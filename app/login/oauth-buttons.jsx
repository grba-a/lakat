"use client";

import { createClient } from "@/lib/supabase/client";

// Provider lista — Apple se doda kao još jedan entry kad bude spreman
// Apple Developer account (kod ostaje isti, samo raste ovaj niz)
const PROVIDERS = [{ id: "google", label: "Uleti Googleom" }];

export default function OauthButtons({ next = "/" }) {
  async function handleClick(provider) {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted">
        <span className="h-px flex-1 bg-white/10" />
        ili
        <span className="h-px flex-1 bg-white/10" />
      </div>
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => handleClick(p.id)}
          className="glass pressable-soft flex h-14 items-center justify-center rounded-button font-bold uppercase tracking-wide"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
