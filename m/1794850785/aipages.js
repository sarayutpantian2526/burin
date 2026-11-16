/* BURIN part: aipages (loaded when first used) */
/* ---------- pages for the AI (task 8.10): the part m/aipages.js, switched off with "aipages" in flags.json.
   The question maker can take any number of pages: this page, pages picked by hand, a chapter of the contents, a
   range of pages, or the whole notebook (before, at most 5 pages could be picked and only 4 of them were sent).
   Up to AP_DIRECT pages go to the AI as pictures in one call, as before. More pages are read first, AP_BATCH pages
   a call with the 'read' task (the cheaper model when the user lets the app choose): what is written on each page
   (handwriting, the printed content of an imported page, a short note of each figure) is kept on this device until
   that page changes, so a page read once is never sent again for any AI work, and the text can serve the search
   later. When everything picked is too long for one call, it is summed up a stretch of pages at a time (each summary
   is kept too, keyed by what it was made from), then the summaries are put together, so a long notebook is not read
   again for every new set of questions.
   The readings live in their own IndexedDB database ('burin-aird'), not in the store: nothing goes to the cloud, the
   live room or a backup, the notebooks are untouched, and an older version of the app ignores them.
   Pictures are made a few pages at a time and let go after each call; the work is split into short pieces so writing
   never stalls; stopping keeps every page read so far; a call that fails is tried again once, and the next run reads
   only the pages still missing ---------- */
const AP = { db: null, mem: null, memP: null, lk: null, gen: 0, block: 0, chaps: null, chapsFor: '', budget: 8, skipOnce: false, stat: null };
const AP_DIRECT = 4, AP_BATCH = 4, AP_PICK = 25, AP_BLOCK = 50, AP_ASK = 10, AP_TEXT = 12000, AP_PAGE = 3000, AP_SUM = 1400, AP_DAYS = 90;

/* ----- the readings kept on this device ----- */
function apDb() {
  if (!AP.db) AP.db = new Promise((res, rej) => {
    const r = indexedDB.open('burin-aird', 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('rd')) d.createObjectStore('rd'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
  }).catch((e) => { AP.db = null; throw e; });
  return AP.db;
}
/* the readings of one account (or of this device) are apart from another's on the same device */
function apScope() { return S.store && S.store.kind === 'cloud' && typeof CLOUD !== 'undefined' && CLOUD.user ? 'c' + CLOUD.user.id : 'l' + ((S.store && S.store.kind) || ''); }
/* every reading of this scope, once a session: looking one up is then instant */
function apMem() {
  const sc = apScope();
  if (AP.mem && AP.mem.sc === sc) return Promise.resolve(AP.mem.m);
  if (AP.memP && AP.memP.sc === sc) return AP.memP.p;
  const m = new Map(), old = now() - AP_DAYS * 864e5, drop = [];
  const p = apDb().then((d) => new Promise((res) => {
    const t = d.transaction('rd', 'readonly'), q = t.objectStore('rd').openCursor();
    q.onsuccess = () => { const c = q.result; if (!c) return; const k = String(c.key); if (k.indexOf(sc + '|') === 0) { const v = c.value; if (v && v.at > old) m.set(k.slice(sc.length + 1), v); else drop.push(k); } c.continue(); };
    t.oncomplete = () => res(); t.onerror = () => res(); t.onabort = () => res();
  })).catch(() => {}).then(() => {
    AP.mem = { sc, m }; AP.memP = null;
    /* readings older than AP_DAYS days go (the page is read again if needed) */
    if (drop.length) apDb().then((d) => { const t = d.transaction('rd', 'readwrite'), st = t.objectStore('rd'); for (const k of drop) st.delete(k); }).catch(() => {});
    return m;
  });
  AP.memP = { sc, p };
  return p;
}
async function apPut(key, v) {
  const m = await apMem(); m.set(key, v);
  try { const d = await apDb(); await new Promise((res) => { const t = d.transaction('rd', 'readwrite'); t.objectStore('rd').put(v, apScope() + '|' + key); t.oncomplete = res; t.onerror = res; t.onabort = res; }); } catch (e) { /* kept for this session only */ }
}
function apHash(s) { let h = 2166136261 >>> 0, g = 5381; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h ^= c; h = Math.imul(h, 16777619) >>> 0; g = (Math.imul(g, 33) + c) >>> 0; } return h.toString(36) + g.toString(36); }

