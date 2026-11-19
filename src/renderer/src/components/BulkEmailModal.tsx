import { useState, useMemo, useCallback, useEffect } from 'react'
import type { ReactElement } from 'react'
import { isEmailSent, rememberScheduledEmail, sendEmail, sendEmailBulk, makeEmailPeriodKey, getScheduledSendAt, loadScheduledEmails, type MockEmployee } from '@/lib/mock-data'
import { useOverlayDismiss } from '@/hooks/useOverlayDismiss'
import {
  sendDocsByEmail,
  isMailSendAvailable,
  japanLocalInputToUtcIso,
  formatJapanDateTime,
  type MailDocItem,
  type SendProgress,
} from '@/lib/mail-client'
import { ConfirmPrompt } from '@/components/ConfirmPrompt'
import styles from './BulkEmailModal.module.css'

interface BulkEmailModalProps {
  employees: MockEmployee[]
  type: 'payslip' | 'bonus'
  year: number
  monthOrSeason: number | string
  periodLabel: string
  /** 選択従業員の送信メッセージ（明細PDF含む）を構築する。null の場合は送信対象外。 */
  makeItem: (employee: MockEmployee) => MailDocItem | null
  /** single のときは見出しを「メール送信」にする（個別送信） */
  mode?: 'bulk' | 'single'
  onClose: () => void
  onSent: () => void
}

