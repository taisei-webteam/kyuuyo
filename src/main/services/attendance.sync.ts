/**
 * Supabase ⇔ ローカル SQLite の勤怠データ同期サービス
 *
 * iPad PWA で打刻されたデータを Supabase から取得し、
 * ローカルの attendance_records テーブルに反映する。
 * 逆方向として、従業員マスタを Supabase に同期する。
 */

import type { AttendanceSyncResult, AttendanceWarning } from '../../shared/types';

interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

interface PunchRow {
  id: string;
  employee_id: number;
  employee_name: string;
  punch_type: 'clock_in' | 'clock_out';
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
}

async function supabaseFetch<T>(
  config: SupabaseConfig,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: options?.method === 'POST' ? 'resolution=merge-duplicates' : 'return=representation',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function groupPunchesByDay(punches: PunchRow[]): DayPunches[] {
  const active = punches.filter((p) => !p.cancelled);

  const grouped = new Map<string, PunchRow[]>();
  for (const p of active) {
    const date = p.punched_at.slice(0, 10);
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

    results.push({
      employeeId: Number(empId),
      employeeName: sorted[0]?.employee_name ?? '',
      date: date!,
      clockIn: clockIns[0]?.punched_at ?? null,
      clockOut: clockOuts.at(-1)?.punched_at ?? null,
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
 * 指定年月の打刻データを Supabase から取得し、
 * ペアリング + バリデーション済みの結果を返す。
 */
export async function syncAttendanceFromSupabase(
  config: SupabaseConfig,
  year: number,
  month: number,
): Promise<{ pairs: DayPunches[]; warnings: AttendanceWarning[] }> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00`;

  const punches = await supabaseFetch<PunchRow[]>(
    config,
    `punch_records?punched_at=gte.${startDate}&punched_at=lt.${endDate}&order=punched_at.asc`,
  );

  const pairs = groupPunchesByDay(punches);
  const warnings = validateDayPunches(pairs);

  return { pairs, warnings };
}

/**
 * 従業員マスタを Supabase の employees_sync テーブルに同期する。
 * Windows アプリ → Supabase 方向 (UPSERT)。
 */
export async function syncEmployeesToSupabase(
  config: SupabaseConfig,
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

  await supabaseFetch(config, 'employees_sync?on_conflict=id', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type { SupabaseConfig, DayPunches, PunchRow, EmployeeRow };
