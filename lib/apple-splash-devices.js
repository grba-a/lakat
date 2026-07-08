// iPhone rezolucije za apple-touch-startup-image (native iOS splash za
// instaliran PWA — pokriva crni ekran PRIJE HTML-a). Logičke (CSS) dimenzije
// + devicePixelRatio; fizička slika je w*dpr × h*dpr. Portrait only (app je
// portrait-first). Dijele je i generator skripta i <link> tagovi da ostanu
// usklađeni.
export const APPLE_SPLASH = [
  { w: 375, h: 667, dpr: 2 }, // SE 2/3, 8, 7, 6s
  { w: 414, h: 736, dpr: 3 }, // 8 Plus
  { w: 375, h: 812, dpr: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 414, h: 896, dpr: 2 }, // XR, 11
  { w: 414, h: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { w: 390, h: 844, dpr: 3 }, // 12, 13, 14, 12/13 Pro
  { w: 428, h: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 393, h: 852, dpr: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 430, h: 932, dpr: 3 }, // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { w: 402, h: 874, dpr: 3 }, // 16 Pro
  { w: 440, h: 956, dpr: 3 }, // 16 Pro Max
];
