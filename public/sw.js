// PixCherry service worker. Only here so phones offer "Install app" for an
// event album; it caches nothing (the album is always live).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
