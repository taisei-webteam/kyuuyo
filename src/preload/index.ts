/**
 * Preload Script — contextBridge 経由で Renderer に IPC API を公開
 *
 * nodeIntegration: false, contextIsolation: true の環境で安全に使用。
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import type {
  IpcResult,
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  AttendanceRecord,
  AttendanceUpsert,
  AttendanceSyncResult,
  AttendanceWarning,
  RawPunch,
  Payslip,
  PayslipCreate,
  CompanySettings,
  CompanySettingsUpdate,
  CalendarEntry,
  MailConfigStatus,
  MailConfigUpdate,
  MailMessageInput,
  MailSendResult,
  PunchSyncConfigStatus,
  PunchSyncConfigUpdate,
  EmailLog,
  EmailLogInput,
  BackupInfo,
  InsuranceRate,
  InsuranceRateInput,
  UpdaterEvent,
} from '../shared/types.js';

const api = {
  employees: {
    list: (): Promise<IpcResult<Employee[]>> =>
      ipcRenderer.invoke(IPC.EMPLOYEES.LIST),
    get: (id: number): Promise<IpcResult<Employee | null>> =>
      ipcRenderer.invoke(IPC.EMPLOYEES.GET, { id }),
    create: (data: EmployeeCreate): Promise<IpcResult<{ id: number }>> =>
      ipcRenderer.invoke(IPC.EMPLOYEES.CREATE, data),
    update: (data: EmployeeUpdate): Promise<IpcResult<{ updated: boolean }>> =>
      ipcRenderer.invoke(IPC.EMPLOYEES.UPDATE, data),
    delete: (id: number): Promise<IpcResult<{ deleted: boolean }>> =>
      ipcRenderer.invoke(IPC.EMPLOYEES.DELETE, { id }),
  },

  payslips: {
    list: (year: number, month: number, type?: string): Promise<IpcResult<Payslip[]>> =>
      ipcRenderer.invoke(IPC.PAYSLIPS.LIST, { year, month, type }),
    get: (id: number): Promise<IpcResult<Payslip | null>> =>
      ipcRenderer.invoke(IPC.PAYSLIPS.GET, { id }),
    create: (data: PayslipCreate): Promise<IpcResult<{ id: number }>> =>
      ipcRenderer.invoke(IPC.PAYSLIPS.CREATE, data),
    createBulk: (items: PayslipCreate[]): Promise<IpcResult<{ count: number }>> =>
      ipcRenderer.invoke(IPC.PAYSLIPS.CREATE_BULK, { items }),
    saveMonth: (
      year: number,
      month: number,
      type: string,
      items: PayslipCreate[],
    ): Promise<IpcResult<{ count: number }>> =>
      ipcRenderer.invoke(IPC.PAYSLIPS.SAVE_MONTH, { year, month, type, items }),
    update: (data: Partial<PayslipCreate> & { id: number }): Promise<IpcResult<{ updated: boolean }>> =>
      ipcRenderer.invoke(IPC.PAYSLIPS.UPDATE, data),
    delete: (id: number): Promise<IpcResult<{ deleted: boolean }>> =>
      ipcRenderer.invoke(IPC.PAYSLIPS.DELETE, { id }),
    latestSalaryPeriod: (): Promise<IpcResult<{ year: number; month: number } | null>> =>
      ipcRenderer.invoke(IPC.PAYSLIPS.LATEST_SALARY_PERIOD),
  },

  attendance: {
    sync: (year: number, month: number): Promise<IpcResult<AttendanceSyncResult>> =>
      ipcRenderer.invoke(IPC.ATTENDANCE.SYNC, { year, month }),
    list: (year: number, month: number, employeeId?: number): Promise<IpcResult<AttendanceRecord[]>> =>
      ipcRenderer.invoke(IPC.ATTENDANCE.LIST, { year, month, employeeId }),
    upsert: (data: AttendanceUpsert): Promise<IpcResult<{ id: number }>> =>
      ipcRenderer.invoke(IPC.ATTENDANCE.UPSERT, data),
    syncEmployees: (employees: Array<{ id: number; name: string; name_kana: string; employee_type: string; display_order: number; is_active: boolean }>): Promise<IpcResult<{ synced: number }>> =>
      ipcRenderer.invoke(IPC.ATTENDANCE.SYNC_EMPLOYEES, { employees }),
    validate: (year: number, month: number): Promise<IpcResult<AttendanceWarning[]>> =>
      ipcRenderer.invoke(IPC.ATTENDANCE.VALIDATE, { year, month }),
    rawList: (year: number, month: number): Promise<IpcResult<RawPunch[]>> =>
      ipcRenderer.invoke(IPC.ATTENDANCE.RAW_LIST, { year, month }),
    roundAll: (year: number, month: number): Promise<IpcResult<{ processed: number }>> =>
      ipcRenderer.invoke(IPC.ATTENDANCE.ROUND_ALL, { year, month }),
    roundOne: (employeeId: number, date: string): Promise<IpcResult<{ ok: boolean }>> =>
      ipcRenderer.invoke(IPC.ATTENDANCE.ROUND_ONE, { employeeId, date }),
    getSyncConfig: (): Promise<IpcResult<PunchSyncConfigStatus>> =>
      ipcRenderer.invoke(IPC.ATTENDANCE.GET_SYNC_CONFIG),
    setSyncConfig: (data: PunchSyncConfigUpdate): Promise<IpcResult<PunchSyncConfigStatus>> =>
      ipcRenderer.invoke(IPC.ATTENDANCE.SET_SYNC_CONFIG, data),
    testSyncConfig: (): Promise<IpcResult<{ ok: boolean }>> =>
      ipcRenderer.invoke(IPC.ATTENDANCE.TEST_SYNC_CONFIG),
  },

  company: {
    get: (): Promise<IpcResult<CompanySettings>> =>
      ipcRenderer.invoke(IPC.COMPANY.GET),
    update: (data: CompanySettingsUpdate): Promise<IpcResult<CompanySettings>> =>
      ipcRenderer.invoke(IPC.COMPANY.UPDATE, data),
  },

  calendar: {
    list: (year: number): Promise<IpcResult<CalendarEntry[]>> =>
      ipcRenderer.invoke(IPC.CALENDAR.LIST, { year }),
    set: (date: string, isHoliday: boolean, holidayName?: string): Promise<IpcResult<{ saved: boolean }>> =>
      ipcRenderer.invoke(IPC.CALENDAR.SET, { date, isHoliday, holidayName }),
    initYear: (year: number, holidays: Array<{ date: string; isHoliday: boolean; holidayName: string | null }>): Promise<IpcResult<{ count: number }>> =>
      ipcRenderer.invoke(IPC.CALENDAR.INIT_YEAR, { year, holidays }),
  },

  export: {
    pdf: (params?: {
      fileName?: string
      pageSize?: 'A4' | 'A3'
      landscape?: boolean
    }): Promise<IpcResult<{ path: string }>> =>
      ipcRenderer.invoke(IPC.EXPORT.PDF, params ?? {}),
    pdfBuffer: (params?: {
      fileName?: string
      pageSize?: 'A4' | 'A3'
      landscape?: boolean
    }): Promise<IpcResult<{ base64: string }>> =>
      ipcRenderer.invoke(IPC.EXPORT.PDF_BUFFER, params ?? {}),
    csv: (params: { fileName?: string; content: string }): Promise<IpcResult<{ path: string | null }>> =>
      ipcRenderer.invoke(IPC.EXPORT.CSV, params),
  },

  mail: {
    getConfig: (): Promise<IpcResult<MailConfigStatus>> =>
      ipcRenderer.invoke(IPC.MAIL.GET_CONFIG),
    setConfig: (data: MailConfigUpdate): Promise<IpcResult<MailConfigStatus>> =>
      ipcRenderer.invoke(IPC.MAIL.SET_CONFIG, data),
    authorize: (): Promise<IpcResult<{ authorized: boolean; email: string }>> =>
      ipcRenderer.invoke(IPC.MAIL.AUTHORIZE),
    send: (messages: MailMessageInput[]): Promise<IpcResult<MailSendResult[]>> =>
      ipcRenderer.invoke(IPC.MAIL.SEND, { messages }),
    test: (): Promise<IpcResult<MailSendResult>> =>
      ipcRenderer.invoke(IPC.MAIL.TEST),
    logList: (type: string, periodKey: string): Promise<IpcResult<EmailLog[]>> =>
      ipcRenderer.invoke(IPC.MAIL.LOG_LIST, { type, periodKey }),
    logRecord: (data: EmailLogInput): Promise<IpcResult<{ recorded: boolean }>> =>
      ipcRenderer.invoke(IPC.MAIL.LOG_RECORD, data),
  },

  backup: {
    run: (): Promise<IpcResult<BackupInfo>> =>
      ipcRenderer.invoke(IPC.BACKUP.RUN),
    list: (): Promise<IpcResult<BackupInfo[]>> =>
      ipcRenderer.invoke(IPC.BACKUP.LIST),
    openDir: (): Promise<IpcResult<{ opened: boolean }>> =>
      ipcRenderer.invoke(IPC.BACKUP.OPEN_DIR),
    restore: (fileName: string): Promise<IpcResult<{ restored: boolean }>> =>
      ipcRenderer.invoke(IPC.BACKUP.RESTORE, { fileName }),
  },

  insuranceRates: {
    list: (): Promise<IpcResult<InsuranceRate[]>> =>
      ipcRenderer.invoke(IPC.INSURANCE_RATES.LIST),
    upsert: (data: InsuranceRateInput): Promise<IpcResult<InsuranceRate>> =>
      ipcRenderer.invoke(IPC.INSURANCE_RATES.UPSERT, data),
    delete: (id: number): Promise<IpcResult<{ deleted: boolean }>> =>
      ipcRenderer.invoke(IPC.INSURANCE_RATES.DELETE, { id }),
  },

  app: {
    /** アプリの現在バージョンを取得する。 */
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP.GET_VERSION),
  },

  updater: {
    /** 自動更新イベントを購読する。戻り値の関数で購読解除。 */
    onEvent: (callback: (event: UpdaterEvent) => void): (() => void) => {
      const listener = (_e: unknown, payload: UpdaterEvent): void => callback(payload);
      ipcRenderer.on(IPC.UPDATER.EVENT, listener);
      return () => ipcRenderer.removeListener(IPC.UPDATER.EVENT, listener);
    },
    /** 購読前に発生した直近の状態を取得する。 */
    getState: (): Promise<UpdaterEvent | null> =>
      ipcRenderer.invoke(IPC.UPDATER.GET_STATE),
    /** 今すぐ更新を適用して再起動する。 */
    quitAndInstall: (): Promise<void> =>
      ipcRenderer.invoke(IPC.UPDATER.QUIT_AND_INSTALL),
  },
} as const;

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
