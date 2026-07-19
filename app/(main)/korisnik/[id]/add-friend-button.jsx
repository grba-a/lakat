"use client";

import { useState, useTransition } from "react";
import { sendFriendRequestTo } from "@/app/(main)/profil/frendovi/actions";

// Zahtjev za pajdaša izravno s tuđeg (ne-frend) profila — akcija na
// serveru traži bar jednog zajedničkog pajdaša (anti-spam)
export default function AddFriendButton({ targetId }) {
  const [state, setState] = useState(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await sendFriendRequestTo(targetId);
      setState(result ?? null);
    });
  }

  if (state?.ok) {
    return (
      <p className="mt-8 rounded-card border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-bold text-accent">
        {state.message ?? "Zahtjev poslan."}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="pressable-soft mt-8 flex h-14 w-full items-center justify-center rounded-button bg-accent font-display text-xl uppercase tracking-wide text-black shadow-glow disabled:opacity-50"
      >
        {isPending ? "Sekunda..." : "Pošalji zahtjev"}
      </button>
      {state?.error && (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {state.error}
        </p>
      )}
    </>
  );
}
