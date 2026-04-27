const CACHE_NAME = 'todoflow-shell-v2';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.pathname === '/env.js') {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  if (request.method !== 'GET' || url.pathname.startsWith('/tasks') || url.pathname.startsWith('/notifications')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || 'TodoFlow';
  const options = {
    body: payload.body || 'Nouvelle notification de tache.'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
