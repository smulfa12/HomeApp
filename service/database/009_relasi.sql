-- =============================================================
--  Rumahku — Migrasi 009: relasi antar tabel (foreign key)
--
--  inv_movements.item_id        → inv_items        (barang dihapus: riwayat tetap, tautan dikosongkan)
--  fin_transactions.account_id  → fin_accounts     (dikosongkan bila akun terhapus)
--  fin_transactions.to_account_id → fin_accounts   (akun tujuan transfer)
--  fin_transactions.ref_id      → fin_transactions (biaya admin ikut terhapus bersama transfernya)
--  inv_shopping.account_id      → fin_accounts     (dikosongkan)
--  inv_shopping.transaction_id  → fin_transactions (dikosongkan)
--  act_todos.recipe_id          → rcp_recipes      (jadwal masak tetap ada, tautan resep dikosongkan)
--  fin_goals.account_ids[]      → fin_accounts     (dijaga trigger: id akun yang tidak ada dibuang)
--  <semua tabel>.created_by     → auth.users       (dikosongkan bila akun login dihapus)
--
--  Jalankan SEKALI di Supabase: SQL Editor → New query → paste → Run.
--  Aman dijalankan ulang. Data yang tautannya sudah putus dibersihkan dulu (tautan dikosongkan,
--  baris datanya TIDAK dihapus).
-- =============================================================

-- 1) Bersihkan tautan yang menunjuk ke data yang sudah tidak ada
update public.inv_movements m set item_id = null
  where item_id is not null and not exists (select 1 from public.inv_items i where i.id = m.item_id);
update public.fin_transactions t set account_id = null
  where account_id is not null and not exists (select 1 from public.fin_accounts a where a.id = t.account_id);
-- transfer boleh tanpa akun tujuan bila akunnya sudah terhapus
alter table public.fin_transactions drop constraint if exists fin_transactions_transfer_check;
alter table public.fin_transactions add constraint fin_transactions_transfer_check
  check (type <> 'transfer' or to_account_id is null or to_account_id <> account_id);
update public.fin_transactions t set to_account_id = null
  where to_account_id is not null and not exists (select 1 from public.fin_accounts a where a.id = t.to_account_id);
update public.fin_transactions t set ref_id = null
  where ref_id is not null and not exists (select 1 from public.fin_transactions p where p.id = t.ref_id);
update public.inv_shopping s set account_id = null
  where account_id is not null and not exists (select 1 from public.fin_accounts a where a.id = s.account_id);
update public.inv_shopping s set transaction_id = null
  where transaction_id is not null and not exists (select 1 from public.fin_transactions t where t.id = s.transaction_id);
update public.act_todos k set recipe_id = null
  where recipe_id is not null and not exists (select 1 from public.rcp_recipes r where r.id = k.recipe_id);
update public.fin_goals g set account_ids = array(select a from unnest(g.account_ids) a where exists (select 1 from public.fin_accounts x where x.id = a))
  where exists (select 1 from unnest(g.account_ids) a where not exists (select 1 from public.fin_accounts x where x.id = a));

-- 2) Foreign key
do $$
declare r record;
begin
  for r in select * from (values
      ('inv_movements',    'item_id',        'inv_items',        'set null'),
      ('fin_transactions', 'account_id',     'fin_accounts',     'set null'),
      ('fin_transactions', 'to_account_id',  'fin_accounts',     'set null'),
      ('fin_transactions', 'ref_id',         'fin_transactions', 'cascade'),
      ('inv_shopping',     'account_id',     'fin_accounts',     'set null'),
      ('inv_shopping',     'transaction_id', 'fin_transactions', 'set null'),
      ('act_todos',        'recipe_id',      'rcp_recipes',      'set null')) as t(tbl, col, ref, action)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.tbl || '_' || r.col || '_fkey');
    execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I (id) on delete %s',
      r.tbl, r.tbl || '_' || r.col || '_fkey', r.col, r.ref, r.action);
    execute format('create index if not exists %I on public.%I (%I)', r.tbl || '_' || r.col || '_idx', r.tbl, r.col);
  end loop;

  -- created_by → akun login (auth.users)
  for r in select unnest(array['inv_items', 'inv_movements', 'inv_shopping', 'fin_accounts', 'fin_transactions', 'fin_goals', 'act_todos', 'rcp_recipes']) as tbl
  loop
    execute format('update public.%I set created_by = null where created_by is not null and not exists (select 1 from auth.users u where u.id = created_by)', r.tbl);
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.tbl || '_created_by_fkey');
    execute format('alter table public.%I add constraint %I foreign key (created_by) references auth.users (id) on delete set null', r.tbl, r.tbl || '_created_by_fkey');
  end loop;
end $$;

-- 3) Target tabungan ↔ akun (kolom array, dijaga trigger)
create or replace function public.fin_goals_valid_accounts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.account_ids := coalesce(array(select a from unnest(new.account_ids) a where exists (select 1 from public.fin_accounts x where x.id = a)), '{}');
  return new;
end;
$$;
drop trigger if exists fin_goals_valid_accounts on public.fin_goals;
create trigger fin_goals_valid_accounts before insert or update of account_ids on public.fin_goals
  for each row execute function public.fin_goals_valid_accounts();

create or replace function public.fin_accounts_unlink_goals() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.fin_goals set account_ids = array_remove(account_ids, old.id) where old.id = any (account_ids);
  return old;
end;
$$;
drop trigger if exists fin_accounts_unlink_goals on public.fin_accounts;
create trigger fin_accounts_unlink_goals after delete on public.fin_accounts
  for each row execute function public.fin_accounts_unlink_goals();

notify pgrst, 'reload schema';
