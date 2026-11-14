/* BURIN offline cache: the app and its libraries keep working without internet.
   Source: burin-pro app/sw.js. build.py adds the parts of this release to SHELL, tools/deploy.py sets the cache number. */
const CACHE = 'burin-v261';
const SHELL = ['./', './index.html', './config.js', './vendor/supabase.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', './icon-maskable-512.png', './favicon-64.png', './fonts/burin-hand.woff2', './m/1794638575/scene.js', './m/1794638575/cas.js', './m/1794638575/sketch.js', './m/1794638575/stats.js', './m/1794638575/video.js', './m/1794638575/data.js', './m/1794638575/measure.js', './m/1794638575/imgmeas.js', './m/1794638575/cite.js', './m/1794638575/work.js', './m/1794638575/search.js'];
/* parts of the app loaded on first use live in m/<build>/, one folder per release, so a page left open keeps
   getting the parts of its own release after a new one goes up. Older pages ask for m/<name>.js?v=<build>;
   those are kept under their plain name so they also work offline */
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const lib = /(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname);
  if (u.origin === location.origin) {
    /* app files: network first so updates arrive, cache when offline */
    const fresh = r.mode === 'navigate' || /\.(html|js|webmanifest)$/.test(u.pathname) ? fetch(u.href, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(r);
    const part = /\/m\/(\d+\/)?[a-z0-9]+\.js$/.test(u.pathname), key = part ? u.origin + u.pathname : r;
    const kept = () => caches.match(key).then((m) => m || (part ? caches.match(r, { ignoreSearch: true }) : caches.match('./index.html')));
    e.respondWith(fresh.then((res) => {
      if (!res.ok && part) return kept().then((m) => m || res);
      const c = res.clone(); if (res.ok && (!u.search || part)) caches.open(CACHE).then((k) => k.put(key, c)); return res;
    }).catch(kept));
  } else if (lib) {
    /* fixed-version libraries and fonts: cache first */
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put(r, c)); return res; })));
  }
});
