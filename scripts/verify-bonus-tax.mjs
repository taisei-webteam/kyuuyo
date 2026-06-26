// 賞与の源泉徴収税額（算出率の表・甲欄／令和8年分）の検算。
// 1) 算出率表の内部整合性チェック
// 2) 既知ケースでの率・税額の照合
// 3) DB の従業員で「旧:一律10.21%」と「新:算出率表」を比較
// 実行: node --experimental-sqlite scripts/verify-bonus-tax.mjs

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

// --- 月額表ロジック（src/shared/income-tax-jp.ts と同一。特例フォールバック用） ---
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
function calcWithholdingTaxMonthly(a0, deps0) {
  const a = Math.max(0, Math.floor(a0))
  const deps = Math.max(0, Math.floor(deps0))
  const b = a - salaryIncomeDeduction(a) - DEPENDENT_DEDUCTION * deps - BASIC_DEDUCTION
  const raw = taxFromTaxableIncome(b)
  if (raw <= 0) return 0
  return Math.round(raw / 10) * 10
}

// --- 賞与算出率の表（src/shared/bonus-tax-jp.ts と同一） ---
const BONUS_RATES = [
  2.042, 4.084, 6.126, 8.168, 10.21, 12.252, 14.294, 16.336, 18.378, 20.42,
  22.462, 24.504, 26.546, 28.588, 30.63, 32.672, 35.735, 38.798, 41.861, 45.945,
]
const TH = [
  [82, 94, 260, 309, 342, 372, 402, 433, 520, 605, 684, 715, 752, 795, 854, 922, 1318, 1521, 2621, 3495],
  [107, 250, 289, 346, 373, 401, 430, 463, 520, 621, 705, 739, 778, 821, 882, 952, 1342, 1526, 2645, 3527],
  [143, 276, 321, 377, 400, 426, 457, 492, 525, 636, 728, 764, 804, 848, 910, 983, 1367, 1526, 2669, 3559],
  [181, 300, 354, 405, 424, 452, 484, 517, 550, 651, 751, 788, 830, 876, 938, 1013, 1391, 1538, 2693, 3590],
  [218, 300, 387, 431, 452, 477, 509, 540, 577, 666, 774, 813, 856, 903, 966, 1044, 1416, 1555, 2716, 3622],
  [251, 304, 412, 457, 479, 503, 531, 564, 604, 681, 798, 838, 881, 930, 994, 1074, 1440, 1555, 2740, 3654],
  [284, 343, 438, 483, 505, 527, 553, 589, 630, 697, 821, 862, 907, 957, 1022, 1104, 1464, 1555, 2764, 3685],
  [317, 383, 463, 508, 529, 552, 578, 614, 657, 708, 845, 887, 933, 985, 1051, 1135, 1489, 1583, 2788, 3717],
]
function getBonusTaxRate(prev0, deps0) {
  const col = Math.min(Math.max(Math.floor(deps0), 0), 7)
  const th = TH[col]
  const amount = Math.max(0, Math.floor(prev0))
  let rate = 0
  for (let i = 0; i < th.length; i++) {
    if (amount >= th[i] * 1000) rate = BONUS_RATES[i]
    else break
  }
  return rate
}
function calcBonusTax(bonus0, prev0, deps0, months = 6) {
  const bonus = Math.max(0, Math.floor(bonus0))
  const prev = Math.max(0, Math.floor(prev0))
  if (prev <= 0) return calcWithholdingTaxMonthly(bonus / months, deps0) * months
  if (bonus > prev * 10) {
    const tWith = calcWithholdingTaxMonthly(bonus / months + prev, deps0)
    const tPrev = calcWithholdingTaxMonthly(prev, deps0)
    return Math.max(0, (tWith - tPrev) * months)
  }
  const rate = getBonusTaxRate(prev, deps0)
  const rateMilli = Math.round(rate * 1000)
  return Math.floor((bonus * rateMilli) / 100000)
}

// --- 1) 内部整合性チェック ---
console.log('=== 算出率表の内部整合性 ===')
let structOk = TH.length === 8
for (let c = 0; c < TH.length; c++) {
  const col = TH[c]
  let mono = col.length === BONUS_RATES.length
  for (let i = 1; i < col.length; i++) if (col[i] <= col[i - 1]) mono = false
  if (!mono) structOk = false
  console.log(`  扶養${c === 7 ? '7+' : c}人: ${col.length}区分, 昇順=${mono ? 'OK' : 'NG'}`)
}
console.log(structOk ? '✅ 構造OK（8列×20区分・昇順）' : '❌ 構造NG')

