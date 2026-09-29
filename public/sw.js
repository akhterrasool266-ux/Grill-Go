/* ===========================================================================
   Service worker — deliberately minimal.

   HTML is NEVER cached or intercepted. Every page keeps coming straight from
   the Worker, so Google always sees fresh server-rendered content, prices are
   never stale, and the cart never shows an old page. Only static assets
   (script, icons, images) are cached, which is where the speed win is.
   =========================================================================== */
const VERSION = 'v1';
const STATIC = 'static-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC).then((c) => c.addAll(['/app.js', '/icons/icon-192.png']).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // never touch HTML, the API, the admin panel or anything cross-origin
  // except images, which are safe to cache.
  const accept = req.headers.get('accept') || '';
  if (accept.includes('text/html')) return;
  if (url.origin === location.origin
      && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin'))) return;

  const isAsset = url.origin === location.origin
    && /\.(js|css|png|jpg|jpeg|webp|avif|svg|ico|woff2?)$/.test(url.pathname);
  const isImageCdn = /res\.cloudinary\.com$/.test(url.hostname);
  if (!isAsset && !isImageCdn) return;

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        caches.open(STATIC).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => hit))
  );
});
