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

// Smanji zadržavajući omjer — duža stranica na maxSide (dokazne slike)
export async function downscaleToBlob(file, maxSide, quality = 0.85) {
  const { img, url } = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return toBlob(canvas, quality);
}
