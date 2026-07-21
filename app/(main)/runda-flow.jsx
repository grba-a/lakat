"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { downscaleToBlob } from "@/lib/image";
import { getCurrentDayStart } from "@/lib/day";
import { checkIn, logDrink, undoLastDrink } from "@/app/actions";
import { drinkInfo } from "@/lib/drinks";
import { distanceM, KADAR_RADIUS_M } from "@/lib/geo";
import Avatar from "./avatar";
import PhotoEditor from "./photo-editor";
import Omnitrix from "./omnitrix";
import BadgeToast from "./badge-toast";
import PlusButton from "./plus-button";

const PHOTO_MAX_SIDE = 1024;
const THUMB_MAX_SIDE = 320;
const DRINK_TOAST_MS = 8000;
const ERROR_TOAST_MS = 6000;

// Cijeli flow "nove runde", dostupan sa svakog ekrana kroz plus u navbaru:
// kamera → editor (pregled + tekst) → objava (prva runda dana = check-in s
// pushom grupi, svaka sljedeća samo nova slika — server odlučuje) → omnitrix
// kolo pića → toast s undo gumbom. Bez optimističkih redova: Šank novi red
// dobije postojećim realtime kanalom, ostali ekrani nemaju listu.
export default function RundaFlow({ userId }) {
  const [editorFile, setEditorFile] = useState(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [askPhoto, setAskPhoto] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [drinkToast, setDrinkToast] = useState(null); // drink key
  const [badgeQueue, setBadgeQueue] = useState([]);
  // Zajednički kadar: { file, overlay, options } dok korisnik bira tko je
  // na slici; kadarIds = trenutno označeni
  const [kadarAsk, setKadarAsk] = useState(null);
  const [kadarIds, setKadarIds] = useState([]);
  const [isPending, startTransition] = useTransition();
  const cameraRef = useRef(null);
  const geoRef = useRef(null); // promise pokrenut na klik, awaita se pri objavi
  const presentRef = useRef(null); // tko je danas prisutan — za kadar picker
  const toastTimerRef = useRef(null);

  // Zatvorena kamera bez slike (podržano u novijim browserima) → podsjeti
  // da je slika obavezna (nema objave bez dokaza)
  useEffect(() => {
    const input = cameraRef.current;
    if (!input) return;
    const onCancel = () => setAskPhoto(true);
    input.addEventListener("cancel", onCancel);
    return () => input.removeEventListener("cancel", onCancel);
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  // Greška se sama makne — flow je globalan pa ne smije trajno visjeti
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), ERROR_TOAST_MS);
    return () => clearTimeout(t);
  }, [error]);

  // Lokacija se traži paralelno s kamerom; odbijena/spora lokacija ne
  // blokira objavu (slika je dokaz, lokacija je bonus za mapu)
  function requestLocation() {
    if (!("geolocation" in navigator)) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 60_000 }
      );
    });
  }

  // Danas prisutni FRENDOVI (bez mene) — kandidati za zajednički kadar.
  // RLS na checkins ionako vraća samo moje + frendovske runde, pa je
  // dovoljno povući današnje s koordinatama. STROGO lokacijski: broji se
  // samo najnovija runda S koordinatama, tko je nema ne nudi se u pickeru
  // (filter po radijusu je u handleEditorPublish kad stigne moja lokacija).
  // Bilo kakva greška = prazan popis (kadar je bonus, objava ne ovisi o njemu)
  async function fetchPresentOthers() {
    try {
      const supabase = createClient();
      const { data: rows } = await supabase
        .from("checkins")
        .select("user_id, lat, lng")
        .is("cancelled_at", null)
        .gte("checked_in_at", getCurrentDayStart().toISOString())
        .order("checked_in_at", { ascending: false });
      // rows su desc — prvi red po korisniku je njegova najnovija runda s koordinatama
      const lastCoords = new Map();
      for (const r of rows ?? []) {
        if (r.user_id === userId || r.lat == null || r.lng == null) continue;
        if (!lastCoords.has(r.user_id)) lastCoords.set(r.user_id, r);
      }
      if (!lastCoords.size) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", [...lastCoords.keys()]);
      return (profiles ?? []).map((p) => ({
        ...p,
        lat: lastCoords.get(p.id).lat,
        lng: lastCoords.get(p.id).lng,
      }));
    } catch {
      return [];
    }
  }

  function openCamera() {
    setError(null);
    setAskPhoto(false);
    geoRef.current = requestLocation();
    presentRef.current = fetchPresentOthers();
    cameraRef.current?.click();
  }

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      setAskPhoto(true);
      return;
    }
    setEditorFile(file);
  }

  async function submitCheckIn(photoUrl, thumbUrl, ids = []) {
    const coords = await (geoRef.current ?? requestLocation());
    const result = await checkIn(
      photoUrl ?? undefined,
      thumbUrl ?? undefined,
      coords ?? undefined,
      ids.length ? ids : undefined
    );
    if (result?.error) {
      setError(result.error);
      return false;
    }
    if (result?.newBadges?.length) {
      setBadgeQueue((prev) => [...prev, ...result.newBadges]);
    }
    return true;
  }

  // Objava iz editora: ako je netko prisutan UNUTAR radijusa, prvo kratki
  // kadar picker ("tko je na slici?"); inače ravno u upload — solo runda
  // bez ijednog dodatnog klika. STROGO: bez moje lokacije nema pickera.
  function handleEditorPublish(overlay) {
    const file = editorFile;
    setEditorFile(null);
    if (!file) return;
    startTransition(async () => {
      const [candidates, coords] = await Promise.all([
        presentRef.current ?? Promise.resolve([]),
        geoRef.current ?? requestLocation(),
      ]);
      const options = coords
        ? candidates.filter((p) => distanceM(coords, p) <= KADAR_RADIUS_M)
        : [];
      if (options.length) {
        setKadarIds([]);
        setKadarAsk({ file, overlay, options });
        return;
      }
      doPublish(file, overlay, []);
    });
  }

  // Bake teksta u sliku, upload u dokazi, checkin (s kadrom), pa kolo pića
  function doPublish(file, overlay, ids) {
    setPublishing(true);
    startTransition(async () => {
      try {
        // Thumb se radi iz već pečenog bloba da i on nosi tekst
        const blob = await downscaleToBlob(file, PHOTO_MAX_SIDE, 0.85, overlay);
        const thumbBlob = await downscaleToBlob(blob, THUMB_MAX_SIDE, 0.8);

        const supabase = createClient();
        const ts = Date.now();
        const path = `${userId}/${ts}.jpg`;
        const thumbPath = `${userId}/${ts}_thumb.jpg`;
        const [{ error: uploadError }, { error: thumbUploadError }] =
          await Promise.all([
            supabase.storage
              .from("dokazi")
              .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" }),
            supabase.storage
              .from("dokazi")
              .upload(thumbPath, thumbBlob, {
                contentType: "image/jpeg",
                cacheControl: "31536000",
              }),
          ]);
        if (uploadError) throw new Error(uploadError.message);
        const { data } = supabase.storage.from("dokazi").getPublicUrl(path);
        const thumbPublicUrl = thumbUploadError
          ? null
          : supabase.storage.from("dokazi").getPublicUrl(thumbPath).data.publicUrl;

        const ok = await submitCheckIn(data.publicUrl, thumbPublicUrl, ids);
        if (ok) setWheelOpen(true);
      } catch {
        setError("Slika nije prošla. Probaj opet, bez dokaza nema šanka.");
        setAskPhoto(true);
      } finally {
        setPublishing(false);
      }
    });
  }

  function handleConfirmDrink(drinkKey) {
    setWheelOpen(false);
    startTransition(async () => {
      const result = await logDrink(drinkKey);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.newBadges?.length) {
        setBadgeQueue((prev) => [...prev, ...result.newBadges]);
      }
      setDrinkToast(drinkKey);
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setDrinkToast(null), DRINK_TOAST_MS);
    });
  }

  // Krivi tap — bez optimizma, realtime DELETE povuče brojače na Šanku
  function handleUndoDrink() {
    clearTimeout(toastTimerRef.current);
    setDrinkToast(null);
    startTransition(async () => {
      const result = await undoLastDrink();
      if (result?.error) setError(result.error);
    });
  }

  const toastDrink = drinkInfo(drinkToast);

  // Overlayi idu portalom u <body>: komponenta živi u navbaru čiji
  // glass-nav ima backdrop-filter, a taj je containing block za fixed
  // potomke — bez portala bi se editor/kolo renderirali UNUTAR pilule
  return (
    <>
      <PlusButton onClick={openCamera} disabled={publishing} />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhoto}
        className="hidden"
      />

      {createPortal(overlays(), document.body)}
    </>
  );

  function overlays() {
    return (
    <>
      <BadgeToast
        queue={badgeQueue}
        onDone={(key) =>
          setBadgeQueue((prev) => prev.filter((b) => b.key !== key))
        }
      />

      {editorFile && (
        <PhotoEditor
          file={editorFile}
          onPublish={handleEditorPublish}
          onRetake={() => {
            setEditorFile(null);
            openCamera();
          }}
          onCancel={() => setEditorFile(null)}
        />
      )}

      {wheelOpen && (
        <Omnitrix
          pending={isPending}
          onConfirm={handleConfirmDrink}
          onClose={() => setWheelOpen(false)}
        />
      )}

      {kadarAsk && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-5 pb-28">
          <div className="w-full max-w-sm rounded-card border border-white/10 bg-[#131316] p-4">
            <p className="text-sm font-bold">Tko je s tobom u kadru? 👥</p>
            <p className="mt-1 text-xs text-muted">
              Zajednički kadar nosi +4 boda u ligi. Označi pa objavi.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {kadarAsk.options.map((p) => {
                const on = kadarIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setKadarIds((prev) =>
                        on ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                      )
                    }
                    className={`pressable flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-bold ${
                      on
                        ? "border-accent bg-accent/20 text-accent"
                        : "border-white/15 text-muted"
                    }`}
                  >
                    <Avatar
                      username={p.username ?? "?"}
                      avatarUrl={p.avatar_url}
                      size={24}
                      className={on ? "border-accent/50" : ""}
                    />
                    {p.username}
                    {on && " ✓"}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                const { file, overlay } = kadarAsk;
                const ids = kadarIds;
                setKadarAsk(null);
                doPublish(file, overlay, ids);
              }}
              disabled={isPending}
              className="pressable-soft mt-4 flex h-12 w-full items-center justify-center rounded-button bg-accent font-display text-lg uppercase tracking-wide text-black disabled:opacity-50"
            >
              {kadarIds.length
                ? `Objavi (${kadarIds.length + 1} u kadru) 👥`
                : "Sam sam na slici, objavi"}
            </button>
          </div>
        </div>
      )}

      {askPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-5 pb-28"
          onClick={() => setAskPhoto(false)}
        >
          <div
            className="w-full max-w-sm rounded-card border border-white/10 bg-[#131316] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-danger">
              Slikaj nam gdje si smrade.
            </p>
            <p className="mt-1 text-xs text-muted">
              Bez slike nema objave — dokaz da si stvarno za šankom je obavezan.
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={openCamera}
                disabled={isPending}
                className="pressable-soft flex h-12 w-full items-center justify-center rounded-button bg-accent font-display text-lg uppercase tracking-wide text-black disabled:opacity-50"
              >
                Ajde, slikam
              </button>
            </div>
          </div>
        </div>
      )}

      {publishing && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[55] flex justify-center px-5">
          <p className="rounded-full border border-white/10 bg-[#131316] px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted">
            Objavljujem...
          </p>
        </div>
      )}

      {toastDrink && !publishing && (
        <div className="fixed inset-x-0 bottom-28 z-[55] flex justify-center px-5">
          <div className="flex items-center gap-3 rounded-full border border-accent/30 bg-[#131316] py-2 pl-4 pr-2 shadow-glow">
            <span className="text-sm font-bold">
              Zapisano: {toastDrink.emoji} {toastDrink.label}
            </span>
            <button
              type="button"
              onClick={handleUndoDrink}
              className="pressable rounded-full bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wide"
            >
              ↩ Krivi tap
            </button>
          </div>
        </div>
      )}

      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          className="fixed inset-x-5 bottom-28 z-[55] mx-auto max-w-sm rounded-card border border-danger/30 bg-[#131316] px-4 py-3 text-left text-sm font-bold text-danger"
        >
          {error}
        </button>
      )}
    </>
    );
  }
}
