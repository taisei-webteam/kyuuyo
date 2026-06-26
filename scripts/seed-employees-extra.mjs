// 追加従業員マスタ（ID 11〜30）投入スクリプト
// 実行: node --experimental-sqlite scripts/seed-employees-extra.mjs
//
// 既存(1〜10)と同じ給与規定パターンに沿って、役員/社員/パートを現実的な比率で追加する。
// 名前は日本人らしい仮名。ON CONFLICT(id) で冪等。

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const db = new DatabaseSync(path.join(process.env.APPDATA, 'rakuraku-kyuuyo-alpha', 'rakuraku-kyuuyo.db'))

// 社員/役員の既定スケジュール（09-18, 残業18-22）
const FT = { scheduledStart: '09:00', scheduledEnd: '18:00', overtimeAllowed: true, overtimeStart: '18:00', overtimeEnd: '22:00' }
// 早番系（08:30-17:30, 残業17:30-22:00, 早出07:30-08:15）
const EARLY = { scheduledStart: '08:30', scheduledEnd: '17:30', overtimeAllowed: true, overtimeStart: '17:30', overtimeEnd: '22:00', earlyWorkStart: '07:30', earlyWorkEnd: '08:15' }

// 部分指定。未指定は下の defaults で補完する。
const SPECS = [
  { id: 11, name: '小林 直樹', kana: 'コバヤシ ナオキ', type: '社員', dept: '営業部', title: '課長', birth: '1979-06-10', hire: '2011-04-01', basic: 360000, std: 460000, transport: 14000, position: 50000, family: 15000, sales: 30000, resident: 27000, dependents: 2, ...FT },
  { id: 12, name: '加藤 智子', kana: 'カトウ トモコ', type: '社員', dept: '経理部', title: '主任', birth: '1986-02-14', hire: '2014-04-01', basic: 290000, std: 360000, transport: 9000, position: 20000, resident: 19000, savings: 15000, dependents: 0, ...FT },
  { id: 13, name: '吉田 健', kana: 'ヨシダ ケン', type: '社員', dept: '技術部', title: '係長', birth: '1984-09-03', hire: '2012-04-01', basic: 330000, std: 410000, transport: 12000, position: 25000, family: 10000, special: 5000, resident: 22000, dependents: 1, ...FT, earlyWorkStart: '08:00', earlyWorkEnd: '08:45' },
  { id: 14, name: '山田 大樹', kana: 'ヤマダ ダイキ', type: '社員', dept: '営業部', title: '一般', birth: '1993-11-20', hire: '2016-04-01', basic: 270000, std: 340000, transport: 16000, sales: 20000, resident: 16000, dependents: 0, ...FT },
  { id: 15, name: '佐々木 麻衣', kana: 'ササキ マイ', type: '社員', dept: '総務部', title: '一般', birth: '1995-05-05', hire: '2018-04-01', basic: 260000, std: 320000, transport: 8000, resident: 15000, dependents: 0, ...FT },
  { id: 16, name: '山口 浩', kana: 'ヤマグチ ヒロシ', type: '社員', dept: '製造部', title: '主任', birth: '1981-03-28', hire: '2009-04-01', basic: 300000, std: 380000, transport: 7000, position: 25000, danger: 8000, resident: 20000, dependents: 2, ...EARLY },
  { id: 17, name: '松本 涼', kana: 'マツモト リョウ', type: '社員', dept: '技術部', title: '一般', birth: '1992-07-17', hire: '2015-10-01', basic: 280000, std: 350000, transport: 11000, special: 5000, resident: 17000, dependents: 1, ...FT },
  { id: 18, name: '井上 彩', kana: 'イノウエ アヤ', type: '社員', dept: '営業部', title: '一般', birth: '1996-10-09', hire: '2019-04-01', basic: 265000, std: 330000, transport: 13000, sales: 18000, resident: 16000, dependents: 0, ...FT },
  { id: 19, name: '木村 拓也', kana: 'キムラ タクヤ', type: '社員', dept: '倉庫部', title: '係長', birth: '1983-12-22', hire: '2010-09-01', basic: 310000, std: 380000, transport: 10000, position: 25000, danger: 5000, resident: 20000, dependents: 2, ...EARLY, earlyWorkStart: null, earlyWorkEnd: null },
  { id: 20, name: '林 さやか', kana: 'ハヤシ サヤカ', type: '社員', dept: '経理部', title: '一般', birth: '1997-04-01', hire: '2020-04-01', basic: 255000, std: 320000, transport: 9000, resident: 14000, dependents: 0, ...FT },
  { id: 21, name: '清水 健一', kana: 'シミズ ケンイチ', type: '役員', dept: '総務部', title: '取締役', birth: '1968-08-08', hire: '2006-04-01', basic: 480000, std: 560000, position: 90000, family: 10000, resident: 40000, dependents: 2, ...FT },
  { id: 22, name: '森 美里', kana: 'モリ ミサト', type: '社員', dept: '総務部', title: '課長', birth: '1980-01-30', hire: '2008-04-01', basic: 340000, std: 430000, transport: 12000, position: 45000, resident: 25000, dependents: 1, ...FT },
  { id: 23, name: '池田 駿', kana: 'イケダ シュン', type: '社員', dept: '製造部', title: '一般', birth: '1994-06-12', hire: '2017-04-01', basic: 275000, std: 340000, transport: 6000, danger: 8000, resident: 16000, dependents: 0, ...EARLY, earlyWorkStart: null, earlyWorkEnd: null },
  { id: 24, name: '橋本 紗', kana: 'ハシモト スズ', type: 'パート', dept: '製造部', title: '-', birth: '1990-09-19', hire: '2021-03-01', hourly: 1180, std: 200000, transport: 5000, danger: 3000, resident: 8000, dependents: 0, scheduledStart: '10:00', scheduledEnd: '16:00', holidayMode: 'individual' },
  { id: 25, name: '阿部 健太郎', kana: 'アベ ケンタロウ', type: 'パート', dept: '倉庫部', title: '-', birth: '1987-02-25', hire: '2020-11-01', hourly: 1120, std: 190000, transport: 4000, resident: 7000, dependents: 1, scheduledStart: '09:00', scheduledEnd: '15:00' },
  { id: 26, name: '石川 真央', kana: 'イシカワ マオ', type: 'パート', dept: '営業部', title: '事務', birth: '1991-11-11', hire: '2022-04-01', hourly: 1250, std: 210000, transport: 6000, resident: 9000, dependents: 0, scheduledStart: '09:00', scheduledEnd: '16:00' },
  { id: 27, name: '中島 翼', kana: 'ナカジマ ツバサ', type: '社員', dept: '技術部', title: '一般', birth: '1990-03-03', hire: '2014-10-01', basic: 285000, std: 350000, transport: 12000, special: 5000, resident: 17000, dependents: 0, ...FT },
  { id: 28, name: '前田 久美子', kana: 'マエダ クミコ', type: 'パート', dept: '総務部', title: '事務', birth: '1975-07-07', hire: '2019-06-01', hourly: 1300, std: 220000, transport: 7000, resident: 10000, dependents: 2, scheduledStart: '09:00', scheduledEnd: '16:00', holidayMode: 'individual' },
  { id: 29, name: '藤田 亮', kana: 'フジタ リョウ', type: '社員', dept: '営業部', title: '主任', birth: '1985-05-29', hire: '2011-10-01', basic: 305000, std: 380000, transport: 15000, position: 25000, sales: 22000, resident: 20000, dependents: 1, ...FT },
  { id: 30, name: '岡田 莉子', kana: 'オカダ リコ', type: 'パート', dept: '製造部', title: '-', birth: '1999-12-31', hire: '2023-04-01', hourly: 1100, std: 180000, transport: 3000, danger: 3000, resident: 6500, dependents: 0, scheduledStart: '10:00', scheduledEnd: '15:00' },
]

