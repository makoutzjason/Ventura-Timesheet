const CACHE_NAME = "ventura-shell-v1";
const SHELL_ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

// Deliberately no offline fallback for pages or API calls: this app deals in
// live timesheet/payroll data, so serving a stale cached page would be worse
// than the browser's normal "you're offline" behavior. Only the static shell
// assets above (needed for install/updates) are cached.
self.addEventListener("fetch", (event) => {
  if (SHELL_ASSETS.some((asset) => event.request.url.endsWith(asset))) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