/* ----- what a page is, as the AI would see it ----- */
/* raw read of a saved page (nothing here writes) */
function apDoc(pid) {
  if (pid === S.pid && S.page) return S.page;
  try { return S.store && typeof S.store.peek === 'function' ? S.store.peek('pages/' + pid) : null; } catch (e) { return null; }
}
/* the layers of the saved pages, found once a run from the names in the store (a copy of each layer otherwise) */
async function apLayers(pid) {
  if (S.store && typeof S.store.keys === 'function' && typeof S.store.peek === 'function') {
    if (!AP.lk) {
      AP.lk = new Map();
      for (const k of S.store.keys()) { const m = /^pages\/([^/]+)\/layers\/[^/]+$/.exec(k); if (m) { const a = AP.lk.get(m[1]); if (a) a.push(k); else AP.lk.set(m[1], [k]); } }
    }
    return (AP.lk.get(pid) || []).map((k) => S.store.peek(k)).filter(Boolean);
  }
  return S.store ? S.store.list('pages/' + pid + '/layers').catch(() => []) : [];
}
async function apStrokes(pid) {
  if (pid === S.pid) return allStrokes().map((r) => r.s).filter((s) => s && s.k !== 'h');
  const out = []; for (const l of await apLayers(pid)) for (const s of (l && l.strokes) || []) if (s && s.k !== 'h') out.push(s); return out;
}
/* the typed text of a page goes to the AI as text, never by picture */
function apTyped(pg) { return ((pg && pg.items) || []).filter((it) => it && !it.teacher && (!it.type || it.type === 'text') && it.md).map((it) => it.md).join('\n'); }
/* a key for what a picture of the page holds: its lines and its page pictures (an imported PDF). The same page gives
   the same key on any later day; a line added, moved or rubbed out gives another */
async function apInfo(pid) {
  const pg = apDoc(pid), st = await apStrokes(pid), bgs = ((pg && pg.items) || []).filter(isBgItem);
  let s = '';
  for (const x of st) { const p = x.p || [], n = p.length; s += (x.id || '') + ',' + n + ',' + p[0] + ',' + p[1] + ',' + p[n - 2] + ',' + p[n - 1] + ',' + (x.c || '') + ';'; }
  for (const it of bgs) s += '#' + it.asset + ',' + Math.round(it.x || 0) + ',' + Math.round(it.y || 0) + ',' + Math.round(it.w || 0);
  return { pid, pg, n: st.length, bg: bgs.length, h: st.length || bgs.length ? apHash(s) : '', typed: apTyped(pg) };
}
/* how many of the pages picked still need the AI to read them (pages with only typed text never do) */
async function apCount(pids, alive) {
  const m = await apMem(); let n = 0, t0 = performance.now();
  for (const pid of pids) {
    if (performance.now() - t0 > AP.budget) { await new Promise((r) => setTimeout(r, 0)); if (alive && !alive()) return -1; t0 = performance.now(); }
    const f = await apInfo(pid); if (!f.h) continue;
    const r = m.get('p' + pid); if (!r || r.h !== f.h) n++;
  }
  return n;
}

