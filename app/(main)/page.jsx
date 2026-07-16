import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser, getActiveGroupFor } from "@/lib/auth";
import { getCurrentDayStart, getDayKey } from "@/lib/day";
import { fetchAllCheckins } from "@/lib/checkins";
import {
  userDaySets,
  computeStreaks,
  titleFor,
  monthOf,
  previousMonth,
  lastDayOfMonth,
} from "@/lib/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeLiga, weekStartKey, bodovaLabel } from "@/lib/liga";
import Link from "next/link";
import Sank from "./sank";
import Flashbacks from "./flashbacks";
import InstallHint from "./install-hint";
import JoinGroupCard from "./join-group-card";
import WrappedBanner from "./wrapped-banner";

// Prozor za statistiku na Home: zadnjih 60 dana pokriva tekući mjesec (rang)
// + streak titule (prag je 30 dana), a ne skenira cijelu povijest grupe.
const STATS_WINDOW_DAYS = 60;

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveGroupFor(user.id);
  // Bez grupe — ostaješ u appu, ali umjesto liste dobiješ poziv da uđeš u grupu.
  if (!active) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="glass mt-6 flex flex-col items-center justify-center gap-1 rounded-hero border-white/10 p-8 text-center opacity-80">
          <p className="font-display text-4xl uppercase tracking-wide text-muted">
            Prvo uđi u grupu
          </p>
          <p className="text-xs tracking-widest text-muted">
            Bez ekipe nema šanka.
          </p>
        </div>
        <JoinGroupCard />
      </main>
    );
  }

  const supabase = await createClient();
  const dayStart = getCurrentDayStart();
  const windowStart = new Date(
    dayStart.getTime() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const todayKeyForMonth = getDayKey(new Date());
  const [monthYear, monthNum] = monthOf(todayKeyForMonth).split("-").map(Number);
  const monthStartIso = getCurrentDayStart(
    new Date(Date.UTC(monthYear, monthNum - 1, 1, 12))
  ).toISOString();

  const najavaCutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const sazivCutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const [
    { data: profiles },
    { data: checkins },
    allCheckins,
    { data: drinks },
    { count: monthDrinkCount },
    { data: najave },
    { data: sazivi },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, avatar_url, created_at, group_members!inner(group_id, joined_at)"
      )
      .eq("group_members.group_id", active.id)
      .order("username"),
    supabase
      .from("checkins")
      .select("id, user_id, checked_in_at, cancelled_at, photo_url, thumb_url")
      .eq("group_id", active.id)
      .gte("checked_in_at", dayStart.toISOString())
      .order("checked_in_at", { ascending: true }),
    fetchAllCheckins(supabase, undefined, active.id, windowStart),
    supabase
      .from("drinks")
      .select("id, user_id, drink_type, logged_at")
      .eq("group_id", active.id)
      .gte("logged_at", dayStart.toISOString()),
    supabase
      .from("drinks")
      .select("id", { count: "exact", head: true })
      .eq("group_id", active.id)
      .gte("logged_at", monthStartIso),
    supabase
      .from("najave")
      .select("id, user_id, created_at, target_user_id")
      .eq("group_id", active.id)
      .gte("created_at", najavaCutoff),
    supabase
      .from("sazivi")
      .select("id, created_by, place_text, at_time, created_at")
      .eq("group_id", active.id)
      .gte("at_time", sazivCutoff)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  // Odazivi ovise o ID-u živog saziva pa idu u drugi val (kao reakcije)
  const ziviSaziv = sazivi?.[0] ?? null;
  const { data: sazivOdazivi } = ziviSaziv
    ? await supabase
        .from("saziv_odazivi")
        .select("user_id, saziv_id, status")
        .eq("saziv_id", ziviSaziv.id)
    : { data: [] };

  // Statistika unutar grupe kreće od ulaska u grupu (za staru ekipu = registracija)
  const allProfiles = (profiles ?? []).map((p) => ({
    ...p,
    created_at: p.group_members?.[0]?.joined_at ?? p.created_at,
  }));
  const usernames = Object.fromEntries(allProfiles.map((p) => [p.id, p.username]));

  // Reakcije ovise o ID-jevima današnjih checkina pa moraju u drugi val
  const reactionIds = [...new Set((checkins ?? []).map((c) => c.id))];
  const { data: reactionRows } = reactionIds.length
    ? await supabase
        .from("reactions")
        .select("checkin_id, user_id, emoji")
        .in("checkin_id", reactionIds)
    : { data: [] };

  const reactionsByCheckin = {};
  for (const r of reactionRows ?? []) {
    (reactionsByCheckin[r.checkin_id] ??= []).push({
      user_id: r.user_id,
      emoji: r.emoji,
    });
  }

  // Titule: samo streak status — sram mehanika je maknuta
  const daySets = userDaySets(allCheckins);
  const todayKey = getDayKey(new Date());
  const titles = {};
  for (const p of allProfiles) {
    const { current } = computeStreaks(daySets.get(p.id) ?? new Set(), todayKey);
    titles[p.id] = titleFor(current);
  }

  // Liga widget: pozicija i bodovi aktivne grupe ovaj tjedan (admin klijent
  // zbog cross-group zbrajanja; UI dobije samo rang + bodove)
  let liga = null;
  try {
    const table = await computeLiga({
      admin: createAdminClient(),
      weekKey: weekStartKey(todayKey),
    });
    const rank = table.findIndex((g) => g.id === active.id) + 1;
    if (rank > 0) {
      liga = { rank, points: table[rank - 1].points, total: table.length };
    }
  } catch {
    // liga je bonus — Šank živi i bez nje (npr. prije primjene SQL-a)
  }

  // Slike dana renderira Sank (realtime rows) — ovdje se više ne deriviraju

  // Wrapped banner: zadnja 3 dana tekućeg mjeseca (recap koji se puni) ili
  // prva 3 dana idućeg (recap prošlog, netom zaključenog mjeseca)
  const currentMonthKey = monthOf(todayKey);
  const lastDayNum = Number(lastDayOfMonth(currentMonthKey).slice(8, 10));
  const dayNum = Number(todayKey.slice(8, 10));
  const wrappedMonthKey =
    dayNum <= 3
      ? previousMonth(currentMonthKey)
      : dayNum >= lastDayNum - 2
        ? currentMonthKey
        : null;

  return (
    <main className="flex flex-1 flex-col">
      {liga && (
        <Link
          href="/liga"
          className="pressable mt-4 flex items-center justify-between rounded-card border border-white/10 bg-white/[0.03] px-4 py-2.5"
        >
          <span className="text-xs font-bold uppercase tracking-widest">
            🏆 {liga.rank}. u ligi{" "}
            <span className="text-muted">· {bodovaLabel(liga.points)} ovaj tjedan</span>
          </span>
          <span className="text-muted">›</span>
        </Link>
      )}
      <Sank
        key={active.id}
        groupId={active.id}
        profiles={allProfiles}
        initialCheckins={checkins ?? []}
        currentUserId={user.id}
        titles={titles}
        initialNajave={najave ?? []}
        initialReactions={reactionsByCheckin}
        initialDrinks={drinks ?? []}
        monthDrinkCount={monthDrinkCount ?? 0}
        initialSaziv={ziviSaziv}
        initialOdazivi={sazivOdazivi ?? []}
      />
      {wrappedMonthKey && <WrappedBanner monthKey={wrappedMonthKey} />}
      <Suspense fallback={null}>
        <Flashbacks groupId={active.id} usernames={usernames} myId={user.id} />
      </Suspense>
      <InstallHint />
    </main>
  );
}
