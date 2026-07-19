import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import { fetchAllCheckins } from "@/lib/checkins";
import { getDayKey } from "@/lib/day";
import { userDaySets, computeStreaks, countableDays, titleFor } from "@/lib/stats";
import { fetchPouzdanost } from "@/lib/pouzdanost";
import { friendIdsOf } from "@/lib/friends";
import Avatar from "../../avatar";
import PouzdanostCard from "../../pouzdanost-card";
import Heatmap from "../../heatmap";
import AddFriendButton from "./add-friend-button";

const dateFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function comment(pct) {
  if (pct >= 80) return "Praktički inventar kafane. Svaka čast.";
  if (pct >= 50) return "Solidno. Šank ga prepoznaje.";
  if (pct >= 25) return "Mlako. Ekipa mu počinje zaboravljati lice.";
  return "Sramota. Ekipa ga vodi kao nestalu osobu.";
}

export default async function KorisnikPage({ params }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.id === id) redirect("/profil");
  const supabase = await createClient();

  const friendIds = await friendIdsOf(supabase, user.id);
  const jeFrend = friendIds.includes(id);

  // NE-frend: minimalna javna kartica (username + avatar kroz admin
  // klijent — namjerno javno) + gumb za zahtjev. Statistika/slike NIKAD.
  if (!jeFrend) {
    const admin = createAdminClient();
    const { data: target } = await admin
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", id)
      .maybeSingle();
    if (!target) notFound();

    return (
      <main className="mx-auto flex min-h-[60dvh] w-full max-w-sm flex-col items-center justify-center text-center">
        <Avatar username={target.username} avatarUrl={target.avatar_url} size={96} />
        <h1 className="mt-4 font-display text-4xl uppercase leading-none tracking-tight">
          {target.username}
          <span className="text-accent">.</span>
        </h1>
        <p className="mt-3 text-sm text-muted">
          Niste pajdaši, pa je ovo sve što vidiš. Takva su pravila.
        </p>
        <AddFriendButton targetId={target.id} />
      </main>
    );
  }

  // FREND: puni profil (RLS ionako pušta samo frendove)
  const [{ data: profile }, checkins, pouzdanost] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, created_at, avatar_url")
      .eq("id", id)
      .maybeSingle(),
    fetchAllCheckins(supabase, id),
    fetchPouzdanost(supabase, id),
  ]);

  if (!profile) notFound();

  const daySet = userDaySets(checkins).get(id) ?? new Set();
  const todayKey = getDayKey(new Date());
  const regKey = getDayKey(profile.created_at);
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

  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-8 flex items-center gap-5">
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
            Na Laktu od {dateFmt.format(new Date(profile.created_at))}
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

      <PouzdanostCard
        total={pouzdanost.total}
        held={pouzdanost.held}
        own={false}
      />

      <Heatmap daySet={daySet} todayKey={todayKey} />
    </main>
  );
}
