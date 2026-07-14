"use client";

import { useState, useTransition } from "react";
import { react } from "@/app/actions";
import PhotoLightbox from "./photo-lightbox";
import ReactionBar, { toggleReaction } from "./reaction-bar";
import CommentThread from "./comment-thread";

// "Na današnji dan" flashback grid (3/6/12 mjeseci) — tap za fullscreen +
// reakcije. Današnje "Slike dana" žive u sank.jsx (realtime); flashbackovi
// su stari checkini pa im server-seedane reakcije + optimistički toggle
// ovdje ostaju točni.
export default function Memorije({ flashbacks = [], myId, initialReactions = {} }) {
  const [lightbox, setLightbox] = useState(null);
  const [reactions, setReactions] = useState(initialReactions);
  const [, startTransition] = useTransition();

  if (!flashbacks.length) return null;

  function handleReaction(checkinId, emoji) {
    setReactions((prev) => ({
      ...prev,
      [checkinId]: toggleReaction(prev[checkinId] ?? [], myId, emoji),
    }));
    startTransition(async () => {
      await react(checkinId, emoji);
    });
  }

  return (
    <section className="mb-4 mt-12">
      <h2 className="text-xs font-bold uppercase tracking-widest text-accent">
        Na današnji dan 📅
      </h2>
      <div className="stagger mt-4 grid grid-cols-3 gap-2">
        {flashbacks.map((item, i) => {
          const caption = `${item.username} · ${item.label}`;
          const count = reactions[item.id]?.length ?? 0;
          return (
            <div key={item.id} style={{ "--stagger-i": Math.min(i, 8) }}>
              <button
                type="button"
                onClick={() =>
                  setLightbox({
                    items: [
                      { url: item.photo_url, caption, checkinId: item.id },
                    ],
                  })
                }
                className="pressable relative aspect-square w-full overflow-hidden rounded-card border border-accent/25"
                aria-label={`Flashback: ${item.username}, ${item.label}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumb_url ?? item.photo_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
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
            </div>
          );
        })}
      </div>

      <PhotoLightbox
        items={lightbox?.items}
        onClose={() => setLightbox(null)}
      >
        {(current) =>
          current?.checkinId && (
            <div className="flex flex-col items-center gap-4">
              <ReactionBar
                rows={reactions[current.checkinId] ?? []}
                myId={myId}
                onToggle={(emoji) => handleReaction(current.checkinId, emoji)}
              />
              <CommentThread checkinId={current.checkinId} currentUserId={myId} />
            </div>
          )
        }
      </PhotoLightbox>
    </section>
  );
}
