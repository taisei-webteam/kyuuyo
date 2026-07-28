import { useState, useMemo, useCallback } from 'react'
import type { ReactElement } from 'react'
import { reloadEmployeesFromDb, isEmployeeRetired, type MockEmployee } from '@/lib/mock-data'
import type { EmailVerifyBulkItem } from '../../../shared/types'
import styles from './EmailVerifyBulkModal.module.css'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

/** 送信可能なアドレスかを簡易判定する（IPC 側でも改めて検証される）。 */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function statusLabel(status: string | undefined): string {
  if (status === 'verified') return '確認済み'
  if (status === 'pending') return '確認中'
  return '未確認'
}

/**
 * 到達確認メールの一括送信モーダル。
 * 実際にメールが飛ぶため、宛先一覧を提示したうえで明示的に送信させる。
 */
export function EmailVerifyBulkModal({
  employees,
  onClose,
  onSent,
}: {
  employees: MockEmployee[]
  onClose: () => void
  onSent: () => void
}): ReactElement {
  // 送信可能な候補: 在籍中・アドレスが有効・まだ確認済みでない
  const candidates = useMemo(
    () =>
      employees.filter(
        (e) =>
          !isEmployeeRetired(e) &&
          isValidEmail(e.email) &&
          e.emailVerifyStatus !== 'verified',
      ),
    [employees],
  )

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(candidates.map((e) => e.id)),
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [results, setResults] = useState<Map<number, EmailVerifyBulkItem> | null>(null)

  const allSelected = selected.size === candidates.length && candidates.length > 0

  const toggle = useCallback((id: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((): void => {
    setSelected((prev) =>
      prev.size === candidates.length ? new Set<number>() : new Set(candidates.map((e) => e.id)),
    )
  }, [candidates])

  const handleSend = useCallback(async (): Promise<void> => {
    if (!hasElectronApi) {
      setMessage('メール送信はデスクトップアプリ版でのみ利用できます。')
      return
    }
    const ids = candidates.filter((e) => selected.has(e.id)).map((e) => e.id)
    if (ids.length === 0) {
      setMessage('送信対象が選択されていません。')
      return
    }

    setBusy(true)
    setMessage(`${ids.length} 名へ送信中です。しばらくお待ちください...`)
    try {
      const res = await window.api.mail.sendVerificationBulk(ids)
      if (!res.success) {
        setMessage(`送信に失敗しました: ${res.error}`)
        return
      }
      setResults(new Map(res.data.items.map((item) => [item.employeeId, item])))
      setMessage(
        res.data.failed === 0
          ? `${res.data.ok} 名へ確認メールを送信しました。相手がメール内のボタンを押すと「確認済み」になります。`
          : `${res.data.ok} 名へ送信しました（${res.data.failed} 名は失敗）。失敗した理由は一覧の「結果」列を確認してください。`,
      )
      await reloadEmployeesFromDb()
      onSent()
    } catch (err) {
      setMessage(`送信に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setBusy(false)
    }
  }, [candidates, selected, onSent])

  return (
    <div
      className={styles.overlay}
      onClick={() => {
        if (!busy) onClose()
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-bulk-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="verify-bulk-title" className={styles.title}>
            メール到達確認の一括送信
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる" disabled={busy}>
            ×
          </button>
        </div>

        <p className={styles.desc}>
          給与明細メールが届くかどうかを確かめる確認メールを、選んだ従業員へまとめて送ります。
          受け取った方がメール内のボタンを押すと「確認済み」になります。
        </p>

        <div className={styles.note}>
          すでに確認済みの方、退職者、メールアドレスが未登録・不正な方は対象外です。
          迷惑メールに振り分けられた場合は相手が気づけないため、しばらく「確認中」のままの方には別の手段で連絡してください。
        </div>

        <div className={styles.summary}>
          <span>
            送信対象: <span className={styles.summaryValue}>{selected.size} 名</span>
          </span>
          <span className={styles.muted}>（候補 {candidates.length} 名）</span>
        </div>

        <div className={styles.body}>
          {candidates.length === 0 ? (
            <p className={styles.empty}>
              送信できる従業員がいません。メールアドレスが登録されているか確認してください。
            </p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.checkCell}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={busy}
                      aria-label="すべて選択"
                    />
                  </th>
                  <th>氏名</th>
                  <th>メールアドレス</th>
                  <th>現在の状態</th>
                  {results && <th>結果</th>}
                </tr>
              </thead>
              <tbody>
                {candidates.map((e) => {
                  const result = results?.get(e.id)
                  return (
                    <tr key={e.id}>
                      <td className={styles.checkCell}>
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          onChange={() => toggle(e.id)}
                          disabled={busy}
                          aria-label={`${e.name} を選択`}
                        />
                      </td>
                      <td>{e.name}</td>
                      <td className={styles.emailText}>{e.email}</td>
                      <td>
                        <span
                          className={styles.statusBadge}
                          data-status={e.emailVerifyStatus ?? 'unverified'}
                        >
                          {statusLabel(e.emailVerifyStatus)}
                        </span>
                      </td>
                      {results && (
                        <td>
                          {result ? (
                            result.success ? (
                              <span className={styles.resultOk}>送信済み</span>
                            ) : (
                              <span className={styles.resultNg}>
                                失敗
                                <span className={styles.resultError}>{result.error}</span>
                              </span>
                            )
                          ) : (
                            <span className={styles.muted}>-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.message}>{message}</span>
          <div className={styles.actions}>
            <button className={styles.btnSecondary} onClick={onClose} disabled={busy}>
              {results ? '閉じる' : 'キャンセル'}
            </button>
            <button
              className={styles.btnPrimary}
              onClick={() => void handleSend()}
              disabled={busy || selected.size === 0}
            >
              {busy ? '送信中...' : `${selected.size} 名へ送信`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
