"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import jsQR from "jsqr";

// Iz skeniranog QR-a izvuci friend kod: ili iz /f/CODE linka ili goli 6-znak.
// Alfabet koda je bez 0/O/1/I (gen_friend_code), ali skener prihvaća bilo
// koji 6-znak pa server (sendFriendRequest) i dalje validira postojanje.
function extractCode(raw) {
  if (!raw) return null;
  const s = raw.trim();
  const link = s.match(/\/f\/([A-Za-z0-9]{6})(?:[/?#]|$)/);
  if (link) return link[1].toUpperCase();
  if (/^[A-Za-z0-9]{6}$/.test(s)) return s.toUpperCase();
  return null;
}

// Živi skener: getUserMedia video → jsQR petlja nad frameovima. Na detekciju
// zaustavi stream i vrati kod parentu. Overlay ide portalom u <body> (glass-nav
// backdrop-filter je containing block za fixed potomke).
export default function QrScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const rafRef = useRef(0);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  // Uvijek gađaj najsvježiji onDetected bez restarta kamere (deps [])
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function stopStream() {
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
        streamRef.current = null;
      }
    }

    function tick() {
      const video = videoRef.current;
      if (cancelled || !video) return;
      if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(img.data, img.width, img.height, {
          inversionAttempts: "dontInvert",
        });
        const code = found && extractCode(found.data);
        if (code) {
          cancelled = true;
          stopStream();
          onDetectedRef.current?.(code);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Ovaj uređaj ne da pristup kameri. Neka ti pošalje link (Podijeli).");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
        tick();
      } catch {
        if (!cancelled) {
          setError("Kamera je blokirana. Neka ti pošalje svoj link (Podijeli) pa ga otvori.");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ backgroundColor: "#09090b" }}
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <p className="font-display text-2xl uppercase tracking-tight">
          Skeniraj<span className="text-accent">.</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zatvori skener"
          className="pressable flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg"
        >
          ✕
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <div className="max-w-xs px-6 text-center">
            <p className="text-sm font-bold text-danger">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="pressable-soft mt-5 h-12 w-full rounded-button bg-accent font-display text-lg uppercase tracking-wide text-black"
            >
              Natrag
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Ciljnik */}
            <div
              className="pointer-events-none relative rounded-3xl"
              style={{
                width: 256,
                height: 256,
                border: "2px solid rgba(74, 222, 128, 0.85)",
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
              }}
            />
          </>
        )}
      </div>

      {!error && (
        <p className="px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4 text-center text-sm font-bold text-muted">
          Uperi u pajdašev QR. Dodaje se čim ga uhvatiš.
        </p>
      )}
    </div>,
    document.body
  );
}
