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

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Obavijesti
      </h2>

      {status === "loading" && (
        <p className="mt-4 text-sm text-muted">Provjeravam...</p>
      )}

      {status === "unsupported" && (
        <p className="mt-4 text-sm text-muted">
          Ovaj browser ne podržava push. Na iPhoneu prvo dodaj Lakat na
          početni zaslon (vidi upute na Šanku) pa otvori odande.
        </p>
      )}

      {status === "denied" && (
        <p className="mt-4 text-sm text-muted">
          Blokirao si obavijesti u postavkama browsera. Sam si to napravio,
          sam i odblokiraj.
        </p>
      )}

      {(status === "off" || status === "on") && (
        <>
          <button
            type="button"
            onClick={status === "on" ? disable : enable}
            disabled={isPending}
            className={
              status === "on"
                ? "mt-4 h-14 w-full border-2 border-line bg-surface font-display text-xl uppercase tracking-wide text-muted active:translate-y-0.5 disabled:opacity-50"
                : "mt-4 h-14 w-full bg-accent font-display text-xl uppercase tracking-wide text-black active:translate-y-0.5 disabled:opacity-50"
            }
          >
            {isPending
              ? "Sekunda..."
              : status === "on"
                ? "Isključi obavijesti"
                : "Uključi obavijesti"}
          </button>
          <p className="mt-2 text-xs text-muted">
            {status === "on"
              ? "Javit će ti se kad netko sjedne za šank."
              : "Da znaš čim netko sjedne za šank."}
          </p>
        </>
      )}

      {error && (
        <p className="mt-3 border-2 border-danger bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
