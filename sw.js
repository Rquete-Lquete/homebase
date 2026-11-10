// Service worker: lets Homebase open with no connection.
// App files: network first (so updates show up straight away), cache as backup.
// Bus stop list: cached copy first, refreshed in the background.
// Live bus arrivals always go to the network.
// When you change any file, bump VERSION so old caches are cleared.

const VERSION = 'hb-v3.0.0';
const DATA_CACHE = 'hb-data';

const APP_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/ui.js',
  './js/store.js',
  './js/shortcuts.js',
  './js/today.js',
  './js/tasks.js',
  './js/bus.js',
  './js/health.js',
  './js/plan.js',
  './js/timetable.js',
  './js/grades.js',
  './js/focus.js',
  './js/weather.js',
  './js/idp.js',
  './js/settings.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== DATA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await Promise.race([fetch(request), timeout(3500)]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cachedThenRefresh(request) {
  const cache = await caches.open(DATA_CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return hit || (await network) || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (url.hostname === 'data.busrouter.sg') {
    event.respondWith(cachedThenRefresh(request));
  }
});
