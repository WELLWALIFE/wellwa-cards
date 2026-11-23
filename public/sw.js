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

/* ---- Mobile Shop without internet (owner, 23 Nov 2026) ----
 * Only the Mobile Shop screens (/poster/mobile…) and the app's own static files are kept on the phone, so the bill screen opens
 * with no network. Pages: network first, the kept copy only when the network fails. Static files carry a hash in their name, so a
 * kept copy is always the right one. No API answer and no other page is ever kept here. */
const MS_SHELL = "ms-shell-v1";
const msPage = (p) => p === "/poster/mobile" || p.startsWith("/poster/mobile/");

async function msTrim(cache) {
  const keys = await cache.keys();
  if (keys.length > 500) await Promise.all(keys.slice(0, 150).map((k) => cache.delete(k)));
}
async function msKeepPage(path) {
  const r = await fetch(path, { credentials: "same-origin" });
  if (r.ok && !r.redirected) await msKeep(path, r);
}
/** Keep one page and every static file its HTML names (after a new version, the new files come with the next visit). */
async function msKeep(path, r) {
  const cache = await caches.open(MS_SHELL);
  const html = await r.clone().text();
  await cache.put(path, r);
  const found = new Set();
  for (const m of html.match(/\/_next\/static\/[^"'\\\s<>)]+/g) || []) found.add(m);
  for (const m of html.match(/static\/(?:chunks|css|media)\/[^"'\\\s<>)]+?\.(?:js|css|woff2)/g) || []) found.add("/_next/" + m);
  await Promise.all([...found].map(async (a) => {
    try { if (!(await cache.match(a))) { const x = await fetch(a); if (x.ok) await cache.put(a, x); } } catch { /* next time */ }
  }));
  await msTrim(cache);
}

self.addEventListener("message", (event) => {
  const d = event.data || {};
  if (d.type !== "ms-warm" || !Array.isArray(d.paths)) return;
  event.waitUntil((async () => { for (const p of d.paths.slice(0, 10)) { if (typeof p === "string" && msPage(p)) { try { await msKeepPage(p); } catch { /* offline */ } } } })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate" && msPage(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(MS_SHELL);
      try {
        const r = await fetch(req);
        if (r.ok && !r.redirected) event.waitUntil(msKeep(url.pathname, r.clone()).catch(() => undefined));
        return r;
      } catch (e) {
        const kept = (await cache.match(url.pathname)) || (/^\/poster\/mobile\/bill\/[^/]+$/.test(url.pathname) ? null : await cache.match("/poster/mobile/bill"));
        if (kept) return kept;
        throw e;
      }
    })());
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(MS_SHELL);
      const kept = await cache.match(req.url);
      if (kept) return kept;
      return fetch(req);   // kept only by the warm-up above, so the rest of the app does not fill the phone
    })());
  }
});
