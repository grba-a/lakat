"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAP_EMOJIS } from "@/lib/map-emojis";
import { setMapEmoji } from "./emoji-actions";

// "Moj emoji na karti" — kurirana mreža + "Nasumično" (null). Optimistički
// odabir, sprema u pozadini.
export default function MapEmojiPicker({ current }) {
  const router = useRouter();
  const [selected, setSelected] = useState(current ?? null);
  const [, startTransition] = useTransition();

  function pick(emoji) {
    setSelected(emoji);
    startTransition(async () => {
      await setMapEmoji(emoji);
      router.refresh();
    });
  }

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Moj emoji na karti
      </h2>
      <p className="mt-2 text-sm text-muted">
        Ovako te ekipa vidi na mapi. Odaberi svoj ili pusti nasumično.
      </p>

      <button
        type="button"
        onClick={() => pick(null)}
        className={`pressable-soft mt-4 flex h-12 w-full items-center justify-center rounded-button text-sm font-bold uppercase tracking-widest ${
          selected == null
            ? "bg-accent/15 text-accent"
            : "surface-2 text-muted"
        }`}
      >
        🎲 Nasumično
      </button>

      <div className="mt-3 grid grid-cols-8 gap-2">
        {MAP_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => pick(emoji)}
            aria-label={`Emoji ${emoji}`}
            className={`pressable-soft flex aspect-square items-center justify-center rounded-field text-2xl ${
              selected === emoji
                ? "border-2 border-accent bg-accent/15"
                : "surface-2"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </section>
  );
}
