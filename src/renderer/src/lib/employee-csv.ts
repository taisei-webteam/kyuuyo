/**
 * 従業員マスタの CSV 入出力。
 * テスト用アプリで入れた時給・定時などを、別PCのアプリへ移すために使う。
 * 取り込みは従業員IDではなく氏名（空白を無視）で突き合わせる。
 * 空欄のセルは既存の値を残す。0 や「いいえ」など文字があるセルだけ上書きする。
 */
import type { HolidayMode, MockEmployee } from '@/lib/mock-data'

export interface EmployeeCsvPatch {
  name: string
  nameKana?: string
  email?: string
  birthDate?: string
  employeeType?: MockEmployee['employeeType']
  departmentName?: string
  jobTitle?: string
  hireDate?: string
  resignDate?: string | null
  displayOrder?: number
  basicSalary?: number
  hourlyRate?: number
  standardMonthlyRemuneration?: number
  transportAllowance?: number
  taxableTransport?: number
  positionAllowance?: number
  familyAllowance?: number
  specialAllowance?: number
  dangerAllowance?: number
  salesAllowance?: number
  healthInsurance?: number
  healthInsuranceManual?: boolean
  welfarePension?: number
  residentTax?: number
  savingsDeduction?: number
  loanDeduction?: number
  dependents?: number
  scheduledStart?: string
  scheduledEnd?: string
  holidayMode?: HolidayMode
  earlyWorkStart?: string | null
  earlyWorkEnd?: string | null
  overtimeAllowed?: boolean
  overtimeStart?: string | null
  overtimeEnd?: string | null
  bonusEligible?: boolean
  employmentInsuranceOverage?: number
  fixedOvertimePay?: number
  incomeTaxExempt?: boolean
  paidLeaveBalance?: number | null
  isActive?: boolean
}

export interface ParsedEmployeeRow {
  line: number
  patch: EmployeeCsvPatch
}

export interface EmployeeImportPlan {
  updates: MockEmployee[]
  creates: MockEmployee[]
  skipped: string[]
}

interface CsvColumn {
  header: string
  read: (emp: MockEmployee) => string
  write: (patch: EmployeeCsvPatch, cell: string) => string | null
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

function nameKey(name: string): string {
  return name.replace(/[\s\u3000]/g, '')
}

function formatBool(value: boolean): string {
  return value ? 'はい' : 'いいえ'
}

function formatDate(value: string | null | undefined): string {
  return value ?? ''
}

function formatTime(value: string | null | undefined): string {
  if (!value) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!m) return value
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

function parseBool(cell: string, label: string): { ok: true; value: boolean } | { ok: false; error: string } | null {
  const s = cell.trim().toLowerCase()
  if (s === '') return null
  if (s === 'はい' || s === '1' || s === 'true' || s === '○' || s === 'yes') return { ok: true, value: true }
  if (s === 'いいえ' || s === '0' || s === 'false' || s === '×' || s === 'no') return { ok: true, value: false }
  return { ok: false, error: `${label}は「はい」または「いいえ」で入力してください` }
}

function parseIntYen(cell: string, label: string): { ok: true; value: number } | { ok: false; error: string } | null {
  const cleaned = cell.replace(/[¥,\s円]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: `${label}は0以上の数値で入力してください` }
  return { ok: true, value: Math.round(n) }
}

function parseDate(cell: string, label: string): { ok: true; value: string } | { ok: false; error: string } | null {
  const s = cell.trim()
  if (s === '') return null
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s)
  if (!m) return { ok: false, error: `${label}は YYYY-MM-DD で入力してください` }
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return { ok: false, error: `${label}の日付が正しくありません` }
  }
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return { ok: true, value: `${year}-${mm}-${dd}` }
}

function parseTime(cell: string, label: string): { ok: true; value: string } | { ok: false; error: string } | null {
  const s = cell.trim()
  if (s === '') return null
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s)
  if (!m) return { ok: false, error: `${label}は HH:MM で入力してください` }
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (hh > 23 || mm > 59) return { ok: false, error: `${label}の時刻が正しくありません` }
  return { ok: true, value: `${String(hh).padStart(2, '0')}:${m[2]}` }
}

