import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import styles from './DateSelect.module.css'

interface DateSelectProps {
  /** YYYY-MM-DD 形式の値（未入力は空文字） */
  value: string
  /** 同じく YYYY-MM-DD 形式（未確定時は空文字）を返す */
  onChange: (value: string) => void
  /** 選択可能な最小年（省略時は現在年-100） */
  minYear?: number
  /** 選択可能な最大年（省略時は現在年） */
  maxYear?: number
  required?: boolean
}

interface Parts {
  year: string
  month: string
  day: string
}

function parse(value: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return { year: '', month: '', day: '' }
  return { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) }
}

/** 指定年月の日数（うるう年・月末対応） */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function DateSelect({
  value,
  onChange,
  minYear,
  maxYear,
  required,
}: DateSelectProps): ReactElement {
  const current = new Date().getFullYear()
  const max = maxYear ?? current
  const min = minYear ?? current - 100

  // 途中段階（年だけ選択など）を保持するための内部状態
  const [parts, setParts] = useState<Parts>(() => parse(value))

  // 親から渡る value が変わったら内部状態へ反映（編集・別従業員切替に対応）
  useEffect(() => {
    setParts(parse(value))
  }, [value])

  const years: number[] = []
  for (let y = max; y >= min; y--) years.push(y)

  const months: number[] = []
  for (let m = 1; m <= 12; m++) months.push(m)

  const dayCount =
    parts.year && parts.month ? daysInMonth(Number(parts.year), Number(parts.month)) : 31
  const days: number[] = []
  for (let d = 1; d <= dayCount; d++) days.push(d)

  function update(next: Parts): void {
    setParts(next)
    if (!next.year || !next.month || !next.day) {
      onChange('')
      return
    }
    // 月末を超える日付（例: 2/31）はその月の末日に丸める
    const maxDay = daysInMonth(Number(next.year), Number(next.month))
    const clampedDay = Math.min(Number(next.day), maxDay)
    const mm = next.month.padStart(2, '0')
    const dd = String(clampedDay).padStart(2, '0')
    onChange(`${next.year}-${mm}-${dd}`)
  }

  return (
    <div className={styles.dateSelect}>
      <select
        className={styles.year}
        value={parts.year}
        onChange={(e) => update({ ...parts, year: e.target.value })}
        required={required}
        aria-label="年"
      >
        <option value="">----</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
      <span className={styles.unit}>年</span>
      <select
        className={styles.month}
        value={parts.month}
        onChange={(e) => update({ ...parts, month: e.target.value })}
        required={required}
        aria-label="月"
      >
        <option value="">--</option>
        {months.map((m) => (
          <option key={m} value={String(m)}>
            {m}
          </option>
        ))}
      </select>
      <span className={styles.unit}>月</span>
      <select
        className={styles.day}
        value={parts.day}
        onChange={(e) => update({ ...parts, day: e.target.value })}
        required={required}
        aria-label="日"
      >
        <option value="">--</option>
        {days.map((d) => (
          <option key={d} value={String(d)}>
            {d}
          </option>
        ))}
      </select>
      <span className={styles.unit}>日</span>
    </div>
  )
}
