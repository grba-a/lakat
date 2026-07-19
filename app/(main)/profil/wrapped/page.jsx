import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { friendIdsOf } from "@/lib/friends";
import { fetchAllCheckins } from "@/lib/checkins";
import { getDayKey } from "@/lib/day";
import {
  userDaySets,
  monthRanking,
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

  // 3.0: obračun ide po frend krugu (ja + pajdaši), staž od registracije
  const friendIds = await friendIdsOf(supabase, user.id);
  const [{ data: profiles }, checkins] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, created_at")
      .in("id", [user.id, ...friendIds]),
    fetchAllCheckins(supabase),
  ]);

  const allProfiles = profiles ?? [];
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

  // Inventar bez ijednog dolaska nije inventar — 0% se ne slavi
  const winners = bestOf(ranking).filter((w) => w.days > 0);
  const isWinner = winners.some((w) => w.id === user.id);

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
        days={mine.days}
        possible={mine.possible}
        pct={Math.round(mine.pct * 100)}
        rank={rank}
        total={ranking.length}
        streak={streak}
        isWinner={isWinner}
      />
    </main>
  );
}
