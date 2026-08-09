/* SKILL2CASH — service worker de notifications et cache PWA.
   Affiche les alertes système (messages, défis, duels, paiements) même
   lorsque l'onglet n'est pas au premier plan. Gère également le cache offline. */

const CACHE_NAME = "skill2cash-v1";
const STATIC_CACHE = "skill2cash-static-v1";
const DYNAMIC_CACHE = "skill2cash-dynamic-v1";

// Assets à mettre en cache statique
const STATIC_ASSETS = [
  "/",
  "/favicon.ico",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("skill2cash-") && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Stratégie de cache : Network First pour les requêtes API, Cache First pour les assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes non-GET et les requêtes vers d'autres origines
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Stratégie Cache First pour les assets statiques
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          const cloned = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, cloned));
          return response;
        });
      })
    );
    return;
  }

  // Stratégie Network First pour les requêtes API et pages
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, cloned));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Notifications déclenchées par l'application (Realtime -> postMessage).
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "s2c-notify") return;
  event.waitUntil(
    self.registration.showNotification(data.title || "SKILL2CASH", {
      body: data.body || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: data.tag,
      renotify: true,
      vibrate: [80, 40, 80],
      data: { link: data.link || "/tableau-de-bord" },
    }),
  );
});

// Notifications Web Push (si un serveur push VAPID est configuré).
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "SKILL2CASH", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "SKILL2CASH", {
      body: payload.body || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      vibrate: [80, 40, 80],
      data: { link: payload.link || "/tableau-de-bord" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/tableau-de-bord";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});