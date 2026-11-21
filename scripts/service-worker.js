const VERSION = '__FIT30_VERSION__';
const ASSETS = ['__FIT30_ASSETS__'];
const scope = new URL(self.registration.scope);
const cachePrefix = `fit30-shell:${scope.pathname}:`;
const cacheName = `${cachePrefix}${VERSION}`;
const urls = new Set(ASSETS.map((asset) => new URL(asset, scope).href));
const indexUrl = new URL('index.html', scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(
    [...urls].map((url) => new Request(url, { cache: 'reload' })),
  )));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin) return;
  const navigation = event.request.mode === 'navigate';
  const path = url.pathname;
  const appPage = navigation && (path === scope.pathname || url.href === indexUrl);
  if (!appPage && !urls.has(url.href)) return;

  // Keep HTML and its hashed assets on the same version until the next worker takes over.
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    // The precache stores fixed same-origin files; navigation and module requests can send different headers.
    return await cache.match(appPage ? indexUrl : url.href, { ignoreVary: true }) ?? await fetch(event.request);
  })());
});
