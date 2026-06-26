// 2026年5月の実打刻（raw_punches）テストデータ投入スクリプト（全従業員対応・汎用版）
// 実行: node --experimental-sqlite scripts/seed-may-2026.mjs
//
// DB の各従業員の定時/残業/早出設定を読み込み、区分に応じて現実的な実打刻を生成する:
//  - 社員/役員: 定時±数分。一部の日に程よい残業、早出設定者は早出。
//  - パート: 定時きっかり。曜日固定で週休（ID 由来）。残業許可があれば稀に残業。
// 投入後はアプリの「一括丸め」で attendance_records が生成され、給与作成で検証できる。
// ID 由来の擬似乱数で決まるため再現性あり。ON 既存5月データは掃除して冪等。

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const db = new DatabaseSync(path.join(process.env.APPDATA, 'rakuraku-kyuuyo-alpha', 'rakuraku-kyuuyo.db'))

const YEAR = 2026
const MONTH = 5
const HOLIDAYS = new Set([4, 5, 6]) // GWの平日祝日(みどり/こども/振替)

// 稼働日（平日かつ祝日でない日）
const workDays = []
const daysInMonth = new Date(YEAR, MONTH, 0).getDate()
for (let d = 1; d <= daysInMonth; d++) {
  const date = new Date(YEAR, MONTH - 1, d)
  const dow = date.getDay()
  if (dow === 0 || dow === 6) continue
  if (HOLIDAYS.has(d)) continue
  workDays.push({ d, dow, dateStr: `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
}

const toMin = (hhmm) => {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
const toHMS = (min) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

// ID 由来の決定的 PRNG（mulberry32）
function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const OT_OPTIONS = [60, 90, 90, 120, 120, 150] // 程よい残業（1〜2.5h、短め寄り）

const employees = db
  .prepare(
    `SELECT id, employee_type AS type, scheduled_start AS ss, scheduled_end AS se,
            early_work_start AS ews, early_work_end AS ewe, overtime_allowed AS ot, overtime_end AS oe
     FROM employees WHERE is_active = 1 ORDER BY id`,
  )
  .all()

// 既存5月データを掃除（冪等）
const monthLike = `${YEAR}-${String(MONTH).padStart(2, '0')}%`
db.prepare('DELETE FROM raw_punches WHERE date LIKE ?').run(monthLike)
db.prepare('DELETE FROM attendance_records WHERE date LIKE ?').run(monthLike)

const insert = db.prepare(`
  INSERT INTO raw_punches (employee_id, date, raw_clock_in, raw_clock_out, raw_go_out, raw_go_return, data_source, synced_at)
  VALUES (?, ?, ?, ?, ?, ?, 'ipad', datetime('now','localtime'))
`)

let count = 0
const perEmp = {}

db.exec('BEGIN')
try {
  for (const e of employees) {
    const rng = makeRng(e.id * 2654435761)
    const isPart = e.type === 'パート'
    const canOT = e.ot === 1
    const hasEarly = !!e.ews && !!e.ewe
    const otProb = e.type === '役員' ? 0.18 : isPart ? 0.15 : 0.33
    const skipDow = (e.id % 5) + 1 // パートの週休曜日(月〜金)
    const otCap = e.oe ? toMin(e.oe) : null
    perEmp[e.id] = 0

    for (const day of workDays) {
      // パートは固定曜日で週休
      if (isPart && day.dow === skipDow) continue
      // 社員/役員はごく稀に終日休(有給)
      if (!isPart && rng() < 0.02) continue

      let inMin
      let outMin
      let goOut = null
      let goReturn = null

      if (isPart) {
        inMin = toMin(e.ss)
        outMin = toMin(e.se)
        if (canOT && rng() < otProb) {
          outMin = Math.min(toMin(e.se) + OT_OPTIONS[Math.floor(rng() * OT_OPTIONS.length)], otCap ?? 22 * 60)
        }
      } else {
        // 早出（設定者のみ・一部の日）
        if (hasEarly && rng() < 0.3) {
          inMin = toMin(e.ews)
        } else {
          inMin = toMin(e.ss) - 5 // 定時5分前 → 丸めで定時扱い
        }
        // 退勤（通常は定時+2分→丸めで定時、残業日は後ろ倒し）
        if (canOT && rng() < otProb) {
          outMin = toMin(e.se) + OT_OPTIONS[Math.floor(rng() * OT_OPTIONS.length)]
          if (otCap) outMin = Math.min(outMin, otCap)
        } else {
          outMin = toMin(e.se) + 2
        }
        // 稀に外出
        if (rng() < 0.04) {
          goOut = '14:00:00'
          goReturn = '14:40:00'
        }
      }

      insert.run(e.id, day.dateStr, toHMS(inMin), toHMS(outMin), goOut, goReturn)
      count++
      perEmp[e.id]++
    }
  }
  db.exec('COMMIT')
} catch (err) {
  db.exec('ROLLBACK')
  throw err
}

console.log(`稼働日: ${workDays.length}日 (${workDays.map((w) => w.d).join(', ')})`)
console.log(`対象従業員: ${employees.length}名 / raw_punches 投入: ${count}件`)
console.log('従業員別件数:', JSON.stringify(perEmp))
db.close()
