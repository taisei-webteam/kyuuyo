import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Employees } from './pages/Employees'
import { Attendance } from './pages/Attendance'
import { PayslipCreate } from './pages/PayslipCreate'
import { BonusCreate } from './pages/BonusCreate'
import { PayslipHistory } from './pages/PayslipHistory'
import Settings from './pages/Settings'
import { reloadEmployeesFromDb, hydrateCalendarYearFromDb } from './lib/mock-data'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

export function App(): ReactElement {
  // Electron 環境では起動時に DB の従業員一覧を共通データソースへ読み込む。
  // これにより従業員管理・給与作成・給与生成が DB の従業員（打刻アプリ追加分含む）を反映する。
  const [ready, setReady] = useState(!hasElectronApi)

  useEffect(() => {
    if (!hasElectronApi) return
    let cancelled = false
    void (async () => {
      try {
        await reloadEmployeesFromDb()
        await hydrateCalendarYearFromDb(new Date().getFullYear())
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: '#64748b' }}>
        従業員データを読み込み中...
      </div>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/payslip" element={<PayslipCreate />} />
        <Route path="/bonus" element={<BonusCreate />} />
        <Route path="/history" element={<PayslipHistory />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}
