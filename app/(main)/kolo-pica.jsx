"use client";

import { useRef, useState } from "react";
import { DRINK_TYPES, drinkInfo } from "@/lib/drinks";

const SEGMENT_DEG = 360 / DRINK_TYPES.length;
const COLORS = [
  "#4ade80",
  "#22c55e",
  "#16a34a",
  "#4ade80",
  "#22c55e",
  "#16a34a",
  "#4ade80",
  "#22c55e",
];

function segmentPath(index) {
  const start = (index * SEGMENT_DEG * Math.PI) / 180;
  const end = ((index + 1) * SEGMENT_DEG * Math.PI) / 180;
  const cx = 150;
  const cy = 150;
  const r = 148;
  const x1 = cx + r * Math.sin(start);
  const y1 = cy - r * Math.cos(start);
  const x2 = cx + r * Math.sin(end);
  const y2 = cy - r * Math.cos(end);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

function labelPos(index) {
  const mid = ((index + 0.5) * SEGMENT_DEG * Math.PI) / 180;
  const r = 100;
  return { x: 150 + r * Math.sin(mid), y: 150 - r * Math.cos(mid) };
}

// Kolo pića — SVG + CSS transform, bez novih dependencija. Rezultat bira
// server (spinKolo); ovdje se samo animira kolo da sleti na taj segment.
export default function KoloPica({ mySpinDrink, onSpin, disabled }) {
  const [open, setOpen] = useState(false);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const wheelRef = useRef(null);

  const alreadySpun = Boolean(mySpinDrink);

  function handleOpen() {
    setError(null);
    setResult(alreadySpun ? mySpinDrink : null);
    setOpen(true);
  }

  async function handleSpin() {
    if (alreadySpun || spinning) return;
    setError(null);
    setSpinning(true);
    const res = await onSpin();
    if (res?.error) {
      setSpinning(false);
      setError(res.error);
      if (res.already) setResult(res.result);
      return;
    }
    const idx = DRINK_TYPES.findIndex((d) => d.key === res.result);
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const jitter = Math.random() * (SEGMENT_DEG - 4) - (SEGMENT_DEG - 4) / 2;
    const targetDeg =
      (reduced ? 0 : 5 * 360) +
      (360 - (idx + 0.5) * SEGMENT_DEG) +
      (reduced ? 0 : jitter);
    setAngle((prev) => prev - (prev % 360) + targetDeg);
    if (reduced) {
      setSpinning(false);
      setResult(res.result);
    }
  }

  function handleTransitionEnd() {
    if (!spinning) return;
    setSpinning(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className="pressable-soft mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-button border border-accent/30 bg-accent/10 font-display text-lg uppercase tracking-wide text-accent disabled:opacity-50"
      >
        {alreadySpun ? `Kolo je reklo: ${drinkInfo(mySpinDrink)?.label}` : "🎡 Zavrti kolo"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/85 p-5 backdrop-blur-xl"
          onClick={() => !spinning && setOpen(false)}
          role="dialog"
          aria-label="Kolo pića"
        >
          <div
            className="relative flex flex-col items-center gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-[280px] w-[280px]">
              <div
                className="absolute left-1/2 top-[-6px] z-10 h-4 w-4 -translate-x-1/2 rotate-45 bg-accent"
                aria-hidden="true"
              />
              <svg
                ref={wheelRef}
                viewBox="0 0 300 300"
                className="h-full w-full rounded-full border-4 border-accent/40 shadow-glow"
                style={{
                  transform: `rotate(${angle}deg)`,
                  transition: spinning ? "transform 4s cubic-bezier(0.12, 0.8, 0.2, 1)" : "none",
                }}
                onTransitionEnd={handleTransitionEnd}
              >
                {DRINK_TYPES.map((d, i) => {
                  const pos = labelPos(i);
                  return (
                    <g key={d.key}>
                      <path d={segmentPath(i)} fill={COLORS[i]} fillOpacity={0.85} stroke="#000" strokeOpacity={0.3} />
                      <text
                        x={pos.x}
                        y={pos.y}
                        textAnchor="middle"
                        fontSize="22"
                        dominantBaseline="middle"
                      >
                        {d.emoji}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {result && !spinning ? (
              <div className="glass flex flex-col items-center gap-3 rounded-card p-5 text-center">
                <p className="font-display text-2xl uppercase leading-tight tracking-wide">
                  Kolo je presudilo:{" "}
                  <span className="text-accent">{drinkInfo(result)?.label}</span>
                </p>
                <p className="text-xs text-muted">Nema žalbe.</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="pressable-soft flex h-11 items-center justify-center rounded-button bg-accent px-6 font-display text-sm uppercase tracking-wide text-black"
                >
                  Prihvaćam sudbinu
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSpin}
                disabled={spinning || alreadySpun}
                className="pressable-soft flex h-14 w-48 items-center justify-center rounded-button bg-accent font-display text-xl uppercase tracking-wide text-black disabled:opacity-50"
              >
                {spinning ? "Vrti se..." : "Vrti"}
              </button>
            )}

            {error && (
              <p className="max-w-xs rounded-card border border-danger/30 bg-danger/10 px-4 py-2 text-center text-sm font-bold text-danger">
                {error}
              </p>
            )}

            <p className="text-xs text-muted/60">Stisni izvan kola za zatvoriti</p>
          </div>
        </div>
      )}
    </>
  );
}
