import { useState, useEffect, useMemo } from 'react'
import type { ReactElement } from 'react'
import type { RawPunch } from '../../../shared/types'
import { getEmployees } from '@/lib/mock-data'
import styles from './RawPunchModal.module.css'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

interface Props {
  year: number
  month: number
  onClose: () => void
}

export function RawPunchModal({ year, month, onClose }: Props): ReactElement {
  const [data, setData] = useState<RawPunch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const grouped = useMemo(() => {
    const map = new Map<number, RawPunch[]>()
    for (const d of data) {
      const arr = map.get(d.employeeId) ?? []
      arr.push(d)
      map.set(d.employeeId, arr)
    }
    return map
  }, [data])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>実打刻一覧 — {year}年{month}月</h2>
          <div className={styles.headerActions}>
            <button
              className={styles.printButton}
              onClick={() => window.print()}
            >
              印刷
            </button>
            <button className={styles.closeButton} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className={styles.body}>
          {loading && <div className={styles.status}>読み込み中...</div>}
          {error && <div className={styles.status}>{error}</div>}
          {!loading && !error && data.length === 0 && (
            <div className={styles.status}>実打刻データがありません</div>
          )}

          {!loading && !error && Array.from(grouped.entries()).map(([empId, punches]) => (
            <div key={empId} className={styles.employeeSection}>
              <h3 className={styles.employeeName}>{empMap.get(empId) ?? `ID:${empId}`}</h3>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>実出勤打刻</th>
                    <th>実退勤打刻</th>
                    <th>同期日時</th>
                  </tr>
                </thead>
                <tbody>
                  {punches.map((p) => (
                    <tr key={p.id}>
                      <td>{p.date}</td>
                      <td>{p.rawClockIn ?? '-'}</td>
                      <td>{p.rawClockOut ?? '-'}</td>
                      <td className={styles.syncedAt}>{p.syncedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
