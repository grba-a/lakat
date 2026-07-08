"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";
import OauthButtons from "./oauth-buttons";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="font-display text-7xl uppercase leading-none tracking-tight">
        Lakat<span className="text-accent">.</span>
      </h1>
      <p className="mt-3 text-sm uppercase tracking-widest text-muted">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
        Šank te čeka. Ekipa broji.
      </p>

      <form
        action={formAction}
        className="mt-12 flex flex-col gap-5 animate-[rise_300ms_var(--ease-fluid)_both]"
      >
        <input type="hidden" name="next" value={next} />

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Email
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="h-14 rounded-field border border-white/10 bg-white/[0.05] px-4 text-base outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]"
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
            autoComplete="current-password"
            className="h-14 rounded-field border border-white/10 bg-white/[0.05] px-4 text-base outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]"
          />
        </label>

        {state?.error && (
          <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="pressable-soft mt-2 h-16 rounded-button bg-accent font-display text-2xl uppercase tracking-wide text-black shadow-glow disabled:opacity-50"
        >
          {isPending ? "Malo strpljenja..." : "Pusti me unutra"}
        </button>
      </form>

      <OauthButtons next={next} />

      <p className="mt-8 text-center text-sm text-muted">
        Nemaš račun?{" "}
        <Link
          href={next !== "/" ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="font-bold text-accent underline underline-offset-4"
        >
          Registriraj se, pičko.
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
