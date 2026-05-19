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
  },
  COMPANY: {
    GET: 'company:get',
    UPDATE: 'company:update',
  },
  EXPORT: {
    PDF: 'export:pdf',
    CSV: 'export:csv',
  },
} as const;
