/* School ERP service worker.
 * - Caches static build assets and icons (cache-first).
 * - Navigations are network-first; if the network is down, an offline page is shown.
 * - It NEVER caches API calls, server-action posts or authenticated HTML (student/finance data
 *   must not sit in a shared device's cache).
 * - The one exception is /offline-work: a static shell with NO data in it (the lists are read from the
 *   phone's own IndexedDB after a PIN), cached so teachers can still open it without internet.
 * - Handles web-push notifications when VAPID keys are configured.
 */
const VERSION = 'v2';
const STATIC = `static-${VERSION}`;
const OFFLINE_URL = '/offline';
const WORK_URL = '/offline-work';

/** Cache the offline shell plus the scripts/styles it references, so it can open with no network. */
async function warm() {
  const cache = await caches.open(STATIC);
  const res = await fetch(WORK_URL, { credentials: 'omit' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put(WORK_URL, res);
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) || [])];
  await Promise.all(assets.map((a) => cache.match(a).then((hit) => hit || fetch(a).then((r) => (r.ok ? cache.put(a, r) : null))).catch(() => null)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, '/icons/icon-192.png', '/icons/icon.svg'])).then(() => warm().catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== STATIC).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => { if (event.data === 'warm-offline') event.waitUntil(warm().catch(() => {})); });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); return res;
    })));
    return;
  }
  if (req.mode === 'navigate' && url.pathname === WORK_URL) {
    event.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(WORK_URL, copy)); } return res; }).catch(() => caches.match(WORK_URL).then((hit) => hit || caches.match(OFFLINE_URL))));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text push */ }
  event.waitUntil(self.registration.showNotification(data.title || 'School ERP', {
    body: data.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: data.url || '/notifications' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
