import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { getCurrentDayStart } from "@/lib/day";
import { friendIdsOf } from "@/lib/friends";
import MapClient from "./map-client";
import BrandPunct from "@/app/brand-punct";

export default async function MapaPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const dayStart = getCurrentDayStart();

  // 3.0: markeri su ja + frendovi (RLS ionako ne pušta dalje); partner
  // kafići se prikazuju svima (zelena zastavica)
  const friendIds = await friendIdsOf(supabase, user.id);
  const [{ data: profiles }, { data: checkins }, { data: drinks }, { data: kafici }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", [user.id, ...friendIds]),
      supabase
        .from("checkins")
        .select("id, user_id, checked_in_at, cancelled_at, photo_url, thumb_url, lat, lng")
        .gte("checked_in_at", dayStart.toISOString())
        .order("checked_in_at", { ascending: true }),
      supabase
        .from("drinks")
        .select("id, user_id, drink_type, logged_at")
        .gte("logged_at", dayStart.toISOString())
        .order("logged_at", { ascending: true }),
      supabase
        .from("kafici")
        .select("id, name, lat, lng, partner")
        .eq("partner", true),
    ]);

  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-8">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          Gdje su<BrandPunct>?</BrandPunct>
        </h1>
        <p className="mt-3 text-sm text-muted">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
          Tko je od pajdaša danas bio za šankom i odakle.
        </p>
      </section>

      <MapClient
        profiles={profiles ?? []}
        initialCheckins={checkins ?? []}
        initialDrinks={drinks ?? []}
        kafici={kafici ?? []}
      />
    </main>
  );
}
