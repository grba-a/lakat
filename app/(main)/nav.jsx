"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Linijske ikone (Lucide paths): transparentne, crtane stroke-om u brand
// zelenoj — aktivna puna, neaktivne prigušene
const ICONS = {
  sank: (
    <>
      <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
      <path d="M9 12v6" />
      <path d="M13 12v6" />
      <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z" />
      <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
    </>
  ),
  sram: (
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  mapa: (
    <>
      <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
      <path d="M15 5.764v15" />
      <path d="M9 3.236v15" />
    </>
  ),
  ja: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
};

const TABS = [
  { href: "/", label: "Šank", icon: "sank" },
  { href: "/shame", label: "Sram", icon: "sram" },
  { href: "/mapa", label: "Mapa", icon: "mapa" },
  { href: "/profil", label: "Ja", icon: "ja" },
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
              aria-label={tab.label}
              className={`pressable flex h-12 flex-1 items-center justify-center rounded-full transition-colors duration-200 ${
                active ? "bg-accent/15 text-accent" : "text-accent/45"
              }`}
              style={active ? { viewTransitionName: "tab-pill" } : undefined}
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
                {ICONS[tab.icon]}
              </svg>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
