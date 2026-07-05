-- LAKAT faza 1: poništavanje check-ina — zalijepi u Supabase Dashboard > SQL Editor > Run

-- 1. Kolona: kad je checkin poništen (null = aktivan)
alter table public.checkins add column if not exists cancelled_at timestamptz;

-- 2. Korisnik smije ažurirati (poništiti) samo svoj checkin
create policy "checkins_update_own" on public.checkins
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
