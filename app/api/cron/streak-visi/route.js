import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDayKey } from "@/lib/day";
import { computeStreaks } from "@/lib/stats";
import { notifyUser } from "@/lib/push";
import { streakVisiPushBody } from "@/lib/push-copy";

const LOOKBACK_DAYS = 40; // pokriva i "Vlasnik stolice" prag (30) s marginom
const MIN_STREAK_AT_RISK = 3; // isti prag kao "U formi" titula

// Vercel cron: 18:00 UTC = 20:00 po Zagrebu ljeti (zimi 19:00 — cron ne zna
// za DST). Jedini večernji podsjetnik u 3.0 (osobni streak; grupni streak i
// prazan-šank su umrli s grupama — BeReal pouka: ne gnjaviti).
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
    .select("user_id, checked_in_at")
    .is("cancelled_at", null)
    .gte("checked_in_at", since);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Dan-setovi po korisniku (3.0: streak je globalan, grupe ne postoje)
  const buckets = new Map();
  for (const c of checkins ?? []) {
    if (!buckets.has(c.user_id)) buckets.set(c.user_id, new Set());
    buckets.get(c.user_id).add(getDayKey(c.checked_in_at));
  }

  const atRisk = new Map();
  for (const [userId, daySet] of buckets) {
    if (daySet.has(todayKey)) continue;
    const { current } = computeStreaks(daySet, todayKey);
    if (current >= MIN_STREAK_AT_RISK) atRisk.set(userId, current);
  }

  await Promise.allSettled(
    [...atRisk].map(([userId, streak]) =>
      notifyUser({ userId, body: streakVisiPushBody(streak) })
    )
  );

  return NextResponse.json({ ok: true, atRisk: atRisk.size });
}
