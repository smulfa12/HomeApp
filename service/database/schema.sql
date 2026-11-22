-- =============================================================
--  Rumahku — skema database Supabase
--  Jalankan sekali di Supabase: SQL Editor → New query → paste → Run.
--  Aman dijalankan ulang.
-- =============================================================

-- ---------- Inventory ----------
create table if not exists public.inv_items (
  id          text primary key,
  name        text not null,
  barcode     text,
  qty         double precision not null default 0,
  unit        text,
  category    text,
  min_stock   double precision not null default 0,
  location    text,
  expiry      date,
  price       double precision not null default 0,
  created_at  text,
  updated_at  text,
  created_by  uuid default auth.uid()
);
create index if not exists inv_items_barcode_idx on public.inv_items (barcode);

create table if not exists public.inv_movements (
  id          text primary key,
  item_id     text,
  item_name   text,
  type        text,             -- in | out | opname | adjust
  qty         double precision,
  before      double precision,
  after       double precision,
  date        date,
  note        text,
  created_at  text,
  updated_at  text,
  created_by  uuid default auth.uid()
);
create index if not exists inv_movements_item_idx on public.inv_movements (item_id);

-- ---------- Riwayat belanja ----------
create table if not exists public.inv_shopping (
  id              text primary key,
  date            date not null,
  store           text,
  total           double precision not null default 0,
  account_id      text,
  transaction_id  text,
  items           jsonb not null default '[]'::jsonb,
  note            text,
  created_at      text,
  updated_at      text,
  created_by      uuid default auth.uid()
);
create index if not exists inv_shopping_date_idx on public.inv_shopping (date);

-- ---------- Keuangan ----------
-- (Database lama: jalankan juga 002_akun_uang.sql, 003_transfer.sql, 004_target_tabungan.sql, 005_riwayat_belanja.sql, 006_kegiatan.sql)
create table if not exists public.fin_accounts (
  id          text primary key,
  name        text not null,
  type        text not null,    -- asset | liability
  "group"     text,
  icon        text,
  number      text,             -- nomor rekening / no. HP e-wallet
  note        text,
  archived    boolean not null default false,
  opening     double precision not null default 0,
  created_at  text,
  updated_at  text,
  created_by  uuid default auth.uid()
);

create unique index if not exists fin_accounts_type_name_uniq on public.fin_accounts (type, lower(name));

create table if not exists public.fin_transactions (
  id          text primary key,
  type        text not null,    -- income | expense | transfer
  amount      double precision not null,
  category    text,
  account_id  text,
  to_account_id text,           -- akun tujuan (khusus transfer)
  ref_id      text,             -- id transfer induk (khusus biaya admin)
  date        date not null,
  note        text,
  source      text,             -- manual | scan
  created_at  text,
  updated_at  text,
  created_by  uuid default auth.uid()
);
create index if not exists fin_transactions_date_idx on public.fin_transactions (date);

alter table public.fin_transactions drop constraint if exists fin_transactions_type_check;
alter table public.fin_transactions add constraint fin_transactions_type_check check (type in ('income', 'expense', 'transfer'));
alter table public.fin_transactions drop constraint if exists fin_transactions_transfer_check;
alter table public.fin_transactions add constraint fin_transactions_transfer_check
  check (type <> 'transfer' or (to_account_id is not null and to_account_id <> account_id));
create index if not exists fin_transactions_ref_idx on public.fin_transactions (ref_id);

-- ---------- Target tabungan ----------
create table if not exists public.fin_goals (
  id             text primary key,
  name           text not null,
  icon           text,
  target_amount  double precision not null check (target_amount > 0),
  account_ids    text[] not null default '{}',
  deadline       date,
  note           text,
  archived       boolean not null default false,
  milestone      integer not null default 0,
  created_at     text,
  updated_at     text,
  created_by     uuid default auth.uid()
);
create index if not exists fin_goals_account_ids_idx on public.fin_goals using gin (account_ids);

-- ---------- Kegiatan (to-do harian) ----------
create table if not exists public.act_todos (
  id          text primary key,
  title       text not null,
  icon        text,
  time        text,
  end_time    text,
  date        date not null,
  repeat      text not null default 'none' check (repeat in ('none', 'daily', 'weekdays', 'weekly')),
  days        smallint[] not null default '{}',
  who         text,
  note        text,
  done_dates  text[] not null default '{}',
  skip_dates  text[] not null default '{}',
  created_at  text,
  updated_at  text,
  created_by  uuid default auth.uid()
);
create index if not exists act_todos_date_idx on public.act_todos (date);

-- ---------- Pengaturan (lokasi, budget, dll) ----------
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------- Keamanan: hanya user yang login (anggota keluarga) ----------
do $$
declare t text;
begin
  foreach t in array array['inv_items','inv_movements','inv_shopping','fin_accounts','fin_transactions','fin_goals','act_todos','app_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "keluarga boleh semua" on public.%I', t);
    execute format('create policy "keluarga boleh semua" on public.%I for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
    -- realtime: perubahan dari HP lain langsung muncul
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
