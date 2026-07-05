"use client";

// Fullscreen pregled slike — tap bilo gdje zatvara
export default function PhotoLightbox({ url, caption, onClose }) {
  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-5 backdrop-blur-xl"
      onClick={onClose}
      role="dialog"
      aria-label={caption || "Slika"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={caption || ""}
        className="max-h-[75dvh] w-auto max-w-full rounded-card border border-white/10 object-contain shadow-float"
      />
      {caption && (
        <p className="text-sm font-bold uppercase tracking-widest text-muted">
          {caption}
        </p>
      )}
      <p className="text-xs text-muted/60">Stisni bilo gdje za zatvoriti</p>
    </div>
  );
}
