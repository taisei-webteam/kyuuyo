-- ==============================================
-- らくらく給与明細α - 打刻システム
-- Supabase マイグレーション: 打刻テーブル
-- ==============================================

-- 従業員マスタ (Windows側から同期)
create table if not exists employees_sync (
  id integer primary key,
  name text not null,
  name_kana text,
  employee_type text check (employee_type in ('社員', '役員', 'パート')),
  display_order integer default 0,
  is_active boolean default true,
  updated_at timestamptz default now()
);

-- 打刻レコード
create table if not exists punch_records (
  id uuid primary key default gen_random_uuid(),
  employee_id integer not null references employees_sync(id),
  employee_name text not null,
  punch_type text not null check (punch_type in ('clock_in', 'clock_out')),
  punched_at timestamptz not null,
  device text not null default 'ipad' check (device in ('ipad', 'manual')),
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);

-- インデックス
create index idx_punch_records_employee_date
  on punch_records (employee_id, punched_at);

create index idx_punch_records_punched_at
  on punch_records (punched_at)
  where cancelled = false;

-- =====================
-- Row Level Security
-- =====================

alter table employees_sync enable row level security;
alter table punch_records enable row level security;

-- employees_sync: anon は読み取りのみ
create policy "anon can read employees"
  on employees_sync for select
  to anon
  using (true);

-- punch_records: anon は INSERT + SELECT のみ (UPDATE/DELETE 不可)
create policy "anon can insert punches"
  on punch_records for insert
  to anon
  with check (true);

create policy "anon can read punches"
  on punch_records for select
  to anon
  using (true);

-- service_role は全操作可能 (RLS バイパス)
-- → Windowsアプリから service_role key で接続するため追加ポリシー不要
