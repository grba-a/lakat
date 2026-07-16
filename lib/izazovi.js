// Izazov tjedna — NEMA tablice ni crona: izazov se deterministički bira
// iz poola hashom (group_id + weekKey), a ispunjenje se detektira iz
// checkina tog tjedna (isti redovi koje liga ionako dohvaća). Bodovi za
// ligu: BOD_IZAZOV u lib/liga.js.

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

// 0=ned..6=sub za dayKey (lakat-dan: noć do 06:00 pripada jučer, pa
// subotnja pijanka do 6 ujutro i dalje broji subotu — točno što želimo)
function weekday(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Svaki check dobije kontekst izgrađen iz checkina tjedna:
// days (Set dayKey), userDays (Map dayKey -> Set userId),
// sazivUsers (Map sazivId -> Set userId), rows (s izračunatim satom)
export const IZAZOVI = [
  {
    key: "tri_dana",
    label: "Tri dana vani",
    description: "Okupite se bar 3 različita dana ovaj tjedan.",
    check: (ctx) => ctx.days.size >= 3,
  },
  {
    key: "puna_kuca",
    label: "Puna kuća",
    description: "Bar 4 člana vani u istom danu.",
    check: (ctx) => [...ctx.userDays.values()].some((s) => s.size >= 4),
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
    key: "saziv_koji_pali",
    label: "Saziv koji pali",
    description: "Jedan saziv okupi bar 3 člana. Diži ih!",
    check: (ctx) => [...ctx.sazivUsers.values()].some((s) => s.size >= 3),
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
];

// Deterministički "random": ista grupa + isti tjedan = isti izazov,
// bez tablice. FNV-1a hash nad stringom.
export function izazovForWeek(groupId, weekKey) {
  const str = `${groupId}|${weekKey}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return IZAZOVI[(h >>> 0) % IZAZOVI.length];
}

// rows: checkini tjedna jedne grupe [{ user_id, checked_in_at, saziv_id }]
export function checkIzazov(izazov, rows) {
  const days = new Set();
  const userDays = new Map();
  const sazivUsers = new Map();
  const ctxRows = [];
  for (const r of rows) {
    const dk = getDayKey(r.checked_in_at);
    days.add(dk);
    if (!userDays.has(dk)) userDays.set(dk, new Set());
    userDays.get(dk).add(r.user_id);
    if (r.saziv_id) {
      if (!sazivUsers.has(r.saziv_id)) sazivUsers.set(r.saziv_id, new Set());
      sazivUsers.get(r.saziv_id).add(r.user_id);
    }
    ctxRows.push({ ...r, hour: zagrebHour(r.checked_in_at) });
  }
  return izazov.check({ days, userDays, sazivUsers, rows: ctxRows });
}
