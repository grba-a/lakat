"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { squareCropToBlob } from "@/lib/image";
import Avatar from "../avatar";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const OUTPUT_SIZE = 256;

export default function AvatarUploader({ userId, username, avatarUrl }) {
  const inputRef = useRef(null);
  const router = useRouter();
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Bez slike: tap odmah otvara picker. Sa slikom: tap otvara izbor
  // Promijeni/Izbriši (čisto, bez plusa i teksta).
  function handleTap() {
    setError(null);
    if (!avatarUrl) {
      inputRef.current?.click();
      return;
    }
    setMenuOpen((open) => !open);
  }

  function handleChangeClick() {
    setMenuOpen(false);
    inputRef.current?.click();
  }

  function handleDelete() {
    setMenuOpen(false);
    setError(null);
    startTransition(async () => {
      try {
        const supabase = createClient();
        await supabase.storage.from("avatars").remove([`${userId}/avatar.jpg`]);
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: null })
          .eq("id", userId);
        if (updateError) throw new Error(updateError.message);
        router.refresh();
      } catch {
        setError("Brisanje nije prošlo. Slika te ne pušta.");
      }
    });
  }

  function handlePick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError("Koji ti je to kurac od slike? Manju.");
      return;
    }

    startTransition(async () => {
      try {
        const blob = await squareCropToBlob(file, OUTPUT_SIZE);
        const supabase = createClient();
        const path = `${userId}/avatar.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, blob, {
            upsert: true,
            contentType: "image/jpeg",
            cacheControl: "3600",
          });
        if (uploadError) throw new Error(uploadError.message);

        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        const url = `${data.publicUrl}?v=${Date.now()}`;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: url })
          .eq("id", userId);
        if (updateError) throw new Error(updateError.message);

        router.refresh();
      } catch {
        setError("Slika se nije uploadala. Probaj neku manju, Spielbergu.");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleTap}
        disabled={isPending}
        className="pressable rounded-full disabled:opacity-50"
        aria-label={avatarUrl ? "Uredi profilnu sliku" : "Dodaj profilnu sliku"}
      >
        {avatarUrl ? (
          <Avatar username={username} avatarUrl={avatarUrl} size={80} />
        ) : (
          <span
            style={{ width: 80, height: 80 }}
            className="flex items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-4xl font-bold leading-none text-accent"
          >
            +
          </span>
        )}
      </button>

      {isPending && <span className="text-xs text-muted">Sekunda...</span>}
      {!avatarUrl && !isPending && (
        <span className="text-xs text-muted">Dodaj sliku</span>
      )}

      {menuOpen && avatarUrl && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleChangeClick}
            className="surface-2 pressable-soft rounded-full px-3 py-2 text-xs font-bold uppercase tracking-widest text-foreground"
          >
            Promijeni
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="pressable-soft rounded-full border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-danger"
          >
            Izbriši
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handlePick}
        className="hidden"
      />
      {error && (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
