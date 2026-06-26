/**
 * ローカル開発用の初期データ投入 (seed)
 *
 * Renderer の mock-data.ts と同じ従業員 (id 1〜8) を SQLite に投入する。
 * これにより Supabase が無いローカル環境でも、勤怠 (attendance_records) の
 * 外部キー制約・丸め・給与作成への反映を一通り検証できる。
 *
 * 既に従業員が 1 件でも存在する場合は何もしない (冪等)。
 */
import type Database from 'better-sqlite3';

interface SeedEmployee {
  id: number;
  name: string;
  nameKana: string;
  email: string;
  birthDate: string;
  employeeType: string;
  departmentName: string;
  jobTitle: string;
  hireDate: string;
  displayOrder: number;
  basicSalary: number;
  hourlyRate: number;
  standardMonthlyRemuneration: number;
  transportAllowance: number;
  positionAllowance: number;
  familyAllowance: number;
  specialAllowance: number;
  dangerAllowance: number;
  salesAllowance: number;
  healthInsurance: number;
  welfarePension: number;
  residentTax: number;
  savingsDeduction: number;
  loanDeduction: number;
  dependents: number;
  scheduledStart: string;
  scheduledEnd: string;
  holidayMode: string;
  earlyWorkStart: string | null;
  earlyWorkEnd: string | null;
  overtimeAllowed: boolean;
  overtimeStart: string | null;
  overtimeEnd: string | null;
}

const SEED_EMPLOYEES: SeedEmployee[] = [
  { id: 1, name: '藤原 誠一', nameKana: 'フジワラ セイイチ', email: 'fujiwara@example.co.jp', birthDate: '1965-03-12', employeeType: '役員', departmentName: '総務部', jobTitle: '代表取締役', hireDate: '2005-04-01', displayOrder: 1, basicSalary: 500000, hourlyRate: 0, standardMonthlyRemuneration: 620000, transportAllowance: 0, positionAllowance: 100000, familyAllowance: 20000, specialAllowance: 0, dangerAllowance: 0, salesAllowance: 0, healthInsurance: 29730, welfarePension: 56730, residentTax: 45000, savingsDeduction: 0, loanDeduction: 0, dependents: 2, scheduledStart: '09:00', scheduledEnd: '18:00', holidayMode: 'calendar', earlyWorkStart: null, earlyWorkEnd: null, overtimeAllowed: true, overtimeStart: '18:00', overtimeEnd: '22:00' },
  { id: 2, name: '中村 健太', nameKana: 'ナカムラ ケンタ', email: 'nakamura@example.co.jp', birthDate: '1978-08-25', employeeType: '社員', departmentName: '営業部', jobTitle: '課長', hireDate: '2010-04-01', displayOrder: 2, basicSalary: 350000, hourlyRate: 0, standardMonthlyRemuneration: 460000, transportAllowance: 15000, positionAllowance: 50000, familyAllowance: 15000, specialAllowance: 0, dangerAllowance: 0, salesAllowance: 30000, healthInsurance: 22610, welfarePension: 43155, residentTax: 28000, savingsDeduction: 10000, loanDeduction: 0, dependents: 1, scheduledStart: '09:00', scheduledEnd: '18:00', holidayMode: 'calendar', earlyWorkStart: null, earlyWorkEnd: null, overtimeAllowed: true, overtimeStart: '18:00', overtimeEnd: '22:00' },
  { id: 3, name: '山本 裕子', nameKana: 'ヤマモト ユウコ', email: 'yamamoto@example.co.jp', birthDate: '1972-11-03', employeeType: '役員', departmentName: '総務部', jobTitle: '取締役', hireDate: '2008-07-01', displayOrder: 3, basicSalary: 450000, hourlyRate: 0, standardMonthlyRemuneration: 540000, transportAllowance: 10000, positionAllowance: 80000, familyAllowance: 0, specialAllowance: 0, dangerAllowance: 0, salesAllowance: 0, healthInsurance: 26730, welfarePension: 51030, residentTax: 38000, savingsDeduction: 20000, loanDeduction: 0, dependents: 0, scheduledStart: '09:00', scheduledEnd: '18:00', holidayMode: 'calendar', earlyWorkStart: null, earlyWorkEnd: null, overtimeAllowed: true, overtimeStart: '18:00', overtimeEnd: '22:00' },
  { id: 4, name: '高橋 大輔', nameKana: 'タカハシ ダイスケ', email: 'takahashi@example.co.jp', birthDate: '1988-05-20', employeeType: '社員', departmentName: '技術部', jobTitle: '主任', hireDate: '2015-04-01', displayOrder: 4, basicSalary: 300000, hourlyRate: 0, standardMonthlyRemuneration: 380000, transportAllowance: 12000, positionAllowance: 30000, familyAllowance: 15000, specialAllowance: 10000, dangerAllowance: 5000, salesAllowance: 0, healthInsurance: 18810, welfarePension: 35910, residentTax: 22000, savingsDeduction: 5000, loanDeduction: 20000, dependents: 2, scheduledStart: '08:30', scheduledEnd: '17:30', holidayMode: 'calendar', earlyWorkStart: '07:30', earlyWorkEnd: '08:15', overtimeAllowed: true, overtimeStart: '17:30', overtimeEnd: '22:00' },
  { id: 5, name: '佐藤 俊介', nameKana: 'サトウ シュンスケ', email: 'sato@example.co.jp', birthDate: '1990-01-15', employeeType: '社員', departmentName: '営業部', jobTitle: '係長', hireDate: '2017-04-01', displayOrder: 5, basicSalary: 320000, hourlyRate: 0, standardMonthlyRemuneration: 410000, transportAllowance: 18000, positionAllowance: 20000, familyAllowance: 10000, specialAllowance: 0, dangerAllowance: 0, salesAllowance: 25000, healthInsurance: 20390, welfarePension: 38925, residentTax: 24000, savingsDeduction: 0, loanDeduction: 30000, dependents: 1, scheduledStart: '09:00', scheduledEnd: '18:00', holidayMode: 'calendar', earlyWorkStart: '08:00', earlyWorkEnd: '08:45', overtimeAllowed: true, overtimeStart: '18:00', overtimeEnd: '22:00' },
  { id: 6, name: '伊藤 翔太', nameKana: 'イトウ ショウタ', email: 'ito@example.co.jp', birthDate: '1995-07-08', employeeType: 'パート', departmentName: '製造部', jobTitle: '-', hireDate: '2020-06-01', displayOrder: 6, basicSalary: 0, hourlyRate: 1200, standardMonthlyRemuneration: 200000, transportAllowance: 5000, positionAllowance: 0, familyAllowance: 0, specialAllowance: 0, dangerAllowance: 3000, salesAllowance: 0, healthInsurance: 9900, welfarePension: 18900, residentTax: 8000, savingsDeduction: 0, loanDeduction: 0, dependents: 0, scheduledStart: '10:00', scheduledEnd: '16:00', holidayMode: 'individual', earlyWorkStart: null, earlyWorkEnd: null, overtimeAllowed: false, overtimeStart: null, overtimeEnd: null },
  { id: 7, name: '渡辺 美咲', nameKana: 'ワタナベ ミサキ', email: 'watanabe@example.co.jp', birthDate: '1998-12-01', employeeType: 'パート', departmentName: '製造部', jobTitle: '-', hireDate: '2021-09-01', displayOrder: 7, basicSalary: 0, hourlyRate: 1100, standardMonthlyRemuneration: 180000, transportAllowance: 3000, positionAllowance: 0, familyAllowance: 0, specialAllowance: 0, dangerAllowance: 3000, salesAllowance: 0, healthInsurance: 8910, welfarePension: 17010, residentTax: 6500, savingsDeduction: 0, loanDeduction: 0, dependents: 0, scheduledStart: '09:00', scheduledEnd: '15:00', holidayMode: 'calendar', earlyWorkStart: null, earlyWorkEnd: null, overtimeAllowed: false, overtimeStart: null, overtimeEnd: null },
  { id: 8, name: '松田 浩二', nameKana: 'マツダ コウジ', email: 'matsuda@example.co.jp', birthDate: '1982-04-10', employeeType: 'パート', departmentName: '倉庫部', jobTitle: '-', hireDate: '2022-01-15', displayOrder: 8, basicSalary: 0, hourlyRate: 1150, standardMonthlyRemuneration: 190000, transportAllowance: 4000, positionAllowance: 0, familyAllowance: 0, specialAllowance: 0, dangerAllowance: 0, salesAllowance: 0, healthInsurance: 9400, welfarePension: 17940, residentTax: 7000, savingsDeduction: 0, loanDeduction: 0, dependents: 1, scheduledStart: '09:00', scheduledEnd: '16:00', holidayMode: 'individual', earlyWorkStart: null, earlyWorkEnd: null, overtimeAllowed: false, overtimeStart: null, overtimeEnd: null },
];