function textColumn(header: string, key: 'name' | 'nameKana' | 'email' | 'departmentName' | 'jobTitle'): CsvColumn {
  return {
    header,
    read: (emp) => emp[key] ?? '',
    write: (patch, cell) => {
      const value = cell.trim()
      if (key === 'name') {
        if (value === '') return '氏名が空です'
        patch.name = value
        return null
      }
      if (value !== '') patch[key] = value
      return null
    },
  }
}

function intColumn(
  header: string,
  key: 'displayOrder' | 'basicSalary' | 'hourlyRate' | 'standardMonthlyRemuneration' | 'transportAllowance' | 'taxableTransport' | 'positionAllowance' | 'familyAllowance' | 'specialAllowance' | 'dangerAllowance' | 'salesAllowance' | 'healthInsurance' | 'welfarePension' | 'residentTax' | 'savingsDeduction' | 'loanDeduction' | 'dependents' | 'employmentInsuranceOverage' | 'fixedOvertimePay',
): CsvColumn {
  return {
    header,
    read: (emp) => String(emp[key] ?? 0),
    write: (patch, cell) => {
      const parsed = parseIntYen(cell, header)
      if (parsed === null) return null
      if (!parsed.ok) return parsed.error
      patch[key] = parsed.value
      return null
    },
  }
}

function boolColumn(
  header: string,
  key: 'healthInsuranceManual' | 'overtimeAllowed' | 'bonusEligible' | 'incomeTaxExempt' | 'isActive',
): CsvColumn {
  return {
    header,
    read: (emp) => formatBool(Boolean(emp[key])),
    write: (patch, cell) => {
      const parsed = parseBool(cell, header)
      if (parsed === null) return null
      if (!parsed.ok) return parsed.error
      patch[key] = parsed.value
      return null
    },
  }
}

function dateColumn(header: string, key: 'birthDate' | 'hireDate' | 'resignDate'): CsvColumn {
  return {
    header,
    read: (emp) => formatDate(emp[key]),
    write: (patch, cell) => {
      const parsed = parseDate(cell, header)
      if (parsed === null) return null
      if (!parsed.ok) return parsed.error
      patch[key] = parsed.value
      return null
    },
  }
}

function requiredTimeColumn(header: string, key: 'scheduledStart' | 'scheduledEnd'): CsvColumn {
  return {
    header,
    read: (emp) => formatTime(emp[key]),
    write: (patch, cell) => {
      const parsed = parseTime(cell, header)
      if (parsed === null) return null
      if (!parsed.ok) return parsed.error
      patch[key] = parsed.value
      return null
    },
  }
}

function optionalTimeColumn(
  header: string,
  key: 'earlyWorkStart' | 'earlyWorkEnd' | 'overtimeStart' | 'overtimeEnd',
): CsvColumn {
  return {
    header,
    read: (emp) => formatTime(emp[key]),
    write: (patch, cell) => {
      const parsed = parseTime(cell, header)
      if (parsed === null) return null
      if (!parsed.ok) return parsed.error
      patch[key] = parsed.value
      return null
    },
  }
}

