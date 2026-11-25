import { execFile } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/** ブラウザ開発時に本番 SQLite（読み取り専用）を /__dev/snapshot で渡す */
function devDbSnapshotPlugin(): Plugin {
  let cached: Promise<string> | null = null
  const readSnapshot = (): Promise<string> => {
    cached ??= new Promise((resolve, reject) => {
      const electronExe = path.resolve(__dirname, '../../node_modules/electron/dist/electron.exe')
      const script = path.resolve(__dirname, '../../scripts/dev-db-snapshot.cjs')
      execFile(
        electronExe,
        [script],
        {
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
          maxBuffer: 32 * 1024 * 1024,
          windowsHide: true,
        },
        (err, stdout, stderr) => {
          if (err) {
            cached = null
            reject(new Error(stderr || err.message))
            return
          }
          resolve(stdout)
        },
      )
    })
    return cached
  }

  return {
    name: 'dev-db-snapshot',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/__dev/snapshot') {
          next()
          return
        }
        void readSnapshot()
          .then((json) => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(json)
          })
          .catch((err: unknown) => {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'snapshot failed' }))
          })
      })
    },
  }
}

/**
 * 同梱フォントを、これまで外部から読み込んでいたときと同じ名前・太さの範囲 (400〜700) で登録する。
 * 範囲を広げると 800 / 900 指定の文字が今より太く表示される。
 */
function bundledFontPlugin(): Plugin {
  const packagedName = "font-family: 'Noto Sans JP Variable'"
  const packagedWeight = 'font-weight: 100 900'
  return {
    name: 'bundled-noto-sans-jp',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@fontsource-variable/noto-sans-jp') || !id.split('?')[0].endsWith('.css')) return null
      if (!code.includes(packagedName) || !code.includes(packagedWeight)) {
        this.error('同梱フォントの定義が想定と異なります。@fontsource-variable/noto-sans-jp の内容を確認してください。')
      }
      return {
        code: code
          .replaceAll(packagedName, "font-family: 'Noto Sans JP'")
          .replaceAll(packagedWeight, 'font-weight: 400 700'),
        map: null,
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), devDbSnapshotPlugin(), bundledFontPlugin()],
  // パッケージ版は file:// で読み込むため相対パスにする
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    // 本番読込先 (dist/main/main から ../../renderer) に合わせてリポジトリ直下 dist/renderer へ出力
    outDir: path.resolve(__dirname, '../../dist/renderer'),
    emptyOutDir: true,
  },
})
