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
    `${count} pijanaca te čeka. Al ajde, ne moraš baš odmah.`,
  ]);
}

export function najavaPushBody(ime) {
  return pick([
    `${ime} kreće prema šanku. (Laže, kasnit će pola sata, klasika.)`,
    `${ime} je najavio dolazak. Provjerite za sat vremena je li istina.`,
    `${ime} tvrdi da stiže. Klađenje je otvoreno.`,
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

export function truncate(text, max = 60) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function commentPushBody(ime, text) {
  return `${ime} je komentirao: '${truncate(text)}'`;
}
