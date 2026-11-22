-- =============================================================
--  Rumahku — Migrasi 006: Kegiatan (to-do list harian)
--  repeat: none | daily | weekdays | weekly (days: 0=Minggu … 6=Sabtu)
--  done_dates: tanggal-tanggal kegiatan ini sudah dicentang.
--
--  Jalankan SEKALI di Supabase: SQL Editor → New query → paste → Run.
--  Aman dijalankan ulang. Jalankan SEBELUM memakai aplikasi v1.15.
-- =============================================================

create table if not exists public.act_todos (
  id          text primary key,
  title       text not null,
  icon        text,
  time        text,                         -- 'HH:MM' (kosong = kapan saja)
  end_time    text,
  date        date not null,                -- tanggal (sekali) / mulai berlaku (rutin)
  repeat      text not null default 'none' check (repeat in ('none', 'daily', 'weekdays', 'weekly')),
  days        smallint[] not null default '{}',
  who         text,                         -- untuk siapa (opsional)
  note        text,
  done_dates  text[] not null default '{}',
  skip_dates  text[] not null default '{}',
  created_at  text,
  updated_at  text,
  created_by  uuid default auth.uid()
);
create index if not exists act_todos_date_idx on public.act_todos (date);

-- Keamanan: hanya anggota keluarga yang login
alter table public.act_todos enable row level security;
drop policy if exists "keluarga boleh semua" on public.act_todos;
create policy "keluarga boleh semua" on public.act_todos
  for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.act_todos to authenticated;
revoke all on public.act_todos from anon;

-- Realtime: centang dari HP lain langsung muncul
do $$
begin
  alter publication supabase_realtime add table public.act_todos;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
