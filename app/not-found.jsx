import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-5 py-10 text-center">
      <p className="font-display text-8xl leading-none tracking-tight text-accent">
        404
      </p>
      <h1 className="mt-4 font-display text-3xl uppercase leading-tight tracking-tight">
        Ovo mjesto ne postoji.
      </h1>
      <p className="mt-3 text-sm text-muted">
        Ko ni tvoj streak. Nema tu ničega, vrati se za šank.
      </p>

      <Link
        href="/"
        className="pressable-soft mt-10 flex h-16 w-full items-center justify-center rounded-button bg-accent font-display text-2xl uppercase tracking-wide text-black shadow-glow"
      >
        Nazad na šank
      </Link>
    </main>
  );
}
