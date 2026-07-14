"use client";

import { useState } from "react";

// Bez tugla ispod ovog broja bedževa (dvije pune grid linije)
const COLLAPSE_THRESHOLD = 6;

// Sklopivi grid bedževa: otključani prvi, zaključani iza "Vidi sve" —
// 16+ kartica je gušilo profil. Server (badges-grid.jsx) šalje već
// posložen popis {key, label, description, got}.
export default function BadgesList({ badges }) {
  const [expanded, setExpanded] = useState(false);

  const unlocked = badges.filter((b) => b.got);
  // Bez ijednog otključanog sekcija ne smije biti samo naslov — pokaži
  // prva 3 zaključana kao teaser
  const collapsed = unlocked.length > 0 ? unlocked : badges.slice(0, 3);
  const collapsible = badges.length > COLLAPSE_THRESHOLD;
  const shown = !collapsible || expanded ? badges : collapsed;

  return (
    <>
      <div className="stagger mt-4 grid grid-cols-3 gap-2">
        {shown.map((badge, i) => (
          <div
            key={badge.key}
            className={`rounded-card border px-3 py-4 text-center ${
              badge.got
                ? "border-accent/40 bg-accent/10"
                : "border-white/10 bg-white/[0.03] opacity-40"
            }`}
            style={{ "--stagger-i": Math.min(i, 8) }}
          >
            <p
              className={`font-display text-sm uppercase leading-tight tracking-wide ${
                badge.got ? "text-accent" : "text-muted"
              }`}
            >
              {badge.label}
            </p>
            <p className="mt-1 text-[10px] text-muted">{badge.description}</p>
          </div>
        ))}
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="pressable-soft mt-3 flex h-11 w-full items-center justify-center rounded-button border border-white/10 bg-white/[0.03] text-xs font-bold uppercase tracking-widest text-muted"
        >
          {expanded ? "Sakrij" : `Vidi sve (${badges.length})`}
        </button>
      )}
    </>
  );
}
