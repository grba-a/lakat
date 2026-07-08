import { Anton, Archivo } from "next/font/google";
import SwRegister from "./sw-register";
import BootSplash from "./boot-splash";
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

export const metadata = {
  title: "Lakat",
  description: "Tko je za šankom, a tko je pička. Uživo.",
  appleWebApp: {
    capable: true,
    title: "Lakat",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#09090b",
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
