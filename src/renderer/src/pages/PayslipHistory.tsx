import { useState, useMemo, useCallback, useEffect, type KeyboardEvent } from 'react'
import type { ReactElement, ChangeEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  getEmployees,
  getPayslips,
  isPayslipsCreated,
  loadPayslipsFromDb,
  savePayslipsToDb,
  setPayslips,
  firstExtraLineLabel,
  resolveSalaryPaymentExtras,
  sumExtraLines,
  visibleExtraLines,
  type MockPayslip,
  migrateRareDeductionsToFreeSlots,
  FREE_DEDUCTION_SLOTS,
  newExtraLine,
} from '@/lib/mock-data'
import { buildYearSelectOptions } from '@/lib/year-options'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window
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
  { key: 'incomeTax', label: '所得税', editable: true },
  { key: 'healthInsurance', label: '健康・介護', editable: true },
  { key: 'welfarePension', label: '厚生年金', editable: true },
  { key: 'employmentInsurance', label: '雇用保険', editable: true },
  { key: 'residentTax', label: '住民税', editable: true },
]

const PAY_BASE_COLUMNS = PAY_COLUMNS.filter((c) => c.key !== 'totalPayment')
const DEDUCT_BASE_COLUMNS = DEDUCT_COLUMNS
const EXTRA_PAY_LABEL_DEFAULT = '追加支給'

function extraPaymentAmount(row: MockPayslip): number {
  return sumExtraLines(resolveSalaryPaymentExtras(row))
}

function extraDeductionAmount(row: MockPayslip): number {
  return sumExtraLines(visibleExtraLines(row.extraDeductionLines))
}

function recalcEditableRow(row: EditablePayslip): EditablePayslip {
  const next = { ...row }
  next.totalPayment =
    next.basicSalary +
    next.overtimePay +
    next.transportAllowance +
    next.positionAllowance +
    next.familyAllowance +
    next.specialAllowance +
    next.dangerAllowance +
    next.salesAllowance +
    extraPaymentAmount(next)
  next.totalDeduction =
    next.healthInsurance +
    next.nursingInsurance +
    next.welfarePension +
    next.employmentInsurance +
    next.incomeTax +
    next.residentTax +
    next.savingsDeduction +
    next.loanDeduction +
    next.otherDeduction +
    extraDeductionAmount(next)
  next.netPayment = next.totalPayment - next.totalDeduction
  return next
}

/** 予備列: 0円は空欄 */
function numOrBlank(amount: number): string {
  if (amount === 0) return ''
  return amount.toLocaleString('ja-JP')
}

