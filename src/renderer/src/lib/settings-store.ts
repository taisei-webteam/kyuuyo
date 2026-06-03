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
