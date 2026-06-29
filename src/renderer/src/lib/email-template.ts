import { getSettings } from './settings-store'
import type { AppSettings } from './settings-store'

export interface EmailTemplateVars {
  employeeName: string
  year: number
  month?: number
  season?: string
  companyName: string
}

export interface BuiltEmail {
  subject: string
  /** プレーンテキスト本文（署名込み） */
  body: string
  /** HTML本文（署名込み） */
  html: string
}

export function renderEmailTemplate(template: string, vars: EmailTemplateVars): string {
  const monthLabel = vars.month !== undefined ? String(vars.month) : ''
  const seasonLabel = vars.season ?? ''

  return template
    .replaceAll('{employeeName}', vars.employeeName)
    .replaceAll('{year}', String(vars.year))
    .replaceAll('{month}', monthLabel)
    .replaceAll('{season}', seasonLabel)
    .replaceAll('{companyName}', vars.companyName)
}

/** 会社情報から署名（プレーンテキスト）を組み立てる。空項目は省略。 */
function buildSignatureLines(settings: AppSettings): string[] {
  const lines: string[] = []
  if (settings.companyName) lines.push(settings.companyName)
  if (settings.representativeName) lines.push(settings.representativeName)
  const addr = [settings.postalCode ? `〒${settings.postalCode}` : '', settings.address]
    .filter(Boolean)
    .join(' ')
  if (addr) lines.push(addr)
  if (settings.phone) lines.push(`TEL: ${settings.phone}`)
  return lines
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** プレーンテキスト本文＋署名から HTML 版を生成する */
function buildHtml(bodyText: string, settings: AppSettings): string {
  const bodyHtml = escapeHtml(bodyText).replaceAll('\n', '<br>')
  const sigLines = buildSignatureLines(settings)
  const sigHtml =
    sigLines.length > 0
      ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">` +
        `<div style="font-size:12px;color:#6b7280;line-height:1.7;">` +
        sigLines.map((l) => escapeHtml(l)).join('<br>') +
        `</div>`
      : ''

  return (
    `<div style="font-family:'Hiragino Sans','Yu Gothic',Meiryo,sans-serif;font-size:14px;color:#1f2937;line-height:1.8;max-width:640px;">` +
    `<div>${bodyHtml}</div>` +
    sigHtml +
    `</div>`
  )
}

function buildEmail(subjectTemplate: string, bodyTemplate: string, vars: EmailTemplateVars): BuiltEmail {
  const settings = getSettings()
  const subject = renderEmailTemplate(subjectTemplate, vars)
  const renderedBody = renderEmailTemplate(bodyTemplate, vars)
  const sigLines = buildSignatureLines(settings)
  const body =
    sigLines.length > 0 ? `${renderedBody}\n\n${sigLines.join('\n')}` : renderedBody
  const html = buildHtml(renderedBody, settings)
  return { subject, body, html }
}

export function buildPayslipEmail(vars: EmailTemplateVars): BuiltEmail {
  const settings = getSettings()
  return buildEmail(settings.payslipEmailSubject, settings.payslipEmailBody, vars)
}

export function buildBonusEmail(vars: EmailTemplateVars): BuiltEmail {
  const settings = getSettings()
  return buildEmail(settings.bonusEmailSubject, settings.bonusEmailBody, vars)
}
