// Hemlo Systems service worker: the app opens and sells without internet.
// The page shell and its files are kept on the device; data comes from the API (and the app's own offline queue).
const CACHE = 'hemlo-system-v2';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const html = await (await fetch('/', { cache: 'reload' })).text();
    const files = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
    await cache.addAll([...new Set(['/', ...files])]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // the API is never cached here
  if (req.mode === 'navigate') {
    // the newest page when online; the kept one when not
    event.respondWith((async () => {
      try { const res = await fetch(req); if (res.ok) (await caches.open(CACHE)).put('/', res.clone()); return res; }
      catch { return (await caches.match('/')) ?? Response.error(); }
    })());
    return;
  }
  // hashed build files, fonts, logos, icons: keep the first copy
  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  })());
});
