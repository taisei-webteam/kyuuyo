import { useState, useMemo, useCallback } from 'react'
import {
  getEmployees,
  isEmailSent,
  sendEmail,
  type MockEmployee,
  type MockPayslip,
} from '@/lib/mock-data'
import { BulkEmailModal } from '@/components/BulkEmailModal'
import { PdfPreviewModal } from '@/components/PdfPreviewModal'
import { BonusReportModal } from '@/components/BonusReportModal'
import styles from './BonusCreate.module.css'

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

interface MockBonus {
  id: number
  employeeId: number
  year: number
  season: '夏季' | '冬季'
  basicBonus: number
  performanceBonus: number
  specialBonus: number
  totalPayment: number
  healthInsurance: number
  nursingInsurance: number
  welfarePension: number
  employmentInsurance: number
  incomeTax: number
  totalDeduction: number
  netPayment: number
}

function bonusToPayslipShape(b: MockBonus): MockPayslip {
  return {
    id: b.id,
    employeeId: b.employeeId,
    year: b.year,
    month: b.season === '夏季' ? 7 : 12,
    workDays: 0,
    workHours: 0,
    overtimeHours: 0,
    holidayWorkDays: 0,
    basicSalary: b.basicBonus,
    overtimePay: 0,
    transportAllowance: 0,
    positionAllowance: 0,
    familyAllowance: 0,
    specialAllowance: b.specialBonus,
    dangerAllowance: 0,
    salesAllowance: 0,
    otherAllowance: b.performanceBonus,
    totalPayment: b.totalPayment,
    healthInsurance: b.healthInsurance,
    nursingInsurance: b.nursingInsurance,
    welfarePension: b.welfarePension,
    employmentInsurance: b.employmentInsurance,
    incomeTax: b.incomeTax,
    residentTax: 0,
    savingsDeduction: 0,
    loanDeduction: 0,
    otherDeduction: 0,
    totalDeduction: b.totalDeduction,
    netPayment: b.netPayment,
  }
}

function generateBonusData(employees: MockEmployee[], year: number, season: '夏季' | '冬季'): MockBonus[] {
  const multiplier = season === '夏季' ? 2.0 : 2.5
  return employees
    .filter((emp) => emp.employeeType !== 'パート')
    .map((emp, idx) => {
      const basicBonus = Math.round(emp.basicSalary * multiplier)
      const performanceBonus = Math.round(emp.basicSalary * 0.3)
      const specialBonus = emp.employeeType === '役員' ? 100000 : 0
      const totalPayment = basicBonus + performanceBonus + specialBonus

      const healthInsurance = Math.round(totalPayment * 0.04985)
      const nursingInsurance = emp.id === 3 ? Math.round(totalPayment * 0.008) : 0
      const welfarePension = Math.round(totalPayment * 0.0915)
      const employmentInsurance = Math.round(totalPayment * 0.006)
      const socialInsurance = healthInsurance + nursingInsurance + welfarePension + employmentInsurance
      const incomeTax = Math.round((totalPayment - socialInsurance) * 0.1021)
      const totalDeduction = socialInsurance + incomeTax

      return {
        id: idx + 1,
        employeeId: emp.id,
        year,
        season,
        basicBonus,
        performanceBonus,
        specialBonus,
        totalPayment,
        healthInsurance,
        nursingInsurance,
        welfarePension,
        employmentInsurance,
        incomeTax,
        totalDeduction,
        netPayment: totalPayment - totalDeduction,
      }
    })
}

