-- LAKAT najave2: "Stižem" sad cilja konkretnog prisutnog (stižem KOD nekoga,
-- klikom na njegovu karticu/sliku). Push ide samo meti; ostali vide label.
-- Stari redovi ostaju s target_user_id = null (generična najava).
--
-- Primijeniti ručno u Supabase SQL editoru PRIJE deploya koda koji šalje
-- target_user_id (realtime schema cache treba pokupiti novu kolonu).

alter table public.najave
  add column target_user_id uuid references public.profiles(id) on delete cascade;

create index najave_target_idx on public.najave (target_user_id);

-- RLS policyji se ne mijenjaju: insert i dalje traži auth.uid() = user_id i
-- članstvo u grupi, select ostaje group-scopan.
