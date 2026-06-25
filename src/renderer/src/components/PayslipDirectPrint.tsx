import { useCallback, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { triggerPrint } from '@/lib/print'
import { PayslipPrintDocument, type PayslipPrintDocumentProps } from './PayslipPrintDocument'
import styles from './PayslipPrintDocument.module.css'

interface PayslipDirectPrintProps extends PayslipPrintDocumentProps {
  onDone: () => void
}

export function PayslipDirectPrint({
  onDone,
  ...documentProps
}: PayslipDirectPrintProps): ReactElement {
  const [busy, setBusy] = useState(false)

  const handlePrint = useCallback(async (): Promise<void> => {
    const exportPdf = window.api?.export?.pdf
    if (typeof exportPdf !== 'function') {
      // ブラウザ(Vite単体) または preload未更新時は従来の印刷ダイアログにフォールバック
      triggerPrint({ orientation: 'portrait', mode: 'modal' })
      return
    }

    const docKind = documentProps.titleLabel?.includes('賞') ? '賞与明細' : '給与明細'
    const fileName = `${docKind}_${documentProps.employee.name}_${documentProps.year}年${documentProps.month}月`
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
  }, [documentProps])

  function handleOverlayClick(e: React.MouseEvent): void {
    if (e.target === e.currentTarget) onDone()
  }

  return createPortal(
    <div className={`${styles.previewOverlay} printScope`} onClick={handleOverlayClick}>
      <div className={styles.previewModal}>
        <div className={`${styles.previewHeader} noPrint`}>
          <h2 className={styles.previewTitle}>印刷プレビュー</h2>
          <div className={styles.previewActions}>
            <button
              className={styles.previewPrintButton}
              onClick={handlePrint}
              type="button"
              disabled={busy}
            >
              {busy ? 'PDF生成中...' : 'PDF出力 / 印刷'}
            </button>
            <button className={styles.previewCloseButton} onClick={onDone} type="button">
              ×
            </button>
          </div>
        </div>
        <div className={styles.previewBody}>
          <PayslipPrintDocument {...documentProps} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
