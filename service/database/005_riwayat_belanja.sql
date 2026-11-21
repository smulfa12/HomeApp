-- =============================================================
--  Rumahku — Migrasi 005: riwayat belanja (Mode Belanja)
--  Satu baris = satu kali belanja (tanggal, toko, total, isi barang).
--
--  Jalankan SEKALI di Supabase: SQL Editor → New query → paste → Run.
--  Aman dijalankan ulang. Jalankan SEBELUM memakai aplikasi v1.14.
-- =============================================================

create table if not exists public.inv_shopping (
  id              text primary key,
  date            date not null,
  store           text,
  total           double precision not null default 0,
  account_id      text,             -- dibayar dari (fin_accounts.id)
  transaction_id  text,             -- pengeluaran terkait (fin_transactions.id)
  items           jsonb not null default '[]'::jsonb,  -- [{itemId, name, unit, barcode, qty, price}]
  note            text,
  created_at      text,
  updated_at      text,
  created_by      uuid default auth.uid()
);
create index if not exists inv_shopping_date_idx on public.inv_shopping (date);

-- Keamanan: hanya anggota keluarga yang login
alter table public.inv_shopping enable row level security;
drop policy if exists "keluarga boleh semua" on public.inv_shopping;
create policy "keluarga boleh semua" on public.inv_shopping
  for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.inv_shopping to authenticated;
revoke all on public.inv_shopping from anon;

-- Realtime: perubahan dari HP lain langsung muncul
do $$
begin
  alter publication supabase_realtime add table public.inv_shopping;
exception when duplicate_object then null;
end $$;

-- Muat ulang cache skema API
notify pgrst, 'reload schema';
