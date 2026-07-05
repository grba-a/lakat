"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDayStart } from "@/lib/day";
import { notifyOthers } from "@/lib/push";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function checkIn(photoUrl) {
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

  const dayStart = getCurrentDayStart();

  // Dupli AKTIVNI checkin u istom danu blokiramo i na serveru; nakon
  // poništenja se smiješ vratiti (novi red)
  const { data: existing, error: checkError } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
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
    .insert({ user_id: user.id, photo_url });
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

export async function cancelCheckIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dayStart = getCurrentDayStart();

  const { data: rows, error: findError } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
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
