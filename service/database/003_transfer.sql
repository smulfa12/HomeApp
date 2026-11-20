-- =============================================================
--  Rumahku — Migrasi 003: transfer antar dompet / rekening
--  Transfer disimpan di fin_transactions dengan type = 'transfer':
--    account_id    = akun asal
--    to_account_id = akun tujuan
--  Biaya admin disimpan sebagai pengeluaran (type = 'expense')
--  dengan ref_id = id transfer-nya.
--
--  Jalankan SEKALI di Supabase: SQL Editor → New query → paste → Run.
--  Aman dijalankan ulang. Jalankan SEBELUM memakai aplikasi v1.5.
-- =============================================================

alter table public.fin_transactions add column if not exists to_account_id text;
alter table public.fin_transactions add column if not exists ref_id        text;

create index if not exists fin_transactions_account_idx    on public.fin_transactions (account_id);
create index if not exists fin_transactions_to_account_idx on public.fin_transactions (to_account_id);
create index if not exists fin_transactions_ref_idx        on public.fin_transactions (ref_id);

-- Jenis transaksi yang valid
alter table public.fin_transactions drop constraint if exists fin_transactions_type_check;
alter table public.fin_transactions add constraint fin_transactions_type_check
  check (type in ('income', 'expense', 'transfer'));

-- Transfer wajib punya akun tujuan yang berbeda dari akun asal
alter table public.fin_transactions drop constraint if exists fin_transactions_transfer_check;
alter table public.fin_transactions add constraint fin_transactions_transfer_check
  check (type <> 'transfer' or (to_account_id is not null and to_account_id <> account_id));

-- Muat ulang cache skema API supaya kolom baru langsung bisa dipakai
notify pgrst, 'reload schema';
