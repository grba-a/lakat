import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser, getActiveGroupFor } from "@/lib/auth";
import { fetchAllCheckins } from "@/lib/checkins";
import { getDayKey } from "@/lib/day";
import {
  userDaySets,
  monthRanking,
  worstOf,
  bestOf,
  computeStreaks,
  monthOf,
  previousMonth,
  lastDayOfMonth,
} from "@/lib/stats";
import WrappedCard from "./wrapped-card";

const monthFmt = new Intl.DateTimeFormat("hr-HR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatMonth(monthKey) {
  return monthFmt.format(new Date(`${monthKey}-01T00:00:00Z`));
}

function EmptyState({ title, body }) {
  return (
    <main className="flex flex-1 flex-col">
      <div className="glass mt-10 rounded-card p-5 text-center">
        <p className="font-display text-2xl uppercase tracking-wide">{title}</p>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <Link
          href="/profil"
          className="pressable-soft mt-5 inline-flex h-12 items-center justify-center rounded-button bg-accent px-6 font-display text-lg uppercase tracking-wide text-black"
        >
          Natrag na profil
        </Link>
      </div>
    </main>
  );
}

export default async function WrappedPage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveGroupFor(user.id);
  if (!active) {
    return (
      <EmptyState
        title="Nisi u grupi."
        body="Uđi u grupu da vidiš svoj mjesečni obračun."
      />
    );
  }

  const supabase = await createClient();
  const todayKey = getDayKey(new Date());
  const currentMonthKey = monthOf(todayKey);
  const dayOfMonth = Number(todayKey.slice(8, 10));
  const defaultMonthKey =
    dayOfMonth <= 3 ? previousMonth(currentMonthKey) : currentMonthKey;

  const { mjesec } = (await searchParams) ?? {};
  const monthKey =
    typeof mjesec === "string" && /^\d{4}-\d{2}$/.test(mjesec)
      ? mjesec
      : defaultMonthKey;

  const [{ data: profiles }, checkins] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, created_at, group_members!inner(group_id, joined_at)"
      )
      .eq("group_members.group_id", active.id),
    fetchAllCheckins(supabase, undefined, active.id),
  ]);

  const allProfiles = (profiles ?? []).map((p) => ({
    ...p,
    created_at: p.group_members?.[0]?.joined_at ?? p.created_at,
  }));
  const daySets = userDaySets(checkins);

  const ranking = monthRanking({
    profiles: allProfiles,
    daySets,
    monthKey,
    todayKey,
  });

  const mine = ranking.find((e) => e.id === user.id);
  if (!mine) {
    return (
      <EmptyState
        title="Nisi ni postojao taj mjesec."
        body="Kasnije probaj s mjesecom u kojem si stvarno bio u ekipi."
      />
    );
  }

  const losers = worstOf(ranking);
  const winners = bestOf(ranking);
  const isLoser = losers.some((l) => l.id === user.id);
  const isWinner = winners.some((w) => w.id === user.id) && !isLoser;

  // Najduži niz unutar SAMOG mjeseca — filtriraj daySet na mjesečni prozor
  const monthStart = `${monthKey}-01`;
  const monthEnd = lastDayOfMonth(monthKey);
  const fullDaySet = daySets.get(user.id) ?? new Set();
  const monthDaySet = new Set(
    [...fullDaySet].filter((k) => k >= monthStart && k <= monthEnd)
  );
  const { longest: streak } = computeStreaks(monthDaySet, monthEnd);

  const rankSorted = [...ranking].sort(
    (a, b) => b.pct - a.pct || a.username.localeCompare(b.username)
  );
  const rank = rankSorted.findIndex((e) => e.id === user.id) + 1;

  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-8">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          Wrapped<span className="text-accent">.</span>
        </h1>
        <p className="mt-2 text-sm text-muted">{formatMonth(monthKey)}</p>
      </section>

      <WrappedCard
        username={mine.username}
        monthLabel={formatMonth(monthKey)}
        groupName={active.name}
        days={mine.days}
        possible={mine.possible}
        pct={Math.round(mine.pct * 100)}
        rank={rank}
        total={ranking.length}
        streak={streak}
        isLoser={isLoser}
        isWinner={isWinner}
      />
    </main>
  );
}
