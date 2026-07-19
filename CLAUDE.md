@AGENTS.md

# LAKAT — Kontekst projekta

## Što je ovo
Web aplikacija (PWA) — **društvena mreža za druženje uživo** (cilja regionalno/balkansko tržište).
Korisnik gradi **friend listu**, objavljuje runde s dokaznom slikom, diže "Poziv na laktanje", i
natječe se u tjednom RANGU (među pajdašima + globalno). Dugoročno: partner kafići (loyalty bodovi za
popuste, INA/BATAK model). **Sram mehanika je UKLONJENA.**
Ton aplikacije je vulgaran i zajebantski — to je feature, ne bug; vulgarne riječi u copyju su OK.
Copy piši na hrvatskom, slobodno bezobrazno, ali razumljivo cijeloj regiji (izbjegavaj hiper-lokalni
sleng koji izvan Dubrovnika nitko ne kuži). Jezične konvencije copyja: "pjanac/pjanci" (dubrovački,
NE "pijanac"), "pajdaš/pajdaši" za frendove, bez engleskog "checkirati" (domaće: "za šankom", "sjeo za
šank"), linkovi za prijavu su "Prijavi se", loading tekst "Sekunda...".
**Brend interpunkcija** (`. ? !` u display fontu = cijeli accent zeleni) ide kroz `app/brand-punct.jsx`.

### PRIVATNOST = SAMO FRENDOVI (temeljno pravilo 3.0)
Sav sadržaj (checkini, slike, pića, prisutnost, statistika, pozivi) vidi ISKLJUČIVO prihvaćeni frend.
Tuđi profil bez frendstva = samo username + avatar + "Dodaj". Provedeno na RLS razini
(`are_friends()` helper) — kod se OSLANJA na RLS (upiti nemaju group/friend filter, realtime kanali
su bez filtera), pa svaki novi upit MORA proći kroz user-scoped klijent osim gdje je namjerno javno
(username/avatar preko admin klijenta na ne-frend kartici, "možda se znate", rang globalni broj).

**Grupe su UKLONJENE** (bile 2.x). Tablice `groups`/`group_members`/`group_id` kolone OSTAJU u bazi
(povijest, nullable), ali ih novi kod NE čita. Vidljivost određuje `friendships` graf.

## Stack (NE MIJENJAJ)
- Next.js 16+, App Router, JavaScript (.jsx), NE TypeScript
- Tailwind CSS v4 (tema u `app/globals.css`, nema `tailwind.config.js`)
- Supabase: auth (email + lozinka), Postgres, Realtime, Storage
- Hosting: Vercel (laktarenje.com), funkcije u regiji **fra1** (`vercel.json` — korisnici i Supabase su u EU, ne mijenjati)
- PWA: manifest + service worker, instalacija na home screen. SW (`public/sw.js`, cache "lakat-v4"): RSC/prefetch zahtjeve (`_rsc`, `RSC` header) NE presreće (sintetski odgovori tjeraju Next router na puni reload!), `/_next/static/`+ikone+fontovi su cache-first, navigacije network-first s offline fallbackom, ostalo se ne dira
- Middleware fajl se zove `proxy.js` (Next 16 preimenovanje middleware→proxy); u njemu se auth provjerava s `getClaims()` (lokalna JWT validacija), NE `getUser()` (mrežni roundtrip po requestu)

## 3.0 PROMJENE — override za pravila ispod
Detaljna "Pravila igre" i "Baza"/"Ekrani" sekcije NIŽE su pisane za 2.x (grupe). U 3.0 vrijedi isti
flow ALI scope je friend lista umjesto grupe. Ključni deltas (mjerodavni gdje se kose s tekstom niže):
- **Vidljivost**: `is_member(group_id)` → `are_friends(user, autor)`. Helperi u `supabase-lakat3-1.sql`
  (`are_friends`, `can_see_checkin`, `can_see_saziv`). Feed/mapa/rang su scopani na ja+frendove.
- **Šank = kronološki feed** (`sank.jsx`): story bar prisutnih/stižućih avatara (tap → sheet
  Profil/Stižem) + feed današnjih rundi (velika slika, inline reakcije, 💬 → `comment-sheet.jsx`
  bottom sheet). Feed je SAMO današnji lakat-dan. Realtime kanal `feed-live-${userId}` bez filtera.
- **Saziv**: max 1 živi po KREATORU (ne po grupi), ide SVIM frendovima kreatora; stack živih poziva na
  vrhu Šanka (`saziv-card.jsx`: `SazivComposer` + `SazivCard`).
- **Rang** (`lib/rang.js`, `/rang`, bivša /liga koja sad redirecta): bodovi POJEDINCA (dolazak +2,
  odaziv +1, kadar +4/dan, osobni izazov +10). Prikaz: ljestvica frend kruga + MOJA globalna pozicija
  SAMO kao broj ("#3 od N"). Izazov tjedna je OSOBAN (`lib/izazovi.js`, hash user+week).
- **Pushevi**: `notifyFriends(userId,...)` (frendovi autora) umjesto notifyGroup. FOMO = "3+ pajdaša
  vani" po primatelju (`fomoSweep`, claim `profiles.fomo_day`). Prazan-šank cron OBRISAN. Streak-visi
  samo osobni.
- **Kadar** = prisutni FRENDOVI unutar 500 m (`lib/geo.js`). **Bedževi** globalni po korisniku
  (`unique(user_id, badge_key)`, bez groupId; `founding_member`/`prvi_ikad` umirovljeni).
- **Mapa**: mjesta/otimanje OBRISANI; partner kafići (`kafici` tablica) = zelene zastavice. Runda u
  radijusu kafića dobiva `checkins.kafic_id` (temelj loyalty bodova — UI SKRIVEN do 1. ugovora).
- **Discovery**: kod + share link + "možda se znate" (frendovi frendova, `/profil/frendovi`). Zahtjev
  s tuđeg profila (`sendFriendRequestTo`) traži bar 1 zajedničkog pajdaša. BEZ pretrage po imenu.
- **Onboarding**: registracija bez grupe → ako nemaš frendova, Šank pokazuje `add-friends-card.jsx`.

## Pravila igre (poslovna logika) — 2.x baza, čitaj uz 3.0 override gore
1. **Runda (check-in)**: zeleni PLUS u sredini navbara (TikTok stil, `plus-button.jsx` + `runda-flow.jsx`, lazy iz `nav.jsx`) → kamera → **photo editor** (`photo-editor.jsx`: pregled + opcionalni IG-story tekst, 4 stila, drag pozicija; tekst se peče canvasom u JPEG prije uploada, thumb iz pečenog bloba) → "Objavi" upisuje red u `checkins` → **omnitrix kolo pića** (`omnitrix.jsx`: okreće se prstom 1:1, inercija + snap na segment, odabrano je pod kazaljkom, "Potvrdi" = logDrink; X preskače; NE random, potpuno neprozirni overlay). **Više rundi dnevno je dozvoljeno** — prva slika dana je check-in (checkin push kopija, `isFirstToday` u checkIn akciji), svaka sljedeća je nova runda (nova slika u Slike dana + piće) i TAKOĐER šalje push (`rundaPushBody`) uz cooldown po autoru: `RUNDA_PUSH_COOLDOWN_MS` = 45 min od prethodne autorove runde, inače se push preskače (objava prolazi). Popis "Za šankom" prikazuje ZADNJU objavljenu sliku korisnika i njeno vrijeme (fallback: najnoviji checkin bez slike). Piće se logira ISKLJUČIVO kroz taj flow; undo = toast "↩ Krivi tap" (~8s) nakon zapisanog pića. Veliki gumb "TU SAM" i drink-bar više NE postoje. **"Ipak bježim" je maknut** — `cancelCheckIn` akcija ne postoji, `checkins.cancelled_at` kolona ostaje u bazi zbog starih redova (filteri `.is("cancelled_at", null)` ostaju).
1b. **Saziv — u UI-ju se zove "POZIV NA LAKTANJE"** (gumb za slanje: "ZOVI NAROD"; interni
   nazivi u kodu ostaju sazivi/digniEkipu). (`saziv-card.jsx` na vrhu Šanka): bilo koji član digne okupljanje —
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
   tjedna (`checkIzazov`), bodovi +10 idu kroz `computeLiga` (`BOD_IZAZOV`). Prikaz: kartica na
   /liga između prvaka i tablice (Šank NEMA izazov karticu — maknuta u 2.2) + marker u ligi.
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
   UNUTAR RADIJUSA (fetch kreće paralelno s kamerom, `presentRef`) — solo runda nema nijedan
   dodatni klik. **STROGO lokacijski** (`lib/geo.js`: `KADAR_RADIUS_M` = 500, haversine
   `distanceM`): kandidat je samo član čija je najnovija današnja runda S koordinatama unutar
   500 m od autora; bez autorove lokacije picker se preskače. Server u `checkIn` validira
   članstvo I udaljenost (ne vjeruje klijentu; bez autorovih koordinata kadar se odbacuje),
   autor se uvijek dodaje, sprema se samo 2+ u kadru, i samo uz dokaznu sliku. `computeLiga`
   čita kolonu s fallbackom na select bez nje (ne smije pasti prije primjene SQL-a).
   **Kadar push** (`kadarPushBody`: "X i Y laktaju skupa. A di ste vi?"): prva runda dana s
   kadrom koristi kadar kopiju UMJESTO checkin kopije; ne-prva runda (unutar runda-push
   cooldowna, vidi #1) koristi kadar kopiju SAMO za prvu kadar sliku dana u grupi, inače
   `rundaPushBody`; tagirani su `excludeIds`. Face-scan prepoznavanje je RAZMOTRENO I
   ODBIJENO (GDPR biometrija) — tagovi rade isti posao.
10. **Share kartice** (`lib/share-card.js` + gumb "Podijeli" u photo-lightbox.jsx): canvas
   1080×1920 story kartica (blur cover pozadina, slika, LAKAT. wordmark, caption,
   laktarenje.com) → Web Share API s files, fallback download. Organski marketing — ne dirati
   branding elemente bez pitanja.
11. **Naša mjesta** (`lib/mjesta.js`, prikaz na /mapa): grid klasteriranje (~130 m) checkina s
   koordinatama u zadnjih 30 dana, grupa s najviše rundi na lokaciji (min 3) "drži" mjesto —
   zastavica ⚑ s imenom grupe na Leaflet mapi (mjestaLayer ispod dnevnih markera). Izjednačenje
   = "ničija zemlja". Cross-group ide ADMIN klijentom, van smije SAMO ime grupe + broj rundi.
   Sve on-the-fly, bez tablice. **Otimanje mjesta push** (`detectOtimanje` u lib/mjesta.js,
   poziva se iz `checkIn` nakon inserta runde s koordinatama): usporedi vlasnika ćelije bez/s
   novom rundom; promjena → push osvajačima (`mjestoOsvojenoPushBody`) i eventualnim bivšim
   vlasnicima (`mjestoOtetoPushBody`). Tihe promjene starenjem rundi NE šalju push.
6. **Registracija**: email, lozinka, username, ime + šifra grupe (join postojeće ili create nove). Šifra grupe je hashirana u `groups.password_hash` (pgcrypto) i provjerava se ISKLJUČIVO server-side preko `verify_group_password` RPC-a (service_role only). Nikad ne slati šifru u klijentski bundle.

## Baza (Supabase)
Schema je flat SQL fajlovi primijenjeni ručno u Supabase SQL editoru, redom: `supabase-setup.sql` → `-avatars` → `-faza1..4` → `-grupe1.sql` → ... → `-najave2.sql` → `-saziv1.sql` → `-kadar1.sql` → `-kava1.sql`. NE kreiraj migracijski framework, NE mijenjaj schemu bez pitanja — dodaj novi `supabase-*.sql` fajl po istoj konvenciji.

- `profiles`: id (uuid, FK na auth.users), username (unique), avatar_url, active_group_id, created_at
- `checkins`: id, user_id, group_id, checked_in_at, cancelled_at, photo_url, lat, lng, saziv_id (nullable FK), kadar_user_ids (uuid[], nullable — tko je u kadru, uklj. autora)
- `groups`: id, name (unique), password_hash, created_by
- `group_members`: group_id, user_id, role (admin/member), joined_at
- `reactions`: checkin_id, user_id, emoji (unique po user/checkin)
- `najave`: "stižem" najave dolaska; od `supabase-najave2.sql` imaju `target_user_id` (uuid, nullable) — najava cilja KONKRETNOG prisutnog (klik "👉 Stižem" na njegovoj kartici), push ide SAMO meti (`notifyUser` + `najavaTargetPushBody`), ostali vide label "Stiže kod X" + badge "👀 n stiže/stižu" na kartici mete. Nema najave dok nitko nije za šankom (nema komu). Stari redovi imaju target null → generični label "Stiže (navodno)" (isti fallback kad meta ode)
- `sazivi`: saziv okupljanja (od `supabase-saziv1.sql`) — id, group_id, created_by, place_text (1-40), at_time, created_at. Jedan živi po grupi (enforce u akciji `digniEkipu`, ne u bazi); nema update policyja (otkaži pa digni novi)
- `saziv_odazivi`: saziv_id, user_id, group_id, status ('stizem'|'ne_mogu'), responded_at; unique (saziv_id, user_id) — upsert mijenja odgovor. `checkins.saziv_id` (nullable, on delete set null) veže rundu na saziv
- `push_subscriptions`: user_id, subscription (jsonb), created_at
- `drinks`: beer log — id, user_id, group_id, drink_type, logged_at. Redni broj pića se ne sprema, derivira se brojanjem redova po lakat-danu. Lista pića je u `lib/drinks.js` (DRINK_TYPES, uklj. pelin od `supabase-pica3.sql` i **kavu ☕ od `supabase-kava1.sql`**; **"sot" I "vino" su maknuti iz ponude** — ključevi ostaju u DB constraintu zbog starih redova, `drinkInfo()` za njih vraća null pa prikazi moraju biti null-safe; rakija nosi ⚡); zadnje danas logirano piće je ujedno marker korisnika na mapi (fallback: random emoji stabilan po danu). `profiles.map_emoji` postoji u bazi ali je DEPRECATED — picker je maknut, kolona se ne koristi.
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
- **Brend interpunkcija u display (Anton) fontu** — dio brend voicea: `.`, `?` i `!` se
  renderiraju CIJELI u accent zelenoj. Za user-input i nove naslove UVIJEK kroz
  `app/brand-punct.jsx` (BrandPunct); postojeći ručni `<span className="text-accent">` spanovi
  su u skladu s pravilom i smiju ostati. Vrijedi i za user-input u display fontu (saziv
  place_text). (Varijanta "samo točka glifa zelena" isprobana i ODBAČENA — korisnik želi
  cijeli znak zelen.)

## Disciplina rada (VAŽNO)
- **NIKAD `git push` (= deploy na laktarenje.com) bez eksplicitnog dopuštenja korisnika** —
  vrijedi i za bugfixeve: pripremi fix, verificiraj, commitaj lokalno, pa PITAJ. App je živ
  s pravim korisnicima.
- **"Što je novo" kartica se radi SAMO na izričitu riječ korisnika** — on odlučuje kada je
  update dovoljno velik da je zaslužuje (pravilo od 2026-07-18). NE raditi je proaktivno po
  batchu. Obrazac kad je zatraži: `app/(main)/whats-new.jsx` (glass + accent glow, stagger
  redovi, X dismiss u localStorage, hardkodirani istek ~2 dana od deploya).
- Radi ISKLJUČIVO ono što piše u promptu. Svaki prompt završava s "Ne diraj ništa drugo." i to se poštuje doslovno.
- Ne refaktoriraj postojeći kod bez eksplicitnog zahtjeva.
- Ne dodavaj dependencije koje nisu tražene.
- Ne kreiraj TypeScript fajlove.
- Faze rada su u `PROMPTS.md` — jedna faza po sessionu, redom.
- Nakon svake faze reci točno što je napravljeno i što korisnik mora ručno testirati.

## LAKAT 3.0 U TIJEKU (od 2026-07-19)
**Veliki pivot: grupe VAN, friend model + partner kafići.** Cijeli roadmap s konačnim
odlukama korisnika je u `LAKAT3-PLAN.md` — čitaj ga PRIJE bilo kakvog rada. Faze idu
redom (0→G), jedna po sesiji; SVE se razvija na DEV Supabase bazi (.env.local), prod se
dira TEK u Fazi G (cutover uz lockdown). Dijelovi ovog CLAUDE.md koji opisuju grupe/ligu/
mjesta vrijede za ŽIVU 2.x produkciju dok cutover ne prođe — potpuni rewrite je dio Faze F.

- [x] Faza 0: dev okruženje — Supabase projekt `lakat-dev` (ref krhirdrftysfbltugmwr, org Lakat),
      SVA schema (21 skripta, bez prod-migracijskog bloka iz grupe1) primijenjena; `.env.local` na
      dev (prod backup u `.env.prod.backup`); 3 test računa + frendstvo (podaci u .env.local
      komentarima — NE u repo, repo je javan)
- [x] Faza A: baza 3.0 — `supabase-lakat3-1.sql` PRIMIJENJEN NA DEV (are_friends/can_see_checkin/can_see_saziv helperi, RLS po frendovima na svim tablicama, group_id nullable svugdje, bedževi globalni unique(user,badge), kafici tablica + checkins.kafic_id); `supabase-lakat3-migracija.sql` spreman za prod (Faza G, ide PRIJE lakat3-1); RLS verificiran REST-om (frend vidi/201, ne-frend prazno/403); seed: kafić Club23 partner na dev
- [x] Faza B: friend model core — actions.js kompletno bez grupa (checkIn: saziv po vidljivosti, kadar=frendovi 500m, kafic_id detekcija, notifyFriends, fomoSweep po primatelju uz profiles.fomo_day claim; saziv max 1 po KREATORU); lib/push.js notifyFriends (notifyGroup obrisan), lib/friends.js friendIdsOf; badges globalni (bez groupId, founding_member+prvi_ikad umirovljeni, tenure od registracije); prazan-sank cron OBRISAN (i vercel.json), streak-visi samo osobni; group-switcher obrisan, layout bez grupa; fomo_day primijenjen na dev
- [x] Faza C: novi Šank — kronološki feed (sank.jsx: story bar prisutnih/stižućih avatara s mini action sheetom Profil/Stižem, feed današnjih rundi s inline reakcijama + komentari u bottom sheetu comment-sheet.jsx, stack živih poziva saziv-card.jsx SazivComposer+SazivCard, realtime bez filtera — RLS ograničava); page.jsx bez grupa (frend krug + comment counts); add-friends-card.jsx empty state s kodom; flashbacks bez group filtera; whats-new maknut sa Šanka
- [x] Faza D: Rang — lib/rang.js (computeBodovi/computeRang: bodovi pojedinca, ljestvica frend kruga, globalna pozicija SAMO broj), lib/izazovi.js OSOBNI pool (hash user+week), /rang stranica + rang-widget na Šanku, /liga → redirect /rang, nav tab Rang; Wrapped na frend krug (OD n PAJDAŠA)
- [x] Faza E: mapa — mjesta/otimanje OBRISANI (lib/mjesta.js + push copy), partner kafići zelene zastavice (mapa/page fetch kafici partner=true, map-view kaficiLayerRef), markeri = ja+frendovi, realtime bez filtera; kafic_id detekcija već u checkIn (Faza B); bodovi UI namjerno SKRIVEN do 1. ugovora
- [x] Faza F: discovery + onboarding + čišćenje — Pajdaši 'možda se znate' + zahtjev s profila; welcome/postavke/registracija bez grupa; grupni fajlovi (grupe-actions, moje-grupe, group-switcher, join-group-card, lib/groups, lib/liga, lib/mjesta, /g/[code]) + whats-new 2.0 OBRISANI; lib čist (fetchAllCheckins/Drinks bez groupId, auth bez getActiveGroupFor); CLAUDE.md 3.0 override sekcija. E2E verificirano na dev: ante vidi bepin feed/saziv/prisutnost, cvitan (bez frendova) vidi SAMO sebe + add-friends empty state
- [ ] Faza G: cutover na produkciju (lockdown, SAMO uz dopuštenje)

## Status faza (ažuriraj nakon svake završene faze)
- [x] Faza 1: setup, auth, registracija sa šifrom
- [x] Faza 2: glavni ekran, check-in, realtime popis
- [x] Faza 3: hall of shame + statistika profila
- [x] Faza 4: PWA (manifest, ikone, instalacija)
- [x] Faza 5: push notifikacije
