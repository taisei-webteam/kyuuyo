import { useState, useEffect, useCallback } from 'react'
import type { ReactElement } from 'react'
import { getSettings, updateSettings } from '../lib/settings-store'
import type { AppSettings } from '../lib/settings-store'
import { renderEmailTemplate } from '../lib/email-template'
import { CompanyCalendar } from './CompanyCalendar'
import type { MailConfigStatus, BackupInfo } from '../../../shared/types'
import styles from './Settings.module.css'

const DEFAULT_CLIENT_ID = '1086473446602-fkcvs3f5n0lsmlfnlnlcnon79723jsmb.apps.googleusercontent.com'
const DEFAULT_SENDER_ADDRESS = 'cskyuyomeisai@gmail.com'

type SettingsTab = 'general' | 'email' | 'calendar'

const TABS: { key: SettingsTab; label: string; icon: string }[] = [
  { key: 'general', label: '基本設定', icon: '⚙️' },
  { key: 'email', label: 'メール設定', icon: '✉️' },
  { key: 'calendar', label: '休日カレンダー', icon: '📅' },
]

const EMAIL_PLACEHOLDERS = '{employeeName} {year} {month} {season} {companyName}'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatBackupDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

interface CompanyRoundingDto {
  roundingUnit: number
  gracePeriod: number
  defaultBreakMinutes: number
  earlyRoundingUnit: number
  overtimeRoundingUnit: number
}

const ROUNDING_OPTIONS = [
  { value: 5, label: '5分' },
  { value: 10, label: '10分' },
  { value: 15, label: '15分' },
  { value: 30, label: '30分' },
]

