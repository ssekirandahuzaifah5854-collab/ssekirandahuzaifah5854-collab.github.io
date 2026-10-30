/* Open Board service worker: the app works offline after the first visit. */
const VERSION = 'ob-v1';
const CORE = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'privacy.html', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function neverCache(url, req) {
  return /firebaseio\.com|firebasedatabase\.app/.test(url.hostname) ||
    url.pathname.indexOf('/.well-known/') === 0 || url.pathname === '/assetlinks.json' ||
    (req.headers.get('accept') || '').indexOf('text/event-stream') >= 0;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (neverCache(url, req)) return;
  const sameOrigin = url.origin === self.location.origin;
  const fontHost = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fontHost) return;

  e.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req, { ignoreSearch: sameOrigin }).then((hit) => {
        const refresh = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => null);
        if (hit) { e.waitUntil(refresh); return hit; }
        return refresh.then((res) => {
          if (res) return res;
          if (req.mode === 'navigate') return cache.match('index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
      })
    )
  );
});
