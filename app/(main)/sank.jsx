"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentDayStart } from "@/lib/day";
import { downscaleToBlob } from "@/lib/image";
import { checkIn, cancelCheckIn, najaviDolazak, react } from "@/app/actions";
import Avatar from "./avatar";
import PhotoLightbox from "./photo-lightbox";
import ReactionBar, { toggleReaction } from "./reaction-bar";

const timeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

const PHOTO_MAX_SIDE = 1024;
const NAJAVA_TRAJANJE_MS = 45 * 60 * 1000;

export default function Sank({
  groupId,
  profiles,
  initialCheckins,
  currentUserId,
  titles = {},
  initialNajave = [],
  initialReactions = {},
}) {
  // Svi današnji checkin REDOVI po id-u (jedan korisnik može imati više:
  // checkin -> poništi -> novi checkin). Realtime UPDATE mijenja red po id-u.
  const [rows, setRows] = useState(() => {
    const map = {};
    for (const c of initialCheckins) map[c.id] = c;
    return map;
  });
  const [najave, setNajave] = useState(() => {
    const map = {};
    for (const n of initialNajave) map[n.id] = n;
    return map;
  });
  // checkinId -> [{ user_id, emoji }]
  const [reactions, setReactions] = useState(initialReactions);
  const [now, setNow] = useState(() => Date.now());
  const [dayStartIso, setDayStartIso] = useState(() =>
    getCurrentDayStart().toISOString()
  );
  const [error, setError] = useState(null);
  const [askPhoto, setAskPhoto] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { url, caption }
  const [isPending, startTransition] = useTransition();
  const cameraRef = useRef(null);
  const geoRef = useRef(null); // promise pokrenut na klik, awaita se pri checkinu

  // Realtime: INSERT (novi checkin) + UPDATE (poništenje) osvježavaju sve.
  // Sve filtrirano po aktivnoj grupi (RLS to čuva i na serveru); na
  // promjenu grupe komponenta se remounta (key) i resubscribea.
  useEffect(() => {
    const supabase = createClient();
    const groupFilter = `group_id=eq.${groupId}`;
    const channel = supabase
      .channel(`checkins-live-${groupId}`)
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
        { event: "INSERT", schema: "public", table: "najave", filter: groupFilter },
        (payload) => {
          setNajave((prev) => ({ ...prev, [payload.new.id]: payload.new }));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions", filter: groupFilter },
        (payload) => {
          const row = payload.eventType === "DELETE" ? payload.old : payload.new;
          if (!row?.checkin_id) return;
          setReactions((prev) => {
            const rest = (prev[row.checkin_id] ?? []).filter(
              (r) => r.user_id !== row.user_id
            );
            return {
              ...prev,
              [row.checkin_id]:
                payload.eventType === "DELETE"
                  ? rest
                  : [...rest, { user_id: row.user_id, emoji: row.emoji }],
            };
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  // Nakon 06:00 svi se resetiraju u sivo, najave istječu — bez refresha
  useEffect(() => {
    const timer = setInterval(() => {
      setDayStartIso(getCurrentDayStart().toISOString());
      setNow(Date.now());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Zatvorena kamera bez slike (podržano u novijim browserima) -> ponudi ulaz bez dokaza
  useEffect(() => {
    const input = cameraRef.current;
    if (!input) return;
    const onCancel = () => setAskPhoto(true);
    input.addEventListener("cancel", onCancel);
    return () => input.removeEventListener("cancel", onCancel);
  }, []);

  // Po korisniku: najraniji aktivni checkin (dolazak + slika), najkasnije
  // poništenje i najsvježija živa najava dolaska
  const { present, arriving, fled, absent } = useMemo(() => {
    const byUser = new Map();
    for (const row of Object.values(rows)) {
      if (row.checked_in_at < dayStartIso) continue;
      const u = byUser.get(row.user_id) ?? { active: null, cancelledAt: null };
      if (!row.cancelled_at) {
        if (!u.active || row.checked_in_at < u.active.checked_in_at) {
          u.active = row;
        }
      } else if (!u.cancelledAt || row.cancelled_at > u.cancelledAt) {
        u.cancelledAt = row.cancelled_at;
      }
      byUser.set(row.user_id, u);
    }

    const najavaCutoff = new Date(now - NAJAVA_TRAJANJE_MS).toISOString();
    const arrivingAt = new Map();
    for (const n of Object.values(najave)) {
      if (n.created_at < najavaCutoff) continue;
      const prev = arrivingAt.get(n.user_id);
      if (!prev || n.created_at > prev) arrivingAt.set(n.user_id, n.created_at);
    }

    const present = [];
    const arriving = [];
    const fled = [];
    const absent = [];
    for (const p of profiles) {
      const u = byUser.get(p.id);
      const announcedAt = arrivingAt.get(p.id);
      if (u?.active) {
        present.push({
          ...p,
          checkinId: u.active.id,
          arrivedAt: u.active.checked_in_at,
          photoUrl: u.active.photo_url ?? null,
        });
      } else if (announcedAt && (!u?.cancelledAt || announcedAt > u.cancelledAt)) {
        arriving.push({ ...p, announcedAt });
      } else if (u?.cancelledAt) {
        fled.push({ ...p, cancelledAt: u.cancelledAt });
      } else {
        absent.push(p);
      }
    }
    present.sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
    arriving.sort((a, b) => b.announcedAt.localeCompare(a.announcedAt));
    fled.sort((a, b) => b.cancelledAt.localeCompare(a.cancelledAt));
    return { present, arriving, fled, absent };
  }, [profiles, rows, najave, now, dayStartIso]);

  const iAmPresent = present.some((p) => p.id === currentUserId);
  const iAmArriving = arriving.some((p) => p.id === currentUserId);

  // Lokacija se traži paralelno s kamerom; odbijena/spora lokacija ne
  // blokira checkin (slika je dokaz, lokacija je bonus za mapu)
  function requestLocation() {
    if (!("geolocation" in navigator)) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
      );
    });
  }

  function doCheckIn(photoUrl) {
    setAskPhoto(false);
    setError(null);
    startTransition(async () => {
      const coords = await (geoRef.current ?? requestLocation());
      const result = await checkIn(photoUrl ?? undefined, coords ?? undefined);
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
          photo_url: photoUrl ?? null,
        },
      }));
    });
  }

  // TU SAM prvo otvara kameru — slika je dokaz i objava dana
  function handleCheckInClick() {
    setError(null);
    geoRef.current = requestLocation();
    cameraRef.current?.click();
  }

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      setAskPhoto(true);
      return;
    }
    startTransition(async () => {
      try {
        const blob = await downscaleToBlob(file, PHOTO_MAX_SIDE);
        const supabase = createClient();
        const path = `${currentUserId}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("dokazi")
          .upload(path, blob, {
            contentType: "image/jpeg",
            cacheControl: "31536000",
          });
        if (uploadError) throw new Error(uploadError.message);
        const { data } = supabase.storage.from("dokazi").getPublicUrl(path);
        doCheckIn(data.publicUrl);
      } catch {
        setError("Slika nije prošla. Probaj opet ili uđi bez dokaza ko pička.");
        setAskPhoto(true);
      }
    });
  }

  function handleNajava() {
    setError(null);
    startTransition(async () => {
      const result = await najaviDolazak();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setNajave((prev) => ({
        ...prev,
        [`tmp-najava-${currentUserId}`]: {
          id: `tmp-najava-${currentUserId}`,
          user_id: currentUserId,
          created_at: new Date().toISOString(),
        },
      }));
      setNow(Date.now());
    });
  }

  function handleReaction(checkinId, emoji) {
    // Optimistički odmah, server potvrđuje; realtime ionako ispravi
    setReactions((prev) => ({
      ...prev,
      [checkinId]: toggleReaction(prev[checkinId] ?? [], currentUserId, emoji),
    }));
    startTransition(async () => {
      const result = await react(checkinId, emoji);
      if (result?.error) setError(result.error);
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

  function Title({ id }) {
    const title = titles[id];
    if (!title) return null;
    return (
      <span
        className={`text-[10px] font-bold uppercase tracking-wider ${
          title.startsWith("Pička") ? "text-danger" : "text-accent/80"
        }`}
      >
        {title}
      </span>
    );
  }

  function openPhoto(e, p) {
    e.preventDefault();
    e.stopPropagation();
    setLightbox({
      url: p.photoUrl,
      caption: `${p.username} · ${timeFmt.format(new Date(p.arrivedAt))}`,
      checkinId: typeof p.checkinId === "number" ? p.checkinId : null,
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhoto}
        className="hidden"
      />

      <button
        type="button"
        onClick={handleCheckInClick}
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

      {!iAmPresent && (
        <button
          type="button"
          onClick={handleNajava}
          disabled={isPending || iAmArriving}
          className="pressable-soft mt-3 flex h-12 w-full items-center justify-center rounded-button border border-amber-400/30 bg-amber-400/10 font-display text-lg uppercase tracking-wide text-amber-300 disabled:opacity-60"
        >
          {iAmArriving
            ? "Najavljen si. Sad dođi."
            : isPending
              ? "Sekunda..."
              : "Stižem."}
        </button>
      )}

      {askPhoto && !iAmPresent && (
        <div className="glass mt-3 rounded-card p-4">
          <p className="text-sm font-bold text-danger">
            Slikaj nam gdje si smrade.
          </p>
          <p className="mt-1 text-xs text-muted">
            Bez slike nema dokaza da si stvarno za šankom.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCheckInClick}
              disabled={isPending}
              className="pressable-soft flex h-12 flex-1 items-center justify-center rounded-button bg-accent font-display text-lg uppercase tracking-wide text-black disabled:opacity-50"
            >
              Ajde, slikam
            </button>
            <button
              type="button"
              onClick={() => doCheckIn(null)}
              disabled={isPending}
              className="surface-2 pressable-soft flex h-12 flex-1 items-center justify-center rounded-button font-display text-lg uppercase tracking-wide text-muted disabled:opacity-50"
            >
              Nemam sliku
            </button>
          </div>
        </div>
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
                className="flex min-h-14 items-center justify-between gap-2 px-4 py-2"
              >
                <span className="flex items-center gap-3 font-bold">
                  <Avatar
                    username={p.username}
                    avatarUrl={p.avatar_url}
                    size={32}
                    className="border-accent/40"
                  />
                  <span className="flex flex-col">
                    {p.username}
                    <Title id={p.id} />
                    {!p.photoUrl && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-danger">
                        Slikaj nam gdje si smrade.
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {p.photoUrl && (
                    <button
                      type="button"
                      onClick={(e) => openPhoto(e, p)}
                      className="pressable relative shrink-0"
                      aria-label={`Dokazna slika: ${p.username}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.photoUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-lg border border-accent/30 object-cover"
                      />
                      {(reactions[p.checkinId]?.length ?? 0) > 0 && (
                        <span className="absolute -bottom-1.5 -right-1.5 rounded-full border border-white/10 bg-black/80 px-1.5 text-[10px] font-bold leading-4 text-foreground">
                          {reactions[p.checkinId].length}
                        </span>
                      )}
                    </button>
                  )}
                  <span className="text-xs font-bold uppercase tracking-widest text-accent">
                    {timeFmt.format(new Date(p.arrivedAt))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {arriving.map((p, i) => (
            <li
              key={p.id}
              className="surface-2 pressable-soft rounded-row border-amber-400/25 bg-amber-400/[0.06]"
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
                    className="border-amber-400/40"
                  />
                  <span className="flex flex-col">
                    {p.username}
                    <Title id={p.id} />
                  </span>
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                  Stiže (navodno) · {timeFmt.format(new Date(p.announcedAt))}
                </span>
              </Link>
            </li>
          ))}
          {fled.map((p, i) => (
            <li
              key={p.id}
              className="surface-2 pressable-soft rounded-row border-danger/25 bg-danger/[0.06] opacity-70"
              style={{ "--stagger-i": Math.min(present.length + arriving.length + i, 8) }}
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
                  <span className="flex flex-col">
                    {p.username}
                    <Title id={p.id} />
                  </span>
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
              style={{ "--stagger-i": Math.min(present.length + arriving.length + fled.length + i, 8) }}
            >
              <Link
                href={profileHref(p.id)}
                className="flex h-14 items-center justify-between px-4"
              >
                <span className="flex items-center gap-3 font-bold">
                  <Avatar username={p.username} avatarUrl={p.avatar_url} size={32} />
                  <span className="flex flex-col">
                    {p.username}
                    <Title id={p.id} />
                  </span>
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Nema ga
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <PhotoLightbox
        url={lightbox?.url}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      >
        {lightbox?.checkinId && (
          <ReactionBar
            rows={reactions[lightbox.checkinId] ?? []}
            myId={currentUserId}
            onToggle={(emoji) => handleReaction(lightbox.checkinId, emoji)}
          />
        )}
      </PhotoLightbox>
    </div>
  );
}
