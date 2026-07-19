// Rang 3.0 — tjedni bodovi POJEDINCA (ponedjeljak 06:00 → ponedjeljak
// 06:00 po lakat-danima). Bodovi se računaju on-the-fly ADMIN klijentom
// (cross-user čitanje preko RLS-a), ali prema UI-ju idu SAMO: imena i
// bodovi MOJIH frendova + MOJA globalna pozicija kao broj (nikad tuđa
// imena izvan frend kruga — privatnost "samo frendovi").

import { getDayKey, getCurrentDayStart } from "./day.js";
import { addDays } from "./stats.js";
import { izazovForWeek, checkIzazov } from "./izazovi.js";

export const BOD_DOLAZAK = 2;
export const BOD_ODAZIV = 1;
export const BOD_KADAR = 4;
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

export function bodovaLabel(n) {
  const label =
    n === 1 ? "bod" : n % 100 >= 2 && n % 100 <= 4 ? "boda" : "bodova";
  return `${n} ${label}`;
}

// Bodovi SVIH korisnika u tjednu: Map userId -> { points, izazov }.
// Dolazak (jedinstveni dan) +2, ispunjen odaziv (jedinstveni saziv) +1,
// kadar dan +4 (anti-farm cap po danu), osobni izazov tjedna +10.
export async function computeBodovi({ admin, weekKey }) {
  const fromIso = dayKeyToStartIso(weekKey);
  const toIso = dayKeyToStartIso(addDays(weekKey, 7));

  const { data: checkins } = await admin
    .from("checkins")
    .select("user_id, checked_in_at, saziv_id, kadar_user_ids")
    .is("cancelled_at", null)
    .gte("checked_in_at", fromIso)
    .lt("checked_in_at", toIso);

  const byUser = new Map();
  for (const c of checkins ?? []) {
    if (!byUser.has(c.user_id)) byUser.set(c.user_id, []);
    byUser.get(c.user_id).push(c);
  }

  const bodovi = new Map();
  for (const [uid, rows] of byUser) {
    const days = new Set(rows.map((r) => getDayKey(r.checked_in_at)));
    const odazivSazivi = new Set(rows.filter((r) => r.saziv_id).map((r) => r.saziv_id));
    const kadarDani = new Set(
      rows
        .filter((r) => Array.isArray(r.kadar_user_ids) && r.kadar_user_ids.length >= 2)
        .map((r) => getDayKey(r.checked_in_at))
    );
    let points =
      days.size * BOD_DOLAZAK +
      odazivSazivi.size * BOD_ODAZIV +
      kadarDani.size * BOD_KADAR;

    const izazov = izazovForWeek(uid, weekKey);
    const done = checkIzazov(izazov, rows);
    if (done) points += BOD_IZAZOV;

    bodovi.set(uid, {
      points,
      izazov: {
        key: izazov.key,
        label: izazov.label,
        description: izazov.description,
        done,
      },
    });
  }
  return bodovi;
}

// Rang za jednog korisnika: ljestvica frend kruga (s ID-jevima — imena
// mapira UI iz frend profila) + globalna pozicija samo kao broj
export async function computeRang({ admin, userId, friendIds, weekKey }) {
  const bodovi = await computeBodovi({ admin, weekKey });

  let mine = bodovi.get(userId) ?? null;
  if (!mine) {
    // bez ijedne runde — izazov je ipak dodijeljen (prikaz kartice)
    const iz = izazovForWeek(userId, weekKey);
    mine = {
      points: 0,
      izazov: { key: iz.key, label: iz.label, description: iz.description, done: false },
    };
  }

  const krug = [userId, ...friendIds];
  const ljestvica = krug
    .map((id) => ({ id, points: bodovi.get(id)?.points ?? 0 }))
    .sort((a, b) => b.points - a.points);
  const friendRank = ljestvica.findIndex((e) => e.id === userId) + 1;

  const boljih = [...bodovi.values()].filter((b) => b.points > mine.points).length;
  const globalRank = boljih + 1;
  const globalTotal = Math.max(bodovi.size, 1);

  return { mine, ljestvica, friendRank, globalRank, globalTotal };
}
