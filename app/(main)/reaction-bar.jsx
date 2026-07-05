"use client";

export const REACTION_EMOJI = ["🔥", "🤮", "😂", "🫡", "🍺"];

// Red emoji gumba s brojačima — čisti prikaz, logika je u roditelju
export default function ReactionBar({ rows, myId, onToggle, disabled }) {
  const counts = new Map();
  let mine = null;
  for (const r of rows) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    if (r.user_id === myId) mine = r.emoji;
  }

  return (
    <div className="flex gap-2">
      {REACTION_EMOJI.map((emoji) => {
        const count = counts.get(emoji) ?? 0;
        const selected = mine === emoji;
        return (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(emoji)}
            className={`pressable flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-2.5 text-lg ${
              selected
                ? "border-accent/60 bg-accent/20"
                : "border-white/10 bg-white/[0.06]"
            } disabled:opacity-50`}
            aria-label={`Reakcija ${emoji}${count ? `, ${count}` : ""}`}
          >
            {emoji}
            {count > 0 && (
              <span
                className={`text-xs font-bold ${selected ? "text-accent" : "text-muted"}`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Zajednička optimistička izmjena: ista = makni, druga = pregazi
export function toggleReaction(rows, myId, emoji) {
  const mine = rows.find((r) => r.user_id === myId);
  const rest = rows.filter((r) => r.user_id !== myId);
  if (mine?.emoji === emoji) return rest;
  return [...rest, { user_id: myId, emoji }];
}
