"use client";

import { useEffect, useRef } from "react";
import { heartbeat } from "./profil/frendovi/actions";

const INTERVAL_MS = 180_000;

// Javlja "zadnje viđen" dok je app u foregroundu; pauzira kad je tab
// pozadinski da ne troši bateriju/network uzalud
export default function PresenceHeartbeat() {
  const timerRef = useRef(null);

  useEffect(() => {
    function tick() {
      if (document.visibilityState === "visible") heartbeat();
    }
    function start() {
      tick();
      if (!timerRef.current) timerRef.current = setInterval(tick, INTERVAL_MS);
    }
    function stop() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
