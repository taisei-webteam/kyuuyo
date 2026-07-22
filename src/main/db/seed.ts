/**
 * 初期データ投入 (seed)
 *
 * チクホーシーリングの社員マスタ（.docs/master.csv の在籍者=taisyoku:FALSE のみ）を
 * SQLite に投入する。給与・勤怠・明細作成を実データで検証・運用できる。
 *
 * 既に従業員が 1 件でも存在する場合は何もしない (冪等)。
 * 既存 DB を作り直す場合は connection.ts の reseedFromMasterOnce() が
 * employees（と依存データ）を一度だけクリアしてから本 seed を再実行する。
 */
import type Database from 'better-sqlite3';

interface SeedEmployee {
  id: number;
  name: string;
  nameKana: string;
  email: string;
  birthDate: string | null;
  employeeType: string;
  departmentName: string;
  jobTitle: string;
  hireDate: string | null;
  displayOrder: number;
  basicSalary: number;
  hourlyRate: number;
  standardMonthlyRemuneration: number;
  transportAllowance: number;
  positionAllowance: number;
  familyAllowance: number;
  specialAllowance: number;
  dangerAllowance: number;
  salesAllowance: number;
  healthInsurance: number;
  welfarePension: number;
  residentTax: number;
  savingsDeduction: number;
  loanDeduction: number;
  dependents: number;
  scheduledStart: string;
  scheduledEnd: string;
  holidayMode: string;
  earlyWorkStart: string | null;
  earlyWorkEnd: string | null;
  overtimeAllowed: boolean;
  overtimeStart: string | null;
  overtimeEnd: string | null;
}

/**
 * master.csv の在籍者を、変換前の生値のまま列挙する。
 * type: 役員 / 社員 / パート（CSV の「パート・アルバイト」は「パート」に正規化済み）
 * pay: 月給（役員・社員）または時給（パート）。CSV の kihonkyuu 列。
 * health/pension: CSV の「保険料(健康保険)」「厚生年金」実額。標準報酬月額の逆算に使用。
 */
interface RawSeed {
  name: string;
  kana: string;
  type: '役員' | '社員' | 'パート';
  dept: string;
  pay: number;
  family: number;
  special: number;
  position: number;
  transport: number;
  sales: number;
  danger: number;
  health: number;
  pension: number;
  resident: number;
  savings: number;
  loan: number;
  hire: string | null;
  order: number;
}

