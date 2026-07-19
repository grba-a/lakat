# LAKAT — Svi tekstovi aplikacije

> Generirano 2026-07-18 iz stanja koda na `main` (Batch 2.1 live).
> Prvi dio: sve push notifikacije (s okidačima i primateljima). Drugi dio: svi tekstovi u appu, po ekranima.

---

## 1. PUSH NOTIFIKACIJE

Sve pushevi imaju naslov **"LAKAT"** (iz `lib/push.js`). Tko je u 2+ grupa dobiva prefiks `[Ime grupe]` ispred teksta. Kopije se rotiraju nasumično (svaki push izvuče jednu varijantu). Izvor: `lib/push-copy.js`.

### 1.1. Check-in — prva runda dana (`checkinPushBody`)
**Okidač:** prva slika/runda dana nekog člana. **Prima:** cijela grupa osim pošiljatelja.
- `{ime} je za šankom. Miči guzicu.`
- `{ime} sjeda za šank. Gdje si ti, kod kuće ko fol?`
- `{ime} je stigao. Netko će opet piti sam.`
- `{ime} je za šankom, a ti skrolaš mobitel. Sramota.`

### 1.2. FOMO (`fomoPushBody`)
**Okidač:** kad TREĆI različiti član dođe isti dan (1× dnevno po grupi). **Prima:** oni koji NISU došli.
- `Šank se puni ({n} ih je). Di si ti?`
- `{n} ljudi je tamo, a tebe nema. Klasika.`
- `Ekipa je navalila ({n} ih je). Ti kao obično kasniš.`
- `{n} pjanac/pjanca/pjanaca te čeka. Al ajde, ne moraš baš odmah.`

### 1.3. Stižem — najava dolaska (`najavaTargetPushBody`)
**Okidač:** klik "👉 Stižem" na kartici prisutnog. **Prima:** SAMO meta (kod koga se stiže).
- `{ime} stiže kod tebe. Naruči mu piće.`
- `{ime} kreće prema tebi. (Laže, kasnit će pola sata, klasika.)`
- `{ime} tvrdi da ti stiže za šank. Klađenje je otvoreno.`

### 1.4. Poziv na laktanje / saziv (`sazivPushBody`)
**Okidač:** netko digne saziv ("Zovi narod"). **Prima:** cijela grupa osim kreatora.

Kad je ODMAH (manje od 10 min do termina):
- `📣 {ime} zove na laktanje — {mjesto}, ODMAH. Ostavi sve.`
- `📣 {ime} zove: {mjesto}, sad. Tko ne dođe, časti.`
- `📣 {ime} je digao uzbunu — {mjesto}. Kreći.`

Kad je s terminom:
- `📣 {ime} zove na laktanje — {mjesto} u {HH:mm}. Javi se.`
- `📣 {ime} zove: {mjesto}, {HH:mm}. Stižeš ili ne?`
- `📣 {ime} skuplja narod za {HH:mm} — {mjesto}. Bez izmotavanja.`

*(Odaziv na saziv NE šalje push — samo realtime.)*

### 1.5. Otimanje mjesta — gubitnici (`mjestoOtetoPushBody`)
**Okidač:** runda s koordinatama promijeni vlasnika grid ćelije na mapi. **Prima:** grupa koja je DRŽALA mjesto.
- `⚑ {osvajač} vam je upravo oteo mjesto na mapi. Vraćajte ga rundama.`
- `⚑ {osvajač} vam je uzeo teritorij. Ovo se ne oprašta — na mapu pa van.`
- `⚑ Izgubili ste mjesto na mapi — uzeo ga {osvajač}. Sram vas bilo, branite svoje.`

### 1.6. Otimanje mjesta — osvajači (`mjestoOsvojenoPushBody`)
**Prima:** grupa koja je osvojila mjesto.

Mjesto je bilo ničije:
- `⚑ Osvojili ste mjesto na mapi! Vaše je — dok ga netko ne uzme.`
- `⚑ Nova zastava na mapi — mjesto je vaše. Držite ga rundama.`

Mjesto je oteto drugoj ekipi:
- `⚑ Oteli ste mjesto ekipi {prijašnji}! Mapa pamti pobjednike.`
- `⚑ {prijašnji} je upravo ostao bez mjesta — uzeli ste ga vi. Bravo, pjanci.`

### 1.7. Zajednički kadar (`kadarPushBody`)
**Okidač:** prva kadar slika dana u grupi (max 1 kadar push dnevno; kod prve runde dana zamjenjuje checkin kopiju). **Prima:** grupa BEZ tagiranih.
- `👥 {X i Y} laktaju skupa. A di ste vi?`
- `👥 {X i Y} su se našli bez vas. Bole li uši?`
- `👥 {X i Y} laktaju, a vi skrolate. Klasika.`

*(Više imena se spaja: "A, B i C".)*

