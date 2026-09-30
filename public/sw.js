/* Shubhora service worker: shows notifications sent by the server and opens the right page on tap. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Shubhora", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Shubhora";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: data.icon || "/icon.png",
    badge: data.badge || "/icon.png",
    tag: data.tag,
    data: { url: data.url || "/dashboard" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === new URL(url, self.location.origin).origin && "focus" in c) {
        await c.focus();
        if ("navigate" in c) await c.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
