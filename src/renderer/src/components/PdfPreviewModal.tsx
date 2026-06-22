import type { ReactElement } from 'react'
import type { MockEmployee, MockPayslip } from '@/lib/mock-data'
import { getSettings } from '@/lib/settings-store'
import styles from './PdfPreviewModal.module.css'

function yen(amount: number): string {
  return amount.toLocaleString('ja-JP')
}

interface PdfPreviewModalProps {
  employee: MockEmployee
  payslip: MockPayslip
  year: number
  month: number
  paymentDate?: string
  onClose: () => void
  title?: string
}

function formatPayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

function PayslipHalf({
  employee,
  payslip,
  year,
  month,
  paymentDate,
  settings,
  label,
  title,
}: {
  employee: MockEmployee
  payslip: MockPayslip
  year: number
  month: number
  paymentDate?: string
  settings: ReturnType<typeof getSettings>
  label: string
  title: string
}): ReactElement {
  const isPartTime = employee.employeeType === 'パート'
  const regularHours = Math.max(0, payslip.workHours - payslip.overtimeHours)

  return (
    <div className={styles.half}>
      <div className={styles.halfLabel}>{label}</div>

      <div className={styles.docHeader}>
        <div className={styles.docHeaderLeft}>
          <div className={styles.docTitle}>{title}</div>
          <div className={styles.docPeriod}>{year}年{String(month).padStart(2, '0')}月分</div>
        </div>
        <div className={styles.docHeaderRight}>
          <div className={styles.companyName}>{settings.companyName}</div>
          {paymentDate && (
            <div className={styles.paymentDate}>支給日 {formatPayDate(paymentDate)}</div>
          )}
        </div>
      </div>

      <table className={styles.empTable}>
        <tbody>
          <tr>
            <th>氏名</th>
            <td className={styles.empNameCell}>{employee.name} 殿</td>
            <th>所属</th>
            <td>{employee.departmentName}</td>
            <th>社員番号</th>
            <td>{String(employee.id).padStart(4, '0')}</td>
            <th>区分</th>
            <td>{employee.employeeType}</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.sectionBar}>勤 怠</div>
      <table className={styles.attendTable}>
        <thead>
          <tr>
            <th>出勤日数</th><th>労働時間</th><th>残業時間</th>
            <th>休日出勤</th><th>有休残</th><th>欠勤</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{payslip.workDays}日</td><td>{payslip.workHours}h</td>
            <td>{payslip.overtimeHours}h</td><td>{payslip.holidayWorkDays}日</td>
            <td>-</td><td>-</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.twoColumn}>
        <div>
          <div className={styles.sectionBar}>支 給</div>
          <table className={styles.payTable}>
            <tbody>
              <tr>
                <th>{isPartTime ? `基本給(¥${employee.hourlyRate.toLocaleString()}×${regularHours}h)` : '基本給'}</th>
                <td>{yen(payslip.basicSalary)}</td>
              </tr>
              <tr><th>時間外手当</th><td>{yen(payslip.overtimePay)}</td></tr>
              <tr><th>通勤手当</th><td>{yen(payslip.transportAllowance)}</td></tr>
              <tr><th>役職手当</th><td>{yen(payslip.positionAllowance)}</td></tr>
              <tr><th>家族手当</th><td>{yen(payslip.familyAllowance)}</td></tr>
              <tr><th>特別手当</th><td>{yen(payslip.specialAllowance)}</td></tr>
              <tr><th>危険手当</th><td>{yen(payslip.dangerAllowance)}</td></tr>
              <tr><th>営業手当</th><td>{yen(payslip.salesAllowance)}</td></tr>
              <tr><th>その他</th><td>{yen(payslip.otherAllowance)}</td></tr>
            </tbody>
            <tfoot>
              <tr><th>支給合計</th><td>{yen(payslip.totalPayment)}</td></tr>
            </tfoot>
          </table>
        </div>
        <div>
          <div className={styles.sectionBar}>控 除</div>
          <table className={styles.payTable}>
            <tbody>
              <tr><th>健康保険</th><td>{yen(payslip.healthInsurance)}</td></tr>
              <tr><th>介護保険</th><td>{yen(payslip.nursingInsurance)}</td></tr>
              <tr><th>厚生年金</th><td>{yen(payslip.welfarePension)}</td></tr>
              <tr><th>雇用保険</th><td>{yen(payslip.employmentInsurance)}</td></tr>
              <tr><th>所得税</th><td>{yen(payslip.incomeTax)}</td></tr>
              <tr><th>住民税</th><td>{yen(payslip.residentTax)}</td></tr>
              <tr><th>積立金</th><td>{yen(payslip.savingsDeduction)}</td></tr>
              <tr><th>貸付返済</th><td>{yen(payslip.loanDeduction)}</td></tr>
              <tr><th>その他</th><td>{yen(payslip.otherDeduction)}</td></tr>
            </tbody>
            <tfoot>
              <tr><th>控除合計</th><td>{yen(payslip.totalDeduction)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className={styles.netRow}>
        <span className={styles.netLabel}>差引支給額</span>
        <span className={styles.netAmount}>¥{yen(payslip.netPayment)}</span>
      </div>

      <div className={styles.docFooter}>
        <span className={styles.footerNote}>上記の通り支給いたします。</span>
        <div className={styles.stampArea}>
          <div className={styles.stampBox}><span>承認</span></div>
          <div className={styles.stampBox}><span>確認</span></div>
        </div>
      </div>
    </div>
  )
}

export function PdfPreviewModal({
  employee,
  payslip,
  year,
  month,
  paymentDate,
  onClose,
  title,
}: PdfPreviewModalProps): ReactElement {
  const settings = getSettings()
  const docTitle = title ?? '給 与 明 細 書'

  function handleOverlayClick(e: React.MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>印刷プレビュー</h2>
          <div className={styles.headerActions}>
            <button className={styles.printButton} onClick={() => window.print()}>印刷</button>
            <button className={styles.closeButton} onClick={onClose} type="button">×</button>
          </div>
        </div>

        <div className={styles.previewArea}>
          <div className={styles.page}>
            <PayslipHalf
              employee={employee} payslip={payslip}
              year={year} month={month} paymentDate={paymentDate}
              settings={settings} label="本人用" title={docTitle}
            />

            <div className={styles.cutLine}>
              <span className={styles.cutText}>✂ 切り取り</span>
            </div>

            <PayslipHalf
              employee={employee} payslip={payslip}
              year={year} month={month} paymentDate={paymentDate}
              settings={settings} label="会社控え" title={docTitle}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
