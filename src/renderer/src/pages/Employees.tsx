import { useState, useMemo, useEffect, useCallback } from 'react'
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
import { useVerifyAutoRefresh } from '@/hooks/useVerifyAutoRefresh'
import { ActionMenu } from '@/components/ActionMenu'
import { EmployeeForm } from '@/components/EmployeeForm'
import { EmailVerifyBulkModal } from '@/components/EmailVerifyBulkModal'
import { ResidentTaxBulkModal } from '@/components/ResidentTaxBulkModal'
import { SocialInsuranceBulkModal } from '@/components/SocialInsuranceBulkModal'
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
  const [isSocialInsuranceOpen, setIsSocialInsuranceOpen] = useState(false)
  const [isVerifyBulkOpen, setIsVerifyBulkOpen] = useState(false)
  const [verifyRefreshing, setVerifyRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  // 削除確認モーダルの対象従業員（null のとき非表示）
  const [deleteTarget, setDeleteTarget] = useState<MockEmployee | null>(null)
  const [deleting, setDeleting] = useState(false)

  /** 確認中の従業員がいれば照会し、確認済みになったものを取り込む（通知は出さない）。 */
  const refreshVerificationsSilently = useCallback(async (): Promise<void> => {
    if (!getEmployees().some((emp) => emp.emailVerifyStatus === 'pending')) return
    const res = await window.api.mail.refreshVerificationBulk()
    if (!res.success || res.data.newlyVerified === 0) return
    await reloadEmployeesFromDb()
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!hasElectronApi) return
    void (async () => {
      const ok = await reloadEmployeesFromDb()
      if (!ok) return
      setRefreshKey((k) => k + 1)
      try {
        await refreshVerificationsSilently()
      } catch {
        // 自動照会の失敗は無視する（メニューから手動で再実行できる）
      }
    })()
  }, [refreshVerificationsSilently])

  const employees = useMemo(() => getEmployees(), [refreshKey])

  const hasPendingVerification = useMemo(
    () => employees.some((emp) => emp.emailVerifyStatus === 'pending'),
    [employees],
  )

  // 編集フォームを開いている間はフォーム側が照会するため、一覧側は発火させない
  useVerifyAutoRefresh(
    hasElectronApi && !isFormOpen && !verifyRefreshing && hasPendingVerification,
    refreshVerificationsSilently,
  )

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

  async function handleClose(): Promise<void> {
    setIsFormOpen(false)
    setEditingEmployee(null)
    // フォーム内のメール確認操作は保存を待たず DB を更新するため、一覧を読み直す
    if (hasElectronApi) {
      await reloadEmployeesFromDb()
      setRefreshKey((k) => k + 1)
    }
  }

  /** 確認中の従業員をまとめて照会し、相手が確認済みにしたものを一覧へ反映する。 */
  async function handleRefreshVerifications(): Promise<void> {
    if (!hasElectronApi) {
      setSyncMessage('Electron モードで起動してください')
      return
    }
    setVerifyRefreshing(true)
    setSyncMessage(null)
    try {
      const res = await window.api.mail.refreshVerificationBulk()
      if (!res.success) {
        setSyncMessage(`確認状態の更新に失敗しました: ${res.error}`)
        return
      }
      await reloadEmployeesFromDb()
      setRefreshKey((k) => k + 1)
      const { items, newlyVerified } = res.data
      setSyncMessage(
        items.length === 0
          ? '確認中の従業員はいません'
          : `${items.length}名を照会し、${newlyVerified}名が確認済みになりました`,
      )
    } catch (err) {
      setSyncMessage(
        `確認状態の更新に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`,
      )
    } finally {
      setVerifyRefreshing(false)
    }
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
      // 生年月日・入社日は送らない（Neon がマスタ。仮データでの上書き事故を防ぐ）
      const payload = getEmployees().map((e) => ({
        id: e.id,
        name: e.name,
        name_kana: e.nameKana,
        employee_type: e.employeeType,
        display_order: e.displayOrder,
        is_active: !isEmployeeRetired(e) && e.employeeType !== '役員',
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
          <ActionMenu
            label="一括入力"
            items={[
              {
                label: '健康・介護保険を一括入力',
                description: '健康保険と介護保険の合算額（本人負担）をまとめて登録します',
                onSelect: () => setIsSocialInsuranceOpen(true),
              },
              {
                label: '住民税を一括入力',
                description: '特別徴収税額の決定通知書の月額をまとめて登録します',
                onSelect: () => setIsResidentTaxOpen(true),
              },
            ]}
          />
          <ActionMenu
            label="メール確認"
            items={[
              {
                label: '到達確認メールを一括送信',
                description: '給与明細メールが届くかを確かめる確認メールを送ります',
                onSelect: () => setIsVerifyBulkOpen(true),
              },
              {
                label: verifyRefreshing ? '確認状態を取得中...' : '確認状態を最新にする',
                description: '従業員が確認ボタンを押したかどうかを取得して反映します',
                disabled: verifyRefreshing,
                onSelect: () => void handleRefreshVerifications(),
              },
            ]}
          />
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
              <th className={styles.thRight}>健康・介護</th>
              <th className={styles.thRight}>有給残</th>
              <th className={styles.thRight}>交通費</th>
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
                  <td className={styles.emailCell}>
                    {emp.email ? (
                      <div className={styles.emailCellInner}>
                        <span className={styles.emailText}>{emp.email}</span>
                        <span
                          className={styles.verifyBadge}
                          data-status={emp.emailVerifyStatus ?? 'unverified'}
                          title={
                            emp.emailVerifyStatus === 'verified'
                              ? '受信確認済み'
                              : emp.emailVerifyStatus === 'pending'
                                ? '確認メール送信済み（相手の確認待ち）'
                                : '受信確認をしていません'
                          }
                        >
                          {emp.emailVerifyStatus === 'verified'
                            ? '確認済み'
                            : emp.emailVerifyStatus === 'pending'
                              ? '確認中'
                              : '未確認'}
                        </span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={styles.tdRight}>{yen(emp.basicSalary)}</td>
                  <td className={styles.tdRight}>{yen(emp.healthInsurance)}</td>
                  <td className={styles.tdRight}>
                    {emp.paidLeaveBalance != null ? `${emp.paidLeaveBalance}日` : '-'}
                  </td>
                  <td className={styles.tdRight}>{yen(emp.transportAllowance)}</td>
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

      {isVerifyBulkOpen && (
        <EmailVerifyBulkModal
          employees={employees}
          onClose={() => setIsVerifyBulkOpen(false)}
          onSent={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {isSocialInsuranceOpen && (
        <SocialInsuranceBulkModal
          employees={employees}
          onClose={() => setIsSocialInsuranceOpen(false)}
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
