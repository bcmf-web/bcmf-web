const CACHE_NAME = "bcmf-crew-v2";

// Ressources à mettre en cache pour fonctionner hors ligne
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/logo-bcmf.svg",
  "/manifest.json",
];

// Installation : mise en cache des ressources statiques
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activation : suppression des anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch : Network First (toujours essayer le réseau, cache en fallback)
self.addEventListener("fetch", (event) => {
  // On ne cache pas les appels Supabase (données toujours fraîches)
  if (event.request.url.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre en cache la réponse fraîche
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Réseau indisponible → utiliser le cache
        return caches.match(event.request).then(
          (cached) => cached || caches.match("/index.html")
        );
      })
  );
});

// ── Notifications Push ────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "BCMF Crew", body: event.data.text() }; }
  const { title = "BCMF Crew", body = "", url = "/" } = data;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo-bcmf.svg",
      badge: "/logo-bcmf.svg",
      data: { url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
