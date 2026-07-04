# LAKAT — Tvoji ručni koraci

## Prije prvog prompta

1. **Folder projekta**: napravi npr. ~/Desktop/lakat i u njega kopiraj CLAUDE.md, PROMPTS.md i supabase-setup.sql iz ovog paketa. Claude Code pokrećeš IZ tog foldera (cd ~/Desktop/lakat pa claude).

2. **Supabase projekt**:
   - supabase.com > New project (regija: EU, npr. Frankfurt)
   - SQL Editor > zalijepi cijeli supabase-setup.sql > Run
   - Authentication > Providers > Email: UKLJUČI, a "Confirm email" ISKLJUČI (za privatnu foru ne treba, samo komplicira registraciju ekipi)
   - Settings > API: kopiraj Project URL i anon key

3. **Env varijable**: kad Claude Code u fazi 1 napravi .env.local.example, kopiraj ga u .env.local i upiši:
   - NEXT_PUBLIC_SUPABASE_URL = tvoj project URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY = anon key
   - GROUP_PASSWORD = šifra koju daš ekipi (npr. srebreno23)

4. **Model i mod**: u Claude Codeu /model pa odaberi Fable 5. Prije svake faze Shift+Tab dvaput za Plan Mode, pregledaj plan, tek onda odobri.

5. **Skillovi**: prije faze 1 pokreni /plugins ili provjeri ~/.claude/skills. Ako "ui ux pro max" i "frontend design superpowers" NISU instalirani, ta imena u promptu ne rade ništa. CLAUDE.md već govori Claudeu da koristi frontend/design skillove ako postoje, pa ne moraš ništa dodatno pisati.

## Tijekom izrade

- Jedna faza po sessionu, redom iz PROMPTS.md
- Nakon svake faze odradi ručni test naveden ispod prompta
- Nakon svake faze reci Claudeu da označi fazu u CLAUDE.md checklisti
- Git commit nakon svake uspješne faze (Claude Code to može sam, samo traži)

## Deploy (nakon faze 2 ili 3, ne čekaj kraj)

1. Novi repo na GitHubu, push
2. Vercel > Import repo
3. U Vercel Environment Variables upiši SVE iz .env.local (GROUP_PASSWORD posebno, bez njega registracija ne radi na produkciji)
4. Za fazu 5 dodaš i VAPID ključeve (Claude Code će ti generirati komandu za njih)
5. Domena: Vercel > Settings > Domains > dodaj laktarenje.com. Kod registrara postavi A record 76.76.21.21 za root i CNAME cname.vercel-dns.com za www. SSL Vercel sredi sam.
6. Supabase > Authentication > URL Configuration: Site URL = https://laktarenje.com, dodaj je i u Redirect URLs. Bez ovoga auth puca na produkciji.
7. Nakon faze 4: uslikaj iOS korake instalacije na svom iPhoneu (3 screenshota) i Android na nečijem mobitelu, ubaci u /public/upute/ (imena fajlova su u PROMPTS.md, faza 4)

## Bitno da znaš unaprijed

- Push notifikacije na iPhoneu rade SAMO ako je aplikacija dodana na home screen (iOS 16.4+). Zato je faza 4 prije faze 5.
- Realtime na Supabase free tieru ima limit od 200 istovremenih konekcija, za vašu ekipu nebitno.
- Supabase free tier pauzira projekt nakon tjedan dana neaktivnosti. Ako ekipa koristi aplikaciju, neće se dogoditi. Ako se dogodi, resume je jedan klik u dashboardu.
