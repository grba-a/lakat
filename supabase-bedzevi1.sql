-- LAKAT: trajni bedževi/dostignuća — zalijepi u Supabase Dashboard >
-- SQL Editor (Cmd+A, obriši staro, zalijepi, Run)

create table if not exists public.user_badges (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, group_id, badge_key)
);

create index if not exists user_badges_lookup_idx on public.user_badges (user_id, group_id);

alter table public.user_badges enable row level security;

create policy "user_badges_select_member" on public.user_badges
  for select to authenticated using (public.is_member(group_id));
-- namjerno nema insert/update/delete policyja za authenticated — bedževe
-- upisuje isključivo server (admin klijent), isti obrazac kao groups/group_members
