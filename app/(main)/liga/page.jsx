import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser, getActiveGroupFor } from "@/lib/auth";
import { getDayKey } from "@/lib/day";
import { addDays } from "@/lib/stats";
import {
  computeLiga,
  weekStartKey,
  bodovaLabel,
  BOD_DOLAZAK,
  BOD_ODAZIV,
} from "@/lib/liga";

const dateFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "UTC",
  day: "numeric",
  month: "numeric",
});

function formatDayKey(dayKey) {
  return dateFmt.format(new Date(`${dayKey}T00:00:00Z`));
}

const MEDALS = ["🥇", "🥈", "🥉"];

// Liga ekipa: grupe se natječu tjedno u okupljanju. Vidljivo je SAMO ime
// grupe + bodovi + broj članova — tuđe slike/članovi/lokacije nikad.
export default async function LigaPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveGroupFor(user.id);
  if (!active) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="glass mt-10 rounded-card p-5 text-center">
          <p className="font-display text-2xl uppercase tracking-wide">
            Nisi u grupi.
          </p>
          <p className="mt-2 text-sm text-muted">
            Uđi u grupu pa se natječi s ekipom.
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

  const admin = createAdminClient();
  const todayKey = getDayKey(new Date());
  const weekKey = weekStartKey(todayKey);
  const prevWeekKey = addDays(weekKey, -7);

  const [table, prevTable] = await Promise.all([
    computeLiga({ admin, weekKey }),
    computeLiga({ admin, weekKey: prevWeekKey }),
  ]);

  const myRank = table.findIndex((g) => g.id === active.id) + 1;
  const prevWinners = prevTable.filter(
    (g) => g.points > 0 && g.points === prevTable[0]?.points
  );

  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-8">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          Liga<span className="text-accent">.</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Tjedan {formatDayKey(weekKey)} – {formatDayKey(addDays(weekKey, 6))} ·
          Koja ekipa se najviše druži?
        </p>
      </section>

      {prevWinners.length > 0 && (
        <section className="mt-6">
          <div className="rounded-card border border-accent/30 bg-accent/10 px-5 py-4 shadow-glow">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Prvak prošlog tjedna
            </p>
            <p className="mt-1 font-display text-3xl uppercase leading-none tracking-tight text-accent">
              🏆 {prevWinners.map((g) => g.name).join(" & ")}
            </p>
            <p className="mt-1 text-sm text-muted">
              {bodovaLabel(prevWinners[0].points)}. Skidamo kapu, dižemo čaše.
            </p>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Ovaj tjedan
        </h2>
        {table.every((g) => g.points === 0) ? (
          <p className="mt-4 text-sm text-muted">
            Još nitko nije skupio nijedan bod. Tjedan je mlad, dižite ekipu.
          </p>
        ) : (
          <ul className="stagger mt-4 flex flex-col gap-2">
            {table.map((g, i) => {
              const isMine = g.id === active.id;
              return (
                <li
                  key={g.id}
                  className={`surface-2 rounded-row ${
                    isMine ? "border-accent/40 bg-accent/[0.08]" : ""
                  }`}
                  style={{ "--stagger-i": Math.min(i, 8) }}
                >
                  <div className="flex h-14 items-center justify-between px-4">
                    <span className="flex min-w-0 items-center gap-3 font-bold">
                      <span className="w-7 shrink-0 text-lg">
                        {MEDALS[i] ?? `${i + 1}.`}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className={`truncate ${isMine ? "text-accent" : ""}`}>
                          {g.name}
                          {isMine && " (mi)"}
                        </span>
                        <span className="text-[10px] font-normal uppercase tracking-wider text-muted">
                          {g.memberCount}{" "}
                          {g.memberCount === 1
                            ? "član"
                            : g.memberCount % 100 >= 2 && g.memberCount % 100 <= 4
                              ? "člana"
                              : "članova"}
                          {g.activeCount > 0 && ` · ${g.activeCount} aktivno`}
                        </span>
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-bold uppercase tracking-widest ${
                        isMine ? "text-accent" : "text-muted"
                      }`}
                    >
                      {bodovaLabel(g.points)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {myRank > 3 && (
          <p className="mt-3 text-xs text-muted">
            Vi ste {myRank}. — dovucite još ljudi u ekipu i preteknite ove iznad.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Kako se boduje
        </h2>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
          <li>
            📸 Dolazak (runda sa slikom) —{" "}
            <span className="font-bold text-foreground">+{BOD_DOLAZAK}</span>{" "}
            po članu po danu
          </li>
          <li>
            📣 Došao na saziv —{" "}
            <span className="font-bold text-foreground">+{BOD_ODAZIV}</span>{" "}
            povrh dolaska
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          Liga se resetira ponedjeljkom u 06:00. Više ljudi vani = više bodova.
          Matematika je jednostavna: druži se.
        </p>
      </section>
    </main>
  );
}
