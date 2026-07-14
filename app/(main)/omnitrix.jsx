"use client";

import { useEffect, useRef, useState } from "react";
import { DRINK_TYPES } from "@/lib/drinks";

const SEGMENT_DEG = 360 / DRINK_TYPES.length;
const COLORS = ["#4ade80", "#22c55e", "#16a34a"];
// Ispod ove brzine otpusta (deg/ms) nema zamaha — kolo se samo poravna
const INERTIA_MIN_VELOCITY = 0.15;
// Zamah stane kad brzina padne ispod ovoga, pa kolo sjedne na segment
const INERTIA_STOP_VELOCITY = 0.02;
// Faktor trenja po 16ms framea
const FRICTION = 0.94;

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
  const r = 110;
  return { x: 150 + r * Math.sin(mid), y: 150 - r * Math.cos(mid) };
}

function mod360(deg) {
  return ((deg % 360) + 360) % 360;
}

// Kut prsta u odnosu na centar kola, u stupnjevima
function pointerAngle(e, el) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
}

// Segment koji je trenutno pod kazaljkom (vrh kola)
function selectedIndex(angle) {
  return Math.floor(mod360(-angle) / SEGMENT_DEG) % DRINK_TYPES.length;
}

// Najkraći pomak da centar odabranog segmenta sjedne točno pod kazaljku
function snapDelta(angle) {
  const target = -(selectedIndex(angle) + 0.5) * SEGMENT_DEG;
  return ((((target - angle) % 360) + 540) % 360) - 180;
}

// Omnitrix odabir pića: kolo se okreće prstom 1:1 (kao Ben 10 sat), otpust
// sa zamahom se istroši trenjem pa kolo sjedne na najbliži segment. Odabrano
// je piće pod kazaljkom, "Potvrdi" ga logira — nema randoma, nema servera u
// samom kolu. Overlay je namjerno POTPUNO neproziran (transparencija je
// glitchala preko sadržaja ispod).
export default function Omnitrix({ pending = false, onConfirm, onClose }) {
  // Start: prvi segment (piva) centriran pod kazaljkom
  const [angle, setAngle] = useState(-SEGMENT_DEG / 2);
  const [dragging, setDragging] = useState(false);
  const [coasting, setCoasting] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const dragRef = useRef(null); // { lastPointerDeg, samples: [{t, delta}] }
  const rafRef = useRef(null);
  const angleRef = useRef(angle);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  function moveTo(next) {
    angleRef.current = next;
    setAngle(next);
  }

  function stopInertia() {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setCoasting(false);
  }

  function settle() {
    setSnapping(true);
    moveTo(angleRef.current + snapDelta(angleRef.current));
  }

  function startInertia(v0) {
    setCoasting(true);
    let v = v0;
    let last = performance.now();
    function step(t) {
      const dt = Math.min(t - last, 64);
      last = t;
      v *= Math.pow(FRICTION, dt / 16);
      moveTo(angleRef.current + v * dt);
      if (Math.abs(v) < INERTIA_STOP_VELOCITY) {
        stopInertia();
        settle();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
  }

  function handlePointerDown(e) {
    stopInertia();
    setSnapping(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      lastPointerDeg: pointerAngle(e, e.currentTarget),
      samples: [],
    };
    setDragging(true);
  }

  function handlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const deg = pointerAngle(e, e.currentTarget);
    let delta = deg - drag.lastPointerDeg;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    drag.lastPointerDeg = deg;
    const t = e.timeStamp;
    drag.samples = [...drag.samples.filter((s) => t - s.t < 120), { t, delta }];
    moveTo(angleRef.current + delta);
  }

  function handlePointerUp(e) {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!drag) return;

    // Kutna brzina iz zadnjih ~120ms povlačenja
    const samples = drag.samples.filter((s) => e.timeStamp - s.t < 120);
    const total = samples.reduce((sum, s) => sum + s.delta, 0);
    const span = samples.length >= 2 ? e.timeStamp - samples[0].t : 0;
    const velocity = span > 0 ? total / span : 0;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!reduced && Math.abs(velocity) >= INERTIA_MIN_VELOCITY) {
      startInertia(velocity);
    } else {
      settle();
    }
  }

  const sel = selectedIndex(angle);
  const drink = DRINK_TYPES[sel];
  const busy = dragging || coasting;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background p-5"
      style={{
        background:
          "radial-gradient(60% 40% at 50% 30%, rgba(74, 222, 128, 0.08), transparent 70%), var(--background)",
      }}
      role="dialog"
      aria-label="Šta piješ?"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Preskoči piće"
        className="pressable absolute right-4 top-[max(env(safe-area-inset-top),1rem)] flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-white/5"
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
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>

      <div className="relative flex flex-col items-center gap-6">
        <h2 className="font-display text-4xl uppercase leading-none tracking-wide">
          Šta piješ<span className="text-accent">?</span>
        </h2>

        <div
          className="relative h-[280px] w-[280px]"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="absolute left-1/2 top-[-6px] z-10 h-4 w-4 -translate-x-1/2 rotate-45 bg-accent"
            aria-hidden="true"
          />
          <svg
            viewBox="0 0 300 300"
            className="h-full w-full rounded-full border-4 border-accent/40 shadow-glow"
            style={{
              transform: `rotate(${angle}deg)`,
              transition:
                snapping && !dragging
                  ? "transform 220ms cubic-bezier(0.2, 0.8, 0.3, 1)"
                  : "none",
            }}
            onTransitionEnd={() => setSnapping(false)}
          >
            {DRINK_TYPES.map((d, i) => {
              const pos = labelPos(i);
              const active = i === sel;
              return (
                <g key={d.key}>
                  <path
                    d={segmentPath(i)}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={active ? 1 : 0.5}
                    stroke={active ? "#fff" : "#000"}
                    strokeOpacity={active ? 0.9 : 0.3}
                    strokeWidth={active ? 2 : 1}
                  />
                  <text
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    fontSize="20"
                    dominantBaseline="middle"
                  >
                    {d.emoji}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="font-display text-3xl uppercase leading-none tracking-wide">
          {drink.emoji} <span className="text-accent">{drink.label}</span>
        </p>

        <button
          type="button"
          onClick={() => onConfirm(drink.key)}
          disabled={pending || busy}
          className="pressable-soft flex h-14 w-full max-w-xs items-center justify-center rounded-button bg-accent font-display text-xl uppercase tracking-wide text-black disabled:opacity-50"
        >
          {pending ? "Sekunda..." : `Potvrdi ${drink.label}`}
        </button>

        <p className="text-xs text-muted">Zavrti, nišani, potvrdi.</p>
      </div>
    </div>
  );
}
