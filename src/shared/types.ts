// ========================================
// IPC 通信の共有型定義
// ========================================

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ========================================
// 従業員
// ========================================

export type EmployeeType = '社員' | '役員' | 'パート';

export interface Employee {
  id: number;
  name: string;
  nameKana: string;
  employeeType: EmployeeType;
  departmentName: string;
  jobTitle: string;
  hireDate: string;
  resignDate: string | null;
  displayOrder: number;
  basicSalary: number;
  transportAllowance: number;
  positionAllowance: number;
  familyAllowance: number;
  specialAllowance: number;
  dangerAllowance: number;
  salesAllowance: number;
  healthInsurance: number;
  welfarePension: number;
  residentTax: number;
  savingsDeduction: number;
  loanDeduction: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ========================================
// 勤怠
// ========================================

export type DataSource = 'ipad' | 'manual';

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  workMinutes: number;
  overtimeMinutes: number;
  isHoliday: boolean;
  dataSource: DataSource;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceSyncResult {
  synced: number;
  errors: number;
  warnings: AttendanceWarning[];
}

export interface AttendanceWarning {
  employeeId: number;
  employeeName: string;
  date: string;
  type: 'missing_clock_out' | 'missing_clock_in' | 'double_punch' | 'abnormal_hours' | 'holiday_work' | 'overtime_excess';
  message: string;
}

// ========================================
// 給与明細
// ========================================

export interface Payslip {
  id: number;
  employeeId: number;
  year: number;
  month: number;
  paymentDate: string;
  payslipType: 'salary' | 'bonus';
  bonusSeason: string | null;
  workDays: number;
  workHours: number;
  overtimeHours: number;
  holidayWorkDays: number;
  basicSalary: number;
  overtimePay: number;
  transportAllowance: number;
  positionAllowance: number;
  familyAllowance: number;
  specialAllowance: number;
  dangerAllowance: number;
  salesAllowance: number;
  otherAllowance: number;
  totalPayment: number;
  healthInsurance: number;
  nursingInsurance: number;
  welfarePension: number;
  employmentInsurance: number;
  incomeTax: number;
  residentTax: number;
  savingsDeduction: number;
  loanDeduction: number;
  otherDeduction: number;
  totalDeduction: number;
  netPayment: number;
  createdAt: string;
  updatedAt: string;
}
