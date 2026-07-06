"use client";

import { useState, useTransition } from "react";
import { react } from "@/app/actions";
import PhotoLightbox from "./photo-lightbox";
import ReactionBar, { toggleReaction } from "./reaction-bar";

const timeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

// Grid današnjih dokaznih slika (beer with me stil) — tap za fullscreen +
// reakcije; "resetira" se sam u 06:00 jer server šalje samo današnji dan
export default function Memorije({ items, flashbacks = [], myId, initialReactions = {} }) {
  const [lightbox, setLightbox] = useState(null);
  const [reactions, setReactions] = useState(initialReactions);
  const [, startTransition] = useTransition();

  if (!items.length && !flashbacks.length) return null;

  function handleReaction(checkinId, emoji) {
    setReactions((prev) => ({
      ...prev,
      [checkinId]: toggleReaction(prev[checkinId] ?? [], myId, emoji),
    }));
    startTransition(async () => {
      await react(checkinId, emoji);
    });
  }

  function Tile({ item, caption, borderClass, label }) {
    const count = reactions[item.id]?.length ?? 0;
    return (
      <button
        type="button"
        onClick={() => setLightbox({ url: item.photo_url, caption, checkinId: item.id })}
        className={`pressable relative aspect-square overflow-hidden rounded-card border ${borderClass}`}
        aria-label={label}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.photo_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left text-[10px] font-bold uppercase tracking-wider text-foreground">
          {caption}
        </span>
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 rounded-full border border-white/10 bg-black/70 px-1.5 text-[10px] font-bold leading-4 text-foreground">
            {count}
          </span>
        )}
      </button>
    );
  }

  return (
    <section className="mb-4 mt-12">
      {flashbacks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-accent">
            Na današnji dan 📅
          </h2>
          <div className="stagger mt-4 grid grid-cols-3 gap-2">
            {flashbacks.map((item, i) => (
              <div key={item.id} style={{ "--stagger-i": Math.min(i, 8) }}>
                <Tile
                  item={item}
                  caption={`${item.username} · ${item.label}`}
                  borderClass="border-accent/25"
                  label={`Flashback: ${item.username}, ${item.label}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
            Slike dana
          </h2>
          <div className="stagger mt-4 grid grid-cols-3 gap-2">
            {items.map((item, i) => (
              <div key={item.id} style={{ "--stagger-i": Math.min(i, 8) }}>
                <Tile
                  item={item}
                  caption={`${item.username} · ${timeFmt.format(new Date(item.checked_in_at))}`}
                  borderClass="border-white/10"
                  label={`Slika dana: ${item.username}`}
                />
              </div>
            ))}
          </div>
        </>
      )}

      <PhotoLightbox
        url={lightbox?.url}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      >
        {lightbox?.checkinId && (
          <ReactionBar
            rows={reactions[lightbox.checkinId] ?? []}
            myId={myId}
            onToggle={(emoji) => handleReaction(lightbox.checkinId, emoji)}
          />
        )}
      </PhotoLightbox>
    </section>
  );
}