### 1.8. Prazan šank — cron (`praznaSankPushBody`)
**Okidač:** cron u 21h (ljeti; `prazan-sank`), grupa u kojoj danas NITKO nije došao. **Prima:** cijela grupa.
- `21 je sati, a šank zjapi prazan. Sram vas bilo, pičke.`
- `Šank prazan, ekipa u bijegu. Jadno.`
- `21h, tišina za šankom. Ovo je tužno, ljudi.`

### 1.9. Streak visi — osobni, cron (`streakVisiPushBody`)
**Okidač:** cron u 20h (`streak-visi`), streak ≥ 3 i danas još nisi došao. **Prima:** pojedinac (max 1 push, najveći streak preko svih grupa).
- `Streak od {n} dana ti visi o koncu. Miči guzicu za šank.`
- `{n} dana truda ide u kurac ako večeras ne dođeš.`
- `Još par sati pa ti {n}-dnevni streak puca. Kreni.`

### 1.10. Grupni streak visi — cron (`grupniStreakVisiPushBody`)
**Okidač:** isti cron; grupni streak ≥ 3 i danas još NITKO iz grupe nije izašao. **Prima:** cijela grupa.
- `🔥 Streak ekipe ({n} dana) umire večeras. Nitko još nije izašao. Sramota, ekipo.`
- `🔥 {n} dana zaredom je netko bio vani — večeras nitko?! Spašavajte streak.`
- `🔥 Grupni streak od {n} dana visi o koncu. Jedan od vas mora van. Ždrijebajte.`

### 1.11. Deseto piće (`drinkMilestonePushBody`)
**Okidač:** TOČNO deseto logirano piće u večeri. **Prima:** grupa osim pošiljatelja.
- `{ime} je na desetom piću. Ovo više nije večer, ovo je karijera.`
- `Deseto piće za {ime}. Zovite mu nekoga, bilo koga.`
- `{ime}: 10 pića. Šank vodi 10:0 protiv njegove jetre.`

### 1.12. Komentar (`commentPushBody`)
**Okidač:** komentar na tuđu sliku. **Prima:** SAMO vlasnik slike.
- `{ime} je komentirao: '{tekst, max 60 znakova…}'`

### 1.13. Pajdaši — friend zahtjev (hardkodirano u `frendovi/actions.js`)
**Prima:** primatelj zahtjeva.
- `{ime} te želi za pajdaša. Sumnjivo.`

### 1.14. Poziv u grupu (hardkodirano u `frendovi/actions.js`)
**Prima:** pozvani frend.
- `{ime} te zove u grupu "{naziv}".`

### 1.15. Service worker fallback (`public/sw.js`)
Kad push stigne bez teksta:
- naslov: `LAKAT`, body: `Nešto se događa za šankom.`

---

## 2. TEKSTOVI PO EKRANIMA

### 2.1. Landing — `/welcome`
- Wordmark: **Lakat.**
- Hero: **Tko je večeras za šankom?** / `Vidi ekipu uživo. A tko najmanje dolazi... e, to se zna.`
- CTA: **Otvori račun** · `Već imaš račun? Prijavi se.`
- Sekcija **Što je ovo**: `Lakat je aplikacija za tvoju ekipu. Kad si vani za šankom, stisneš TU SAM i svi uživo vide da si tu. Bez grupnih poruka, bez „di ste ljudi“ — samo otvoriš i vidiš tko je gdje.` / `A pošto se sve broji, na kraju mjeseca se točno zna tko je legenda, a tko se skrivao doma.`
  - ⚠️ **NAPOMENA:** spominje "TU SAM" gumb koji više ne postoji (zamijenjen zelenim plusom) — kandidat za update.
- Sekcija **Kako radi**:
  1. **Otvori račun** — `Email, lozinka, username. 30 sekundi i gotovo.`
  2. **Uđi u BETA** — `Na Šanku stisni gumb Uđi u BETA. Javna grupa, bez šifre.`
  3. **Dođi za šank** — `Kad si vani, stisni TU SAM. Ekipa te vidi uživo.` ⚠️ (isti zastarjeli "TU SAM")
- Sekcija **Imaš svoju ekipu?**: **Osnuj grupu.** / `Ti si taj koji uvijek piše „di ste"? Osnuj grupu za svoju ekipu, pozovi ih jednim linkom i vodite svoju ekipu do vrha lige.` / gumb **Osnuj grupu za ekipu**
- Sekcija **Što dobiješ** (kartice):
  - **Uživo za šankom** — `Tko je vani baš sad — bez pisanja po grupama.`
  - **Liga ekipa** — `Tvoja ekipa protiv drugih. Tko se više druži, taj vodi.`
  - **Mapa** — `Gdje je ekipa danas pila, na karti.`
  - **Pajdaši** — `Dodaj ekipu, vidi tko je online, zovi ih u grupu.`
  - **Slike dana** — `Slikaj dokaz da si stvarno vani. Ekipa reagira.`
  - **Streak** — `Nižeš dolaske, gradiš streak. Ne prekidaj ga.`
