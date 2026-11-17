/* BURIN part: trash (loaded when first used) */
/* ---------- the bin (task 1.6): the part m/trash.js, switched off with "trash" in flags.json.
   Deleting a notebook or a page (in the main file) keeps a small record in trash/<nb-id or pg-id>:
     { kind: 'nb', nid, at, nb: the notebook as it was saved }   the pages and their ink stay where they were
     { kind: 'page', nid, pid, idx, at, title }                  the page left its notebook's list, nothing else moved
   This part shows the bin under the notebooks in the menu, brings things back, removes them for good when asked, and
   removes what has waited TRASH_DAYS days (a while after the app opens). It works the same on this device and in
   the cloud: only the usual reads and writes of the store are used. Removing for good never touches a page that is
   back in a notebook (brought back on another device in the meantime) ---------- */
const TRASH = { busy: false };
const TRASH_MS = TRASH_DAYS * 864e5;
function trashDate(t) {
  try { return new Date(t).toLocaleDateString(typeof UI_LANG === 'string' && UI_LANG !== 'th' ? UI_LANG : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch (e) { return new Date(t).toISOString().slice(0, 10); }
}
/* every record in the bin, the newest first (something that is not a record of the bin is left alone) */
async function trashList() {
  const l = await Promise.resolve(S.store.list('trash')).catch(() => []);
  return (l || []).filter((e) => e && ((e.kind === 'nb' && e.nid && e.nb) || (e.kind === 'page' && e.pid))).sort((a, b) => (+b.at || 0) - (+a.at || 0));
}
const trashLeft = (e) => Math.max(0, Math.ceil(((+e.at || 0) + TRASH_MS - now()) / 864e5));
/* the pages some notebook still has: these are never removed */
async function trashInUse() {
  const s = new Set(); for (const n of await Promise.resolve(S.store.list('notebooks')).catch(() => [])) for (const p of (n && n.pages) || []) s.add(p);
  return s;
}
async function trashDropPage(pid, used) {
  if (!pid || used.has(pid)) return;
  const ls = await Promise.resolve(S.store.list('pages/' + pid + '/layers')).catch(() => []);
  for (const l of ls) await Promise.resolve(S.store.del('pages/' + pid + '/layers/' + l.id)).catch(() => {});
  await Promise.resolve(S.store.del('pages/' + pid)).catch(() => {});
}
/* removes one record for good: a notebook with its pages (and the pages of it deleted one by one before), or one page */
async function trashDrop(e, used) {
  used = used || (await trashInUse());
  if (e.kind === 'nb') {
    if (!(await S.store.get('notebooks/' + e.nid))) {
      for (const pid of e.nb.pages || []) await trashDropPage(pid, used);
      for (const x of await trashList()) if (x.kind === 'page' && x.nid === e.nid) { await trashDropPage(x.pid, used); await Promise.resolve(S.store.del('trash/' + x.id)).catch(() => {}); }
    }
  } else await trashDropPage(e.pid, used);
  await S.store.del('trash/' + e.id);
}
/* what has waited long enough is removed; returns how many records */
async function trashPurge() {
  if (TRASH.busy) return 0; TRASH.busy = true;
  let n = 0;
  try {
    const old = (await trashList()).filter((e) => now() - (+e.at || 0) > TRASH_MS);
    if (!old.length) return 0;
    const used = await trashInUse();
    for (const e of old) { try { await trashDrop(e, used); n++; } catch (er) { /* tried again next time */ } }
  } finally { TRASH.busy = false; }
  return n;
}
/* brings one record back: a notebook to the shelf as it was, a page to its place in its notebook. A page whose
   notebook is in the bin brings the notebook back too; a page whose notebook is gone joins the open notebook */
async function trashRestore(e) {
  if (e.kind === 'nb') {
    if (!(await S.store.get('notebooks/' + e.nid))) await S.store.set('notebooks/' + e.nid, Object.assign({}, e.nb, { updatedAt: now() }));
    await S.store.del('trash/' + e.id);
    return { nid: e.nid, title: e.nb.title || '' };
  }
  if (!(await S.store.get('pages/' + e.pid))) { await S.store.del('trash/' + e.id); return { gone: true }; }
  let nid = e.nid, nb = await S.store.get('notebooks/' + nid);
  if (!nb) {
    const t = await S.store.get('trash/nb-' + nid);
    if (t && t.nb) { await trashRestore(Object.assign({}, t, { id: 'nb-' + nid })); nb = await S.store.get('notebooks/' + nid); }
  }
  if (!nb && S.nid) { nid = S.nid; nb = await S.store.get('notebooks/' + nid); }
  if (!nb) return { none: true };
  const pages = (nb.pages || []).slice();
  if (!pages.includes(e.pid)) pages.splice(e.idx >= 0 ? Math.min(e.idx, pages.length) : pages.length, 0, e.pid);
  await S.store.update('notebooks/' + nid, { pages, updatedAt: now() });
  if (nid !== e.nid) await S.store.update('pages/' + e.pid, { nb: nid });
  if (S.nid === nid && S.nb) { S.nb = Object.assign({}, S.nb, { pages }); renderPageList(); renderTitle(); }
  await S.store.del('trash/' + e.id);
  return { nid, title: nb.title || '', at: pages.indexOf(e.pid) + 1, moved: nid !== e.nid };
}
function trashBtn(t, f, cls) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = t;
  b.onclick = (ev) => { ev.stopPropagation(); f(b); }; return b;
}
/* the bin, drawn into a box of the menu's shelf */
async function trashShow(box) {
  const all = await trashList(), list = all.filter((e) => trashMine(e, all));
  if (!box.isConnected) return;
  box.innerHTML = '';
  const head = document.createElement('div'); head.className = 'trashhead';
  const note = document.createElement('div'); note.className = 'note';
  note.textContent = 'สมุดและหน้าที่ลบอยู่ที่นี่ ' + TRASH_DAYS + ' วัน แล้วจะถูกลบจริงเอง' + (S.store.kind === 'cloud' ? ' ถังขยะเดียวกันทุกเครื่องที่เข้าบัญชีนี้' : ' เฉพาะเครื่องนี้');
  head.appendChild(note);
  if (list.length) head.appendChild(trashBtn('ลบทั้งหมดในถังขยะ', (b) => {
    popMenu(b, 'ลบ ' + list.length + ' รายการในถังขยะทันที ลบแล้วกู้คืนไม่ได้', [['ยืนยันลบทั้งหมด', () => trashRun(async () => { const used = await trashInUse(); for (const e of list) await trashDrop(e, used); toast('ลบทุกอย่างในถังขยะแล้ว', 2200); })], ['ยกเลิก', () => {}]]);
    const c = $('#tabMenu').querySelector('button'); if (c) c.classList.add('danger');
  }, 'danger'));
  box.appendChild(head);
  if (!list.length) { const n = document.createElement('div'); n.className = 'note shelfnote'; n.textContent = 'ถังขยะว่าง'; box.appendChild(n); return; }
  const ul = document.createElement('div'); ul.className = 'trashlist';
  for (const e of list) {
    const row = document.createElement('div'); row.className = 'trashitem'; row.dataset.t = e.id;
    const ic = document.createElement('span'); ic.className = 'trashic' + (e.kind === 'nb' ? ' nb' : ''); ic.setAttribute('aria-hidden', 'true');
    if (e.kind === 'nb') ic.setAttribute('style', coverCss(e.nb));
    const tx = document.createElement('span'); tx.className = 'trashtx';
    const b = document.createElement('b'), s = document.createElement('span');
    if (e.kind === 'nb') { b.textContent = e.nb.title || 'สมุด'; s.textContent = 'สมุด ' + (e.nb.pages || []).length + ' หน้า'; }
    else {
      const nb = (S.nbsAll || []).find((n) => n.id === e.nid) || ((all.find((x) => x.kind === 'nb' && x.nid === e.nid) || {}).nb);
      /* the words and the title are apart, so the words can be translated */
      b.append(document.createTextNode('หน้า ' + ((+e.idx || 0) + 1) + ' ของ '), document.createTextNode((nb && nb.title) || e.title || 'สมุด'));
      s.textContent = nb ? 'หน้าที่ลบจากสมุด' : 'สมุดเล่มนี้ไม่อยู่แล้ว กู้คืนแล้วหน้าไปอยู่ในสมุดที่เปิดอยู่';
    }
    const left = trashLeft(e), when = document.createElement('small');
    when.textContent = 'ลบเมื่อ ' + trashDate(+e.at || 0) + (left > 0 ? ' เหลืออีก ' + left + ' วัน' : ' จะถูกลบจริงเร็ว ๆ นี้');
    tx.append(b, s, when);
    const acts = document.createElement('span'); acts.className = 'trashacts';
    acts.appendChild(trashBtn('กู้คืน', () => trashRun(async () => {
      const r = await trashRestore(e);
      if (r.gone) toast('หน้านี้ถูกลบจริงไปแล้วจากอีกเครื่อง', 2600);
      else if (r.none) toast('ไม่มีสมุดให้หน้านี้กลับไป เปิดสมุดเล่มใดก่อนแล้วกู้คืนอีกครั้ง', 3000);
      else if (e.kind === 'nb') toast('กู้คืนสมุด ' + r.title + ' แล้ว อยู่ที่เอกสาร', 2600);
      else toast('กู้คืนเป็นหน้า ' + r.at + ' ของสมุด ' + r.title + ' แล้ว', 2600);
    }), 'solid'));
    acts.appendChild(trashBtn('ลบถาวร', (bt) => {
      popMenu(bt, 'ลบ ' + b.textContent + ' ทันที ลบแล้วกู้คืนไม่ได้', [['ยืนยันลบถาวร', () => trashRun(async () => { await trashDrop(e); toast('ลบถาวรแล้ว', 1800); })], ['ยกเลิก', () => {}]]);
      const c = $('#tabMenu').querySelector('button'); if (c) c.classList.add('danger');
    }, 'danger'));
    row.append(ic, tx, acts); ul.appendChild(row);
  }
  box.appendChild(ul);
}
/* one action at a time; the shelf is drawn again after it */
async function trashRun(f) {
  if (TRASH.busy) return; TRASH.busy = true;
  try { await f(); } catch (e) { onStoreError(e); } finally { TRASH.busy = false; renderLibrary(); }
}

