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
  /** 通勤手当のうち課税対象となる額（非課税限度超過分）。0=全額非課税。源泉所得税の課税ベースに算入する。 */
  taxableTransport: number;
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
  /** 賞与を支給するか。役員のみ判定に使用（社員は常に対象・パートは対象外）。 */
  bonusEligible: boolean;
  /** 雇用保険料超過分（支給項目）。雇用保険控除の算定基数には含めない。 */
  employmentInsuranceOverage: number;
  /** 有給残日数（手入力。0.5日単位可。自動計算は未実装） */
  paidLeaveBalance: number | null;
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

/** 有給の取得区分（1日あたり） */
export type PaidLeaveUsage = 'full' | 'am' | 'pm';

/** 有給の確定状態（実績 or 予定） */
export type PaidLeaveStatus = 'confirmed' | 'planned';

/** 有給区分を消化日数に換算する（全日=1、半日=0.5） */
export function paidLeaveUsageToDays(usage: PaidLeaveUsage | null | undefined): number {
  if (!usage) return 0;
  return usage === 'full' ? 1 : 0.5;
}

/** 確定済み有給のみ消化日数に換算する（予定は0） */
export function confirmedPaidLeaveDays(
  usage: PaidLeaveUsage | null | undefined,
  status: PaidLeaveStatus | null | undefined,
): number {
  if (!usage || status === 'planned') return 0;
  return paidLeaveUsageToDays(usage);
}

/** 有給日数の表示用文字列（0.5単位。0は「-」） */
export function formatPaidLeaveDays(days: number): string {
  if (days <= 0) return '-';
  const rounded = Math.round(days * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export const PAID_LEAVE_USAGE_LABELS: Record<PaidLeaveUsage, string> = {
  full: '全日',
  am: '午前',
  pm: '午後',
};

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
  paidLeaveUsage: PaidLeaveUsage | null;
  paidLeaveStatus: PaidLeaveStatus | null;
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

/** 給与明細の追加行（雇用保険料超過分など、頻度の低い項目） */
export interface PayslipExtraLine {
  id: string;
  label: string;
  amount: number;
}

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
  /** 当月の確定有給取得日数（0.5日単位） */
  paidLeaveDays: number;
  basicSalary: number;
  overtimePay: number;
  transportAllowance: number;
  positionAllowance: number;
  familyAllowance: number;
  specialAllowance: number;
  dangerAllowance: number;
  salesAllowance: number;
  otherAllowance: number;
  /** JSON: PayslipExtraLine[] */
  extraPaymentLines: string;
  /** JSON: PayslipExtraLine[] */
  extraDeductionLines: string;
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
  monthlyWorkHours: number;
  /** 有給残日数のリセット基準月（1〜12）。未設定時は手動管理 */
  paidLeaveResetMonth: number | null;
  /** 有給休暇規程・運用メモ（自由記述） */
  paidLeavePolicy: string | null;
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

/** 打刻連携(Neon)接続設定の状態。接続文字列自体は返さずマスク表示する。 */
export interface PunchSyncConfigStatus {
  /** 実効的に接続先が決まっているか（保存済み or 環境変数） */
  configured: boolean;
  /** 接続文字列の取得元 */
  source: 'stored' | 'env' | 'none';
  /** この端末で暗号化保存が使えるか */
  encryptionAvailable: boolean;
  /** 認証情報を伏せたマスク表示（例: postgresql://***@host/db） */
  maskedUrl: string;
}

/** 打刻連携(Neon)接続設定の更新。databaseUrl が空文字なら保存を削除する。 */
export interface PunchSyncConfigUpdate {
  databaseUrl: string;
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
// 社会保険料率マスタ
// ========================================

/** 年度別の社会保険料率（いずれも被保険者負担分＝折半後の率） */
export interface InsuranceRate {
  id: number;
  /** 適用年（例: 2024 = 令和6年度） */
  year: number;
  /** 適用開始月（協会けんぽは通常3月分＝4月納付。既定4） */
  month: number;
  /** 健康保険料率（被保険者負担分。都道府県ごとに異なる） */
  healthRate: number;
  /** 介護保険料率（被保険者負担分。40歳以上に適用） */
  nursingRate: number;
  /** 厚生年金保険料率（被保険者負担分。全国一律） */
  pensionRate: number;
  /** 雇用保険料率（被保険者負担分。総支給額ベース） */
  employmentRate: number;
  /** 都道府県（健康保険料率の根拠。既定 '全国'） */
  prefecture: string;
}

/** 料率の新規登録／更新入力（id があれば更新、無ければ年度+都道府県で upsert） */
export type InsuranceRateInput = Omit<InsuranceRate, 'id'> & { id?: number };

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
