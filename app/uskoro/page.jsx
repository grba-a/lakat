import Link from "next/link";

export const metadata = { title: "VELIKI UPDATE DOLAZI." };

// Lockdown stranica za vrijeme velikih radova (LAKAT_LOCKDOWN=1 u proxy.js).
// Statična, bez client JS-a — svi osim allowliste završe ovdje.
export default function UskoroPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-3xl uppercase leading-none tracking-tight">
        Lakat<span className="text-accent">.</span>
      </p>

      <h1 className="mt-10 font-display text-6xl uppercase leading-[0.95] tracking-tight">
        Veliki update
        <br />
        dolazi<span className="text-accent">.</span>
      </h1>

      <p className="mt-6 max-w-xs text-balance text-muted">
        Šank je na renovaciji. Strpi se, pjanče — vraćamo se jači, pjaniji i
        ljepši.
      </p>

      <p className="mt-14 text-xs uppercase tracking-widest text-muted/60">
        <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent align-middle" />
        Radovi u tijeku
      </p>

      <Link
        href="/login"
        className="mt-10 text-sm text-muted/50 underline underline-offset-4"
      >
        Prijavi se
      </Link>
    </main>
  );
}
