"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentDayStart } from "@/lib/day";
import { checkIn, cancelCheckIn } from "@/app/actions";
import Avatar from "./avatar";

const timeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

export default function Sank({ profiles, initialCheckins, currentUserId }) {
  // Svi današnji checkin REDOVI po id-u (jedan korisnik može imati više:
  // checkin -> poništi -> novi checkin). Realtime UPDATE mijenja red po id-u.
  const [rows, setRows] = useState(() => {
    const map = {};
    for (const c of initialCheckins) map[c.id] = c;
    return map;
  });
  const [dayStartIso, setDayStartIso] = useState(() =>
    getCurrentDayStart().toISOString()
  );
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  // Realtime: INSERT (novi checkin) + UPDATE (poništenje) osvježavaju sve
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("checkins-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checkins" },
        (payload) => {
          if (payload.new.checked_in_at < getCurrentDayStart().toISOString()) return;
          setRows((prev) => ({ ...prev, [payload.new.id]: payload.new }));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "checkins" },
        (payload) => {
          setRows((prev) =>
            prev[payload.new.id] ? { ...prev, [payload.new.id]: payload.new } : prev
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

  // Po korisniku: najraniji aktivni checkin (dolazak) i najkasnije poništenje
  const { present, fled, absent } = useMemo(() => {
    const byUser = new Map();
    for (const row of Object.values(rows)) {
      if (row.checked_in_at < dayStartIso) continue;
      const u = byUser.get(row.user_id) ?? { activeAt: null, cancelledAt: null };
      if (!row.cancelled_at) {
        if (!u.activeAt || row.checked_in_at < u.activeAt) {
          u.activeAt = row.checked_in_at;
        }
      } else if (!u.cancelledAt || row.cancelled_at > u.cancelledAt) {
        u.cancelledAt = row.cancelled_at;
      }
      byUser.set(row.user_id, u);
    }

    const present = [];
    const fled = [];
    const absent = [];
    for (const p of profiles) {
      const u = byUser.get(p.id);
      if (u?.activeAt) present.push({ ...p, arrivedAt: u.activeAt });
      else if (u?.cancelledAt) fled.push({ ...p, cancelledAt: u.cancelledAt });
      else absent.push(p);
    }
    present.sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
    fled.sort((a, b) => b.cancelledAt.localeCompare(a.cancelledAt));
    return { present, fled, absent };
  }, [profiles, rows, dayStartIso]);

  const iAmPresent = present.some((p) => p.id === currentUserId);

  function handleCheckIn() {
    setError(null);
    startTransition(async () => {
      const result = await checkIn();
      if (result?.error) {
        setError(result.error);
        return;
      }
      // Optimistički temp red; pravi stiže realtimeom (derivacija je po
      // korisniku pa duplikat ne smeta)
      setRows((prev) => ({
        ...prev,
        [`tmp-${currentUserId}`]: {
          id: `tmp-${currentUserId}`,
          user_id: currentUserId,
          checked_in_at: new Date().toISOString(),
          cancelled_at: null,
        },
      }));
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelCheckIn();
      if (result?.error) {
        setError(result.error);
        return;
      }
      // Optimistički poništi sve svoje aktivne redove (uključivo temp)
      const now = new Date().toISOString();
      setRows((prev) => {
        const next = { ...prev };
        for (const [id, row] of Object.entries(next)) {
          if (row.user_id === currentUserId && !row.cancelled_at) {
            next[id] = { ...row, cancelled_at: now };
          }
        }
        return next;
      });
    });
  }

  function profileHref(id) {
    return id === currentUserId ? "/profil" : `/korisnik/${id}`;
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

      {iAmPresent && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="pressable-soft mt-3 flex h-12 w-full items-center justify-center rounded-button border border-danger/30 bg-danger/10 font-display text-lg uppercase tracking-wide text-danger disabled:opacity-50"
        >
          {isPending ? "Sekunda..." : "Ipak bježim"}
        </button>
      )}

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
              className="surface-2 pressable-soft rounded-row border-accent/25 bg-accent/[0.08]"
              style={{ "--stagger-i": Math.min(i, 8) }}
            >
              <Link
                href={profileHref(p.id)}
                className="flex h-14 items-center justify-between px-4"
              >
                <span className="flex items-center gap-3 font-bold">
                  <Avatar
                    username={p.username}
                    avatarUrl={p.avatar_url}
                    size={32}
                    className="border-accent/40"
                  />
                  {p.username}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-accent">
                  Prisutan · {timeFmt.format(new Date(p.arrivedAt))}
                </span>
              </Link>
            </li>
          ))}
          {fled.map((p, i) => (
            <li
              key={p.id}
              className="surface-2 pressable-soft rounded-row border-danger/25 bg-danger/[0.06] opacity-70"
              style={{ "--stagger-i": Math.min(present.length + i, 8) }}
            >
              <Link
                href={profileHref(p.id)}
                className="flex h-14 items-center justify-between px-4"
              >
                <span className="flex items-center gap-3 font-bold">
                  <Avatar
                    username={p.username}
                    avatarUrl={p.avatar_url}
                    size={32}
                    className="border-danger/40"
                  />
                  {p.username}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-danger">
                  Pobjegao u {timeFmt.format(new Date(p.cancelledAt))}
                </span>
              </Link>
            </li>
          ))}
          {absent.map((p, i) => (
            <li
              key={p.id}
              className="surface-2 pressable-soft rounded-row opacity-40 transition-opacity duration-300"
              style={{ "--stagger-i": Math.min(present.length + fled.length + i, 8) }}
            >
              <Link
                href={profileHref(p.id)}
                className="flex h-14 items-center justify-between px-4"
              >
                <span className="flex items-center gap-3 font-bold">
                  <Avatar username={p.username} avatarUrl={p.avatar_url} size={32} />
                  {p.username}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Nema ga
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
