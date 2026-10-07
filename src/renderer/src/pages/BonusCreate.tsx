import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  getEmployees,
  isEmailSent,
  sendEmail,
  isBonusRecipient,
  defaultBonusBasicAmount,
  loadBonusFromDb,
  loadPreviousBonusFromDb,
  saveBonusToDb,
  loadEmailHistory,
  reloadEmployeesFromDb,
  type MockEmployee,
  type MockPayslip,
  type PayslipExtraLine,
  sumExtraLines,
} from '@/lib/mock-data'
import { buildYearSelectOptions } from '@/lib/year-options'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window
import { BulkEmailModal } from '@/components/BulkEmailModal'
import { PayslipDirectPrint } from '@/components/PayslipDirectPrint'
import { BonusReportModal } from '@/components/BonusReportModal'
import { BonusBulkEditModal } from '@/components/BonusBulkEditModal'
import { BonusRecipientModal } from '@/components/BonusRecipientModal'
import { ExtraLinesSection } from '@/components/PayslipExtraLinesEditor'
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
  extraPaymentLines: PayslipExtraLine[]
  extraDeductionLines: PayslipExtraLine[]
  totalPayment: number
  healthInsurance: number
  nursingInsurance: number
  welfarePension: number
  employmentInsurance: number
  incomeTax: number
  totalDeduction: number
  netPayment: number
}

function cloneExtraLines(lines: PayslipExtraLine[] | undefined): PayslipExtraLine[] {
  if (!Array.isArray(lines)) return []
  return lines.map((line) => ({ ...line }))
}

