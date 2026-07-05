import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllCheckins } from "@/lib/checkins";
import { getDayKey } from "@/lib/day";
import {
  userDaySets,
  monthRanking,
  worstOf,
  monthOf,
  nextMonth,
} from "@/lib/stats";
import Avatar from "../avatar";

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

export default async function ShamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profiles }, checkins] = await Promise.all([
    supabase.from("profiles").select("id, username, created_at, avatar_url"),
    fetchAllCheckins(supabase),
  ]);

  const allProfiles = profiles ?? [];
  const daySets = userDaySets(checkins);
  const todayKey = getDayKey(new Date());
  const currentMonth = monthOf(todayKey);

  const ranking = monthRanking({
    profiles: allProfiles,
    daySets,
    monthKey: currentMonth,
    todayKey,
  });
  const losers = worstOf(ranking);

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
  const archive = months.map((monthKey) => ({
    monthKey,
    losers: worstOf(
      monthRanking({ profiles: allProfiles, daySets, monthKey, todayKey })
    ),
  }));

  return (
    <main className="flex flex-1 flex-col">
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

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Rang srama · {formatMonth(currentMonth)}
        </h2>
        <ul className="stagger mt-4 flex flex-col gap-2">
          {ranking.map((entry, i) => {
            const isLoser = losers.some((l) => l.id === entry.id);
            return (
              <li
                key={entry.id}
                className={`surface-2 flex h-14 items-center justify-between rounded-row px-4 ${
                  isLoser ? "border-danger/30 bg-danger/[0.08]" : ""
                }`}
                style={{ "--stagger-i": Math.min(i, 8) }}
              >
                <span className="flex items-center gap-3 font-bold">
                  <span className="w-5 text-sm text-muted">{i + 1}.</span>
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
              </li>
            );
          })}
        </ul>
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
            {archive.map(({ monthKey, losers: monthLosers }, i) => (
              <li
                key={monthKey}
                className="surface-2 flex h-14 items-center justify-between rounded-row px-4"
                style={{ "--stagger-i": Math.min(i, 8) }}
              >
                <span className="text-sm capitalize text-muted">
                  {formatMonth(monthKey)}
                </span>
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
                    ? monthLosers.map((l) => l.username).join(" & ")
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
