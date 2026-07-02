import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { isEmployeeRetired } from '@/lib/mock-data'
import { getWithholdingRows, type WithholdingRow } from '@/lib/withholding'
import { WithholdingDirectPrint } from '@/components/WithholdingDirectPrint'
import styles from './WithholdingCertificate.module.css'

function yen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - i)

export function WithholdingCertificate(): ReactElement {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [rows, setRows] = useState<WithholdingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [preview, setPreview] = useState<WithholdingRow | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const r = await getWithholdingRows(year)
      setRows(r)
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <label className={styles.yearLabel}>対象年</label>
          <select
            className={styles.yearSelect}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
          <button className={styles.reloadBtn} onClick={() => void load()} disabled={loading}>
            {loading ? '集計中...' : '再集計'}
          </button>
        </div>
      </div>

      <div className={styles.notice}>
        <strong>年末調整前の実績集計版です。</strong>
        給与・賞与の1〜12月の合計から「支払金額・源泉徴収税額・社会保険料等の金額」を算出します。
        「給与所得控除後の金額」「所得控除の額の合計額」は年末調整で確定するため空欄になります。
        年の途中で退職した方は、この実績値がそのまま交付用として使えます。
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thLeft}>氏名</th>
              <th>区分</th>
              <th className={styles.thRight}>給与月数</th>
              <th className={styles.thRight}>賞与</th>
              <th className={styles.thRight}>支払金額</th>
              <th className={styles.thRight}>源泉徴収税額</th>
              <th className={styles.thRight}>社会保険料等</th>
              <th className={styles.thCenter}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ employee, summary }) => {
              const retired = isEmployeeRetired(employee)
              return (
                <tr key={employee.id}>
                  <td className={styles.nameCell}>
                    <span className={styles.namePrimary}>{employee.name}</span>
                    <span className={styles.nameKana}>{employee.nameKana}</span>
                  </td>
                  <td>
                    {retired ? (
                      <span className={styles.badgeRetired}>退職</span>
                    ) : (
                      <span className={styles.badgeActive}>在職</span>
                    )}
                  </td>
                  <td className={styles.tdRight}>{summary.monthsWithData}か月</td>
                  <td className={styles.tdRight}>{summary.hasBonus ? 'あり' : '-'}</td>
                  <td className={styles.tdRight}>{yen(summary.paymentAmount)}</td>
                  <td className={styles.tdRight}>{yen(summary.withholdingTax)}</td>
                  <td className={styles.tdRight}>{yen(summary.socialInsuranceTotal)}</td>
                  <td className={styles.tdCenter}>
                    <button
                      className={styles.previewBtn}
                      onClick={() => setPreview({ employee, summary })}
                    >
                      源泉徴収票
                    </button>
                  </td>
                </tr>
              )
            })}
            {loaded && !loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.emptyRow}>
                  {year}年の給与・賞与明細が見つかりません。給与作成・賞与作成で明細を保存してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerCount}>{rows.length} 名</span>
      </div>

      {preview && (
        <WithholdingDirectPrint
          employee={preview.employee}
          summary={preview.summary}
          year={year}
          onDone={() => setPreview(null)}
        />
      )}
    </div>
  )
}
