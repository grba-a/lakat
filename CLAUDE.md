@AGENTS.md

# LAKAT — Kontekst projekta

## Što je ovo
Web aplikacija (PWA) za privatne ekipe koje se druže uživo (izvorno kafić Club23 u Srebrenom;
cilja regionalno/balkansko tržište — "LAKAT 2.0" pivot iz jednog šanka u aplikaciju za druženje).
Članovi dižu ekipu (saziv), objavljuju runde s dokaznom slikom i skupljaju bodove za svoju grupu u
tjednoj LIGI protiv drugih grupa. **Sram mehanika ("pička mjeseca", /shame) je UKLONJENA** —
motivacija je natjecanje među ekipama, ne prozivanje pojedinca unutar ekipe.
Ton aplikacije je vulgaran i zajebantski — to je feature, ne bug; vulgarne riječi u copyju su OK i
dalje, samo mehanika srama ne postoji. Copy piši na hrvatskom, slobodno bezobrazno, ali razumljivo
cijeloj regiji (izbjegavaj hiper-lokalni sleng koji izvan Dubrovnika nitko ne kuži).
Jezične konvencije copyja: "pjanac/pjanci" (dubrovački, NE "pijanac"), bez engleskog "checkirati" (domaće: "za šankom", "sjeo za šank"), linkovi za prijavu su "Prijavi se", loading tekst "Sekunda...".

Aplikacija je **multi-tenant**: korisnik može biti član do 3 grupe, svaka grupa ima svoje ime i lozinku
(hashirano u bazi, provjera isključivo server-side), sve što se vidi (checkini, statistika, mapa) je
scopano na trenutno aktivnu grupu (`profiles.active_group_id`).

## Stack (NE MIJENJAJ)
- Next.js 16+, App Router, JavaScript (.jsx), NE TypeScript
- Tailwind CSS v4 (tema u `app/globals.css`, nema `tailwind.config.js`)
- Supabase: auth (email + lozinka), Postgres, Realtime, Storage
- Hosting: Vercel (laktarenje.com), funkcije u regiji **fra1** (`vercel.json` — korisnici i Supabase su u EU, ne mijenjati)
- PWA: manifest + service worker, instalacija na home screen. SW (`public/sw.js`, cache "lakat-v4"): RSC/prefetch zahtjeve (`_rsc`, `RSC` header) NE presreće (sintetski odgovori tjeraju Next router na puni reload!), `/_next/static/`+ikone+fontovi su cache-first, navigacije network-first s offline fallbackom, ostalo se ne dira
- Middleware fajl se zove `proxy.js` (Next 16 preimenovanje middleware→proxy); u njemu se auth provjerava s `getClaims()` (lokalna JWT validacija), NE `getUser()` (mrežni roundtrip po requestu)

