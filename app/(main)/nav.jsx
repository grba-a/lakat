"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Šank" },
  { href: "/shame", label: "Sram" },
  { href: "/profil", label: "Ja" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t-2 border-line bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-sm">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex h-16 flex-1 items-center justify-center font-display text-xl uppercase tracking-wide ${
                active ? "border-t-4 border-accent text-accent" : "text-muted"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
