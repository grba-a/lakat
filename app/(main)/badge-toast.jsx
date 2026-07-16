"use client";

import { useEffect } from "react";

const DISMISS_MS = 3000;

// Prikazuje jedan bedž iz reda (queue[0]) pa poziva onDone da ga roditelj
// makne — sljedeći u redu (ako ima) izroni sam. Roditelj drži queue u
// stanju i puni ga kad akcija (checkin/komentar/piće) vrati newBadges.
export default function BadgeToast({ queue, onDone }) {
  const current = queue?.[0] ?? null;

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => onDone(current.key), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [current, onDone]);

  if (!current) return null;

  return (
    <div
      className="badge-toast fixed inset-x-5 top-6 z-50 flex items-center gap-3 rounded-card border border-accent/40 bg-black/90 px-4 py-3 shadow-glow backdrop-blur-xl"
      role="status"
      onClick={() => onDone(current.key)}
    >
      <span className="text-2xl">🏅</span>
      <span className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
          Otključao si bedž
        </span>
        <span className="font-display text-lg uppercase leading-none tracking-wide">
          {current.label}
        </span>
        <span className="text-xs text-muted">{current.description}</span>
      </span>
    </div>
  );
}
