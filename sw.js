const CACHE_NAME = 'juggling-planner-v2.4.5'; // Updated version
const APP_SHELL_FILES = [
    '/',
    '/index.html',
    '/app.js'
];
const LIBS_TO_CACHE = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'
];

// Install: Cache the libraries
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(LIBS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network first for app shell, Cache first for libs
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // For app shell files, go network first
    if (APP_SHELL_FILES.includes(url.pathname)) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // If successful, update the cache
                    if (response.ok) {
                        const resClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, resClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // If network fails, serve from cache
                    return caches.match(event.request);
                })
        );
    } 
    // For other requests (like the libs), go cache first
    else {
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
    }
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
