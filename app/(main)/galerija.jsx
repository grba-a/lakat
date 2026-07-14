"use client";

import { useMemo, useState } from "react";
import { getDayKey } from "@/lib/day";
import PhotoLightbox from "./photo-lightbox";

const dateFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

// Osobna arhiva dokaznih slika na profilu, grupirana po lakat-danu
// (06:00-06:00) — jedan kvadratić po danu, tap otvara fullscreen swipe kroz
// slike tog dana. Bez reakcija (te žive na Šanku uz slike dana).
// Napomena: items su capani na 60 REDOVA u profil/page.jsx, pa najstariji
// prikazani dan može biti odrezan usred dana.
export default function Galerija({ items, own = false }) {
  const [lightbox, setLightbox] = useState(null);

  // items stižu newest-first → najnoviji dan prvi, unutar dana najnovija prva
  const groups = useMemo(() => {
    const byDay = new Map();
    for (const it of items) {
      const k = getDayKey(it.checked_in_at);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(it);
    }
    return [...byDay.entries()].map(([dayKey, photos]) => ({ dayKey, photos }));
  }, [items]);

  function openDay(group) {
    const day = dateFmt.format(new Date(group.photos[0].checked_in_at));
    setLightbox({
      items: group.photos.map((p) => ({
        url: p.photo_url,
        caption: `${day} · ${timeFmt.format(new Date(p.checked_in_at))}`,
      })),
    });
  }

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Galerija
      </h2>

      {groups.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          {own
            ? "Još nema slika. Slikaj se za šankom pa će ih biti."
            : "Još nema slika. Nije se slikao za šankom, sumnjivo."}
        </p>
      ) : (
        <div className="stagger mt-4 grid grid-cols-3 gap-2">
          {groups.map((group, i) => {
            const cover = group.photos[0];
            const caption = dateFmt.format(new Date(cover.checked_in_at));
            return (
              <div key={group.dayKey} style={{ "--stagger-i": Math.min(i, 8) }}>
                <button
                  type="button"
                  onClick={() => openDay(group)}
                  className="pressable relative aspect-square w-full overflow-hidden rounded-card border border-white/10"
                  aria-label={`Slike od ${caption} (${group.photos.length})`}
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
                    {caption}
                  </span>
                  {group.photos.length > 1 && (
                    <span className="absolute left-1.5 top-1.5 rounded-full border border-white/10 bg-black/70 px-1.5 text-[10px] font-bold leading-4 text-foreground">
                      {group.photos.length} 📸
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <PhotoLightbox items={lightbox?.items} onClose={() => setLightbox(null)} />
    </section>
  );
}
