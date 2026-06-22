/**
 * Electron Preload API の型定義
 * Renderer プロセスで window.api を型安全に使用するための宣言
 */

interface ElectronAttendanceApi {
  sync(year: number, month: number): Promise<{
    success: true;
    data: {
      synced: number;
      errors: number;
      warnings: Array<{
        employeeId: number;
        employeeName: string;
        date: string;
        type: string;
        message: string;
      }>;
    };
  } | {
    success: false;
    error: string;
  }>;
  list(year: number, month: number, employeeId?: number): Promise<{
    success: true;
    data: unknown[];
  } | {
    success: false;
    error: string;
  }>;
  rawList(year: number, month: number): Promise<{
    success: true;
    data: import('../../../../shared/types').RawPunch[];
  } | {
    success: false;
    error: string;
  }>;
  roundAll(year: number, month: number): Promise<{
    success: true;
    data: { processed: number };
  } | {
    success: false;
    error: string;
  }>;
  roundOne(employeeId: number, date: string): Promise<{
    success: true;
    data: { ok: boolean };
  } | {
    success: false;
    error: string;
  }>;
  upsert(data: {
    employeeId: number;
    date: string;
    clockIn: string | null;
    clockOut: string | null;
    workMinutes: number;
    overtimeMinutes: number;
    earlyOvertimeMinutes: number;
    breakMinutes: number;
    isHoliday: boolean;
    isHolidayWork: boolean;
    dataSource: string;
    note: string | null;
  }): Promise<{
    success: true;
    data: { id: number };
  } | {
    success: false;
    error: string;
  }>;
}

interface ElectronApi {
  attendance: ElectronAttendanceApi;
  employees: Record<string, (...args: unknown[]) => Promise<unknown>>;
  payslips: Record<string, (...args: unknown[]) => Promise<unknown>>;
  company: Record<string, (...args: unknown[]) => Promise<unknown>>;
  calendar: Record<string, (...args: unknown[]) => Promise<unknown>>;
}

interface Window {
  api: ElectronApi;
}
