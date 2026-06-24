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
    update: (data: Partial<PayslipCreate> & { id: number }): Promise<IpcResult<{ updated: boolean }>> =>
      ipcRenderer.invoke(IPC.PAYSLIPS.UPDATE, data),
    delete: (id: number): Promise<IpcResult<{ deleted: boolean }>> =>
      ipcRenderer.invoke(IPC.PAYSLIPS.DELETE, { id }),
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
  },
} as const;

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
