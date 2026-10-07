import { useState, useMemo, useCallback, useRef } from 'react'
import type { ReactElement, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { updateEmployee, reloadEmployeesFromDb, type MockEmployee } from '@/lib/mock-data'
import styles from './ResidentTaxBulkModal.module.css'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

/** 金額文字列（カンマ・円記号・空白許容）を整数に変換する。無効なら null。 */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[¥,\s円]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

/** 加算額（マイナス可）を整数に変換する。無効なら null。 */
function parseDelta(raw: string): number | null {
  const cleaned = raw.replace(/[¥,\s円+]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

/**
 * パートの時給を一括入力するモーダル。
 * 在籍しているパートだけを表示し、1人ずつ入力するか「全員に加算」で一律に上げ下げできる。
 * Enter で下の行へ移動する。
 */
export function HourlyRateBulkModal({
  employees,
  onClose,
  onSaved,
}: {
  employees: MockEmployee[]
  onClose: () => void
  onSaved: () => void
}): ReactElement {
  const targets = useMemo(
    () => employees.filter((e) => e.employeeType === 'パート' && e.isActive),
    [employees],
  )

  const [drafts, setDrafts] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    for (const e of targets) init[e.id] = String(e.hourlyRate)
    return init
  })
  const [deltaRaw, setDeltaRaw] = useState('55')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map())

  const changedCount = useMemo(() => {
    let n = 0
    for (const e of targets) {
      const draft = parseAmount(drafts[e.id] ?? '')
      if (draft !== null && draft !== e.hourlyRate) n++
    }
    return n
  }, [drafts, targets])

  const handleChange = useCallback((id: number, value: string): void => {
    setDrafts((prev) => ({ ...prev, [id]: value }))
  }, [])

  const handleKeyDown = useCallback(
    (index: number, ev: KeyboardEvent<HTMLInputElement>): void => {
      if (ev.key !== 'Enter') return
      ev.preventDefault()
      const next = targets[index + 1]
      if (!next) return
      const el = inputRefs.current.get(next.id)
      el?.focus()
      el?.select()
    },
    [targets],
  )

  /** 現在の時給に加算額を足した値を全員の入力欄に入れる（まだ保存はしない）。 */
  const handleApplyDelta = useCallback((): void => {
    const delta = parseDelta(deltaRaw)
    if (delta === null) {
      setMessage('加算額は数字で入力してください（例: 55）。')
      return
    }
    setDrafts(() => {
      const next: Record<number, string> = {}
      for (const e of targets) next[e.id] = String(Math.max(0, e.hourlyRate + delta))
      return next
    })
    setMessage(`全員の時給を現在値 ${delta >= 0 ? '+' : ''}${delta} 円にしました。内容を確認して保存してください。`)
  }, [deltaRaw, targets])

  const handleResetDrafts = useCallback((): void => {
    setDrafts(() => {
      const next: Record<number, string> = {}
      for (const e of targets) next[e.id] = String(e.hourlyRate)
      return next
    })
    setMessage(null)
  }, [targets])

  const handleSave = useCallback(async (): Promise<void> => {
    const invalid = targets.filter((e) => parseAmount(drafts[e.id] ?? '') === null)
    if (invalid.length > 0) {
      setMessage(`入力が正しくない従業員がいます（${invalid.map((e) => e.name).join('、')}）。数字を入力してください。`)
      return
    }
    const changes = targets
      .map((e) => ({ e, amount: parseAmount(drafts[e.id] ?? '') as number }))
      .filter(({ e, amount }) => amount !== e.hourlyRate)

    if (changes.length === 0) {
      setMessage('変更はありません。')
      return
    }
    setBusy(true)
    setMessage('保存中...')
    try {
      if (hasElectronApi) {
        let ok = 0
        for (const { e, amount } of changes) {
          const res = await window.api.employees.update({ id: e.id, hourlyRate: amount })
          if (res.success) ok++
        }
        await reloadEmployeesFromDb()
        setMessage(
          ok === changes.length
            ? `${ok} 名の時給を更新しました`
            : `${ok}/${changes.length} 名を更新しました（一部失敗）`,
        )
      } else {
        for (const { e, amount } of changes) {
          updateEmployee({ ...e, hourlyRate: amount })
        }
        setMessage(`${changes.length} 名の時給を更新しました`)
      }
      onSaved()
    } catch (err) {
      setMessage(`保存に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setBusy(false)
    }
  }, [drafts, targets, onSaved])

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>パートの時給を一括入力</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <p className={styles.desc}>
          在籍しているパート {targets.length} 名の時給をまとめて変更します。
          時給は給与作成時点の値で計算されるため、過去月の給与を作り直すときは当時の時給に戻してから作成してください。
        </p>

        <div className={styles.toolbar} style={{ alignItems: 'center' }}>
          <label className={styles.muted} htmlFor="hourly-rate-delta">
            全員に加算
          </label>
          <input
            id="hourly-rate-delta"
            type="text"
            inputMode="numeric"
            className={styles.input}
            style={{ width: '6rem' }}
            value={deltaRaw}
            onChange={(ev) => setDeltaRaw(ev.target.value)}
            disabled={busy}
          />
          <span className={styles.muted}>円</span>
          <button className={styles.btnSecondary} onClick={handleApplyDelta} disabled={busy || targets.length === 0}>
            全員に加算
          </button>
          <button className={styles.btnSecondary} onClick={handleResetDrafts} disabled={busy}>
            入力を現在値に戻す
          </button>
        </div>

        <div className={styles.summary}>
          <span>
            変更対象: <span className={styles.summaryValue}>{changedCount} 名</span>
          </span>
        </div>

        <div className={styles.body}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>氏名</th>
                <th>部署</th>
                <th className={styles.thRight}>現在の時給</th>
                <th className={styles.thRight}>新しい時給</th>
                <th className={styles.thRight}>差額</th>
              </tr>
            </thead>
            <tbody>
              {targets.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.muted}>
                    在籍しているパートがいません。
                  </td>
                </tr>
              )}
              {targets.map((e, index) => {
                const draftRaw = drafts[e.id] ?? ''
                const draft = parseAmount(draftRaw)
                const changed = draft !== null && draft !== e.hourlyRate
                const diff = draft === null ? null : draft - e.hourlyRate
                return (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td className={styles.muted}>{e.departmentName || '—'}</td>
                    <td className={styles.tdRight}>{yen(e.hourlyRate)}</td>
                    <td className={styles.tdRight}>
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(e.id, el)
                          else inputRefs.current.delete(e.id)
                        }}
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${changed ? styles.changed : ''}`}
                        value={draftRaw}
                        onChange={(ev) => handleChange(e.id, ev.target.value)}
                        onKeyDown={(ev) => handleKeyDown(index, ev)}
                        disabled={busy}
                      />
                    </td>
                    <td className={`${styles.tdRight} ${styles.muted}`}>
                      {diff === null || diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('ja-JP')}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <span className={styles.message}>{message}</span>
          <div className={styles.actions}>
            <button className={styles.btnSecondary} onClick={onClose} disabled={busy}>
              キャンセル
            </button>
            <button className={styles.btnPrimary} onClick={() => void handleSave()} disabled={busy || changedCount === 0}>
              {busy ? '保存中...' : `${changedCount} 名を保存`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
