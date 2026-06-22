/**
 * Supabase に2026年5月の1ヶ月分フル打刻データを投入
 * 全8名の従業員について、平日の出退勤データを生成する
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabasePost(table, body, upsert = false) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: upsert ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${table} POST failed ${res.status}: ${text}`);
  }
}

async function supabaseDelete(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  return res.status;
}

function punch(employee_id, employee_name, date, punch_type, time) {
  return {
    employee_id,
    employee_name,
    punch_type,
    punched_at: `${date}T${time}:00+09:00`,
    device: 'ipad',
    cancelled: false,
  };
}

/** 分のランダムな揺らぎ (-range ~ +range) */
function jitter(baseMin, range) {
  return baseMin + Math.floor(Math.random() * (range * 2 + 1)) - range;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function timeStr(hours, minutes) {
  let h = hours;
  let m = minutes;
  if (m < 0) { h--; m += 60; }
  if (m >= 60) { h++; m -= 60; }
  return `${pad2(h)}:${pad2(m)}`;
}

// 2026年5月の日付一覧
const year = 2026;
const month = 5;

function getWorkdays() {
  const days = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(`${year}-${pad2(month)}-${pad2(d)}`);
    }
  }
  return days;
}

// パート用：水曜休みの平日
function getPartWorkdays(skipWed = false) {
  const days = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    if (skipWed && dow === 3) continue;
    days.push(`${year}-${pad2(month)}-${pad2(d)}`);
  }
  return days;
}

const workdays = getWorkdays();

// 従業員ごとの打刻パターン定義
const employeePatterns = [
  {
    id: 1, name: '藤原 誠一',
    inH: 8, inM: 50, inJitter: 8,   // 08:42~08:58
    outH: 18, outM: 5, outJitter: 15, // 17:50~18:20
    days: workdays,
  },
  {
    id: 2, name: '中村 健太',
    inH: 8, inM: 52, inJitter: 6,   // 08:46~08:58
    outH: 18, outM: 30, outJitter: 20, // 18:10~18:50 (残業多め)
    days: workdays,
  },
  {
    id: 3, name: '山本 裕子',
    inH: 8, inM: 55, inJitter: 5,   // 08:50~09:00
    outH: 18, outM: 10, outJitter: 10, // 18:00~18:20
    days: workdays,
  },
  {
    id: 4, name: '高橋 大輔',
    inH: 7, inM: 35, inJitter: 10,  // 07:25~07:45 (早出多い)
    outH: 17, outM: 35, outJitter: 15, // 17:20~17:50
    days: workdays,
  },
  {
    id: 5, name: '佐藤 俊介',
    inH: 8, inM: 10, inJitter: 15,  // 07:55~08:25 (早出あり)
    outH: 18, outM: 15, outJitter: 15, // 18:00~18:30
    days: workdays,
  },
  {
    id: 6, name: '伊藤 翔太',
    inH: 9, inM: 52, inJitter: 6,   // 09:46~09:58
    outH: 16, outM: 5, outJitter: 5,  // 16:00~16:10
    days: getPartWorkdays(true), // 水曜休み
  },
  {
    id: 7, name: '渡辺 美咲',
    inH: 9, inM: 55, inJitter: 5,   // 09:50~10:00
    outH: 15, outM: 5, outJitter: 5,  // 15:00~15:10
    days: getPartWorkdays(false),
  },
  {
    id: 8, name: '松田 浩二',
    inH: 9, inM: 50, inJitter: 8,   // 09:42~09:58
    outH: 16, outM: 5, outJitter: 8,  // 15:57~16:13
    days: getPartWorkdays(true), // 水曜休み
  },
];

// 従業員マスタ
const employees = [
  { id: 1, name: '藤原 誠一', name_kana: 'フジワラ セイイチ', employee_type: '役員', display_order: 1, is_active: true },
  { id: 2, name: '中村 健太', name_kana: 'ナカムラ ケンタ', employee_type: '社員', display_order: 2, is_active: true },
  { id: 3, name: '山本 裕子', name_kana: 'ヤマモト ユウコ', employee_type: '役員', display_order: 3, is_active: true },
  { id: 4, name: '高橋 大輔', name_kana: 'タカハシ ダイスケ', employee_type: '社員', display_order: 4, is_active: true },
  { id: 5, name: '佐藤 俊介', name_kana: 'サトウ シュンスケ', employee_type: '社員', display_order: 5, is_active: true },
  { id: 6, name: '伊藤 翔太', name_kana: 'イトウ ショウタ', employee_type: 'パート', display_order: 6, is_active: true },
  { id: 7, name: '渡辺 美咲', name_kana: 'ワタナベ ミサキ', employee_type: 'パート', display_order: 7, is_active: true },
  { id: 8, name: '松田 浩二', name_kana: 'マツダ コウジ', employee_type: 'パート', display_order: 8, is_active: true },
];

async function main() {
  console.log('=== Supabase 2026年5月フルデータ投入 ===\n');

  // 1) 従業員マスタ
  console.log('1) 従業員マスタ同期...');
  await supabasePost('employees_sync?on_conflict=id', employees, true);
  console.log(`  ✓ ${employees.length}名`);

  // 2) 既存打刻クリア (2026年5月)
  console.log('\n2) 既存打刻データクリア (2026年5月)...');
  const delStatus = await supabaseDelete(
    'punch_records',
    'punched_at=gte.2026-05-01T00:00:00&punched_at=lt.2026-06-01T00:00:00',
  );
  console.log(`  ✓ DELETE status: ${delStatus}`);

  // 3) 打刻データ生成
  console.log('\n3) 打刻データ生成...');
  const allPunches = [];

  for (const emp of employeePatterns) {
    let count = 0;
    for (const date of emp.days) {
      const inMin = jitter(emp.inM, emp.inJitter);
      const outMin = jitter(emp.outM, emp.outJitter);
      const clockIn = timeStr(emp.inH, inMin);
      const clockOut = timeStr(emp.outH, outMin);

      allPunches.push(punch(emp.id, emp.name, date, 'clock_in', clockIn));
      allPunches.push(punch(emp.id, emp.name, date, 'clock_out', clockOut));
      count++;
    }
    console.log(`  ${emp.name}: ${count}日分`);
  }

  // 4) Supabase に投入（100件ずつバッチ）
  console.log(`\n4) Supabase に投入 (合計 ${allPunches.length} 件)...`);
  const batchSize = 100;
  for (let i = 0; i < allPunches.length; i += batchSize) {
    const batch = allPunches.slice(i, i + batchSize);
    await supabasePost('punch_records', batch);
    process.stdout.write(`  ✓ ${Math.min(i + batchSize, allPunches.length)}/${allPunches.length}\r`);
  }
  console.log();

  console.log(`\n=== 完了 ===`);
  console.log(`従業員: ${employees.length}名`);
  console.log(`打刻レコード: ${allPunches.length}件`);
  console.log(`期間: 2026年5月`);
  console.log('\nElectron の勤怠管理画面で「打刻同期」ボタンを押して同期してください。');
}

main().catch(console.error);
