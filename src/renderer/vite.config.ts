import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
