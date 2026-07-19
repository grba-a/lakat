"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Avatar from "../../avatar";
import {
  sendFriendRequest,
  sendFriendRequestTo,
  respondFriendRequest,
  removeFriend,
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
  myCode,
  friends,
  incoming,
  outgoing,
  suggestions = [],
}) {
  const router = useRouter();
  const [actionMsg, setActionMsg] = useState(null);
  const [, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [addPending, setAddPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sentTo, setSentTo] = useState(() => new Set());

  function runAction(fn) {
    setActionMsg(null);
    startTransition(async () => {
      const result = await fn();
      setActionMsg(result ?? null);
      if (result?.ok) router.refresh();
    });
  }

  function handleAdd(e) {
    e.preventDefault();
    setActionMsg(null);
    setAddPending(true);
    startTransition(async () => {
      const result = await sendFriendRequest(code);
      setActionMsg(result ?? null);
      setAddPending(false);
      if (result?.ok) {
        setCode("");
        router.refresh();
      }
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

  async function handleShare() {
    if (!myCode) return;
    const shareUrl = `${window.location.origin}/f/${myCode}`;
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
    <>
      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Moj kod
        </h2>
        <div className="glass mt-4 flex items-center justify-between rounded-card p-4">
          <p className="font-display text-3xl tracking-[0.3em] text-accent">
            {myCode ?? "······"}
          </p>
          <button
            type="button"
            onClick={handleShare}
            className="pressable-soft rounded-full border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent"
          >
            {copied ? "Kopirano" : "Podijeli"}
          </button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Dodaj pajdaša
        </h2>
        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="KOD"
            autoComplete="off"
            className="h-14 flex-1 rounded-field border border-white/10 bg-white/[0.05] px-4 text-center font-display text-xl uppercase tracking-[0.3em] outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]"
          />
          <button
            type="submit"
            disabled={addPending}
            className="pressable-soft h-14 shrink-0 rounded-button bg-accent px-6 font-display text-lg uppercase tracking-wide text-black disabled:opacity-50"
          >
            {addPending ? "..." : "Dodaj"}
          </button>
        </form>
      </section>

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
                <button
                  type="button"
                  onClick={() => handleSuggestion(s.id)}
                  disabled={sentTo.has(s.id)}
                  className="pressable-soft shrink-0 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-accent disabled:opacity-50"
                >
                  {sentTo.has(s.id) ? "Poslano" : "Dodaj"}
                </button>
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
