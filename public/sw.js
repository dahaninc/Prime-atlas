// prime-atlas Service Worker v4 — SELF-DESTRUCT.
//
// v3 cached the app shell cache-first with no revalidation, so returning
// browsers ran a stale deploy forever: old HTML referencing deleted JS
// chunks → hydration dead → signup/login broken. This version replaces v3
// on the browser's next update check, wipes every cache, unregisters
// itself, and reloads open tabs so stranded clients heal automatically.
// Do NOT reintroduce a caching service worker without deploy-aware
// versioning and network-first navigations.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.navigate(client.url); // reload each tab against the live network
      }
    })()
  );
});
