// Public app shell only. All account/API and third-party traffic bypasses storage.
const CACHE = 'finfolk-shell-__VERSION__',
  SHELL = __SHELL__;
self.addEventListener('install', (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url),
    base = new URL('./', self.registration.scope);
  if (request.method !== 'GET' || url.origin !== base.origin) return;
  if (request.mode === 'navigate')
    event.respondWith(
      (async () => {
        try {
          return await fetch(request, { signal: AbortSignal.timeout(5000) });
        } catch {
          const cached = await (await caches.open(CACHE)).match('./index.html');
          if (!cached) return new Response('FinFolk is offline. Reconnect to load the app.', {status:503});
          // Static hosts redirect index.html to /. Navigation requests cannot
          // consume a redirected cached response, so return a fresh HTML response.
          const headers = new Headers(cached.headers);
          headers.delete('Content-Encoding');
          headers.delete('Content-Length');
          return new Response(cached.body, {status:cached.status, statusText:cached.statusText, headers});
        }
      })(),
    );
  else if (SHELL.some((path) => new URL(path, base).href === url.href))
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(request)) || fetch(request);
      })(),
    );
});
