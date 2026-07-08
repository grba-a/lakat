import Link from "next/link";

const STEPS = [
  {
    n: 1,
    title: "Registriraj se",
    body: "Email, lozinka, username. Ili odmah dolje uleti Googleom.",
  },
  {
    n: 2,
    title: "Grupa: beta",
    body: "Kad te pita za grupu, upiši točno ovo:",
    code: "beta",
  },
  {
    n: 3,
    title: "Šifra: beta123",
    body: "Ista faca za šifru grupe:",
    code: "beta123",
  },
  {
    n: 4,
    title: "Instaliraj na home screen",
    body: "Nakon prijave, dodaj Lakat na početni zaslon da ti stižu notifikacije kad netko dođe za šank.",
  },
];

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="font-display text-6xl uppercase leading-none tracking-tight">
        Lakat<span className="text-accent">.</span>
      </h1>
      <p className="mt-3 text-sm uppercase tracking-widest text-muted">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
        Dobrodošao u betu.
      </p>

      <ol className="stagger mt-10 flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <li
            key={step.n}
            className="glass flex gap-4 rounded-card p-4"
            style={{ "--stagger-i": i }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-display text-lg text-black">
              {step.n}
            </span>
            <div>
              <p className="font-bold uppercase tracking-wide">{step.title}</p>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
              {step.code && (
                <p className="mt-2 inline-block rounded-field border border-accent/30 bg-accent/10 px-3 py-1.5 font-display text-lg tracking-widest text-accent">
                  {step.code}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <Link
        href="/register"
        className="pressable-soft mt-10 flex h-16 w-full items-center justify-center rounded-button bg-accent font-display text-2xl uppercase tracking-wide text-black shadow-glow"
      >
        Ajmo, registracija
      </Link>

      <p className="mt-6 text-center text-sm text-muted">
        Već imaš račun?{" "}
        <Link
          href="/login"
          className="font-bold text-accent underline underline-offset-4"
        >
          Prijavi se.
        </Link>
      </p>
    </main>
  );
}
