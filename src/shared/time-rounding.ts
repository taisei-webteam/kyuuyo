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
 * 休日の出勤丸め。
 * 平日定時（例: 09:00）へは上げない。
 * 早出開始があればそれをその日の開始とし、より前の打刻は開始時刻に切上げる。
 * 早出開始が無い場合は丸め単位で切捨てる。
 */
export function roundHolidayClockIn(
  rawTime: string,
  roundingUnit: number,
  gracePeriod: number,
  earlyWorkStart: string | null,
): string {
  if (earlyWorkStart) {
    return roundClockIn(rawTime, {
      scheduledStart: earlyWorkStart,
      earlyWorkStart: null,
      earlyWorkEnd: null,
      roundingUnit,
      gracePeriod,
    }).time
  }
  return fromMinutes(floorToUnit(toMinutes(rawTime), roundingUnit))
}

/** 労働基準法34条: 6時間を超える場合に休憩を与える */
export const LEGAL_BREAK_THRESHOLD_MINUTES = 6 * 60

/**
 * その日の休憩時間（分）を決める。
 *
 * 拘束時間（出勤〜退勤 − 外出）が 6 時間以下なら 0。
 * 6 時間を超える日は会社設定の昼休憩（通常 60 分）を適用する。
 * 8 時間超の法定 60 分は、会社既定 60 分で満たす。
 */
export function calcBreakMinutes(spanMinutes: number, defaultBreakMinutes: number): number {
  if (spanMinutes <= LEGAL_BREAK_THRESHOLD_MINUTES) return 0
  return Math.max(0, defaultBreakMinutes)
}

/**
 * 労働時間から引く外出時間（分）。
 * 12時台（12:00〜12:59）の外出は昼休憩とみなし、所定休憩と二重に引かない。
 */
export function unpaidGoOutMinutes(goOut: string | null, goReturn: string | null): number {
  if (!goOut || !goReturn) return 0
  const start = toMinutes(goOut.slice(0, 5))
  const lunchStart = 12 * 60
  const lunchEnd = 13 * 60
  if (start >= lunchStart && start < lunchEnd) return 0
  return Math.max(0, toMinutes(goReturn.slice(0, 5)) - start)
}

/**
 * 早出時間を計算（分）
 *
 * 出勤丸めと同じく、早出開始より前の打刻は開始時刻に切上げてから数える。
 * （例: 07:40 打刻 → 08:00 開始。08:00〜早出終了が早出）
 *
 * - 実打刻 ≥ 早出終了        → 0（早出時間帯を過ぎた出社）
 * - それ以外                 → (早出終了 − max(実打刻, 早出開始)) を earlyRoundingUnit で切り捨て
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
  if (raw >= earlyEnd) return 0
  const start = Math.max(raw, earlyStart)
  return floorToUnit(earlyEnd - start, earlyRoundingUnit)
}

/**
 * 残業時間を丸める（月合計に対して残業丸め単位で切り捨て）
 */
export function roundOvertimeMinutes(totalOvertimeMinutes: number, overtimeRoundingUnit: number): number {
  return floorToUnit(Math.max(0, totalOvertimeMinutes), overtimeRoundingUnit)
}
