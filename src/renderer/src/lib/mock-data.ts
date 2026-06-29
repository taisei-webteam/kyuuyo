// 保険料率（令和6年度の参考値。本番では insurance_rates テーブルから取得）
export const INSURANCE_RATES = {
  healthRate: 0.04985,
  nursingRate: 0.008,
  pensionRate: 0.0915,
  employmentRate: 0.006,
} as const

/**
 * 社会保険料の端数処理: 50銭以下切捨て、50銭超切上げ
 */
function roundInsurance(amount: number): number {
  const fraction = amount - Math.floor(amount)
  if (fraction <= 0.5) return Math.floor(amount)
  return Math.ceil(amount)
}

/**
 * 生年月日から指定日時点の年齢を計算
 */
export function calcAge(birthDate: string, baseDate: string = new Date().toISOString().slice(0, 10)): number {
  const birth = new Date(birthDate)
  const base = new Date(baseDate)
  let age = base.getFullYear() - birth.getFullYear()
  const monthDiff = base.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && base.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export interface InsurancePremiums {
  healthInsurance: number
  nursingInsurance: number
  welfarePension: number
  employmentInsurance: number
}

/**
 * 社会保険料を標準報酬月額と生年月日から自動計算
 */
export function calculateInsurancePremiums(
  standardMonthlyRemuneration: number,
  birthDate: string,
  totalPayment: number,
): InsurancePremiums {
  const age = calcAge(birthDate)
  const healthInsurance = roundInsurance(standardMonthlyRemuneration * INSURANCE_RATES.healthRate)
  const nursingInsurance = age >= 40
    ? roundInsurance(standardMonthlyRemuneration * INSURANCE_RATES.nursingRate)
    : 0
  const welfarePension = roundInsurance(standardMonthlyRemuneration * INSURANCE_RATES.pensionRate)
  const employmentInsurance = Math.floor(totalPayment * INSURANCE_RATES.employmentRate)
  return { healthInsurance, nursingInsurance, welfarePension, employmentInsurance }
}

export type HolidayMode = 'calendar' | 'individual'

export interface MockEmployee {
  id: number
  name: string
  nameKana: string
  email: string
  birthDate: string
  employeeType: '社員' | '役員' | 'パート'
  departmentName: string
  jobTitle: string
  hireDate: string
  displayOrder: number
  basicSalary: number
  hourlyRate: number
  standardMonthlyRemuneration: number
  transportAllowance: number
  positionAllowance: number
  familyAllowance: number
  specialAllowance: number
  dangerAllowance: number
  salesAllowance: number
  healthInsurance: number
  welfarePension: number
  residentTax: number
  savingsDeduction: number
  loanDeduction: number
  dependents: number
  isActive: boolean
  scheduledStart: string
  scheduledEnd: string
  holidayDays: number[]
  holidayMode: HolidayMode
  earlyWorkStart: string | null
  earlyWorkEnd: string | null
  overtimeAllowed: boolean
  overtimeStart: string | null
  overtimeEnd: string | null
}

export type StampInType = '出勤' | '早出' | '遅刻'
export type StampOutType = '退勤' | '早退'

export interface MockAttendanceDay {
  date: string
  rawClockIn: string | null
  rawClockOut: string | null
  clockIn: string | null
  clockOut: string | null
  stampIn: StampInType | null
  stampOut: StampOutType | null
  goOut: string | null
  goReturn: string | null
  workMinutes: number
  overtimeMinutes: number
  earlyOvertimeMinutes: number
  isHoliday: boolean
  isHolidayWork: boolean
  dataSource: 'ipad' | 'manual'
}

export interface MockPayslip {
  id: number
  employeeId: number
  year: number
  month: number
  workDays: number
  workHours: number
  overtimeHours: number
  holidayWorkDays: number
  basicSalary: number
  overtimePay: number
  transportAllowance: number
  positionAllowance: number
  familyAllowance: number
  specialAllowance: number
  dangerAllowance: number
  salesAllowance: number
  otherAllowance: number
  totalPayment: number
  healthInsurance: number
  nursingInsurance: number
  welfarePension: number
  employmentInsurance: number
  incomeTax: number
  residentTax: number
  savingsDeduction: number
  loanDeduction: number
  otherDeduction: number
  totalDeduction: number
  netPayment: number
}

const employees: MockEmployee[] = [
  {
    id: 1,
    name: '藤原 誠一',
    nameKana: 'フジワラ セイイチ',
    email: 'fujiwara@example.co.jp',
    birthDate: '1965-03-12',
    employeeType: '役員',
    departmentName: '総務部',
    jobTitle: '代表取締役',
    hireDate: '2005-04-01',
    displayOrder: 1,
    basicSalary: 500000,
    hourlyRate: 0,
    standardMonthlyRemuneration: 620000,
    transportAllowance: 0,
    positionAllowance: 100000,
    familyAllowance: 20000,
    specialAllowance: 0,
    dangerAllowance: 0,
    salesAllowance: 0,
    healthInsurance: 29730,
    welfarePension: 56730,
    residentTax: 45000,
    savingsDeduction: 0,
    loanDeduction: 0,
    dependents: 2,
    isActive: true,
    scheduledStart: '09:00',
    scheduledEnd: '18:00',
    holidayDays: [0, 6],
    holidayMode: 'calendar',
    earlyWorkStart: null,
    earlyWorkEnd: null,
    overtimeAllowed: true,
    overtimeStart: '18:00',
    overtimeEnd: '22:00',
  },
  {
    id: 2,
    name: '中村 健太',
    nameKana: 'ナカムラ ケンタ',
    email: 'nakamura@example.co.jp',
    birthDate: '1978-08-25',
    employeeType: '社員',
    departmentName: '営業部',
    jobTitle: '課長',
    hireDate: '2010-04-01',
    displayOrder: 2,
    basicSalary: 350000,
    hourlyRate: 0,
    standardMonthlyRemuneration: 460000,
    transportAllowance: 15000,
    positionAllowance: 50000,
    familyAllowance: 15000,
    specialAllowance: 0,
    dangerAllowance: 0,
    salesAllowance: 30000,
    healthInsurance: 22610,
    welfarePension: 43155,
    residentTax: 28000,
    savingsDeduction: 10000,
    loanDeduction: 0,
    dependents: 1,
    isActive: true,
    scheduledStart: '09:00',
    scheduledEnd: '18:00',
    holidayDays: [0, 6],
    holidayMode: 'calendar',
    earlyWorkStart: null,
    earlyWorkEnd: null,
    overtimeAllowed: true,
    overtimeStart: '18:00',
    overtimeEnd: '22:00',
  },
  {
    id: 3,
    name: '山本 裕子',
    nameKana: 'ヤマモト ユウコ',
    email: 'yamamoto@example.co.jp',
    birthDate: '1972-11-03',
    employeeType: '役員',
    departmentName: '総務部',
    jobTitle: '取締役',
    hireDate: '2008-07-01',
    displayOrder: 3,
    basicSalary: 450000,
    hourlyRate: 0,
    standardMonthlyRemuneration: 540000,
    transportAllowance: 10000,
    positionAllowance: 80000,
    familyAllowance: 0,
    specialAllowance: 0,
    dangerAllowance: 0,
    salesAllowance: 0,
    healthInsurance: 26730,
    welfarePension: 51030,
    residentTax: 38000,
    savingsDeduction: 20000,
    loanDeduction: 0,
    dependents: 0,
    isActive: true,
    scheduledStart: '09:00',
    scheduledEnd: '18:00',
    holidayDays: [0, 6],
    holidayMode: 'calendar',
    earlyWorkStart: null,
    earlyWorkEnd: null,
    overtimeAllowed: true,
    overtimeStart: '18:00',
    overtimeEnd: '22:00',
  },
  {
    id: 4,
    name: '高橋 大輔',
    nameKana: 'タカハシ ダイスケ',
    email: 'takahashi@example.co.jp',
    birthDate: '1988-05-20',
    employeeType: '社員',
    departmentName: '技術部',
    jobTitle: '主任',
    hireDate: '2015-04-01',
    displayOrder: 4,
    basicSalary: 300000,
    hourlyRate: 0,
    standardMonthlyRemuneration: 380000,
    transportAllowance: 12000,
    positionAllowance: 30000,
    familyAllowance: 15000,
    specialAllowance: 10000,
    dangerAllowance: 5000,
    salesAllowance: 0,
    healthInsurance: 18810,
    welfarePension: 35910,
    residentTax: 22000,
    savingsDeduction: 5000,
    loanDeduction: 20000,
    dependents: 2,
    isActive: true,
    scheduledStart: '08:30',
    scheduledEnd: '17:30',
    holidayDays: [0, 6],
    holidayMode: 'calendar',
    earlyWorkStart: '07:30',
    earlyWorkEnd: '08:15',
    overtimeAllowed: true,
    overtimeStart: '17:30',
    overtimeEnd: '22:00',
  },
  {
    id: 5,
    name: '佐藤 俊介',
    nameKana: 'サトウ シュンスケ',
    email: 'sato@example.co.jp',
    birthDate: '1990-01-15',
    employeeType: '社員',
    departmentName: '営業部',
    jobTitle: '係長',
    hireDate: '2017-04-01',
    displayOrder: 5,
    basicSalary: 320000,
    hourlyRate: 0,
    standardMonthlyRemuneration: 410000,
    transportAllowance: 18000,
    positionAllowance: 20000,
    familyAllowance: 10000,
    specialAllowance: 0,
    dangerAllowance: 0,
    salesAllowance: 25000,
    healthInsurance: 20390,
    welfarePension: 38925,
    residentTax: 24000,
    savingsDeduction: 0,
    loanDeduction: 30000,
    dependents: 1,
    isActive: true,
    scheduledStart: '09:00',
    scheduledEnd: '18:00',
    holidayDays: [0, 6],
    holidayMode: 'calendar',
    earlyWorkStart: '08:00',
    earlyWorkEnd: '08:45',
    overtimeAllowed: true,
    overtimeStart: '18:00',
    overtimeEnd: '22:00',
  },
  {
    id: 6,
    name: '伊藤 翔太',
    nameKana: 'イトウ ショウタ',
    email: 'ito@example.co.jp',
    birthDate: '1995-07-08',
    employeeType: 'パート',
    departmentName: '製造部',
    jobTitle: '-',
    hireDate: '2020-06-01',
    displayOrder: 6,
    basicSalary: 0,
    hourlyRate: 1200,
    standardMonthlyRemuneration: 200000,
    transportAllowance: 5000,
    positionAllowance: 0,
    familyAllowance: 0,
    specialAllowance: 0,
    dangerAllowance: 3000,
    salesAllowance: 0,
    healthInsurance: 9900,
    welfarePension: 18900,
    residentTax: 8000,
    savingsDeduction: 0,
    loanDeduction: 0,
    dependents: 0,
    isActive: true,
    scheduledStart: '10:00',
    scheduledEnd: '16:00',
    holidayDays: [0, 3, 6],
    holidayMode: 'individual',
    earlyWorkStart: null,
    earlyWorkEnd: null,
    overtimeAllowed: false,
    overtimeStart: null,
    overtimeEnd: null,
  },
  {
    id: 7,
    name: '渡辺 美咲',
    nameKana: 'ワタナベ ミサキ',
    email: 'watanabe@example.co.jp',
    birthDate: '1998-12-01',
    employeeType: 'パート',
    departmentName: '製造部',
    jobTitle: '-',
    hireDate: '2021-09-01',
    displayOrder: 7,
    basicSalary: 0,
    hourlyRate: 1100,
    standardMonthlyRemuneration: 180000,
    transportAllowance: 3000,
    positionAllowance: 0,
    familyAllowance: 0,
    specialAllowance: 0,
    dangerAllowance: 3000,
    salesAllowance: 0,
    healthInsurance: 8910,
    welfarePension: 17010,
    residentTax: 6500,
    savingsDeduction: 0,
    loanDeduction: 0,
    dependents: 0,
    isActive: true,
    scheduledStart: '09:00',
    scheduledEnd: '15:00',
    holidayDays: [0, 6],
    holidayMode: 'calendar',
    earlyWorkStart: null,
    earlyWorkEnd: null,
    overtimeAllowed: false,
    overtimeStart: null,
    overtimeEnd: null,
  },
  {
    id: 8,
    name: '松田 浩二',
    nameKana: 'マツダ コウジ',
    email: 'matsuda@example.co.jp',
    birthDate: '1982-04-10',
    employeeType: 'パート',
    departmentName: '倉庫部',
    jobTitle: '-',
    hireDate: '2022-01-15',
    displayOrder: 8,
    basicSalary: 0,
    hourlyRate: 1150,
    standardMonthlyRemuneration: 190000,
    transportAllowance: 4000,
    positionAllowance: 0,
    familyAllowance: 0,
    specialAllowance: 0,
    dangerAllowance: 0,
    salesAllowance: 0,
    healthInsurance: 9400,
    welfarePension: 17940,
    residentTax: 7000,
    savingsDeduction: 0,
    loanDeduction: 0,
    dependents: 1,
    isActive: true,
    scheduledStart: '09:00',
    scheduledEnd: '16:00',
    holidayDays: [0, 4, 6],
    holidayMode: 'individual',
    earlyWorkStart: null,
    earlyWorkEnd: null,
    overtimeAllowed: false,
    overtimeStart: null,
    overtimeEnd: null,
  },
]

// ========================================
// 会社カレンダーストア
// ========================================

import { getHolidaysForYear } from './holidays-jp'
import { roundClockIn, roundClockOut, calcEarlyOvertime } from './time-rounding'
import type { ClockInConfig } from './time-rounding'
import { getSettings } from './settings-store'
import { calcWithholdingTaxMonthly } from '../../../shared/income-tax-jp'
import type { AttendanceRecord, RawPunch, Employee, EmployeeCreate, Payslip, PayslipCreate } from '../../../shared/types'

export interface CalendarDay {
  isHoliday: boolean
  holidayName: string | null
  isNationalHoliday: boolean
}

const calendarStore = new Map<string, CalendarDay>()

export function initCalendarYear(year: number): void {
  const daysInYear = new Date(year, 11, 31).getDate() === 31 ? 365 + (isLeapYear(year) ? 1 : 0) : 365
  const holidays = getHolidaysForYear(year)
  const holidayMap = new Map(holidays.map((h) => [h.date, h.name]))

  const start = new Date(year, 0, 1)
  for (let i = 0; i < (isLeapYear(year) ? 366 : 365); i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const key = formatDateKey(d)
    const dow = d.getDay()
    const nationalHolidayName = holidayMap.get(key) ?? null
    const isSunday = dow === 0

    if (!calendarStore.has(key)) {
      calendarStore.set(key, {
        isHoliday: isSunday || nationalHolidayName !== null,
        holidayName: nationalHolidayName,
        isNationalHoliday: nationalHolidayName !== null,
      })
    }
  }
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getCalendarDay(date: string): CalendarDay | undefined {
  return calendarStore.get(date)
}

export function setCalendarDay(date: string, isHoliday: boolean, holidayName?: string): void {
  const existing = calendarStore.get(date)
  calendarStore.set(date, {
    isHoliday,
    holidayName: holidayName ?? existing?.holidayName ?? null,
    isNationalHoliday: existing?.isNationalHoliday ?? false,
  })
}

export function getCalendarYear(year: number): Map<string, CalendarDay> {
  initCalendarYear(year)
  const result = new Map<string, CalendarDay>()
  for (const [key, val] of calendarStore) {
    if (key.startsWith(`${year}-`)) {
      result.set(key, val)
    }
  }
  return result
}

export function loadNationalHolidays(year: number): void {
  const holidays = getHolidaysForYear(year)
  const daysInYear = isLeapYear(year) ? 366 : 365
  const start = new Date(year, 0, 1)
  const holidayMap = new Map(holidays.map((h) => [h.date, h.name]))

  for (let i = 0; i < daysInYear; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const key = formatDateKey(d)
    const nationalName = holidayMap.get(key) ?? null
    const isSunday = d.getDay() === 0
    const existing = calendarStore.get(key)

    calendarStore.set(key, {
      isHoliday: isSunday || nationalName !== null || (existing?.isHoliday ?? false),
      holidayName: nationalName ?? existing?.holidayName ?? null,
      isNationalHoliday: nationalName !== null,
    })
  }
}

export function resetCalendarYear(year: number): void {
  for (const key of [...calendarStore.keys()]) {
    if (key.startsWith(`${year}-`)) {
      calendarStore.delete(key)
    }
  }
}

function isCalendarHoliday(dateStr: string, year: number): boolean {
  if (!calendarStore.has(`${year}-01-01`)) {
    initCalendarYear(year)
  }
  return calendarStore.get(dateStr)?.isHoliday ?? false
}

// ========================================

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function clockInTypeToStampIn(type: 'early' | 'normal' | 'late'): StampInType {
  if (type === 'early') return '早出'
  if (type === 'late') return '遅刻'
  return '出勤'
}

function detectStampOut(clockOut: string, scheduledEnd: string): StampOutType {
  const outMin = timeToMinutes(clockOut)
  const endMin = timeToMinutes(scheduledEnd)
  if (outMin < endMin) return '早退'
  return '退勤'
}

function generateAttendance(employeeId: number, year: number, month: number): MockAttendanceDay[] {
  const emp = employeeData.find((e) => e.id === employeeId)
  const scheduledStart = emp?.scheduledStart ?? '09:00'
  const scheduledEnd = emp?.scheduledEnd ?? '18:00'
  const holidayMode = emp?.holidayMode ?? 'calendar'
  const settings = getSettings()

  const clockInConfig: ClockInConfig = {
    scheduledStart,
    earlyWorkStart: emp?.earlyWorkStart ?? null,
    earlyWorkEnd: emp?.earlyWorkEnd ?? null,
    roundingUnit: settings.roundingUnit,
    gracePeriod: settings.gracePeriod,
  }

  const days: MockAttendanceDay[] = []
  const daysInMonth = new Date(year, month, 0).getDate()

  const holidayDays = emp?.holidayDays ?? [0, 6]

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dow = date.getDay()
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isHoliday = holidayMode === 'calendar'
      ? isCalendarHoliday(dateStr, year)
      : holidayDays.includes(dow)

    if (isHoliday) {
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
        isHoliday: true,
        isHolidayWork: false,
        dataSource: 'ipad',
      })
      continue
    }

    const baseInHour = 8
    const baseInMin = 25 + ((employeeId * 7 + day * 3) % 15)
    const baseOutHour = 17
    const baseOutMin = 30 + ((employeeId * 5 + day * 11) % 45)

    const rawClockIn = `${String(baseInHour).padStart(2, '0')}:${String(baseInMin).padStart(2, '0')}`
    const rawClockOut = `${String(baseOutHour).padStart(2, '0')}:${String(baseOutMin).padStart(2, '0')}`

    const clockInResult = roundClockIn(rawClockIn, clockInConfig)
    const clockIn = clockInResult.time
    const clockOut = roundClockOut(rawClockOut, settings.roundingUnit)

    const earlyOvertimeMinutes = calcEarlyOvertime(
      rawClockIn,
      emp?.earlyWorkStart ?? null,
      emp?.earlyWorkEnd ?? null,
      settings.earlyRoundingUnit,
    )

    const hasGoOut = (employeeId + day) % 7 === 0
    let goOut: string | null = null
    let goReturn: string | null = null
    let goOutMinutes = 0
    if (hasGoOut) {
      const goOutHour = 13 + ((employeeId + day) % 3)
      const goOutMin = 10 + ((day * 7) % 30)
      const returnMin = goOutMin + 40 + ((employeeId * 3) % 50)
      const returnHour = goOutHour + Math.floor(returnMin / 60)
      const returnMinRemainder = returnMin % 60
      goOut = `${String(goOutHour).padStart(2, '0')}:${String(goOutMin).padStart(2, '0')}`
      goReturn = `${String(returnHour).padStart(2, '0')}:${String(returnMinRemainder).padStart(2, '0')}`
      goOutMinutes = (returnHour * 60 + returnMinRemainder) - (goOutHour * 60 + goOutMin)
    }

    const workStartMin = timeToMinutes(clockIn)
    let workEndMin = timeToMinutes(clockOut)

    const overtimeAllowed = emp?.overtimeAllowed ?? true
    const overtimeStart = emp?.overtimeStart ?? null
    const overtimeEnd = emp?.overtimeEnd ?? null

    // 残業不可の場合: 退勤を定時終了で切り捨て
    if (!overtimeAllowed) {
      const scheduledEndMin = timeToMinutes(scheduledEnd)
      workEndMin = Math.min(workEndMin, scheduledEndMin)
    }
    // 残業終了時刻が設定されている場合: 退勤をその時刻で上限クリップ
    else if (overtimeEnd) {
      const otEndMin = timeToMinutes(overtimeEnd)
      workEndMin = Math.min(workEndMin, otEndMin)
    }

    const breakMinutes = settings.defaultBreakMinutes
    const totalWork = Math.max(0, workEndMin - workStartMin - breakMinutes - goOutMinutes)
    const scheduledMinutes = timeToMinutes(scheduledEnd) - timeToMinutes(scheduledStart) - breakMinutes

    let overtime = 0
    if (!overtimeAllowed) {
      overtime = 0
    } else if (overtimeStart) {
      const otStartMin = timeToMinutes(overtimeStart)
      const clippedEnd = timeToMinutes(clockOut)
      const effectiveEnd = overtimeEnd ? Math.min(clippedEnd, timeToMinutes(overtimeEnd)) : clippedEnd
      overtime = Math.max(0, effectiveEnd - otStartMin)
    } else {
      overtime = Math.max(0, totalWork - scheduledMinutes)
    }

    days.push({
      date: dateStr,
      rawClockIn,
      rawClockOut,
      clockIn,
      clockOut,
      stampIn: clockInTypeToStampIn(clockInResult.type),
      stampOut: detectStampOut(clockOut, scheduledEnd),
      goOut,
      goReturn,
      workMinutes: totalWork,
      overtimeMinutes: overtime,
      earlyOvertimeMinutes,
      isHoliday: false,
      isHolidayWork: false,
      dataSource: day % 5 === 0 ? 'manual' : 'ipad',
    })
  }

  return days
}

