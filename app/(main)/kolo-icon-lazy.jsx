"use client";

import dynamic from "next/dynamic";

// Kolo (drag fizika + SVG) ide u zaseban chunk umjesto u bundle svake
// stranice — učitava se tek na klijentu, kad i header
const KoloIcon = dynamic(() => import("./kolo-icon"), { ssr: false });

export default function KoloIconLazy(props) {
  return <KoloIcon {...props} />;
}
