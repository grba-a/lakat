import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMyGroups } from "@/lib/groups";

// OAuth (Google i dr.) se vraća ovdje s ?code=; PKCE exchange napravi
// sesiju. Prvi put ovdje (bez profila/grupe) ide na /onboarding.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const [{ data: profile }, groups] = await Promise.all([
          supabase.from("profiles").select("id").eq("id", user.id).maybeSingle(),
          getMyGroups(supabase, user.id),
        ]);
        if (!profile || groups.length === 0) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
