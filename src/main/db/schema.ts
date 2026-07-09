/**
 * Drizzle ORM スキーマ定義 (SQLite)
 * らくらく給与明細α のデータベーススキーマの唯一のソース。
 */
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ========================================
// 会社情報
// ========================================

export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  representativeName: text('representative_name'),
  postalCode: text('postal_code'),
  address: text('address'),
  phone: text('phone'),
  insuranceNumber: text('insurance_number'),
  roundingUnit: integer('rounding_unit').notNull().default(15),
  gracePeriod: integer('grace_period').notNull().default(10),
  defaultBreakMinutes: integer('default_break_minutes').notNull().default(60),
  clockOutRounding: text('clock_out_rounding').notNull().default('down'),
  earlyRoundingUnit: integer('early_rounding_unit').notNull().default(15),
  overtimeRoundingUnit: integer('overtime_rounding_unit').notNull().default(15),
  // 月給者の時間外単価算定に用いる「1か月平均所定労働時間数」。
  // 割増賃金の基礎 = 基本給 ÷ この値（労基則19条準拠。会社ごとに設定）。
  monthlyWorkHours: real('monthly_work_hours').notNull().default(173.6),
  paidLeaveResetMonth: integer('paid_leave_reset_month'),
  paidLeavePolicy: text('paid_leave_policy'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// ========================================
// 従業員マスタ
// ========================================

export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nameKana: text('name_kana').notNull().default(''),
  email: text('email').notNull().default(''),
  birthDate: text('birth_date'),
  employeeType: text('employee_type').notNull().default('社員'),
  departmentName: text('department_name').notNull().default(''),
  jobTitle: text('job_title').notNull().default(''),
  hireDate: text('hire_date'),
  resignDate: text('resign_date'),
  displayOrder: integer('display_order').notNull().default(0),
  basicSalary: integer('basic_salary').notNull().default(0),
  hourlyRate: integer('hourly_rate').notNull().default(0),
  standardMonthlyRemuneration: integer('standard_monthly_remuneration').notNull().default(0),
  transportAllowance: integer('transport_allowance').notNull().default(0),
  // 通勤手当のうち課税対象額（非課税限度超過分）。0=全額非課税。
  taxableTransport: integer('taxable_transport').notNull().default(0),
  positionAllowance: integer('position_allowance').notNull().default(0),
  familyAllowance: integer('family_allowance').notNull().default(0),
  specialAllowance: integer('special_allowance').notNull().default(0),
  dangerAllowance: integer('danger_allowance').notNull().default(0),
  salesAllowance: integer('sales_allowance').notNull().default(0),
  healthInsurance: integer('health_insurance').notNull().default(0),
  welfarePension: integer('welfare_pension').notNull().default(0),
  residentTax: integer('resident_tax').notNull().default(0),
  savingsDeduction: integer('savings_deduction').notNull().default(0),
  loanDeduction: integer('loan_deduction').notNull().default(0),
  dependents: integer('dependents').notNull().default(0),
  scheduledStart: text('scheduled_start').notNull().default('09:00'),
  scheduledEnd: text('scheduled_end').notNull().default('18:00'),
  holidayMode: text('holiday_mode').notNull().default('calendar'),
  earlyWorkStart: text('early_work_start'),
  earlyWorkEnd: text('early_work_end'),
  overtimeAllowed: integer('overtime_allowed', { mode: 'boolean' }).notNull().default(true),
  overtimeStart: text('overtime_start'),
  overtimeEnd: text('overtime_end'),
  bonusEligible: integer('bonus_eligible', { mode: 'boolean' }).notNull().default(false),
  /** 雇用保険料超過分（支給項目）。雇用保険控除の算定基数には含めない。 */
  employmentInsuranceOverage: integer('employment_insurance_overage').notNull().default(0),
  paidLeaveBalance: real('paid_leave_balance'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// ========================================
// 実打刻データ (Supabase同期の生データ)
// ========================================

export const rawPunches = sqliteTable('raw_punches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  date: text('date').notNull(),
  rawClockIn: text('raw_clock_in'),
  rawClockOut: text('raw_clock_out'),
  dataSource: text('data_source').notNull().default('ipad'),
  syncedAt: text('synced_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// ========================================
// 勤怠レコード (日次・丸め後)
// ========================================

export const attendanceRecords = sqliteTable('attendance_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  date: text('date').notNull(),
  clockIn: text('clock_in'),
  clockOut: text('clock_out'),
  goOut: text('go_out'),
  goReturn: text('go_return'),
  workMinutes: integer('work_minutes').notNull().default(0),
  overtimeMinutes: integer('overtime_minutes').notNull().default(0),
  earlyOvertimeMinutes: integer('early_overtime_minutes').notNull().default(0),
  breakMinutes: integer('break_minutes').notNull().default(60),
  isHoliday: integer('is_holiday', { mode: 'boolean' }).notNull().default(false),
  isHolidayWork: integer('is_holiday_work', { mode: 'boolean' }).notNull().default(false),
  paidLeaveUsage: text('paid_leave_usage'),
  paidLeaveStatus: text('paid_leave_status'),
  dataSource: text('data_source').notNull().default('manual'),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// ========================================
// 給与明細ヘッダ
// ========================================

export const payslips = sqliteTable('payslips', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  paymentDate: text('payment_date'),
  payslipType: text('payslip_type').notNull().default('salary'),
  bonusSeason: text('bonus_season'),
  workDays: integer('work_days').notNull().default(0),
  workHours: real('work_hours').notNull().default(0),
  overtimeHours: real('overtime_hours').notNull().default(0),
  holidayWorkDays: integer('holiday_work_days').notNull().default(0),
  paidLeaveDays: real('paid_leave_days').notNull().default(0),
  basicSalary: integer('basic_salary').notNull().default(0),
  overtimePay: integer('overtime_pay').notNull().default(0),
  transportAllowance: integer('transport_allowance').notNull().default(0),
  positionAllowance: integer('position_allowance').notNull().default(0),
  familyAllowance: integer('family_allowance').notNull().default(0),
  specialAllowance: integer('special_allowance').notNull().default(0),
  dangerAllowance: integer('danger_allowance').notNull().default(0),
  salesAllowance: integer('sales_allowance').notNull().default(0),
  otherAllowance: integer('other_allowance').notNull().default(0),
  extraPaymentLines: text('extra_payment_lines').notNull().default('[]'),
  extraDeductionLines: text('extra_deduction_lines').notNull().default('[]'),
  totalPayment: integer('total_payment').notNull().default(0),
  healthInsurance: integer('health_insurance').notNull().default(0),
  nursingInsurance: integer('nursing_insurance').notNull().default(0),
  welfarePension: integer('welfare_pension').notNull().default(0),
  employmentInsurance: integer('employment_insurance').notNull().default(0),
  incomeTax: integer('income_tax').notNull().default(0),
  residentTax: integer('resident_tax').notNull().default(0),
  savingsDeduction: integer('savings_deduction').notNull().default(0),
  loanDeduction: integer('loan_deduction').notNull().default(0),
  otherDeduction: integer('other_deduction').notNull().default(0),
  totalDeduction: integer('total_deduction').notNull().default(0),
  netPayment: integer('net_payment').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// ========================================
// 源泉徴収税額表
// ========================================

export const taxTables = sqliteTable('tax_tables', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  year: integer('year').notNull(),
  salaryFrom: integer('salary_from').notNull(),
  salaryTo: integer('salary_to').notNull(),
  dependents: integer('dependents').notNull(),
  taxColumn: text('tax_column').notNull().default('A'),
  taxAmount: integer('tax_amount').notNull(),
});

// ========================================
// 社会保険料率マスタ
// ========================================

export const insuranceRates = sqliteTable('insurance_rates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  year: integer('year').notNull(),
  month: integer('month').notNull().default(4),
  healthRate: real('health_rate').notNull(),
  nursingRate: real('nursing_rate').notNull(),
  pensionRate: real('pension_rate').notNull(),
  employmentRate: real('employment_rate').notNull(),
  prefecture: text('prefecture').notNull().default('全国'),
});

// ========================================
// 勤務パターン
// ========================================

export const workSchedules = sqliteTable('work_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  startTime: text('start_time').notNull().default('09:00'),
  endTime: text('end_time').notNull().default('18:00'),
  breakMinutes: integer('break_minutes').notNull().default(60),
  scheduledMinutes: integer('scheduled_minutes').notNull().default(480),
});

// ========================================
// 会社カレンダー
// ========================================

export const companyCalendar = sqliteTable('company_calendar', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  isHoliday: integer('is_holiday', { mode: 'boolean' }).notNull().default(false),
  holidayName: text('holiday_name'),
});

// ========================================
// 打刻取り込み履歴
// ========================================

export const attendanceImports = sqliteTable('attendance_imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  importedAt: text('imported_at').notNull().default(sql`(datetime('now','localtime'))`),
  source: text('source').notNull().default('supabase'),
  recordCount: integer('record_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  yearMonth: text('year_month').notNull(),
});

// ========================================
// メール送信履歴
// ========================================

export const emailLogs = sqliteTable('email_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  // 'payslip' | 'bonus'
  type: text('type').notNull(),
  // 期間キー（例: 'payslip-2026-5' / 'bonus-2026-夏季'）
  periodKey: text('period_key').notNull(),
  toAddress: text('to_address'),
  sentAt: text('sent_at').notNull().default(sql`(datetime('now','localtime'))`),
});
