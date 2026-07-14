import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Lockdown za vrijeme velikih radova: LAKAT_LOCKDOWN=1 u envu pušta u app
// samo račune s allowliste, svi ostali (i neulogirani) idu na /uskoro.
// Gašenje = obrisati env var u Vercelu + redeploy.
const LOCKDOWN_ALLOWED = ["pgrbi0@gmail.com", "test@mail.com"];

export async function proxy(request) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (process.env.LAKAT_LOCKDOWN === "1") {
    const allowed = user && LOCKDOWN_ALLOWED.includes(user.email);
    // /login mora ostati dostupan da se dopušteni računi uopće mogu prijaviti
    const lockdownPublic = pathname === "/uskoro" || pathname === "/login";
    if (!allowed && !lockdownPublic) {
      return redirectTo("/uskoro", request, response);
    }
  }

  const isAuthPage = pathname === "/login" || pathname === "/register";
  // /welcome je javna QR landing stranica — svi je vide, ulogirani se ne
  // bacaju s nje (netko tko skenira QR može već imati račun).
  // /zaboravio-lozinku i /reset-lozinka su javni za reset lozinke —
  // recovery sesija iz maila stiže kao URL hash koji proxy (server-side)
  // ne vidi, pa /reset-lozinka MORA biti javna da je klijentski JS uopće
  // stigne obraditi (supabase-js hvata #access_token= na mountu).
  const isPublicPage =
    pathname === "/welcome" ||
    pathname === "/uskoro" ||
    pathname === "/zaboravio-lozinku" ||
    pathname === "/reset-lozinka";

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
