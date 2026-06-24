import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { getEmployees, type MockEmployee, type MockPayslip } from '@/lib/mock-data'
import { getSettings } from '@/lib/settings-store'
import { triggerPrint } from '@/lib/print'
import styles from './PayrollReportModal.module.css'

function num(amount: number): string {
  if (amount === 0) return '0'
  return amount.toLocaleString('ja-JP')
}

function formatPayDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

/** 給与支給日の既定値（対象月の翌月10日） */
function defaultPayDate(year: number, month: number): string {
  const d = new Date(year, month, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-10`
}

interface ReportRow {
  name: string
  workDays: number
  netPayment: number
  basicSalary: number
  overtimePay: number
  familyAllowance: number
  specialAllowance: number
  positionAllowance: number
  transportAllowance: number
  salesAllowance: number
  dangerAllowance: number
  totalPayment: number
  healthInsurance: number
  nursingInsurance: number
  welfarePension: number
  employmentInsurance: number
  incomeTax: number
  residentTax: number
  savingsDeduction: number
  loanDeduction: number
  otherDeduction: number
  totalDeduction: number
}

interface PayrollReportModalProps {
  payslips: MockPayslip[]
  year: number
  month: number
  onClose: () => void
}

export function PayrollReportModal({
  payslips,
  year,
  month,
  onClose,
}: PayrollReportModalProps): ReactElement {
  const employees = useMemo(() => getEmployees(), [])
  const companyName = useMemo(() => getSettings().companyName, [])
  const [paymentDate, setPaymentDate] = useState(() => defaultPayDate(year, month))
  const [busy, setBusy] = useState(false)

  const rows: ReportRow[] = useMemo(() => {
    const empMap = new Map<number, MockEmployee>()
    for (const e of employees) empMap.set(e.id, e)

    return payslips
      .map((ps) => {
        const emp = empMap.get(ps.employeeId)
        return {
          name: emp?.name ?? '',
          displayOrder: emp?.displayOrder ?? 99,
          workDays: ps.workDays,
          netPayment: ps.netPayment,
          basicSalary: ps.basicSalary,
          overtimePay: ps.overtimePay,
          familyAllowance: ps.familyAllowance,
          specialAllowance: ps.specialAllowance,
          positionAllowance: ps.positionAllowance,
          transportAllowance: ps.transportAllowance,
          salesAllowance: ps.salesAllowance,
          dangerAllowance: ps.dangerAllowance,
          totalPayment: ps.totalPayment,
          healthInsurance: ps.healthInsurance,
          nursingInsurance: ps.nursingInsurance,
          welfarePension: ps.welfarePension,
          employmentInsurance: ps.employmentInsurance,
          incomeTax: ps.incomeTax,
          residentTax: ps.residentTax,
          savingsDeduction: ps.savingsDeduction,
          loanDeduction: ps.loanDeduction,
          otherDeduction: ps.otherDeduction,
          totalDeduction: ps.totalDeduction,
        }
      })
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }, [payslips, employees])

  const totals = useMemo(() => {
    const t: Omit<ReportRow, 'name'> = {
      workDays: 0, netPayment: 0, basicSalary: 0, overtimePay: 0,
      familyAllowance: 0, specialAllowance: 0, positionAllowance: 0,
      transportAllowance: 0, salesAllowance: 0, dangerAllowance: 0, totalPayment: 0,
      healthInsurance: 0, nursingInsurance: 0, welfarePension: 0,
      employmentInsurance: 0, incomeTax: 0, residentTax: 0,
      savingsDeduction: 0, loanDeduction: 0, otherDeduction: 0, totalDeduction: 0,
    }
    for (const r of rows) {
      for (const k of Object.keys(t) as (keyof typeof t)[]) {
        (t[k] as number) += r[k]
      }
    }
    return t
  }, [rows])

  function handleOverlayClick(e: React.MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }

  async function handlePrint(): Promise<void> {
    const exportPdf = window.api?.export?.pdf
    if (typeof exportPdf !== 'function') {
      // ブラウザ(Vite単体) または preload未更新時は従来の印刷ダイアログにフォールバック
      triggerPrint({ orientation: 'landscape', mode: 'modal', size: 'A3' })
      return
    }

    const fileName = `給与一覧表_${year}年${String(month).padStart(2, '0')}月`
    setBusy(true)
    document.body.classList.add('is-printing-modal')
    try {
      const result = await exportPdf({ fileName, pageSize: 'A3', landscape: true })
      if (!result.success) {
        alert(`PDF出力に失敗しました: ${result.error}`)
      }
    } catch (err) {
      alert(`PDF出力に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      document.body.classList.remove('is-printing-modal')
      setBusy(false)
    }
  }

  return createPortal(
    <div className={`${styles.overlay} printScope`} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={`${styles.modalHeader} noPrint`}>
          <h2>給与一覧表（A3横）印刷プレビュー</h2>
          <div className={styles.headerActions}>
            <label className={styles.payDateField}>
              支給日
              <input
                type="date"
                className={styles.payDateInput}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </label>
            <button className={styles.printButton} onClick={handlePrint} disabled={busy}>
              {busy ? 'PDF生成中...' : 'PDF出力 / 印刷'}
            </button>
            <button className={styles.closeButton} onClick={onClose} type="button">×</button>
          </div>
        </div>

        <div className={styles.previewArea} id="payroll-report">
          <div className={styles.page}>
            <div className={styles.reportHeader}>
              <span className={styles.reportTitle}>{year}年{String(month).padStart(2, '0')}月分　給与一覧表</span>
              <span className={styles.reportDate}>{formatPayDate(paymentDate)}　支給</span>
              <span className={styles.reportCompany}>{companyName}</span>
            </div>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th rowSpan={2} className={styles.thName}>氏名</th>
                  <th rowSpan={2} className={styles.thSmall}>労働<br />日数</th>
                  <th rowSpan={2} className={styles.thAmount}>銀行<br />振込額</th>
                  <th colSpan={9} className={styles.thGroup}>支　払</th>
                  <th colSpan={10} className={styles.thGroup}>控　除</th>
                </tr>
                <tr>
                  <th className={styles.thAmount}>基本給</th>
                  <th className={styles.thAmount}>前月時間外<br />賃金</th>
                  <th className={styles.thAmount}>家族手当</th>
                  <th className={styles.thAmount}>特別手当</th>
                  <th className={styles.thAmount}>役職手当</th>
                  <th className={styles.thAmount}>交通費</th>
                  <th className={styles.thAmount}>営業手当</th>
                  <th className={styles.thAmount}>危険手当</th>
                  <th className={styles.thAmountTotal}>支払額<br />合計</th>
                  <th className={styles.thAmount}>健康保険</th>
                  <th className={styles.thAmount}>介護保険</th>
                  <th className={styles.thAmount}>厚生年金</th>
                  <th className={styles.thAmount}>雇用保険</th>
                  <th className={styles.thAmount}>所得税</th>
                  <th className={styles.thAmount}>住民税</th>
                  <th className={styles.thAmount}>積立</th>
                  <th className={styles.thAmount}>貸付</th>
                  <th className={styles.thAmount}>共済掛金</th>
                  <th className={styles.thAmountTotal}>控除額<br />合計</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td className={styles.tdName}>{r.name}</td>
                    <td className={styles.tdNum}>{r.workDays}</td>
                    <td className={styles.tdAmount}>{num(r.netPayment)}</td>
                    <td className={styles.tdAmount}>{num(r.basicSalary)}</td>
                    <td className={styles.tdAmount}>{num(r.overtimePay)}</td>
                    <td className={styles.tdAmount}>{num(r.familyAllowance)}</td>
                    <td className={styles.tdAmount}>{num(r.specialAllowance)}</td>
                    <td className={styles.tdAmount}>{num(r.positionAllowance)}</td>
                    <td className={styles.tdAmount}>{num(r.transportAllowance)}</td>
                    <td className={styles.tdAmount}>{num(r.salesAllowance)}</td>
                    <td className={styles.tdAmount}>{num(r.dangerAllowance)}</td>
                    <td className={styles.tdAmountTotal}>{num(r.totalPayment)}</td>
                    <td className={styles.tdAmount}>{num(r.healthInsurance)}</td>
                    <td className={styles.tdAmount}>{num(r.nursingInsurance)}</td>
                    <td className={styles.tdAmount}>{num(r.welfarePension)}</td>
                    <td className={styles.tdAmount}>{num(r.employmentInsurance)}</td>
                    <td className={styles.tdAmount}>{num(r.incomeTax)}</td>
                    <td className={styles.tdAmount}>{num(r.residentTax)}</td>
                    <td className={styles.tdAmount}>{num(r.savingsDeduction)}</td>
                    <td className={styles.tdAmount}>{num(r.loanDeduction)}</td>
                    <td className={styles.tdAmount}>{num(r.otherDeduction)}</td>
                    <td className={styles.tdAmountTotal}>{num(r.totalDeduction)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.totalRow}>
                  <td className={styles.tdName}>合計</td>
                  <td className={styles.tdNum}></td>
                  <td className={styles.tdAmount}>{num(totals.netPayment)}</td>
                  <td className={styles.tdAmount}>{num(totals.basicSalary)}</td>
                  <td className={styles.tdAmount}>{num(totals.overtimePay)}</td>
                  <td className={styles.tdAmount}>{num(totals.familyAllowance)}</td>
                  <td className={styles.tdAmount}>{num(totals.specialAllowance)}</td>
                  <td className={styles.tdAmount}>{num(totals.positionAllowance)}</td>
                  <td className={styles.tdAmount}>{num(totals.transportAllowance)}</td>
                  <td className={styles.tdAmount}>{num(totals.salesAllowance)}</td>
                  <td className={styles.tdAmount}>{num(totals.dangerAllowance)}</td>
                  <td className={styles.tdAmountTotal}>{num(totals.totalPayment)}</td>
                  <td className={styles.tdAmount}>{num(totals.healthInsurance)}</td>
                  <td className={styles.tdAmount}>{num(totals.nursingInsurance)}</td>
                  <td className={styles.tdAmount}>{num(totals.welfarePension)}</td>
                  <td className={styles.tdAmount}>{num(totals.employmentInsurance)}</td>
                  <td className={styles.tdAmount}>{num(totals.incomeTax)}</td>
                  <td className={styles.tdAmount}>{num(totals.residentTax)}</td>
                  <td className={styles.tdAmount}>{num(totals.savingsDeduction)}</td>
                  <td className={styles.tdAmount}>{num(totals.loanDeduction)}</td>
                  <td className={styles.tdAmount}>{num(totals.otherDeduction)}</td>
                  <td className={styles.tdAmountTotal}>{num(totals.totalDeduction)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
