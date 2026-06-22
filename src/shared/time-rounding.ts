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

function floorToUnit(minutes: number, unit: number): number {
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
 * 早出残業時間を計算（分）
 *
 * 出勤(丸め後)～早出終了時間 の勤務時間を返す。
 * 早出設定がない場合や通常出勤の場合は 0。
 */
export function calcEarlyOvertime(
  clockInRounded: string,
  clockInType: ClockInType,
  earlyWorkEnd: string | null,
): number {
  if (clockInType !== 'early' || !earlyWorkEnd) return 0
  const inMin = toMinutes(clockInRounded)
  const endMin = toMinutes(earlyWorkEnd)
  return Math.max(0, endMin - inMin)
}
