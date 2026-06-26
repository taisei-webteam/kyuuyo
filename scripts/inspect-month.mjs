import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
const db = new DatabaseSync(path.join(process.env.APPDATA, 'rakuraku-kyuuyo-alpha', 'rakuraku-kyuuyo.db'), { readOnly: true })
const total = db.prepare("SELECT COUNT(*) c FROM attendance_records WHERE date LIKE '2026-05%'").get()
console.log('attendance_records (2026-05) total rows:', total.c)
console.log('per employee:')
console.table(db.prepare("SELECT employee_id AS id, COUNT(*) days, SUM(overtime_minutes) ot, SUM(early_overtime_minutes) early, SUM(is_holiday_work) hw FROM attendance_records WHERE date LIKE '2026-05%' GROUP BY employee_id ORDER BY employee_id").all())
const rpTotal = db.prepare("SELECT COUNT(*) c FROM raw_punches WHERE date LIKE '2026-05%'").get()
console.log('raw_punches (2026-05) total rows:', rpTotal.c)
db.close()
