"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { joinOrCreateGroup } from "@/lib/join-or-create-group";

export async function completeOnboarding(prevState, formData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const username = formData.get("username")?.toString().trim();
  const mode = formData.get("mode")?.toString();
  const groupName = formData.get("groupName")?.toString().trim();
  const groupPassword = formData.get("groupPassword")?.toString();
  const groupConfirm = formData.get("groupConfirm")?.toString();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    if (!username || username.length < 2 || username.length > 24) {
      return { error: "Username mora imati između 2 i 24 znaka." };
    }
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id, username });
    if (insertError) {
      if (insertError.code === "23505") {
        return { error: `"${username}" je već zauzet. Smisli nešto originalnije.` };
      }
      return { error: `Profil se nije spremio: ${insertError.message}` };
    }
  }

  const admin = createAdminClient();
  const result = await joinOrCreateGroup(admin, user.id, {
    mode,
    groupName,
    groupPassword,
    groupConfirm,
  });
  if (result.error) return { error: result.error };

  redirect("/");
}
