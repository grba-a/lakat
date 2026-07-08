"use client";

import { useState } from "react";
import PhotoLightbox from "./photo-lightbox";

const dateFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

// Osobna arhiva dokaznih slika na profilu — čist grid + lightbox, bez
// reakcija (te žive na Šanku uz slike dana)
export default function Galerija({ items, own = false }) {
  const [lightbox, setLightbox] = useState(null);

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Galerija
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          {own
            ? "Još nema slika. Slikaj se za šankom pa će ih biti."
            : "Još nema slika. Nije se slikao za šankom, sumnjivo."}
        </p>
      ) : (
        <div className="stagger mt-4 grid grid-cols-3 gap-2">
          {items.map((item, i) => {
            const caption = dateFmt.format(new Date(item.checked_in_at));
            return (
              <div key={item.id} style={{ "--stagger-i": Math.min(i, 8) }}>
                <button
                  type="button"
                  onClick={() => setLightbox({ url: item.photo_url, caption })}
                  className="pressable relative aspect-square w-full overflow-hidden rounded-card border border-white/10"
                  aria-label={`Slika od ${caption}`}
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
                </button>
              </div>
            );
          })}
        </div>
      )}

      <PhotoLightbox
        url={lightbox?.url}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
    </section>
  );
}
