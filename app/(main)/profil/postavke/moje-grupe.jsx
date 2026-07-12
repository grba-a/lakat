"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  joinGroup,
  createGroup,
  leaveGroup,
  renameGroup,
  changeGroupPassword,
  kickMember,
  makeAdmin,
  regenerateInviteCode,
} from "./grupe-actions";

const inputClass =
  "h-14 rounded-field border border-white/10 bg-white/[0.05] px-4 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted/50 focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]";

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

function SubmitButton({ isPending, children }) {
  return (
    <button
      type="submit"
      disabled={isPending}
      className="surface-2 pressable-soft h-14 w-full rounded-button font-display text-xl uppercase tracking-wide text-foreground disabled:opacity-50"
    >
      {isPending ? "Sekunda..." : children}
    </button>
  );
}

// Podijeli invite link grupe — native share s clipboard fallbackom.
// Skriven dok grupa nema kod (deploy prije SQL-a).
function ShareInviteButton({ inviteCode, groupName }) {
  const [copied, setCopied] = useState(false);

  if (!inviteCode) return null;

  async function handleShare() {
    const url = `${window.location.origin}/g/${inviteCode}`;
    const text = `Upadaj u grupu ${groupName} na Laktu. Šank te čeka.`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // korisnik odustao od sharea — ne padaj na clipboard
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="pressable-soft shrink-0 rounded-full border border-accent/25 bg-accent/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-accent"
    >
      {copied ? "Kopirano" : "Podijeli link"}
    </button>
  );
}

