"use client";

import { useActionState, useState } from "react";
import { completeOnboarding } from "./actions";

const inputClass =
  "h-14 rounded-field border border-white/10 bg-white/[0.05] px-4 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted/50 focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]";

export default function OnboardingForm({ needsUsername }) {
  const [state, formAction, isPending] = useActionState(completeOnboarding, null);
  const [mode, setMode] = useState("join");

  return (
    <form
      action={formAction}
      className="mt-10 flex flex-col gap-5 animate-[rise_300ms_var(--ease-fluid)_both]"
    >
      {needsUsername && (
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
      )}

      <input type="hidden" name="mode" value={mode} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`pressable-soft h-12 rounded-full text-xs font-bold uppercase tracking-widest ${
            mode === "join" ? "bg-accent/15 text-accent" : "surface-2 text-muted"
          }`}
        >
          Upadam u postojeću
        </button>
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`pressable-soft h-12 rounded-full text-xs font-bold uppercase tracking-widest ${
            mode === "create" ? "bg-accent/15 text-accent" : "surface-2 text-muted"
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
        {isPending ? "Malo strpljenja..." : mode === "join" ? "Upadam" : "Osnivam grupu"}
      </button>
    </form>
  );
}
