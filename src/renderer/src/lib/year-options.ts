/** 生年月日（DateSelect）と同様に、当年から過去100年分を新しい順で列挙する */
export function buildYearSelectOptions(asOf: Date = new Date()): number[] {
  const current = asOf.getFullYear()
  const years: number[] = []
  for (let y = current; y >= current - 100; y--) {
    years.push(y)
  }
  return years
}
