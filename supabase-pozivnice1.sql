-- Faza 7: grupni invite link — trajni kod po grupi za ulazak bez šifre
-- (laktarenje.com/g/KOD). Isti stil kao supabase-frendovi1.sql: kod se
-- rješava ISKLJUČIVO server-side kroz admin klijent, nema novih RLS pravila
-- (članovi već čitaju svoje grupe pa vide kod za dijeljenje).

-- 1. Trajni jedinstveni kod po grupi. 8 znakova (duži od friend koda jer
-- zaobilazi šifru grupe), bez 0/O/1/I da se ne miješaju pri prepisivanju.
alter table public.groups add column if not exists invite_code text unique;

create or replace function public.gen_invite_code()
returns text
language sql volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1),
    ''
  )
  from generate_series(1, 8);
$$;

create or replace function public.assign_invite_code()
returns trigger
language plpgsql
as $$
declare
  candidate text;
begin
  if new.invite_code is not null then
    return new;
  end if;
  loop
    candidate := public.gen_invite_code();
    exit when not exists (select 1 from public.groups where invite_code = candidate);
  end loop;
  new.invite_code := candidate;
  return new;
end;
$$;

drop trigger if exists groups_invite_code on public.groups;
create trigger groups_invite_code
  before insert on public.groups
  for each row execute function public.assign_invite_code();

-- Backfill postojećih grupa bez koda
do $$
declare
  r record;
  candidate text;
begin
  for r in select id from public.groups where invite_code is null loop
    loop
      candidate := public.gen_invite_code();
      exit when not exists (select 1 from public.groups where invite_code = candidate);
    end loop;
    update public.groups set invite_code = candidate where id = r.id;
  end loop;
end $$;
