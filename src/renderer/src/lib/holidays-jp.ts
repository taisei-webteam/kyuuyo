/**
 * 日本の祝日プリセットデータ
 *
 * 国民の祝日に関する法律（昭和23年法律第178号）に基づく。
 * 春分の日・秋分の日は天文学的計算による近似式を使用。
 */

export interface HolidayEntry {
  date: string
  name: string
}

function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month - 1, 1).getDay()
  let day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
  return day
}

/**
 * 春分の日を計算（1900-2099年対応の近似式）
 */
function vernalEquinoxDay(year: number): number {
  if (year <= 1947) return 21
  const y = year - 2000
  return Math.floor(20.8431 + 0.242194 * y - Math.floor(y / 4))
}

/**
 * 秋分の日を計算（1900-2099年対応の近似式）
 */
function autumnalEquinoxDay(year: number): number {
  if (year <= 1947) return 23
  const y = year - 2000
  return Math.floor(23.2488 + 0.242194 * y - Math.floor(y / 4))
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getBaseHolidays(year: number): HolidayEntry[] {
  const holidays: HolidayEntry[] = []

  // 元日
  holidays.push({ date: dateStr(year, 1, 1), name: '元日' })

  // 成人の日: 1月第2月曜
  holidays.push({ date: dateStr(year, 1, nthWeekday(year, 1, 1, 2)), name: '成人の日' })

  // 建国記念の日: 2/11
  holidays.push({ date: dateStr(year, 2, 11), name: '建国記念の日' })

  // 天皇誕生日: 2/23 (2020年〜)
  if (year >= 2020) {
    holidays.push({ date: dateStr(year, 2, 23), name: '天皇誕生日' })
  }

  // 春分の日
  holidays.push({ date: dateStr(year, 3, vernalEquinoxDay(year)), name: '春分の日' })

  // 昭和の日: 4/29
  holidays.push({ date: dateStr(year, 4, 29), name: '昭和の日' })

  // 憲法記念日: 5/3
  holidays.push({ date: dateStr(year, 5, 3), name: '憲法記念日' })

  // みどりの日: 5/4
  holidays.push({ date: dateStr(year, 5, 4), name: 'みどりの日' })

  // こどもの日: 5/5
  holidays.push({ date: dateStr(year, 5, 5), name: 'こどもの日' })

  // 海の日: 7月第3月曜
  holidays.push({ date: dateStr(year, 7, nthWeekday(year, 7, 1, 3)), name: '海の日' })

  // 山の日: 8/11
  holidays.push({ date: dateStr(year, 8, 11), name: '山の日' })

  // 敬老の日: 9月第3月曜
  holidays.push({ date: dateStr(year, 9, nthWeekday(year, 9, 1, 3)), name: '敬老の日' })

  // 秋分の日
  holidays.push({ date: dateStr(year, 9, autumnalEquinoxDay(year)), name: '秋分の日' })

  // スポーツの日: 10月第2月曜
  holidays.push({ date: dateStr(year, 10, nthWeekday(year, 10, 1, 2)), name: 'スポーツの日' })

  // 文化の日: 11/3
  holidays.push({ date: dateStr(year, 11, 3), name: '文化の日' })

  // 勤労感謝の日: 11/23
  holidays.push({ date: dateStr(year, 11, 23), name: '勤労感謝の日' })

  return holidays
}

/**
 * 振替休日を追加（祝日が日曜の場合、その後の最も近い平日を振替休日とする）
 * 国民の休日（祝日に挟まれた平日）も追加
 */
function addSubstituteHolidays(holidays: HolidayEntry[]): HolidayEntry[] {
  const holidaySet = new Set(holidays.map((h) => h.date))
  const result = [...holidays]

  for (const h of holidays) {
    const d = new Date(h.date + 'T00:00:00')
    if (d.getDay() === 0) {
      let substitute = new Date(d)
      substitute.setDate(substitute.getDate() + 1)
      while (holidaySet.has(formatLocalDate(substitute))) {
        substitute.setDate(substitute.getDate() + 1)
      }
      const subDate = formatLocalDate(substitute)
      if (!holidaySet.has(subDate)) {
        result.push({ date: subDate, name: '振替休日' })
        holidaySet.add(subDate)
      }
    }
  }

  // 国民の休日: 祝日に挟まれた平日
  const sortedDates = [...holidaySet].sort()
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const curr = new Date(sortedDates[i]! + 'T00:00:00')
    const next = new Date(sortedDates[i + 1]! + 'T00:00:00')
    const diffDays = (next.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays === 2) {
      const between = new Date(curr)
      between.setDate(between.getDate() + 1)
      const betweenStr = formatLocalDate(between)
      if (!holidaySet.has(betweenStr) && between.getDay() !== 0) {
        result.push({ date: betweenStr, name: '国民の休日' })
        holidaySet.add(betweenStr)
      }
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 指定年の日本の祝日一覧を返す（振替休日・国民の休日を含む）
 */
export function getHolidaysForYear(year: number): HolidayEntry[] {
  const base = getBaseHolidays(year)
  return addSubstituteHolidays(base)
}

/**
 * 祝日の日付→名前のMapを返す（高速lookup用）
 */
export function getHolidayMap(year: number): Map<string, string> {
  const holidays = getHolidaysForYear(year)
  const map = new Map<string, string>()
  for (const h of holidays) {
    map.set(h.date, h.name)
  }
  return map
}
