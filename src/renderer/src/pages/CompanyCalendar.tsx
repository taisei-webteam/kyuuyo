import { useState, useMemo, useCallback, useEffect } from 'react'
import { buildYearSelectOptions } from '@/lib/year-options'
import type { ReactElement } from 'react'
import {
  setCalendarDay,
  fiscalYearOf,
  fiscalYearMonths,
  getCalendarFiscalYear,
  loadNationalHolidaysFiscalYear,
  resetCalendarFiscalYear,
  hydrateCalendarFiscalYearFromDb,
  exportCalendarFiscalYearForDb,
  type CalendarDay,
} from '@/lib/mock-data'
import styles from './CompanyCalendar.module.css'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

function MonthGrid({
  year,
  month,
  calendarData,
  todayStr,
  onToggle,
}: {
  year: number
  month: number
  calendarData: Map<string, CalendarDay>
  todayStr: string
  onToggle: (dateStr: string) => void
}): ReactElement {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow = new Date(year, month - 1, 1).getDay()

  const cells: ReactElement[] = []

  for (let i = 0; i < firstDow; i++) {
    cells.push(<div key={`pad-${i}`} className={styles.daySlot} />)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dow = new Date(year, month - 1, day).getDay()
    const calDay = calendarData.get(dateStr)
    const isHoliday = calDay?.isHoliday ?? false
    const isNational = calDay?.isNationalHoliday ?? false
    const holidayName = calDay?.holidayName ?? null
    const isToday = dateStr === todayStr

    let cellClass = styles.dayCell
    if (isHoliday && (isNational || dow === 0)) {
      cellClass += ` ${styles.dayHoliday}`
    } else if (isHoliday) {
      cellClass += ` ${styles.dayCompanyHoliday}`
    } else if (dow === 0) {
      cellClass += ` ${styles.daySunday}`
    } else if (dow === 6) {
      cellClass += ` ${styles.daySaturday}`
    }
    if (isToday) {
      cellClass += ` ${styles.dayToday}`
    }

    cells.push(
      <div key={dateStr} className={styles.daySlot}>
        <button
          className={cellClass}
          onClick={() => onToggle(dateStr)}
          title={holidayName ?? undefined}
        >
          <span className={styles.dayNum}>{day}</span>
          {holidayName && <span className={styles.holidayName}>{holidayName}</span>}
        </button>
      </div>,
    )
  }

  return (
    <div className={styles.monthCard}>
      <div className={styles.monthTitle}>{year}年 {month}月</div>
      <div className={styles.weekHeader}>
        {WEEKDAY_LABELS.map((label, i) => (
          <span
            key={label}
            className={i === 0 ? styles.weekSun : i === 6 ? styles.weekSat : styles.weekDay}
          >
            {label}
          </span>
        ))}
      </div>
      <div className={styles.daysGrid}>{cells}</div>
    </div>
  )
}

export function CompanyCalendar(): ReactElement {
  // selectedYear は「年度」（5月始まり）。例: 2026 = 2026年5月〜2027年4月
  const currentFiscalYear = fiscalYearOf(new Date())
  const [selectedYear, setSelectedYear] = useState(currentFiscalYear)
  const [refreshKey, setRefreshKey] = useState(0)

  const todayStr = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  useEffect(() => {
    if (!hasElectronApi) return
    let cancelled = false
    void (async () => {
      await hydrateCalendarFiscalYearFromDb(selectedYear)
      if (!cancelled) setRefreshKey((k) => k + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedYear])

  const calendarData = useMemo(() => {
    void refreshKey
    return getCalendarFiscalYear(selectedYear)
  }, [selectedYear, refreshKey])

  // 年間休日は年度期間（5月〜翌4月）で集計する
  const holidayCount = useMemo(() => {
    let count = 0
    for (const [, val] of calendarData) {
      if (val.isHoliday) count++
    }
    return count
  }, [calendarData])

  // 年度に含まれる12か月（5月→翌4月）
  const months = useMemo(() => fiscalYearMonths(selectedYear), [selectedYear])

  const handleToggle = useCallback(
    (dateStr: string) => {
      const current = calendarData.get(dateStr)
      if (!current) return
      const next = !current.isHoliday
      setCalendarDay(dateStr, next)
      setRefreshKey((k) => k + 1)
      if (hasElectronApi) {
        void window.api.calendar.set(dateStr, next, current.holidayName ?? undefined)
      }
    },
    [calendarData],
  )

  const handleLoadHolidays = useCallback(() => {
    loadNationalHolidaysFiscalYear(selectedYear)
    setRefreshKey((k) => k + 1)
    if (hasElectronApi) {
      void window.api.calendar.initYear(selectedYear, exportCalendarFiscalYearForDb(selectedYear))
    }
  }, [selectedYear])

  const handleReset = useCallback(() => {
    resetCalendarFiscalYear(selectedYear)
    setRefreshKey((k) => k + 1)
    if (hasElectronApi) {
      void window.api.calendar.initYear(selectedYear, exportCalendarFiscalYearForDb(selectedYear))
    }
  }, [selectedYear])

  const yearOptions = useMemo(
    () => buildYearSelectOptions(),
    [selectedYear],
  )

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <button className={styles.navBtn} onClick={() => setSelectedYear((y) => y - 1)}>
          ◀ 前年度
        </button>
        <select
          className={styles.yearSelect}
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}年度（{y}年5月〜{y + 1}年4月）
            </option>
          ))}
        </select>
        <button className={styles.navBtn} onClick={() => setSelectedYear((y) => y + 1)}>
          翌年度 ▶
        </button>
        <button className={styles.loadBtn} onClick={handleLoadHolidays}>
          祝日を読み込む
        </button>
        <button className={styles.resetBtn} onClick={handleReset}>
          リセット
        </button>
        <div className={styles.summary}>
          年間休日（5月〜翌4月）: <span className={styles.summaryCount}>{holidayCount}</span> 日
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendDotRed}`} />
          日曜・祝日
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendDotBlue}`} />
          会社休日（クリックで追加/解除）
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendDotNone}`} />
          営業日
        </div>
      </div>

      <div className={styles.calendarGrid}>
        {months.map(({ year, month }) => (
          <MonthGrid
            key={`${year}-${month}`}
            year={year}
            month={month}
            calendarData={calendarData}
            todayStr={todayStr}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  )
}
