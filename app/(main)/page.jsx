import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { getCurrentDayStart, getDayKey } from "@/lib/day";
import { fetchAllCheckins } from "@/lib/checkins";
import { friendIdsOf } from "@/lib/friends";
import {
  userDaySets,
  computeStreaks,
  titleFor,
  monthOf,
  previousMonth,
  lastDayOfMonth,
} from "@/lib/stats";
import Sank from "./sank";
import Flashbacks from "./flashbacks";
import InstallHint from "./install-hint";
import AddFriendsCard from "./add-friends-card";
import WrappedBanner from "./wrapped-banner";
import RangWidget from "./rang-widget";

// Prozor za statistiku na Home: zadnjih 60 dana pokriva tekući mjesec +
// streak titule (prag 30 dana), a ne skenira cijelu povijest.
const STATS_WINDOW_DAYS = 60;

const NAJAVA_TRAJANJE_MS = 45 * 60 * 1000;
const SAZIV_ZIVOT_NAKON_MS = 3 * 60 * 60 * 1000;

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Moj profil + frendovi — 3.0: friend lista je jedini scope vidljivosti
  const [{ data: me }, friendIds] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, avatar_url, friend_code")
      .eq("id", user.id)
      .maybeSingle(),
    friendIdsOf(supabase, user.id),
  ]);

  const { data: friendProfiles } = friendIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", friendIds)
        .order("username")
    : { data: [] };

  const allProfiles = [
    { id: user.id, username: me?.username ?? "ja", avatar_url: me?.avatar_url ?? null },
    ...(friendProfiles ?? []),
  ];
  const usernames = Object.fromEntries(allProfiles.map((p) => [p.id, p.username]));

  const dayStart = getCurrentDayStart();
  const windowStart = new Date(
    dayStart.getTime() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const todayKey = getDayKey(new Date());
  const [monthYear, monthNum] = monthOf(todayKey).split("-").map(Number);
  const monthStartIso = getCurrentDayStart(
    new Date(Date.UTC(monthYear, monthNum - 1, 1, 12))
  ).toISOString();

  const najavaCutoff = new Date(Date.now() - NAJAVA_TRAJANJE_MS).toISOString();
  const sazivCutoff = new Date(Date.now() - SAZIV_ZIVOT_NAKON_MS).toISOString();

  // Svi upiti su RLS-scopani na mene + frendove — nema group filtera
  const [
    { data: checkins },
    allCheckins,
    { data: drinks },
    { count: monthDrinkCount },
    { data: najave },
    { data: sazivi },
  ] = await Promise.all([
    supabase
      .from("checkins")
      .select("id, user_id, checked_in_at, cancelled_at, photo_url, thumb_url")
      .gte("checked_in_at", dayStart.toISOString())
      .order("checked_in_at", { ascending: true }),
    fetchAllCheckins(supabase, undefined, undefined, windowStart),
    supabase
      .from("drinks")
      .select("id, user_id, drink_type, logged_at")
      .gte("logged_at", dayStart.toISOString()),
    supabase
      .from("drinks")
      .select("id", { count: "exact", head: true })
      .gte("logged_at", monthStartIso),
    supabase
      .from("najave")
      .select("id, user_id, created_at, target_user_id")
      .gte("created_at", najavaCutoff),
    supabase
      .from("sazivi")
      .select("id, created_by, place_text, at_time, created_at")
      .gte("at_time", sazivCutoff)
      .order("created_at", { ascending: false }),
  ]);

  // Odazivi + reakcije + brojevi komentara ovise o ID-jevima pa drugi val
  const sazivIds = (sazivi ?? []).map((s) => s.id);
  const checkinIds = (checkins ?? []).map((c) => c.id);
  const [{ data: sazivOdazivi }, { data: reactionRows }, { data: commentRows }] =
    await Promise.all([
      sazivIds.length
        ? supabase
            .from("saziv_odazivi")
            .select("user_id, saziv_id, status")
            .in("saziv_id", sazivIds)
        : Promise.resolve({ data: [] }),
      checkinIds.length
        ? supabase
            .from("reactions")
            .select("checkin_id, user_id, emoji")
            .in("checkin_id", checkinIds)
        : Promise.resolve({ data: [] }),
      checkinIds.length
        ? supabase
            .from("comments")
            .select("checkin_id")
            .in("checkin_id", checkinIds)
        : Promise.resolve({ data: [] }),
    ]);

  const reactionsByCheckin = {};
  for (const r of reactionRows ?? []) {
    (reactionsByCheckin[r.checkin_id] ??= []).push({
      user_id: r.user_id,
      emoji: r.emoji,
    });
  }
  const commentCounts = {};
  for (const c of commentRows ?? []) {
    commentCounts[c.checkin_id] = (commentCounts[c.checkin_id] ?? 0) + 1;
  }

  // Titule: streak status po korisniku
  const daySets = userDaySets(allCheckins);
  const titles = {};
  for (const p of allProfiles) {
    const { current } = computeStreaks(daySets.get(p.id) ?? new Set(), todayKey);
    titles[p.id] = titleFor(current);
  }

  // Wrapped banner: zadnja 3 dana mjeseca ili prva 3 idućeg
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
      <RangWidget userId={user.id} friendIds={friendIds} todayKey={todayKey} />
      {friendIds.length === 0 && <AddFriendsCard friendCode={me?.friend_code} />}
      <Sank
        profiles={allProfiles}
        currentUserId={user.id}
        titles={titles}
        initialCheckins={checkins ?? []}
        initialNajave={najave ?? []}
        initialReactions={reactionsByCheckin}
        initialDrinks={drinks ?? []}
        initialSazivi={sazivi ?? []}
        initialOdazivi={sazivOdazivi ?? []}
        initialCommentCounts={commentCounts}
        monthDrinkCount={monthDrinkCount ?? 0}
      />
      {wrappedMonthKey && <WrappedBanner monthKey={wrappedMonthKey} />}
      <Suspense fallback={null}>
        <Flashbacks usernames={usernames} myId={user.id} />
      </Suspense>
      <InstallHint />
    </main>
  );
}
