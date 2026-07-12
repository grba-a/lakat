-- Faza 8: FOMO push — kad treći različiti član u grupi danas dođe za šank,
-- ostali koji fale dobiju ping. fomo_day pamti dan-ključ zadnjeg poslanog
-- pusha po grupi — jednostavan dedup bez nove tablice.
alter table public.groups add column if not exists fomo_day text;
