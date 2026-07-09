import type { ReactElement } from 'react'
import type { MockEmployee, MockPayslip } from '@/lib/mock-data'
import { formatPaidLeaveDays } from '../../../shared/types'
import { getSettings } from '@/lib/settings-store'
import styles from './PayslipPrintDocument.module.css'

// 会社ロゴ。src/assets/logo-dark.(png|jpg|jpeg|svg|webp) を置くと自動で読み込まれる。
// 未配置の場合は会社名テキストにフォールバックする。
const logoModules = import.meta.glob<{ default: string }>(
  '../assets/logo-dark.{png,jpg,jpeg,svg,webp}',
  { eager: true },
)
const companyLogoSrc: string | undefined = Object.values(logoModules)[0]?.default

function num(amount: number): string {
  return amount.toLocaleString('ja-JP')
}

/** 印刷に表示する追加行（空行・0円のみは除外） */
function visibleExtraLines(lines: MockPayslip['extraPaymentLines']): NonNullable<MockPayslip['extraPaymentLines']> {
  if (!lines?.length) return []
  return lines.filter((line) => line.label.trim() !== '' || line.amount > 0)
}

export interface PayslipPrintDocumentProps {
  employee: MockEmployee
  payslip: MockPayslip
  year: number
  month: number
  paymentDate?: string
  /** タイトル文言（既定: 給 与 明 細 書）。賞与では「賞 与 明 細 書」を渡す */
  titleLabel?: string
  /** 期間文言（既定: ○年○月分）。賞与では「○年 夏季賞与」等を渡す */
  periodLabel?: string
  /** 給与 or 賞与。賞与は共済掛金欄を省略する */
  variant?: 'salary' | 'bonus'
  /** print: 原本＋控え＋切り取り線（既定）。mail: 控え・切り取り線を省いた1枚構成 */
  layout?: 'print' | 'mail'
}

interface BlockProps {
  employee: MockEmployee
  payslip: MockPayslip
  title: string
  period: string
  companyName: string
  variant: 'salary' | 'bonus'
  paymentDate?: string
}

function resolvePaymentExtras(payslip: MockPayslip, variant: 'salary' | 'bonus'): MockPayslip['extraPaymentLines'] {
  if (payslip.extraPaymentLines?.length) return payslip.extraPaymentLines
  if (variant === 'salary' && payslip.otherAllowance > 0) {
    return [{ id: 'legacy-payment', label: '雇用保険料超過分', amount: payslip.otherAllowance }]
  }
  return []
}

function formatPaymentDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

