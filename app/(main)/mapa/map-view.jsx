"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Club23, Srebreno — default centar dok nema markera
const HOME = [42.6215, 18.1996];

export default function MapView({ markers }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: false });
    // Tamni tile-ovi (CARTO) da se karta uklapa u temu aplikacije
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    map.setView(HOME, 15);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    for (const m of markers) {
      const icon = L.divIcon({
        html: `<div style="font-size:26px;line-height:36px;text-align:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6))">${m.emoji}</div>`,
        className: "",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(layer);
      const photo = m.photoUrl
        ? `<img src="${m.photoUrl}" alt="" style="width:120px;height:120px;object-fit:cover;border-radius:12px;margin-top:6px" />`
        : "";
      marker.bindPopup(
        `<strong>${m.username}</strong><br/>checkiran u ${m.time}${photo}`
      );
    }

    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 16);
    } else if (markers.length > 1) {
      map.fitBounds(
        L.latLngBounds(markers.map((m) => [m.lat, m.lng])),
        { padding: [40, 40], maxZoom: 16 }
      );
    }
  }, [markers]);

  return (
    <div
      ref={elRef}
      className="relative z-0 mt-6 h-[55dvh] w-full overflow-hidden rounded-card border border-white/10 shadow-soft"
    />
  );
}
