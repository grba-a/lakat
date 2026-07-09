"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { getCurrentDayStart, getDayKey } from "@/lib/day";

// Leaflet dira window pa se smije učitati tek u browseru
const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="surface-2 mt-6 flex h-[55dvh] items-center justify-center rounded-card text-sm text-muted">
      Karta se diže...
    </div>
  ),
});

// Random emoji po korisniku, stabilan cijeli lakat-dan (user + dan -> hash)
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

export default function MapClient({ groupId, profiles, initialCheckins }) {
  const [rows, setRows] = useState(() => {
    const map = {};
    for (const c of initialCheckins) map[c.id] = c;
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
    const emojis = new Map(profiles.map((p) => [p.id, p.map_emoji]));
    const byUser = new Map();
    for (const row of Object.values(rows)) {
      if (row.checked_in_at < dayStartIso) continue;
      if (row.cancelled_at || row.lat == null || row.lng == null) continue;
      const prev = byUser.get(row.user_id);
      if (!prev || row.checked_in_at > prev.checked_in_at) {
        byUser.set(row.user_id, row);
      }
    }
    const dayKey = getDayKey(new Date());
    return [...byUser.values()].map((row) => ({
      id: row.user_id,
      lat: row.lat,
      lng: row.lng,
      // Odabrani emoji iz postavki, inače nasumičan (stabilan po danu)
      emoji: emojis.get(row.user_id) || emojiFor(row.user_id, dayKey),
      username: usernames.get(row.user_id) ?? "Netko",
      time: timeFmt.format(new Date(row.checked_in_at)),
      photoUrl: row.thumb_url ?? row.photo_url ?? null,
    }));
  }, [profiles, rows, dayStartIso]);

  return (
    <>
      <MapView markers={markers} />
      {markers.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nitko se danas još nije checkirao s lokacijom. Karta zjapi prazna
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
              <span>· checkiran u {m.time}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
