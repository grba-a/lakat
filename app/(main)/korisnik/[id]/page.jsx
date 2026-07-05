import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllCheckins } from "@/lib/checkins";
import { getDayKey } from "@/lib/day";
import { userDaySets, computeStreaks, daysBetween, titleFor } from "@/lib/stats";
import Avatar from "../../avatar";
import Heatmap from "../../heatmap";

const dateFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function comment(pct) {
  if (pct >= 80) return "Praktički inventar kafića. Svaka čast.";
  if (pct >= 50) return "Solidno. Šank ga prepoznaje.";
  if (pct >= 25) return "Mlako. Ekipa mu počinje zaboravljati lice.";
  return "Sramota. Titula pičke mjeseca mu maše iz daljine.";
}

export default async function KorisnikPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.id === id) redirect("/profil");

  const [{ data: profile }, checkins] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, created_at, avatar_url")
      .eq("id", id)
      .maybeSingle(),
    fetchAllCheckins(supabase, id),
  ]);

  if (!profile) notFound();

  const daySet = userDaySets(checkins).get(id) ?? new Set();
  const todayKey = getDayKey(new Date());
  const regKey = getDayKey(profile.created_at);
  const possible = daysBetween(regKey, todayKey);
  const total = daySet.size;
  const pct = possible > 0 ? Math.round((total / possible) * 100) : 0;
  const { current, longest } = computeStreaks(daySet, todayKey);
  const title = titleFor(current);

  const stats = [
    { value: total, label: "dolazaka" },
    { value: `${pct}%`, label: "od registracije" },
    { value: current, label: "streak sad" },
    { value: longest, label: "najduži streak" },
  ];

  return (
    <main className="flex flex-1 flex-col">
      <Link
        href="/"
        className="pressable mt-6 inline-flex w-fit items-center gap-1 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted active:bg-white/5"
      >
        ← Šank
      </Link>

      <section className="mt-4 flex items-center gap-5">
        <Avatar username={profile.username} avatarUrl={profile.avatar_url} size={80} />
        <div>
          <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
            {profile.username}
            <span className="text-accent">.</span>
          </h1>
          {title && (
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-accent">
              {title}
            </p>
          )}
          <p className="mt-3 text-sm text-muted">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
            U ekipi od {dateFmt.format(new Date(profile.created_at))}
          </p>
        </div>
      </section>

      <section className="stagger mt-10 grid grid-cols-2 gap-3">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="surface-2 rounded-card px-4 py-5 shadow-soft"
            style={{ "--stagger-i": i }}
          >
            <p className="font-display text-4xl leading-none text-accent">
              {stat.value}
            </p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      <p className="mt-6 text-sm text-muted">{comment(pct)}</p>

      <Heatmap daySet={daySet} todayKey={todayKey} />
    </main>
  );
}
