// Trajni bedževi — jednom osvojeno, zauvijek ostaje. Definicije su
// statične (kao titleFor u lib/stats.js), evaluateBadges samo dodjeljuje
// u user_badges preko admin klijenta (isti obrazac kao groups/group_members
// — nema client insert policyja).
//
// NAMJERNO ne importa lib/supabase/admin.js — admin klijent se prima kao
// parametar, da ovaj fajl ostane siguran za import iz klijentskih
// komponenti (badge-toast.jsx, badges-grid.jsx trebaju samo BADGE_DEFS).

import { PRESKOCENI_DANI } from "./stats.js";

const TIME_ZONE = "Europe/Zagreb";

export const BADGE_DEFS = [
  // streak
  { key: "streak_7", category: "streak", label: "Tjedan dana", description: "7 dana zaredom", hidden: false },
  { key: "streak_30", category: "streak", label: "Vlasnik stolice", description: "30 dana zaredom", hidden: false },
  { key: "streak_100", category: "streak", label: "Legenda", description: "100 dana zaredom", hidden: false },
  // attendance / staž
  { key: "checkins_100", category: "attendance", label: "Stotka", description: "100 checkina ukupno", hidden: false },
  { key: "tenure_365", category: "attendance", label: "Godina dana", description: "365 dana na Laktu", hidden: false },
  // social — apsolutni pragovi, ne "trenutno prvi"
  { key: "reactions_10", category: "social", label: "Zanimljiv", description: "10 reakcija primljeno", hidden: false },
  { key: "reactions_50", category: "social", label: "Popularan", description: "50 reakcija primljeno", hidden: false },
  { key: "reactions_100", category: "social", label: "Faca", description: "100 reakcija primljeno", hidden: false },
  { key: "comments_20", category: "social", label: "Brbljavac", description: "20 komentara objavljeno", hidden: false },
  { key: "comments_50", category: "social", label: "Usta na struju", description: "50 komentara objavljeno", hidden: false },
  // cuga
  { key: "drinks_100", category: "cuga", label: "Stotka piva", description: "100 pića ukupno", hidden: false },
  { key: "drinks_500", category: "cuga", label: "Cisterna", description: "500 pića ukupno", hidden: false },
  // skriveni/easter-egg — nikad prikazani kao zaključan placeholder
  { key: "night_owl", category: "hidden", label: "Noćna ptica", description: "Check-in između 3 i 4 ujutro", hidden: true },
  { key: "drinks_night_10", category: "hidden", label: "Deseta rundo, evo mene", description: "10 pića u jednoj večeri", hidden: true },
];

const BADGE_BY_KEY = new Map(BADGE_DEFS.map((b) => [b.key, b]));

export function badgeInfo(key) {
  return BADGE_BY_KEY.get(key) ?? null;
}

function zagrebHour(isoString) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoString));
  return Number(parts.find((p) => p.type === "hour")?.value ?? -1);
}

function dayKey(isoString) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoString));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  let year = get("year");
  let month = get("month");
  let day = get("day");
  if (get("hour") < 6) {
    const prev = new Date(Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000);
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth() + 1;
    day = prev.getUTCDate();
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDay(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d) + n * 24 * 60 * 60 * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function currentStreak(daySet, todayKey) {
  // Preskočeni dani (lockdown) se premošćuju — isto ponašanje kao
  // computeStreaks u lib/stats.js, da bedž i profil pričaju istu priču
  const prevCounted = (key) => {
    let k = addDay(key, -1);
    while (PRESKOCENI_DANI.has(k)) k = addDay(k, -1);
    return k;
  };
  let start = todayKey;
  while (PRESKOCENI_DANI.has(start)) start = addDay(start, -1);
  let current = 0;
  let cursor = daySet.has(start) ? start : prevCounted(start);
  while (daySet.has(cursor)) {
    current++;
    cursor = prevCounted(cursor);
  }
  return current;
}

async function evalStreak({ admin, userId, earned, checkedInAt }) {
  if (earned.has("streak_100")) return [];
  const since = new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("checkins")
    .select("checked_in_at")
    .eq("user_id", userId)
    .is("cancelled_at", null)
    .gte("checked_in_at", since);

  const daySet = new Set((data ?? []).map((c) => dayKey(c.checked_in_at)));
  const todayKey = dayKey(checkedInAt ?? new Date().toISOString());
  const current = currentStreak(daySet, todayKey);

  return [7, 30, 100]
    .filter((tier) => current >= tier)
    .map((tier) => `streak_${tier}`)
    .filter((key) => !earned.has(key));
}

async function evalAttendance({ admin, userId, earned }) {
  const won = [];

  if (!earned.has("checkins_100")) {
    const { count } = await admin
      .from("checkins")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("cancelled_at", null);
    if ((count ?? 0) >= 100) won.push("checkins_100");
  }

  // 3.0: staž se mjeri od registracije (grupe ne postoje)
  if (!earned.has("tenure_365")) {
    const { data: profile } = await admin
      .from("profiles")
      .select("created_at")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.created_at) {
      const days = (Date.now() - new Date(profile.created_at).getTime()) / (24 * 60 * 60 * 1000);
      if (days >= 365) won.push("tenure_365");
    }
  }

  return won;
}

