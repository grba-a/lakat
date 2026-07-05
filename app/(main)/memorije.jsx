"use client";

import { useState } from "react";
import PhotoLightbox from "./photo-lightbox";

const dateFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  day: "numeric",
  month: "numeric",
});

// Grid zadnjih dokaznih slika (beer with me stil) — tap za fullscreen
export default function Memorije({ items }) {
  const [lightbox, setLightbox] = useState(null);

  if (!items.length) return null;

  return (
    <section className="mb-4 mt-12">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Memorije
      </h2>
      <div className="stagger mt-4 grid grid-cols-3 gap-2">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              setLightbox({
                url: item.photo_url,
                caption: `${item.username} · ${dateFmt.format(new Date(item.checked_in_at))}`,
              })
            }
            className="pressable relative aspect-square overflow-hidden rounded-card border border-white/10"
            style={{ "--stagger-i": Math.min(i, 8) }}
            aria-label={`Memorija: ${item.username}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.photo_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left text-[10px] font-bold uppercase tracking-wider text-foreground">
              {item.username}
            </span>
          </button>
        ))}
      </div>

      <PhotoLightbox
        url={lightbox?.url}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
    </section>
  );
}
