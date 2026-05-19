---
name: pdf-payslip
description: >-
  給与明細PDF生成の実装支援。@react-pdf/renderer を使ったレイアウト設計パターン。
  Use when implementing PDF generation, payslip printing, or when the user mentions
  PDF出力, 給与明細印刷, 明細書, @react-pdf.
---

# 給与明細PDF生成ガイド

## 技術選定

- **ライブラリ**: `@react-pdf/renderer` — React コンポーネントとしてPDFを定義
- **実行場所**: Main Process (`src/main/services/pdf.gen.ts`)
- **フォント**: Noto Sans JP (日本語対応必須)

## PDF生成の流れ

```
Renderer: ユーザーが「PDF出力」ボタンをクリック
  → IPC: 'export:pdf' チャンネルで明細データを送信
    → Main: pdf.gen.ts が @react-pdf/renderer でPDF生成
      → ファイル保存ダイアログ or 一時ファイル → 印刷
```

## 給与明細レイアウト (A4縦)

```
┌─────────────────────────────────────┐
│         給  与  明  細  書          │
│    令和○年○月分  支給日: ○月○日  │
├─────────────────────────────────────┤
│ 会社名: ○○株式会社                │
│ 氏名: ○○ ○○    部署: ○○部     │
├──────────────┬──────────────────────┤
│   支  給     │    控  除            │
├──────────────┼──────────────────────┤
│ 基本給  xxx  │ 健康保険    xxx      │
│ 残業手当 xx  │ 厚生年金    xxx      │
│ 通勤手当 xx  │ 雇用保険    xxx      │
│ ...          │ 所得税      xxx      │
│              │ 住民税      xxx      │
├──────────────┼──────────────────────┤
│ 総支給額 xxx │ 控除合計    xxx      │
├──────────────┴──────────────────────┤
│         差引支給額: ¥xxx,xxx        │
├─────────────────────────────────────┤
│ 勤怠情報: 出勤日数/有給/残業時間   │
└─────────────────────────────────────┘
```

## @react-pdf/renderer の実装パターン

```typescript
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
  family: 'NotoSansJP',
  src: '/path/to/NotoSansJP-Regular.ttf',
});

const styles = StyleSheet.create({
  page: { fontFamily: 'NotoSansJP', fontSize: 10, padding: 30 },
  title: { fontSize: 16, textAlign: 'center', marginBottom: 10 },
  table: { display: 'flex', flexDirection: 'row' },
  column: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  amount: { textAlign: 'right' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#000', paddingTop: 4 },
});
```

## 金額表示フォーマット

```typescript
function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}
```

- 3桁カンマ区切り
- マイナスは `△` 表記 (日本の会計慣行)
- 0円は `—` (ダッシュ) 表記も選択肢

## 印刷対応

- A4サイズ (595.28 x 841.89 pt)
- マージン: 上下左右 30pt
- 1ページに1名分の明細を配置
- 複数人分は複数ページ
