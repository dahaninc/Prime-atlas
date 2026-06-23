// prime-atlas Service Worker v2
// Provides offline shell + caches static assets only
// IMPORTANT: Protected routes and auth routes are NEVER cached

const CACHE_NAME = "prime-atlas-v2"; // bumped to clear all v1 cached redirects

const OFFLINE_URL = "/offline";

// App shell assets (public, never auth-gated)
const SHELL_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Routes that must ALWAYS go to the network — never serve from cache.
// These are auth-gated (returning a cached redirect would break login).
const BYPASS_PREFIXES = [
  "/dashboard",
  "/watchlists",
  "/signals",
  "/opportunities/finder",
  "/auth/",
  "/api/",
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate — wipe ALL old caches ──────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept GET requests to this origin
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Auth-gated + API routes: ALWAYS network, NEVER cache
  if (BYPASS_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    // Let the browser handle it natively — no respondWith means pass-through
    return;
  }

  // Next.js static chunks: cache-first (immutable hashed filenames)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((res) => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      }))
    );
    return;
  }

  // Skip other /_next/ internals (image optimisation etc.)
  if (url.pathname.startsWith("/_next/")) return;

  // Public navigation pages: stale-while-revalidate
  // CRITICAL: only cache HTTP 200 responses — never cache redirects (307, 302, 303)
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.status === 200) {
            cache.put(request, res.clone());
          }
          return res;
        })
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
