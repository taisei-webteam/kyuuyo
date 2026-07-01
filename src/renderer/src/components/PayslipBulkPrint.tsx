import { useCallback, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { triggerPrint } from '@/lib/print'
import { PayslipPrintDocument } from './PayslipPrintDocument'
import type { MockEmployee, MockPayslip } from '@/lib/mock-data'
import { useOverlayDismiss } from '@/hooks/useOverlayDismiss'
import styles from './PayslipPrintDocument.module.css'

export interface BulkPrintItem {
  employee: MockEmployee
  payslip: MockPayslip
}

interface PayslipBulkPrintProps {
  items: BulkPrintItem[]
  year: number
  month: number
  fileName: string
  titleLabel?: string
  periodLabel?: string
  variant?: 'salary' | 'bonus'
  onDone: () => void
}

/**
 * 複数従業員の明細を1つのPDF（1人1ページ）へまとめて出力する。
 * printToPDF はウィンドウ全体を描画するため、印刷対象(.printScope)に
 * 全員分を並べ、各ページを改ページで区切る。
 */
export function PayslipBulkPrint({
  items,
  year,
  month,
  fileName,
  titleLabel,
  periodLabel,
  variant = 'salary',
  onDone,
}: PayslipBulkPrintProps): ReactElement {
  const [busy, setBusy] = useState(false)

  const handlePrint = useCallback(async (): Promise<void> => {
    const exportPdf = window.api?.export?.pdf
    if (typeof exportPdf !== 'function') {
      triggerPrint({ orientation: 'portrait', mode: 'modal' })
      return
    }
    setBusy(true)
    document.body.classList.add('is-printing-modal')
    try {
      const result = await exportPdf({ fileName, pageSize: 'A4', landscape: false })
      if (!result.success) {
        alert(`PDF出力に失敗しました: ${result.error}`)
      }
    } catch (err) {
      alert(`PDF出力に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      document.body.classList.remove('is-printing-modal')
      setBusy(false)
    }
  }, [fileName])

  const overlay = useOverlayDismiss(onDone)

  return createPortal(
    <div className={`${styles.previewOverlay} printScope`} {...overlay}>
      <div className={styles.previewModal}>
        <div className={`${styles.previewHeader} noPrint`}>
          <h2 className={styles.previewTitle}>一括印刷プレビュー（{items.length}名）</h2>
          <div className={styles.previewActions}>
            <button
              className={styles.previewPrintButton}
              onClick={handlePrint}
              type="button"
              disabled={busy || items.length === 0}
            >
              {busy ? 'PDF生成中...' : `PDF出力 / 印刷（${items.length}名）`}
            </button>
            <button className={styles.previewCloseButton} onClick={onDone} type="button">
              ×
            </button>
          </div>
        </div>
        <div className={`${styles.previewBody} ${styles.bulkBody}`}>
          {items.map((it) => (
            <div key={it.employee.id} className={styles.bulkItem}>
              <PayslipPrintDocument
                employee={it.employee}
                payslip={it.payslip}
                year={year}
                month={month}
                titleLabel={titleLabel}
                periodLabel={periodLabel}
                variant={variant}
              />
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
