/**
 * メール送信のフロント側オーケストレーション
 *
 * 各従業員の明細を「印刷と同一レイアウト」でオフスクリーン描画し、
 * printToPDF で PDF 化（base64）してから Gmail API 送信 IPC へ渡す。
 */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { PayslipPrintDocument, type PayslipPrintDocumentProps } from '@/components/PayslipPrintDocument'
import type { MailMessageInput, MailSendResult } from '../../../shared/types'

export interface MailDocItem {
  /** 突き合わせ用ID（従業員ID） */
  refId: number
  name: string
  to: string
  subject: string
  body: string
  /** HTML版本文（任意） */
  html?: string
  /** 拡張子なしのファイル名 */
  fileName: string
  doc: PayslipPrintDocumentProps
}

export interface SendProgress {
  index: number
  total: number
  name: string
  phase: 'pdf' | 'sending'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isMailSendAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'api' in window &&
    typeof window.api?.mail?.send === 'function' &&
    typeof window.api?.export?.pdfBuffer === 'function'
  )
}

/** 明細1件をオフスクリーン描画して PDF(base64) を生成する */
async function renderPdfBase64(doc: PayslipPrintDocumentProps, fileName: string): Promise<string> {
  const container = document.createElement('div')
  container.className = 'printScope'
  // 画面上は隠す。印刷(PDF)時は print.css のルールで static 表示に切り替わる。
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = '210mm'
  document.body.appendChild(container)

  const root = createRoot(container)
  try {
    await new Promise<void>((resolve) => {
      // メール添付は控え・切り取り線を省いた1枚構成で描画する
      root.render(createElement(PayslipPrintDocument, { ...doc, layout: 'mail' }))
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    if (document.fonts?.ready) {
      await document.fonts.ready
    }
    await delay(120)

    document.body.classList.add('is-printing-modal')
    const res = await window.api.export.pdfBuffer({ fileName, pageSize: 'A4', landscape: false })
    if (!res.success) {
      throw new Error(res.error)
    }
    return res.data.base64
  } finally {
    document.body.classList.remove('is-printing-modal')
    root.unmount()
    container.remove()
  }
}

/**
 * 複数明細を PDF 添付付きで送信する。
 * 戻り値は refId（従業員ID）ごとの成否。
 */
export async function sendDocsByEmail(
  items: MailDocItem[],
  onProgress?: (p: SendProgress) => void,
): Promise<MailSendResult[]> {
  if (!isMailSendAvailable()) {
    throw new Error('メール送信はデスクトップアプリ版でのみ利用できます')
  }

  const messages: MailMessageInput[] = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    onProgress?.({ index: i, total: items.length, name: it.name, phase: 'pdf' })
    const base64 = await renderPdfBase64(it.doc, it.fileName)
    messages.push({
      to: it.to,
      subject: it.subject,
      body: it.body,
      html: it.html,
      refId: it.refId,
      attachments: [{ filename: `${it.fileName}.pdf`, contentBase64: base64, mimeType: 'application/pdf' }],
    })
  }

  onProgress?.({ index: items.length, total: items.length, name: '', phase: 'sending' })
  const res = await window.api.mail.send(messages)
  if (!res.success) {
    throw new Error(res.error)
  }
  return res.data
}
