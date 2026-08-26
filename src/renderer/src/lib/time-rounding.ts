/**
 * 共有モジュールからの re-export
 * Renderer 側の既存 import パスを維持するためのブリッジ。
 */
export {
  roundClockIn,
  roundClockOut,
  roundHolidayClockIn,
  calcEarlyOvertime,
  calcBreakMinutes,
  unpaidGoOutMinutes,
  roundOvertimeMinutes,
  floorToUnit,
  toMinutes,
  fromMinutes,
  LEGAL_BREAK_THRESHOLD_MINUTES,
} from '../../../shared/time-rounding'

export type {
  ClockInConfig,
  ClockInType,
  ClockInResult,
} from '../../../shared/time-rounding'
