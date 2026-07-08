"use client";

export default function Error({ error, reset }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-5 py-10 text-center">
      <p className="font-display text-6xl leading-none tracking-tight text-danger">
        Ups.
      </p>
      <h1 className="mt-4 font-display text-3xl uppercase leading-tight tracking-tight">
        Nešto je puklo.
      </h1>
      <p className="mt-3 text-sm text-muted">
        Nismo mi krivi. Vjerojatno. Probaj opet.
      </p>

      <button
        type="button"
        onClick={() => reset()}
        className="pressable-soft mt-10 flex h-16 w-full items-center justify-center rounded-button bg-accent font-display text-2xl uppercase tracking-wide text-black shadow-glow"
      >
        Probaj opet
      </button>
    </main>
  );
}
