/**
 * 給与所得の源泉徴収税額（月額表・甲欄）の算定
 *
 * 国税庁「電子計算機等を使用して源泉徴収税額を計算する方法（月額表の甲欄を適用する
 * 給与等に対する税額の電算機計算の特例）」（財務省告示）に基づく算式版。
 * ソフトウェアでの源泉徴収税額計算に公式に認められた方式。
 *
 * 適用: 令和8年分以降（2026年1月以降に支払う給与等）。
 * 出典: 国税庁「令和8年分以降 月額表の甲欄を適用する給与等に対する税額の電算機計算の特例について」
 *   https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/denshi_01.pdf
 *
 * 注意:
 * - 本算式は「甲欄」（扶養控除等申告書を提出している人）専用。乙欄は未対応。
 * - 賞与は別表（賞与の源泉徴収税額の算出率の表）のため対象外。
 * - 特定親族特別控除等の細目は未反映（扶養親族等は一律31,667円で算定）。
 *   差額は年末調整で精算される。
 */

/** この税額表が適用される年分（令和8年分以降） */
export const INCOME_TAX_TABLE_YEAR = 2026

/** 第3表 基礎控除の額（月額相当・令和8年分以降） */
const BASIC_DEDUCTION = 48334

/** 第2表 源泉控除対象配偶者・扶養親族等1人あたりの控除額（令和8年分以降） */
const DEPENDENT_DEDUCTION = 31667

/**
 * 第1表 給与所得控除の額
 * @param a その月の社会保険料等控除後の給与等の金額
 */
function salaryIncomeDeduction(a: number): number {
  if (a <= 158333) return 54167
  if (a <= 299999) return a * 0.3 + 6667
  if (a <= 549999) return a * 0.2 + 36667
  if (a <= 708330) return a * 0.1 + 91667
  return 162500
}

/**
 * 第3表 税額の算式（課税給与所得金額 B から復興特別所得税込みの税額を算出）
 * 率・控除額は所得税率 × 1.021（復興特別所得税）を織り込んだ月額表の標準値。
 */
function taxFromTaxableIncome(b: number): number {
  if (b <= 0) return 0
  if (b <= 162500) return b * 0.05105
  if (b <= 275000) return b * 0.1021 - 8296
  if (b <= 579166) return b * 0.2042 - 36374
  if (b <= 750000) return b * 0.23483 - 54113
  if (b <= 1500000) return b * 0.33693 - 130688
  if (b <= 3333333) return b * 0.4084 - 237893
  return b * 0.45945 - 408061
}

/**
 * その月の源泉徴収税額（月額表・甲欄）を電算機計算の特例で求める。
 *
 * @param socialInsuranceDeductedAmount その月の社会保険料等控除後の給与等の金額
 *   （＝課税支給合計 − 社会保険料合計。非課税通勤手当は課税支給に含めない）
 * @param dependents 扶養親族等の数（源泉控除対象配偶者を含む）
 * @returns 源泉徴収税額（円。10円未満四捨五入）
 */
export function calcWithholdingTaxMonthly(
  socialInsuranceDeductedAmount: number,
  dependents: number,
): number {
  const a = Math.max(0, Math.floor(socialInsuranceDeductedAmount))
  const deps = Math.max(0, Math.floor(dependents))

  // その月の課税給与所得金額 B
  const b = a - salaryIncomeDeduction(a) - DEPENDENT_DEDUCTION * deps - BASIC_DEDUCTION

  const raw = taxFromTaxableIncome(b)
  if (raw <= 0) return 0

  // 10円未満四捨五入
  return Math.round(raw / 10) * 10
}
