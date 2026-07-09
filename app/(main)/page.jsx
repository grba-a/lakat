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
  monthRanking,
  worstOf,
  monthOf,
} from "@/lib/stats";
import Sank from "./sank";
import Memorije from "./memorije";
import Flashbacks from "./flashbacks";
import InstallHint from "./install-hint";
import JoinGroupCard from "./join-group-card";

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
        <button
          type="button"
          disabled
          className="glass mt-6 flex h-40 w-full flex-col items-center justify-center gap-1 rounded-hero border-white/10 font-display text-6xl uppercase tracking-wide text-muted opacity-60"
        >
          Tu sam
          <span className="text-xs tracking-widest">Prvo uđi u grupu</span>
        </button>
        <JoinGroupCard />
      </main>
    );
  }

  const supabase = await createClient();
  const dayStart = getCurrentDayStart();
  const windowStart = new Date(
    dayStart.getTime() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const [{ data: profiles }, { data: checkins }, allCheckins] = await Promise.all([
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
  ]);

  // Statistika unutar grupe kreće od ulaska u grupu (za staru ekipu = registracija)
  const allProfiles = (profiles ?? []).map((p) => ({
    ...p,
    created_at: p.group_members?.[0]?.joined_at ?? p.created_at,
  }));
  const usernames = Object.fromEntries(allProfiles.map((p) => [p.id, p.username]));

  // Reakcije za današnje slike + žive najave — najave ne ovise o reactionIds
  // pa idu paralelno u istom valu
  const reactionIds = [...new Set((checkins ?? []).map((c) => c.id))];
  const najavaCutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const [{ data: reactionRows }, { data: najave }] = await Promise.all([
    reactionIds.length
      ? supabase
          .from("reactions")
          .select("checkin_id, user_id, emoji")
          .in("checkin_id", reactionIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("najave")
      .select("id, user_id, created_at")
      .eq("group_id", active.id)
      .gte("created_at", najavaCutoff),
  ]);

  const reactionsByCheckin = {};
  for (const r of reactionRows ?? []) {
    (reactionsByCheckin[r.checkin_id] ??= []).push({
      user_id: r.user_id,
      emoji: r.emoji,
    });
  }

  // Titule: streak po korisniku + kruna za aktualnu pičku mjeseca (iz prozora)
  const daySets = userDaySets(allCheckins);
  const todayKey = getDayKey(new Date());
  const losers = worstOf(
    monthRanking({
      profiles: allProfiles,
      daySets,
      monthKey: monthOf(todayKey),
      todayKey,
    })
  );
  const titles = {};
  for (const p of allProfiles) {
    const { current } = computeStreaks(daySets.get(p.id) ?? new Set(), todayKey);
    titles[p.id] = titleFor(current, losers.some((l) => l.id === p.id));
  }

  // Slike dana: dokazne slike iz današnjih check-inova, najnovije prve
  const memoryItems = (checkins ?? [])
    .filter((c) => c.photo_url)
    .sort((a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at))
    .map((m) => ({ ...m, username: usernames[m.user_id] ?? "Netko" }));

  return (
    <main className="flex flex-1 flex-col">
      <Sank
        key={active.id}
        groupId={active.id}
        profiles={allProfiles}
        initialCheckins={checkins ?? []}
        currentUserId={user.id}
        titles={titles}
        initialNajave={najave ?? []}
        initialReactions={reactionsByCheckin}
      />
      <Memorije
        key={`memorije-${active.id}`}
        items={memoryItems}
        flashbacks={[]}
        myId={user.id}
        initialReactions={reactionsByCheckin}
      />
      <Suspense fallback={null}>
        <Flashbacks groupId={active.id} usernames={usernames} myId={user.id} />
      </Suspense>
      <InstallHint />
    </main>
  );
}
