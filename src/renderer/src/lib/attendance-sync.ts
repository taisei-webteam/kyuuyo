/**
 * Supabase からの勤怠データ同期サービス
 *
 * punch_records を取得 → 日次ペアリング → MockAttendanceDay 形式に変換
 */

import { supabase, isSupabaseConfigured } from './supabase'
import type { MockAttendanceDay, MockEmployee, StampInType, StampOutType } from './mock-data'
import { roundClockIn, roundClockOut, calcEarlyOvertime } from './time-rounding'
import type { ClockInConfig } from './time-rounding'
import { getSettings } from './settings-store'

interface PunchRecord {
  id: string
  employee_id: number
  employee_name: string
  punch_type: 'clock_in' | 'clock_out'
  punched_at: string
  device: string
  cancelled: boolean
}

interface DayPunches {
  employeeId: number
  employeeName: string
  date: string
  clockIn: string | null
  clockOut: string | null
}

export interface SyncResult {
  success: boolean
  synced: number
  warnings: SyncWarning[]
  error?: string
}

export interface SyncWarning {
  employeeId: number
  employeeName: string
  date: string
  type: 'missing_clock_out' | 'missing_clock_in' | 'abnormal_hours'
  message: string
}

function groupPunchesByDay(punches: PunchRecord[]): DayPunches[] {
  const active = punches.filter((p) => !p.cancelled)

  const grouped = new Map<string, PunchRecord[]>()
  for (const p of active) {
    const date = p.punched_at.slice(0, 10)
    const key = `${p.employee_id}:${date}`
    const arr = grouped.get(key) ?? []
    arr.push(p)
    grouped.set(key, arr)
  }

  const results: DayPunches[] = []
  for (const [key, dayPunches] of grouped) {
    const [empId, date] = key.split(':')
    const sorted = dayPunches.sort(
      (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
    )
    const clockIns = sorted.filter((p) => p.punch_type === 'clock_in')
    const clockOuts = sorted.filter((p) => p.punch_type === 'clock_out')

    results.push({
      employeeId: Number(empId),
      employeeName: sorted[0]?.employee_name ?? '',
      date: date!,
      clockIn: clockIns[0]?.punched_at ?? null,
      clockOut: clockOuts.at(-1)?.punched_at ?? null,
    })
  }

  return results
}

function validateDayPunches(pairs: DayPunches[]): SyncWarning[] {
  const warnings: SyncWarning[] = []

  for (const pair of pairs) {
    if (pair.clockIn && !pair.clockOut) {
      warnings.push({
        employeeId: pair.employeeId,
        employeeName: pair.employeeName,
        date: pair.date,
        type: 'missing_clock_out',
        message: `${pair.employeeName}: ${pair.date} の退勤打刻がありません`,
      })
    }
    if (!pair.clockIn && pair.clockOut) {
      warnings.push({
        employeeId: pair.employeeId,
        employeeName: pair.employeeName,
        date: pair.date,
        type: 'missing_clock_in',
        message: `${pair.employeeName}: ${pair.date} の出勤打刻がありません`,
      })
    }
    if (pair.clockIn && pair.clockOut) {
      const diffMs = new Date(pair.clockOut).getTime() - new Date(pair.clockIn).getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      if (diffHours > 16) {
        warnings.push({
          employeeId: pair.employeeId,
          employeeName: pair.employeeName,
          date: pair.date,
          type: 'abnormal_hours',
          message: `${pair.employeeName}: ${pair.date} の勤務時間が${diffHours.toFixed(1)}時間と異常です`,
        })
      }
    }
  }

  return warnings
}

function extractTimeHHMM(isoOrDatetime: string): string {
  const d = new Date(isoOrDatetime)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

function clockInTypeToStampIn(type: 'early' | 'normal' | 'late'): StampInType {
  if (type === 'early') return '早出'
  if (type === 'late') return '遅刻'
  return '出勤'
}

function detectStampOut(clockOut: string, scheduledEnd: string): StampOutType {
  const outMin = toMinutes(clockOut)
  const endMin = toMinutes(scheduledEnd)
  if (outMin < endMin) return '早退'
  return '退勤'
}

/**
 * 打刻ペアを MockAttendanceDay に変換
 */
function pairToAttendanceDay(
  pair: DayPunches,
  employee: MockEmployee,
  isHoliday: boolean,
): MockAttendanceDay {
  if (!pair.clockIn && !pair.clockOut) {
    return {
      date: pair.date,
      rawClockIn: null,
      rawClockOut: null,
      clockIn: null,
      clockOut: null,
      stampIn: null,
      stampOut: null,
      goOut: null,
      goReturn: null,
      workMinutes: 0,
      overtimeMinutes: 0,
      earlyOvertimeMinutes: 0,
      isHoliday,
      isHolidayWork: isHoliday,
      paidLeaveUsage: null,
      paidLeaveStatus: null,
      dataSource: 'ipad',
    }
  }

  const settings = getSettings()
  const clockInConfig: ClockInConfig = {
    scheduledStart: employee.scheduledStart,
    earlyWorkStart: employee.earlyWorkStart,
    earlyWorkEnd: employee.earlyWorkEnd,
    roundingUnit: settings.roundingUnit,
    gracePeriod: settings.gracePeriod,
  }

  const rawIn = pair.clockIn ? extractTimeHHMM(pair.clockIn) : null
  const rawOut = pair.clockOut ? extractTimeHHMM(pair.clockOut) : null

  let clockIn: string | null = null
  let stampIn: StampInType | null = null
  let earlyOvertimeMinutes = 0

  if (rawIn) {
    const result = roundClockIn(rawIn, clockInConfig)
    clockIn = result.time
    stampIn = clockInTypeToStampIn(result.type)
    earlyOvertimeMinutes = calcEarlyOvertime(
      rawIn,
      employee.earlyWorkStart,
      employee.earlyWorkEnd,
      settings.earlyRoundingUnit,
    )
  }

  let clockOut: string | null = null
  let stampOut: StampOutType | null = null

  if (rawOut) {
    clockOut = roundClockOut(rawOut, settings.roundingUnit)
    stampOut = detectStampOut(clockOut, employee.scheduledEnd)
  }

  let workMinutes = 0
  let overtimeMinutes = 0

  if (clockIn && clockOut) {
    const inMin = toMinutes(clockIn)
    const outMin = toMinutes(clockOut)
    const breakMinutes = settings.defaultBreakMinutes
    const scheduledMinutes =
      toMinutes(employee.scheduledEnd) - toMinutes(employee.scheduledStart) - breakMinutes
    workMinutes = Math.max(0, outMin - inMin - breakMinutes)
    overtimeMinutes = Math.max(0, workMinutes - scheduledMinutes)
  }

  return {
    date: pair.date,
    rawClockIn: rawIn,
    rawClockOut: rawOut,
    clockIn,
    clockOut,
    stampIn,
    stampOut,
    goOut: null,
    goReturn: null,
    workMinutes,
    overtimeMinutes,
    earlyOvertimeMinutes,
    isHoliday,
    isHolidayWork: isHoliday && workMinutes > 0,
    paidLeaveUsage: null,
    paidLeaveStatus: null,
    dataSource: 'ipad',
  }
}

/**
 * 指定年月の打刻データを Supabase から取得し、
 * 従業員ごとの MockAttendanceDay[] に変換して返す。
 */
export async function syncAttendanceMonth(
  employeeId: number,
  employee: MockEmployee,
  year: number,
  month: number,
  isHolidayFn: (dateStr: string) => boolean,
): Promise<SyncResult & { days: MockAttendanceDay[] }> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      synced: 0,
      warnings: [],
      days: [],
      error: 'Supabase が設定されていません。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
    }
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00`

  const { data, error } = await supabase
    .from('punch_records')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('punched_at', startDate)
    .lt('punched_at', endDate)
    .order('punched_at', { ascending: true })

  if (error) {
    return {
      success: false,
      synced: 0,
      warnings: [],
      days: [],
      error: `Supabase エラー: ${error.message}`,
    }
  }

  const punches = (data ?? []) as PunchRecord[]
  const pairs = groupPunchesByDay(punches)
  const warnings = validateDayPunches(pairs)

  const daysInMonth = new Date(year, month, 0).getDate()
  const days: MockAttendanceDay[] = []

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isHoliday = isHolidayFn(dateStr)
    const pair = pairs.find((p) => p.date === dateStr)

    if (pair) {
      days.push(pairToAttendanceDay(pair, employee, isHoliday))
    } else {
      days.push({
        date: dateStr,
        rawClockIn: null,
        rawClockOut: null,
        clockIn: null,
        clockOut: null,
        stampIn: null,
        stampOut: null,
        goOut: null,
        goReturn: null,
        workMinutes: 0,
        overtimeMinutes: 0,
        earlyOvertimeMinutes: 0,
        isHoliday,
        isHolidayWork: false,
        paidLeaveUsage: null,
        paidLeaveStatus: null,
        dataSource: 'manual',
      })
    }
  }

  return {
    success: true,
    synced: pairs.length,
    warnings,
    days,
  }
}

/**
 * 全従業員の指定年月の打刻件数をサマリとして取得
 */
export async function fetchPunchSummary(
  year: number,
  month: number,
): Promise<{ employeeId: number; count: number }[]> {
  if (!isSupabaseConfigured()) return []

  const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00`

  const { data } = await supabase
    .from('punch_records')
    .select('employee_id')
    .eq('cancelled', false)
    .gte('punched_at', startDate)
    .lt('punched_at', endDate)

  if (!data) return []

  const counts = new Map<number, number>()
  for (const row of data) {
    const id = (row as { employee_id: number }).employee_id
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  return Array.from(counts, ([employeeId, count]) => ({ employeeId, count }))
}
