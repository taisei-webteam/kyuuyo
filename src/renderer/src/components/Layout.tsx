import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import type { ReactNode, ReactElement } from 'react'
import styles from './Layout.module.css'
import { getSettings, subscribe } from '../lib/settings-store'

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { to: '/', icon: '🏠', label: 'ダッシュボード' },
  { to: '/employees', icon: '👤', label: '従業員管理' },
  { to: '/attendance', icon: '⏰', label: '勤怠管理' },
  { to: '/payslip', icon: '💰', label: '給与作成' },
  { to: '/history', icon: '📋', label: '給与一括編集' },
  { to: '/bonus', icon: '🎁', label: '賞与作成' },
  // 源泉徴収票: 今回スコープ外（別途料金の追加機能。2026-07-03 決定）。将来対応時に復帰
  // { to: '/withholding', icon: '📄', label: '源泉徴収票' },
  { to: '/settings', icon: '⚙️', label: '設定' },
]

const pageTitles: Record<string, string> = {
  '/': 'ダッシュボード',
  '/employees': '従業員管理',
  '/attendance': '勤怠管理',
  '/payslip': '給与作成',
  '/history': '給与一括編集',
  '/bonus': '賞与作成',
  // 源泉徴収票: 今回スコープ外（別途料金の追加機能。2026-07-03 決定）。将来対応時に復帰
  // '/withholding': '源泉徴収票',
  '/settings': '設定',
}

export function Layout({ children }: LayoutProps): ReactElement {
  const location = useLocation()
  const pageTitle = pageTitles[location.pathname] ?? ''
  const [companyName, setCompanyName] = useState(getSettings().companyName)

  useEffect(() => {
    return subscribe(() => setCompanyName(getSettings().companyName))
  }, [])

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoText}>らくらく給与明細α</span>
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>{pageTitle}</h1>
          <span className={styles.headerCompany}>{companyName}</span>
        </header>
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  )
}
