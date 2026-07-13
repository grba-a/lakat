"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentDayStart } from "@/lib/day";
import { downscaleToBlob } from "@/lib/image";
import {
  checkIn,
  cancelCheckIn,
  najaviDolazak,
  react,
  logDrink,
  undoLastDrink,
} from "@/app/actions";
import Avatar from "./avatar";
import PhotoLightbox from "./photo-lightbox";
import ReactionBar, { toggleReaction } from "./reaction-bar";
import CommentThread from "./comment-thread";
import BadgeToast from "./badge-toast";
import DrinkBar from "./drink-bar";
import { drinkInfo } from "@/lib/drinks";

const timeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

const PHOTO_MAX_SIDE = 1024;
const THUMB_MAX_SIDE = 320;
const NAJAVA_TRAJANJE_MS = 45 * 60 * 1000;

export default function Sank({
  groupId,
  profiles,
  initialCheckins,
  currentUserId,
  titles = {},
  initialNajave = [],
  initialReactions = {},
  initialDrinks = [],
  initialSpins = [],
  monthDrinkCount = 0,
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
  // Pića i spinovi kola, po id-u reda — obrazac identičan rows/najave
  const [drinks, setDrinks] = useState(() => {
    const map = {};
    for (const d of initialDrinks) map[d.id] = d;
    return map;
  });
  const [spins, setSpins] = useState(() => {
    const map = {};
    for (const s of initialSpins) map[s.id] = s;
    return map;
  });
  const [now, setNow] = useState(() => Date.now());
  const [dayStartIso, setDayStartIso] = useState(() =>
    getCurrentDayStart().toISOString()
  );
  const [error, setError] = useState(null);
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [askPhoto, setAskPhoto] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { url, caption }
  const [isPending, startTransition] = useTransition();
  const cameraRef = useRef(null);
  const geoRef = useRef(null); // promise pokrenut na klik, awaita se pri checkinu
  const previewUrlRef = useRef(null); // object URL lokalnog previewa, čeka se pravi red pa se revoke-a

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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kolo_spins", filter: groupFilter },
        (payload) => {
          setSpins((prev) => ({ ...prev, [payload.new.id]: payload.new }));
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

  // Čim pravi red (s pravim photo_url-om) stigne realtimeom, tmp red s
  // lokalnim previewom više ne treba — makni ga i oslobodi object URL
  useEffect(() => {
    const tmpKey = `tmp-${currentUserId}`;
    if (!rows[tmpKey]) return;
    const hasReal = Object.values(rows).some(
      (r) =>
        r.user_id === currentUserId &&
        r.id !== tmpKey &&
        !r.cancelled_at &&
        r.checked_in_at >= dayStartIso
    );
    if (!hasReal) return;
    setRows((prev) => {
      const next = { ...prev };
      delete next[tmpKey];
      return next;
    });
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, [rows, currentUserId, dayStartIso]);

  // Sigurnosna mreža ako se komponenta unmounta prije nego pravi red stigne
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // Isti obrazac kao tmp checkin: čim pravi (broj-id) red za mene stigne
  // realtimeom, tmp red pića više ne treba
  useEffect(() => {
    const tmpPrefix = `tmp-drink-${currentUserId}`;
    const hasTmp = Object.keys(drinks).some((id) => id.startsWith(tmpPrefix));
    if (!hasTmp) return;
    const hasReal = Object.values(drinks).some(
      (d) =>
        d.user_id === currentUserId &&
        typeof d.id === "number" &&
        d.logged_at >= dayStartIso
    );
    if (!hasReal) return;
    setDrinks((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (id.startsWith(tmpPrefix)) delete next[id];
      }
      return next;
    });
  }, [drinks, currentUserId, dayStartIso]);

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

    const drinkCountByUser = new Map();
    for (const d of Object.values(drinks)) {
      if (d.logged_at < dayStartIso) continue;
      drinkCountByUser.set(d.user_id, (drinkCountByUser.get(d.user_id) ?? 0) + 1);
    }
    const spinByUser = new Map();
    for (const s of Object.values(spins)) {
      if (s.created_at < dayStartIso) continue;
      spinByUser.set(s.user_id, s.result);
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
          thumbUrl: u.active.thumb_url ?? null,
          drinkCount: drinkCountByUser.get(p.id) ?? 0,
          spinDrink: spinByUser.get(p.id) ?? null,
        });
      } else if (announcedAt && (!u?.cancelledAt || announcedAt > u.cancelledAt)) {
        arriving.push({ ...p, announcedAt });
      } else if (u?.cancelledAt) {
        fled.push({ ...p, cancelledAt: u.cancelledAt });
      } else {
        absent.push(p);
      }
    }
    present.sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt));
    arriving.sort((a, b) => b.announcedAt.localeCompare(a.announcedAt));
    fled.sort((a, b) => b.cancelledAt.localeCompare(a.cancelledAt));
    return { present, arriving, fled, absent };
  }, [profiles, rows, najave, drinks, spins, now, dayStartIso]);

  const iAmPresent = present.some((p) => p.id === currentUserId);
  const iAmArriving = arriving.some((p) => p.id === currentUserId);
  const me = present.find((p) => p.id === currentUserId);
  const myTonightDrinkCount = me?.drinkCount ?? 0;
  const mySpinDrink = me?.spinDrink ?? null;

  // Lokacija se traži paralelno s kamerom; odbijena/spora lokacija ne
  // blokira checkin (slika je dokaz, lokacija je bonus za mapu)
  function requestLocation() {
    if (!("geolocation" in navigator)) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 60_000 }
      );
    });
  }

  // Šalje checkin serveru u pozadini; ne blokira UI (optimistički red je već
  // na ekranu prije ovog poziva). Na grešku miče tmp red i vraća false.
  async function submitCheckIn(photoUrl, thumbUrl, tmpKey) {
    const coords = await (geoRef.current ?? requestLocation());
    const result = await checkIn(
      photoUrl ?? undefined,
      thumbUrl ?? undefined,
      coords ?? undefined
    );
    if (result?.error) {
      setError(result.error);
      setRows((prev) => {
        const next = { ...prev };
        delete next[tmpKey];
        return next;
      });
      return false;
    }
    if (result?.newBadges?.length) {
      setBadgeQueue((prev) => [...prev, ...result.newBadges]);
    }
    return true;
  }

  function doCheckIn(photoUrl) {
    setAskPhoto(false);
    setError(null);
    const tmpKey = `tmp-${currentUserId}`;
    // Optimistički temp red ODMAH — pravi stiže realtimeom (derivacija je po
    // korisniku pa duplikat ne smeta, efekt gore ga makne kad stigne pravi)
    setRows((prev) => ({
      ...prev,
      [tmpKey]: {
        id: tmpKey,
        user_id: currentUserId,
        checked_in_at: new Date().toISOString(),
        cancelled_at: null,
        photo_url: photoUrl ?? null,
        thumb_url: null,
      },
    }));
    startTransition(async () => {
      await submitCheckIn(photoUrl, null, tmpKey);
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
    setError(null);
    setAskPhoto(false);
    const tmpKey = `tmp-${currentUserId}`;
    startTransition(async () => {
      try {
        // Kompresija je brza (canvas) — čim imamo blob, pokaži se u listi
        // odmah s lokalnim previewom; upload i checkin idu u pozadini.
        const [blob, thumbBlob] = await Promise.all([
          downscaleToBlob(file, PHOTO_MAX_SIDE),
          downscaleToBlob(file, THUMB_MAX_SIDE, 0.8),
        ]);
        const previewUrl = URL.createObjectURL(blob);
        previewUrlRef.current = previewUrl;
        setRows((prev) => ({
          ...prev,
          [tmpKey]: {
            id: tmpKey,
            user_id: currentUserId,
            checked_in_at: new Date().toISOString(),
            cancelled_at: null,
            photo_url: previewUrl,
            thumb_url: previewUrl,
          },
        }));

        const supabase = createClient();
        const ts = Date.now();
        const path = `${currentUserId}/${ts}.jpg`;
        const thumbPath = `${currentUserId}/${ts}_thumb.jpg`;
        const [{ error: uploadError }, { error: thumbUploadError }] = await Promise.all([
          supabase.storage
            .from("dokazi")
            .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" }),
          supabase.storage
            .from("dokazi")
            .upload(thumbPath, thumbBlob, {
              contentType: "image/jpeg",
              cacheControl: "31536000",
            }),
        ]);
        if (uploadError) throw new Error(uploadError.message);
        const { data } = supabase.storage.from("dokazi").getPublicUrl(path);
        const thumbPublicUrl = thumbUploadError
          ? null
          : supabase.storage.from("dokazi").getPublicUrl(thumbPath).data.publicUrl;
        const ok = await submitCheckIn(data.publicUrl, thumbPublicUrl, tmpKey);
        if (!ok) setAskPhoto(true);
      } catch {
        setRows((prev) => {
          const next = { ...prev };
          delete next[tmpKey];
          return next;
        });
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = null;
        }
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

  // Piće — optimistički tmp red odmah (isti obrazac kao checkin), pravo
  // stiže realtimeom i tmp se makne u efektu ispod
  function handleLogDrink(drinkType) {
    setError(null);
    const tmpId = `tmp-drink-${currentUserId}-${Date.now()}`;
    setDrinks((prev) => ({
      ...prev,
      [tmpId]: {
        id: tmpId,
        user_id: currentUserId,
        drink_type: drinkType,
        logged_at: new Date().toISOString(),
      },
    }));
    startTransition(async () => {
      const result = await logDrink(drinkType);
      if (result?.error) {
        setError(result.error);
        setDrinks((prev) => {
          const next = { ...prev };
          delete next[tmpId];
          return next;
        });
        return;
      }
      if (result?.newBadges?.length) {
        setBadgeQueue((prev) => [...prev, ...result.newBadges]);
      }
    });
  }

  // Krivi tap — bez optimizma, realtime DELETE povuče brojač dolje
  function handleUndoDrink() {
    setError(null);
    startTransition(async () => {
      const result = await undoLastDrink();
      if (result?.error) setError(result.error);
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
      <BadgeToast
        queue={badgeQueue}
        onDone={(key) =>
          setBadgeQueue((prev) => prev.filter((b) => b.key !== key))
        }
      />
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

      {iAmPresent && (
        <DrinkBar
          tonightCount={myTonightDrinkCount}
          mySpinDrink={mySpinDrink}
          onLog={handleLogDrink}
          onUndo={handleUndoDrink}
          disabled={isPending}
        />
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
        {monthDrinkCount > 0 && (
          <p className="mt-1 text-xs text-muted">
            Grupa je ovaj mjesec sredila {monthDrinkCount}{" "}
            {monthDrinkCount === 1 ? "piće" : "pića"}. Jetra plaču.
          </p>
        )}

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
                    {(p.drinkCount > 0 || p.spinDrink) && (
                      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                        {p.drinkCount > 0 && <span>🍺 {p.drinkCount}</span>}
                        {p.spinDrink && (
                          <span>🎡 {drinkInfo(p.spinDrink)?.label}</span>
                        )}
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
                        src={p.thumbUrl ?? p.photoUrl}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        decoding="async"
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
          <div className="flex flex-col items-center gap-4">
            <ReactionBar
              rows={reactions[lightbox.checkinId] ?? []}
              myId={currentUserId}
              onToggle={(emoji) => handleReaction(lightbox.checkinId, emoji)}
            />
            <CommentThread
              checkinId={lightbox.checkinId}
              currentUserId={currentUserId}
            />
          </div>
        )}
      </PhotoLightbox>
    </div>
  );
}
