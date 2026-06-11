import { useState, useEffect, useCallback } from 'react'
import type { ReactElement } from 'react'
import { getSettings, updateSettings } from '../lib/settings-store'
import type { AppSettings } from '../lib/settings-store'
import { renderEmailTemplate } from '../lib/email-template'
import { CompanyCalendar } from './CompanyCalendar'
import styles from './Settings.module.css'

type SettingsTab = 'general' | 'email' | 'calendar'

const TABS: { key: SettingsTab; label: string; icon: string }[] = [
  { key: 'general', label: '基本設定', icon: '⚙️' },
  { key: 'email', label: 'メール設定', icon: '✉️' },
  { key: 'calendar', label: '休日カレンダー', icon: '📅' },
]

const EMAIL_PLACEHOLDERS = '{employeeName} {year} {month} {season} {companyName}'

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

  useEffect(() => {
    setForm(getSettings())
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

  const handleSave = useCallback(() => {
    updateSettings(form)
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
                <span className={styles.ruleLabel}>退勤丸め方向</span>
                <div className={styles.ruleValue}>
                  <select className={styles.select} value="down" disabled>
                    <option value="down">切捨て</option>
                  </select>
                </div>
              </div>
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
              <span className={styles.sectionTitle}>送信元</span>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.field}>
                <label className={styles.label}>送信者名</label>
                <input
                  className={styles.input}
                  value={form.emailSenderName}
                  onChange={(e) => handleChange('emailSenderName', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>送信元メールアドレス</label>
                <input
                  type="email"
                  className={styles.input}
                  value={form.emailSenderAddress}
                  onChange={(e) => handleChange('emailSenderAddress', e.target.value)}
                />
              </div>
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
