"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAP_EMOJIS } from "@/lib/map-emojis";

// Postavi marker-emoji na karti. null = nasumično (stabilno po korisniku).
export async function setMapEmoji(emoji) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Samo iz kurirane liste ili null; sve drugo se tiho odbacuje na null
  const value = emoji && MAP_EMOJIS.includes(emoji) ? emoji : null;

  const { error } = await supabase
    .from("profiles")
    .update({ map_emoji: value })
    .eq("id", user.id);
  if (error) return { error: `Nije prošlo: ${error.message}` };

  revalidatePath("/mapa");
  revalidatePath("/profil/postavke");
  return { ok: true };
}
