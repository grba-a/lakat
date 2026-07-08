-- Faza 6: prijatelji — trajni kod po korisniku, zahtjev/prihvat, pozivi u
-- grupu bez šifre, "zadnje viđen" heartbeat. Isti stil kao supabase-grupe1.sql:
-- čitanje kroz RLS, SVA pisanja idu kroz server akcije s admin klijentom.

-- 1. Trajni jedinstveni kod po profilu (bez 0/O/1/I da se ne miješaju pri
-- prepisivanju) + "zadnje viđen" heartbeat kolona
alter table public.profiles add column if not exists friend_code text unique;
alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.gen_friend_code()
returns text
language sql volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1),
    ''
  )
  from generate_series(1, 6);
$$;

create or replace function public.assign_friend_code()
returns trigger
language plpgsql
as $$
declare
  candidate text;
begin
  if new.friend_code is not null then
    return new;
  end if;
  loop
    candidate := public.gen_friend_code();
    exit when not exists (select 1 from public.profiles where friend_code = candidate);
  end loop;
  new.friend_code := candidate;
  return new;
end;
$$;

drop trigger if exists profiles_friend_code on public.profiles;
create trigger profiles_friend_code
  before insert on public.profiles
  for each row execute function public.assign_friend_code();

-- Backfill postojećih profila bez koda
do $$
declare
  r record;
  candidate text;
begin
  for r in select id from public.profiles where friend_code is null loop
    loop
      candidate := public.gen_friend_code();
      exit when not exists (select 1 from public.profiles where friend_code = candidate);
    end loop;
    update public.profiles set friend_code = candidate where id = r.id;
  end loop;
end $$;

-- 2. Prijateljstva: zahtjev/prihvat, jedan red po paru bez obzira na smjer
create table public.friendships (
  id bigint generated always as identity primary key,
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);
create unique index friendships_pair_idx on public.friendships
  (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on public.friendships (addressee);

alter table public.friendships enable row level security;
create policy "friendships_select_own" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));

-- 3. Pozivi u grupu preko friend liste — prihvat upisuje u group_members
-- BEZ provjere šifre grupe (poziv od frenda je dovoljan)
create table public.group_invites (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  inviter uuid not null references public.profiles(id) on delete cascade,
  invitee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create unique index group_invites_pending_idx on public.group_invites (group_id, invitee)
  where (status = 'pending');
create index group_invites_invitee_idx on public.group_invites (invitee);

alter table public.group_invites enable row level security;
create policy "group_invites_select_own" on public.group_invites
  for select to authenticated using (auth.uid() in (inviter, invitee));

-- 4. Vidljivost profila: frendovi (i pending zahtjevi) vide jedni druge i
-- bez zajedničke grupe — treba za friend listu, presence, /f/[code]
create or replace function public.is_friend_or_pending(other uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where (requester = auth.uid() and addressee = other)
       or (addressee = auth.uid() and requester = other)
  );
$$;

drop policy "profiles_select_shared" on public.profiles;
create policy "profiles_select_shared" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.shares_group_with(id)
    or public.is_friend_or_pending(id)
  );

-- Napomena: profiles NIJE u realtime publikaciji, pa 60s heartbeat update
-- (last_seen_at) ne spama nikoga — namjerno se ne dira ovdje.