/**
 * 給与計算に必要な勤怠の月次集計
 */
export interface AttendanceAggregate {
  workDays: number
  workHours: number
  overtimeHours: number
  holidayWorkDays: number
}

/**
 * SQLite (attendance_records) から取得した実勤怠レコードを従業員ごとに集計する。
 * Supabase 同期 → 丸め済みの勤怠を給与計算に反映するための入口。
 */
export function aggregateAttendanceRecords(
  records: AttendanceRecord[],
): Map<number, AttendanceAggregate> {
  const acc = new Map<number, { workDays: number; totalWork: number; totalOvertime: number; holidayWorkDays: number }>()
  for (const r of records) {
    const cur = acc.get(r.employeeId) ?? { workDays: 0, totalWork: 0, totalOvertime: 0, holidayWorkDays: 0 }
    if (!r.isHoliday && r.workMinutes > 0) cur.workDays++
    cur.totalWork += r.workMinutes
    // 残業時間 = 通常残業 + 早出 + 休日出勤(全労働時間)。いずれも割増(1.25倍)の対象。
    if (r.isHolidayWork) {
      cur.totalOvertime += r.workMinutes
      cur.holidayWorkDays++
    } else {
      cur.totalOvertime += r.overtimeMinutes + r.earlyOvertimeMinutes
    }
    acc.set(r.employeeId, cur)
  }

  const result = new Map<number, AttendanceAggregate>()
  for (const [id, v] of acc) {
    result.set(id, {
      workDays: v.workDays,
      workHours: Math.round((v.totalWork / 60) * 10) / 10,
      overtimeHours: Math.round((v.totalOvertime / 60) * 10) / 10,
      holidayWorkDays: v.holidayWorkDays,
    })
  }
  return result
}

