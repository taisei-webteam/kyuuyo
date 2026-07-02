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
  payslipEmailSubject: '{year}年{month}月分 給与明細書の送付',
  payslipEmailBody:
    '{employeeName} 様\n\n' +
    'お疲れ様です。\n' +
    '{year}年{month}月分の給与明細書を添付ファイル（PDF）にてお送りいたします。\n' +
    '内容をご確認くださいますようお願いいたします。\n\n' +
    '【ご注意】\n' +
    '本メールには給与に関する個人情報が含まれております。\n' +
    '宛名にお心当たりがない場合は、お手数ですがメールを破棄のうえ、下記までご連絡ください。\n\n' +
    'ご不明な点がございましたら、本メールへのご返信、または下記連絡先までお問い合わせください。',
  bonusEmailSubject: '{year}年 {season}賞与明細書の送付',
  bonusEmailBody:
    '{employeeName} 様\n\n' +
    'お疲れ様です。\n' +
    '{year}年 {season}の賞与明細書を添付ファイル（PDF）にてお送りいたします。\n' +
    '内容をご確認くださいますようお願いいたします。\n\n' +
    '【ご注意】\n' +
    '本メールには賞与に関する個人情報が含まれております。\n' +
    '宛名にお心当たりがない場合は、お手数ですがメールを破棄のうえ、下記までご連絡ください。\n\n' +
    'ご不明な点がございましたら、本メールへのご返信、または下記連絡先までお問い合わせください。',
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

/**
 * SQLite の会社情報(companies)をストアへ反映する。
 * 給与明細・源泉徴収票などが参照する会社名・住所等を、再起動後も維持するため
 * アプリ起動時に一度呼び出す。Electron 環境のみ動作。
 */
export async function hydrateCompanyFromDb(): Promise<void> {
  if (typeof window === 'undefined' || !('api' in window)) return
  try {
    const res = await window.api.company.get()
    if (!res.success || !res.data) return
    const d = res.data
    updateSettings({
      companyName: d.name || current.companyName,
      representativeName: d.representativeName ?? '',
      postalCode: d.postalCode ?? '',
      address: d.address ?? '',
      phone: d.phone ?? '',
      insuranceNumber: d.insuranceNumber ?? '',
      roundingUnit: d.roundingUnit ?? current.roundingUnit,
      gracePeriod: d.gracePeriod ?? current.gracePeriod,
      defaultBreakMinutes: d.defaultBreakMinutes ?? current.defaultBreakMinutes,
      earlyRoundingUnit: d.earlyRoundingUnit ?? current.earlyRoundingUnit,
      overtimeRoundingUnit: d.overtimeRoundingUnit ?? current.overtimeRoundingUnit,
    })
  } catch {
    // 取得失敗時は既定値のまま
  }
}
