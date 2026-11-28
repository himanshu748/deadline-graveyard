// Production build injects a version and an exact app-shell allowlist. Dev mode caches nothing.
// No external requests, API responses, credentials or user data enter this cache.
// MDN: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
const CACHE = /* BUILD_CACHE */ null;
const ASSETS = /* BUILD_ASSETS */ [];

self.addEventListener('install', (event) => {
  if (CACHE) event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  // Updates wait for old tabs to close; never replace a running app with mixed build versions.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (CACHE) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith('deadline-graveyard-shell-') && name !== CACHE).map((name) => caches.delete(name)));
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (!CACHE || event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.search || !ASSETS.includes(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(url.pathname)) ?? fetch(event.request)));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => 'focus' in w);
      return open ? open.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
