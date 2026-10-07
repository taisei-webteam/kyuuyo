import { useState, useMemo, useCallback } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { isBonusRecipient, type MockEmployee } from '@/lib/mock-data'
import styles from './ResidentTaxBulkModal.module.css'

type Season = '夏季' | '冬季'

/** 自動判定で対象外になる理由（表示用）。対象なら null。 */
function autoExcludeReason(
  emp: MockEmployee,
  year: number,
  season: Season,
  paymentDate: string,
): string | null {
  if (isBonusRecipient(emp, year, season, paymentDate)) return null
  if (emp.employeeType === '役員' && !emp.bonusEligible) return '役員（賞与支給のチェックなし）'
  if (emp.resignDate) return `支給月より前に退職（${emp.resignDate}）`
  if (emp.hireDate) return `支給月より後に入社（${emp.hireDate}）`
  return '自動判定では対象外'
}

/**
 * 賞与の支給対象者を選ぶモーダル。
 * 自動判定（社員・パート・賞与支給チェック済みの役員で、支給月に在籍）を基準に、
 * 手で追加・除外できる。チェックした人だけが賞与作成の一覧に載る。
 */
export function BonusRecipientModal({
  employees,
  recipientIds,
  year,
  season,
  paymentDate,
  onApply,
  onClose,
}: {
  employees: MockEmployee[]
  recipientIds: ReadonlySet<number>
  year: number
  season: Season
  paymentDate: string
  onApply: (ids: number[]) => void
  onClose: () => void
}): ReactElement {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(recipientIds))
  const [showResigned, setShowResigned] = useState(false)

  const autoIds = useMemo(
    () => new Set(employees.filter((e) => isBonusRecipient(e, year, season, paymentDate)).map((e) => e.id)),
    [employees, year, season, paymentDate],
  )

  const sorted = useMemo(
    () => [...employees].sort((a, b) => a.displayOrder - b.displayOrder),
    [employees],
  )

  // 退職者は既定で畳む。ただし今の対象者・チェック済みの人は常に出す。
  const visible = useMemo(
    () =>
      sorted.filter(
        (e) => showResigned || e.isActive || recipientIds.has(e.id) || selected.has(e.id),
      ),
    [sorted, showResigned, recipientIds, selected],
  )

  const hiddenResignedCount = useMemo(
    () => sorted.length - visible.length,
    [sorted, visible],
  )

  const toggle = useCallback((id: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleResetToAuto = useCallback((): void => {
    setSelected(new Set(autoIds))
  }, [autoIds])

  const handleSelectAllVisible = useCallback((): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const e of visible) next.add(e.id)
      return next
    })
  }, [visible])

  const handleClearAll = useCallback((): void => {
    setSelected(new Set())
  }, [])

  const addedCount = useMemo(
    () => [...selected].filter((id) => !recipientIds.has(id)).length,
    [selected, recipientIds],
  )
  const removedCount = useMemo(
    () => [...recipientIds].filter((id) => !selected.has(id)).length,
    [selected, recipientIds],
  )
  const changed = addedCount > 0 || removedCount > 0

  const handleApply = useCallback((): void => {
    onApply(sorted.filter((e) => selected.has(e.id)).map((e) => e.id))
  }, [onApply, sorted, selected])

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>
            {year}年 {season}賞与の対象者を追加・除外
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <p className={styles.desc}>
          チェックした人だけが賞与作成の一覧に載ります。自動判定（社員・パート・賞与支給にチェックした役員で、支給月に在籍）に関係なく、手で追加・除外できます。
          除外した人の入力内容は保存時に消えます。
        </p>

        <div className={styles.toolbar} style={{ alignItems: 'center' }}>
          <button className={styles.btnSecondary} onClick={handleResetToAuto} type="button">
            自動判定に戻す
          </button>
          <button className={styles.btnSecondary} onClick={handleSelectAllVisible} type="button">
            表示中を全員選択
          </button>
          <button className={styles.btnSecondary} onClick={handleClearAll} type="button">
            全員解除
          </button>
          <label className={styles.muted} style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showResigned}
              onChange={(e) => setShowResigned(e.target.checked)}
            />
            退職者も表示{hiddenResignedCount > 0 && !showResigned ? `（${hiddenResignedCount} 名）` : ''}
          </label>
        </div>

        <div className={styles.summary}>
          <span>
            対象者: <span className={styles.summaryValue}>{selected.size} 名</span>
          </span>
          <span className={styles.muted}>
            追加 {addedCount} 名 / 除外 {removedCount} 名
          </span>
        </div>

        <div className={styles.body}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>氏名</th>
                <th>区分</th>
                <th>部署</th>
                <th>在籍</th>
                <th>自動判定</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => {
                const isAuto = autoIds.has(e.id)
                const reason = isAuto ? null : autoExcludeReason(e, year, season, paymentDate)
                const checked = selected.has(e.id)
                const manual = checked !== isAuto
                const inputId = `bonus-recipient-${e.id}`
                return (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => toggle(e.id)}>
                    <td>
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(e.id)}
                        onClick={(ev) => ev.stopPropagation()}
                        aria-label={`${e.name} を対象にする`}
                      />
                    </td>
                    <td>
                      <label htmlFor={inputId} style={{ cursor: 'pointer' }} onClick={(ev) => ev.stopPropagation()}>
                        {e.name}
                      </label>
                    </td>
                    <td className={styles.muted}>{e.employeeType}</td>
                    <td className={styles.muted}>{e.departmentName || '—'}</td>
                    <td className={styles.muted}>
                      {e.isActive ? '在籍' : `退職${e.resignDate ? ` ${e.resignDate}` : ''}`}
                    </td>
                    <td className={styles.muted}>
                      {isAuto ? '対象' : reason}
                      {manual && (
                        <span style={{ marginLeft: 6, fontWeight: 600, color: checked ? '#2563eb' : '#dc2626' }}>
                          {checked ? '手動で追加' : '手動で除外'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <span className={styles.message}>
            {selected.size === 0 ? '対象者が 0 名です。1 名以上選んでください。' : ''}
          </span>
          <div className={styles.actions}>
            <button className={styles.btnSecondary} onClick={onClose} type="button">
              キャンセル
            </button>
            <button
              className={styles.btnPrimary}
              onClick={handleApply}
              disabled={!changed || selected.size === 0}
              type="button"
            >
              この対象者で確定
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
