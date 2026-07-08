"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_GRUPA = 3;
const PUBLIC_GROUP = "beta"; // javna grupa — ulazak bez šifre, dostupna svima

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

// Autoritativna provjera uloge — uvijek kroz admin klijent, nikad
// vjerovati klijentskom stanju
async function membershipOf(admin, groupId, userId) {
  const { data } = await admin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

// Ako je korisniku aktivna grupa upravo nestala (napustio/izbačen/obrisana),
// prebaci ga na prvu preostalu ili na ništa
async function resetActiveGroup(admin, userId, removedGroupId) {
  const { data: profile } = await admin
    .from("profiles")
    .select("active_group_id")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.active_group_id !== removedGroupId) return;

  const { data: rest } = await admin
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1);
  await admin
    .from("profiles")
    .update({ active_group_id: rest?.[0]?.group_id ?? null })
    .eq("id", userId);
}

// BETA je javna grupa — ulazak bez šifre, jednim tapom (za nove korisnike).
export async function joinBeta() {
  const user = await requireUser();
  const admin = createAdminClient();

  const { count } = await admin
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_GRUPA) {
    return { error: "Tri grupe su ti malo? Alkoholičaru." };
  }

  const { data: group } = await admin
    .from("groups")
    .select("id")
    .ilike("name", PUBLIC_GROUP)
    .maybeSingle();
  if (!group) {
    return { error: "Beta grupa trenutno ne postoji. Javi ekipi." };
  }

  const existing = await membershipOf(admin, group.id, user.id);
  if (existing) {
    return { error: "Već si u beti, koliko si popio?" };
  }

  const { error } = await admin
    .from("group_members")
    .insert({ group_id: group.id, user_id: user.id, role: "member" });
  if (error) {
    return { error: `Upis nije prošao: ${error.message}` };
  }

  await admin
    .from("profiles")
    .update({ active_group_id: group.id })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  return { ok: true, message: "Upao si u betu. Dobrodošao u ludnicu." };
}

export async function joinGroup(prevState, formData) {
  const user = await requireUser();
  const groupName = formData.get("groupName")?.toString().trim();
  const groupPassword = formData.get("groupPassword")?.toString();

  if (!groupName || !groupPassword) {
    return { error: "Naziv i šifra grupe. Oboje. Ajde." };
  }

  const admin = createAdminClient();

  const { count } = await admin
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_GRUPA) {
    return { error: "Tri grupe su ti malo? Alkoholičaru." };
  }

  const { data: gid, error: verifyError } = await admin.rpc(
    "verify_group_password",
    { g_name: groupName, g_password: groupPassword }
  );
  if (verifyError) {
    return { error: `Provjera nije prošla: ${verifyError.message}` };
  }
  if (!gid) {
    return { error: "Ta grupa ne postoji ili si fulao šifru. Otriježni se." };
  }

  const existing = await membershipOf(admin, gid, user.id);
  if (existing) {
    return { error: "Već si u toj grupi, koliko si popio?" };
  }

  const { error } = await admin
    .from("group_members")
    .insert({ group_id: gid, user_id: user.id, role: "member" });
  if (error) {
    return { error: `Upis nije prošao: ${error.message}` };
  }

  // Odmah te prebaci u novu grupu — zato si se i pridružio
  await admin
    .from("profiles")
    .update({ active_group_id: gid })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  return { ok: true, message: "Upao si. Novi šank, ista jetra." };
}

export async function createGroup(prevState, formData) {
  const user = await requireUser();
  const groupName = formData.get("groupName")?.toString().trim();
  const groupPassword = formData.get("groupPassword")?.toString();
  const groupConfirm = formData.get("groupConfirm")?.toString();

  if (!groupName || !groupPassword) {
    return { error: "Naziv i šifra grupe. Oboje. Ajde." };
  }
  if (groupName.length < 2 || groupName.length > 32) {
    return { error: "Naziv grupe mora imati između 2 i 32 znaka." };
  }
  if (groupPassword.length < 4) {
    return { error: "Šifra grupe mora imati bar 4 znaka." };
  }
  if (groupPassword !== groupConfirm) {
    return { error: "Šifre se ne poklapaju. Otriježni se pa probaj opet." };
  }

  const admin = createAdminClient();

  const { count } = await admin
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_GRUPA) {
    return { error: "Tri grupe su ti malo? Alkoholičaru." };
  }

  const { data: hash, error: hashError } = await admin.rpc(
    "hash_group_password",
    { pw: groupPassword }
  );
  if (hashError) {
    return { error: `Nije prošlo: ${hashError.message}` };
  }

  const { data: created, error: groupError } = await admin
    .from("groups")
    .insert({ name: groupName, password_hash: hash, created_by: user.id })
    .select("id")
    .single();
  if (groupError) {
    if (groupError.code === "23505") {
      return {
        error: `Grupa "${groupName}" već postoji. Pridruži joj se ili smisli drugo ime.`,
      };
    }
    return { error: `Grupa se nije kreirala: ${groupError.message}` };
  }

  const { error: memberError } = await admin
    .from("group_members")
    .insert({ group_id: created.id, user_id: user.id, role: "admin" });
  if (memberError) {
    return { error: `Upis nije prošao: ${memberError.message}` };
  }

  await admin
    .from("profiles")
    .update({ active_group_id: created.id })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  return { ok: true, message: "Grupa osnovana. Ti si gazda, nemoj zajebat." };
}

