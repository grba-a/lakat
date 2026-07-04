# LAKAT — Prompti po fazama

Pravila: jedna faza po sessionu. Prije svake faze uključi Plan Mode (Shift+Tab dvaput),
pregledaj plan, tek onda odobri izvršavanje. Kopiraj prompt doslovno.

---

## FAZA 1 — Setup + Auth

```
Pročitaj CLAUDE.md.

Izradi novi Next.js projekt (App Router, JavaScript, Tailwind) za aplikaciju Lakat, u ovom folderu.

Napravi samo:
1. Inicijalizaciju projekta s Tailwindom (create-next-app, bez TypeScripta, bez src foldera po tvom izboru samo budi konzistentan)
2. Supabase klijente (@supabase/supabase-js + @supabase/ssr): browser klijent, server klijent, middleware helper
3. .env.local.example s NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GROUP_PASSWORD
4. Stranice /login i /register. Registracija: email, lozinka, username, šifra grupe. Šifra se provjerava server-side (server action) protiv process.env.GROUP_PASSWORD PRIJE poziva supabase.auth.signUp. Nakon uspješnog signupa upiši red u profiles (id, username). Ako je username zauzet, jasna poruka greške.
5. Middleware: neulogirani idu na /login, ulogirani s /login i /register na /
6. Logout gumb (server action)

Dizajn: tamna pozadina, mobile first, minimalno. Copy na hrvatskom, zajebantski ton.
Ne diraj ništa drugo.
```

Ručni test: registracija s krivom šifrom (mora pasti), s dobrom (mora proći),
duplikat username, login, logout, redirect na /login kad nisi ulogiran.

---

## FAZA 2 — Glavni ekran + Realtime

```
Pročitaj CLAUDE.md. Faza 1 je gotova.

Napravi glavni ekran (/):
1. Ogroman gumb "TU SAM" na vrhu. Klik = insert u checkins za trenutnog korisnika. Ako je korisnik već prisutan danas (checkin nakon zadnjih 06:00 Europe/Zagreb), gumb je disabled i piše "TU SI, LEGENDO".
2. Ispod popis SVIH korisnika iz profiles. Prisutni (checkin nakon zadnjih 06:00): zeleni, oznaka "PRISUTAN", sortirani na vrh po vremenu dolaska. Ostali: zamagljeni/opacity, sivi.
3. Supabase Realtime subscription na INSERT u checkins: popis se osvježava live bez refresha, i gumb se sam disable-a ako sam ja taj koji je kliknuo na drugom uređaju.
4. Logika "zadnjih 06:00" izračunata u jednom utility fajlu (getCurrentDayStart), koristi Europe/Zagreb. Prije 06:00 dan počinje jučer u 06:00.
5. Spriječi dupli checkin u istom danu i na serveru (provjera u server actionu prije inserta), ne samo disabled gumbom.

Ne diraj ništa drugo.
```

Ručni test: dva browsera/dva računa, klik na jednom se vidi na drugom bez refresha.
Dupli klik ne stvara dupli checkin. Nakon 06:00 svi se resetiraju u sivo.

---

## FAZA 3 — Hall of Shame + Profil

```
Pročitaj CLAUDE.md. Faze 1 i 2 su gotove.

Napravi:
1. /shame — Hall of Shame:
   - Tekući mjesec: rangiraj sve korisnike po postotku dolazaka (broj dana s checkinom / broj mogućih dana od registracije ili početka mjeseca, što je kasnije). Najgori je na vrhu s velikim naslovom "PIČKA MJESECA (ZASAD)". Izjednačeni dijele titulu.
   - Dan = 06:00 do 06:00, maksimalno jedan checkin po danu se broji.
   - Arhiva: za svaki prošli mjesec od pokretanja izračunaj i prikaži pičku mjeseca. Sve on-the-fly iz checkins tablice, bez nove tablice i bez crona.
2. /profil — vlastita statistika: ukupan broj dolazaka, postotak od registracije, trenutni streak (uzastopni dani), najduži streak.
3. Donji navigacijski bar (mobile): Šank (/), Sram (/shame), Ja (/profil).

Ne diraj ništa drugo.
```

Ručni test: ubaci testne checkinove kroz Supabase Table Editor s raznim datumima,
provjeri da se postoci i streak dobro računaju, pogotovo oko granice 06:00 i oko registracije sredinom mjeseca.

---

## FAZA 4 — PWA

```
Pročitaj CLAUDE.md. Faze 1-3 su gotove.

Pretvori aplikaciju u PWA:
1. manifest.json: name "Lakat", short_name "Lakat", display standalone, tamna theme_color i background_color, start_url /
2. Ikone 192x192 i 512x512 (generiraj jednostavnu ikonu: lakat ili šaka na tamnoj pozadini, može i SVG pretvoren u PNG)
3. Minimalni service worker dovoljan za instalabilnost (registriraj ga u layoutu). Bez agresivnog cachanja, network-first, da korisnici ne gledaju stale podatke.
4. Na glavnom ekranu diskretna poruka za korisnike koji NISU u standalone modu: "Dodaj na početni zaslon za notifikacije", linka na /upute. Detektiraj standalone preko display-mode media querya.
5. Stranica /upute: koraci za dodavanje na početni zaslon, iOS i Android odvojeno (tabovi ili sekcije). Svaki korak ima kratki tekst i sliku koja se učitava iz /public/upute/ (ios-1.png, ios-2.png, ios-3.png, android-1.png, android-2.png). Slike još ne postoje, stavi vidljiv placeholder dok ih ne ubacim. Naglasi da bez instalacije na iPhoneu NEMA notifikacija.

Ne diraj ništa drugo.
```

Ručni test: deploy na Vercel, otvori na mobitelu, dodaj na home screen,
mora se otvarati bez browser UI-a (standalone). /upute se otvara i placeholderi su vidljivi.

Nakon deploya: uslikaj na svom iPhoneu 3 koraka (Safari sa Share gumbom na laktarenje.com,
Share meni s Add to Home Screen, home screen s ikonom Lakta), kropaj i ubaci u /public/upute/.
Android verziju uslikaj na nečijem Androidu iz ekipe.

---

## FAZA 5 — Push notifikacije

```
Pročitaj CLAUDE.md. Faze 1-4 su gotove.

Implementiraj Web Push notifikacije:
1. Instaliraj web-push paket. VAPID ključevi iz env varijabli (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY).
2. Na /profil gumb "Uključi obavijesti": traži Notification permission, napravi pushManager.subscribe, spremi subscription u push_subscriptions tablicu (server action). I gumb za isključivanje (unsubscribe + brisanje reda).
3. Kad korisnik napravi checkin, server action nakon inserta pošalje push SVIM ostalim korisnicima koji imaju subscription: naslov "LAKAT", tekst "{username} je za šankom. Miči guzicu."
4. Service worker: push event handler koji prikazuje notifikaciju, notificationclick otvara aplikaciju.
5. Obriši mrtve subscriptione (410/404 response od push servisa) iz baze.

Ne diraj ništa drugo.
```

Ručni test: dva mobitela s instaliranom PWA, oba uključe obavijesti,
jedan klikne TU SAM, drugi dobije notifikaciju. Na iPhoneu radi SAMO iz instalirane PWA (iOS 16.4+).
