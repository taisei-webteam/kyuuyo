import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { UpdateIndicator } from './components/UpdateIndicator'
import { Dashboard } from './pages/Dashboard'
import { Employees } from './pages/Employees'
import { Attendance } from './pages/Attendance'
import { PayslipCreate } from './pages/PayslipCreate'
import { BonusCreate } from './pages/BonusCreate'
import { PayslipHistory } from './pages/PayslipHistory'
// 源泉徴収票: 今回スコープ外（別途料金の追加機能。2026-07-03 決定）。将来対応時に下記2行を復帰
// import { WithholdingCertificate } from './pages/WithholdingCertificate'
import Settings from './pages/Settings'
import { reloadEmployeesFromDb, hydrateCalendarYearFromDb, hydrateInsuranceRatesFromDb } from './lib/mock-data'
import { hydrateCompanyFromDb } from './lib/settings-store'

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
        await hydrateCompanyFromDb()
        await hydrateCalendarYearFromDb(new Date().getFullYear())
        await hydrateInsuranceRatesFromDb(new Date().getFullYear())
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
    <>
      <Layout>
        <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/payslip" element={<PayslipCreate />} />
        <Route path="/bonus" element={<BonusCreate />} />
        <Route path="/history" element={<PayslipHistory />} />
        {/* 源泉徴収票: 今回スコープ外（別途料金の追加機能。2026-07-03 決定）。将来対応時に復帰 */}
        {/* <Route path="/withholding" element={<WithholdingCertificate />} /> */}
        <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      <UpdateIndicator />
    </>
  )
}