export async function leaveGroup(groupId) {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: members } = await admin
    .from("group_members")
    .select("user_id, role")
    .eq("group_id", groupId);
  const me = (members ?? []).find((m) => m.user_id === user.id);
  if (!me) {
    return { error: "Nisi u toj grupi." };
  }

  if (me.role === "admin" && members.length > 1) {
    const otherAdmin = members.some(
      (m) => m.user_id !== user.id && m.role === "admin"
    );
    if (!otherAdmin) {
      return { error: "Ti si jedini admin. Predaj titulu nekome pa onda bježi." };
    }
  }

  // Zadnji član odlazi = grupa se briše (cascade nosi članstva, checkinove,
  // najave i reakcije te grupe)
  if (members.length === 1) {
    const { error } = await admin.from("groups").delete().eq("id", groupId);
    if (error) return { error: `Nije prošlo: ${error.message}` };
    await resetActiveGroup(admin, user.id, groupId);
    revalidatePath("/", "layout");
    return { ok: true, message: "Otišao si, a grupa s tobom. Nitko je neće pamtiti." };
  }

  const { error } = await admin
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);
  if (error) return { error: `Nije prošlo: ${error.message}` };

  await resetActiveGroup(admin, user.id, groupId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Pobjegao si iz grupe. Klasika." };
}

export async function renameGroup(groupId, prevState, formData) {
  const user = await requireUser();
  const name = formData.get("name")?.toString().trim();

  if (!name || name.length < 2 || name.length > 32) {
    return { error: "Naziv grupe mora imati između 2 i 32 znaka." };
  }

  const admin = createAdminClient();
  const me = await membershipOf(admin, groupId, user.id);
  if (me?.role !== "admin") {
    return { error: "Nisi admin ove grupe. Lijepo probaj." };
  }

  const { error } = await admin
    .from("groups")
    .update({ name })
    .eq("id", groupId);
  if (error) {
    if (error.code === "23505") {
      return { error: `Grupa "${name}" već postoji. Smisli drugo ime.` };
    }
    return { error: `Nije prošlo: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Novo ime, isti pijanci." };
}

export async function changeGroupPassword(groupId, prevState, formData) {
  const user = await requireUser();
  const password = formData.get("password")?.toString();
  const confirm = formData.get("confirm")?.toString();

  if (!password || password.length < 4) {
    return { error: "Šifra grupe mora imati bar 4 znaka." };
  }
  if (password !== confirm) {
    return { error: "Šifre se ne poklapaju. Otriježni se pa probaj opet." };
  }

  const admin = createAdminClient();
  const me = await membershipOf(admin, groupId, user.id);
  if (me?.role !== "admin") {
    return { error: "Nisi admin ove grupe. Lijepo probaj." };
  }

  const { data: hash, error: hashError } = await admin.rpc(
    "hash_group_password",
    { pw: password }
  );
  if (hashError) {
    return { error: `Nije prošlo: ${hashError.message}` };
  }

  const { error } = await admin
    .from("groups")
    .update({ password_hash: hash })
    .eq("id", groupId);
  if (error) {
    return { error: `Nije prošlo: ${error.message}` };
  }

  return { ok: true, message: "Nova šifra. Javi je samo onima koje podnosiš." };
}

export async function kickMember(groupId, targetId) {
  const user = await requireUser();
  if (targetId === user.id) {
    return { error: "Sebe ne možeš izbaciti. Za to postoji Napusti grupu." };
  }

  const admin = createAdminClient();
  const me = await membershipOf(admin, groupId, user.id);
  if (me?.role !== "admin") {
    return { error: "Nisi admin ove grupe. Lijepo probaj." };
  }

  const target = await membershipOf(admin, groupId, targetId);
  if (!target) {
    return { error: "Taj nije u grupi. Već je pobjegao sam." };
  }

  const { error } = await admin
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", targetId);
  if (error) return { error: `Nije prošlo: ${error.message}` };

  await resetActiveGroup(admin, targetId, groupId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Izbačen. Neka pije doma." };
}

export async function makeAdmin(groupId, targetId) {
  const user = await requireUser();
  const admin = createAdminClient();

  const me = await membershipOf(admin, groupId, user.id);
  if (me?.role !== "admin") {
    return { error: "Nisi admin ove grupe. Lijepo probaj." };
  }

  const target = await membershipOf(admin, groupId, targetId);
  if (!target) {
    return { error: "Taj nije u grupi." };
  }
  if (target.role === "admin") {
    return { error: "Već je admin. Dva gazde, jedan šank, može to." };
  }

  const { error } = await admin
    .from("group_members")
    .update({ role: "admin" })
    .eq("group_id", groupId)
    .eq("user_id", targetId);
  if (error) return { error: `Nije prošlo: ${error.message}` };

  revalidatePath("/", "layout");
  return { ok: true, message: "Sad ste dva gazde. Nemojte se pobiti." };
}
