"use server";

import { createClient } from "@/lib/supabase/server";

export async function requestReset(prevState, formData) {
  const email = formData.get("email")?.toString().trim();
  if (!email) {
    return { error: "Upiši email. Bez toga ne ide." };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email);

  // Uvijek ista poruka — ne odajemo postoji li email u bazi
  return {
    ok: true,
    message:
      "Ako taj email postoji, stigao mu je link za novu lozinku. Provjeri i spam, znaš kakvi su.",
  };
}
