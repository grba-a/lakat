import Link from "next/link";

const STEPS = [
  {
    n: 1,
    title: "Otvori račun",
    body: "Email, lozinka, username. 30 sekundi i gotovo.",
  },
  {
    n: 2,
    title: "Uđi u BETA",
    body: "Na Šanku stisni gumb Uđi u BETA. Javna grupa, bez šifre.",
  },
  {
    n: 3,
    title: "Dođi za šank",
    body: "Kad si vani, stisni TU SAM. Ekipa te vidi uživo.",
  },
];

const FEATURES = [
  {
    icon: (
      <>
        <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
        <path d="M9 12v6" />
        <path d="M13 12v6" />
        <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z" />
        <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
      </>
    ),
    title: "Uživo za šankom",
    body: "Tko je vani baš sad — bez pisanja po grupama.",
  },
  {
    icon: (
      <>
        <path d="M3 3v18h18" />
        <path d="M18 17V9" />
        <path d="M13 17V5" />
        <path d="M8 17v-3" />
      </>
    ),
    title: "Liga ekipa",
    body: "Tvoja ekipa protiv drugih. Tko se više druži, taj vodi.",
  },
  {
    icon: (
      <>
        <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
        <path d="M15 5.764v15" />
        <path d="M9 3.236v15" />
      </>
    ),
    title: "Mapa",
    body: "Gdje je ekipa danas pila, na karti.",
  },
  {
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    title: "Pajdaši",
    body: "Dodaj ekipu, vidi tko je online, zovi ih u grupu.",
  },
  {
    icon: (
      <>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </>
    ),
    title: "Slike dana",
    body: "Slikaj dokaz da si stvarno vani. Ekipa reagira.",
  },
  {
    icon: (
      <>
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </>
    ),
    title: "Streak",
    body: "Nižeš dolaske, gradiš streak. Ne prekidaj ga.",
  },
];

function FeatureIcon({ children }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-accent"
    >
      {children}
    </svg>
  );
}

export default function WelcomePage() {
  return (
    <main className="mx-auto w-full max-w-sm px-5 pb-16 pt-12">
      {/* Hero */}
      <p className="font-display text-3xl uppercase leading-none tracking-tight">
        Lakat<span className="text-accent">.</span>
      </p>

      <section className="mt-16">
        <h1 className="font-display text-6xl uppercase leading-[0.95] tracking-tight">
          Tko je večeras za šankom<span className="text-accent">?</span>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Vidi ekipu uživo. A tko najmanje dolazi... e, to se zna.
        </p>

        <Link
          href="/register"
          className="pressable-soft mt-8 flex h-16 w-full items-center justify-center rounded-button bg-accent font-display text-2xl uppercase tracking-wide text-black shadow-glow"
        >
          Otvori račun
        </Link>
        <p className="mt-4 text-center text-sm text-muted">
          Već imaš račun?{" "}
          <Link
            href="/login"
            className="font-bold text-accent underline underline-offset-4"
          >
            Prijavi se.
          </Link>
        </p>
      </section>

      {/* Što je Lakat */}
      <section className="mt-20">
        <h2 className="text-xs font-bold uppercase tracking-widest text-accent">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
          Što je ovo
        </h2>
        <p className="mt-4 text-xl leading-relaxed">
          Lakat je aplikacija za tvoju ekipu. Kad si vani za šankom, stisneš{" "}
          <span className="font-bold text-accent">TU SAM</span> i svi uživo vide
          da si tu. Bez grupnih poruka, bez „di ste ljudi“ — samo otvoriš i vidiš
          tko je gdje.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          A pošto se sve broji, na kraju mjeseca se točno zna tko je legenda, a
          tko se skrivao doma.
        </p>
      </section>

      {/* Kako radi */}
      <section className="mt-20">
        <h2 className="text-xs font-bold uppercase tracking-widest text-accent">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
          Kako radi
        </h2>
        <ol className="stagger mt-5 flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className="glass flex gap-4 rounded-card p-4"
              style={{ "--stagger-i": i }}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-display text-lg text-black">
                {step.n}
              </span>
              <div>
                <p className="font-bold uppercase tracking-wide">{step.title}</p>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Za osnivače ekipa */}
      <section className="mt-20">
        <h2 className="text-xs font-bold uppercase tracking-widest text-accent">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
          Imaš svoju ekipu?
        </h2>
        <div className="glass mt-5 rounded-card px-5 py-8">
          <p className="font-display text-4xl uppercase leading-none tracking-tight">
            Osnuj grupu<span className="text-accent">.</span>
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Ti si taj koji uvijek piše „di ste“? Osnuj grupu za svoju ekipu,
            pozovi ih jednim linkom i vodite svoju ekipu do vrha lige.
          </p>
          <Link
            href="/register"
            className="pressable-soft mt-6 flex h-16 w-full items-center justify-center rounded-button border border-accent/40 bg-accent/10 font-display text-2xl uppercase tracking-wide text-accent"
          >
            Osnuj grupu za ekipu
          </Link>
        </div>
      </section>

      {/* Fore */}
      <section className="mt-20">
        <h2 className="text-xs font-bold uppercase tracking-widest text-accent">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
          Što dobiješ
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface-2 rounded-card p-4">
              <FeatureIcon>{f.icon}</FeatureIcon>
              <p className="mt-3 font-bold uppercase tracking-wide">{f.title}</p>
              <p className="mt-1 text-sm leading-snug text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Završni CTA */}
      <section className="mt-20">
        <div className="glass rounded-card px-5 py-8 text-center">
          <p className="font-display text-4xl uppercase leading-none tracking-tight">
            Ekipa te čeka<span className="text-accent">.</span>
          </p>
          <p className="mt-3 text-sm text-muted">
            Otvori račun, uđi u BETA, dođi za šank.
          </p>
          <Link
            href="/register"
            className="pressable-soft mt-6 flex h-16 w-full items-center justify-center rounded-button bg-accent font-display text-2xl uppercase tracking-wide text-black shadow-glow"
          >
            Ajmo
          </Link>
          <p className="mt-4 text-xs text-muted">
            Nakon prijave dodaj Lakat na home screen za notifikacije.
          </p>
        </div>
      </section>

      <p className="mt-12 text-center text-xs uppercase tracking-widest text-muted">
        laktarenje.com
      </p>
    </main>
  );
}
