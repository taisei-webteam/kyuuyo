import { useState, useEffect, useMemo, useCallback } from 'react'
import type { ReactElement } from 'react'
import type { EmailVerifyStatus } from '../../../shared/types'
import type { MockEmployee, HolidayMode } from '@/lib/mock-data'
import { calcAge, nextEmployeeId } from '@/lib/mock-data'
import { useOverlayDismiss } from '@/hooks/useOverlayDismiss'
import { useVerifyAutoRefresh } from '@/hooks/useVerifyAutoRefresh'
import { DateSelect } from './DateSelect'
import styles from './EmployeeForm.module.css'

interface EmployeeFormProps {
  employee: MockEmployee | null
  onSave: (data: MockEmployee) => void
  onClose: () => void
}

const emptyEmployee: MockEmployee = {
  id: 0,
  name: '',
  nameKana: '',
  email: '',
  birthDate: '',
  employeeType: '社員',
  departmentName: '',
  jobTitle: '',
  hireDate: '',
  resignDate: null,
  displayOrder: 0,
  basicSalary: 0,
  hourlyRate: 0,
  standardMonthlyRemuneration: 0,
  transportAllowance: 0,
  taxableTransport: 0,
  employmentInsuranceOverage: 0,
  positionAllowance: 0,
  familyAllowance: 0,
  specialAllowance: 0,
  dangerAllowance: 0,
  salesAllowance: 0,
  healthInsurance: 0,
  welfarePension: 0,
  residentTax: 0,
  savingsDeduction: 0,
  loanDeduction: 0,
  dependents: 0,
  isActive: true,
  scheduledStart: '09:00',
  scheduledEnd: '18:00',
  holidayDays: [0, 6],
  holidayMode: 'calendar' as HolidayMode,
  earlyWorkStart: null,
  earlyWorkEnd: null,
  overtimeAllowed: true,
  overtimeStart: '18:00',
  overtimeEnd: '22:00',
  bonusEligible: false,
  paidLeaveBalance: null,
  fixedOvertimePay: 0,
  incomeTaxExempt: false,
}

const VERIFY_LABEL: Record<EmailVerifyStatus, string> = {
  unverified: '未確認',
  pending: '受信確認中',
  verified: '確認済み',
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** 'YYYY-MM-DD HH:MM:SS' を '5/12 14:30' 形式に短縮する。 */
function shortDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value)
  if (!m) return value
  return `${Number(m[2])}/${Number(m[3])} ${m[4]}:${m[5]}`
}

