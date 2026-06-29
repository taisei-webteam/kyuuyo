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
export type HolidayMode = 'calendar' | 'individual';

export interface Employee {
  id: number;
  name: string;
  nameKana: string;
  email: string;
  birthDate: string | null;
  employeeType: EmployeeType;
  departmentName: string;
  jobTitle: string;
  hireDate: string | null;
  resignDate: string | null;
  displayOrder: number;
  basicSalary: number;
  hourlyRate: number;
  standardMonthlyRemuneration: number;
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
  dependents: number;
  scheduledStart: string;
  scheduledEnd: string;
  holidayMode: HolidayMode;
  earlyWorkStart: string | null;
  earlyWorkEnd: string | null;
  overtimeAllowed: boolean;
  overtimeStart: string | null;
  overtimeEnd: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EmployeeCreate = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;
export type EmployeeUpdate = Partial<EmployeeCreate> & { id: number };

// ========================================
// 実打刻データ
// ========================================

export interface RawPunch {
  id: number;
  employeeId: number;
  date: string;
  rawClockIn: string | null;
  rawClockOut: string | null;
  rawGoOut: string | null;
  rawGoReturn: string | null;
  dataSource: string;
  syncedAt: string;
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
  goOut: string | null;
  goReturn: string | null;
  workMinutes: number;
  overtimeMinutes: number;
  earlyOvertimeMinutes: number;
  breakMinutes: number;
  isHoliday: boolean;
  isHolidayWork: boolean;
  dataSource: DataSource;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceUpsert = Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>;

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
  paymentDate: string | null;
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

export type PayslipCreate = Omit<Payslip, 'id' | 'createdAt' | 'updatedAt'>;

// ========================================
// 会社設定
// ========================================

export interface CompanySettings {
  id: number;
  name: string;
  representativeName: string | null;
  postalCode: string | null;
  address: string | null;
  phone: string | null;
  insuranceNumber: string | null;
  roundingUnit: number;
  gracePeriod: number;
  defaultBreakMinutes: number;
  clockOutRounding: string;
  earlyRoundingUnit: number;
  overtimeRoundingUnit: number;
}

export type CompanySettingsUpdate = Partial<Omit<CompanySettings, 'id'>>;

// ========================================
// 会社カレンダー
// ========================================

export interface CalendarEntry {
  id: number;
  date: string;
  isHoliday: boolean;
  holidayName: string | null;
}

// ========================================
// メール送信（Gmail API）
// ========================================

/** Renderer に返すメール設定の状態（秘密情報は含めない） */
export interface MailConfigStatus {
  senderName: string;
  senderAddress: string;
  clientId: string;
  hasClientSecret: boolean;
  authorized: boolean;
  encryptionAvailable: boolean;
}

/** 設定画面から保存するメール設定（シークレットは任意・未指定なら据え置き） */
export interface MailConfigUpdate {
  senderName: string;
  senderAddress: string;
  clientId: string;
  clientSecret?: string;
}

/** 1通分の送信メッセージ */
export interface MailMessageInput {
  /** 宛先メールアドレス */
  to: string;
  subject: string;
  body: string;
  /** HTML版本文（任意）。指定時は multipart/alternative で併送する */
  html?: string;
  attachments: MailAttachmentInput[];
  /** 呼び出し側で結果を突き合わせるための任意キー（例: 従業員ID） */
  refId?: number;
}

export interface MailAttachmentInput {
  filename: string;
  /** PDF 本体の base64 文字列 */
  contentBase64: string;
  mimeType?: string;
}

/** 1通分の送信結果 */
export interface MailSendResult {
  to: string;
  refId?: number;
  success: boolean;
  error?: string;
}

// ========================================
// メール送信履歴（永続化）
// ========================================

/** DB に保存されたメール送信記録 */
export interface EmailLog {
  id: number;
  employeeId: number;
  /** 'payslip' | 'bonus' */
  type: string;
  /** 期間キー（例: 'payslip-2026-5' / 'bonus-2026-夏季'） */
  periodKey: string;
  toAddress: string | null;
  sentAt: string;
}

/** 送信記録の登録入力 */
export interface EmailLogInput {
  employeeId: number;
  type: 'payslip' | 'bonus';
  periodKey: string;
  toAddress?: string | null;
}

// ========================================
// データバックアップ
// ========================================

/** バックアップファイル1件の情報 */
export interface BackupInfo {
  /** ファイル名（例: rakuraku-kyuuyo-20260629-161507.db） */
  fileName: string;
  /** 絶対パス */
  path: string;
  /** ファイルサイズ（バイト） */
  size: number;
  /** 作成日時（ISO文字列） */
  createdAt: string;
}
