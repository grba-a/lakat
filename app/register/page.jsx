"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { register } from "./actions";
import OauthButtons from "../login/oauth-buttons";

const inputClass =
  "h-14 rounded-field border border-white/10 bg-white/[0.05] px-4 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted/50 focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]";

function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [state, formAction, isPending] = useActionState(register, null);
  const [mode, setMode] = useState("join");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
        Novi u ekipi<span className="text-accent">?</span>
      </h1>
      <p className="mt-3 text-sm uppercase tracking-widest text-muted">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
        Upadni u grupu ili osnuj svoju.
      </p>

      <form
        action={formAction}
        className="mt-10 flex flex-col gap-5 animate-[rise_300ms_var(--ease-fluid)_both]"
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
            className={inputClass}
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
            className={inputClass}
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
            className={inputClass}
          />
        </label>

        <input type="hidden" name="mode" value={mode} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("join")}
            className={`pressable-soft h-12 rounded-full text-xs font-bold uppercase tracking-widest ${
              mode === "join"
                ? "bg-accent/15 text-accent"
                : "surface-2 text-muted"
            }`}
          >
            Upadam u postojeću
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`pressable-soft h-12 rounded-full text-xs font-bold uppercase tracking-widest ${
              mode === "create"
                ? "bg-accent/15 text-accent"
                : "surface-2 text-muted"
            }`}
          >
            Osnivam novu
          </button>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Naziv grupe
          </span>
          <input
            type="text"
            name="groupName"
            required
            minLength={2}
            maxLength={32}
            autoComplete="off"
            placeholder={mode === "join" ? "kako se grupa zove" : "npr. ime kafane"}
            className={inputClass}
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
            minLength={mode === "create" ? 4 : undefined}
            autoComplete="off"
            className={inputClass}
          />
          <span className="text-xs text-muted">
            {mode === "join"
              ? "Ne znaš je? Pitaj ekipu za šankom."
              : "Nju daješ ekipi da upadne. Nemoj 1234, molim te."}
          </span>
        </label>

        {mode === "create" && (
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted">
              Ponovi šifru grupe
            </span>
            <input
              type="password"
              name="groupConfirm"
              required
              minLength={4}
              autoComplete="off"
              className={inputClass}
            />
          </label>
        )}

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
          {isPending
            ? "Malo strpljenja..."
            : mode === "join"
              ? "Upadam"
              : "Osnivam grupu"}
        </button>
      </form>

      <OauthButtons next={next} />

      <p className="mt-8 text-center text-sm text-muted">
        Već si registriran?{" "}
        <Link
          href={next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-bold text-accent underline underline-offset-4"
        >
          Ulogiraj se.
        </Link>
      </p>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
