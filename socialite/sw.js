const CACHE_NAME = 'socialite-v4';
const AYB_CLIENT = 'https://cdn.jsdelivr.net/npm/@aybdb/client@0.1.0/ayb.min.js';
const ASSETS = [
    './',
    './index.html',
    AYB_CLIENT,
    './manifest.json',
    './icon.svg'
];

// Install - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - cache first for the app shell only
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Everything else is live data: ayb queries, OAuth, and the PDSes and
    // Mastodon servers we poll. Let the browser handle those directly so a
    // poll never gets a stale cached answer.
    const isShell = event.request.method === 'GET' &&
        (url.origin === self.location.origin || url.href === AYB_CLIENT);
    if (!isShell || url.pathname.includes('/oauth/') ||
        (url.pathname.includes('/v1/') && url.pathname.includes('/query'))) {
        return;
    }

    // Static assets - cache first, network fallback
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) {
                    // Return cached, but also update cache in background
                    fetch(event.request).then(response => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, response);
                            });
                        }
                    }).catch(() => {});
                    return cached;
                }

                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                });
            })
    );
});