- Završni CTA: **Ekipa te čeka.** / `Otvori račun, uđi u BETA, dođi za šank.` / gumb **Ajmo** / `Nakon prijave dodaj Lakat na home screen za notifikacije.`
- Footer: `laktarenje.com`

### 2.2. Login — `/login`
- **Lakat.** / `Šank te čeka. Ekipa broji.`
- Polja: Email, Lozinka
- Gumb: **Pusti me unutra** (pending: `Malo strpljenja...`)
- `Zaboravio si lozinku?`
- `Nemaš račun? Registriraj se, pičko.`
- Greške (actions): `Fali email ili lozinka. Ajde ispočetka.` · `Kriva kombinacija. Otrijezni se pa probaj opet.`

### 2.3. Registracija — `/register`
- **Novi u ekipi?** / `Otvori račun, grupu biraš unutra.`
- Polja: Email, Lozinka, Username (placeholder: `kako te ekipa zove`)
- Gumb: **Otvori račun** (pending: `Malo strpljenja...`)
- `Već si registriran? Prijavi se.`
- Greške: `Popuni sva polja, nije ovo raketna znanost.` · `Username mora imati između 2 i 24 znaka.` · `Lozinka mora imati bar 6 znakova. Znam da je teško.` · `Taj email je već registriran. Probaj se prijaviti.` · `Registracija nije prošla: {...}` · `Račun je tu, ali prijava nije prošla sama od sebe. Probaj se prijaviti.` · `"{username}" je već zauzet. Smisli nešto originalnije.` · `Profil se nije spremio: {...}`

### 2.4. Zaboravljena lozinka — `/zaboravio-lozinku`
- **Lakat.** / `Zaboravio si lozinku? Klasika.`
- Gumb: **Pošalji mi link**
- Uspjeh: `Ako taj email postoji, stigao mu je link za novu lozinku. Provjeri i spam, znaš kakvi su.`
- Greška: `Upiši email. Bez toga ne ide.`
- `Sjetio si se? Prijavi se.`

### 2.5. Reset lozinke — `/reset-lozinka`
- **Lakat.** / `Nova lozinka. Ovaj put je zapamti.`
- `Provjeravam link iz maila...`
- Polja: Nova lozinka, Ponovi lozinku · gumb **Spremi lozinku**
- Greške: `Lozinka mora imati bar 6 znakova.` · `Lozinke se ne poklapaju. Otrijezni se pa probaj opet.` · `Nije prošlo: {...}`

### 2.6. Lockdown — `/uskoro`
- **Lakat.** / **Veliki update dolazi.**
- `Šank je na renovaciji. Strpi se, pjanče — vraćamo se jači, pjaniji i ljepši.`
- `Radovi u tijeku` · link `Prijavi se`

### 2.7. Šank — `/` (glavni ekran)

**Bez grupe:**
- **Prvo uđi u grupu** / `Bez ekipe nema šanka.`
- **Nisi u grupi** / `Da vidiš tko je za šankom i da sjedneš za šank, uđi u grupu.`
- Gumb **Uđi u BETA** / `Javna grupa. Bez šifre, samo uleti.`
- Gumbi: **Druga grupa** · **Osnuj novu** · **Upadam** · **Osnivam grupu**
- Šifra hint: `Ne znaš je? Pitaj ekipu.` · `Nju daješ ekipi da upadne. Nemoj 1234, molim te.` · placeholderi: `kako se grupa zove`, `npr. ime kafane`

**"Što je novo" kartica (LAKAT 2.0, gasi se 19.7. u 06:00):**
- `LAKAT 2.0` / **Veliki update.** / `Sram je mrtav. Živjela liga.`
- 📣 **Dižem ekipu** — `digni saziv, svi dobiju push, javljaju se stižu li.`
- 🏆 **Liga ekipa** — `vaša grupa protiv drugih, svaki tjedan. Sram tab je sad Liga.`
- 🎯 **Izazov tjedna** — `novi svaki ponedjeljak, vrijedi +10 bodova.`
- 👥 **Zajednički kadar** — `slika s ekipom nosi +4. Označi tko je s tobom.`
- ↗ **Podijeli** — `svaka slika postaje story kartica za Instagram.`
- ⚑ **Naša mjesta** — `ekipa s najviše rundi drži lokaciju na mapi.`
- Footer: `I da — ovo je tek početak, još noviteta uskoro stiže. Čekali ste tri dana? Nije nam žao. Isplatilo se.`

**Liga widget:** `🏆 {n}. u ligi · {n} bodova` + `🔥 {streak}`