function normalizeBonusForEdit(b: MockBonus): MockBonus {
  return {
    ...b,
    extraPaymentLines: cloneExtraLines(b.extraPaymentLines),
    extraDeductionLines: cloneExtraLines(b.extraDeductionLines),
  }
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
    paidLeaveDays: 0,
    basicSalary: b.basicBonus,
    overtimePay: 0,
    transportAllowance: 0,
    positionAllowance: 0,
    familyAllowance: 0,
    specialAllowance: b.specialBonus,
    dangerAllowance: 0,
    salesAllowance: 0,
    otherAllowance: b.performanceBonus,
    extraPaymentLines: cloneExtraLines(b.extraPaymentLines),
    extraDeductionLines: cloneExtraLines(b.extraDeductionLines),
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
    extraPaymentLines: cloneExtraLines(p.extraPaymentLines),
    extraDeductionLines: cloneExtraLines(p.extraDeductionLines),
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

/**
 * 前回データが無い場合の初期明細を作る。
 * 基本賞与は会社ルール（社員: 基本給×1/×2、パート: 7万/8万）で埋め、控除は 0（手入力）。
 */
function emptyBonus(emp: MockEmployee, year: number, season: '夏季' | '冬季', idx: number): MockBonus {
  const basicBonus = defaultBonusBasicAmount(emp, season)
  return {
    id: idx + 1,
    employeeId: emp.id,
    year,
    season,
    basicBonus,
    performanceBonus: 0,
    specialBonus: 0,
    extraPaymentLines: [],
    extraDeductionLines: [],
    totalPayment: basicBonus,
    healthInsurance: 0,
    nursingInsurance: 0,
    welfarePension: 0,
    employmentInsurance: 0,
    incomeTax: 0,
    totalDeduction: 0,
    netPayment: basicBonus,
  }
}

/**
 * 前回（同季）の明細を引き継ぐ際、基本賞与だけは現在の基本給・区分から会社ルールで
 * 再計算する（社員・パートのみ。役員は前回値のまま）。控除や追加行は前回値を維持する。
 */
function applyBonusRule(bonus: MockBonus, emp: MockEmployee, season: '夏季' | '冬季'): MockBonus {
  if (emp.employeeType !== '社員' && emp.employeeType !== 'パート') return bonus
  return { ...bonus, basicBonus: defaultBonusBasicAmount(emp, season) }
}

/**
 * 支給対象者の手動調整。自動判定（isBonusRecipient）に対して、
 * include は「自動では対象外だが手で追加した人」、exclude は「自動では対象だが手で外した人」。
 */
interface RecipientOverrides {
  include: ReadonlySet<number>
  exclude: ReadonlySet<number>
}

const NO_OVERRIDES: RecipientOverrides = { include: new Set(), exclude: new Set() }

/** 自動判定に手動の追加・除外を重ねた、現在の支給対象者（従業員マスタの並び順）。 */
function resolveRecipients(
  employees: MockEmployee[],
  year: number,
  season: '夏季' | '冬季',
  paymentDate: string | null | undefined,
  overrides: RecipientOverrides,
): MockEmployee[] {
  return employees.filter((emp) => {
    if (overrides.exclude.has(emp.id)) return false
    if (overrides.include.has(emp.id)) return true
    return isBonusRecipient(emp, year, season, paymentDate)
  })
}

/**
 * 「この人たちを対象にしたい」という ID 集合から、自動判定との差分を手動調整として求める。
 * 保存済みの顔ぶれを復元するときと、対象者モーダルで確定したときに使う。
 */
function deriveOverrides(
  recipientIds: ReadonlySet<number>,
  employees: MockEmployee[],
  year: number,
  season: '夏季' | '冬季',
  paymentDate: string | null | undefined,
): RecipientOverrides {
  const include = new Set<number>()
  const exclude = new Set<number>()
  for (const emp of employees) {
    const auto = isBonusRecipient(emp, year, season, paymentDate)
    const wanted = recipientIds.has(emp.id)
    if (wanted && !auto) include.add(emp.id)
    if (!wanted && auto) exclude.add(emp.id)
  }
  return { include, exclude }
}

/**
 * 支給対象者と賞与明細を同期する。
 * - 対象者全員に明細行を用意する
 * - 既存の入力値は維持し、新たに対象になった人だけ初期行または fallback を追加する
 * - 対象外になった人の明細は除外する
 */
function syncBonusesWithRecipients(
  current: MockBonus[],
  recipients: MockEmployee[],
  year: number,
  season: '夏季' | '冬季',
  fallback?: MockBonus[],
): MockBonus[] {
  const bonusMap = new Map(current.map((b) => [b.employeeId, b]))
  const fallbackMap = new Map((fallback ?? []).map((b) => [b.employeeId, b]))
  return recipients.map((emp, idx) => {
    const existing = bonusMap.get(emp.id)
    if (existing) {
      return recalcBonus(normalizeBonusForEdit({ ...existing, id: idx + 1, year, season }))
    }
    const prev = fallbackMap.get(emp.id)
    if (prev) {
      return recalcBonus(
        applyBonusRule(normalizeBonusForEdit({ ...prev, id: idx + 1, year, season }), emp, season),
      )
    }
    return emptyBonus(emp, year, season, idx)
  })
}

/**
 * 賞与作成時の初期表示データを組み立てる。
 * - 基本賞与は会社ルールで算出する（社員: 基本給×1（夏）/×2（冬）、パート: 7万（夏）/8万（冬））。
 * - 前回（同季）の入力値があれば、控除・追加行はそのまま引き継ぐ（従業員ごとにマッチング）。
 * - 控除（社会保険料・所得税など）は自動計算せず手入力する運用。
 */
function buildInitialBonuses(
  employees: MockEmployee[],
  year: number,
  season: '夏季' | '冬季',
  previous?: MockBonus[],
  paymentDate?: string | null,
): MockBonus[] {
  const recipients = resolveRecipients(employees, year, season, paymentDate, NO_OVERRIDES)
  return syncBonusesWithRecipients([], recipients, year, season, previous)
}

export function BonusCreate(): React.ReactElement {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedSeason, setSelectedSeason] = useState<'夏季' | '冬季'>('夏季')
  const [paymentDate, setPaymentDate] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [showBulkEmail, setShowBulkEmail] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showRecipients, setShowRecipients] = useState(false)
  const [emailRefresh, setEmailRefresh] = useState(0)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [employeeRefreshKey, setEmployeeRefreshKey] = useState(0)
  const dirtyRef = useRef(false)
  const bonusLoadGenRef = useRef(0)
  const prevPaymentDateRef = useRef<string | undefined>(undefined)

  // 従業員マスタの最新状態（役員の賞与支給フラグ等）を反映する
  useEffect(() => {
    if (!hasElectronApi) return
    void reloadEmployeesFromDb().then((ok) => {
      if (ok) setEmployeeRefreshKey((k) => k + 1)
    })
  }, [])

  const employees = useMemo(() => getEmployees(), [employeeRefreshKey])

  // 支給対象者の手動調整（自動判定への追加・除外）。保存済みを読み込んだときは保存どおりの顔ぶれになるよう逆算する。
  const [overrides, setOverrides] = useState<RecipientOverrides>(NO_OVERRIDES)

  // 賞与データ。DB に保存済みがあればそれを（発行時の顔ぶれ・金額のまま）復元し、無ければ
  // 自動判定の対象者に対して基本賞与を会社ルールで算出し、控除等は前回（同季）の入力値を引き継いで初期表示する。
  const [bonuses, setBonuses] = useState<MockBonus[]>(() =>
    buildInitialBonuses(employees, selectedYear, selectedSeason),
  )

  // 現在の支給対象者 = 明細行がある人（従業員マスタの並び順）。一覧・一括編集・PDF・メールはこれを使う。
  const recipientEmployees = useMemo(() => {
    const ids = new Set(bonuses.map((b) => b.employeeId))
    return employees.filter((emp) => ids.has(emp.id))
  }, [employees, bonuses])

  const recipientIds = useMemo(
    () => new Set(recipientEmployees.map((e) => e.id)),
    [recipientEmployees],
  )

  const filteredEmployees = useMemo(
    () =>
      recipientEmployees.filter(
        (emp) =>
          emp.name.includes(searchQuery) || emp.nameKana.includes(searchQuery),
      ),
    [recipientEmployees, searchQuery],
  )

  useEffect(() => {
    const gen = ++bonusLoadGenRef.current
    let cancelled = false
    setSaveMessage(null)
    void (async () => {
      if (hasElectronApi) await loadEmailHistory('bonus', selectedYear, selectedSeason)
      const saved = (hasElectronApi || import.meta.env.DEV)
        ? await loadBonusFromDb(selectedYear, selectedSeason)
        : null
      if (cancelled || gen !== bonusLoadGenRef.current) return
      if (saved) {
        // 保存済みは保存どおりの顔ぶれで復元する（自動判定で人を足し引きしない）。
        const loaded = saved.list.map((p) => payslipShapeToBonus(p, selectedSeason))
        const payDate = saved.paymentDate ?? ''
        const savedIds = new Set(loaded.map((b) => b.employeeId))
        const nextOverrides = deriveOverrides(savedIds, employees, selectedYear, selectedSeason, payDate)
        const recipients = resolveRecipients(employees, selectedYear, selectedSeason, payDate, nextOverrides)
        setOverrides(nextOverrides)
        setBonuses(syncBonusesWithRecipients(loaded, recipients, selectedYear, selectedSeason))
        setPaymentDate(payDate)
        prevPaymentDateRef.current = payDate
      } else {
        // 未作成のシーズンは、自動判定の対象者で、基本賞与を会社ルールで算出し、控除等は前回（同季）の入力値を引き継ぐ。
        const prev = (hasElectronApi || import.meta.env.DEV)
          ? await loadPreviousBonusFromDb(selectedYear, selectedSeason)
          : null
        if (cancelled || gen !== bonusLoadGenRef.current) return
        const previousBonuses = prev?.list.map((p) => payslipShapeToBonus(p, selectedSeason))
        setOverrides(NO_OVERRIDES)
        setBonuses(buildInitialBonuses(employees, selectedYear, selectedSeason, previousBonuses))
        setPaymentDate('')
        prevPaymentDateRef.current = ''
      }
      dirtyRef.current = false
      setRefreshKey((k) => k + 1)
      setEmailRefresh((k) => k + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [employees, selectedYear, selectedSeason])

  // 支給日変更で自動判定の対象者が変わったとき、手動の追加・除外は保ったまま一覧・明細を同期する（DB再読込はしない）
  useEffect(() => {
    if (prevPaymentDateRef.current === undefined) {
      prevPaymentDateRef.current = paymentDate
      return
    }
    if (prevPaymentDateRef.current === paymentDate) return
    prevPaymentDateRef.current = paymentDate
    const recipients = resolveRecipients(employees, selectedYear, selectedSeason, paymentDate, overrides)
    setBonuses((prev) => syncBonusesWithRecipients(prev, recipients, selectedYear, selectedSeason))
  }, [paymentDate, employees, selectedYear, selectedSeason, overrides])

  // 対象者モーダル・「対象から外す」で決めた顔ぶれを反映する。追加された人は初期行で入り、外された人の明細は消える。
  const handleRecipientsApply = useCallback(
    (ids: number[]): void => {
      const wanted = new Set(ids)
      const nextOverrides = deriveOverrides(wanted, employees, selectedYear, selectedSeason, paymentDate)
      const recipients = resolveRecipients(employees, selectedYear, selectedSeason, paymentDate, nextOverrides)
      dirtyRef.current = true
      setOverrides(nextOverrides)
      setBonuses((prev) => syncBonusesWithRecipients(prev, recipients, selectedYear, selectedSeason))
      setShowRecipients(false)
    },
    [employees, selectedYear, selectedSeason, paymentDate],
  )

  const handleExcludeSelected = useCallback((): void => {
    const emp = employees.find((e) => e.id === selectedEmployeeId)
    if (!emp) return
    if (recipientIds.size <= 1) {
      alert('対象者が 0 名になるため外せません。別の人を追加してから外してください。')
      return
    }
    const ok = window.confirm(
      `${emp.name} を ${selectedYear}年 ${selectedSeason}賞与の対象から外します。\n` +
        'この人の入力内容は消えます。よろしいですか？（対象者を追加・除外 から戻せます）',
    )
    if (!ok) return
    handleRecipientsApply([...recipientIds].filter((id) => id !== emp.id))
  }, [employees, selectedEmployeeId, recipientIds, selectedYear, selectedSeason, handleRecipientsApply])

  // 従業員マスタから消えた人の行を除いて保存対象を確定する。
  const recipientBonuses = useCallback(
    (list: MockBonus[]): MockBonus[] => {
      const ids = new Set(employees.map((e) => e.id))
      return list.filter((b) => ids.has(b.employeeId))
    },
    [employees],
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
    if (ok) dirtyRef.current = false
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
    setOverrides(NO_OVERRIDES)
    setPaymentDate('')
    dirtyRef.current = false
    setRefreshKey((k) => k + 1)
    setEmailRefresh((k) => k + 1)
    setSaveMessage('削除しました（未作成に戻しました）')
  }, [selectedYear, selectedSeason, employees])

  // 明細の金額欄を編集する（支給・控除）。変更後は合計・差引支給額を再計算する。
  const handleFieldChange = useCallback(
    (employeeId: number, field: keyof MockBonus, value: number): void => {
      dirtyRef.current = true
      setBonuses((prev) =>
        prev.map((b) => (b.employeeId === employeeId ? recalcBonus({ ...b, [field]: value }) : b)),
      )
    },
    [],
  )

  const handleExtraLinesCommit = useCallback(
    (
      employeeId: number,
      kind: 'payment' | 'deduction',
      updater: (prev: PayslipExtraLine[]) => PayslipExtraLine[],
    ): void => {
      dirtyRef.current = true
      setBonuses((prev) =>
        prev.map((b) => {
          if (b.employeeId !== employeeId) return b
          const current =
            kind === 'payment'
              ? cloneExtraLines(b.extraPaymentLines)
              : cloneExtraLines(b.extraDeductionLines)
          const nextLines = updater(current)
          const next =
            kind === 'payment'
              ? { ...b, extraPaymentLines: nextLines }
              : { ...b, extraDeductionLines: nextLines }
          return recalcBonus(next)
        }),
      )
    },
    [],
  )

  useEffect(() => {
    if (!dirtyRef.current || !hasElectronApi) return
    const timer = setTimeout(() => {
      void (async () => {
        const ok = await saveBonusToDb(
          selectedYear,
          selectedSeason,
          recipientBonuses(bonuses).map(bonusToPayslipShape),
          paymentDate || null,
        )
        if (ok) {
          dirtyRef.current = false
          setSaveMessage('保存しました')
        }
      })()
    }, 800)
    return () => clearTimeout(timer)
  }, [bonuses, selectedYear, selectedSeason, paymentDate, recipientBonuses])

  // 一括編集モーダルの適用結果を state に反映し、そのまま DB へ保存する。
  const handleBulkApply = useCallback(
    async (updated: MockBonus[]): Promise<void> => {
      dirtyRef.current = true
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
      if (ok) dirtyRef.current = false
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

  // 選択中の従業員が対象外（除外・賞与支給月より前に退職など）になったら先頭へ切り替える。
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
    for (const emp of recipientEmployees) {
      map.set(emp.id, isEmailSent(emp.id, 'bonus', selectedYear, selectedSeason))
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientEmployees, selectedYear, selectedSeason, emailRefresh])

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
              {buildYearSelectOptions().map((y) => (
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
          <div className={styles.recipientBar}>
            <span className={styles.recipientCount}>対象 {recipientEmployees.length} 名</span>
            <button
              type="button"
              className={styles.recipientButton}
              onClick={() => setShowRecipients(true)}
            >
              対象者を追加・除外
            </button>
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
              syncKey={`${selectedYear}-${selectedSeason}-${refreshKey}-${selectedEmployee.id}`}
              onChange={handleFieldChange}
              onExtraLinesCommit={handleExtraLinesCommit}
              onExclude={handleExcludeSelected}
            />
          ) : (
            <div className={styles.emptyState}>
              {recipientEmployees.length === 0
                ? '支給対象者がいません。「対象者を追加・除外」から追加してください'
                : '従業員を選択してください'}
            </div>
          )}
        </main>
      </div>

      {showRecipients && (
        <BonusRecipientModal
          employees={employees}
          recipientIds={recipientIds}
          year={selectedYear}
          season={selectedSeason}
          paymentDate={paymentDate}
          onApply={handleRecipientsApply}
          onClose={() => setShowRecipients(false)}
        />
      )}

      {showBulkEmail && (
        <BulkEmailModal
          employees={recipientEmployees}
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
          employees={recipientEmployees}
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
  syncKey,
  onChange,
  onExtraLinesCommit,
  onExclude,
}: {
  employee: MockEmployee
  bonus: MockBonus
  year: number
  season: string
  paymentDate: string
  syncKey: string
  onChange: (employeeId: number, field: keyof MockBonus, value: number) => void
  onExtraLinesCommit: (
    employeeId: number,
    kind: 'payment' | 'deduction',
    updater: (prev: PayslipExtraLine[]) => PayslipExtraLine[],
  ) => void
  onExclude: () => void
}): React.ReactElement {
  const handleChange = useCallback(
    (field: keyof MockBonus) =>
      (e: React.ChangeEvent<HTMLInputElement>): void => {
        onChange(employee.id, field, Number(e.target.value))
      },
    [onChange, employee.id],
  )

  const handlePaymentExtrasCommit = useCallback(
    (updater: (prev: PayslipExtraLine[]) => PayslipExtraLine[]) => {
      onExtraLinesCommit(employee.id, 'payment', updater)
    },
    [onExtraLinesCommit, employee.id],
  )

  const handleDeductionExtrasCommit = useCallback(
    (updater: (prev: PayslipExtraLine[]) => PayslipExtraLine[]) => {
      onExtraLinesCommit(employee.id, 'deduction', updater)
    },
    [onExtraLinesCommit, employee.id],
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
        <button type="button" className={styles.excludeButton} onClick={onExclude}>
          対象から外す
        </button>
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
            <ExtraLinesSection
              lines={bonus.extraPaymentLines}
              syncKey={syncKey}
              onCommit={handlePaymentExtrasCommit}
            />
            <div className={styles.sectionTotal}>
              <span>支給合計</span>
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
            <ExtraLinesSection
              lines={bonus.extraDeductionLines}
              syncKey={syncKey}
              onCommit={handleDeductionExtrasCommit}
            />
            <div className={styles.sectionTotal}>
              <span>控除合計</span>
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