/* ----- the picker in the question maker ----- */
function apPages() { return (S.nb && S.nb.pages) || []; }
function apMode() { const pages = apPages(), sel = gaPids(); return !GA.custom ? 'cur' : sel.length === pages.length && pages.length > 1 ? 'all' : 'pick'; }
function apSet(pids) {
  const pages = apPages(), at = new Map(pages.map((p, i) => [p, i]));
  const ok = [...new Set(pids)].filter((p) => at.has(p)).sort((a, z) => at.get(a) - at.get(z));
  GA.custom = true; GA.pids = ok.length ? ok : (S.pid ? [S.pid] : []); apRender();
}
function apBtn(label, on, fn, cls) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (cls ? ' ' + cls : ''); b.textContent = label;
  b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.onclick = fn; return b;
}
function apDiv(cls, html) { const d = document.createElement('div'); d.className = cls; if (html) d.innerHTML = html; return d; }
/* the chapters of the notebook from its contents (task 8.2): a heading starts a chapter that runs to the next one */
async function apChapters(alive) {
  const pages = apPages(), key = S.nid + ':' + pages.length + ':' + pages[0] + ':' + pages[pages.length - 1];
  if (AP.chaps && AP.chapsFor === key) return AP.chaps;
  try { await need('toc'); } catch (e) { return []; }
  const out = []; let last = '', t0 = performance.now();
  for (let k = 0; k < pages.length; k++) {
    if (performance.now() - t0 > AP.budget) { await new Promise((r) => setTimeout(r, 0)); if (alive && !alive()) return null; t0 = performance.now(); }
    const h = (tocHeads(apDoc(pages[k])) || []).filter((x) => x.lv === 1)[0];
    if (h && h.t !== last) { out.push({ t: h.t, a: k, b: pages.length - 1 }); if (out.length > 1) out[out.length - 2].b = k - 1; }
    if (h) last = h.t;
  }
  AP.chaps = out; AP.chapsFor = key; return out;
}
function apRender() {
  const el = $('#aiPages'); if (!el) return;
  const gen = ++AP.gen, pages = apPages(), sel = gaPids(), N = pages.length, mode = apMode(), on = new Set(sel);
  el.innerHTML = ''; el.classList.add('apick');
  const hint = $('#aiPagesHint'); if (hint) hint.textContent = N > AP_PICK ? 'เลือกตามบท เป็นช่วงหน้า หรือแตะทีละหน้า' : 'แตะเลือกได้หลายหน้า';
  /* quick choices */
  const q = apDiv('apq');
  q.appendChild(apBtn('หน้านี้', mode === 'cur', () => { GA.custom = false; GA.pids = null; apRender(); }));
  q.appendChild(apBtn('เลือกเอง', mode === 'pick', () => { if (mode !== 'pick') apSet(S.pid ? [S.pid] : []); }));
  if (N > 1) q.appendChild(apBtn(tr('ทั้งเล่ม ' + N + ' หน้า', 'Whole notebook, ' + N + ' pages'), mode === 'all', () => apSet(pages.slice())));
  el.appendChild(q);
  /* a long notebook: by chapter, or a range of pages */
  if (N > AP_PICK) {
    const ch = apDiv('apch'); ch.setAttribute('role', 'group'); el.appendChild(ch);
    apChapters(() => gen === AP.gen).then((list) => {
      if (gen !== AP.gen || !list || !list.length) { ch.remove(); return; }
      ch.appendChild(apDiv('apcap', 'ตามบท'));
      const box = apDiv('apchl'); ch.appendChild(box);
      for (const c of list) {
        const ids = pages.slice(c.a, c.b + 1), all = ids.every((p) => on.has(p));
        const b = apBtn('', all, () => { const cur = new Set(GA.custom ? gaPids() : []); if (all) ids.forEach((p) => cur.delete(p)); else ids.forEach((p) => cur.add(p)); apSet([...cur]); }, 'apchip');
        b.innerHTML = '<span class="apct"></span><small></small>'; b.firstChild.textContent = c.t; b.lastChild.textContent = c.a === c.b ? tr('หน้า ' + (c.a + 1), 'page ' + (c.a + 1)) : tr('หน้า ' + (c.a + 1) + ' ถึง ' + (c.b + 1), 'pages ' + (c.a + 1) + ' to ' + (c.b + 1));
        box.appendChild(b);
      }
    }).catch(() => ch.remove());
    const rg = apDiv('aprg');
    rg.innerHTML = '<span class="apcap">ช่วงหน้า</span><input type="number" inputmode="numeric" min="1" aria-label="ตั้งแต่หน้า"><span class="apto"></span><input type="number" inputmode="numeric" min="1" aria-label="ถึงหน้า"><button class="btn sm" type="button">เลือกช่วงนี้</button>';
    const [i1, i2] = rg.querySelectorAll('input'), cur = pages.indexOf(S.pid);
    rg.querySelector('.apto').textContent = tr('ถึง', 'to');
    i1.max = i2.max = String(N); i1.value = String(Math.max(1, cur + 1)); i2.value = String(Math.min(N, Math.max(1, cur + 1) + 9));
    rg.querySelector('button').onclick = () => {
      let a = Math.round(+i1.value), z = Math.round(+i2.value);
      if (!(a >= 1) || !(z >= 1)) { toast(tr('ใส่เลขหน้าตั้งแต่ 1 ถึง ' + N, 'Give page numbers from 1 to ' + N), 1800); return; }
      a = clamp(a, 1, N); z = clamp(z, 1, N); if (z < a) { const t = a; a = z; z = t; }
      const cur2 = new Set(GA.custom ? gaPids() : []); pages.slice(a - 1, z).forEach((p) => cur2.add(p)); apSet([...cur2]);
    };
    el.appendChild(rg);
  }
  /* page by page; a long notebook shows AP_BLOCK pages at a time */
  const blocks = Math.ceil(N / AP_BLOCK);
  if (blocks > 1) {
    if (AP.block >= blocks) AP.block = 0;
    const bl = apDiv('apbl');
    for (let k = 0; k < blocks; k++) {
      const a = k * AP_BLOCK, z = Math.min(N, a + AP_BLOCK), n = pages.slice(a, z).filter((p) => on.has(p)).length;
      const b = apBtn((a + 1) + '-' + z + (n ? ' (' + n + ')' : ''), k === AP.block, () => { AP.block = k; apRender(); }, 'apblk');
      bl.appendChild(b);
    }
    el.appendChild(bl);
  }
  const grid = apDiv('apgrid');
  const a0 = blocks > 1 ? AP.block * AP_BLOCK : 0;
  pages.slice(a0, a0 + AP_BLOCK).forEach((pid, j) => {
    const i = a0 + j;
    const b = apBtn(pid === S.pid ? (i + 1) + ' หน้านี้' : String(i + 1), on.has(pid), () => {
      const cur = GA.custom ? gaPids().slice() : (S.pid ? [S.pid] : []), k = cur.indexOf(pid);
      if (k >= 0) { if (cur.length > 1) cur.splice(k, 1); } else cur.push(pid);
      apSet(cur);
    }, pid === S.pid ? 'cur' : '');
    grid.appendChild(b);
  });
  el.appendChild(grid);
  /* what was picked, and how much the AI still has to read */
  const sum = apDiv('apsum');
  const sp = document.createElement('span'); sp.textContent = sel.length > 1 ? tr('เลือกแล้ว ' + sel.length + ' หน้า', sel.length + ' pages picked') : ''; sum.appendChild(sp);
  if (GA.custom && sel.length > 1) { const c = document.createElement('button'); c.type = 'button'; c.className = 'btn sm'; c.textContent = 'ล้างที่เลือก'; c.onclick = () => { GA.custom = false; GA.pids = null; apRender(); }; sum.appendChild(c); }
  const nd = document.createElement('small'); nd.className = 'apneed'; nd.id = 'apNeed'; sum.appendChild(nd);
  el.appendChild(sum);
  const lab = $('#bGenPage');
  if (lab) lab.textContent = mode === 'all' ? tr('สร้างโจทย์จากทั้งเล่ม (' + N + ' หน้า)', 'Make questions from the whole notebook (' + N + ' pages)') : sel.length > 1 ? 'สร้างโจทย์จาก ' + sel.length + ' หน้าที่เลือก' : (sel[0] === S.pid ? 'สร้างโจทย์จากหน้านี้' : 'สร้างโจทย์จากหน้า ' + (pages.indexOf(sel[0]) + 1));
  apNeedShow(sel, gen);
}
/* before the button is pressed: how many pages the AI has to read again (said when more than AP_ASK) */
function apNeedShow(sel, gen) {
  const nd = $('#apNeed'); if (!nd) return;
  if (sel.length <= AP_DIRECT || !apImgOk()) { nd.textContent = ''; return; }
  const put = (n) => {
    if (gen !== AP.gen) return; const el = $('#apNeed'); if (!el) return;
    el.textContent = n > AP_ASK ? tr('AI ต้องอ่านใหม่ ' + n + ' หน้า ส่งครั้งละ ' + AP_BATCH + ' หน้า รวม ' + Math.ceil(n / AP_BATCH) + ' ครั้ง หน้าที่อ่านแล้วใช้ซ้ำได้ทันที', 'The AI has to read ' + n + ' pages, ' + AP_BATCH + ' a call, ' + Math.ceil(n / AP_BATCH) + ' calls; pages read before are used again at once')
      : n > 0 ? tr('AI ต้องอ่านใหม่ ' + n + ' หน้า', 'The AI has to read ' + n + ' pages') : tr('อ่านทุกหน้าที่เลือกไว้แล้ว เริ่มได้ทันที', 'Every page picked was read before: it starts at once');
  };
  /* counted again each time: a page may have changed on this device or another since */
  nd.textContent = '';
  apCount(sel, () => gen === AP.gen).then((n) => { if (n >= 0) put(n); }).catch(() => {});
}
function apImgOk() { const l = AI.limits('read'); return !l || !!l.images; }
/* the question maker uses this part when more pages are picked than go in one call */
function apWanted(fromSel, more) { return !fromSel && !more && gaPids().length > AP_DIRECT; }

