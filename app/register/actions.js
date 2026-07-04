"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function register(prevState, formData) {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  const username = formData.get("username")?.toString().trim();
  const groupPassword = formData.get("groupPassword")?.toString();

  if (!email || !password || !username || !groupPassword) {
    return { error: "Popuni sva polja, nije ovo raketna znanost." };
  }
  if (username.length < 2 || username.length > 24) {
    return { error: "Username mora imati između 2 i 24 znaka." };
  }
  if (password.length < 6) {
    return { error: "Lozinka mora imati bar 6 znakova. Znam da je teško." };
  }

  // Šifra grupe se provjerava PRIJE ikakvog poziva Supabaseu
  if (!process.env.GROUP_PASSWORD) {
    return { error: "GROUP_PASSWORD nije postavljen na serveru. Javi adminu." };
  }
  if (groupPassword !== process.env.GROUP_PASSWORD) {
    return { error: "Kriva šifra grupe. Nisi iz ekipe ili si već pijan." };
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

  redirect("/");
}
