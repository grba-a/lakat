// Rotirajuće varijante push copyja — svaki poziv nasumično bira jednu,
// da tekst ne bude uvijek identičan.

function pick(variants) {
  return variants[Math.floor(Math.random() * variants.length)];
}

export function checkinPushBody(ime) {
  return pick([
    `${ime} je za šankom. Miči guzicu.`,
    `${ime} sjeda za šank. Gdje si ti, kod kuće ko fol?`,
    `${ime} je stigao. Netko će opet piti sam.`,
    `${ime} je za šankom, a ti skrolaš mobitel. Sramota.`,
  ]);
}

// Ne-prva runda dana — šalje se uz cooldown po autoru (45 min), da svaka
// nova slika javi grupi bez notifikacijskog vodopada
export function rundaPushBody(ime) {
  return pick([
    `${ime} je ubacio novu rundu. Šank živi.`,
    `Nova runda od ${ime}. Večer se zahuktava.`,
    `${ime} nastavlja di je stao. Nova slika, novo piće.`,
    `${ime} opet naručuje, a ti opet skrolaš. Klasika.`,
  ]);
}

// FOMO 3.0 — primatelju kad mu je vani 3+ frendova, a njega nema
export function fomoPushBody(count) {
  return pick([
    `${count} tvojih pajdaša je vani, a ti doma. Klasika.`,
    `Vani ti je ${count} pajdaša. Di si ti?`,
    `Ekipa je navalila (${count} ih je vani). Ti kao obično kasniš.`,
    `${count} ${count === 1 ? "pjanac" : count % 100 >= 2 && count % 100 <= 4 ? "pjanca" : "pjanaca"} te čeka. Al ajde, ne moraš baš odmah.`,
  ]);
}

// Ide SAMO meti najave (onome kod koga se stiže), ne cijeloj grupi
export function najavaTargetPushBody(ime) {
  return pick([
    `${ime} stiže kod tebe. Naruči mu piće.`,
    `${ime} kreće prema tebi. (Laže, kasnit će pola sata, klasika.)`,
    `${ime} tvrdi da ti stiže za šank. Klađenje je otvoreno.`,
  ]);
}

// Poziv na laktanje (saziv) — ide cijeloj grupi; kad je null znači ODMAH
export function sazivPushBody(ime, mjesto, kad) {
  if (!kad) {
    return pick([
      `📣 ${ime} zove na laktanje — ${mjesto}, ODMAH. Ostavi sve.`,
      `📣 ${ime} zove: ${mjesto}, sad. Tko ne dođe, časti.`,
      `📣 ${ime} je digao uzbunu — ${mjesto}. Kreći.`,
    ]);
  }
  return pick([
    `📣 ${ime} zove na laktanje — ${mjesto} u ${kad}. Javi se.`,
    `📣 ${ime} zove: ${mjesto}, ${kad}. Stižeš ili ne?`,
    `📣 ${ime} skuplja narod za ${kad} — ${mjesto}. Bez izmotavanja.`,
  ]);
}

// Zajednički kadar — "laktaju skupa", ide grupi BEZ tagiranih
export function kadarPushBody(imena) {
  const lista =
    imena.length > 2
      ? `${imena.slice(0, -1).join(", ")} i ${imena[imena.length - 1]}`
      : imena.join(" i ");
  return pick([
    `👥 ${lista} laktaju skupa. A di ste vi?`,
    `👥 ${lista} su se našli bez vas. Bole li uši?`,
    `👥 ${lista} laktaju, a vi skrolate. Klasika.`,
  ]);
}

export function streakVisiPushBody(streak) {
  return pick([
    `Streak od ${streak} dana ti visi o koncu. Miči guzicu za šank.`,
    `${streak} dana truda ide u kurac ako večeras ne dođeš.`,
    `Još par sati pa ti ${streak}-dnevni streak puca. Kreni.`,
  ]);
}

// Šalje se SAMO na točno deseto piće večeri — rijedak event, da pushevi
// ne gnjave (odluka korisnika: nizak volumen notifikacija)
export function drinkMilestonePushBody(ime) {
  return pick([
    `${ime} je na desetom piću. Ovo više nije večer, ovo je karijera.`,
    `Deseto piće za ${ime}. Zovite mu nekoga, bilo koga.`,
    `${ime}: 10 pića. Šank vodi 10:0 protiv njegove jetre.`,
  ]);
}

export function truncate(text, max = 60) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function commentPushBody(ime, text) {
  return `${ime} je komentirao: '${truncate(text)}'`;
}