async function evalReactions({ admin, userId, earned }) {
  if (earned.has("reactions_100")) return [];
  const { data } = await admin
    .from("checkins")
    .select("id, reactions(count)")
    .eq("user_id", userId);
  const total = (data ?? []).reduce((sum, c) => sum + (c.reactions?.[0]?.count ?? 0), 0);
  return [10, 50, 100]
    .filter((tier) => total >= tier)
    .map((tier) => `reactions_${tier}`)
    .filter((key) => !earned.has(key));
}

async function evalComments({ admin, userId, earned }) {
  if (earned.has("comments_50")) return [];
  const { count } = await admin
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return [20, 50]
    .filter((tier) => (count ?? 0) >= tier)
    .map((tier) => `comments_${tier}`)
    .filter((key) => !earned.has(key));
}

function evalHiddenCheckin({ earned, checkedInAt }) {
  const won = [];
  if (!earned.has("night_owl") && checkedInAt && zagrebHour(checkedInAt) === 3) {
    won.push("night_owl");
  }
  return won;
}

async function evalDrinks({ admin, userId, earned, tonightCount = 0 }) {
  const won = [];

  if (!earned.has("drinks_night_10") && tonightCount >= 10) {
    won.push("drinks_night_10");
  }

  if (!earned.has("drinks_500")) {
    const { count } = await admin
      .from("drinks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    won.push(
      ...[100, 500]
        .filter((tier) => (count ?? 0) >= tier)
        .map((tier) => `drinks_${tier}`)
        .filter((key) => !earned.has(key))
    );
  }

  return won;
}

// Vraća listu novoosvojenih BADGE_DEFS objekata (prazna na bilo kakvu
// grešku — poziva se best-effort iz akcija koje ovo ne smiju srušiti).
// 3.0: bedževi su GLOBALNI po korisniku (unique user_id+badge_key).
export async function evaluateBadges({ admin, userId, trigger, context = {} }) {
  try {
    const { data: earnedRows } = await admin
      .from("user_badges")
      .select("badge_key")
      .eq("user_id", userId);
    const earned = new Set((earnedRows ?? []).map((r) => r.badge_key));

    let wonKeys = [];
    if (trigger === "checkin") {
      const [streakWon, attendanceWon, reactionsWon] = await Promise.all([
        evalStreak({ admin, userId, earned, checkedInAt: context.checkedInAt }),
        evalAttendance({ admin, userId, earned }),
        evalReactions({ admin, userId, earned }),
      ]);
      const hiddenWon = evalHiddenCheckin({
        earned,
        checkedInAt: context.checkedInAt,
      });
      wonKeys = [...streakWon, ...attendanceWon, ...reactionsWon, ...hiddenWon];
    } else if (trigger === "comment") {
      const [commentsWon, reactionsWon] = await Promise.all([
        evalComments({ admin, userId, earned }),
        evalReactions({ admin, userId, earned }),
      ]);
      wonKeys = [...commentsWon, ...reactionsWon];
    } else if (trigger === "drink") {
      wonKeys = await evalDrinks({
        admin,
        userId,
        earned,
        tonightCount: context.tonightCount,
      });
    }

    wonKeys = [...new Set(wonKeys)];
    if (!wonKeys.length) return [];

    const { data: inserted } = await admin
      .from("user_badges")
      .upsert(
        wonKeys.map((badge_key) => ({ user_id: userId, badge_key })),
        { onConflict: "user_id,badge_key", ignoreDuplicates: true }
      )
      .select("badge_key");

    return (inserted ?? [])
      .map((row) => badgeInfo(row.badge_key))
      .filter(Boolean);
  } catch {
    return [];
  }
}