**Poziv na laktanje (saziv kartica):**
- Sklopljeni gumb: **📣 Poziv na laktanje** / `Digni sve odjednom. Mjesto, vrijeme, gotovo.`
- Forma: `Gdje?` (placeholder: `Club23, plaža, kod mene...`) · `Kad?` · gumbi **Sad** / **U...** · **Zovi narod 📣** · **Odustani**
- Živi saziv: `📣 {ime} zove na laktanje` / mjesto / `SADA` ili `u {HH:mm} · za {X}min`
- Gumb kreatora: **Spusti**
- Odazivi: `✓ {n} stiže/stižu` · `✗ {n} ne može. Izlike, izlike.`
- Gumbi: **✓ Stižem** · **✗ Ne mogu**

**Izazov tjedna kartica:** `🎯 Izazov tjedna · +10 u ligi` / `{naziv} — {opis}` / ✓ (aria: `Ispunjeno`)

**Hint za plus (kad nisi za šankom):**
- `Slikaj dokaz i sjedni za šank.` / `Stisni zeleni plus dolje. Nemoj se izgubiti. ↓`

**Popis "Za šankom":**
- Naslov: `ZA ŠANKOM ({n})`
- `Grupa je ovaj mjesec sredila {n} piće/pića. Jetra plaču.`
- Prazno: `Nitko još nije sjeo. Najave su jeftine.` (kad netko stiže) · `Nikoga. Šank zjapi prazan, sram vas sve bilo.` (kad nitko)
- Kartica bez slike: `Slikaj nam gdje si smrade.`
- Badge: `🍺 {n}` · `👀 1 stiže / {n} stižu / {n} stiže`
- Gumb: **👉 Stižem**
- Kartica dolazećeg: `Stiže kod {ime}` · fallback `Stiže (navodno)`

**Slike dana:** naslov `SLIKE DANA`, badge `{n} 📸`, aria: `Slike dana: {ime} ({n})`

**Na današnji dan (flashbackovi):** naslov `Na današnji dan 📅` · labele: `prije 3 mjeseca` · `prije pola godine` · `prije godinu dana`

**Wrapped banner (kraj/početak mjeseca):** **Tvoj mjesec je spreman.** / `Pogledaj štetu.`

**Install hint:** `Dodaj Lakat na početni zaslon za notifikacije. Kako? Stisni tu. →`

### 2.8. Runda flow (plus → kamera → editor → kolo)

**Photo editor:**
- `Dokaz. Povuci tekst gore-dolje.` / `Dokaz s porukom. Povuci tekst gore-dolje.`
- Input placeholder: `Napiši nešto (ili nemoj)`
- Gumbi: **Objavi** · **Ponovi** · **Odustani**

**Kadar picker:**
- `Tko je s tobom u kadru? 👥` / `Zajednički kadar nosi +4 boda u ligi. Označi pa objavi.`
- Gumb: **Objavi ({n} u kadru) 👥** ili **Sam sam na slici, objavi**

**Bez slike (dialog):**
- `Slikaj nam gdje si smrade.` / `Bez slike nema dokaza da si stvarno za šankom.`
- Gumbi: **Ajde, slikam** · **Nemam sliku**

**Omnitrix kolo pića:**
- Naslov: **Šta piješ?**
- Gumb: **Potvrdi {piće}** (pending: `Sekunda...`)
- Hint: `Zavrti, nišani, potvrdi.`
- X aria: `Preskoči piće`
- Pića: 🍺 Piva · 🥂 Gemišt · ☕ Kava · ⚡ Rakija · 🍹 Koktel · 🥃 Viski · 🍸 Gin · 🧊 Vodka · 🌿 Pelin · 💧 Voda

**Toastovi:**
- `Objavljujem...`
- `Zapisano: {emoji} {piće}` + gumb **↩ Krivi tap**
- Upload greška: `Slika nije prošla. Probaj opet ili uđi bez dokaza ko pička.`

**Bedž toast:** `Otključao si bedž` / `{naziv}` / `{opis}`

