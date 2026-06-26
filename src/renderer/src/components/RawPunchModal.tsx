import { useState, useEffect, useMemo, useCallback } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { RawPunch } from '../../../shared/types'
import { getEmployees } from '@/lib/mock-data'
import { getSettings } from '@/lib/settings-store'
import { triggerPrint } from '@/lib/print'
import { useOverlayDismiss } from '@/hooks/useOverlayDismiss'
import styles from './RawPunchModal.module.css'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

// 会社ロゴ。src/assets/logo-dark.(png|jpg|jpeg|svg|webp) を置くと自動で読み込まれる。
// 未配置の場合は会社名テキストにフォールバックする。
const logoModules = import.meta.glob<{ default: string }>(
  '../assets/logo-dark.{png,jpg,jpeg,svg,webp}',
  { eager: true },
)
const companyLogoSrc: string | undefined = Object.values(logoModules)[0]?.default

interface Props {
  year: number
  month: number
  /** 指定時はその従業員のみを表示・出力する（選択者版）。未指定は全員一括版。 */
  employeeId?: number
  onClose: () => void
}

export function RawPunchModal({ year, month, employeeId, onClose }: Props): ReactElement {
  const [data, setData] = useState<RawPunch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const companyName = useMemo(() => getSettings().companyName, [])
  const employees = useMemo(() => getEmployees(), [])
  const empMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const e of employees) m.set(e.id, e.name)
    return m
  }, [employees])

  useEffect(() => {
    if (!hasElectronApi) {
      setError('Electron モードで起動してください')
      setLoading(false)
      return
    }
    (async () => {
      try {
        const result = await window.api.attendance.rawList(year, month)
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '取得に失敗しました')
      } finally {
        setLoading(false)
      }
    })()
  }, [year, month])

  // 月の全日（休日含む）を生成する
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

  // 従業員ごとに「日付 → 実打刻」の対応表を作る。
  // 選択者版はデータが無くても当該従業員を表示し、全日を空欄で出力する。
  const employeeSections = useMemo(() => {
    const byEmp = new Map<number, Map<string, RawPunch>>()
    for (const d of data) {
      if (employeeId !== undefined && d.employeeId !== employeeId) continue
      let m = byEmp.get(d.employeeId)
      if (!m) {
        m = new Map<string, RawPunch>()
        byEmp.set(d.employeeId, m)
      }
      m.set(d.date, d)
    }
    const ids = employeeId !== undefined ? [employeeId] : Array.from(byEmp.keys())
    return ids.map((id) => ({ id, byDate: byEmp.get(id) ?? new Map<string, RawPunch>() }))
  }, [data, employeeId])

  const titleLabel = useMemo(() => {
    if (employeeId === undefined) return `${year}年${month}月`
    const name = empMap.get(employeeId) ?? `ID:${employeeId}`
    return `${name}（${year}年${month}月）`
  }, [employeeId, empMap, year, month])

  const overlay = useOverlayDismiss(onClose)

  const handlePrint = useCallback(async (): Promise<void> => {
    const exportPdf = window.api?.export?.pdf
    if (typeof exportPdf !== 'function') {
      // ブラウザ(Vite単体) または preload未更新時は従来の印刷ダイアログにフォールバック
      triggerPrint({ orientation: 'portrait', mode: 'modal', size: 'A4' })
      return
    }

    const ym = `${year}-${String(month).padStart(2, '0')}`
    const fileName =
      employeeId === undefined
        ? `${ym}_実打刻一覧`
        : `${ym}_実打刻一覧_${empMap.get(employeeId) ?? `ID${employeeId}`}`
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
          <h2 className={styles.title}>実打刻一覧 — {titleLabel}</h2>
          <div className={styles.headerRight}>
            {companyLogoSrc ? (
              <img src={companyLogoSrc} alt={companyName} className={styles.headerLogo} />
            ) : companyName ? (
              <span className={styles.headerCompany}>{companyName}</span>
            ) : null}
            <div className={styles.headerActions}>
              <button
                className={styles.printButton}
                onClick={handlePrint}
                disabled={busy}
              >
                {busy ? 'PDF生成中...' : 'PDF出力'}
              </button>
              <button className={styles.closeButton} onClick={onClose}>✕</button>
            </div>
          </div>
        </div>

        <div className={styles.body}>
          {loading && <div className={styles.status}>読み込み中...</div>}
          {error && <div className={styles.status}>{error}</div>}
          {!loading && !error && employeeSections.length === 0 && (
            <div className={styles.status}>実打刻データがありません</div>
          )}

          {!loading && !error && employeeSections.map(({ id, byDate }) => (
            <div key={id} className={styles.employeeSection}>
              <h3 className={styles.employeeName}>{empMap.get(id) ?? `ID:${id}`}</h3>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>出勤</th>
                    <th>退勤</th>
                    <th>外出</th>
                    <th>戻り</th>
                  </tr>
                </thead>
                <tbody>
                  {monthDays.map((day) => {
                    const p = byDate.get(day.dateStr)
                    const dateClass =
                      day.dow === 0 ? styles.daySun : day.dow === 6 ? styles.daySat : undefined
                    return (
                      <tr key={day.dateStr}>
                        <td className={dateClass}>{day.label}</td>
                        <td>{p?.rawClockIn ?? '-'}</td>
                        <td>{p?.rawClockOut ?? '-'}</td>
                        <td>{p?.rawGoOut ?? '-'}</td>
                        <td>{p?.rawGoReturn ?? '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
