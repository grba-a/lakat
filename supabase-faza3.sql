-- LAKAT faza 3: lokacija pri check-inu — zalijepi u Supabase Dashboard > SQL Editor > Run
-- (Cmd+A, obriši staro iz editora, zalijepi ovo, Run)

alter table public.checkins add column if not exists lat double precision;
alter table public.checkins add column if not exists lng double precision;