/**
 * employees テーブルが空の場合のみ、開発用の従業員データを投入する。
 */
export function seedEmployeesIfEmpty(raw: Database.Database): void {
  const row = raw.prepare('SELECT COUNT(*) AS count FROM employees').get() as { count: number };
  if (row.count > 0) return;

  const insert = raw.prepare(`
    INSERT INTO employees (
      id, name, name_kana, email, birth_date, employee_type, department_name, job_title, hire_date,
      display_order, basic_salary, hourly_rate, standard_monthly_remuneration,
      transport_allowance, position_allowance, family_allowance, special_allowance,
      danger_allowance, sales_allowance, health_insurance, welfare_pension, resident_tax,
      savings_deduction, loan_deduction, dependents, scheduled_start, scheduled_end, holiday_mode,
      early_work_start, early_work_end, overtime_allowed, overtime_start, overtime_end, is_active
    ) VALUES (
      @id, @name, @nameKana, @email, @birthDate, @employeeType, @departmentName, @jobTitle, @hireDate,
      @displayOrder, @basicSalary, @hourlyRate, @standardMonthlyRemuneration,
      @transportAllowance, @positionAllowance, @familyAllowance, @specialAllowance,
      @dangerAllowance, @salesAllowance, @healthInsurance, @welfarePension, @residentTax,
      @savingsDeduction, @loanDeduction, @dependents, @scheduledStart, @scheduledEnd, @holidayMode,
      @earlyWorkStart, @earlyWorkEnd, @overtimeAllowed, @overtimeStart, @overtimeEnd, 1
    )
  `);

  const tx = raw.transaction((rows: SeedEmployee[]) => {
    for (const e of rows) {
      insert.run({
        ...e,
        overtimeAllowed: e.overtimeAllowed ? 1 : 0,
      });
    }
  });
  tx(SEED_EMPLOYEES);
}
