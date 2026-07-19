// Izazov tjedna 3.0 — OSOBAN: NEMA tablice ni crona, izazov se
// deterministički bira FNV-1a hashom (user_id + weekKey) iz poola,
// ispunjenje se detektira iz korisnikovih checkina tjedna (isti redovi
// koje rang ionako dohvaća). Bodovi: BOD_IZAZOV u lib/rang.js.

import { getDayKey } from "./day.js";

const hourFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  hourCycle: "h23",
});

function zagrebHour(iso) {
  const p = hourFmt.formatToParts(new Date(iso));
  return Number(p.find((x) => x.type === "hour")?.value ?? -1);
}

// 0=ned..6=sub za dayKey (lakat-dan: noć do 06:00 pripada jučer)
function weekday(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ctx: days (Set dayKey), rows (s izračunatim satom i kadar flagom) —
// SVE iz checkina jednog korisnika u tjednu
export const IZAZOVI = [
  {
    key: "tri_dana",
    label: "Tri dana vani",
    description: "Izađi bar 3 različita dana ovaj tjedan.",
    check: (ctx) => ctx.days.size >= 3,
  },
  {
    key: "rana_ptica",
    label: "Rana ptica",
    description: "Jedna runda prije 18h. Da, dnevno svjetlo postoji.",
    check: (ctx) => ctx.rows.some((r) => r.hour >= 6 && r.hour < 18),
  },
  {
    key: "nocna_smjena",
    label: "Noćna smjena",
    description: "Runda poslije ponoći. Netko mora čuvati grad.",
    check: (ctx) => ctx.rows.some((r) => r.hour < 6),
  },
  {
    key: "vikend_dupla",
    label: "Vikend dupla",
    description: "Vani i u subotu i u nedjelju. Bez milosti za jetru.",
    check: (ctx) => {
      const dows = new Set([...ctx.days].map(weekday));
      return dows.has(6) && dows.has(0);
    },
  },
  {
    key: "kadar_tjedna",
    label: "Laktanje u društvu",
    description: "Bar jedna zajednička slika (kadar) ovaj tjedan.",
    check: (ctx) => ctx.rows.some((r) => r.kadar),
  },
  {
    key: "rijec_je_rijec",
    label: "Riječ je riječ",
    description: "Odazovi se na poziv i stvarno dođi.",
    check: (ctx) => ctx.rows.some((r) => r.saziv_id),
  },
];

// Deterministički "random": isti korisnik + isti tjedan = isti izazov
export function izazovForWeek(userId, weekKey) {
  const str = `${userId}|${weekKey}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return IZAZOVI[(h >>> 0) % IZAZOVI.length];
}

// rows: checkini JEDNOG korisnika u tjednu
// [{ checked_in_at, saziv_id, kadar_user_ids }]
export function checkIzazov(izazov, rows) {
  const days = new Set();
  const ctxRows = [];
  for (const r of rows) {
    days.add(getDayKey(r.checked_in_at));
    ctxRows.push({
      ...r,
      hour: zagrebHour(r.checked_in_at),
      kadar: Array.isArray(r.kadar_user_ids) && r.kadar_user_ids.length >= 2,
    });
  }
  return izazov.check({ days, rows: ctxRows });
}
