"use client";

import { useRef, useState } from "react";
import { DRINK_TYPES, drinkInfo } from "@/lib/drinks";
import { spinKolo } from "@/app/actions";

const SEGMENT_DEG = 360 / DRINK_TYPES.length;
const COLORS = ["#4ade80", "#22c55e", "#16a34a"];

// Minimalna kutna brzina otpusta (deg/ms) da se zamah računa kao spin
const SPIN_VELOCITY_THRESHOLD = 0.3;
// Zamah dodaje ovoliko punih okretaja prije nego se kolo smiri na rezultat
const MOMENTUM_TURNS = 5;

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

// "Piće dana" — jednokratna dnevna ikona u headeru. Klik otvara kolo preko
// cijelog ekrana (neprozirno, ništa ispod nije klikabilno); nakon spina (i
// zatvaranja) ikona nestaje do 06:00. Nema tipke: kolo se zavrti rukom
// (povuci i pusti). Rezultat bira server (spinKolo); zamah je samo animacija
// koja se smiri točno na serverski segment.
export default function KoloIcon({ initialSpun = false }) {
  const [spun, setSpun] = useState(initialSpun);
  const [open, setOpen] = useState(false);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const dragRef = useRef(null); // { lastPointerDeg, samples: [{t, delta}] }
  const resultRef = useRef(null); // guard za onTransitionEnd prije rezultata

  if (spun && !open) return null;

  // Otpust sa zamahom: momentum animacija kreće ODMAH, server u pozadini
  // bira rezultat pa se cilj samo preusmjeri na pravi segment
  async function launchSpin(dir) {
    setError(null);
    setSpinning(true);
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!reduced) {
      setAngle((a) => a + dir * MOMENTUM_TURNS * 360);
    }

    const res = await spinKolo();
    if (res?.error) {
      setSpinning(false);
      setError(res.error);
      if (res.already) {
        resultRef.current = res.result;
        setResult(res.result);
        setSpun(true);
      }
      return;
    }
    setSpun(true);

    const idx = DRINK_TYPES.findIndex((d) => d.key === res.result);
    const jitter = Math.random() * (SEGMENT_DEG - 4) - (SEGMENT_DEG - 4) / 2;
    // Kut na kojem dobitni segment sjeda pod kazaljku (vrh kola)
    const target = 360 - (idx + 0.5) * SEGMENT_DEG + jitter;

    resultRef.current = res.result;
    if (reduced) {
      setAngle(target);
      setResult(res.result);
      setSpinning(false);
    } else {
      // Od trenutnog momentum cilja nastavi u ISTOM smjeru do rezultata —
      // transition se glatko preusmjeri, rezultat se otkriva kad kolo stane
      setAngle((m) =>
        dir > 0 ? m + mod360(target - m) : m - mod360(m - target)
      );
      setResult(res.result);
    }
  }

  function handlePointerDown(e) {
    if (spinning || result) return;
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
    setAngle((a) => a + delta);
  }

  function handlePointerUp(e) {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!drag || spinning || result) return;

    // Kutna brzina iz zadnjih ~120ms povlačenja
    const samples = drag.samples.filter((s) => e.timeStamp - s.t < 120);
    if (samples.length < 2) return;
    const total = samples.reduce((sum, s) => sum + s.delta, 0);
    const span = e.timeStamp - samples[0].t;
    if (span <= 0) return;
    const velocity = total / span;
    if (Math.abs(velocity) < SPIN_VELOCITY_THRESHOLD) return;

    launchSpin(velocity > 0 ? 1 : -1);
  }

  function handleClose() {
    if (spinning) return;
    setOpen(false);
  }

  const showResult = result && !spinning;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Piće dana — zavrti kolo"
        className="pressable inline-flex items-center rounded-full px-1 py-1 text-accent/70 active:bg-white/5"
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
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="1.5" />
          <path d="M12 3v7.5" />
          <path d="M19.8 16.5 13.3 12.8" />
          <path d="M4.2 16.5 10.7 12.8" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-5"
          style={{
            background:
              "radial-gradient(60% 40% at 50% 30%, rgba(74, 222, 128, 0.08), transparent 70%), var(--background)",
          }}
          role="dialog"
          aria-label="Piće dana"
        >
          {!showResult && (
            <button
              type="button"
              onClick={handleClose}
              disabled={spinning}
              aria-label="Zatvori kolo"
              className="pressable absolute right-4 top-[max(env(safe-area-inset-top),1rem)] flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-white/5 disabled:opacity-40"
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
          )}

          <div className="relative flex flex-col items-center gap-6">
            <h2 className="font-display text-4xl uppercase leading-none tracking-wide">
              Piće dana<span className="text-accent">.</span>
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
                    spinning && !dragging
                      ? "transform 4s cubic-bezier(0.12, 0.8, 0.2, 1)"
                      : "none",
                }}
                onTransitionEnd={() => {
                  if (resultRef.current) setSpinning(false);
                }}
              >
                {DRINK_TYPES.map((d, i) => {
                  const pos = labelPos(i);
                  return (
                    <g key={d.key}>
                      <path
                        d={segmentPath(i)}
                        fill={COLORS[i % COLORS.length]}
                        fillOpacity={0.85}
                        stroke="#000"
                        strokeOpacity={0.3}
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

            {showResult ? (
              <div className="glass flex flex-col items-center gap-3 rounded-card p-5 text-center">
                <p className="font-display text-2xl uppercase leading-tight tracking-wide">
                  Kolo je presudilo:{" "}
                  <span className="text-accent">
                    {drinkInfo(result)?.emoji} {drinkInfo(result)?.label}
                  </span>
                </p>
                <p className="text-xs text-muted">Nema žalbe.</p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="pressable-soft flex h-11 items-center justify-center rounded-button bg-accent px-6 font-display text-sm uppercase tracking-wide text-black"
                >
                  Prihvaćam sudbinu
                </button>
              </div>
            ) : (
              <p className="font-display text-xl uppercase tracking-wide text-muted">
                {spinning ? "Vrti se..." : "Zavrti ga. Rukom."}
              </p>
            )}

            {error && (
              <p className="max-w-xs rounded-card border border-danger/30 bg-danger/10 px-4 py-2 text-center text-sm font-bold text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
