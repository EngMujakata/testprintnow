const CACHE_NAME = 'enican-mines-native-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './logo-192.png',
  './logo-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache the Apps Script API. Live account, report and transaction
  // data must always come from the backend.
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('script.googleusercontent.com')
  ) {
    return;
  }

  // App shell: network first so deployments update quickly, cached fallback
  // keeps the installed PWA usable when offline.
  if (request.mode === 'navigate' || url.origin === self.location.origin) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached || caches.match('./index.html')
          )
        )
    );
  }
});

/*
 * Generic Web Push receiver.
 *
 * If a Web Push provider is connected later, its push message will reach this
 * service worker even when the Enican Mines app is not open. The worker accepts
 * both JSON payloads and plain text payloads.
 */
self.addEventListener('push', event => {
  let data = {
    title: 'Enican Mines',
    body: 'You have a new Enican Mines alert.',
    url: './',
    icon: './logo-192.png',
    badge: './logo-192.png'
  };

  try {
    if (event.data) {
      const incoming = event.data.json();
      data = Object.assign(data, incoming || {});
    }
  } catch (e) {
    try {
      if (event.data) data.body = event.data.text();
    } catch (_) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Enican Mines', {
      body: data.body || '',
      icon: data.icon || './logo-192.png',
      badge: data.badge || './logo-192.png',
      tag: data.tag || 'enican-mines-alert',
      renotify: true,
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) {
            try {
              client.navigate(target);
            } catch (_) {}
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});

// Local confirmation notification requested by the installed PWA.
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'SHOW_LOCAL_NOTIFICATION') return;

  event.waitUntil(
    self.registration.showNotification(data.title || 'Enican Mines', {
      body: data.body || '',
      icon: './logo-192.png',
      badge: './logo-192.png',
      tag: 'enican-mines-local'
    })
  );
});
