import type { ReactElement } from 'react'
import type { MockEmployee, MockPayslip } from '@/lib/mock-data'
import styles from './PayslipPrintDocument.module.css'

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

export interface PayslipPrintDocumentProps {
  employee: MockEmployee
  payslip: MockPayslip
  year: number
  month: number
  paymentDate?: string
}

interface PayslipHalfProps {
  title: string
  employee: MockEmployee
  payslip: MockPayslip
  year: number
  month: number
  paymentDate?: string
  isPartTime: boolean
  regularHours: number
}

function formatPayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

function toFullWidth(str: string): string {
  return str.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0))
}

function formatPeriod(year: number, month: number): string {
  return toFullWidth(`${year}年${month}月`)
}

function PayslipHalf({
  title,
  employee,
  payslip,
  year,
  month,
  paymentDate,
  isPartTime,
  regularHours,
}: PayslipHalfProps): ReactElement {
  return (
    <div className={styles.halfPage}>
      <div className={styles.halfHeader}>
        <div className={styles.docTitle}>
          <span className={styles.docTitleText}>{title}</span>
          <span className={styles.docPeriodInline}>（{formatPeriod(year, month)}）</span>
        </div>
        {paymentDate && (
          <div className={styles.docPayDateLine}>支給日: {formatPayDate(paymentDate)}</div>
        )}
      </div>

      <div className={styles.halfBody}>
        <div className={styles.empInfo}>
          <table className={styles.infoTable}>
            <tbody>
              <tr>
                <th>氏名</th>
                <td className={styles.empName}>{employee.name}</td>
                <th>所属</th>
                <td>{employee.departmentName}</td>
              </tr>
              <tr>
                <th>社員番号</th>
                <td>{String(employee.id).padStart(4, '0')}</td>
                <th>区分</th>
                <td>{employee.employeeType}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.sectionLabel}>勤 怠</div>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>出勤日数</th>
              <th>労働時間</th>
              <th>残業時間</th>
              <th>休日出勤</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{payslip.workDays}日</td>
              <td>{payslip.workHours}h</td>
              <td>{payslip.overtimeHours}h</td>
              <td>{payslip.holidayWorkDays}日</td>
            </tr>
          </tbody>
        </table>

        <div className={styles.twoColumn}>
          <div>
            <div className={styles.sectionLabel}>支 給</div>
            <table className={styles.dataTable}>
              <tbody>
                <tr>
                  <th>
                    {isPartTime
                      ? `基本給（¥${employee.hourlyRate} × ${regularHours}h）`
                      : '基本給'}
                  </th>
                  <td className={styles.amount}>{yen(payslip.basicSalary)}</td>
                </tr>
                <tr>
                  <th>残業手当</th>
                  <td className={styles.amount}>{yen(payslip.overtimePay)}</td>
                </tr>
                <tr>
                  <th>通勤手当</th>
                  <td className={styles.amount}>{yen(payslip.transportAllowance)}</td>
                </tr>
                <tr>
                  <th>役職手当</th>
                  <td className={styles.amount}>{yen(payslip.positionAllowance)}</td>
                </tr>
                <tr>
                  <th>家族手当</th>
                  <td className={styles.amount}>{yen(payslip.familyAllowance)}</td>
                </tr>
                {payslip.specialAllowance > 0 && (
                  <tr>
                    <th>特別手当</th>
                    <td className={styles.amount}>{yen(payslip.specialAllowance)}</td>
                  </tr>
                )}
                {payslip.dangerAllowance > 0 && (
                  <tr>
                    <th>危険手当</th>
                    <td className={styles.amount}>{yen(payslip.dangerAllowance)}</td>
                  </tr>
                )}
                {payslip.salesAllowance > 0 && (
                  <tr>
                    <th>営業手当</th>
                    <td className={styles.amount}>{yen(payslip.salesAllowance)}</td>
                  </tr>
                )}
                {payslip.otherAllowance > 0 && (
                  <tr>
                    <th>その他手当</th>
                    <td className={styles.amount}>{yen(payslip.otherAllowance)}</td>
                  </tr>
                )}
                <tr className={styles.totalRow}>
                  <th>総支給額</th>
                  <td className={styles.amount}>{yen(payslip.totalPayment)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <div className={styles.sectionLabel}>控 除</div>
            <table className={styles.dataTable}>
              <tbody>
                <tr>
                  <th>健康保険料</th>
                  <td className={styles.amount}>{yen(payslip.healthInsurance)}</td>
                </tr>
                <tr>
                  <th>介護保険料</th>
                  <td className={styles.amount}>{yen(payslip.nursingInsurance)}</td>
                </tr>
                <tr>
                  <th>厚生年金保険料</th>
                  <td className={styles.amount}>{yen(payslip.welfarePension)}</td>
                </tr>
                <tr>
                  <th>雇用保険料</th>
                  <td className={styles.amount}>{yen(payslip.employmentInsurance)}</td>
                </tr>
                <tr>
                  <th>所得税</th>
                  <td className={styles.amount}>{yen(payslip.incomeTax)}</td>
                </tr>
                <tr>
                  <th>住民税</th>
                  <td className={styles.amount}>{yen(payslip.residentTax)}</td>
                </tr>
                {payslip.savingsDeduction > 0 && (
                  <tr>
                    <th>積立金</th>
                    <td className={styles.amount}>{yen(payslip.savingsDeduction)}</td>
                  </tr>
                )}
                {payslip.loanDeduction > 0 && (
                  <tr>
                    <th>貸付返済</th>
                    <td className={styles.amount}>{yen(payslip.loanDeduction)}</td>
                  </tr>
                )}
                {payslip.otherDeduction > 0 && (
                  <tr>
                    <th>その他控除</th>
                    <td className={styles.amount}>{yen(payslip.otherDeduction)}</td>
                  </tr>
                )}
                <tr className={styles.totalRow}>
                  <th>控除合計</th>
                  <td className={styles.amount}>{yen(payslip.totalDeduction)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={styles.halfFooter}>
        <div className={styles.netPayment}>
          <span>差引支給額</span>
          <span className={styles.netAmount}>{yen(payslip.netPayment)}</span>
        </div>
        <div className={styles.docFooter}>上記の通り支給いたします。</div>
      </div>
    </div>
  )
}

export function PayslipPrintDocument({
  employee,
  payslip,
  year,
  month,
  paymentDate,
}: PayslipPrintDocumentProps): ReactElement {
  const isPartTime = employee.employeeType === 'パート'
  const regularHours = Math.max(0, payslip.workHours - payslip.overtimeHours)

  const halfProps = {
    employee,
    payslip,
    year,
    month,
    paymentDate,
    isPartTime,
    regularHours,
  }

  return (
    <div className={styles.page}>
      <PayslipHalf title="給 与 明 細 書" {...halfProps} />
      <div className={styles.cutLine}>
        <span className={styles.cutLineLabel}>切り取り線</span>
      </div>
      <PayslipHalf title="給 与 明 細 控 え" {...halfProps} />
    </div>
  )
}
