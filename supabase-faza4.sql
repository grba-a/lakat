-- LAKAT faza 4: reakcije na slike + najave dolaska — zalijepi u
-- Supabase Dashboard > SQL Editor (Cmd+A, obriši staro, zalijepi, Run)

-- 1. REAKCIJE: jedna po osobi po slici (nova pregazi staru)
create table public.reactions (
  id bigint generated always as identity primary key,
  checkin_id bigint not null references public.checkins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  unique (checkin_id, user_id)
);

alter table public.reactions enable row level security;

create policy "reactions_select_all" on public.reactions
  for select to authenticated using (true);
create policy "reactions_insert_own" on public.reactions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "reactions_update_own" on public.reactions
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reactions_delete_own" on public.reactions
  for delete to authenticated using (auth.uid() = user_id);

-- 2. NAJAVE DOLASKA ("Stižem.")
create table public.najave (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.najave enable row level security;

create policy "najave_select_all" on public.najave
  for select to authenticated using (true);
create policy "najave_insert_own" on public.najave
  for insert to authenticated with check (auth.uid() = user_id);

-- 3. Realtime za obje tablice; replica identity full da DELETE event
-- nosi cijeli red (bez toga klijent ne zna koju reakciju maknuti)
alter table public.reactions replica identity full;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.najave;
