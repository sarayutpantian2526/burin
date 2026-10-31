/* BURIN offline cache: the app and its libraries keep working without internet */
const CACHE = 'burin-v102';
const SHELL = ['./', './index.html', './config.js', './vendor/supabase.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', './icon-maskable-512.png', './favicon-64.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const lib = /(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname);
  if (u.origin === location.origin) {
    /* app files: network first so updates arrive, cache when offline */
    const fresh = r.mode === 'navigate' || /\.(html|js|webmanifest)$/.test(u.pathname) ? fetch(u.href, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(r);
    e.respondWith(fresh.then((res) => { const c = res.clone(); if (res.ok && !u.search) caches.open(CACHE).then((k) => k.put(r, c)); return res; }).catch(() => caches.match(r).then((m) => m || caches.match('./index.html'))));
  } else if (lib) {
    /* fixed-version libraries and fonts: cache first */
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put(r, c)); return res; })));
  }
});
