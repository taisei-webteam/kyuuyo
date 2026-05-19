# らくらく給与明細α

中小企業向け給与明細作成ソフト（Windows デスクトップアプリケーション）

## 機能

- 従業員マスタ管理
- 給与明細の作成・計算（所得税・社会保険料の自動計算）
- 賞与明細の作成
- 給与明細の PDF 出力・印刷
- ダッシュボード（月次サマリー）
- GitHub Releases 経由の自動アップデート

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| ランタイム | Electron |
| フロントエンド | React + TypeScript + Vite |
| UI | shadcn/ui + TailwindCSS + Radix UI |
| データベース | SQLite (better-sqlite3) + Drizzle ORM |
| PDF | @react-pdf/renderer |
| 状態管理 | Zustand |

## 開発

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# TypeScript 型チェック
npm run typecheck

# ビルド (Windows)
npm run build
```

## リリース

```bash
# バージョン更新 + タグ作成
npm version patch  # or minor / major

# タグをプッシュ → GitHub Actions が自動ビルド & リリース
git push --tags
```

## ディレクトリ構成

```
src/
├── main/          # Electron Main Process (IPC, DB, Services)
├── renderer/      # React UI (Pages, Components, Stores)
├── shared/        # 共有型定義
└── preload/       # Preload Script (contextBridge)
```

## ライセンス

Proprietary - All rights reserved.
