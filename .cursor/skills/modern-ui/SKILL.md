---
name: modern-ui
description: >-
  モダンUIコンポーネント実装支援。shadcn/ui + TailwindCSS 4 + TanStack Table を使った
  画面構築の標準パターン・テーマ設定・アクセシビリティガイド。Use when creating UI components,
  pages, layouts, forms, data tables, or when the user mentions UI, 画面, コンポーネント,
  テーブル, フォーム, ダークモード, テーマ.
---

# モダンUI実装ガイド

## コンポーネント配置

```
src/renderer/
├── components/
│   ├── ui/              # shadcn/ui (CLI でコピー。直接カスタマイズ可)
│   ├── Sidebar.tsx      # アプリサイドバー
│   ├── TitleBar.tsx     # カスタムタイトルバー
│   ├── PageHeader.tsx   # ページヘッダー (タイトル + アクション)
│   ├── DataTable.tsx    # 汎用データテーブル (TanStack Table)
│   └── ...
├── pages/               # ページ単位コンポーネント
└── lib/
    └── utils.ts         # cn() ヘルパー等
```

## テーマ設定

### CSS変数 (globals.css)

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 221.2 83.2% 53.3%;      /* blue-600 */
    --primary-foreground: 210 40% 98%;
    /* ... shadcn/ui 標準変数 */
  }
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --primary: 217.2 91.2% 59.8%;      /* blue-500 */
    --primary-foreground: 222.2 47.4% 11.2%;
  }
}
```

### フォント

```css
body {
  font-family: 'Noto Sans JP', 'Inter', system-ui, sans-serif;
}
```

Google Fonts CDN または ローカルフォントファイルで読み込む。

## カスタムタイトルバー

```typescript
export function TitleBar() {
  return (
    <div className="flex h-10 items-center border-b bg-background px-4"
         style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <span className="text-sm font-medium">らくらく給与明細α</span>
      <div className="flex-1" />
      {/* ウィンドウコントロールは titleBarOverlay で OS が描画 */}
    </div>
  );
}
```

- `WebkitAppRegion: 'drag'` でウィンドウドラッグ可能
- ボタン・入力要素には `WebkitAppRegion: 'no-drag'` を設定

## データテーブル (TanStack Table v8)

```typescript
import { useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel, getFilteredRowModel } from '@tanstack/react-table';

function DataTable<T>({ data, columns }: Props<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  // shadcn/ui の Table コンポーネントでレンダリング
}
```

## フォームパターン

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, '氏名は必須です'),
  basicSalary: z.coerce.number().int().min(0, '基本給は0以上'),
});

function EmployeeForm() {
  const form = useForm({ resolver: zodResolver(schema) });
  return (
    <Form {...form}>
      <FormField name="name" render={({ field }) => (
        <FormItem>
          <FormLabel>氏名</FormLabel>
          <FormControl><Input {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </Form>
  );
}
```

## 数値フォーマット

```typescript
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency', currency: 'JPY',
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ja-JP').format(n);
}
```

## アニメーション (Framer Motion)

```typescript
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.15 }}
>
  {children}
</motion.div>
```

- `duration` は 0.1〜0.2s（業務ソフトなので控えめに）
- 大量データのリストにはアニメーション不要（パフォーマンス優先）

## アクセシビリティ基準

- shadcn/ui (Radix UI) の aria 属性を削除しない
- フォーカスリング: `focus-visible:ring-2 focus-visible:ring-ring`
- キーボード操作: `Escape` で閉じる、`Enter` で確定、`Tab` で移動
- 色だけに依存しない（アイコン + テキストの併用）
