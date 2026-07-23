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
  upsert(data: import('../../../../shared/types').AttendanceUpsert): Promise<{
    success: true;
    data: { id: number };
  } | {
    success: false;
    error: string;
  }>;
  getSyncConfig(): Promise<{
    success: true;
    data: import('../../../../shared/types').PunchSyncConfigStatus;
  } | {
    success: false;
    error: string;
  }>;
  setSyncConfig(data: import('../../../../shared/types').PunchSyncConfigUpdate): Promise<{
    success: true;
    data: import('../../../../shared/types').PunchSyncConfigStatus;
  } | {
    success: false;
    error: string;
  }>;
  testSyncConfig(): Promise<{
    success: true;
    data: { ok: boolean };
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
  pdfBuffer(params?: {
    fileName?: string;
    pageSize?: 'A4' | 'A3';
    landscape?: boolean;
  }): Promise<{
    success: true;
    data: { base64: string };
  } | {
    success: false;
    error: string;
  }>;
  csv(params: { fileName?: string; content: string }): Promise<{
    success: true;
    data: { path: string | null };
  } | {
    success: false;
    error: string;
  }>;
}

interface ElectronMailApi {
  getConfig(): Promise<{
    success: true;
    data: import('../../shared/types').MailConfigStatus;
  } | {
    success: false;
    error: string;
  }>;
  setConfig(data: import('../../shared/types').MailConfigUpdate): Promise<{
    success: true;
    data: import('../../shared/types').MailConfigStatus;
  } | {
    success: false;
    error: string;
  }>;
  authorize(): Promise<{
    success: true;
    data: { authorized: boolean; email: string };
  } | {
    success: false;
    error: string;
  }>;
  send(messages: import('../../shared/types').MailMessageInput[]): Promise<{
    success: true;
    data: import('../../shared/types').MailSendResult[];
  } | {
    success: false;
    error: string;
  }>;
  test(): Promise<{
    success: true;
    data: import('../../shared/types').MailSendResult;
  } | {
    success: false;
    error: string;
  }>;
  logList(type: string, periodKey: string): Promise<{
    success: true;
    data: import('../../shared/types').EmailLog[];
  } | {
    success: false;
    error: string;
  }>;
  logRecord(data: import('../../shared/types').EmailLogInput): Promise<{
    success: true;
    data: { recorded: boolean };
  } | {
    success: false;
    error: string;
  }>;
}

interface ElectronPayslipsApi {
  list(year: number, month: number, type?: string): Promise<{
    success: true;
    data: import('../../shared/types').Payslip[];
  } | {
    success: false;
    error: string;
  }>;
  get(id: number): Promise<{
    success: true;
    data: import('../../shared/types').Payslip | null;
  } | {
    success: false;
    error: string;
  }>;
  create(data: import('../../shared/types').PayslipCreate): Promise<{
    success: true;
    data: { id: number };
  } | {
    success: false;
    error: string;
  }>;
  createBulk(items: import('../../shared/types').PayslipCreate[]): Promise<{
    success: true;
    data: { count: number };
  } | {
    success: false;
    error: string;
  }>;
  saveMonth(
    year: number,
    month: number,
    type: string,
    items: import('../../shared/types').PayslipCreate[],
  ): Promise<{
    success: true;
    data: { count: number };
  } | {
    success: false;
    error: string;
  }>;
  update(data: Partial<import('../../shared/types').PayslipCreate> & { id: number }): Promise<{
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
  latestSalaryPeriod(): Promise<{
    success: true;
    data: { year: number; month: number } | null;
  } | {
    success: false;
    error: string;
  }>;
}

interface ElectronBackupApi {
  run(): Promise<{
    success: true;
    data: import('../../shared/types').BackupInfo;
  } | {
    success: false;
    error: string;
  }>;
  list(): Promise<{
    success: true;
    data: import('../../shared/types').BackupInfo[];
  } | {
    success: false;
    error: string;
  }>;
  openDir(): Promise<{
    success: true;
    data: { opened: boolean };
  } | {
    success: false;
    error: string;
  }>;
  restore(fileName: string): Promise<{
    success: true;
    data: { restored: boolean };
  } | {
    success: false;
    error: string;
  }>;
}

interface ElectronCompanyApi {
  get(): Promise<{
    success: true;
    data: import('../../shared/types').CompanySettings;
  } | {
    success: false;
    error: string;
  }>;
  update(data: import('../../shared/types').CompanySettingsUpdate): Promise<{
    success: true;
    data: import('../../shared/types').CompanySettings;
  } | {
    success: false;
    error: string;
  }>;
}

interface ElectronCalendarApi {
  list(year: number): Promise<{
    success: true;
    data: import('../../shared/types').CalendarEntry[];
  } | {
    success: false;
    error: string;
  }>;
  set(date: string, isHoliday: boolean, holidayName?: string): Promise<{
    success: true;
    data: { saved: boolean };
  } | {
    success: false;
    error: string;
  }>;
  initYear(
    year: number,
    holidays: Array<{ date: string; isHoliday: boolean; holidayName: string | null }>,
  ): Promise<{
    success: true;
    data: { count: number };
  } | {
    success: false;
    error: string;
  }>;
}

interface ElectronInsuranceRatesApi {
  list(): Promise<{
    success: true;
    data: import('../../shared/types').InsuranceRate[];
  } | {
    success: false;
    error: string;
  }>;
  upsert(data: import('../../shared/types').InsuranceRateInput): Promise<{
    success: true;
    data: import('../../shared/types').InsuranceRate;
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

interface ElectronApi {
  attendance: ElectronAttendanceApi;
  employees: ElectronEmployeesApi;
  payslips: ElectronPayslipsApi;
  company: ElectronCompanyApi;
  calendar: ElectronCalendarApi;
  export: ElectronExportApi;
  mail: ElectronMailApi;
  backup: ElectronBackupApi;
  insuranceRates: ElectronInsuranceRatesApi;
}

interface Window {
  api: ElectronApi;
}