const insert = db.prepare(`
  INSERT INTO employees (
    id, name, name_kana, email, birth_date, employee_type, department_name, job_title, hire_date,
    display_order, basic_salary, hourly_rate, standard_monthly_remuneration,
    transport_allowance, position_allowance, family_allowance, special_allowance,
    danger_allowance, sales_allowance, health_insurance, welfare_pension, resident_tax,
    savings_deduction, loan_deduction, dependents, scheduled_start, scheduled_end, holiday_mode,
    early_work_start, early_work_end, overtime_allowed, overtime_start, overtime_end, is_active
  ) VALUES (
    @id, @name, @kana, @email, @birth, @type, @dept, @title, @hire,
    @id, @basic, @hourly, @std,
    @transport, @position, @family, @special,
    @danger, @sales, @health, @welfare, @resident,
    @savings, @loan, @dependents, @scheduledStart, @scheduledEnd, @holidayMode,
    @earlyWorkStart, @earlyWorkEnd, @overtimeAllowed, @overtimeStart, @overtimeEnd, 1
  )
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, name_kana=excluded.name_kana, email=excluded.email, birth_date=excluded.birth_date,
    employee_type=excluded.employee_type, department_name=excluded.department_name, job_title=excluded.job_title,
    hire_date=excluded.hire_date, display_order=excluded.display_order, basic_salary=excluded.basic_salary,
    hourly_rate=excluded.hourly_rate, standard_monthly_remuneration=excluded.standard_monthly_remuneration,
    transport_allowance=excluded.transport_allowance, position_allowance=excluded.position_allowance,
    family_allowance=excluded.family_allowance, special_allowance=excluded.special_allowance,
    danger_allowance=excluded.danger_allowance, sales_allowance=excluded.sales_allowance,
    health_insurance=excluded.health_insurance, welfare_pension=excluded.welfare_pension,
    resident_tax=excluded.resident_tax, savings_deduction=excluded.savings_deduction,
    loan_deduction=excluded.loan_deduction, dependents=excluded.dependents,
    scheduled_start=excluded.scheduled_start, scheduled_end=excluded.scheduled_end, holiday_mode=excluded.holiday_mode,
    early_work_start=excluded.early_work_start, early_work_end=excluded.early_work_end,
    overtime_allowed=excluded.overtime_allowed, overtime_start=excluded.overtime_start, overtime_end=excluded.overtime_end,
    is_active=1, updated_at=datetime('now','localtime')
`)