function generatePayslips(
  year: number,
  month: number,
  realAttendance?: Map<number, AttendanceAggregate>,
): MockPayslip[] {
  return employeeData.map((emp, idx) => {
    // 実勤怠 (Supabase 同期 → attendance_records) があれば優先し、
    // 無ければ従来どおりモック勤怠から算出する。
    const real = realAttendance?.get(emp.id)
    let workDays: number
    let workHours: number
    let overtimeHours: number
    let holidayWorkDays: number
    if (real) {
      workDays = real.workDays
      workHours = real.workHours
      overtimeHours = real.overtimeHours
      holidayWorkDays = real.holidayWorkDays
    } else {
      const attendance = generateAttendance(emp.id, year, month)
      workDays = attendance.filter(d => !d.isHoliday && d.workMinutes > 0).length
      const totalWorkMinutes = attendance.reduce((sum, d) => sum + d.workMinutes, 0)
      const totalOvertimeMinutes = attendance.reduce((sum, d) => sum + d.overtimeMinutes, 0)
      workHours = Math.round(totalWorkMinutes / 60 * 10) / 10
      overtimeHours = Math.round(totalOvertimeMinutes / 60 * 10) / 10
      holidayWorkDays = 0
    }

    const isPartTime = emp.employeeType === 'パート'
    const regularHours = Math.max(0, workHours - overtimeHours)

    let basicSalary: number
    let hourlyRate: number
    if (isPartTime) {
      hourlyRate = emp.hourlyRate
      basicSalary = Math.round(hourlyRate * regularHours)
    } else {
      hourlyRate = Math.round(emp.basicSalary / 160)
      basicSalary = emp.basicSalary
    }

    const overtimePay = Math.round(hourlyRate * 1.25 * overtimeHours)

    const totalPayment =
      basicSalary +
      overtimePay +
      emp.transportAllowance +
      emp.positionAllowance +
      emp.familyAllowance +
      emp.specialAllowance +
      emp.dangerAllowance +
      emp.salesAllowance

    const premiums = calculateInsurancePremiums(
      emp.standardMonthlyRemuneration,
      emp.birthDate,
      totalPayment,
    )

    // その月の社会保険料等控除後の給与等の金額（非課税通勤手当を除いた課税支給 − 社会保険料）
    const socialInsuranceTotal =
      premiums.healthInsurance +
      premiums.nursingInsurance +
      premiums.welfarePension +
      premiums.employmentInsurance
    const taxableBase = totalPayment - emp.transportAllowance - socialInsuranceTotal
    // 源泉徴収税額（月額表・甲欄／電算機計算の特例）。扶養親族等の数で税額が変わる。
    const incomeTax = calcWithholdingTaxMonthly(taxableBase, emp.dependents)

    const totalDeduction =
      premiums.healthInsurance +
      premiums.nursingInsurance +
      premiums.welfarePension +
      premiums.employmentInsurance +
      incomeTax +
      emp.residentTax +
      emp.savingsDeduction +
      emp.loanDeduction

    const netPayment = totalPayment - totalDeduction

    return {
      id: idx + 1,
      employeeId: emp.id,
      year,
      month,
      workDays,
      workHours,
      overtimeHours,
      holidayWorkDays,
      basicSalary,
      overtimePay,
      transportAllowance: emp.transportAllowance,
      positionAllowance: emp.positionAllowance,
      familyAllowance: emp.familyAllowance,
      specialAllowance: emp.specialAllowance,
      dangerAllowance: emp.dangerAllowance,
      salesAllowance: emp.salesAllowance,
      otherAllowance: 0,
      totalPayment,
      healthInsurance: premiums.healthInsurance,
      nursingInsurance: premiums.nursingInsurance,
      welfarePension: premiums.welfarePension,
      employmentInsurance: premiums.employmentInsurance,
      incomeTax,
      residentTax: emp.residentTax,
      savingsDeduction: emp.savingsDeduction,
      loanDeduction: emp.loanDeduction,
      otherDeduction: 0,
      totalDeduction,
      netPayment,
    }
  })
}

