import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import './index.css'
import './styles/print.css'

/**
 * 確認やファイル選択のあと、クリックしても文字が入らないことがある。
 * 入力欄を押したときにウィンドウへキーボードを付け直す。
 */
function installKeyboardRestore(): void {
  if (typeof window === 'undefined' || !('api' in window) || !window.api?.app?.focusPage) return
  const focusPage = window.api.app.focusPage.bind(window.api.app)
  let last = 0
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const field = target.closest('input, textarea, select')
      if (
        !(field instanceof HTMLInputElement)
        && !(field instanceof HTMLTextAreaElement)
        && !(field instanceof HTMLSelectElement)
      ) {
        return
      }
      if (field.disabled || (field instanceof HTMLInputElement && field.readOnly)) return
      const now = Date.now()
      if (now - last < 400) return
      last = now
      void focusPage().then(() => {
        if (field.isConnected) field.focus({ preventScroll: true })
      })
    },
    true,
  )
}

installKeyboardRestore()

// HashRouter を使用する: 配布版 (Electron) は file:// で index.html を読み込むため、
// BrowserRouter ではパスがルート定義にマッチせず画面が真っ白になる
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
