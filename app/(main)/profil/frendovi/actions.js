"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/push";
import { countActiveFriends } from "@/lib/friends";

const MAX_GRUPA = 3;

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
    return { error: "Sebe ne možeš dodati za kompanjona, koliko god htio." };
  }

  const existing = await friendshipBetween(admin, user.id, target.id);
  if (existing) {
    if (existing.status === "accepted") {
      return { error: "Već ste kompanjoni." };
    }
    if (existing.requester === target.id) {
      // Već te je on zvao — prihvati umjesto duplikata
      const { error } = await admin
        .from("friendships")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return { error: `Nije prošlo: ${error.message}` };
      revalidatePath("/profil/frendovi");
      return { ok: true, message: "Već te je zvao. Sad ste kompanjoni." };
    }
    return { error: "Zahtjev je već poslan, budi strpljiv." };
  }

  const { error } = await admin
    .from("friendships")
    .insert({ requester: user.id, addressee: target.id });
  if (error) return { error: `Nije prošlo: ${error.message}` };

  try {
    const { data: me } = await admin
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    await notifyUser({
      userId: target.id,
      body: `${me?.username ?? "Netko"} te želi za kompanjona. Sumnjivo.`,
    });
  } catch {
    // best-effort
  }

  revalidatePath("/profil/frendovi");
  return { ok: true, message: "Zahtjev poslan." };
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
  return { ok: true, message: "Novi kompanjon. Čestitke, valjda." };
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
  return { ok: true, message: "Makut. Sam si kriv." };
}

export async function inviteToGroup(groupId, friendId) {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Nisi član te grupe." };

  const friendship = await friendshipBetween(admin, user.id, friendId);
  if (friendship?.status !== "accepted") {
    return { error: "Taj ti nije kompanjon (još)." };
  }

  const { data: alreadyMember } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", friendId)
    .maybeSingle();
  if (alreadyMember) return { error: "Već je u grupi." };

  const { data: pending } = await admin
    .from("group_invites")
    .select("id")
    .eq("group_id", groupId)
    .eq("invitee", friendId)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) return { error: "Već je pozvan, čeka odgovor." };

  const { error } = await admin
    .from("group_invites")
    .insert({ group_id: groupId, inviter: user.id, invitee: friendId });
  if (error) return { error: `Nije prošlo: ${error.message}` };

  try {
    const [{ data: group }, { data: me }] = await Promise.all([
      admin.from("groups").select("name").eq("id", groupId).maybeSingle(),
      admin.from("profiles").select("username").eq("id", user.id).maybeSingle(),
    ]);
    await notifyUser({
      userId: friendId,
      body: `${me?.username ?? "Netko"} te zove u grupu "${group?.name ?? "?"}".`,
    });
  } catch {
    // best-effort
  }

  revalidatePath("/profil/frendovi");
  return { ok: true, message: "Pozvan je." };
}

export async function respondGroupInvite(id, accept) {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("group_invites")
    .select("id, group_id, invitee, status")
    .eq("id", id)
    .maybeSingle();
  if (!invite || invite.invitee !== user.id || invite.status !== "pending") {
    return { error: "Taj poziv ne postoji ili više nije aktualan." };
  }

  if (!accept) {
    const { error } = await admin
      .from("group_invites")
      .update({ status: "declined" })
      .eq("id", id);
    if (error) return { error: `Nije prošlo: ${error.message}` };
    revalidatePath("/profil/frendovi");
    return { ok: true };
  }

  const { count } = await admin
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_GRUPA) {
    return { error: "Tri grupe su ti malo? Alkoholičaru." };
  }

  const { error: memberError } = await admin.from("group_members").upsert(
    { group_id: invite.group_id, user_id: user.id, role: "member" },
    { onConflict: "group_id,user_id", ignoreDuplicates: true }
  );
  if (memberError) return { error: `Nije prošlo: ${memberError.message}` };

  await admin.from("group_invites").update({ status: "accepted" }).eq("id", id);
  await admin
    .from("profiles")
    .update({ active_group_id: invite.group_id })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  revalidatePath("/profil/frendovi");
  return { ok: true, message: "Upao si. Nema šifre, ima kompanjona." };
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
