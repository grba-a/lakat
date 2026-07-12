import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDayKey } from "@/lib/day";
import { computeStreaks } from "@/lib/stats";
import { notifyUser } from "@/lib/push";
import { streakVisiPushBody } from "@/lib/push-copy";

const LOOKBACK_DAYS = 40; // pokriva i "Vlasnik stolice" prag (30) s marginom
const MIN_STREAK_AT_RISK = 3; // isti prag kao "U formi" titula

// Vercel cron: 18:00 UTC = 20:00 po Zagrebu ljeti (zimi 19:00 — cron ne zna
// za DST, isti caveat kao prazan-sank). Nema crona koji piše u bazu — samo
// šalje push, dedup nije potreban jer je jednom dnevno.
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Odbij." }, { status: 401 });
  }

  const admin = createAdminClient();
  const todayKey = getDayKey(new Date());
  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: checkins, error } = await admin
    .from("checkins")
    .select("user_id, group_id, checked_in_at")
    .is("cancelled_at", null)
    .gte("checked_in_at", since);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Dan-setovi po (grupa, korisnik) — isti korisnik u više grupa računa
  // streak posebno po svakoj
  const buckets = new Map();
  for (const c of checkins ?? []) {
    const key = `${c.group_id}:${c.user_id}`;
    if (!buckets.has(key)) buckets.set(key, new Set());
    buckets.get(key).add(getDayKey(c.checked_in_at));
  }

  // Jedan push po korisniku — najveći streak koji mu visi preko svih grupa
  const atRisk = new Map();
  for (const [key, daySet] of buckets) {
    if (daySet.has(todayKey)) continue;
    const userId = key.split(":")[1];
    const { current } = computeStreaks(daySet, todayKey);
    if (current >= MIN_STREAK_AT_RISK) {
      atRisk.set(userId, Math.max(atRisk.get(userId) ?? 0, current));
    }
  }

  await Promise.allSettled(
    [...atRisk].map(([userId, streak]) =>
      notifyUser({
        userId,
        body: streakVisiPushBody(streak),
      })
    )
  );

  return NextResponse.json({ ok: true, atRisk: atRisk.size });
}
