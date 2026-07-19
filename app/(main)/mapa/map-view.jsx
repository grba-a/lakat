"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fallback centar (Club23, Srebreno) dok nema ni markera ni dopuštene
// lokacije gledatelja
const HOME = [42.6215, 18.1996];

export default function MapView({ markers, kafici = [] }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const kaficiLayerRef = useRef(null);
  const markersCountRef = useRef(markers.length);
  markersCountRef.current = markers.length;

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
    kaficiLayerRef.current = L.layerGroup().addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Default centar = gdje je gledatelj SAD; markeri imaju prednost
    // (fitBounds ispod), odbijena lokacija ostavlja fallback
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (mapRef.current && markersCountRef.current === 0) {
            mapRef.current.setView(
              [pos.coords.latitude, pos.coords.longitude],
              15
            );
          }
        },
        () => {},
        { timeout: 8000, maximumAge: 60_000 }
      );
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Partner kafići: zelena zastavica — ispod dnevnih markera. Laktanje
  // na tim lokacijama se pamti (kafic_id na checkinu, bodovi u budućnosti).
  useEffect(() => {
    const layer = kaficiLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const k of kafici) {
      const icon = L.divIcon({
        html: `<div style="display:flex;align-items:center;gap:4px;background:rgba(74,222,128,0.18);border:1px solid rgba(74,222,128,0.6);border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;color:#4ade80;white-space:nowrap;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6))">⚑ ${k.name}</div>`,
        className: "",
        iconSize: null,
        iconAnchor: [10, 10],
      });
      const marker = L.marker([k.lat, k.lng], {
        icon,
        zIndexOffset: -100,
      }).addTo(layer);
      marker.bindPopup(
        `<strong>${k.name}</strong> — partner kafić.<br/>Laktanje ovdje se pamti.`
      );
    }
  }, [kafici]);

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
        `<strong>${m.username}</strong><br/>za šankom od ${m.time}${photo}`
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
