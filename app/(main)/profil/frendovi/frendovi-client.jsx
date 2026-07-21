"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Avatar from "../../avatar";
import {
  sendFriendRequestTo,
  respondFriendRequest,
  removeFriend,
  dismissSuggestion,
} from "./actions";

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function presenceLabel(lastSeenAt) {
  if (!lastSeenAt) return { online: false, label: "Nikad aktivan" };
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  if (diffMs < ONLINE_WINDOW_MS) return { online: true, label: "Online sad" };
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return { online: false, label: `Viđen prije ${mins} min` };
  const hours = Math.round(mins / 60);
  if (hours < 24) return { online: false, label: `Viđen prije ${hours} h` };
  const days = Math.round(hours / 24);
  return { online: false, label: `Viđen prije ${days} d` };
}

function Msg({ state }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p className="rounded-card border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-bold text-accent">
        {state.message}
      </p>
    );
  }
  return null;
}

function FriendRow({ friend, onAction, style }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const presence = presenceLabel(friend.last_seen_at);

  return (
    <li
      className={`surface-2 rounded-row transition-opacity ${
        presence.online ? "" : "opacity-50"
      }`}
      style={style}
    >
      <div className="flex min-h-14 items-center justify-between gap-2 px-4 py-2">
        <span className="flex items-center gap-3 font-bold">
          <Avatar username={friend.username} avatarUrl={friend.avatar_url} size={32} />
          <span className="flex flex-col">
            {friend.username}
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                presence.online ? "text-accent" : "text-muted"
              }`}
            >
              <span
                className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                  presence.online ? "bg-accent" : "bg-muted"
                }`}
              />
              {presence.label}
            </span>
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            if (confirmRemove) {
              setConfirmRemove(false);
              onAction(() => removeFriend(friend.friendshipId));
            } else {
              setConfirmRemove(true);
            }
          }}
          className="pressable-soft shrink-0 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-danger"
        >
          {confirmRemove ? "Sigurno?" : "Makni"}
        </button>
      </div>
    </li>
  );
}

export default function FrendoviClient({
  friends,
  incoming,
  outgoing,
  suggestions = [],
}) {
  const router = useRouter();
  const [actionMsg, setActionMsg] = useState(null);
  const [, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState(() => new Set());

  function runAction(fn) {
    setActionMsg(null);
    startTransition(async () => {
      const result = await fn();
      setActionMsg(result ?? null);
      if (result?.ok) router.refresh();
    });
  }

  function handleSuggestion(id) {
    setActionMsg(null);
    setSentTo((prev) => new Set([...prev, id]));
    startTransition(async () => {
      const result = await sendFriendRequestTo(id);
      setActionMsg(result ?? null);
      if (result?.ok) router.refresh();
    });
  }

  // Odbij prijedlog: ne nestaje, server ga premjesti na kraj liste
  function handleDismiss(id) {
    setActionMsg(null);
    startTransition(async () => {
      const result = await dismissSuggestion(id);
      if (result?.ok) router.refresh();
      else setActionMsg(result ?? null);
    });
  }

  return (
    <>
      {actionMsg && (
        <div className="mt-4">
          <Msg state={actionMsg} />
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
            Možda se znate
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="surface-2 flex min-h-14 items-center justify-between gap-2 rounded-row px-4 py-2"
              >
                <span className="flex items-center gap-3 font-bold">
                  <Avatar username={s.username} avatarUrl={s.avatar_url} size={32} />
                  <span className="flex flex-col">
                    {s.username}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      {s.mutual}{" "}
                      {s.mutual === 1
                        ? "zajednički pajdaš"
                        : s.mutual <= 4
                          ? "zajednička pajdaša"
                          : "zajedničkih pajdaša"}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDismiss(s.id)}
                    aria-label="Odbij prijedlog"
                    className="pressable flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-sm text-muted"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSuggestion(s.id)}
                    disabled={sentTo.has(s.id)}
                    className="pressable-soft rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-accent disabled:opacity-50"
                  >
                    {sentTo.has(s.id) ? "Poslano" : "Dodaj"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {incoming.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
            Zahtjevi
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {incoming.map((f) => (
              <li
                key={f.friendshipId}
                className="surface-2 flex min-h-14 items-center justify-between gap-2 rounded-row px-4 py-2"
              >
                <span className="flex items-center gap-3 font-bold">
                  <Avatar username={f.username} avatarUrl={f.avatar_url} size={32} />
                  {f.username}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => runAction(() => respondFriendRequest(f.friendshipId, true))}
                    className="pressable-soft rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-accent"
                  >
                    Prihvati
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(() => respondFriendRequest(f.friendshipId, false))}
                    className="pressable-soft rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-danger"
                  >
                    Odbij
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-4 mt-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Pajdaši {friends.length > 0 && `(${friends.length})`}
        </h2>
        {friends.length === 0 && outgoing.length === 0 && (
          <p className="mt-4 text-sm text-muted">Nemaš pajdaša. Tragično.</p>
        )}
        <ul className="stagger mt-4 flex flex-col gap-2">
          {friends.map((f, i) => (
            <FriendRow
              key={f.friendshipId}
              friend={f}
              onAction={runAction}
              style={{ "--stagger-i": Math.min(i, 8) }}
            />
          ))}
          {outgoing.map((f) => (
            <li
              key={f.friendshipId}
              className="surface-2 flex h-14 items-center justify-between gap-2 rounded-row px-4 opacity-60"
            >
              <span className="flex items-center gap-3 font-bold">
                <Avatar username={f.username} avatarUrl={f.avatar_url} size={32} />
                {f.username}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Čeka odgovor
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
