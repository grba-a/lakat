"use client";

import { useEffect, useState } from "react";

// Pokriva slučaj kad je app već otvorena i wifi/mobitel padne usred
// korištenja — SW offline fallback pokriva samo nove navigacije.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="glass-nav fixed inset-x-0 top-0 z-[200] flex justify-center px-5 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <p className="text-xs font-bold uppercase tracking-widest text-danger">
        Nema neta. Šank te ne vidi.
      </p>
    </div>
  );
}