## Pravila igre (poslovna logika)
1. **Runda (check-in)**: zeleni PLUS u sredini navbara (TikTok stil, `plus-button.jsx` + `runda-flow.jsx`, lazy iz `nav.jsx`) → kamera → **photo editor** (`photo-editor.jsx`: pregled + opcionalni IG-story tekst, 4 stila, drag pozicija; tekst se peče canvasom u JPEG prije uploada, thumb iz pečenog bloba) → "Objavi" upisuje red u `checkins` → **omnitrix kolo pića** (`omnitrix.jsx`: okreće se prstom 1:1, inercija + snap na segment, odabrano je pod kazaljkom, "Potvrdi" = logDrink; X preskače; NE random, potpuno neprozirni overlay). **Više rundi dnevno je dozvoljeno** — prva slika dana je check-in (jedina šalje push grupi, `isFirstToday` u checkIn akciji), svaka sljedeća je nova runda (nova slika u Slike dana + piće). Piće se logira ISKLJUČIVO kroz taj flow; undo = toast "↩ Krivi tap" (~8s) nakon zapisanog pića. Veliki gumb "TU SAM" i drink-bar više NE postoje. **"Ipak bježim" je maknut** — `cancelCheckIn` akcija ne postoji, `checkins.cancelled_at` kolona ostaje u bazi zbog starih redova (filteri `.is("cancelled_at", null)` ostaju).
1b. **Saziv "Dižem ekipu"** (`saziv-card.jsx` na vrhu Šanka): bilo koji član digne okupljanje —
   mjesto (max 40 znakova) + vrijeme ("Sad" ili time picker; prošlo vrijeme = sutra) → push cijeloj
   grupi (`sazivPushBody`) → ostali se odazivaju ✓ Stižem / ✗ Ne mogu (upsert, može se predomisliti).
   Max JEDAN živi saziv po grupi; živi do `at_time + 3h` (client filter, nema crona); tko digne,
   automatski je "stizem"; samo kreator može "Spustiti" (delete, cascade briše odazive). Runda
   nastala u prozoru saziva (`at_time - 1h` do `at_time + 3h`) dobije `checkins.saziv_id` — temelj
   za pouzdanost (Kremen/Fantom) i liga bodove. Odaziv NE šalje push (realtime je dovoljan).
2. **Status "prisutan"**: korisnik je prisutan ako ima checkin NAKON danas u 06:00 po Europe/Zagreb.
   Prije 06:00 gleda se jučerašnjih 06:00 (noć traje do 6 ujutro). Nema crona, sve se računa iz timestampa.
3. **Popis**: prisutni su zeleni s dokaznom slikom na vrhu popisa; prikazuju se samo prisutni / koji stižu — "nema ga" korisnici se NE prikazuju.
4. **Liga ekipa** (`lib/liga.js`, `/liga` tab — zamijenio /shame): grupe se natječu TJEDNO
   (ponedjeljak 06:00 → ponedjeljak 06:00 po lakat-danima, `weekStartKey`). Bodovi on-the-fly iz
   checkins (NEMA crona ni score tablice): dolazak (jedinstveni user+dan) = +2 (`BOD_DOLAZAK`),
   ispunjen odaziv na saziv (checkin sa `saziv_id`, jedinstven user+saziv) = +1 (`BOD_ODAZIV`),
   zajednički kadar = +4 (`BOD_KADAR`) po DANU s bar jednom kadar slikom (anti-farm cap).
   Cross-group zbrajanje ide ADMIN klijentom, ali UI smije vidjeti SAMO ime grupe + bodove + broj
   članova — nikad tuđe slike/članove/lokacije. Widget na vrhu Šanka ("🏆 n. u ligi") + puna
   tablica na /liga s prvakom prošlog tjedna. Sirovi bodovi bez normalizacije po veličini grupe —
   NAMJERNO: više članova = više bodova = motiv za pozivanje ljudi (growth petlja).
5. **Wrapped/statistika**: mjesečni rang po postotku dolazaka ostaje (`monthRanking`, `bestOf` za
   "Inventar mjeseca" 🏆 na Wrapped kartici) — slavi se najbolji, ne proziva najgori. `worstOf`,
   `allTimeStats` i picka_* bedževi su OBRISANI (stari picka_* redovi u `user_badges` ostaju u
   bazi, `badgeInfo()` za njih vraća null pa se ne renderiraju).
6. **Izazov tjedna** (`lib/izazovi.js`): NEMA tablice ni crona — izazov se deterministički bira
   FNV-1a hashom (group_id + weekKey) iz poola `IZAZOVI`, ispunjenje se detektira iz checkina
   tjedna (`checkIzazov`), bodovi +10 idu kroz `computeLiga` (`BOD_IZAZOV`). Prikaz: kompaktna
   kartica na Šanku ispod saziva (prop `izazov` u `sank.jsx`, ✓ kad je ispunjen) + marker u ligi.
