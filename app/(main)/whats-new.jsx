"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "lakat-news-2-dismissed";
// 2 lakat-dana od deploya batcha #2 — datum potvrditi na dan pusha,
// poslije isteka kartica je mrtav kod (obrazac: mijenja se sadržaj +
// DISMISS_KEY + NEWS_END za svaki sljedeći batch)
const NEWS_END = Date.parse("2026-07-19T04:00:00Z");

const NOVOSTI = [
  ["📣", "Poziv na laktanje", "saziv se sad zove kako treba. Gumb: „Zovi narod“."],
  ["☕", "Kava u kolu", "vino je van, kava unutra — jutarnje laktanje sad legalno postoji."],
  ["⚑", "Otimanje mjesta", "otmeš li lokaciju drugoj ekipi, obje grupe saznaju odmah."],
  ["👥", "Laktaju skupa", "zajednički kadar javlja grupi tko se druži bez njih. Bole li uši?"],
];

// Jednokratni "što je novo" doček za LAKAT 2.0 — sam se gasi nakon 2 dana,
// X ga gasi odmah i zauvijek (localStorage, obrazac kao install-hint.jsx)
export default function WhatsNew() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Date.now() > NEWS_END) return;
    setShow(localStorage.getItem(DISMISS_KEY) !== "1");
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="glass relative mt-4 overflow-hidden rounded-card border-accent/40 shadow-glow">
      {/* Accent glow iz kuta — dubina bez slike */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl"
      />

      <button
        type="button"
        onClick={dismiss}
        aria-label="Zatvori novosti"
        className="pressable absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center rounded-full text-muted"
      >
        <svg
          width="18"
          height="18"
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

      <div className="relative px-5 pb-5 pt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
          Lakat 2.1
        </p>
        <h2 className="mt-1 font-display text-4xl uppercase leading-none tracking-tight">
          Nova runda<span className="text-accent">.</span>
        </h2>
        <p className="mt-2 text-sm font-bold text-muted">
          Rekli smo da stiže još. Nismo lagali.
        </p>

        <ul className="stagger mt-5 flex flex-col gap-3">
          {NOVOSTI.map(([emoji, naziv, opis], i) => (
            <li
              key={naziv}
              className="flex items-start gap-3 text-sm"
              style={{ "--stagger-i": i }}
            >
              <span className="w-6 shrink-0 text-center text-base leading-5 text-accent">
                {emoji}
              </span>
              <span className="leading-5">
                <span className="font-bold">{naziv}</span>{" "}
                <span className="text-muted">— {opis}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-muted">
          <span className="font-bold text-accent">Nastavljamo dolijevati</span> —
          imaš ideju što fali? Viči. Najbolje ćemo ukrasti i reći da su naše.
        </p>
      </div>
    </div>
  );
}
