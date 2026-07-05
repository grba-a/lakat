"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function changeUsername(prevState, formData) {
  const username = formData.get("username")?.toString().trim();

  if (!username) {
    return { error: "Upiši nešto, prazno ime nosi samo pička." };
  }
  if (username.length < 2 || username.length > 24) {
    return { error: "Username mora imati između 2 i 24 znaka." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi ulogiran." };

  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: `"${username}" je već zauzet. Smisli nešto originalnije.` };
    }
    return { error: `Nije prošlo: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Novo ime, ista pička." };
}

export async function changePassword(prevState, formData) {
  const password = formData.get("password")?.toString();
  const confirm = formData.get("confirm")?.toString();

  if (!password || !confirm) {
    return { error: "Popuni oba polja." };
  }
  if (password.length < 6) {
    return { error: "Lozinka mora imati bar 6 znakova. Znam da je teško." };
  }
  if (password !== confirm) {
    return { error: "Lozinke se ne poklapaju. Otriježni se pa probaj opet." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    if (/should be different/i.test(error.message)) {
      return { error: "To ti je ista lozinka, genije." };
    }
    return { error: `Nije prošlo: ${error.message}` };
  }

  return { ok: true, message: "Promijenjeno. Nemoj je zaboraviti do sutra." };
}

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