const payslipCache = new Map<string, MockPayslip[]>()
const createdMonths = new Set<string>()

let employeeData = [...employees]

export function getEmployees(): MockEmployee[] {
  return [...employeeData].sort((a, b) => a.displayOrder - b.displayOrder)
}

/**
 * 従業員データソースを差し替える（DB から読み込んだ一覧で上書きする）。
 * 給与キャッシュもクリアして再計算を促す。
 */
export function setEmployees(list: MockEmployee[]): void {
  employeeData = [...list]
  payslipCache.clear()
  createdMonths.clear()
}

/**
 * Electron 環境では DB(window.api.employees.list) から従業員を読み込み、
 * 画面共通のデータソース(employeeData)へ反映する。Vite 単体では何もしない。
 */
export async function reloadEmployeesFromDb(): Promise<boolean> {
  if (typeof window === 'undefined' || !('api' in window)) return false
  const res = await window.api.employees.list()
  if (!res.success) return false
  const active = res.data.filter((e) => e.isActive)
  if (active.length === 0) return false
  setEmployees(active.map(mapDbEmployeeToMock).sort((a, b) => a.displayOrder - b.displayOrder))
  return true
}

/**
 * MockEmployee を DB 登録/更新用の入力(EmployeeCreate)へ変換する。
 * holidayDays は DB に列が無いため除外する。
 */
