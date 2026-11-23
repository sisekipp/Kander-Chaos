/* Kandern Chaos – Service Worker (wird beim Build mit der Precache-Liste befüllt). */
/* global self, caches, Response, URL */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL_CACHE = `kc-shell-${VERSION}`;
const WORLD_CACHE = 'kc-world';
const BASE = new URL('./', self.location.href).pathname;

self.addEventListener('install', (event) => {
  // App-Shell atomar vorladen: entweder alles oder die Installation schlägt fehl.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(PRECACHE.map((p) => new Request(BASE + p, { cache: 'reload' })))),
  );
  // Kein skipWaiting: neue Version wird erst nach Bestätigung (Nachricht) oder beim nächsten Start aktiv.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'VERSION') event.source?.postMessage({ type: 'VERSION', version: VERSION });
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('kc-shell-') && key !== SHELL_CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

/** Beantwortet Range-Anfragen aus einer zwischengespeicherten Antwort (206 Partial Content). */
async function rangeResponse(cached, rangeHeader) {
  const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader || '');
  if (!m) return cached;
  const blob = await cached.blob();
  const start = Number(m[1]);
  const end = m[2] ? Math.min(Number(m[2]), blob.size - 1) : blob.size - 1;
  if (start >= blob.size)
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
  const part = blob.slice(start, end + 1);
  return new Response(part, {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${blob.size}`,
      'Content-Length': String(part.size),
    },
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : url.pathname;

  // Weltdaten: Pakete und aktive Metadaten aus dem Welt-Cache (vom Downloader befüllt).
  if (path.startsWith('world/')) {
    // Abfragen mit ?check umgehen den Cache (Update-Prüfung des Downloaders).
    if (url.searchParams.has('check')) return;
    event.respondWith(
      (async () => {
        const cache = await caches.open(WORLD_CACHE);
        const cached = await cache.match(BASE + path);
        if (cached) return req.headers.has('range') ? rangeResponse(cached, req.headers.get('range')) : cached;
        return fetch(req);
      })(),
    );
    return;
  }

  // Navigation: App-Shell (index.html) – offline aus dem Cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(BASE + 'index.html');
        if (!cached) return fetch(req);
        // Cloudflare leitet /index.html auf / um: eine umgeleitete Antwort darf respondWith() bei
        // Seitenaufrufen nicht liefern -> als frische Antwort ohne Umleitungs-Markierung zurückgeben
        if (!cached.redirected) return cached;
        return new Response(await cached.blob(), { status: 200, headers: cached.headers });
      })(),
    );
    return;
  }

  // Übrige Dateien: Cache zuerst (gehashte Bundles ändern sich nie).
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      return hit || fetch(req);
    })(),
  );
});
