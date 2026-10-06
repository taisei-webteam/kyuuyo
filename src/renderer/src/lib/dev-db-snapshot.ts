import type { AttendanceRecord, Employee, InsuranceRate, Payslip, RawPunch } from '../../../shared/types'

/** 本番 SQLite の会社情報（Vite 開発時の画面反映用） */
export interface DevCompanyRow {
  name: string
  representativeName: string | null
  postalCode: string | null
  address: string | null
  phone: string | null
  insuranceNumber: string | null
  roundingUnit: number
  gracePeriod: number
  defaultBreakMinutes: number
  earlyRoundingUnit: number
  overtimeRoundingUnit: number
  monthlyWorkHours: number
  paidLeaveResetMonth: number | null
  paidLeavePolicy: string | null
}

export interface DevDbSnapshot {
  employees: Employee[]
  company: DevCompanyRow | null
  insuranceRates: InsuranceRate[]
  payslips: Payslip[]
  attendanceRecords: AttendanceRecord[]
  rawPunches: RawPunch[]
}

let pending: Promise<DevDbSnapshot | null> | null = null

/**
 * ブラウザ単体の Vite 開発時だけ、本番アプリの SQLite スナップショットを読む。
 * Electron では window.api 経由のローカル DB を使うため、ここでは何も取らない。
 */
export function loadDevSnapshot(): Promise<DevDbSnapshot | null> {
  if (!import.meta.env.DEV) return Promise.resolve(null)
  if (typeof window !== 'undefined' && 'api' in window) return Promise.resolve(null)
  pending ??= fetch('/__dev/snapshot')
    .then(async (res) => {
      if (!res.ok) return null
      return (await res.json()) as DevDbSnapshot
    })
    .catch(() => null)
  return pending
}
