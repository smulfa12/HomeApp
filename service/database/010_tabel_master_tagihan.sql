-- =============================================================
--  Rumahku — Migrasi 010
--  1) Lokasi, kategori keuangan & budget pindah dari app_settings (satu paket JSON)
--     ke tabel sendiri, satu baris per data → dua HP yang mengubah bersamaan
--     tidak saling menimpa lagi.
--  2) Tabel tagihan rutin (listrik, cicilan, SPP, ...).
--
--  Jalankan SEKALI di Supabase: SQL Editor → New query → paste → Run.
--  Aman dijalankan ulang. Data lama di app_settings disalin (tidak dihapus).
--  Butuh migrasi 008 (role & akses menu) sudah dijalankan.
-- =============================================================

create table if not exists public.inv_locations (
  id          text primary key,
  name        text not null,
  icon        text,
  sort        integer not null default 0,
  created_at  text,
  updated_at  text,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);

create table if not exists public.fin_categories (
  id          text primary key,
  type        text not null check (type in ('income', 'expense')),
  name        text not null,
  emoji       text,
  hidden      boolean not null default false,
  sort        integer not null default 0,
  created_at  text,
  updated_at  text,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists fin_categories_type_idx on public.fin_categories (type, sort);

create table if not exists public.fin_budgets (
  id          text primary key,
  month       text not null,            -- 'YYYY-MM'
  category    text not null,
  amount      double precision not null check (amount > 0),
  created_at  text,
  updated_at  text,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists fin_budgets_month_idx on public.fin_budgets (month);

create table if not exists public.fin_bills (
  id               text primary key,
  name             text not null,
  icon             text,
  amount           double precision not null check (amount > 0),
  category         text,
  account_id       text references public.fin_accounts (id) on delete set null,
  due_day          integer not null default 1 check (due_day between 1 and 31),
  interval_months  integer not null default 1 check (interval_months in (1, 2, 3, 6, 12)),
  start_month      text not null,       -- 'YYYY-MM' tagihan pertama
  paid             jsonb not null default '{}'::jsonb,  -- { 'YYYY-MM': { tx, date, amount } }
  note             text,
  archived         boolean not null default false,
  created_at       text,
  updated_at       text,
  created_by       uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists fin_bills_account_id_idx on public.fin_bills (account_id);

-- ---------- Keamanan: sesuai akses menu (lihat 008) + realtime ----------
do $$
declare r record;
begin
  for r in select * from (values
      ('inv_locations', 'inventory'), ('fin_categories', 'finance'),
      ('fin_budgets', 'finance'), ('fin_bills', 'finance')) as t(tbl, menu)
  loop
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format('drop policy if exists "akses per menu" on public.%I', r.tbl);
    execute format('create policy "akses per menu" on public.%I for all to authenticated using (public.can_access(%L)) with check (public.can_access(%L))', r.tbl, r.menu, r.menu);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.tbl);
    execute format('revoke all on public.%I from anon', r.tbl);
    begin
      execute format('alter publication supabase_realtime add table public.%I', r.tbl);
    exception when duplicate_object or undefined_object then null;
    end;
  end loop;
end $$;

-- ---------- Salin data lama dari app_settings ----------
-- id dibuat dari nama (sama dengan yang dibuat aplikasi) supaya tidak dobel
insert into public.inv_locations (id, name, icon, sort, created_at, updated_at)
  select 'loc:' || lower(trim(e.n)), trim(e.n),
         (select i.value ->> trim(e.n) from public.app_settings i where i.key = 'inv.locationIcons'),
         e.ord - 1, now()::text, now()::text
  from public.app_settings s, jsonb_array_elements_text(s.value) with ordinality as e(n, ord)
  where s.key = 'inv.locations' and jsonb_typeof(s.value) = 'array' and trim(e.n) <> ''
  on conflict (id) do nothing;

insert into public.fin_categories (id, type, name, emoji, hidden, sort, created_at, updated_at)
  select 'cat:' || t.type || ':' || lower(trim(e.c ->> 'name')), t.type, trim(e.c ->> 'name'), e.c ->> 'emoji',
         coalesce((e.c ->> 'hidden')::boolean, false), e.ord - 1, now()::text, now()::text
  from (values ('income'), ('expense')) as t(type)
  join public.app_settings s on s.key = 'fin.categories.' || t.type and jsonb_typeof(s.value) = 'array'
  cross join lateral jsonb_array_elements(s.value) with ordinality as e(c, ord)
  where coalesce(trim(e.c ->> 'name'), '') <> ''
  on conflict (id) do nothing;

insert into public.fin_budgets (id, month, category, amount, created_at, updated_at)
  select 'bud:' || m.key || ':' || lower(c.key), m.key, c.key, (c.value #>> '{}')::double precision, now()::text, now()::text
  from public.app_settings s, jsonb_each(s.value) as m(key, value), jsonb_each(m.value) as c(key, value)
  where s.key = 'fin.budgets' and jsonb_typeof(s.value) = 'object' and jsonb_typeof(m.value) = 'object'
    and jsonb_typeof(c.value) = 'number' and (c.value #>> '{}')::double precision > 0
  on conflict (id) do nothing;

notify pgrst, 'reload schema';
