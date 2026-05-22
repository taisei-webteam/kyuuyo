import { useState, useMemo, useCallback, type KeyboardEvent } from 'react'
import type { ReactElement, ChangeEvent } from 'react'
import {
  getEmployees,
  getPayslips,
  isPayslipsCreated,
  type MockPayslip,
} from '@/lib/mock-data'
import { PayrollReportModal } from '@/components/PayrollReportModal'
import styles from './PayslipHistory.module.css'

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

interface EditablePayslip extends MockPayslip {
  employeeName: string
  employeeType: string
  displayOrder: number
}

export function PayslipHistory(): ReactElement {
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(5)
  const [showReport, setShowReport] = useState(false)

  const employees = useMemo(() => getEmployees(), [])
  const basePayslips = useMemo(
    () => getPayslips(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  )

  const initialData = useMemo((): EditablePayslip[] => {
    const empOrder = new Map(employees.map((e, i) => [e.id, i]))
    return basePayslips
      .map((ps) => {
        const emp = employees.find((e) => e.id === ps.employeeId)
        return {
          ...ps,
          employeeName: emp?.name ?? '',
          employeeType: emp?.employeeType ?? '',
          displayOrder: emp?.displayOrder ?? 0,
        }
      })
      .sort((a, b) => (empOrder.get(a.employeeId) ?? 0) - (empOrder.get(b.employeeId) ?? 0))
  }, [basePayslips, employees])

  const [editData, setEditData] = useState<EditablePayslip[]>(initialData)

  useState(() => {
    setEditData(initialData)
  })

  const handleChange = useCallback(
    (idx: number, field: keyof MockPayslip, value: number): void => {
      setEditData((prev) => {
        const updated = [...prev]
        const row = { ...updated[idx], [field]: value }

        row.totalPayment =
          row.basicSalary +
          row.overtimePay +
          row.transportAllowance +
          row.positionAllowance +
          row.familyAllowance +
          row.specialAllowance +
          row.dangerAllowance +
          row.salesAllowance +
          row.otherAllowance

        row.totalDeduction =
          row.healthInsurance +
          row.nursingInsurance +
          row.welfarePension +
          row.employmentInsurance +
          row.incomeTax +
          row.residentTax +
          row.savingsDeduction +
          row.loanDeduction +
          row.otherDeduction

        row.netPayment = row.totalPayment - row.totalDeduction

        updated[idx] = row
        return updated
      })
    },
    [],
  )

  const columns: {
    key: keyof MockPayslip
    label: string
    editable: boolean
    group: string
  }[] = [
    { key: 'workDays', label: '労働日数', editable: true, group: '勤怠' },
    { key: 'workHours', label: '労働時間', editable: true, group: '勤怠' },
    { key: 'overtimeHours', label: '残業時間', editable: true, group: '勤怠' },
    { key: 'holidayWorkDays', label: '休日出勤', editable: true, group: '勤怠' },
    { key: 'basicSalary', label: '基本給', editable: true, group: '支給' },
    { key: 'overtimePay', label: '残業手当', editable: true, group: '支給' },
    { key: 'transportAllowance', label: '通勤手当', editable: true, group: '支給' },
    { key: 'positionAllowance', label: '役職手当', editable: true, group: '支給' },
    { key: 'familyAllowance', label: '家族手当', editable: true, group: '支給' },
    { key: 'specialAllowance', label: '特別手当', editable: true, group: '支給' },
    { key: 'dangerAllowance', label: '危険手当', editable: true, group: '支給' },
    { key: 'salesAllowance', label: '営業手当', editable: true, group: '支給' },
    { key: 'otherAllowance', label: 'その他手当', editable: true, group: '支給' },
    { key: 'totalPayment', label: '支給合計', editable: false, group: '支給' },
    { key: 'healthInsurance', label: '健康保険', editable: true, group: '控除' },
    { key: 'nursingInsurance', label: '介護保険', editable: true, group: '控除' },
    { key: 'welfarePension', label: '厚生年金', editable: true, group: '控除' },
    { key: 'employmentInsurance', label: '雇用保険', editable: true, group: '控除' },
    { key: 'incomeTax', label: '所得税', editable: true, group: '控除' },
    { key: 'residentTax', label: '住民税', editable: true, group: '控除' },
    { key: 'savingsDeduction', label: '積立金', editable: true, group: '控除' },
    { key: 'loanDeduction', label: '貸付', editable: true, group: '控除' },
    { key: 'otherDeduction', label: 'その他', editable: true, group: '控除' },
    { key: 'totalDeduction', label: '控除合計', editable: false, group: '控除' },
    { key: 'netPayment', label: '差引支給額', editable: false, group: '合計' },
  ]

  const created = useMemo(
    () => isPayslipsCreated(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const nextRow = rowIdx + 1
        const next = document.querySelector<HTMLInputElement>(
          `input[data-row="${nextRow}"][data-col="${colIdx}"]`,
        )
        if (next) {
          next.focus()
          next.select()
        }
      }
    },
    [],
  )

  const payGroups = ['勤怠', '支給', '控除', '合計'] as const
  const groupCounts = payGroups.map(
    (g) => columns.filter((c) => c.group === g).length,
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>給与一括編集</h1>
          <div className={styles.periodSelector}>
            <select
              className={styles.select}
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value))
              }}
            >
              {[2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
            <select
              className={styles.select}
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(Number(e.target.value))
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>
        </div>
        {created && (
          <div className={styles.headerActions}>
            <div className={styles.legend}>
              <span className={styles.legendEditable}>編集可能</span>
              <span className={styles.legendTotal}>自動合計</span>
            </div>
            <button
              className={styles.btnSecondary}
              onClick={() => setShowReport(true)}
            >
              給与一覧表
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => window.print()}
            >
              印刷
            </button>
            <button
              className={styles.btnPrimary}
              onClick={() => alert('保存しました（モック）')}
            >
              保存
            </button>
          </div>
        )}
      </div>

      <div className={styles.printTitle}>
        {selectedYear}年{String(selectedMonth).padStart(2, '0')}月分　給与一覧
      </div>

      {created ? (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.groupRow}>
                <th
                  rowSpan={2}
                  style={{ position: 'sticky', left: 0, top: 0, zIndex: 31, background: '#f8fafc', minWidth: 120, borderBottom: '2px solid var(--color-border)', padding: '6px 14px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}
                >
                  氏名
                </th>
                <th
                  rowSpan={2}
                  style={{ position: 'sticky', left: 120, top: 0, zIndex: 31, background: '#f8fafc', minWidth: 64, borderBottom: '2px solid var(--color-border)', padding: '6px 14px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-text-secondary)', boxShadow: '2px 0 4px rgba(0,0,0,0.08)' }}
                >
                  区分
                </th>
                {payGroups.map((g, i) => (
                  <th
                    key={g}
                    colSpan={groupCounts[i]}
                    className={`${styles.groupHeader} ${styles[`group${g}`]}`}
                  >
                    {g}
                  </th>
                ))}
              </tr>
              <tr>
                {columns.map((col) => {
                  const isTotal = col.key === 'totalPayment' || col.key === 'totalDeduction' || col.key === 'netPayment'
                  return (
                    <th
                      key={col.key}
                      className={`${styles.th} ${isTotal ? styles.thTotal : ''}`}
                    >
                      {col.label}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {editData.map((row, rowIdx) => (
                <tr key={row.employeeId} className={styles.bodyRow}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 10, background: 'var(--color-surface)', minWidth: 120, padding: '6px 14px', borderBottom: '1px solid var(--color-border)' }}>
                    <span className={styles.empName}>{row.employeeName}</span>
                  </td>
                  <td style={{ position: 'sticky', left: 120, zIndex: 10, background: 'var(--color-surface)', minWidth: 64, padding: '6px 10px', borderBottom: '1px solid var(--color-border)', boxShadow: '2px 0 4px rgba(0,0,0,0.08)' }}>
                    <span className={`${styles.badge} ${styles[`badge${row.employeeType}`]}`}>
                      {row.employeeType}
                    </span>
                  </td>
                  {columns.map((col, colIdx) => {
                    const val = row[col.key] as number
                    const isTotal = col.key === 'totalPayment' || col.key === 'totalDeduction' || col.key === 'netPayment'
                    if (col.editable) {
                      return (
                        <td key={col.key} className={styles.tdEditable}>
                          <input
                            type="number"
                            className={styles.cellInput}
                            value={val}
                            data-row={rowIdx}
                            data-col={colIdx}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              handleChange(rowIdx, col.key, Number(e.target.value))
                            }
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                            min={0}
                          />
                        </td>
                      )
                    }
                    return (
                      <td
                        key={col.key}
                        className={`${styles.tdReadonly} ${isTotal ? styles.tdTotal : ''}`}
                      >
                        {yen(val)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.footRow}>
                <td style={{ position: 'sticky', left: 0, zIndex: 16, background: '#f1f5f9', minWidth: 120, padding: '8px 14px', borderTop: '2px solid var(--color-border)', fontWeight: 700, fontSize: '0.8125rem', textAlign: 'left' as const }}>
                  合計
                </td>
                <td style={{ position: 'sticky', left: 120, zIndex: 16, background: '#f1f5f9', minWidth: 64, padding: '8px 10px', borderTop: '2px solid var(--color-border)', boxShadow: '2px 0 4px rgba(0,0,0,0.08)' }}>
                </td>
                {columns.map((col) => {
                  const sum = editData.reduce(
                    (s, row) => s + (row[col.key] as number),
                    0,
                  )
                  const isTotal = col.key === 'totalPayment' || col.key === 'totalDeduction' || col.key === 'netPayment'
                  return (
                    <td key={col.key} className={`${styles.tdFooter} ${isTotal ? styles.tdFooterTotal : ''}`}>
                      {yen(Math.round(sum))}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className={styles.notCreated}>
          <div className={styles.notCreatedIcon}>📋</div>
          <h2 className={styles.notCreatedTitle}>{selectedYear}年{selectedMonth}月分の給与データ</h2>
          <p className={styles.notCreatedDesc}>
            給与作成画面で先にデータを作成してください。
          </p>
        </div>
      )}

      {showReport && created && (
        <PayrollReportModal
          payslips={editData}
          year={selectedYear}
          month={selectedMonth}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}
