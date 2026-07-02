/**
 * 源泉徴収票（給与所得の源泉徴収票）用の年間集計。
 *
 * 方針: 保存済みの給与・賞与明細（payslips）を1〜12月ぶん合算して
 *       「支払金額・源泉徴収税額・社会保険料等の金額」を算出する（実績合算）。
 *       年末調整は行わないため「給与所得控除後の金額」「所得控除の額の合計額」は
 *       集計しない（帳票側で空欄＋注記）。
 *
 * 退職者は会社側で年末調整をしないため、この実績合算がそのまま交付用として正しい。
 */
import type { Payslip } from '../../../shared/types'
import { getEmployees, type MockEmployee } from './mock-data'

export interface WithholdingSummary {
  employeeId: number
  /** 給与(salary)明細があった月数 */
  monthsWithData: number
  /** 賞与(bonus)明細が1件以上あるか */
  hasBonus: boolean
  /** 総支給額の年間合計（非課税通勤手当を含む・参考値） */
  grossTotal: number
  /** 非課税通勤手当の年間合計 */
  nonTaxableTransport: number
  /** 支払金額 = 総支給合計 − 非課税通勤手当合計（源泉徴収票の「支払金額」欄） */
  paymentAmount: number
  /** 社会保険料等の金額（健保＋介護＋厚年＋雇用の年間合計） */
  socialInsuranceTotal: number
  /** 源泉徴収税額（所得税の年間合計） */
  withholdingTax: number
}

export interface WithholdingRow {
  employee: MockEmployee
  summary: WithholdingSummary
}

const hasApi = (): boolean => typeof window !== 'undefined' && 'api' in window

function emptySummary(employeeId: number): WithholdingSummary {
  return {
    employeeId,
    monthsWithData: 0,
    hasBonus: false,
    grossTotal: 0,
    nonTaxableTransport: 0,
    paymentAmount: 0,
    socialInsuranceTotal: 0,
    withholdingTax: 0,
  }
}

/**
 * 指定年の給与・賞与明細を1〜12月ぶん取得し、従業員ごとに合算する。
 * Electron 環境のみ動作（DB 参照）。
 */
export async function aggregateWithholding(year: number): Promise<Map<number, WithholdingSummary>> {
  const map = new Map<number, WithholdingSummary>()
  if (!hasApi()) return map

  for (let month = 1; month <= 12; month++) {
    // type 省略で給与・賞与の両方を取得する
    const res = await window.api.payslips.list(year, month)
    if (!res.success) continue
    for (const p of res.data as Payslip[]) {
      const s = map.get(p.employeeId) ?? emptySummary(p.employeeId)
      s.grossTotal += p.totalPayment
      s.nonTaxableTransport += p.transportAllowance
      s.socialInsuranceTotal +=
        p.healthInsurance + p.nursingInsurance + p.welfarePension + p.employmentInsurance
      s.withholdingTax += p.incomeTax
      if (p.payslipType === 'bonus') {
        s.hasBonus = true
      } else {
        s.monthsWithData += 1
      }
      map.set(p.employeeId, s)
    }
  }

  for (const s of map.values()) {
    s.paymentAmount = Math.max(0, s.grossTotal - s.nonTaxableTransport)
  }
  return map
}

/**
 * 集計結果を現存の従業員情報と結合し、表示順で返す。
 * 明細が1件も無い従業員は含めない。
 */
export async function getWithholdingRows(year: number): Promise<WithholdingRow[]> {
  const map = await aggregateWithholding(year)
  const empById = new Map(getEmployees().map((e) => [e.id, e]))

  const rows: WithholdingRow[] = []
  for (const [employeeId, summary] of map) {
    const employee = empById.get(employeeId)
    if (!employee) continue
    rows.push({ employee, summary })
  }
  rows.sort((a, b) => a.employee.displayOrder - b.employee.displayOrder)
  return rows
}