export function EmployeeForm({ employee, onSave, onClose }: EmployeeFormProps): ReactElement {
  const [form, setForm] = useState<MockEmployee>(
    employee ?? { ...emptyEmployee, id: nextEmployeeId(), displayOrder: nextEmployeeId() },
  )

  useEffect(() => {
    setForm(employee ?? { ...emptyEmployee, id: nextEmployeeId(), displayOrder: nextEmployeeId() })
  }, [employee])

  const isNew = !employee

  // ── メール到達確認 ──────────────────────────────
  const [verifyStatus, setVerifyStatus] = useState<EmailVerifyStatus>('unverified')
  const [verifySentAt, setVerifySentAt] = useState<string | null>(null)
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null)
  const [verifyBusy, setVerifyBusy] = useState<'idle' | 'sending' | 'refreshing'>('idle')
  const [verifyMessage, setVerifyMessage] = useState('')
  const [verifyConfigured, setVerifyConfigured] = useState(false)

  const hasElectronApi = typeof window !== 'undefined' && typeof window.api !== 'undefined'

  useEffect(() => {
    setVerifyStatus(employee?.emailVerifyStatus ?? 'unverified')
    setVerifySentAt(employee?.emailVerifySentAt ?? null)
    setVerifiedAt(employee?.emailVerifiedAt ?? null)
    setVerifyMessage('')
  }, [employee])

  // 確認状態は Neon に記録するため、打刻連携の接続文字列が設定済みであることが前提
  useEffect(() => {
    if (!hasElectronApi) return
    let cancelled = false
    void window.api.attendance.getSyncConfig().then((res) => {
      if (cancelled) return
      setVerifyConfigured(res.success && res.data.configured)
    })
    return () => {
      cancelled = true
    }
  }, [hasElectronApi])

  /** メールアドレスが保存済みの値と一致しているか（未保存の宛先には送れない） */
  const emailSaved = !isNew && employee?.email === form.email
  const canSendVerification =
    hasElectronApi &&
    verifyConfigured &&
    emailSaved &&
    isValidEmail(form.email) &&
    verifyBusy === 'idle'

  function verifyHint(): string {
    if (!hasElectronApi) return 'メール確認はデスクトップアプリ版でのみ利用できます。'
    if (!verifyConfigured) {
      return '設定 →「打刻連携」で接続文字列(DATABASE_URL)を登録すると利用できます。'
    }
    if (form.email.trim().length === 0) return 'メールアドレスを入力すると確認メールを送信できます。'
    if (!isValidEmail(form.email)) return 'メールアドレスの形式が正しくありません。'
    if (!emailSaved) return 'メールアドレスを保存した後に確認メールを送信できます。'
    if (verifyStatus === 'verified') {
      return `${shortDateTime(verifiedAt)} に受信が確認されました。`
    }
    if (verifyStatus === 'pending') {
      return `${shortDateTime(verifySentAt)} に確認メールを送信しました。相手がメール内のボタンを押すと自動で反映されます。すぐに反映されない場合は「状態を更新」を押してください。`
    }
    return '確認メールを送り、相手がメール内のボタンを押すと「確認済み」になります。'
  }

  async function handleSendVerification(): Promise<void> {
    if (!employee || !canSendVerification) return
    setVerifyBusy('sending')
    setVerifyMessage('')
    const res = await window.api.mail.sendVerification(employee.id)
    if (res.success) {
      setVerifyStatus(res.data.status)
      setVerifySentAt(res.data.sentAt)
      setVerifiedAt(res.data.verifiedAt)
      setVerifyMessage(`${form.email} に確認メールを送信しました。`)
    } else {
      setVerifyMessage(`送信に失敗しました: ${res.error}`)
    }
    setVerifyBusy('idle')
  }

  /** 通知を出さずに確認状態を取り込む（ウィンドウ復帰時の自動照会用）。 */
  const refreshVerificationSilently = useCallback(async (): Promise<void> => {
    if (!employee) return
    const res = await window.api.mail.refreshVerification(employee.id)
    if (!res.success) return
    setVerifyStatus(res.data.status)
    setVerifySentAt(res.data.sentAt)
    setVerifiedAt(res.data.verifiedAt)
    // 変化がないときに何度も同じ文言を出しても意味がないため、確認できたときだけ知らせる
    if (res.data.status === 'verified') setVerifyMessage('受信が確認されました。')
  }, [employee])

  useVerifyAutoRefresh(
    hasElectronApi && emailSaved && verifyStatus === 'pending' && verifyBusy === 'idle',
    refreshVerificationSilently,
  )

  async function handleRefreshVerification(): Promise<void> {
    if (!employee || !hasElectronApi || verifyBusy !== 'idle') return
    setVerifyBusy('refreshing')
    setVerifyMessage('')
    const res = await window.api.mail.refreshVerification(employee.id)
    if (res.success) {
      setVerifyStatus(res.data.status)
      setVerifySentAt(res.data.sentAt)
      setVerifiedAt(res.data.verifiedAt)
      setVerifyMessage(
        res.data.status === 'verified'
          ? '受信が確認されました。'
          : 'まだ確認されていません。相手がメール内のボタンを押すまでお待ちください。',
      )
    } else {
      setVerifyMessage(`確認状態の取得に失敗しました: ${res.error}`)
    }
    setVerifyBusy('idle')
  }

  const age = useMemo(() => {
    if (!form.birthDate) return null
    return calcAge(form.birthDate)
  }, [form.birthDate])

  function handleChange(field: keyof MockEmployee, value: string | number | boolean): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    onSave(form)
  }

  const overlay = useOverlayDismiss(onClose)

  return (
    <div className={styles.overlay} {...overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>{isNew ? '従業員 新規登録' : '従業員 編集'}</h2>
          <button className={styles.closeButton} onClick={onClose} type="button">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>個人情報</div>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label>氏名</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="例: 田中 太郎"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>フリガナ</label>
                  <input
                    type="text"
                    value={form.nameKana}
                    onChange={(e) => handleChange('nameKana', e.target.value)}
                    placeholder="例: タナカ タロウ"
                    required
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label>
                    メールアドレス
                    <span
                      className={styles.verifyBadge}
                      data-status={emailSaved ? verifyStatus : 'unverified'}
                    >
                      {VERIFY_LABEL[emailSaved ? verifyStatus : 'unverified']}
                    </span>
                  </label>
                  <div className={styles.emailRow}>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="例: tanaka@example.co.jp"
                    />
                    <button
                      type="button"
                      className={styles.verifyButton}
                      onClick={handleSendVerification}
                      disabled={!canSendVerification}
                      title="確認メールを送信して、相手が受信できるか確かめます"
                    >
                      {verifyBusy === 'sending'
                        ? '送信中...'
                        : verifyStatus === 'unverified'
                          ? '送信確認'
                          : '再送信'}
                    </button>
                    {emailSaved && verifyStatus === 'pending' && (
                      <button
                        type="button"
                        className={styles.verifyRefreshButton}
                        onClick={handleRefreshVerification}
                        disabled={verifyBusy !== 'idle'}
                      >
                        {verifyBusy === 'refreshing' ? '確認中...' : '状態を更新'}
                      </button>
                    )}
                  </div>
                  <p className={styles.fieldNote}>{verifyMessage || verifyHint()}</p>
                </div>
                <div className={styles.field}>
                  <label>生年月日 {age !== null && <span className={styles.ageBadge}>({age}歳)</span>}</label>
                  <DateSelect
                    value={form.birthDate}
                    onChange={(value) => handleChange('birthDate', value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>社員区分</label>
                  <select
                    value={form.employeeType}
                    onChange={(e) => handleChange('employeeType', e.target.value)}
                  >
                    <option value="社員">社員</option>
                    <option value="役員">役員</option>
                    <option value="パート">パート</option>
                  </select>
                </div>
                {form.employeeType === '役員' && (
                  <div className={styles.field}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={form.bonusEligible ?? false}
                        onChange={(e) => handleChange('bonusEligible', e.target.checked)}
                      />
                      賞与を支給する
                    </label>
                  </div>
                )}
                <div className={styles.field}>
                  <label>部署名</label>
                  <input
                    type="text"
                    value={form.departmentName}
                    onChange={(e) => handleChange('departmentName', e.target.value)}
                    placeholder="例: 営業部"
                  />
                </div>
                <div className={styles.field}>
                  <label>職名</label>
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={(e) => handleChange('jobTitle', e.target.value)}
                    placeholder="例: 部長"
                  />
                </div>
                <div className={styles.field}>
                  <label>雇入年月日</label>
                  <DateSelect
                    value={form.hireDate}
                    onChange={(value) => handleChange('hireDate', value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>退職年月日（在籍中は空欄）</label>
                  <DateSelect
                    value={form.resignDate ?? ''}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, resignDate: value || null }))
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label>表示順</label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) => handleChange('displayOrder', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>定時（開始）</label>
                  <input
                    type="time"
                    value={form.scheduledStart}
                    onChange={(e) => handleChange('scheduledStart', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>定時（終了）</label>
                  <input
                    type="time"
                    value={form.scheduledEnd}
                    onChange={(e) => handleChange('scheduledEnd', e.target.value)}
                  />
                </div>
                <div className={styles.timePair}>
                  <div className={styles.field}>
                    <label>早出開始時刻</label>
                    <input
                      type="time"
                      value={form.earlyWorkStart ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          earlyWorkStart: e.target.value || null,
                        }))
                      }
                      placeholder="未設定"
                    />
                  </div>
                  <div className={styles.field}>
                    <label>早出終了時刻</label>
                    <input
                      type="time"
                      value={form.earlyWorkEnd ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          earlyWorkEnd: e.target.value || null,
                        }))
                      }
                      placeholder="未設定"
                    />
                  </div>
                </div>
                <p className={styles.fieldNote}>
                  開始より前の打刻は開始時刻に切り上げます。早出終了（通常は定時開始）までが早出＝時給1.25倍、それ以降は通常時給です。土曜・休日も同じで、午前の早出だけ割増、定時開始以降は基本給に入れます。
                </p>
                <div className={styles.field}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={!form.overtimeAllowed}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          overtimeAllowed: !e.target.checked,
                          overtimeStart: e.target.checked ? null : (prev.overtimeStart ?? prev.scheduledEnd),
                          overtimeEnd: e.target.checked ? null : (prev.overtimeEnd ?? '22:00'),
                        }))
                      }
                    />
                    残業不可
                  </label>
                </div>
                <div className={styles.timePair}>
                  <div className={styles.field}>
                    <label>残業開始時刻</label>
                    <input
                      type="time"
                      value={form.overtimeStart ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          overtimeStart: e.target.value || null,
                        }))
                      }
                      disabled={!form.overtimeAllowed}
                      placeholder="未設定"
                    />
                  </div>
                  <div className={styles.field}>
                    <label>残業終了時刻</label>
                    <input
                      type="time"
                      value={form.overtimeEnd ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          overtimeEnd: e.target.value || null,
                        }))
                      }
                      disabled={!form.overtimeAllowed}
                      placeholder="未設定"
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label>固定時間外手当</label>
                  <input
                    type="number"
                    value={form.fixedOvertimePay ?? 0}
                    onChange={(e) => handleChange('fixedOvertimePay', Number(e.target.value))}
                    min={0}
                  />
                  <p className={styles.fieldNote}>0 円のときは勤怠の残業時間から計算します。田中さんのように月額固定の場合は金額を入れます。</p>
                </div>
                <div className={styles.fieldWide}>
                  <label>休日設定</label>
                  <div className={styles.holidayModePicker}>
                    <label className={styles.holidayModeItem}>
                      <input
                        type="radio"
                        name="holidayMode"
                        checked={form.holidayMode === 'calendar'}
                        onChange={() => setForm((prev) => ({ ...prev, holidayMode: 'calendar' }))}
                      />
                      <span>会社カレンダーに従う</span>
                    </label>
                    <label className={styles.holidayModeItem}>
                      <input
                        type="radio"
                        name="holidayMode"
                        checked={form.holidayMode === 'individual'}
                        onChange={() => setForm((prev) => ({ ...prev, holidayMode: 'individual' }))}
                      />
                      <span>個別設定（曜日指定）</span>
                    </label>
                  </div>
                  {form.holidayMode === 'individual' && (
                    <div className={styles.holidayDaysPicker}>
                      {['日', '月', '火', '水', '木', '金', '土'].map((label, idx) => (
                        <label key={idx} className={styles.holidayDayItem}>
                          <input
                            type="checkbox"
                            checked={form.holidayDays.includes(idx)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.holidayDays, idx].sort()
                                : form.holidayDays.filter((d) => d !== idx)
                              setForm((prev) => ({ ...prev, holidayDays: next }))
                            }}
                          />
                          <span className={`${styles.holidayDayLabel} ${form.holidayDays.includes(idx) ? styles.holidayDayLabelActive : ''}`}>
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>有給休暇</div>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label>有給残日数</label>
                  <input
                    type="number"
                    value={form.paidLeaveBalance ?? ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        paidLeaveBalance: e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    min={0}
                    step={0.5}
                    placeholder="例: 12.5"
                  />
                  <p className={styles.fieldNote}>
                    付与時・年度始めの残日数をここで設定します。勤怠管理で有給を確定保存すると自動で減算され、この値が更新されます（予定は減算されません）。
                    社員は午前休・午後休・全日休（半日=0.5日）、パートは全日休のみです。
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>給与情報</div>
              <div className={styles.fieldGrid}>
                {form.employeeType === 'パート' ? (
                  <div className={styles.field}>
                    <label>時給（円）</label>
                    <input
                      type="number"
                      value={form.hourlyRate}
                      onChange={(e) => handleChange('hourlyRate', Number(e.target.value))}
                      min={0}
                      placeholder="例: 1200"
                    />
                  </div>
                ) : (
                  <div className={styles.field}>
                    <label>基本給（月給）</label>
                    <input
                      type="number"
                      value={form.basicSalary}
                      onChange={(e) => handleChange('basicSalary', Number(e.target.value))}
                      min={0}
                      placeholder="例: 300000"
                    />
                  </div>
                )}
                <div className={styles.field}>
                  <label>交通費</label>
                  <input
                    type="number"
                    value={form.transportAllowance}
                    onChange={(e) => handleChange('transportAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>うち課税分（非課税限度超過）</label>
                  <input
                    type="number"
                    value={form.taxableTransport ?? 0}
                    onChange={(e) => handleChange('taxableTransport', Number(e.target.value))}
                    min={0}
                    max={form.transportAllowance}
                  />
                </div>
                <div className={styles.field}>
                  <label>役職手当</label>
                  <input
                    type="number"
                    value={form.positionAllowance}
                    onChange={(e) => handleChange('positionAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>家族手当</label>
                  <input
                    type="number"
                    value={form.familyAllowance}
                    onChange={(e) => handleChange('familyAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>特別手当</label>
                  <input
                    type="number"
                    value={form.specialAllowance}
                    onChange={(e) => handleChange('specialAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>危険手当</label>
                  <input
                    type="number"
                    value={form.dangerAllowance}
                    onChange={(e) => handleChange('dangerAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>営業手当</label>
                  <input
                    type="number"
                    value={form.salesAllowance}
                    onChange={(e) => handleChange('salesAllowance', Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>社会保険料</div>
              <p className={styles.fieldNote}>
                健康保険と介護保険は合算額を入力します。雇用保険は給与作成時に総支給額から自動計算します。
              </p>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label>健康・介護保険（合算・月額）</label>
                  <input
                    type="number"
                    value={form.healthInsurance}
                    onChange={(e) => handleChange('healthInsurance', Number(e.target.value))}
                    min={0}
                    placeholder="例: 10340"
                  />
                </div>
                <div className={styles.field}>
                  <label>厚生年金（月額）</label>
                  <input
                    type="number"
                    value={form.welfarePension}
                    onChange={(e) => handleChange('welfarePension', Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>その他控除</div>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label>住民税</label>
                  <input
                    type="number"
                    value={form.residentTax}
                    onChange={(e) => handleChange('residentTax', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>積立金</label>
                  <input
                    type="number"
                    value={form.savingsDeduction}
                    onChange={(e) => handleChange('savingsDeduction', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>貸付</label>
                  <input
                    type="number"
                    value={form.loanDeduction}
                    onChange={(e) => handleChange('loanDeduction', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label>扶養人数</label>
                  <input
                    type="number"
                    value={form.dependents}
                    onChange={(e) => handleChange('dependents', Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={form.incomeTaxExempt ?? false}
                      onChange={(e) => handleChange('incomeTaxExempt', e.target.checked)}
                    />
                    所得税免除
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className={styles.saveButton}>
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