**Greške akcija (checkin/piće/najava/saziv):**
- `Nisi ni u jednoj grupi. Kako si uopće ovdje?` · `Nešto je puklo: {...}` · `Checkin nije prošao: {...}`
- `Kod koga točno stižeš?` · `Nisi ni u jednoj grupi. Kamo točno stižeš?` · `Već si za šankom, kamo točno stižeš?` · `Taj više nije za šankom. Zakasnio si.` · `Najava nije prošla: {...}`
- `To piće ne postoji, hakeru.` · `Nisi ni u jednoj grupi. Gdje točno piješ?` · `Prvo sjedni za šank, pa onda cugaj. Redoslijed, pička ti materina.` · `Polako, majstore. Ni Bukowski nije pio tako brzo.` (cooldown 45 s)
- Undo: `Nisi ni u jednoj grupi.` · `Nemaš što brisati. Trijezan ko sudac.`
- Saziv: `Gdje se dižete? Mjesto, majstore.` · `Kraće. Max 40 znakova, ne roman.` · `To vrijeme ne postoji.` · `To je prošlo. Vremeplov još ne radi.` · `Max 24 sata unaprijed. Ne planiramo godišnji.` · `Nisi ni u jednoj grupi. Koga točno dižeš?` · `Saziv već postoji. Odazovi se na njega.` · `Saziv nije prošao: {...}`
- Odaziv: `Stižeš ili ne stižeš. Trećeg nema.` · `Taj saziv ne postoji ili nije iz tvoje grupe.` · `Taj saziv je istekao. Prekasno, kao i obično.`
- Reakcije: `Taj emoji ne postoji u ponudi, hakeru.` · `Ta slika ne postoji ili nije iz tvoje grupe.` · `Nije prošlo: {...}`
- Komentari: `Prazan komentar? Ma daj.` · `Malo si se raspisao. Max 200 znakova.`
- Grupa switch: `Nisi u toj grupi. Lijepo probaj.` · `Prebacivanje nije prošlo: {...}`

**Lightbox (pregled slika):**
- Gumb: **Podijeli** (pending: `Sekunda...`)
- `Stisni bilo gdje za zatvoriti`
- Brojač: `{i}/{n}`

**Komentari:** `Učitavam komentare...` · placeholder `Komentiraj...` · aria: `Pošalji komentar`, `Obriši komentar`

### 2.9. Liga — `/liga`
- Naslov: **Liga.** / `Tjedan {d.m.} – {d.m.} · Koja ekipa se najviše druži?`
- Bez grupe: **Nisi u grupi.** / `Uđi u grupu pa se natječi s ekipom.` / gumb **Uđi u grupu**
- Prvak: `PRVAK PROŠLOG TJEDNA` / `🏆 {ime(na)}` / `{n} bodova. Skidamo kapu, dižemo čaše.`
- `OVAJ TJEDAN`
- Prazno: `Još nitko nije skupio nijedan bod. Tjedan je mlad, dižite ekipu.`
- Red: 🥇🥈🥉 / `{n}.` · `{ime} (mi)` · `{n} član/člana/članova · {n} aktivno · 🎯 izazov ✓` · `{n} bodova`
- Ispod tablice (ako si 4.+): `Vi ste {n}. — dovucite još ljudi u ekipu i preteknite ove iznad.`
- `KAKO SE BODUJE`:
  - `📸 Dolazak (runda sa slikom) — +2 po članu po danu`
  - `📣 Poziv ispoštovan — +1 povrh dolaska`
  - `👥 Zajednički kadar (2+ na slici) — +4 po danu`
  - `🎯 Izazov tjedna ispunjen — +10 (novi svaki ponedjeljak, piše na Šanku)`
- `Liga se resetira ponedjeljkom u 06:00. Više ljudi vani = više bodova. Matematika je jednostavna: druži se.`

**Izazovi tjedna (pool, `lib/izazovi.js`):**
- **Tri dana vani** — `Okupite se bar 3 različita dana ovaj tjedan.`
- **Puna kuća** — `Bar 4 člana vani u istom danu.`
- **Rana ptica** — `Jedna runda prije 18h. Da, dnevno svjetlo postoji.`
- **Noćna smjena** — `Runda poslije ponoći. Netko mora čuvati grad.`
- **Saziv koji pali** — `Jedan saziv okupi bar 3 člana. Diži ih!`
- **Vikend dupla** — `Vani i u subotu i u nedjelju. Bez milosti za jetru.`

### 2.10. Mapa — `/mapa`
- Naslov: **Gdje su?** / `Tko je danas bio za šankom i odakle.`
- Bez grupe: **Nisi u grupi.** / `Uđi u grupu da vidiš gdje ekipa pije.` / **Uđi u grupu**
- Loading: `Karta se diže...`
- Legenda mjesta: `⚑ Ekipa s najviše rundi na lokaciji (30 dana) drži to mjesto.` + `Vi držite {n}.` ili `Vi još ne držite ništa. Sramota.`
- Prazno: `Nitko se danas još nije javio s lokacijom. Karta zjapi prazna ko šank u ponedjeljak.`
- Lista: `{emoji} {ime} · za šankom od {HH:mm}`
- Popup markera: `{ime} — za šankom od {HH:mm}`
- Popup zastavice: `{grupa} drži ovo mjesto — {n} rundi u zadnjih 30 dana` · ničija: `Ničija zemlja — izjednačeno. Otmi mjesto s više rundi.` · label `⚔️ ničije`

