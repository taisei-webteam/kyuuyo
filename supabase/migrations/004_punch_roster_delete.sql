-- 打刻アプリの名簿から退職者を外すとき、punch_records が
-- employees_sync を参照していると DELETE が失敗する。
-- 打刻履歴の employee_id はそのまま残し（給与アプリへの取り込みに使う）、
-- 名簿行だけ削除できるように外部キーを外す。
alter table public.punch_records
  drop constraint if exists punch_records_employee_id_fkey;
