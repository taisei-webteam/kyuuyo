import { useState, useEffect, useMemo, useCallback } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { AttendanceRecord } from '../../../shared/types'
import { getEmployees, mapDbEmployeeToMock, isEmployedInMonth, type MockEmployee } from '@/lib/mock-data'
import { getSettings } from '@/lib/settings-store'
import { scheduledWorkMinutes, paidLeaveSupplementMinutes, partTimeLaborMinutes, unpaidGoOutMinutes } from '@/lib/time-rounding'
import { triggerPrint } from '@/lib/print'
import { useOverlayDismiss } from '@/hooks/useOverlayDismiss'
import styles from './AttendanceBookModal.module.css'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

interface Props {
  year: number
  month: number
  /** 指定時はその従業員のみを出力する（選択者版）。未指定は全員一括版。 */
  employeeId?: number
  onClose: () => void
}

/** 分を小数時間の文字列にする（例: 480→"8", 30→"0.5", 0→"0"）。 */
function fmtHours(minutes: number): string {
  if (!minutes || minutes <= 0) return '0'
  return String(parseFloat((minutes / 60).toFixed(2)))
}

/** "HH:MM:SS" / "HH:MM" を "HH:MM" に切り詰める。null は空欄。 */
function hm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : ''
}

function isPaidLeaveDay(r: AttendanceRecord | undefined): boolean {
  return !!r?.paidLeaveUsage
}

/** 実働時間（残業を除く）。workMinutes には残業分が含まれるため差し引く。 */
function regularWorkMinutes(workMinutes: number, overtimeMinutes: number): number {
  return Math.max(0, workMinutes - overtimeMinutes)
}

/** パートは打刻から定時外を時間外として引き直す。保存値が古くても出勤簿と給与を揃える。 */
function partTimeSplit(
  r: AttendanceRecord,
  emp: MockEmployee,
): { workMinutes: number; overtimeMinutes: number } | null {
  if (!r.clockIn || !r.clockOut) return null
  const settings = getSettings()
  const labor = partTimeLaborMinutes(
    r.clockIn,
    r.clockOut,
    emp.scheduledStart,
    emp.scheduledEnd,
    emp.earlyWorkStart,
    settings.earlyRoundingUnit,
    unpaidGoOutMinutes(r.goOut, r.goReturn),
    settings.defaultBreakMinutes,
  )
  return { workMinutes: labor.workMinutes, overtimeMinutes: labor.overtimeMinutes }
}

/** タイムカード実働に確定有給の不足分を足した労働時間（分）。残業は含めない。 */
function laborMinutesForBook(r: AttendanceRecord, emp: MockEmployee | undefined): number {
  const settings = getSettings()
  const scheduled = scheduledWorkMinutes(
    emp?.scheduledStart ?? '09:00',
    emp?.scheduledEnd ?? '17:30',
    settings.defaultBreakMinutes,
  )
  const part = emp?.employeeType === 'パート' ? partTimeSplit(r, emp) : null
  const timecard = part?.workMinutes ?? r.workMinutes
  const withLeave = timecard + paidLeaveSupplementMinutes(
    r.paidLeaveUsage,
    r.paidLeaveStatus,
    timecard,
    scheduled,
  )
  if (part) return withLeave
  return regularWorkMinutes(withLeave, r.overtimeMinutes)
}

function overtimeMinutesForBook(r: AttendanceRecord, emp: MockEmployee | undefined): number {
  if (emp?.employeeType === 'パート') {
    return partTimeSplit(r, emp)?.overtimeMinutes ?? r.overtimeMinutes
  }
  return r.overtimeMinutes
}

