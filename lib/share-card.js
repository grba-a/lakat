"use client";

// Brandirana story kartica (1080×1920) iz dokazne slike — za IG/WhatsApp
// share. Svaka podijeljena slika je besplatna reklama: LAKAT. wordmark +
// laktarenje.com. Isti canvas obrazac kao Wrapped kartica.

const WIDTH = 1080;
const HEIGHT = 1920;

// next/font hashira ime fonta — pravo ime čitamo iz computed stylea
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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Supabase public storage šalje CORS *
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function buildShareCard({ url, caption }) {
  const img = await loadImage(url);

  const displayFamily = resolveFontFamily("font-display");
  const sansFamily = resolveFontFamily("font-sans");
  try {
    await Promise.all([
      document.fonts.load(`400 72px ${displayFamily}`),
      document.fonts.load(`700 34px ${sansFamily}`),
      document.fonts.ready,
    ]);
  } catch {
    // fallback fontovi su prihvatljivi
  }

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Pozadina: razmazana cover verzija slike (story feel), preko nje tama
  const coverScale = Math.max(WIDTH / img.width, HEIGHT / img.height);
  const cw = img.width * coverScale;
  const ch = img.height * coverScale;
  ctx.filter = "blur(60px)";
  ctx.drawImage(img, (WIDTH - cw) / 2, (HEIGHT - ch) / 2, cw, ch);
  ctx.filter = "none";
  ctx.fillStyle = "rgba(9,9,11,0.55)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Glavna slika: contain, centrirana, zaobljena
  const fitScale = Math.min((WIDTH - 120) / img.width, (HEIGHT - 560) / img.height);
  const fw = img.width * fitScale;
  const fh = img.height * fitScale;
  const fx = (WIDTH - fw) / 2;
  const fy = (HEIGHT - fh) / 2;
  const r = 48;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(fx, fy, fw, fh, r);
  ctx.clip();
  ctx.drawImage(img, fx, fy, fw, fh);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(fx, fy, fw, fh, r);
  ctx.stroke();

  // Wordmark gore lijevo
  ctx.textAlign = "left";
  ctx.font = `400 84px ${displayFamily}`;
  ctx.fillStyle = "#f4f4f5";
  ctx.fillText("LAKAT", 80, 170);
  const wordmarkW = ctx.measureText("LAKAT").width;
  ctx.fillStyle = "#4ade80";
  ctx.fillText(".", 80 + wordmarkW, 170);

  // Caption + domena dolje
  ctx.textAlign = "center";
  if (caption) {
    ctx.font = `700 34px ${sansFamily}`;
    ctx.fillStyle = "#f4f4f5";
    ctx.fillText(caption.toUpperCase(), WIDTH / 2, HEIGHT - 170);
  }
  ctx.font = `700 30px ${sansFamily}`;
  ctx.fillStyle = "#4ade80";
  ctx.fillText("LAKTARENJE.COM", WIDTH / 2, HEIGHT - 110);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.9
    );
  });
}

// Web Share s file fallbackom na download
export async function shareCard({ url, caption }) {
  const blob = await buildShareCard({ url, caption });
  const file = new File([blob], "lakat.jpg", { type: "image/jpeg" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch {
      return false; // korisnik odustao
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lakat.jpg";
  a.click();
  return true;
}