export function BonusCreate(): React.ReactElement {
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedSeason, setSelectedSeason] = useState<'夏季' | '冬季'>('夏季')
  const [paymentDate, setPaymentDate] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [showBulkEmail, setShowBulkEmail] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [emailRefresh, setEmailRefresh] = useState(0)

  const employees = useMemo(() => getEmployees(), [])

  const eligibleEmployees = useMemo(
    () => employees.filter((emp) => emp.employeeType !== 'パート'),
    [employees],
  )

  const filteredEmployees = useMemo(
    () =>
      eligibleEmployees.filter(
        (emp) =>
          emp.name.includes(searchQuery) || emp.nameKana.includes(searchQuery),
      ),
    [eligibleEmployees, searchQuery],
  )

  const bonuses = useMemo(
    () => generateBonusData(employees, selectedYear, selectedSeason),
    [employees, selectedYear, selectedSeason],
  )

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  )

  const selectedBonus = useMemo(
    () => bonuses.find((b) => b.employeeId === selectedEmployeeId),
    [bonuses, selectedEmployeeId],
  )

  const emailSentMap = useMemo(() => {
    const map = new Map<number, boolean>()
    for (const emp of eligibleEmployees) {
      map.set(emp.id, isEmailSent(emp.id, 'bonus', selectedYear, selectedSeason))
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleEmployees, selectedYear, selectedSeason, emailRefresh])

  const handleEmailSend = useCallback((): void => {
    if (!selectedEmployee?.email) {
      alert('メールアドレスが登録されていません。')
      return
    }
    sendEmail(selectedEmployee.id, 'bonus', selectedYear, selectedSeason)
    setEmailRefresh((k) => k + 1)
  }, [selectedEmployee, selectedYear, selectedSeason])

  const handleEmailSent = useCallback((): void => {
    setEmailRefresh((k) => k + 1)
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>賞与作成</h1>
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
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value as '夏季' | '冬季')}
            >
              <option value="夏季">夏季</option>
              <option value="冬季">冬季</option>
            </select>
            <label className={styles.paymentDateLabel}>
              支給日
              <input
                type="date"
                className={styles.paymentDateInput}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => setShowReport(true)}>賞与一覧表</button>
          <button className={styles.btnSecondary} onClick={() => setShowBulkEmail(true)}>一括送信</button>
          <button className={styles.btnSecondary} onClick={handleEmailSend}>個別送信</button>
          <button className={styles.btnPrimary} onClick={() => setShowPdfPreview(true)}>PDFプレビュー</button>
        </div>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="従業員検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <ul className={styles.employeeList}>
            {filteredEmployees.map((emp) => {
              const sent = emailSentMap.get(emp.id) ?? false
              return (
                <li
                  key={emp.id}
                  className={`${styles.employeeItem} ${emp.id === selectedEmployeeId ? styles.employeeItemActive : ''}`}
                  onClick={() => setSelectedEmployeeId(emp.id)}
                >
                  <div>
                    <span className={styles.employeeName}>{emp.name}</span>
                    {sent && <span className={styles.sentBadge}>送信済</span>}
                  </div>
                  <span className={styles.employeeType}>{emp.employeeType}</span>
                </li>
              )
            })}
          </ul>
        </aside>

        <main className={styles.detail}>
          {selectedEmployee && selectedBonus ? (
            <BonusDetail
              employee={selectedEmployee}
              bonus={selectedBonus}
              year={selectedYear}
              season={selectedSeason}
              paymentDate={paymentDate}
            />
          ) : (
            <div className={styles.emptyState}>従業員を選択してください</div>
          )}
        </main>
      </div>

      {showBulkEmail && (
        <BulkEmailModal
          employees={eligibleEmployees}
          type="bonus"
          year={selectedYear}
          monthOrSeason={selectedSeason}
          periodLabel={`${selectedYear}年 ${selectedSeason} 賞与明細`}
          onClose={() => setShowBulkEmail(false)}
          onSent={handleEmailSent}
        />
      )}

      {showPdfPreview && selectedEmployee && selectedBonus && (
        <PdfPreviewModal
          employee={selectedEmployee}
          payslip={bonusToPayslipShape(selectedBonus)}
          year={selectedYear}
          month={selectedSeason === '夏季' ? 7 : 12}
          paymentDate={paymentDate}
          onClose={() => setShowPdfPreview(false)}
        />
      )}

      {showReport && (
        <BonusReportModal
          bonuses={bonuses}
          year={selectedYear}
          season={selectedSeason}
          paymentDate={paymentDate}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}

function formatPaymentDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

function BonusDetail({
  employee,
  bonus,
  year,
  season,
  paymentDate,
}: {
  employee: MockEmployee
  bonus: MockBonus
  year: number
  season: string
  paymentDate: string
}): React.ReactElement {
  return (
    <div className={styles.detailCard}>
      <div className={styles.detailHeader}>
        <span className={styles.detailName}>{employee.name}</span>
        <span className={styles.detailBadge}>{employee.employeeType}</span>
        <span className={styles.detailPeriod}>
          {year}年 {season} 賞与明細
          {paymentDate && <span className={styles.detailPayDate}>（支給日: {formatPaymentDate(paymentDate)}）</span>}
        </span>
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>支給</div>
            <div className={styles.sectionBody}>
              <Row label="基本賞与" value={yen(bonus.basicBonus)} />
              <Row label="業績賞与" value={yen(bonus.performanceBonus)} />
              <Row label="特別賞与" value={yen(bonus.specialBonus)} />
            </div>
            <div className={styles.sectionTotal}>
              <span>合計</span>
              <span>{yen(bonus.totalPayment)}</span>
            </div>
          </div>
        </div>

        <div className={styles.column}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>控除</div>
            <div className={styles.sectionBody}>
              <Row label="健康保険" value={yen(bonus.healthInsurance)} />
              <Row label="介護保険" value={yen(bonus.nursingInsurance)} />
              <Row label="厚生年金" value={yen(bonus.welfarePension)} />
              <Row label="雇用保険" value={yen(bonus.employmentInsurance)} />
              <Row label="所得税" value={yen(bonus.incomeTax)} />
            </div>
            <div className={styles.sectionTotal}>
              <span>合計</span>
              <span>{yen(bonus.totalDeduction)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.netPaymentCard}>
        <span className={styles.netPaymentLabel}>差引支給額（振込額）</span>
        <span className={styles.netPaymentAmount}>{yen(bonus.netPayment)}</span>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
}: {
  label: string
  value: string
}): React.ReactElement {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  )
}