export function AttendanceBookModal({ year, month, employeeId, onClose }: Props): ReactElement {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [employees, setEmployees] = useState<MockEmployee[]>(() => getEmployees())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hasElectronApi) {
      setError('Electron モードで起動してください')
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [recRes, empRes] = await Promise.all([
          window.api.attendance.list(year, month),
          window.api.employees.list(),
        ])
        if (cancelled) return
        if (!recRes.success) {
          setError(recRes.error)
          return
        }
        setRecords(recRes.data)
        if (empRes.success) {
          setEmployees(empRes.data.filter((e) => e.isActive).map(mapDbEmployeeToMock))
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '取得に失敗しました')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [year, month])

  const empMap = useMemo(() => {
    const m = new Map<number, MockEmployee>()
    for (const e of employees) m.set(e.id, e)
    return m
  }, [employees])

  // 月の全日（休日含む）
  const monthDays = useMemo(() => {
    const count = new Date(year, month, 0).getDate()
    const days: { dateStr: string; label: string; dow: number }[] = []
    for (let d = 1; d <= count; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dow = new Date(year, month - 1, d).getDay()
      days.push({
        dateStr,
        label: `${month}月${String(d).padStart(2, '0')}日(${WEEKDAY_LABELS[dow]})`,
        dow,
      })
    }
    return days
  }, [year, month])

  // 従業員ごとの「日付 → 勤怠レコード」対応表
  const recByEmp = useMemo(() => {
    const map = new Map<number, Map<string, AttendanceRecord>>()
    for (const r of records) {
      let m = map.get(r.employeeId)
      if (!m) {
        m = new Map<string, AttendanceRecord>()
        map.set(r.employeeId, m)
      }
      m.set(r.date, r)
    }
    return map
  }, [records])

  // 出力対象の従業員。役員は打刻をしないため出勤簿の対象外にする。
  // 全員版: 在籍かつ役員以外で、当月の勤怠レコードがある人。
  // 選択者版: 指定従業員（役員なら対象外）。
  const sections = useMemo(() => {
    const isTarget = (emp: MockEmployee | undefined): emp is MockEmployee =>
      !!emp && emp.employeeType !== '役員' && isEmployedInMonth(emp, year, month)

    if (employeeId !== undefined) {
      const emp = empMap.get(employeeId)
      if (!isTarget(emp)) return []
      return [{ emp, byDate: recByEmp.get(employeeId) ?? new Map<string, AttendanceRecord>() }]
    }

    return employees
      .filter((emp) => isTarget(emp) && recByEmp.has(emp.id))
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((emp) => ({ emp, byDate: recByEmp.get(emp.id) ?? new Map<string, AttendanceRecord>() }))
  }, [employeeId, empMap, employees, recByEmp, year, month])

  const sheetTitle = `${year}年${String(month).padStart(2, '0')}月分　出勤簿`

  const titleLabel = useMemo(() => {
    if (employeeId === undefined) return `${year}年${month}月`
    const name = empMap.get(employeeId)?.name ?? `ID:${employeeId}`
    return `${name}（${year}年${month}月）`
  }, [employeeId, empMap, year, month])

  const overlay = useOverlayDismiss(onClose)

  const handlePrint = useCallback(async (): Promise<void> => {
    const exportPdf = window.api?.export?.pdf
    if (typeof exportPdf !== 'function') {
      triggerPrint({ orientation: 'portrait', mode: 'modal', size: 'A4' })
      return
    }
    const ym = `${year}-${String(month).padStart(2, '0')}`
    const fileName =
      employeeId === undefined
        ? `${ym}_出勤簿`
        : `${ym}_出勤簿_${empMap.get(employeeId)?.name ?? `ID${employeeId}`}`
    setBusy(true)
    document.body.classList.add('is-printing-modal')
    try {
      const result = await exportPdf({ fileName, pageSize: 'A4', landscape: false })
      if (!result.success) {
        alert(`PDF出力に失敗しました: ${result.error}`)
      }
    } catch (err) {
      alert(`PDF出力に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      document.body.classList.remove('is-printing-modal')
      setBusy(false)
    }
  }, [year, month, employeeId, empMap])

  return createPortal(
    <div className={`${styles.overlay} printScope`} {...overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>出勤簿 — {titleLabel}</h2>
          <div className={styles.headerRight}>
            <div className={styles.headerActions}>
              <button className={styles.printButton} onClick={handlePrint} disabled={busy || sections.length === 0}>
                {busy ? 'PDF生成中...' : `PDF出力（${sections.length}名）`}
              </button>
              <button className={styles.closeButton} onClick={onClose}>✕</button>
            </div>
          </div>
        </div>

        <div className={styles.body}>
          {loading && <div className={styles.status}>読み込み中...</div>}
          {error && <div className={styles.status}>{error}</div>}
          {!loading && !error && sections.length === 0 && (
            <div className={styles.status}>出力対象の勤怠データがありません</div>
          )}

          {!loading && !error && sections.map(({ emp, byDate }) => {
            let totalWork = 0
            let totalOvertime = 0
            let totalBreak = 0
            for (const r of byDate.values()) {
              totalWork += laborMinutesForBook(r, emp)
              totalOvertime += overtimeMinutesForBook(r, emp)
              totalBreak += r.breakMinutes
            }
            return (
              <section key={emp.id} className={styles.employeeSection}>
                <div className={styles.sheetHead}>
                  <h3 className={styles.sheetTitle}>{sheetTitle}</h3>
                </div>
                <div className={styles.employeeInfo}>
                  <span className={styles.infoLabel}>氏名</span>
                  <span className={styles.infoValue}>{emp.name}</span>
                  {emp.employeeType === 'パート' && (
                    <>
                      <span className={styles.infoLabel}>時給</span>
                      <span className={styles.infoValue}>{emp.hourlyRate}</span>
                    </>
                  )}
                </div>
                <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.colDate}>日付</th>
                      <th className={styles.colTime}>出勤</th>
                      <th className={styles.colTime}>退勤</th>
                      <th className={styles.colHours}>実働時間</th>
                      <th className={styles.colHours}>残業時間</th>
                      <th className={styles.colBreak}>差引</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthDays.map((day) => {
                      const r = byDate.get(day.dateStr)
                      return (
                        <tr key={day.dateStr}>
                          <td className={`${styles.dateCell} ${styles.colDate}`}>
                            <span className={styles.leaveMark}>{isPaidLeaveDay(r) ? '(有給)' : ''}</span>
                            <span>{day.label}</span>
                          </td>
                          <td className={styles.colTime}>{hm(r?.clockIn)}</td>
                          <td className={styles.colTime}>{hm(r?.clockOut)}</td>
                          <td className={`${styles.num} ${styles.colHours}`}>{fmtHours(r ? laborMinutesForBook(r, emp) : 0)}</td>
                          <td className={`${styles.num} ${styles.colHours}`}>{fmtHours(r ? overtimeMinutesForBook(r, emp) : 0)}</td>
                          <td className={`${styles.num} ${styles.colBreak}`}>{fmtHours(r?.breakMinutes ?? 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
                <table className={styles.summary}>
                  <tbody>
                    <tr>
                      <th rowSpan={2} className={styles.summaryTotal}>合計</th>
                      <th>実働時間</th>
                      <th>残業時間</th>
                      <th>差引</th>
                    </tr>
                    <tr>
                      <td className={styles.num}>{fmtHours(totalWork)}</td>
                      <td className={styles.num}>{fmtHours(totalOvertime)}</td>
                      <td className={styles.num}>{fmtHours(totalBreak)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
