import { useState, useMemo, useCallback, useEffect } from 'react'
import type { ReactElement, ChangeEvent } from 'react'
import {
  getEmployees,
  getAttendance,
  buildAttendanceDaysFromRecords,
  mapDbEmployeeToMock,
  isEmployedInMonth,
  type MockEmployee,
  type MockAttendanceDay,
  type StampInType,
  type StampOutType,
} from '@/lib/mock-data'
import { RawPunchModal } from '@/components/RawPunchModal'
import { getSettings } from '@/lib/settings-store'
import { floorToUnit } from '@/lib/time-rounding'
import styles from './Attendance.module.css'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

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
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [rounding, setRounding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [rawPunchTarget, setRawPunchTarget] = useState<'all' | 'single' | null>(null)

  // Electron では DB の従業員一覧を表示する（打刻アプリで追加された従業員も反映するため）。
  // Vite 単体プレビュー時はモックを表示する。
  const [employees, setEmployees] = useState<MockEmployee[]>(() => getEmployees())

  useEffect(() => {
    if (!hasElectronApi) return
    let cancelled = false
    void (async () => {
      const res = await window.api.employees.list()
      if (cancelled || !res.success) return
      const active = res.data.filter((e) => e.isActive)
      if (active.length > 0) {
        setEmployees(active.map(mapDbEmployeeToMock).sort((a, b) => a.displayOrder - b.displayOrder))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredEmployees = useMemo(
    () =>
      employees.filter(
        (emp) =>
          // 退職翌月以降・入社前月は勤怠対象外（退職月までは表示）
          isEmployedInMonth(emp, selectedYear, selectedMonth) &&
          (emp.name.includes(searchQuery) || emp.nameKana.includes(searchQuery)),
      ),
    [employees, searchQuery, selectedYear, selectedMonth],
  )

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  )

  // 選択中の従業員がその月の対象外（退職翌月以降など）になったら、
  // 先頭の在籍者へ選択を切り替える。
  useEffect(() => {
    if (filteredEmployees.length === 0) return
    if (!filteredEmployees.some((e) => e.id === selectedEmployeeId)) {
      setSelectedEmployeeId(filteredEmployees[0].id)
    }
  }, [filteredEmployees, selectedEmployeeId])

  const [editData, setEditData] = useState<MockAttendanceDay[]>([])
  const [loading, setLoading] = useState(false)

  // 勤怠データの読み込み:
  // Electron では SQLite の実データ (raw_punches + attendance_records) を表示する。
  // Vite 単体プレビュー時は従来どおりモック勤怠を表示する。
  const loadAttendance = useCallback(async (): Promise<void> => {
    if (!hasElectronApi) {
      setEditData(getAttendance(selectedEmployeeId, selectedYear, selectedMonth).map((d) => ({ ...d })))
      setDirty(false)
      return
    }
    setLoading(true)
    try {
      const [listRes, rawRes] = await Promise.all([
        window.api.attendance.list(selectedYear, selectedMonth, selectedEmployeeId),
        window.api.attendance.rawList(selectedYear, selectedMonth),
      ])
      const records = listRes.success ? listRes.data : []
      const raws = rawRes.success ? rawRes.data : []
      setEditData(
        buildAttendanceDaysFromRecords(selectedEmployeeId, selectedYear, selectedMonth, records, raws),
      )
      setDirty(false)
    } finally {
      setLoading(false)
    }
  }, [selectedEmployeeId, selectedYear, selectedMonth])

  useEffect(() => {
    void loadAttendance()
  }, [loadAttendance])

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
      setDirty(true)
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
      setDirty(true)
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
      setDirty(true)
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
      setDirty(true)
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
    const totalOvertimeRaw = editData.reduce((s, d) => s + d.overtimeMinutes, 0)
    const overtimeUnit = getSettings().overtimeRoundingUnit
    const totalOvertime = floorToUnit(totalOvertimeRaw, overtimeUnit)
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
        <div className={styles.headerButtons}>
          <button
            className={styles.syncButton}
            disabled={syncing}
            onClick={async () => {
              if (hasElectronApi) {
                setSyncing(true)
                setSyncMessage(null)
                try {
                const result = await window.api.attendance.sync(selectedYear, selectedMonth)
                if (result.success) {
                  setSyncMessage(`${result.data.synced}件の打刻データを取り込みました`)
                  await loadAttendance()
                } else {
                  setSyncMessage(`同期エラー: ${result.error}`)
                }
                } catch (err) {
                  setSyncMessage(`同期に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
                } finally {
                  setSyncing(false)
                }
              } else {
                setSyncMessage('Electron モードで起動してください（Vite単体では同期不可）')
              }
            }}
          >
            {syncing ? '同期中...' : '打刻同期'}
          </button>
          <button
            className={styles.roundButton}
            disabled={rounding}
            onClick={async () => {
              if (hasElectronApi) {
                setRounding(true)
                setSyncMessage(null)
                try {
                  const result = await window.api.attendance.roundAll(selectedYear, selectedMonth)
                  if (result.success) {
                    setSyncMessage(`${result.data.processed}件の丸め処理を実行しました`)
                    await loadAttendance()
                  } else {
                    setSyncMessage(`丸めエラー: ${result.error}`)
                  }
                } catch (err) {
                  setSyncMessage(`丸めに失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
                } finally {
                  setRounding(false)
                }
              } else {
                setSyncMessage('Electron モードで起動してください')
              }
            }}
          >
            {rounding ? '処理中...' : '一括丸め'}
          </button>
          <button
            className={styles.rawPunchButton}
            onClick={() => setRawPunchTarget('all')}
          >
            実打刻一覧（全員）
          </button>
          <button
            className={styles.rawPunchButton}
            onClick={() => setRawPunchTarget('single')}
          >
            実打刻一覧（選択者）
          </button>
          <button
            className={editing ? styles.editButtonActive : styles.editButton}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? '編集を終了' : '丸め時間を編集'}
          </button>
          {(editing || dirty) && (
            <button
              className={styles.saveButton}
              disabled={saving}
              onClick={async () => {
                if (!hasElectronApi) {
                  setSyncMessage('Electron モードで起動してください')
                  return
                }
                setSaving(true)
                setSyncMessage(null)
                try {
                  let savedCount = 0
                  for (const day of editData) {
                    if (!day.clockIn && !day.clockOut && !day.isHolidayWork) continue
                    await window.api.attendance.upsert({
                      employeeId: selectedEmployeeId,
                      date: day.date,
                      clockIn: day.clockIn,
                      clockOut: day.clockOut,
                      goOut: day.goOut,
                      goReturn: day.goReturn,
                      workMinutes: day.workMinutes,
                      overtimeMinutes: day.overtimeMinutes,
                      earlyOvertimeMinutes: day.earlyOvertimeMinutes,
                      breakMinutes: BREAK_MINUTES,
                      isHoliday: day.isHoliday,
                      isHolidayWork: day.isHolidayWork,
                      dataSource: day.dataSource,
                      note: null,
                    })
                    savedCount++
                  }
                  setDirty(false)
                  setSyncMessage(`${savedCount}件の勤怠データを保存しました`)
                  await loadAttendance()
                } catch (err) {
                  setSyncMessage(`保存に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          )}
        </div>
        {syncMessage && (
          <div className={styles.syncMessage}>{syncMessage}</div>
        )}
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
                {loading && <span className={styles.contentHeaderSub}>読み込み中...</span>}
              </div>
              <div className={styles.legend}>
                出勤・退勤欄は<span className={styles.legendRaw}>上段=実打刻（編集不可）</span>／
                <span className={styles.legendRounded}>下段=丸め時間</span>。
                {editing ? '「下段」のみ修正できます。' : '「丸め時間を編集」で下段を修正できます。'}
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>日付</th>
                      <th>休出</th>
                      <th>種別</th>
                      <th>出勤</th>
                      <th>外出</th>
                      <th>戻り</th>
                      <th>種別</th>
                      <th>退勤</th>
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

                      const isWorkday = !day.isHoliday || day.isHolidayWork
                      const missingClockOut = isWorkday && !!day.clockIn && !day.clockOut
                      const missingClockIn = isWorkday && !day.clockIn && !!day.clockOut

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
                                disabled={!editing}
                                onChange={(e) => handleHolidayWorkChange(idx, e.target.checked)}
                              />
                            </label>
                          </td>
                          <td>
                            <select
                              className={`${styles.stampSelect} ${stampInClass(day.stampIn)}`}
                              value={day.stampIn ?? '出勤'}
                              disabled={!editing}
                              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                handleStampInChange(idx, e.target.value as StampInType)
                              }
                            >
                              {STAMP_IN_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td className={missingClockIn ? styles.cellError : undefined}>
                            <div className={styles.twoTier}>
                              <span className={styles.rawTime} title="実打刻（編集不可）">
                                {day.rawClockIn ?? '−'}
                              </span>
                              {editing ? (
                                <input
                                  type="time"
                                  className={styles.editableCell}
                                  value={day.clockIn ?? ''}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    handleTimeChange(idx, 'clockIn', e.target.value)
                                  }
                                />
                              ) : (
                                <span className={styles.roundedTime}>{day.clockIn ?? '−'}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className={styles.twoTier}>
                              <span className={styles.rawTimeEmpty}>−</span>
                              {editing ? (
                                <input
                                  type="time"
                                  className={`${styles.editableCell} ${day.goOut ? styles.editableCellGoOut : ''}`}
                                  value={day.goOut ?? ''}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    handleTimeChange(idx, 'goOut', e.target.value)
                                  }
                                />
                              ) : (
                                <span className={`${styles.roundedTime} ${day.goOut ? styles.editableCellGoOut : ''}`}>
                                  {day.goOut ?? '−'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className={styles.twoTier}>
                              <span className={styles.rawTimeEmpty}>−</span>
                              {editing ? (
                                <input
                                  type="time"
                                  className={`${styles.editableCell} ${day.goReturn ? styles.editableCellGoReturn : ''}`}
                                  value={day.goReturn ?? ''}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    handleTimeChange(idx, 'goReturn', e.target.value)
                                  }
                                />
                              ) : (
                                <span className={`${styles.roundedTime} ${day.goReturn ? styles.editableCellGoReturn : ''}`}>
                                  {day.goReturn ?? '−'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <select
                              className={`${styles.stampSelect} ${stampOutClass(day.stampOut)}`}
                              value={day.stampOut ?? '退勤'}
                              disabled={!editing}
                              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                handleStampOutChange(idx, e.target.value as StampOutType)
                              }
                            >
                              {STAMP_OUT_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td className={missingClockOut ? styles.cellError : undefined}>
                            <div className={styles.twoTier}>
                              <span className={styles.rawTime} title="実打刻（編集不可）">
                                {day.rawClockOut ?? '−'}
                              </span>
                              {editing ? (
                                <input
                                  type="time"
                                  className={styles.editableCell}
                                  value={day.clockOut ?? ''}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    handleTimeChange(idx, 'clockOut', e.target.value)
                                  }
                                />
                              ) : (
                                <span className={styles.roundedTime}>{day.clockOut ?? '−'}</span>
                              )}
                            </div>
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
      {rawPunchTarget && (
        <RawPunchModal
          year={selectedYear}
          month={selectedMonth}
          employeeId={rawPunchTarget === 'single' ? selectedEmployeeId : undefined}
          onClose={() => setRawPunchTarget(null)}
        />
      )}
    </div>
  )
}