export function BulkEmailModal({
  employees,
  type,
  year,
  monthOrSeason,
  periodLabel,
  makeItem,
  mode = 'bulk',
  onClose,
  onSent,
}: BulkEmailModalProps): ReactElement {
  const [statusTick, setStatusTick] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)
  const [pendingSendAt, setPendingSendAt] = useState<string | null>(null)
  const targets = useMemo(
    () =>
      employees.map((emp) => ({
        ...emp,
        sent: isEmailSent(emp.id, type, year, monthOrSeason),
        hasEmail: !!emp.email,
      })),
    [employees, type, year, monthOrSeason, statusTick],
  )

  const [selected, setSelected] = useState<Set<number>>(() => {
    // 個別送信は開いた人を対象にする。アドレスが無くてもチェックは付け、送信時に理由を出す。
    if (mode === 'single') {
      const person = targets.find((t) => !t.sent)
      return new Set(person ? [person.id] : [])
    }
    const sendable = targets.filter((t) => t.hasEmail && !t.sent)
    return new Set(sendable.map((t) => t.id))
  })

  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<SendProgress | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set())
  const [mailReady, setMailReady] = useState<boolean | null>(null)
  const [sendAtLocal, setSendAtLocal] = useState('')
  const [scheduleTick, setScheduleTick] = useState(0)

  const electronMail = isMailSendAvailable()
  const periodKey = makeEmailPeriodKey(type, year, monthOrSeason)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await loadScheduledEmails(type, year, monthOrSeason)
      if (!cancelled) setScheduleTick((n) => n + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [type, year, monthOrSeason])

  useEffect(() => {
    if (!electronMail) {
      setMailReady(false)
      return
    }
    void (async () => {
      const res = await window.api.mail.getConfig()
      setMailReady(res.success ? res.data.authorized : false)
    })()
  }, [electronMail])

  useEffect(() => {
    if (scheduleTick === 0) return
    setSelected((prev) => {
      const next = new Set<number>()
      for (const id of prev) {
        if (!getScheduledSendAt(id, type, year, monthOrSeason)) next.add(id)
      }
      return next
    })
  }, [scheduleTick, type, year, monthOrSeason])

  const toggleSelect = useCallback((id: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback((): void => {
    const sendable = targets.filter((t) => !t.sent && (mode === 'single' || t.hasEmail))
    const allSelected = sendable.length > 0 && sendable.every((t) => selected.has(t.id))
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sendable.map((t) => t.id)))
    }
  }, [targets, selected, mode])

  const requestSend = useCallback((): void => {
    if (selected.size === 0 || doneMessage) return
    const missingEmail = targets.filter((t) => selected.has(t.id) && !t.hasEmail)
    if (missingEmail.length > 0) {
      const names = missingEmail.map((t) => t.name).join('、')
      setErrors([`${names} さんのメールアドレスが未登録のため送信できません。従業員管理で登録してください。`])
      return
    }
    let sendAtIso: string | null = null
    if (sendAtLocal.trim()) {
      sendAtIso = japanLocalInputToUtcIso(sendAtLocal.trim())
      if (!sendAtIso) {
        setErrors(['送信日時の形式が正しくありません'])
        return
      }
      if (new Date(sendAtIso).getTime() <= Date.now()) {
        setErrors(['送信日時は現在の日本時間より後を指定してください。今すぐ送る場合は日時を空にしてください。'])
        return
      }
    }
    setErrors([])
    setPendingSendAt(sendAtIso)
    setConfirming(true)
  }, [selected, doneMessage, sendAtLocal, targets])

  const handleSend = useCallback(async (sendAtIso: string | null): Promise<void> => {
    const ids = Array.from(selected)
    if (ids.length === 0) return

    // ブラウザの開発サーバーでは Gmail を送らず、確認と完了メッセージだけ試せる
    if (!electronMail) {
      if (sendAtIso) {
        for (const id of ids) rememberScheduledEmail(id, type, year, monthOrSeason, sendAtIso)
        setDoneMessage('メールの予約が完了しました。')
      } else {
        sendEmailBulk(ids, type, year, monthOrSeason)
        setDoneMessage('メールの送信が完了しました。')
      }
      onSent()
      setStatusTick((n) => n + 1)
      return
    }

    setSending(true)
    setErrors([])
    setFailedIds(new Set())

    try {
      const items: MailDocItem[] = []
      for (const id of ids) {
        const emp = employees.find((e) => e.id === id)
        if (!emp) continue
        const item = makeItem(emp)
        if (item) items.push(item)
      }

      if (items.length === 0) {
        setErrors(['送信可能な明細がありませんでした'])
        return
      }

      const results = await sendDocsByEmail(
        items,
        setProgress,
        sendAtIso ? { sendAt: sendAtIso, type, periodKey } : undefined,
      )

      if (results.some((r) => r.scheduled)) {
        for (const r of results) {
          if (r.success && r.scheduled && typeof r.refId === 'number' && sendAtIso) {
            rememberScheduledEmail(r.refId, type, year, monthOrSeason, sendAtIso)
          }
        }
        onSent()
        setStatusTick((n) => n + 1)
        setDoneMessage('メールの予約が完了しました。')
        return
      }

      const newFailed = new Set<number>()
      const newErrors: string[] = []
      let successCount = 0
      for (const r of results) {
        if (r.success) {
          successCount += 1
          if (typeof r.refId === 'number') {
            sendEmail(r.refId, type, year, monthOrSeason)
          }
        } else {
          if (typeof r.refId === 'number') newFailed.add(r.refId)
          const emp = employees.find((e) => e.id === r.refId)
          newErrors.push(`${emp?.name ?? r.to}: ${r.error ?? '送信に失敗しました'}`)
        }
      }

      setFailedIds(newFailed)
      setErrors(newErrors)

      if (successCount > 0) {
        onSent()
        setStatusTick((n) => n + 1)
      }
      if (newErrors.length === 0) {
        setDoneMessage('メールの送信が完了しました。')
      } else {
        setSelected(newFailed)
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'メール送信に失敗しました'])
    } finally {
      setSending(false)
      setProgress(null)
    }
  }, [selected, electronMail, type, year, monthOrSeason, periodKey, employees, makeItem, onSent])

  const sendableCount = targets.filter((t) => !t.sent && (mode === 'single' || t.hasEmail)).length
  const selectedCount = selected.size
  const sentCount = targets.filter((t) => t.sent).length

  const overlay = useOverlayDismiss(sending || confirming ? () => {} : onClose)

  const progressPct = progress
    ? progress.phase === 'sending'
      ? 100
      : Math.round((progress.index / Math.max(1, progress.total)) * 100)
    : 0

  return (
    <div className={styles.overlay} {...overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>{mode === 'single' ? 'メール送信' : 'メール一括送信'}</h2>
          <span className={styles.periodLabel}>{periodLabel}</span>
          <button className={styles.closeButton} onClick={onClose} type="button" disabled={sending}>×</button>
        </div>

        {doneMessage && <div className={styles.doneBanner}>{doneMessage}</div>}

        {mailReady === false && (
          <div className={styles.warnBanner}>
            {electronMail
              ? 'Googleとの連携が未完了です。「設定 > メール」からGmail連携を行ってください。'
              : 'プレビューです。確認と完了メッセージは試せます。実際のGmail送信はデスクトップアプリで行います。'}
          </div>
        )}

        <div className={styles.summary}>
          <span className={styles.summaryItem}>対象: {targets.length}名</span>
          <span className={styles.summaryItem}>送信済: {sentCount}名</span>
          <span className={styles.summaryItem}>選択中: {selectedCount}名</span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCheck}>
                  <input
                    type="checkbox"
                    checked={sendableCount > 0 && selectedCount === sendableCount}
                    onChange={toggleAll}
                    disabled={sending}
                  />
                </th>
                <th>氏名</th>
                <th>区分</th>
                <th>メールアドレス</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} className={t.sent ? styles.rowSent : undefined}>
                  <td className={styles.tdCheck}>
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      disabled={(mode !== 'single' && !t.hasEmail) || t.sent || sending}
                      onChange={() => toggleSelect(t.id)}
                    />
                  </td>
                  <td className={styles.tdName}>{t.name}</td>
                  <td><span className={styles.typeBadge}>{t.employeeType}</span></td>
                  <td className={styles.tdEmail}>
                    {t.email || <span className={styles.noEmail}>未登録</span>}
                  </td>
                  <td>
                    {failedIds.has(t.id) ? (
                      <span className={styles.errBadge}>送信失敗</span>
                    ) : t.sent ? (
                      <span className={styles.sentBadge}>送信済</span>
                    ) : getScheduledSendAt(t.id, type, year, monthOrSeason) ? (
                      <span className={styles.scheduleBadge}>
                        予約 {formatJapanDateTime(getScheduledSendAt(t.id, type, year, monthOrSeason) ?? '')}
                      </span>
                    ) : !t.hasEmail ? (
                      <span className={styles.noEmailBadge}>メール未登録</span>
                    ) : (
                      <span className={styles.pendingBadge}>未送信</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(sending || errors.length > 0) && (
          <div className={styles.statusBar}>
            {sending && (
              <>
                <span className={styles.statusText}>
                    {progress?.phase === 'scheduling'
                    ? '送信予約を保存しています...'
                    : progress?.phase === 'sending'
                    ? 'Gmailで送信中...'
                    : progress
                      ? `明細PDFを生成中... (${progress.index + 1}/${progress.total}) ${progress.name}`
                      : '準備中...'}
                </span>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
                </div>
              </>
            )}
            {errors.length > 0 && <div className={styles.errorBox}>{errors.join('\n')}</div>}
          </div>
        )}

        <div className={styles.modalFooter}>
          <div className={styles.scheduleBox}>
            <label className={styles.scheduleLabel}>
              送信日時（日本時間）
              <input
                className={styles.scheduleInput}
                type="datetime-local"
                value={sendAtLocal}
                onChange={(e) => setSendAtLocal(e.target.value)}
                disabled={sending}
              />
            </label>
            <p className={styles.scheduleHint}>
              空欄なら今すぐ送信します。未来の日時を入れると、その時刻（日本時間）に送ります。アプリが閉じているときは、次に起動したときに送ります。
            </p>
          </div>
          <div className={styles.footerButtons}>
            <button className={styles.cancelButton} onClick={onClose} type="button" disabled={sending}>
              {doneMessage || errors.length > 0 ? '閉じる' : 'キャンセル'}
            </button>
            {!doneMessage && (
              <button
                className={styles.sendButton}
                onClick={requestSend}
                disabled={selectedCount === 0 || sending || (electronMail && mailReady === false)}
                type="button"
              >
                {sending ? '処理中...' : sendAtLocal.trim() ? `${selectedCount}名を予約` : `${selectedCount}名に送信`}
              </button>
            )}
          </div>
        </div>
        {confirming && (
          <ConfirmPrompt
            message={
              pendingSendAt
                ? `日本時間 ${sendAtLocal.replace('T', ' ')} にメールを予約しますか？`
                : 'メールを送りますか？'
            }
            confirmLabel={pendingSendAt ? '予約する' : '送信する'}
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false)
              void handleSend(pendingSendAt)
            }}
          />
        )}
      </div>
    </div>
  )
}
