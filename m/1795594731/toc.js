/* BURIN part: toc (loaded when first used) */
/* ---------- contents and bookmarks of one notebook (task 8.2): in a long notebook, jump to a heading or a bookmark at once.
   The contents are made from the headings of the pages: a page's own title, the lines that start with ## (lessons,
   question sets and worksheets put their headings this way), or else the first line of the typed box at the top of the
   page. Bookmarks are pinned by hand and may be given a name; they are a field of the notebook (marks: page id to
   { t: name, at: time }), so a notebook without the field opens as before, and they stay with the notebook: nothing of
   them goes to the live room or a shared lecture (the page sent there is made from the page alone). Reading the
   headings never writes anything; the pages are read a few at a time and the headings of a page are remembered until
   that page changes (a page that changes is a new object in the store) ---------- */
const TOC = { gen: 0, memo: new WeakMap(), seg: null, shown: '', edit: '', budget: 8 };
function tocPlain(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/(\*\*|__|`|~~)/g, '').replace(/^\s{0,3}(#{1,6}|>|[-*+]\s)\s*/, '').replace(/\$+/g, ' ').replace(/[ \t\u00a0]+/g, ' ').trim();
}
/* a long heading is shortened at a word edge, never inside a Thai word, a number with its unit, or a name */
function tocShort(t, max) {
  if (t.length <= max) return t;
  if (TOC.seg === null) { try { TOC.seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : false; } catch (e) { TOC.seg = false; } }
  let cut = 0;
  if (TOC.seg) { for (const x of TOC.seg.segment(t)) { if (x.index > max) break; cut = x.index; } }
  else for (let i = 1; i <= max; i++) if (/\s/.test(t[i - 1]) && !/\s/.test(t[i])) cut = i;
  return t.slice(0, cut || max).trim() + ' ...';
}
/* the headings of one page, top to bottom: [{ t, lv (1 or 2), item }] */
function tocHeads(doc) {
  if (!doc || typeof doc !== 'object') return [];
  if (TOC.memo.has(doc)) return TOC.memo.get(doc);
  const out = [];
  if (typeof doc.title === 'string' && tocPlain(doc.title)) out.push({ t: tocShort(tocPlain(doc.title), 70), lv: 1, item: '' });
  const texts = (Array.isArray(doc.items) ? doc.items : []).filter((it) => it && typeof it === 'object' && (!it.type || it.type === 'text') && typeof (it.md != null ? it.md : it.text) === 'string')
    .sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
  for (const it of texts) {
    for (const line of String(it.md != null ? it.md : it.text).split('\n')) {
      const m = line.match(/^\s{0,3}(#{1,6})\s+(\S.*)$/);
      if (!m) continue;
      const t = tocPlain(m[2]);
      if (t) out.push({ t: tocShort(t, 70), lv: m[1].length <= 2 ? 1 : 2, item: it.id || '' });
    }
  }
  /* no heading written as one: the first line of the typed box at the top of the page, when it is short like a heading */
  if (!out.length) {
    const ph = pageDims(doc)[1];
    for (const it of texts) {
      if ((it.y || 0) > ph * 0.15) break;
      const first = String(it.md != null ? it.md : it.text).split('\n').map(tocPlain).filter(Boolean)[0];
      if (!first) continue;
      if (first.length <= 80) out.push({ t: first, lv: 1, item: it.id || '' });
      break;
    }
  }
  TOC.memo.set(doc, out);
  return out;
}
/* raw read of a page when the store has one (nothing here writes), a copy otherwise */
async function tocDoc(pid) {
  try { return S.store && typeof S.store.peek === 'function' ? S.store.peek('pages/' + pid) : await S.store.get('pages/' + pid); } catch (e) { return null; }
}
function tocMarks(nb) {
  const m = nb && nb.marks && typeof nb.marks === 'object' ? nb.marks : {}, pages = (nb && nb.pages) || [], out = {};
  for (const pid of pages) if (m[pid] && typeof m[pid] === 'object') out[pid] = m[pid];
  return out;
}
/* pin or take out the bookmark of a page, or give it a name (an empty name goes back to the page's heading).
   Only the notebook's marks field changes; a bookmark of a page no longer in the notebook is dropped then */
async function tocMark(pid, on, name) {
  if (!S.nb || !S.nid || !pid || !(S.nb.pages || []).includes(pid)) return false;
  const nid = S.nid, marks = tocMarks(S.nb);
  if (on === false) delete marks[pid];
  else {
    const m = Object.assign({ at: now() }, marks[pid] || {});
    if (typeof name === 'string') { const t = name.replace(/\s+/g, ' ').trim().slice(0, 80); if (t) m.t = t; else delete m.t; }
    marks[pid] = m;
  }
  try { await S.store.update('notebooks/' + nid, { marks }); } catch (e) { onStoreError(e); return false; }
  if (S.nid === nid && S.nb) S.nb = Object.assign({}, S.nb, { marks });
  renderPageList();
  return true;
}
/* open the page, and when the heading is in a box, bring that box into view and let it glow for a moment */
function tocGo(pid, itemId) {
  if (pid !== S.pid) openPage(pid);
  if (window.innerWidth < 900) togglePages(false);
  if (!itemId) return;
  let tries = 0;
  const sel = '#page .item[data-id="' + String(itemId).replace(/["\\]/g, '') + '"]';
  const look = () => {
    if (S.pid !== pid) return;
    const it = ((S.page && S.page.items) || []).find((x) => x && x.id === itemId), el = document.querySelector(sel);
    if (!it || !el) { if (++tries < 30) setTimeout(look, 100); return; }
    /* the view is moved the same way in both ways of turning pages (in continuous scrolling the page is not scrolled
       natively either: the page shown is placed by S.ty) */
    if (vp) {
      const k = S.base * S.zoom, top = S.ty + (it.y || 0) * k, vh = vp.clientHeight;
      if (top < 60 || top > vh * 0.7) { S.ty = vh * 0.3 - (it.y || 0) * k; S.pull = 0; clampT(); applyT(); }
    }
    el.classList.add('findglow'); setTimeout(() => el.classList.remove('findglow'), 2600);
  };
  setTimeout(look, 60);
}
const TOC_IC = {
  edit: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16l1-4 8-8 3 3-8 8z M11.5 5.5l3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  del: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 6l8 8 M14 6l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
};
function tocRow(n, name, cls, cur, onGo) {
  const row = document.createElement('div'); row.className = 'tocrow' + (cls ? ' ' + cls : ''); row.setAttribute('role', 'listitem');
  if (cur) row.setAttribute('aria-current', 'true');
  const b = document.createElement('button'); b.type = 'button'; b.className = 'tocgo';
  b.innerHTML = '<span class="tocn"></span><span class="tocname"></span>';
  b.firstChild.textContent = n; b.lastChild.textContent = name;
  b.onclick = onGo; row.appendChild(b);
  return row;
}
/* the contents in the page drawer: the bookmark button for this page, the bookmarks, then the headings of every page */
async function tocShow(box) {
  const gen = ++TOC.gen, nb = S.nb, nid = S.nid;
  if (!box || !nb) { if (box) box.innerHTML = ''; return; }
  /* a name being typed is not swept away when another device saves the notebook */
  { const f = document.activeElement; if (TOC.edit && f && f.tagName === 'INPUT' && box.contains(f)) return; }
  const pages = (nb.pages || []).slice(), heads = new Array(pages.length);
  let t0 = performance.now();
  for (let k = 0; k < pages.length; k++) {
    if (performance.now() - t0 > TOC.budget) { await new Promise((r) => setTimeout(r, 0)); if (gen !== TOC.gen) return; t0 = performance.now(); }
    heads[k] = tocHeads(await tocDoc(pages[k]));
  }
  if (gen !== TOC.gen || S.nid !== nid) return;
  const marks = tocMarks(S.nb), cur = pages.indexOf(S.pid), frag = document.createDocumentFragment();
  const nameOf = (k) => (marks[pages[k]] && marks[pages[k]].t) || ((heads[k] || [])[0] || {}).t || '';
  /* this page */
  if (cur >= 0) {
    const on = !!marks[S.pid], b = document.createElement('button'); b.type = 'button'; b.className = 'btn tocmk';
    b.textContent = on ? 'เอาที่คั่นหน้านี้ออก' : 'ปักที่คั่นหน้านี้';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const pid = S.pid; b.onclick = () => tocMark(pid, !on);
    frag.appendChild(b);
  }
  /* bookmarks, in the order of the pages */
  const h1 = document.createElement('h3'); h1.textContent = 'ที่คั่นหน้า'; frag.appendChild(h1);
  const ml = document.createElement('div'); ml.className = 'toclist tocmarks'; ml.setAttribute('role', 'list'); frag.appendChild(ml);
  pages.forEach((pid, k) => {
    if (!marks[pid]) return;
    const row = tocRow(String(k + 1), nameOf(k) || 'หน้า ' + (k + 1), 'mark', pid === S.pid, () => tocGo(pid, ''));
    row.dataset.pid = pid;
    if (TOC.edit === pid) {
      const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 80; inp.value = marks[pid].t || nameOf(k); inp.setAttribute('aria-label', 'ชื่อที่คั่นหน้า หน้า ' + (k + 1));
      let done = false;
      const end = (save) => { if (done) return; done = true; TOC.edit = ''; if (save && inp.value.trim() !== (marks[pid].t || nameOf(k))) tocMark(pid, true, inp.value); else tocShow(box); };
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); end(true); } else if (e.key === 'Escape') { e.preventDefault(); end(false); } };
      inp.onblur = () => end(true);
      row.replaceChild(inp, row.firstChild);
      setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) { /* fine */ } }, 0);
    } else {
      const e = document.createElement('button'); e.type = 'button'; e.className = 'btn icon sm'; e.innerHTML = TOC_IC.edit;
      e.setAttribute('aria-label', 'ตั้งชื่อที่คั่นหน้า หน้า ' + (k + 1)); e.title = 'ตั้งชื่อที่คั่นหน้า';
      e.onclick = () => { TOC.edit = pid; tocShow(box); };
      row.appendChild(e);
    }
    const d = document.createElement('button'); d.type = 'button'; d.className = 'btn icon sm'; d.innerHTML = TOC_IC.del;
    d.setAttribute('aria-label', 'เอาที่คั่นหน้าออก หน้า ' + (k + 1)); d.title = 'เอาที่คั่นหน้าออก';
    d.onmousedown = (e) => e.preventDefault(); /* the name being typed is not saved first */
    d.onclick = () => { if (TOC.edit === pid) TOC.edit = ''; tocMark(pid, false); };
    row.appendChild(d);
    ml.appendChild(row);
  });
  if (!ml.children.length) { const n = document.createElement('div'); n.className = 'note'; n.textContent = 'ยังไม่มีที่คั่นหน้า แตะปุ่มด้านบนเพื่อปักที่หน้านี้'; frag.insertBefore(n, ml); }
  /* the headings; the same heading on the pages that follow (a worksheet over several pages) shows once */
  const h2 = document.createElement('h3'); h2.textContent = 'สารบัญ'; frag.appendChild(h2);
  const tl = document.createElement('div'); tl.className = 'toclist tochds'; tl.setAttribute('role', 'list'); frag.appendChild(tl);
  let last = '', curRow = null;
  pages.forEach((pid, k) => {
    for (const hd of heads[k] || []) {
      const key = hd.lv + '|' + hd.t.replace(/\s+/g, '');
      if (key === last) continue;
      last = key;
      const row = tocRow(String(k + 1), hd.t, hd.lv > 1 ? 'sub' : '', false, () => tocGo(pid, hd.item));
      row.dataset.pid = pid;
      if (k <= cur) curRow = row;
      tl.appendChild(row);
    }
  });
  /* the heading of the part being read: the last one at or before this page */
  if (curRow) curRow.setAttribute('aria-current', 'true');
  if (!tl.children.length) { const n = document.createElement('div'); n.className = 'note'; n.textContent = 'ยังไม่มีหัวเรื่อง ข้อความที่พิมพ์ไว้บนสุดของหน้าจะขึ้นเป็นหัวเรื่อง ลายมือที่ยังไม่ได้แปลงเป็นตัวพิมพ์ไม่ขึ้นในสารบัญ'; frag.appendChild(n); }
  box.innerHTML = ''; box.appendChild(frag);
  /* the part being read is in view when the contents open or the page changes */
  const key = nid + '/' + S.pid;
  if (TOC.shown !== key) { TOC.shown = key; const c = tl.querySelector('[aria-current="true"]'); if (c && c.scrollIntoView) setTimeout(() => { try { c.scrollIntoView({ block: 'nearest' }); } catch (e) { /* fine */ } }, 0); }
}

