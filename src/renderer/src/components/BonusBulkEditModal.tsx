import { useMemo, useState, useCallback } from 'react'
import type { ReactElement, ChangeEvent, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useOverlayDismiss } from '@/hooks/useOverlayDismiss'
import type { MockEmployee } from '@/lib/mock-data'
import { sumExtraLines, firstExtraLineLabel, visibleExtraLines } from '@/lib/mock-data'
import type { MockBonus } from '@/pages/BonusCreate'
import styles from './BonusBulkEditModal.module.css'

function num(amount: number): string {
  if (amount === 0) return '0'
  return amount.toLocaleString('ja-JP')
}

function numOrBlank(amount: number): string {
  if (amount === 0) return ''
  return amount.toLocaleString('ja-JP')
}

const EXTRA_PAY_LABEL_DEFAULT = '追加支給'
const EXTRA_DEDUCT_LABEL_DEFAULT = '追加控除'

function extraPaymentAmount(row: MockBonus): number {
  return sumExtraLines(visibleExtraLines(row.extraPaymentLines))
}

function extraDeductionAmount(row: MockBonus): number {
  return sumExtraLines(visibleExtraLines(row.extraDeductionLines))
}

/** 支給・控除の変更後に合計と差引支給額を再計算する。 */
function recalcBonus(b: MockBonus): MockBonus {
  const extraPaymentTotal = sumExtraLines(b.extraPaymentLines)
  const extraDeductionTotal = sumExtraLines(b.extraDeductionLines)
  const totalPayment = b.basicBonus + b.performanceBonus + b.specialBonus + extraPaymentTotal
  const totalDeduction =
    b.healthInsurance +
    b.nursingInsurance +
    b.welfarePension +
    b.employmentInsurance +
    b.incomeTax +
    extraDeductionTotal
  return { ...b, totalPayment, totalDeduction, netPayment: totalPayment - totalDeduction }
}

type BonusField = keyof MockBonus

interface Column {
  key: BonusField
  label: string
  editable: boolean
}

const PAY_COLUMNS: Column[] = [
  { key: 'basicBonus', label: '基本賞与', editable: true },
  { key: 'performanceBonus', label: '業績賞与', editable: true },
  { key: 'specialBonus', label: '特別賞与', editable: true },
  { key: 'totalPayment', label: '支給合計', editable: false },
]

const DEDUCT_COLUMNS: Column[] = [
  { key: 'healthInsurance', label: '健康保険', editable: true },
  { key: 'nursingInsurance', label: '介護保険', editable: true },
  { key: 'welfarePension', label: '厚生年金', editable: true },
  { key: 'employmentInsurance', label: '雇用保険', editable: true },
  { key: 'incomeTax', label: '所得税', editable: true },
  { key: 'totalDeduction', label: '控除合計', editable: false },
]

const ALL_COLUMNS: Column[] = [...PAY_COLUMNS, ...DEDUCT_COLUMNS]

const PAY_BASE_COLUMNS = PAY_COLUMNS.filter((c) => c.key !== 'totalPayment')
const DEDUCT_BASE_COLUMNS = DEDUCT_COLUMNS.filter((c) => c.key !== 'totalDeduction')

interface EditableBonus extends MockBonus {
  employeeName: string
  displayOrder: number
}

interface BonusBulkEditModalProps {
  bonuses: MockBonus[]
  employees: MockEmployee[]
  year: number
  season: string
  onApply: (updated: MockBonus[]) => void | Promise<void>
  onClose: () => void
}

