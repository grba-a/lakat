-- LAKAT: komentari na check-in — zalijepi u Supabase Dashboard >
-- SQL Editor (Cmd+A, obriši staro, zalijepi, Run)

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  checkin_id bigint not null references public.checkins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists comments_checkin_idx on public.comments (checkin_id, created_at);

alter table public.comments enable row level security;

create policy "comments_select_member" on public.comments
  for select to authenticated using (public.is_member(group_id));
create policy "comments_insert_own" on public.comments
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_member(group_id));
create policy "comments_delete_own" on public.comments
  for delete to authenticated using (auth.uid() = user_id);
-- namjerno nema update policyja: komentari se ne uređuju, samo brišu+repostaju

alter table public.comments replica identity full;
alter publication supabase_realtime add table public.comments;
