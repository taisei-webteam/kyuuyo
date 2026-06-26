// 検証用: 月給者1名の2026年5月を「残業0・通常勤務18日」に整え、期待される給与を算出する。
// 実行: node --experimental-sqlite scripts/seed-clean-salaried.mjs [empId]
//   既定 empId = 20 (林 さやか / 09-18, 40歳未満で介護保険なし, 手当最小)
//
// 月給者で残業0なら給与額はマスタのみで決まる（出勤日数/労働時間に依存しない）。
// 本スクリプトはアプリと同じ計算式で期待値を出力するので、画面/PDFと突き合わせて検証できる。

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const empId = Number(process.argv[2] ?? 20)
const db = new DatabaseSync(path.join(process.env.APPDATA, 'rakuraku-kyuuyo-alpha', 'rakuraku-kyuuyo.db'))

const YEAR = 2026
const MONTH = 5
const HOLIDAYS = new Set([4, 5, 6])

// --- 計算式（mock-data.ts と同一） ---
const RATES = { health: 0.04985, nursing: 0.008, pension: 0.0915, employment: 0.006 }
const roundInsurance = (a) => (a - Math.floor(a) <= 0.5 ? Math.floor(a) : Math.ceil(a))
const calcAge = (birth, base = new Date()) => {
  const b = new Date(birth)
  let age = base.getFullYear() - b.getFullYear()
  const md = base.getMonth() - b.getMonth()
  if (md < 0 || (md === 0 && base.getDate() < b.getDate())) age--
  return age
}

const toMin = (hhmm) => {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
const toHMS = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`

const e = db
  .prepare(
    `SELECT id, name, employee_type AS type, birth_date AS birth,
            basic_salary AS basic, hourly_rate AS hourly, standard_monthly_remuneration AS std,
            transport_allowance AS transport, position_allowance AS position, family_allowance AS family,
            special_allowance AS special, danger_allowance AS danger, sales_allowance AS sales,
            resident_tax AS resident, savings_deduction AS savings, loan_deduction AS loan,
            scheduled_start AS ss, scheduled_end AS se
     FROM employees WHERE id = ?`,
  )
  .get(empId)

if (!e) {
  console.error(`employee id=${empId} not found`)
  db.close()
  process.exit(1)
}

// 稼働日（平日・祝日除外）
const workDays = []
const dim = new Date(YEAR, MONTH, 0).getDate()
for (let d = 1; d <= dim; d++) {
  const dow = new Date(YEAR, MONTH - 1, d).getDay()
  if (dow === 0 || dow === 6 || HOLIDAYS.has(d)) continue
  workDays.push(`${YEAR}-${String(MONTH).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
}

// 当該社員の5月を掃除して、残業0の通常勤務(定時5分前出勤・定時2分後退勤)を投入
const inT = toHMS(toMin(e.ss) - 5)
const outT = toHMS(toMin(e.se) + 2)
db.exec('BEGIN')
try {
  db.prepare('DELETE FROM raw_punches WHERE employee_id=? AND date LIKE ?').run(empId, `${YEAR}-05%`)
  db.prepare('DELETE FROM attendance_records WHERE employee_id=? AND date LIKE ?').run(empId, `${YEAR}-05%`)
  const ins = db.prepare(`
    INSERT INTO raw_punches (employee_id, date, raw_clock_in, raw_clock_out, raw_go_out, raw_go_return, data_source, synced_at)
    VALUES (?, ?, ?, ?, NULL, NULL, 'ipad', datetime('now','localtime'))
  `)
  for (const date of workDays) ins.run(empId, date, inT, outT)
  db.exec('COMMIT')
} catch (err) {
  db.exec('ROLLBACK')
  throw err
}

// --- 期待値（残業0前提） ---
const isPart = e.type === 'パート'
const age = calcAge(e.birth)
const workHours = workDays.length * 8 // 09-18/休憩60 = 8h
const overtimeHours = 0
const regularHours = workHours
const basicSalary = isPart ? Math.round(e.hourly * regularHours) : e.basic
const overtimePay = 0
const totalPayment = basicSalary + overtimePay + e.transport + e.position + e.family + e.special + e.danger + e.sales
const health = roundInsurance(e.std * RATES.health)
const nursing = age >= 40 ? roundInsurance(e.std * RATES.nursing) : 0
const pension = roundInsurance(e.std * RATES.pension)
const employment = Math.floor(totalPayment * RATES.employment)
const incomeTax = Math.round((totalPayment - e.transport - health - nursing - pension - employment) * 0.05)
const totalDeduction = health + nursing + pension + employment + incomeTax + e.resident + e.savings + e.loan
const net = totalPayment - totalDeduction

console.log(`=== 検証対象: ${e.name} (id=${e.id}, ${e.type}, age=${age}) ===`)
console.log(`5月: 通常勤務 ${workDays.length}日 / 残業0 を投入しました（出勤=${inT}→退勤=${outT}）`)
console.log('--- マスタ ---')
console.log(`基本給=${e.basic} 標準報酬=${e.std} 通勤=${e.transport} 役職=${e.position} 家族=${e.family} 住民税=${e.resident}`)
console.log('--- 期待される給与明細（残業0） ---')
console.table({
  出勤日数: workDays.length,
  労働時間h: workHours,
  残業時間h: overtimeHours,
  基本給: basicSalary,
  残業手当: overtimePay,
  通勤手当: e.transport,
  総支給額: totalPayment,
  健康保険: health,
  介護保険: nursing,
  厚生年金: pension,
  雇用保険: employment,
  所得税: incomeTax,
  住民税: e.resident,
  控除合計: totalDeduction,
  差引支給額: net,
})
db.close()
