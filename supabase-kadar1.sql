-- LAKAT: Zajednički kadar — zalijepi u Supabase Dashboard > SQL Editor
-- (Cmd+A, obriši staro, zalijepi, Run)

-- Tko je sve u kadru dokazne slike (uklj. autora). NULL = solo slika.
-- Validacija članstva se radi u checkIn akciji, RLS je isti kao za checkins.
alter table public.checkins add column if not exists kadar_user_ids uuid[];
