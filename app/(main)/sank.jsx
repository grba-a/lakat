"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentDayStart } from "@/lib/day";
import { najaviDolazak, react } from "@/app/actions";
import Avatar from "./avatar";
import PhotoLightbox from "./photo-lightbox";
import ReactionBar, { toggleReaction } from "./reaction-bar";
import CommentThread from "./comment-thread";
import SazivCard from "./saziv-card";

const timeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

const NAJAVA_TRAJANJE_MS = 45 * 60 * 1000;
const SAZIV_ZIVOT_NAKON_MS = 3 * 60 * 60 * 1000;

// Makni jedan red (po id-u) iz mape stanja
function removeRow(setMap, id) {
  setMap((prev) => {
    const next = { ...prev };
    delete next[id];
    return next;
  });
}

// Popis dana na Šanku: prisutni + najavljeni, realtime. Sama objava runde
// (kamera → editor → kolo pića) živi u runda-flow.jsx iza plusa u navbaru;
// novi redovi ovdje stižu realtime kanalom.
export default function Sank({
  groupId,
  profiles,
  initialCheckins,
  currentUserId,
  titles = {},
  initialNajave = [],
  initialReactions = {},
  initialDrinks = [],
  monthDrinkCount = 0,
  initialSaziv = null,
  initialOdazivi = [],
}) {
  // Svi današnji checkin REDOVI po id-u (korisnik može imati više rundi
  // dnevno). Realtime INSERT dodaje red, UPDATE mijenja po id-u.
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
  // Pića po id-u reda — obrazac identičan rows/najave
  const [drinks, setDrinks] = useState(() => {
    const map = {};
    for (const d of initialDrinks) map[d.id] = d;
    return map;
  });
  // Živi saziv (max jedan po grupi) + odazivi keyed po user_id (jedan
  // odaziv po članu; INSERT i UPDATE oba samo pregaze red)
  const [saziv, setSaziv] = useState(initialSaziv);
  const [odazivi, setOdazivi] = useState(() => {
    const map = {};
    for (const o of initialOdazivi) map[o.user_id] = o;
    return map;
  });
  const [now, setNow] = useState(() => Date.now());
  const [dayStartIso, setDayStartIso] = useState(() =>
    getCurrentDayStart().toISOString()
  );
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { items: [{url, caption, checkinId}], startIndex }
  const [isPending, startTransition] = useTransition();

  // Realtime: sve filtrirano po aktivnoj grupi (RLS to čuva i na serveru);
  // na promjenu grupe komponenta se remounta (key) i resubscribea.
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
            removeRow(setDrinks, payload.old.id);
            return;
          }
          setDrinks((prev) => ({ ...prev, [payload.new.id]: payload.new }));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sazivi", filter: groupFilter },
        (payload) => {
          // Jedan živi saziv po grupi — noviji pregazi eventualni stari
          setSaziv(payload.new);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "sazivi", filter: groupFilter },
        (payload) => {
          setSaziv((prev) => (prev && prev.id === payload.old.id ? null : prev));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saziv_odazivi", filter: groupFilter },
        (payload) => {
          if (payload.eventType === "DELETE") return; // cascade uz saziv, karta ionako nestaje
          setOdazivi((prev) => ({ ...prev, [payload.new.user_id]: payload.new }));
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

  // Po korisniku: najraniji aktivni checkin (vrijeme dolaska + slika) i
  // najsvježija živa najava. Tko nema ništa od toga, ne prikazuje se.
  const { present, arriving, incomingByTarget } = useMemo(() => {
    const byUser = new Map();
    for (const row of Object.values(rows)) {
      if (row.cancelled_at || row.checked_in_at < dayStartIso) continue;
      const first = byUser.get(row.user_id);
      if (!first || row.checked_in_at < first.checked_in_at) {
        byUser.set(row.user_id, row);
      }
    }

    const najavaCutoff = new Date(now - NAJAVA_TRAJANJE_MS).toISOString();
    // Po korisniku najsvježija živa najava (s metom kod koje stiže); usput
    // se broji koliko ih stiže kod koje mete (badge na kartici prisutnog)
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
      const first = byUser.get(p.id);
      const najava = arrivingAt.get(p.id);
      if (first) {
        present.push({
          ...p,
          checkinId: first.id,
          arrivedAt: first.checked_in_at,
          photoUrl: first.photo_url ?? null,
          thumbUrl: first.thumb_url ?? null,
          drinkCount: drinkCountByUser.get(p.id) ?? 0,
        });
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
    present.sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt));
    arriving.sort((a, b) => b.announcedAt.localeCompare(a.announcedAt));
    return { present, arriving, incomingByTarget };
  }, [profiles, rows, najave, drinks, now, dayStartIso]);

  // Slike dana grupirane PO KORISNIKU: [{ userId, photos }] — photos newest
  // first, grupe poredane po najnovijoj slici. Živi na Sankovom realtimeu
  // (rows), pa nova slika uskače bez refresha.
  const memoryGroups = useMemo(() => {
    const sorted = Object.values(rows)
      .filter((r) => r.photo_url && !r.cancelled_at && r.checked_in_at >= dayStartIso)
      .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at));
    const byUser = new Map();
    for (const r of sorted) {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
      byUser.get(r.user_id).push(r);
    }
    return [...byUser.entries()].map(([userId, photos]) => ({ userId, photos }));
  }, [rows, dayStartIso]);

  // Saziv živi do at_time + 3h; istek "otkuca" minutni now timer
  const ziviSaziv =
    saziv && new Date(saziv.at_time).getTime() + SAZIV_ZIVOT_NAKON_MS > now
      ? saziv
      : null;
  const sazivOdazivi = useMemo(
    () =>
      ziviSaziv
        ? Object.values(odazivi).filter((o) => o.saziv_id === ziviSaziv.id)
        : [],
    [odazivi, ziviSaziv]
  );

  const iAmPresent = present.some((p) => p.id === currentUserId);
  const iAmArriving = arriving.some((p) => p.id === currentUserId);
  const presentIds = useMemo(() => new Set(present.map((p) => p.id)), [present]);
  const usernameById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.username])),
    [profiles]
  );

  // "Stižem" na kartici prisutnog — najava cilja baš njega (push samo njemu)
  function handleNajava(targetId) {
    setError(null);
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
      items: [
        {
          url: p.photoUrl,
          caption: `${p.username} · ${timeFmt.format(new Date(p.arrivedAt))}`,
          checkinId: typeof p.checkinId === "number" ? p.checkinId : null,
        },
      ],
      startIndex: 0,
    });
  }

  // Tap na grupirani tile: fullscreen carousel kroz sve današnje slike
  // tog korisnika (najnovija prva)
  function openMemories(group) {
    const username = usernameById.get(group.userId) ?? "Netko";
    setLightbox({
      items: group.photos.map((p) => ({
        url: p.photo_url,
        caption: `${username} · ${timeFmt.format(new Date(p.checked_in_at))}`,
        checkinId: p.id,
      })),
      startIndex: 0,
    });
  }

  // "Stižem" postoji samo na karticama prisutnih — ako nitko nije sjeo,
  // nemaš komu stizati
  const canNajava = !iAmPresent && !iAmArriving;

  return (
    <div className="flex flex-1 flex-col">
      <SazivCard
        saziv={ziviSaziv}
        odazivi={sazivOdazivi}
        profiles={profiles}
        currentUserId={currentUserId}
        now={now}
        onSazivCreated={(s) => {
          setSaziv(s);
          setOdazivi((prev) => ({
            ...prev,
            [currentUserId]: {
              user_id: currentUserId,
              saziv_id: s.id,
              status: "stizem",
            },
          }));
          setNow(Date.now());
        }}
        onOdaziv={(userId, sazivId, status) =>
          setOdazivi((prev) => ({
            ...prev,
            [userId]: { user_id: userId, saziv_id: sazivId, status },
          }))
        }
        onSazivGone={() => setSaziv(null)}
        onError={setError}
      />

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

      <section className="mt-8">
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
            {arriving.length > 0
              ? "Nitko još nije sjeo. Najave su jeftine."
              : "Nikoga. Šank zjapi prazan, sram vas sve bilo."}
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
                    {(p.drinkCount > 0 || incomingByTarget.has(p.id)) && (
                      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                        {p.drinkCount > 0 && <span>🍺 {p.drinkCount}</span>}
                        {incomingByTarget.has(p.id) && (
                          <span className="text-amber-300">
                            👀{" "}
                            {incomingByTarget.get(p.id) === 1
                              ? "1 stiže"
                              : incomingByTarget.get(p.id) <= 4
                                ? `${incomingByTarget.get(p.id)} stižu`
                                : `${incomingByTarget.get(p.id)} stiže`}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {canNajava && p.id !== currentUserId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleNajava(p.id);
                      }}
                      disabled={isPending}
                      className="pressable rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-amber-300 disabled:opacity-50"
                    >
                      👉 Stižem
                    </button>
                  )}
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
                className="flex min-h-14 items-center justify-between gap-2 px-4 py-2"
              >
                <span className="flex min-w-0 items-center gap-3 font-bold">
                  <Avatar
                    username={p.username}
                    avatarUrl={p.avatar_url}
                    size={32}
                    className="border-amber-400/40"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{p.username}</span>
                    <Title id={p.id} />
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end text-right text-xs font-bold uppercase tracking-widest text-amber-300">
                  <span>
                    {p.targetId && presentIds.has(p.targetId)
                      ? `Stiže kod ${usernameById.get(p.targetId) ?? "nekoga"}`
                      : "Stiže (navodno)"}
                  </span>
                  <span>{timeFmt.format(new Date(p.announcedAt))}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {memoryGroups.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
            Slike dana
          </h2>
          <div className="stagger mt-4 grid grid-cols-3 gap-2">
            {memoryGroups.map((group, i) => {
              const username = usernameById.get(group.userId) ?? "Netko";
              const cover = group.photos[0];
              const reactionCount = group.photos.reduce(
                (n, p) => n + (reactions[p.id]?.length ?? 0),
                0
              );
              return (
                <div key={group.userId} style={{ "--stagger-i": Math.min(i, 8) }}>
                  <button
                    type="button"
                    onClick={() => openMemories(group)}
                    className="pressable relative aspect-square w-full overflow-hidden rounded-card border border-white/10"
                    aria-label={`Slike dana: ${username} (${group.photos.length})`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cover.thumb_url ?? cover.photo_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left text-[10px] font-bold uppercase tracking-wider text-foreground">
                      {username} · {timeFmt.format(new Date(cover.checked_in_at))}
                    </span>
                    {group.photos.length > 1 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full border border-white/10 bg-black/70 px-1.5 text-[10px] font-bold leading-4 text-foreground">
                        {group.photos.length} 📸
                      </span>
                    )}
                    {reactionCount > 0 && (
                      <span className="absolute right-1.5 top-1.5 rounded-full border border-white/10 bg-black/70 px-1.5 text-[10px] font-bold leading-4 text-foreground">
                        {reactionCount}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
              <CommentThread
                key={current.checkinId}
                checkinId={current.checkinId}
                currentUserId={currentUserId}
              />
            </div>
          )
        }
      </PhotoLightbox>
    </div>
  );
}
