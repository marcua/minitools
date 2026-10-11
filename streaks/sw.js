const CACHE_NAME = 'streaks-v28';
const ASSETS = [
    './',
    './index.html',
    'https://cdn.jsdelivr.net/npm/@aybdb/client@0.1.0/ayb.min.js',
    './manifest.json',
    './icon.svg'
];

const NAVIGATE_TIMEOUT_MS = 2500;

// The page itself loads network first so updates show on the next load, but
// never waits more than NAVIGATE_TIMEOUT_MS on a slow connection: then the
// cached copy is served (and offline it always is). The network response
// still refreshes the cache for next time.
function networkFirst(event) {
    let saved = Promise.resolve();
    const network = fetch(event.request, { cache: 'no-cache' }).then(response => {
        if (response.ok) {
            const copy = response.clone();
            saved = caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
    });
    // Keep the worker alive until the cache is refreshed, even when the
    // cached copy wins the race.
    event.waitUntil(network.then(() => saved).catch(() => {}));

    const cached = () => caches.match(event.request).then(c => c || caches.match('./index.html'));
    const timeout = new Promise(resolve => setTimeout(resolve, NAVIGATE_TIMEOUT_MS)).then(cached);
    return Promise.race([
        network.catch(() => cached().then(c => c || Response.error())),
        timeout.then(c => c || network)
    ]);
}

// Install - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        // cache: 'reload' skips the browser's HTTP cache (the site sends
        // max-age=600), so a new worker never stores a stale page.
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
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

// Fetch - network only for API, cache first for assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API requests (ayb queries) and OAuth - network only
    if ((url.pathname.includes('/v1/') && url.pathname.includes('/query')) ||
        url.pathname.includes('/oauth/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(networkFirst(event));
        return;
    }

    // Static assets - cache first, network fallback
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) {
                    // Return cached, but also update cache in background
                    fetch(event.request, { cache: 'no-cache' }).then(response => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, response);
                            });
                        }
                    }).catch(() => {});
                    return cached;
                }

                return fetch(event.request).then(response => {
                    // Cache successful GET responses
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
