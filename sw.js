/* BURIN offline cache: the app and its libraries keep working without internet.
   Source: burin-pro app/sw.js. build.py adds the parts of this release to SHELL, tools/deploy.py sets the cache number. */
const CACHE = 'burin-v284';
const SHELL = ['./', './index.html', './config.js', './vendor/supabase.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', './icon-maskable-512.png', './favicon-64.png', './fonts/burin-hand.woff2', './m/1795158431/scene.js', './m/1795158431/cas.js', './m/1795158431/sketch.js', './m/1795158431/stats.js', './m/1795158431/video.js', './m/1795158431/data.js', './m/1795158431/measure.js', './m/1795158431/imgmeas.js', './m/1795158431/cite.js', './m/1795158431/work.js', './m/1795158431/search.js', './m/1795158431/toc.js', './m/1795158431/keep.js', './m/1795158431/trash.js', './m/1795158431/history.js', './m/1795158431/export.js', './m/1795158431/aipages.js', './m/1795158431/cmds.js', './m/1795158431/clean.js', './m/1795158431/ar.js', './m/1795158431/typed.js', './m/1795158431/account.js', './m/1795158431/cloudset.js'];
/* parts of the app loaded on first use live in m/<build>/, one folder per release, so a page left open keeps
   getting the parts of its own release after a new one goes up. Older pages ask for m/<name>.js?v=<build>;
   those are kept under their plain name so they also work offline */
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const lib = /(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname);
  /* a 3D file the app built on this device (task 9.0, m/ar.js): it has an ordinary address only here */
  if (u.origin === location.origin && /\/ar-tmp\/[\w.-]+$/.test(u.pathname)) { e.respondWith(caches.open('burin-ar').then((c) => c.match(u.origin + u.pathname)).then((m) => m || new Response('', { status: 404 }))); return; }
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
