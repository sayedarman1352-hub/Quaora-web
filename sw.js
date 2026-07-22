const CACHE_NAME = "quaora-static-v16";
const STATIC_ASSETS = [
  "/quaora-tailwind.css",
  "/quaora-responsive.css?v=20260714-2",
  "/quaora-performance.js",
  "/quaora-image-utils.js",
  "/quaora-preorder.js",
  "/quaora-logo.svg",
  "/quaora-product-links.js?v=20260715-1",
  "/quaora-discounts.js",
  "/quaora-agent.css?v=20260722-1",
  "/quaora-agent.js?v=20260722-4"
];
const CACHEABLE_ORIGINS = new Set([
  "https://cdn.tailwindcss.com",
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com"
]);

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

  // CSS ve JS her zaman network-first; yeni tasarim normal yenilemede gelsin.
  if (/\.(css|js)$/i.test(url.pathname) && url.origin === self.location.origin) {
    event.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => null);
      return res;
    }).catch(() => caches.match(req)));
    return;
  }

  // Gorseller ve harici fontlar performans icin cache-first kalabilir.
  if (/\.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname) || CACHEABLE_ORIGINS.has(url.origin)) {
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => null);
      return res;
    })));
  }
});
