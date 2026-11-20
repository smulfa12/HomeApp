-- =============================================================
--  Rumahku — Migrasi 002: tempat penyimpanan uang (akun)
--  Menambah ikon, nomor rekening, catatan, dan arsip pada fin_accounts.
--
--  Jalankan SEKALI di Supabase: SQL Editor → New query → paste → Run.
--  Aman dijalankan ulang. Jalankan SEBELUM memakai versi aplikasi v1.4.
-- =============================================================

alter table public.fin_accounts add column if not exists icon     text;
alter table public.fin_accounts add column if not exists number   text;     -- nomor rekening / no. HP e-wallet (opsional)
alter table public.fin_accounts add column if not exists note     text;
alter table public.fin_accounts add column if not exists archived boolean not null default false;

-- Nama akun tidak boleh kembar dalam jenis (aset / hutang) yang sama
create unique index if not exists fin_accounts_type_name_uniq
  on public.fin_accounts (type, lower(name));

-- Jenis akun yang valid
alter table public.fin_accounts drop constraint if exists fin_accounts_type_check;
alter table public.fin_accounts add constraint fin_accounts_type_check check (type in ('asset', 'liability'));

-- Isi ikon bawaan untuk akun lama
update public.fin_accounts set icon = case "group"
    when 'Kas / Tunai' then '👛'
    when 'Bank' then '🏦'
    when 'E-Wallet' then '📱'
    when 'Tabungan & Investasi' then '🐷'
    when 'Aset Tetap' then '🏠'
    when 'Hutang' then '📌'
    when 'Cicilan / Kredit' then '🧾'
    when 'Kartu Kredit' then '💳'
    else '💼'
  end
where icon is null;

-- Muat ulang cache skema API supaya kolom baru langsung bisa dipakai
notify pgrst, 'reload schema';
