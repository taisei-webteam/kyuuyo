/**
 * 開発用 Vite が本番アプリと同じ SQLite を読むための読み取り専用スナップショット。
 * 標準出力へ JSON だけを出す。本番 DB は開くだけで更新しない。
 */
const path = require('node:path');
const Database = require('better-sqlite3');

const BOOLEAN_KEYS = new Set([
  'healthInsuranceManual',
  'overtimeAllowed',
  'bonusEligible',
  'incomeTaxExempt',
  'isActive',
  'isHoliday',
  'isHolidayWork',
]);

function camelRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = BOOLEAN_KEYS.has(camel) ? value === 1 || value === true : value;
  }
  return out;
}

function main() {
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error('APPDATA が未設定です');
  }
  const dbPath = path.join(appData, 'rakuraku-kyuuyo-alpha', 'rakuraku-kyuuyo.db');
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const employees = db.prepare('select * from employees order by display_order, id').all().map(camelRow);
    const company = db.prepare('select * from companies order by id limit 1').get();
    const insuranceRates = db.prepare('select * from insurance_rates order by year, month').all().map(camelRow);
    const payslips = db.prepare('select * from payslips order by year, month, id').all().map(camelRow);
    const attendanceRecords = db.prepare('select * from attendance_records order by date, id').all().map(camelRow);
    const rawPunches = db.prepare('select * from raw_punches order by date, id').all().map(camelRow);
    process.stdout.write(JSON.stringify({
      employees,
      company: company ? camelRow(company) : null,
      insuranceRates,
      payslips,
      attendanceRecords,
      rawPunches,
    }));
  } finally {
    db.close();
  }
}

main();
