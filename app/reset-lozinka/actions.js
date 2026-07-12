"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setNewPassword(prevState, formData) {
  const password = formData.get("password")?.toString();
  const confirm = formData.get("confirm")?.toString();

  if (!password || password.length < 6) {
    return { error: "Lozinka mora imati bar 6 znakova." };
  }
  if (password !== confirm) {
    return { error: "Lozinke se ne poklapaju. Otriježni se pa probaj opet." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: `Nije prošlo: ${error.message}` };
  }

  redirect("/");
}
