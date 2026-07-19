# LAKAT 3.0 — Društvena mreža: friend model umjesto grupa + partner kafići

## Kontekst

Veliki pivot (dani rada): grupe IDU VAN, LAKAT postaje prava društvena mreža za druženje.
Srž ostaje (runde, slike, streakovi, sazivi, pića), ali **vidljivost određuje friend lista**.
Dugoročno: ugovori s kafićima (INA Loyalty/BATAK model) — partner kafići zeleni na mapi,
laktanje na njima skuplja bodove za buduće popuste.

**Veliki adut:** friend sustav VEĆ POSTOJI (`friendships`, kodovi, `/f/[code]`, Pajdaši,
`notifyUser`) — 3.0 ga promiče iz sporedne u središnju mehaniku.

## KONAČNE ODLUKE (brainstorming s korisnikom, 19.7.)

| Tema | Odluka |
|---|---|
| Model | Friend lista (uzajamno prihvaćanje), grupe van |
| Privatnost | SAMO frendovi vide sadržaj; tuđi profil bez frendstva = username + avatar + "Dodaj" |
| Migracija | Auto-frendovi: svi ko-članovi postojećih grupa postaju međusobno frendovi; povijest ostaje |
| Dev baza | NOVI čisti Supabase test projekt; na prod se primjenjuje tek na cutover dan |
| Šank | **KRONOLOŠKI FEED**: story bar prisutnih avatara gore (🟢 prisutni, 👀 stižu) + feed današnjih rundi (velika slika, reakcije inline, 💬 brojka) |
| Feed dubina | SAMO DANAS (lakat-dan); prošlost = flashbackovi + galerija na profilu |
| Komentari | Bottom sheet na tap 💬 (lazy, postojeći comment-thread obrazac) |
| Rang (bivša Liga) | Tab "Rang": tjedna ljestvica MOJIH frendova + MOJA globalna pozicija samo kao broj ("#300 od 1.240") — bez javne globalne ljestvice. Per-kafić ljestvice kasnije s ugovorima |
| Sazivi | Saziv ide SVIM frendovima kreatora; STACK kartica živih saziva na Šanku (najnoviji gore); max 1 MOJ živi saziv; odazivi vidljivi svim pozvanima |
| Discovery | Kod + share link + "Možda se znate" (frendovi frendova s brojem zajedničkih); BEZ pretrage po imenu |
| Bodovi vjernosti | Temelji u bazi ODMAH (kafici + checkins.kafic_id), UI SKRIVEN do 1. potpisanog ugovora |
| Admin kafića | SQL/Supabase dashboard za sad; admin ekran kasnije |
| Prazan-šank cron | GASI SE; streak-visi (osobni) ostaje jedini večernji podsjetnik |
| Frend limit | Neograničen (growth) |

## Dizajn odluke (moje, dokumentirane)

1. **RLS**: `are_friends(a,b)` security-definer helper; red vidljiv ako je autor ja ILI moj
   prihvaćeni frend; insert samo svoje. Vrijedi za checkins/drinks/najave/sazivi/
   saziv_odazivi/reactions/comments.
2. **Baza aditivno**: `groups`/`group_members`/`group_id` kolone OSTAJU (povijest), novi kod
   ih ne čita. Realtime kanali BEZ group filtera — RLS na postgres_changes filtrira.
3. **Pushevi**: `notifyFriends(userId, body)` zamjenjuje notifyGroup (checkin/runda/kadar/
   saziv/milestone). FOMO → "3+ tvojih frendova je vani" (po primatelju, 1×/dan, dedup preko
   `profiles.fomo_day`). Grupni streak umire. Runda cooldown 45 min ostaje.
4. **Kadar** = prisutni FRENDOVI unutar 500 m (lib/geo.js ostaje).
5. **Bodovi pojedinca** (lib/rang.js, bivši liga.js): dolazak +2, ispunjen odaziv +1, kadar
   +4/dan, izazov tjedna +10 (osoban: FNV-1a hash user_id+week iz istog IZAZOVI poola,
   provjera nad vlastitim checkinima). Globalna pozicija on-the-fly admin klijentom.
6. **Bedževi** globalni po korisniku; `founding_member`/`prvi_ikad` umirovljeni (badgeInfo
   → null, obrazac picka_*).
7. **Pouzdanost** (Kremen/Fantom) ostaje — veže se na sazive, radi i bez grupa.
8. **Wrapped** = mjesečni rang među frendovima.

## FAZE (jedna po sesiji, redom; sve na DEV bazi do Faze G)

### Faza 0 — Dev okruženje
Novi Supabase projekt (korisnik kreira ili ja kroz browser; trebaju URL + anon + secret).
Postojeće supabase-*.sql redom na dev bazu, seed 3-4 test korisnika s frendstvima/checkinima.
`.env.local` → dev ključevi (prod ključevi sačuvani sa strane za cutover). Provjera: dev
server radi protiv dev baze.

