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
    data: import('../../../../shared/types').AttendanceRecord[];
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
  syncEmployees(employees: Array<{
    id: number;
    name: string;
    name_kana: string;
    employee_type: string;
    display_order: number;
    is_active: boolean;
  }>): Promise<{
    success: true;
    data: { synced: number };
  } | {
    success: false;
    error: string;
  }>;
  upsert(data: {
    employeeId: number;
    date: string;
    clockIn: string | null;
    clockOut: string | null;
    goOut: string | null;
    goReturn: string | null;
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

interface ElectronEmployeesApi {
  list(): Promise<{
    success: true;
    data: import('../../../../shared/types').Employee[];
  } | {
    success: false;
    error: string;
  }>;
  get(id: number): Promise<{
    success: true;
    data: import('../../../../shared/types').Employee | null;
  } | {
    success: false;
    error: string;
  }>;
  create(data: import('../../../../shared/types').EmployeeCreate): Promise<{
    success: true;
    data: { id: number };
  } | {
    success: false;
    error: string;
  }>;
  update(data: import('../../../../shared/types').EmployeeUpdate): Promise<{
    success: true;
    data: { updated: boolean };
  } | {
    success: false;
    error: string;
  }>;
  delete(id: number): Promise<{
    success: true;
    data: { deleted: boolean };
  } | {
    success: false;
    error: string;
  }>;
}

interface ElectronExportApi {
  pdf(params?: {
    fileName?: string;
    pageSize?: 'A4' | 'A3';
    landscape?: boolean;
  }): Promise<{
    success: true;
    data: { path: string };
  } | {
    success: false;
    error: string;
  }>;
}

interface ElectronApi {
  attendance: ElectronAttendanceApi;
  employees: ElectronEmployeesApi;
  payslips: Record<string, (...args: unknown[]) => Promise<unknown>>;
  company: Record<string, (...args: unknown[]) => Promise<unknown>>;
  calendar: Record<string, (...args: unknown[]) => Promise<unknown>>;
  export: ElectronExportApi;
}

interface Window {
  api: ElectronApi;
}
