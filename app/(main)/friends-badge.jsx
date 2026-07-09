"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getActiveFriendsCount } from "./profil/frendovi/actions";

// Ikona + broj trenutno aktivnih frendova u headeru. Bez stalnog pollinga —
// osvježi na mount i kad se korisnik vrati u app (focus/visibility). Štedi
// server/mrežu/bateriju; broj aktivnih se ionako sporo mijenja.
export default function FriendsBadge({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      const next = await getActiveFriendsCount();
      if (!cancelled && typeof next === "number") setCount(next);
    }
    function onVisibility() {
      if (document.visibilityState === "visible") refresh();
    }
    refresh();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <Link
      href="/profil/frendovi"
      aria-label={`Pajdaši — ${count} aktivnih`}
      className="pressable inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-accent/70 active:bg-white/5"
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <span
        className={`min-w-4 text-center font-display text-lg leading-none ${
          count > 0 ? "text-accent" : "text-muted"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
