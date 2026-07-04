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

export async function checkIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dayStart = getCurrentDayStart();

  // Dupli checkin u istom danu blokiramo i na serveru, ne samo disabled gumbom
  const { data: existing, error: checkError } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", user.id)
    .gte("checked_in_at", dayStart.toISOString())
    .limit(1);

  if (checkError) {
    return { error: `Nešto je puklo: ${checkError.message}` };
  }
  if (existing?.length) {
    return { already: true };
  }

  const { error } = await supabase.from("checkins").insert({ user_id: user.id });
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
