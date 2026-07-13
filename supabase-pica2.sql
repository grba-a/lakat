-- LAKAT: popravak pica sheme (v1 djelomično prošla) + kolo v2 nova lista.
-- IDEMPOTENTNO — sigurno pokrenuti više puta. Supabase SQL Editor > Run.

-- 1) drinks: policyji + realtime (za slučaj da je v1 stala usred bloka)
alter table public.drinks enable row level security;

drop policy if exists "drinks_select_member" on public.drinks;
create policy "drinks_select_member" on public.drinks
  for select to authenticated using (public.is_member(group_id));
drop policy if exists "drinks_insert_own" on public.drinks;
create policy "drinks_insert_own" on public.drinks
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_member(group_id));
drop policy if exists "drinks_delete_own" on public.drinks;
create policy "drinks_delete_own" on public.drinks
  for delete to authenticated using (auth.uid() = user_id);
-- namjerno nema update policyja: piće se ne uređuje, krivi tap se briše

create index if not exists drinks_group_time_idx on public.drinks (group_id, logged_at);
create index if not exists drinks_user_group_idx on public.drinks (user_id, group_id, logged_at);

alter table public.drinks replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.drinks;
exception when duplicate_object then null; end $$;

-- 2) kolo_spins ("Piće dana"): rezultat bira ISKLJUČIVO server (service
-- role) — namjerno nema client insert policyja, obrazac kao user_badges
create table if not exists public.kolo_spins (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  result text not null check (result in
    ('piva','gemist','vino','rakija','sot','koktel','viski','gin','vodka','voda')),
  created_at timestamptz not null default now()
);

create index if not exists kolo_spins_group_time_idx on public.kolo_spins (group_id, created_at);

alter table public.kolo_spins enable row level security;

drop policy if exists "kolo_spins_select_member" on public.kolo_spins;
create policy "kolo_spins_select_member" on public.kolo_spins
  for select to authenticated using (public.is_member(group_id));

do $$ begin
  alter publication supabase_realtime add table public.kolo_spins;
exception when duplicate_object then null; end $$;

-- 3) v2 lista pića: van bambus/bevanda (migracija u vino), unutra
-- viski/gin/vodka/voda; 'sot' ostaje (label "Shot")
update public.drinks
  set drink_type = 'vino'
  where drink_type in ('bambus', 'bevanda');

alter table public.drinks
  drop constraint if exists drinks_drink_type_check;
alter table public.drinks
  add constraint drinks_drink_type_check check (drink_type in
    ('piva','gemist','vino','rakija','sot','koktel','viski','gin','vodka','voda'));

alter table public.kolo_spins
  drop constraint if exists kolo_spins_result_check;
alter table public.kolo_spins
  add constraint kolo_spins_result_check check (result in
    ('piva','gemist','vino','rakija','sot','koktel','viski','gin','vodka','voda'));
