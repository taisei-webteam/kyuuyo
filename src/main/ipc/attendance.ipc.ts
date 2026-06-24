/**
 * 勤怠データ IPC ハンドラ
 *
 * Supabase 同期 → raw_punches (実打刻)
 * 丸め処理 → attendance_records (勤怠データ)
 */
import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels.js';
import { getSqlite } from '../db/connection.js';
import {
  syncAttendanceFromSupabase,
  syncEmployeesToSupabase,
  type SupabaseConfig,
} from '../services/attendance.sync.js';
import { validateAttendance } from '../services/attendance.validate.js';
import {
  roundClockIn,
  roundClockOut,
  calcEarlyOvertime,
  toMinutes,
  type ClockInConfig,
} from '../../shared/time-rounding.js';
import type {
  IpcResult,
  AttendanceRecord,
  AttendanceUpsert,
  AttendanceSyncResult,
  AttendanceWarning,
  RawPunch,
} from '../../shared/types.js';

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase の環境変数が未設定です (.env を確認してください)');
  }
  return { url, serviceRoleKey: key };
}

interface EmployeeRow {
  id: number;
  scheduled_start: string;
  scheduled_end: string;
  early_work_start: string | null;
  early_work_end: string | null;
  overtime_allowed: number;
  overtime_start: string | null;
  overtime_end: string | null;
}

interface CompanyRow {
  rounding_unit: number;
  grace_period: number;
  default_break_minutes: number;
  early_rounding_unit: number;
  overtime_rounding_unit: number;
}

function getCompanySettings(): CompanyRow {
  const raw = getSqlite();
  const row = raw.prepare(
    'SELECT rounding_unit, grace_period, default_break_minutes, early_rounding_unit, overtime_rounding_unit FROM companies LIMIT 1',
  ).get() as CompanyRow | undefined;
  return row ?? {
    rounding_unit: 15,
    grace_period: 10,
    default_break_minutes: 60,
    early_rounding_unit: 15,
    overtime_rounding_unit: 15,
  };
}

function getEmployeeMap(): Map<number, EmployeeRow> {
  const raw = getSqlite();
  const rows = raw.prepare(
    `SELECT id, scheduled_start, scheduled_end, early_work_start, early_work_end,
            overtime_allowed, overtime_start, overtime_end
     FROM employees WHERE is_active = 1`
  ).all() as EmployeeRow[];
  const map = new Map<number, EmployeeRow>();
  for (const r of rows) map.set(r.id, r);
  return map;
}

/**
 * 1件の実打刻に対して丸め＋勤務時間計算を行い、attendance_records に UPSERT する
 */
function roundAndUpsertOne(
  empId: number,
  date: string,
  rawIn: string | null,
  rawOut: string | null,
  emp: EmployeeRow,
  company: CompanyRow,
): void {
  if (!rawIn) return;

  const clockInConfig: ClockInConfig = {
    scheduledStart: emp.scheduled_start,
    earlyWorkStart: emp.early_work_start,
    earlyWorkEnd: emp.early_work_end,
    roundingUnit: company.rounding_unit,
    gracePeriod: company.grace_period,
  };

  const clockInResult = roundClockIn(rawIn.slice(0, 5), clockInConfig);
  const clockIn = clockInResult.time;
  const clockOut = rawOut ? roundClockOut(rawOut.slice(0, 5), company.rounding_unit) : null;

  // 早出は「実打刻」を基準に算出（早出開始前は0、早出終了までを早出単位で切り捨て）
  const earlyOvertimeMinutes = calcEarlyOvertime(
    rawIn.slice(0, 5),
    emp.early_work_start,
    emp.early_work_end,
    company.early_rounding_unit,
  );

  let workMinutes = 0;
  let overtimeMinutes = 0;

  if (clockOut) {
    const workStartMin = toMinutes(clockIn);
    let workEndMin = toMinutes(clockOut);
    const scheduledEndMin = toMinutes(emp.scheduled_end);
    const overtimeAllowed = !!emp.overtime_allowed;

    if (!overtimeAllowed) {
      workEndMin = Math.min(workEndMin, scheduledEndMin);
    } else if (emp.overtime_end) {
      workEndMin = Math.min(workEndMin, toMinutes(emp.overtime_end));
    }

    const breakMinutes = company.default_break_minutes;
    const scheduledMinutes = scheduledEndMin - toMinutes(emp.scheduled_start) - breakMinutes;
    workMinutes = Math.max(0, workEndMin - workStartMin - breakMinutes);

    if (!overtimeAllowed) {
      overtimeMinutes = 0;
    } else if (emp.overtime_start) {
      const otStartMin = toMinutes(emp.overtime_start);
      const effectiveEnd = emp.overtime_end
        ? Math.min(toMinutes(clockOut), toMinutes(emp.overtime_end))
        : toMinutes(clockOut);
      overtimeMinutes = Math.max(0, effectiveEnd - otStartMin);
    } else {
      overtimeMinutes = Math.max(0, workMinutes - scheduledMinutes);
    }
  }

  const raw = getSqlite();
  raw.prepare(`
    INSERT INTO attendance_records
      (employee_id, date, clock_in, clock_out, work_minutes, overtime_minutes,
       early_overtime_minutes, break_minutes, is_holiday, is_holiday_work, data_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'ipad')
    ON CONFLICT(employee_id, date) DO UPDATE SET
      clock_in = excluded.clock_in,
      clock_out = excluded.clock_out,
      work_minutes = excluded.work_minutes,
      overtime_minutes = excluded.overtime_minutes,
      early_overtime_minutes = excluded.early_overtime_minutes,
      break_minutes = excluded.break_minutes,
      data_source = 'ipad',
      updated_at = datetime('now','localtime')
  `).run(
    empId, date, clockIn, clockOut,
    workMinutes, overtimeMinutes, earlyOvertimeMinutes,
    company.default_break_minutes,
  );
}

