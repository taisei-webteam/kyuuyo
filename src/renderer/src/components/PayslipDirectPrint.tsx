import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactElement } from 'react'
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
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      triggerPrint({ orientation: 'portrait', mode: 'modal' })
    })

    const handleAfterPrint = (): void => {
      onDone()
    }

    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [onDone])

  return createPortal(
    <div className={`${styles.printLayer} printScope`}>
      <PayslipPrintDocument {...documentProps} />
    </div>,
    document.body,
  )
}
