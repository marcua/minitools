const CACHE_NAME = 'socialite-v10';
const AYB_CLIENT = 'https://cdn.jsdelivr.net/npm/@aybdb/client@0.1.0/ayb.min.js';
const ASSETS = [
    './',
    './index.html',
    AYB_CLIENT,
    './manifest.json',
    './icon.svg'
];

const NAVIGATE_TIMEOUT_MS = 2500;

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
    // Whichever comes first: a network response, or the cache after the
    // timeout. If the network fails outright, use the cache.
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

    // The page itself - network first so updates show on the next load,
    // but never wait more than NAVIGATE_TIMEOUT_MS on a slow connection:
    // then the cached copy is served (and offline it always is). The
    // network response still refreshes the cache for next time.
    if (event.request.mode === 'navigate') {
        event.respondWith(networkFirst(event));
        return;
    }

    // Other static assets - cache first, network fallback
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
