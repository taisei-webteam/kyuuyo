import type { ReactElement } from 'react'
import type { MockEmployee } from '@/lib/mock-data'
import type { WithholdingSummary } from '@/lib/withholding'
import { getSettings } from '@/lib/settings-store'
import styles from './WithholdingCertificateDocument.module.css'

export interface WithholdingCertificateDocumentProps {
  employee: MockEmployee
  summary: WithholdingSummary
  year: number
}

function num(amount: number): string {
  return amount.toLocaleString('ja-JP')
}

/** 西暦 → 令和年（2019=令和元年）。元年は「元」表記。 */
function reiwaLabel(year: number): string {
  const r = year - 2018
  return r === 1 ? '元' : String(r)
}

/** 'YYYY-MM-DD' が対象年に含まれるかを判定し、和暦の月日文字列を返す。 */
function inYearDate(ymd: string | null | undefined, year: number): string | null {
  if (!ymd) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return null
  if (Number(m[1]) !== year) return null
  return `${Number(m[2])}月${Number(m[3])}日`
}

export function WithholdingCertificateDocument({
  employee,
  summary,
  year,
}: WithholdingCertificateDocumentProps): ReactElement {
  const s = getSettings()
  const hireInYear = inYearDate(employee.hireDate, year)
  const resignInYear = inYearDate(employee.resignDate, year)

  const remarks: string[] = ['※本票は年末調整前の実績集計です。']
  remarks.push('「給与所得控除後の金額」「所得控除の額の合計額」は年末調整で確定するため空欄です。')
  if (hireInYear) remarks.push(`就職 ${hireInYear}`)
  if (resignInYear) remarks.push(`退職 ${resignInYear}`)
  if (summary.hasBonus) remarks.push('支払金額には賞与を含みます。')

  return (
    <div className={styles.page}>
      <div className={styles.sheet}>
        <div className={styles.titleBar}>
          <span className={styles.titleMain}>
            令和{reiwaLabel(year)}年分 給与所得の源泉徴収票
          </span>
        </div>

        {/* 支払を受ける者 */}
        <table className={styles.receiver}>
          <tbody>
            <tr>
              <th className={styles.rLabel}>支払を受ける者</th>
              <td className={styles.rAddrHead}>住所<br />又は居所</td>
              <td className={styles.rAddr}>&nbsp;</td>
            </tr>
            <tr>
              <th className={styles.rLabel}>受給者番号</th>
              <td className={styles.rNoHead}>（フリガナ）</td>
              <td className={styles.rName}>
                <div className={styles.kana}>{employee.nameKana}</div>
                <div className={styles.name}>
                  {employee.name}
                  <span className={styles.sama}>様</span>
                </div>
                <div className={styles.birth}>
                  生年月日：{employee.birthDate || '　'}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 金額メイン */}
        <table className={styles.amounts}>
          <thead>
            <tr>
              <th>種別</th>
              <th>支払金額</th>
              <th>給与所得控除後の金額</th>
              <th>所得控除の額の合計額</th>
              <th>源泉徴収税額</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.kind}>給料・賞与</td>
              <td className={styles.money}>{num(summary.paymentAmount)}<span className={styles.yen}>円</span></td>
              <td className={styles.blank}>（年末調整で算出）</td>
              <td className={styles.blank}>（年末調整で算出）</td>
              <td className={styles.money}>{num(summary.withholdingTax)}<span className={styles.yen}>円</span></td>
            </tr>
          </tbody>
        </table>

        {/* 社会保険料等 + 扶養 */}
        <table className={styles.sub}>
          <tbody>
            <tr>
              <th>社会保険料等の金額</th>
              <th>生命保険料の控除額</th>
              <th>地震保険料の控除額</th>
              <th>控除対象扶養親族の数</th>
            </tr>
            <tr>
              <td className={styles.money}>{num(summary.socialInsuranceTotal)}<span className={styles.yen}>円</span></td>
              <td className={styles.blank}>&nbsp;</td>
              <td className={styles.blank}>&nbsp;</td>
              <td className={styles.money}>{employee.dependents}<span className={styles.yen}>人</span></td>
            </tr>
          </tbody>
        </table>

        {/* 摘要 */}
        <table className={styles.remarksTable}>
          <tbody>
            <tr>
              <th className={styles.remarksLabel}>摘要</th>
              <td className={styles.remarksCell}>
                {remarks.map((r, i) => (
                  <div key={i}>{r}</div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 支払者 */}
        <table className={styles.payer}>
          <tbody>
            <tr>
              <th className={styles.payerLabel}>支払者</th>
              <td className={styles.payerBody}>
                <div className={styles.payerLine}>
                  {s.postalCode ? `〒${s.postalCode}　` : ''}{s.address}
                </div>
                <div className={styles.payerName}>{s.companyName}</div>
                <div className={styles.payerSub}>
                  {s.representativeName ? `代表者：${s.representativeName}　` : ''}
                  {s.phone ? `電話：${s.phone}` : ''}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className={styles.footnote}>
          支払金額は非課税の通勤手当等を除いた課税支給額の年間合計です。
          正式な源泉徴収票として提出・交付する際は、住所欄の記入と内容の最終確認を行ってください。
        </div>
      </div>
    </div>
  )
}
