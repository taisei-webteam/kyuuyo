import { useState, useMemo, useRef, useCallback } from 'react'
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

/** CSVテキストから { 従業員ID → 住民税額 } を抽出する。 */
function parseResidentTaxCsv(text: string, validIds: Set<number>): { map: Map<number, number>; result: ImportResult } {
  const stripped = text.replace(/^\uFEFF/, '')
  const lines = stripped.split(/\r?\n/).filter((l) => l.trim() !== '')
  const map = new Map<number, number>()
  let matched = 0
  let unmatched = 0
  if (lines.length === 0) return { map, result: { matched, unmatched } }

  // ヘッダー行の検出（先頭セルが数値でなければヘッダーとみなす）
  const firstCells = parseCsvLine(lines[0])
  const hasHeader = !/^\d+$/.test(firstCells[0].trim())
  let idIdx = 0
  let amountIdx = firstCells.length - 1
  let startRow = 0
  if (hasHeader) {
    startRow = 1
    const headerFoundId = firstCells.findIndex((c) => /id/i.test(c) || c.includes('番号'))
    const headerFoundAmount = firstCells.findIndex((c) => c.includes('住民税') || c.includes('税'))
    if (headerFoundId >= 0) idIdx = headerFoundId
    if (headerFoundAmount >= 0) amountIdx = headerFoundAmount
  }

  for (let r = startRow; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r])
    const id = Number(cells[idIdx]?.trim())
    const amount = parseAmount(cells[amountIdx] ?? '')
    if (!Number.isInteger(id) || !validIds.has(id) || amount === null) {
      unmatched++
      continue
    }
    map.set(id, amount)
    matched++
  }
  return { map, result: { matched, unmatched } }
}

export function ResidentTaxBulkModal({
  employees,
  onClose,
  onSaved,
}: {
  employees: MockEmployee[]
  onClose: () => void
  onSaved: () => void
}): ReactElement {
  const [drafts, setDrafts] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    for (const e of employees) init[e.id] = String(e.residentTax)
    return init
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentById = useMemo(() => {
    const m = new Map<number, number>()
    for (const e of employees) m.set(e.id, e.residentTax)
    return m
  }, [employees])

  const changedCount = useMemo(() => {
    let n = 0
    for (const e of employees) {
      const draft = parseAmount(drafts[e.id] ?? '')
      if (draft !== null && draft !== e.residentTax) n++
    }
    return n
  }, [drafts, employees])

  const totalPreview = useMemo(() => {
    let sum = 0
    for (const e of employees) {
      const draft = parseAmount(drafts[e.id] ?? '')
      sum += draft ?? e.residentTax
    }
    return sum
  }, [drafts, employees])

  const handleChange = useCallback((id: number, value: string): void => {
    setDrafts((prev) => ({ ...prev, [id]: value }))
  }, [])

  const handleExportTemplate = useCallback(async (): Promise<void> => {
    const header = ['ID', '氏名', '住民税']
    const rows = employees.map((e) => [e.id, e.name, parseAmount(drafts[e.id] ?? '') ?? e.residentTax])
    const content = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
    const fileName = '住民税一括入力テンプレート'
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
        const { map, result } = parseResidentTaxCsv(text, validIds)
        if (map.size === 0) {
          setMessage('取り込める住民税データが見つかりませんでした。ID列と住民税列を確認してください。')
          return
        }
        setDrafts((prev) => {
          const next = { ...prev }
          for (const [id, amount] of map) next[id] = String(amount)
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
    // 入力値の検証
    const invalid = employees.filter((e) => parseAmount(drafts[e.id] ?? '') === null)
    if (invalid.length > 0) {
      setMessage(`入力が正しくない従業員がいます（${invalid.map((e) => e.name).join('、')}）。数字を入力してください。`)
      return
    }
    const targets = employees
      .map((e) => ({ e, amount: parseAmount(drafts[e.id] ?? '') as number }))
      .filter(({ e, amount }) => amount !== e.residentTax)

    if (targets.length === 0) {
      setMessage('変更はありません。')
      return
    }
    setBusy(true)
    setMessage('保存中...')
    try {
      if (hasElectronApi) {
        let ok = 0
        for (const { e, amount } of targets) {
          const res = await window.api.employees.update({ id: e.id, residentTax: amount })
          if (res.success) ok++
        }
        await reloadEmployeesFromDb()
        setMessage(`${ok} 名の住民税を更新しました`)
        if (ok !== targets.length) {
          setMessage(`${ok}/${targets.length} 名を更新しました（一部失敗）`)
        }
      } else {
        for (const { e, amount } of targets) {
          updateEmployee({ ...e, residentTax: amount })
        }
        setMessage(`${targets.length} 名の住民税を更新しました`)
      }
      onSaved()
    } catch (err) {
      setMessage(`保存に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setBusy(false)
    }
  }, [drafts, employees, onSaved])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>住民税の一括入力</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <p className={styles.desc}>
          市区町村の「特別徴収税額の決定通知書」に記載された毎月の住民税額を入力します。
          画面で直接入力するか、CSVで一括取込できます。
        </p>

        <div className={styles.note}>
          <div className={styles.noteTitle}>CSVで取り込む場合の書式</div>
          <ul className={styles.noteList}>
            <li>
              まず<strong>「テンプレート出力」</strong>でCSVを書き出し、金額欄に記入して取り込むのが確実です。
            </li>
            <li>
              列の並び:<code>A列＝従業員ID</code> / <code>B列＝氏名</code> / <code>C列＝住民税（月額・円）</code>
            </li>
            <li>
              照合は<strong>従業員ID（A列）</strong>で行います。<strong>ID列は変更・削除しないでください</strong>（氏名は参考表示のみ）。
            </li>
            <li>1行目の見出し（ID, 氏名, 住民税）は有っても無くても構いません。金額は <code>¥</code> やカンマ付きでも取り込めます。</li>
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
            住民税 合計（月額）: <span className={styles.summaryValue}>{yen(totalPreview)}</span>
          </span>
        </div>

        <div className={styles.body}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>氏名</th>
                <th>区分</th>
                <th className={styles.thRight}>現在</th>
                <th className={styles.thRight}>新しい住民税（月額）</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const draftRaw = drafts[e.id] ?? ''
                const draft = parseAmount(draftRaw)
                const current = currentById.get(e.id) ?? 0
                const changed = draft !== null && draft !== current
                return (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td className={styles.muted}>{e.employeeType}</td>
                    <td className={styles.tdRight}>{yen(current)}</td>
                    <td className={styles.tdRight}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${changed ? styles.changed : ''}`}
                        value={draftRaw}
                        onChange={(ev) => handleChange(e.id, ev.target.value)}
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
    </div>
  )
}
