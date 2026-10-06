import { useState, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ReactElement, ChangeEvent } from 'react'
import { updateEmployee, reloadEmployeesFromDb, type MockEmployee } from '@/lib/mock-data'
import styles from './ResidentTaxBulkModal.module.css'

const hasElectronApi = typeof window !== 'undefined' && 'api' in window

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 1行のCSVをダブルクォート対応で分割する。 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

/** 金額文字列（カンマ・円記号・空白許容）を整数に変換する。無効なら null。 */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[¥,\s円]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

interface ImportResult {
  matched: number
  unmatched: number
}

interface PremiumDraft {
  health: string
  pension: string
}

interface PremiumAmounts {
  health: number | null
  pension: number | null
}

/** CSVテキストから { 従業員ID → 健康保険料・厚生年金 } を抽出する。 */
function parsePremiumCsv(
  text: string,
  validIds: Set<number>,
): { map: Map<number, PremiumAmounts>; result: ImportResult } {
  const stripped = text.replace(/^\uFEFF/, '')
  const lines = stripped.split(/\r?\n/).filter((l) => l.trim() !== '')
  const map = new Map<number, PremiumAmounts>()
  let matched = 0
  let unmatched = 0
  if (lines.length === 0) return { map, result: { matched, unmatched } }

  const firstCells = parseCsvLine(lines[0])
  const hasHeader = !/^\d+$/.test(firstCells[0].trim())
  let idIdx = 0
  let healthIdx = 2
  let pensionIdx = 3
  let startRow = 0
  if (hasHeader) {
    startRow = 1
    const headerFoundId = firstCells.findIndex((c) => /id/i.test(c) || c.includes('番号'))
    const headerFoundHealth = firstCells.findIndex(
      (c) => c.includes('健康') || c.includes('介護'),
    )
    const headerFoundPension = firstCells.findIndex((c) => c.includes('厚生') || c.includes('年金'))
    if (headerFoundId >= 0) idIdx = headerFoundId
    if (headerFoundHealth >= 0) healthIdx = headerFoundHealth
    if (headerFoundPension >= 0) pensionIdx = headerFoundPension
  } else if (firstCells.length < 4) {
    healthIdx = firstCells.length - 1
    pensionIdx = -1
  }

  for (let r = startRow; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r])
    const id = Number(cells[idIdx]?.trim())
    const health = parseAmount(cells[healthIdx] ?? '')
    const pension = pensionIdx >= 0 ? parseAmount(cells[pensionIdx] ?? '') : null
    if (!Number.isInteger(id) || !validIds.has(id) || (health === null && pension === null)) {
      unmatched++
      continue
    }
    map.set(id, { health, pension })
    matched++
  }
  return { map, result: { matched, unmatched } }
}

