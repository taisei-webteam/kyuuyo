import { useState, useMemo, useCallback, useEffect } from 'react'
import type { ReactElement } from 'react'
import { isEmailSent, sendEmail, sendEmailBulk, type MockEmployee } from '@/lib/mock-data'
import { useOverlayDismiss } from '@/hooks/useOverlayDismiss'
import { sendDocsByEmail, isMailSendAvailable, type MailDocItem, type SendProgress } from '@/lib/mail-client'
import styles from './BulkEmailModal.module.css'

interface BulkEmailModalProps {
  employees: MockEmployee[]
  type: 'payslip' | 'bonus'
  year: number
  monthOrSeason: number | string
  periodLabel: string
  /** 選択従業員の送信メッセージ（明細PDF含む）を構築する。null の場合は送信対象外。 */
  makeItem: (employee: MockEmployee) => MailDocItem | null
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
  onClose,
  onSent,
}: BulkEmailModalProps): ReactElement {
  const targets = useMemo(
    () =>
      employees.map((emp) => ({
        ...emp,
        sent: isEmailSent(emp.id, type, year, monthOrSeason),
        hasEmail: !!emp.email,
      })),
    [employees, type, year, monthOrSeason],
  )

  const [selected, setSelected] = useState<Set<number>>(() => {
    const sendable = targets.filter((t) => t.hasEmail && !t.sent)
    return new Set(sendable.map((t) => t.id))
  })

  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<SendProgress | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set())
  const [mailReady, setMailReady] = useState<boolean | null>(null)

  const electronMail = isMailSendAvailable()

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
    const sendable = targets.filter((t) => t.hasEmail && !t.sent)
    const allSelected = sendable.every((t) => selected.has(t.id))
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sendable.map((t) => t.id)))
    }
  }, [targets, selected])

  const handleSend = useCallback(async (): Promise<void> => {
    const ids = Array.from(selected)
    if (ids.length === 0) return

    // デスクトップアプリ以外（ブラウザ単体プレビュー）はモック記録のみ
    if (!electronMail) {
      sendEmailBulk(ids, type, year, monthOrSeason)
      onSent()
      onClose()
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

      const results = await sendDocsByEmail(items, setProgress)

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
      }
      // 全件成功なら自動で閉じる
      if (newErrors.length === 0) {
        onClose()
      } else {
        // 失敗分だけ選択に残す
        setSelected(newFailed)
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'メール送信に失敗しました'])
    } finally {
      setSending(false)
      setProgress(null)
    }
  }, [selected, electronMail, type, year, monthOrSeason, employees, makeItem, onSent, onClose])

  const sendableCount = targets.filter((t) => t.hasEmail && !t.sent).length
  const selectedCount = selected.size
  const sentCount = targets.filter((t) => t.sent).length

  const overlay = useOverlayDismiss(sending ? () => {} : onClose)

  const progressPct = progress
    ? progress.phase === 'sending'
      ? 100
      : Math.round((progress.index / Math.max(1, progress.total)) * 100)
    : 0

  return (
    <div className={styles.overlay} {...overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>メール一括送信</h2>
          <span className={styles.periodLabel}>{periodLabel}</span>
          <button className={styles.closeButton} onClick={onClose} type="button" disabled={sending}>×</button>
        </div>

        {mailReady === false && (
          <div className={styles.warnBanner}>
            {electronMail
              ? 'Googleとの連携が未完了です。「設定 > メール」からGmail連携を行ってください。'
              : 'メール送信はデスクトップアプリ版でのみ利用できます（現在はプレビュー環境）。'}
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
                      disabled={!t.hasEmail || t.sent || sending}
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
                  {progress?.phase === 'sending'
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
          <button className={styles.cancelButton} onClick={onClose} type="button" disabled={sending}>
            {errors.length > 0 ? '閉じる' : 'キャンセル'}
          </button>
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={selectedCount === 0 || sending || mailReady === false}
            type="button"
          >
            {sending ? '送信中...' : `${selectedCount}名に送信`}
          </button>
        </div>
      </div>
    </div>
  )
}
