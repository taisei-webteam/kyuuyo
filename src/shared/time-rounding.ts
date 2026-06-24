/**
 * 打刻時間の丸めロジック
 *
 * Main Process / Renderer 両方から利用される共有モジュール。
 * 全関数は純粋関数。設定値を引数で受け取り、副作用を持たない。
 */

export interface ClockInConfig {
  scheduledStart: string
  earlyWorkStart: string | null
  earlyWorkEnd: string | null
  roundingUnit: number
  gracePeriod: number
}

export type ClockInType = 'early' | 'normal' | 'late'

export interface ClockInResult {
  time: string
  type: ClockInType
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function floorToUnit(minutes: number, unit: number): number {
  if (unit <= 0) return minutes
  return Math.floor(minutes / unit) * unit
}

function ceilToUnit(minutes: number, unit: number): number {
  return Math.ceil(minutes / unit) * unit
}

/**
 * 出勤打刻を丸める
 *
 * 1. 早出開始前 → 早出開始に切上げ
 * 2. 早出時間帯内 → roundingUnit で切捨て（早出）
 * 3. 早出終了～定時開始（休憩） → 定時開始に切上げ（通常出勤）
 * 4. 定時～定時+猶予 → 定時扱い（通常出勤）
 * 5. 猶予超過 → roundingUnit で切上げ（遅刻）
 */
export function roundClockIn(rawTime: string, config: ClockInConfig): ClockInResult {
  const raw = toMinutes(rawTime)
  const scheduled = toMinutes(config.scheduledStart)
  const unit = config.roundingUnit
  const grace = config.gracePeriod

  const hasEarlyWork = config.earlyWorkStart !== null && config.earlyWorkEnd !== null

  if (hasEarlyWork) {
    const earlyStart = toMinutes(config.earlyWorkStart!)
    const earlyEnd = toMinutes(config.earlyWorkEnd!)

    if (raw < earlyStart) {
      return { time: config.earlyWorkStart!, type: 'early' }
    }

    if (raw >= earlyStart && raw <= earlyEnd) {
      return { time: fromMinutes(floorToUnit(raw, unit)), type: 'early' }
    }

    if (raw > earlyEnd && raw < scheduled) {
      return { time: config.scheduledStart, type: 'normal' }
    }
  } else {
    if (raw < scheduled) {
      return { time: config.scheduledStart, type: 'normal' }
    }
  }

  if (raw >= scheduled && raw <= scheduled + grace) {
    return { time: config.scheduledStart, type: 'normal' }
  }

  return { time: fromMinutes(ceilToUnit(raw, unit)), type: 'late' }
}

/**
 * 退勤打刻を丸める（常に切捨て）
 */
export function roundClockOut(rawTime: string, roundingUnit: number): string {
  const raw = toMinutes(rawTime)
  return fromMinutes(floorToUnit(raw, roundingUnit))
}

/**
 * 早出時間を計算（分）
 *
 * 「実打刻」を基準に、早出終了までの時間を早出丸め単位で切り捨てて返す。
 *
 * - 実打刻 < 早出開始        → 0（早出開始前の打刻は早出として数えない）
 * - 早出開始 ≤ 実打刻 < 早出終了 → (早出終了 − 実打刻) を earlyRoundingUnit で切り捨て
 * - 実打刻 ≥ 早出終了        → 0（早出時間帯を過ぎた出社）
 *
 * 早出設定（開始・終了）が無い場合は 0。
 */
export function calcEarlyOvertime(
  rawClockIn: string,
  earlyWorkStart: string | null,
  earlyWorkEnd: string | null,
  earlyRoundingUnit: number,
): number {
  if (!earlyWorkStart || !earlyWorkEnd) return 0
  const raw = toMinutes(rawClockIn)
  const earlyStart = toMinutes(earlyWorkStart)
  const earlyEnd = toMinutes(earlyWorkEnd)
  if (raw < earlyStart) return 0
  if (raw >= earlyEnd) return 0
  return floorToUnit(earlyEnd - raw, earlyRoundingUnit)
}

/**
 * 残業時間を丸める（月合計に対して残業丸め単位で切り捨て）
 */
export function roundOvertimeMinutes(totalOvertimeMinutes: number, overtimeRoundingUnit: number): number {
  return floorToUnit(Math.max(0, totalOvertimeMinutes), overtimeRoundingUnit)
}
