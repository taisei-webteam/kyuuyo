export type PrintOrientation = 'portrait' | 'landscape'
export type PrintMode = 'page' | 'modal'

export interface PrintOptions {
  orientation?: PrintOrientation
  mode?: PrintMode
}

const STYLE_ID = 'dynamic-print-style'

function applyPageStyle(orientation: PrintOrientation): void {
  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = STYLE_ID
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = `@media print { @page { size: A4 ${orientation}; margin: 8mm; } }`
}

export function triggerPrint(options?: PrintOptions): void {
  const orientation = options?.orientation ?? 'portrait'
  const mode = options?.mode ?? 'page'

  applyPageStyle(orientation)

  if (mode === 'modal') {
    document.body.classList.add('is-printing-modal')
  }

  const cleanup = (): void => {
    document.body.classList.remove('is-printing-modal')
    window.removeEventListener('afterprint', cleanup)
  }

  window.addEventListener('afterprint', cleanup)
  window.print()
}
