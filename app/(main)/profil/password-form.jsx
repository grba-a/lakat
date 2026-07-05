"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "./actions";

export default function PasswordForm() {
  const [state, formAction, isPending] = useActionState(changePassword, null);
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <details className="surface-2 rounded-card">
      <summary className="cursor-pointer list-none px-4 py-4 font-display text-xl uppercase tracking-wide text-muted">
        Promijeni lozinku
      </summary>
      <form ref={formRef} action={formAction} className="flex flex-col gap-4 px-4 pb-4">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Nova lozinka
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="h-14 rounded-field border border-white/10 bg-white/[0.05] px-4 text-base outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Ponovi lozinku
          </span>
          <input
            type="password"
            name="confirm"
            required
            minLength={6}
            autoComplete="new-password"
            className="h-14 rounded-field border border-white/10 bg-white/[0.05] px-4 text-base outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]"
          />
        </label>

        {state?.error && (
          <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="rounded-card border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-bold text-accent">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="surface-2 pressable-soft h-14 w-full rounded-button font-display text-xl uppercase tracking-wide text-foreground disabled:opacity-50"
        >
          {isPending ? "Sekunda..." : "Promijeni lozinku"}
        </button>
      </form>
    </details>
  );
}
