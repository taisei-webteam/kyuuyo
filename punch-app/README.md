# らくらく給与明細α 打刻アプリ

iPad で動作する PWA 打刻アプリ。従業員が名前をタップするだけで出退勤を記録できます。

## 機能

- 従業員カードをタップして出勤/退勤を打刻
- 出勤/退勤の自動判定（当日の状態に応じて切替）
- 打刻取消（誤タップ対応）
- 社員/役員/パートのフィルタ表示
- オフライン対応（IndexedDB → オンライン復帰時に自動同期）
- PWA（ホーム画面に追加でネイティブアプリ風に動作）

## セットアップ

### 1. Supabase

[Supabase](https://supabase.com) でプロジェクトを作成し、SQL Editor で以下を実行:

→ `../supabase/migrations/001_punch_records.sql`

### 2. 環境変数

```bash
cp .env.example .env
```

`.env` に Supabase の URL と anon key を設定。

### 3. 開発

```bash
npm install
npm run dev
```

### 4. iPad へのデプロイ

GitHub Pages に自動デプロイ（`main` ブランチへの push 時）。
iPad の Safari でデプロイ先 URL を開き「ホーム画面に追加」。

## 技術スタック

- React 19 + TypeScript 5
- Vite 6 + vite-plugin-pwa
- Supabase (PostgreSQL + REST API)
- CSS Modules
