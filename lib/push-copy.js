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

export function fomoPushBody(count) {
  return pick([
    `Šank se puni (${count} ih je). Di si ti?`,
    `${count} ljudi je tamo, a tebe nema. Klasika.`,
    `Ekipa je navalila (${count} ih je). Ti kao obično kasniš.`,
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

// Otimanje mjesta na mapi — gubitnicima (grupa koja je držala mjesto)
export function mjestoOtetoPushBody(osvajac) {
  return pick([
    `⚑ ${osvajac} vam je upravo oteo mjesto na mapi. Vraćajte ga rundama.`,
    `⚑ ${osvajac} vam je uzeo teritorij. Ovo se ne oprašta — na mapu pa van.`,
    `⚑ Izgubili ste mjesto na mapi — uzeo ga ${osvajac}. Sram vas bilo, branite svoje.`,
  ]);
}

// Osvajačima — i kad je mjesto bilo ničije i kad je oteto
export function mjestoOsvojenoPushBody(prijasnji) {
  if (!prijasnji) {
    return pick([
      `⚑ Osvojili ste mjesto na mapi! Vaše je — dok ga netko ne uzme.`,
      `⚑ Nova zastava na mapi — mjesto je vaše. Držite ga rundama.`,
    ]);
  }
  return pick([
    `⚑ Oteli ste mjesto ekipi ${prijasnji}! Mapa pamti pobjednike.`,
    `⚑ ${prijasnji} je upravo ostao bez mjesta — uzeli ste ga vi. Bravo, pjanci.`,
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

export function praznaSankPushBody() {
  return pick([
    "21 je sati, a šank zjapi prazan. Sram vas bilo, pičke.",
    "Šank prazan, ekipa u bijegu. Jadno.",
    "21h, tišina za šankom. Ovo je tužno, ljudi.",
  ]);
}

export function streakVisiPushBody(streak) {
  return pick([
    `Streak od ${streak} dana ti visi o koncu. Miči guzicu za šank.`,
    `${streak} dana truda ide u kurac ako večeras ne dođeš.`,
    `Još par sati pa ti ${streak}-dnevni streak puca. Kreni.`,
  ]);
}

// Grupni streak visi — ide CIJELOJ grupi, max 1× (isti cron kao streakVisi)
export function grupniStreakVisiPushBody(streak) {
  return pick([
    `🔥 Streak ekipe (${streak} dana) umire večeras. Nitko još nije izašao. Sramota, ekipo.`,
    `🔥 ${streak} dana zaredom je netko bio vani — večeras nitko?! Spašavajte streak.`,
    `🔥 Grupni streak od ${streak} dana visi o koncu. Jedan od vas mora van. Ždrijebajte.`,
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