export function mockToEmployeeInput(m: MockEmployee): EmployeeCreate {
  return {
    name: m.name,
    nameKana: m.nameKana,
    email: m.email,
    birthDate: m.birthDate || null,
    employeeType: m.employeeType,
    departmentName: m.departmentName,
    jobTitle: m.jobTitle,
    hireDate: m.hireDate || null,
    resignDate: null,
    displayOrder: m.displayOrder,
    basicSalary: m.basicSalary,
    hourlyRate: m.hourlyRate,
    standardMonthlyRemuneration: m.standardMonthlyRemuneration,
    transportAllowance: m.transportAllowance,
    positionAllowance: m.positionAllowance,
    familyAllowance: m.familyAllowance,
    specialAllowance: m.specialAllowance,
    dangerAllowance: m.dangerAllowance,
    salesAllowance: m.salesAllowance,
    healthInsurance: m.healthInsurance,
    welfarePension: m.welfarePension,
    residentTax: m.residentTax,
    savingsDeduction: m.savingsDeduction,
    loanDeduction: m.loanDeduction,
    dependents: m.dependents,
    scheduledStart: m.scheduledStart,
    scheduledEnd: m.scheduledEnd,
    holidayMode: m.holidayMode,
    earlyWorkStart: m.earlyWorkStart,
    earlyWorkEnd: m.earlyWorkEnd,
    overtimeAllowed: m.overtimeAllowed,
    overtimeStart: m.overtimeStart,
    overtimeEnd: m.overtimeEnd,
    isActive: m.isActive,
  }
}

