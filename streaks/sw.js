const CACHE_NAME = 'streaks-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

// Install - cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - cache-first strategy for app shell
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Only cache same-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) {
                    // Return cached version, but update cache in background
                    fetch(event.request).then(response => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, response);
                            });
                        }
                    }).catch(() => {});
                    return cached;
                }

                // Not in cache, fetch from network
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
