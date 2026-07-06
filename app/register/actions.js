"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function register(prevState, formData) {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  const username = formData.get("username")?.toString().trim();
  const mode = formData.get("mode")?.toString(); // "join" | "create"
  const groupName = formData.get("groupName")?.toString().trim();
  const groupPassword = formData.get("groupPassword")?.toString();
  const groupConfirm = formData.get("groupConfirm")?.toString();

  if (!email || !password || !username || !groupName || !groupPassword) {
    return { error: "Popuni sva polja, nije ovo raketna znanost." };
  }
  if (username.length < 2 || username.length > 24) {
    return { error: "Username mora imati između 2 i 24 znaka." };
  }
  if (password.length < 6) {
    return { error: "Lozinka mora imati bar 6 znakova. Znam da je teško." };
  }
  if (groupName.length < 2 || groupName.length > 32) {
    return { error: "Naziv grupe mora imati između 2 i 32 znaka." };
  }
  if (mode !== "join" && mode !== "create") {
    return { error: "Odaberi: upadaš u postojeću grupu ili osnivaš novu." };
  }
  if (mode === "create") {
    if (groupPassword.length < 4) {
      return { error: "Šifra grupe mora imati bar 4 znaka." };
    }
    if (groupPassword !== groupConfirm) {
      return { error: "Šifre grupe se ne poklapaju. Otriježni se pa probaj opet." };
    }
  }

  // Grupa se provjerava PRIJE kreiranja računa — bez valjane grupe nema
  // ni računa. Šifre grupa žive hashirane u bazi (pgcrypto), provjera i
  // hashiranje idu kroz RPC funkcije dostupne samo service roleu.
  const admin = createAdminClient();
  let joinGroupId = null;

  if (mode === "join") {
    const { data: gid, error: verifyError } = await admin.rpc(
      "verify_group_password",
      { g_name: groupName, g_password: groupPassword }
    );
    if (verifyError) {
      return { error: `Provjera grupe nije prošla: ${verifyError.message}` };
    }
    if (!gid) {
      return { error: "Ta grupa ne postoji ili si fulao šifru. Otriježni se." };
    }
    joinGroupId = gid;
  } else {
    const { data: taken } = await admin
      .from("groups")
      .select("id")
      .ilike("name", groupName)
      .maybeSingle();
    if (taken) {
      return {
        error: `Grupa "${groupName}" već postoji. Pridruži joj se ili smisli drugo ime.`,
      };
    }
  }

  const supabase = await createClient();

  let { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Recovery: račun postoji od polu-dovršene registracije (signUp prošao, profil nije)
    if (/already registered/i.test(error.message)) {
      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) {
        return { error: "Taj email je već registriran. Probaj se ulogirati." };
      }
      data = signIn.data;
    } else {
      return { error: `Registracija nije prošla: ${error.message}` };
    }
  }

  if (!data.session) {
    return {
      error:
        "Račun je kreiran, ali nema sesije. U Supabaseu isključi 'Confirm email' pa probaj opet.",
    };
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: data.user.id, username });

    if (insertError) {
      await supabase.auth.signOut();
      if (insertError.code === "23505") {
        return {
          error: `"${username}" je već zauzet. Smisli nešto originalnije.`,
        };
      }
      return { error: `Profil se nije spremio: ${insertError.message}` };
    }
  }

  // Grupa: pridruži se ili osnuj (osnivač = admin). Idempotentno za
  // slučaj polu-dovršene registracije.
  if (mode === "create") {
    const { data: hash, error: hashError } = await admin.rpc(
      "hash_group_password",
      { pw: groupPassword }
    );
    if (hashError) {
      return { error: `Grupa se nije kreirala: ${hashError.message}` };
    }
    const { data: created, error: groupError } = await admin
      .from("groups")
      .insert({
        name: groupName,
        password_hash: hash,
        created_by: data.user.id,
      })
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
    joinGroupId = created.id;
  }

  const { error: memberError } = await admin
    .from("group_members")
    .upsert(
      {
        group_id: joinGroupId,
        user_id: data.user.id,
        role: mode === "create" ? "admin" : "member",
      },
      { onConflict: "group_id,user_id", ignoreDuplicates: true }
    );
  if (memberError) {
    return { error: `Upis u grupu nije prošao: ${memberError.message}` };
  }

  await admin
    .from("profiles")
    .update({ active_group_id: joinGroupId })
    .eq("id", data.user.id);

  redirect("/");
}