### 2.11. Profil — `/profil`
- Ime + titula + `U ekipi od {datum}`
- Statistike: `dolazaka` · `dolaznost` · `streak sad` · `najduži streak`
- Komentar dolaznosti (`comment(pct)`):
  - ≥80%: `Praktički inventar kafane. Svaka čast.`
  - ≥50%: `Solidno. Šank te prepoznaje.`
  - ≥25%: `Mlako. Ekipa počinje zaboravljati kako izgledaš.`
  - <25%: `Sramota. Ekipa te vodi kao nestalu osobu.`
- **Pouzdanost** kartica:
  - Titula: **Kremen 💎** (≥80%) · **Pola-pola 🌗** (≥50%) · **Fantom 👻** (<50%) · `Još se mjeri...` (manje od 3 odaziva)
  - `Rekao si „stižem" {n} put(a), došao si {m} ({pct}%).`
  - Dodatci: ` Ocjena stiže nakon 3 odaziva.` · Fantom: ` Riječ ti ne vrijedi ni pola piva.` · Kremen: ` Riječ tvrđa od kamena.`
- **Pijanstvo**: `večeras` · `ovaj mjesec` · `ukupno` · `omiljeno piće`
- Komentar pića (`drinkComment`):
  - ≥100: `Jetra ti je službeno dala otkaz.`
  - ≥50: `Poluvrijeme, a već si legenda.`
  - >0: `Skromno, ali časno.`
  - 0: `Trijezan kao suza. Za sada.`
- Link: **Lakat Wrapped.**
- Heatmap: `ZADNJIH 12 TJEDANA` · `PO MJESECIMA`
- **Bedževi** (+ gumb `Vidi sve ({n})` / `Sakrij`)
- **Galerija**: prazno svoje: `Još nema slika. Slikaj se za šankom pa će ih biti.` · tuđe: `Još nema slika. Nije se slikao za šankom, sumnjivo.`
- Avatar: `Dodaj sliku` · `Sekunda...` · gumbi **Promijeni** / **Izbriši**
  - Greške: `Koji ti je to kurac od slike? Manju.` · `Slika se nije uploadala. Probaj neku manju, Spielbergu.` · `Brisanje nije prošlo. Slika te ne pušta.`

**Titule uz ime (`titleFor`, po streaku):**
- ≥30: **Vlasnik stolice** · ≥14: **Inventar** · ≥7: **Legenda tjedna** · ≥3: **U formi**

**Bedževi (`BADGE_DEFS`):**
| Bedž | Opis |
|---|---|
| Tjedan dana | 7 dana zaredom |
| Vlasnik stolice | 30 dana zaredom |
| Legenda | 100 dana zaredom |
| Stotka | 100 checkina ukupno |
| Godina dana | 365 dana u ekipi |
| Osnivač | Jedan od prvih 10 članova grupe |
| Zanimljiv | 10 reakcija primljeno |
| Popularan | 50 reakcija primljeno |
| Faca | 100 reakcija primljeno |
| Brbljavac | 20 komentara objavljeno |
| Usta na struju | 50 komentara objavljeno |
| Stotka piva | 100 pića ukupno |
| Cisterna | 500 pića ukupno |
| Noćna ptica *(skriven)* | Check-in između 3 i 4 ujutro |
| Prvi ikad *(skriven)* | Prvi checkin u povijesti grupe |
| Deseta rundo, evo mene *(skriven)* | 10 pića u jednoj večeri |

### 2.12. Tuđi profil — `/korisnik/[id]`
- Isto kao profil, ali komentar u trećem licu:
  - ≥80%: `Praktički inventar kafane. Svaka čast.`
  - ≥50%: `Solidno. Šank ga prepoznaje.`
  - ≥25%: `Mlako. Ekipa mu počinje zaboravljati lice.`
  - <25%: `Sramota. Ekipa ga vodi kao nestalu osobu.`
- Pouzdanost: `Rekao je „stižem" {n} puta, došao je {m} ({pct}%).`

### 2.13. Wrapped — `/profil/wrapped`
- Naslov: **Wrapped.** / `{mjesec godina}`
- Bez grupe: **Nisi u grupi.** / `Uđi u grupu da vidiš svoj mjesečni obračun.`
- Nisi postojao: **Nisi ni postojao taj mjesec.** / `Kasnije probaj s mjesecom u kojem si stvarno bio u ekipi.` / gumb **Natrag na profil**
- Kartica (canvas): `LAKAT.` / `{MJESEC}` / veliki broj + `DOLAZAKA` / `#{rank}` + `OD {n} U GRUPI "{IME}"` / `{n}` + `NAJDULJI STREAK U MJESECU` / `INVENTAR MJESECA 🏆` / `{USERNAME}` / `LAKTARENJE.COM`
- Loading: `Crtam štetu...`
- Gumbi: **Podijeli** · **Skini sliku**
- Share text: `Moj Lakat Wrapped.`

