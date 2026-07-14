"use client";

import { DRINK_TYPES } from "@/lib/drinks";

// Beer log — brojač + red emoji čipova, 1 tap = log. Prikazan samo dok si
// checkiran (roditelj to čuva). Čisti prikaz, logika (server akcije,
// optimistički state) je u sank.jsx — isti obrazac kao ReactionBar.
export default function DrinkBar({
  tonightCount,
  mySpinDrink,
  onLog,
  onUndo,
  disabled,
}) {
  return (
    <div className="glass mt-3 rounded-card p-4">
      <p className="font-display text-2xl uppercase leading-none tracking-wide">
        Večeras: <span className="text-accent">{tonightCount}</span>{" "}
        {tonightCount === 1 ? "piće" : "pića"}
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {DRINK_TYPES.map((d) => (
          <button
            key={d.key}
            type="button"
            disabled={disabled}
            onClick={() => onLog(d.key)}
            className={`pressable flex h-12 min-w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-button border px-2 text-xl disabled:opacity-50 ${
              mySpinDrink === d.key
                ? "border-accent/60 bg-accent/20"
                : "border-white/10 bg-white/[0.06]"
            }`}
            aria-label={`Logiraj ${d.label}`}
          >
            <span>{d.emoji}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
              {d.label}
            </span>
          </button>
        ))}
      </div>
      {DRINK_TYPES.some((d) => d.key === mySpinDrink) && (
        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-accent">
          Kolo kaže: {DRINK_TYPES.find((d) => d.key === mySpinDrink)?.label}
        </p>
      )}
      {tonightCount > 0 && (
        <button
          type="button"
          onClick={onUndo}
          disabled={disabled}
          className="pressable-soft mt-3 text-xs font-bold uppercase tracking-wider text-muted disabled:opacity-50"
        >
          ↩ Krivi tap
        </button>
      )}
    </div>
  );
}