/* ----- reading the pages, a few at a time ----- */
async function apShot(f) {
  if (f.bg) { const sh = await pageShot(f.pid, await apStrokes(f.pid)); if (sh) return sh.blob; }
  const st = await apStrokes(f.pid); if (!st.length) return null;
  const b = await strokesBlob(st.map((x) => ({ s: x }))); return b ? b.blob : null;
}
const AP_FATAL = /^(not_granted|sampling_disabled|not_declared|capability_disabled|capability_removed|bad_key|bad_model|ai_off|session_expired|images_unavailable|cancelled|refused)$/;
async function apReadBatch(fs, nums, signal) {
  const images = [];
  for (const f of fs) { const b = await apShot(f); images.push(b); }
  const keep = fs.filter((f, i) => images[i]), imgs = images.filter(Boolean);
  if (!imgs.length) return 0;
  const prompt = 'You read pages of a notebook for a teacher. The ' + imgs.length + ' attached image' + (imgs.length > 1 ? 's are' : ' is') + ' ' + (imgs.length > 1 ? 'pages ' + keep.map((f) => nums.get(f.pid)).join(', ') + ', one image per page in that order' : 'page ' + nums.get(keep[0].pid)) + '.\n'
    + 'Transcribe each page: write down everything on it as text: the handwriting, the printed text of an imported page, every equation in LaTeX between $...$, tables row by row, and for each figure, graph or diagram one short line in square brackets saying what it shows with its labels and values. Do not translate, explain, solve, correct or add anything. A page with nothing readable gets (empty).\n'
    + 'Reply in exactly this format and nothing else:\n' + keep.map((f, i) => '@@PAGE ' + (i + 1) + '\n(what page ' + nums.get(f.pid) + ' says)').join('\n');
  let res = null, err = null;
  for (let t = 0; t < 2 && !res; t++) {
    if (signal.aborted) throw { code: 'cancelled' };
    try { res = await AI.run('read', prompt, { images: imgs, signal, maxTokens: 1500 * imgs.length, cache: false }); }
    catch (e) { err = e; if (e && AP_FATAL.test(e.code || '')) throw e; }
  }
  images.length = 0; imgs.length = 0;
  if (!res) throw err || { code: 'empty_completion' };
  const ps = sections(String(res.text || '')).filter((p) => p.key === 'PAGE');
  let got = 0;
  for (let i = 0; i < keep.length; i++) {
    const p = ps.find((x) => +x.arg === i + 1) || (ps.length === keep.length ? ps[i] : null);
    if (!p) continue;
    const t = /^\(?empty\)?$/i.test(String(p.text || '').trim()) ? '' : String(p.text || '').trim().slice(0, AP_PAGE);
    await apPut('p' + keep[i].pid, { h: keep[i].h, t, at: now() }); got++;
  }
  return got;
}
/* a stretch of notes made shorter, kept by what it was made from */
async function apSum(parts, signal) {
  const body = parts.join('\n\n'), key = 's' + apHash(body);
  const m = await apMem(), had = m.get(key); if (had) return had.t;
  const prompt = 'Below are notes from a stretch of a notebook, page by page. Write a compact summary of them for a teacher who will write questions from it: keep every concept, definition, rule, formula (LaTeX between $...$), symbol, unit and the given values of each worked example, in the order of the pages, and keep the [page n] labels of where each part comes from. At most ' + Math.round(AP_SUM / 6) + ' words. Reply with the summary only.\n\n' + body;
  let res = null, err = null;
  for (let t = 0; t < 2 && !res; t++) {
    if (signal.aborted) throw { code: 'cancelled' };
    try { res = await AI.run('read', prompt, { signal, maxTokens: 1500, cache: false }); }
    catch (e) { err = e; if (e && AP_FATAL.test(e.code || '')) throw e; }
  }
  if (!res || !String(res.text || '').trim()) throw err || { code: 'empty_completion' };
  const t = String(res.text).trim().slice(0, AP_SUM * 2);
  await apPut(key, { h: '', t, at: now() });
  return t;
}
/* the source of a question set made from many pages: what each page says, put together (summed up when too long).
   Returns null when it ended here (stopped, or pages could not be read), after saying so in the card */
