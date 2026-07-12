"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinByInvite } from "@/app/(main)/profil/postavke/grupe-actions";

export default function JoinByLinkButton({ code }) {
  const router = useRouter();
  const [state, setState] = useState(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await joinByInvite(code);
      setState(result ?? null);
      if (result?.ok) {
        setTimeout(() => router.push("/"), 900);
      }
    });
  }

  if (state?.ok) {
    return (
      <p className="mt-10 rounded-card border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-bold text-accent">
        {state.message ?? "Upao si."}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="pressable-soft mt-10 flex h-16 w-full items-center justify-center rounded-button bg-accent font-display text-2xl uppercase tracking-wide text-black shadow-glow disabled:opacity-50"
      >
        {isPending ? "Sekunda..." : "Uleti u grupu"}
      </button>
      {state?.error && (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {state.error}
        </p>
      )}
    </>
  );
}
