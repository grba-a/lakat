"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { getCurrentDayStart, getDayKey } from "@/lib/day";
import { drinkInfo } from "@/lib/drinks";

// Leaflet dira window pa se smije učitati tek u browseru
const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="surface-2 mt-6 flex h-[55dvh] items-center justify-center rounded-card text-sm text-muted">
      Karta se diže...
    </div>
  ),
});

// Fallback dok korisnik danas nije logirao nijedno piće: random emoji po
// korisniku, stabilan cijeli lakat-dan (user + dan -> hash). Čim logira,
// marker postane emoji zadnjeg pića (kolo je samo prijedlog, ne utječe).
const EMOJI = ["🍺", "🍻", "🥴", "🍷", "🥃", "🤙", "🦍", "🔥", "🍕", "🚬"];

function emojiFor(userId, dayKey) {
  let h = 0;
  for (const ch of userId + dayKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EMOJI[h % EMOJI.length];
}

const timeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

export default function MapClient({
  groupId,
  profiles,
  initialCheckins,
  initialDrinks = [],
  mjesta = [],
  myGroupName = null,
}) {
  const [rows, setRows] = useState(() => {
    const map = {};
    for (const c of initialCheckins) map[c.id] = c;
    return map;
  });
  const [drinks, setDrinks] = useState(() => {
    const map = {};
    for (const d of initialDrinks) map[d.id] = d;
    return map;
  });
  const [dayStartIso, setDayStartIso] = useState(() =>
    getCurrentDayStart().toISOString()
  );

  useEffect(() => {
    const supabase = createClient();
    const groupFilter = `group_id=eq.${groupId}`;
    const channel = supabase
      .channel(`checkins-mapa-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checkins", filter: groupFilter },
        (payload) => {
          if (payload.new.checked_in_at < getCurrentDayStart().toISOString()) return;
          setRows((prev) => ({ ...prev, [payload.new.id]: payload.new }));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "checkins", filter: groupFilter },
        (payload) => {
          setRows((prev) =>
            prev[payload.new.id] ? { ...prev, [payload.new.id]: payload.new } : prev
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drinks", filter: groupFilter },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setDrinks((prev) => {
              const next = { ...prev };
              delete next[payload.old.id];
              return next;
            });
            return;
          }
          setDrinks((prev) => ({ ...prev, [payload.new.id]: payload.new }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  useEffect(() => {
    const timer = setInterval(
      () => setDayStartIso(getCurrentDayStart().toISOString()),
      60_000
    );
    return () => clearInterval(timer);
  }, []);

  // Po korisniku: najnoviji AKTIVNI checkin s koordinatama
  const markers = useMemo(() => {
    const usernames = new Map(profiles.map((p) => [p.id, p.username]));
    const byUser = new Map();
    for (const row of Object.values(rows)) {
      if (row.checked_in_at < dayStartIso) continue;
      if (row.cancelled_at || row.lat == null || row.lng == null) continue;
      const prev = byUser.get(row.user_id);
      if (!prev || row.checked_in_at > prev.checked_in_at) {
        byUser.set(row.user_id, row);
      }
    }
    // Zadnje danas logirano piće po korisniku
    const lastDrink = new Map();
    for (const d of Object.values(drinks)) {
      if (d.logged_at < dayStartIso) continue;
      const prev = lastDrink.get(d.user_id);
      if (!prev || d.logged_at > prev.logged_at) lastDrink.set(d.user_id, d);
    }
    const dayKey = getDayKey(new Date());
    return [...byUser.values()].map((row) => ({
      id: row.user_id,
      lat: row.lat,
      lng: row.lng,
      // Što stvarno pije (zadnje piće), inače nasumičan (stabilan po danu)
      emoji:
        drinkInfo(lastDrink.get(row.user_id)?.drink_type)?.emoji ||
        emojiFor(row.user_id, dayKey),
      username: usernames.get(row.user_id) ?? "Netko",
      time: timeFmt.format(new Date(row.checked_in_at)),
      photoUrl: row.thumb_url ?? row.photo_url ?? null,
    }));
  }, [profiles, rows, drinks, dayStartIso]);

  const nasaMjesta = mjesta.filter((m) => m.holder === myGroupName).length;

  return (
    <>
      <MapView markers={markers} mjesta={mjesta} myGroupName={myGroupName} />
      {mjesta.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          ⚑ Ekipa s najviše rundi na lokaciji (30 dana) drži to mjesto.
          {nasaMjesta > 0
            ? ` Vi držite ${nasaMjesta}.`
            : " Vi još ne držite ništa. Sramota."}
        </p>
      )}
      {markers.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nitko se danas još nije javio s lokacijom. Karta zjapi prazna
          ko šank u ponedjeljak.
        </p>
      ) : (
        <ul className="stagger mt-4 flex flex-col gap-1">
          {markers.map((m, i) => (
            <li
              key={m.id}
              className="flex items-center gap-2 text-sm text-muted"
              style={{ "--stagger-i": Math.min(i, 8) }}
            >
              <span className="text-base">{m.emoji}</span>
              <span className="font-bold text-foreground">{m.username}</span>
              <span>· za šankom od {m.time}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
