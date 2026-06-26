import { useState, useMemo, useCallback } from 'react'
import type { ReactElement } from 'react'
import { isEmailSent, sendEmailBulk, type MockEmployee } from '@/lib/mock-data'
import { useOverlayDismiss } from '@/hooks/useOverlayDismiss'
import styles from './BulkEmailModal.module.css'

interface BulkEmailModalProps {
  employees: MockEmployee[]
  type: 'payslip' | 'bonus'
  year: number
  monthOrSeason: number | string
  periodLabel: string
  onClose: () => void
  onSent: () => void
}

export function BulkEmailModal({
  employees,
  type,
  year,
  monthOrSeason,
  periodLabel,
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

  const handleSend = useCallback((): void => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    sendEmailBulk(ids, type, year, monthOrSeason)
    onSent()
    onClose()
  }, [selected, type, year, monthOrSeason, onSent, onClose])

  const sendableCount = targets.filter((t) => t.hasEmail && !t.sent).length
  const selectedCount = selected.size
  const sentCount = targets.filter((t) => t.sent).length

  const overlay = useOverlayDismiss(onClose)

  return (
    <div className={styles.overlay} {...overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>メール一括送信</h2>
          <span className={styles.periodLabel}>{periodLabel}</span>
          <button className={styles.closeButton} onClick={onClose} type="button">×</button>
        </div>

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
                      disabled={!t.hasEmail || t.sent}
                      onChange={() => toggleSelect(t.id)}
                    />
                  </td>
                  <td className={styles.tdName}>{t.name}</td>
                  <td><span className={styles.typeBadge}>{t.employeeType}</span></td>
                  <td className={styles.tdEmail}>
                    {t.email || <span className={styles.noEmail}>未登録</span>}
                  </td>
                  <td>
                    {t.sent ? (
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

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose} type="button">
            キャンセル
          </button>
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={selectedCount === 0}
            type="button"
          >
            {selectedCount}名に送信
          </button>
        </div>
      </div>
    </div>
  )
}
