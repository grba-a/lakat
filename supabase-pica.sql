-- LAKAT: beer log + kolo pića — zalijepi u Supabase Dashboard >
-- SQL Editor (Cmd+A, obriši staro, zalijepi, Run)

-- Pića kroz večer: redni broj se NE sprema, derivira se brojanjem redova
-- po lakat-danu (06-06). Krivi tap se briše (delete_own), ne uređuje.
create table if not exists public.drinks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  drink_type text not null check (drink_type in
    ('piva','gemist','vino','bambus','rakija','sot','koktel','bevanda')),
  logged_at timestamptz not null default now()
);

create index if not exists drinks_group_time_idx on public.drinks (group_id, logged_at);
create index if not exists drinks_user_group_idx on public.drinks (user_id, group_id, logged_at);

alter table public.drinks enable row level security;

create policy "drinks_select_member" on public.drinks
  for select to authenticated using (public.is_member(group_id));
create policy "drinks_insert_own" on public.drinks
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_member(group_id));
create policy "drinks_delete_own" on public.drinks
  for delete to authenticated using (auth.uid() = user_id);
-- namjerno nema update policyja: piće se ne uređuje, krivi tap se briše

-- realtime treba i DELETE (undo zadnjeg pića) -> replica identity full,
-- isti obrazac kao reactions
alter table public.drinks replica identity full;
alter publication supabase_realtime add table public.drinks;

-- Kolo pića: rezultat bira ISKLJUČIVO server (service role) — namjerno
-- nema client insert policyja, isti obrazac kao user_badges. 1 spin po
-- večeri se provjerava server-side po created_at >= dayStart.
create table if not exists public.kolo_spins (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  result text not null check (result in
    ('piva','gemist','vino','bambus','rakija','sot','koktel','bevanda')),
  created_at timestamptz not null default now()
);

create index if not exists kolo_spins_group_time_idx on public.kolo_spins (group_id, created_at);

alter table public.kolo_spins enable row level security;

create policy "kolo_spins_select_member" on public.kolo_spins
  for select to authenticated using (public.is_member(group_id));

alter publication supabase_realtime add table public.kolo_spins;
