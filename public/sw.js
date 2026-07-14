// SW: instalabilnost + push + pametno keširanje.
// - RSC/prefetch zahtjeve Next routera NE presrećemo (sintetski error
//   odgovor tjera router na puni page reload — uzrok štekanja navigacije)
// - hashirani statički asseti su cache-first (immutable)
// - navigacije su network-first s offline fallbackom
const CACHE = "lakat-v4";
const OFFLINE_URL = "/offline.html";

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // krivi payload — prikaži default
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "LAKAT", {
      body: data.body || "Nešto se događa za šankom.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const win of windows) {
          if ("focus" in win) return win.focus();
        }
        return self.clients.openWindow("/");
      })
  );
});

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Immutable asseti: hashirani chunkovi, fontovi, ikone, manifest
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    /^\/(icon|apple-icon|apple-splash)[^/]*\.(png|svg)$/.test(url.pathname) ||
    /\.(woff2?|ttf)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(request.url);

  // Next router RSC/prefetch promet ide direktno na mrežu — presretanje
  // i lažni odgovori rušili bi klijentsku navigaciju u puni reload
  if (
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") ||
    request.headers.get("Next-Router-Prefetch")
  ) {
    return;
  }

  // Cache-first za immutable statiku — jedini sadržaj koji smije živjeti
  // u cacheu bez pitanja (hash u imenu = nikad se ne mijenja)
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Navigacije: network-first, offline fallback na zadnju viđenu stranicu
  // pa na offline.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Sve ostalo (API pozivi, slike s drugim headerima...) ne diramo —
  // browser i HTTP cache rade svoj posao
});