### Faza A — Baza 3.0
`supabase-lakat3-1.sql` (dev): `are_friends()`, nove RLS policyje po točki 1, `kafici`
(id, name, lat, lng, radius_m, partner bool, created_at) + `checkins.kafic_id` (nullable FK),
`sazivi.group_id` nullable. `supabase-lakat3-migracija.sql` (spremljen za prod cutover):
INSERT prijateljstava svih parova ko-članova (accepted, ON CONFLICT skip).

### Faza B — Friend model core (akcije + pushevi)
`lib/friends.js` + `friendIdsOf`; `lib/push.js` + `notifyFriends`; `checkIn`/`logDrink`/
`najaviDolazak`/`undoLastDrink`/saziv akcije BEZ getActiveGroup (max 1 živi saziv po
KREATORU); kadar kandidati = prisutni frendovi (klijent i server, 500 m); FOMO rework;
prazan-sank cron + vercel.json unos VAN; streak-visi bez grupnog dijela; push-copy dorade
(fomo "frendovi", kadar isto, saziv isto).

### Faza C — NOVI ŠANK: kronološki feed
Najveći UI zahvat: story bar prisutnih/stižućih avatara (tap na avatar → profil; "👉 Stižem"
u story baru na prisutnom frendu), feed današnjih rundi frendova (kartica: avatar + ime +
vrijeme + velika slika + ReactionBar inline + 💬 brojka → bottom sheet komentara), stack
živih saziva na vrhu, realtime bez group filtera (INSERT checkins/drinks/najave/sazivi/
reactions), flashbackovi "na današnji dan" ispod feeda, hint za plus kad nisam vani.
Header BEZ group-switchera. BrandPunct svugdje po pravilu.

### Faza D — Rang + izazov + Wrapped
`lib/rang.js` (bodovi pojedinca, ljestvica frendova, globalna pozicija broj); /liga → /rang
(redirect sa stare rute), nav ikona ostaje trofej; kartica izazova tjedna (osobna) na Rangu;
widget na Šanku "🏆 1. među frendovima · #300 u svijetu"; Wrapped rang među frendovima;
"Kako se boduje" copy update.

### Faza E — Mapa + partner kafići
Mjesta/otimanje VAN (lib/mjesta.js, detectOtimanje, oba push copyja, computeMjesta render).
`kafici` render: zelene zastavice partnera; detekcija `kafic_id` u checkIn (radius match,
best-effort); markeri = frendovi danas. Bodovi UI NE POSTOJI još (skriveno do 1. ugovora —
samo baza puni kafic_id).

### Faza F — Discovery + onboarding + veliko čišćenje
"Možda se znate" na Pajdašima (frendovi frendova + broj zajedničkih, admin klijent, dedup
postojećih/pending); registracija bez grupe; JoinGroupCard → AddFriends empty state ("Bez
pajdaša nema šanka" + kod/link + prijedlozi); postavke bez Moje grupe; /g/[code] van;
group-switcher van; welcome copy 3.0 (mrtvi "TU SAM" konačno van); bedževi globalno; mrtvi
kod van (grupe-actions, group-switcher, lib/groups.js, liga.js...); whats-new 2.0 mrtva
kartica van; TEKSTOVI.md + CLAUDE.md potpuni rewrite (pravila igre 3.0).

### Faza G — Cutover na produkciju (SAMO uz eksplicitno dopuštenje, zadnja sesija)
Lockdown (LAKAT_LOCKDOWN=1) → prod SQL (lakat3-1 + migracija auto-frendova) → .env.local
natrag na prod → korisnikov test na mobitelu → git push + deploy → live verifikacija
(frend feed, ne-frend NE vidi ništa, rang, mapa, pushevi) → lockdown OFF. PRESKOCENI_DANI
+= dani lockdowna. PITATI korisnika za "što je novo" karticu (LAKAT 3.0 — njegova odluka).

## Verifikacija (svaka faza + finalno)
- Po fazi: `npm run lint` (bez novih grešaka) + `npm run build` + ručni test na dev bazi.
- KLJUČNI test vidljivosti: 3 test računa (A-B frendovi, C nikome) — C ne smije vidjeti
  NIŠTA od A/B (feed, mapa, rang, profil, realtime). REST curl s JWT-ovima za RLS provjeru.
- Realtime: dva browser profila — checkin frenda uskače bez refresha, ne-frendu nikad.
- Feed perf: 20+ rundi u danu, scroll gladak na mobilnoj širini (375px).
- Pred cutover: korisnikov kompletan test na mobitelu protiv dev baze.
