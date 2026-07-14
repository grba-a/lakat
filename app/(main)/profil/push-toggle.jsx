"use client";

import { useEffect, useState, useTransition } from "react";
import { savePushSubscription, deletePushSubscription } from "./actions";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushToggle({ vapidPublicKey }) {
  // "loading" | "unsupported" | "denied" | "off" | "on"
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setStatus("on");
        else if (Notification.permission === "denied") setStatus("denied");
        else setStatus("off");
      })
      .catch(() => setStatus("unsupported"));
  }, []);

  function enable() {
    setError(null);
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const result = await savePushSubscription(sub.toJSON());
        if (result?.error) {
          setError(result.error);
          await sub.unsubscribe();
          return;
        }
        setStatus("on");
      } catch {
        setError("Subscribe nije prošao. Probaj opet.");
      }
    });
  }

  function disable() {
    setError(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await deletePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setStatus("off");
      } catch {
        setError("Nije se dalo isključiti. Probaj opet.");
      }
    });
  }

  const toggleable = status === "off" || status === "on";
  const isOn = status === "on";

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Obavijesti
      </h2>

      <div className="surface-2 mt-4 flex items-center gap-3 rounded-card px-4 py-4">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isOn ? "bg-accent/15 text-accent" : "bg-white/5 text-muted"
          }`}
        >
          {/* Zvonce — isti stroke stil kao nav ikone */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Obavijesti</span>
          <span className="mt-0.5 block text-xs text-muted">
            {status === "loading" && "Provjeravam..."}
            {status === "unsupported" &&
              "Ovaj browser ne podržava push. Na iPhoneu prvo dodaj Lakat na početni zaslon (vidi upute na Šanku) pa otvori odande."}
            {status === "denied" &&
              "Blokirao si obavijesti u postavkama browsera. Sam si to napravio, sam i odblokiraj."}
            {status === "on" && "Javit će ti se kad netko sjedne za šank."}
            {status === "off" && "Da znaš čim netko sjedne za šank."}
          </span>
        </span>

        {(toggleable || status === "loading") && (
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label={isOn ? "Isključi obavijesti" : "Uključi obavijesti"}
            onClick={isOn ? disable : enable}
            disabled={isPending || status === "loading"}
            className={`pressable-soft relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 after:absolute after:-inset-2 after:content-[''] disabled:opacity-50 ${
              isOn ? "bg-accent" : "bg-white/10"
            }`}
            style={{ touchAction: "manipulation" }}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-soft transition-[left] duration-200 ${
                isOn ? "left-7" : "left-1"
              }`}
            />
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