// 表示順(表示順列)昇順。役員(001-008)→社員/パート(101-138)。
const RAW_SEED: RawSeed[] = [
  { name: '谷口　正尚', kana: 'タニグチ　マサナオ', type: '役員', dept: '', pay: 345000, family: 0, special: 0, position: 0, transport: 0, sales: 0, danger: 0, health: 17153, pension: 0, resident: 9700, savings: 0, loan: 0, hire: null, order: 1 },
  { name: '谷口　正知', kana: 'タニグチ　マサトモ', type: '役員', dept: '', pay: 2300000, family: 0, special: 0, position: 0, transport: 0, sales: 0, danger: 0, health: 70603, pension: 54169, resident: 249000, savings: 0, loan: 100000, hire: null, order: 2 },
  { name: '谷口　幸子', kana: 'タニグチ　サチコ', type: '役員', dept: '', pay: 380000, family: 0, special: 0, position: 0, transport: 0, sales: 0, danger: 0, health: 19171, pension: 33201, resident: 9700, savings: 0, loan: 100000, hire: null, order: 3 },
  { name: '谷口　正臣', kana: 'タニグチ　マサオミ', type: '役員', dept: '', pay: 2100000, family: 0, special: 0, position: 0, transport: 0, sales: 0, danger: 0, health: 70603, pension: 54169, resident: 213800, savings: 0, loan: 100000, hire: null, order: 4 },
  { name: '有馬　優子', kana: 'アリマ　ユウコ', type: '役員', dept: '', pay: 1500000, family: 0, special: 0, position: 0, transport: 0, sales: 0, danger: 0, health: 61044, pension: 54169, resident: 110600, savings: 0, loan: 50000, hire: null, order: 5 },
  { name: '谷口　優子', kana: 'タニグチ　ユウコ', type: '役員', dept: '', pay: 300000, family: 0, special: 0, position: 0, transport: 0, sales: 0, danger: 0, health: 17505, pension: 26211, resident: 12400, savings: 0, loan: 0, hire: '2012-06-01', order: 6 },
  { name: '谷口　正知（抜', kana: 'タニグチ　マサトモ（ヌ', type: '役員', dept: '', pay: 300000, family: 0, special: 0, position: 0, transport: 0, sales: 0, danger: 0, health: 0, pension: 0, resident: 0, savings: 0, loan: 0, hire: null, order: 8 },
  { name: '藤田　琢哉', kana: 'フジタ　タクヤ', type: '社員', dept: '抜き部', pay: 200000, family: 20000, special: 0, position: 30000, transport: 10000, sales: 0, danger: 0, health: 15171, pension: 22716, resident: 8900, savings: 0, loan: 0, hire: '2004-08-03', order: 101 },
  { name: '田中　好徳', kana: 'タナカ　ヨシノリ', type: '社員', dept: 'シール部', pay: 157700, family: 0, special: 0, position: 0, transport: 0, sales: 0, danger: 0, health: 9336, pension: 13979, resident: 1500, savings: 0, loan: 0, hire: '1999-09-20', order: 102 },
  { name: '小田原　嘉秀', kana: 'オダハラ　ヨシヒデ', type: '社員', dept: 'シール部', pay: 205000, family: 25000, special: 15000, position: 5000, transport: 5000, sales: 15000, danger: 0, health: 13117, pension: 22716, resident: 12500, savings: 0, loan: 0, hire: '2003-09-24', order: 103 },
  { name: '銭花　貴文', kana: 'ゼニハナ　タカフミ', type: '社員', dept: 'シール部', pay: 180000, family: 10000, special: 5000, position: 0, transport: 5000, sales: 10000, danger: 0, health: 10090, pension: 17474, resident: 8600, savings: 0, loan: 0, hire: '2009-10-13', order: 104 },
  { name: '木森　ひとみ', kana: 'キモリ　ヒトミ', type: 'パート', dept: '総務部', pay: 830, family: 0, special: 0, position: 0, transport: 3000, sales: 0, danger: 0, health: 7352, pension: 11009, resident: 1700, savings: 10000, loan: 0, hire: '2004-07-27', order: 105 },
  { name: '甲木　純子', kana: 'カツキ　ジュンコ', type: 'パート', dept: '総務部', pay: 772, family: 0, special: 0, position: 0, transport: 3000, sales: 0, danger: 0, health: 0, pension: 0, resident: 2200, savings: 5000, loan: 0, hire: '2009-09-29', order: 107 },
  { name: '野口　工', kana: 'ノグチ　タクミ', type: '社員', dept: 'シール部', pay: 205000, family: 0, special: 22000, position: 30000, transport: 20000, sales: 0, danger: 0, health: 16338, pension: 24464, resident: 12500, savings: 0, loan: 0, hire: '2000-02-14', order: 108 },
  { name: '安松　久弘', kana: 'ヤスマツ　ヒサヒロ', type: '社員', dept: '抜き部', pay: 205000, family: 10000, special: 32000, position: 20000, transport: 10000, sales: 0, danger: 0, health: 16338, pension: 24464, resident: 4900, savings: 0, loan: 0, hire: '1999-10-15', order: 110 },
  { name: '松岡　正', kana: 'マツオカ　タダシ', type: '社員', dept: '抜き部', pay: 220000, family: 20000, special: 10000, position: 0, transport: 7500, sales: 0, danger: 5000, health: 15171, pension: 22716, resident: 0, savings: 0, loan: 0, hire: '1997-03-10', order: 111 },
  { name: '山崎　秀夫', kana: 'ヤマサキ　ヒデオ', type: '社員', dept: '抜き部', pay: 185000, family: 15000, special: 10000, position: 0, transport: 5000, sales: 0, danger: 5000, health: 11099, pension: 19221, resident: 6300, savings: 0, loan: 0, hire: '2004-03-01', order: 112 },
  { name: '安田　正信', kana: 'ヤスダ　マサノブ', type: 'パート', dept: '抜き部', pay: 780, family: 0, special: 0, position: 0, transport: 5000, sales: 0, danger: 0, health: 6760, pension: 11708, resident: 3400, savings: 0, loan: 0, hire: '2003-10-06', order: 115 },
  { name: '谷口　恵', kana: 'タニグチ　メグミ', type: 'パート', dept: '抜き部', pay: 880, family: 0, special: 5000, position: 0, transport: 3000, sales: 0, danger: 0, health: 7164, pension: 12407, resident: 3500, savings: 5000, loan: 0, hire: '2001-08-01', order: 118 },
  { name: '手柴　昌美', kana: 'テシバ　マサミ', type: 'パート', dept: '抜き部', pay: 840, family: 0, special: 0, position: 0, transport: 0, sales: 0, danger: 0, health: 0, pension: 0, resident: 0, savings: 2000, loan: 0, hire: '2003-08-28', order: 120 },
  { name: '南利　美紀子', kana: 'ナンリ　ミキコ', type: 'パート', dept: '抜き部', pay: 840, family: 0, special: 5000, position: 0, transport: 0, sales: 0, danger: 0, health: 0, pension: 0, resident: 2300, savings: 10000, loan: 0, hire: '2003-10-10', order: 121 },
  { name: '岡部　紀子', kana: 'オカベ　ノリコ', type: 'パート', dept: '抜き部', pay: 830, family: 0, special: 0, position: 0, transport: 5000, sales: 0, danger: 0, health: 6885, pension: 10310, resident: 1700, savings: 5000, loan: 0, hire: '2004-07-12', order: 122 },
  { name: '後藤　とし子', kana: 'ゴトウ　トシコ', type: 'パート', dept: '抜き部', pay: 830, family: 0, special: 0, position: 0, transport: 5000, sales: 0, danger: 0, health: 0, pension: 0, resident: 0, savings: 10000, loan: 0, hire: '2004-07-20', order: 123 },
  { name: '菊池　妙子', kana: 'キクチ　タエコ', type: 'パート', dept: '抜き部', pay: 830, family: 0, special: 5000, position: 0, transport: 3000, sales: 0, danger: 0, health: 7352, pension: 11009, resident: 2600, savings: 10000, loan: 0, hire: '2005-02-26', order: 124 },
  { name: '神崎　志保', kana: 'カンザキ　シホ', type: 'パート', dept: '抜き部', pay: 772, family: 0, special: 0, position: 0, transport: 3000, sales: 0, danger: 0, health: 5953, pension: 10310, resident: 0, savings: 10000, loan: 0, hire: '2010-01-25', order: 125 },
  { name: '長谷川　浩美', kana: 'ハセガワ　ヒロミ', type: 'パート', dept: '抜き部', pay: 810, family: 0, special: 0, position: 0, transport: 5000, sales: 0, danger: 0, health: 7352, pension: 11009, resident: 2300, savings: 5000, loan: 0, hire: '2005-07-25', order: 126 },
  { name: '松尾　三喜男', kana: 'マツオ　ミキオ', type: '社員', dept: 'シール部', pay: 155000, family: 0, special: 0, position: 0, transport: 0, sales: 0, danger: 0, health: 9336, pension: 13979, resident: 8900, savings: 0, loan: 0, hire: '2005-10-11', order: 128 },
  { name: '五反田　めぐみ', kana: 'ゴタンダ　メグミ', type: 'パート', dept: '抜き部', pay: 770, family: 0, special: 0, position: 0, transport: 3000, sales: 0, danger: 0, health: 0, pension: 0, resident: 0, savings: 10000, loan: 0, hire: '2007-09-11', order: 131 },
  { name: '田中　智明', kana: 'タナカ　トモアキ', type: 'パート', dept: '抜き部', pay: 840, family: 0, special: 0, position: 0, transport: 5000, sales: 0, danger: 5000, health: 9336, pension: 13979, resident: 4300, savings: 0, loan: 0, hire: '2008-02-04', order: 132 },
  { name: '山下　邦子', kana: 'ヤマシタ　クニコ', type: 'パート', dept: '抜き部', pay: 772, family: 0, special: 0, position: 0, transport: 3000, sales: 0, danger: 0, health: 0, pension: 0, resident: 1800, savings: 10000, loan: 0, hire: '2009-12-02', order: 134 },
  { name: '田中　隆二', kana: 'タナカ　リュウジ', type: 'パート', dept: '', pay: 780, family: 0, special: 0, position: 0, transport: 5000, sales: 0, danger: 0, health: 7819, pension: 11708, resident: 2100, savings: 0, loan: 0, hire: '2010-01-25', order: 135 },
  { name: '有吉　ゆかり', kana: 'アリヨシ　ユカリ', type: 'パート', dept: '抜き部', pay: 772, family: 0, special: 0, position: 0, transport: 3000, sales: 0, danger: 0, health: 0, pension: 0, resident: 2100, savings: 5000, loan: 0, hire: '2010-05-06', order: 136 },
  { name: '太田　志保', kana: 'オオタ　シホ', type: 'パート', dept: '抜き部', pay: 772, family: 0, special: 0, position: 0, transport: 3000, sales: 0, danger: 0, health: 0, pension: 0, resident: 1800, savings: 10000, loan: 0, hire: '2010-05-06', order: 137 },
  { name: '池田　好美', kana: 'イケダ　ヨシミ', type: 'パート', dept: '', pay: 780, family: 0, special: 0, position: 0, transport: 5000, sales: 0, danger: 0, health: 6760, pension: 11708, resident: 0, savings: 0, loan: 0, hire: '2010-05-17', order: 138 },
];

