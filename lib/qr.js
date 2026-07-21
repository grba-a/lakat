import QRCode from "qrcode";

// QR kao data URL (PNG) za prikaz vlastitog koda. Tamni moduli na bijeloj
// podlozi — QR se najpouzdanije skenira s tamnim modulom na svijetlom, pa
// bijela kartica ispod ostaje čak i u tamnoj temi (kontrast > estetika).
export function qrDataUrl(text) {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
    color: { dark: "#09090b", light: "#ffffff" },
  });
}
