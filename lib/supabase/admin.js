import { createClient } from "@supabase/supabase-js";

// SAMO za server (lib/push.js): secret ključ zaobilazi RLS.
// Nikad ne importati u klijentski kod ni slati u browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
