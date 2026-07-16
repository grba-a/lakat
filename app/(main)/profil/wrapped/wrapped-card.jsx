"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 1080;
const HEIGHT = 1920;

// next/font hashira ime fonta — pravo ime čitamo iz computed stylea
// skrivenog elementa umjesto da ga hardkodiramo.
function resolveFontFamily(className) {
  const el = document.createElement("span");
  el.className = className;
  el.style.position = "absolute";
  el.style.visibility = "hidden";
  document.body.appendChild(el);
  const family = getComputedStyle(el).fontFamily;
  document.body.removeChild(el);
  return family;
}

export default function WrappedCard({
  username,
  monthLabel,
  groupName,
  days,
  rank,
  total,
  streak,
  isWinner,
}) {
  const canvasRef = useRef(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [blob, setBlob] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext("2d");

      const displayFamily = resolveFontFamily("font-display");
      const sansFamily = resolveFontFamily("font-sans");
      try {
        await Promise.all([
          document.fonts.load(`400 200px ${displayFamily}`),
          document.fonts.load(`700 40px ${sansFamily}`),
          document.fonts.ready,
        ]);
      } catch {
        // fallback fontovi su prihvatljiv ishod, ne blokiraj crtanje
      }
      if (cancelled) return;

      const accent = "#4ade80";
      const fg = "#f4f4f5";
      const muted = "#8b8b94";

      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      const glow = ctx.createRadialGradient(
        WIDTH * 0.15,
        HEIGHT * 0.06,
        0,
        WIDTH * 0.15,
        HEIGHT * 0.06,
        WIDTH
      );
      glow.addColorStop(0, "rgba(74,222,128,0.18)");
      glow.addColorStop(1, "rgba(74,222,128,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.textAlign = "left";

      ctx.font = `400 60px ${displayFamily}`;
      ctx.fillStyle = fg;
      ctx.fillText("LAKAT", 80, 150);
      const wordmarkW = ctx.measureText("LAKAT").width;
      ctx.fillStyle = accent;
      ctx.fillText(".", 80 + wordmarkW, 150);

      ctx.font = `700 34px ${sansFamily}`;
      ctx.fillStyle = muted;
      ctx.fillText(monthLabel.toUpperCase(), 80, 210);

      ctx.font = `400 420px ${displayFamily}`;
      ctx.fillStyle = accent;
      ctx.fillText(String(days), 76, 660);

      ctx.font = `700 42px ${sansFamily}`;
      ctx.fillStyle = fg;
      ctx.fillText("DOLAZAKA", 80, 730);

      const rankY = 880;
      ctx.font = `400 96px ${displayFamily}`;
      ctx.fillStyle = fg;
      ctx.fillText(`#${rank}`, 80, rankY);
      ctx.font = `700 30px ${sansFamily}`;
      ctx.fillStyle = muted;
      ctx.fillText(`OD ${total} U GRUPI "${groupName.toUpperCase()}"`, 80, rankY + 46);

      const streakY = rankY + 200;
      ctx.font = `400 96px ${displayFamily}`;
      ctx.fillStyle = fg;
      ctx.fillText(String(streak), 80, streakY);
      ctx.font = `700 30px ${sansFamily}`;
      ctx.fillStyle = muted;
      ctx.fillText("NAJDULJI STREAK U MJESECU", 80, streakY + 46);

      if (isWinner) {
        const badgeY = streakY + 220;
        ctx.font = `400 66px ${displayFamily}`;
        ctx.fillStyle = accent;
        ctx.fillText("INVENTAR MJESECA", 80, badgeY);
        ctx.font = `56px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.fillText("🏆", 80, badgeY + 90);
      }

      ctx.textAlign = "center";
      ctx.font = `700 32px ${sansFamily}`;
      ctx.fillStyle = fg;
      ctx.fillText(username.toUpperCase(), WIDTH / 2, HEIGHT - 140);
      ctx.font = `700 26px ${sansFamily}`;
      ctx.fillStyle = accent;
      ctx.fillText("LAKTARENJE.COM", WIDTH / 2, HEIGHT - 90);

      canvas.toBlob((b) => {
        if (cancelled || !b) return;
        setBlob(b);
        setImgUrl(URL.createObjectURL(b));
      }, "image/png");
    }

    draw();
    return () => {
      cancelled = true;
    };
  }, [username, monthLabel, groupName, days, rank, total, streak, isWinner]);

  async function handleShare() {
    if (!blob) return;
    const file = new File([blob], `lakat-wrapped-${monthLabel}.png`, {
      type: "image/png",
    });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: "Moj Lakat Wrapped." });
      } catch {
        // korisnik odustao — ništa za napraviti
      }
      return;
    }
    handleDownload();
  }

  function handleDownload() {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `lakat-wrapped-${monthLabel}.png`;
    a.click();
  }

  return (
    <div className="mt-6 flex flex-col items-center">
      <canvas ref={canvasRef} className="hidden" />
      <div
        className="w-full max-w-[320px] overflow-hidden rounded-card border border-white/10 shadow-soft"
        style={{ aspectRatio: "9 / 16" }}
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt="Lakat Wrapped kartica"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted">
            Crtam štetu...
          </div>
        )}
      </div>

      <div className="mt-6 flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={handleShare}
          disabled={!blob}
          className="pressable-soft h-16 w-full rounded-button bg-accent font-display text-2xl uppercase tracking-wide text-black shadow-glow disabled:opacity-50"
        >
          Podijeli
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!blob}
          className="pressable-soft h-14 w-full rounded-button border border-white/10 bg-white/[0.05] font-display text-xl uppercase tracking-wide text-foreground disabled:opacity-50"
        >
          Skini sliku
        </button>
      </div>
    </div>
  );
}