/** 厚生年金保険・健康保険の標準報酬月額 等級表（円）。逆算値を最も近い等級へ丸める。 */
const STD_REMUNERATION_GRADES: number[] = [
  58000, 68000, 78000, 88000, 98000, 104000, 110000, 118000, 126000, 134000,
  142000, 150000, 160000, 170000, 180000, 190000, 200000, 220000, 240000, 260000,
  280000, 300000, 320000, 340000, 360000, 380000, 410000, 440000, 470000, 500000,
  530000, 560000, 590000, 620000, 650000, 680000, 710000, 750000, 790000, 830000,
  880000, 930000, 980000, 1030000, 1090000, 1150000, 1210000, 1270000, 1330000, 1390000,
];

// 折半後の被保険者負担率（seedInsuranceRatesIfEmpty の初期値と対応）
const PENSION_HALF_RATE = 0.0915;
const HEALTH_HALF_RATE = 0.05055;

/**
 * CSV の実額保険料から標準報酬月額を逆算し、最も近い等級へ丸める。
 * 厚生年金額を優先（ユーザー選択）。厚生年金が 0（70歳以上で年金対象外等）の場合は
 * 健康保険料から逆算する。両方 0（社保対象外のパート等）は 0 を返す。
 *
 * 注: 現行モデルは健保・年金を単一の標準報酬月額から算出するため、報酬が高く
 * 厚生年金が上限で頭打ちの役員では、明細上の保険料が CSV 実額と一致しない場合がある。
 * 正確な値が必要な場合は「標準報酬月額（定時決定）」画面で個別に上書きすること。
 */
