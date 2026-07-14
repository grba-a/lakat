"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { downscaleToBlob } from "@/lib/image";
import { checkIn, logDrink, undoLastDrink } from "@/app/actions";
import { drinkInfo } from "@/lib/drinks";
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
  const [isPending, startTransition] = useTransition();
  const cameraRef = useRef(null);
  const geoRef = useRef(null); // promise pokrenut na klik, awaita se pri objavi
  const toastTimerRef = useRef(null);

  // Zatvorena kamera bez slike (podržano u novijim browserima) → ponudi
  // ulaz bez dokaza
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

  function openCamera() {
    setError(null);
    setAskPhoto(false);
    geoRef.current = requestLocation();
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

  async function submitCheckIn(photoUrl, thumbUrl) {
    const coords = await (geoRef.current ?? requestLocation());
    const result = await checkIn(
      photoUrl ?? undefined,
      thumbUrl ?? undefined,
      coords ?? undefined
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

  // Objava iz editora: bake teksta u sliku, upload u dokazi, checkin,
  // pa kolo pića
  function handleEditorPublish(overlay) {
    const file = editorFile;
    setEditorFile(null);
    if (!file) return;
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

        const ok = await submitCheckIn(data.publicUrl, thumbPublicUrl);
        if (ok) setWheelOpen(true);
      } catch {
        setError("Slika nije prošla. Probaj opet ili uđi bez dokaza ko pička.");
        setAskPhoto(true);
      } finally {
        setPublishing(false);
      }
    });
  }

  function handleNoPhoto() {
    setAskPhoto(false);
    setPublishing(true);
    startTransition(async () => {
      const ok = await submitCheckIn(null, null);
      setPublishing(false);
      if (ok) setWheelOpen(true);
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
              Bez slike nema dokaza da si stvarno za šankom.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={openCamera}
                disabled={isPending}
                className="pressable-soft flex h-12 flex-1 items-center justify-center rounded-button bg-accent font-display text-lg uppercase tracking-wide text-black disabled:opacity-50"
              >
                Ajde, slikam
              </button>
              <button
                type="button"
                onClick={handleNoPhoto}
                disabled={isPending}
                className="surface-2 pressable-soft flex h-12 flex-1 items-center justify-center rounded-button font-display text-lg uppercase tracking-wide text-muted disabled:opacity-50"
              >
                Nemam sliku
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
