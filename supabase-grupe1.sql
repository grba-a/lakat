-- LAKAT grupe, faza 1: multi-tenant temelj — tablice grupa, RLS po grupi,
-- migracija postojeće ekipe u grupu "Club23".
--
-- PRIJE POKRETANJA: u retku "admin_username" dolje upiši SVOJ username
-- (točno kako piše u aplikaciji) — ta osoba postaje admin grupe.
--
-- Zalijepi cijeli fajl u Supabase Dashboard > SQL Editor > Run.

-- 0. pgcrypto za hashiranje šifre grupe (crypt + gen_salt)
create extension if not exists pgcrypto;

-- 1. GRUPE
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 32),
  password_hash text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index groups_name_lower_idx on public.groups (lower(name));

-- 2. ČLANSTVA (max 3 po korisniku — limit provjerava server akcija)
create table public.group_members (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- 3. group_id stupci na postojećim tablicama + aktivna grupa na profilu
alter table public.profiles
  add column active_group_id uuid references public.groups(id) on delete set null;
alter table public.checkins
  add column group_id uuid references public.groups(id) on delete cascade;
alter table public.najave
  add column group_id uuid references public.groups(id) on delete cascade;
alter table public.reactions
  add column group_id uuid references public.groups(id) on delete cascade;

create index checkins_group_time_idx on public.checkins (group_id, checked_in_at desc);
create index najave_group_time_idx on public.najave (group_id, created_at desc);
create index reactions_group_idx on public.reactions (group_id);

-- 4. Helperi za RLS — security definer da se izbjegne rekurzivni RLS
-- na group_members
create or replace function public.is_member(g uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = g and user_id = auth.uid()
  );
$$;

create or replace function public.shares_group_with(other uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

-- 5. Funkcije SAMO za server (service role) — provjera i hashiranje šifre
-- grupe. Klijentima se oduzima execute da nitko ne brute-forcea iz browsera.
create or replace function public.verify_group_password(g_name text, g_password text)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.groups
  where lower(name) = lower(g_name)
    and password_hash = crypt(g_password, password_hash);
$$;

create or replace function public.hash_group_password(pw text)
returns text
language sql stable security definer set search_path = public
as $$
  select crypt(pw, gen_salt('bf'));
$$;

revoke execute on function public.verify_group_password(text, text) from public, anon, authenticated;
revoke execute on function public.hash_group_password(text) from public, anon, authenticated;
grant execute on function public.verify_group_password(text, text) to service_role;
grant execute on function public.hash_group_password(text) to service_role;

-- 6. RLS za nove tablice — čitanje samo svojih grupa; SVA pisanja idu
-- kroz server akcije s admin klijentom (nema klijentskih insert/update)
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "groups_select_member" on public.groups
  for select to authenticated using (public.is_member(id));
create policy "group_members_select_member" on public.group_members
  for select to authenticated using (public.is_member(group_id));

-- 7. MIGRACIJA postojeće ekipe u grupu "Club23" (šifra ostaje srebreno23,
-- admin je može kasnije promijeniti u aplikaciji)
do $$
declare
  admin_username text := 'OVDJE-UPISI-SVOJ-USERNAME';  -- <<< PROMIJENI OVO
  g uuid;
begin
  if not exists (select 1 from public.profiles where username = admin_username) then
    raise exception 'Nema profila s usernameom "%". Upiši točan username u admin_username.', admin_username;
  end if;

  insert into public.groups (name, password_hash, created_by)
  values (
    'Club23',
    crypt('srebreno23', gen_salt('bf')),
    (select id from public.profiles where username = admin_username)
  )
  returning id into g;

  insert into public.group_members (group_id, user_id, role)
  select g, id, case when username = admin_username then 'admin' else 'member' end
  from public.profiles;

  update public.checkins set group_id = g where group_id is null;
  update public.najave set group_id = g where group_id is null;
  update public.reactions set group_id = g where group_id is null;
  update public.profiles set active_group_id = g where active_group_id is null;
end $$;

alter table public.checkins alter column group_id set not null;
alter table public.najave alter column group_id set not null;
alter table public.reactions alter column group_id set not null;

-- 8. RLS prepisivanje postojećih tablica: sve po članstvu u grupi
-- profiles: vidiš sebe + ljude s kojima dijeliš barem jednu grupu
drop policy "profiles_select_all" on public.profiles;
create policy "profiles_select_shared" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_group_with(id));

-- checkins
drop policy "checkins_select_all" on public.checkins;
create policy "checkins_select_member" on public.checkins
  for select to authenticated using (public.is_member(group_id));
drop policy "checkins_insert_own" on public.checkins;
create policy "checkins_insert_own" on public.checkins
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_member(group_id));

-- najave
drop policy "najave_select_all" on public.najave;
create policy "najave_select_member" on public.najave
  for select to authenticated using (public.is_member(group_id));
drop policy "najave_insert_own" on public.najave;
create policy "najave_insert_own" on public.najave
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_member(group_id));

-- reactions (update/delete ostaju vlasničke, ne diramo ih)
drop policy "reactions_select_all" on public.reactions;
create policy "reactions_select_member" on public.reactions
  for select to authenticated using (public.is_member(group_id));
drop policy "reactions_insert_own" on public.reactions;
create policy "reactions_insert_own" on public.reactions
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_member(group_id));
