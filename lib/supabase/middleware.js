import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function updateSession(request) {
  let response = NextResponse.next({ request });

  // Dok .env.local nije popunjen, ponašaj se kao da nitko nije ulogiran
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { response, user: null };
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims validira JWT lokalno (JWKS se kešira) umjesto mrežnog
  // poziva prema Supabase Auth na svakom requestu; istekla sesija se
  // i dalje osvježi. Proxy treba samo "je li netko ulogiran".
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  return { response, user: claims ? { id: claims.sub } : null };
}
