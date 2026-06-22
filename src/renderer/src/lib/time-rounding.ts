/**
 * 共有モジュールからの re-export
 * Renderer 側の既存 import パスを維持するためのブリッジ。
 */
export {
  roundClockIn,
  roundClockOut,
  calcEarlyOvertime,
  toMinutes,
  fromMinutes,
} from '../../../shared/time-rounding'

export type {
  ClockInConfig,
  ClockInType,
  ClockInResult,
} from '../../../shared/time-rounding'
