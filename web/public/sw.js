// Vedotrix Pulse Production Service Worker
// Designed & Managed by Vedotrix Technologies

const CACHE_NAME = 'vedotrix-pulse-v1';

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
