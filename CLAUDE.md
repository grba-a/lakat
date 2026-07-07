@AGENTS.md

# LAKAT — Kontekst projekta

## Što je ovo
Web aplikacija (PWA) za privatne ekipe koje se checkiraju kad su vani (izvorno kafić Club23 u Srebrenom,
danas grupa preimenovana u "beta" jer se aplikacija otvara novim korisnicima).
Korisnici se registriraju, klikom na gumb "TU SAM" označe da su prisutni za šankom.
Ostali ih vide na popisu u realtimeu. Tko ne dolazi, javno je posramljen kao "pička mjeseca".
Ton aplikacije je vulgaran i zajebantski — to je feature, ne bug. Copy piši na hrvatskom, slobodno bezobrazno.

Aplikacija je **multi-tenant**: korisnik može biti član do 3 grupe, svaka grupa ima svoje ime i lozinku
(hashirano u bazi, provjera isključivo server-side), sve što se vidi (checkini, statistika, mapa) je
scopano na trenutno aktivnu grupu (`profiles.active_group_id`).

## Stack (NE MIJENJAJ)
- Next.js 16+, App Router, JavaScript (.jsx), NE TypeScript
- Tailwind CSS v4 (tema u `app/globals.css`, nema `tailwind.config.js`)
- Supabase: auth (email + lozinka), Postgres, Realtime, Storage
- Hosting: Vercel (laktarenje.com)
- PWA: manifest + service worker, instalacija na home screen
- Middleware fajl se zove `proxy.js` (Next 16 preimenovanje middleware→proxy)

## Pravila igre (poslovna logika)
1. **Check-in**: korisnik klikne "TU SAM" → upisuje se red u `checkins` s timestampom.
2. **Status "prisutan"**: korisnik je prisutan ako ima checkin NAKON danas u 06:00 po Europe/Zagreb.
   Prije 06:00 gleda se jučerašnjih 06:00 (noć traje do 6 ujutro). Nema crona, sve se računa iz timestampa.
3. **Default stanje**: tko nije prisutan, taj je pička. Nema aktivnog gumba "pička".
4. **Popis**: prisutni su zeleni, s oznakom "PRISUTAN", na vrhu popisa. Ostali su zamagljeni/zatamnjeni (blur ili opacity).
5. **Pička mjeseca**: osoba s NAJMANJE check-inova u kalendarskom mjesecu.
   - Broji se maksimalno jedan check-in po "danu" (dan = 06:00 do 06:00).
   - Korisniku registriranom sredinom mjeseca broji se samo od dana registracije (usporedba po postotku mogućih dana, ne apsolutnom broju).
   - Izjednačenje → svi izjednačeni su pička mjeseca.
   - Računa se on-the-fly kad netko otvori hall of shame. NEMA cron joba.
6. **Registracija**: email, lozinka, username, ime + šifra grupe (join postojeće ili create nove). Šifra grupe je hashirana u `groups.password_hash` (pgcrypto) i provjerava se ISKLJUČIVO server-side preko `verify_group_password` RPC-a (service_role only). Nikad ne slati šifru u klijentski bundle.

## Baza (Supabase)
Schema je flat SQL fajlovi primijenjeni ručno u Supabase SQL editoru, redom: `supabase-setup.sql` → `-avatars` → `-faza1..4` → `-grupe1.sql`. NE kreiraj migracijski framework, NE mijenjaj schemu bez pitanja — dodaj novi `supabase-*.sql` fajl po istoj konvenciji.

- `profiles`: id (uuid, FK na auth.users), username (unique), avatar_url, active_group_id, created_at
- `checkins`: id, user_id, group_id, checked_in_at, cancelled_at, photo_url, lat, lng
- `groups`: id, name (unique), password_hash, created_by
- `group_members`: group_id, user_id, role (admin/member), joined_at
- `reactions`: checkin_id, user_id, emoji (unique po user/checkin)
- `najave`: "stižem" najave dolaska
- `push_subscriptions`: user_id, subscription (jsonb), created_at

RLS je uključen i grupno-scopan (`is_member(group_id)`, `shares_group_with(id)` helper funkcije). Sva pisanja u `groups`/`group_members` idu isključivo kroz service-role admin klijent (`lib/supabase/admin.js`), nema client insert/update policyja na tim tablicama.

## Realtime
Supabase Realtime subscription po grupi (`checkins-live-${groupId}`) na `checkins`/`najave`/`reactions` (INSERT/UPDATE). Kad netko klikne "TU SAM", popis se svima u istoj grupi osvježi bez refresha.

## Env varijable (.env.local)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SECRET_KEY (server-only, service role, bypass RLS — koristi se za grupne operacije)
- CRON_SECRET (za `/api/cron/prazan-sank`)
- VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY (push)

## Ekrani
1. `/login` i `/register` — auth (join ili create grupu pri registraciji)
2. `/` — glavni "Šank": veliki gumb "TU SAM", ispod realtime popis korisnika, "Slike dana"
3. `/shame` — hall of shame: trenutno stanje mjeseca + arhiva
4. `/mapa` — Leaflet mapa check-in lokacija
5. `/profil` i `/profil/postavke` — vlastita statistika, galerija, upravljanje grupama
6. `/korisnik/[id]` — tuđi profil

## Dizajn
- Mobile first. 95% korištenja je s mobitela u kafiću, po noći.
- Tamna tema obavezna (crna/tamno siva pozadina). Zelena za prisutne.
- Veliki touch targeti, gumb "TU SAM" mora biti ogroman i nemoguć za promašiti pijan.
- Minimalno ekrana, minimalno klikova. Bez nepotrebnih animacija koje troše bateriju.
- Ako su instalirani frontend/design skillovi (frontend-design ili slično), koristi ih za vizualni identitet.

## Disciplina rada (VAŽNO)
- Radi ISKLJUČIVO ono što piše u promptu. Svaki prompt završava s "Ne diraj ništa drugo." i to se poštuje doslovno.
- Ne refaktoriraj postojeći kod bez eksplicitnog zahtjeva.
- Ne dodavaj dependencije koje nisu tražene.
- Ne kreiraj TypeScript fajlove.
- Faze rada su u `PROMPTS.md` — jedna faza po sessionu, redom.
- Nakon svake faze reci točno što je napravljeno i što korisnik mora ručno testirati.

## Status faza (ažuriraj nakon svake završene faze)
- [x] Faza 1: setup, auth, registracija sa šifrom
- [x] Faza 2: glavni ekran, check-in, realtime popis
- [x] Faza 3: hall of shame + statistika profila
- [x] Faza 4: PWA (manifest, ikone, instalacija)
- [x] Faza 5: push notifikacije