/**
 * DB の Employee (shared/types) を画面用の MockEmployee 形に変換する。
 * holidayDays は DB に持っていないため既定値 [0,6]（土日休み）を補う。
 */
export function mapDbEmployeeToMock(e: Employee): MockEmployee {
  return {
    id: e.id,
    name: e.name,
    nameKana: e.nameKana,
    email: e.email,
    birthDate: e.birthDate ?? '',
    employeeType: e.employeeType,
    departmentName: e.departmentName,
    jobTitle: e.jobTitle,
    hireDate: e.hireDate ?? '',
    displayOrder: e.displayOrder,
    basicSalary: e.basicSalary,
    hourlyRate: e.hourlyRate,
    standardMonthlyRemuneration: e.standardMonthlyRemuneration,
    transportAllowance: e.transportAllowance,
    positionAllowance: e.positionAllowance,
    familyAllowance: e.familyAllowance,
    specialAllowance: e.specialAllowance,
    dangerAllowance: e.dangerAllowance,
    salesAllowance: e.salesAllowance,
    healthInsurance: e.healthInsurance,
    welfarePension: e.welfarePension,
    residentTax: e.residentTax,
    savingsDeduction: e.savingsDeduction,
    loanDeduction: e.loanDeduction,
    dependents: e.dependents,
    isActive: e.isActive,
    scheduledStart: e.scheduledStart,
    scheduledEnd: e.scheduledEnd,
    holidayDays: [0, 6],
    holidayMode: e.holidayMode,
    earlyWorkStart: e.earlyWorkStart,
    earlyWorkEnd: e.earlyWorkEnd,
    overtimeAllowed: e.overtimeAllowed,
    overtimeStart: e.overtimeStart,
    overtimeEnd: e.overtimeEnd,
  }
}

/**
 * 新規従業員に割り当てる ID を返す (既存最大 + 1)。
 * Supabase / SQLite の employee_id は integer 型のため、Date.now() のような
 * 巨大値を使わず小さな連番にする。
 */
export function nextEmployeeId(): number {
  return employeeData.reduce((max, e) => Math.max(max, e.id), 0) + 1
}

export function updateEmployee(updated: MockEmployee): void {
  const idx = employeeData.findIndex(e => e.id === updated.id)
  if (idx >= 0) {
    employeeData[idx] = updated
  } else {
    employeeData.push(updated)
  }
  payslipCache.clear()
}

export function deleteEmployee(id: number): void {
  employeeData = employeeData.filter(e => e.id !== id)
  payslipCache.clear()
}

export function getAttendance(employeeId: number, year: number, month: number): MockAttendanceDay[] {
  return generateAttendance(employeeId, year, month)
}

