"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { joinOrCreateGroup } from "@/lib/join-or-create-group";

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

  // Šifre grupa žive hashirane u bazi (pgcrypto); provjera i hashiranje
  // idu kroz RPC funkcije dostupne samo service roleu.
  const admin = createAdminClient();
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
  const result = await joinOrCreateGroup(admin, data.user.id, {
    mode,
    groupName,
    groupPassword,
    groupConfirm,
  });
  if (result.error) return { error: result.error };

  const next = formData.get("next")?.toString();
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(safeNext);
}
