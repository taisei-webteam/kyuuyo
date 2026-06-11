import { useState, useMemo, useCallback } from 'react'
import type { ReactElement, ChangeEvent } from 'react'
import {
  getEmployees,
  getAttendance,
  getCalendarDay,
  initCalendarYear,
  type MockAttendanceDay,
  type StampInType,
  type StampOutType,
} from '@/lib/mock-data'
import { syncAttendanceMonth, type SyncWarning } from '@/lib/attendance-sync'
import { isSupabaseConfigured } from '@/lib/supabase'
import styles from './Attendance.module.css'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const
const BREAK_MINUTES = 60
const STANDARD_MINUTES = 480

const STAMP_IN_OPTIONS: StampInType[] = ['出勤', '早出', '遅刻']
const STAMP_OUT_OPTIONS: StampOutType[] = ['退勤', '早退']

const AVATAR_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
] as const

function formatMinutes(m: number): string {
  if (m <= 0) return '-'
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h}:${String(min).padStart(2, '0')}`
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function recalcFromTimes(clockIn: string, clockOut: string): { workMinutes: number; overtimeMinutes: number } {
  const inMin = parseTimeToMinutes(clockIn)
  const outMin = parseTimeToMinutes(clockOut)
  const totalWork = Math.max(0, outMin - inMin - BREAK_MINUTES)
  const overtime = Math.max(0, totalWork - STANDARD_MINUTES)
  return { workMinutes: totalWork, overtimeMinutes: overtime }
}

function stampInClass(stamp: StampInType | null): string {
  if (stamp === '早出') return styles.badgeEarly
  if (stamp === '遅刻') return styles.badgeLate
  return styles.badgeNormal
}

function stampOutClass(stamp: StampOutType | null): string {
  if (stamp === '早退') return styles.badgeLeaveEarly
  return styles.badgeNormal
}

export function Attendance(): ReactElement {
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(6)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)
  const [syncWarnings, setSyncWarnings] = useState<SyncWarning[]>([])
  const [syncedKeys, setSyncedKeys] = useState<Set<string>>(new Set())

  const employees = useMemo(() => getEmployees(), [])

  const filteredEmployees = useMemo(
    () =>
      employees.filter(
        (emp) =>
          emp.name.includes(searchQuery) || emp.nameKana.includes(searchQuery),
      ),
    [employees, searchQuery],
  )

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  )

  const rawAttendance = useMemo(
    () => getAttendance(selectedEmployeeId, selectedYear, selectedMonth),
    [selectedEmployeeId, selectedYear, selectedMonth],
  )

  const [editData, setEditData] = useState<MockAttendanceDay[]>([])
  const [editKey, setEditKey] = useState('')

  const currentKey = `${selectedEmployeeId}-${selectedYear}-${selectedMonth}`
  if (editKey !== currentKey) {
    setEditData(rawAttendance.map((d) => ({ ...d })))
    setEditKey(currentKey)
  }

  const isSynced = syncedKeys.has(currentKey)

  const handleSync = useCallback(async () => {
    if (!selectedEmployee) return
    setSyncing(true)
    setSyncStatus(null)
    setSyncWarnings([])

    try {
      initCalendarYear(selectedYear)
      const isHolidayFn = (dateStr: string): boolean => {
        const emp = selectedEmployee
        if (emp.holidayMode === 'calendar') {
          return getCalendarDay(dateStr)?.isHoliday ?? false
        }
        const dow = new Date(dateStr).getDay()
        return emp.holidayDays.includes(dow)
      }

      const result = await syncAttendanceMonth(
        selectedEmployeeId,
        selectedEmployee,
        selectedYear,
        selectedMonth,
        isHolidayFn,
      )

      if (!result.success) {
        setSyncStatus({ type: 'error', message: result.error ?? '同期に失敗しました' })
        return
      }

      setEditData(result.days)
      setSyncWarnings(result.warnings)
      setSyncedKeys((prev) => new Set(prev).add(currentKey))

      if (result.warnings.length > 0) {
        setSyncStatus({
          type: 'warning',
          message: `${result.synced}件の打刻データを同期しました（警告 ${result.warnings.length}件）`,
        })
      } else {
        setSyncStatus({
          type: 'success',
          message: `${result.synced}件の打刻データを同期しました`,
        })
      }
    } catch (err) {
      setSyncStatus({
        type: 'error',
        message: `同期エラー: ${err instanceof Error ? err.message : '不明なエラー'}`,
      })
    } finally {
      setSyncing(false)
    }
  }, [selectedEmployee, selectedEmployeeId, selectedYear, selectedMonth, currentKey])

  const handleTimeChange = useCallback(
    (idx: number, field: 'clockIn' | 'clockOut' | 'goOut' | 'goReturn', value: string): void => {
      setEditData((prev) => {
        const updated = [...prev]
        const row = { ...updated[idx], [field]: value || null, dataSource: 'manual' as const }
        const clockIn = field === 'clockIn' ? value : row.clockIn
        const clockOut = field === 'clockOut' ? value : row.clockOut
        const goOut = field === 'goOut' ? value : row.goOut
        const goReturn = field === 'goReturn' ? value : row.goReturn
        if (clockIn && clockOut) {
          let goOutMinutes = 0
          if (goOut && goReturn) {
            goOutMinutes = Math.max(0, parseTimeToMinutes(goReturn) - parseTimeToMinutes(goOut))
          }
          const inMin = parseTimeToMinutes(clockIn)
          const outMin = parseTimeToMinutes(clockOut)
          const totalWork = Math.max(0, outMin - inMin - BREAK_MINUTES - goOutMinutes)
          const overtime = Math.max(0, totalWork - STANDARD_MINUTES)
          row.workMinutes = totalWork
          row.overtimeMinutes = overtime
        }
        updated[idx] = row
        return updated
      })
    },
    [],
  )

  const handleStampInChange = useCallback(
    (idx: number, value: StampInType): void => {
      setEditData((prev) => {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], stampIn: value }
        return updated
      })
    },
    [],
  )

  const handleStampOutChange = useCallback(
    (idx: number, value: StampOutType): void => {
      setEditData((prev) => {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], stampOut: value }
        return updated
      })
    },
    [],
  )

  const handleHolidayWorkChange = useCallback(
    (idx: number, checked: boolean): void => {
      setEditData((prev) => {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], isHolidayWork: checked }
        return updated
      })
    },
    [],
  )

  const holidayLabel = useMemo(() => {
    const mode = selectedEmployee?.holidayMode ?? 'calendar'
    if (mode === 'calendar') {
      return '会社カレンダー'
    }
    const dayNames = ['日', '月', '火', '水', '木', '金', '土']
    const days = selectedEmployee?.holidayDays ?? [0, 6]
    return days.map((d) => dayNames[d]).join('・')
  }, [selectedEmployee])

  const summary = useMemo(() => {
    const workDays = editData.filter((d) => !d.isHoliday && d.workMinutes > 0).length
    const totalWork = editData.reduce((s, d) => s + d.workMinutes, 0)
    const totalOvertime = editData.reduce((s, d) => s + d.overtimeMinutes, 0)
    const totalEarlyOvertime = editData.reduce((s, d) => s + d.earlyOvertimeMinutes, 0)
    const earlyCount = editData.filter((d) => d.stampIn === '早出').length
    const lateCount = editData.filter((d) => d.stampIn === '遅刻').length
    const leaveEarlyCount = editData.filter((d) => d.stampOut === '早退').length
    const outsideCount = editData.filter((d) => d.goOut !== null).length
    const holidayWorkCount = editData.filter((d) => d.isHolidayWork).length
    return { workDays, totalWork, totalOvertime, totalEarlyOvertime, earlyCount, lateCount, leaveEarlyCount, outsideCount, holidayWorkCount }
  }, [editData])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>勤怠管理</h1>
        <div className={styles.monthSelector}>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>
        <div className={styles.headerSpacer} />
        {isSynced && (
          <span className={styles.syncedBadge}>同期済み</span>
        )}
        <button
          className={styles.syncButton}
          onClick={handleSync}
          disabled={syncing || !isSupabaseConfigured()}
          title={!isSupabaseConfigured() ? 'Supabase が未設定です' : undefined}
        >
          {syncing ? '同期中...' : 'iPad同期'}
        </button>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.searchBox}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="従業員を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.employeeList}>
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                className={emp.id === selectedEmployeeId ? styles.employeeItemSelected : styles.employeeItem}
                onClick={() => setSelectedEmployeeId(emp.id)}
              >
                <div
                  className={styles.employeeAvatar}
                  style={{ background: AVATAR_COLORS[emp.id % AVATAR_COLORS.length] }}
                >
                  {emp.name.slice(0, 1)}
                </div>
                <div>
                  <div>{emp.name}</div>
                  <div className={styles.employeeDept}>{emp.employeeType} · {emp.departmentName}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className={styles.content}>
          {syncStatus && (
            <div className={
              syncStatus.type === 'success' ? styles.syncSuccess
                : syncStatus.type === 'warning' ? styles.syncWarning
                  : styles.syncError
            }>
              <span>{syncStatus.message}</span>
              <button className={styles.syncDismiss} onClick={() => setSyncStatus(null)}>×</button>
            </div>
          )}
          {syncWarnings.length > 0 && (
            <details className={styles.warningDetails}>
              <summary>警告一覧（{syncWarnings.length}件）</summary>
              <ul className={styles.warningList}>
                {syncWarnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </details>
          )}
          {selectedEmployee ? (
            <>
              <div className={styles.contentHeader}>
                {selectedEmployee.name}
                <span className={styles.contentHeaderSub}>
                  {selectedYear}年{selectedMonth}月
                  {selectedEmployee.employeeType === 'パート' && ` / 時給 ¥${selectedEmployee.hourlyRate.toLocaleString('ja-JP')}`}
                </span>
                <span className={styles.scheduleBadge}>
                  定時 {selectedEmployee.scheduledStart}〜{selectedEmployee.scheduledEnd}
                </span>
                {selectedEmployee.earlyWorkStart && selectedEmployee.earlyWorkEnd && (
                  <span className={styles.scheduleBadge}>
                    早出 {selectedEmployee.earlyWorkStart}〜{selectedEmployee.earlyWorkEnd}
                  </span>
                )}
                <span className={styles.holidayBadge}>
                  休日 {holidayLabel}
                </span>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>日付</th>
                      <th>休出</th>
                      <th>種別</th>
                      <th className={styles.thClockIn}>出勤</th>
                      <th>外出</th>
                      <th>戻り</th>
                      <th>種別</th>
                      <th className={styles.thClockOut}>退勤</th>
                      <th>労働時間</th>
                      <th>早出</th>
                      <th>残業時間</th>
                      <th>データ元</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editData.map((day, idx) => {
                      const date = new Date(day.date)
                      const dow = date.getDay()
                      const dayNum = date.getDate()
                      const weekdayLabel = WEEKDAY_LABELS[dow]
                      const weekdayClass =
                        dow === 0 ? styles.weekdaySun
                          : dow === 6 ? styles.weekdaySat
                            : styles.weekdayNormal

                      return (
                        <tr
                          key={day.date}
                          className={day.isHolidayWork ? styles.rowHolidayWork : day.isHoliday ? styles.rowHoliday : undefined}
                        >
                          <td>
                            <div className={styles.dateCell}>
                              {selectedMonth}/{dayNum}
                              <span className={weekdayClass}>({weekdayLabel})</span>
                            </div>
                          </td>
                          <td>
                            <label className={styles.holidayWorkCheck}>
                              <input
                                type="checkbox"
                                checked={day.isHolidayWork}
                                onChange={(e) => handleHolidayWorkChange(idx, e.target.checked)}
                              />
                            </label>
                          </td>
                          <td>
                            <select
                              className={`${styles.stampSelect} ${stampInClass(day.stampIn)}`}
                              value={day.stampIn ?? '出勤'}
                              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                handleStampInChange(idx, e.target.value as StampInType)
                              }
                            >
                              {STAMP_IN_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="time"
                              className={styles.editableCell}
                              value={day.clockIn ?? ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                handleTimeChange(idx, 'clockIn', e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="time"
                              className={`${styles.editableCell} ${day.goOut ? styles.editableCellGoOut : ''}`}
                              value={day.goOut ?? ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                handleTimeChange(idx, 'goOut', e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="time"
                              className={`${styles.editableCell} ${day.goReturn ? styles.editableCellGoReturn : ''}`}
                              value={day.goReturn ?? ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                handleTimeChange(idx, 'goReturn', e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <select
                              className={`${styles.stampSelect} ${stampOutClass(day.stampOut)}`}
                              value={day.stampOut ?? '退勤'}
                              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                handleStampOutChange(idx, e.target.value as StampOutType)
                              }
                            >
                              {STAMP_OUT_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="time"
                              className={styles.editableCell}
                              value={day.clockOut ?? ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                handleTimeChange(idx, 'clockOut', e.target.value)
                              }
                            />
                          </td>
                          <td>
                            {day.workMinutes > 0
                              ? formatMinutes(day.workMinutes)
                              : <span className={styles.cellMuted}>-</span>}
                          </td>
                          <td>
                            {day.earlyOvertimeMinutes > 0
                              ? formatMinutes(day.earlyOvertimeMinutes)
                              : <span className={styles.cellMuted}>-</span>}
                          </td>
                          <td>
                            {day.overtimeMinutes > 0
                              ? formatMinutes(day.overtimeMinutes)
                              : <span className={styles.cellMuted}>-</span>}
                          </td>
                          <td>
                            {day.isHolidayWork ? (
                              <span className={styles.badgeHolidayWork}>休出</span>
                            ) : day.isHoliday ? (
                              <span className={styles.badgeHoliday}>休日</span>
                            ) : day.dataSource === 'ipad' ? (
                              <span className={styles.badgeIpad}>iPad</span>
                            ) : (
                              <span className={styles.badgeManual}>手入力</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={styles.summaryRow}>
                      <td>合計</td>
                      <td></td>
                      <td></td>
                      <td>{summary.workDays}日</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td>{formatMinutes(summary.totalWork)}</td>
                      <td>{formatMinutes(summary.totalEarlyOvertime)}</td>
                      <td>{formatMinutes(summary.totalOvertime)}</td>
                      <td></td>
                    </tr>
                    {(summary.earlyCount > 0 || summary.lateCount > 0 || summary.leaveEarlyCount > 0 || summary.outsideCount > 0 || summary.holidayWorkCount > 0) && (
                      <tr className={styles.stampSummaryRow}>
                        <td colSpan={12}>
                          <div className={styles.stampSummary}>
                            {summary.earlyCount > 0 && (
                              <span className={styles.stampSummaryItem}>
                                <span className={styles.badgeEarlySmall}>早出</span> {summary.earlyCount}回
                              </span>
                            )}
                            {summary.lateCount > 0 && (
                              <span className={styles.stampSummaryItem}>
                                <span className={styles.badgeLateSmall}>遅刻</span> {summary.lateCount}回
                              </span>
                            )}
                            {summary.leaveEarlyCount > 0 && (
                              <span className={styles.stampSummaryItem}>
                                <span className={styles.badgeLeaveEarlySmall}>早退</span> {summary.leaveEarlyCount}回
                              </span>
                            )}
                            {summary.outsideCount > 0 && (
                              <span className={styles.stampSummaryItem}>
                                <span className={styles.badgeOutsideSmall}>外出</span> {summary.outsideCount}回
                              </span>
                            )}
                            {summary.holidayWorkCount > 0 && (
                              <span className={styles.stampSummaryItem}>
                                <span className={styles.badgeHolidayWorkSmall}>休出</span> {summary.holidayWorkCount}日
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>従業員を選択してください</div>
          )}
        </div>
      </div>
    </div>
  )
}
