/* Nireekshanam service worker: offline app shell + runtime caching.
 * Field records are not queued here; the app stores them in IndexedDB and syncs them itself,
 * so a record is never lost if the browser evicts this worker's caches. */
const VERSION = 'nk-v3';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const PRECACHE = ['/offline', '/icon.svg', '/icons/192', '/manifest.webmanifest'];
// Field pages need a session. The lot and stage pages read their IDs from the URL on the device,
// so one cached copy of each template (`_` segments) answers every lot when offline.
const FIELD_PAGES = ['/field', '/field/sync', '/field/lots', '/field/scan', '/field/lots/_', '/field/lots/_/stage/_'];
const TEMPLATES = [
  [/^\/field\/lots\/[^/]+\/stage\/[^/]+\/?$/, '/field/lots/_/stage/_'],
  [/^\/field\/lots\/[^/]+\/?$/, '/field/lots/_'],
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then(async (c) => {
        await c.addAll(PRECACHE);
        await cacheFieldPages(c);
        await warmAssets(c);
      })
      .then(() => self.skipWaiting()),
  );
});

/** Caches the field pages the current session can open. Before login they redirect to /login,
 * and that redirect must not be stored as the field page; the app asks again after login. */
async function cacheFieldPages(shell) {
  await Promise.all(FIELD_PAGES.map(async (u) => {
    try {
      const res = await fetch(u, { credentials: 'same-origin' });
      if (res.ok && !res.redirected) await shell.put(u, res);
      // An unread body holds its connection open and stalls the other fetches.
      else await res.body?.cancel();
    } catch {
      // Retried on the next WARM_FIELD message.
    }
  }));
}

/** Caches the build assets the precached pages load, so they also start offline. */
async function warmAssets(shell) {
  const runtime = await caches.open(RUNTIME);
  const assets = new Set();
  for (const req of await shell.keys()) {
    const res = await shell.match(req);
    if (!res || !(res.headers.get('content-type') || '').includes('text/html')) continue;
    const html = await res.clone().text();
    for (const m of html.matchAll(/["'(](\/_next\/static\/[^"'()\s]+)/g)) assets.add(m[1].replace(/\\u0026/g, '&'));
  }
  await Promise.all([...assets].map(async (u) => {
    if (await runtime.match(u)) return;
    try {
      const res = await fetch(u);
      if (res.ok) await runtime.put(u, res);
    } catch {
      // Fetched again on first use.
    }
  }));
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build assets: cache first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Field data the app needs offline: network first, fall back to the last copy.
  if (url.pathname.startsWith('/api/field/')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Page navigations: network first, then cached page, then the offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      networkFirst(req).catch(async () => {
        const path = url.pathname;
        for (const [pattern, template] of TEMPLATES) {
          if (pattern.test(path)) {
            const hit = await caches.match(template);
            if (hit) return hit;
          }
        }
        return (await caches.match('/offline')) || Response.error();
      }),
    );
  }
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(RUNTIME)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(RUNTIME)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: false });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'WARM_FIELD') {
    event.waitUntil(caches.open(SHELL).then(async (c) => {
      await cacheFieldPages(c);
      await warmAssets(c);
    }));
  }
});
