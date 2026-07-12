import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Landing za linkove iz Supabase auth mailova (reset lozinke). Radi i kad se
// mail otvori u drugom browseru jer verifikacija ide preko token_hash-a, ne
// preko PKCE code-a vezanog za sesiju.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next");
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) redirect(safeNext);
  }

  redirect("/login");
}
