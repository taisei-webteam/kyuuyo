-- ==============================================
-- らくらく給与明細α - 打刻システム
-- マイグレーション002: 外出/戻り 打刻種別の追加
-- ==============================================
--
-- punch_records.punch_type は当初 ('clock_in','clock_out') のみ許可していたが、
-- iPad 打刻アプリの「外出」「戻り」も保存・同期できるよう
-- ('go_out','go_return') を追加する。
--
-- ▼ 適用方法（いずれか）
--   - Supabase ダッシュボード → SQL Editor にこの内容を貼り付けて実行
--   - supabase CLI: supabase db push
--
-- これを適用するまで、打刻アプリで外出/戻りを押すと CHECK 制約違反で保存に失敗する。

alter table punch_records drop constraint if exists punch_records_punch_type_check;

alter table punch_records
  add constraint punch_records_punch_type_check
  check (punch_type in ('clock_in', 'clock_out', 'go_out', 'go_return'));
