"use client";

import { useState } from "react";
import Link from "next/link";

// Empty state za korisnika BEZ pajdaša — 3.0 zamjena za nekadašnji
// "uđi u grupu" onboarding. Kod + share link (isti flow kao Pajdaši).
export default function AddFriendsCard({ friendCode }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!friendCode) return;
    const shareUrl = `${window.location.origin}/f/${friendCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Lakat",
          text: "Dodaj me na Lakatu",
          url: shareUrl,
        });
        return;
      } catch {
        // korisnik otkazao share sheet — padni na copy
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="mt-10">
      <div className="glass rounded-card p-6 text-center">
        <p className="font-display text-4xl uppercase leading-none tracking-tight">
          Bez pajdaša nema šanka<span className="text-accent">.</span>
        </p>
        <p className="mt-3 text-sm text-muted">
          Lakat je tvoja ekipa uživo — dodaj pajdaše pa vidi tko je vani,
          tko stiže i tko časti.
        </p>

        {friendCode && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-card border border-white/10 bg-white/[0.04] p-4">
            <span className="flex flex-col text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Moj kod
              </span>
              <span className="font-display text-2xl tracking-[0.3em] text-accent">
                {friendCode}
              </span>
            </span>
            <button
              type="button"
              onClick={handleShare}
              className="pressable-soft shrink-0 rounded-full border border-accent/25 bg-accent/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-accent"
            >
              {copied ? "Kopirano" : "Podijeli"}
            </button>
          </div>
        )}

        <Link
          href="/profil/frendovi"
          className="pressable-soft mt-4 flex h-14 w-full items-center justify-center rounded-button bg-accent font-display text-xl uppercase tracking-wide text-black shadow-glow"
        >
          Dodaj pajdaše
        </Link>
        <p className="mt-3 text-xs text-muted">
          Imaš tuđi kod? Upiši ga na Pajdašima. Nemaš? Traži, ne budi pička.
        </p>
      </div>
    </section>
  );
}
