/* SKILL2CASH — service worker de notifications.
   Affiche les alertes système (messages, défis, duels, paiements) même
   lorsque l'onglet n'est pas au premier plan. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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