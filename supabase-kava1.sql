-- LAKAT: kava ulazi u ponudu pića (vino izlazi iz ponude, ali ostaje u
-- constraintu zbog starih redova — isti obrazac kao 'sot').
-- IDEMPOTENTNO — sigurno pokrenuti više puta. Supabase SQL Editor > Run.
-- Pokrenuti PRIJE deploya koda koji nudi kavu (inače insert puca na checku).
-- kolo_spins se NE dira (tablica napuštena od omnitrix odabira).

alter table public.drinks
  drop constraint if exists drinks_drink_type_check;
alter table public.drinks
  add constraint drinks_drink_type_check check (drink_type in
    ('piva','gemist','vino','rakija','sot','koktel','viski','gin','vodka','voda','pelin','kava'));
