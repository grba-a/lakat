// Liga ekipa — grupe se natječu tjedno (ponedjeljak 06:00 → ponedjeljak
// 06:00 po lakat-danima). Bodovi se računaju on-the-fly iz checkins, nema
// crona ni score tablice. Upiti idu ADMIN klijentom (cross-group čitanje
// preko RLS-a), ali prema UI-ju smiju samo ime grupe + bodovi + broj
// članova — nikad slike, imena članova ili lokacije tuđih grupa.

import { getDayKey, getCurrentDayStart } from "./day.js";
import { addDays } from "./stats.js";
import { izazovForWeek, checkIzazov } from "./izazovi.js";

export const BOD_DOLAZAK = 2;
export const BOD_ODAZIV = 1;
export const BOD_IZAZOV = 10;

// Ponedjeljak tekućeg lakat-tjedna za zadani dayKey ("YYYY-MM-DD")
export function weekStartKey(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=ned..6=sub
  return addDays(dayKey, -((dow + 6) % 7));
}

// UTC instant 06:00 po Zagrebu za zadani dayKey (podne UTC izbjegne DST rub)
export function dayKeyToStartIso(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return getCurrentDayStart(new Date(Date.UTC(y, m - 1, d, 12))).toISOString();
}

// Tablica lige za tjedan [weekKey, weekKey+7): [{ id, name, memberCount,
// activeCount, points, izazov }] sortirano po bodovima. Dolazak =
// jedinstveni (user, dan) par ×2; ispunjen odaziv = jedinstveni (user,
// saziv) ×1; ispunjen izazov tjedna = +10 (lib/izazovi.js, bez tablice).
export async function computeLiga({ admin, weekKey }) {
  const fromIso = dayKeyToStartIso(weekKey);
  const toIso = dayKeyToStartIso(addDays(weekKey, 7));

  const [{ data: groups }, { data: members }, { data: checkins }] =
    await Promise.all([
      admin.from("groups").select("id, name"),
      admin.from("group_members").select("group_id, user_id"),
      admin
        .from("checkins")
        .select("user_id, group_id, checked_in_at, saziv_id")
        .is("cancelled_at", null)
        .gte("checked_in_at", fromIso)
        .lt("checked_in_at", toIso),
    ]);

  const rowsByGroup = new Map();
  for (const c of checkins ?? []) {
    if (!rowsByGroup.has(c.group_id)) rowsByGroup.set(c.group_id, []);
    rowsByGroup.get(c.group_id).push(c);
  }

  const memberCount = new Map();
  for (const m of members ?? []) {
    memberCount.set(m.group_id, (memberCount.get(m.group_id) ?? 0) + 1);
  }

  const table = (groups ?? []).map((g) => {
    const rows = rowsByGroup.get(g.id) ?? [];
    const dani = new Set();
    const odazivi = new Set();
    const aktivni = new Set();
    for (const c of rows) {
      dani.add(`${c.user_id}|${getDayKey(c.checked_in_at)}`);
      aktivni.add(c.user_id);
      if (c.saziv_id) odazivi.add(`${c.user_id}|${c.saziv_id}`);
    }
    const izazov = izazovForWeek(g.id, weekKey);
    const izazovDone = rows.length > 0 && checkIzazov(izazov, rows);
    return {
      id: g.id,
      name: g.name,
      memberCount: memberCount.get(g.id) ?? 0,
      activeCount: aktivni.size,
      points:
        dani.size * BOD_DOLAZAK +
        odazivi.size * BOD_ODAZIV +
        (izazovDone ? BOD_IZAZOV : 0),
      izazov: { ...izazov, done: izazovDone },
    };
  });
  table.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  return table;
}

// "n bodova" s hrvatskom deklinacijom
export function bodovaLabel(n) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} bod`;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return `${n} boda`;
  return `${n} bodova`;
}
