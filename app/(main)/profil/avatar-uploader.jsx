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
  const [isPending, startTransition] = useTransition();

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
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="pressable relative rounded-full disabled:opacity-50"
        aria-label="Promijeni profilnu sliku"
      >
        <Avatar username={username} avatarUrl={avatarUrl} size={80} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-sm font-bold text-black shadow-soft">
          +
        </span>
      </button>
      <span className="text-xs text-muted">
        {isPending ? "Sekunda..." : "Promijeni sliku"}
      </span>
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