7. **Grupni streak**: dan s bar 1 rundom bilo koga iz grupe = streak dan; derivat iz istih
   checkina (60-dnevni prozor Šanka), prikaz "🔥 n" u liga widgetu. Push "streak ekipe umire"
   ide iz POSTOJEĆEG crona `/api/cron/streak-visi` (`grupniStreakVisiPushBody`, max 1× navečer,
   samo ako danas još nitko nije izašao) — NE dodavati nove cronove/podsjetnike (BeReal pouka).
8. **Pouzdanost (Kremen/Fantom)** (`lib/pouzdanost.js` + `pouzdanost-card.jsx`): rekao "stižem"
   na saziv i stvarno došao (checkin sa saziv_id) vs ispario. Broje se samo ZAKLJUČENI sazivi
   (at_time+3h prošao). Titula od 3 odaziva: ≥80% Kremen 💎, ≥50% Pola-pola 🌗, inače Fantom 👻.
   Prikaz SAMO na /profil i /korisnik/[id] — NIKAD push, NIKAD rang (nije novi sram).
9. **Zajednički kadar** (`checkins.kadar_user_ids uuid[]`, od `supabase-kadar1.sql`): u runda
   flowu se NAKON editora prikaže picker "tko je u kadru" SAMO ako je još netko danas prisutan
   (fetch kreće paralelno s kamerom, `presentRef`) — solo runda nema nijedan dodatni klik.
   Server u `checkIn` validira da su označeni članovi grupe (ne vjeruje klijentu), autor se
   uvijek dodaje, sprema se samo 2+ u kadru, i samo uz dokaznu sliku. `computeLiga` čita kolonu
   s fallbackom na select bez nje (ne smije pasti prije primjene SQL-a).
10. **Share kartice** (`lib/share-card.js` + gumb "Podijeli" u photo-lightbox.jsx): canvas
   1080×1920 story kartica (blur cover pozadina, slika, LAKAT. wordmark, caption,
   laktarenje.com) → Web Share API s files, fallback download. Organski marketing — ne dirati
   branding elemente bez pitanja.
6. **Registracija**: email, lozinka, username, ime + šifra grupe (join postojeće ili create nove). Šifra grupe je hashirana u `groups.password_hash` (pgcrypto) i provjerava se ISKLJUČIVO server-side preko `verify_group_password` RPC-a (service_role only). Nikad ne slati šifru u klijentski bundle.

## Baza (Supabase)
Schema je flat SQL fajlovi primijenjeni ručno u Supabase SQL editoru, redom: `supabase-setup.sql` → `-avatars` → `-faza1..4` → `-grupe1.sql` → ... → `-najave2.sql` → `-saziv1.sql` → `-kadar1.sql`. NE kreiraj migracijski framework, NE mijenjaj schemu bez pitanja — dodaj novi `supabase-*.sql` fajl po istoj konvenciji.

