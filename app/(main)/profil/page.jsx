import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllCheckins } from "@/lib/checkins";
import { getDayKey } from "@/lib/day";
import { userDaySets, computeStreaks, daysBetween } from "@/lib/stats";

const dateFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function comment(pct) {
  if (pct >= 80) return "Praktički inventar kafića. Svaka čast.";
  if (pct >= 50) return "Solidno. Šank te prepoznaje.";
  if (pct >= 25) return "Mlako. Ekipa počinje zaboravljati kako izgledaš.";
  return "Sramota. Titula pičke mjeseca ti maše iz daljine.";
}

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, checkins] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    fetchAllCheckins(supabase, user.id),
  ]);

  const daySet = userDaySets(checkins).get(user.id) ?? new Set();
  const todayKey = getDayKey(new Date());
  const regKey = getDayKey(profile?.created_at ?? new Date());
  const possible = daysBetween(regKey, todayKey);
  const total = daySet.size;
  const pct = possible > 0 ? Math.round((total / possible) * 100) : 0;
  const { current, longest } = computeStreaks(daySet, todayKey);

  const stats = [
    { value: total, label: "dolazaka" },
    { value: `${pct}%`, label: "od registracije" },
    { value: current, label: "streak sad" },
    { value: longest, label: "najduži streak" },
  ];

  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-8">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          {profile?.username ?? "Bezimeni"}
          <span className="text-accent">.</span>
        </h1>
        <p className="mt-3 border-l-4 border-accent pl-3 text-sm text-muted">
          U ekipi od {dateFmt.format(new Date(profile?.created_at ?? Date.now()))}
        </p>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface px-4 py-5">
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
    </main>
  );
}
