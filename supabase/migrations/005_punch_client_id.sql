-- 打刻の二重登録防止用に、端末側で採番した client_id を保持する。
-- 通信失敗時に端末が同じ打刻を再送しても、client_id が一致すれば
-- 新しい行を作らず既存行を返す（冪等な再送）。
-- 旧バージョンの端末からの打刻は client_id が null のまま入る。
alter table public.punch_records
  add column if not exists client_id text;

-- unique index は null 同士を重複とみなさないため、旧端末の打刻は制約の対象外。
create unique index if not exists punch_records_client_id_key
  on public.punch_records (client_id);
