-- Faza 2: thumbnail kolona za dokazne slike (performanse gridova)
-- Stari redovi imaju thumb_url = null; renderi padaju natrag na photo_url.

alter table public.checkins add column if not exists thumb_url text;
