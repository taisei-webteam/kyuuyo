import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { ReactElement, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getEmployees,
  getPayslips,
  createPayslips,
  deletePayslips,
  aggregateAttendanceRecords,
  isPayslipsCreated,
  isEmailSent,
  sendEmail,
  loadPayslipsFromDb,
  savePayslipsToDb,
  setPayslips,
  loadEmailHistory,
  isPayrollTargetInMonth,
  type MockEmployee,
  type MockPayslip,
  type PayslipExtraLine,
  sumExtraLines,
} from '@/lib/mock-data'
import { buildYearSelectOptions } from '@/lib/year-options'
import { BulkEmailModal } from '@/components/BulkEmailModal'
import { PayslipDirectPrint } from '@/components/PayslipDirectPrint'
import { PayslipBulkPrint, type BulkPrintItem } from '@/components/PayslipBulkPrint'
import { ExtraLinesSection } from '@/components/PayslipExtraLinesEditor'
import { buildPayslipEmail } from '@/lib/email-template'
import { getSettings } from '@/lib/settings-store'
import { sendDocsByEmail, isMailSendAvailable, type MailDocItem } from '@/lib/mail-client'
import styles from './PayslipCreate.module.css'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 月次給与明細を CSV 文字列へ変換する（金額は円単位の整数、カンマ区切りなし）。 */
function buildPayslipCsv(
  items: Array<{ employee: MockEmployee; payslip: MockPayslip }>,
): string {
  const headers = [
    '氏名', 'フリガナ', '部署', '従業員区分',
    '勤務日数', '勤務時間', '残業時間', '休日出勤日数', '有給日数',
    '基本給', '時間外賃金', '交通費', '役職手当', '家族手当', '特別手当', '危険手当', '営業手当', 'その他手当', '総支給額',
    '健康保険', '介護保険', '厚生年金', '雇用保険', '所得税', '住民税', '積立', '貸付', 'その他控除', '控除合計',
    '差引支給額',
  ]
  const lines = [headers.join(',')]
  for (const { employee: e, payslip: p } of items) {
    const row: Array<string | number> = [
      e.name, e.nameKana, e.departmentName, e.employeeType,
      p.workDays, p.workHours, p.overtimeHours, p.holidayWorkDays, p.paidLeaveDays,
      p.basicSalary, p.overtimePay, p.transportAllowance, p.positionAllowance, p.familyAllowance,
      p.specialAllowance, p.dangerAllowance, p.salesAllowance, p.otherAllowance, p.totalPayment,
      p.healthInsurance, p.nursingInsurance, p.welfarePension, p.employmentInsurance,
      p.incomeTax, p.residentTax, p.savingsDeduction, p.loanDeduction, p.otherDeduction, p.totalDeduction,
      p.netPayment,
    ]
    lines.push(row.map(csvCell).join(','))
  }
  return lines.join('\r\n')
}

type DistributeMode = 'pdf' | 'email'

const PAYSLIP_CREATE_PERIOD_KEY = 'rakuraku-kyuuyo:payslip-create-period'

interface StoredPayslipCreatePeriod {
  year: number
  month: number
  employeeId?: number
}

function readStoredPayslipCreatePeriod(): StoredPayslipCreatePeriod | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PAYSLIP_CREATE_PERIOD_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const { year, month, employeeId } = parsed as Record<string, unknown>
    if (typeof year !== 'number' || typeof month !== 'number') return null
    if (month < 1 || month > 12) return null
    return {
      year,
      month,
      employeeId: typeof employeeId === 'number' ? employeeId : undefined,
    }
  } catch {
    return null
  }
}

function writeStoredPayslipCreatePeriod(period: StoredPayslipCreatePeriod): void {
  try {
    window.localStorage.setItem(PAYSLIP_CREATE_PERIOD_KEY, JSON.stringify(period))
  } catch {
    // ストレージ不可時は無視
  }
}

