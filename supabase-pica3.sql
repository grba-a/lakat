-- LAKAT: pelin (liker) ulazi u ponudu pića i na kolo.
-- IDEMPOTENTNO — sigurno pokrenuti više puta. Supabase SQL Editor > Run.
-- Pokrenuti PRIJE deploya koda koji nudi pelin (inače insert puca na checku).

alter table public.drinks
  drop constraint if exists drinks_drink_type_check;
alter table public.drinks
  add constraint drinks_drink_type_check check (drink_type in
    ('piva','gemist','vino','rakija','sot','koktel','viski','gin','vodka','voda','pelin'));

alter table public.kolo_spins
  drop constraint if exists kolo_spins_result_check;
alter table public.kolo_spins
  add constraint kolo_spins_result_check check (result in
    ('piva','gemist','vino','rakija','sot','koktel','viski','gin','vodka','voda','pelin'));
