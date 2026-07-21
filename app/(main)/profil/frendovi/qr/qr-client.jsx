"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { qrDataUrl } from "@/lib/qr";
import QrScanner from "../qr-scanner";
import { sendFriendRequest } from "../actions";

function Msg({ state }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p className="mt-4 rounded-card border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-bold text-accent">
        {state.message}
      </p>
    );
  }
  return null;
}

export default function QrClient({ myCode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  // QR vlastitog koda (enkodira /f/CODE link — istu metu ko Podijeli)
  useEffect(() => {
    if (!myCode) return;
    let alive = true;
    const url = `${window.location.origin}/f/${myCode}`;
    qrDataUrl(url)
      .then((data) => {
        if (alive) setQr(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [myCode]);

  async function handleShare() {
    if (!myCode) return;
    const shareUrl = `${window.location.origin}/f/${myCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Lakat",
          text: "Dodaj me na Laktu",
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

  // Skener uhvatio kod → pošalji zahtjev (bez uvjeta zajedničkog pajdaša)
  function handleDetected(scannedCode) {
    setScanOpen(false);
    setActionMsg(null);
    startTransition(async () => {
      const result = await sendFriendRequest(scannedCode);
      setActionMsg(result ?? null);
      if (result?.ok) router.refresh();
    });
  }

  return (
    <>
      <section className="mt-8">
        <div className="glass flex flex-col items-center rounded-card p-5">
          <div className="flex h-[200px] w-[200px] items-center justify-center overflow-hidden rounded-2xl bg-white p-3">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Moj QR kod" width={200} height={200} className="h-full w-full" />
            ) : (
              <span className="font-display text-2xl tracking-[0.2em] text-black/80">
                {myCode ?? "······"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="pressable-soft mt-5 rounded-full border border-accent/25 bg-accent/10 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-accent"
          >
            {copied ? "Kopirano" : "Podijeli link"}
          </button>
          <p className="mt-3 text-center text-xs text-muted">
            Pokaži pajdašu da skenira — ili podijeli link.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Skeniraj pajdaša
        </h2>
        <button
          type="button"
          onClick={() => {
            setActionMsg(null);
            setScanOpen(true);
          }}
          className="pressable-soft mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-button bg-accent font-display text-lg uppercase tracking-wide text-black"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M7 12h10" />
          </svg>
          Skeniraj QR
        </button>
      </section>

      <Msg state={actionMsg} />

      {scanOpen && (
        <QrScanner onDetected={handleDetected} onClose={() => setScanOpen(false)} />
      )}
    </>
  );
}