export function registerAttendanceHandlers(): void {
  /**
   * Supabase → raw_punches に同期（生データ保存のみ）
   */
  ipcMain.handle(
    IPC.ATTENDANCE.SYNC,
    async (_event, params: { year: number; month: number }): Promise<IpcResult<AttendanceSyncResult>> => {
      try {
        const config = getSupabaseConfig();
        const { pairs, warnings } = await syncAttendanceFromSupabase(
          config,
          params.year,
          params.month,
        );

        const raw = getSqlite();
        const upsert = raw.prepare(`
          INSERT INTO raw_punches (employee_id, date, raw_clock_in, raw_clock_out, data_source, synced_at)
          VALUES (?, ?, ?, ?, 'ipad', datetime('now','localtime'))
          ON CONFLICT(employee_id, date) DO UPDATE SET
            raw_clock_in = excluded.raw_clock_in,
            raw_clock_out = excluded.raw_clock_out,
            synced_at = datetime('now','localtime')
        `);

        const tx = raw.transaction(() => {
          for (const pair of pairs) {
            const clockInTime = pair.clockIn ? pair.clockIn.slice(11, 19) : null;
            const clockOutTime = pair.clockOut ? pair.clockOut.slice(11, 19) : null;
            upsert.run(pair.employeeId, pair.date, clockInTime, clockOutTime);
          }
        });
        tx();

        return {
          success: true,
          data: {
            synced: pairs.length,
            errors: 0,
            warnings,
          },
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : '同期に失敗しました',
        };
      }
    },
  );

  /**
   * 実打刻一覧 (raw_punches) の取得
   */
  ipcMain.handle(
    IPC.ATTENDANCE.RAW_LIST,
    async (_event, params: { year: number; month: number }): Promise<IpcResult<RawPunch[]>> => {
      try {
        const raw = getSqlite();
        const monthStr = `${params.year}-${String(params.month).padStart(2, '0')}`;
        const rows = raw.prepare(`
          SELECT id, employee_id AS employeeId, date,
                 raw_clock_in AS rawClockIn, raw_clock_out AS rawClockOut,
                 data_source AS dataSource, synced_at AS syncedAt
          FROM raw_punches
          WHERE date LIKE ? || '%'
          ORDER BY employee_id, date
        `).all(monthStr) as RawPunch[];
        return { success: true, data: rows };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '実打刻一覧の取得に失敗しました' };
      }
    },
  );

  /**
   * 一括丸め: raw_punches → attendance_records
   */
  ipcMain.handle(
    IPC.ATTENDANCE.ROUND_ALL,
    async (_event, params: { year: number; month: number }): Promise<IpcResult<{ processed: number }>> => {
      try {
        const raw = getSqlite();
        const monthStr = `${params.year}-${String(params.month).padStart(2, '0')}`;
        const company = getCompanySettings();
        const empMap = getEmployeeMap();

        const punches = raw.prepare(`
          SELECT employee_id AS employeeId, date,
                 raw_clock_in AS rawClockIn, raw_clock_out AS rawClockOut
          FROM raw_punches
          WHERE date LIKE ? || '%'
          ORDER BY employee_id, date
        `).all(monthStr) as Array<{
          employeeId: number;
          date: string;
          rawClockIn: string | null;
          rawClockOut: string | null;
        }>;

        let processed = 0;
        const tx = raw.transaction(() => {
          for (const p of punches) {
            const emp = empMap.get(p.employeeId);
            if (!emp) continue;
            roundAndUpsertOne(p.employeeId, p.date, p.rawClockIn, p.rawClockOut, emp, company);
            processed++;
          }
        });
        tx();

        return { success: true, data: { processed } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '一括丸めに失敗しました' };
      }
    },
  );

  /**
   * 個別丸め: 1件の raw_punch → attendance_record
   */
  ipcMain.handle(
    IPC.ATTENDANCE.ROUND_ONE,
    async (_event, params: { employeeId: number; date: string }): Promise<IpcResult<{ ok: boolean }>> => {
      try {
        const raw = getSqlite();
        const company = getCompanySettings();
        const empMap = getEmployeeMap();

        const punch = raw.prepare(`
          SELECT raw_clock_in AS rawClockIn, raw_clock_out AS rawClockOut
          FROM raw_punches
          WHERE employee_id = ? AND date = ?
        `).get(params.employeeId, params.date) as { rawClockIn: string | null; rawClockOut: string | null } | undefined;

        if (!punch) {
          return { success: false, error: '該当の実打刻データがありません' };
        }

        const emp = empMap.get(params.employeeId);
        if (!emp) {
          return { success: false, error: '該当の従業員が見つかりません' };
        }

        roundAndUpsertOne(params.employeeId, params.date, punch.rawClockIn, punch.rawClockOut, emp, company);
        return { success: true, data: { ok: true } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '個別丸めに失敗しました' };
      }
    },
  );

  /**
   * 従業員マスタを Supabase に同期
   */
  ipcMain.handle(
    IPC.ATTENDANCE.SYNC_EMPLOYEES,
    async (_event, params: { employees: Array<{ id: number; name: string; name_kana: string; employee_type: string; display_order: number; is_active: boolean }> }): Promise<IpcResult<{ synced: number }>> => {
      try {
        const config = getSupabaseConfig();
        await syncEmployeesToSupabase(config, params.employees);
        return { success: true, data: { synced: params.employees.length } };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : '従業員同期に失敗しました',
        };
      }
    },
  );

  /**
   * 勤怠レコードの手動入力/更新 (UPSERT)
   */
  ipcMain.handle(
    IPC.ATTENDANCE.UPSERT,
    async (_event, params: AttendanceUpsert): Promise<IpcResult<{ id: number }>> => {
      try {
        const raw = getSqlite();
        const result = raw.prepare(`
          INSERT INTO attendance_records
            (employee_id, date, clock_in, clock_out, work_minutes, overtime_minutes,
             early_overtime_minutes, break_minutes, is_holiday, is_holiday_work, data_source, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(employee_id, date) DO UPDATE SET
            clock_in = excluded.clock_in,
            clock_out = excluded.clock_out,
            work_minutes = excluded.work_minutes,
            overtime_minutes = excluded.overtime_minutes,
            early_overtime_minutes = excluded.early_overtime_minutes,
            break_minutes = excluded.break_minutes,
            is_holiday = excluded.is_holiday,
            is_holiday_work = excluded.is_holiday_work,
            data_source = excluded.data_source,
            note = excluded.note,
            updated_at = datetime('now','localtime')
        `).run(
          params.employeeId, params.date, params.clockIn, params.clockOut,
          params.workMinutes, params.overtimeMinutes, params.earlyOvertimeMinutes,
          params.breakMinutes, params.isHoliday ? 1 : 0, params.isHolidayWork ? 1 : 0,
          params.dataSource, params.note,
        );
        return { success: true, data: { id: Number(result.lastInsertRowid) } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '勤怠レコードの保存に失敗しました' };
      }
    },
  );

  /**
   * 指定年月の勤怠レコード一覧
   */
  ipcMain.handle(
    IPC.ATTENDANCE.LIST,
    async (_event, params: { year: number; month: number; employeeId?: number }): Promise<IpcResult<AttendanceRecord[]>> => {
      try {
        const monthStr = `${params.year}-${String(params.month).padStart(2, '0')}`;
        const raw = getSqlite();

        let sql = `SELECT * FROM attendance_records WHERE date LIKE ? || '%'`;
        const sqlParams: (string | number)[] = [monthStr];

        if (params.employeeId) {
          sql += ' AND employee_id = ?';
          sqlParams.push(params.employeeId);
        }
        sql += ' ORDER BY employee_id, date';

        const rows = raw.prepare(sql).all(...sqlParams) as AttendanceRecord[];
        return { success: true, data: rows };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '勤怠一覧の取得に失敗しました' };
      }
    },
  );

  /**
   * 勤怠バリデーション
   */
  ipcMain.handle(
    IPC.ATTENDANCE.VALIDATE,
    async (_event, params: { year: number; month: number }): Promise<IpcResult<AttendanceWarning[]>> => {
      try {
        const raw = getSqlite();
        const monthStr = `${params.year}-${String(params.month).padStart(2, '0')}`;

        const rows = raw.prepare(`
          SELECT
            ar.employee_id AS employeeId,
            e.name AS employeeName,
            ar.date,
            ar.clock_in AS clockIn,
            ar.clock_out AS clockOut,
            ar.work_minutes AS workMinutes,
            ar.is_holiday AS isHoliday
          FROM attendance_records ar
          JOIN employees e ON e.id = ar.employee_id
          WHERE ar.date LIKE ? || '%'
          ORDER BY ar.employee_id, ar.date
        `).all(monthStr) as Array<{
          employeeId: number;
          employeeName: string;
          date: string;
          clockIn: string | null;
          clockOut: string | null;
          workMinutes: number;
          isHoliday: boolean;
        }>;

        const warnings = validateAttendance(rows);
        return { success: true, data: warnings };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'バリデーションに失敗しました' };
      }
    },
  );
}
