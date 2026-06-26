// 検証用: 早出＋休日出勤の残業反映を確認するための制御データを1名に投入し、
// アプリと同じ式で期待値を独立に算出して表示する。
// 実行: node --experimental-sqlite scripts/seed-verify-early-holiday.mjs [empId=13]
//
// 投入後、アプリで「勤怠管理→2026年5月→一括丸め→給与作成→作成」を実行し、
// 対象従業員の明細が本スクリプトの期待値と一致するか確認する。

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const empId = Number(process.argv[2] ?? 13)
const db = new DatabaseSync(path.join(process.env.APPDATA, 'rakuraku-kyuuyo-alpha', 'rakuraku-kyuuyo.db'))

const YEAR = 2026
const MONTH = 5
const HOLIDAY_WORK_DATE = '2026-05-16' // 土曜（休日出勤テスト）

// --- 会社設定（無ければ既定） ---
const co = db.prepare('SELECT rounding_unit AS ru, grace_period AS gp, default_break_minutes AS br, early_rounding_unit AS eru FROM companies LIMIT 1').get()
const RU = co?.ru ?? 15
const GP = co?.gp ?? 10
const BR = co?.br ?? 60
const ERU = co?.eru ?? 15

// --- 計算式（時間丸め・社保・所得税：アプリと同一） ---
const toMin = (t) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m }
const toHMS = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`
const floorU = (m, u) => (u <= 0 ? m : Math.floor(m / u) * u)
const ceilU = (m, u) => Math.ceil(m / u) * u

function roundClockIn(raw, ss, ews, ewe) {
  const r = toMin(raw), sched = toMin(ss)
  const hasEarly = ews && ewe
  if (hasEarly) {
    const es = toMin(ews), ee = toMin(ewe)
    if (r < es) return ews
    if (r >= es && r <= ee) return toHMS(floorU(r, RU))
    if (r > ee && r < sched) return ss
  } else if (r < sched) {
    return ss
  }
  if (r >= sched && r <= sched + GP) return ss
  return toHMS(ceilU(r, RU))
}
const roundClockOut = (raw) => toHMS(floorU(toMin(raw), RU))
function calcEarly(raw, ews, ewe) {
  if (!ews || !ewe) return 0
  const r = toMin(raw), es = toMin(ews), ee = toMin(ewe)
  if (r < es || r >= ee) return 0
  return floorU(ee - r, ERU)
}
const RATES = { health: 0.04985, nursing: 0.008, pension: 0.0915, employment: 0.006 }
const roundIns = (a) => (a - Math.floor(a) <= 0.5 ? Math.floor(a) : Math.ceil(a))
const calcAge = (b, base = new Date()) => { const d = new Date(b); let a = base.getFullYear() - d.getFullYear(); const md = base.getMonth() - d.getMonth(); if (md < 0 || (md === 0 && base.getDate() < d.getDate())) a--; return a }

const e = db.prepare(`
  SELECT name, employee_type AS type, birth_date AS birth, basic_salary AS basic, hourly_rate AS hourly,
         standard_monthly_remuneration AS std, transport_allowance AS transport, position_allowance AS position,
         family_allowance AS family, special_allowance AS special, danger_allowance AS danger, sales_allowance AS sales,
         resident_tax AS resident, savings_deduction AS savings, loan_deduction AS loan,
         scheduled_start AS ss, scheduled_end AS se, early_work_start AS ews, early_work_end AS ewe,
         overtime_allowed AS ot, overtime_start AS os, overtime_end AS oe
  FROM employees WHERE id=?
