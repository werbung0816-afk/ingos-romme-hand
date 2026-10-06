/**
 * Chartster Service Worker v1.2
 * Offline-First Cache Strategy
 * 
 * v1.2: Cache-Version auf v213 angehoben → busted alten Cache
 *       romme-hand und andere Spiele nutzen Network First (Updates kommen immer durch)
 */

const CACHE_NAME = 'chartster-v213';
const DATA_CACHE = 'chartster-data-v213';

// App Shell – alles was für den Grundbetrieb gebraucht wird
const SHELL_ASSETS = [
  '/schnuppes-spielportal/chartster/',
  '/schnuppes-spielportal/chartster/index.html',
  '/schnuppes-spielportal/chartster/songs.json',
  '/schnuppes-spielportal/chartster/slot%20machine.mp3',
  '/schnuppes-spielportal/chartster/applause.mp3',
  '/schnuppes-spielportal/chartster/manifest.json',
  '/schnuppes-spielportal/chartster/icons/icon-192x192.png',
  '/schnuppes-spielportal/chartster/icons/icon-512x512.png',
  '/schnuppes-spielportal/chartster/icons/apple-touch-icon.png',
  '/schnuppes-spielportal/chartster/memory.html',
  '/schnuppes-spielportal/chartster/paparazzi.html',
  '/schnuppes-spielportal/chartster/filter/filter-rs500.png',
  '/schnuppes-spielportal/chartster/filter/filter-bondedition.png',
  '/schnuppes-spielportal/chartster/filter/filter-football.png',
  '/schnuppes-spielportal/chartster/filter/filter-kino.png',
];

// Pfade anderer Spiele → nie cachen (Network First damit Updates ankommen)
const GAME_PATHS = [
  '/romme-hand/',
  '/schock-doof/',
  '/memory/',
];

const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=DM+Sans:ital,wght@0,400;0,700&display=swap',
];

// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Install v213');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Konnte nicht cachen:', url, err))
        )
      );
    }).then(() => {
      console.log('[SW] Shell gecacht');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate v213');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== DATA_CACHE)
          .map(k => {
            console.log('[SW] Alter Cache gelöscht:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Spotify & externe APIs → immer Network Only
  if (url.hostname.includes('spotify.com') ||
      url.hostname.includes('open.spotify') ||
      url.hostname.includes('accounts.spotify') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('firebaseio.com')) {
    return;
  }

  // Google Fonts → Cache First
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // songs.json → Network First mit Cache Fallback
  if (url.pathname.endsWith('songs.json')) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  // Andere Spiele (romme-hand etc.) → Network First (Updates kommen immer durch)
  if (GAME_PATHS.some(p => url.pathname.includes(p))) {
    event.respondWith(networkFirst(event.request, CACHE_NAME));
    return;
  }

  // Chartster App Shell → Cache First
  if (url.hostname === self.location.hostname) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }
});

// ── STRATEGIEN ───────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/schnuppes-spielportal/chartster/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline – kein Cache verfügbar', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('{"error":"offline"}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ── MESSAGE HANDLER ──────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0]?.postMessage({ success: true });
    });
  }
});
