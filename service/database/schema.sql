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

-- ---------- Keuangan ----------
create table if not exists public.fin_accounts (
  id          text primary key,
  name        text not null,
  type        text not null,    -- asset | liability
  "group"     text,
  opening     double precision not null default 0,
  created_at  text,
  updated_at  text,
  created_by  uuid default auth.uid()
);

create table if not exists public.fin_transactions (
  id          text primary key,
  type        text not null,    -- income | expense
  amount      double precision not null,
  category    text,
  account_id  text,
  date        date not null,
  note        text,
  source      text,             -- manual | scan
  created_at  text,
  updated_at  text,
  created_by  uuid default auth.uid()
);
create index if not exists fin_transactions_date_idx on public.fin_transactions (date);

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
  foreach t in array array['inv_items','inv_movements','fin_accounts','fin_transactions','app_settings'] loop
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
