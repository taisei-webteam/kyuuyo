import { useState, useEffect, useMemo, useCallback } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { AttendanceRecord } from '../../../shared/types'
import { getEmployees, mapDbEmployeeToMock, isEmployedInMonth, type MockEmployee } from '@/lib/mock-data'
import { getSettings } from '@/lib/settings-store'
import { triggerPrint } from '@/lib/print'
import { useOverlayDismiss } from '@/hooks/useOverlayDismiss'
import styles from './AttendanceBookModal.module.css'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

// 会社ロゴ。src/assets/logo-dark.(png|jpg|jpeg|svg|webp) を置くと自動で読み込まれる。
const logoModules = import.meta.glob<{ default: string }>(
  '../assets/logo-dark.{png,jpg,jpeg,svg,webp}',
  { eager: true },
)
const companyLogoSrc: string | undefined = Object.values(logoModules)[0]?.default

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

/** 実働時間（残業を除く）。workMinutes には残業分が含まれるため差し引く。 */
function regularWorkMinutes(workMinutes: number, overtimeMinutes: number): number {
  return Math.max(0, workMinutes - overtimeMinutes)
}

export function AttendanceBookModal({ year, month, employeeId, onClose }: Props): ReactElement {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [employees, setEmployees] = useState<MockEmployee[]>(() => getEmployees())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const companyName = useMemo(() => getSettings().companyName, [])

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
      days.push({ dateStr, label: `${month}/${d}（${WEEKDAY_LABELS[dow]}）`, dow })
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
            {companyLogoSrc ? (
              <img src={companyLogoSrc} alt={companyName} className={styles.headerLogo} />
            ) : companyName ? (
              <span className={styles.headerCompany}>{companyName}</span>
            ) : null}
            <div className={styles.headerActions}>
              <button className={styles.printButton} onClick={handlePrint} disabled={busy}>
                {busy ? 'PDF生成中...' : 'PDF出力'}
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
              totalWork += regularWorkMinutes(r.workMinutes, r.overtimeMinutes)
              totalOvertime += r.overtimeMinutes
              totalBreak += r.breakMinutes
            }
            return (
              <div key={emp.id} className={styles.employeeSection}>
                <div className={styles.sheetHead}>
                  <h3 className={styles.sheetTitle}>{sheetTitle}</h3>
                  {companyLogoSrc ? (
                    <img src={companyLogoSrc} alt={companyName} className={styles.sheetLogo} />
                  ) : companyName ? (
                    <span className={styles.sheetCompany}>{companyName}</span>
                  ) : null}
                </div>
                <div className={styles.employeeInfo}>
                  <span className={styles.employeeName}>氏名　{emp.name}</span>
                  {emp.employeeType === 'パート' && (
                    <span className={styles.employeeRate}>
                      時給　¥{emp.hourlyRate.toLocaleString('ja-JP')}
                    </span>
                  )}
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>日付</th>
                      <th>出勤</th>
                      <th>退勤</th>
                      <th>実働時間</th>
                      <th>残業時間</th>
                      <th>差引</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthDays.map((day) => {
                      const r = byDate.get(day.dateStr)
                      const dateClass =
                        day.dow === 0 ? styles.daySun : day.dow === 6 ? styles.daySat : undefined
                      return (
                        <tr key={day.dateStr}>
                          <td className={dateClass}>{day.label}</td>
                          <td>{hm(r?.clockIn)}</td>
                          <td>{hm(r?.clockOut)}</td>
                          <td className={styles.num}>
                            {fmtHours(regularWorkMinutes(r?.workMinutes ?? 0, r?.overtimeMinutes ?? 0))}
                          </td>
                          <td className={styles.num}>{fmtHours(r?.overtimeMinutes ?? 0)}</td>
                          <td className={styles.num}>{fmtHours(r?.breakMinutes ?? 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={styles.totalRow}>
                      <td>合計</td>
                      <td></td>
                      <td></td>
                      <td className={styles.num}>{fmtHours(totalWork)}</td>
                      <td className={styles.num}>{fmtHours(totalOvertime)}</td>
                      <td className={styles.num}>{fmtHours(totalBreak)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
