import type { ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEmployees, getPayslips } from '@/lib/mock-data'
import styles from './Dashboard.module.css'

export function Dashboard(): ReactElement {
  const navigate = useNavigate()
  const employees = getEmployees()
  const payslips = getPayslips(2026, 5)

  const cards = [
    {
      icon: '👤',
      title: '従業員管理',
      description: '従業員の情報を管理します。基本給・手当・控除の設定が行えます。',
      meta: `${employees.length}名 登録中`,
      path: '/employees',
    },
    {
      icon: '⏰',
      title: '勤怠管理',
      description: 'iPad打刻データの確認・手動修正。月別の出勤状況を一覧で確認できます。',
      meta: '2026年5月',
      path: '/attendance',
    },
    {
      icon: '💰',
      title: '給与作成',
      description: '月次給与の計算・明細書の作成。社会保険料・所得税を自動計算します。',
      meta: '2026年5月',
      path: '/payslip',
    },
    {
      icon: '🎁',
      title: '賞与作成',
      description: '賞与（ボーナス）の計算・明細書の作成を行います。',
      meta: '次回: 2026年6月',
      path: '/bonus',
    },
  ]

  return (
    <div>
      <div className={styles.grid}>
        {cards.map((card) => (
          <div
            key={card.path}
            className={styles.card}
            onClick={() => navigate(card.path)}
          >
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>{card.icon}</div>
              <h2 className={styles.cardTitle}>{card.title}</h2>
            </div>
            <p className={styles.cardDescription}>{card.description}</p>
            <span className={styles.cardMeta}>{card.meta}</span>
          </div>
        ))}
      </div>

      <div className={styles.summarySection}>
        <h3 className={styles.summaryTitle}>今月の概要</h3>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryValue}>{employees.length}</div>
            <div className={styles.summaryLabel}>従業員数</div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryValue}>2</div>
            <div className={styles.summaryLabel}>未処理の勤怠</div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryValue}>{payslips.length}</div>
            <div className={styles.summaryLabel}>給与作成済み</div>
          </div>
        </div>
      </div>
    </div>
  )
}
