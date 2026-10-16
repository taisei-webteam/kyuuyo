import { useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, MouseEvent, ReactElement } from 'react'

function toHalfWidthNumeric(raw: string): string {
  return raw
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
}

/** 整数の下書き。空欄は空欄のまま、先頭の 0 は次の数字を打った時点で落とす。 */
export function normalizeIntegerDraft(raw: string): string {
  const digits = toHalfWidthNumeric(raw).replace(/\D/g, '')
  if (digits === '') return ''
  return String(Number(digits))
}

function sanitizeNumericInput(raw: string, allowDecimal: boolean): string {
  const half = toHalfWidthNumeric(raw)
  if (!allowDecimal) return normalizeIntegerDraft(half)
  const cleaned = half.replace(/[^\d.]/g, '')
  if (cleaned === '' || cleaned === '.') return cleaned
  const dot = cleaned.indexOf('.')
  if (dot < 0) return normalizeIntegerDraft(cleaned)
  const headRaw = cleaned.slice(0, dot)
  const tail = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2)
  const head = headRaw === '' ? '' : String(Number(headRaw))
  return `${head}.${tail}`
}

function parseNumericInput(text: string, allowDecimal: boolean): number {
  if (text === '' || text === '.') return 0
  const n = Number(text)
  if (!Number.isFinite(n) || n < 0) return 0
  return allowDecimal ? Math.round(n * 100) / 100 : Math.round(n)
}

function formatNumericInput(value: number | null, blankWhenZero: boolean): string {
  if (value === null || !Number.isFinite(value)) return ''
  if (blankWhenZero && value === 0) return ''
  return String(value)
}

function isZeroText(value: string): boolean {
  return value === '0' || value === '0.0' || value === '0.00'
}

/** 初期値 0 を選択した状態で上書きできるようにする。 */
export function selectZeroOnFocus(event: FocusEvent<HTMLInputElement>): void {
  const el = event.currentTarget
  if (!isZeroText(el.value)) return
  requestAnimationFrame(() => el.select())
}

/** クリックで 0 の選択が解除されないようにする。 */
export function keepZeroSelectionOnMouseUp(event: MouseEvent<HTMLInputElement>): void {
  if (isZeroText(event.currentTarget.value)) event.preventDefault()
}

/**
 * 金額・日数の入力。
 * 値 0 を Number に戻すと空欄が即座に 0 へ戻るため、編集中は文字列のまま持つ。
 * 空欄の確定値は 0（nullable のときは null）。フォーカスを外すと表示を確定値に戻す。
 */
export function ClearableNumberInput({
  value,
  onValue,
  className,
  allowDecimal = false,
  nullable = false,
  blankWhenZero = false,
  placeholder,
  disabled,
  title,
  onKeyDown,
  dataRow,
  dataCol,
}: {
  value: number | null
  onValue: (value: number | null) => void
  className?: string
  allowDecimal?: boolean
  /** 空欄の確定値を null にする（有給残日数など） */
  nullable?: boolean
  /** 確定値 0 は空欄で表示する（積立・貸付など） */
  blankWhenZero?: boolean
  placeholder?: string
  disabled?: boolean
  title?: string
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  dataRow?: number
  dataCol?: number
}): ReactElement {
  const [text, setText] = useState(() => formatNumericInput(value, blankWhenZero))
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setText(formatNumericInput(value, blankWhenZero))
  }, [value, blankWhenZero])

  const commit = (nextText: string): void => {
    if (nextText === '' || nextText === '.') {
      if (nullable) {
        if (value !== null) onValue(null)
        return
      }
      if (value !== 0) onValue(0)
      return
    }
    const parsed = parseNumericInput(nextText, allowDecimal)
    if (parsed !== value) onValue(parsed)
  }

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      spellCheck={false}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      title={title}
      value={text}
      data-row={dataRow}
      data-col={dataCol}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        focusedRef.current = true
        selectZeroOnFocus(event)
      }}
      onMouseUp={keepZeroSelectionOnMouseUp}
      onBlur={() => {
        focusedRef.current = false
        if (text === '' || text === '.') {
          if (nullable) {
            setText('')
            if (value !== null) onValue(null)
            return
          }
          setText(blankWhenZero ? '' : '0')
          if (value !== 0) onValue(0)
          return
        }
        const next = parseNumericInput(text, allowDecimal)
        setText(formatNumericInput(next, blankWhenZero))
        if (next !== value) onValue(next)
      }}
      onChange={(event) => {
        const next = sanitizeNumericInput(event.target.value, allowDecimal)
        setText(next)
        commit(next)
      }}
    />
  )
}