export function SocialInsuranceBulkModal({
  employees,
  onClose,
  onSaved,
}: {
  employees: MockEmployee[]
  onClose: () => void
  onSaved: () => void
}): ReactElement {
  const [drafts, setDrafts] = useState<Record<number, PremiumDraft>>(() => {
    const init: Record<number, PremiumDraft> = {}
    for (const e of employees) {
      init[e.id] = { health: String(e.healthInsurance), pension: String(e.welfarePension) }
    }
    return init
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const changedCount = useMemo(() => {
    let n = 0
    for (const e of employees) {
      const draft = drafts[e.id]
      const health = parseAmount(draft?.health ?? '')
      const pension = parseAmount(draft?.pension ?? '')
      if (health === null || pension === null) continue
      if (health !== e.healthInsurance || pension !== e.welfarePension) n++
    }
    return n
  }, [drafts, employees])

  const totals = useMemo(() => {
    let health = 0
    let pension = 0
    for (const e of employees) {
      const draft = drafts[e.id]
      health += parseAmount(draft?.health ?? '') ?? e.healthInsurance
      pension += parseAmount(draft?.pension ?? '') ?? e.welfarePension
    }
    return { health, pension }
  }, [drafts, employees])

  const handleChange = useCallback((id: number, field: keyof PremiumDraft, value: string): void => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { health: prev[id]?.health ?? '', pension: prev[id]?.pension ?? '', [field]: value },
    }))
  }, [])

  const handleExportTemplate = useCallback(async (): Promise<void> => {
    const header = ['ID', '氏名', '健康保険料', '厚生年金']
    const rows = employees.map((e) => [
      e.id,
      e.name,
      parseAmount(drafts[e.id]?.health ?? '') ?? e.healthInsurance,
      parseAmount(drafts[e.id]?.pension ?? '') ?? e.welfarePension,
    ])
    const content = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
    const fileName = '健康保険料・厚生年金一括入力テンプレート'
    const exportCsv = window.api?.export?.csv
    if (typeof exportCsv === 'function') {
      const result = await exportCsv({ fileName, content })
      if (result.success) {
        setMessage(result.data.path ? `CSVを保存しました: ${result.data.path}` : 'CSVを保存しました')
      } else {
        setMessage(`CSV出力に失敗しました: ${result.error}`)
      }
      return
    }
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [employees, drafts])

  const handleImportClick = useCallback((): void => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelected = useCallback(
    async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      try {
        const text = await file.text()
        const validIds = new Set(employees.map((emp) => emp.id))
        const { map, result } = parsePremiumCsv(text, validIds)
        if (map.size === 0) {
          setMessage('取り込めるデータが見つかりませんでした。ID列と金額列を確認してください。')
          return
        }
        setDrafts((prev) => {
          const next = { ...prev }
          for (const [id, amount] of map) {
            const current = next[id] ?? { health: '', pension: '' }
            next[id] = {
              health: amount.health === null ? current.health : String(amount.health),
              pension: amount.pension === null ? current.pension : String(amount.pension),
            }
          }
          return next
        })
        setMessage(
          `CSVから ${result.matched} 名を取り込みました` +
            (result.unmatched > 0 ? `（${result.unmatched} 行はスキップ）` : ''),
        )
      } catch (err) {
        setMessage(`CSV読み込みに失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
      }
    },
    [employees],
  )

  const handleSave = useCallback(async (): Promise<void> => {
    const invalid = employees.filter((e) => {
      const draft = drafts[e.id]
      return parseAmount(draft?.health ?? '') === null || parseAmount(draft?.pension ?? '') === null
    })
    if (invalid.length > 0) {
      setMessage(`入力が正しくない従業員がいます（${invalid.map((e) => e.name).join('、')}）。数字を入力してください。`)
      return
    }
    const targets = employees
      .map((e) => ({
        e,
        health: parseAmount(drafts[e.id]?.health ?? '') as number,
        pension: parseAmount(drafts[e.id]?.pension ?? '') as number,
      }))
      .filter(
        ({ e, health, pension }) =>
          health !== e.healthInsurance || pension !== e.welfarePension,
      )

    if (targets.length === 0) {
      setMessage('変更はありません。')
      return
    }
    setBusy(true)
    setMessage('保存中...')
    try {
      if (hasElectronApi) {
        let ok = 0
        for (const { e, health, pension } of targets) {
          const res = await window.api.employees.update({
            id: e.id,
            healthInsurance: health,
            welfarePension: pension,
            healthInsuranceManual: true,
          })
          if (res.success) ok++
        }
        await reloadEmployeesFromDb()
        setMessage(ok === targets.length ? `${ok} 名の健康保険料と厚生年金を更新しました` : `${ok}/${targets.length} 名を更新しました（一部失敗）`)
      } else {
        for (const { e, health, pension } of targets) {
          updateEmployee({
            ...e,
            healthInsurance: health,
            welfarePension: pension,
            healthInsuranceManual: true,
          })
        }
        setMessage(`${targets.length} 名の健康保険料と厚生年金を更新しました`)
      }
      onSaved()
    } catch (err) {
      setMessage(`保存に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setBusy(false)
    }
  }, [drafts, employees, onSaved])

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>健康保険料・厚生年金の一括入力</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <p className={styles.desc}>
          労務士の通知にある健康保険料と厚生年金（本人負担・月額）を入力します。
          給与を作成すると、この2つを控除にそのまま入れます。
          介護保険と子育て支援金も引くときは、健康保険料に通知の「健康保険計」を入れてください。
          令和8年9月28日の定時決定は、10月に支払う給与から使います。
        </p>

        <div className={styles.note}>
          <div className={styles.noteTitle}>CSVで取り込む場合の書式</div>
          <ul className={styles.noteList}>
            <li>
              まず<strong>「テンプレート出力」</strong>でCSVを書き出し、金額欄に記入して取り込むのが確実です。
            </li>
            <li>
              列の並び:<code>A列＝従業員ID</code> / <code>B列＝氏名</code> / <code>C列＝健康保険料（円）</code> / <code>D列＝厚生年金（円）</code>
            </li>
            <li>
              照合は<strong>従業員ID（A列）</strong>で行います。<strong>ID列は変更・削除しないでください</strong>（氏名は参考表示のみ）。
            </li>
            <li>1行目の見出しは有っても無くても構いません。金額は <code>¥</code> やカンマ付きでも取り込めます。</li>
          </ul>
        </div>

        <div className={styles.toolbar}>
          <button className={styles.btnSecondary} onClick={handleImportClick} disabled={busy}>
            CSV取込
          </button>
          <button className={styles.btnSecondary} onClick={() => void handleExportTemplate()} disabled={busy}>
            テンプレート出力
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => void handleFileSelected(e)}
          />
        </div>

        <div className={styles.summary}>
          <span>
            変更対象: <span className={styles.summaryValue}>{changedCount} 名</span>
          </span>
          <span>
            健康保険料 合計: <span className={styles.summaryValue}>{yen(totals.health)}</span>
          </span>
          <span>
            厚生年金 合計: <span className={styles.summaryValue}>{yen(totals.pension)}</span>
          </span>
        </div>

        <div className={styles.body}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>氏名</th>
                <th>区分</th>
                <th className={styles.thRight}>健康保険料（月額）</th>
                <th className={styles.thRight}>厚生年金（月額）</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const draft = drafts[e.id] ?? { health: '', pension: '' }
                const health = parseAmount(draft.health)
                const pension = parseAmount(draft.pension)
                const healthChanged = health !== null && health !== e.healthInsurance
                const pensionChanged = pension !== null && pension !== e.welfarePension
                return (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td className={styles.muted}>{e.employeeType}</td>
                    <td className={styles.tdRight}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${healthChanged ? styles.changed : ''}`}
                        value={draft.health}
                        aria-label={`${e.name}の健康保険料`}
                        onChange={(ev) => handleChange(e.id, 'health', ev.target.value)}
                      />
                    </td>
                    <td className={styles.tdRight}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${pensionChanged ? styles.changed : ''}`}
                        value={draft.pension}
                        aria-label={`${e.name}の厚生年金`}
                        onChange={(ev) => handleChange(e.id, 'pension', ev.target.value)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <span className={styles.message}>{message}</span>
          <div className={styles.actions}>
            <button className={styles.btnSecondary} onClick={onClose} disabled={busy}>
              キャンセル
            </button>
            <button className={styles.btnPrimary} onClick={() => void handleSave()} disabled={busy || changedCount === 0}>
              {busy ? '保存中...' : `${changedCount} 名を保存`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
