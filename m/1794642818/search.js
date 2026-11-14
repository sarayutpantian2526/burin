/* BURIN part: search (loaded when first used) */
/* ---------- finding words in every notebook: typed text, handwriting already turned into type, page headings and the
   words in boxes (titles of graphs and experiments, tables, labels), across every notebook of this side. Read only:
   nothing is ever written to a notebook. Thai has no spaces between words, so the text and the words looked for are
   both compared without spaces; a page is a hit when it has every word looked for. The pages are read a few at a time
   between frames, so a shelf of many notebooks does not freeze an iPad, and the words of a page are remembered until
   that page changes (a page that changes is a new object in the store) ---------- */
const FIND = { gen: 0, memo: new WeakMap(), seg: null, max: 120, budget: 8 }; /* max is written in the message shown when there are more */
/* the same letters written two ways compare the same: sara am typed as two marks (the tone mark before or after the circle), zero-width spaces, wide forms */
function findNorm(s) {
  let t = String(s || '');
  try { t = t.normalize('NFKC'); } catch (e) { /* old engine */ }
  return t.replace(/\u0E4D([\u0E48-\u0E4B]?)\u0E32/g, '$1\u0E33').replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '').toLowerCase();
}
/* where each letter of the text without spaces came from in the text as written (only for the excerpt of a page found) */
function findCompact(s) {
  let out = ''; const at = [];
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (/\s/.test(c)) continue; out += c; at.push(i); }
  return { out, at };
}
/* markup is not part of the words: tags, markdown marks, the dollar signs around an equation */
function findPlain(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/(\*\*|__|`|~~)/g, '').replace(/^\s{0,3}(#{1,6}|>|[-*+]\s)\s*/gm, '').replace(/\$+/g, ' ').replace(/[ \t]+/g, ' ').trim();
}
/* the words of one box, as short parts that each say where they are */
function findItemParts(it) {
  const out = [];
  const add = (t) => { const p = findPlain(t); if (p) out.push(p); };
  if (!it || typeof it !== 'object') return out;
  if (typeof it.md === 'string') add(it.md);
  if (typeof it.text === 'string') add(it.text);
  for (const k of ['title', 'label', 'expr', 'fn', 'caption', 'cap', 'name']) if (typeof it[k] === 'string') add(it[k]);
  if (it.kind && typeof SIMS !== 'undefined' && SIMS[it.kind] && SIMS[it.kind].title) add(SIMS[it.kind].title);
  if (Array.isArray(it.rows)) add(it.rows.map((r) => (Array.isArray(r) ? r.join(' ') : '')).join(' '));
  if (it.plan && typeof it.plan === 'object') add(Object.keys(it.plan).map((k) => (typeof it.plan[k] === 'string' ? it.plan[k] : '')).join(' '));
  if (typeof it.svg === 'string' && it.svg.indexOf('<text') >= 0) { const m = it.svg.match(/<text[^>]*>[^<]*/g); if (m) add(m.map((x) => x.replace(/<text[^>]*>/, '')).join(' ')); }
  return out;
}
/* every part of a page: its heading first (the page's own title, or the first line of the box nearest the top) */
function findPageParts(doc) {
  if (!doc) return { head: '', parts: [] };
  if (FIND.memo.has(doc)) return FIND.memo.get(doc);
  const parts = [];
  let head = typeof doc.title === 'string' ? findPlain(doc.title) : '', from = null;
  if (head) { from = { item: '', text: head, head: true }; parts.push(from); }
  const items = (Array.isArray(doc.items) ? doc.items : []).slice().sort((a, b) => ((a && a.y) || 0) - ((b && b.y) || 0) || ((a && a.x) || 0) - ((b && b.x) || 0));
  for (const it of items) {
    for (const t of findItemParts(it)) {
      const p = { item: (it && it.id) || '', text: t };
      if (!head && (!it.type || it.type === 'text')) { head = t.split('\n').map((x) => x.trim()).filter(Boolean)[0] || ''; if (head) from = p; }
      parts.push(p);
    }
  }
  for (const p of parts) p.c = findNorm(p.text).replace(/\s+/g, '');
  /* a long first line is shortened at a word edge, never inside a word */
  if (head.length > 60) { let cut = 0; for (const x of findEdges(head)) { if (x > 60) break; cut = x; } head = head.slice(0, cut || 60).trim() + ' ...'; }
  const r = { head, from, parts };
  FIND.memo.set(doc, r);
  return r;
}
/* the words looked for, each without spaces; a phrase typed with spaces still finds the same words written without */
function findTerms(q) {
  const n = findNorm(findPlain(q));
  const all = n.replace(/\s+/g, '');
  const words = n.split(/\s+/).filter(Boolean);
  return { all, words: words.length ? words : (all ? [all] : []) };
}
/* how well a page matches, and the part to show; null when a word is missing */
function findMatch(pp, T) {
  if (!T.all) return null;
  const joined = pp.parts.map((p) => p.c).join('\u0001');
  for (const w of T.words) if (joined.indexOf(w) < 0) return null;
  let best = null, count = 0, boxed = '';
  for (const p of pp.parts) {
    let i = p.c.indexOf(T.all), len = T.all.length, score = 3;
    if (i < 0) { for (const w of T.words) { const j = p.c.indexOf(w); if (j >= 0) { i = j; len = w.length; score = 1; break; } } }
    if (i < 0) continue;
    if (p.head) score += 2;
    for (let k = i; k >= 0 && count < 99; k = p.c.indexOf(p.c.substr(i, len), k + len)) count++;
    if (!best || score > best.score) best = { part: p, i, len, score };
    if (!boxed && p.item) boxed = p.item;
  }
  /* found in the page's own title: the box pointed at is the first box that has the words too */
  if (best) { best.count = count; best.item = best.part.item || boxed; }
  return best;
}
/* where a line may start or end: at a word edge, never inside a Thai word, a number with its unit, or a name */
function findEdges(s) {
  if (FIND.seg === null) { try { FIND.seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : false; } catch (e) { FIND.seg = false; } }
  const e = [0];
  if (FIND.seg) { for (const x of FIND.seg.segment(s)) if (x.index) e.push(x.index); }
  else for (let i = 1; i < s.length; i++) if (/\s/.test(s[i - 1]) && !/\s/.test(s[i])) e.push(i);
  e.push(s.length);
  return e;
}
/* a short piece of the text around what was found, cut at word edges, with what was found marked */
function findExcerpt(m) {
  const src = m.part.text, at = findCompact(findNorm(src)).at;
  /* the text as written and its letters compared without spaces line up one to one after findNorm in nearly all text;
     when they do not (a letter that changes length), the excerpt starts at the beginning instead of in a wrong place */
  const ok = findNorm(src).length === src.length;
  const a = ok ? at[m.i] : 0, b = ok ? at[m.i + m.len - 1] + 1 : 0;
  const edges = findEdges(src);
  let s0 = 0, s1 = src.length;
  for (const x of edges) { if (x <= Math.max(0, a - 36)) s0 = x; if (x >= Math.min(src.length, b + 60)) { s1 = x; break; } }
  if (!ok) { s0 = 0; s1 = Math.min(src.length, 120); for (const x of edges) if (x >= 120) { s1 = x; break; } }
  const piece = (x, y) => esc(src.slice(x, y).replace(/\s+/g, ' '));
  const lead = s0 > 0 ? '... ' : '', tail = s1 < src.length ? ' ...' : '';
  if (!ok || b <= a) return lead + piece(s0, s1) + tail;
  return lead + piece(s0, a) + '<mark>' + piece(a, b) + '</mark>' + piece(b, s1) + tail;
}
/* raw read of a page in the store when it has one (no copy: nothing here writes), a copy otherwise */
async function findDoc(path) {
  if (S.store && typeof S.store.peek === 'function') return S.store.peek(path);
  return S.store ? S.store.get(path) : null;
}
/* search the notebooks given, a few pages each frame; onHit gets each page found, onDone the totals.
   Starting another search stops this one */
async function findRun(q, nbs, onHit, onDone, alive) {
  const gen = ++FIND.gen, T = findTerms(q);
  let pages = 0, hits = 0, t0 = performance.now(), slice = 0; /* slice: the longest the search held the page at once */
  const stopped = () => gen !== FIND.gen || (alive && !alive());
  if (!T.all) { onDone({ pages, hits, slice }); return; }
  for (const nb of nbs) {
    const list = (nb && nb.pages) || [];
    for (let k = 0; k < list.length; k++) {
      if (stopped()) return;
      const t = performance.now() - t0; if (t > slice) slice = t;
      if (t > FIND.budget) { await new Promise((r) => setTimeout(r, 0)); if (stopped()) return; t0 = performance.now(); }
      const pid = list[k];
      let doc = null; try { doc = await findDoc('pages/' + pid); } catch (e) { doc = null; }
      pages++;
      if (!doc) continue;
      const pp = findPageParts(doc), m = findMatch(pp, T);
      if (!m) continue;
      hits++;
      /* the heading is not repeated when what was found is in the heading's own box */
      onHit({ nb, pid, n: k + 1, head: m.part === pp.from ? '' : pp.head, item: m.item, html: findExcerpt(m), count: m.count || 1 });
      if (hits >= FIND.max) { onDone({ pages, hits, more: true, slice }); return; }
    }
  }
  if (!stopped()) onDone({ pages, hits, more: false, slice: Math.max(slice, performance.now() - t0) });
}
/* the results under the notebooks found by name in the library; tapping one opens that page and points at the box */
function findShow(q, box) {
  box.innerHTML = '';
  const h = document.createElement('h3'); h.className = 'shelfh findh'; h.textContent = 'พบในหน้าสมุด'; box.appendChild(h);
  const st = document.createElement('div'); st.className = 'note findst'; st.setAttribute('role', 'status'); st.textContent = 'กำลังค้นในทุกเล่ม'; box.appendChild(st);
  const list = document.createElement('div'); list.className = 'findlist'; list.setAttribute('role', 'list'); box.appendChild(list);
  const groups = new Map();
  findRun(q, (S.nbs || []).slice(), (r) => {
    let g = groups.get(r.nb.id);
    /* what people wrote (notebook names, headings, excerpts) carries the class nbname, so the app's own translation of
       its labels into another language never changes it; only the labels around it are translated */
    if (!g) { g = document.createElement('div'); g.className = 'findnb'; const t = document.createElement('b'); t.className = 'nbname'; t.textContent = r.nb.title || 'สมุด'; g.appendChild(t); list.appendChild(g); groups.set(r.nb.id, g); }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'findhit'; b.setAttribute('role', 'listitem');
    b.dataset.nb = r.nb.id; b.dataset.pid = r.pid; b.dataset.item = r.item;
    b.innerHTML = '<span class="findpg"><span></span><span class="nbname"></span></span><span class="findtx nbname">' + r.html + '</span>';
    b.querySelector('.findpg > span').textContent = 'หน้า ' + r.n;
    if (r.head) b.querySelector('.findpg > .nbname').textContent = ' ' + r.head;
    b.onclick = () => findGo(r.nb.id, r.pid, r.item);
    g.appendChild(b);
  }, (d) => {
    if (!box.isConnected) return;
    /* each sentence whole (the list of labels for other languages has them word for word) */
    st.textContent = d.hits ? 'พบ ' + d.hits + ' หน้า' : 'ไม่พบข้อความนี้ในหน้าสมุด ลายมือที่ยังไม่ได้แปลงเป็นตัวพิมพ์ค้นไม่ได้';
    if (d.more) { const m2 = document.createElement('span'); m2.className = 'findmore'; m2.textContent = 'แสดงเฉพาะ 120 หน้าแรก พิมพ์คำให้ยาวขึ้นเพื่อให้ตรงกว่านี้'; st.appendChild(document.createTextNode(' ')); st.appendChild(m2); }
  }, () => box.isConnected);
}
/* go to the page and point at the box: the page moves so the box is in view, and the box glows for a moment */
function findGo(nid, pid, itemId) {
  FIND.gen++;
  closeSheets();
  openNotebook(nid, pid);
  if (!itemId) return;
  let tries = 0;
  const sel = '#page .item[data-id="' + String(itemId).replace(/["\\]/g, '') + '"]';
  const look = () => {
    if (S.pid !== pid) { if (++tries < 30) setTimeout(look, 100); return; }
    const it = ((S.page && S.page.items) || []).find((x) => x && x.id === itemId);
    const el = document.querySelector(sel);
    if (!it || !el) { if (++tries < 30) setTimeout(look, 100); return; }
    if (!FLOW.on && vp) {
      const k = S.base * S.zoom, top = S.ty + (it.y || 0) * k, vh = vp.clientHeight;
      if (top < 60 || top > vh * 0.7) { S.ty = vh * 0.3 - (it.y || 0) * k; S.pull = 0; clampT(); applyT(); }
    } else if (el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    /* the box may be drawn again while it glows (a graph once its maths has loaded): the new one glows too */
    const until = Date.now() + 2600;
    el.classList.add('findglow');
    const keep = () => { const e2 = document.querySelector(sel); if (Date.now() >= until || S.pid !== pid) { if (e2) e2.classList.remove('findglow'); return; } if (e2 && !e2.classList.contains('findglow')) e2.classList.add('findglow'); setTimeout(keep, 150); };
    setTimeout(keep, 150);
  };
  setTimeout(look, 60);
}