- `profiles`: id (uuid, FK na auth.users), username (unique), avatar_url, active_group_id, created_at
- `checkins`: id, user_id, group_id, checked_in_at, cancelled_at, photo_url, lat, lng, saziv_id (nullable FK), kadar_user_ids (uuid[], nullable — tko je u kadru, uklj. autora)
- `groups`: id, name (unique), password_hash, created_by
- `group_members`: group_id, user_id, role (admin/member), joined_at
- `reactions`: checkin_id, user_id, emoji (unique po user/checkin)
- `najave`: "stižem" najave dolaska; od `supabase-najave2.sql` imaju `target_user_id` (uuid, nullable) — najava cilja KONKRETNOG prisutnog (klik "👉 Stižem" na njegovoj kartici), push ide SAMO meti (`notifyUser` + `najavaTargetPushBody`), ostali vide label "Stiže kod X" + badge "👀 n stiže/stižu" na kartici mete. Nema najave dok nitko nije za šankom (nema komu). Stari redovi imaju target null → generični label "Stiže (navodno)" (isti fallback kad meta ode)
- `sazivi`: saziv okupljanja (od `supabase-saziv1.sql`) — id, group_id, created_by, place_text (1-40), at_time, created_at. Jedan živi po grupi (enforce u akciji `digniEkipu`, ne u bazi); nema update policyja (otkaži pa digni novi)
- `saziv_odazivi`: saziv_id, user_id, group_id, status ('stizem'|'ne_mogu'), responded_at; unique (saziv_id, user_id) — upsert mijenja odgovor. `checkins.saziv_id` (nullable, on delete set null) veže rundu na saziv
- `push_subscriptions`: user_id, subscription (jsonb), created_at
- `drinks`: beer log — id, user_id, group_id, drink_type, logged_at. Redni broj pića se ne sprema, derivira se brojanjem redova po lakat-danu. Lista pića je u `lib/drinks.js` (DRINK_TYPES, uklj. pelin od `supabase-pica3.sql`; **"sot" je maknut iz ponude** — ključ ostaje u DB constraintima zbog starih redova, `drinkInfo("sot")` vraća null pa prikazi moraju biti null-safe; rakija nosi ⚡); zadnje danas logirano piće je ujedno marker korisnika na mapi (fallback: random emoji stabilan po danu). `profiles.map_emoji` postoji u bazi ali je DEPRECATED — picker je maknut, kolona se ne koristi.
- `kolo_spins`: NAPUŠTENO — random kolo "Piće dana" je zamijenjeno omnitrix odabirom pića u runda flowu (korisnik BIRA, ne random). Tablica i stari redovi ostaju u bazi, kod je ne čita niti piše; `spinKolo` akcija i `kolo-icon.jsx` su obrisani.

RLS je uključen i grupno-scopan (`is_member(group_id)`, `shares_group_with(id)` helper funkcije). Sva pisanja u `groups`/`group_members` idu isključivo kroz service-role admin klijent (`lib/supabase/admin.js`), nema client insert/update policyja na tim tablicama.

## Realtime
Supabase Realtime subscription po grupi (`checkins-live-${groupId}`) na `checkins`/`najave`/`reactions`/`drinks`/`sazivi`/`saziv_odazivi` (INSERT/UPDATE, `drinks` i reakcije i DELETE, `sazivi` INSERT+DELETE). Kad netko objavi rundu ili logira piće, popis se svima u istoj grupi osvježi bez refresha. Runda-flow NE radi optimističke redove — Šank novi red dobije realtimeom.

## Env varijable (.env.local)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SECRET_KEY (server-only, service role, bypass RLS — koristi se za grupne operacije)
- CRON_SECRET (za `/api/cron/prazan-sank`)
- VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY (push)
- LAKAT_LOCKDOWN (opcionalno): "1" = lockdown za velike radove — svi osim allowliste emailova (hardkodirana u `proxy.js`) idu na `/uskoro` ("VELIKI UPDATE DOLAZI."), /login ostaje dostupan, SVI pushevi pauzirani (guard u `lib/push.js` setupWebpush). Gašenje = obrisati env var u Vercelu + redeploy.

## Ekrani
1. `/login` i `/register` — auth (join ili create grupu pri registraciji)
2. `/` — glavni "Šank": realtime popis korisnika (prisutni + "stiže kod X"), "Slike dana"; objava runde ide kroz PLUS u navbaru (dostupan na svim ekranima)
3. `/liga` — liga ekipa: tjedna tablica svih grupa + prvak prošlog tjedna + kako se boduje
4. `/mapa` — Leaflet mapa check-in lokacija
5. `/profil` i `/profil/postavke` — vlastita statistika, galerija, upravljanje grupama
6. `/korisnik/[id]` — tuđi profil

## Dizajn
- Mobile first. 95% korištenja je s mobitela u kafiću, po noći.
- Tamna tema obavezna (crna/tamno siva pozadina). Zelena za prisutne.
- Veliki touch targeti — plus u navbaru i kolo pića moraju biti nemogući za promašiti pijan.
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
