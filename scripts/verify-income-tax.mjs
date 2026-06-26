// 源泉徴収税額（月額表・甲欄／電算特例・令和8年分以降）の検算と、
// id13/id20 の所得税を「旧:一律5%」と「新:税額表」で比較する。
// 実行: node --experimental-sqlite scripts/verify-income-tax.mjs

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

// --- 税額表ロジック（src/shared/income-tax-jp.ts と同一） ---
const BASIC_DEDUCTION = 48334
const DEPENDENT_DEDUCTION = 31667
function salaryIncomeDeduction(a) {
  if (a <= 158333) return 54167
  if (a <= 299999) return a * 0.3 + 6667
  if (a <= 549999) return a * 0.2 + 36667
  if (a <= 708330) return a * 0.1 + 91667
  return 162500
}
function taxFromTaxableIncome(b) {
  if (b <= 0) return 0
  if (b <= 162500) return b * 0.05105
  if (b <= 275000) return b * 0.1021 - 8296
  if (b <= 579166) return b * 0.2042 - 36374
  if (b <= 750000) return b * 0.23483 - 54113
  if (b <= 1500000) return b * 0.33693 - 130688
  if (b <= 3333333) return b * 0.4084 - 237893
  return b * 0.45945 - 408061
}
function calcWithholdingTaxMonthly(a0, dependents) {
  const a = Math.max(0, Math.floor(a0))
  const deps = Math.max(0, Math.floor(dependents))
  const b = a - salaryIncomeDeduction(a) - DEPENDENT_DEDUCTION * deps - BASIC_DEDUCTION
  const raw = taxFromTaxableIncome(b)
  if (raw <= 0) return 0
  return Math.round(raw / 10) * 10
}

// --- 国税庁 公式計算例での検算（令和8年分以降） ---
console.log('=== 国税庁 公式計算例の検算（令和8年分以降・甲欄） ===')
const cases = [
  { a: 175000, deps: 2, expect: 210 }, // 配偶者+親族1人
  { a: 446000, deps: 8, expect: 940 }, // 配偶者+親族7人
  { a: 775200, deps: 3, expect: 59470 }, // 配偶者+親族2人
]
let allOk = true
for (const c of cases) {
  const got = calcWithholdingTaxMonthly(c.a, c.deps)
  const ok = got === c.expect
  allOk = allOk && ok
  console.log(`  A=${c.a} 扶養等${c.deps}人 → ${got}円 (期待${c.expect}円) ${ok ? 'OK' : 'NG'}`)
}
console.log(allOk ? '✅ 全例一致' : '❌ 不一致あり')

// --- 社会保険料・年齢（mock-data と同一） ---
const RATES = { health: 0.04985, nursing: 0.008, pension: 0.0915, employment: 0.006 }
const roundIns = (a) => (a - Math.floor(a) <= 0.5 ? Math.floor(a) : Math.ceil(a))
function calcAge(b, base = new Date()) {
  const d = new Date(b); let a = base.getFullYear() - d.getFullYear()
  const md = base.getMonth() - d.getMonth()
  if (md < 0 || (md === 0 && base.getDate() < d.getDate())) a--
  return a
}

const db = new DatabaseSync(path.join(process.env.APPDATA, 'rakuraku-kyuuyo-alpha', 'rakuraku-kyuuyo.db'), { readOnly: true })

function aggregate(empId) {
  const rows = db.prepare("SELECT work_minutes AS wm, overtime_minutes AS ot, early_overtime_minutes AS eo, is_holiday AS hol, is_holiday_work AS hw FROM attendance_records WHERE employee_id=? AND date LIKE '2026-05%'").all(empId)
  let work = 0, otTotal = 0
  for (const r of rows) {
    work += r.wm
    otTotal += r.hw ? r.wm : r.ot + r.eo
  }
  return { workHours: Math.round(work / 60 * 10) / 10, overtimeHours: Math.round(otTotal / 60 * 10) / 10 }
}

function payslip(empId) {
  const e = db.prepare(`SELECT name, employee_type AS type, birth_date AS birth, basic_salary AS basic, hourly_rate AS hourly,
    standard_monthly_remuneration AS std, transport_allowance AS transport, position_allowance AS position,
    family_allowance AS family, special_allowance AS special, danger_allowance AS danger, sales_allowance AS sales,
    resident_tax AS resident, savings_deduction AS savings, loan_deduction AS loan, dependents AS deps FROM employees WHERE id=?`).get(empId)
  const agg = aggregate(empId)
  const regularHours = Math.max(0, agg.workHours - agg.overtimeHours)
  const isPart = e.type === 'パート'
  const hourly = isPart ? e.hourly : Math.round(e.basic / 160)
  const basic = isPart ? Math.round(hourly * regularHours) : e.basic
  const otPay = Math.round(hourly * 1.25 * agg.overtimeHours)
  const total = basic + otPay + e.transport + e.position + e.family + e.special + e.danger + e.sales
  const age = calcAge(e.birth)
  const health = roundIns(e.std * RATES.health)
  const nursing = age >= 40 ? roundIns(e.std * RATES.nursing) : 0
  const pension = roundIns(e.std * RATES.pension)
  const employment = Math.floor(total * RATES.employment)
  const socialTotal = health + nursing + pension + employment
  const a = total - e.transport - socialTotal
  const taxOld = Math.round(a * 0.05)
  const taxNew = calcWithholdingTaxMonthly(a, e.deps)
  return { e, agg, total, socialTotal, a, age, taxOld, taxNew,
    netOld: total - (socialTotal + taxOld + e.resident + e.savings + e.loan),
    netNew: total - (socialTotal + taxNew + e.resident + e.savings + e.loan) }
}

for (const id of [13, 20]) {
  const p = payslip(id)
  console.log(`\n=== id${id} ${p.e.name} (${p.e.type}, age=${p.age}, 扶養等${p.e.deps}人) ===`)
  console.log(`  労働${p.agg.workHours}h / 残業${p.agg.overtimeHours}h, 総支給=${p.total}, 社保計=${p.socialTotal}`)
  console.log(`  課税対象A(社保控除後)=${p.a}`)
  console.log(`  所得税: 旧(5%)=${p.taxOld}円  →  新(税額表)=${p.taxNew}円  (差 ${p.taxNew - p.taxOld}円)`)
  console.log(`  差引支給額: 旧=${p.netOld}  →  新=${p.netNew}`)
}
db.close()
