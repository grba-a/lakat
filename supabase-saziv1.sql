-- LAKAT: Saziv "Dižem ekipu" — zalijepi u Supabase Dashboard >
-- SQL Editor (Cmd+A, obriši staro, zalijepi, Run)

-- Saziv: jedan član digne okupljanje (mjesto + vrijeme), ostali se odazivaju.
-- Živi do at_time + 3h (client-side filter, nema crona).
create table if not exists public.sazivi (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  place_text text not null check (char_length(place_text) between 1 and 40),
  at_time timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sazivi_group_idx on public.sazivi (group_id, at_time desc);

-- Odazivi: stizem / ne_mogu, jedan red po članu po sazivu (upsert mijenja status)
create table if not exists public.saziv_odazivi (
  id bigint generated always as identity primary key,
  saziv_id bigint not null references public.sazivi(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  status text not null check (status in ('stizem', 'ne_mogu')),
  responded_at timestamptz not null default now(),
  unique (saziv_id, user_id)
);

create index if not exists saziv_odazivi_saziv_idx on public.saziv_odazivi (saziv_id);

-- Runda se veže na saziv u čijem je prozoru nastala (pouzdanost, liga bodovi)
alter table public.checkins add column if not exists saziv_id bigint references public.sazivi(id) on delete set null;

alter table public.sazivi enable row level security;
alter table public.saziv_odazivi enable row level security;

drop policy if exists "sazivi_select_member" on public.sazivi;
create policy "sazivi_select_member" on public.sazivi
  for select to authenticated using (public.is_member(group_id));
drop policy if exists "sazivi_insert_own" on public.sazivi;
create policy "sazivi_insert_own" on public.sazivi
  for insert to authenticated
  with check (auth.uid() = created_by and public.is_member(group_id));
drop policy if exists "sazivi_delete_own" on public.sazivi;
create policy "sazivi_delete_own" on public.sazivi
  for delete to authenticated using (auth.uid() = created_by);
-- namjerno nema update policyja: saziv se ne uređuje, samo otkaže pa digne novi

drop policy if exists "saziv_odazivi_select_member" on public.saziv_odazivi;
create policy "saziv_odazivi_select_member" on public.saziv_odazivi
  for select to authenticated using (public.is_member(group_id));
drop policy if exists "saziv_odazivi_insert_own" on public.saziv_odazivi;
create policy "saziv_odazivi_insert_own" on public.saziv_odazivi
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_member(group_id));
drop policy if exists "saziv_odazivi_update_own" on public.saziv_odazivi;
create policy "saziv_odazivi_update_own" on public.saziv_odazivi
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.sazivi replica identity full;
alter table public.saziv_odazivi replica identity full;

-- Publication: idempotentno (duplicate_object kad tablica već postoji u publikaciji)
do $$
begin
  begin
    alter publication supabase_realtime add table public.sazivi;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.saziv_odazivi;
  exception when duplicate_object then null;
  end;
end $$;