export function PayslipHistory(): ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as { year?: number; month?: number } | null
  const [selectedYear, setSelectedYear] = useState(navState?.year ?? new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(navState?.month ?? new Date().getMonth() + 1)
  const [showReport, setShowReport] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // 年月の切替時に SQLite から保存済み明細を読み込み、メモリキャッシュへ反映する。
  useEffect(() => {
    setSaveMessage(null)
    if (!hasElectronApi) return
    let cancelled = false
    void (async () => {
      await loadPayslipsFromDb(selectedYear, selectedMonth)
      if (!cancelled) setRefreshKey((k) => k + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedYear, selectedMonth])

  const employees = useMemo(() => getEmployees(), [])
  const basePayslips = useMemo(
    () => getPayslips(selectedYear, selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedYear, selectedMonth, refreshKey],
  )

  const initialData = useMemo((): EditablePayslip[] => {
    const empOrder = new Map(employees.map((e, i) => [e.id, i]))
    return basePayslips
      .map((ps) => {
        const emp = employees.find((e) => e.id === ps.employeeId)
        const migrated = migrateRareDeductionsToFreeSlots(ps)
        return {
          ...migrated,
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
        if (field === 'healthInsurance') {
          row.nursingInsurance = 0
        }
        updated[idx] = recalcEditableRow(row)
        return updated
      })
    },
    [],
  )

  const handleFreeDeductChange = useCallback(
    (idx: number, slotIdx: number, value: number): void => {
      setEditData((prev) => {
        const updated = [...prev]
        const row = { ...updated[idx] }
        const lines = [...(row.extraDeductionLines ?? [])]
        while (lines.length < FREE_DEDUCTION_SLOTS) lines.push(newExtraLine())
        lines[slotIdx] = { ...lines[slotIdx], amount: value }
        row.extraDeductionLines = lines
        updated[idx] = recalcEditableRow(row)
        return updated
      })
    },
    [],
  )

  const created = useMemo(
    () => isPayslipsCreated(selectedYear, selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedYear, selectedMonth, refreshKey],
  )

  const handleSave = useCallback(async (): Promise<void> => {
    setSaveMessage('保存中...')
    // メモリキャッシュへ反映しつつ SQLite に永続化する。
    setPayslips(selectedYear, selectedMonth, editData)
    if (!hasElectronApi) {
      setSaveMessage('保存しました')
      return
    }
    const ok = await savePayslipsToDb(selectedYear, selectedMonth, editData)
    setSaveMessage(ok ? '保存しました' : '保存に失敗しました')
  }, [selectedYear, selectedMonth, editData])

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
      extraPayment: 0, totalPayment: 0,
      healthNursing: 0, welfarePension: 0, employmentInsurance: 0,
      incomeTax: 0, residentTax: 0,
      extraDeduction: 0, totalDeduction: 0,
    }
    const freeDeduct = Array.from({ length: FREE_DEDUCTION_SLOTS }, () => 0)
    for (const r of editData) {
      t.workDays += r.workDays
      t.netPayment += r.netPayment
      t.basicSalary += r.basicSalary
      t.overtimePay += r.overtimePay
      t.familyAllowance += r.familyAllowance
      t.specialAllowance += r.specialAllowance
      t.positionAllowance += r.positionAllowance
      t.transportAllowance += r.transportAllowance
      t.salesAllowance += r.salesAllowance
      t.dangerAllowance += r.dangerAllowance
      t.extraPayment += extraPaymentAmount(r)
      t.totalPayment += r.totalPayment
      t.healthNursing += r.healthInsurance + r.nursingInsurance
      t.welfarePension += r.welfarePension
      t.employmentInsurance += r.employmentInsurance
      t.incomeTax += r.incomeTax
      t.residentTax += r.residentTax
      t.extraDeduction += extraDeductionAmount(r)
      t.totalDeduction += r.totalDeduction
      for (let i = 0; i < FREE_DEDUCTION_SLOTS; i++) {
        freeDeduct[i] += r.extraDeductionLines?.[i]?.amount ?? 0
      }
    }
    return { ...t, freeDeduct }
  }, [editData])

  const paymentExtraLabel = useMemo(
    () => firstExtraLineLabel(editData.map((r) => resolveSalaryPaymentExtras(r))) || EXTRA_PAY_LABEL_DEFAULT,
    [editData],
  )

  const deductStartCol = PAY_BASE_COLUMNS.length
  const freeStartCol = deductStartCol + DEDUCT_BASE_COLUMNS.length

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
              {buildYearSelectOptions().map((y) => (
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
              onClick={() => void handleSave()}
            >
              保存
            </button>
            {saveMessage && <span className={styles.legendTotal}>{saveMessage}</span>}
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
                <th colSpan={PAY_BASE_COLUMNS.length + 2} className={styles.thGroupPay}>支　払</th>
                <th colSpan={DEDUCT_BASE_COLUMNS.length + FREE_DEDUCTION_SLOTS + 1} className={styles.thGroupDeduct}>控　除</th>
              </tr>
              <tr>
                {PAY_BASE_COLUMNS.map((col) => (
                  <th key={col.key} className={styles.th}>{col.label}</th>
                ))}
                <th className={`${styles.th} ${styles.thExtra}`}>{paymentExtraLabel}</th>
                <th className={`${styles.th} ${styles.thTotal}`}>支払合計</th>
                {DEDUCT_BASE_COLUMNS.map((col) => (
                  <th key={col.key} className={styles.th}>{col.label}</th>
                ))}
                {Array.from({ length: FREE_DEDUCTION_SLOTS }, (_, i) => (
                  <th key={`free-${i}`} className={`${styles.th} ${styles.thExtra}`} />
                ))}
                <th className={`${styles.th} ${styles.thTotal}`}>控除合計</th>
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
                  {PAY_BASE_COLUMNS.map((col, colIdx) => {
                    const val = row[col.key] as number
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
                  })}
                  <td className={styles.tdReadonly}>{numOrBlank(extraPaymentAmount(row))}</td>
                  <td className={`${styles.tdReadonly} ${styles.tdTotal}`}>{num(row.totalPayment)}</td>
                  {DEDUCT_BASE_COLUMNS.map((col, colIdx) => {
                    const val = col.key === 'healthInsurance'
                      ? row.healthInsurance + row.nursingInsurance
                      : (row[col.key] as number)
                    const dataCol = deductStartCol + colIdx
                    return (
                      <td key={col.key} className={styles.tdEditable}>
                        <input
                          type="number"
                          className={styles.cellInput}
                          value={val}
                          data-row={rowIdx}
                          data-col={dataCol}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleChange(rowIdx, col.key, Number(e.target.value))
                          }
                          onKeyDown={(e) => handleKeyDown(e, rowIdx, dataCol)}
                          min={0}
                        />
                      </td>
                    )
                  })}
                  {Array.from({ length: FREE_DEDUCTION_SLOTS }, (_, slotIdx) => {
                    const amount = row.extraDeductionLines?.[slotIdx]?.amount ?? 0
                    const dataCol = freeStartCol + slotIdx
                    return (
                      <td key={`free-${slotIdx}`} className={styles.tdEditable}>
                        <input
                          type="number"
                          className={styles.cellInput}
                          value={amount === 0 ? '' : amount}
                          data-row={rowIdx}
                          data-col={dataCol}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleFreeDeductChange(
                              rowIdx,
                              slotIdx,
                              e.target.value === '' ? 0 : Number(e.target.value),
                            )
                          }
                          onKeyDown={(e) => handleKeyDown(e, rowIdx, dataCol)}
                          min={0}
                        />
                      </td>
                    )
                  })}
                  <td className={`${styles.tdReadonly} ${styles.tdTotal}`}>{num(row.totalDeduction)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td className={styles.tdNameFoot}>合計</td>
                <td className={styles.tdNumFoot}></td>
                <td className={styles.tdNetPayFoot}>{num(totals.netPayment)}</td>
                {PAY_BASE_COLUMNS.map((col) => (
                  <td key={col.key} className={styles.tdFoot}>
                    {num(Math.round(totals[col.key as keyof typeof totals] as number))}
                  </td>
                ))}
                <td className={styles.tdFoot}>{numOrBlank(totals.extraPayment)}</td>
                <td className={`${styles.tdFoot} ${styles.tdFootTotal}`}>{num(Math.round(totals.totalPayment))}</td>
                {DEDUCT_BASE_COLUMNS.map((col) => {
                  const amount = col.key === 'healthInsurance'
                    ? totals.healthNursing
                    : (totals[col.key as keyof typeof totals] as number)
                  return (
                    <td key={col.key} className={styles.tdFoot}>
                      {num(Math.round(amount))}
                    </td>
                  )
                })}
                {totals.freeDeduct.map((amount, i) => (
                  <td key={`free-foot-${i}`} className={styles.tdFoot}>{numOrBlank(amount)}</td>
                ))}
                <td className={`${styles.tdFoot} ${styles.tdFootTotal}`}>{num(Math.round(totals.totalDeduction))}</td>
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
