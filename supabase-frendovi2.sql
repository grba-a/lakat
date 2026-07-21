-- Faza 3.x: QR/identitet dorade pajdaša —
--  (1) case-insensitive jedinstvenost korisničkog imena (uz postojeći
--      exact-case unique iz supabase-setup.sql),
--  (2) limit promjene imena (kolona username_changed_at; logika 1×/30 dana
--      je u app/(main)/profil/actions.js),
--  (3) odbijeni prijedlozi "možda se znate" — ne nestaju, idu na kraj liste
--      (trajno, po korisniku).
-- Isti stil kao ostali flat SQL fajlovi: čitanje kroz RLS, pisanja kroz
-- server akcije s admin klijentom.

-- PRIJE INDEXA (samo ako sumnjaš na duplikate po caseu):
--   select lower(username), count(*) from public.profiles
--   group by 1 having count(*) > 1;
-- ako ima redova, ručno razriješi prije nego index padne.

-- 1. Case-insensitive jedinstvenost imena
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- 2. Zadnja promjena imena (null = nikad mijenjano; prva promjena je besplatna)
alter table public.profiles
  add column if not exists username_changed_at timestamptz;

-- 3. Odbijeni prijedlozi (deprioritizacija, ne skrivanje)
create table if not exists public.suggestion_dismissals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  dismissed_id uuid not null references public.profiles(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, dismissed_id)
);

alter table public.suggestion_dismissals enable row level security;

drop policy if exists "dismissals_select_own" on public.suggestion_dismissals;
create policy "dismissals_select_own" on public.suggestion_dismissals
  for select to authenticated using (auth.uid() = user_id);
-- pisanja (upsert) idu kroz admin klijent u server akciji — nema client
-- insert/update policyja (konvencija projekta)
