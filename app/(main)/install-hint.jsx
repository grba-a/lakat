"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "lakat-install-hint-dismissed";

// Diskretna poruka samo za one koji NISU instalirali aplikaciju; X je
// trajno gasi (localStorage) da ne gnjavi svaki put
export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    setShow(!standalone && !dismissed);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="relative mt-8">
      <Link
        href="/upute"
        className="pressable-soft block rounded-card border border-dashed border-white/15 bg-white/[0.03] py-3 pl-4 pr-12 text-center text-xs text-muted"
      >
        <span className="font-bold text-foreground">
          Dodaj Lakat na početni zaslon
        </span>{" "}
        za notifikacije. Kako? Stisni tu. →
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Sakrij"
        className="pressable absolute right-0 top-0 flex h-full w-11 items-center justify-center text-muted/60"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}