/**
 * SQLite から取得した実打刻 (raw_punches) と丸め済み勤怠 (attendance_records) を
 * 月次の勤怠表 (MockAttendanceDay[]) に組み立てる。
 *
 * - 上段=実打刻 は raw_punches、下段=丸め時間/労働時間は attendance_records 由来。
 * - レコードが無い日は空欄（休日判定は従業員設定で補完）。
 * Supabase 同期 → 勤怠管理画面のメイン表に「実際の打刻」を反映するための変換。
 */
export function buildAttendanceDaysFromRecords(
  employeeId: number,
  year: number,
  month: number,
  records: AttendanceRecord[],
  rawPunches: RawPunch[],
): MockAttendanceDay[] {
  const emp = employeeData.find((e) => e.id === employeeId)
  const holidayMode = emp?.holidayMode ?? 'calendar'
  const holidayDays = emp?.holidayDays ?? [0, 6]

  const recByDate = new Map<string, AttendanceRecord>()
  for (const r of records) {
    if (r.employeeId === employeeId) recByDate.set(r.date, r)
  }
  const rawByDate = new Map<string, RawPunch>()
  for (const r of rawPunches) {
    if (r.employeeId === employeeId) rawByDate.set(r.date, r)
  }

  const toHm = (t: string | null): string | null => (t ? t.slice(0, 5) : null)

  const days: MockAttendanceDay[] = []
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dow = new Date(year, month - 1, day).getDay()
    const rec = recByDate.get(dateStr)
    const raw = rawByDate.get(dateStr)

    const isHoliday = rec
      ? !!rec.isHoliday
      : holidayMode === 'calendar'
        ? isCalendarHoliday(dateStr, year)
        : holidayDays.includes(dow)

    days.push({
      date: dateStr,
      rawClockIn: toHm(raw?.rawClockIn ?? null),
      rawClockOut: toHm(raw?.rawClockOut ?? null),
      clockIn: toHm(rec?.clockIn ?? null),
      clockOut: toHm(rec?.clockOut ?? null),
      stampIn: null,
      stampOut: null,
      goOut: toHm(rec?.goOut ?? raw?.rawGoOut ?? null),
      goReturn: toHm(rec?.goReturn ?? raw?.rawGoReturn ?? null),
      workMinutes: rec?.workMinutes ?? 0,
      overtimeMinutes: rec?.overtimeMinutes ?? 0,
      earlyOvertimeMinutes: rec?.earlyOvertimeMinutes ?? 0,
      isHoliday,
      isHolidayWork: rec ? !!rec.isHolidayWork : false,
      dataSource: (rec?.dataSource ?? 'ipad') as 'ipad' | 'manual',
    })
  }

  return days
}

export function createPayslips(
  year: number,
  month: number,
  realAttendance?: Map<number, AttendanceAggregate>,
): MockPayslip[] {
  const key = `${year}-${month}`
  const data = generatePayslips(year, month, realAttendance)
  payslipCache.set(key, data)
  createdMonths.add(key)
  return data
}

export function isPayslipsCreated(year: number, month: number): boolean {
  return createdMonths.has(`${year}-${month}`)
}

export function getPayslip(employeeId: number, year: number, month: number): MockPayslip | undefined {
  const all = getPayslips(year, month)
  return all.find(p => p.employeeId === employeeId)
}

export function getPayslips(year: number, month: number): MockPayslip[] {
  const key = `${year}-${month}`
  if (!createdMonths.has(key)) {
    return []
  }
  return payslipCache.get(key) ?? []
}

// ========================================
// 給与明細の永続化 (SQLite ⇔ メモリキャッシュ)
// ========================================

const hasApi = (): boolean => typeof window !== 'undefined' && 'api' in window

/** DB の Payslip を画面用 MockPayslip に変換する。 */
function payslipToMock(p: Payslip): MockPayslip {
  return {
    id: p.id,
    employeeId: p.employeeId,
    year: p.year,
    month: p.month,
    workDays: p.workDays,
    workHours: p.workHours,
    overtimeHours: p.overtimeHours,
    holidayWorkDays: p.holidayWorkDays,
    basicSalary: p.basicSalary,
    overtimePay: p.overtimePay,
    transportAllowance: p.transportAllowance,
    positionAllowance: p.positionAllowance,
    familyAllowance: p.familyAllowance,
    specialAllowance: p.specialAllowance,
    dangerAllowance: p.dangerAllowance,
    salesAllowance: p.salesAllowance,
    otherAllowance: p.otherAllowance,
    totalPayment: p.totalPayment,
    healthInsurance: p.healthInsurance,
    nursingInsurance: p.nursingInsurance,
    welfarePension: p.welfarePension,
    employmentInsurance: p.employmentInsurance,
    incomeTax: p.incomeTax,
    residentTax: p.residentTax,
    savingsDeduction: p.savingsDeduction,
    loanDeduction: p.loanDeduction,
    otherDeduction: p.otherDeduction,
    totalDeduction: p.totalDeduction,
    netPayment: p.netPayment,
  }
}

/** 画面用 MockPayslip を DB 保存用 PayslipCreate に変換する。 */
function mockToPayslipCreate(m: MockPayslip, type: 'salary' | 'bonus' = 'salary'): PayslipCreate {
  return {
    employeeId: m.employeeId,
    year: m.year,
    month: m.month,
    paymentDate: null,
    payslipType: type,
    bonusSeason: null,
    workDays: m.workDays,
    workHours: m.workHours,
    overtimeHours: m.overtimeHours,
    holidayWorkDays: m.holidayWorkDays,
    basicSalary: m.basicSalary,
    overtimePay: m.overtimePay,
    transportAllowance: m.transportAllowance,
    positionAllowance: m.positionAllowance,
    familyAllowance: m.familyAllowance,
    specialAllowance: m.specialAllowance,
    dangerAllowance: m.dangerAllowance,
    salesAllowance: m.salesAllowance,
    otherAllowance: m.otherAllowance,
    totalPayment: m.totalPayment,
    healthInsurance: m.healthInsurance,
    nursingInsurance: m.nursingInsurance,
    welfarePension: m.welfarePension,
    employmentInsurance: m.employmentInsurance,
    incomeTax: m.incomeTax,
    residentTax: m.residentTax,
    savingsDeduction: m.savingsDeduction,
    loanDeduction: m.loanDeduction,
    otherDeduction: m.otherDeduction,
    totalDeduction: m.totalDeduction,
    netPayment: m.netPayment,
  }
}