function deriveStandardRemuneration(pension: number, health: number): number {
  let raw = 0;
  if (pension > 0) raw = pension / PENSION_HALF_RATE;
  else if (health > 0) raw = health / HEALTH_HALF_RATE;
  else return 0;

  let best = STD_REMUNERATION_GRADES[0];
  let bestDiff = Math.abs(raw - best);
  for (const grade of STD_REMUNERATION_GRADES) {
    const diff = Math.abs(raw - grade);
    if (diff < bestDiff) {
      best = grade;
      bestDiff = diff;
    }
  }
  return best;
}

/** RawSeed[] を DB 投入用の SeedEmployee[] へ変換する。 */
function buildSeedEmployees(): SeedEmployee[] {
  return RAW_SEED.map((r, index): SeedEmployee => {
    const isHourly = r.type === 'パート';
    const overtimeAllowed = r.type === '社員';
    return {
      id: index + 1,
      name: r.name,
      nameKana: r.kana,
      email: '',
      birthDate: null,
      employeeType: r.type,
      departmentName: r.dept,
      jobTitle: '',
      hireDate: r.hire,
      displayOrder: r.order,
      basicSalary: isHourly ? 0 : r.pay,
      hourlyRate: isHourly ? r.pay : 0,
      standardMonthlyRemuneration: deriveStandardRemuneration(r.pension, r.health),
      transportAllowance: r.transport,
      positionAllowance: r.position,
      familyAllowance: r.family,
      specialAllowance: r.special,
      dangerAllowance: r.danger,
      salesAllowance: r.sales,
      healthInsurance: r.health,
      welfarePension: r.pension,
      residentTax: r.resident,
      savingsDeduction: r.savings,
      loanDeduction: r.loan,
      dependents: 0,
      scheduledStart: '09:00',
      scheduledEnd: '18:00',
      holidayMode: 'calendar',
      earlyWorkStart: null,
      earlyWorkEnd: null,
      overtimeAllowed,
      overtimeStart: overtimeAllowed ? '18:00' : null,
      overtimeEnd: overtimeAllowed ? '22:00' : null,
    };
  });
}

