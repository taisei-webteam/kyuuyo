import { useState, useEffect, useRef } from 'react'
import type { ReactElement, ChangeEvent } from 'react'
import { newExtraLine, type PayslipExtraLine } from '@/lib/mock-data'
import styles from './PayslipExtraLinesEditor.module.css'

function ExtraLineRow({
  line,
  syncKey,
  onPatch,
  onRemove,
}: {
  line: PayslipExtraLine
  syncKey: string
  onPatch: (patch: Partial<Pick<PayslipExtraLine, 'label' | 'amount'>>) => void
  onRemove: () => void
}): ReactElement {
  const labelRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)
  const [amountText, setAmountText] = useState(() => (line.amount > 0 ? String(line.amount) : ''))

  useEffect(() => {
    if (labelRef.current) {
      labelRef.current.value = line.label
    }
    setAmountText(line.amount > 0 ? String(line.amount) : '')
  }, [line.id, syncKey])

  const commitLabel = (): void => {
    if (composingRef.current) return
    const next = labelRef.current?.value ?? ''
    if (next !== line.label) {
      onPatch({ label: next })
    }
  }

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const digits = e.target.value.replace(/\D/g, '')
    setAmountText(digits)
    onPatch({ amount: digits === '' ? 0 : Number(digits) })
  }

  return (
    <div className={styles.extraRow}>
      <input
        ref={labelRef}
        type="text"
        className={styles.extraLabelInput}
        defaultValue={line.label}
        onBlur={commitLabel}
        onCompositionStart={() => {
          composingRef.current = true
        }}
        onCompositionEnd={() => {
          composingRef.current = false
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        placeholder="項目名"
        aria-label="追加項目名"
        autoComplete="off"
        spellCheck={false}
      />
      <input
        type="text"
        inputMode="numeric"
        className={styles.amountInput}
        value={amountText}
        onChange={handleAmountChange}
        onFocus={commitLabel}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        aria-label={`${line.label || '追加項目'}の金額`}
      />
      <button
        type="button"
        className={styles.extraRemoveBtn}
        onClick={onRemove}
        aria-label="行を削除"
      >
        ×
      </button>
    </div>
  )
}

export function ExtraLinesSection({
  lines,
  syncKey,
  onCommit,
}: {
  lines: PayslipExtraLine[]
  syncKey: string
  onCommit: (updater: (prev: PayslipExtraLine[]) => PayslipExtraLine[]) => void
}): ReactElement {
  return (
    <div className={styles.sectionExtra}>
      {lines.map((line) => (
        <ExtraLineRow
          key={line.id}
          line={line}
          syncKey={syncKey}
          onPatch={(patch) => {
            onCommit((prev) => prev.map((item) => (item.id === line.id ? { ...item, ...patch } : item)))
          }}
          onRemove={() => {
            onCommit((prev) => prev.filter((item) => item.id !== line.id))
          }}
        />
      ))}
      <button
        type="button"
        className={styles.addLineBtn}
        onClick={() => onCommit((prev) => [...prev, newExtraLine()])}
      >
        + 行を追加
      </button>
    </div>
  )
}
