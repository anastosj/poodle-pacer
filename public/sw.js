/**
 * Poodle Pacer service worker.
 *
 * Deliberately minimal: it exists to receive push notifications, not to cache.
 * An offline cache layer would need care around the app's authenticated,
 * server-rendered pages, so that is left for its own change.
 */

self.addEventListener("install", () => {
  // Take over straight away rather than waiting for every tab to close, so a
  // runner who just enabled notifications is registered on this visit.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Poodle Pacer";
  const options = {
    body: payload.body || "Time to train!",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Same tag collapses repeats, so a week away is one notification, not seven.
    tag: payload.tag || "poodle-pacer",
    renotify: true,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an open tab rather than piling up new ones.
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
