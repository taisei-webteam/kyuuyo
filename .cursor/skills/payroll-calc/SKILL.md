---
name: payroll-calc
description: >-
  給与計算ロジックの実装支援。所得税（源泉徴収税額表）、社会保険料（健康保険・厚生年金・雇用保険）、
  端数処理の正確な実装ガイド。Use when implementing payroll calculation, tax computation,
  insurance premium calculation, or when the user mentions 給与計算, 所得税, 社会保険料, 源泉徴収.
---

# 給与計算実装ガイド

## 計算エンジンの場所

- `src/main/services/payroll.calc.ts` — 給与計算メイン
- `src/main/services/tax.calc.ts` — 所得税計算
- `src/main/services/insurance.calc.ts` — 社会保険料計算

## 金額の型

全ての金額は**整数（円単位）**で扱う。TypeScript では `number` 型だが、小数を含めてはならない。

```typescript
type Yen = number; // 整数のみ。小数禁止。
```

## 端数処理関数

```typescript
function roundInsurance(amount: number): number {
  const fraction = amount - Math.floor(amount);
  if (fraction <= 0.5) return Math.floor(amount);
  return Math.ceil(amount);
}
```

社会保険料の端数処理: **50銭以下切捨て、50銭超切上げ**（事業所の労使協定がない場合のデフォルト）。

## 所得税計算の実装

1. `tax_tables` テーブルから該当する給与範囲の行を取得
2. 甲欄/乙欄と扶養人数で税額を決定
3. 税額表にない範囲は算式で計算（税額表の注記参照）

```typescript
function calculateIncomeTax(
  taxableAmount: Yen,
  dependents: number,
  column: 'A' | 'B',
): Yen {
  // tax_tables テーブルを参照
  // 該当行がない場合はエラー（推測で計算しない）
}
```

## 社会保険料計算の実装

```typescript
function calculateInsurance(
  standardMonthlyRemuneration: Yen,
  rates: InsuranceRates,
  age: number,
): InsurancePremiums {
  const health = roundInsurance(standardMonthlyRemuneration * rates.healthRate);
  const nursing = age >= 40
    ? roundInsurance(standardMonthlyRemuneration * rates.nursingRate)
    : 0;
  const pension = roundInsurance(standardMonthlyRemuneration * rates.pensionRate);
  const employment = Math.floor(totalPayment * rates.employmentRate);
  return { health, nursing, pension, employment };
}
```

## テスト方針

- 国税庁公表の源泉徴収税額表の具体例と照合
- 日本年金機構の保険料額表と照合
- 境界値テスト: 税額表の区切り値の前後
- 端数処理テスト: 0.5円ちょうど、0.49円、0.51円

## 絶対に守るルール

1. **料率をハードコードしない** — 必ず `insurance_rates` テーブルから取得
2. **税額表をハードコードしない** — 必ず `tax_tables` テーブルから取得
3. **推測で計算しない** — 該当データがなければエラーを返す
4. **端数処理を省略しない** — 法令で定められた方法を必ず適用
