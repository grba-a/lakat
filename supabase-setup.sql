-- LAKAT: Supabase setup
-- Zalijepi cijeli fajl u Supabase Dashboard > SQL Editor > Run

-- 1. PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 2 and 24),
  created_at timestamptz not null default now()
);

-- 2. CHECKINS
create table public.checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now()
);

create index checkins_user_time_idx on public.checkins (user_id, checked_in_at desc);
create index checkins_time_idx on public.checkins (checked_in_at desc);

-- 3. PUSH SUBSCRIPTIONS (faza 5, kreiramo odmah da kasnije ne diramo schemu)
create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, subscription)
);

-- 4. RLS
alter table public.profiles enable row level security;
alter table public.checkins enable row level security;
alter table public.push_subscriptions enable row level security;

-- Svi ulogirani vide sve profile (popis ekipe)
create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);

-- Korisnik kreira i mijenja samo svoj profil
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Svi ulogirani vide sve checkinove (popis + statistika + shame)
create policy "checkins_select_all" on public.checkins
  for select to authenticated using (true);

-- Korisnik upisuje samo svoj checkin
create policy "checkins_insert_own" on public.checkins
  for insert to authenticated with check (auth.uid() = user_id);

-- Push subscription: samo svoje
create policy "push_select_own" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);
create policy "push_insert_own" on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "push_delete_own" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

-- 5. REALTIME na checkins
alter publication supabase_realtime add table public.checkins;
