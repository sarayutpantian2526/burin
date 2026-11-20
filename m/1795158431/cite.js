/* BURIN part: cite (loaded when first used) */
/* ---------- references and captions: a reference from its DOI (or found by title) is kept with the notebook and cited on
   the page in the chosen style; a reference list page is made from them. Pictures, graphs and tables get numbered
   captions, renumbered in page order across the notebook ---------- */
const CITE_STYLES = [['apa', 'APA 7'], ['ieee', 'IEEE'], ['van', 'Vancouver']];
function citeRefs() { return ((S.nb && S.nb.refs) || []).slice(); }
function citeSave(refs) { S.nb = Object.assign({}, S.nb, { refs }); S.store.update('notebooks/' + S.nid, { refs }).catch(() => {}); }
function citeStyle() { return (S.nb && S.nb.citeStyle) || store_ls.get('tp-citestyle') || 'apa'; }
function citeDoi(s) { const m = String(s || '').trim().match(/(10\.\d{4,9}\/[^\s"<>]+)/); return m ? m[1].replace(/[.,;)\]]+$/, '') : ''; }
async function citeFetch(doi) {
  const r = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(r.status === 404 ? 'ไม่พบ DOI นี้' : 'ค้นไม่สำเร็จ');
  return citeMeta((await r.json()).message);
}
async function citeSearch(q) {
  const r = await fetch('https://api.crossref.org/works?rows=6&query.bibliographic=' + encodeURIComponent(q));
  if (!r.ok) throw new Error('ค้นไม่สำเร็จ');
  return ((await r.json()).message.items || []).map(citeMeta);
}
/* only what a reference needs, so the notebook stays small */
function citeMeta(m) {
  const yr = ((m.issued && m.issued['date-parts'] && m.issued['date-parts'][0]) || (m.published && m.published['date-parts'] && m.published['date-parts'][0]) || [])[0] || '';
  return { doi: m.DOI || '', type: m.type || '', title: ((m.title || [])[0] || '').replace(/\s+/g, ' ').trim(), au: (m.author || []).slice(0, 25).map((a) => ({ f: a.family || a.name || '', g: a.given || '' })),
    yr: String(yr), jn: ((m['container-title'] || [])[0] || ''), vol: m.volume || '', iss: m.issue || '', pg: m.page || m['article-number'] || '', pub: m.publisher || '', url: m.URL || '' };
}
const ini = (g) => g.split(/[\s-]+/).filter(Boolean).map((x) => x[0].toUpperCase() + '.').join(' ');
function citeFull(r, style, n) {
  const au = r.au || [], doi = r.doi ? 'https://doi.org/' + r.doi : r.url || '';
  if (style === 'ieee') {
    const names = au.map((a) => (a.g ? ini(a.g) + ' ' : '') + a.f); const who = names.length > 6 ? names[0] + ' et al.' : names.length > 1 ? names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1] : (names[0] || '');
    return '[' + n + '] ' + (who ? who + ', ' : '') + '"' + r.title + ',"' + (r.jn ? ' *' + r.jn + '*,' : '') + (r.vol ? ' vol. ' + r.vol + ',' : '') + (r.iss ? ' no. ' + r.iss + ',' : '') + (r.pg ? (/[-–]/.test(r.pg) ? ' pp. ' : ' Art. no. ') + r.pg + ',' : '') + (r.yr ? ' ' + r.yr : '') + (r.doi ? ', doi: ' + r.doi : '') + '.';
  }
  if (style === 'van') {
    const names = au.map((a) => a.f + (a.g ? ' ' + a.g.split(/[\s-]+/).filter(Boolean).map((x) => x[0].toUpperCase()).join('') : '')); const who = names.length > 6 ? names.slice(0, 6).join(', ') + ', et al' : names.join(', ');
    return n + '. ' + (who ? who + '. ' : '') + r.title + '. ' + (r.jn ? r.jn + '. ' : '') + (r.yr || '') + (r.vol ? ';' + r.vol : '') + (r.iss ? '(' + r.iss + ')' : '') + (r.pg ? ':' + r.pg : '') + '.' + (r.doi ? ' doi:' + r.doi : '');
  }
  const names = au.map((a) => a.f + (a.g ? ', ' + ini(a.g) : ''));
  const who = names.length > 20 ? names.slice(0, 19).join(', ') + ', ... ' + names[names.length - 1] : names.length > 1 ? names.slice(0, -1).join(', ') + ', & ' + names[names.length - 1] : (names[0] || '');
  return (who ? who + ' ' : '') + '(' + (r.yr || 'n.d.') + '). ' + r.title + '.' + (r.jn ? ' *' + r.jn + '*' + (r.vol ? ', *' + r.vol + '*' : '') + (r.iss ? '(' + r.iss + ')' : '') + (r.pg ? ', ' + r.pg : '') + '.' : (r.pub ? ' ' + r.pub + '.' : '')) + (doi ? ' ' + doi : '');
}
function citeInText(r, style, n) {
  if (style !== 'apa') return '[' + n + ']';
  const au = r.au || [], y = r.yr || 'n.d.';
  return '(' + (au.length === 0 ? (r.title || '').split(' ').slice(0, 3).join(' ') : au.length === 1 ? au[0].f : au.length === 2 ? au[0].f + ' & ' + au[1].f : au[0].f + ' et al.') + ', ' + y + ')';
}
function openCite() {
  closeSheets(); let sh = $('#citeSheet');
  if (!sh) {
    sh = document.createElement('div'); sh.id = 'citeSheet'; sh.className = 'sheet vidsheet';
    sh.innerHTML = '<div class="panel wide" role="dialog" aria-label="อ้างอิง"><div class="mvhead"><h2>อ้างอิงและบรรณานุกรม</h2><button type="button" class="btn" data-a="x">ปิด</button></div>'
      + '<div class="vaset"><label class="field"><span>DOI ลิงก์ หรือชื่อบทความ</span><input data-a="q" placeholder="เช่น 10.1103/PhysRevLett.116.061102"></label><label class="field"><span>รูปแบบ</span><select data-a="st">' + CITE_STYLES.map((x) => '<option value="' + x[0] + '">' + x[1] + '</option>').join('') + '</select></label></div>'
      + '<div class="row2"><button type="button" class="btn solid" data-a="find">ค้นและเพิ่ม</button><button type="button" class="btn" data-a="bib">สร้างหน้าบรรณานุกรมท้ายสมุด</button></div><div class="ctfound"></div><h3>อ้างอิงในสมุดนี้</h3><div class="ctlist"></div></div>';
    document.body.appendChild(sh);
    const q = (a) => sh.querySelector('[data-a="' + a + '"]');
    q('x').onclick = () => { sh.hidden = true; };
    q('st').onchange = () => { store_ls.set('tp-citestyle', q('st').value); S.nb = Object.assign({}, S.nb, { citeStyle: q('st').value }); S.store.update('notebooks/' + S.nid, { citeStyle: q('st').value }).catch(() => {}); citeList(); };
    q('find').onclick = () => citeFind(q('q').value);
    q('q').onkeydown = (e) => { if (e.key === 'Enter') citeFind(q('q').value); };
    q('bib').onclick = citeBibPage;
  }
  sh.querySelector('[data-a="st"]').value = citeStyle(); sh.hidden = false; citeList();
}
async function citeFind(text) {
  const box = $('#citeSheet .ctfound'), doi = citeDoi(text); if (!String(text).trim()) return;
  box.innerHTML = '<div class="note small">กำลังค้น</div>';
  try {
    if (doi) { const r = await citeFetch(doi); citeAdd(r); box.innerHTML = ''; return; }
    const list = await citeSearch(text);
    if (!list.length) { box.innerHTML = '<div class="note small">ไม่พบ ลองใส่ DOI</div>'; return; }
    box.innerHTML = '<div class="note small">เลือกรายการที่ถูกต้อง</div>' + list.map((r, i) => '<button type="button" class="btn ctpick" data-i="' + i + '">' + esc(citeFull(r, 'apa', i + 1)) + '</button>').join('');
    box.querySelectorAll('.ctpick').forEach((b) => { b.onclick = () => { citeAdd(list[+b.dataset.i]); box.innerHTML = ''; }; });
  } catch (e) { box.innerHTML = '<div class="note err">' + esc(e.message || 'ค้นไม่สำเร็จ') + ' ต้องเชื่อมต่ออินเทอร์เน็ต</div>'; }
}
function citeAdd(r) {
  const refs = citeRefs(); let i = refs.findIndex((x) => r.doi && x.doi && x.doi.toLowerCase() === r.doi.toLowerCase());
  if (i < 0) { refs.push(Object.assign({ id: 'r' + uid() }, r)); i = refs.length - 1; citeSave(refs); }
  citeList(); toast('เพิ่มในรายการอ้างอิงแล้ว กดอ้างในหน้าเพื่อวางที่หน้านี้', 2400);
}
function citeList() {
  const box = $('#citeSheet .ctlist'), refs = citeRefs(), st = citeStyle();
  if (!refs.length) { box.innerHTML = '<div class="note small">ยังไม่มีรายการอ้างอิง</div>'; return; }
  box.innerHTML = refs.map((r, i) => '<div class="ctrow"><div class="ctref">' + esc(citeFull(r, st, i + 1)) + '</div><div class="row2"><button type="button" class="btn" data-c="' + i + '">อ้างในหน้า ' + esc(citeInText(r, st, i + 1)) + '</button><button type="button" class="btn" data-d="' + i + '">ลบ</button></div></div>').join('');
  box.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { const i = +b.dataset.c, r = refs[i], w = 260, at = viewSpot(w, 60); addItem({ type: 'text', x: at[0], y: at[1], w, md: citeInText(r, st, i + 1), cite: r.id }); $('#citeSheet').hidden = true; toast('วางการอ้างแล้ว ลากไปไว้ท้ายประโยคได้', 2000); }; });
  box.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => { const rr = citeRefs(); rr.splice(+b.dataset.d, 1); citeSave(rr); citeList(); }; });
}
async function citeBibPage() {
  const refs = citeRefs(); if (!refs.length) { toast('ยังไม่มีรายการอ้างอิง', 1800); return; }
  const st = citeStyle(), sorted = st === 'apa' ? refs.slice().sort((a, b) => ((a.au[0] || {}).f || a.title).localeCompare((b.au[0] || {}).f || b.title)) : refs;
  const md = '## ' + (st === 'apa' ? 'บรรณานุกรม' : 'เอกสารอ้างอิง') + '\n\n' + sorted.map((r) => citeFull(r, st, refs.indexOf(r) + 1)).join('\n\n');
  $('#citeSheet').hidden = true;
  await addPage({ at: 'end' }); await new Promise((r) => setTimeout(r, 400));
  addItem({ type: 'text', x: 60, y: 50, w: Math.min(W - 120, 900), md, fs: 16 });
  toast('สร้างหน้าบรรณานุกรมท้ายสมุดแล้ว', 2000);
}
/* ----- numbered captions: รูปที่ n for pictures and graphs, ตารางที่ n for tables, in page order through the notebook ----- */
async function captionSel() {
  if (!S.sel || S.sel.items.length !== 1) return; const it = findItem(S.sel.items[0]); if (!it) return;
  const isTab = it.type === 'lab' || (!it.type || it.type === 'text') && /\|\s*-{3}/.test(it.md || '');
  const text = (prompt((isTab ? 'คำบรรยายตาราง' : 'คำบรรยายรูป') + ' (เลขที่จะใส่ให้เอง)', '') || '').trim(); if (!text) return;
  const b = itemBox(it), w = Math.max(200, b[2] - b[0]), kind = isTab ? 'tab' : 'fig';
  addItem({ type: 'text', x: b[0], y: isTab ? Math.max(0, b[1] - 40) : b[3] + 6, w, md: (isTab ? '**ตารางที่ 0** ' : '**รูปที่ 0** ') + text, cap: kind, capFor: it.id });
  clearSel(); await captionRenumber(true);
}
async function captionRenumber(quiet) {
  if (!S.nb) return; savePage.flush && savePage.flush();
  const n = { fig: 0, tab: 0 }; let changed = 0;
  for (const pid of S.nb.pages || []) {
    const pg = pid === S.pid ? S.page : await S.store.get('pages/' + pid).catch(() => null); if (!pg || !pg.items) continue;
    const caps = pg.items.filter((x) => x.cap === 'fig' || x.cap === 'tab').sort((a, b) => a.y - b.y || a.x - b.x); if (!caps.length) continue;
    const items = pg.items.map((x) => Object.assign({}, x)); let dirty = false;
    for (const c of caps) { n[c.cap]++; const it = items.find((x) => x.id === c.id), lab = (c.cap === 'tab' ? 'ตารางที่ ' : 'รูปที่ ') + n[c.cap], md = String(it.md || '').replace(/^\*\*(รูปที่|ตารางที่) \d+\*\*/, '**' + lab + '**'); if (md !== it.md) { it.md = md; dirty = true; } }
    if (!dirty || pg.lock) continue; changed++; /* a locked record page keeps its numbers */
    if (pid === S.pid) { S.page = Object.assign({}, S.page, { items }); savePage(); renderItems(); }
    else await S.store.set('pages/' + pid, Object.assign({}, pg, { items, rev: now() }));
  }
  if (!quiet || changed) toast('จัดเลขรูป ' + n.fig + ' รูป และตาราง ' + n.tab + ' ตาราง ตามลำดับหน้าแล้ว', 2200);
}

