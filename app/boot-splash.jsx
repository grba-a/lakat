"use client";

import { useEffect, useState } from "react";

// Brendirani boot splash. Renderira se u početni HTML (dio root layouta) pa
// se vidi čim prvi bajtovi stignu — pokriva "crni ekran" dok se JS skida i
// app hidrira na sporoj vezi. Fade-in kasni ~300ms, pa ga brzi korisnici
// (hidracija < 300ms) nikad ne vide. Uklanja se na hidraciji (useEffect).
// U instaliranom PWA-u je skriven CSS-om (display:none u globals.css) —
// native iOS splash tamo već pokriva boot, dva splasha zaredom su treperila.
export default function BootSplash() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // Hidracija gotova → app je spreman, makni splash
    setLeaving(true);
    const id = setTimeout(() => setGone(true), 260);
    return () => clearTimeout(id);
  }, []);

  if (gone) return null;

  return (
    <div
      role="status"
      aria-label="Učitavanje"
      className={`boot-splash fixed inset-0 z-[300] flex items-center justify-center bg-background ${
        leaving ? "boot-leaving" : ""
      }`}
    >
      <p className="font-display text-7xl uppercase leading-none tracking-tight">
        Lakat<span className="boot-dot text-accent">.</span>
      </p>
    </div>
  );
}
