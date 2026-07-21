import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { getCurrentDayStart, getDayKey } from "@/lib/day";
import { fetchAllCheckins } from "@/lib/checkins";
import { fetchTodayFeed } from "@/lib/feed";
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
import WhatsNew from "./whats-new";

// Prozor za statistiku na Home: zadnjih 60 dana pokriva tekući mjesec +
// streak titule (prag 30 dana), a ne skenira cijelu povijest.
const STATS_WINDOW_DAYS = 60;

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

  // Feed (danas, RLS scop na mene + frendove) + statistika (60 dana) +
  // mjesečni broj pića — sve paralelno. Feed upiti su u lib/feed.js jer ih
  // dijeli i klijentski foreground refetch u sank.jsx.
  const [feed, allCheckins, { count: monthDrinkCount }] = await Promise.all([
    fetchTodayFeed(supabase),
    fetchAllCheckins(supabase, undefined, windowStart),
    supabase
      .from("drinks")
      .select("id", { count: "exact", head: true })
      .gte("logged_at", monthStartIso),
  ]);

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
      <WhatsNew />
      <RangWidget userId={user.id} friendIds={friendIds} todayKey={todayKey} />
      {friendIds.length === 0 && <AddFriendsCard friendCode={me?.friend_code} />}
      <Sank
        profiles={allProfiles}
        currentUserId={user.id}
        titles={titles}
        initialCheckins={feed.checkins}
        initialNajave={feed.najave}
        initialReactions={feed.reactions}
        initialDrinks={feed.drinks}
        initialSazivi={feed.sazivi}
        initialOdazivi={feed.odazivi}
        initialCommentCounts={feed.commentCounts}
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