### 2.14. Postavke — `/profil/postavke`
- Naslov: **Postavke.** / `Račun, obavijesti i tvoje grupe.`
- **Obavijesti** (push toggle):
  - `Provjeravam...`
  - unsupported: `Ovaj browser ne podržava push. Na iPhoneu prvo dodaj Lakat na početni zaslon (vidi upute na Šanku) pa otvori odande.`
  - denied: `Blokirao si obavijesti u postavkama browsera. Sam si to napravio, sam i odblokiraj.`
  - on: `Javit će ti se kad netko sjedne za šank.`
  - off: `Da znaš čim netko sjedne za šank.`
  - Greške: `Subscribe nije prošao. Probaj opet.` · `Nije se dalo isključiti. Probaj opet.` · `Neispravan subscription.` · `Spremanje nije prošlo: {...}` · `Brisanje nije prošlo: {...}`
- **Račun**: **Promijeni ime** · **Promijeni lozinku** (pending: `Sekunda...`)
  - Ime — greške: `Upiši nešto, prazno ime nosi samo pička.` · `Username mora imati između 2 i 24 znaka.` · `"{ime}" je već zauzet. Smisli nešto originalnije.` · uspjeh: `Novo ime, ista pička.`
  - Lozinka — greške: `Popuni oba polja.` · `Lozinka mora imati bar 6 znakova. Znam da je teško.` · `Lozinke se ne poklapaju. Otrijezni se pa probaj opet.` · `To ti je ista lozinka, genije.` · uspjeh: `Promijenjeno. Nemoj je zaboraviti do sutra.`
- **Moje grupe**:
  - Kartica: `{ime}` / `Ti si gazda` ili `Član` · `{n} član/člana/članova`
  - Gumbi: **Podijeli link** (→ `Kopirano`) · **Napusti** (→ `Sigurno?`)
  - Share tekst: `Upadaj u grupu {ime} na Laktu. Šank te čeka.`
  - **Upravljaj grupom** (admin): `Invite link` / `Tko klikne, upada bez šifre.` · **Poništi link** (→ `Sigurno?`) · **Preimenuj** · **Promijeni šifru** · `Članovi ({n})` · **Daj admina** · **Izbaci** (→ `Sigurno?`)
  - 3 grupe: `Tri grupe su ti malo? Alkoholičaru.`
  - **Pridruži se grupi** · **Osnuj novu grupu**
- **Odjavi me** / `Odjava iz aplikacije. Šank te neće zaboraviti, bez brige.`

**Poruke grupnih akcija (`grupe-actions.js`):**
- joinBeta: `Upao si u betu. Dobrodošao u ludnicu.` · greške: `Beta grupa trenutno ne postoji. Javi ekipi.` · `Već si u beti, koliko si popio?`
- joinByInvite: `Upao si. Novi šank, ista jetra.` · greške: `Nema koda, nema ulaska.` · `Taj link više ne vrijedi. Traži ekipu novi.` · `Već si u toj grupi, koliko si popio?`
- regenerateInviteCode: `Stari link je mrtav. Podijeli novi.` · `Nije prošlo, probaj opet.`
- joinGroup: `Upao si. Novi šank, ista jetra.` · greške: `Naziv i šifra grupe. Oboje. Ajde.` · `Ta grupa ne postoji ili si fulao šifru. Otrijezni se.`
- createGroup: `Grupa osnovana. Ti si gazda, nemoj zajebat.` · greške: `Naziv grupe mora imati između 2 i 32 znaka.` · `Šifra grupe mora imati bar 4 znaka.` · `Šifre se ne poklapaju. Otrijezni se pa probaj opet.` · `Grupa "{ime}" već postoji. Pridruži joj se ili smisli drugo ime.`
- leaveGroup: `Pobjegao si iz grupe. Klasika.` · zadnji: `Otišao si, a grupa s tobom. Nitko je neće pamtiti.` · greške: `Nisi u toj grupi.` · `Ti si jedini admin. Predaj titulu nekome pa onda bježi.`
- renameGroup: `Novo ime, isti pjanci.` · `Grupa "{ime}" već postoji. Smisli drugo ime.`
- changeGroupPassword: `Nova šifra. Javi je samo onima koje podnosiš.`
- kickMember: `Izbačen. Neka pije doma.` · greške: `Sebe ne možeš izbaciti. Za to postoji Napusti grupu.` · `Taj nije u grupi. Već je pobjegao sam.`
- makeAdmin: `Sad ste dva gazde. Nemojte se pobiti.` · greške: `Već je admin. Dva gazde, jedan šank, može to.` · `Taj nije u grupi.`
- zajedničko: `Nisi admin ove grupe. Lijepo probaj.` · `Nisi član te grupe.`

