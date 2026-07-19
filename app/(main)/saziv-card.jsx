"use client";

import { useState, useTransition } from "react";
import { digniEkipu, odazoviSe, otkaziSaziv } from "@/app/actions";
import Avatar from "./avatar";
import BrandPunct from "@/app/brand-punct";

const timeFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

// "20:30" s time inputa → ISO; vrijeme koje je već prošlo znači sutra
// (saziv u 23:50 za 00:30). Device tz = HR za naše korisnike.
function timeToIso(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() < Date.now() - 60_000) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

// 3.0: gumb + sklopiva forma za dizanje MOG poziva (max 1 živi po
// kreatoru — guard je u akciji). Živi pozivi frendova su SazivCard stack.
export function SazivComposer({ currentUserId, onSazivCreated, onError }) {
  const [open, setOpen] = useState(false);
  const [mjesto, setMjesto] = useState("");
  const [kadMode, setKadMode] = useState("sad"); // "sad" | "kasnije"
  const [kadTime, setKadTime] = useState("21:00");
  const [isPending, startTransition] = useTransition();

  function handleDigni() {
    const atIso = kadMode === "sad" ? new Date().toISOString() : timeToIso(kadTime);
    onError(null);
    startTransition(async () => {
      const result = await digniEkipu(mjesto, atIso);
      if (result?.error) {
        onError(result.error);
        return;
      }
      setOpen(false);
      setMjesto("");
      onSazivCreated({
        id: result.sazivId ?? `tmp-saziv-${currentUserId}`,
        created_by: currentUserId,
        place_text: mjesto.trim(),
        at_time: atIso,
        created_at: new Date().toISOString(),
      });
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable mt-4 flex w-full items-center justify-between rounded-card border border-accent/30 bg-accent/[0.08] px-4 py-3 text-left"
      >
        <span className="flex flex-col">
          <span className="font-display text-lg uppercase tracking-wide text-accent">
            📣 Poziv na laktanje
          </span>
          <span className="text-xs text-muted">
            Digni sve pajdaše odjednom. Mjesto, vrijeme, gotovo.
          </span>
        </span>
        <span className="text-2xl text-accent">›</span>
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-card border border-accent/30 bg-accent/[0.08] px-4 py-4">
      <p className="font-display text-lg uppercase tracking-wide text-accent">
        📣 Poziv na laktanje
      </p>
      <label className="mt-3 block">
        <span className="text-xs font-bold uppercase tracking-widest text-muted">
          Gdje?
        </span>
        <input
          type="text"
          value={mjesto}
          onChange={(e) => setMjesto(e.target.value)}
          maxLength={40}
          placeholder="Club23, plaža, kod mene..."
          className="mt-1 w-full rounded-field border border-white/15 bg-black/30 px-3 py-3 text-sm font-bold placeholder:font-normal placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
        />
      </label>
      <div className="mt-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted">
          Kad?
        </span>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setKadMode("sad")}
            className={`pressable rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide ${
              kadMode === "sad"
                ? "border-accent bg-accent/20 text-accent"
                : "border-white/15 text-muted"
            }`}
          >
            Sad
          </button>
          <button
            type="button"
            onClick={() => setKadMode("kasnije")}
            className={`pressable rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide ${
              kadMode === "kasnije"
                ? "border-accent bg-accent/20 text-accent"
                : "border-white/15 text-muted"
            }`}
          >
            U...
          </button>
          {kadMode === "kasnije" && (
            <input
              type="time"
              value={kadTime}
              onChange={(e) => setKadTime(e.target.value)}
              className="rounded-field border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold focus:border-accent/60 focus:outline-none"
            />
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleDigni}
          disabled={isPending || !mjesto.trim()}
          className="pressable flex-1 rounded-button bg-accent px-4 py-3 font-display text-lg uppercase tracking-wide text-black disabled:opacity-50"
        >
          {isPending ? "Sekunda..." : "Zovi narod 📣"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="pressable rounded-button border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted"
        >
          Odustani
        </button>
      </div>
    </div>
  );
}

// Jedan živi poziv (moj ili frendov) u stacku na vrhu Šanka
export default function SazivCard({
  saziv,
  odazivi,
  profileById,
  currentUserId,
  now,
  onOdaziv,
  onSazivGone,
  onError,
}) {
  const [isPending, startTransition] = useTransition();

  function handleOdaziv(status) {
    onError(null);
    onOdaziv(currentUserId, saziv.id, status);
    startTransition(async () => {
      const result = await odazoviSe(saziv.id, status);
      if (result?.error) onError(result.error);
    });
  }

  function handleOtkazi() {
    onError(null);
    startTransition(async () => {
      const result = await otkaziSaziv(saziv.id);
      if (result?.error) {
        onError(result.error);
        return;
      }
      onSazivGone(saziv.id);
    });
  }

  const creator = profileById.get(saziv.created_by);
  const stizu = odazivi.filter((o) => o.status === "stizem");
  const neMogu = odazivi.filter((o) => o.status === "ne_mogu");
  const myStatus = odazivi.find((o) => o.user_id === currentUserId)?.status ?? null;
  const atMs = new Date(saziv.at_time).getTime();
  const jeSada = atMs <= now;
  const minDo = Math.max(0, Math.round((atMs - now) / 60_000));
  const kadLabel = jeSada
    ? "SADA"
    : `u ${timeFmt.format(new Date(saziv.at_time))}${
        minDo < 600
          ? ` · za ${minDo >= 60 ? `${Math.floor(minDo / 60)}h ${minDo % 60}min` : `${minDo}min`}`
          : ""
      }`;

  return (
    <div className="mt-3 rounded-card border border-accent/40 bg-accent/[0.1] px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
            📣 {creator?.username ?? "Netko"} zove na laktanje
          </p>
          <p className="mt-0.5 truncate font-display text-2xl uppercase tracking-wide">
            <BrandPunct>{saziv.place_text}</BrandPunct>
          </p>
          <p className="text-sm font-bold uppercase tracking-widest text-accent">
            {kadLabel}
          </p>
        </div>
        {saziv.created_by === currentUserId && (
          <button
            type="button"
            onClick={handleOtkazi}
            disabled={isPending}
            className="pressable shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted disabled:opacity-50"
          >
            Spusti
          </button>
        )}
      </div>

      {(stizu.length > 0 || neMogu.length > 0) && (
        <div className="mt-3 flex flex-col gap-1 text-xs">
          {stizu.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="flex -space-x-2">
                {stizu.slice(0, 6).map((o) => {
                  const p = profileById.get(o.user_id);
                  return (
                    <Avatar
                      key={o.user_id}
                      username={p?.username ?? "?"}
                      avatarUrl={p?.avatar_url}
                      size={22}
                      className="border-accent/50"
                    />
                  );
                })}
              </span>
              <span className="font-bold text-accent">
                ✓ {stizu.length}{" "}
                {stizu.length === 1
                  ? "stiže"
                  : stizu.length <= 4
                    ? "stižu"
                    : "stiže"}
              </span>
            </div>
          )}
          {neMogu.length > 0 && (
            <span className="text-muted">
              ✗ {neMogu.length} ne može. Izlike, izlike.
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => handleOdaziv("stizem")}
          disabled={isPending || myStatus === "stizem"}
          className={`pressable flex-1 rounded-button px-4 py-3 text-sm font-bold uppercase tracking-wide ${
            myStatus === "stizem"
              ? "bg-accent text-black"
              : "border border-accent/40 bg-accent/10 text-accent"
          } disabled:opacity-80`}
        >
          ✓ Stižem
        </button>
        <button
          type="button"
          onClick={() => handleOdaziv("ne_mogu")}
          disabled={isPending || myStatus === "ne_mogu"}
          className={`pressable flex-1 rounded-button px-4 py-3 text-sm font-bold uppercase tracking-wide ${
            myStatus === "ne_mogu"
              ? "bg-white/20 text-foreground"
              : "border border-white/15 text-muted"
          } disabled:opacity-80`}
        >
          ✗ Ne mogu
        </button>
      </div>
    </div>
  );
}
