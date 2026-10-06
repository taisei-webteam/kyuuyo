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
  scheduledWorkMinutes,
  paidLeaveSupplementMinutes,
  minutesOutsideSchedule,
  partTimeLaborMinutes,
  BREAK_REQUIRED_AFTER_MINUTES,
} from '../../../shared/time-rounding'

export type {
  ClockInConfig,
  ClockInType,
  ClockInResult,
  OutsideScheduleMinutes,
  PartTimeLaborMinutes,
} from '../../../shared/time-rounding'
