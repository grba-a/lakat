// Statistika dolazaka — sve se računa on-the-fly iz checkins, nema crona.
// "Dan" je lakat-dan (06:00-06:00), ključevi su "YYYY-MM-DD" iz lib/day.js.

import { getDayKey } from "./day.js";

// Dani koji se NE broje nigdje: LAKAT 2.0 lockdown (app je bio zaključan
// na /uskoro pa korisnici NISU MOGLI doći) — ne ulaze u moguće dane
// dolaznosti, ne nose dolaske i premošćuju se u streakovima.
export const PRESKOCENI_DANI = new Set([
  "2026-07-14",
  "2026-07-15",
  "2026-07-16",
]);

export function addDays(dayKey, n) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d) + n * 24 * 60 * 60 * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// Broj dana od `from` do `to` uključivo
export function daysBetween(from, to) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / (24 * 60 * 60 * 1000)) + 1;
}

// Broj dana koji se BROJE (bez preskočenih) — za "moguće dane" dolaznosti
export function countableDays(from, to) {
  let n = daysBetween(from, to);
  for (const d of PRESKOCENI_DANI) {
    if (d >= from && d <= to) n--;
  }
  return Math.max(0, n);
}

export function monthOf(dayKey) {
  return dayKey.slice(0, 7);
}

export function lastDayOfMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthKey}-${String(d).padStart(2, "0")}`;
}

export function previousMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function nextMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

// Map userId -> Set dan-ključeva s barem jednim checkinom (max jedan po
// danu); preskočeni dani se ne upisuju (dosljedno s countableDays)
export function userDaySets(checkins) {
  const sets = new Map();
  for (const c of checkins) {
    const key = getDayKey(c.checked_in_at);
    if (PRESKOCENI_DANI.has(key)) continue;
    if (!sets.has(c.user_id)) sets.set(c.user_id, new Set());
    sets.get(c.user_id).add(key);
  }
  return sets;
}

// Rang mjeseca po postotku dolazaka (najmanji prvi). Registriranima sredinom
// mjeseca broje se mogući dani tek od registracije; korisnici bez ijednog
// mogućeg dana u mjesecu se preskaču. Koristi ga Wrapped (rang + inventar).
export function monthRanking({ profiles, daySets, monthKey, todayKey }) {
  const monthStart = `${monthKey}-01`;
  const monthEnd = lastDayOfMonth(monthKey);
  const entries = [];

  for (const profile of profiles) {
    const regKey = getDayKey(profile.created_at);
    const from = regKey > monthStart ? regKey : monthStart;
    const to = todayKey < monthEnd ? todayKey : monthEnd;
    if (from > to) continue;

    const possible = countableDays(from, to);
    if (possible <= 0) continue;
    // Do kraja mjeseca mogući dani članstva (bez obzira koliko je mjesec
    // već odmakao) — prag staža, ne mijenja postotak dolazaka ni rang.
    const tenurePossible = countableDays(from, monthEnd);
    // Grace period: prvih MIN_POSSIBLE_DAYS dana od učlanjenja član je
    // "novi" — prikazuje se odvojeno u rangovima dok se ne uhoda.
    const memberDays = daysBetween(regKey, todayKey);
    const isNew = memberDays < MIN_POSSIBLE_DAYS;
    const graceDaysLeft = isNew ? MIN_POSSIBLE_DAYS - memberDays : 0;
    const daySet = daySets.get(profile.id);
    let days = 0;
    if (daySet) {
      for (const key of daySet) {
        if (key >= from && key <= to) days++;
      }
    }
    entries.push({
      ...profile,
      days,
      possible,
      tenurePossible,
      isNew,
      graceDaysLeft,
      pct: days / possible,
    });
  }

  entries.sort((a, b) => a.pct - b.pct || a.username.localeCompare(b.username));
  return entries;
}

// Novi član ima toliko dana poštede od učlanjenja (isNew u monthRanking)
// prije nego uđe u rangove — tko je ušao prije dva dana nema fer postotak.
const MIN_POSSIBLE_DAYS = 7;

// Najbolji postotak dolazaka = inventar mjeseca (izjednačeni dijele)
export function bestOf(ranking) {
  if (!ranking.length) return [];
  const bestPct = ranking[ranking.length - 1].pct;
  return ranking.filter((e) => e.pct === bestPct);
}

// Automatska titula uz ime — streak gradi status
export function titleFor(streak) {
  if (streak >= 30) return "Vlasnik stolice";
  if (streak >= 14) return "Inventar";
  if (streak >= 7) return "Legenda tjedna";
  if (streak >= 3) return "U formi";
  return null;
}

// Sljedeći/prethodni dan koji se BROJI — preskočeni dani se premošćuju,
// pa streak ne puca preko lockdown rupe
function nextCountedDay(key) {
  let k = addDays(key, 1);
  while (PRESKOCENI_DANI.has(k)) k = addDays(k, 1);
  return k;
}

function prevCountedDay(key) {
  let k = addDays(key, -1);
  while (PRESKOCENI_DANI.has(k)) k = addDays(k, -1);
  return k;
}

export function computeStreaks(daySet, todayKey) {
  const keys = [...daySet].filter((k) => !PRESKOCENI_DANI.has(k)).sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const key of keys) {
    run = prev !== null && nextCountedDay(prev) === key ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = key;
  }

  // Trenutni streak ne puca dok današnji dan još traje — broji se i od
  // zadnjeg dana koji se broji (današnji preskočeni dan gleda unatrag)
  let start = todayKey;
  while (PRESKOCENI_DANI.has(start)) start = addDays(start, -1);
  let current = 0;
  let cursor = daySet.has(start) ? start : prevCountedDay(start);
  while (daySet.has(cursor)) {
    current++;
    cursor = prevCountedDay(cursor);
  }

  return { current, longest };
}
