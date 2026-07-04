"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Diskretna poruka samo za one koji NISU instalirali aplikaciju
export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    setShow(!standalone);
  }, []);

  if (!show) return null;

  return (
    <Link
      href="/upute"
      className="mt-8 block border-2 border-dashed border-line px-4 py-3 text-center text-xs text-muted"
    >
      <span className="font-bold text-foreground">
        Dodaj Lakat na početni zaslon
      </span>{" "}
      za notifikacije. Kako? Stisni tu. →
    </Link>
  );
}
