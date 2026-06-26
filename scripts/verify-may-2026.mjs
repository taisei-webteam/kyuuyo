// 2026年5月の投入結果確認スクリプト
// 実行: node --experimental-sqlite scripts/verify-may-2026.mjs
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const db = new DatabaseSync(path.join(process.env.APPDATA, 'rakuraku-kyuuyo-alpha', 'rakuraku-kyuuyo.db'))

const raw = db
  .prepare(
    `SELECT employee_id AS eid, COUNT(*) AS days,
            SUM(CASE WHEN raw_go_out IS NOT NULL THEN 1 ELSE 0 END) AS goout
     FROM raw_punches WHERE date LIKE '2026-05%'
     GROUP BY employee_id ORDER BY employee_id`,
  )
  .all()
console.log('=== raw_punches (実打刻) 2026-05 ===')
console.table(raw)

const att = db
  .prepare(
    `SELECT employee_id AS eid, COUNT(*) AS days,
            SUM(work_minutes) AS workMin,
            SUM(overtime_minutes) AS otMin,
            SUM(early_overtime_minutes) AS earlyMin
     FROM attendance_records WHERE date LIKE '2026-05%'
     GROUP BY employee_id ORDER BY employee_id`,
  )
  .all()
  .map((r) => ({
    eid: r.eid,
    days: r.days,
    workH: Math.round((r.workMin / 60) * 10) / 10,
    otH: Math.round((r.otMin / 60) * 10) / 10,
    earlyH: Math.round((r.earlyMin / 60) * 10) / 10,
  }))
console.log('=== attendance_records (丸め後) 2026-05 ===')
if (att.length === 0) {
  console.log('（まだ空です。アプリの「一括丸め」を実行してください）')
} else {
  console.table(att)
}
db.close()
