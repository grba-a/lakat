"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/push";
import { countActiveFriends, friendIdsOf } from "@/lib/friends";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

// Postojeći red između dvoje ljudi, bez obzira na smjer (requester/addressee)
async function friendshipBetween(admin, a, b) {
  const { data } = await admin
    .from("friendships")
    .select("id, requester, status")
    .or(`and(requester.eq.${a},addressee.eq.${b}),and(requester.eq.${b},addressee.eq.${a})`)
    .maybeSingle();
  return data ?? null;
}

// Zajednička logika zahtjeva prema poznatoj meti (kod ili ID)
async function createRequest(admin, userId, target) {
  const existing = await friendshipBetween(admin, userId, target.id);
  if (existing) {
    if (existing.status === "accepted") {
      return { error: "Već ste pajdaši." };
    }
    if (existing.requester === target.id) {
      // Već te je on zvao — prihvati umjesto duplikata
      const { error } = await admin
        .from("friendships")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return { error: `Nije prošlo: ${error.message}` };
      revalidatePath("/profil/frendovi");
      return { ok: true, message: "Već te je zvao. Sad ste pajdaši." };
    }
    return { error: "Zahtjev je već poslan, budi strpljiv." };
  }

  const { error } = await admin
    .from("friendships")
    .insert({ requester: userId, addressee: target.id });
  if (error) return { error: `Nije prošlo: ${error.message}` };

  try {
    const { data: me } = await admin
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    await notifyUser({
      userId: target.id,
      body: `${me?.username ?? "Netko"} te želi za pajdaša. Sumnjivo.`,
    });
  } catch {
    // best-effort
  }

  revalidatePath("/profil/frendovi");
  return { ok: true, message: "Zahtjev poslan." };
}

export async function sendFriendRequest(code) {
  const user = await requireUser();
  const normalized = code?.toString().trim().toUpperCase();
  if (!normalized || normalized.length !== 6) {
    return { error: "Kod ima točno 6 znakova. Prepiši ponovno." };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, username")
    .eq("friend_code", normalized)
    .maybeSingle();
  if (!target) {
    return { error: "Nema tog koda. Provjeri jesi li dobro prepisao." };
  }
  if (target.id === user.id) {
    return { error: "Sebe ne možeš dodati za pajdaša, koliko god htio." };
  }

  return createRequest(admin, user.id, target);
}

// Zahtjev izravno po ID-u (tuđi profil / "možda se znate") — bez koda.
// Anti-spam: dopušteno SAMO uz bar jednog zajedničkog pajdaša; potpune
// neznance i dalje dodaješ isključivo kodom (odluka: bez pretrage).
export async function sendFriendRequestTo(targetId) {
  const user = await requireUser();
  if (!targetId || targetId === user.id) {
    return { error: "Sebe ne možeš dodati za pajdaša, koliko god htio." };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, username")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) {
    return { error: "Taj korisnik ne postoji." };
  }

  const [mine, theirs] = await Promise.all([
    friendIdsOf(admin, user.id),
    friendIdsOf(admin, targetId),
  ]);
  const mineSet = new Set(mine);
  const mutual = theirs.some((id) => mineSet.has(id));
  if (!mutual) {
    return { error: "Nemate zajedničkih pajdaša. Traži mu kod uživo, upoznajte se." };
  }

  return createRequest(admin, user.id, target);
}

// Odbij prijedlog "možda se znate": ne briše ga zauvijek, samo upiše
// dismissal pa ga page.jsx sortira na kraj liste (deprioritizacija)
export async function dismissSuggestion(targetId) {
  const user = await requireUser();
  if (!targetId || targetId === user.id) {
    return { error: "Neispravan prijedlog." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("suggestion_dismissals")
    .upsert(
      {
        user_id: user.id,
        dismissed_id: targetId,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,dismissed_id" }
    );
  if (error) return { error: `Nije prošlo: ${error.message}` };
  revalidatePath("/profil/frendovi");
  return { ok: true };
}

export async function respondFriendRequest(id, accept) {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("friendships")
    .select("id, addressee, status")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.addressee !== user.id || row.status !== "pending") {
    return { error: "Taj zahtjev ne postoji ili više nije aktualan." };
  }

  if (!accept) {
    const { error } = await admin.from("friendships").delete().eq("id", id);
    if (error) return { error: `Nije prošlo: ${error.message}` };
    revalidatePath("/profil/frendovi");
    return { ok: true };
  }

  const { error } = await admin
    .from("friendships")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: `Nije prošlo: ${error.message}` };
  revalidatePath("/profil/frendovi");
  return { ok: true, message: "Novi pajdaš. Čestitke, valjda." };
}

export async function removeFriend(id) {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("friendships")
    .select("id, requester, addressee")
    .eq("id", id)
    .maybeSingle();
  if (!row || (row.requester !== user.id && row.addressee !== user.id)) {
    return { error: "To prijateljstvo ne postoji." };
  }

  const { error } = await admin.from("friendships").delete().eq("id", id);
  if (error) return { error: `Nije prošlo: ${error.message}` };
  revalidatePath("/profil/frendovi");
  return { ok: true, message: "Maknut. Sam si kriv." };
}

// Heartbeat: samo dok je app u foregroundu (client to sam pazi), obična
// vlastita RLS update — nema potrebe za admin klijentom
export async function heartbeat() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id);
}

// Broj trenutno aktivnih frendova — friends badge u headeru ovo poziva
// periodički jer se layout ne re-fetcha pri client navigaciji
export async function getActiveFriendsCount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  return countActiveFriends(supabase, user.id);
}
