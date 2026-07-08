import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/register";
  // /welcome je javna QR landing stranica — svi je vide, ulogirani se ne
  // bacaju s nje (netko tko skenira QR može već imati račun).
  // /auth/ (OAuth callback) mora proći bez sesije — tu se sesija tek stvara.
  const isPublicPage = pathname === "/welcome" || pathname.startsWith("/auth/");

  if (!user && !isAuthPage && !isPublicPage) {
    // ?next= čuva kamo je korisnik htio (npr. /f/KOD share link) da ga
    // login/register vrate tamo umjesto na Šank
    const search =
      pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return redirectTo(`/login${search}`, request, response);
  }

  if (user && isAuthPage) {
    return redirectTo("/", request, response);
  }

  return response;
}

// Redirect mora ponijeti auth cookieje koje je updateSession upravo osvježio
function redirectTo(pathAndSearch, request, response) {
  const url = request.nextUrl.clone();
  const [pathname, search] = pathAndSearch.split("?");
  url.pathname = pathname;
  url.search = search ?? "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|offline\\.html|manifest\\.webmanifest|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
