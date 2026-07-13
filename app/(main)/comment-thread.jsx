"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { addComment, deleteComment } from "@/app/actions";
import BadgeToast from "./badge-toast";

// Komentari se namjerno NE prefetchaju sa slikama — fetch tek kad se
// lightbox otvori (montira ovu komponentu), da inicijalni load Šanka/
// arhive ostane brz. Vlastiti scoped realtime kanal po checkinu, ne
// grupni — teardown na zatvaranje.
export default function CommentThread({ checkinId, currentUserId }) {
  const [comments, setComments] = useState(null); // null = još učitava
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("comments")
      .select("id, user_id, text, created_at, profiles(username)")
      .eq("checkin_id", checkinId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setComments(data ?? []);
      });

    const channel = supabase
      .channel(`comments-${checkinId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `checkin_id=eq.${checkinId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setComments((prev) =>
              (prev ?? []).filter((c) => c.id !== payload.old.id)
            );
            return;
          }
          if (payload.eventType === "INSERT") {
            setComments((prev) => {
              const rows = prev ?? [];
              if (rows.some((c) => c.id === payload.new.id)) return rows;
              return [...rows, { ...payload.new, profiles: null }];
            });
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [checkinId]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    setText("");
    startTransition(async () => {
      const result = await addComment(checkinId, trimmed);
      if (result?.error) {
        setError(result.error);
        setText(trimmed);
        return;
      }
      if (result?.newBadges?.length) {
        setBadgeQueue((prev) => [...prev, ...result.newBadges]);
      }
    });
  }

  function handleDelete(commentId) {
    setComments((prev) => (prev ?? []).filter((c) => c.id !== commentId));
    startTransition(async () => {
      await deleteComment(commentId);
    });
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <BadgeToast
        queue={badgeQueue}
        onDone={(key) =>
          setBadgeQueue((prev) => prev.filter((b) => b.key !== key))
        }
      />
      {comments === null && (
        <p className="text-xs text-muted">Učitavam komentare...</p>
      )}

      {comments?.length > 0 && (
        <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
          {comments.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <span>
                <span className="font-bold text-accent">
                  {c.profiles?.username ?? "Netko"}:
                </span>{" "}
                <span className="text-foreground/90">{c.text}</span>
              </span>
              {c.user_id === currentUserId && (
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="pressable shrink-0 text-xs text-muted"
                  aria-label="Obriši komentar"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder="Komentiraj..."
          className="h-10 flex-1 rounded-field border border-white/10 bg-white/[0.05] px-3 text-sm outline-none focus:border-accent/60"
        />
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          aria-label="Pošalji komentar"
          className="pressable-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-accent text-black disabled:opacity-50"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      </form>
      {error && <p className="text-xs font-bold text-danger">{error}</p>}
    </div>
  );
}