function recalcTotals(ps: MockPayslip): MockPayslip {
  const extraPaymentTotal = sumExtraLines(ps.extraPaymentLines ?? [])
  const extraDeductionTotal = sumExtraLines(ps.extraDeductionLines ?? [])
  const totalPayment =
    ps.basicSalary +
    ps.overtimePay +
    ps.transportAllowance +
    ps.positionAllowance +
    ps.familyAllowance +
    ps.specialAllowance +
    ps.dangerAllowance +
    ps.salesAllowance +
    extraPaymentTotal

  const totalDeduction =
    ps.healthInsurance +
    ps.nursingInsurance +
    ps.welfarePension +
    ps.employmentInsurance +
    ps.incomeTax +
    ps.residentTax +
    ps.savingsDeduction +
    ps.loanDeduction +
    ps.otherDeduction +
    extraDeductionTotal

  return {
    ...ps,
    otherAllowance: extraPaymentTotal,
    totalPayment,
    totalDeduction,
    netPayment: totalPayment - totalDeduction,
  }
}

export function PayslipCreate(): ReactElement {
  const navigate = useNavigate()
  const now = new Date()
  const storedPeriod = readStoredPayslipCreatePeriod()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(storedPeriod?.month ?? now.getMonth() + 1)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(storedPeriod?.employeeId ?? 1)
  const [searchQuery, setSearchQuery] = useState('')
  const [distributeMode, setDistributeMode] = useState<DistributeMode>('pdf')
  const [refreshKey, setRefreshKey] = useState(0)
  const [editPayslips, setEditPayslips] = useState<MockPayslip[]>([])
  const [showBulkEmail, setShowBulkEmail] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [bulkPrinting, setBulkPrinting] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [emailRefresh, setEmailRefresh] = useState(0)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [createMessage, setCreateMessage] = useState<string | null>(null)
  const [loadingMonth, setLoadingMonth] = useState(hasElectronApi)
  // ユーザー編集による変更のみ DB 保存するためのフラグ（DB ロード直後の保存を抑止）
  const dirtyRef = useRef(false)

  const employees = useMemo(() => getEmployees(), [])

  // リロード後も編集中の年月・従業員選択を維持する
  useEffect(() => {
    writeStoredPayslipCreatePeriod({
      year: selectedYear,
      month: selectedMonth,
      employeeId: selectedEmployeeId,
    })
  }, [selectedYear, selectedMonth, selectedEmployeeId])

  // 年月の切替時に SQLite から保存済み明細を読み込み、メモリキャッシュへ反映する。
  useEffect(() => {
    if (!hasElectronApi) {
      setLoadingMonth(false)
      return
    }
    let cancelled = false
    dirtyRef.current = false
    setLoadingMonth(true)
    void (async () => {
      try {
        await loadPayslipsFromDb(selectedYear, selectedMonth)
        await loadEmailHistory('payslip', selectedYear, selectedMonth)
      } finally {
        if (!cancelled) {
          setRefreshKey((k) => k + 1)
          setEmailRefresh((k) => k + 1)
          setLoadingMonth(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedYear, selectedMonth])

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

  // 年月切替・DB再読込(refreshKey)時のみ編集バッファを初期化する（入力中の再同期を防ぐ）
  useEffect(() => {
    setEditPayslips(rawPayslips.map((ps) => normalizePayslipForEdit({ ...ps })))
    dirtyRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, refreshKey])

  // 退職者は退職月まで表示し、退職翌月以降は給与作成から除外する（翌月分の勤務が無く明細を作らないため）。
  const filteredEmployees = useMemo(
    () =>
      employees.filter(
        (emp) =>
          isPayrollTargetInMonth(emp, selectedYear, selectedMonth) &&
          (emp.name.includes(searchQuery) || emp.nameKana.includes(searchQuery)),
      ),
    [employees, searchQuery, selectedYear, selectedMonth],
  )

  // 選択中の従業員が対象外（退職者の退職翌月など）になったら先頭へ切り替える。
  useEffect(() => {
    if (filteredEmployees.length === 0) return
    if (!filteredEmployees.some((e) => e.id === selectedEmployeeId)) {
      setSelectedEmployeeId(filteredEmployees[0].id)
    }
  }, [filteredEmployees, selectedEmployeeId])

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

  const handleCreate = useCallback(async (): Promise<void> => {
    // 未来月ガード: 当月より先の給与はまだ勤務実績が無いため作成させない
    const n = new Date()
    const isFuture =
      selectedYear > n.getFullYear() ||
      (selectedYear === n.getFullYear() && selectedMonth > n.getMonth() + 1)
    if (isFuture) {
      setCreateMessage('未来の月の給与は作成できません（まだ勤務実績がありません）')
      return
    }
    setCreating(true)
    setCreateMessage(null)
    try {
      // Electron 環境では Supabase 同期 → 丸め済みの実勤怠 (attendance_records) を取り込み、
      // 給与の出勤日数・労働時間・残業・休出に反映する。データが無い場合はモック勤怠にフォールバック。
      let realAttendance: ReturnType<typeof aggregateAttendanceRecords> | undefined
      if (hasElectronApi) {
        const result = await window.api.attendance.list(selectedYear, selectedMonth)
        if (result.success && result.data.length > 0) {
          realAttendance = aggregateAttendanceRecords(result.data)
        }
      }
      const data = createPayslips(selectedYear, selectedMonth, realAttendance)
      // 生成した明細を SQLite に永続化する（再起動後も保持される）
      const saved = await savePayslipsToDb(selectedYear, selectedMonth, data)
      dirtyRef.current = false
      setRefreshKey((k) => k + 1)
      if (realAttendance && realAttendance.size > 0) {
        setCreateMessage(`同期済みの勤怠データ（${realAttendance.size}名分）を反映して作成しました`)
      } else if (hasElectronApi && !saved) {
        setCreateMessage('同期済み勤怠が無いため、仮の勤怠で作成しました（勤怠管理で同期・丸めを実行してください）')
      } else if (hasElectronApi) {
        setCreateMessage('給与データを作成・保存しました')
      }
    } catch (err) {
      setCreateMessage(`作成に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setCreating(false)
    }
  }, [selectedYear, selectedMonth])

  const handleDelete = useCallback(async (): Promise<void> => {
    const ok = window.confirm(
      `${selectedYear}年${selectedMonth}月分の給与データを削除して「未作成」に戻します。\n` +
        'この月に入力・編集した内容は失われます。よろしいですか？\n\n' +
        '（月末に勤怠を同期してから作り直す場合などにご利用ください）',
    )
    if (!ok) return
    setDeleting(true)
    setCreateMessage(null)
    try {
      const done = await deletePayslips(selectedYear, selectedMonth)
      dirtyRef.current = false
      setEditPayslips([])
      setRefreshKey((k) => k + 1)
      setCreateMessage(
        done
          ? '給与データを削除しました。勤怠を確定・同期してから作り直してください。'
          : '削除に失敗しました。もう一度お試しください。',
      )
    } catch (err) {
      setCreateMessage(`削除に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setDeleting(false)
    }
  }, [selectedYear, selectedMonth])

  const handleFieldChange = useCallback(
    (employeeId: number, field: keyof MockPayslip, value: number): void => {
      dirtyRef.current = true
      setEditPayslips((prev) =>
        prev.map((ps) => {
          if (ps.employeeId !== employeeId) return ps
          return recalcTotals({ ...ps, [field]: value })
        }),
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
      setEditPayslips((prev) =>
        prev.map((ps) => {
          if (ps.employeeId !== employeeId) return ps
          const current =
            kind === 'payment'
              ? cloneExtraLines(ps.extraPaymentLines)
              : cloneExtraLines(ps.extraDeductionLines)
          const nextLines = updater(current)
          const next =
            kind === 'payment'
              ? { ...ps, extraPaymentLines: nextLines }
              : { ...ps, extraDeductionLines: nextLines }
          return recalcTotals(next)
        }),
      )
    },
    [],
  )

  // 編集内容を自動保存する（デバウンス）。DB ロード直後や未編集時は保存しない。
  useEffect(() => {
    if (!dirtyRef.current || editPayslips.length === 0) return
    const timer = setTimeout(() => {
      void (async () => {
        const ok = await savePayslipsToDb(selectedYear, selectedMonth, editPayslips)
        if (ok) {
          setPayslips(selectedYear, selectedMonth, editPayslips)
          dirtyRef.current = false
        }
      })()
    }, 800)
    return () => clearTimeout(timer)
  }, [editPayslips, selectedYear, selectedMonth])

  const buildMailItem = useCallback(
    (emp: MockEmployee): MailDocItem | null => {
      if (!emp.email) return null
      const payslip = editPayslips.find((p) => p.employeeId === emp.id)
      if (!payslip) return null
      const settings = getSettings()
      const email = buildPayslipEmail({
        employeeName: emp.name,
        year: selectedYear,
        month: selectedMonth,
        companyName: settings.companyName,
      })
      const mm = String(selectedMonth).padStart(2, '0')
      return {
        refId: emp.id,
        name: emp.name,
        to: emp.email,
        subject: email.subject,
        body: email.body,
        html: email.html,
        fileName: `${selectedYear}-${mm}_給与明細_${emp.name}様`,
        doc: { employee: emp, payslip, year: selectedYear, month: selectedMonth },
      }
    },
    [editPayslips, selectedYear, selectedMonth],
  )

  const handleEmailSend = useCallback(async (): Promise<void> => {
    if (!selectedEmployee?.email) {
      alert('メールアドレスが登録されていません。従業員管理画面で登録してください。')
      return
    }
    if (!isMailSendAvailable()) {
      // ブラウザ単体プレビューではモック記録のみ
      sendEmail(selectedEmployee.id, 'payslip', selectedYear, selectedMonth)
      setEmailRefresh((k) => k + 1)
      return
    }
    const item = buildMailItem(selectedEmployee)
    if (!item) {
      alert('明細データが見つかりません。先に給与データを作成してください。')
      return
    }
    setCreateMessage(`${selectedEmployee.name} さんへ送信中...`)
    try {
      const results = await sendDocsByEmail([item])
      const r = results[0]
      if (r?.success) {
        sendEmail(selectedEmployee.id, 'payslip', selectedYear, selectedMonth)
        setEmailRefresh((k) => k + 1)
        setCreateMessage(`${selectedEmployee.name} さんへ送信しました`)
      } else {
        setCreateMessage(null)
        alert(`送信に失敗しました: ${r?.error ?? '不明なエラー'}`)
      }
    } catch (err) {
      setCreateMessage(null)
      alert(`送信に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    }
  }, [selectedEmployee, selectedYear, selectedMonth, buildMailItem])

  const handleEmailSent = useCallback((): void => {
    setEmailRefresh((k) => k + 1)
  }, [])

  const handlePrint = useCallback((): void => {
    if (!selectedEmployee || !selectedPayslip) return
    setPrinting(true)
  }, [selectedEmployee, selectedPayslip])

  const handlePrintDone = useCallback((): void => {
    setPrinting(false)
  }, [])

  // 一括印刷対象（従業員の表示順で、明細が存在する全員）
  const bulkPrintItems = useMemo<BulkPrintItem[]>(() => {
    const items: BulkPrintItem[] = []
    for (const emp of employees) {
      const ps = editPayslips.find((p) => p.employeeId === emp.id)
      if (ps) items.push({ employee: emp, payslip: ps })
    }
    return items
  }, [employees, editPayslips])

  const handleBulkPrint = useCallback((): void => {
    if (bulkPrintItems.length === 0) {
      alert('印刷対象の明細がありません。先に給与データを作成してください。')
      return
    }
    setBulkPrinting(true)
  }, [bulkPrintItems])

  const handleBulkPrintDone = useCallback((): void => {
    setBulkPrinting(false)
  }, [])

  const handleExportCsv = useCallback(async (): Promise<void> => {
    if (bulkPrintItems.length === 0) {
      alert('出力対象の明細がありません。先に給与データを作成してください。')
      return
    }
    const content = buildPayslipCsv(bulkPrintItems)
    const mm = String(selectedMonth).padStart(2, '0')
    const fileName = `${selectedYear}-${mm}_給与明細一覧`
    const exportCsv = window.api?.export?.csv
    if (typeof exportCsv !== 'function') {
      // ブラウザ単体プレビュー時はブラウザのダウンロードにフォールバック
      const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName}.csv`
      a.click()
      URL.revokeObjectURL(url)
      return
    }
    setExportingCsv(true)
    setCreateMessage(null)
    try {
      const result = await exportCsv({ fileName, content })
      if (!result.success) {
        setCreateMessage(`CSV出力に失敗しました: ${result.error}`)
      } else if (result.data.path) {
        setCreateMessage(`CSVを保存しました: ${result.data.path}`)
      }
    } catch (err) {
      setCreateMessage(`CSV出力に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setExportingCsv(false)
    }
  }, [bulkPrintItems, selectedYear, selectedMonth])

  const isFutureMonth =
    selectedYear > now.getFullYear() ||
    (selectedYear === now.getFullYear() && selectedMonth > now.getMonth() + 1)

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
              {buildYearSelectOptions().map((y) => (
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
          ) : isFutureMonth ? (
            <span className={styles.futureBadge}>未来の月は作成できません</span>
          ) : (
            <button className={styles.btnCreate} onClick={handleCreate} disabled={creating}>
              {creating ? '作成中...' : `${selectedMonth}月分を作成`}
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
            <button
              className={styles.btnSecondary}
              onClick={() => navigate('/history', { state: { year: selectedYear, month: selectedMonth } })}
            >
              一括編集
            </button>
            <button
              className={styles.btnDanger}
              onClick={handleDelete}
              disabled={deleting}
              title="この月の給与データを削除して未作成に戻します"
            >
              {deleting ? '削除中...' : '削除して作り直す'}
            </button>
            {distributeMode === 'pdf' ? (
              <>
                <button
                  className={styles.btnSecondary}
                  onClick={handleExportCsv}
                  disabled={exportingCsv}
                  title="この月の給与明細一覧をCSVで書き出します"
                >
                  {exportingCsv ? 'CSV出力中...' : 'CSV出力'}
                </button>
                <button className={styles.btnSecondary} onClick={handleBulkPrint}>一括印刷</button>
                <button className={styles.btnPrimary} onClick={handlePrint}>印刷</button>
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

      {created && createMessage && (
        <p className={styles.notCreatedDesc} style={{ margin: '0 0 12px' }}>{createMessage}</p>
      )}

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
                syncKey={`${selectedYear}-${selectedMonth}-${refreshKey}-${selectedEmployee.id}`}
                distributeMode={distributeMode}
                onChange={handleFieldChange}
                onExtraLinesCommit={handleExtraLinesCommit}
              />
            ) : (
              <div className={styles.emptyState}>従業員を選択してください</div>
            )}
          </main>
        </div>
      ) : loadingMonth ? (
        <div className={styles.notCreated}>
          <div className={styles.notCreatedIcon}>⏳</div>
          <p className={styles.notCreatedDesc}>保存済みの給与データを読み込み中...</p>
        </div>
      ) : (
        <div className={styles.notCreated}>
          <div className={styles.notCreatedIcon}>{isFutureMonth ? '🚫' : '📋'}</div>
          <h2 className={styles.notCreatedTitle}>{selectedYear}年{selectedMonth}月分の給与データ</h2>
          {isFutureMonth ? (
            <p className={styles.notCreatedDesc}>
              未来の月の給与は作成できません。<br />
              勤務実績が確定してから作成してください。
            </p>
          ) : (
            <>
              <p className={styles.notCreatedDesc}>
                まだ作成されていません。<br />
                勤怠データと従業員マスタをもとに給与データを自動生成します。
              </p>
              <button className={styles.btnCreateLarge} onClick={handleCreate} disabled={creating}>
                {creating ? '作成中...' : `${selectedMonth}月分を作成`}
              </button>
              {createMessage && <p className={styles.notCreatedDesc}>{createMessage}</p>}
            </>
          )}
        </div>
      )}

      {showBulkEmail && (
        <BulkEmailModal
          employees={employees}
          type="payslip"
          year={selectedYear}
          monthOrSeason={selectedMonth}
          periodLabel={`${selectedYear}年${selectedMonth}月 給与明細`}
          makeItem={buildMailItem}
          onClose={() => setShowBulkEmail(false)}
          onSent={handleEmailSent}
        />
      )}

      {printing && selectedEmployee && selectedPayslip && (
        <PayslipDirectPrint
          employee={selectedEmployee}
          payslip={selectedPayslip}
          year={selectedYear}
          month={selectedMonth}
          onDone={handlePrintDone}
        />
      )}

      {bulkPrinting && (
        <PayslipBulkPrint
          items={bulkPrintItems}
          year={selectedYear}
          month={selectedMonth}
          fileName={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}_給与明細_一括`}
          onDone={handleBulkPrintDone}
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
  syncKey,
  distributeMode,
  onChange,
  onExtraLinesCommit,
}: {
  employee: MockEmployee
  payslip: MockPayslip
  year: number
  month: number
  syncKey: string
  distributeMode: DistributeMode
  onChange: (employeeId: number, field: keyof MockPayslip, value: number) => void
  onExtraLinesCommit: (
    employeeId: number,
    kind: 'payment' | 'deduction',
    updater: (prev: PayslipExtraLine[]) => PayslipExtraLine[],
  ) => void
}): ReactElement {
  const isPartTime = employee.employeeType === 'パート'
  const regularHours = Math.max(0, payslip.workHours - payslip.overtimeHours)
  const settings = getSettings()
  const emailPreview = buildPayslipEmail({
    employeeName: employee.name,
    year,
    month,
    companyName: settings.companyName,
  })

  const handleChange = useCallback(
    (field: keyof MockPayslip) =>
      (e: ChangeEvent<HTMLInputElement>): void => {
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
          <div>送信先: {employee.email}</div>
          <div className={styles.emailPreview}>
            <div className={styles.emailPreviewSubject}>件名: {emailPreview.subject}</div>
            <pre className={styles.emailPreviewBody}>{emailPreview.body}</pre>
          </div>
          <span className={styles.emailNote}>
            {settings.emailIncludeStub
              ? '添付: 給与明細書＋明細控え'
              : '添付: 給与明細書のみ（控えなし）'}
          </span>
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
        <AttendanceInput label="有給" value={payslip.paidLeaveDays} unit="日" onChange={handleChange('paidLeaveDays')} step={0.5} />
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
            </div>
            <ExtraLinesSection
              lines={payslip.extraPaymentLines ?? []}
              syncKey={syncKey}
              onCommit={handlePaymentExtrasCommit}
            />
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
              <EditableRow label="共済掛金" value={payslip.otherDeduction} onChange={handleChange('otherDeduction')} />
            </div>
            <ExtraLinesSection
              lines={payslip.extraDeductionLines ?? []}
              syncKey={syncKey}
              onCommit={handleDeductionExtrasCommit}
            />
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

function normalizePayslipForEdit(ps: MockPayslip): MockPayslip {
  return {
    ...ps,
    extraPaymentLines: cloneExtraLines(ps.extraPaymentLines),
    extraDeductionLines: cloneExtraLines(ps.extraDeductionLines),
  }
}

function cloneExtraLines(lines: PayslipExtraLine[] | undefined): PayslipExtraLine[] {
  if (!Array.isArray(lines)) return []
  return lines.map((line) => ({ ...line }))
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
