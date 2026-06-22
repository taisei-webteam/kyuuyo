/**
 * ローカル SQLite に丸めルールテスト用の打刻データを直接投入
 *
 * 対象従業員:
 *   ID=4 高橋大輔  定時 08:30  早出 07:30〜08:15
 *   ID=5 佐藤俊介  定時 09:00  早出 08:00〜08:45
 *   ID=1 藤原誠一  定時 09:00  早出なし
 *   ID=6 伊藤翔太  定時 10:00  早出なし（パート）
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const appName = 'rakuraku-kyuuyo-alpha';
let userDataDir;
if (process.platform === 'win32') {
  userDataDir = path.join(os.homedir(), 'AppData', 'Roaming', appName);
} else {
  userDataDir = path.join(os.homedir(), '.config', appName);
}

const dbPath = path.join(userDataDir, 'rakuraku-kyuuyo.db');

if (!fs.existsSync(dbPath)) {
  console.error(`DB ファイルが見つかりません: ${dbPath}`);
  console.error('先に Electron アプリを一度起動してください。');
  process.exit(1);
}

console.log(`DB: ${dbPath}\n`);
const db = new Database(dbPath);

// ── 1) 従業員マスタ投入 ──
console.log('1) 従業員マスタ投入...');

const empUpsert = db.prepare(`
  INSERT INTO employees (id, name, name_kana, email, birth_date, employee_type, department_name, job_title,
    hire_date, display_order, basic_salary, hourly_rate, standard_monthly_remuneration,
    transport_allowance, position_allowance, family_allowance, special_allowance,
    danger_allowance, sales_allowance, health_insurance, welfare_pension, resident_tax,
    savings_deduction, loan_deduction, dependents,
    scheduled_start, scheduled_end, holiday_mode, early_work_start, early_work_end, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, scheduled_start=excluded.scheduled_start,
    scheduled_end=excluded.scheduled_end, early_work_start=excluded.early_work_start,
    early_work_end=excluded.early_work_end, employee_type=excluded.employee_type,
    department_name=excluded.department_name, hourly_rate=excluded.hourly_rate,
    basic_salary=excluded.basic_salary, birth_date=excluded.birth_date,
    standard_monthly_remuneration=excluded.standard_monthly_remuneration
`);

const employees = [
  [1, '藤原 誠一', 'フジワラ セイイチ', 'fujiwara@example.co.jp', '1965-03-12', '役員', '総務部', '代表取締役', '2005-04-01', 1, 500000, 0, 620000, 0, 100000, 20000, 0, 0, 0, 29730, 56730, 45000, 0, 0, 2, '09:00', '18:00', 'calendar', null, null, 1],
  [2, '中村 健太', 'ナカムラ ケンタ', 'nakamura@example.co.jp', '1978-08-25', '社員', '営業部', '課長', '2010-04-01', 2, 350000, 0, 460000, 15000, 50000, 15000, 0, 0, 30000, 22610, 43155, 28000, 10000, 0, 1, '09:00', '18:00', 'calendar', null, null, 1],
  [3, '山本 裕子', 'ヤマモト ユウコ', 'yamamoto@example.co.jp', '1972-11-03', '役員', '総務部', '取締役', '2008-07-01', 3, 450000, 0, 540000, 10000, 80000, 0, 0, 0, 0, 26730, 51030, 38000, 20000, 0, 0, '09:00', '18:00', 'calendar', null, null, 1],
  [4, '高橋 大輔', 'タカハシ ダイスケ', 'takahashi@example.co.jp', '1988-05-20', '社員', '技術部', '主任', '2015-04-01', 4, 300000, 0, 380000, 12000, 30000, 15000, 10000, 5000, 0, 18810, 35910, 22000, 5000, 20000, 2, '08:30', '17:30', 'calendar', '07:30', '08:15', 1],
  [5, '佐藤 俊介', 'サトウ シュンスケ', 'sato@example.co.jp', '1990-01-15', '社員', '営業部', '係長', '2017-04-01', 5, 320000, 0, 410000, 18000, 20000, 10000, 0, 0, 25000, 20390, 38925, 24000, 0, 30000, 1, '09:00', '18:00', 'calendar', '08:00', '08:45', 1],
  [6, '伊藤 翔太', 'イトウ ショウタ', 'ito@example.co.jp', '1995-07-08', 'パート', '製造部', '-', '2020-06-01', 6, 0, 1200, 200000, 5000, 0, 0, 0, 3000, 0, 9900, 18900, 8000, 0, 0, 0, '10:00', '16:00', 'individual', null, null, 1],
  [7, '渡辺 美咲', 'ワタナベ ミサキ', 'watanabe@example.co.jp', '1998-12-01', 'パート', '製造部', '-', '2021-09-01', 7, 0, 1100, 180000, 3000, 0, 0, 0, 3000, 0, 8910, 17010, 6500, 0, 0, 0, '09:00', '15:00', 'calendar', null, null, 1],
  [8, '松田 浩二', 'マツダ コウジ', 'matsuda@example.co.jp', '1982-04-10', 'パート', '倉庫部', '-', '2022-01-15', 8, 0, 1150, 190000, 4000, 0, 0, 0, 0, 0, 9400, 17940, 7000, 0, 0, 1, '09:00', '16:00', 'individual', null, null, 1],
];

const txEmp = db.transaction(() => {
  for (const e of employees) {
    empUpsert.run(...e);
  }
});
txEmp();
console.log(`  ✓ ${employees.length} 名の従業員を登録\n`);

// ── 2) 2026年6月の打刻データを投入 ──
console.log('2) 打刻テストデータ投入 (2026年6月)...');

db.prepare("DELETE FROM attendance_records WHERE date LIKE '2026-06-%'").run();

const attUpsert = db.prepare(`
  INSERT INTO attendance_records (employee_id, date, clock_in, clock_out, data_source, work_minutes, overtime_minutes, early_overtime_minutes, break_minutes, is_holiday, is_holiday_work)
  VALUES (?, ?, ?, ?, 'ipad', 0, 0, 0, 60, 0, 0)
  ON CONFLICT(employee_id, date) DO UPDATE SET
    clock_in=excluded.clock_in, clock_out=excluded.clock_out, data_source='ipad'
`);

const punches = [
  // ═══ 高橋大輔 (ID=4): 定時08:30, 早出07:30〜08:15 ═══
  // 丸め前の生打刻を記録（丸め結果は勤怠画面で確認）
  [4, '2026-06-01', '07:20', '17:35'],  // 早出開始前 → 07:30
  [4, '2026-06-02', '07:42', '17:48'],  // 早出帯 → 07:30(15分切捨)
  [4, '2026-06-03', '07:30', '17:30'],  // 早出ぴったり → 07:30
  [4, '2026-06-04', '08:10', '18:05'],  // 早出帯 → 08:00(15分切捨)
  [4, '2026-06-05', '08:16', '17:30'],  // 休憩帯(早出後) → 08:30(定時)
  [4, '2026-06-08', '08:35', '17:30'],  // 猶予内 → 08:30(定時)
  [4, '2026-06-09', '08:40', '17:30'],  // 猶予ギリギリ → 08:30(定時)
  [4, '2026-06-10', '08:45', '17:30'],  // 遅刻 → 09:00(15分切上)
  [4, '2026-06-11', '08:50', '18:20'],  // 遅刻 → 09:00(15分切上)
  [4, '2026-06-12', '08:28', '17:44'],  // 猶予内 → 08:30, 退勤 → 17:30(切捨)

  // ═══ 佐藤俊介 (ID=5): 定時09:00, 早出08:00〜08:45 ═══
  [5, '2026-06-01', '07:55', '18:10'],  // 早出開始前 → 08:00
  [5, '2026-06-02', '08:22', '18:00'],  // 早出帯 → 08:15(15分切捨)
  [5, '2026-06-03', '08:48', '18:00'],  // 休憩帯 → 09:00(定時)
  [5, '2026-06-04', '09:05', '18:00'],  // 猶予内 → 09:00
  [5, '2026-06-05', '09:18', '18:00'],  // 遅刻 → 09:30(15分切上)

  // ═══ 藤原誠一 (ID=1): 定時09:00, 早出なし ═══
  [1, '2026-06-01', '08:45', '18:00'],  // 早め出勤 → 09:00(早出なし)
  [1, '2026-06-02', '09:00', '18:15'],  // ぴったり → 09:00
  [1, '2026-06-03', '09:08', '18:00'],  // 猶予内 → 09:00
  [1, '2026-06-04', '09:22', '18:00'],  // 遅刻 → 09:30(15分切上)

  // ═══ 伊藤翔太 (ID=6): パート 定時10:00, 早出なし ═══
  [6, '2026-06-01', '09:48', '16:05'],  // 早め出勤 → 10:00
  [6, '2026-06-02', '10:17', '16:00'],  // 遅刻 → 10:30(15分切上)
];

const txAtt = db.transaction(() => {
  for (const [empId, date, clockIn, clockOut] of punches) {
    attUpsert.run(empId, date, clockIn, clockOut);
  }
});
txAtt();
console.log(`  ✓ ${punches.length} 件の打刻データを登録\n`);

// ── 3) 確認 ──
const count = db.prepare("SELECT COUNT(*) as cnt FROM attendance_records WHERE date LIKE '2026-06-%'").get();
const empCount = db.prepare("SELECT COUNT(*) as cnt FROM employees").get();
console.log(`=== 完了 ===`);
console.log(`  従業員: ${empCount.cnt} 名`);
console.log(`  勤怠レコード (6月): ${count.cnt} 件`);

console.log('\n📋 テストパターン一覧:');
console.log('┌────────┬──────┬───────┬──────────────────────────────┐');
console.log('│ 従業員 │ 日付 │ 打刻  │ 丸め結果（期待値）           │');
console.log('├────────┼──────┼───────┼──────────────────────────────┤');
console.log('│ 高橋   │ 6/1  │ 07:20 │ → 07:30 早出(開始前切上げ)  │');
console.log('│ 高橋   │ 6/2  │ 07:42 │ → 07:30 早出(15分切捨て)    │');
console.log('│ 高橋   │ 6/3  │ 07:30 │ → 07:30 早出(ぴったり)      │');
console.log('│ 高橋   │ 6/4  │ 08:10 │ → 08:00 早出(15分切捨て)    │');
console.log('│ 高橋   │ 6/5  │ 08:16 │ → 08:30 通常(休憩帯→定時)   │');
console.log('│ 高橋   │ 6/8  │ 08:35 │ → 08:30 通常(猶予内→定時)   │');
console.log('│ 高橋   │ 6/9  │ 08:40 │ → 08:30 通常(猶予ギリギリ)  │');
console.log('│ 高橋   │ 6/10 │ 08:45 │ → 09:00 遅刻(15分切上げ)    │');
console.log('│ 高橋   │ 6/11 │ 08:50 │ → 09:00 遅刻(15分切上げ)    │');
console.log('│ 高橋   │ 6/12 │ 08:28 │ → 08:30 通常(猶予内)        │');
console.log('├────────┼──────┼───────┼──────────────────────────────┤');
console.log('│ 佐藤   │ 6/1  │ 07:55 │ → 08:00 早出(開始前切上げ)  │');
console.log('│ 佐藤   │ 6/2  │ 08:22 │ → 08:15 早出(15分切捨て)    │');
console.log('│ 佐藤   │ 6/3  │ 08:48 │ → 09:00 通常(休憩帯→定時)   │');
console.log('│ 佐藤   │ 6/4  │ 09:05 │ → 09:00 通常(猶予内)        │');
console.log('│ 佐藤   │ 6/5  │ 09:18 │ → 09:30 遅刻(15分切上げ)    │');
console.log('├────────┼──────┼───────┼──────────────────────────────┤');
console.log('│ 藤原   │ 6/1  │ 08:45 │ → 09:00 通常(早出なし)      │');
console.log('│ 藤原   │ 6/2  │ 09:00 │ → 09:00 通常(ぴったり)      │');
console.log('│ 藤原   │ 6/3  │ 09:08 │ → 09:00 通常(猶予内)        │');
console.log('│ 藤原   │ 6/4  │ 09:22 │ → 09:30 遅刻(15分切上げ)    │');
console.log('├────────┼──────┼───────┼──────────────────────────────┤');
console.log('│ 伊藤   │ 6/1  │ 09:48 │ → 10:00 通常(早出なし)      │');
console.log('│ 伊藤   │ 6/2  │ 10:17 │ → 10:30 遅刻(15分切上げ)    │');
console.log('└────────┴──────┴───────┴──────────────────────────────┘');

db.close();
