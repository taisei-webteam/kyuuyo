export const IPC = {
  EMPLOYEES: {
    LIST: 'employees:list',
    GET: 'employees:get',
    CREATE: 'employees:create',
    UPDATE: 'employees:update',
    DELETE: 'employees:delete',
  },
  PAYSLIPS: {
    LIST: 'payslips:list',
    GET: 'payslips:get',
    CREATE: 'payslips:create',
    CREATE_BULK: 'payslips:create-bulk',
    UPDATE: 'payslips:update',
    DELETE: 'payslips:delete',
  },
  ATTENDANCE: {
    SYNC: 'attendance:sync',
    LIST: 'attendance:list',
    GET: 'attendance:get',
    UPSERT: 'attendance:upsert',
    SYNC_EMPLOYEES: 'attendance:sync-employees',
    VALIDATE: 'attendance:validate',
    RAW_LIST: 'attendance:raw-list',
    ROUND_ALL: 'attendance:round-all',
    ROUND_ONE: 'attendance:round-one',
  },
  COMPANY: {
    GET: 'company:get',
    UPDATE: 'company:update',
  },
  CALENDAR: {
    LIST: 'calendar:list',
    SET: 'calendar:set',
    INIT_YEAR: 'calendar:init-year',
  },
  EXPORT: {
    PDF: 'export:pdf',
    CSV: 'export:csv',
  },
} as const;
