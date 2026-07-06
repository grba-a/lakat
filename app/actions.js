"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDayStart } from "@/lib/day";
import { getActiveGroup } from "@/lib/groups";
import { notifyOthers } from "@/lib/push";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function checkIn(photoUrl, coords) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Slika smije biti samo iz vlastite mape u dokazi bucketu — sve drugo
  // se tiho odbacuje (nitko ne podmeće tuđe/vanjske URL-ove)
  let photo_url = null;
  if (typeof photoUrl === "string") {
    const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dokazi/${user.id}/`;
    if (photoUrl.startsWith(prefix)) photo_url = photoUrl;
  }

  // Lokacija je opcionalna; prihvaćaju se samo smislene koordinate
  let lat = null;
  let lng = null;
  if (
    typeof coords?.lat === "number" &&
    typeof coords?.lng === "number" &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    Math.abs(coords.lat) <= 90 &&
    Math.abs(coords.lng) <= 180
  ) {
    lat = coords.lat;
    lng = coords.lng;
  }

  const { active } = await getActiveGroup(supabase, user.id);
  if (!active) {
    return { error: "Nisi ni u jednoj grupi. Kako si uopće ovdje?" };
  }

  const dayStart = getCurrentDayStart();

  // Dupli AKTIVNI checkin u istom danu (u ovoj grupi) blokiramo i na
  // serveru; nakon poništenja se smiješ vratiti (novi red)
  const { data: existing, error: checkError } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
    .eq("group_id", active.id)
    .is("cancelled_at", null)
    .gte("checked_in_at", dayStart.toISOString())
    .limit(1);

  if (checkError) {
    return { error: `Nešto je puklo: ${checkError.message}` };
  }
  if (existing?.length) {
    return { already: true };
  }

  const { error } = await supabase
    .from("checkins")
    .insert({ user_id: user.id, group_id: active.id, photo_url, lat, lng });
  if (error) {
    return { error: `Checkin nije prošao: ${error.message}` };
  }

  // Push ostalima — ne smije srušiti checkin ako slanje pukne
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    await notifyOthers(user.id, profile?.username ?? "Netko");
  } catch {
    // ignoriraj: checkin je prošao, obavijesti su best-effort
  }

  return { ok: true };
}

const REACTION_EMOJI = ["🔥", "🤮", "😂", "🫡", "🍺"];

// Reakcija na sliku: ista = makni (toggle), druga = pregazi
export async function react(checkinId, emoji) {
  if (!REACTION_EMOJI.includes(emoji)) {
    return { error: "Taj emoji ne postoji u ponudi, hakeru." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Grupa reakcije = grupa slike na koju se reagira (RLS pušta samo
  // slike iz vlastitih grupa, pa je ovo ujedno i provjera članstva)
  const { data: checkin } = await supabase
    .from("checkins")
    .select("group_id")
    .eq("id", checkinId)
    .maybeSingle();
  if (!checkin) {
    return { error: "Ta slika ne postoji ili nije iz tvoje grupe." };
  }

  const { data: existing } = await supabase
    .from("reactions")
    .select("id, emoji")
    .eq("checkin_id", checkinId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.emoji === emoji) {
    const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
    if (error) return { error: `Nije prošlo: ${error.message}` };
    return { ok: true, removed: true };
  }

  const { error } = await supabase
    .from("reactions")
    .upsert(
      { checkin_id: checkinId, user_id: user.id, group_id: checkin.group_id, emoji },
      { onConflict: "checkin_id,user_id" }
    );
  if (error) return { error: `Nije prošlo: ${error.message}` };
  return { ok: true };
}

const NAJAVA_TRAJANJE_MS = 45 * 60 * 1000;

// "Stižem." — najava dolaska, push ekipi, istekne za 45 min
export async function najaviDolazak() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active: grupa } = await getActiveGroup(supabase, user.id);
  if (!grupa) {
    return { error: "Nisi ni u jednoj grupi. Kamo točno stižeš?" };
  }

  const dayStart = getCurrentDayStart();

  const { data: active } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
    .eq("group_id", grupa.id)
    .is("cancelled_at", null)
    .gte("checked_in_at", dayStart.toISOString())
    .limit(1);
  if (active?.length) {
    return { error: "Već si za šankom, kamo točno stižeš?" };
  }

  const since = new Date(Date.now() - NAJAVA_TRAJANJE_MS).toISOString();
  const { data: recent } = await supabase
    .from("najave")
    .select("id")
    .eq("user_id", user.id)
    .eq("group_id", grupa.id)
    .gte("created_at", since)
    .limit(1);
  if (recent?.length) {
    return { already: true };
  }

  const { error } = await supabase
    .from("najave")
    .insert({ user_id: user.id, group_id: grupa.id });
  if (error) {
    return { error: `Najava nije prošla: ${error.message}` };
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    await notifyOthers(
      user.id,
      profile?.username ?? "Netko",
      `${profile?.username ?? "Netko"} kreće prema šanku. (Laže, kasnit će pola sata, klasika.)`
    );
  } catch {
    // najava je prošla, push je best-effort
  }

  return { ok: true };
}

export async function cancelCheckIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveGroup(supabase, user.id);
  if (!active) {
    return { error: "Nisi ni u jednoj grupi. Od čega bježiš?" };
  }

  const dayStart = getCurrentDayStart();

  const { data: rows, error: findError } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
    .eq("group_id", active.id)
    .is("cancelled_at", null)
    .gte("checked_in_at", dayStart.toISOString())
    .order("checked_in_at", { ascending: false })
    .limit(1);

  if (findError) {
    return { error: `Nešto je puklo: ${findError.message}` };
  }
  if (!rows?.length) {
    return { error: "Nemaš aktivan check-in. Od čega bježiš?" };
  }

  const { error } = await supabase
    .from("checkins")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", rows[0].id);

  if (error) {
    return { error: `Poništavanje nije prošlo: ${error.message}` };
  }
  return { ok: true };
}