### 2.15. Pajdaši — `/profil/frendovi`
- Naslov: **Pajdaši.**
- `MOJ KOD` + **Podijeli** (→ `Kopirano`) · share: `Dodaj me na Lakatu`
- `DODAJ PAJDAŠA` — input `KOD`, gumb **Dodaj**
- `POZIVI U GRUPU`: `{ime} te zove u {grupa}` · **Upadam** · **Odbij**
- `ZAHTJEVI`: **Prihvati** · **Odbij**
- `PAJDAŠI ({n})` — prazno: `Nemaš pajdaša. Tragično.`
- Red pajdaša: `Online sad` · `Viđen prije {n} min/h/d` · `Nikad aktivan` · gumbi **Zovi** / **Makni** (→ `Sigurno?`)
- InviteSheet: `ZOVI U GRUPU` · `Nisi ni u jednoj grupi.`
- Čekanje: `Čeka odgovor`
- Poruke akcija: `Zahtjev poslan.` · `Već te je zvao. Sad ste pajdaši.` · `Novi pajdaš. Čestitke, valjda.` · `Maknut. Sam si kriv.` · `Pozvan je.` · `Upao si. Nema šifre, ima pajdaša.`
- Greške: `Kod ima točno 6 znakova. Prepiši ponovno.` · `Nema tog koda. Provjeri jesi li dobro prepisao.` · `Sebe ne možeš dodati za pajdaša, koliko god htio.` · `Već ste pajdaši.` · `Zahtjev je već poslan, budi strpljiv.` · `Taj zahtjev ne postoji ili više nije aktualan.` · `To prijateljstvo ne postoji.` · `Taj ti nije pajdaš (još).` · `Već je u grupi.` · `Već je pozvan, čeka odgovor.` · `Taj poziv ne postoji ili više nije aktualan.` · `Tri grupe su ti malo? Alkoholičaru.`

### 2.16. Invite linkovi — `/f/[code]` i `/g/[code]`
- Friend: `{ime}.` / `Zove te za pajdaša.` / gumb **Pošalji zahtjev**
- Grupa: `ZOVU TE U GRUPU` / `{ime}.` / `{n} pjanac/pjanca/pjanaca te čeka za šankom.` / gumb **Uleti u grupu**

### 2.17. Upute — `/upute`
- Naslov: **Instaliraj.**
- `Na iPhoneu bez ovoga NEMA notifikacija. Nula. Apple tako kaže. Dvije minute posla, ajde.`
- **iPhone (Safari):**
  1. `Otvori Lakat u Safariju, otvori meni i stisni "Share".`
  2. `U meniju nađi i stisni "Add to Home Screen" (Dodaj na početni zaslon).`
  3. `Stisni "Add" i gotov si. Ikona Lakta ti je sad na home screenu — od sad otvaraj SAMO preko nje.`
- **Android (Chrome):**
  1. `Otvori Lakat u Chromeu, stisni tri točkice gore desno pa "Dodaj na početni zaslon" ili "Instaliraj aplikaciju".`
  2. `Potvrdi i gotov si. Vidiš kako je Android jednostavniji? Reci to svom Apple prijatelju.`

### 2.18. Sistemske stranice
- **404**: `404` / **Ovo mjesto ne postoji.** / `Ko ni tvoj streak. Nema tu ničega, vrati se za šank.` / gumb **Nazad na šank**
- **Error**: `Ups.` / **Nešto je puklo.** / `Nismo mi krivi. Vjerojatno. Probaj opet.` / gumb **Probaj opet**
- **Global error**: `Ups.` / **Nešto je puklo, i to ozbiljno.** / `Probaj ponovno učitati.` / **Probaj opet**
- **Offline banner** (u appu): `Nema neta. Šank te ne vidi.`
- **offline.html** (SW fallback): `Lakat` / `Nema neta, nema šanka.` / `Provjeri konekciju pa probaj opet.` / **Probaj opet**
- **Boot splash**: `Lakat.` (aria: `Učitavanje`)

### 2.19. PWA meta
- Ime: `Lakat` · Opis (manifest + metadata): `Diži ekipu, slikaj dokaz, vodi ligu. Uživo.`

---

## 3. BRZE NAPOMENE (uočeno pri izvlačenju)

1. **`/welcome` još spominje "TU SAM" gumb** (2 mjesta: "Što je ovo" i korak 3 "Kako radi") — taj gumb je zamijenjen zelenim plusom u Batchu prije 2.0. Kandidat za osvježavanje copyja.
2. Push toggle "on/off" opisi (`Javit će ti se kad netko sjedne za šank.`) su i dalje točni, ali pokrivaju samo checkin — pushevi sad idu i za sazive, ligu mjesta, streakove itd. Po želji se može proširiti opis.
3. Emoji pool na mapi (fallback markeri): 🍺 🍻 🥴 🍷 🥃 🤙 🦍 🔥 🍕 🚬
4. Reakcije na slike: 🔥 🤮 😂 🫡 🍺
