import { useState, useMemo, useEffect } from 'react'
import type { ReactElement } from 'react'
import {
  getEmployees,
  updateEmployee,
  deleteEmployee,
  reloadEmployeesFromDb,
  mockToEmployeeInput,
  calcAge,
  isEmployeeRetired,
  type MockEmployee,
} from '@/lib/mock-data'
import { EmployeeForm } from '@/components/EmployeeForm'
import { ResidentTaxBulkModal } from '@/components/ResidentTaxBulkModal'
import { StandardRemunerationModal } from '@/components/StandardRemunerationModal'
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
  const [isResidentTaxOpen, setIsResidentTaxOpen] = useState(false)
  const [isStdRemunOpen, setIsStdRemunOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  // 削除確認モーダルの対象従業員（null のとき非表示）
  const [deleteTarget, setDeleteTarget] = useState<MockEmployee | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!hasElectronApi) return
    void reloadEmployeesFromDb().then((ok) => {
      if (ok) setRefreshKey((k) => k + 1)
    })
  }, [])

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
      // 退職者は一覧の最後にまとめる（在籍者内・退職者内の並びは表示順を維持）
      .sort((a, b) => Number(isEmployeeRetired(a)) - Number(isEmployeeRetired(b)))
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

  // 削除ボタン: いきなり削除せず確認モーダルを開く
  function handleDelete(emp: MockEmployee): void {
    setDeleteTarget(emp)
  }

  // 確認モーダルで「削除する」を押したときの実処理
  async function confirmDelete(): Promise<void> {
    const emp = deleteTarget
    if (!emp) return
    setDeleting(true)
    try {
      if (hasElectronApi) {
        // 1) ローカルDBを論理削除（isActive=false。ID・過去の給与/打刻データは保持）
        const res = await window.api.employees.delete(emp.id)
        if (!res.success) {
          setSyncMessage(`削除に失敗しました: ${res.error}`)
          return
        }
        // 2) 打刻アプリ(Neon)へ is_active=false を送信し、一覧から即時に除外する
        const punch = await window.api.attendance.syncEmployees([
          {
            id: emp.id,
            name: emp.name,
            name_kana: emp.nameKana,
            employee_type: emp.employeeType,
            display_order: emp.displayOrder,
            is_active: false,
          },
        ])
        await reloadEmployeesFromDb()
        setSyncMessage(
          punch.success
            ? `${emp.name} を削除し、打刻アプリからも除外しました`
            : `${emp.name} を削除しましたが、打刻アプリへの反映に失敗しました: ${punch.error}`,
        )
      } else {
        deleteEmployee(emp.id)
        setSyncMessage(`${emp.name} を削除しました`)
      }
      setRefreshKey((k) => k + 1)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
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
      // 退職者・役員は is_active=false で送り、打刻アプリの一覧から外す（IDと過去の打刻データは保持）
      const payload = getEmployees().map((e) => ({
        id: e.id,
        name: e.name,
        name_kana: e.nameKana,
        employee_type: e.employeeType,
        display_order: e.displayOrder,
        is_active: !isEmployeeRetired(e) && e.employeeType !== '役員',
        birth_date: e.birthDate || null,
        hire_date: e.hireDate || null,
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
          <button className={styles.btnSecondary} onClick={() => setIsStdRemunOpen(true)}>
            標準報酬の定時決定
          </button>
          <button className={styles.btnSecondary} onClick={() => setIsResidentTaxOpen(true)}>
            住民税を一括入力
          </button>
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
              <th className={styles.thRight}>有給残</th>
              <th className={styles.thRight}>交通費</th>
              <th className={styles.thRight}>健康保険</th>
              <th className={styles.thRight}>厚生年金</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => {
              const age = emp.birthDate ? calcAge(emp.birthDate) : null
              const retired = isEmployeeRetired(emp)
              return (
                <tr
                  key={emp.id}
                  className={`${styles.row} ${retired ? styles.rowRetired : ''}`}
                >
                  <td className={styles.tdFixed}>
                    <div className={styles.nameCell}>
                      <span className={styles.namePrimary}>
                        {emp.name}
                        {retired && (
                          <span className={styles.badgeRetired}>
                            退職{emp.resignDate ? `（${emp.resignDate}）` : ''}
                          </span>
                        )}
                      </span>
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
                  <td className={styles.tdRight}>
                    {emp.paidLeaveBalance != null ? `${emp.paidLeaveBalance}日` : '-'}
                  </td>
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

      {isResidentTaxOpen && (
        <ResidentTaxBulkModal
          employees={employees}
          onClose={() => setIsResidentTaxOpen(false)}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {isStdRemunOpen && (
        <StandardRemunerationModal
          employees={employees}
          onClose={() => setIsStdRemunOpen(false)}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {deleteTarget && (
        <div
          className={styles.overlay}
          onClick={() => {
            if (!deleting) setDeleteTarget(null)
          }}
        >
          <div
            className={styles.confirmModal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.confirmHeader}>
              <span className={styles.confirmIcon} aria-hidden="true">
                ⚠️
              </span>
              <h2 id="delete-confirm-title" className={styles.confirmTitle}>
                従業員の削除
              </h2>
            </div>
            <div className={styles.confirmBody}>
              <p className={styles.confirmText}>
                <strong>{deleteTarget.name}</strong> を本当に削除しますか？
              </p>
              <p className={styles.confirmWarning}>
                ※ この操作は元に戻せません。削除すると、打刻アプリの一覧からも即時に削除されます。
              </p>
            </div>
            <div className={styles.confirmActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                キャンセル
              </button>
              <button
                className={styles.btnDanger}
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
