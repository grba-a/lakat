import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDayStart, getDayKey } from "@/lib/day";
import { fetchAllCheckins } from "@/lib/checkins";
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

  const dayStart = getCurrentDayStart();
  const [{ data: profiles }, { data: checkins }, { data: memories }, allCheckins, ...flashbackResults] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, avatar_url, created_at")
        .order("username"),
      supabase
        .from("checkins")
        .select("id, user_id, checked_in_at, cancelled_at, photo_url")
        .gte("checked_in_at", dayStart.toISOString())
        .order("checked_in_at", { ascending: true }),
      supabase
        .from("checkins")
        .select("id, user_id, checked_in_at, photo_url")
        .not("photo_url", "is", null)
        .order("checked_in_at", { ascending: false })
        .limit(30),
      fetchAllCheckins(supabase),
      ...FLASHBACKS.map(({ months }) => {
        const start = shiftMonths(dayStart, months);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        return supabase
          .from("checkins")
          .select("id, user_id, checked_in_at, photo_url")
          .not("photo_url", "is", null)
          .gte("checked_in_at", start.toISOString())
          .lt("checked_in_at", end.toISOString());
      }),
    ]);

  const allProfiles = profiles ?? [];
  const usernames = new Map(allProfiles.map((p) => [p.id, p.username]));

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

  const memoryItems = (memories ?? []).map((m) => ({
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
        profiles={allProfiles}
        initialCheckins={checkins ?? []}
        currentUserId={user.id}
        titles={titles}
      />
      <Memorije items={memoryItems} flashbacks={flashbackItems} />
      <InstallHint />
    </main>
  );
}
