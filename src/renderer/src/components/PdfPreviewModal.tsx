import type { ReactElement } from 'react'
import type { MockEmployee, MockPayslip } from '@/lib/mock-data'
import styles from './PdfPreviewModal.module.css'

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

interface PdfPreviewModalProps {
  employee: MockEmployee
  payslip: MockPayslip
  year: number
  month: number
  onClose: () => void
}

export function PdfPreviewModal({
  employee,
  payslip,
  year,
  month,
  onClose,
}: PdfPreviewModalProps): ReactElement {
  const isPartTime = employee.employeeType === 'パート'
  const regularHours = Math.max(0, payslip.workHours - payslip.overtimeHours)

  function handleOverlayClick(e: React.MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>PDF プレビュー</h2>
          <div className={styles.headerActions}>
            <button className={styles.printButton} onClick={() => alert('印刷します（モック）')}>
              印刷
            </button>
            <button className={styles.closeButton} onClick={onClose} type="button">×</button>
          </div>
        </div>

        <div className={styles.previewArea}>
          <div className={styles.page}>
            {/* タイトル */}
            <div className={styles.docTitle}>給 与 明 細 書</div>
            <div className={styles.docPeriod}>{year}年{month}月分</div>

            {/* 従業員情報 */}
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

            {/* 勤怠 */}
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

            {/* 支給・控除の2カラム */}
            <div className={styles.twoColumn}>
              <div>
                <div className={styles.sectionLabel}>支 給</div>
                <table className={styles.dataTable}>
                  <tbody>
                    <tr>
                      <th>{isPartTime ? `基本給（¥${employee.hourlyRate} × ${regularHours}h）` : '基本給'}</th>
                      <td className={styles.amount}>{yen(payslip.basicSalary)}</td>
                    </tr>
                    <tr><th>残業手当</th><td className={styles.amount}>{yen(payslip.overtimePay)}</td></tr>
                    <tr><th>通勤手当</th><td className={styles.amount}>{yen(payslip.transportAllowance)}</td></tr>
                    <tr><th>役職手当</th><td className={styles.amount}>{yen(payslip.positionAllowance)}</td></tr>
                    <tr><th>家族手当</th><td className={styles.amount}>{yen(payslip.familyAllowance)}</td></tr>
                    {payslip.specialAllowance > 0 && <tr><th>特別手当</th><td className={styles.amount}>{yen(payslip.specialAllowance)}</td></tr>}
                    {payslip.dangerAllowance > 0 && <tr><th>危険手当</th><td className={styles.amount}>{yen(payslip.dangerAllowance)}</td></tr>}
                    {payslip.salesAllowance > 0 && <tr><th>営業手当</th><td className={styles.amount}>{yen(payslip.salesAllowance)}</td></tr>}
                    {payslip.otherAllowance > 0 && <tr><th>その他手当</th><td className={styles.amount}>{yen(payslip.otherAllowance)}</td></tr>}
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
                    <tr><th>健康保険料</th><td className={styles.amount}>{yen(payslip.healthInsurance)}</td></tr>
                    <tr><th>介護保険料</th><td className={styles.amount}>{yen(payslip.nursingInsurance)}</td></tr>
                    <tr><th>厚生年金保険料</th><td className={styles.amount}>{yen(payslip.welfarePension)}</td></tr>
                    <tr><th>雇用保険料</th><td className={styles.amount}>{yen(payslip.employmentInsurance)}</td></tr>
                    <tr><th>所得税</th><td className={styles.amount}>{yen(payslip.incomeTax)}</td></tr>
                    <tr><th>住民税</th><td className={styles.amount}>{yen(payslip.residentTax)}</td></tr>
                    {payslip.savingsDeduction > 0 && <tr><th>積立金</th><td className={styles.amount}>{yen(payslip.savingsDeduction)}</td></tr>}
                    {payslip.loanDeduction > 0 && <tr><th>貸付返済</th><td className={styles.amount}>{yen(payslip.loanDeduction)}</td></tr>}
                    {payslip.otherDeduction > 0 && <tr><th>その他控除</th><td className={styles.amount}>{yen(payslip.otherDeduction)}</td></tr>}
                    <tr className={styles.totalRow}>
                      <th>控除合計</th>
                      <td className={styles.amount}>{yen(payslip.totalDeduction)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 差引支給額 */}
            <div className={styles.netPayment}>
              <span>差引支給額</span>
              <span className={styles.netAmount}>{yen(payslip.netPayment)}</span>
            </div>

            {/* フッター */}
            <div className={styles.docFooter}>
              上記の通り支給いたします。
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
