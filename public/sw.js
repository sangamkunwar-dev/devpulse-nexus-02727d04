const CACHE_NAME = "devpulse-shell-v2";
const APP_SHELL = ["/", "/auth", "/dashboard", "/courses", "/teacher", "/manifest.webmanifest", "/devpulse-logo.png", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];
const OFFLINE_HTML = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          APP_SHELL.map((url) =>
            cache.add(url).catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    try {
      const response = await fetch(request);
      if (response.ok && (request.destination === "document" || request.destination === "image" || request.destination === "style" || request.destination === "script" || request.destination === "empty")) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    } catch {
      return cached || (request.mode === "navigate" ? caches.match(OFFLINE_HTML) : undefined);
    }
  })());
});
