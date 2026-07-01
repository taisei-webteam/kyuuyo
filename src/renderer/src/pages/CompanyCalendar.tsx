import { useState, useMemo, useCallback, useEffect } from 'react'
import type { ReactElement } from 'react'
import {
  getCalendarYear,
  setCalendarDay,
  loadNationalHolidays,
  resetCalendarYear,
  initCalendarYear,
  hydrateCalendarYearFromDb,
  exportCalendarYearForDb,
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
    cells.push(<div key={`pad-${i}`} className={`${styles.dayCell} ${styles.dayEmpty}`} />)
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
      <button
        key={dateStr}
        className={cellClass}
        onClick={() => onToggle(dateStr)}
        title={holidayName ?? undefined}
      >
        {day}
        {holidayName && <span className={styles.tooltip}>{holidayName}</span>}
      </button>,
    )
  }

  return (
    <div className={styles.monthCard}>
      <div className={styles.monthTitle}>{month}月</div>
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
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [refreshKey, setRefreshKey] = useState(0)

  const todayStr = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  useEffect(() => {
    if (!hasElectronApi) return
    let cancelled = false
    void (async () => {
      await hydrateCalendarYearFromDb(selectedYear)
      if (!cancelled) setRefreshKey((k) => k + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedYear])

  const calendarData = useMemo(() => {
    void refreshKey
    return getCalendarYear(selectedYear)
  }, [selectedYear, refreshKey])

  const holidayCount = useMemo(() => {
    let count = 0
    for (const [, val] of calendarData) {
      if (val.isHoliday) count++
    }
    return count
  }, [calendarData])

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
    loadNationalHolidays(selectedYear)
    setRefreshKey((k) => k + 1)
    if (hasElectronApi) {
      void window.api.calendar.initYear(selectedYear, exportCalendarYearForDb(selectedYear))
    }
  }, [selectedYear])

  const handleReset = useCallback(() => {
    resetCalendarYear(selectedYear)
    initCalendarYear(selectedYear)
    setRefreshKey((k) => k + 1)
    if (hasElectronApi) {
      void window.api.calendar.initYear(selectedYear, exportCalendarYearForDb(selectedYear))
    }
  }, [selectedYear])

  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
      years.push(y)
    }
    return years
  }, [currentYear])

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <button className={styles.navBtn} onClick={() => setSelectedYear((y) => y - 1)}>
          ◀ 前年
        </button>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
        <button className={styles.navBtn} onClick={() => setSelectedYear((y) => y + 1)}>
          翌年 ▶
        </button>
        <button className={styles.loadBtn} onClick={handleLoadHolidays}>
          祝日を読み込む
        </button>
        <button className={styles.resetBtn} onClick={handleReset}>
          リセット
        </button>
        <div className={styles.summary}>
          年間休日: <span className={styles.summaryCount}>{holidayCount}</span> 日
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
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
          <MonthGrid
            key={month}
            year={selectedYear}
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