const SEED_EMPLOYEES: SeedEmployee[] = buildSeedEmployees();

/**
 * employees テーブルが空の場合のみ、従業員データを投入する。
 */
export function seedEmployeesIfEmpty(raw: Database.Database): void {
  const row = raw.prepare('SELECT COUNT(*) AS count FROM employees').get() as { count: number };
  if (row.count > 0) return;

  const insert = raw.prepare(`
    INSERT INTO employees (
      id, name, name_kana, email, birth_date, employee_type, department_name, job_title, hire_date,
      display_order, basic_salary, hourly_rate, standard_monthly_remuneration,
      transport_allowance, position_allowance, family_allowance, special_allowance,
      danger_allowance, sales_allowance, health_insurance, welfare_pension, resident_tax,
      savings_deduction, loan_deduction, dependents, scheduled_start, scheduled_end, holiday_mode,
      early_work_start, early_work_end, overtime_allowed, overtime_start, overtime_end, is_active
    ) VALUES (
      @id, @name, @nameKana, @email, @birthDate, @employeeType, @departmentName, @jobTitle, @hireDate,
      @displayOrder, @basicSalary, @hourlyRate, @standardMonthlyRemuneration,
      @transportAllowance, @positionAllowance, @familyAllowance, @specialAllowance,
      @dangerAllowance, @salesAllowance, @healthInsurance, @welfarePension, @residentTax,
      @savingsDeduction, @loanDeduction, @dependents, @scheduledStart, @scheduledEnd, @holidayMode,
      @earlyWorkStart, @earlyWorkEnd, @overtimeAllowed, @overtimeStart, @overtimeEnd, 1
    )
  `);

  const tx = raw.transaction((rows: SeedEmployee[]) => {
    for (const e of rows) {
      insert.run({
        ...e,
        overtimeAllowed: e.overtimeAllowed ? 1 : 0,
      });
    }
  });
  tx(SEED_EMPLOYEES);
}

/**
 * insurance_rates テーブルが空の場合のみ、初期の社会保険料率を投入する。
 *
 * 値は令和8年度（2026年度）の協会けんぽ福岡支部＋全国一律の料率（いずれも
 * 折半後の被保険者負担分）。会社所在地（筑豊＝福岡県）を前提とした既定値であり、
 * 都道府県・年度が異なる場合は設定画面「保険料率」から更新する運用とする。
 *
 *   健康保険（福岡）  : 総額 10.11%  → 折半 5.055%
 *   介護保険（全国）  : 総額  1.62%  → 折半 0.81%（40歳以上）
 *   厚生年金（全国）  : 総額 18.30%  → 折半 9.15%
 *   雇用保険（一般の事業）: 労働者負担 5/1000 = 0.5%
 *
 * 注: 令和8年4月分からの「子ども・子育て支援金率」(全国一律 総額0.23%/折半0.115%)
 * は現行データモデルに専用項目が無いため未反映。厳密な手取り計算が必要な場合は
 * 健康保険料率へ 0.115% を上乗せするか、別途対応する。
 *
 * 既に料率が 1 件でも存在する場合は何もしない (冪等)。
 */
export function seedInsuranceRatesIfEmpty(raw: Database.Database): void {
  const row = raw.prepare('SELECT COUNT(*) AS count FROM insurance_rates').get() as { count: number };
  if (row.count > 0) return;

  raw
    .prepare(`
      INSERT INTO insurance_rates (year, month, health_rate, nursing_rate, pension_rate, employment_rate, prefecture)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(2026, 3, 0.05055, 0.0081, 0.0915, 0.005, '福岡県');
}
