import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDayStart } from "@/lib/day";
import MapClient from "./map-client";

export default async function MapaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dayStart = getCurrentDayStart();
  const [{ data: profiles }, { data: checkins }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url"),
    supabase
      .from("checkins")
      .select("id, user_id, checked_in_at, cancelled_at, photo_url, lat, lng")
      .gte("checked_in_at", dayStart.toISOString())
      .order("checked_in_at", { ascending: true }),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-8">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          Gdje su<span className="text-accent">?</span>
        </h1>
        <p className="mt-3 text-sm text-muted">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
          Tko se danas checkirao i odakle. Resetira se u 06:00.
        </p>
      </section>

      <MapClient
        profiles={profiles ?? []}
        initialCheckins={checkins ?? []}
      />
    </main>
  );
}
