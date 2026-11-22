-- =============================================================
--  Rumahku — Migrasi 007: Resep (menu masak, resep & gizi)
--  + tautan jadwal masak di Kegiatan (act_todos.recipe_id)
--
--  Jalankan SEKALI di Supabase: SQL Editor → New query → paste → Run.
--  Aman dijalankan ulang. Jalankan SEBELUM memakai aplikasi v1.16.
-- =============================================================

create table if not exists public.rcp_recipes (
  id            text primary key,
  name          text not null,
  emoji         text,
  category      text,
  servings      integer not null default 1 check (servings > 0),
  prep_minutes  integer not null default 0,
  cook_minutes  integer not null default 0,
  ingredients   jsonb not null default '[]'::jsonb,  -- [{name, qty, unit, note}]
  steps         jsonb not null default '[]'::jsonb,  -- ["langkah 1", ...]
  nutrition     jsonb not null default '{}'::jsonb,  -- per porsi: {calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg}
  tags          text[] not null default '{}',
  note          text,
  source        text,                                -- manual | ai
  favorite      boolean not null default false,
  created_at    text,
  updated_at    text,
  created_by    uuid default auth.uid()
);
create index if not exists rcp_recipes_name_idx on public.rcp_recipes (lower(name));

-- Jadwal masak di Kegiatan bisa tertaut ke resep
alter table public.act_todos add column if not exists recipe_id text;
create index if not exists act_todos_recipe_idx on public.act_todos (recipe_id);

-- Keamanan: hanya anggota keluarga yang login
alter table public.rcp_recipes enable row level security;
drop policy if exists "keluarga boleh semua" on public.rcp_recipes;
create policy "keluarga boleh semua" on public.rcp_recipes
  for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.rcp_recipes to authenticated;
revoke all on public.rcp_recipes from anon;

do $$
begin
  alter publication supabase_realtime add table public.rcp_recipes;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
