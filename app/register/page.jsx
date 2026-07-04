"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "./actions";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(register, null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
        Novi u ekipi<span className="text-accent">?</span>
      </h1>
      <p className="mt-3 border-l-4 border-accent pl-3 text-sm uppercase tracking-widest text-muted">
        Bez šifre grupe nema upada.
      </p>

      <form action={formAction} className="mt-10 flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Email
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="h-14 border-2 border-line bg-surface px-4 text-base outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Lozinka
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="h-14 border-2 border-line bg-surface px-4 text-base outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Username
          </span>
          <input
            type="text"
            name="username"
            required
            minLength={2}
            maxLength={24}
            autoComplete="username"
            placeholder="kako te ekipa zove"
            className="h-14 border-2 border-line bg-surface px-4 text-base outline-none placeholder:text-muted/50 focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Šifra grupe
          </span>
          <input
            type="password"
            name="groupPassword"
            required
            autoComplete="off"
            className="h-14 border-2 border-line bg-surface px-4 text-base outline-none focus:border-accent"
          />
          <span className="text-xs text-muted">
            Ne znaš je? Pitaj ekipu za šankom.
          </span>
        </label>

        {state?.error && (
          <p className="border-2 border-danger bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 h-16 bg-accent font-display text-2xl uppercase tracking-wide text-black active:translate-y-0.5 disabled:opacity-50"
        >
          {isPending ? "Malo strpljenja..." : "Upadam"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Već si registriran?{" "}
        <Link
          href="/login"
          className="font-bold text-accent underline underline-offset-4"
        >
          Ulogiraj se.
        </Link>
      </p>
    </main>
  );
}
