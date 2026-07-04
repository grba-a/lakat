"use server";

import { createClient } from "@/lib/supabase/server";

export async function savePushSubscription(subscription) {
  if (!subscription?.endpoint) {
    return { error: "Neispravan subscription." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi ulogiran." };

  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ user_id: user.id, subscription });

  // 23505 = već postoji isti subscription, i to je OK
  if (error && error.code !== "23505") {
    return { error: `Spremanje nije prošlo: ${error.message}` };
  }
  return { ok: true };
}

export async function deletePushSubscription(endpoint) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi ulogiran." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("subscription->>endpoint", endpoint);

  if (error) {
    return { error: `Brisanje nije prošlo: ${error.message}` };
  }
  return { ok: true };
}
