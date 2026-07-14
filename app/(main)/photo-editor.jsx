"use client";

import { useEffect, useRef, useState } from "react";
import { drawTextOverlay } from "@/lib/image";

// IG-story stil: jedan tekst, par stilova, povlačenje gore-dolje.
// Preview crta ISTOM funkcijom kao finalni bake (drawTextOverlay) pa je
// ono što vidiš točno ono što se objavi.
const STYLES = [
  { key: "bijela", color: "#ffffff", plateColor: null, shadow: true },
  { key: "ploca", color: "#ffffff", plateColor: "rgba(0,0,0,0.75)", shadow: false },
  { key: "zelena", color: "#0a0a0a", plateColor: "#4ade80", shadow: false },
  { key: "zuta", color: "#fbbf24", plateColor: null, shadow: true },
];

export default function PhotoEditor({ file, onPublish, onRetake, onCancel }) {
  const [text, setText] = useState("");
  const [styleKey, setStyleKey] = useState("bijela");
  const [y, setY] = useState(0.75);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(false);
  const fontRef = useRef("system-ui, sans-serif");

  function overlaySpec() {
    const style = STYLES.find((s) => s.key === styleKey) ?? STYLES[0];
    return {
      text,
      y,
      fontFamily: fontRef.current,
      color: style.color,
      plateColor: style.plateColor,
      shadow: style.shadow,
    };
  }

  function draw() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawTextOverlay(ctx, canvas.width, canvas.height, overlaySpec());
  }

  // Učitaj sliku jednom; canvas dobiva omjer slike, širinu ekrana
  useEffect(() => {
    // Anton se u canvasu mora zvati pravim (next/font) imenom obitelji
    const anton = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-anton")
      .trim();
    if (anton) fontRef.current = anton;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        const cssW = canvas.clientWidth || 320;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round((cssW * img.height) / img.width * dpr);
        draw();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [text, styleKey, y]);

  function moveTo(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    setY(Math.min(0.95, Math.max(0.05, (e.clientY - rect.top) / rect.height)));
  }

  function onPointerDown(e) {
    if (!text.trim()) return;
    dragRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e);
  }

  function onPointerMove(e) {
    if (dragRef.current) moveTo(e);
  }

  function onPointerUp() {
    dragRef.current = false;
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-background px-5 py-6">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-muted">
        Dokaz{text.trim() ? " s porukom" : ""}. Povuci tekst gore-dolje.
      </p>

      <div className="mt-4 flex flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="w-full rounded-card border border-white/10 shadow-soft"
          style={{ touchAction: "none" }}
        />
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {STYLES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-label={`Stil teksta: ${s.key}`}
            aria-pressed={styleKey === s.key}
            onClick={() => setStyleKey(s.key)}
            className={`pressable-soft flex h-11 w-11 items-center justify-center rounded-full font-display text-lg ${
              styleKey === s.key ? "ring-2 ring-accent" : "ring-1 ring-white/15"
            }`}
            style={{
              background: s.plateColor ?? "rgba(255,255,255,0.06)",
              color: s.color,
              textShadow: s.shadow ? "0 1px 4px rgba(0,0,0,0.8)" : "none",
            }}
          >
            Aa
          </button>
        ))}
      </div>

      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={60}
        placeholder="Napiši nešto (ili nemoj)"
        enterKeyHint="done"
        className="mt-3 h-14 w-full rounded-field border border-white/10 bg-white/5 px-4 text-center text-base outline-none focus:border-accent/50"
      />

      <button
        type="button"
        onClick={() => onPublish(text.trim() ? overlaySpec() : null)}
        className="pressable mt-4 flex h-14 w-full items-center justify-center rounded-button bg-accent font-display text-xl uppercase tracking-wide text-black shadow-glow"
      >
        Objavi
      </button>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onRetake}
          className="surface-2 pressable-soft flex h-12 flex-1 items-center justify-center rounded-button font-display text-lg uppercase tracking-wide text-muted"
        >
          Ponovi
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="pressable-soft flex h-12 flex-1 items-center justify-center rounded-button border border-white/10 font-display text-lg uppercase tracking-wide text-muted"
        >
          Odustani
        </button>
      </div>
    </div>
  );
}
