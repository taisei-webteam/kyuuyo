import { useCallback, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { triggerPrint } from '@/lib/print'
import { useOverlayDismiss } from '@/hooks/useOverlayDismiss'
import {
  WithholdingCertificateDocument,
  type WithholdingCertificateDocumentProps,
} from './WithholdingCertificateDocument'
import styles from './PayslipPrintDocument.module.css'

interface WithholdingDirectPrintProps extends WithholdingCertificateDocumentProps {
  onDone: () => void
}

export function WithholdingDirectPrint({
  onDone,
  ...documentProps
}: WithholdingDirectPrintProps): ReactElement {
  const [busy, setBusy] = useState(false)

  const handlePrint = useCallback(async (): Promise<void> => {
    const exportPdf = window.api?.export?.pdf
    if (typeof exportPdf !== 'function') {
      triggerPrint({ orientation: 'portrait', mode: 'modal' })
      return
    }

    const fileName = `${documentProps.year}年分_源泉徴収票_${documentProps.employee.name}様`
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

  const overlay = useOverlayDismiss(onDone)

  return createPortal(
    <div className={`${styles.previewOverlay} printScope`} {...overlay}>
      <div className={styles.previewModal}>
        <div className={`${styles.previewHeader} noPrint`}>
          <h2 className={styles.previewTitle}>源泉徴収票プレビュー</h2>
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
          <WithholdingCertificateDocument {...documentProps} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
