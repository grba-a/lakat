"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentDayStart } from "@/lib/day";
import { checkIn } from "@/app/actions";

const timeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

export default function Sank({ profiles, initialCheckins, currentUserId }) {
  // userId -> ISO prvog današnjeg checkina
  const [arrivals, setArrivals] = useState(() => {
    const map = {};
    for (const c of initialCheckins) {
      if (!map[c.user_id]) map[c.user_id] = c.checked_in_at;
    }
    return map;
  });
  const [dayStartIso, setDayStartIso] = useState(() =>
    getCurrentDayStart().toISOString()
  );
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  // Realtime: svaki INSERT u checkins osvježava popis svima, bez refresha
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("checkins-insert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checkins" },
        (payload) => {
          const { user_id, checked_in_at } = payload.new;
          if (checked_in_at < getCurrentDayStart().toISOString()) return;
          setArrivals((prev) =>
            prev[user_id] && prev[user_id] <= checked_in_at
              ? prev
              : { ...prev, [user_id]: checked_in_at }
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Nakon 06:00 svi se resetiraju u sivo i bez refresha
  useEffect(() => {
    const timer = setInterval(
      () => setDayStartIso(getCurrentDayStart().toISOString()),
      60_000
    );
    return () => clearInterval(timer);
  }, []);

  const { present, absent } = useMemo(() => {
    const present = [];
    const absent = [];
    for (const p of profiles) {
      const arrivedAt = arrivals[p.id];
      if (arrivedAt && arrivedAt >= dayStartIso) {
        present.push({ ...p, arrivedAt });
      } else {
        absent.push(p);
      }
    }
    present.sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
    return { present, absent };
  }, [profiles, arrivals, dayStartIso]);

  const iAmPresent = Boolean(
    arrivals[currentUserId] && arrivals[currentUserId] >= dayStartIso
  );

  function handleCheckIn() {
    setError(null);
    startTransition(async () => {
      const result = await checkIn();
      if (result?.error) {
        setError(result.error);
        return;
      }
      // {ok} ili {already} — označi odmah, realtime ionako stiže za ostale
      setArrivals((prev) =>
        prev[currentUserId] ? prev : { ...prev, [currentUserId]: new Date().toISOString() }
      );
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <button
        type="button"
        onClick={handleCheckIn}
        disabled={iAmPresent || isPending}
        className={
          iAmPresent
            ? "glass mt-6 flex h-40 w-full items-center justify-center rounded-hero border-accent/40 font-display text-4xl uppercase tracking-wide text-accent shadow-glow"
            : "pressable mt-6 flex h-40 w-full items-center justify-center rounded-hero bg-accent font-display text-6xl uppercase tracking-wide text-black shadow-glow disabled:opacity-50"
        }
      >
        {iAmPresent ? "Tu si, legendo" : isPending ? "Sekunda..." : "Tu sam"}
      </button>

      {error && (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Za šankom {present.length > 0 && `(${present.length})`}
        </h2>

        {present.length === 0 && (
          <p className="mt-4 text-sm text-muted">
            Nikoga. Šank zjapi prazan, sram vas sve bilo.
          </p>
        )}

        <ul className="stagger mt-4 flex flex-col gap-2">
          {present.map((p, i) => (
            <li
              key={p.id}
              className="surface-2 flex h-14 items-center justify-between rounded-row border-accent/25 bg-accent/[0.08] px-4"
              style={{ "--stagger-i": Math.min(i, 8) }}
            >
              <span className="flex items-center gap-3 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {p.username}
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-accent">
                Prisutan · {timeFmt.format(new Date(p.arrivedAt))}
              </span>
            </li>
          ))}
          {absent.map((p, i) => (
            <li
              key={p.id}
              className="surface-2 flex h-14 items-center justify-between rounded-row px-4 opacity-40 transition-opacity duration-300"
              style={{ "--stagger-i": Math.min(present.length + i, 8) }}
            >
              <span className="font-bold">{p.username}</span>
              <span className="text-xs font-bold uppercase tracking-widest text-muted">
                Nema ga
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
