"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchGroup } from "@/app/actions";

// Dropdown pilula u kutu Šanka: aktivna grupa + prebacivanje (max 3).
// S jednom grupom je samo tiha oznaka bez menija.
export default function GroupSwitcher({ groups, activeId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const active = groups.find((g) => g.id === activeId) ?? groups[0];
  if (!active) return null;

  function handlePick(groupId) {
    setOpen(false);
    if (groupId === active.id) return;
    startTransition(async () => {
      await switchGroup(groupId);
      router.refresh();
    });
  }

  // S jednom grupom se u headeru uopće ne renderira (guard u layoutu);
  // ova grana je tihi fallback ako se komponenta iskoristi drugdje.
  if (groups.length < 2) {
    return (
      <span className="text-sm font-bold text-muted">{active.name}</span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className="pressable-soft inline-flex items-center gap-1 text-sm font-bold text-muted disabled:opacity-50"
        aria-label="Promijeni grupu"
      >
        {isPending ? "..." : active.name}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="glass absolute left-0 top-8 z-30 flex min-w-40 flex-col overflow-hidden rounded-card border border-white/10 shadow-float">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => handlePick(g.id)}
              className={`pressable-soft px-4 py-3 text-left text-sm font-bold ${
                g.id === active.id ? "text-accent" : "text-muted"
              }`}
            >
              {g.name}
              {g.id === active.id && <span className="ml-2">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
