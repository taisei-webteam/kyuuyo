/**
 * SQLite データベース接続管理
 *
 * better-sqlite3 + Drizzle ORM で接続を管理する。
 * WAL モード有効化、外部キー制約 ON。
 * DB ファイルは app.getPath('userData') 配下に配置。
 */

import path from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDbPath(): string {
  const userDataDir = app.getPath('userData');
  return path.join(userDataDir, 'rakuraku-kyuuyo.db');
}

/**
 * DB 接続を初期化して Drizzle インスタンスを返す。
 * 既に接続済みの場合はキャッシュを返す。
 */
export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (db) return db;

  const dbPath = getDbPath();
  sqlite = new Database(dbPath);

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  db = drizzle(sqlite, { schema });

  initTables();

  return db;
}

/**
 * 生の better-sqlite3 インスタンスを取得
 * (マイグレーションやトランザクションの直接操作用)
 */
export function getSqlite(): Database.Database {
  if (!sqlite) {
    getDb();
  }
  return sqlite!;
}

/**
 * テーブルが存在しない場合に作成する (初回起動用)
 */
function initTables(): void {
  const raw = getSqlite();

  raw.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      representative_name TEXT,
      postal_code TEXT,
      address TEXT,
      phone TEXT,
      insurance_number TEXT,
      rounding_unit INTEGER NOT NULL DEFAULT 15,
      grace_period INTEGER NOT NULL DEFAULT 10,
      default_break_minutes INTEGER NOT NULL DEFAULT 60,
      clock_out_rounding TEXT NOT NULL DEFAULT 'down',
      early_rounding_unit INTEGER NOT NULL DEFAULT 15,
      overtime_rounding_unit INTEGER NOT NULL DEFAULT 15,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_kana TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      birth_date TEXT,
      employee_type TEXT NOT NULL DEFAULT '社員',
      department_name TEXT NOT NULL DEFAULT '',
      job_title TEXT NOT NULL DEFAULT '',
      hire_date TEXT,
      resign_date TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      basic_salary INTEGER NOT NULL DEFAULT 0,
      hourly_rate INTEGER NOT NULL DEFAULT 0,
      standard_monthly_remuneration INTEGER NOT NULL DEFAULT 0,
      transport_allowance INTEGER NOT NULL DEFAULT 0,
      position_allowance INTEGER NOT NULL DEFAULT 0,
      family_allowance INTEGER NOT NULL DEFAULT 0,
      special_allowance INTEGER NOT NULL DEFAULT 0,
      danger_allowance INTEGER NOT NULL DEFAULT 0,
      sales_allowance INTEGER NOT NULL DEFAULT 0,
      health_insurance INTEGER NOT NULL DEFAULT 0,
      welfare_pension INTEGER NOT NULL DEFAULT 0,
      resident_tax INTEGER NOT NULL DEFAULT 0,
      savings_deduction INTEGER NOT NULL DEFAULT 0,
      loan_deduction INTEGER NOT NULL DEFAULT 0,
      dependents INTEGER NOT NULL DEFAULT 0,
      scheduled_start TEXT NOT NULL DEFAULT '09:00',
      scheduled_end TEXT NOT NULL DEFAULT '18:00',
      holiday_mode TEXT NOT NULL DEFAULT 'calendar',
      early_work_start TEXT,
      early_work_end TEXT,
      overtime_allowed INTEGER NOT NULL DEFAULT 1,
      overtime_start TEXT,
      overtime_end TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS raw_punches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      date TEXT NOT NULL,
      raw_clock_in TEXT,
      raw_clock_out TEXT,
      data_source TEXT NOT NULL DEFAULT 'ipad',
      synced_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      date TEXT NOT NULL,
      clock_in TEXT,
      clock_out TEXT,
      work_minutes INTEGER NOT NULL DEFAULT 0,
      overtime_minutes INTEGER NOT NULL DEFAULT 0,
      early_overtime_minutes INTEGER NOT NULL DEFAULT 0,
      break_minutes INTEGER NOT NULL DEFAULT 60,
      is_holiday INTEGER NOT NULL DEFAULT 0,
      is_holiday_work INTEGER NOT NULL DEFAULT 0,
      data_source TEXT NOT NULL DEFAULT 'manual',
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS payslips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      payment_date TEXT,
      payslip_type TEXT NOT NULL DEFAULT 'salary',
      bonus_season TEXT,
      work_days INTEGER NOT NULL DEFAULT 0,
      work_hours REAL NOT NULL DEFAULT 0,
      overtime_hours REAL NOT NULL DEFAULT 0,
      holiday_work_days INTEGER NOT NULL DEFAULT 0,
      basic_salary INTEGER NOT NULL DEFAULT 0,
      overtime_pay INTEGER NOT NULL DEFAULT 0,
      transport_allowance INTEGER NOT NULL DEFAULT 0,
      position_allowance INTEGER NOT NULL DEFAULT 0,
      family_allowance INTEGER NOT NULL DEFAULT 0,
      special_allowance INTEGER NOT NULL DEFAULT 0,
      danger_allowance INTEGER NOT NULL DEFAULT 0,
      sales_allowance INTEGER NOT NULL DEFAULT 0,
      other_allowance INTEGER NOT NULL DEFAULT 0,
      total_payment INTEGER NOT NULL DEFAULT 0,
      health_insurance INTEGER NOT NULL DEFAULT 0,
      nursing_insurance INTEGER NOT NULL DEFAULT 0,
      welfare_pension INTEGER NOT NULL DEFAULT 0,
      employment_insurance INTEGER NOT NULL DEFAULT 0,
      income_tax INTEGER NOT NULL DEFAULT 0,
      resident_tax INTEGER NOT NULL DEFAULT 0,
      savings_deduction INTEGER NOT NULL DEFAULT 0,
      loan_deduction INTEGER NOT NULL DEFAULT 0,
      other_deduction INTEGER NOT NULL DEFAULT 0,
      total_deduction INTEGER NOT NULL DEFAULT 0,
      net_payment INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(employee_id, year, month, payslip_type)
    );

    CREATE TABLE IF NOT EXISTS tax_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      salary_from INTEGER NOT NULL,
      salary_to INTEGER NOT NULL,
      dependents INTEGER NOT NULL,
      tax_column TEXT NOT NULL DEFAULT 'A',
      tax_amount INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS insurance_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL DEFAULT 4,
      health_rate REAL NOT NULL,
      nursing_rate REAL NOT NULL,
      pension_rate REAL NOT NULL,
      employment_rate REAL NOT NULL,
      prefecture TEXT NOT NULL DEFAULT '全国'
    );

    CREATE TABLE IF NOT EXISTS work_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL DEFAULT '09:00',
      end_time TEXT NOT NULL DEFAULT '18:00',
      break_minutes INTEGER NOT NULL DEFAULT 60,
      scheduled_minutes INTEGER NOT NULL DEFAULT 480
    );

    CREATE TABLE IF NOT EXISTS company_calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      is_holiday INTEGER NOT NULL DEFAULT 0,
      holiday_name TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imported_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      source TEXT NOT NULL DEFAULT 'supabase',
      record_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      year_month TEXT NOT NULL
    );
  `);

  runMigrations(raw);
}

/**
 * 既存テーブルへのカラム追加等のマイグレーション。
 * ALTER TABLE ADD COLUMN は「カラムが既にあればエラー」になるため try-catch で吸収。
 */
function runMigrations(raw: Database.Database): void {
  const addColumn = (table: string, col: string, def: string): void => {
    try {
      raw.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    } catch {
      // カラムが既に存在する場合は無視
    }
  };

  // employees: 残業設定カラム
  addColumn('employees', 'overtime_allowed', 'INTEGER NOT NULL DEFAULT 1');
  addColumn('employees', 'overtime_start', 'TEXT');
  addColumn('employees', 'overtime_end', 'TEXT');

  // employees: 早出設定カラム
  addColumn('employees', 'early_work_start', 'TEXT');
  addColumn('employees', 'early_work_end', 'TEXT');

  // companies: 丸め設定カラム
  addColumn('companies', 'rounding_unit', 'INTEGER NOT NULL DEFAULT 15');
  addColumn('companies', 'grace_period', 'INTEGER NOT NULL DEFAULT 10');
  addColumn('companies', 'default_break_minutes', 'INTEGER NOT NULL DEFAULT 60');
  addColumn('companies', 'clock_out_rounding', "TEXT NOT NULL DEFAULT 'down'");
  addColumn('companies', 'early_rounding_unit', 'INTEGER NOT NULL DEFAULT 15');
  addColumn('companies', 'overtime_rounding_unit', 'INTEGER NOT NULL DEFAULT 15');
}

/**
 * DB 接続を閉じる (アプリ終了時に呼ぶ)
 */
export function closeDb(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}
