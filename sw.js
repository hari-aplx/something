// Minimal service worker: needed so phones (Android Chrome) can show the
// last-minute notification. Tapping it brings the countdown page to front.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow(self.registration.scope);
    })
  );
});
