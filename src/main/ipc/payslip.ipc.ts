/**
 * 給与明細 IPC ハンドラ
 */
import { ipcMain } from 'electron';
import { eq, and } from 'drizzle-orm';
import { IPC } from '../../shared/ipc-channels.js';
import { getDb, getSqlite } from '../db/connection.js';
import { payslips } from '../db/schema.js';
import type { IpcResult, Payslip, PayslipCreate } from '../../shared/types.js';

export function registerPayslipHandlers(): void {
  ipcMain.handle(
    IPC.PAYSLIPS.LATEST_SALARY_PERIOD,
    async (): Promise<IpcResult<{ year: number; month: number } | null>> => {
      try {
        const raw = getSqlite();
        const row = raw
          .prepare(
            `SELECT year, month FROM payslips
             WHERE payslip_type = 'salary'
             GROUP BY year, month
             ORDER BY year DESC, month DESC
             LIMIT 1`,
          )
          .get() as { year: number; month: number } | undefined;
        return { success: true, data: row ?? null };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : '最新の給与作成分の取得に失敗しました',
        };
      }
    },
  );

  ipcMain.handle(
    IPC.PAYSLIPS.LIST,
    async (_event, params: { year: number; month: number; type?: string }): Promise<IpcResult<Payslip[]>> => {
      try {
        const db = getDb();
        const conditions = [
          eq(payslips.year, params.year),
          eq(payslips.month, params.month),
        ];
        if (params.type) {
          conditions.push(eq(payslips.payslipType, params.type));
        }
        const rows = db.select().from(payslips).where(and(...conditions)).all();
        return { success: true, data: rows as Payslip[] };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '給与明細一覧の取得に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.PAYSLIPS.GET,
    async (_event, params: { id: number }): Promise<IpcResult<Payslip | null>> => {
      try {
        const db = getDb();
        const row = db.select().from(payslips).where(eq(payslips.id, params.id)).get();
        return { success: true, data: (row as Payslip) ?? null };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '給与明細の取得に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.PAYSLIPS.CREATE,
    async (_event, params: PayslipCreate): Promise<IpcResult<{ id: number }>> => {
      try {
        const db = getDb();
        const result = db.insert(payslips).values(params).run();
        return { success: true, data: { id: Number(result.lastInsertRowid) } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '給与明細の作成に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.PAYSLIPS.CREATE_BULK,
    async (_event, params: { items: PayslipCreate[] }): Promise<IpcResult<{ count: number }>> => {
      try {
        const raw = getSqlite();
        const db = getDb();
        const tx = raw.transaction(() => {
          for (const item of params.items) {
            db.insert(payslips).values(item).run();
          }
        });
        tx();
        return { success: true, data: { count: params.items.length } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '給与明細の一括作成に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.PAYSLIPS.SAVE_MONTH,
    async (
      _event,
      params: { year: number; month: number; type?: string; items: PayslipCreate[] },
    ): Promise<IpcResult<{ count: number }>> => {
      try {
        const raw = getSqlite();
        const db = getDb();
        const type = params.type ?? 'salary';
        // 指定年月・種別の明細を一括置換する（編集・再作成を冪等に反映）。
        // UNIQUE(employee_id, year, month, payslip_type) の競合を避けるため
        // 削除 → 挿入を 1 トランザクションで実施する。
        const tx = raw.transaction(() => {
          db.delete(payslips)
            .where(
              and(
                eq(payslips.year, params.year),
                eq(payslips.month, params.month),
                eq(payslips.payslipType, type),
              ),
            )
            .run();
          for (const item of params.items) {
            db.insert(payslips).values(item).run();
          }
        });
        tx();
        return { success: true, data: { count: params.items.length } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '給与明細の保存に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.PAYSLIPS.UPDATE,
    async (_event, params: Partial<PayslipCreate> & { id: number }): Promise<IpcResult<{ updated: boolean }>> => {
      try {
        const db = getDb();
        const { id, ...data } = params;
        db.update(payslips).set(data).where(eq(payslips.id, id)).run();
        return { success: true, data: { updated: true } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '給与明細の更新に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.PAYSLIPS.DELETE,
    async (_event, params: { id: number }): Promise<IpcResult<{ deleted: boolean }>> => {
      try {
        const db = getDb();
        db.delete(payslips).where(eq(payslips.id, params.id)).run();
        return { success: true, data: { deleted: true } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '給与明細の削除に失敗しました' };
      }
    },
  );
}
