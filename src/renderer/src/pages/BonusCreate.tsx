import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  getEmployees,
  isEmailSent,
  sendEmail,
  isBonusRecipient,
  loadBonusFromDb,
  loadPreviousBonusFromDb,
  saveBonusToDb,
  loadEmailHistory,
  type MockEmployee,
  type MockPayslip,
} from '@/lib/mock-data'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window
import { BulkEmailModal } from '@/components/BulkEmailModal'
import { PayslipDirectPrint } from '@/components/PayslipDirectPrint'
import { BonusReportModal } from '@/components/BonusReportModal'
import { BonusBulkEditModal } from '@/components/BonusBulkEditModal'
import { buildBonusEmail } from '@/lib/email-template'
import { getSettings } from '@/lib/settings-store'
import { sendDocsByEmail, isMailSendAvailable, type MailDocItem } from '@/lib/mail-client'
import styles from './BonusCreate.module.css'

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

export interface MockBonus {
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

/** 支給・控除の変更後に合計と差引支給額を再計算する。 */
function recalcBonus(b: MockBonus): MockBonus {
  const totalPayment = b.basicBonus + b.performanceBonus + b.specialBonus
  const totalDeduction =
    b.healthInsurance + b.nursingInsurance + b.welfarePension + b.employmentInsurance + b.incomeTax
  return { ...b, totalPayment, totalDeduction, netPayment: totalPayment - totalDeduction }
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

/** DB から読み込んだ MockPayslip 形を画面用 MockBonus に逆変換する。 */
function payslipShapeToBonus(p: MockPayslip, season: '夏季' | '冬季'): MockBonus {
  return {
    id: p.id,
    employeeId: p.employeeId,
    year: p.year,
    season,
    basicBonus: p.basicSalary,
    performanceBonus: p.otherAllowance,
    specialBonus: p.specialAllowance,
    totalPayment: p.totalPayment,
    healthInsurance: p.healthInsurance,
    nursingInsurance: p.nursingInsurance,
    welfarePension: p.welfarePension,
    employmentInsurance: p.employmentInsurance,
    incomeTax: p.incomeTax,
    totalDeduction: p.totalDeduction,
    netPayment: p.netPayment,
  }
}

/** 金額が全て 0 の空の賞与明細を作る（前回データが無い場合の初期値）。 */
function emptyBonus(emp: MockEmployee, year: number, season: '夏季' | '冬季', idx: number): MockBonus {
  return {
    id: idx + 1,
    employeeId: emp.id,
    year,
    season,
    basicBonus: 0,
    performanceBonus: 0,
    specialBonus: 0,
    totalPayment: 0,
    healthInsurance: 0,
    nursingInsurance: 0,
    welfarePension: 0,
    employmentInsurance: 0,
    incomeTax: 0,
    totalDeduction: 0,
    netPayment: 0,
  }
}

/**
 * 賞与作成時の初期表示データを組み立てる。
 * - 前回（同季）の入力値があれば、その金額をそのまま初期値にする（従業員ごとにマッチング）。
 * - 前回データが無い従業員（新入社員など）は 0 円で開始し、手入力してもらう。
 * ※仮の賞与率による自動算出は廃止。以降は全て手入力で編集する運用。
 */
function buildInitialBonuses(
  employees: MockEmployee[],
  year: number,
  season: '夏季' | '冬季',
  previous?: MockBonus[],
  paymentDate?: string | null,
): MockBonus[] {
  const prevMap = new Map<number, MockBonus>((previous ?? []).map((b) => [b.employeeId, b]))
  return employees
    .filter((emp) => isBonusRecipient(emp, year, season, paymentDate))
    .map((emp, idx) => {
      const prev = prevMap.get(emp.id)
      if (prev) {
        return recalcBonus({ ...prev, id: idx + 1, year, season })
      }
      return emptyBonus(emp, year, season, idx)
    })
}

export function BonusCreate(): React.ReactElement {
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedSeason, setSelectedSeason] = useState<'夏季' | '冬季'>('夏季')
  const [paymentDate, setPaymentDate] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [showBulkEmail, setShowBulkEmail] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [emailRefresh, setEmailRefresh] = useState(0)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const employees = useMemo(() => getEmployees(), [])

  // 賞与は「支給月に在籍している人」が対象。パート・支給月より前に退職した人は除外する。
  const eligibleEmployees = useMemo(
    () => employees.filter((emp) => isBonusRecipient(emp, selectedYear, selectedSeason, paymentDate)),
    [employees, selectedYear, selectedSeason, paymentDate],
  )

  const filteredEmployees = useMemo(
    () =>
      eligibleEmployees.filter(
        (emp) =>
          emp.name.includes(searchQuery) || emp.nameKana.includes(searchQuery),
      ),
    [eligibleEmployees, searchQuery],
  )

  // 賞与データ。DB に保存済みがあればそれを（発行時のまま）復元し、無ければ
  // 前回（同季）の入力値をそのまま初期表示する。前回が無ければ 0 円で開始する。
  const [bonuses, setBonuses] = useState<MockBonus[]>(() =>
    buildInitialBonuses(employees, selectedYear, selectedSeason),
  )

  useEffect(() => {
    let cancelled = false
    setSaveMessage(null)
    void (async () => {
      if (hasElectronApi) await loadEmailHistory('bonus', selectedYear, selectedSeason)
      const saved = hasElectronApi ? await loadBonusFromDb(selectedYear, selectedSeason) : null
      if (cancelled) return
      if (saved) {
        setBonuses(saved.list.map((p) => payslipShapeToBonus(p, selectedSeason)))
        setPaymentDate(saved.paymentDate ?? '')
      } else {
        // 未作成のシーズンは、前回（同季）の入力値を初期値として引き継ぐ。
        const prev = hasElectronApi ? await loadPreviousBonusFromDb(selectedYear, selectedSeason) : null
        if (cancelled) return
        const previousBonuses = prev?.list.map((p) => payslipShapeToBonus(p, selectedSeason))
        setBonuses(buildInitialBonuses(employees, selectedYear, selectedSeason, previousBonuses))
        setPaymentDate('')
      }
      setEmailRefresh((k) => k + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [employees, selectedYear, selectedSeason])

  // 支給月に在籍していない人（支給月より前に退職）を除外して保存対象を確定する。
  const recipientBonuses = useCallback(
    (list: MockBonus[]): MockBonus[] => {
      const eligibleIds = new Set(eligibleEmployees.map((e) => e.id))
      return list.filter((b) => eligibleIds.has(b.employeeId))
    },
    [eligibleEmployees],
  )

  const handleSave = useCallback(async (): Promise<void> => {
    setSaveMessage('保存中...')
    if (!hasElectronApi) {
      setSaveMessage('保存しました')
      return
    }
    const ok = await saveBonusToDb(
      selectedYear,
      selectedSeason,
      recipientBonuses(bonuses).map(bonusToPayslipShape),
      paymentDate || null,
    )
    setSaveMessage(ok ? '保存しました' : '保存に失敗しました')
  }, [selectedYear, selectedSeason, bonuses, paymentDate, recipientBonuses])

  // この年・シーズンの賞与を削除して「未作成」に戻す。
  // 削除後は前回（同季）の入力値を引き継いだ初期表示に戻す。
  const handleClear = useCallback(async (): Promise<void> => {
    const ok = window.confirm(
      `${selectedYear}年 ${selectedSeason}賞与を削除して「未作成」に戻します。\n` +
        'この賞与で入力・保存した内容は失われます。よろしいですか？',
    )
    if (!ok) return
    setSaveMessage('削除中...')
    if (hasElectronApi) {
      await saveBonusToDb(selectedYear, selectedSeason, [], null)
      const prev = await loadPreviousBonusFromDb(selectedYear, selectedSeason)
      const previousBonuses = prev?.list.map((p) => payslipShapeToBonus(p, selectedSeason))
      setBonuses(buildInitialBonuses(employees, selectedYear, selectedSeason, previousBonuses))
    } else {
      setBonuses(buildInitialBonuses(employees, selectedYear, selectedSeason))
    }
    setPaymentDate('')
    setEmailRefresh((k) => k + 1)
    setSaveMessage('削除しました（未作成に戻しました）')
  }, [selectedYear, selectedSeason, employees])

  // 明細の金額欄を編集する（支給・控除）。変更後は合計・差引支給額を再計算する。
  const handleFieldChange = useCallback(
    (employeeId: number, field: keyof MockBonus, value: number): void => {
      setBonuses((prev) =>
        prev.map((b) => (b.employeeId === employeeId ? recalcBonus({ ...b, [field]: value }) : b)),
      )
    },
    [],
  )

  // 一括編集モーダルの適用結果を state に反映し、そのまま DB へ保存する。
  const handleBulkApply = useCallback(
    async (updated: MockBonus[]): Promise<void> => {
      setBonuses(updated)
      setShowBulkEdit(false)
      if (!hasElectronApi) {
        setSaveMessage('保存しました')
        return
      }
      setSaveMessage('保存中...')
      const ok = await saveBonusToDb(
        selectedYear,
        selectedSeason,
        recipientBonuses(updated).map(bonusToPayslipShape),
        paymentDate || null,
      )
      setSaveMessage(ok ? '保存しました' : '保存に失敗しました')
    },
    [selectedYear, selectedSeason, paymentDate, recipientBonuses],
  )

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  )

  const selectedBonus = useMemo(
    () => bonuses.find((b) => b.employeeId === selectedEmployeeId),
    [bonuses, selectedEmployeeId],
  )

  // 選択中の従業員が対象外（賞与支給月より前に退職など）になったら先頭へ切り替える。
  useEffect(() => {
    if (filteredEmployees.length === 0) return
    if (!filteredEmployees.some((e) => e.id === selectedEmployeeId)) {
      setSelectedEmployeeId(filteredEmployees[0].id)
    }
  }, [filteredEmployees, selectedEmployeeId])

  // 一覧表・一括編集・PDF に渡す、支給対象者のみに絞った賞与データ。
  const visibleBonuses = useMemo(() => recipientBonuses(bonuses), [recipientBonuses, bonuses])

  const emailSentMap = useMemo(() => {
    const map = new Map<number, boolean>()
    for (const emp of eligibleEmployees) {
      map.set(emp.id, isEmailSent(emp.id, 'bonus', selectedYear, selectedSeason))
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleEmployees, selectedYear, selectedSeason, emailRefresh])

  const buildMailItem = useCallback(
    (emp: MockEmployee): MailDocItem | null => {
      if (!emp.email) return null
      const bonus = bonuses.find((b) => b.employeeId === emp.id)
      if (!bonus) return null
      const settings = getSettings()
      const email = buildBonusEmail({
        employeeName: emp.name,
        year: selectedYear,
        season: selectedSeason,
        companyName: settings.companyName,
      })
      return {
        refId: emp.id,
        name: emp.name,
        to: emp.email,
        subject: email.subject,
        body: email.body,
        html: email.html,
        fileName: `${selectedYear}_${selectedSeason}賞与_${emp.name}様`,
        doc: {
          employee: emp,
          payslip: bonusToPayslipShape(bonus),
          year: selectedYear,
          month: selectedSeason === '夏季' ? 7 : 12,
          paymentDate,
          titleLabel: '賞 与 明 細 書',
          periodLabel: `${selectedYear}年 ${selectedSeason}賞与`,
          variant: 'bonus',
        },
      }
    },
    [bonuses, selectedYear, selectedSeason, paymentDate],
  )

  const handleEmailSend = useCallback(async (): Promise<void> => {
    if (!selectedEmployee?.email) {
      alert('メールアドレスが登録されていません。')
      return
    }
    if (!isMailSendAvailable()) {
      sendEmail(selectedEmployee.id, 'bonus', selectedYear, selectedSeason)
      setEmailRefresh((k) => k + 1)
      return
    }
    const item = buildMailItem(selectedEmployee)
    if (!item) {
      alert('賞与データが見つかりません。')
      return
    }
    try {
      const results = await sendDocsByEmail([item])
      const r = results[0]
      if (r?.success) {
        sendEmail(selectedEmployee.id, 'bonus', selectedYear, selectedSeason)
        setEmailRefresh((k) => k + 1)
      } else {
        alert(`送信に失敗しました: ${r?.error ?? '不明なエラー'}`)
      }
    } catch (err) {
      alert(`送信に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    }
  }, [selectedEmployee, selectedYear, selectedSeason, buildMailItem])

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
          {saveMessage && <span className={styles.detailBadge}>{saveMessage}</span>}
          <button className={styles.btnSecondary} onClick={() => setShowBulkEdit(true)}>一括編集</button>
          <button className={styles.btnDanger} onClick={() => void handleClear()}>削除</button>
          <button className={styles.btnSecondary} onClick={() => setShowReport(true)}>賞与一覧表</button>
          <button className={styles.btnSecondary} onClick={() => setShowBulkEmail(true)}>一括送信</button>
          <button className={styles.btnSecondary} onClick={handleEmailSend}>個別送信</button>
          <button className={styles.btnSecondary} onClick={() => void handleSave()}>保存</button>
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
              onChange={handleFieldChange}
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
          makeItem={buildMailItem}
          onClose={() => setShowBulkEmail(false)}
          onSent={handleEmailSent}
        />
      )}

      {showPdfPreview && selectedEmployee && selectedBonus && (
        <PayslipDirectPrint
          employee={selectedEmployee}
          payslip={bonusToPayslipShape(selectedBonus)}
          year={selectedYear}
          month={selectedSeason === '夏季' ? 7 : 12}
          paymentDate={paymentDate}
          titleLabel="賞 与 明 細 書"
          periodLabel={`${selectedYear}年 ${selectedSeason}賞与`}
          variant="bonus"
          onDone={() => setShowPdfPreview(false)}
        />
      )}

      {showReport && (
        <BonusReportModal
          bonuses={visibleBonuses}
          year={selectedYear}
          season={selectedSeason}
          paymentDate={paymentDate}
          onClose={() => setShowReport(false)}
        />
      )}

      {showBulkEdit && (
        <BonusBulkEditModal
          bonuses={visibleBonuses}
          employees={eligibleEmployees}
          year={selectedYear}
          season={selectedSeason}
          onApply={handleBulkApply}
          onClose={() => setShowBulkEdit(false)}
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
  onChange,
}: {
  employee: MockEmployee
  bonus: MockBonus
  year: number
  season: string
  paymentDate: string
  onChange: (employeeId: number, field: keyof MockBonus, value: number) => void
}): React.ReactElement {
  const handleChange = useCallback(
    (field: keyof MockBonus) =>
      (e: React.ChangeEvent<HTMLInputElement>): void => {
        onChange(employee.id, field, Number(e.target.value))
      },
    [onChange, employee.id],
  )

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
              <EditableRow label="基本賞与" value={bonus.basicBonus} onChange={handleChange('basicBonus')} />
              <EditableRow label="業績賞与" value={bonus.performanceBonus} onChange={handleChange('performanceBonus')} />
              <EditableRow label="特別賞与" value={bonus.specialBonus} onChange={handleChange('specialBonus')} />
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
              <EditableRow label="健康保険" value={bonus.healthInsurance} onChange={handleChange('healthInsurance')} />
              <EditableRow label="介護保険" value={bonus.nursingInsurance} onChange={handleChange('nursingInsurance')} />
              <EditableRow label="厚生年金" value={bonus.welfarePension} onChange={handleChange('welfarePension')} />
              <EditableRow label="雇用保険" value={bonus.employmentInsurance} onChange={handleChange('employmentInsurance')} />
              <EditableRow label="所得税" value={bonus.incomeTax} onChange={handleChange('incomeTax')} />
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

function EditableRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}): React.ReactElement {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
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
