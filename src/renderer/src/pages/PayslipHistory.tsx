import { useState, useMemo, useCallback, useEffect, type KeyboardEvent } from 'react'
import type { ReactElement, ChangeEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  getEmployees,
  getPayslips,
  isPayslipsCreated,
  type MockPayslip,
} from '@/lib/mock-data'
import { PayrollReportModal } from '@/components/PayrollReportModal'
import styles from './PayslipHistory.module.css'

function num(amount: number): string {
  if (amount === 0) return '0'
  return amount.toLocaleString('ja-JP')
}

interface EditablePayslip extends MockPayslip {
  employeeName: string
  employeeType: string
  displayOrder: number
}

type PayField = keyof MockPayslip

interface Column {
  key: PayField
  label: string
  editable: boolean
}

const PAY_COLUMNS: Column[] = [
  { key: 'basicSalary', label: '基本給', editable: true },
  { key: 'overtimePay', label: '残業手当', editable: true },
  { key: 'familyAllowance', label: '家族手当', editable: true },
  { key: 'specialAllowance', label: '特別手当', editable: true },
  { key: 'positionAllowance', label: '役職手当', editable: true },
  { key: 'transportAllowance', label: '交通費', editable: true },
  { key: 'salesAllowance', label: '営業手当', editable: true },
  { key: 'dangerAllowance', label: '危険手当', editable: true },
  { key: 'totalPayment', label: '支払合計', editable: false },
]

const DEDUCT_COLUMNS: Column[] = [
  { key: 'healthInsurance', label: '健康保険', editable: true },
  { key: 'nursingInsurance', label: '介護保険', editable: true },
  { key: 'welfarePension', label: '厚生年金', editable: true },
  { key: 'employmentInsurance', label: '雇用保険', editable: true },
  { key: 'incomeTax', label: '所得税', editable: true },
  { key: 'residentTax', label: '住民税', editable: true },
  { key: 'savingsDeduction', label: '積立', editable: true },
  { key: 'loanDeduction', label: '貸付', editable: true },
  { key: 'otherDeduction', label: '共済掛金', editable: true },
  { key: 'totalDeduction', label: '控除合計', editable: false },
]

const ALL_COLUMNS: Column[] = [...PAY_COLUMNS, ...DEDUCT_COLUMNS]

export function PayslipHistory(): ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as { year?: number; month?: number } | null
  const [selectedYear, setSelectedYear] = useState(navState?.year ?? 2026)
  const [selectedMonth, setSelectedMonth] = useState(navState?.month ?? 5)
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

  // 年月の切替で initialData が再計算されたら編集データを同期する。
  // (旧コードは useState の初期化関数で 1 度しか実行されず、期間変更が反映されなかった)
  useEffect(() => {
    setEditData(initialData)
  }, [initialData])

  const handleChange = useCallback(
    (idx: number, field: PayField, value: number): void => {
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

  const totals = useMemo(() => {
    const t = {
      workDays: 0, netPayment: 0,
      basicSalary: 0, overtimePay: 0, familyAllowance: 0, specialAllowance: 0,
      positionAllowance: 0, transportAllowance: 0, salesAllowance: 0, dangerAllowance: 0,
      totalPayment: 0,
      healthInsurance: 0, nursingInsurance: 0, welfarePension: 0, employmentInsurance: 0,
      incomeTax: 0, residentTax: 0, savingsDeduction: 0, loanDeduction: 0, otherDeduction: 0,
      totalDeduction: 0,
    }
    for (const r of editData) {
      for (const k of Object.keys(t) as (keyof typeof t)[]) {
        (t[k] as number) += r[k]
      }
    }
    return t
  }, [editData])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.btnBack}
            onClick={() => navigate('/payslip')}
            type="button"
          >
            ← 給与作成へ戻る
          </button>
          <div className={styles.periodSelector}>
            <select
              className={styles.select}
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
            <select
              className={styles.select}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
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
              PDF出力 / 印刷
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
                <th rowSpan={2} className={styles.thName}>氏名</th>
                <th rowSpan={2} className={styles.thSmall}>労働<br />日数</th>
                <th rowSpan={2} className={styles.thNetPay}>振込額</th>
                <th colSpan={PAY_COLUMNS.length} className={styles.thGroupPay}>支　払</th>
                <th colSpan={DEDUCT_COLUMNS.length} className={styles.thGroupDeduct}>控　除</th>
              </tr>
              <tr>
                {ALL_COLUMNS.map((col) => {
                  const isTotal = col.key === 'totalPayment' || col.key === 'totalDeduction'
                  return (
                    <th key={col.key} className={`${styles.th} ${isTotal ? styles.thTotal : ''}`}>
                      {col.label}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {editData.map((row, rowIdx) => (
                <tr key={row.employeeId} className={styles.bodyRow}>
                  <td className={styles.tdName}>
                    <span className={styles.empName}>{row.employeeName}</span>
                  </td>
                  <td className={styles.tdNum}>
                    <input
                      type="number"
                      className={styles.cellInputSmall}
                      value={row.workDays}
                      data-row={rowIdx}
                      data-col={-1}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleChange(rowIdx, 'workDays', Number(e.target.value))
                      }
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, -1)}
                      min={0}
                    />
                  </td>
                  <td className={styles.tdNetPay}>{num(row.netPayment)}</td>
                  {ALL_COLUMNS.map((col, colIdx) => {
                    const val = row[col.key] as number
                    const isTotal = col.key === 'totalPayment' || col.key === 'totalDeduction'
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
                      <td key={col.key} className={`${styles.tdReadonly} ${isTotal ? styles.tdTotal : ''}`}>
                        {num(val)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td className={styles.tdNameFoot}>合計</td>
                <td className={styles.tdNumFoot}></td>
                <td className={styles.tdNetPayFoot}>{num(totals.netPayment)}</td>
                {ALL_COLUMNS.map((col) => {
                  const val = totals[col.key as keyof typeof totals] as number | undefined
                  const isTotal = col.key === 'totalPayment' || col.key === 'totalDeduction'
                  return (
                    <td key={col.key} className={`${styles.tdFoot} ${isTotal ? styles.tdFootTotal : ''}`}>
                      {val !== undefined ? num(Math.round(val)) : ''}
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