// Admin alati jedne grupe: preimenuj, promijeni šifru, invite link, članovi
function AdminTools({ group, myId, onAction }) {
  const [renameState, renameAction, renamePending] = useActionState(
    renameGroup.bind(null, group.id),
    null
  );
  const [pwState, pwAction, pwPending] = useActionState(
    changeGroupPassword.bind(null, group.id),
    null
  );
  const [confirmKick, setConfirmKick] = useState(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      {group.inviteCode && (
        <div className="flex items-center justify-between gap-2">
          <span className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-widest text-muted">
              Invite link
            </span>
            <span className="text-xs text-muted">
              Tko klikne, upada bez šifre.
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (confirmRegen) {
                setConfirmRegen(false);
                onAction(() => regenerateInviteCode(group.id));
              } else {
                setConfirmRegen(true);
              }
            }}
            className="pressable-soft shrink-0 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-danger"
          >
            {confirmRegen ? "Sigurno?" : "Poništi link"}
          </button>
        </div>
      )}

      <form action={renameAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Novi naziv grupe
          </span>
          <input
            type="text"
            name="name"
            required
            minLength={2}
            maxLength={32}
            defaultValue={group.name}
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <Msg state={renameState} />
        <SubmitButton isPending={renamePending}>Preimenuj</SubmitButton>
      </form>

      <form action={pwAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Nova šifra grupe
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={4}
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Ponovi šifru
          </span>
          <input
            type="password"
            name="confirm"
            required
            minLength={4}
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <Msg state={pwState} />
        <SubmitButton isPending={pwPending}>Promijeni šifru</SubmitButton>
      </form>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted">
          Članovi ({group.members.length})
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {group.members.map((m) => (
            <li
              key={m.id}
              className="flex min-h-10 items-center justify-between gap-2"
            >
              <span className="text-sm font-bold">
                {m.username}
                {m.role === "admin" && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-accent">
                    admin
                  </span>
                )}
              </span>
              {m.id !== myId && (
                <span className="flex shrink-0 gap-1.5">
                  {m.role !== "admin" && (
                    <button
                      type="button"
                      onClick={() => onAction(() => makeAdmin(group.id, m.id))}
                      className="pressable-soft rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-accent"
                    >
                      Daj admina
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmKick === m.id) {
                        setConfirmKick(null);
                        onAction(() => kickMember(group.id, m.id));
                      } else {
                        setConfirmKick(m.id);
                      }
                    }}
                    className="pressable-soft rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-danger"
                  >
                    {confirmKick === m.id ? "Sigurno?" : "Izbaci"}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GroupCard({ group, myId, onAction }) {
  const [confirmLeave, setConfirmLeave] = useState(false);

  return (
    <div className="rounded-card border border-white/10 bg-surface shadow-soft">
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <span className="flex flex-col">
          <span className="font-display text-xl uppercase tracking-wide">
            {group.name}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {group.role === "admin" ? "Ti si gazda" : "Član"} ·{" "}
            {group.members.length}{" "}
            {group.members.length === 1 ? "član" : "člana"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <ShareInviteButton
            inviteCode={group.inviteCode}
            groupName={group.name}
          />
          <button
            type="button"
            onClick={() => {
              if (confirmLeave) {
                setConfirmLeave(false);
                onAction(() => leaveGroup(group.id));
              } else {
                setConfirmLeave(true);
              }
            }}
            className="pressable-soft shrink-0 rounded-full border border-danger/30 bg-danger/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-danger"
          >
            {confirmLeave ? "Sigurno?" : "Napusti"}
          </button>
        </span>
      </div>

      {group.role === "admin" && (
        <details>
          <summary className="cursor-pointer list-none border-t border-white/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-accent/80">
            Upravljaj grupom
          </summary>
          <AdminTools group={group} myId={myId} onAction={onAction} />
        </details>
      )}
    </div>
  );
}

export default function MojeGrupe({ groups, myId }) {
  const router = useRouter();
  const [actionMsg, setActionMsg] = useState(null);
  const [, startTransition] = useTransition();
  const [joinState, joinAction, joinPending] = useActionState(joinGroup, null);
  const [createState, createAction, createPending] = useActionState(
    createGroup,
    null
  );

  // Zajednički kanal za gumb-akcije (napusti/izbaci/daj admina)
  function runAction(fn) {
    setActionMsg(null);
    startTransition(async () => {
      const result = await fn();
      setActionMsg(result ?? null);
      if (result?.ok) router.refresh();
    });
  }

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
        Moje grupe
      </h2>

      <div className="stagger mt-4 flex flex-col gap-3">
        {groups.map((group, i) => (
          <div key={group.id} style={{ "--stagger-i": i }}>
            <GroupCard group={group} myId={myId} onAction={runAction} />
          </div>
        ))}
      </div>

      {actionMsg && (
        <div className="mt-3">
          <Msg state={actionMsg} />
        </div>
      )}

      {groups.length >= 3 ? (
        <p className="mt-4 text-xs text-muted">
          Tri grupe su ti malo? Alkoholičaru.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <details className="rounded-card border border-white/10 bg-surface shadow-soft">
            <summary className="cursor-pointer list-none px-4 py-4 font-display text-xl uppercase tracking-wide text-muted">
              Pridruži se grupi
            </summary>
            <form action={joinAction} className="flex flex-col gap-4 px-4 pb-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Naziv grupe
                </span>
                <input
                  type="text"
                  name="groupName"
                  required
                  minLength={2}
                  maxLength={32}
                  autoComplete="off"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Šifra grupe
                </span>
                <input
                  type="password"
                  name="groupPassword"
                  required
                  autoComplete="off"
                  className={inputClass}
                />
              </label>
              <Msg state={joinState} />
              <SubmitButton isPending={joinPending}>Upadam</SubmitButton>
            </form>
          </details>

          <details className="rounded-card border border-white/10 bg-surface shadow-soft">
            <summary className="cursor-pointer list-none px-4 py-4 font-display text-xl uppercase tracking-wide text-muted">
              Osnuj novu grupu
            </summary>
            <form
              action={createAction}
              className="flex flex-col gap-4 px-4 pb-4"
            >
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Naziv grupe
                </span>
                <input
                  type="text"
                  name="groupName"
                  required
                  minLength={2}
                  maxLength={32}
                  autoComplete="off"
                  placeholder="npr. ime kafane"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Šifra grupe
                </span>
                <input
                  type="password"
                  name="groupPassword"
                  required
                  minLength={4}
                  autoComplete="off"
                  className={inputClass}
                />
                <span className="text-xs text-muted">
                  Nju daješ ekipi da upadne. Nemoj 1234, molim te.
                </span>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Ponovi šifru
                </span>
                <input
                  type="password"
                  name="groupConfirm"
                  required
                  minLength={4}
                  autoComplete="off"
                  className={inputClass}
                />
              </label>
              <Msg state={createState} />
              <SubmitButton isPending={createPending}>
                Osnivam grupu
              </SubmitButton>
            </form>
          </details>
        </div>
      )}
    </section>
  );
}
