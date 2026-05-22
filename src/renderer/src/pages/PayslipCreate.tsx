import { useState, useMemo, useCallback, useEffect } from 'react'
import type { ReactElement, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getEmployees,
  getPayslips,
  createPayslips,
  isPayslipsCreated,
  isEmailSent,
  sendEmail,
  type MockEmployee,
  type MockPayslip,
} from '@/lib/mock-data'
import { BulkEmailModal } from '@/components/BulkEmailModal'
import { PdfPreviewModal } from '@/components/PdfPreviewModal'
import styles from './PayslipCreate.module.css'

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

type DistributeMode = 'pdf' | 'email'

function recalcTotals(ps: MockPayslip): MockPayslip {
  const totalPayment =
    ps.basicSalary +
    ps.overtimePay +
    ps.transportAllowance +
    ps.positionAllowance +
    ps.familyAllowance +
    ps.specialAllowance +
    ps.dangerAllowance +
    ps.salesAllowance +
    ps.otherAllowance

  const totalDeduction =
    ps.healthInsurance +
    ps.nursingInsurance +
    ps.welfarePension +
    ps.employmentInsurance +
    ps.incomeTax +
    ps.residentTax +
    ps.savingsDeduction +
    ps.loanDeduction +
    ps.otherDeduction

  return {
    ...ps,
    totalPayment,
    totalDeduction,
    netPayment: totalPayment - totalDeduction,
  }
}

