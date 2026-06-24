/**
 * アプリケーション全般設定のインメモリストア
 *
 * 将来は IPC 経由で SQLite に永続化する。
 */

export interface AppSettings {
  companyName: string
  representativeName: string
  postalCode: string
  address: string
  phone: string
  insuranceNumber: string

  roundingUnit: number
  gracePeriod: number
  defaultBreakMinutes: number
  clockOutRounding: 'down'
  earlyRoundingUnit: number
  overtimeRoundingUnit: number

  emailSenderName: string
  emailSenderAddress: string
  payslipEmailSubject: string
  payslipEmailBody: string
  bonusEmailSubject: string
  bonusEmailBody: string
  emailIncludeStub: boolean
}

const defaultSettings: AppSettings = {
  companyName: 'チクホーシーリング',
  representativeName: '',
  postalCode: '',
  address: '',
  phone: '',
  insuranceNumber: '',

  roundingUnit: 15,
  gracePeriod: 10,
  defaultBreakMinutes: 60,
  clockOutRounding: 'down',
  earlyRoundingUnit: 15,
  overtimeRoundingUnit: 15,

  emailSenderName: 'チクホーシーリング',
  emailSenderAddress: 'payroll@example.co.jp',
  payslipEmailSubject: '{year}年{month}月分 給与明細のお知らせ',
  payslipEmailBody:
    '{employeeName} 様\n\n' +
    'いつもお世話になっております。\n' +
    '{companyName}です。\n\n' +
    '{year}年{month}月分の給与明細を添付いたします。\n' +
    'ご確認をお願いいたします。\n\n' +
    '※本メールに返信いただいても対応できません。',
  bonusEmailSubject: '{year}年 {season} 賞与明細のお知らせ',
  bonusEmailBody:
    '{employeeName} 様\n\n' +
    'いつもお世話になっております。\n' +
    '{companyName}です。\n\n' +
    '{year}年 {season} の賞与明細を添付いたします。\n' +
    'ご確認をお願いいたします。\n\n' +
    '※本メールに返信いただいても対応できません。',
  emailIncludeStub: false,
}

let current: AppSettings = { ...defaultSettings }

const listeners = new Set<() => void>()

export function getSettings(): AppSettings {
  return { ...current }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  current = { ...current, ...partial }
  listeners.forEach((fn) => fn())
  return { ...current }
}

export function resetSettings(): AppSettings {
  current = { ...defaultSettings }
  listeners.forEach((fn) => fn())
  return { ...current }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
