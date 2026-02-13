const CACHE_NAME = 'workpulse-v2';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icons/icon.svg'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.origin !== location.origin) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );
        return;
    }
    e.respondWith(
        caches.match(e.request).then(cached => {
            const fetched = fetch(e.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                return response;
            }).catch(() => cached);
            return cached || fetched;
        })
    );
});
