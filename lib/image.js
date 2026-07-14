// Client-side obrada slika prije uploada (canvas, bez dependencija)

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Slika se ne da učitati."));
    };
    img.src = url;
  });
}

function toBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Canvas nije izbacio sliku.")),
      "image/jpeg",
      quality
    );
  });
}

// Kvadratni cover-crop centra (avatari)
export async function squareCropToBlob(file, size, quality = 0.85) {
  const { img, url } = await loadImage(file);
  const s = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")
    .drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return toBlob(canvas, quality);
}

// Smanji zadržavajući omjer — duža stranica na maxSide (dokazne slike).
// Uz opcionalni overlay ({ text, y, fontFamily, color, plateColor, shadow })
// tekst se ispeče direktno u JPEG — isti crtež kao preview u photo-editoru.
export async function downscaleToBlob(file, maxSide, quality = 0.85, overlay = null) {
  const { img, url } = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (overlay) drawTextOverlay(ctx, canvas.width, canvas.height, overlay);
  URL.revokeObjectURL(url);
  return toBlob(canvas, quality);
}

// Crta tekst overlay na canvas — sve mjere su relativne širini (W) pa
// preview (mali canvas) i finalni bake (1024px) izgledaju identično.
// overlay: { text, y (0-1, središte bloka), fontFamily, color,
//            plateColor (null = bez pločice), shadow (bool) }
export function drawTextOverlay(ctx, W, H, overlay) {
  const text = overlay?.text?.trim();
  if (!text) return;

  const fontSize = Math.round(W * 0.065);
  const lineHeight = Math.round(fontSize * 1.3);
  const maxWidth = W * 0.86;
  ctx.font = `${fontSize}px ${overlay.fontFamily || "system-ui, sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Word-wrap po izmjerenoj širini; predugačke riječi ostaju u svom redu
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const probe = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(probe).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);

  // Blok centriran na overlay.y, ali cijeli mora stati u sliku
  const blockH = lines.length * lineHeight;
  const rawCenter = (overlay.y ?? 0.75) * H;
  const centerY = Math.min(
    Math.max(rawCenter, blockH / 2 + lineHeight / 2),
    H - blockH / 2 - lineHeight / 2
  );
  let y = centerY - blockH / 2 + lineHeight / 2;

  for (const l of lines) {
    if (overlay.plateColor) {
      const w = ctx.measureText(l).width;
      const padX = fontSize * 0.4;
      const plateW = w + padX * 2;
      const plateH = lineHeight;
      const r = fontSize * 0.22;
      ctx.fillStyle = overlay.plateColor;
      ctx.beginPath();
      ctx.roundRect(W / 2 - plateW / 2, y - plateH / 2, plateW, plateH, r);
      ctx.fill();
    }
    if (overlay.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = fontSize * 0.25;
      ctx.shadowOffsetY = fontSize * 0.04;
    }
    ctx.fillStyle = overlay.color || "#fff";
    ctx.fillText(l, W / 2, y);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    y += lineHeight;
  }
}
