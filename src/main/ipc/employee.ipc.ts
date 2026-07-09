/**
 * 従業員マスタ IPC ハンドラ
 */
import { ipcMain } from 'electron';
import { eq } from 'drizzle-orm';
import { IPC } from '../../shared/ipc-channels.js';
import { getDb } from '../db/connection.js';
import { employees } from '../db/schema.js';
import type { IpcResult, Employee, EmployeeCreate, EmployeeUpdate } from '../../shared/types.js';

export function registerEmployeeHandlers(): void {
  ipcMain.handle(
    IPC.EMPLOYEES.LIST,
    async (_event): Promise<IpcResult<Employee[]>> => {
      try {
        const db = getDb();
        const rows = db.select().from(employees).orderBy(employees.displayOrder).all();
        return { success: true, data: rows as Employee[] };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '従業員一覧の取得に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.EMPLOYEES.GET,
    async (_event, params: { id: number }): Promise<IpcResult<Employee | null>> => {
      try {
        const db = getDb();
        const row = db.select().from(employees).where(eq(employees.id, params.id)).get();
        return { success: true, data: (row as Employee) ?? null };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '従業員の取得に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.EMPLOYEES.CREATE,
    async (_event, params: EmployeeCreate): Promise<IpcResult<{ id: number }>> => {
      try {
        const db = getDb();
        const result = db.insert(employees).values({
          name: params.name,
          nameKana: params.nameKana,
          email: params.email,
          birthDate: params.birthDate,
          employeeType: params.employeeType,
          departmentName: params.departmentName,
          jobTitle: params.jobTitle,
          hireDate: params.hireDate,
          resignDate: params.resignDate,
          displayOrder: params.displayOrder,
          basicSalary: params.basicSalary,
          hourlyRate: params.hourlyRate,
          standardMonthlyRemuneration: params.standardMonthlyRemuneration,
          transportAllowance: params.transportAllowance,
          taxableTransport: params.taxableTransport,
          positionAllowance: params.positionAllowance,
          familyAllowance: params.familyAllowance,
          specialAllowance: params.specialAllowance,
          dangerAllowance: params.dangerAllowance,
          salesAllowance: params.salesAllowance,
          healthInsurance: params.healthInsurance,
          welfarePension: params.welfarePension,
          residentTax: params.residentTax,
          savingsDeduction: params.savingsDeduction,
          loanDeduction: params.loanDeduction,
          dependents: params.dependents,
          scheduledStart: params.scheduledStart,
          scheduledEnd: params.scheduledEnd,
          holidayMode: params.holidayMode,
          earlyWorkStart: params.earlyWorkStart,
          earlyWorkEnd: params.earlyWorkEnd,
          bonusEligible: params.bonusEligible,
          employmentInsuranceOverage: params.employmentInsuranceOverage,
          paidLeaveBalance: params.paidLeaveBalance,
          isActive: params.isActive,
        }).run();
        return { success: true, data: { id: Number(result.lastInsertRowid) } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '従業員の作成に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.EMPLOYEES.UPDATE,
    async (_event, params: EmployeeUpdate): Promise<IpcResult<{ updated: boolean }>> => {
      try {
        const db = getDb();
        const { id, ...data } = params;
        db.update(employees).set(data).where(eq(employees.id, id)).run();
        return { success: true, data: { updated: true } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '従業員の更新に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.EMPLOYEES.DELETE,
    async (_event, params: { id: number }): Promise<IpcResult<{ deleted: boolean }>> => {
      try {
        const db = getDb();
        db.update(employees)
          .set({ isActive: false })
          .where(eq(employees.id, params.id))
          .run();
        return { success: true, data: { deleted: true } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '従業員の削除に失敗しました' };
      }
    },
  );
}
