// Generira sve ikone iz postojećeg artworka (zeleni L na crnoj).
// Pokreni: node scripts/make-icons.mjs (koristi sharp iz node_modules, bez novih depsa)
//
// - app/icon.png            96px, iOS zaobljen — favicon (Next konvencija)
// - public/icon-192.png     192px, iOS zaobljen — manifest "any"
// - public/icon-512.png     512px, iOS zaobljen — manifest "any"
// - public/icon-maskable-512.png  512px, PUNI kvadrat — manifest "maskable"
//   (Android sam reže svoju masku; zaobljeni izvor bi se duplo rezao)
// - app/apple-icon.png      180px, PUNI kvadrat — iOS sam zaobljuje home ikonu
import sharp from "sharp";
import fs from "node:fs";

// Izvor istine je netaknuti puni kvadrat. Nakon prvog runa icon-512.png
// postaje zaobljen, pa se dalje čita icon-maskable-512.png (idempotentno).
const SQUARE = fs.existsSync("public/icon-maskable-512.png")
  ? "public/icon-maskable-512.png"
  : "public/icon-512.png";
const src = fs.readFileSync(SQUARE);

function roundedMask(size) {
  const r = Math.round(size * 0.2237); // aproksimacija iOS superelipse
  return Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`
  );
}

async function rounded(size, out) {
  await sharp(src)
    .resize(size, size)
    .composite([{ input: roundedMask(size), blend: "dest-in" }])
    .png()
    .toFile(out);
}

// 1. Prvo spremi pune kvadrate (icon-512.png je vlastiti izvor na prvom runu!)
await sharp(src).resize(512, 512).png().toFile("public/icon-maskable-512.png");
await sharp(src).resize(180, 180).png().toFile("app/apple-icon.png");

// 2. Zaobljene verzije
await rounded(512, "public/icon-512.png");
await rounded(192, "public/icon-192.png");
await rounded(96, "app/icon.png");

console.log("Ikone generirane.");
