// Service Worker для управления кэшированием
const CACHE_NAME = 'juggling-planner-v2.0.0';
const CACHE_BUSTER = Date.now();

// Файлы для кэширования
const urlsToCache = [
    '/',
    '/index.html',
    `/app.js?v=${CACHE_BUSTER}`,
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'
];

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('Service Worker: Установка');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Кэширование файлов');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                // Принудительная активация нового SW
                return self.skipWaiting();
            })
    );
});

// Активация Service Worker
self.addEventListener('activate', event => {
    console.log('Service Worker: Активация');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Удаляем старые кэши
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Удаление старого кэша', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Принудительное управление всеми клиентами
            return self.clients.claim();
        })
    );
});

// Обработка запросов
self.addEventListener('fetch', event => {
    // Для HTML файлов всегда проверяем сеть первой
    if (event.request.destination === 'document') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Если получили ответ из сети, кэшируем его
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Если сеть недоступна, берем из кэша
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Для остальных ресурсов используем стратегию "кэш сначала"
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Возвращаем из кэша если есть, иначе загружаем из сети
                return response || fetch(event.request).then(fetchResponse => {
                    // Кэшируем новый ответ
                    if (fetchResponse.status === 200) {
                        const responseClone = fetchResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return fetchResponse;
                });
            })
    );
});

// Обработка сообщений от главного потока
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(names => {
            names.forEach(name => {
                caches.delete(name);
            });
        });
    }
});