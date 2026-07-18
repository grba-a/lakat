import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser, getActiveGroupFor } from "@/lib/auth";
import { getCurrentDayStart } from "@/lib/day";
import { computeMjesta } from "@/lib/mjesta";
import MapClient from "./map-client";
import BrandPunct from "@/app/brand-punct";

export default async function MapaPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const { active } = await getActiveGroupFor(user.id);
  if (!active) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="glass mt-10 rounded-card p-5 text-center">
          <p className="font-display text-2xl uppercase tracking-wide">
            Nisi u grupi.
          </p>
          <p className="mt-2 text-sm text-muted">
            Uđi u grupu da vidiš gdje ekipa pije.
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

  const dayStart = getCurrentDayStart();
  const [{ data: profiles }, { data: checkins }, { data: drinks }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, avatar_url, group_members!inner(group_id)")
        .eq("group_members.group_id", active.id),
      supabase
        .from("checkins")
        .select("id, user_id, checked_in_at, cancelled_at, photo_url, thumb_url, lat, lng")
        .eq("group_id", active.id)
        .gte("checked_in_at", dayStart.toISOString())
        .order("checked_in_at", { ascending: true }),
      // Marker na karti = zadnje danas logirano piće korisnika
      supabase
        .from("drinks")
        .select("id, user_id, drink_type, logged_at")
        .eq("group_id", active.id)
        .gte("logged_at", dayStart.toISOString())
        .order("logged_at", { ascending: true }),
    ]);

  // Naša mjesta: koje ekipe drže koje lokacije (cross-group, samo imena
  // grupa + broj rundi) — greška ne ruši mapu
  let mjesta = [];
  try {
    mjesta = await computeMjesta({ admin: createAdminClient() });
  } catch {
    // mapa živi i bez mjesta
  }

  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-8">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          Gdje su<BrandPunct>?</BrandPunct>
        </h1>
        <p className="mt-3 text-sm text-muted">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
          Tko je danas bio za šankom i odakle.
        </p>
      </section>

      <MapClient
        key={active.id}
        groupId={active.id}
        profiles={profiles ?? []}
        initialCheckins={checkins ?? []}
        initialDrinks={drinks ?? []}
        mjesta={mjesta}
        myGroupName={active.name}
      />
    </main>
  );
}
