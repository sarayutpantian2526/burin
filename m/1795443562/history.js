/* BURIN part: history (loaded when first used) */
/* ---------- earlier versions of a page (task 8.3): the part m/history.js, switched off with "history" in flags.json.
   While a page is open the app keeps, on this device, what the page looked like:
     'open'     when the page was opened (if it changed since the last version: on another device, yesterday)
     'auto'     every few minutes of writing, and when leaving the page or the app
     'cut'      just before many lines were erased, a box was removed, or typed text was written over
     'restore'  just before an earlier version was brought back, so bringing one back can itself be undone
   Each version keeps every line of every writer and every box of the page. A line or a box that did not change is kept
   once for all the versions of the page (a pool keyed by what it is), so a version costs only what changed.
   The versions live in their own IndexedDB database ('burin-hist'), not in the store: nothing goes to the cloud or the
   live room, the notebooks and the backup of this device are untouched, and an older version of the app ignores them.
   Limits: HIST_MAX versions per page, thinned to one an hour after an hour and one a day after a day, none
   older than HIST_DAYS days; the oldest pages' versions go first when all of them pass HIST_BYTES ---------- */
const HIST = { wk: new WeakMap(), db: null, cur: null, timer: 0, since: 0, pool: new Map(), q: Promise.resolve(), sel: -1, view: null, busy: false };
const HIST_GAP = 5 * 60e3, HIST_MAX = 80, HIST_DAYS = 30, HIST_BYTES = 48e6, HIST_IDLE = 1500, HIST_WAIT = 10e3;
/* the words of this part are given in Thai and English here (numbers and times go between them) */
const HIST_WHY = { open: ['ตอนเปิดหน้า', 'When the page was opened'], auto: ['ระหว่างเขียน', 'While writing'], cut: ['ก่อนลบหรือเขียนทับ', 'Before erasing or writing over'], restore: ['ก่อนคืนรุ่นก่อน', 'Before an earlier version came back'] };
function histDb() {
  if (!HIST.db) HIST.db = new Promise((res, rej) => {
    const r = indexedDB.open('burin-hist', 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('rec')) d.createObjectStore('rec'); if (!d.objectStoreNames.contains('idx')) d.createObjectStore('idx'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
  }).catch((e) => { HIST.db = null; throw e; });
  return HIST.db;
}
async function histTx(mode, fn) {
  const d = await histDb();
  return new Promise((res, rej) => {
    const t = d.transaction(['rec', 'idx'], mode), out = fn(t.objectStore('rec'), t.objectStore('idx'));
    t.oncomplete = () => res(out && typeof out === 'object' && 'result' in out ? out.result : out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
/* the versions of the pages of one account (or of this device) are apart from another's on the same device */
function histScope() { return S.store.kind === 'cloud' && typeof CLOUD !== 'undefined' && CLOUD.user ? 'c' + CLOUD.user.id : 'l' + S.store.kind; }
function histH(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
/* what a line is: its id, its look (colour, width, kind ...) and all its points; a line that moved or changed is another */
function histSk(s) {
  const p = s.p || [], n = p.length;
  /* a line that is the same object with the same ends, length and look as last time has the same key (moving a line
     changes its ends, recolouring its look): the points are summed again only for a new or changed line */
  const q = n + ',' + p[0] + ',' + p[1] + ',' + p[n - 3] + ',' + p[n - 2] + ',' + s.c + ',' + s.w + ',' + s.k + ',' + s.t + ',' + s.id, m = HIST.wk.get(s);
  if (m && m.q === q) return m.k;
  const k = histSk0(s); HIST.wk.set(s, { q, k }); return k;
}
function histSk0(s) {
  const p = s.p || []; let a = 0;
  for (let i = 0; i < p.length; i++) { const v = p[i]; a += (typeof v === 'number' ? v : v && v.length ? (+v[0] || 0) + (+v[1] || 0) * 3 : 0) * ((i % 7) + 1); }
  return (s.id || '') + '.' + histH(JSON.stringify(s, (k, v) => (k === 'p' || k === 'ck' ? undefined : v)) + '|' + p.length + '|' + Math.round(a * 10));
}
function histIk(it) { return (it.id || '') + '.' + histH(JSON.stringify(it)); }
const histText = (it) => (!it.type || it.type === 'text' ? String(it.md || '').length : 0);
/* the open page as keys into the pool (a line or a box seen for the first time is copied once) */
function histCap() {
  if (!S.pid || !S.page) return null;
  const ink = {}, items = []; let n = 0, tx = 0;
  const layer = (lid, arr) => {
    const ks = [];
    for (const s of arr || []) { if (!s || !s.p) continue; const k = histSk(s); ks.push(k); if (!HIST.pool.has(k)) HIST.pool.set(k, clone(s)); }
    if (ks.length) { ink[lid] = ks; n += ks.length; }
  };
  layer(DEV, S.mine);
  for (const lid of Object.keys(S.others || {})) if (lid !== DEV) layer(lid, S.others[lid]);
  for (const it of S.page.items || []) { if (!it) continue; const k = histIk(it); items.push(k); tx += histText(it); if (!HIST.pool.has(k)) HIST.pool.set(k, clone(it)); }
  const paper = S.page.paper || 'grid', orient = S.page.orient === 'land' ? 'land' : '';
  const sig = histH(Object.keys(ink).sort().map((l) => l + ':' + ink[l].join(',')).join(';') + '#' + items.join(',') + '#' + paper + orient);
  return { pid: S.pid, at: now(), paper, orient, items, ink, n, ni: items.length, tx, sig };
}
/* a lot went at once: several lines erased (or moved), a box removed, or typed text written over */
function histLoss(a, b) {
  if (!a || !b) return false;
  const have = new Set(); for (const l in b.ink) for (const k of b.ink[l]) have.add(k);
  let gone = 0; for (const l in a.ink) for (const k of a.ink[l]) if (!have.has(k)) gone++;
  if (gone >= 3) return true;
  const ids = new Set(b.items.map((k) => k.split('.')[0]));
  if (a.items.some((k) => !ids.has(k.split('.')[0]))) return true;
  return a.tx - b.tx >= 20;
}
/* fewer versions as they get older: all of the last hour, then one an hour for a day, then one a day (a version kept
   just before erasing or bringing one back counts apart from the others); none older than HIST_DAYS days, at most
   HIST_MAX (the oldest go first) */
function histThin(v) {
  const t = now(), seen = new Set(), out = [];
  for (let i = v.length - 1; i >= 0; i--) {
    const x = v[i], age = t - (+x.at || 0);
    if (age > HIST_DAYS * 864e5) continue;
    const g = x.why === 'cut' || x.why === 'restore' ? 'c' : 'a';
    const b = age > 864e5 ? g + 'd' + Math.floor(x.at / 864e5) : age > 3600e3 ? g + 'h' + Math.floor(x.at / 3600e3) : '';
    if (b) { if (seen.has(b)) continue; seen.add(b); }
    out.push(x);
  }
  out.reverse();
  return out.length > HIST_MAX ? out.slice(out.length - HIST_MAX) : out;
}
/* only what the open page's versions (and its last look) still use stays in the pool */
function histGc() {
  const c = HIST.cur, keep = new Set();
  const use = (x) => { if (!x) return; for (const k of x.items) keep.add(k); for (const l in x.ink) for (const k of x.ink[l]) keep.add(k); };
  if (c) { use(c.prev); for (const x of (c.rec && c.rec.v) || []) use(x); for (const x of c.wait) use(x); }
  for (const k of [...HIST.pool.keys()]) if (!keep.has(k)) HIST.pool.delete(k);
}
function histVer(cap, why) { return { at: cap.at, why, sig: cap.sig, paper: cap.paper, orient: cap.orient, items: cap.items, ink: cap.ink, n: cap.n, ni: cap.ni, tx: cap.tx }; }
/* a version joins the page's list unless the page looks the same as the last one kept */
function histPush(cap, why) {
  const c = HIST.cur; if (!c || !cap || cap.pid !== c.pid) return false;
  const list = c.rec ? c.rec.v : c.wait, last = list[list.length - 1];
  if (last && last.sig === cap.sig) return false;
  list.push(histVer(cap, why)); c.lastAt = cap.at; c.dirty = true;
  return true;
}
/* the page's record written out (one after another, never two at once) */
function histSave(c) {
  c = c || HIST.cur;
  if (!c || !c.rec || !c.dirty) return HIST.q;
  c.dirty = false;
  c.rec.v = histThin(c.rec.v);
  const pool = {}; let size = 0;
  for (const x of c.rec.v) {
    for (const k of x.items) if (!pool[k] && HIST.pool.has(k)) { pool[k] = HIST.pool.get(k); size += JSON.stringify(pool[k]).length; }
    for (const l in x.ink) for (const k of x.ink[l]) if (!pool[k] && HIST.pool.has(k)) { const s = HIST.pool.get(k); pool[k] = s; size += ((s.p && s.p.length) || 0) * 9 + 80; }
  }
  const rec = { pid: c.pid, nid: c.nid, v: c.rec.v.slice(), pool };
  const last = rec.v[rec.v.length - 1], key = c.key;
  HIST.q = HIST.q.then(() => histTx('readwrite', (r, i) => {
    if (!rec.v.length) { r.delete(key); i.delete(key); return; }
    r.put(rec, key); i.put({ pid: rec.pid, at: (last && last.at) || now(), n: rec.v.length, size }, key);
  })).catch(() => { /* this device keeps no versions (private window, no room): the page itself is not affected */ });
  if (c === HIST.cur) histGc();
  return HIST.q;
}
function histDue() {
  clearTimeout(HIST.timer); HIST.timer = 0; HIST.since = 0;
  const c = HIST.cur; if (!c || !c.ready || c.pid !== S.pid) return;
  const cap = histCap(); if (!cap) return;
  let w = false;
  if (histLoss(c.prev, cap)) w = histPush(c.prev, 'cut') || w;
  if (cap.at - (c.lastAt || 0) >= HIST_GAP) w = histPush(cap, 'auto') || w;
  c.prev = cap;
  if (w) histSave(c); else histGc();
}
/* the page has loaded (its boxes and its lines arrived), or it waited long enough */
function histStart(c) {
  if (HIST.cur !== c || c.ready) return;
  if (S.pid !== c.pid) return;
  const loaded = S.ownLoaded && S.pageLoaded === c.pid;
  if (!loaded && now() - c.t0 < 6000) { setTimeout(() => histStart(c), 300); return; }
  if (!c.rec && now() - c.t0 < 6000) { setTimeout(() => histStart(c), 300); return; }
  c.ready = true;
  const cap = histCap(); c.prev = cap;
  if (cap && histPush(cap, 'open')) histSave(c);
}
/* called by the main file: 'open' (a page was opened), 'save' (it is being saved), 'leave' (another page is opened
   next), 'hide' (the app goes to the background) */
function histNote(why) {
  if (why === 'open') {
    if (HIST.cur && HIST.cur.pid === S.pid) return;
    histNote('leave');
    const pid = S.pid; if (!pid) return;
    const c = { pid, nid: S.nid, key: histScope() + '|' + pid, rec: null, wait: [], prev: null, ready: false, lastAt: 0, t0: now(), dirty: false };
    HIST.cur = c; HIST.pool.clear();
    histTx('readonly', (r) => r.get(c.key)).then((rec) => {
      if (HIST.cur !== c) return;
      rec = rec && Array.isArray(rec.v) ? rec : { v: [], pool: {} };
      for (const k in rec.pool || {}) if (!HIST.pool.has(k)) HIST.pool.set(k, rec.pool[k]);
      c.rec = { v: rec.v.filter((x) => x && x.sig && Array.isArray(x.items) && x.ink) };
      const last = c.rec.v[c.rec.v.length - 1]; if (last) c.lastAt = +last.at || 0;
      for (const x of c.wait) if (x.sig !== (c.rec.v[c.rec.v.length - 1] || {}).sig) c.rec.v.push(x);
      c.wait = []; if (c.dirty) histSave(c);
    }).catch(() => { if (HIST.cur === c) c.rec = { v: [] }; });
    setTimeout(() => histStart(c), 400);
    return;
  }
  const c = HIST.cur;
  if (!c || c.pid !== S.pid) return;
  if (why === 'leave' || why === 'hide') {
    clearTimeout(HIST.timer); HIST.timer = 0; HIST.since = 0;
    if (c.ready) {
      const cap = histCap();
      if (histLoss(c.prev, cap)) histPush(c.prev, 'cut');
      histPush(cap, 'auto'); c.prev = cap;
    }
    histSave(c);
    if (why === 'leave') HIST.cur = null;
    return;
  }
  /* saving: looked at once the writing pauses (or every HIST_WAIT while it goes on) */
  if (!c.ready) return;
  if (!HIST.since) HIST.since = now();
  clearTimeout(HIST.timer);
  HIST.timer = setTimeout(histDue, now() - HIST.since > HIST_WAIT ? 0 : HIST_IDLE);
}
/* the versions of the open page, the newest first, and the page as it is now */
function histVersions() {
  const c = HIST.cur; if (!c || c.pid !== S.pid || !c.rec) return null;
  return c.rec.v.slice().reverse();
}
function histBuild(x) {
  const ink = {}; for (const l in x.ink) ink[l] = x.ink[l].map((k) => HIST.pool.get(k)).filter(Boolean);
  return { items: x.items.map((k) => HIST.pool.get(k)).filter(Boolean), ink, paper: x.paper || 'grid', orient: x.orient === 'land' ? 'land' : '' };
}
/* brings one version back onto the open page: every line of every writer and every box as they were. What the page
   looks like now is kept first as a version, so this can be undone the same way */
async function histRestore(x) {
  const c = HIST.cur;
  if (!c || c.pid !== S.pid || !x) return { none: true };
  if (pageLock()) return { lock: true };
  saveMine.flush(); savePage.flush();
  const cap = histCap();
  if (cap) { histPush(cap, 'restore'); c.prev = cap; }
  const v = histBuild(x);
  if (editing) commitEdit();
  clearSel(); S.undo = []; S.redo = []; updUndo();
  const lids = new Set(Object.keys(S.others || {})); for (const l in v.ink) if (l !== DEV) lids.add(l);
  S.mine = clone(v.ink[DEV] || []);
  const others = {}; for (const l of lids) others[l] = clone(v.ink[l] || []); S.others = others;
  S.page = Object.assign({}, S.page, { paper: v.paper, items: clone(v.items) }); if (v.orient === 'land') S.page.orient = 'land'; else delete S.page.orient;
  applyOrient(S.page); drawBg(); drawInk(); renderItems(); renderPaperChips();
  savePage(); saveMine(); for (const l of lids) saveOther(l);
  savePage.flush(); saveMine.flush();
  if (typeof refreshCurThumb === 'function') refreshCurThumb();
  c.prev = histCap(); c.lastAt = now();
  await histSave(c);
  return { ok: true };
}
/* ---------- the sheet: the list of versions, a picture of the chosen one, and the button that brings it back ---------- */
function histWhen(t) {
  const d = new Date(t), td = new Date(), ago = now() - t;
  const hm = d.toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' });
  if (ago < 60e3) return tr('เมื่อสักครู่', 'Just now');
  if (ago < 3600e3) { const m = Math.floor(ago / 60e3); return tr(m + ' นาทีก่อน', m + (m === 1 ? ' minute ago' : ' minutes ago')); }
  const day = (x) => Math.floor((x.getTime() - x.getTimezoneOffset() * 60e3) / 864e5), dd = day(td) - day(d);
  if (dd === 0) return tr('วันนี้ ', 'Today ') + hm;
  if (dd === 1) return tr('เมื่อวาน ', 'Yesterday ') + hm;
  return d.toLocaleDateString(LOC, { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + hm;
}
function histEl(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
/* a picture of one version: the paper and the lines on a canvas, the boxes over it, made smaller to fit */
function histDraw(host, v) {
  host.innerHTML = '';
  /* the whole page in view: as wide as the space, no taller than most of the screen */
  const [pw, ph] = pageDims({ orient: v.orient }), k = Math.min(1, (host.clientWidth || 420) / pw, Math.max(260, (window.innerHeight || 800) * 0.62) / ph);
  const box = histEl('div', 'histpg'); box.style.width = Math.round(pw * k) + 'px'; box.style.height = Math.round(ph * k) + 'px';
  const pg = histEl('div', 'histin'); pg.style.width = pw + 'px'; pg.style.height = ph + 'px'; pg.style.transform = 'scale(' + k + ')';
  const cv = document.createElement('canvas'), r = Math.min(2, (window.devicePixelRatio || 1)) * k;
  cv.width = Math.max(1, Math.round(pw * r)); cv.height = Math.max(1, Math.round(ph * r)); cv.style.width = pw + 'px'; cv.style.height = ph + 'px';
  const x = cv.getContext('2d'), keep = [W, H]; let top = [];
  try {
    W = pw; H = ph; x.setTransform(r, 0, 0, r, 0, 0); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, pw, ph); paper(x, v.paper || 'grid');
    const list = []; for (const l in v.ink) for (const s of v.ink[l]) list.push({ s, layer: l });
    const sp = typeof inkSplitItems === 'function' ? inkSplitItems(v.items, list) : [list, []]; top = sp[1];
    drawInto(x, sp[0], null);
  } catch (e) { /* the boxes still show */ } finally { [W, H] = keep; }
  pg.appendChild(cv);
  const its = histEl('div', 'histitems');
  for (const it of v.items) { try { its.appendChild(buildItemEl(it, true)); } catch (e) { /* a box that cannot be drawn here */ } }
  pg.appendChild(its); { const tc = top.length ? inkTopCanvas(top, pw, ph, r) : null; if (tc) pg.appendChild(tc); } box.appendChild(pg); host.appendChild(box);
  try { typeset(its); } catch (e) { /* no maths */ }
}
function histRow(x, i, on) {
  const b = histEl('button', 'histrow' + (on ? ' on' : '')); b.type = 'button'; b.dataset.i = i; b.setAttribute('aria-pressed', on ? 'true' : 'false');
  const t = histEl('b', '', x ? histWhen(+x.at || 0) : tr('หน้าตอนนี้', 'The page now'));
  const w = (x && HIST_WHY[x.why]) || null, s = histEl('span', '', w ? tr(w[0], w[1]) : tr('ที่เห็นอยู่บนจอ', 'As it is on the screen'));
  /* a number stays on one line with its word */
  const cnt = x || HIST.now, n = cnt.n || 0, ni = cnt.ni || 0, m = histEl('small');
  m.append(histEl('span', 'nw', tr('ลายมือ ' + n + ' เส้น', n + (n === 1 ? ' line' : ' lines'))), document.createTextNode(' '), histEl('span', 'nw', tr('กล่อง ' + ni + ' กล่อง', ni + (ni === 1 ? ' box' : ' boxes'))));
  b.append(t, s, m);
  return b;
}
function histPick(i) {
  HIST.sel = i;
  const body = $('#histBody'); if (!body) return;
  for (const r of body.querySelectorAll('.histrow')) { const on = +r.dataset.i === i; r.classList.toggle('on', on); r.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  const list = HIST.view || [], x = i >= 0 ? list[i] : null;
  const pv = body.querySelector('.histview'), host = body.querySelector('.histpic'), act = body.querySelector('.histact');
  if (!pv || !host || !act) return;
  act.innerHTML = '';
  if (!x) {
    histDraw(host, { items: S.page.items || [], ink: Object.assign({ [DEV]: S.mine }, S.others), paper: S.page.paper, orient: S.page.orient });
    act.appendChild(histEl('div', 'note', tr('นี่คือหน้าตอนนี้ เลือกรุ่นในรายการเพื่อดูก่อนคืน', 'This is the page now. Choose a version in the list to see it before bringing it back')));
    return;
  }
  histDraw(host, histBuild(x));
  if (pageLock()) { act.appendChild(histEl('div', 'note', tr('หน้านี้เป็นบันทึกถาวรที่ล็อกแล้ว คืนรุ่นก่อนไม่ได้', 'This page is a locked record. An earlier version cannot be brought back'))); return; }
  const go = histEl('button', 'btn solid', tr('คืนหน้าเป็นรุ่นนี้', 'Bring this version back')); go.type = 'button'; go.id = 'bHistGo';
  go.onclick = async () => {
    if (HIST.busy) return; HIST.busy = true;
    try {
      const r = await histRestore(x);
      if (r.ok) { $('#histSheet').hidden = true; toast(tr('คืนหน้าเป็นรุ่นที่เลือกแล้ว หน้าก่อนคืนอยู่ในรุ่นก่อนของหน้านี้ ย้อนกลับได้', 'The chosen version is back. The page as it was is in the earlier versions, so this can be undone'), 3600); }
      else if (r.lock) toast(tr('หน้านี้เป็นบันทึกถาวรที่ล็อกแล้ว คืนรุ่นก่อนไม่ได้', 'This page is a locked record. An earlier version cannot be brought back'), 2600);
    } catch (e) { onStoreError(e); } finally { HIST.busy = false; }
  };
  act.append(go, histEl('div', 'note', tr('หน้าตอนนี้จะถูกเก็บเป็นรุ่นหนึ่งก่อนคืน จึงย้อนกลับได้', 'The page as it is now is kept as a version first, so this can be undone')));
}
async function histOpen() {
  if (!S.pid) return;
  if (!HIST.cur || HIST.cur.pid !== S.pid) histNote('open');
  /* what was written a moment ago is in the list too */
  saveMine.flush(); savePage.flush();
  const c = HIST.cur;
  for (let i = 0; i < 40 && c && !c.rec; i++) await new Promise((r) => setTimeout(r, 50));
  if (c && !c.ready) { c.t0 = 0; histStart(c); }
  if (c && c.ready) { histDue(); }
  closeSheets();
  const sh = $('#histSheet'), body = $('#histBody'); if (!sh || !body) return;
  sh.hidden = false; body.innerHTML = '';
  HIST.now = histCap() || { n: 0, ni: 0 };
  const all = histVersions() || [];
  /* the newest version can be the page as it is now: it is shown as now */
  HIST.view = all.filter((x, i) => !(i === 0 && HIST.now.sig && x.sig === HIST.now.sig));
  /* the lines break at the spaces between phrases; the number of days stays with its word */
  const note = histEl('div', 'note');
  note.append(tr('แอปเก็บหน้านี้ไว้เอง ตอนเปิดหน้า ระหว่างเขียน และก่อนลบหรือเขียนทับ เก็บไว้ ', 'The app keeps this page by itself when it is opened, while writing, and before erasing or writing over. Kept for '),
    histEl('span', 'nw', tr(HIST_DAYS + ' วัน', HIST_DAYS + ' days')), tr(' เฉพาะในเครื่องนี้', ', on this device only'));
  body.appendChild(note);
  const wrap = histEl('div', 'histwrap');
  const ul = histEl('div', 'histlist'); ul.setAttribute('role', 'group'); ul.setAttribute('aria-label', tr('รุ่นก่อนของหน้านี้', 'Earlier versions of this page'));
  ul.appendChild(histRow(null, -1, false));
  HIST.view.forEach((x, i) => ul.appendChild(histRow(x, i, false)));
  if (!HIST.view.length) ul.appendChild(histEl('div', 'note', tr('ยังไม่มีรุ่นก่อนของหน้านี้ เขียนต่อแล้วแอปจะเก็บให้เอง', 'No earlier versions of this page yet. The app keeps them by itself as you write')));
  ul.addEventListener('click', (e) => { const r = e.target.closest('.histrow'); if (r) histPick(+r.dataset.i); });
  /* the button above the picture, so it is in view without scrolling */
  const pv = histEl('div', 'histview'); pv.append(histEl('div', 'histact'), histEl('div', 'histpic'));
  wrap.append(ul, pv); body.appendChild(wrap);
  histPick(HIST.view.length ? 0 : -1);
}
/* a while after the app opens: versions older than HIST_DAYS days go, so do those of pages deleted for good from this
   device, and the oldest pages' versions when all of them together pass HIST_BYTES */
async function histPurge() {
  let idx = [];
  try {
    idx = await histTx('readonly', (r, i) => {
      const out = []; const q = i.openCursor();
      q.onsuccess = () => { const cu = q.result; if (cu) { out.push([cu.key, cu.value]); cu.continue(); } };
      return { get result() { return out; } };
    });
  } catch (e) { return 0; }
  const t = now(), drop = new Set(), sc = histScope(), local = S.store.kind === 'local' && typeof S.store.peek === 'function';
  for (const [k, e] of idx) {
    if (!e || t - (+e.at || 0) > HIST_DAYS * 864e5) { drop.add(k); continue; }
    if (local && String(k).startsWith(sc + '|') && !S.store.peek('pages/' + e.pid)) drop.add(k);
  }
  let total = 0; const left = idx.filter(([k]) => !drop.has(k)).sort((a, b) => (+b[1].at || 0) - (+a[1].at || 0));
  for (const [k, e] of left) { total += +e.size || 0; if (total > HIST_BYTES && !(HIST.cur && HIST.cur.key === k)) drop.add(k); }
  if (!drop.size) return 0;
  try { await histTx('readwrite', (r, i) => { for (const k of drop) { r.delete(k); i.delete(k); } }); } catch (e) { return 0; }
  return drop.size;
}

