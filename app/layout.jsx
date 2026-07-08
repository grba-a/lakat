import { Anton, Archivo } from "next/font/google";
import SwRegister from "./sw-register";
import BootSplash from "./boot-splash";
import { APPLE_SPLASH } from "@/lib/apple-splash-devices";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-anton",
});

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-archivo",
});

// iOS native splash za instaliran PWA (pokriva crni ekran prije HTML-a).
// Next stavlja apple-touch-startup-image <link> tagove u <head>.
const startupImage = APPLE_SPLASH.map(({ w, h, dpr }) => {
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  return {
    url: `/splash/apple-splash-${pw}-${ph}.png`,
    media: `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
  };
});

export const metadata = {
  title: "Lakat",
  description: "Tko je za šankom, a tko je pička. Uživo.",
  appleWebApp: {
    capable: true,
    title: "Lakat",
    statusBarStyle: "black-translucent",
    startupImage,
  },
  // Next 16 emitira samo standardni "mobile-web-app-capable"; stariji iOS i
  // mehanizam za apple-touch-startup-image i dalje traže apple-prefiks.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="hr" className={`${anton.variable} ${archivo.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <BootSplash />
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
