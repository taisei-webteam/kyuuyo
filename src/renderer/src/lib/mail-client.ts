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

export interface MailSendOptions {
  /** 未来の送信時刻（UTC ISO）。未指定なら今すぐ送る */
  sendAt?: string
  type?: 'payslip' | 'bonus'
  periodKey?: string
}

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
  phase: 'pdf' | 'sending' | 'scheduling'
}

/** 'YYYY-MM-DDTHH:mm' を日本時間として解釈し、UTC の ISO 文字列にする。不正なら null */
export function japanLocalInputToUtcIso(value: string): string | null {
  const trimmed = value.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(trimmed)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null
  const utc = new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(utc)
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''
  const back = `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`
  if (back !== trimmed) return null
  return utc.toISOString()
}

/** UTC の日時を日本時間の表示用文字列にする */
export function formatJapanDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
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
  container.style.width = '182mm'
  document.body.appendChild(container)

  const root = createRoot(container)
  try {
    await new Promise<void>((resolve) => {
      // メール添付は控えを省いた1枚構成（切り取り線は印刷でも出さない）
      root.render(createElement(PayslipPrintDocument, { ...doc, layout: 'mail' }))
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    if (document.fonts?.ready) {
      await document.fonts.ready
    }
    await delay(120)

    document.body.classList.add('is-printing-modal')
    const res = await window.api.export.pdfBuffer({ fileName, pageSize: 'B5', landscape: false })
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
  options?: MailSendOptions,
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

  const sendAtMs = options?.sendAt ? new Date(options.sendAt).getTime() : Number.NaN
  const scheduleForLater = Number.isFinite(sendAtMs) && sendAtMs > Date.now()
  if (scheduleForLater && options?.sendAt) {
    if (options.type !== 'payslip' && options.type !== 'bonus') {
      throw new Error('送信予約に必要な種別がありません')
    }
    if (!options.periodKey) {
      throw new Error('送信予約に必要な期間がありません')
    }
    if (typeof window.api.mail.schedule !== 'function') {
      throw new Error('送信予約はデスクトップアプリ版でのみ利用できます')
    }
    onProgress?.({ index: items.length, total: items.length, name: '', phase: 'scheduling' })
    const res = await window.api.mail.schedule({
      sendAt: options.sendAt,
      type: options.type,
      periodKey: options.periodKey,
      messages,
    })
    if (!res.success) {
      throw new Error(res.error)
    }
    return messages.map((message) => ({
      to: message.to,
      refId: message.refId,
      success: true,
      scheduled: true,
    }))
  }

  onProgress?.({ index: items.length, total: items.length, name: '', phase: 'sending' })
  const res = await window.api.mail.send(messages)
  if (!res.success) {
    throw new Error(res.error)
  }
  return res.data
}
