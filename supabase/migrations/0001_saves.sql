-- PROJECT LIFE optional cloud sync. Run in the player's own Supabase project.
-- Every row belongs to the signed-in user; RLS makes other users' rows invisible and unwritable.
create table if not exists public.saves (
  id          text        not null,
  owner       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  name        text        not null,
  revision    integer     not null check (revision >= 0),
  checksum    text        not null,
  lineage     jsonb       not null default '[]'::jsonb,
  payload     text        not null,
  updated_at  timestamptz not null default now(),
  primary key (owner, id)
);

alter table public.saves enable row level security;

create policy "saves_select_own" on public.saves for select using (owner = auth.uid());
create policy "saves_insert_own" on public.saves for insert with check (owner = auth.uid());
create policy "saves_update_own" on public.saves for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy "saves_delete_own" on public.saves for delete using (owner = auth.uid());
