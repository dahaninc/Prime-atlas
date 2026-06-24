// prime-atlas Service Worker v3
const CACHE_NAME = "prime-atlas-v3";
const OFFLINE_URL = "/offline";

const SHELL_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
];

const BYPASS_PREFIXES = [
  "/dashboard",
  "/watchlists",
  "/signals",
  "/opportunities/finder",
  "/auth/",
  "/api/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (BYPASS_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((res) => {
        if (res.status === 200) {
          caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
        }
        return res;
      }))
    );
    return;
  }

  if (url.pathname.startsWith("/_next/")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.status === 200) cache.put(request, res.clone());
          return res;
        })
        .catch(() => caches.match(OFFLINE_URL));
      return cached ?? fetchPromise;
    })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "prime-atlas Signal", {
      body: data.body ?? "A new investment signal has been detected.",
      tag: data.tag ?? "signal",
      data: { url: data.url ?? "/signals" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const url = event.notification.data?.url ?? "/signals";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
