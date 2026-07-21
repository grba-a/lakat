"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { getCurrentDayStart } from "@/lib/day";
import { fetchTodayFeed } from "@/lib/feed";
import { najaviDolazak, react } from "@/app/actions";
import BrandPunct from "@/app/brand-punct";
import Avatar from "./avatar";
import PhotoLightbox from "./photo-lightbox";
import ReactionBar, { toggleReaction } from "./reaction-bar";
import CommentSheet from "./comment-sheet";
import SazivCard, { SazivComposer } from "./saziv-card";

const timeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

const NAJAVA_TRAJANJE_MS = 45 * 60 * 1000;
const SAZIV_ZIVOT_NAKON_MS = 3 * 60 * 60 * 1000;

function removeRow(setMap, id) {
  setMap((prev) => {
    const next = { ...prev };
    delete next[id];
    return next;
  });
}

// ŠANK 3.0 — kronološki feed frendovskih rundi (samo današnji lakat-dan):
// story bar prisutnih/stižućih avatara + feed kartica (velika slika,
// reakcije inline, komentari u bottom sheetu) + stack živih poziva.
// Realtime BEZ filtera — RLS na postgres_changes pušta samo frendove.
export default function Sank({
  profiles,
  currentUserId,
  titles = {},
  initialCheckins,
  initialNajave = [],
  initialReactions = {},
  initialDrinks = [],
  initialSazivi = [],
  initialOdazivi = [],
  initialCommentCounts = {},
  monthDrinkCount = 0,
}) {
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
  const [reactions, setReactions] = useState(initialReactions);
  const [drinks, setDrinks] = useState(() => {
    const map = {};
    for (const d of initialDrinks) map[d.id] = d;
    return map;
  });
  const [sazivi, setSazivi] = useState(() => {
    const map = {};
    for (const s of initialSazivi) map[s.id] = s;
    return map;
  });
  const [odazivi, setOdazivi] = useState(() => {
    const map = {};
    for (const o of initialOdazivi) map[`${o.saziv_id}:${o.user_id}`] = o;
    return map;
  });
  const [commentCounts, setCommentCounts] = useState(initialCommentCounts);
  const [now, setNow] = useState(() => Date.now());
  const [dayStartIso, setDayStartIso] = useState(() =>
    getCurrentDayStart().toISOString()
  );
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [commentFor, setCommentFor] = useState(null);
  const [avatarSheet, setAvatarSheet] = useState(null); // { profile, present }
  const [isPending, startTransition] = useTransition();
  // Kad PWA ode u pozadinu (iOS), realtime WS tiho umre — bumpanjem ovog
  // noncea prisilimo svjež kanal, a klijentski refetch povuče propuštene evente.
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const lastReconnectRef = useRef(0);

  // Prati koji su checkin id-jevi već viđeni (initial load) da se realtime
  // dolasci mogu jednokratno animirati (uklizavanje), bez ponavljanja na
  // re-renderu/reorderu liste.
  const seenIdsRef = useRef(new Set(initialCheckins.map((c) => c.id)));
  const arrivalTimersRef = useRef(new Set());
  const [justArrivedIds, setJustArrivedIds] = useState(() => new Set());

  useEffect(
    () => () => {
      for (const t of arrivalTimersRef.current) clearTimeout(t);
    },
    []
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`feed-live-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checkins" },
        (payload) => {
          if (payload.new.checked_in_at < getCurrentDayStart().toISOString()) return;
          const id = payload.new.id;
          const isNew = !seenIdsRef.current.has(id);
          seenIdsRef.current.add(id);
          setRows((prev) => ({ ...prev, [id]: payload.new }));
          if (isNew) {
            setJustArrivedIds((prev) => new Set(prev).add(id));
            const timer = setTimeout(() => {
              arrivalTimersRef.current.delete(timer);
              setJustArrivedIds((prev) => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }, 1000);
            arrivalTimersRef.current.add(timer);
          }
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "najave" },
        (payload) => {
          setNajave((prev) => ({ ...prev, [payload.new.id]: payload.new }));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions" },
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
        { event: "*", schema: "public", table: "drinks" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            removeRow(setDrinks, payload.old.id);
            return;
          }
          setDrinks((prev) => ({ ...prev, [payload.new.id]: payload.new }));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sazivi" },
        (payload) => {
          setSazivi((prev) => ({ ...prev, [payload.new.id]: payload.new }));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "sazivi" },
        (payload) => {
          removeRow(setSazivi, payload.old.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saziv_odazivi" },
        (payload) => {
          if (payload.eventType === "DELETE") return; // cascade uz saziv
          setOdazivi((prev) => ({
            ...prev,
            [`${payload.new.saziv_id}:${payload.new.user_id}`]: payload.new,
          }));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments" },
        (payload) => {
          const id = payload.new?.checkin_id;
          if (!id) return;
          setCommentCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments" },
        (payload) => {
          const id = payload.old?.checkin_id;
          if (!id) return;
          setCommentCounts((prev) => ({
            ...prev,
            [id]: Math.max(0, (prev[id] ?? 1) - 1),
          }));
        }
      )
      .subscribe((status) => {
        // Kanal pukao/istekao dok smo u prvom planu → svjež kanal (throttlano
        // da mrtva mreža ne uđe u petlju rekonekcija). CLOSED je namjerni
        // cleanup pa ga ignoriramo.
        if (
          (status === "CHANNEL_ERROR" || status === "TIMED_OUT") &&
          typeof document !== "undefined" &&
          document.visibilityState === "visible"
        ) {
          const t = Date.now();
          if (t - lastReconnectRef.current < 4000) return;
          lastReconnectRef.current = t;
          setReconnectNonce((n) => n + 1);
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, reconnectNonce]);

  // Povratak u prvi plan (visibilitychange/focus): osvježi realtime kanal i
  // klijentski povuci današnji feed da nadoknadiš evente propuštene dok je
  // kanal bio mrtav. Geolokacija se NE dira (ide samo kroz PLUS gumb), pa
  // brzina lokacije ostaje netaknuta. setState je u async/event handleru
  // (ne u tijelu efekta) pa nema cascading-render problema.
  useEffect(() => {
    async function refetchFeed() {
      try {
        const supabase = createClient();
        const feed = await fetchTodayFeed(supabase);
        const cMap = {};
        for (const c of feed.checkins) {
          cMap[c.id] = c;
          seenIdsRef.current.add(c.id);
        }
        setRows(cMap);
        const nMap = {};
        for (const n of feed.najave) nMap[n.id] = n;
        setNajave(nMap);
        setReactions(feed.reactions);
        const dMap = {};
        for (const d of feed.drinks) dMap[d.id] = d;
        setDrinks(dMap);
        const sMap = {};
        for (const s of feed.sazivi) sMap[s.id] = s;
        setSazivi(sMap);
        const oMap = {};
        for (const o of feed.odazivi) oMap[`${o.saziv_id}:${o.user_id}`] = o;
        setOdazivi(oMap);
        setCommentCounts(feed.commentCounts);
      } catch {
        // refetch je bonus — realtime kanal i dalje hvata nove evente
      }
    }
    function onForeground() {
      if (document.visibilityState !== "visible") return;
      const t = Date.now();
      if (t - lastReconnectRef.current < 4000) return;
      lastReconnectRef.current = t;
      setReconnectNonce((n) => n + 1);
      refetchFeed();
    }
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    return () => {
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
    };
  }, []);

  // Nakon 06:00 sve se resetira, najave/sazivi istječu — bez refresha
  useEffect(() => {
    const timer = setInterval(() => {
      setDayStartIso(getCurrentDayStart().toISOString());
      setNow(Date.now());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  // Po korisniku: najnoviji checkin (prisutnost) + najnovija runda sa
  // slikom; najsvježija živa najava; brojači pića
  const { present, arriving, incomingByTarget, drinkCountByUser } = useMemo(() => {
    const byUser = new Map();
    for (const row of Object.values(rows)) {
      if (row.cancelled_at || row.checked_in_at < dayStartIso) continue;
      const cur = byUser.get(row.user_id);
      if (!cur) {
        byUser.set(row.user_id, { latest: row });
        continue;
      }
      if (row.checked_in_at > cur.latest.checked_in_at) cur.latest = row;
    }

    const najavaCutoff = new Date(now - NAJAVA_TRAJANJE_MS).toISOString();
    const arrivingAt = new Map();
    for (const n of Object.values(najave)) {
      if (n.created_at < najavaCutoff) continue;
      const prev = arrivingAt.get(n.user_id);
      if (!prev || n.created_at > prev.at) {
        arrivingAt.set(n.user_id, {
          at: n.created_at,
          targetId: n.target_user_id ?? null,
        });
      }
    }

    const drinkCountByUser = new Map();
    for (const d of Object.values(drinks)) {
      if (d.logged_at < dayStartIso) continue;
      drinkCountByUser.set(d.user_id, (drinkCountByUser.get(d.user_id) ?? 0) + 1);
    }

    const present = [];
    const arriving = [];
    const incomingByTarget = new Map();
    for (const p of profiles) {
      const entry = byUser.get(p.id);
      const najava = arrivingAt.get(p.id);
      if (entry) {
        present.push({ ...p, lastAt: entry.latest.checked_in_at });
      } else if (najava) {
        arriving.push({ ...p, announcedAt: najava.at, targetId: najava.targetId });
        if (najava.targetId) {
          incomingByTarget.set(
            najava.targetId,
            (incomingByTarget.get(najava.targetId) ?? 0) + 1
          );
        }
      }
    }
    present.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    arriving.sort((a, b) => b.announcedAt.localeCompare(a.announcedAt));
    return { present, arriving, incomingByTarget, drinkCountByUser };
  }, [profiles, rows, najave, drinks, now, dayStartIso]);

  // Feed: sve današnje runde, najnovija prva
  const feedItems = useMemo(
    () =>
      Object.values(rows)
        .filter((r) => !r.cancelled_at && r.checked_in_at >= dayStartIso)
        .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at)),
    [rows, dayStartIso]
  );

  // Živi pozivi (stack) — najnoviji gore
  const liveSazivi = useMemo(
    () =>
      Object.values(sazivi)
        .filter((s) => new Date(s.at_time).getTime() + SAZIV_ZIVOT_NAKON_MS > now)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [sazivi, now]
  );
  const odaziviBySaziv = useMemo(() => {
    const map = new Map();
    for (const o of Object.values(odazivi)) {
      if (!map.has(o.saziv_id)) map.set(o.saziv_id, []);
      map.get(o.saziv_id).push(o);
    }
    return map;
  }, [odazivi]);

  // Detalji za avatar sheet (objave/pića/lokacija tog korisnika danas) —
  // sve izvedeno iz već učitanog client-side state-a, bez novih upita.
  const sheetProfileId = avatarSheet?.profile?.id ?? null;

  const sheetPosts = useMemo(() => {
    if (!sheetProfileId) return [];
    return Object.values(rows)
      .filter(
        (r) =>
          r.user_id === sheetProfileId && !r.cancelled_at && r.checked_in_at >= dayStartIso
      )
      .sort((a, b) => a.checked_in_at.localeCompare(b.checked_in_at));
  }, [rows, sheetProfileId, dayStartIso]);

  const sheetDrinks = useMemo(() => {
    if (!sheetProfileId) return [];
    return Object.values(drinks)
      .filter((d) => d.user_id === sheetProfileId && d.logged_at >= dayStartIso)
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  }, [drinks, sheetProfileId, dayStartIso]);

  const sheetLocation = useMemo(() => {
    const withCoords = [...sheetPosts]
      .reverse()
      .find((post) => post.lat != null && post.lng != null);
    return withCoords ? { lat: withCoords.lat, lng: withCoords.lng } : null;
  }, [sheetPosts]);

  const iAmPresent = present.some((p) => p.id === currentUserId);
  const iAmArriving = arriving.some((p) => p.id === currentUserId);
  const canNajava = !iAmPresent && !iAmArriving;
  const mojZiviSaziv = liveSazivi.some((s) => s.created_by === currentUserId);

  function handleNajava(targetId) {
    setError(null);
    setAvatarSheet(null);
    startTransition(async () => {
      const result = await najaviDolazak(targetId);
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
          target_user_id: targetId,
        },
      }));
      setNow(Date.now());
    });
  }

  function handleReaction(checkinId, emoji) {
    setReactions((prev) => ({
      ...prev,
      [checkinId]: toggleReaction(prev[checkinId] ?? [], currentUserId, emoji),
    }));
    startTransition(async () => {
      const result = await react(checkinId, emoji);
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
      <span className="text-[10px] font-bold uppercase tracking-wider text-accent/80">
        {title}
      </span>
    );
  }

  function openPhoto(item, list = [item]) {
    const withPhotos = list.filter((it) => it.photo_url);
    const startIndex = Math.max(
      0,
      withPhotos.findIndex((it) => it.id === item.id)
    );
    setLightbox({
      items: withPhotos.map((it) => ({
        url: it.photo_url,
        caption: `${profileById.get(it.user_id)?.username ?? "Netko"} · ${timeFmt.format(new Date(it.checked_in_at))}`,
        checkinId: it.id,
      })),
      startIndex,
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      {!mojZiviSaziv && (
        <SazivComposer
          currentUserId={currentUserId}
          onError={setError}
          onSazivCreated={(s) => {
            setSazivi((prev) => ({ ...prev, [s.id]: s }));
            setOdazivi((prev) => ({
              ...prev,
              [`${s.id}:${currentUserId}`]: {
                saziv_id: s.id,
                user_id: currentUserId,
                status: "stizem",
              },
            }));
            setNow(Date.now());
          }}
        />
      )}

      {liveSazivi.map((s) => (
        <SazivCard
          key={s.id}
          saziv={s}
          odazivi={odaziviBySaziv.get(s.id) ?? []}
          profileById={profileById}
          currentUserId={currentUserId}
          now={now}
          onOdaziv={(userId, sazivId, status) =>
            setOdazivi((prev) => ({
              ...prev,
              [`${sazivId}:${userId}`]: { user_id: userId, saziv_id: sazivId, status },
            }))
          }
          onSazivGone={(id) => removeRow(setSazivi, id)}
          onError={setError}
        />
      ))}

      {!iAmPresent && (
        <div className="mt-4 rounded-card border border-accent/25 bg-accent/[0.06] px-4 py-3 text-center">
          <p className="text-sm font-bold">Slikaj dokaz i sjedni za šank.</p>
          <p className="mt-1 text-xs text-muted">
            Stisni zeleni plus dolje. Nemoj se izgubiti. ↓
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      )}

      {/* Story bar: prisutni (zeleno) + stižu (žuto) */}
      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Za šankom {present.length > 0 && `(${present.length})`}
        </h2>
        {monthDrinkCount > 0 && (
          <p className="mt-1 text-xs text-muted">
            Ekipa je ovaj mjesec sredila {monthDrinkCount}{" "}
            {monthDrinkCount === 1 ? "piće" : "pića"}. Jetra plaču.
          </p>
        )}

        {present.length === 0 && arriving.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nitko od pajdaša nije vani. Šank zjapi prazan, sram vas sve bilo.
          </p>
        ) : (
          <div className="-mx-5 mt-4 overflow-hidden">
            <div className="scrollbar-none stagger -mb-6 flex gap-4 overflow-x-auto px-5 pb-6">
              {present.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAvatarSheet({ profile: p, present: true })}
                  className="pressable flex w-16 shrink-0 flex-col items-center gap-1.5"
                  style={{ "--stagger-i": Math.min(i, 8) }}
                >
                  <span className="relative">
                    <span className="block rounded-full border-2 border-accent p-0.5">
                      <Avatar username={p.username} avatarUrl={p.avatar_url} size={52} />
                    </span>
                    {(drinkCountByUser.get(p.id) ?? 0) > 0 && (
                      <span className="absolute -bottom-1 -right-1 rounded-full border border-white/10 bg-black/85 px-1.5 text-[10px] font-bold leading-4 text-foreground">
                        🍺{drinkCountByUser.get(p.id)}
                      </span>
                    )}
                    {incomingByTarget.has(p.id) && (
                      <span className="absolute -top-1 -right-1 rounded-full border border-white/10 bg-black/85 px-1.5 text-[10px] font-bold leading-4 text-amber-300">
                        👀{incomingByTarget.get(p.id)}
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-center text-[10px] font-bold text-foreground">
                    {p.username}
                  </span>
                </button>
              ))}
              {arriving.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAvatarSheet({ profile: p, present: false })}
                  className="pressable flex w-16 shrink-0 flex-col items-center gap-1.5"
                  style={{ "--stagger-i": Math.min(present.length + i, 8) }}
                >
                  <span className="relative">
                    <span className="block rounded-full border-2 border-amber-400/70 p-0.5 opacity-80">
                      <Avatar username={p.username} avatarUrl={p.avatar_url} size={52} />
                    </span>
                    <span className="absolute -top-1 -right-1 text-xs">👀</span>
                  </span>
                  <span className="w-full truncate text-center text-[10px] font-bold text-amber-300">
                    {p.targetId && profileById.has(p.targetId)
                      ? `→ ${profileById.get(p.targetId).username}`
                      : "stiže"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Feed današnjih rundi */}
      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Danas
        </h2>

        {!iAmPresent && feedItems.length > 0 ? (
          <div className="relative mt-4 overflow-hidden rounded-card">
            <div className="pointer-events-none select-none blur-lg brightness-[.35]" aria-hidden="true">
              <div className="flex flex-col gap-4">
                {feedItems.slice(0, 2).map((item) => (
                  <div key={item.id} className="surface-2 h-56 overflow-hidden rounded-card">
                    {item.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photo_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
              <p className="font-display text-2xl uppercase leading-none">
                <BrandPunct>Objavi rundu da vidiš tulum.</BrandPunct>
              </p>
              <p className="text-xs text-muted">
                Frendovi su za šankom, a ti buljiš u prazno. Digni zeleni plus.
              </p>
            </div>
          </div>
        ) : feedItems.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Još nijedna runda danas. Budi prvi, ponesi lakat.
          </p>
        ) : (
          <div className="stagger mt-4 flex flex-col gap-4">
            {feedItems.map((item, i) => {
              const p = profileById.get(item.user_id);
              const username = p?.username ?? "Netko";
              const count = commentCounts[item.id] ?? 0;
              return (
                <article
                  key={item.id}
                  className={`surface-2 overflow-hidden rounded-card${justArrivedIds.has(item.id) ? " feed-item-new" : ""}`}
                  style={{ "--stagger-i": Math.min(i, 8) }}
                >
                  <Link
                    href={profileHref(item.user_id)}
                    className="flex items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 font-bold">
                      <Avatar username={username} avatarUrl={p?.avatar_url} size={30} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{username}</span>
                        <Title id={item.user_id} />
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-accent">
                      {timeFmt.format(new Date(item.checked_in_at))}
                    </span>
                  </Link>

                  {item.photo_url ? (
                    <button
                      type="button"
                      onClick={() => openPhoto(item)}
                      className="block w-full"
                      aria-label={`Slika: ${username}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.photo_url}
                        alt=""
                        loading={i < 2 ? undefined : "lazy"}
                        decoding="async"
                        className="max-h-[70dvh] w-full object-cover"
                      />
                    </button>
                  ) : (
                    <p className="px-4 pb-1 text-sm text-muted">
                      Sjeo za šank. Bez dokaza, klasika.
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <ReactionBar
                      rows={reactions[item.id] ?? []}
                      myId={currentUserId}
                      onToggle={(emoji) => handleReaction(item.id, emoji)}
                    />
                    <button
                      type="button"
                      onClick={() => setCommentFor(item.id)}
                      className="pressable flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 text-sm"
                      aria-label={`Komentari (${count})`}
                    >
                      💬
                      {count > 0 && (
                        <span className="text-xs font-bold text-muted">{count}</span>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <CommentSheet
        checkinId={commentFor}
        currentUserId={currentUserId}
        onClose={() => setCommentFor(null)}
      />

      <PhotoLightbox
        items={lightbox?.items}
        startIndex={lightbox?.startIndex ?? 0}
        onClose={() => setLightbox(null)}
      >
        {(current) =>
          current?.checkinId && (
            <div className="flex flex-col items-center gap-4">
              <ReactionBar
                rows={reactions[current.checkinId] ?? []}
                myId={currentUserId}
                onToggle={(emoji) => handleReaction(current.checkinId, emoji)}
              />
            </div>
          )
        }
      </PhotoLightbox>

      {/* Mini sheet na tap avatara u story baru */}
      {avatarSheet &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setAvatarSheet(null)}
          >
            <div
              className="w-full max-w-sm rounded-t-3xl border-t border-white/10 bg-[#131316] px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
              <div className="flex items-center gap-3">
                <Avatar
                  username={avatarSheet.profile.username}
                  avatarUrl={avatarSheet.profile.avatar_url}
                  size={44}
                />
                <span className="font-display text-2xl uppercase tracking-wide">
                  {avatarSheet.profile.username}
                </span>
              </div>

              <div className="mt-4 max-h-[55dvh] overflow-y-auto">
                {sheetPosts.length > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-1.5">
                      {sheetPosts
                        .filter((post) => post.photo_url)
                        .map((post) => (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => {
                              setAvatarSheet(null);
                              openPhoto(post, sheetPosts);
                            }}
                            className="pressable-soft aspect-square overflow-hidden rounded-field bg-white/[0.04]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={post.thumb_url || post.photo_url}
                              alt={`Slika u ${timeFmt.format(new Date(post.checked_in_at))}`}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                    </div>
                    {sheetDrinks.length > 0 && (
                      <p className="mt-3 text-xs text-muted">
                        🍺 {sheetDrinks.length} {sheetDrinks.length === 1 ? "piće" : "pića"} danas
                        · zadnje u{" "}
                        {timeFmt.format(
                          new Date(sheetDrinks[sheetDrinks.length - 1].logged_at)
                        )}
                      </p>
                    )}
                    {sheetLocation && (
                      <a
                        href={`https://www.google.com/maps?q=${sheetLocation.lat},${sheetLocation.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs font-bold text-accent"
                      >
                        📍 Otvori lokaciju
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted">Još ništa danas.</p>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={profileHref(avatarSheet.profile.id)}
                  onClick={() => setAvatarSheet(null)}
                  className="surface-2 pressable-soft flex h-12 items-center justify-center rounded-button text-sm font-bold uppercase tracking-wide"
                >
                  Vidi profil
                </Link>
                {avatarSheet.present &&
                  avatarSheet.profile.id !== currentUserId &&
                  canNajava && (
                    <button
                      type="button"
                      onClick={() => handleNajava(avatarSheet.profile.id)}
                      disabled={isPending}
                      className="pressable-soft flex h-12 items-center justify-center rounded-button border border-amber-400/30 bg-amber-400/10 text-sm font-bold uppercase tracking-wide text-amber-300 disabled:opacity-50"
                    >
                      👉 Stižem kod {avatarSheet.profile.username}
                    </button>
                  )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
