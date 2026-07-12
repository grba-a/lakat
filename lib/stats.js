// Statistika srama — sve se računa on-the-fly iz checkins, nema crona.
// "Dan" je lakat-dan (06:00-06:00), ključevi su "YYYY-MM-DD" iz lib/day.js.

import { getDayKey } from "./day.js";

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

// Map userId -> Set dan-ključeva s barem jednim checkinom (max jedan po danu)
export function userDaySets(checkins) {
  const sets = new Map();
  for (const c of checkins) {
    const key = getDayKey(c.checked_in_at);
    if (!sets.has(c.user_id)) sets.set(c.user_id, new Set());
    sets.get(c.user_id).add(key);
  }
  return sets;
}

// Rang mjeseca: najgori (najmanji postotak) prvi. Registriranima sredinom
// mjeseca broje se mogući dani tek od registracije; korisnici bez ijednog
// mogućeg dana u mjesecu se preskaču.
export function monthRanking({ profiles, daySets, monthKey, todayKey }) {
  const monthStart = `${monthKey}-01`;
  const monthEnd = lastDayOfMonth(monthKey);
  const entries = [];

  for (const profile of profiles) {
    const regKey = getDayKey(profile.created_at);
    const from = regKey > monthStart ? regKey : monthStart;
    const to = todayKey < monthEnd ? todayKey : monthEnd;
    if (from > to) continue;

    const possible = daysBetween(from, to);
    // Do kraja mjeseca mogući dani članstva (bez obzira koliko je mjesec
    // već odmakao) — koristi se za prag staža kod titule pička mjeseca,
    // ne mijenja postotak dolazaka ni prikaz u rangu.
    const tenurePossible = daysBetween(from, monthEnd);
    const daySet = daySets.get(profile.id);
    let days = 0;
    if (daySet) {
      for (const key of daySet) {
        if (key >= from && key <= to) days++;
      }
    }
    entries.push({ ...profile, days, possible, tenurePossible, pct: days / possible });
  }

  entries.sort((a, b) => a.pct - b.pct || a.username.localeCompare(b.username));
  return entries;
}

// Novi član treba bar toliko mogućih dana članstva u mjesecu (do kraja
// mjeseca, ne samo do danas) prije nego može ponijeti titulu pičke —
// tko je ušao prije dva dana ne smije odmah nositi krunu.
const MIN_POSSIBLE_DAYS = 7;

// Izjednačeni na dnu dijele titulu — samo među članovima sa stažem
export function worstOf(ranking) {
  const eligible = ranking.filter((e) => e.tenurePossible >= MIN_POSSIBLE_DAYS);
  if (!eligible.length) return [];
  const worstPct = eligible[0].pct;
  return eligible.filter((e) => e.pct === worstPct);
}

// Zrcalo worstOf: najbolji postotak = inventar mjeseca (izjednačeni dijele)
export function bestOf(ranking) {
  if (!ranking.length) return [];
  const bestPct = ranking[ranking.length - 1].pct;
  return ranking.filter((e) => e.pct === bestPct);
}

// Automatska titula uz ime — streak gradi status, pička mjeseca ga ruši
export function titleFor(streak, isMonthLoser = false) {
  if (isMonthLoser) return "Pička mjeseca 👑";
  if (streak >= 30) return "Vlasnik stolice";
  if (streak >= 14) return "Inventar";
  if (streak >= 7) return "Legenda tjedna";
  if (streak >= 3) return "U formi";
  return null;
}

export function computeStreaks(daySet, todayKey) {
  const keys = [...daySet].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const key of keys) {
    run = prev !== null && addDays(prev, 1) === key ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = key;
  }

  // Trenutni streak ne puca dok današnji dan još traje — broji se i od jučer
  let current = 0;
  let cursor = daySet.has(todayKey) ? todayKey : addDays(todayKey, -1);
  while (daySet.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { current, longest };
}
