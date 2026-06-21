// prime-atlas Service Worker
// Provides offline shell + caches static assets

const CACHE_NAME = "prime-atlas-v1";
const OFFLINE_URL = "/offline";

// Assets to pre-cache (app shell)
const SHELL_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch strategy ───────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-same-origin (Supabase API, etc.)
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Skip Next.js internal routes
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    );
    return;
  }

  // Network-first for API routes (rankings, signals — need fresh data)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Stale-while-revalidate for navigation
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((res) => { cache.put(request, res.clone()); return res; })
        .catch(() => caches.match(OFFLINE_URL));
      return cached ?? fetchPromise;
    })
  );
});

// ─── Push notifications (Signals alerts) ──────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "prime-atlas Signal", {
      body: data.body ?? "A new investment signal has been detected.",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: data.tag ?? "signal",
      data: { url: data.url ?? "/signals" },
      actions: [
        { action: "view", title: "View Signal" },
        { action: "dismiss", title: "Dismiss" },
      ],
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
