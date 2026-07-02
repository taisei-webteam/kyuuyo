/**
 * 社会保険料率マスタ IPC ハンドラ
 *
 * 年度別の社会保険料率（健康保険・介護・厚生年金・雇用保険。いずれも折半後の
 * 被保険者負担分）を管理する。給与計算はここに登録された率を参照する。
 */
import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels.js';
import { getSqlite } from '../db/connection.js';
import type { IpcResult, InsuranceRate, InsuranceRateInput } from '../../shared/types.js';

const SELECT_COLUMNS =
  'id, year, month, health_rate AS healthRate, nursing_rate AS nursingRate, pension_rate AS pensionRate, employment_rate AS employmentRate, prefecture';

/** 料率入力を検証する。不正な場合はエラーメッセージ、正常なら null を返す。 */
function validateRateInput(p: Partial<InsuranceRateInput>): string | null {
  if (typeof p.year !== 'number' || !Number.isInteger(p.year) || p.year < 2000 || p.year > 2100) {
    return '適用年が不正です';
  }
  if (typeof p.month !== 'number' || !Number.isInteger(p.month) || p.month < 1 || p.month > 12) {
    return '適用月が不正です';
  }
  const rateKeys: Array<keyof InsuranceRateInput> = [
    'healthRate',
    'nursingRate',
    'pensionRate',
    'employmentRate',
  ];
  for (const key of rateKeys) {
    const v = p[key];
    // 率は 0〜1 の小数（例: 4.985% = 0.04985）。1(=100%) を超える値は誤入力とみなす。
    if (typeof v !== 'number' || Number.isNaN(v) || v < 0 || v > 1) {
      return '料率は 0〜1 の範囲の小数で入力してください（例: 4.985% = 0.04985）';
    }
  }
  if (typeof p.prefecture !== 'string' || p.prefecture.trim().length === 0) {
    return '都道府県を入力してください';
  }
  return null;
}

export function registerInsuranceRateHandlers(): void {
  ipcMain.handle(
    IPC.INSURANCE_RATES.LIST,
    async (): Promise<IpcResult<InsuranceRate[]>> => {
      try {
        const raw = getSqlite();
        const rows = raw
          .prepare(`SELECT ${SELECT_COLUMNS} FROM insurance_rates ORDER BY year DESC, prefecture ASC`)
          .all() as InsuranceRate[];
        return { success: true, data: rows };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '保険料率の取得に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.INSURANCE_RATES.UPSERT,
    async (_event, params: InsuranceRateInput): Promise<IpcResult<InsuranceRate>> => {
      try {
        const invalid = validateRateInput(params);
        if (invalid) return { success: false, error: invalid };

        const raw = getSqlite();
        const prefecture = params.prefecture.trim();

        // id 指定があれば id 更新、無ければ (year, prefecture) をキーに upsert する。
        if (typeof params.id === 'number') {
          raw
            .prepare(`
              UPDATE insurance_rates
              SET year = ?, month = ?, health_rate = ?, nursing_rate = ?, pension_rate = ?, employment_rate = ?, prefecture = ?
              WHERE id = ?
            `)
            .run(
              params.year,
              params.month,
              params.healthRate,
              params.nursingRate,
              params.pensionRate,
              params.employmentRate,
              prefecture,
              params.id,
            );
        } else {
          raw
            .prepare(`
              INSERT INTO insurance_rates (year, month, health_rate, nursing_rate, pension_rate, employment_rate, prefecture)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(year, prefecture) DO UPDATE SET
                month = excluded.month,
                health_rate = excluded.health_rate,
                nursing_rate = excluded.nursing_rate,
                pension_rate = excluded.pension_rate,
                employment_rate = excluded.employment_rate
            `)
            .run(
              params.year,
              params.month,
              params.healthRate,
              params.nursingRate,
              params.pensionRate,
              params.employmentRate,
              prefecture,
            );
        }

        const row = raw
          .prepare(`SELECT ${SELECT_COLUMNS} FROM insurance_rates WHERE year = ? AND prefecture = ?`)
          .get(params.year, prefecture) as InsuranceRate | undefined;
        if (!row) return { success: false, error: '保存後の料率が取得できませんでした' };
        return { success: true, data: row };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '保険料率の保存に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.INSURANCE_RATES.DELETE,
    async (_event, params: { id: number }): Promise<IpcResult<{ deleted: boolean }>> => {
      try {
        const raw = getSqlite();
        const info = raw.prepare('DELETE FROM insurance_rates WHERE id = ?').run(params.id);
        return { success: true, data: { deleted: info.changes > 0 } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '保険料率の削除に失敗しました' };
      }
    },
  );
}
