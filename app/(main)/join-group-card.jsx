"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinBeta, joinGroup, createGroup } from "./profil/postavke/grupe-actions";

const inputClass =
  "h-14 rounded-field border border-white/10 bg-white/[0.05] px-4 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted/50 focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]";

function Err({ state }) {
  if (!state?.error) return null;
  return (
    <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
      {state.error}
    </p>
  );
}

export default function JoinGroupCard() {
  const router = useRouter();
  const [mode, setMode] = useState(null); // null | "join" | "create"
  const [betaErr, setBetaErr] = useState(null);
  const [betaPending, startBeta] = useTransition();
  const [joinState, joinAction, joinPending] = useActionState(joinGroup, null);
  const [createState, createAction, createPending] = useActionState(createGroup, null);

  function handleBeta() {
    setBetaErr(null);
    startBeta(async () => {
      const result = await joinBeta();
      if (result?.error) setBetaErr(result);
      else router.refresh();
    });
  }

  // Nakon uspješnog join/create povuci novi server render pa Šank dobije grupu
  // (uz revalidatePath iz samih akcija)
  useEffect(() => {
    if (joinState?.ok || createState?.ok) router.refresh();
  }, [joinState, createState, router]);

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Nisi u grupi
      </h2>
      <p className="mt-2 text-sm text-muted">
        Da vidiš tko je za šankom i da sjedneš za šank, uđi u grupu.
      </p>

      {/* Primarno: javna BETA, bez šifre */}
      <button
        type="button"
        onClick={handleBeta}
        disabled={betaPending}
        className="pressable mt-5 flex h-16 w-full items-center justify-center rounded-button bg-accent font-display text-2xl uppercase tracking-wide text-black shadow-glow disabled:opacity-50"
      >
        {betaPending ? "Sekunda..." : "Uđi u BETA"}
      </button>
      <p className="mt-2 text-center text-xs text-muted">
        Javna grupa. Bez šifre, samo uleti.
      </p>
      {betaErr && <div className="mt-3">{<Err state={betaErr} />}</div>}

      {/* Sekundarno: druge grupe (traže naziv + šifru) */}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode(mode === "join" ? null : "join")}
          className={`pressable-soft h-12 rounded-full text-xs font-bold uppercase tracking-widest ${
            mode === "join" ? "bg-accent/15 text-accent" : "surface-2 text-muted"
          }`}
        >
          Druga grupa
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "create" ? null : "create")}
          className={`pressable-soft h-12 rounded-full text-xs font-bold uppercase tracking-widest ${
            mode === "create" ? "bg-accent/15 text-accent" : "surface-2 text-muted"
          }`}
        >
          Osnuj novu
        </button>
      </div>

      {mode === "join" && (
        <form action={joinAction} className="mt-4 flex flex-col gap-4">
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
              placeholder="kako se grupa zove"
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
              autoComplete="off"
              className={inputClass}
            />
            <span className="text-xs text-muted">Ne znaš je? Pitaj ekipu.</span>
          </label>
          <Err state={joinState} />
          <button
            type="submit"
            disabled={joinPending}
            className="surface-2 pressable-soft h-14 w-full rounded-button font-display text-xl uppercase tracking-wide text-foreground disabled:opacity-50"
          >
            {joinPending ? "Sekunda..." : "Upadam"}
          </button>
        </form>
      )}

      {mode === "create" && (
        <form action={createAction} className="mt-4 flex flex-col gap-4">
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
              placeholder="npr. ime kafane"
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
              minLength={4}
              autoComplete="off"
              className={inputClass}
            />
            <span className="text-xs text-muted">
              Nju daješ ekipi da upadne. Nemoj 1234, molim te.
            </span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted">
              Ponovi šifru
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
          <Err state={createState} />
          <button
            type="submit"
            disabled={createPending}
            className="surface-2 pressable-soft h-14 w-full rounded-button font-display text-xl uppercase tracking-wide text-foreground disabled:opacity-50"
          >
            {createPending ? "Sekunda..." : "Osnivam grupu"}
          </button>
        </form>
      )}
    </section>
  );
}
