/**
 * 年プルダウン用の選択肢を生成する。
 *
 * 開始年（既定 2024）から現在の年までを昇順で返す。
 * 現在の年を基準に算出するため、年が変わると自動的に新しい年が選択肢に加わる。
 */
export function getYearOptions(startYear = 2024): number[] {
  const currentYear = new Date().getFullYear()
  const from = Math.min(startYear, currentYear)
  const years: number[] = []
  for (let y = from; y <= currentYear; y++) {
    years.push(y)
  }
  return years
}
