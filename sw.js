// ==============================================================================
// VEDOTRIX PULSE - PRODUCTION SERVICE WORKER
// Designed & Managed by Vedotrix Technologies
// Background Push, Hardware Device Notifications, & Offline Cache Support
// ==============================================================================

const CACHE_NAME = 'vedotrix-pulse-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network first strategy with offline fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Hardware & Device Push Event Handler
self.addEventListener('push', (event) => {
  let data = {
    title: 'Vedotrix Pulse Notification',
    body: 'New team activity in your workspace',
    icon: './vedotrix-logo.png',
    badge: './vedotrix-logo.png',
    url: './'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || './vedotrix-logo.png',
    badge: data.badge || './vedotrix-logo.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './' },
    tag: data.tag || 'vedotrix-chat-alert',
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// App to Service Worker Direct Notification Message Event
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      ...options,
      icon: options.icon || './vedotrix-logo.png',
      badge: options.badge || './vedotrix-logo.png',
      vibrate: [200, 100, 200]
    });
  }
});

// Focus or Open Window on Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