export function PayslipCreate(): ReactElement {
  const navigate = useNavigate()
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(5)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [distributeMode, setDistributeMode] = useState<DistributeMode>('pdf')
  const [refreshKey, setRefreshKey] = useState(0)
  const [editPayslips, setEditPayslips] = useState<MockPayslip[]>([])
  const [showBulkEmail, setShowBulkEmail] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [emailRefresh, setEmailRefresh] = useState(0)

  const employees = useMemo(() => getEmployees(), [])

  const created = useMemo(
    () => isPayslipsCreated(selectedYear, selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedYear, selectedMonth, refreshKey],
  )

  const rawPayslips = useMemo(
    () => getPayslips(selectedYear, selectedMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedYear, selectedMonth, refreshKey],
  )

  useEffect(() => {
    setEditPayslips(rawPayslips.map((ps) => ({ ...ps })))
  }, [rawPayslips])

  const filteredEmployees = useMemo(
    () =>
      employees.filter(
        (emp) =>
          emp.name.includes(searchQuery) || emp.nameKana.includes(searchQuery),
      ),
    [employees, searchQuery],
  )

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  )

  const selectedPayslip = useMemo(
    () => editPayslips.find((p) => p.employeeId === selectedEmployeeId),
    [editPayslips, selectedEmployeeId],
  )

  const emailSentMap = useMemo(() => {
    const map = new Map<number, boolean>()
    for (const emp of employees) {
      map.set(emp.id, isEmailSent(emp.id, 'payslip', selectedYear, selectedMonth))
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, selectedYear, selectedMonth, emailRefresh])

  const handleCreate = useCallback((): void => {
    createPayslips(selectedYear, selectedMonth)
    setRefreshKey((k) => k + 1)
  }, [selectedYear, selectedMonth])

  const handleFieldChange = useCallback(
    (employeeId: number, field: keyof MockPayslip, value: number): void => {
      setEditPayslips((prev) =>
        prev.map((ps) => {
          if (ps.employeeId !== employeeId) return ps
          return recalcTotals({ ...ps, [field]: value })
        }),
      )
    },
    [],
  )

  const handleEmailSend = useCallback((): void => {
    if (!selectedEmployee?.email) {
      alert('メールアドレスが登録されていません。従業員管理画面で登録してください。')
      return
    }
    sendEmail(selectedEmployee.id, 'payslip', selectedYear, selectedMonth)
    setEmailRefresh((k) => k + 1)
  }, [selectedEmployee, selectedYear, selectedMonth])

  const handleEmailSent = useCallback((): void => {
    setEmailRefresh((k) => k + 1)
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>給与作成</h1>
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
          {created ? (
            <span className={styles.createdBadge}>作成済み</span>
          ) : (
            <button className={styles.btnCreate} onClick={handleCreate}>
              {selectedMonth}月分を作成
            </button>
          )}
        </div>
        {created && (
          <div className={styles.headerActions}>
            <div className={styles.distributeToggle}>
              <button
                className={`${styles.toggleBtn} ${distributeMode === 'pdf' ? styles.toggleBtnActive : ''}`}
                onClick={() => setDistributeMode('pdf')}
              >
                PDF印刷
              </button>
              <button
                className={`${styles.toggleBtn} ${distributeMode === 'email' ? styles.toggleBtnActive : ''}`}
                onClick={() => setDistributeMode('email')}
              >
                メール送信
              </button>
            </div>
            <button className={styles.btnSecondary} onClick={() => navigate('/history')}>一括編集</button>
            {distributeMode === 'pdf' ? (
              <>
                <button className={styles.btnSecondary} onClick={() => alert('一括印刷します（モック）')}>一括印刷</button>
                <button className={styles.btnPrimary} onClick={() => setShowPdfPreview(true)}>PDFプレビュー</button>
              </>
            ) : (
              <>
                <button className={styles.btnSecondary} onClick={() => setShowBulkEmail(true)}>一括送信</button>
                <button className={styles.btnPrimary} onClick={handleEmailSend}>個別送信</button>
              </>
            )}
          </div>
        )}
      </div>

      {created ? (
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
            <EmployeeList
              employees={filteredEmployees}
              payslips={editPayslips}
              selectedId={selectedEmployeeId}
              onSelect={setSelectedEmployeeId}
              emailSentMap={emailSentMap}
            />
          </aside>

          <main className={styles.detail}>
            {selectedEmployee && selectedPayslip ? (
              <PayslipDetail
                employee={selectedEmployee}
                payslip={selectedPayslip}
                year={selectedYear}
                month={selectedMonth}
                distributeMode={distributeMode}
                onChange={handleFieldChange}
              />
            ) : (
              <div className={styles.emptyState}>従業員を選択してください</div>
            )}
          </main>
        </div>
      ) : (
        <div className={styles.notCreated}>
          <div className={styles.notCreatedIcon}>📋</div>
          <h2 className={styles.notCreatedTitle}>{selectedYear}年{selectedMonth}月分の給与データ</h2>
          <p className={styles.notCreatedDesc}>
            まだ作成されていません。<br />
            勤怠データと従業員マスタをもとに給与データを自動生成します。
          </p>
          <button className={styles.btnCreateLarge} onClick={handleCreate}>
            {selectedMonth}月分を作成
          </button>
        </div>
      )}

      {showBulkEmail && (
        <BulkEmailModal
          employees={employees}
          type="payslip"
          year={selectedYear}
          monthOrSeason={selectedMonth}
          periodLabel={`${selectedYear}年${selectedMonth}月 給与明細`}
          onClose={() => setShowBulkEmail(false)}
          onSent={handleEmailSent}
        />
      )}

      {showPdfPreview && selectedEmployee && selectedPayslip && (
        <PdfPreviewModal
          employee={selectedEmployee}
          payslip={selectedPayslip}
          year={selectedYear}
          month={selectedMonth}
          onClose={() => setShowPdfPreview(false)}
        />
      )}
    </div>
  )
}

function PayslipDetail({
  employee,
  payslip,
  year,
  month,
  distributeMode,
  onChange,
}: {
  employee: MockEmployee
  payslip: MockPayslip
  year: number
  month: number
  distributeMode: DistributeMode
  onChange: (employeeId: number, field: keyof MockPayslip, value: number) => void
}): ReactElement {
  const isPartTime = employee.employeeType === 'パート'
  const regularHours = Math.max(0, payslip.workHours - payslip.overtimeHours)

  const handleChange = useCallback(
    (field: keyof MockPayslip) =>
      (e: ChangeEvent<HTMLInputElement>): void => {
        onChange(employee.id, field, Number(e.target.value))
      },
    [onChange, employee.id],
  )

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderLeft}>
          <span className={styles.detailName}>{employee.name}</span>
          <span className={styles.detailBadge}>{employee.employeeType}</span>
        </div>
        <span className={styles.detailPeriod}>
          {year}年{month}月 給与明細
        </span>
      </div>

      {distributeMode === 'email' && employee.email && (
        <div className={styles.emailInfo}>
          送信先: {employee.email}
          <span className={styles.emailNote}>（控え部分は含まれません）</span>
        </div>
      )}
      {distributeMode === 'email' && !employee.email && (
        <div className={styles.emailWarning}>
          メールアドレスが未登録です
        </div>
      )}

      <div className={styles.attendanceRow}>
        <AttendanceInput label="出勤日数" value={payslip.workDays} unit="日" onChange={handleChange('workDays')} />
        <AttendanceInput label="労働時間" value={payslip.workHours} unit="h" onChange={handleChange('workHours')} step={0.5} />
        <AttendanceInput label="残業時間" value={payslip.overtimeHours} unit="h" onChange={handleChange('overtimeHours')} step={0.5} />
        <AttendanceInput label="休日出勤" value={payslip.holidayWorkDays} unit="日" onChange={handleChange('holidayWorkDays')} />
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              支給
              {isPartTime && <span className={styles.autoTag}>時給制</span>}
            </div>
            <div className={styles.sectionBody}>
              {isPartTime && (
                <div className={styles.hourlyBreakdown}>
                  時給 ¥{employee.hourlyRate.toLocaleString('ja-JP')} × {regularHours}h
                </div>
              )}
              <EditableRow label={isPartTime ? '基本給（時給計算）' : '基本給'} value={payslip.basicSalary} onChange={handleChange('basicSalary')} />
              <EditableRow label="残業手当" value={payslip.overtimePay} onChange={handleChange('overtimePay')} />
              <EditableRow label="通勤手当" value={payslip.transportAllowance} onChange={handleChange('transportAllowance')} />
              <EditableRow label="役職手当" value={payslip.positionAllowance} onChange={handleChange('positionAllowance')} />
              <EditableRow label="家族手当" value={payslip.familyAllowance} onChange={handleChange('familyAllowance')} />
              <EditableRow label="特別手当" value={payslip.specialAllowance} onChange={handleChange('specialAllowance')} />
              <EditableRow label="危険手当" value={payslip.dangerAllowance} onChange={handleChange('dangerAllowance')} />
              <EditableRow label="営業手当" value={payslip.salesAllowance} onChange={handleChange('salesAllowance')} />
              <EditableRow label="その他手当" value={payslip.otherAllowance} onChange={handleChange('otherAllowance')} />
            </div>
            <div className={styles.sectionTotal}>
              <span>総支給額</span>
              <span>{yen(payslip.totalPayment)}</span>
            </div>
          </div>
        </div>

        <div className={styles.column}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              控除
              <span className={styles.autoTag}>社保自動計算</span>
            </div>
            <div className={styles.sectionBody}>
              <EditableRow label="健康保険" value={payslip.healthInsurance} onChange={handleChange('healthInsurance')} auto />
              <EditableRow label="介護保険" value={payslip.nursingInsurance} onChange={handleChange('nursingInsurance')} auto />
              <EditableRow label="厚生年金" value={payslip.welfarePension} onChange={handleChange('welfarePension')} auto />
              <EditableRow label="雇用保険" value={payslip.employmentInsurance} onChange={handleChange('employmentInsurance')} auto />
              <EditableRow label="所得税" value={payslip.incomeTax} onChange={handleChange('incomeTax')} />
              <EditableRow label="住民税" value={payslip.residentTax} onChange={handleChange('residentTax')} />
              <EditableRow label="積立金" value={payslip.savingsDeduction} onChange={handleChange('savingsDeduction')} />
              <EditableRow label="貸付返済" value={payslip.loanDeduction} onChange={handleChange('loanDeduction')} />
              <EditableRow label="その他" value={payslip.otherDeduction} onChange={handleChange('otherDeduction')} />
            </div>
            <div className={styles.sectionTotal}>
              <span>控除合計</span>
              <span>{yen(payslip.totalDeduction)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.netPaymentCard}>
        <span className={styles.netPaymentLabel}>差引支給額（振込額）</span>
        <span className={styles.netPaymentAmount}>{yen(payslip.netPayment)}</span>
      </div>
    </div>
  )
}

