// Minimal service worker — satisfies PWA installability requirements.
// next-pwa's webpack plugin is bypassed when Turbopack is active;
// this static file ensures browsers can register a valid SW.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request)));
