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

### 1. Neon

Neon に打刻用テーブルを作成します。

- `employees_sync`
- `punch_records`

このリポジトリでは Neon MCP 経由で作成します。

`punch_devices`（端末登録）と `email_verifications`（メール到達確認）は
API 側の `create table if not exists` で自動作成されるため、手動作成は不要です。

### 2. 環境変数

```bash
cp .env.example .env
```

Vercel の環境変数に `DATABASE_URL` を設定してください。

ローカルで API まで確認する場合も `.env` に `DATABASE_URL` を設定します。

### 3. 開発

フロントエンドだけを確認する場合:

```bash
npm install
npm run dev
```

Vercel API Functions まで含めて確認する場合:

```bash
npm install
npm run dev:vercel
```

### 4. iPad へのデプロイ

Vercel にデプロイし、iPad の Safari でデプロイ先 URL を開き「ホーム画面に追加」。

## メール到達確認（/api/verify-email）

給与明細メールが従業員（多くはキャリアアドレス）に届くかを確認する仕組み。
Windows アプリの従業員編集画面「送信確認」から確認メールを送信し、
従業員がメール内のURLを開いて「確認する」ボタンを押すと確認済みになります。

- `GET /api/verify-email?token=...` — 確認ページを表示（この時点では確定しない）
- `POST /api/verify-email?token=...` — 確認を確定（`email_verifications.status = 'verified'`）

GET で確定しないのは、迷惑メールフィルタによるリンク先の自動取得で
誤って確認済みになるのを防ぐためです。

Windows アプリ側では、設定 →「打刻連携」にこのアプリの URL を登録してください
（確認リンクの生成に使用します）。

## 技術スタック

- React 19 + TypeScript 5
- Vite 6 + vite-plugin-pwa
- Vercel Functions
- Neon PostgreSQL
- CSS Modules