function PayslipBlock({
  employee,
  payslip,
  title,
  period,
  companyName,
  variant,
  paymentDate,
}: BlockProps): ReactElement {
  const visiblePaymentExtras = visibleExtraLines(resolvePaymentExtras(payslip, variant))
  const visibleDeductionExtras = visibleExtraLines(payslip.extraDeductionLines)
  const firstPaymentExtra = visiblePaymentExtras[0]
  const morePaymentExtras = visiblePaymentExtras.slice(1)
  const firstDeductionExtra = visibleDeductionExtras[0]
  const moreDeductionExtras = visibleDeductionExtras.slice(1)
  const paymentRowSpan = 2 + morePaymentExtras.length
  const deductionRowSpan = 2 + moreDeductionExtras.length

  return (
    <div className={styles.block}>
      <div className={styles.titleBar}>
        <span className={styles.titleText}>{title}</span>
        <span className={styles.titlePeriod}>{period}</span>
      </div>

      <div className={styles.nameRow}>
        <span className={styles.nameField}>
          <span className={styles.empName}>{employee.name}</span>
          <span className={styles.sama}>様</span>
        </span>
        {companyLogoSrc ? (
          <img src={companyLogoSrc} alt={companyName} className={styles.companyLogo} />
        ) : (
          <span className={styles.companyName}>{companyName}</span>
        )}
      </div>

      <table className={styles.grid}>
        <tbody>
          {/* 支給額 */}
          {variant === 'bonus' ? (
            <>
              <tr>
                <th rowSpan={paymentRowSpan} className={styles.rowLabel}>支給額</th>
                <th className={styles.colHead}>基本賞与</th>
                <th className={styles.colHead}>業績賞与</th>
                <th className={styles.colHead}>特別賞与</th>
                <th className={styles.colHead} />
                <th className={styles.colHead} />
                <th className={styles.colHead} />
                <th className={styles.colHead} />
                <th className={styles.colHead} />
                <th className={styles.colHead}>{firstPaymentExtra?.label ?? ''}</th>
              </tr>
              <tr>
                <td className={styles.val}>{num(payslip.basicSalary)}</td>
                <td className={styles.val}>{num(payslip.otherAllowance)}</td>
                <td className={styles.val}>{num(payslip.specialAllowance)}</td>
                <td className={styles.val} />
                <td className={styles.val} />
                <td className={styles.val} />
                <td className={styles.val} />
                <td className={styles.val} />
                <td className={styles.val}>
                  {firstPaymentExtra ? num(firstPaymentExtra.amount) : ''}
                </td>
              </tr>
              {morePaymentExtras.map((line) => (
                <tr key={line.id}>
                  <th colSpan={8} className={styles.extraColHead}>{line.label}</th>
                  <td className={styles.val}>{num(line.amount)}</td>
                </tr>
              ))}
            </>
          ) : (
            <>
              <tr>
                <th rowSpan={paymentRowSpan} className={styles.rowLabel}>支給額</th>
                <th className={styles.colHead}>基本給</th>
                <th className={styles.colHead}>時間外賃金</th>
                <th className={styles.colHead}>家族手当</th>
                <th className={styles.colHead}>役職手当</th>
                <th className={styles.colHead}>特別手当</th>
                <th className={styles.colHead}>営業手当</th>
                <th className={styles.colHead}>危険手当</th>
                <th className={styles.colHead}>交通費</th>
                <th className={styles.colHead}>{firstPaymentExtra?.label ?? ''}</th>
              </tr>
              <tr>
                <td className={styles.val}>{num(payslip.basicSalary)}</td>
                <td className={styles.val}>{num(payslip.overtimePay)}</td>
                <td className={styles.val}>{num(payslip.familyAllowance)}</td>
                <td className={styles.val}>{num(payslip.positionAllowance)}</td>
                <td className={styles.val}>{num(payslip.specialAllowance)}</td>
                <td className={styles.val}>{num(payslip.salesAllowance)}</td>
                <td className={styles.val}>{num(payslip.dangerAllowance)}</td>
                <td className={styles.val}>{num(payslip.transportAllowance)}</td>
                <td className={styles.val}>
                  {firstPaymentExtra ? num(firstPaymentExtra.amount) : ''}
                </td>
              </tr>
              {morePaymentExtras.map((line) => (
                <tr key={line.id}>
                  <th colSpan={8} className={styles.extraColHead}>{line.label}</th>
                  <td className={styles.val}>{num(line.amount)}</td>
                </tr>
              ))}
            </>
          )}

          {/* 控除額 */}
          <tr>
            <th rowSpan={deductionRowSpan} className={styles.rowLabel}>控除額</th>
            <th className={styles.colHead}>雇用保険</th>
            <th className={styles.colHead}>厚生年金</th>
            <th className={styles.colHead}>介護保険</th>
            <th className={styles.colHead}>健康保険</th>
            <th className={styles.colHead}>{variant === 'bonus' ? '' : '積立'}</th>
            <th className={styles.colHead}>所得税</th>
            <th className={styles.colHead}>{variant === 'bonus' ? '' : '住民税'}</th>
            <th className={styles.colHead}>{variant === 'bonus' ? '' : '未払'}</th>
            <th className={styles.colHead}>
              {variant === 'bonus' ? (firstDeductionExtra?.label ?? '') : '共済掛金'}
            </th>
          </tr>
          <tr>
            <td className={styles.val}>{num(payslip.employmentInsurance)}</td>
            <td className={styles.val}>{num(payslip.welfarePension)}</td>
            <td className={styles.val}>{num(payslip.nursingInsurance)}</td>
            <td className={styles.val}>{num(payslip.healthInsurance)}</td>
            <td className={styles.val}>{variant === 'bonus' ? '' : num(payslip.savingsDeduction)}</td>
            <td className={styles.val}>{num(payslip.incomeTax)}</td>
            <td className={styles.val}>{variant === 'bonus' ? '' : num(payslip.residentTax)}</td>
            <td className={styles.val}>{variant === 'bonus' ? '' : num(payslip.otherDeduction)}</td>
            <td className={styles.val}>
              {variant === 'bonus'
                ? (firstDeductionExtra ? num(firstDeductionExtra.amount) : '')
                : num(payslip.loanDeduction)}
            </td>
          </tr>
          {moreDeductionExtras.map((line) => (
            <tr key={line.id}>
              <th colSpan={8} className={styles.extraColHead}>{line.label}</th>
              <td className={styles.val}>{num(line.amount)}</td>
            </tr>
          ))}

          {/* 記事 + 担当者印 */}
          {variant === 'bonus' ? (
            <tr>
              <th className={styles.rowLabel}>記事</th>
              <td colSpan={9} className={styles.kijiCell}>
                <div className={styles.kijiWrap}>
                  <div className={styles.bonusKiji}>
                    {paymentDate ? `支給日: ${formatPaymentDate(paymentDate)}` : ''}
                  </div>
                  <div className={styles.stampBox}>
                    <div className={styles.stampLabel}>担当者印</div>
                    <div className={styles.stampSpace} />
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            <tr>
              <th className={styles.rowLabel}>記事</th>
              <td colSpan={9} className={styles.kijiCell}>
                <div className={styles.kijiWrap}>
                  <table className={styles.kijiTable}>
                    <thead>
                      <tr>
                        <th rowSpan={2} className={styles.kijiHead}>
                          勤務日数
                          <br />
                          (有給含む)
                        </th>
                        <th rowSpan={2} className={styles.kijiHead}>勤務時間数</th>
                        <th colSpan={2} className={styles.kijiHead}>時間外勤務時間</th>
                        <th rowSpan={2} className={styles.kijiHead}>有給</th>
                        <th rowSpan={2} className={styles.kijiFiller} />
                      </tr>
                      <tr>
                        <th className={styles.kijiHead}>普通</th>
                        <th className={styles.kijiHead}>休日</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{payslip.workDays}</td>
                        <td>{payslip.workHours.toFixed(1)}</td>
                        <td>{payslip.overtimeHours.toFixed(1)}</td>
                        <td>{payslip.holidayWorkDays}</td>
                        <td>{formatPaidLeaveDays(payslip.paidLeaveDays)}</td>
                        <td className={styles.kijiFiller} />
                      </tr>
                    </tbody>
                  </table>
                  <div className={styles.stampBox}>
                    <div className={styles.stampLabel}>担当者印</div>
                    <div className={styles.stampSpace} />
                  </div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className={styles.totals}>
        <div className={styles.totalBox}>
          <div className={styles.totalLabel}>支給額合計</div>
          <div className={styles.totalValue}>{num(payslip.totalPayment)}</div>
        </div>
        <div className={styles.totalBox}>
          <div className={styles.totalLabel}>控除額合計</div>
          <div className={styles.totalValue}>{num(payslip.totalDeduction)}</div>
        </div>
        <div className={styles.totalSpacer} />
        <div className={styles.totalBoxNet}>
          <div className={styles.totalLabel}>銀行振込額</div>
          <div className={styles.totalValueNet}>¥{num(payslip.netPayment)}</div>
        </div>
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
  titleLabel,
  periodLabel,
  variant = 'salary',
  layout = 'print',
}: PayslipPrintDocumentProps): ReactElement {
  const companyName = getSettings().companyName
  const title = titleLabel ?? '給 与 明 細 書'
  const period = periodLabel ?? `${year}年${String(month).padStart(2, '0')}月分`

  const blockProps = { employee, payslip, companyName, variant, paymentDate }

  return (
    <div className={layout === 'mail' ? `${styles.page} ${styles.pageMail}` : styles.page}>
      <PayslipBlock {...blockProps} title={title} period={period} />
      {layout === 'print' && (
        <>
          <div className={styles.cutLine}>
            <span className={styles.cutLineLabel}>切り取り線</span>
          </div>
          <PayslipBlock {...blockProps} title={`${title}（控え）`} period={period} />
        </>
      )}
    </div>
  )
}
