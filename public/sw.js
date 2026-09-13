const CACHE_NAME = "devpulse-shell-v1";
const APP_SHELL = ["/", "/auth", "/dashboard", "/courses", "/teacher", "/manifest.webmanifest", "/devpulse-logo.png", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];
const OFFLINE_HTML = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && (request.destination === "document" || request.destination === "image" || request.destination === "style" || request.destination === "script")) {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => request.mode === "navigate" ? caches.match(OFFLINE_HTML) : caches.match(request))));
});
