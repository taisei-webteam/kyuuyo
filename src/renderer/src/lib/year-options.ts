/** 生年月日（DateSelect）と同様に、当年から過去100年分を新しい順で列挙する */
export function buildYearSelectOptions(asOf: Date = new Date()): number[] {
  const current = asOf.getFullYear()
  const years: number[] = []
  for (let y = current; y >= current - 100; y--) {
    years.push(y)
  }
  return years
}

/** 賞与を作成できる最初の年。これより前は選択肢に出さない。 */
export const BONUS_YEAR_MIN = 2026

/** 2026年から先に出す年数（開始年を含む。おおよそ10年）。 */
const BONUS_YEAR_SPAN = 10

/**
 * 賞与作成の年選択。
 * 2026年より前は出さず、2026年から先おおよそ10年（2026〜2035）を古い順で返す。
 * 当年がその範囲を超えているときは、当年まで広げる。
 */
export function buildBonusYearSelectOptions(asOf: Date = new Date()): number[] {
  const start = BONUS_YEAR_MIN
  const end = Math.max(start + BONUS_YEAR_SPAN - 1, asOf.getFullYear())
  const years: number[] = []
  for (let y = start; y <= end; y++) {
    years.push(y)
  }
  return years
}

/** 賞与作成の初期年。当年が2026年未満なら2026年にする。 */
export function defaultBonusYear(asOf: Date = new Date()): number {
  const current = asOf.getFullYear()
  return current < BONUS_YEAR_MIN ? BONUS_YEAR_MIN : current
}