const COLUMNS: CsvColumn[] = [
  textColumn('氏名', 'name'),
  textColumn('フリガナ', 'nameKana'),
  textColumn('メール', 'email'),
  dateColumn('生年月日', 'birthDate'),
  {
    header: '区分',
    read: (emp) => emp.employeeType,
    write: (patch, cell) => {
      const s = cell.trim()
      if (s === '') return null
      if (s === '社員' || s === '役員') {
        patch.employeeType = s
        return null
      }
      if (s === 'パート' || s === 'アルバイト' || s === 'パート・アルバイト') {
        patch.employeeType = 'パート'
        return null
      }
      return `区分が不正です（${s}）`
    },
  },
  textColumn('部署', 'departmentName'),
  textColumn('職名', 'jobTitle'),
  dateColumn('入社日', 'hireDate'),
  dateColumn('退職日', 'resignDate'),
  intColumn('表示順', 'displayOrder'),
  intColumn('基本給', 'basicSalary'),
  intColumn('時給', 'hourlyRate'),
  intColumn('標準報酬月額', 'standardMonthlyRemuneration'),
  intColumn('通勤手当', 'transportAllowance'),
  intColumn('課税通勤', 'taxableTransport'),
  intColumn('役職手当', 'positionAllowance'),
  intColumn('家族手当', 'familyAllowance'),
  intColumn('特別手当', 'specialAllowance'),
  intColumn('危険手当', 'dangerAllowance'),
  intColumn('営業手当', 'salesAllowance'),
  intColumn('健康保険料', 'healthInsurance'),
  boolColumn('健保手入力', 'healthInsuranceManual'),
  intColumn('厚生年金', 'welfarePension'),
  intColumn('住民税', 'residentTax'),
  intColumn('財形貯蓄', 'savingsDeduction'),
  intColumn('貸付金', 'loanDeduction'),
  intColumn('扶養人数', 'dependents'),
  requiredTimeColumn('定時開始', 'scheduledStart'),
  requiredTimeColumn('定時終了', 'scheduledEnd'),
  {
    header: '休日',
    read: (emp) => (emp.holidayMode === 'individual' ? '個別' : '会社カレンダー'),
    write: (patch, cell) => {
      const s = cell.trim()
      if (s === '') return null
      if (s === '会社カレンダー' || s === 'calendar') {
        patch.holidayMode = 'calendar'
        return null
      }
      if (s === '個別' || s === 'individual') {
        patch.holidayMode = 'individual'
        return null
      }
      return `休日は「会社カレンダー」または「個別」で入力してください`
    },
  },
  optionalTimeColumn('早出開始', 'earlyWorkStart'),
  optionalTimeColumn('早出終了', 'earlyWorkEnd'),
  boolColumn('残業可', 'overtimeAllowed'),
  optionalTimeColumn('残業開始', 'overtimeStart'),
  optionalTimeColumn('残業終了', 'overtimeEnd'),
  boolColumn('賞与対象', 'bonusEligible'),
  intColumn('雇用保険超過', 'employmentInsuranceOverage'),
  intColumn('固定残業代', 'fixedOvertimePay'),
  boolColumn('所得税免除', 'incomeTaxExempt'),
  {
    header: '有給残',
    read: (emp) => (emp.paidLeaveBalance == null ? '' : String(emp.paidLeaveBalance)),
    write: (patch, cell) => {
      const cleaned = cell.replace(/[,\s日]/g, '')
      if (cleaned === '') return null
      const n = Number(cleaned)
      if (!Number.isFinite(n) || n < 0) return '有給残は0以上の数値で入力してください'
      patch.paidLeaveBalance = Math.round(n * 2) / 2
      return null
    },
  },
  boolColumn('在籍', 'isActive'),
]

function defaultEmployee(id: number, displayOrder: number): MockEmployee {
  return {
    id,
    name: '',
    nameKana: '',
    email: '',
    birthDate: '',
    employeeType: '社員',
    departmentName: '',
    jobTitle: '',
    hireDate: '',
    resignDate: null,
    displayOrder,
    basicSalary: 0,
    hourlyRate: 0,
    standardMonthlyRemuneration: 0,
    transportAllowance: 0,
    taxableTransport: 0,
    positionAllowance: 0,
    familyAllowance: 0,
    specialAllowance: 0,
    dangerAllowance: 0,
    salesAllowance: 0,
    healthInsurance: 0,
    healthInsuranceManual: false,
    welfarePension: 0,
    residentTax: 0,
    savingsDeduction: 0,
    loanDeduction: 0,
    dependents: 0,
    isActive: true,
    scheduledStart: '09:00',
    scheduledEnd: '18:00',
    holidayDays: [0],
    holidayMode: 'calendar',
    earlyWorkStart: null,
    earlyWorkEnd: null,
    overtimeAllowed: true,
    overtimeStart: null,
    overtimeEnd: null,
    bonusEligible: false,
    employmentInsuranceOverage: 0,
    fixedOvertimePay: 0,
    incomeTaxExempt: false,
    paidLeaveBalance: null,
    emailVerifyStatus: 'unverified',
    emailVerifySentAt: null,
    emailVerifiedAt: null,
  }
}

function applyPatch(base: MockEmployee, patch: EmployeeCsvPatch): MockEmployee {
  return {
    ...base,
    ...patch,
    id: base.id,
    holidayDays: base.holidayDays,
    emailVerifyStatus: base.emailVerifyStatus,
    emailVerifySentAt: base.emailVerifySentAt,
    emailVerifiedAt: base.emailVerifiedAt,
  }
}

