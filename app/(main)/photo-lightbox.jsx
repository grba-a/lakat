"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { shareCard } from "@/lib/share-card";

// Fullscreen pregled slika sa swipe carouselom (CSS scroll-snap) — tap bilo
// gdje zatvara (browser guta click nakon touch-scrolla pa swipe NE zatvara);
// children (npr. reakcije) ne zatvaraju i prate trenutno prikazanu sliku.
//
// items: [{ url, caption, checkinId? }] — jedna slika = array od 1 (bez
// točkica/brojača); children može biti render-prop (current) => node.
export default function PhotoLightbox({ items, startIndex = 0, onClose, children }) {
  const count = items?.length ?? 0;
  const [index, setIndex] = useState(startIndex);
  const [sharing, setSharing] = useState(false);
  const trackRef = useRef(null);
  const lastScrollRef = useRef(0);

  // Zaključaj skrol stranice ispod dok je overlay otvoren
  useEffect(() => {
    if (!count) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [count]);

  // Skoči na početni slajd prije painta (bez bljeska prvog slajda)
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (el && startIndex > 0) el.scrollLeft = startIndex * el.clientWidth;
    setIndex(startIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex, count]);

  if (!count) return null;

  const current = items[Math.min(index, count - 1)];

  function handleScroll(e) {
    lastScrollRef.current = Date.now();
    const el = e.currentTarget;
    const i = Math.max(
      0,
      Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth))
    );
    setIndex(i);
  }

  // Ghost-click zaštita: iOS zna propustiti click odmah nakon snap skrola
  function handleBackdropClick() {
    if (Date.now() - lastScrollRef.current < 150) return;
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 py-5 backdrop-blur-xl"
      onClick={handleBackdropClick}
      role="dialog"
      aria-label={current?.caption || "Slika"}
    >
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="scrollbar-none flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {items.map((it, i) => (
          <div
            key={it.checkinId ?? `${it.url}-${i}`}
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-3 px-5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.url}
              alt={it.caption || ""}
              decoding="async"
              fetchPriority={i === startIndex ? "high" : undefined}
              loading={i === startIndex ? undefined : "lazy"}
              className="max-h-[70dvh] w-auto max-w-full rounded-card border border-white/10 object-contain shadow-float"
            />
            {it.caption && (
              <p className="text-sm font-bold uppercase tracking-widest text-muted">
                {it.caption}
              </p>
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="flex items-center justify-center gap-3">
          <span className="flex gap-1.5">
            {items.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === index ? "bg-accent" : "bg-white/25"
                }`}
              />
            ))}
          </span>
          <span className="text-xs font-bold text-muted">
            {index + 1}/{count}
          </span>
        </div>
      )}

      {children && (
        <div onClick={(e) => e.stopPropagation()}>
          {typeof children === "function" ? children(current) : children}
        </div>
      )}

      <button
        type="button"
        disabled={sharing}
        onClick={async (e) => {
          e.stopPropagation();
          setSharing(true);
          try {
            await shareCard({ url: current.url, caption: current.caption });
          } catch {
            // slika bez CORS-a ili prekinut share — tiho odustani
          } finally {
            setSharing(false);
          }
        }}
        className="pressable flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-50"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <path d="m16 6-4-4-4 4" />
          <path d="M12 2v13" />
        </svg>
        {sharing ? "Sekunda..." : "Podijeli"}
      </button>
      <p className="text-xs text-muted/60">Stisni bilo gdje za zatvoriti</p>
    </div>
  );
}
