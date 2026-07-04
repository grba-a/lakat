@AGENTS.md

# LAKAT — Kontekst projekta

## Što je ovo
Web aplikacija (PWA) za privatnu ekipu koja se nalazi u kafiću Club23 u Srebrenom.
Korisnici se registriraju, klikom na gumb "TU SAM" označe da su prisutni za šankom.
Ostali ih vide na popisu u realtimeu. Tko ne dolazi, javno je posramljen kao "pička mjeseca".
Ton aplikacije je vulgaran i zajebantski — to je feature, ne bug. Copy piši na hrvatskom, slobodno bezobrazno.

## Stack (NE MIJENJAJ)
- Next.js 14+, App Router, JavaScript (.jsx), NE TypeScript
- Tailwind CSS
- Supabase: auth (email + lozinka), Postgres, Realtime
- Hosting: Vercel
- PWA: manifest + service worker, instalacija na home screen

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
6. **Registracija**: email, lozinka, username, šifra grupe. Šifra se provjerava ISKLJUČIVO server-side protiv env varijable GROUP_PASSWORD. Nikad ne slati šifru u klijentski bundle.

## Baza (Supabase)
Tablice su već kreirane SQL-om iz `supabase-setup.sql`. NE kreiraj migracije, NE mijenjaj schemu bez pitanja.

- `profiles`: id (uuid, FK na auth.users), username (unique), created_at
- `checkins`: id, user_id (FK profiles), checked_in_at (timestamptz)
- `push_subscriptions`: id, user_id, subscription (jsonb), created_at — koristi se tek u fazi 5

RLS je uključen. Klijent čita profiles i checkins svih, piše samo svoje. Detalji u SQL fajlu.

## Realtime
Supabase Realtime subscription na `checkins` (INSERT). Kad netko klikne "TU SAM", popis se svima osvježi bez refresha.

## Env varijable (.env.local)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- GROUP_PASSWORD (server-only, bez NEXT_PUBLIC prefiksa)
- Faza 5: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY

## Ekrani
1. `/login` i `/register` — auth
2. `/` — glavni: veliki gumb "TU SAM", ispod realtime popis korisnika
3. `/shame` — hall of shame: trenutno stanje mjeseca (tko vodi u sramoti) + arhiva prošlih mjeseci
4. `/profil` — vlastita statistika: broj dolazaka, postotak, streak

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
