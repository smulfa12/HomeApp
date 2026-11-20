-- =============================================================
--  Rumahku — Migrasi 004: target tabungan
--  Satu target bisa dikaitkan ke beberapa rekening (account_ids).
--  Progres = jumlah saldo semua rekening terkait.
--
--  Jalankan SEKALI di Supabase: SQL Editor → New query → paste → Run.
--  Aman dijalankan ulang. Jalankan SEBELUM memakai aplikasi v1.7.
-- =============================================================

create table if not exists public.fin_goals (
  id             text primary key,
  name           text not null,
  icon           text,
  target_amount  double precision not null check (target_amount > 0),
  account_ids    text[] not null default '{}',   -- id rekening di fin_accounts
  deadline       date,
  note           text,
  archived       boolean not null default false,
  milestone      integer not null default 0,     -- milestone terakhir yang dirayakan (25/50/75/100)
  created_at     text,
  updated_at     text,
  created_by     uuid default auth.uid()
);

-- Cari target berdasarkan rekening
create index if not exists fin_goals_account_ids_idx on public.fin_goals using gin (account_ids);

-- Keamanan: hanya anggota keluarga yang login
alter table public.fin_goals enable row level security;
drop policy if exists "keluarga boleh semua" on public.fin_goals;
create policy "keluarga boleh semua" on public.fin_goals
  for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.fin_goals to authenticated;
revoke all on public.fin_goals from anon;

-- Realtime: perubahan dari HP lain langsung muncul
do $$
begin
  alter publication supabase_realtime add table public.fin_goals;
exception when duplicate_object then null;
end $$;

-- Muat ulang cache skema API
notify pgrst, 'reload schema';