function AttendanceInput({
  label,
  value,
  unit,
  onChange,
  step,
}: {
  label: string
  value: number
  unit: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  step?: number
}): ReactElement {
  return (
    <div className={styles.attendanceItem}>
      <span className={styles.attendanceLabel}>{label}</span>
      <div className={styles.attendanceInputWrap}>
        <input
          type="number"
          className={styles.attendanceInput}
          value={value}
          onChange={onChange}
          min={0}
          step={step}
        />
        <span className={styles.attendanceUnit}>{unit}</span>
      </div>
    </div>
  )
}

function EditableRow({
  label,
  value,
  onChange,
  auto,
}: {
  label: string
  value: number
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  auto?: boolean
}): ReactElement {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>
        {label}
        {auto && <span className={styles.rowAutoIcon}>*</span>}
      </span>
      <input
        type="number"
        className={styles.rowInput}
        value={value}
        onChange={onChange}
        min={0}
      />
    </div>
  )
}

function EmployeeList({
  employees,
  payslips,
  selectedId,
  onSelect,
  emailSentMap,
}: {
  employees: MockEmployee[]
  payslips: MockPayslip[]
  selectedId: number
  onSelect: (id: number) => void
  emailSentMap: Map<number, boolean>
}): ReactElement {
  return (
    <ul className={styles.employeeList}>
      {employees.map((emp) => {
        const ps = payslips.find((p) => p.employeeId === emp.id)
        const sent = emailSentMap.get(emp.id) ?? false
        return (
          <li
            key={emp.id}
            className={`${styles.employeeItem} ${emp.id === selectedId ? styles.employeeItemActive : ''}`}
            onClick={() => onSelect(emp.id)}
          >
            <div className={styles.employeeItemLeft}>
              <div className={styles.employeeNameRow}>
                <span className={styles.employeeName}>{emp.name}</span>
                {sent && <span className={styles.sentBadge}>送信済</span>}
              </div>
              <span className={styles.employeeMeta}>
                {emp.employeeType} · {emp.departmentName}
              </span>
            </div>
            <span className={styles.employeeNet}>
              {ps ? yen(ps.netPayment) : '-'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