export default function Settings(): ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [form, setForm] = useState<AppSettings>(getSettings)
  const [saved, setSaved] = useState(false)

  // Gmail送信設定（mail.service / safeStorage 管理）
  const [mailStatus, setMailStatus] = useState<MailConfigStatus | null>(null)
  const [mailSenderName, setMailSenderName] = useState('')
  const [mailSenderAddress, setMailSenderAddress] = useState('')
  const [mailClientId, setMailClientId] = useState('')
  const [mailClientSecret, setMailClientSecret] = useState('')
  const [mailBusy, setMailBusy] = useState(false)
  const [mailMessage, setMailMessage] = useState<{ text: string; ok: boolean } | null>(null)

  // データバックアップ
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupMessage, setBackupMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    setForm(getSettings())
    if (!hasElectronApi) return
    void (async () => {
      const res = (await window.api.company.get()) as {
        success: boolean
        data?: Partial<CompanyRoundingDto>
      }
      if (res.success && res.data) {
        const d = res.data
        setForm((prev) => ({
          ...prev,
          roundingUnit: d.roundingUnit ?? prev.roundingUnit,
          gracePeriod: d.gracePeriod ?? prev.gracePeriod,
          defaultBreakMinutes: d.defaultBreakMinutes ?? prev.defaultBreakMinutes,
          earlyRoundingUnit: d.earlyRoundingUnit ?? prev.earlyRoundingUnit,
          overtimeRoundingUnit: d.overtimeRoundingUnit ?? prev.overtimeRoundingUnit,
        }))
      }
    })()
    void (async () => {
      const res = await window.api.mail.getConfig()
      if (res.success) {
        setMailStatus(res.data)
        setMailSenderName(res.data.senderName || getSettings().companyName)
        setMailSenderAddress(res.data.senderAddress || DEFAULT_SENDER_ADDRESS)
        setMailClientId(res.data.clientId || DEFAULT_CLIENT_ID)
      }
    })()
    void (async () => {
      const res = await window.api.backup.list()
      if (res.success) setBackups(res.data)
    })()
  }, [])

  const refreshBackups = useCallback(async (): Promise<void> => {
    if (!hasElectronApi) return
    const res = await window.api.backup.list()
    if (res.success) setBackups(res.data)
  }, [])

  const handleBackupRun = useCallback(async (): Promise<void> => {
    setBackupBusy(true)
    setBackupMessage(null)
    try {
      const res = await window.api.backup.run()
      if (res.success) {
        setBackupMessage({ text: `バックアップを作成しました（${res.data.fileName}）`, ok: true })
        await refreshBackups()
      } else {
        setBackupMessage({ text: res.error, ok: false })
      }
    } finally {
      setBackupBusy(false)
    }
  }, [refreshBackups])

  const handleBackupOpenDir = useCallback(async (): Promise<void> => {
    const res = await window.api.backup.openDir()
    if (!res.success) setBackupMessage({ text: res.error, ok: false })
  }, [])

  const handleBackupRestore = useCallback(async (b: BackupInfo): Promise<void> => {
    const ok = window.confirm(
      `「${b.fileName}」の内容でデータを復元します。\n` +
        '現在のデータは復元直前に自動バックアップされます。\n' +
        '復元後、アプリは自動的に再起動します。よろしいですか？',
    )
    if (!ok) return
    setBackupBusy(true)
    setBackupMessage({ text: '復元中です。まもなく再起動します...', ok: true })
    const res = await window.api.backup.restore(b.fileName)
    if (!res.success) {
      setBackupBusy(false)
      setBackupMessage({ text: res.error, ok: false })
    }
  }, [])

  const handleMailSave = useCallback(async (): Promise<void> => {
    setMailBusy(true)
    setMailMessage(null)
    try {
      const res = await window.api.mail.setConfig({
        senderName: mailSenderName,
        senderAddress: mailSenderAddress,
        clientId: mailClientId,
        clientSecret: mailClientSecret.length > 0 ? mailClientSecret : undefined,
      })
      if (res.success) {
        setMailStatus(res.data)
        setMailClientSecret('')
        setMailMessage({ text: 'メール送信設定を保存しました', ok: true })
      } else {
        setMailMessage({ text: res.error, ok: false })
      }
    } finally {
      setMailBusy(false)
    }
  }, [mailSenderName, mailSenderAddress, mailClientId, mailClientSecret])

  const handleMailAuthorize = useCallback(async (): Promise<void> => {
    setMailBusy(true)
    setMailMessage({ text: 'ブラウザが開きます。Googleアカウントで連携を許可してください...', ok: true })
    try {
      const res = await window.api.mail.authorize()
      if (res.success) {
        setMailMessage({ text: `Googleと連携しました（${res.data.email}）`, ok: true })
        const status = await window.api.mail.getConfig()
        if (status.success) setMailStatus(status.data)
      } else {
        setMailMessage({ text: res.error, ok: false })
      }
    } finally {
      setMailBusy(false)
    }
  }, [])

  const handleMailTest = useCallback(async (): Promise<void> => {
    setMailBusy(true)
    setMailMessage(null)
    try {
      const res = await window.api.mail.test()
      if (res.success && res.data.success) {
        setMailMessage({ text: 'テストメールを送信しました。受信箱をご確認ください。', ok: true })
      } else {
        const err = res.success ? res.data.error : res.error
        setMailMessage({ text: `テスト送信に失敗しました: ${err ?? '不明なエラー'}`, ok: false })
      }
    } finally {
      setMailBusy(false)
    }
  }, [])

  const handleChange = useCallback(
    (key: keyof AppSettings, value: string | number | boolean) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const payslipPreview = {
    subject: renderEmailTemplate(form.payslipEmailSubject, {
      employeeName: '山田 太郎',
      year: 2026,
      month: 5,
      companyName: form.companyName || '会社名',
    }),
    body: renderEmailTemplate(form.payslipEmailBody, {
      employeeName: '山田 太郎',
      year: 2026,
      month: 5,
      companyName: form.companyName || '会社名',
    }),
  }

  const bonusPreview = {
    subject: renderEmailTemplate(form.bonusEmailSubject, {
      employeeName: '山田 太郎',
      year: 2026,
      season: '夏季',
      companyName: form.companyName || '会社名',
    }),
    body: renderEmailTemplate(form.bonusEmailBody, {
      employeeName: '山田 太郎',
      year: 2026,
      season: '夏季',
      companyName: form.companyName || '会社名',
    }),
  }

  const handleSave = useCallback(async () => {
    updateSettings(form)
    if (hasElectronApi) {
      const payload: CompanyRoundingDto = {
        roundingUnit: form.roundingUnit,
        gracePeriod: form.gracePeriod,
        defaultBreakMinutes: form.defaultBreakMinutes,
        earlyRoundingUnit: form.earlyRoundingUnit,
        overtimeRoundingUnit: form.overtimeRoundingUnit,
      }
      await window.api.company.update(payload)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [form])

  const handleReset = useCallback(() => {
    setForm(getSettings())
  }, [])

  return (
    <div className={styles.page}>
      {/* タブナビ */}
      <div className={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 基本設定タブ */}
      {activeTab === 'general' && (
        <div className={styles.container}>
          {/* 会社情報 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>🏢</span>
              <span className={styles.sectionTitle}>会社情報</span>
            </div>
            <div className={styles.sectionBody}>
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <label className={styles.label}>会社名</label>
                <input
                  className={styles.input}
                  value={form.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>代表者名</label>
                <input
                  className={styles.input}
                  value={form.representativeName}
                  onChange={(e) => handleChange('representativeName', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>電話番号</label>
                <input
                  className={styles.input}
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>郵便番号</label>
                <input
                  className={styles.input}
                  value={form.postalCode}
                  onChange={(e) => handleChange('postalCode', e.target.value)}
                  placeholder="000-0000"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>社会保険番号</label>
                <input
                  className={styles.input}
                  value={form.insuranceNumber}
                  onChange={(e) => handleChange('insuranceNumber', e.target.value)}
                />
              </div>
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <label className={styles.label}>住所</label>
                <input
                  className={styles.input}
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 勤怠ルール */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>⏰</span>
              <span className={styles.sectionTitle}>勤怠ルール</span>
            </div>
            <div className={styles.sectionBodySingle}>
              <div className={styles.ruleRow}>
                <span className={styles.ruleLabel}>打刻丸め単位</span>
                <div className={styles.ruleValue}>
                  <select
                    className={styles.select}
                    value={form.roundingUnit}
                    onChange={(e) => handleChange('roundingUnit', Number(e.target.value))}
                  >
                    {ROUNDING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.ruleRow}>
                <span className={styles.ruleLabel}>遅刻猶予時間</span>
                <div className={styles.ruleValue}>
                  <input
                    type="number"
                    className={`${styles.input} ${styles.inputSmall}`}
                    value={form.gracePeriod}
                    min={0}
                    max={60}
                    onChange={(e) => handleChange('gracePeriod', Number(e.target.value))}
                  />
                  <span className={styles.ruleUnit}>分</span>
                </div>
              </div>

              <div className={styles.ruleRow}>
                <span className={styles.ruleLabel}>昼休憩時間</span>
                <div className={styles.ruleValue}>
                  <input
                    type="number"
                    className={`${styles.input} ${styles.inputSmall}`}
                    value={form.defaultBreakMinutes}
                    min={0}
                    max={120}
                    onChange={(e) => handleChange('defaultBreakMinutes', Number(e.target.value))}
                  />
                  <span className={styles.ruleUnit}>分</span>
                </div>
              </div>

              <div className={styles.ruleRow}>
                <span className={styles.ruleLabel}>早出丸め単位</span>
                <div className={styles.ruleValue}>
                  <select
                    className={styles.select}
                    value={form.earlyRoundingUnit}
                    onChange={(e) => handleChange('earlyRoundingUnit', Number(e.target.value))}
                  >
                    {ROUNDING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className={styles.ruleUnit}>切り捨て</span>
                </div>
              </div>

              <div className={styles.ruleRow}>
                <span className={styles.ruleLabel}>残業丸め単位</span>
                <div className={styles.ruleValue}>
                  <select
                    className={styles.select}
                    value={form.overtimeRoundingUnit}
                    onChange={(e) => handleChange('overtimeRoundingUnit', Number(e.target.value))}
                  >
                    {ROUNDING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className={styles.ruleUnit}>月合計を切り捨て</span>
                </div>
              </div>
            </div>
          </div>

          {/* データバックアップ */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>💾</span>
              <span className={styles.sectionTitle}>データバックアップ</span>
            </div>
            <div className={styles.sectionBodySingle}>
              {hasElectronApi ? (
                <>
                  <p className={styles.fieldHint}>
                    従業員・給与明細・勤怠などの全データを1ファイルに保存します。起動時に1日1回自動でも作成され、最新10件を保持します。
                  </p>
                  <div className={styles.mailActions}>
                    <button className={styles.btnPrimary} onClick={handleBackupRun} disabled={backupBusy}>
                      今すぐバックアップ
                    </button>
                    <button className={styles.btnSecondary} onClick={handleBackupOpenDir} disabled={backupBusy}>
                      バックアップフォルダを開く
                    </button>
                  </div>
                  {backupMessage && (
                    <div
                      className={`${styles.mailMessage} ${backupMessage.ok ? styles.mailMessageOk : styles.mailMessageNg}`}
                    >
                      {backupMessage.text}
                    </div>
                  )}
                  {backups.length > 0 ? (
                    <div className={styles.backupList}>
                      {backups.map((b) => (
                        <div key={b.fileName} className={styles.backupItem}>
                          <div className={styles.backupInfo}>
                            <span className={styles.backupDate}>{formatBackupDate(b.createdAt)}</span>
                            <span className={styles.backupMeta}>{formatFileSize(b.size)}</span>
                          </div>
                          <button
                            className={styles.btnSecondary}
                            onClick={() => handleBackupRestore(b)}
                            disabled={backupBusy}
                          >
                            復元
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.fieldHint}>まだバックアップはありません。</p>
                  )}
                </>
              ) : (
                <p className={styles.fieldHint}>
                  データバックアップはデスクトップアプリ版で利用できます（現在はプレビュー環境）。
                </p>
              )}
            </div>
          </div>

          {/* フッター */}
          <div className={styles.footer}>
            <button className={styles.btnSecondary} onClick={handleReset}>
              元に戻す
            </button>
            <button className={styles.btnPrimary} onClick={handleSave}>
              保存
            </button>
          </div>

          {saved && <div className={styles.toast}>設定を保存しました</div>}
        </div>
      )}

      {/* メール設定タブ */}
      {activeTab === 'email' && (
        <div className={styles.container}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>📤</span>
              <span className={styles.sectionTitle}>Gmail送信設定（送信元）</span>
            </div>
            <div className={styles.sectionBody}>
              {hasElectronApi ? (
                <>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <div className={styles.mailStatusRow}>
                      <span
                        className={`${styles.mailBadge} ${mailStatus?.authorized ? styles.mailBadgeOk : styles.mailBadgeNg}`}
                      >
                        {mailStatus?.authorized ? '● 連携済み' : '○ 未連携'}
                      </span>
                      {mailStatus && !mailStatus.encryptionAvailable && (
                        <span className={styles.fieldHint}>
                          ※この環境では暗号化保存が利用できないため、簡易保存になります
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>送信者名</label>
                    <input
                      className={styles.input}
                      value={mailSenderName}
                      onChange={(e) => setMailSenderName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>送信元メールアドレス（Gmail）</label>
                    <input
                      type="email"
                      className={styles.input}
                      value={mailSenderAddress}
                      onChange={(e) => setMailSenderAddress(e.target.value)}
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label className={styles.label}>クライアントID</label>
                    <input
                      className={styles.input}
                      value={mailClientId}
                      onChange={(e) => setMailClientId(e.target.value)}
                      placeholder="xxxxx.apps.googleusercontent.com"
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label className={styles.label}>クライアントシークレット</label>
                    <input
                      type="password"
                      className={styles.input}
                      value={mailClientSecret}
                      onChange={(e) => setMailClientSecret(e.target.value)}
                      placeholder={
                        mailStatus?.hasClientSecret
                          ? '保存済み（変更する場合のみ入力）'
                          : 'Google Cloud で発行したシークレット'
                      }
                    />
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <div className={styles.mailActions}>
                      <button className={styles.btnPrimary} onClick={handleMailSave} disabled={mailBusy}>
                        設定を保存
                      </button>
                      <button
                        className={styles.btnSecondary}
                        onClick={handleMailAuthorize}
                        disabled={mailBusy || !mailStatus?.hasClientSecret}
                      >
                        Googleと連携
                      </button>
                      <button
                        className={styles.btnSecondary}
                        onClick={handleMailTest}
                        disabled={mailBusy || !mailStatus?.authorized}
                      >
                        テスト送信
                      </button>
                    </div>
                    {mailMessage && (
                      <div
                        className={`${styles.mailMessage} ${mailMessage.ok ? styles.mailMessageOk : styles.mailMessageNg}`}
                      >
                        {mailMessage.text}
                      </div>
                    )}
                    <p className={styles.fieldHint}>
                      Gmailの送信権限のみを使用します。連携には Google Cloud で発行した OAuth
                      クライアント（種類: デスクトップアプリ）の ID とシークレットが必要です。認証情報は端末内に暗号化して保存され、外部には送信されません。
                    </p>
                  </div>
                </>
              ) : (
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <p className={styles.fieldHint}>
                    メール送信設定はデスクトップアプリ版で利用できます（現在はプレビュー環境）。
                  </p>
                </div>
              )}

              <div className={`${styles.field} ${styles.fieldWide}`}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={form.emailIncludeStub}
                    onChange={(e) => handleChange('emailIncludeStub', e.target.checked)}
                  />
                  明細控えをメール添付に含める
                </label>
                <p className={styles.fieldHint}>
                  オフの場合、添付PDFは「給与明細書」のみ（控えなし）です。
                </p>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>💰</span>
              <span className={styles.sectionTitle}>給与明細メール</span>
            </div>
            <div className={styles.sectionBodySingle}>
              <p className={styles.placeholderHelp}>使用できる置換文字: {EMAIL_PLACEHOLDERS}</p>
              <div className={styles.field}>
                <label className={styles.label}>件名</label>
                <input
                  className={styles.input}
                  value={form.payslipEmailSubject}
                  onChange={(e) => handleChange('payslipEmailSubject', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>本文</label>
                <textarea
                  className={styles.textarea}
                  rows={8}
                  value={form.payslipEmailBody}
                  onChange={(e) => handleChange('payslipEmailBody', e.target.value)}
                />
              </div>
              <div className={styles.previewBox}>
                <div className={styles.previewTitle}>プレビュー（給与）</div>
                <div className={styles.previewSubject}>件名: {payslipPreview.subject}</div>
                <pre className={styles.previewBody}>{payslipPreview.body}</pre>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>🎁</span>
              <span className={styles.sectionTitle}>賞与明細メール</span>
            </div>
            <div className={styles.sectionBodySingle}>
              <p className={styles.placeholderHelp}>使用できる置換文字: {EMAIL_PLACEHOLDERS}</p>
              <div className={styles.field}>
                <label className={styles.label}>件名</label>
                <input
                  className={styles.input}
                  value={form.bonusEmailSubject}
                  onChange={(e) => handleChange('bonusEmailSubject', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>本文</label>
                <textarea
                  className={styles.textarea}
                  rows={8}
                  value={form.bonusEmailBody}
                  onChange={(e) => handleChange('bonusEmailBody', e.target.value)}
                />
              </div>
              <div className={styles.previewBox}>
                <div className={styles.previewTitle}>プレビュー（賞与）</div>
                <div className={styles.previewSubject}>件名: {bonusPreview.subject}</div>
                <pre className={styles.previewBody}>{bonusPreview.body}</pre>
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <button className={styles.btnSecondary} onClick={handleReset}>
              元に戻す
            </button>
            <button className={styles.btnPrimary} onClick={handleSave}>
              保存
            </button>
          </div>

          {saved && <div className={styles.toast}>設定を保存しました</div>}
        </div>
      )}

      {/* 休日カレンダータブ */}
      {activeTab === 'calendar' && <CompanyCalendar />}
    </div>
  )
}
