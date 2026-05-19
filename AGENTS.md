# AGENTS.md - らくらく給与明細α

本リポジトリで作業する全ての AI エージェント（Cursor, GitHub Copilot 等）が従うべき共通指示。

## 言語

- コミットメッセージ: 日本語 (Conventional Commits 形式)
- コード内コメント: 日本語 OK（ただし冗長な説明コメントは不要）
- UI テキスト: 日本語

## 最重要原則

1. **給与計算の正確性が最優先** — 所得税・社会保険料・端数処理は法令に準拠すること。推測で計算ロジックを書かない
2. **TypeScript strict モード厳守** — `any` 型の使用禁止、型推論に頼らず明示的な型定義を推奨
3. **変更前に必ず読む** — ファイルの現在の内容を確認してからコードを変更する (Read-Before-Write)

## 技術スタック

- Electron + React 19 + TypeScript + Vite
- shadcn/ui + TailwindCSS + Radix UI
- SQLite (better-sqlite3) + Drizzle ORM
- Zustand (状態管理) + Zod (バリデーション)

## コミットメッセージ形式

```
<type>(<scope>): <日本語サマリー>

概要:
- 変更内容

理由:
- 変更理由
```

type: feat / fix / refactor / docs / test / chore / style
