// Service Worker for Web Push Notifications
// Handles notification display and click events

self.addEventListener('install', (_event) => {
  console.log('[SW] Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  event.waitUntil(clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  const sessionId = event.notification.data?.sessionId;
  const url = sessionId ? `/sandbox?session=${sessionId}` : '/sandbox';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes('/sandbox') && 'focus' in client) {
          return client.focus().then(() => {
            // Navigate to session page
            if (sessionId) {
              client.navigate(url);
            }
          });
        }
      }
      // No window open, open new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
