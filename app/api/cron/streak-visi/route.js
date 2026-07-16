import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDayKey } from "@/lib/day";
import { computeStreaks } from "@/lib/stats";
import { notifyUser, notifyGroup } from "@/lib/push";
import { streakVisiPushBody, grupniStreakVisiPushBody } from "@/lib/push-copy";

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
  // streak posebno po svakoj. Usput i dan-setovi po grupi (grupni streak).
  const buckets = new Map();
  const groupDays = new Map();
  for (const c of checkins ?? []) {
    const key = `${c.group_id}:${c.user_id}`;
    if (!buckets.has(key)) buckets.set(key, new Set());
    buckets.get(key).add(getDayKey(c.checked_in_at));
    if (!groupDays.has(c.group_id)) groupDays.set(c.group_id, new Set());
    groupDays.get(c.group_id).add(getDayKey(c.checked_in_at));
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

  // Grupni streak visi: dan s bar jednom rundom BILO KOGA = streak dan;
  // ako danas još nitko nije izašao, cijela grupa dobije jedan push
  // (jedini grupni podsjetnik — BeReal pouka: ne gnjaviti)
  const groupsAtRisk = [];
  for (const [groupId, daySet] of groupDays) {
    if (daySet.has(todayKey)) continue;
    const { current } = computeStreaks(daySet, todayKey);
    if (current >= MIN_STREAK_AT_RISK) groupsAtRisk.push({ groupId, current });
  }
  let groupNames = new Map();
  if (groupsAtRisk.length) {
    const { data: groups } = await admin
      .from("groups")
      .select("id, name")
      .in("id", groupsAtRisk.map((g) => g.groupId));
    groupNames = new Map((groups ?? []).map((g) => [g.id, g.name]));
  }

  await Promise.allSettled([
    ...[...atRisk].map(([userId, streak]) =>
      notifyUser({
        userId,
        body: streakVisiPushBody(streak),
      })
    ),
    ...groupsAtRisk.map(({ groupId, current }) =>
      notifyGroup({
        groupId,
        groupName: groupNames.get(groupId) ?? null,
        body: grupniStreakVisiPushBody(current),
      })
    ),
  ]);

  return NextResponse.json({
    ok: true,
    atRisk: atRisk.size,
    groupsAtRisk: groupsAtRisk.length,
  });
}
