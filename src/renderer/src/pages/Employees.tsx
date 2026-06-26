import { useState, useMemo } from 'react'
import type { ReactElement } from 'react'
import {
  getEmployees,
  updateEmployee,
  deleteEmployee,
  reloadEmployeesFromDb,
  mockToEmployeeInput,
  calcAge,
  type MockEmployee,
} from '@/lib/mock-data'
import { EmployeeForm } from '@/components/EmployeeForm'
import styles from './Employees.module.css'

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

export function Employees(): ReactElement {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [editingEmployee, setEditingEmployee] = useState<MockEmployee | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const employees = useMemo(() => getEmployees(), [refreshKey])

  const filtered = useMemo(() => {
    return employees
      .filter((emp) => {
        if (filterType !== 'all' && emp.employeeType !== filterType) return false
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          return emp.name.includes(q) || emp.nameKana.includes(q) || emp.email.includes(q)
        }
        return true
      })
  }, [employees, searchQuery, filterType])

  function handleNew(): void {
    setEditingEmployee(null)
    setIsFormOpen(true)
  }

  function handleEdit(emp: MockEmployee): void {
    setEditingEmployee(emp)
    setIsFormOpen(true)
  }

  async function handleSave(data: MockEmployee): Promise<void> {
    if (hasElectronApi) {
      const input = mockToEmployeeInput(data)
      const res = editingEmployee
        ? await window.api.employees.update({ id: editingEmployee.id, ...input })
        : await window.api.employees.create(input)
      if (!res.success) {
        setSyncMessage(`保存に失敗しました: ${res.error}`)
        return
      }
      await reloadEmployeesFromDb()
    } else {
      updateEmployee(data)
    }
    setIsFormOpen(false)
    setEditingEmployee(null)
    setRefreshKey((k) => k + 1)
  }

  async function handleDelete(emp: MockEmployee): Promise<void> {
    if (!confirm(`${emp.name} を削除しますか？`)) return
    if (hasElectronApi) {
      const res = await window.api.employees.delete(emp.id)
      if (!res.success) {
        setSyncMessage(`削除に失敗しました: ${res.error}`)
        return
      }
      await reloadEmployeesFromDb()
    } else {
      deleteEmployee(emp.id)
    }
    setRefreshKey((k) => k + 1)
  }

  function handleClose(): void {
    setIsFormOpen(false)
    setEditingEmployee(null)
  }

  async function handleSyncToPunchApp(): Promise<void> {
    if (!hasElectronApi) {
      setSyncMessage('Electron モードで起動してください')
      return
    }
    setSyncing(true)
    setSyncMessage(null)
    try {
      const payload = getEmployees().map((e) => ({
        id: e.id,
        name: e.name,
        name_kana: e.nameKana,
        employee_type: e.employeeType,
        display_order: e.displayOrder,
        is_active: e.isActive,
      }))
      const result = await window.api.attendance.syncEmployees(payload)
      if (result.success) {
        setSyncMessage(`${result.data.synced}名を打刻アプリへ同期しました`)
      } else {
        setSyncMessage(`同期エラー: ${result.error}`)
      }
    } catch (err) {
      setSyncMessage(`同期に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="氏名・フリガナ・メールで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            {['all', '社員', '役員', 'パート'].map((type) => (
              <button
                key={type}
                className={`${styles.filterBtn} ${filterType === type ? styles.filterBtnActive : ''}`}
                onClick={() => setFilterType(type)}
              >
                {type === 'all' ? '全員' : type}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={handleSyncToPunchApp} disabled={syncing}>
            {syncing ? '同期中...' : '打刻アプリへ同期'}
          </button>
          <button className={styles.btnPrimary} onClick={handleNew}>
            ＋ 新規登録
          </button>
        </div>
      </div>
      {syncMessage && <div className={styles.syncMessage}>{syncMessage}</div>}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thFixed}>氏名</th>
              <th>区分</th>
              <th>部署</th>
              <th>職名</th>
              <th>年齢</th>
              <th>メール</th>
              <th className={styles.thRight}>基本給/時給</th>
              <th className={styles.thRight}>標準報酬月額</th>
              <th className={styles.thRight}>交通費</th>
              <th className={styles.thRight}>健康保険</th>
              <th className={styles.thRight}>厚生年金</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => {
              const age = emp.birthDate ? calcAge(emp.birthDate) : null
              return (
                <tr key={emp.id} className={styles.row}>
                  <td className={styles.tdFixed}>
                    <div className={styles.nameCell}>
                      <span className={styles.namePrimary}>{emp.name}</span>
                      <span className={styles.nameKana}>{emp.nameKana}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[`badge${emp.employeeType}`]}`}>
                      {emp.employeeType}
                    </span>
                  </td>
                  <td>{emp.departmentName}</td>
                  <td>{emp.jobTitle}</td>
                  <td>{age !== null ? `${age}歳` : '-'}</td>
                  <td className={styles.emailCell}>{emp.email || '-'}</td>
                  <td className={styles.tdRight}>{yen(emp.basicSalary)}</td>
                  <td className={styles.tdRight}>{yen(emp.standardMonthlyRemuneration)}</td>
                  <td className={styles.tdRight}>{yen(emp.transportAllowance)}</td>
                  <td className={styles.tdRight}>{yen(emp.healthInsurance)}</td>
                  <td className={styles.tdRight}>{yen(emp.welfarePension)}</td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => handleEdit(emp)} title="編集">
                        ✏️
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        onClick={() => handleDelete(emp)}
                        title="削除"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerCount}>{filtered.length} / {employees.length} 名表示中</span>
      </div>

      {isFormOpen && (
        <EmployeeForm
          employee={editingEmployee}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
