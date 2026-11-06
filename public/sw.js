/* أمتي — service worker: يعرض الإشعارات ويشغّل التذكيرات حتى بعد إغلاق التبويب */
const CACHE = "emty-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

/** جدول التذكيرات المخزّن من الصفحة */
let schedule = [];
let timerId = null;

function fired(id) {
  return caches.open(CACHE).then((c) => c.match("/fired/" + id)).then((r) => Boolean(r));
}
function markFired(id) {
  return caches.open(CACHE).then((c) => c.put("/fired/" + id, new Response("1")));
}

async function tick() {
  const now = Date.now();
  for (const item of schedule) {
    if (item.at > now || item.at < now - 120000) continue;
    if (await fired(item.id)) continue;
    await markFired(item.id);
    await self.registration.showNotification(item.title, {
      body: item.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      dir: "rtl",
      lang: "ar",
      tag: item.id,
      requireInteraction: Boolean(item.important),
      silent: false,
      vibrate: [180, 80, 180],
      data: { url: item.url || "/", sound: item.sound || null },
    });
    if (item.sound) {
      const list = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
      list.forEach((c) => c.postMessage({ type: "play-sound", sound: item.sound }));
    }
  }
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "schedule") {
    schedule = data.items || [];
    if (!timerId) timerId = setInterval(tick, 25000);
    tick();
  }
  if (data.type === "show") {
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.ico",
      dir: "rtl",
      lang: "ar",
      tag: data.tag,
      vibrate: [180, 80, 180],
      data: { url: data.url || "/" },
    });
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "أمتي", body: "تذكير" };
  try {
    payload = event.data ? event.data.json() : payload;
  } catch (_) {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      dir: "rtl",
      lang: "ar",
      vibrate: [180, 80, 180],
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "emty-reminders") event.waitUntil(tick());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});
