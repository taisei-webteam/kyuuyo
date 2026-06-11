import { getSettings } from './settings-store'

export interface EmailTemplateVars {
  employeeName: string
  year: number
  month?: number
  season?: string
  companyName: string
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

export function buildPayslipEmail(vars: EmailTemplateVars): { subject: string; body: string } {
  const settings = getSettings()
  return {
    subject: renderEmailTemplate(settings.payslipEmailSubject, vars),
    body: renderEmailTemplate(settings.payslipEmailBody, vars),
  }
}

export function buildBonusEmail(vars: EmailTemplateVars): { subject: string; body: string } {
  const settings = getSettings()
  return {
    subject: renderEmailTemplate(settings.bonusEmailSubject, vars),
    body: renderEmailTemplate(settings.bonusEmailBody, vars),
  }
}
