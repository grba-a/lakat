"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetLozinkaPage() {
  const [supabase] = useState(() => createClient());
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(null);
  const [isPending, setIsPending] = useState(false);

  // Supabase-js kod mounta obradi #access_token= iz URL-a (recovery link
  // iz maila) i emitira ovaj event kad je recovery sesija spremna
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const password = formData.get("password")?.toString();
    const confirm = formData.get("confirm")?.toString();

    if (!password || password.length < 6) {
      setState({ error: "Lozinka mora imati bar 6 znakova." });
      return;
    }
    if (password !== confirm) {
      setState({ error: "Lozinke se ne poklapaju. Otriježni se pa probaj opet." });
      return;
    }

    setIsPending(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsPending(false);
    if (error) {
      setState({ error: `Nije prošlo: ${error.message}` });
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="font-display text-7xl uppercase leading-none tracking-tight">
        Lakat<span className="text-accent">.</span>
      </h1>
      <p className="mt-3 text-sm uppercase tracking-widest text-muted">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
        Nova lozinka. Ovaj put je zapamti.
      </p>

      {!ready ? (
        <p className="mt-12 text-sm text-muted">
          Provjeravam link iz maila...
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-12 flex flex-col gap-5 animate-[rise_300ms_var(--ease-fluid)_both]"
        >
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

          <button
            type="submit"
            disabled={isPending}
            className="pressable-soft mt-2 h-16 rounded-button bg-accent font-display text-2xl uppercase tracking-wide text-black shadow-glow disabled:opacity-50"
          >
            {isPending ? "Malo strpljenja..." : "Spremi lozinku"}
          </button>
        </form>
      )}
    </main>
  );
}
