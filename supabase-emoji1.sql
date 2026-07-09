-- Emoji na karti: korisnik u postavkama bira svoj marker-emoji.
-- null = nasumično (stabilno po korisniku/danu, kao dosad).

alter table public.profiles add column if not exists map_emoji text;
