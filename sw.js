const CACHE_NAME = "quaora-static-v3";
const STATIC_ASSETS = [
  "/quaora-responsive.css",
  "/quaora-performance.js",
  "/quaora-discounts.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;

  // HTML her zaman network-first; eski sayfa takılı kalmasın.
  if (req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => null);
      return res;
    }).catch(() => caches.match(req)));
    return;
  }

  // Static dosyalar cache-first.
  if (/\.(css|js|png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => null);
      return res;
    })));
  }
});
