/**
 * Neon ⇔ ローカル SQLite の勤怠データ同期サービス
 *
 * iPad PWA で打刻されたデータを Neon から取得し、
 * ローカルの attendance_records テーブルに反映する。
 * 逆方向として、従業員マスタを Neon に同期する。
 */

import { neon } from '@neondatabase/serverless';
import type { AttendanceSyncResult, AttendanceWarning } from '../../shared/types';

interface NeonConfig {
  databaseUrl: string;
}

interface PunchRow {
  id: string;
  employee_id: number;
  employee_name: string;
  punch_type: 'clock_in' | 'clock_out' | 'go_out' | 'go_return';
  punched_at: string;
  device: string;
  cancelled: boolean;
}

interface EmployeeRow {
  id: number;
  name: string;
  name_kana: string;
  employee_type: string;
  display_order: number;
  is_active: boolean;
}

interface DayPunches {
  employeeId: number;
  employeeName: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  goOut: string | null;
  goReturn: string | null;
}

/**
 * UTC の ISO 文字列を JST(+9h) に変換し、日付・時刻文字列を返す。
 * punch_records.punched_at は UTC で保存されるため、勤務日の判定や
 * 勤怠表示は JST に直す必要がある（サーバーのTZに依存しないよう+9hを明示加算）。
 */
function toJstParts(iso: string): { date: string; time: string } {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number): string => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`,
  };
}

/** UTC ISO 文字列を JST の "HH:MM:SS" に変換する。 */
export function isoToJstTime(iso: string): string {
  return toJstParts(iso).time;
}

function groupPunchesByDay(punches: PunchRow[]): DayPunches[] {
  const active = punches.filter((p) => !p.cancelled);

  const grouped = new Map<string, PunchRow[]>();
  for (const p of active) {
    const date = toJstParts(p.punched_at).date;
    const key = `${p.employee_id}:${date}`;
    const arr = grouped.get(key) ?? [];
    arr.push(p);
    grouped.set(key, arr);
  }

  const results: DayPunches[] = [];
  for (const [key, dayPunches] of grouped) {
    const [empId, date] = key.split(':');
    const sorted = dayPunches.sort(
      (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime(),
    );
    const clockIns = sorted.filter((p) => p.punch_type === 'clock_in');
    const clockOuts = sorted.filter((p) => p.punch_type === 'clock_out');
    const goOuts = sorted.filter((p) => p.punch_type === 'go_out');
    const goReturns = sorted.filter((p) => p.punch_type === 'go_return');

    results.push({
      employeeId: Number(empId),
      employeeName: sorted[0]?.employee_name ?? '',
      date: date!,
      clockIn: clockIns[0]?.punched_at ?? null,
      clockOut: clockOuts.at(-1)?.punched_at ?? null,
      // 外出は最初の打刻、戻りは最後の打刻を採用（1日1回の外出を想定）
      goOut: goOuts[0]?.punched_at ?? null,
      goReturn: goReturns.at(-1)?.punched_at ?? null,
    });
  }

  return results;
}

function validateDayPunches(pairs: DayPunches[]): AttendanceWarning[] {
  const warnings: AttendanceWarning[] = [];

  for (const pair of pairs) {
    if (pair.clockIn && !pair.clockOut) {
      warnings.push({
        employeeId: pair.employeeId,
        employeeName: pair.employeeName,
        date: pair.date,
        type: 'missing_clock_out',
        message: `${pair.employeeName}: ${pair.date} の退勤打刻がありません`,
      });
    }
    if (!pair.clockIn && pair.clockOut) {
      warnings.push({
        employeeId: pair.employeeId,
        employeeName: pair.employeeName,
        date: pair.date,
        type: 'missing_clock_in',
        message: `${pair.employeeName}: ${pair.date} の出勤打刻がありません`,
      });
    }
    if (pair.clockIn && pair.clockOut) {
      const diffMs = new Date(pair.clockOut).getTime() - new Date(pair.clockIn).getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours > 16) {
        warnings.push({
          employeeId: pair.employeeId,
          employeeName: pair.employeeName,
          date: pair.date,
          type: 'abnormal_hours',
          message: `${pair.employeeName}: ${pair.date} の勤務時間が${diffHours.toFixed(1)}時間と異常です`,
        });
      }
    }
  }

  return warnings;
}

/**
 * 指定年月の打刻データを Neon から取得し、
 * ペアリング + バリデーション済みの結果を返す。
 */
export async function syncAttendanceFromNeon(
  config: NeonConfig,
  year: number,
  month: number,
): Promise<{ pairs: DayPunches[]; warnings: AttendanceWarning[] }> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00`;

  const sql = neon(config.databaseUrl);
  const punches = await sql`
    select id, employee_id, employee_name, punch_type, punched_at, device, cancelled
    from public.punch_records
    where punched_at >= ${startDate}::timestamptz
      and punched_at < ${endDate}::timestamptz
    order by punched_at asc
  ` as PunchRow[];

  const pairs = groupPunchesByDay(punches);
  const warnings = validateDayPunches(pairs);

  return { pairs, warnings };
}

/**
 * Neon の employees_sync から従業員マスタを取得する。
 * raw_punches は employees(id) へ外部キーを持つため、打刻同期前にローカルへ反映する。
 */
export async function fetchEmployeesFromNeon(config: NeonConfig): Promise<EmployeeRow[]> {
  const sql = neon(config.databaseUrl);
  return await sql`
    select id, name, name_kana, employee_type, display_order, is_active
    from public.employees_sync
    order by display_order asc, id asc
  ` as EmployeeRow[];
}

/**
 * 従業員マスタを Neon の employees_sync テーブルに同期する。
 * Windows アプリ → Neon 方向 (UPSERT)。
 */
export async function syncEmployeesToNeon(
  config: NeonConfig,
  employees: EmployeeRow[],
): Promise<void> {
  if (employees.length === 0) return;

  const body = employees.map((e) => ({
    id: e.id,
    name: e.name,
    name_kana: e.name_kana,
    employee_type: e.employee_type,
    display_order: e.display_order,
    is_active: e.is_active,
    updated_at: new Date().toISOString(),
  }));

  const sql = neon(config.databaseUrl);
  await sql`
    with src as (
      select *
      from jsonb_to_recordset(${JSON.stringify(body)}::jsonb)
        as x(
          id int,
          name text,
          name_kana text,
          employee_type text,
          display_order int,
          is_active boolean,
          updated_at timestamptz
        )
    )
    insert into public.employees_sync (
      id,
      name,
      name_kana,
      employee_type,
      display_order,
      is_active,
      updated_at
    )
    select
      id,
      name,
      name_kana,
      employee_type,
      display_order,
      is_active,
      updated_at
    from src
    on conflict (id) do update set
      name = excluded.name,
      name_kana = excluded.name_kana,
      employee_type = excluded.employee_type,
      display_order = excluded.display_order,
      is_active = excluded.is_active,
      updated_at = excluded.updated_at
  `;
}

export type { NeonConfig, DayPunches, PunchRow, EmployeeRow };
