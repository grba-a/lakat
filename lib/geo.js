// Geo helperi za zajednički kadar — bez server-only importa, koristi ga
// i klijent (runda-flow picker) i server (checkIn validacija).

// Kadar je STROGO lokacijski: tagati se može samo ekipa čija je zadnja
// runda unutar ovog radijusa od autora
export const KADAR_RADIUS_M = 500;

const EARTH_R_M = 6371000;

// Udaljenost dviju točaka {lat, lng} u metrima (haversine) — za radijus
// od 500 m više nego dovoljno točno
export function distanceM(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_M * Math.asin(Math.sqrt(s));
}
