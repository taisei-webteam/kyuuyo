import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
const empId = Number(process.argv[2] ?? 13)
const db = new DatabaseSync(path.join(process.env.APPDATA, 'rakuraku-kyuuyo-alpha', 'rakuraku-kyuuyo.db'), { readOnly: true })
const rp = db.prepare("SELECT COUNT(*) c FROM raw_punches WHERE employee_id=? AND date LIKE '2026-05%'").get(empId)
const at = db.prepare("SELECT COUNT(*) c, SUM(work_minutes) w, SUM(overtime_minutes) o, SUM(early_overtime_minutes) e, SUM(is_holiday) h, SUM(is_holiday_work) hw FROM attendance_records WHERE employee_id=? AND date LIKE '2026-05%'").get(empId)
console.log('raw_punches:', rp)
console.log('attendance(sum):', at)
console.log('attendance rows:')
console.table(db.prepare("SELECT date, clock_in, clock_out, work_minutes AS wm, overtime_minutes AS ot, early_overtime_minutes AS eo, is_holiday AS hol, is_holiday_work AS hw FROM attendance_records WHERE employee_id=? AND date LIKE '2026-05%' ORDER BY date").all(empId))
const ps = db.prepare("SELECT period_year AS y, period_month AS m, work_days AS wd, work_hours AS wh, overtime_hours AS oh, holiday_work_days AS hwd, overtime_pay AS op, total_payment AS tp, net_payment AS np FROM payslips WHERE employee_id=? AND period_year=2026 AND period_month=5").get(empId)
console.log('payslip:', ps)
db.close()