`).get(empId)
if (!e) { console.error(`employee id=${empId} not found`); db.close(); process.exit(1) }

// --- 制御打刻の定義 ---
const HOLIDAYS = new Set([4, 5, 6])
const weekdays = []
const dim = new Date(YEAR, MONTH, 0).getDate()
for (let d = 1; d <= dim; d++) {
  const dow = new Date(YEAR, MONTH - 1, d).getDay()
  if (dow === 0 || dow === 6 || HOLIDAYS.has(d)) continue
  weekdays.push(`${YEAR}-05-${String(d).padStart(2, '0')}`)
}
// 先頭4日を早出(08:00出勤)、残りは通常(定時5分前)。退勤は定時2分後。
const earlyDates = new Set(weekdays.slice(0, 4))
const normalIn = toHMS(toMin(e.ss) - 5)
const normalOut = toHMS(toMin(e.se) + 2)
const earlyIn = e.ews ? toHMS(toMin(e.ews)) : normalIn

const punches = []
for (const date of weekdays) {
  punches.push({ date, in: earlyDates.has(date) ? earlyIn : normalIn, out: normalOut })
}
// 休日出勤: 土曜 09:00→16:00
punches.push({ date: HOLIDAY_WORK_DATE, in: '09:00:00', out: '16:00:00' })

// --- DB投入（当該社員の5月を掃除して制御打刻を投入） ---
db.exec('BEGIN')
try {
  db.prepare('DELETE FROM raw_punches WHERE employee_id=? AND date LIKE ?').run(empId, `${YEAR}-05%`)
  db.prepare('DELETE FROM attendance_records WHERE employee_id=? AND date LIKE ?').run(empId, `${YEAR}-05%`)
  const ins = db.prepare(`INSERT INTO raw_punches (employee_id, date, raw_clock_in, raw_clock_out, raw_go_out, raw_go_return, data_source, synced_at)
    VALUES (?, ?, ?, ?, NULL, NULL, 'ipad', datetime('now','localtime'))`)
  for (const p of punches) ins.run(empId, p.date, p.in, p.out)
  db.exec('COMMIT')
} catch (err) { db.exec('ROLLBACK'); throw err }

// --- 期待値の独立算出（丸め→集計→給与） ---
let totalWork = 0, totalOT = 0, workDays = 0, holidayWorkDays = 0
for (const p of punches) {
  const isHoliday = p.date === HOLIDAY_WORK_DATE // 土曜
  const ci = roundClockIn(p.in, e.ss, e.ews, e.ewe)
  const co2 = roundClockOut(p.out)
  let work = 0, ot = 0, early = 0
  if (isHoliday) {
    work = Math.max(0, toMin(co2) - toMin(ci) - BR)
    ot = work
    holidayWorkDays++
  } else {
    let endM = toMin(co2)
    if (!e.ot) endM = Math.min(endM, toMin(e.se))
    else if (e.oe) endM = Math.min(endM, toMin(e.oe))
    work = Math.max(0, endM - toMin(ci) - BR)
    early = calcEarly(p.in, e.ews, e.ewe)
    if (!e.ot) ot = 0
    else if (e.os) ot = Math.max(0, (e.oe ? Math.min(toMin(co2), toMin(e.oe)) : toMin(co2)) - toMin(e.os))
    else ot = Math.max(0, work - (toMin(e.se) - toMin(e.ss) - BR))
    if (work > 0) workDays++
  }
  totalWork += work
  totalOT += isHoliday ? work : ot + early
}
const workHours = Math.round((totalWork / 60) * 10) / 10
const overtimeHours = Math.round((totalOT / 60) * 10) / 10
const regularHours = Math.max(0, workHours - overtimeHours)
const isPart = e.type === 'パート'
const hourlyRate = isPart ? e.hourly : Math.round(e.basic / 160)
const basicSalary = isPart ? Math.round(hourlyRate * regularHours) : e.basic
const overtimePay = Math.round(hourlyRate * 1.25 * overtimeHours)
const totalPayment = basicSalary + overtimePay + e.transport + e.position + e.family + e.special + e.danger + e.sales
const age = calcAge(e.birth)
const health = roundIns(e.std * RATES.health)
const nursing = age >= 40 ? roundIns(e.std * RATES.nursing) : 0
const pension = roundIns(e.std * RATES.pension)
const employment = Math.floor(totalPayment * RATES.employment)
const incomeTax = Math.round((totalPayment - e.transport - health - nursing - pension - employment) * 0.05)
const totalDeduction = health + nursing + pension + employment + incomeTax + e.resident + e.savings + e.loan
const net = totalPayment - totalDeduction

console.log(`=== 検証対象: ${e.name} (id=${empId}, ${e.type}, age=${age}) ===`)
console.log(`会社設定: 丸め${RU}分/猶予${GP}分/休憩${BR}分/早出丸め${ERU}分`)
console.log(`投入: 平日${weekdays.length}日(うち早出${earlyDates.size}日 ${earlyIn}) + 休日出勤1日(${HOLIDAY_WORK_DATE} 09:00-16:00)`)
console.log('--- 期待される集計 ---')
console.table({ 出勤日数: workDays, 休日出勤日数: holidayWorkDays, 労働時間h: workHours, 残業時間h: overtimeHours, 通常h: regularHours })
console.log('--- 期待される給与明細 ---')
console.table({
  基本給: basicSalary, 残業手当: overtimePay, 通勤手当: e.transport, 役職手当: e.position, 家族手当: e.family, 特別手当: e.special,
  総支給額: totalPayment, 健康保険: health, 介護保険: nursing, 厚生年金: pension, 雇用保険: employment,
  所得税: incomeTax, 住民税: e.resident, 控除合計: totalDeduction, 差引支給額: net,
})
db.close()
