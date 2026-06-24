export type PrintOrientation = 'portrait' | 'landscape'
export type PrintMode = 'page' | 'modal'
export type PrintPaperSize = 'A4' | 'A3'

export interface PrintOptions {
  orientation?: PrintOrientation
  mode?: PrintMode
  size?: PrintPaperSize
}

const STYLE_ID = 'dynamic-print-style'

function applyPageStyle(orientation: PrintOrientation, size: PrintPaperSize): void {
  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = STYLE_ID
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = `@media print { @page { size: ${size} ${orientation}; margin: 8mm; } }`
}

export function triggerPrint(options?: PrintOptions): void {
  const orientation = options?.orientation ?? 'portrait'
  const mode = options?.mode ?? 'page'
  const size = options?.size ?? 'A4'

  applyPageStyle(orientation, size)

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
