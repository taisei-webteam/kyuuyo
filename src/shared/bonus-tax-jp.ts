/**
 * 賞与に対する源泉徴収税額（算出率の表・甲欄）の算定
 *
 * 国税庁「賞与に対する源泉徴収税額の算出率の表（令和8年分）」（財務省告示）に基づく。
 * 出典: https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/15-16.pdf
 *
 * 手順（甲欄・原則）:
 *   1. 前月の給与等（賞与を除く）から社会保険料等を控除した金額を求める
 *   2. 扶養親族等の数と1の金額から「賞与の金額に乗ずべき率」を求める
 *   3. （賞与 − 賞与の社会保険料等）× 率（1円未満切り捨て）
 *
 * 特例（前月給与がない／賞与が前月給与の10倍超）の場合は、算出率の表ではなく
 * 月額表（電算特例）を用いる方法へフォールバックする。
 *
 * 注意:
 * - 本実装は「甲欄」専用。乙欄は未対応。
 * - 適用は令和8年分以降（2026年支給分）。
 */

import { calcWithholdingTaxMonthly } from './income-tax-jp'

/** この賞与税額表が適用される年分（令和8年分以降） */
export const BONUS_TAX_TABLE_YEAR = 2026

/** 賞与の金額に乗ずべき率（％）。下の閾値配列と同じ並び順。 */
const BONUS_RATES = [
  2.042, 4.084, 6.126, 8.168, 10.21, 12.252, 14.294, 16.336, 18.378, 20.42,
  22.462, 24.504, 26.546, 28.588, 30.63, 32.672, 35.735, 38.798, 41.861, 45.945,
] as const

/**
 * 扶養親族等の数（0〜7人以上）ごとの「前月の社会保険料等控除後の給与等の金額」の
 * 各税率の開始額（千円単位・「以上」の値）。BONUS_RATES と同じ並び。
 * 先頭額未満は税率0%。
 */
const BONUS_THRESHOLDS_BY_DEPENDENTS: readonly (readonly number[])[] = [
  // 0人
  [82, 94, 260, 309, 342, 372, 402, 433, 520, 605, 684, 715, 752, 795, 854, 922, 1318, 1521, 2621, 3495],
  // 1人
  [107, 250, 289, 346, 373, 401, 430, 463, 520, 621, 705, 739, 778, 821, 882, 952, 1342, 1526, 2645, 3527],
  // 2人
  [143, 276, 321, 377, 400, 426, 457, 492, 525, 636, 728, 764, 804, 848, 910, 983, 1367, 1526, 2669, 3559],
  // 3人
  [181, 300, 354, 405, 424, 452, 484, 517, 550, 651, 751, 788, 830, 876, 938, 1013, 1391, 1538, 2693, 3590],
  // 4人
  [218, 300, 387, 431, 452, 477, 509, 540, 577, 666, 774, 813, 856, 903, 966, 1044, 1416, 1555, 2716, 3622],
  // 5人
  [251, 304, 412, 457, 479, 503, 531, 564, 604, 681, 798, 838, 881, 930, 994, 1074, 1440, 1555, 2740, 3654],
  // 6人
  [284, 343, 438, 483, 505, 527, 553, 589, 630, 697, 821, 862, 907, 957, 1022, 1104, 1464, 1555, 2764, 3685],
  // 7人以上
  [317, 383, 463, 508, 529, 552, 578, 614, 657, 708, 845, 887, 933, 985, 1051, 1135, 1489, 1583, 2788, 3717],
]

/**
 * 賞与の金額に乗ずべき率（％）を求める（甲欄）。
 * @param prevMonthSalaryAfterSI 前月の社会保険料等控除後の給与等の金額（円）
 * @param dependents 扶養親族等の数（源泉控除対象配偶者を含む）
 */
export function getBonusTaxRate(prevMonthSalaryAfterSI: number, dependents: number): number {
  const col = Math.min(Math.max(Math.floor(dependents), 0), 7)
  const thresholds = BONUS_THRESHOLDS_BY_DEPENDENTS[col]!
  const amount = Math.max(0, Math.floor(prevMonthSalaryAfterSI))

  let rate = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (amount >= thresholds[i]! * 1000) {
      rate = BONUS_RATES[i]!
    } else {
      break
    }
  }
  return rate
}

/**
 * 賞与の源泉徴収税額を求める（甲欄）。
 *
 * @param bonusAfterSI 賞与の社会保険料等控除後の金額（円）
 * @param prevMonthSalaryAfterSI 前月の社会保険料等控除後の給与等の金額（円）
 * @param dependents 扶養親族等の数（源泉控除対象配偶者を含む）
 * @param calcMonths 計算期間の月数（特例フォールバック時に使用。通常6）
 * @returns 賞与の源泉徴収税額（円。1円未満切り捨て）
 */
export function calcBonusTax(
  bonusAfterSI: number,
  prevMonthSalaryAfterSI: number,
  dependents: number,
  calcMonths = 6,
): number {
  const bonus = Math.max(0, Math.floor(bonusAfterSI))
  const prev = Math.max(0, Math.floor(prevMonthSalaryAfterSI))
  const months = calcMonths > 0 ? calcMonths : 6

  // 特例: 前月給与がない（社保控除後が0以下）／賞与が前月給与の10倍超 → 月額表を使用
  if (prev <= 0) {
    const perMonthTax = calcWithholdingTaxMonthly(bonus / months, dependents)
    return perMonthTax * months
  }
  if (bonus > prev * 10) {
    const taxWithBonus = calcWithholdingTaxMonthly(bonus / months + prev, dependents)
    const taxPrevOnly = calcWithholdingTaxMonthly(prev, dependents)
    return Math.max(0, (taxWithBonus - taxPrevOnly) * months)
  }

  // 原則: 算出率の表から率を求めて賞与（社保控除後）に乗ずる（1円未満切り捨て）。
  // 率は小数3桁（%）。浮動小数点誤差を避けるため整数（0.001%単位）で計算する。
  const rate = getBonusTaxRate(prev, dependents)
  const rateMilli = Math.round(rate * 1000)
  return Math.floor((bonus * rateMilli) / 100000)
}