async function apSource(pids, B) {
  const signal = B.ctl.signal, pages = apPages(), nums = new Map(pages.map((p, i) => [p, i + 1]));
  const stat = AP.stat = { pages: pids.length, read: 0, calls: 0, sums: 0, t0: performance.now() };
  AP.lk = null;
  const m = await apMem(), useImg = apImgOk(), skip = AP.skipOnce; AP.skipOnce = false;
  const fs = []; let t0 = performance.now();
  B.status(tr('กำลังดูหน้าที่เลือก', 'Looking at the pages picked'));
  for (const pid of pids) {
    if (performance.now() - t0 > AP.budget) { await new Promise((r) => setTimeout(r, 0)); t0 = performance.now(); }
    if (signal.aborted) break;
    fs.push(await apInfo(pid));
  }
  const todo = useImg && !skip ? fs.filter((f) => f.h && (!m.get('p' + f.pid) || m.get('p' + f.pid).h !== f.h)) : [];
  const failed = []; let done = 0, fatal = null;
  for (let k = 0; k < todo.length && !signal.aborted && !fatal; k += AP_BATCH) {
    const part = todo.slice(k, k + AP_BATCH);
    B.status(tr('AI กำลังอ่านหน้า ' + Math.min(todo.length, k + part.length) + ' จาก ' + todo.length, 'The AI is reading page ' + Math.min(todo.length, k + part.length) + ' of ' + todo.length));
    try { done += await apReadBatch(part, nums, signal); stat.calls++; }
    catch (e) { if (e && AP_FATAL.test(e.code || '')) { fatal = e; break; } failed.push.apply(failed, part); }
  }
  stat.read = done;
  /* the picker counts again what is left to read */
  setTimeout(() => { const d = $('#ai'); if (d && !d.hidden) apRender(); }, 0);
  if (signal.aborted || (fatal && fatal.code === 'cancelled')) { apEnd(B, tr('หยุดแล้ว AI อ่านไว้ ' + done + ' หน้า เก็บไว้ใช้ครั้งหน้า ไม่ต้องอ่านซ้ำ', 'Stopped. The AI read ' + done + ' pages; they are kept and will not be read again'), done); return null; }
  if (fatal) { B.d.innerHTML = '<span class="k">อ่านหน้า</span><div class="note err">' + esc(aiErr(fatal)) + '</div>'; return null; }
  /* pages the AI could not read: try those again, or go on with the pages read */
  const unread = fs.filter((f) => f.h && useImg && !(m.get('p' + f.pid) && m.get('p' + f.pid).h === f.h));
  if (failed.length && !skip) {
    B.d.innerHTML = '<span class="k">อ่านหน้า</span><div class="note err"></div><div class="row"><button class="btn solid" type="button" data-a="again">ลองอ่านเฉพาะหน้าที่ยังไม่ได้</button><button class="btn" type="button" data-a="go">สร้างโจทย์จากหน้าที่อ่านได้</button></div>';
    B.d.querySelector('.err').textContent = tr('AI อ่านไม่ได้ ' + unread.length + ' หน้า (หน้า ' + unread.slice(0, 12).map((f) => nums.get(f.pid)).join(', ') + (unread.length > 12 ? ' ...' : '') + ') หน้าที่อ่านได้แล้วเก็บไว้ ไม่ต้องอ่านซ้ำ', 'The AI could not read ' + unread.length + ' pages (' + unread.slice(0, 12).map((f) => nums.get(f.pid)).join(', ') + (unread.length > 12 ? ' ...' : '') + '). The pages read are kept');
    B.d.querySelector('[data-a="again"]').onclick = () => { B.d.remove(); generate(false); };
    B.d.querySelector('[data-a="go"]').onclick = () => { B.d.remove(); AP.skipOnce = true; generate(false); };
    return null;
  }
  /* what each page says, in the order of the notebook */
  let parts = [];
  for (const f of fs) {
    const r = m.get('p' + f.pid), rd = f.h && r && r.h === f.h ? r.t : '';
    const tx = String(f.typed || '').slice(0, 2500).trim();
    if (!tx && !rd) continue;
    parts.push('[page ' + nums.get(f.pid) + ']\n' + [tx, rd].filter(Boolean).join('\n'));
  }
  if (!parts.length) { B.d.remove(); toast('หน้าที่เลือกยังไม่มีเนื้อหาให้สร้างโจทย์'); return null; }
  /* too long for one call: summed up a stretch at a time, again until it fits (each summary is kept) */
  try {
    for (let level = 0; parts.join('\n\n').length > AP_TEXT && level < 6; level++) {
      const groups = []; let g = [], len = 0;
      for (const p of parts) { if (g.length && len + p.length > AP_TEXT * 0.8) { groups.push(g); g = []; len = 0; } g.push(p); len += p.length; }
      if (g.length) groups.push(g);
      if (groups.length === parts.length && level) { parts = parts.map((p) => p.slice(0, Math.floor(AP_TEXT / parts.length))); break; }
      const next = [];
      for (let k = 0; k < groups.length; k++) {
        if (signal.aborted) throw { code: 'cancelled' };
        B.status(tr('AI กำลังสรุปทีละช่วง ' + (k + 1) + ' จาก ' + groups.length, 'The AI is summing up part ' + (k + 1) + ' of ' + groups.length));
        const gg = groups[k];
        next.push(gg.length === 1 && gg[0].length <= AP_SUM * 2 ? gg[0] : await apSum(gg, signal)); stat.sums++;
      }
      parts = next;
    }
  } catch (e) {
    if (e && e.code === 'cancelled') { apEnd(B, tr('หยุดแล้ว หน้าที่อ่านและสรุปไว้แล้วเก็บไว้ใช้ครั้งหน้า', 'Stopped. What was read and summed up is kept for next time'), done); return null; }
    B.d.innerHTML = '<span class="k">สรุปหน้า</span><div class="note err">' + esc(aiErr(e)) + '</div><div class="row"><button class="btn solid" type="button" data-a="again">ลองอีกครั้ง</button></div>';
    B.d.querySelector('[data-a="again"]').onclick = () => { B.d.remove(); generate(false); };
    return null;
  }
  stat.ms = Math.round(performance.now() - stat.t0);
  const list = pids.map((p) => nums.get(p));
  return { images: [], read: true, text: parts.join('\n\n').slice(0, AP_TEXT + 2000), label: pids.length + ' notebook pages (' + apRanges(list) + '); below is what is on them, typed or read from the handwriting and pictures page by page' + (parts.length < pids.length && parts.some((p) => !/^\[page \d+\]/.test(p)) ? ', summed up a stretch at a time' : '') };
}
function apEnd(B, msg) { B.d.innerHTML = '<span class="k">อ่านหน้า</span><div class="note"></div>'; B.d.querySelector('.note').textContent = msg; }
/* 1, 2, 3, 5, 7, 8 -> "pages 1-3, 5, 7-8" */
function apRanges(ns) {
  const out = []; let a = null, b = null;
  for (const n of ns.slice().sort((x, y) => x - y)) { if (a === null) { a = b = n; } else if (n === b + 1) b = n; else { out.push(a === b ? '' + a : a + '-' + b); a = b = n; } }
  if (a !== null) out.push(a === b ? '' + a : a + '-' + b);
  return 'pages ' + out.join(', ');
}
/* for the search (later) and the tests: the kept reading of a page, when it is still what the page holds */
async function apReading(pid) { const m = await apMem(), f = await apInfo(pid), r = m.get('p' + pid); return f.h && r && r.h === f.h ? r.t : ''; }

