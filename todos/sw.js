const CACHE_NAME = 'todos-v12';
const ASSETS = [
    './',
    './index.html',
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

// Fetch - network first for API, cache first for assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API requests (ayb queries) - network only
    if (url.pathname.includes('/v1/') && url.pathname.includes('/query')) {
        event.respondWith(fetch(event.request));
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
                    // Cache successful responses
                    if (response.ok && event.request.method === 'GET') {
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
