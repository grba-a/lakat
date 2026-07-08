// Generira iOS splash slike (crna pozadina + centrirana zelena ikona) za sve
// iPhone rezolucije iz lib/apple-splash-devices.js.
// Pokreni: node scripts/make-splash.mjs (koristi sharp iz node_modules).
import sharp from "sharp";
import fs from "node:fs";
import { APPLE_SPLASH } from "../lib/apple-splash-devices.js";

const ICON = "public/icon-512.png"; // zaobljena zelena ikona na crnoj
const OUT_DIR = "public/splash";
const BG = "#09090b"; // isti kao manifest.background_color

fs.mkdirSync(OUT_DIR, { recursive: true });
const iconBuf = fs.readFileSync(ICON);

for (const { w, h, dpr } of APPLE_SPLASH) {
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  const iconPx = Math.round(Math.min(pw, ph) * 0.28);
  const icon = await sharp(iconBuf).resize(iconPx, iconPx).png().toBuffer();
  const out = `${OUT_DIR}/apple-splash-${pw}-${ph}.png`;
  await sharp({
    create: { width: pw, height: ph, channels: 4, background: BG },
  })
    .composite([{ input: icon, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("→", out);
}

console.log(`Generirano ${APPLE_SPLASH.length} splash slika.`);
