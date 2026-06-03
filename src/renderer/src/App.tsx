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

export function App(): ReactElement {
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
