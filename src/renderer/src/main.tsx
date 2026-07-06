import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import './index.css'
import './styles/print.css'

// HashRouter を使用する: 配布版 (Electron) は file:// で index.html を読み込むため、
// BrowserRouter ではパスがルート定義にマッチせず画面が真っ白になる
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
