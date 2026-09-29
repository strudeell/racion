// Офлайн-режим: файлы сайта сохраняются на устройстве, и приложение открывается без интернета.
// Когда интернет есть, файлы тихо обновляются в фоне — новая версия появится при следующем открытии.

const CACHE = 'nedelka-v1';
const FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/planner.js',
  './js/data/dicts.js',
  './js/data/stores.js',
  './js/data/products.js',
  './js/data/recipes.js',
  './js/data/recipes/breakfasts.js',
  './js/data/recipes/soups.js',
  './js/data/recipes/mains.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const fresh = fetch(req)
    .then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
      }
      return res;
    })
    .catch(() => null);
  event.waitUntil(fresh);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    const res = await fresh;
    if (res) return res;
    if (req.mode === 'navigate') {
      const page = await cache.match('./index.html');
      if (page) return page;
    }
    return new Response('Нет соединения', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