db.exec('BEGIN')
try {
  for (const s of SPECS) {
    const std = s.std
    const row = {
      id: s.id,
      name: s.name,
      kana: s.kana,
      email: `emp${s.id}@example.co.jp`,
      birth: s.birth,
      type: s.type,
      dept: s.dept,
      title: s.title,
      hire: s.hire,
      basic: s.basic ?? 0,
      hourly: s.hourly ?? 0,
      std,
      transport: s.transport ?? 0,
      position: s.position ?? 0,
      family: s.family ?? 0,
      special: s.special ?? 0,
      danger: s.danger ?? 0,
      sales: s.sales ?? 0,
      // 標準報酬月額ベースの概算（既存マスタと同じ感じ）。給与計算は別途自動算出。
      health: Math.round(std * 0.0492),
      welfare: Math.round(std * 0.0915),
      resident: s.resident ?? 0,
      savings: s.savings ?? 0,
      loan: s.loan ?? 0,
      dependents: s.dependents ?? 0,
      scheduledStart: s.scheduledStart,
      scheduledEnd: s.scheduledEnd,
      holidayMode: s.holidayMode ?? 'calendar',
      earlyWorkStart: s.earlyWorkStart ?? null,
      earlyWorkEnd: s.earlyWorkEnd ?? null,
      overtimeAllowed: s.overtimeAllowed ? 1 : 0,
      overtimeStart: s.overtimeStart ?? null,
      overtimeEnd: s.overtimeEnd ?? null,
    }
    insert.run(row)
  }
  db.exec('COMMIT')
} catch (err) {
  db.exec('ROLLBACK')
  throw err
}

const cnt = db.prepare('SELECT COUNT(*) c, SUM(is_active) act FROM employees').get()
console.log(`従業員追加完了。総数=${cnt.c} (active=${cnt.act})`)
const byType = db.prepare('SELECT employee_type t, COUNT(*) c FROM employees WHERE is_active=1 GROUP BY employee_type').all()
console.log('区分別:', JSON.stringify(byType))
db.close()
