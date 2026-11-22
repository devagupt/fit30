const VERSION = '__FIT30_VERSION__';
const ASSETS = ['__FIT30_ASSETS__'];
const scope = new URL(self.registration.scope);
const cachePrefix = `fit30-shell:${scope.pathname}:`;
const cacheName = `${cachePrefix}${VERSION}`;
const urls = new Set(ASSETS.map((asset) => new URL(asset, scope).href));
const indexUrl = new URL('index.html', scope).href;
const assetsPath = new URL('assets/', scope).pathname;
const activeMarker = new URL('fit30-active-cache', scope).href;

async function otherShellCaches() {
  return (await caches.keys()).filter((name) => name.startsWith(cachePrefix) && name !== cacheName);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    // Keep completed downloads for the next install attempt if the connection drops.
    for (const url of urls) {
      const request = new Request(url, { cache: 'reload' });
      if (!(await cache.match(request))) await cache.add(request);
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'APPLY_FIT30_UPDATE') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const older = await otherShellCaches();
    // An open tab from the last build may still request one of its lazy-loaded assets.
    let previous = older[0];
    for (const name of older) {
      if (await caches.match(activeMarker, { cacheName: name })) previous = name;
    }
    await Promise.all(older.filter((name) => name !== previous).map((name) => caches.delete(name)));
    const cache = await caches.open(cacheName);
    await cache.put(activeMarker, new Response()).catch(() => {});
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin) return;
  const navigation = event.request.mode === 'navigate';
  const path = url.pathname;
  // The update link uses index.html with a query so it reaches the current preview.
  const appPage = navigation && (path === scope.pathname || url.href === indexUrl);
  const bundledAsset = !navigation && path.startsWith(assetsPath) && !url.search;
  if (!appPage && !urls.has(url.href) && !bundledAsset) return;

  // Keep HTML and its hashed assets on the same version until the next worker takes over.
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    // The precache stores fixed same-origin files; navigation and module requests can send different headers.
    const cached = await cache.match(appPage ? indexUrl : url.href, { ignoreVary: true });
    if (cached) return cached;

    if (bundledAsset) {
      for (const older of await otherShellCaches()) {
        const legacy = await caches.match(url.href, { cacheName: older, ignoreVary: true });
        if (legacy) return legacy;
      }
    }
    return fetch(event.request);
  })());
});
