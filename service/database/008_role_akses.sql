-- =============================================================
--  Rumahku — Migrasi 008: role Admin / User & akses menu per user
--  - Tabel app_users: role (admin | user) & menu yang boleh diakses.
--  - Akun PERTAMA yang dibuat otomatis jadi admin; akun baru = user.
--  - Data tiap menu dilindungi di database (RLS), bukan hanya disembunyikan.
--
--  Jalankan SEKALI di Supabase: SQL Editor → New query → paste → Run.
--  Aman dijalankan ulang. Jalankan SEBELUM memakai aplikasi v1.20.
-- =============================================================

create table if not exists public.app_users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  role        text not null default 'user' check (role in ('admin', 'user')),
  menus       text[] not null default '{inventory,finance,kegiatan,resep}',
  updated_at  timestamptz not null default now()
);

-- Fungsi pengecek (security definer: boleh membaca app_users tanpa kena RLS-nya sendiri)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.can_access(menu text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' or menu = any(menus) from public.app_users where user_id = auth.uid()), false);
$$;

-- Akun baru otomatis terdaftar sebagai user (semua menu; admin bisa membatasi)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_users (user_id, email) values (new.id, new.email) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Daftarkan akun yang sudah ada; akun paling awal jadi admin (bila belum ada admin)
insert into public.app_users (user_id, email)
  select id, email from auth.users on conflict (user_id) do nothing;
update public.app_users set role = 'admin', updated_at = now()
  where user_id = (select id from auth.users order by created_at limit 1)
    and not exists (select 1 from public.app_users where role = 'admin');

-- Keamanan tabel app_users: user melihat dirinya sendiri, admin mengelola semua
alter table public.app_users enable row level security;
drop policy if exists "lihat diri sendiri atau admin" on public.app_users;
create policy "lihat diri sendiri atau admin" on public.app_users
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin mengelola" on public.app_users;
create policy "admin mengelola" on public.app_users
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update on public.app_users to authenticated;
revoke all on public.app_users from anon;

-- Data tiap menu hanya untuk yang punya akses menu tersebut
do $$
declare r record;
begin
  for r in select * from (values
      ('inv_items', 'inventory'), ('inv_movements', 'inventory'), ('inv_shopping', 'inventory'),
      ('fin_accounts', 'finance'), ('fin_transactions', 'finance'), ('fin_goals', 'finance'),
      ('act_todos', 'kegiatan'), ('rcp_recipes', 'resep')) as t(tbl, menu)
  loop
    execute format('drop policy if exists "keluarga boleh semua" on public.%I', r.tbl);
    execute format('drop policy if exists "akses per menu" on public.%I', r.tbl);
    execute format('create policy "akses per menu" on public.%I for all to authenticated using (public.can_access(%L)) with check (public.can_access(%L))', r.tbl, r.menu, r.menu);
  end loop;
end $$;

notify pgrst, 'reload schema';