/**
 * 編集済みの明細をメモリキャッシュへ書き戻す（作成済み扱いにする）。
 * DB 保存(savePayslipsToDb)と併用して、同一セッション内の再描画にも反映する。
 */
export function setPayslips(year: number, month: number, list: MockPayslip[]): void {
  const key = `${year}-${month}`
  payslipCache.set(key, list.map((p) => ({ ...p })))
  createdMonths.add(key)
}

/**
 * SQLite から指定年月の給与明細(salary)を読み込み、メモリキャッシュへ反映する。
 * Electron 環境のみ動作。DB に該当データがあれば作成済み扱いにし true を返す。
 */
export async function loadPayslipsFromDb(year: number, month: number): Promise<boolean> {
  if (!hasApi()) return false
  const res = await window.api.payslips.list(year, month, 'salary')
  if (!res.success || res.data.length === 0) return false
  setPayslips(year, month, res.data.map(payslipToMock))
  return true
}

/**
 * 指定年月の給与明細(salary)を SQLite に保存する（月単位で一括置換）。
 * Electron 環境のみ動作。保存成功時 true を返す。
 */
export async function savePayslipsToDb(
  year: number,
  month: number,
  list: MockPayslip[],
): Promise<boolean> {
  if (!hasApi()) return false
  const items = list.map((m) => mockToPayslipCreate(m, 'salary'))
  const res = await window.api.payslips.saveMonth(year, month, 'salary', items)
  return res.success
}

/** 賞与シーズンを支給月にマッピングする（夏季=7月 / 冬季=12月）。 */
function bonusSeasonToMonth(season: '夏季' | '冬季'): number {
  return season === '夏季' ? 7 : 12
}

/**
 * SQLite から指定年・賞与シーズンの賞与明細(bonus)を読み込む。
 * Electron 環境のみ動作。該当データが無ければ null を返す。
 * MockPayslip 形（賞与は basicSalary=基本賞与, specialAllowance=特別賞与, otherAllowance=業績賞与）と
 * 支給日を返す。
 */
export async function loadBonusFromDb(
  year: number,
  season: '夏季' | '冬季',
): Promise<{ list: MockPayslip[]; paymentDate: string | null } | null> {
  if (!hasApi()) return null
  const month = bonusSeasonToMonth(season)
  const res = await window.api.payslips.list(year, month, 'bonus')
  if (!res.success || res.data.length === 0) return null
  return {
    list: res.data.map(payslipToMock),
    paymentDate: res.data[0]?.paymentDate ?? null,
  }
}

/**
 * 指定年・賞与シーズンの賞与明細(bonus)を SQLite に保存する（月単位で一括置換）。
 * Electron 環境のみ動作。保存成功時 true を返す。
 */
export async function saveBonusToDb(
  year: number,
  season: '夏季' | '冬季',
  list: MockPayslip[],
  paymentDate: string | null,
): Promise<boolean> {
  if (!hasApi()) return false
  const month = bonusSeasonToMonth(season)
  const items: PayslipCreate[] = list.map((m) => ({
    ...mockToPayslipCreate(m, 'bonus'),
    month,
    bonusSeason: season,
    paymentDate: paymentDate || null,
  }))
  const res = await window.api.payslips.saveMonth(year, month, 'bonus', items)
  return res.success
}

// --- メール送信履歴 ---

export interface EmailSendRecord {
  employeeId: number
  type: 'payslip' | 'bonus'
  periodKey: string
  sentAt: string
}

const emailHistory: EmailSendRecord[] = []

function makeEmailPeriodKey(type: 'payslip' | 'bonus', year: number, monthOrSeason: number | string): string {
  return `${type}-${year}-${monthOrSeason}`
}

export function sendEmail(employeeId: number, type: 'payslip' | 'bonus', year: number, monthOrSeason: number | string): void {
  const periodKey = makeEmailPeriodKey(type, year, monthOrSeason)
  const exists = emailHistory.find((r) => r.employeeId === employeeId && r.periodKey === periodKey)
  if (!exists) {
    emailHistory.push({
      employeeId,
      type,
      periodKey,
      sentAt: new Date().toISOString(),
    })
  }
}

export function sendEmailBulk(employeeIds: number[], type: 'payslip' | 'bonus', year: number, monthOrSeason: number | string): void {
  for (const id of employeeIds) {
    sendEmail(id, type, year, monthOrSeason)
  }
}

export function isEmailSent(employeeId: number, type: 'payslip' | 'bonus', year: number, monthOrSeason: number | string): boolean {
  const periodKey = makeEmailPeriodKey(type, year, monthOrSeason)
  return emailHistory.some((r) => r.employeeId === employeeId && r.periodKey === periodKey)
}

export function getEmailHistory(type: 'payslip' | 'bonus', year: number, monthOrSeason: number | string): EmailSendRecord[] {
  const periodKey = makeEmailPeriodKey(type, year, monthOrSeason)
  return emailHistory.filter((r) => r.periodKey === periodKey)
}
