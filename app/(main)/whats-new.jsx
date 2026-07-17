"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "lakat-v2-news-dismissed";
// 19.7. u 06:00 po Zagrebu — kartica živi točno 2 lakat-dana od launcha
// (17. i 18.7.), poslije je mrtav kod i može se obrisati u nekoj sesiji
const NEWS_END = Date.parse("2026-07-19T04:00:00Z");

const NOVOSTI = [
  ["📣", "Dižem ekipu", "digni saziv, svi dobiju push, javljaju se stižu li."],
  ["🏆", "Liga ekipa", "vaša grupa protiv drugih, svaki tjedan. Sram tab je sad Liga."],
  ["🎯", "Izazov tjedna", "novi svaki ponedjeljak, vrijedi +10 bodova."],
  ["👥", "Zajednički kadar", "slika s ekipom nosi +4. Označi tko je s tobom."],
  ["↗", "Podijeli", "svaka slika postaje story kartica za Instagram."],
  ["⚑", "Naša mjesta", "ekipa s najviše rundi drži lokaciju na mapi."],
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
          Lakat 2.0
        </p>
        <h2 className="mt-1 font-display text-4xl uppercase leading-none tracking-tight">
          Veliki update<span className="text-accent">.</span>
        </h2>
        <p className="mt-2 text-sm font-bold text-muted">
          Sram je mrtav. Živjela liga.
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
          I da — ovo je tek početak,{" "}
          <span className="font-bold text-accent">još noviteta uskoro stiže</span>.
          Čekali ste tri dana? Nije nam žao. Isplatilo se.
        </p>
      </div>
    </div>
  );
}