export function BonusBulkEditModal({
  bonuses,
  employees,
  year,
  season,
  onApply,
  onClose,
}: BonusBulkEditModalProps): ReactElement {
  const initialData = useMemo((): EditableBonus[] => {
    const empMap = new Map(employees.map((e) => [e.id, e]))
    return bonuses
      .filter((b) => empMap.has(b.employeeId))
      .map((b) => {
        const emp = empMap.get(b.employeeId)
        return {
          ...b,
          employeeName: emp?.name ?? '',
          displayOrder: emp?.displayOrder ?? 99,
        }
      })
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }, [bonuses, employees])

  const [editData, setEditData] = useState<EditableBonus[]>(initialData)
  const [busy, setBusy] = useState(false)

  const handleChange = useCallback((idx: number, field: BonusField, value: number): void => {
    setEditData((prev) => {
      const updated = [...prev]
      const recalced = recalcBonus({ ...updated[idx], [field]: value })
      updated[idx] = { ...updated[idx], ...recalced }
      return updated
    })
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number): void => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const next = document.querySelector<HTMLInputElement>(
        `input[data-row="${rowIdx + 1}"][data-col="${colIdx}"]`,
      )
      if (next) {
        next.focus()
        next.select()
      }
    },
    [],
  )

  const totals = useMemo(() => {
    const t: Record<string, number> = { netPayment: 0, extraPayment: 0, extraDeduction: 0 }
    for (const col of ALL_COLUMNS) t[col.key] = 0
    for (const r of editData) {
      t.netPayment += r.netPayment
      t.extraPayment += extraPaymentAmount(r)
      t.extraDeduction += extraDeductionAmount(r)
      for (const col of ALL_COLUMNS) t[col.key] += r[col.key] as number
    }
    return t
  }, [editData])

  const paymentExtraLabel = useMemo(
    () => firstExtraLineLabel(editData.map((r) => r.extraPaymentLines)) || EXTRA_PAY_LABEL_DEFAULT,
    [editData],
  )

  const deductionExtraLabel = useMemo(
    () => firstExtraLineLabel(editData.map((r) => r.extraDeductionLines)) || EXTRA_DEDUCT_LABEL_DEFAULT,
    [editData],
  )

  const handleSave = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      const updated: MockBonus[] = editData.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        year: r.year,
        season: r.season,
        basicBonus: r.basicBonus,
        performanceBonus: r.performanceBonus,
        specialBonus: r.specialBonus,
        extraPaymentLines: r.extraPaymentLines ?? [],
        extraDeductionLines: r.extraDeductionLines ?? [],
        totalPayment: r.totalPayment,
        healthInsurance: r.healthInsurance,
        nursingInsurance: r.nursingInsurance,
        welfarePension: r.welfarePension,
        employmentInsurance: r.employmentInsurance,
        incomeTax: r.incomeTax,
        totalDeduction: r.totalDeduction,
        netPayment: r.netPayment,
      }))
      await onApply(updated)
    } finally {
      setBusy(false)
    }
  }, [editData, onApply])

  const overlay = useOverlayDismiss(onClose)

  return createPortal(
    <div className={styles.overlay} {...overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>{year}年 {season} 賞与 一括編集</h2>
          <div className={styles.headerActions}>
            <button className={styles.saveButton} onClick={() => void handleSave()} disabled={busy}>
              {busy ? '保存中...' : '保存して閉じる'}
            </button>
            <button className={styles.closeButton} onClick={onClose} type="button">×</button>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.groupRow}>
                <th rowSpan={2} className={styles.thName}>氏名</th>
                <th rowSpan={2} className={styles.thNetPay}>振込額</th>
                <th colSpan={PAY_BASE_COLUMNS.length + 2} className={styles.thGroupPay}>支　給</th>
                <th colSpan={DEDUCT_BASE_COLUMNS.length + 2} className={styles.thGroupDeduct}>控　除</th>
              </tr>
              <tr>
                {PAY_BASE_COLUMNS.map((col) => (
                  <th key={col.key} className={styles.th}>{col.label}</th>
                ))}
                <th className={`${styles.th} ${styles.thExtra}`}>{paymentExtraLabel}</th>
                <th className={`${styles.th} ${styles.thTotal}`}>支給合計</th>
                {DEDUCT_BASE_COLUMNS.map((col) => (
                  <th key={col.key} className={styles.th}>{col.label}</th>
                ))}
                <th className={`${styles.th} ${styles.thExtra}`}>{deductionExtraLabel}</th>
                <th className={`${styles.th} ${styles.thTotal}`}>控除合計</th>
              </tr>
            </thead>
            <tbody>
              {editData.map((row, rowIdx) => (
                <tr key={row.employeeId} className={styles.bodyRow}>
                  <td className={styles.tdName}>{row.employeeName}</td>
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
                  <td className={styles.tdTotal}>{num(row.totalPayment)}</td>
                  {DEDUCT_BASE_COLUMNS.map((col, colIdx) => {
                    const val = row[col.key] as number
                    const dataCol = PAY_BASE_COLUMNS.length + 1 + colIdx
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
                  <td className={styles.tdReadonly}>{numOrBlank(extraDeductionAmount(row))}</td>
                  <td className={styles.tdTotal}>{num(row.totalDeduction)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td className={styles.tdNameFoot}>合計</td>
                <td className={styles.tdNetPayFoot}>{num(totals.netPayment)}</td>
                {PAY_BASE_COLUMNS.map((col) => (
                  <td key={col.key} className={styles.tdFoot}>{num(Math.round(totals[col.key]))}</td>
                ))}
                <td className={styles.tdFoot}>{numOrBlank(totals.extraPayment)}</td>
                <td className={styles.tdFoot}>{num(Math.round(totals.totalPayment))}</td>
                {DEDUCT_BASE_COLUMNS.map((col) => (
                  <td key={col.key} className={styles.tdFoot}>{num(Math.round(totals[col.key]))}</td>
                ))}
                <td className={styles.tdFoot}>{numOrBlank(totals.extraDeduction)}</td>
                <td className={styles.tdFoot}>{num(Math.round(totals.totalDeduction))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  )
}
