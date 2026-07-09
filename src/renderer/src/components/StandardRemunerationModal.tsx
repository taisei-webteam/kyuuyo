import { useState, useMemo, useEffect, useCallback } from 'react'
import type { ReactElement } from 'react'
import { reloadEmployeesFromDb, getPayslips, type MockEmployee } from '@/lib/mock-data'
import { buildYearSelectOptions } from '@/lib/year-options'
import { remunerationToStandard } from '../../../shared/standard-remuneration-jp'
import styles from './StandardRemunerationModal.module.css'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window
const TARGET_MONTHS = [4, 5, 6] as const
const MIN_BASE_DAYS = 17

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

interface MonthEntry {
  total: number
  workDays: number
}

/** 従業員ID → { 月 → 実績 } */
type MonthData = Map<number, Map<number, MonthEntry>>

interface Proposal {
  average: number
  standard: number
  grade: number
  monthsUsed: number
  hasLowDays: boolean
}

export function StandardRemunerationModal({
  employees,
  onClose,
  onSaved,
}: {
  employees: MockEmployee[]
  onClose: () => void
  onSaved: () => void
}): ReactElement {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [monthData, setMonthData] = useState<MonthData>(new Map())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<number, boolean>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessage(null)
    void (async () => {
      const data: MonthData = new Map()
      for (const m of TARGET_MONTHS) {
        let rows: Array<{ employeeId: number; totalPayment: number; workDays: number }> = []
        if (hasElectronApi) {
          const res = await window.api.payslips.list(year, m, 'salary')
          if (res.success) rows = res.data
        } else {
          rows = getPayslips(year, m).map((p) => ({
            employeeId: p.employeeId,
            totalPayment: p.totalPayment,
            workDays: p.workDays,
          }))
        }
        for (const r of rows) {
          if (!data.has(r.employeeId)) data.set(r.employeeId, new Map())
          data.get(r.employeeId)!.set(m, { total: r.totalPayment, workDays: r.workDays })
        }
      }
      if (!cancelled) {
        setMonthData(data)
        setSelected({})
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [year])

  const proposals = useMemo(() => {
    const map = new Map<number, Proposal | null>()
    for (const emp of employees) {
      const months = monthData.get(emp.id)
      if (!months || months.size === 0) {
        map.set(emp.id, null)
        continue
      }
      let sum = 0
      let count = 0
      let hasLowDays = false
      for (const m of TARGET_MONTHS) {
        const e = months.get(m)
        if (!e) continue
        sum += e.total
        count++
        if (e.workDays < MIN_BASE_DAYS) hasLowDays = true
      }
      if (count === 0) {
        map.set(emp.id, null)
        continue
      }
      const average = Math.round(sum / count)
      const g = remunerationToStandard(average)
      map.set(emp.id, { average, standard: g.standard, grade: g.grade, monthsUsed: count, hasLowDays })
    }
    return map
  }, [employees, monthData])

  // 提案が現在値と異なる従業員を既定で選択する。
  useEffect(() => {
    const next: Record<number, boolean> = {}
    for (const emp of employees) {
      const p = proposals.get(emp.id)
      if (p && p.standard !== emp.standardMonthlyRemuneration) next[emp.id] = true
    }
    setSelected(next)
  }, [proposals, employees])

  const changedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  )

  const handleToggle = useCallback((id: number, checked: boolean): void => {
    setSelected((prev) => ({ ...prev, [id]: checked }))
  }, [])

  const handleApply = useCallback(async (): Promise<void> => {
    const targets = employees.filter((emp) => {
      const p = proposals.get(emp.id)
      return selected[emp.id] && p && p.standard !== emp.standardMonthlyRemuneration
    })
    if (targets.length === 0) {
      setMessage('反映対象がありません。')
      return
    }
    setBusy(true)
    setMessage('反映中...')
    try {
      if (hasElectronApi) {
        let ok = 0
        for (const emp of targets) {
          const p = proposals.get(emp.id)!
          const res = await window.api.employees.update({ id: emp.id, standardMonthlyRemuneration: p.standard })
          if (res.success) ok++
        }
        await reloadEmployeesFromDb()
        setMessage(
          ok === targets.length
            ? `${ok} 名の標準報酬月額を更新しました`
            : `${ok}/${targets.length} 名を更新しました（一部失敗）`,
        )
      } else {
        setMessage('ブラウザプレビューではDB更新は行われません（Electronで実行してください）')
      }
      onSaved()
    } catch (err) {
      setMessage(`反映に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setBusy(false)
    }
  }, [employees, proposals, selected, onSaved])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>標準報酬月額の定時決定</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className={styles.toolbar}>
          <label>
            対象年:{' '}
            <select className={styles.select} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {buildYearSelectOptions().map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </label>
          <span className={styles.muted}>4〜6月の給与（総支給額）の平均から新しい標準報酬月額を提案します。</span>
        </div>

        <div className={styles.note}>
          この提案は目安です。<strong>支払基礎日数が17日未満の月は本来平均から除外します</strong>
          （該当月は日数を橙色で表示。必要に応じてチェックを外してください）。
          反映前に必ず「標準報酬決定通知書」と照合してください。9月分の給与から適用されます。
        </div>

        <div className={styles.body}>
          {loading ? (
            <p className={styles.muted}>給与データを読み込み中...</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>反映</th>
                  <th>氏名</th>
                  <th className={styles.thRight}>4月</th>
                  <th className={styles.thRight}>5月</th>
                  <th className={styles.thRight}>6月</th>
                  <th className={styles.thRight}>平均</th>
                  <th className={styles.thRight}>現在</th>
                  <th className={styles.thRight}>提案（標準報酬 / 等級）</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const months = monthData.get(emp.id)
                  const p = proposals.get(emp.id)
                  const changed = !!p && p.standard !== emp.standardMonthlyRemuneration
                  return (
                    <tr key={emp.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selected[emp.id]}
                          disabled={!changed}
                          onChange={(e) => handleToggle(emp.id, e.target.checked)}
                        />
                      </td>
                      <td>{emp.name}</td>
                      {TARGET_MONTHS.map((m) => {
                        const e = months?.get(m)
                        return (
                          <td key={m} className={styles.tdRight}>
                            {e ? (
                              <>
                                {yen(e.total)}
                                <span className={`${styles.smallDays} ${e.workDays < MIN_BASE_DAYS ? styles.warnDays : ''}`}>
                                  {e.workDays}日
                                </span>
                              </>
                            ) : (
                              <span className={styles.muted}>-</span>
                            )}
                          </td>
                        )
                      })}
                      <td className={styles.tdRight}>{p ? yen(p.average) : <span className={styles.muted}>-</span>}</td>
                      <td className={styles.tdRight}>{yen(emp.standardMonthlyRemuneration)}</td>
                      <td className={styles.tdRight}>
                        {p ? (
                          <span className={changed ? styles.propose : styles.same}>
                            {yen(p.standard)} / {p.grade}級
                          </span>
                        ) : (
                          <span className={styles.muted}>給与データなし</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.message}>{message}</span>
          <div className={styles.actions}>
            <button className={styles.btnSecondary} onClick={onClose} disabled={busy}>
              キャンセル
            </button>
            <button className={styles.btnPrimary} onClick={() => void handleApply()} disabled={busy || changedCount === 0}>
              {busy ? '反映中...' : `${changedCount} 名に反映`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
