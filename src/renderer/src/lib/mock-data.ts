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
}

export type StampInType = '出勤' | '早出' | '遅刻'
export type StampOutType = '退勤' | '早退'

export interface MockAttendanceDay {
  date: string
  clockIn: string | null
  clockOut: string | null
  stampIn: StampInType | null
  stampOut: StampOutType | null
  goOut: string | null
  goReturn: string | null
  workMinutes: number
  overtimeMinutes: number
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
  },
]

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function detectStampIn(clockIn: string, scheduledStart: string): StampInType {
  const inMin = timeToMinutes(clockIn)
  const startMin = timeToMinutes(scheduledStart)
  if (inMin < startMin) return '早出'
  if (inMin > startMin) return '遅刻'
  return '出勤'
}

function detectStampOut(clockOut: string, scheduledEnd: string): StampOutType {
  const outMin = timeToMinutes(clockOut)
  const endMin = timeToMinutes(scheduledEnd)
  if (outMin < endMin) return '早退'
  return '退勤'
}

function generateAttendance(employeeId: number, year: number, month: number): MockAttendanceDay[] {
  const emp = employees.find((e) => e.id === employeeId)
  const scheduledStart = emp?.scheduledStart ?? '09:00'
  const scheduledEnd = emp?.scheduledEnd ?? '18:00'

  const days: MockAttendanceDay[] = []
  const daysInMonth = new Date(year, month, 0).getDate()

  const holidayDays = emp?.holidayDays ?? [0, 6]

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dow = date.getDay()
    const isHoliday = holidayDays.includes(dow)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    if (isHoliday) {
      days.push({
        date: dateStr,
        clockIn: null,
        clockOut: null,
        stampIn: null,
        stampOut: null,
        goOut: null,
        goReturn: null,
        workMinutes: 0,
        overtimeMinutes: 0,
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

    const clockIn = `${String(baseInHour).padStart(2, '0')}:${String(baseInMin).padStart(2, '0')}`
    const clockOut = `${String(baseOutHour).padStart(2, '0')}:${String(baseOutMin).padStart(2, '0')}`

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

    const workStart = baseInHour * 60 + baseInMin
    const workEnd = baseOutHour * 60 + baseOutMin
    const breakMinutes = 60
    const totalWork = Math.max(0, workEnd - workStart - breakMinutes - goOutMinutes)
    const standardMinutes = 480
    const overtime = Math.max(0, totalWork - standardMinutes)

    days.push({
      date: dateStr,
      clockIn,
      clockOut,
      stampIn: detectStampIn(clockIn, scheduledStart),
      stampOut: detectStampOut(clockOut, scheduledEnd),
      goOut,
      goReturn,
      workMinutes: totalWork,
      overtimeMinutes: overtime,
      isHoliday: false,
      isHolidayWork: false,
      dataSource: day % 5 === 0 ? 'manual' : 'ipad',
    })
  }

  return days
}

function generatePayslips(year: number, month: number): MockPayslip[] {
  return employees.map((emp, idx) => {
    const attendance = generateAttendance(emp.id, year, month)
    const workDays = attendance.filter(d => !d.isHoliday && d.workMinutes > 0).length
    const totalWorkMinutes = attendance.reduce((sum, d) => sum + d.workMinutes, 0)
    const totalOvertimeMinutes = attendance.reduce((sum, d) => sum + d.overtimeMinutes, 0)
    const workHours = Math.round(totalWorkMinutes / 60 * 10) / 10
    const overtimeHours = Math.round(totalOvertimeMinutes / 60 * 10) / 10

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

    const incomeTax = Math.round(
      (totalPayment - emp.transportAllowance - premiums.healthInsurance - premiums.nursingInsurance - premiums.welfarePension - premiums.employmentInsurance) * 0.05,
    )

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
      holidayWorkDays: 0,
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

export function createPayslips(year: number, month: number): MockPayslip[] {
  const key = `${year}-${month}`
  const data = generatePayslips(year, month)
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