function birthOf(emp: { birthDate?: string | null }): string {
  return emp.birthDate ?? ''
}

/** 在籍者一覧を、Excel で開ける UTF-8 CSV 本文にする（BOM は保存側で付ける）。 */
export function employeesToCsv(employees: MockEmployee[]): string {
  const header = COLUMNS.map((col) => csvCell(col.header)).join(',')
  const rows = employees.map((emp) => COLUMNS.map((col) => csvCell(col.read(emp))).join(','))
  return [header, ...rows].join('\r\n')
}

/** CSV本文を従業員パッチの配列にする。不正な行は errors に入れて除外する。 */
export function parseEmployeeCsv(text: string): { rows: ParsedEmployeeRow[]; errors: string[] } {
  const errors: string[] = []
  const stripped = text.replace(/^\uFEFF/, '')
  const lines = stripped.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) {
    return { rows: [], errors: ['CSVが空です'] }
  }

  const headerCells = parseCsvLine(lines[0]).map((cell) => cell.trim())
  const nameIndex = headerCells.findIndex((cell) => cell === '氏名')
  if (nameIndex < 0) {
    return { rows: [], errors: ['見出し行に「氏名」列がありません。この画面のCSV出力で作ったファイルを使ってください。'] }
  }

  const used = COLUMNS.map((col) => ({
    col,
    index: headerCells.findIndex((cell) => cell === col.header),
  })).filter((item) => item.index >= 0)

  const rows: ParsedEmployeeRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const lineNo = i + 1
    const patch: EmployeeCsvPatch = { name: '' }
    let rowError: string | null = null
    for (const item of used) {
      const err = item.col.write(patch, cells[item.index] ?? '')
      if (err) {
        rowError = err
        break
      }
    }
    if (rowError || patch.name.trim() === '') {
      errors.push(`${lineNo}行目: ${rowError ?? '氏名が空です'}`)
      continue
    }
    rows.push({ line: lineNo, patch })
  }
  return { rows, errors }
}

/**
 * 既存の従業員と CSV 行を突き合わせる。
 * 氏名が一致し、生年月日が両方あるときは生年月日も一致する人を更新する。
 * CSVで空欄の項目は既存の値を残す。一致しなければ新規。同姓同名で区別できない行はスキップする。
 */
export function planEmployeeImport(existing: MockEmployee[], rows: ParsedEmployeeRow[]): EmployeeImportPlan {
  const pool: Array<{ origin: 'existing' | 'new'; employee: MockEmployee }> = existing.map((emp) => ({
    origin: 'existing',
    employee: { ...emp },
  }))
  const dirty = new Set<MockEmployee>()
  const skipped: string[] = []
  let nextId = existing.reduce((max, emp) => Math.max(max, emp.id), 0) + 1

  for (const row of rows) {
    const key = nameKey(row.patch.name)
    const birth = birthOf(row.patch)
    const named = pool.filter((item) => nameKey(item.employee.name) === key)

    let target: (typeof pool)[number] | null = null
    if (named.length === 1) {
      const only = named[0]
      const existingBirth = birthOf(only.employee)
      if (birth && existingBirth && birth !== existingBirth) {
        skipped.push(`${row.line}行目 ${row.patch.name}: 同じ氏名で生年月日が違うためスキップしました`)
        continue
      }
      target = only
    } else if (named.length > 1) {
      if (birth) {
        const exact = named.filter((item) => birthOf(item.employee) === birth)
        if (exact.length === 1) target = exact[0]
        else {
          skipped.push(`${row.line}行目 ${row.patch.name}: 同姓同名が複数いるためスキップしました`)
          continue
        }
      } else {
        skipped.push(`${row.line}行目 ${row.patch.name}: 同姓同名が複数いるため、生年月日を入れて区別してください`)
        continue
      }
    }

    if (target) {
      target.employee = applyPatch(target.employee, row.patch)
      dirty.add(target.employee)
      continue
    }

    const created = applyPatch(defaultEmployee(nextId, nextId), row.patch)
    nextId += 1
    pool.push({ origin: 'new', employee: created })
    dirty.add(created)
  }

  return {
    updates: pool.filter((item) => item.origin === 'existing' && dirty.has(item.employee)).map((item) => item.employee),
    creates: pool.filter((item) => item.origin === 'new').map((item) => item.employee),
    skipped,
  }
}
