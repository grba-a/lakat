import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser, getActiveGroupFor } from "@/lib/auth";
import { fetchAllCheckins } from "@/lib/checkins";
import { getCurrentDayStart, getDayKey } from "@/lib/day";
import { userDaySets, computeStreaks, countableDays, titleFor, monthOf } from "@/lib/stats";
import { fetchAllDrinks, favoriteDrink } from "@/lib/drinks";
import { fetchPouzdanost } from "@/lib/pouzdanost";
import PouzdanostCard from "../pouzdanost-card";
import Heatmap from "../heatmap";
import Galerija from "../galerija";
import AvatarUploader from "./avatar-uploader";
import BadgesGrid from "./badges-grid";

const dateFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function comment(pct) {
  if (pct >= 80) return "Praktički inventar kafane. Svaka čast.";
  if (pct >= 50) return "Solidno. Šank te prepoznaje.";
  if (pct >= 25) return "Mlako. Ekipa počinje zaboravljati kako izgledaš.";
  return "Sramota. Ekipa te vodi kao nestalu osobu.";
}

function drinkComment(total) {
  if (total >= 100) return "Jetra ti je službeno dala otkaz.";
  if (total >= 50) return "Poluvrijeme, a već si legenda.";
  if (total > 0) return "Skromno, ali časno.";
  return "Trijezan kao suza. Za sada.";
}

export default async function ProfilPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // Sve na profilu (statistika, heatmap, galerija) živi u aktivnoj grupi
  const { active } = await getActiveGroupFor(user.id);

  const [{ data: profile }, checkins, { data: photos }, { data: membership }, drinkRows] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("username, created_at, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      fetchAllCheckins(supabase, user.id, active?.id),
      supabase
        .from("checkins")
        .select("id, checked_in_at, photo_url, thumb_url")
        .eq("user_id", user.id)
        .eq("group_id", active?.id ?? "00000000-0000-0000-0000-000000000000")
        .not("photo_url", "is", null)
        .order("checked_in_at", { ascending: false })
        .limit(60),
      active
        ? supabase
            .from("group_members")
            .select("joined_at")
            .eq("group_id", active.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      fetchAllDrinks(supabase, user.id, active?.id),
    ]);

  const pouzdanost = active
    ? await fetchPouzdanost(supabase, user.id, active.id)
    : { total: 0, held: 0 };

  const daySet = userDaySets(checkins).get(user.id) ?? new Set();
  const todayKey = getDayKey(new Date());
  // Postotak se računa od ulaska u aktivnu grupu (staroj ekipi je to
  // isto što i registracija)
  const regKey = getDayKey(
    membership?.joined_at ?? profile?.created_at ?? new Date()
  );
  const possible = countableDays(regKey, todayKey);
  const total = daySet.size;
  const pct = possible > 0 ? Math.round((total / possible) * 100) : 0;
  const { current, longest } = computeStreaks(daySet, todayKey);
  const title = titleFor(current);

  const stats = [
    { value: total, label: "dolazaka" },
    { value: `${pct}%`, label: "aktivnost" },
    { value: current, label: "streak sad" },
    { value: longest, label: "najduži streak" },
  ];

  const dayStartIso = getCurrentDayStart().toISOString();
  const currentMonthKey = monthOf(todayKey);
  const tonightDrinks = drinkRows.filter((d) => d.logged_at >= dayStartIso).length;
  const monthDrinks = drinkRows.filter(
    (d) => monthOf(getDayKey(d.logged_at)) === currentMonthKey
  ).length;
  const allTimeDrinks = drinkRows.length;
  const favDrink = favoriteDrink(drinkRows);

  const drinkStats = [
    { value: tonightDrinks, label: "večeras" },
    { value: monthDrinks, label: "ovaj mjesec" },
    { value: allTimeDrinks, label: "ukupno" },
    { value: favDrink ? `${favDrink.emoji} ${favDrink.label}` : "—", label: "omiljeno piće" },
  ];

  return (
    <main className="flex flex-1 flex-col">
      <section className="relative mt-8 flex items-center gap-5">
        <Link
          href="/profil/postavke"
          aria-label="Postavke"
          className="pressable absolute -top-2 right-0 rounded-full p-2 text-accent/70 active:bg-white/5"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          </svg>
        </Link>
        <AvatarUploader
          userId={user.id}
          username={profile?.username}
          avatarUrl={profile?.avatar_url}
        />
        <div>
          <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
            {profile?.username ?? "Bezimeni"}
            <span className="text-accent">.</span>
          </h1>
          {title && (
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-accent">
              {title}
            </p>
          )}
          <p className="mt-3 text-sm text-muted">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
            U ekipi od{" "}
            {dateFmt.format(
              new Date(membership?.joined_at ?? profile?.created_at ?? Date.now())
            )}
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

      <PouzdanostCard total={pouzdanost.total} held={pouzdanost.held} own />

      <h2 className="mt-10 text-xs font-bold uppercase tracking-widest text-muted">
        Pijanstvo
      </h2>
      <section className="stagger mt-4 grid grid-cols-2 gap-3">
        {drinkStats.map((stat, i) => (
          <div
            key={stat.label}
            className="surface-2 rounded-card px-4 py-5 shadow-soft"
            style={{ "--stagger-i": i }}
          >
            <p className="font-display text-2xl leading-none text-accent">
              {stat.value}
            </p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted">
              {stat.label}
            </p>
          </div>
        ))}
      </section>
      <p className="mt-3 text-sm text-muted">{drinkComment(allTimeDrinks)}</p>

      <Link
        href="/profil/wrapped"
        className="glass pressable-soft mt-6 flex items-center justify-between gap-3 rounded-card px-5 py-4"
      >
        <span className="font-display text-xl uppercase leading-none tracking-wide">
          Lakat Wrapped<span className="text-accent">.</span>
        </span>
        <span className="shrink-0 text-2xl text-accent">→</span>
      </Link>

      <Heatmap daySet={daySet} todayKey={todayKey} />

      {active && <BadgesGrid userId={user.id} groupId={active.id} />}

      <Galerija items={photos ?? []} own />
    </main>
  );
}
