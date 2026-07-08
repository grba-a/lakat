import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDayStart, getDayKey } from "@/lib/day";
import { fetchAllCheckins } from "@/lib/checkins";
import { getActiveGroup } from "@/lib/groups";
import {
  userDaySets,
  computeStreaks,
  titleFor,
  monthRanking,
  worstOf,
  monthOf,
} from "@/lib/stats";
import Sank from "./sank";
import Memorije from "./memorije";
import InstallHint from "./install-hint";

// Flashback: isti datum unazad — dobiva smisao protokom vremena
const FLASHBACKS = [
  { months: 3, label: "prije 3 mjeseca" },
  { months: 6, label: "prije pola godine" },
  { months: 12, label: "prije godinu dana" },
];

function shiftMonths(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Sve na ekranu živi u aktivnoj grupi — prebacivanjem grupe mijenja se
  // popis, slike, statistika, sve
  const { active } = await getActiveGroup(supabase, user.id);
  // Bez profila i/ili grupe (npr. svježi OAuth korisnik) — dovrši prijavu
  if (!active) redirect("/onboarding");

  const dayStart = getCurrentDayStart();
  const [{ data: profiles }, { data: checkins }, allCheckins, ...flashbackResults] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, username, avatar_url, created_at, group_members!inner(group_id, joined_at)"
        )
        .eq("group_members.group_id", active.id)
        .order("username"),
      supabase
        .from("checkins")
        .select("id, user_id, checked_in_at, cancelled_at, photo_url, thumb_url")
        .eq("group_id", active.id)
        .gte("checked_in_at", dayStart.toISOString())
        .order("checked_in_at", { ascending: true }),
      fetchAllCheckins(supabase, undefined, active.id),
      ...FLASHBACKS.map(({ months }) => {
        const start = shiftMonths(dayStart, months);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        return supabase
          .from("checkins")
          .select("id, user_id, checked_in_at, photo_url, thumb_url")
          .eq("group_id", active.id)
          .not("photo_url", "is", null)
          .gte("checked_in_at", start.toISOString())
          .lt("checked_in_at", end.toISOString());
      }),
    ]);

  // Statistika unutar grupe kreće od ulaska u grupu, ne od registracije
  // računa (za staru ekipu su ta dva datuma ista — migracija ih izjednači)
  const allProfiles = (profiles ?? []).map((p) => ({
    ...p,
    created_at: p.group_members?.[0]?.joined_at ?? p.created_at,
  }));
  const usernames = new Map(allProfiles.map((p) => [p.id, p.username]));

  // Reakcije za sve slike na ekranu (današnji popis + flashback)
  // i žive najave dolaska — jedan upit svaka
  const flashbackRows = FLASHBACKS.flatMap((_, i) => flashbackResults[i]?.data ?? []);
  const reactionIds = [
    ...new Set([...(checkins ?? []), ...flashbackRows].map((c) => c.id)),
  ];
  const najavaCutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const [{ data: reactionRows }, { data: najave }] = await Promise.all([
    reactionIds.length
      ? supabase
          .from("reactions")
          .select("checkin_id, user_id, emoji")
          .in("checkin_id", reactionIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("najave")
      .select("id, user_id, created_at")
      .eq("group_id", active.id)
      .gte("created_at", najavaCutoff),
  ]);

  const reactionsByCheckin = {};
  for (const r of reactionRows ?? []) {
    (reactionsByCheckin[r.checkin_id] ??= []).push({
      user_id: r.user_id,
      emoji: r.emoji,
    });
  }

  // Titule: streak po korisniku + kruna za aktualnu pičku mjeseca
  const daySets = userDaySets(allCheckins);
  const todayKey = getDayKey(new Date());
  const losers = worstOf(
    monthRanking({
      profiles: allProfiles,
      daySets,
      monthKey: monthOf(todayKey),
      todayKey,
    })
  );
  const titles = {};
  for (const p of allProfiles) {
    const { current } = computeStreaks(daySets.get(p.id) ?? new Set(), todayKey);
    titles[p.id] = titleFor(current, losers.some((l) => l.id === p.id));
  }

  // Slike dana: dokazne slike iz današnjih check-inova (nakon 06:00 kreće
  // prazan grid), najnovije prve
  const memoryItems = (checkins ?? [])
    .filter((c) => c.photo_url)
    .sort((a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at))
    .map((m) => ({
      ...m,
      username: usernames.get(m.user_id) ?? "Netko",
    }));

  const flashbackItems = FLASHBACKS.flatMap(({ label }, i) =>
    (flashbackResults[i]?.data ?? []).map((m) => ({
      ...m,
      label,
      username: usernames.get(m.user_id) ?? "Netko",
    }))
  );

  return (
    <main className="flex flex-1 flex-col">
      <Sank
        key={active.id}
        groupId={active.id}
        profiles={allProfiles}
        initialCheckins={checkins ?? []}
        currentUserId={user.id}
        titles={titles}
        initialNajave={najave ?? []}
        initialReactions={reactionsByCheckin}
      />
      <Memorije
        key={`memorije-${active.id}`}
        items={memoryItems}
        flashbacks={flashbackItems}
        myId={user.id}
        initialReactions={reactionsByCheckin}
      />
      <InstallHint />
    </main>
  );
}