// --- 2) 既知ケースの照合 ---
console.log('\n=== 既知ケースの率・税額照合 ===')
const cases = [
  { prev: 285454, deps: 3, bonus: 389558, expectRate: 2.042, expectTax: 7954 }, // 国税庁 No.2523 と同帯
  { prev: 81999, deps: 0, bonus: 500000, expectRate: 0, expectTax: 0 },
  { prev: 82000, deps: 0, bonus: 100000, expectRate: 2.042, expectTax: 2042 },
  { prev: 300000, deps: 4, bonus: 600000, expectRate: 4.084, expectTax: 24504 },
  { prev: 3500000, deps: 0, bonus: 1000000, expectRate: 45.945, expectTax: 459450 },
]
let caseOk = true
for (const c of cases) {
  const r = getBonusTaxRate(c.prev, c.deps)
  const t = calcBonusTax(c.bonus, c.prev, c.deps)
  const ok = r === c.expectRate && t === c.expectTax
  caseOk = caseOk && ok
  console.log(
    `  前月${c.prev} 扶養${c.deps}人 → 率${r}% (期待${c.expectRate}%), 賞与${c.bonus} → ${t}円 (期待${c.expectTax}円) ${ok ? 'OK' : 'NG'}`,
  )
}
console.log(caseOk ? '✅ 全ケース一致' : '❌ 不一致あり')

// --- 3) DB 従業員で旧/新比較（夏季・×2.0） ---
const RATES = { health: 0.04985, nursing: 0.008, pension: 0.0915, employment: 0.006 }
const roundIns = (a) => (a - Math.floor(a) <= 0.5 ? Math.floor(a) : Math.ceil(a))
function calcAge(b, base = new Date()) {
  const d = new Date(b)
  let a = base.getFullYear() - d.getFullYear()
  const md = base.getMonth() - d.getMonth()
  if (md < 0 || (md === 0 && base.getDate() < d.getDate())) a--
  return a
}

const db = new DatabaseSync(
  path.join(process.env.APPDATA, 'rakuraku-kyuuyo-alpha', 'rakuraku-kyuuyo.db'),
  { readOnly: true },
)

function bonusFor(empId) {
  const e = db
    .prepare(
      `SELECT name, employee_type AS type, birth_date AS birth, basic_salary AS basic,
        standard_monthly_remuneration AS std, transport_allowance AS transport, position_allowance AS position,
        family_allowance AS family, special_allowance AS special, danger_allowance AS danger,
        sales_allowance AS sales, dependents AS deps FROM employees WHERE id=?`,
    )
    .get(empId)
  if (!e) return null
  const basicBonus = Math.round(e.basic * 2.0)
  const performanceBonus = Math.round(e.basic * 0.3)
  const specialBonus = e.type === '役員' ? 100000 : 0
  const total = basicBonus + performanceBonus + specialBonus
  const age = calcAge(e.birth)
  const health = Math.round(total * RATES.health)
  const nursing = age >= 40 ? Math.round(total * RATES.nursing) : 0
  const pension = Math.round(total * RATES.pension)
  const employment = Math.round(total * RATES.employment)
  const social = health + nursing + pension + employment
  const bonusAfterSI = total - social

  const prevGross = e.basic + e.position + e.family + e.special + e.danger + e.sales
  const pHealth = roundIns(e.std * RATES.health)
  const pNursing = age >= 40 ? roundIns(e.std * RATES.nursing) : 0
  const pPension = roundIns(e.std * RATES.pension)
  const pEmp = Math.floor((prevGross + e.transport) * RATES.employment)
  const prevAfterSI = prevGross - (pHealth + pNursing + pPension + pEmp)

  const taxOld = Math.round(bonusAfterSI * 0.1021)
  const rate = getBonusTaxRate(prevAfterSI, e.deps)
  const taxNew = calcBonusTax(bonusAfterSI, prevAfterSI, e.deps)
  return { e, age, total, social, bonusAfterSI, prevAfterSI, rate, taxOld, taxNew }
}

console.log('\n=== DB従業員：賞与所得税 旧(一律10.21%) vs 新(算出率表) ===')
const ids = db.prepare('SELECT id FROM employees ORDER BY id').all().map((r) => r.id)
for (const id of ids) {
  const b = bonusFor(id)
  if (!b) continue
  if (b.e.type === 'パート') continue
  console.log(
    `id${id} ${b.e.name}(${b.e.type},${b.age}歳,扶養${b.e.deps}) 前月控後=${b.prevAfterSI} 賞与控後=${b.bonusAfterSI} 率=${b.rate}% 旧=${b.taxOld} 新=${b.taxNew} 差=${b.taxNew - b.taxOld}`,
  )
}
db.close()
