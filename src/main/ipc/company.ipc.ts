/**
 * 会社情報・設定 + カレンダー IPC ハンドラ
 */
import { ipcMain } from 'electron';
import { eq } from 'drizzle-orm';
import { IPC } from '../../shared/ipc-channels.js';
import { getDb, getSqlite } from '../db/connection.js';
import { companies, companyCalendar } from '../db/schema.js';
import type { IpcResult, CompanySettings, CompanySettingsUpdate, CalendarEntry } from '../../shared/types.js';

function ensureCompanyRow(): void {
  const raw = getSqlite();
  const exists = raw.prepare('SELECT COUNT(*) as cnt FROM companies').get() as { cnt: number };
  if (exists.cnt === 0) {
    raw.prepare('INSERT INTO companies (name) VALUES (?)').run('チクホーシーリング');
  }
}

export function registerCompanyHandlers(): void {
  ipcMain.handle(
    IPC.COMPANY.GET,
    async (_event): Promise<IpcResult<CompanySettings>> => {
      try {
        ensureCompanyRow();
        const db = getDb();
        const row = db.select().from(companies).get();
        return { success: true, data: row as CompanySettings };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '会社情報の取得に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.COMPANY.UPDATE,
    async (_event, params: CompanySettingsUpdate): Promise<IpcResult<CompanySettings>> => {
      try {
        ensureCompanyRow();
        const db = getDb();
        const current = db.select().from(companies).get();
        if (!current) {
          return { success: false, error: '会社情報が見つかりません' };
        }
        db.update(companies).set(params).where(eq(companies.id, current.id)).run();
        const updated = db.select().from(companies).get();
        return { success: true, data: updated as CompanySettings };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '会社情報の更新に失敗しました' };
      }
    },
  );

  // --- カレンダー ---

  ipcMain.handle(
    IPC.CALENDAR.LIST,
    async (_event, params: { year: number }): Promise<IpcResult<CalendarEntry[]>> => {
      try {
        const raw = getSqlite();
        const startDate = `${params.year}-01-01`;
        const endDate = `${params.year + 1}-01-01`;
        const rows = raw.prepare(
          'SELECT id, date, is_holiday AS isHoliday, holiday_name AS holidayName FROM company_calendar WHERE date >= ? AND date < ? ORDER BY date',
        ).all(startDate, endDate) as CalendarEntry[];
        return { success: true, data: rows };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'カレンダーの取得に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.CALENDAR.SET,
    async (_event, params: { date: string; isHoliday: boolean; holidayName?: string }): Promise<IpcResult<{ saved: boolean }>> => {
      try {
        const raw = getSqlite();
        raw.prepare(`
          INSERT INTO company_calendar (date, is_holiday, holiday_name)
          VALUES (?, ?, ?)
          ON CONFLICT(date) DO UPDATE SET is_holiday = excluded.is_holiday, holiday_name = excluded.holiday_name
        `).run(params.date, params.isHoliday ? 1 : 0, params.holidayName ?? null);
        return { success: true, data: { saved: true } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'カレンダーの設定に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.CALENDAR.INIT_YEAR,
    async (_event, params: { year: number; holidays: Array<{ date: string; isHoliday: boolean; holidayName: string | null }> }): Promise<IpcResult<{ count: number }>> => {
      try {
        const raw = getSqlite();
        const insert = raw.prepare(`
          INSERT INTO company_calendar (date, is_holiday, holiday_name)
          VALUES (?, ?, ?)
          ON CONFLICT(date) DO UPDATE SET is_holiday = excluded.is_holiday, holiday_name = excluded.holiday_name
        `);
        const tx = raw.transaction(() => {
          for (const h of params.holidays) {
            insert.run(h.date, h.isHoliday ? 1 : 0, h.holidayName);
          }
        });
        tx();
        return { success: true, data: { count: params.holidays.length } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'カレンダー初期化に失敗しました' };
      }
    },
  );
}
