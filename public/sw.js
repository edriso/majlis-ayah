/* Keeps Majlis Ayah usable with a weak or absent connection, which is what a
   mosque often has.

   - The page itself is network-first, so a deploy is picked up on the next
     visit, falling back to the cached copy offline.
   - Built assets (hashed file names) and the font files never change under
     the same address, so they are cache-first.
   - Google's font stylesheet can change what it points to, so it is served
     from the cache and refreshed behind it.
   - Recitation audio is never cached here: it is large, streamed in ranges,
     and only listened to, never needed to read.

   Bump VERSION to drop every cache this worker made. */

const VERSION = 'v2';
const SHELL = `majlis-ayah-shell-${VERSION}`;
const ASSETS = `majlis-ayah-assets-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add(new URL('./', self.registration.scope))),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('majlis-ayah-') && !k.endsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const cacheFirst = async (request) => {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque')
    cache.put(request, response.clone());
  return response;
};

const staleWhileRevalidate = async (event) => {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(event.request);
  const fresh = fetch(event.request)
    .then((response) => {
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
    .catch(() => hit);
  if (hit) {
    event.waitUntil(fresh);
    return hit;
  }
  return fresh;
};

const networkFirst = async (request) => {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match(new URL('./', self.registration.scope))) ||
      Response.error()
    );
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  const sameOrigin = url.origin === self.location.origin;
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }
  const isFont =
    url.hostname === 'static.qurancdn.com' ||
    url.hostname === 'fonts.gstatic.com';
  if (
    isFont ||
    (sameOrigin &&
      (url.pathname.includes('/assets/') ||
        url.pathname.includes('/reciters/')))
  ) {
    event.respondWith(cacheFirst(request));
  }
});
