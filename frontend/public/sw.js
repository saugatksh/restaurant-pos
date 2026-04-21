// RestoPOS v3 — Offline-First Service Worker
const CACHE_NAME = "restopos-v3";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/static/js/main.chunk.js",
  "/static/js/bundle.js",
  "/static/css/main.chunk.css",
];

// Install: cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API calls: Network-first, fall back to cached response + queue for sync
// - Static assets: Cache-first
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API requests: network-first with offline fallback
  if (url.pathname.startsWith("/api/") || url.port === "5000") {
    event.respondWith(
      fetch(event.request.clone())
        .then((response) => {
          // Cache successful GET responses
          if (event.request.method === "GET" && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: return cached API response if available
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Return offline indicator for API calls
            return new Response(
              JSON.stringify({ error: "offline", message: "You are offline. Showing cached data." }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          });
        })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // For navigation requests offline, serve the app shell
        if (event.request.mode === "navigate") {
          return caches.match("/index.html");
        }
      });
    })
  );
});

// Background sync for queued offline orders
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-orders") {
    event.waitUntil(syncOfflineOrders());
  }
});

async function syncOfflineOrders() {
  // This is handled by the IndexedDB sync queue in the app
  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage({ type: "SYNC_COMPLETE" }));
}
