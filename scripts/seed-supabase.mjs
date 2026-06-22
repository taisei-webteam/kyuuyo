/**
 * Supabase に丸めルールテスト用の打刻データを投入するスクリプト
 *
 * 対象従業員:
 *   ID=4 高橋大輔  定時 08:30  早出 07:30〜08:15
 *   ID=5 佐藤俊介  定時 09:00  早出 08:00〜08:45
 *   ID=1 藤原誠一  定時 09:00  早出なし
 *   ID=6 伊藤翔太  定時 10:00  早出なし（パート）
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
  console.log(`  ✓ ${table}: ${Array.isArray(body) ? body.length : 1} 件`);
}

// ── 1) 従業員マスタ同期 ──
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

// ── 2) 打刻データ ──
// 2026年6月の平日に各パターンを配置

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

const punches = [
  // ═══════════════════════════════════════
  // 高橋大輔 (ID=4): 定時08:30, 早出07:30〜08:15, 15分丸め
  // ═══════════════════════════════════════

  // 6/1(月): 早出開始前 07:20打刻 → 07:30に切上げ
  punch(4, '高橋 大輔', '2026-06-01', 'clock_in',  '07:20'),
  punch(4, '高橋 大輔', '2026-06-01', 'clock_out', '17:35'),

  // 6/2(火): 早出時間帯 07:42打刻 → 07:30に切捨て(15分単位)
  punch(4, '高橋 大輔', '2026-06-02', 'clock_in',  '07:42'),
  punch(4, '高橋 大輔', '2026-06-02', 'clock_out', '17:48'),

  // 6/3(水): 早出時間帯ぴったり 07:30打刻 → 07:30
  punch(4, '高橋 大輔', '2026-06-03', 'clock_in',  '07:30'),
  punch(4, '高橋 大輔', '2026-06-03', 'clock_out', '17:30'),

  // 6/4(木): 早出時間帯 08:10打刻 → 08:00に切捨て(15分単位)
  punch(4, '高橋 大輔', '2026-06-04', 'clock_in',  '08:10'),
  punch(4, '高橋 大輔', '2026-06-04', 'clock_out', '18:05'),

  // 6/5(金): 休憩帯 08:16打刻(早出終了後) → 08:30(定時開始)
  punch(4, '高橋 大輔', '2026-06-05', 'clock_in',  '08:16'),
  punch(4, '高橋 大輔', '2026-06-05', 'clock_out', '17:30'),

  // 6/8(月): 猶予内 08:35打刻 → 08:30(定時扱い, gracePeriod=10)
  punch(4, '高橋 大輔', '2026-06-08', 'clock_in',  '08:35'),
  punch(4, '高橋 大輔', '2026-06-08', 'clock_out', '17:30'),

  // 6/9(火): 猶予内ギリギリ 08:40打刻 → 08:30(定時扱い)
  punch(4, '高橋 大輔', '2026-06-09', 'clock_in',  '08:40'),
  punch(4, '高橋 大輔', '2026-06-09', 'clock_out', '17:30'),

  // 6/10(水): 遅刻 08:45打刻 → 09:00(15分切上げ)
  punch(4, '高橋 大輔', '2026-06-10', 'clock_in',  '08:45'),
  punch(4, '高橋 大輔', '2026-06-10', 'clock_out', '17:30'),

  // 6/11(木): 遅刻 08:50打刻 → 09:00(15分切上げ)
  punch(4, '高橋 大輔', '2026-06-11', 'clock_in',  '08:50'),
  punch(4, '高橋 大輔', '2026-06-11', 'clock_out', '18:20'),

  // 6/12(金): 退勤切捨て 17:44打刻 → 17:30(15分切捨て)
  punch(4, '高橋 大輔', '2026-06-12', 'clock_in',  '08:28'),
  punch(4, '高橋 大輔', '2026-06-12', 'clock_out', '17:44'),

  // ═══════════════════════════════════════
  // 佐藤俊介 (ID=5): 定時09:00, 早出08:00〜08:45, 15分丸め
  // ═══════════════════════════════════════

  // 6/1: 早出 07:55打刻 → 08:00(早出開始)
  punch(5, '佐藤 俊介', '2026-06-01', 'clock_in',  '07:55'),
  punch(5, '佐藤 俊介', '2026-06-01', 'clock_out', '18:10'),

  // 6/2: 早出 08:22打刻 → 08:15(15分切捨て)
  punch(5, '佐藤 俊介', '2026-06-02', 'clock_in',  '08:22'),
  punch(5, '佐藤 俊介', '2026-06-02', 'clock_out', '18:00'),

  // 6/3: 休憩帯 08:48打刻 → 09:00(定時)
  punch(5, '佐藤 俊介', '2026-06-03', 'clock_in',  '08:48'),
  punch(5, '佐藤 俊介', '2026-06-03', 'clock_out', '18:00'),

  // 6/4: 通常定時 09:05打刻 → 09:00(猶予内)
  punch(5, '佐藤 俊介', '2026-06-04', 'clock_in',  '09:05'),
  punch(5, '佐藤 俊介', '2026-06-04', 'clock_out', '18:00'),

  // 6/5: 遅刻 09:18打刻 → 09:30(15分切上げ)
  punch(5, '佐藤 俊介', '2026-06-05', 'clock_in',  '09:18'),
  punch(5, '佐藤 俊介', '2026-06-05', 'clock_out', '18:00'),

  // ═══════════════════════════════════════
  // 藤原誠一 (ID=1): 定時09:00, 早出なし
  // ═══════════════════════════════════════

  // 6/1: 早め出勤 08:45打刻 → 09:00(早出なし→定時扱い)
  punch(1, '藤原 誠一', '2026-06-01', 'clock_in',  '08:45'),
  punch(1, '藤原 誠一', '2026-06-01', 'clock_out', '18:00'),

  // 6/2: 定時ぴったり 09:00打刻
  punch(1, '藤原 誠一', '2026-06-02', 'clock_in',  '09:00'),
  punch(1, '藤原 誠一', '2026-06-02', 'clock_out', '18:15'),

  // 6/3: 猶予内 09:08打刻 → 09:00
  punch(1, '藤原 誠一', '2026-06-03', 'clock_in',  '09:08'),
  punch(1, '藤原 誠一', '2026-06-03', 'clock_out', '18:00'),

  // 6/4: 遅刻 09:22打刻 → 09:30
  punch(1, '藤原 誠一', '2026-06-04', 'clock_in',  '09:22'),
  punch(1, '藤原 誠一', '2026-06-04', 'clock_out', '18:00'),

  // ═══════════════════════════════════════
  // 伊藤翔太 (ID=6): パート 定時10:00, 早出なし
  // ═══════════════════════════════════════

  // 6/1: 早め出勤 09:48打刻 → 10:00
  punch(6, '伊藤 翔太', '2026-06-01', 'clock_in',  '09:48'),
  punch(6, '伊藤 翔太', '2026-06-01', 'clock_out', '16:05'),

  // 6/2: 遅刻 10:17打刻 → 10:30
  punch(6, '伊藤 翔太', '2026-06-02', 'clock_in',  '10:17'),
  punch(6, '伊藤 翔太', '2026-06-02', 'clock_out', '16:00'),
];

async function main() {
  console.log('=== Supabase テストデータ投入 ===\n');

  console.log('1) 従業員マスタ同期...');
  await supabasePost('employees_sync?on_conflict=id', employees, true);

  console.log('\n2) 既存打刻データをクリア (2026年6月)...');
  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/punch_records?punched_at=gte.2026-06-01T00:00:00&punched_at=lt.2026-07-01T00:00:00`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
    },
  );
  console.log(`  ✓ DELETE status: ${delRes.status}`);

  console.log('\n3) テスト打刻データ投入...');
  await supabasePost('punch_records', punches);

  console.log(`\n=== 完了: ${punches.length} 件の打刻データを投入しました ===`);
  console.log('\nテストパターン:');
  console.log('  高橋大輔 (定時08:30, 早出07:30〜08:15):');
  console.log('    6/1  07:20 → 07:30(早出開始前→切上げ)');
  console.log('    6/2  07:42 → 07:30(早出帯→15分切捨て)');
  console.log('    6/3  07:30 → 07:30(ぴったり)');
  console.log('    6/4  08:10 → 08:00(早出帯→15分切捨て)');
  console.log('    6/5  08:16 → 08:30(休憩帯→定時)');
  console.log('    6/8  08:35 → 08:30(猶予内→定時)');
  console.log('    6/9  08:40 → 08:30(猶予ギリギリ→定時)');
  console.log('    6/10 08:45 → 09:00(遅刻→切上げ)');
  console.log('    6/11 08:50 → 09:00(遅刻→切上げ)');
  console.log('    6/12 08:28 → 08:30(猶予内→定時)');
  console.log('  佐藤俊介 (定時09:00, 早出08:00〜08:45):');
  console.log('    6/1  07:55 → 08:00(早出開始前)');
  console.log('    6/2  08:22 → 08:15(早出帯→切捨て)');
  console.log('    6/3  08:48 → 09:00(休憩帯→定時)');
  console.log('    6/4  09:05 → 09:00(猶予内)');
  console.log('    6/5  09:18 → 09:30(遅刻→切上げ)');
}

main().catch(console.error);
