-- LAKAT 3.0 (1/2): friend model — RLS po frendovima umjesto po grupama,
-- kafici tablica + checkins.kafic_id, bedževi globalni po korisniku.
-- ADITIVNO: groups/group_members/group_id kolone OSTAJU (povijest), samo
-- više nisu nositelji vidljivosti i nisu obavezne.
-- Primijenjeno na DEV (lakat-dev); na PROD ide u Fazi G ZAJEDNO sa
-- supabase-lakat3-migracija.sql (auto-frendovi, PRIJE ove skripte).

-- 1. Helperi vidljivosti (security definer — RLS na friendships/checkins
-- ne smije blokirati provjeru)
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

create or replace function public.can_see_checkin(c_id bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.checkins c
    where c.id = c_id
      and (c.user_id = auth.uid() or public.are_friends(c.user_id, auth.uid()))
  );
$$;

create or replace function public.can_see_saziv(s_id bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.sazivi s
    where s.id = s_id
      and (s.created_by = auth.uid() or public.are_friends(s.created_by, auth.uid()))
  );
$$;

-- 2. group_id postaje nasljeđe — novi redovi ga ne pišu
alter table public.checkins alter column group_id drop not null;
alter table public.najave alter column group_id drop not null;
alter table public.reactions alter column group_id drop not null;
alter table public.drinks alter column group_id drop not null;
alter table public.comments alter column group_id drop not null;
alter table public.sazivi alter column group_id drop not null;
alter table public.saziv_odazivi alter column group_id drop not null;
alter table public.user_badges alter column group_id drop not null;

-- 3. Bedževi globalni po korisniku: dedupe (isti bedž iz više grupa →
-- ostaje najstariji red), group_id se briše, novi unique (user, badge)
delete from public.user_badges ub
using public.user_badges dup
where ub.user_id = dup.user_id
  and ub.badge_key = dup.badge_key
  and ub.id > dup.id;
update public.user_badges set group_id = null;
alter table public.user_badges
  drop constraint if exists user_badges_user_id_group_id_badge_key_key;
drop index if exists user_badges_lookup_idx;
create unique index if not exists user_badges_user_key_idx
  on public.user_badges (user_id, badge_key);
create index if not exists user_badges_lookup_idx on public.user_badges (user_id);

-- 4. RLS: vidljivost = autor sam ja ILI moj prihvaćeni frend
-- profiles: sebe + frend/pending (username tuđih ne-frendova ide kroz
-- admin klijent gdje je namjerno javan, npr. /korisnik header)
drop policy if exists "profiles_select_shared" on public.profiles;
create policy "profiles_select_shared" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_friend_or_pending(id));

-- checkins
drop policy if exists "checkins_select_member" on public.checkins;
create policy "checkins_select_friends" on public.checkins
  for select to authenticated
  using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));
drop policy if exists "checkins_insert_own" on public.checkins;
create policy "checkins_insert_own" on public.checkins
  for insert to authenticated with check (auth.uid() = user_id);
-- checkins_update_own (faza1) ostaje — svoje redove

-- najave
drop policy if exists "najave_select_member" on public.najave;
create policy "najave_select_friends" on public.najave
  for select to authenticated
  using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));
drop policy if exists "najave_insert_own" on public.najave;
create policy "najave_insert_own" on public.najave
  for insert to authenticated with check (auth.uid() = user_id);

-- drinks
drop policy if exists "drinks_select_member" on public.drinks;
create policy "drinks_select_friends" on public.drinks
  for select to authenticated
  using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));
drop policy if exists "drinks_insert_own" on public.drinks;
create policy "drinks_insert_own" on public.drinks
  for insert to authenticated with check (auth.uid() = user_id);
-- drinks_delete_own ostaje

-- sazivi: vidljivost po kreatoru
drop policy if exists "sazivi_select_member" on public.sazivi;
create policy "sazivi_select_friends" on public.sazivi
  for select to authenticated
  using (created_by = auth.uid() or public.are_friends(created_by, auth.uid()));
drop policy if exists "sazivi_insert_own" on public.sazivi;
create policy "sazivi_insert_own" on public.sazivi
  for insert to authenticated with check (auth.uid() = created_by);
-- sazivi_delete_own ostaje

-- saziv_odazivi: vidljivi svima koji vide saziv (odazivi su event kontekst)
drop policy if exists "saziv_odazivi_select_member" on public.saziv_odazivi;
create policy "saziv_odazivi_select_visible" on public.saziv_odazivi
  for select to authenticated using (public.can_see_saziv(saziv_id));
drop policy if exists "saziv_odazivi_insert_own" on public.saziv_odazivi;
create policy "saziv_odazivi_insert_own" on public.saziv_odazivi
  for insert to authenticated
  with check (auth.uid() = user_id and public.can_see_saziv(saziv_id));
-- saziv_odazivi_update_own ostaje

-- reactions: prate vidljivost slike na koju se reagira
drop policy if exists "reactions_select_member" on public.reactions;
create policy "reactions_select_visible" on public.reactions
  for select to authenticated using (public.can_see_checkin(checkin_id));
drop policy if exists "reactions_insert_own" on public.reactions;
create policy "reactions_insert_own" on public.reactions
  for insert to authenticated
  with check (auth.uid() = user_id and public.can_see_checkin(checkin_id));
-- reactions_update_own / reactions_delete_own ostaju

-- comments: isto kao reactions
drop policy if exists "comments_select_member" on public.comments;
create policy "comments_select_visible" on public.comments
  for select to authenticated using (public.can_see_checkin(checkin_id));
drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments
  for insert to authenticated
  with check (auth.uid() = user_id and public.can_see_checkin(checkin_id));
-- comments_delete_own ostaje

-- user_badges: svoje + frendove (prikaz na profilu frenda)
drop policy if exists "user_badges_select_member" on public.user_badges;
create policy "user_badges_select_friends" on public.user_badges
  for select to authenticated
  using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));

-- 5. Partner kafići — pišu se SAMO service_roleom (SQL/dashboard za sad)
create table if not exists public.kafici (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 150,
  partner boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.kafici enable row level security;
drop policy if exists "kafici_select_all" on public.kafici;
create policy "kafici_select_all" on public.kafici
  for select to authenticated using (true);

alter table public.checkins
  add column if not exists kafic_id uuid references public.kafici(id) on delete set null;
create index if not exists checkins_kafic_idx on public.checkins (kafic_id)
  where kafic_id is not null;
