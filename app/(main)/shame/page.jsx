import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser, getActiveGroupFor } from "@/lib/auth";
import { fetchAllCheckins } from "@/lib/checkins";
import { getDayKey } from "@/lib/day";
import {
  userDaySets,
  monthRanking,
  worstOf,
  bestOf,
  monthOf,
  nextMonth,
  allTimeStats,
} from "@/lib/stats";
import { evaluateBadges } from "@/lib/badges";
import Avatar from "../avatar";
import ShameTabs from "./tabs";
import ShameBadgeToast from "./shame-badge-toast";

const monthFmt = new Intl.DateTimeFormat("hr-HR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatMonth(monthKey) {
  return monthFmt.format(new Date(`${monthKey}-01T00:00:00Z`));
}

function formatPct(entry) {
  return `${Math.round(entry.pct * 100)}%`;
}

// Inventar mjeseca: tko ima dolazaka i nije među pičkama tog mjeseca
function winnersOf(rank, losers) {
  return bestOf(rank).filter(
    (w) => w.days > 0 && !losers.some((l) => l.id === w.id)
  );
}

// Rang srama pokazuje samo podij — zlato za najveću pičku
const MEDALS = ["🥇", "🥈", "🥉"];

export default async function ShamePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const { active } = await getActiveGroupFor(user.id);
  if (!active) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="glass mt-10 rounded-card p-5 text-center">
          <p className="font-display text-2xl uppercase tracking-wide">
            Nisi u grupi.
          </p>
          <p className="mt-2 text-sm text-muted">
            Uđi u grupu da vidiš tko je pička mjeseca.
          </p>
          <Link
            href="/"
            className="pressable-soft mt-5 inline-flex h-12 items-center justify-center rounded-button bg-accent px-6 font-display text-lg uppercase tracking-wide text-black"
          >
            Uđi u grupu
          </Link>
        </div>
      </main>
    );
  }

  const [{ data: profiles }, checkins] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, created_at, avatar_url, group_members!inner(group_id, joined_at)"
      )
      .eq("group_members.group_id", active.id),
    fetchAllCheckins(supabase, undefined, active.id),
  ]);

  // Sram se računa od ulaska u grupu, ne od registracije računa
  const allProfiles = (profiles ?? []).map((p) => ({
    ...p,
    created_at: p.group_members?.[0]?.joined_at ?? p.created_at,
  }));
  const daySets = userDaySets(checkins);
  const todayKey = getDayKey(new Date());
  const currentMonth = monthOf(todayKey);

  function profileHref(id) {
    return id === user.id ? "/profil" : `/korisnik/${id}`;
  }

  const ranking = monthRanking({
    profiles: allProfiles,
    daySets,
    monthKey: currentMonth,
    todayKey,
  });
  const losers = worstOf(ranking);
  // Inventar bez ijednog dolaska nije inventar — 0% se ne slavi
  const winners = winnersOf(ranking, losers);
  // Novi članovi (grace period) — prikazani odvojeno, bez postotka srama
  const noviClanovi = ranking.filter((e) => e.isNew);

  // Arhiva: svaki prošli mjesec od najranije registracije, najnoviji prvi
  const months = [];
  if (allProfiles.length) {
    const firstMonth = monthOf(
      allProfiles.map((p) => getDayKey(p.created_at)).sort()[0]
    );
    for (let m = firstMonth; m < currentMonth; m = nextMonth(m)) {
      months.push(m);
    }
    months.reverse();
  }
  const archive = months.map((monthKey) => {
    const monthRank = monthRanking({
      profiles: allProfiles,
      daySets,
      monthKey,
      todayKey,
    });
    const monthLosers = worstOf(monthRank);
    return {
      monthKey,
      losers: monthLosers,
      winners: winnersOf(monthRank, monthLosers),
    };
  });

  const allTime = allTimeStats({ profiles: allProfiles, daySets, archive, todayKey });

  // Bedževi za "koliko puta pička mjeseca" — nula dodatnih upita, koristi
  // brojku koju je allTimeStats već izračunao za trenutnog gledatelja
  let newBadges = [];
  try {
    const viewerPickaCount =
      allTime.pickaLeaders.find((p) => p.id === user.id)?.value ?? 0;
    newBadges = await evaluateBadges({
      admin: createAdminClient(),
      userId: user.id,
      groupId: active.id,
      trigger: "shame_visit",
      context: { pickaCount: viewerPickaCount },
    });
  } catch {
    // ignoriraj: /shame se svejedno mora prikazati
  }

  const monthView = (
    <>
      <section className="mt-8">
        <h1 className="text-xs font-bold uppercase tracking-widest text-danger">
          Pička mjeseca (zasad)
        </h1>
        {losers.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Još nema podataka. Mjesec je mlad, sram tek stiže.
          </p>
        ) : (
          <div className="mt-3 rounded-card border border-danger/30 bg-danger/10 px-5 py-5 shadow-glow-danger backdrop-blur-xl">
            <p className="font-display text-5xl uppercase leading-none tracking-tight text-danger">
              {losers.map((l) => l.username).join(" & ")}
            </p>
            <p className="mt-2 text-sm text-muted">
              {losers.length > 1 ? "Dijele titulu s" : "S jadnih"}{" "}
              <span className="font-bold text-danger">{formatPct(losers[0])}</span>{" "}
              dolazaka u {formatMonth(currentMonth)}
            </p>
          </div>
        )}
      </section>

      {winners.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-accent">
            Inventar mjeseca 🏆
          </h2>
          <div className="mt-3 rounded-card border border-accent/30 bg-accent/10 px-5 py-5 shadow-glow">
            <p className="font-display text-4xl uppercase leading-none tracking-tight text-accent">
              {winners.map((w) => w.username).join(" & ")}
            </p>
            <p className="mt-2 text-sm text-muted">
              {winners.length > 1 ? "Dijele šank s" : "Drži šank s"}{" "}
              <span className="font-bold text-accent">{formatPct(winners[0])}</span>{" "}
              dolazaka. {winners.length > 1 ? "Koji ste vi pjanci e." : "Koji si ti pjanac e."}
            </p>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Rang srama · {formatMonth(currentMonth)}
        </h2>
        <ul className="stagger mt-4 flex flex-col gap-2">
          {ranking
            .filter((e) => !e.isNew)
            .slice(0, 3)
            .map((entry, i) => {
              const isLoser = losers.some((l) => l.id === entry.id);
              return (
                <li
                  key={entry.id}
                  className={`surface-2 pressable-soft rounded-row ${
                    isLoser ? "border-danger/30 bg-danger/[0.08]" : ""
                  }`}
                  style={{ "--stagger-i": Math.min(i, 8) }}
                >
                  <Link
                    href={profileHref(entry.id)}
                    className="flex h-14 items-center justify-between px-4"
                  >
                    <span className="flex items-center gap-3 font-bold">
                      <span className="w-6 text-lg">{MEDALS[i]}</span>
                      <Avatar
                        username={entry.username}
                        avatarUrl={entry.avatar_url}
                        size={32}
                        className={isLoser ? "border-danger/40" : ""}
                      />
                      {entry.username}
                    </span>
                    <span
                      className={`text-xs font-bold uppercase tracking-widest ${
                        isLoser ? "text-danger" : "text-muted"
                      }`}
                    >
                      {entry.days}/{entry.possible} · {formatPct(entry)}
                    </span>
                  </Link>
                </li>
              );
            })}
        </ul>
        {noviClanovi.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {noviClanovi.map((entry) => (
              <li key={entry.id} className="surface-2 rounded-row opacity-60">
                <Link
                  href={profileHref(entry.id)}
                  className="flex h-14 items-center justify-between px-4"
                >
                  <span className="flex items-center gap-3 font-bold">
                    <Avatar
                      username={entry.username}
                      avatarUrl={entry.avatar_url}
                      size={32}
                    />
                    {entry.username}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted">
                    Novi · pošteda još{" "}
                    {entry.graceDaysLeft === 1
                      ? "1 dan"
                      : `${entry.graceDaysLeft} dana`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Arhiva srama
        </h2>
        {archive.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Prazna. Nitko još nije službeno proglašen, ali samo vi čekajte.
          </p>
        ) : (
          <ul className="stagger mt-4 flex flex-col gap-2">
            {archive.map(({ monthKey, losers: monthLosers, winners: monthWinners }, i) => (
              <li
                key={monthKey}
                className="surface-2 flex min-h-14 items-center justify-between rounded-row px-4 py-2"
                style={{ "--stagger-i": Math.min(i, 8) }}
              >
                <span className="text-sm capitalize text-muted">
                  {formatMonth(monthKey)}
                </span>
                <span className="flex flex-col items-end gap-1">
                  {monthWinners.length > 0 && (
                    <span className="text-xs font-bold text-accent">
                      🏆 {monthWinners.map((w) => w.username).join(" & ")}
                    </span>
                  )}
                  <span className="flex items-center gap-2 font-bold text-danger">
                    {monthLosers.length > 0 && (
                      <span className="flex -space-x-1.5">
                        {monthLosers.map((l) => (
                          <Avatar
                            key={l.id}
                            username={l.username}
                            avatarUrl={l.avatar_url}
                            size={24}
                            className="border-danger/40"
                          />
                        ))}
                      </span>
                    )}
                    {monthLosers.length
                      ? `💩 ${monthLosers.map((l) => l.username).join(" & ")}`
                      : "—"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );

  const allTimeView = (
    <>
      <section className="mt-8">
        <h1 className="text-xs font-bold uppercase tracking-widest text-accent">
          Rekorder
        </h1>
        {allTime.streakLeaders.length === 0 || allTime.streakLeaders[0].value === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nitko još nema streak vrijedan spomena.
          </p>
        ) : (
          <div className="mt-3 rounded-card border border-accent/30 bg-accent/10 px-5 py-5 shadow-glow">
            <p className="font-display text-4xl uppercase leading-none tracking-tight text-accent">
              {allTime.streakLeaders
                .filter((l) => l.value === allTime.streakLeaders[0].value)
                .map((l) => l.username)
                .join(" & ")}
            </p>
            <p className="mt-2 text-sm text-muted">
              Najdulji streak ikad:{" "}
              <span className="font-bold text-accent">
                {allTime.streakLeaders[0].value} dana
              </span>
            </p>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Ukupno dolazaka svih vremena
        </h2>
        {allTime.attendanceLeaders.every((l) => l.value === 0) ? (
          <p className="mt-4 text-sm text-muted">Još nema dolazaka. Sve tek počinje.</p>
        ) : (
          <ul className="stagger mt-4 flex flex-col gap-2">
            {allTime.attendanceLeaders.map((entry, i) => (
              <li
                key={entry.id}
                className="surface-2 pressable-soft rounded-row"
                style={{ "--stagger-i": Math.min(i, 8) }}
              >
                <Link
                  href={profileHref(entry.id)}
                  className="flex h-14 items-center justify-between px-4"
                >
                  <span className="flex items-center gap-3 font-bold">
                    <span className="w-5 text-sm text-muted">{i + 1}.</span>
                    <Avatar
                      username={entry.username}
                      avatarUrl={entry.avatar_url}
                      size={32}
                    />
                    {entry.username}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted">
                    {entry.value}{" "}
                    {entry.value === 1
                      ? "dolazak"
                      : entry.value % 100 >= 2 && entry.value % 100 <= 4
                        ? "dolaska"
                        : "dolazaka"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-danger">
          Koliko puta pička mjeseca
        </h2>
        {allTime.pickaLeaders.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nitko još nije okrunjen. Arhiva je prazna ili prekratka.
          </p>
        ) : (
          <ul className="stagger mt-4 flex flex-col gap-2">
            {allTime.pickaLeaders.map((entry, i) => (
              <li
                key={entry.id}
                className="surface-2 pressable-soft rounded-row border-danger/30 bg-danger/[0.08]"
                style={{ "--stagger-i": Math.min(i, 8) }}
              >
                <Link
                  href={profileHref(entry.id)}
                  className="flex h-14 items-center justify-between px-4"
                >
                  <span className="flex items-center gap-3 font-bold">
                    <Avatar
                      username={entry.username}
                      avatarUrl={entry.avatar_url}
                      size={32}
                      className="border-danger/40"
                    />
                    {entry.username}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-danger">
                    {entry.value}×
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );

  return (
    <main className="flex flex-1 flex-col">
      <ShameBadgeToast initialBadges={newBadges} />
      <ShameTabs month={monthView} allTime={allTimeView} />
    </main>
  );
}
