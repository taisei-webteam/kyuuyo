/**
 * 勤怠データ IPC ハンドラ
 *
 * Supabase 同期、ローカル勤怠レコードの CRUD、バリデーションを提供。
 */
import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import {
  syncAttendanceFromSupabase,
  syncEmployeesToSupabase,
  type SupabaseConfig,
} from '../services/attendance.sync';
import type { IpcResult, AttendanceSyncResult } from '../../shared/types';

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase の環境変数が未設定です (.env を確認してください)');
  }
  return { url, serviceRoleKey: key };
}

export function registerAttendanceHandlers(): void {
  /**
   * Supabase から指定年月の打刻データを同期
   * params: { year: number, month: number }
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

        // TODO: pairs を SQLite の attendance_records に UPSERT する
        // (Drizzle ORM のセットアップ後に実装)

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
   * 従業員マスタを Supabase に同期
   * params: Employee[] (ローカルの従業員一覧)
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
   * 勤怠レコードの手動入力/更新
   * params: AttendanceRecord (UPSERT)
   */
  ipcMain.handle(
    IPC.ATTENDANCE.UPSERT,
    async (_event, _params): Promise<IpcResult<{ id: number }>> => {
      // TODO: Drizzle ORM セットアップ後に実装
      return { success: false, error: '未実装: DB セットアップ後に実装' };
    },
  );

  /**
   * 指定年月の勤怠レコード一覧
   * params: { year: number, month: number, employeeId?: number }
   */
  ipcMain.handle(
    IPC.ATTENDANCE.LIST,
    async (_event, _params): Promise<IpcResult<unknown[]>> => {
      // TODO: Drizzle ORM セットアップ後に実装
      return { success: true, data: [] };
    },
  );
}
