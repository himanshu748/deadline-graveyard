// Deadline Graveyard service worker (capture-and-export R3.2). It only shows notifications that
// the open app asks for and focuses the app when one is clicked. There is no push subscription
// and no caching, so a closed tab cannot send reminders; the UI and README say so.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => 'focus' in w);
      return open ? open.focus() : self.clients.openWindow('/');
    }),
  );
});
