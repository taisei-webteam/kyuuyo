-- ==============================================
-- らくらく給与明細α - メール到達確認
-- マイグレーション003: email_verifications テーブルの追加
-- ==============================================
--
-- 従業員のメールアドレス（多くはキャリアアドレス）が迷惑メールに振り分けられて
-- いないかを確認するためのテーブル。
--
-- フロー:
--   1. Windows アプリが token を発行し status='pending' で登録、確認メールを送信
--   2. 従業員がメール内のURL (/api/verify-email?token=...) を開く
--   3. 確認ページの「確認する」ボタン (POST) で status='verified' に更新
--   4. Windows アプリが「状態を更新」でこのテーブルを照会しローカルDBに反映
--
-- GET では確定しない（迷惑メールフィルタのリンク先自動取得による誤確認を防ぐ）。
--
-- ▼ 適用方法
--   punch-app/api/_db.js の ensureEmailVerificationTable() が
--   create table if not exists を実行するため、通常は手動適用は不要。
--   手動で作る場合はこの内容を Neon の SQL Editor で実行する。
--
-- employees_sync への外部キーは張らない
-- （役員など同期対象外の従業員でも到達確認を行えるようにする）。

create table if not exists email_verifications (
  token text primary key,
  employee_id integer not null,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'verified')),
  sent_at timestamptz not null default now(),
  verified_at timestamptz,
  user_agent text
);

create index if not exists email_verifications_employee_id_idx
  on email_verifications (employee_id);
