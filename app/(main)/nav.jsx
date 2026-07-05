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
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-5 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      style={{ viewTransitionName: "tab-bar" }}
    >
      <div className="glass-nav mx-auto flex w-full max-w-sm rounded-full p-1.5">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`pressable flex h-12 flex-1 items-center justify-center rounded-full font-display text-lg uppercase tracking-wide transition-colors duration-200 ${
                active ? "bg-accent/15 text-accent" : "text-muted"
              }`}
              style={active ? { viewTransitionName: "tab-pill" } : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
