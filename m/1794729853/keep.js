/* BURIN part: keep (loaded when first used) */
/* ---------- keeping the notebooks of this device safe (task 2.2): the part m/keep.js, switched off with "keep" in flags.json.
   - asks the browser to keep this site's storage for good (navigator.storage.persist), so it is not cleared when space
     runs low; Safari on iPad may also clear a site that was not opened for 7 days unless it is on the home screen
   - in Safari on iPad and iPhone (not from the home screen) a note in the menu asks to add the app to the home screen,
     first saving a backup: the app on the home screen keeps its own storage and does not see the notebooks in Safari
   - a note in the menu reminds to save a backup when notebooks changed since the last one, at most every few days
   - a backup is one file of every notebook, page, class and picture kept on this device. It is made by reading only.
     Bringing one back only adds what is missing on this device: nothing already here is ever replaced or removed
   The notes are in the menu (never over the page), never on the audience screen or a learner's device in a room, and
   only for notebooks kept on this device (notebooks in the cloud are kept by the cloud) ---------- */
const KEEP = { busy: false, asked: false };
const KEEP_MAGIC = 'BURIN-BACKUP 1';
const KEEP_DAY = 864e5;
function keepNum(k) { const v = +(store_ls.get(k) || 0); return isFinite(v) ? v : 0; }
function keepDate(t) {
  try { return new Date(t).toLocaleDateString(typeof UI_LANG === 'string' && UI_LANG !== 'th' ? UI_LANG : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch (e) { return new Date(t).toISOString().slice(0, 10); }
}
function keepSize(n) { return n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? Math.max(1, Math.round(n / 1e6)) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB'; }
function keepIos() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
function keepStandalone() {
  try { return !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches); } catch (e) { return false; }
}
function keepLocal() { return !!(S.store && S.store.kind === 'local' && typeof S.store.keys === 'function'); }
/* the notebooks on this device, whether anything was written in them (the empty notebook a new device starts with
   does not count), and the time of the newest change */
function keepBooks() {
  if (!keepLocal()) return { n: 0, last: 0, has: false };
  let n = 0, last = 0, has = false;
  for (const k of S.store.keys()) {
    const d = S.store.peek(k); if (!d || typeof d !== 'object') continue;
    if (/^notebooks\/[^/]+$/.test(k)) { n++; last = Math.max(last, +d.updatedAt || 0); }
    else if (/^pages\/[^/]+$/.test(k)) { if (Array.isArray(d.items) && d.items.length) { has = true; last = Math.max(last, +d.rev || 0); } }
    else if (/^pages\/[^/]+\/layers\//.test(k)) { if (Array.isArray(d.strokes) && d.strokes.length) { has = true; last = Math.max(last, +d.rev || 0); } }
  }
  return { n, last, has };
}
/* what a backup holds: not the live room of this device, nor the list of this person's devices */
function keepKeyOk(k) { return typeof k === 'string' && k.length > 0 && k.length < 400 && !/^(cloud:|live\/|devices\/)/.test(k) && !/^\/|\/\/|\/$/.test(k); }
/* the browser keeps this site's storage until the person clears it (best effort: the browser decides) */
async function keepPersist() {
  const st = navigator.storage;
  if (!st || typeof st.persist !== 'function') return 'none';
  try {
    if (typeof st.persisted === 'function' && await st.persisted()) return 'yes';
    return (await st.persist()) ? 'yes' : 'no';
  } catch (e) { return 'no'; }
}
async function keepState() {
  const st = navigator.storage;
  let persisted = 'none', used = 0;
  try { if (st && typeof st.persisted === 'function') persisted = (await st.persisted()) ? 'yes' : 'no'; } catch (e) { persisted = 'none'; }
  try { if (st && typeof st.estimate === 'function') { const e = await st.estimate(); used = +e.usage || 0; } } catch (e) { used = 0; }
  return { persisted, used };
}

/* ----- the backup file: a first line, the length of the header, the header (every saved item, as JSON), then the
   pictures and videos one after another. Pictures stay as they are (no base64), so a big notebook needs little memory */
async function keepMake(say) {
  const keys = S.store.keys().filter(keepKeyOk);
  /* each item is turned into text on its own and handed to the file at once, so even a big device never holds the
     whole backup as one long text; the screen gets a turn every few hundred items */
  const parts = [], used = new Set();
  let books = 0, pages = 0, i = 0, t0 = Date.now();
  for (const k of keys) {
    const d = S.store.peek(k); if (d == null) continue;
    const j = JSON.stringify(d);
    parts.push((parts.length ? ',' : '') + JSON.stringify(k) + ':' + j);
    const re = /"(L[a-z0-9]{6,40})"/gi; let m;
    while ((m = re.exec(j))) used.add(m[1]);
    if (/^notebooks\/[^/]+$/.test(k)) books++; else if (/^pages\/[^/]+$/.test(k)) pages++;
    if (++i % 150 === 0 && Date.now() - t0 > 40) { await new Promise((r) => setTimeout(r, 0)); t0 = Date.now(); }
  }
  const docs = new Blob(parts); parts.length = 0;
  /* only the files that a saved item uses (a file of a deleted page is not kept) */
  let files = [];
  try { files = await IDB.all('blobs'); } catch (e) { files = []; }
  const blobs = [], data = [];
  for (const [id, b] of files) {
    if (typeof id !== 'string' || !b || typeof b.size !== 'number' || !used.has(id)) continue;
    blobs.push({ id, type: b.type || '', size: b.size }); data.push(b);
  }
  files = null;
  const top = JSON.stringify({ app: 'BURIN', v: 1, made: now(), version: typeof VERSION === 'string' ? VERSION : '', blobs }).slice(0, -1) + ',"docs":{';
  const head = new Blob([top, docs, '}}']);
  return { blob: new Blob([KEEP_MAGIC + '\n' + head.size + '\n', head].concat(data), { type: 'application/octet-stream' }), books, pages, files: blobs.length };
}
function keepName() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return 'BURIN backup ' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + p(d.getMinutes()) + '.burin';
}
async function keepSave(say) {
  if (KEEP.busy) return null;
  if (!keepLocal()) { say && say('สมุดของบัญชีนี้เก็บบนคลาวด์อยู่แล้ว', 'ok'); return null; }
  KEEP.busy = true;
  try {
    try { saveMine.flush(); savePage.flush(); } catch (e) { /* save what is there */ }
    say && say('กำลังรวมสมุดเป็นไฟล์สำรอง');
    const r = await keepMake(say);
    if (!r.books) { say && say('ยังไม่มีสมุดในเครื่องนี้ให้สำรอง'); return null; }
    const name = keepName();
    let f = null;
    /* the app opened from the home screen of an iPad or iPhone saves through the share sheet (Save to Files) */
    if (keepIos() && keepStandalone() && navigator.share && navigator.canShare && typeof File === 'function') {
      try { f = new File([r.blob], name, { type: 'application/octet-stream' }); if (!navigator.canShare({ files: [f] })) f = null; } catch (e) { f = null; }
    }
    if (f) {
      if (!(await keepShare(f, say))) return null;
    } else {
      say && say('ไฟล์พร้อมแล้ว ถ้าเห็นหน้าต่างถาม ให้แตะ ดาวน์โหลด');
      const res = await saveFile(name, r.blob);
      if (res && res.status && res.status !== 'saved') { say && say('ยกเลิกการบันทึกไฟล์'); return null; }
    }
    store_ls.set('tp-keep-bak', String(now()));
    say && say('สำรองสมุด ' + r.books + ' เล่ม ' + r.pages + ' หน้า ' + (r.files ? 'กับรูปและวิดีโอ ' + r.files + ' ไฟล์ ' : '') + 'ขนาด ' + keepSize(r.blob.size) + ' แล้ว ' + (f ? 'ไฟล์อยู่ในที่ที่เลือกไว้ในแอป ไฟล์' : 'บน iPad ไฟล์อยู่ในแอป ไฟล์ โฟลเดอร์ ดาวน์โหลด'), 'ok');
    return r;
  } catch (e) {
    if (e && e.code === 'declined') { say && say('ยกเลิกการบันทึกไฟล์'); return null; }
    console.warn('backup', e); say && say('สำรองไม่สำเร็จ ลองอีกครั้ง', 'err'); return null;
  } finally { KEEP.busy = false; }
}
/* the share sheet needs a fresh tap: when making the file took too long for the first tap, a button asks for one */
async function keepShare(f, say) {
  const go = () => navigator.share({ files: [f], title: f.name });
  try { await go(); return true; }
  catch (e) {
    if (!e || e.name !== 'NotAllowedError') { say && say('ยกเลิกการบันทึกไฟล์'); return false; }
  }
  return new Promise((res) => {
    const el = say && say('ไฟล์พร้อมแล้ว แตะ บันทึกไฟล์ แล้วเลือก บันทึกไปยังแอปไฟล์');
    if (!el) { res(false); return; }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn solid keepshare'; b.textContent = 'บันทึกไฟล์';
    b.onclick = () => { b.disabled = true; go().then(() => res(true), () => { say('ยกเลิกการบันทึกไฟล์'); res(false); }); };
    el.appendChild(document.createElement('br')); el.appendChild(b);
  });
}
function keepText(b) {
  if (b && typeof b.text === 'function') return b.text();
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.onerror = () => rej(fr.error); fr.readAsText(b); });
}
/* reads a backup file: { docs, blobs: [{ id, type, blob }] }, or throws { code: 'not_backup' } */
async function keepRead(file) {
  const top = await keepText(file.slice(0, 64));
  const m = /^BURIN-BACKUP 1\n(\d{1,12})\n/.exec(top);
  if (!m) throw { code: 'not_backup' };
  const start = m[0].length, n = +m[1];
  if (start + n > file.size) throw { code: 'not_backup' };
  let head = null;
  try { head = JSON.parse(await keepText(file.slice(start, start + n))); } catch (e) { head = null; }
  if (!head || head.app !== 'BURIN' || !head.docs || typeof head.docs !== 'object' || !Array.isArray(head.blobs)) throw { code: 'not_backup' };
  let off = start + n;
  const blobs = [];
  for (const b of head.blobs) {
    const size = +(b && b.size);
    if (!b || typeof b.id !== 'string' || !isFinite(size) || size < 0 || off + size > file.size) throw { code: 'not_backup' };
    blobs.push({ id: b.id, type: typeof b.type === 'string' ? b.type : '', blob: file.slice(off, off + size, typeof b.type === 'string' ? b.type : '') });
    off += size;
  }
  return { docs: head.docs, blobs, made: +head.made || 0 };
}
/* only adds: an item that is already on this device stays as it is, so bringing a backup back never loses work */
async function keepLoad(file, say) {
  if (KEEP.busy) return null;
  if (!keepLocal()) { say && say('นำคืนได้เฉพาะสมุดที่เก็บในเครื่องนี้', 'err'); return null; }
  KEEP.busy = true;
  try {
    say && say('กำลังอ่านไฟล์สำรอง');
    const r = await keepRead(file);
    let added = 0, kept = 0, books = 0, files = 0;
    for (const b of r.blobs) {
      if (!/^L[a-z0-9]{6,40}$/i.test(b.id)) continue;
      let have = null; try { have = await IDB.get('blobs', b.id); } catch (e) { have = null; }
      if (have) continue;
      const bl = b.blob.type || !b.type ? b.blob : b.blob.slice(0, b.blob.size, b.type);
      await IDB.put('blobs', b.id, bl); files++;
    }
    /* the pages and the rest first, the notebooks last, so a notebook never shows up before its pages */
    const keys = Object.keys(r.docs).filter(keepKeyOk).sort((a, b) => (/^notebooks\//.test(a) ? 1 : 0) - (/^notebooks\//.test(b) ? 1 : 0));
    let i = 0;
    for (const k of keys) {
      const d = r.docs[k];
      if (!d || typeof d !== 'object') continue;
      if (S.store.peek(k) != null) { kept++; continue; }
      await S.store.set(k, d); added++;
      if (/^notebooks\/[^/]+$/.test(k)) books++;
      if (++i % 200 === 0) await new Promise((res) => setTimeout(res, 0));
    }
    say && say(added || files ? (books ? 'นำคืนแล้ว สมุด ' + books + ' เล่ม (รวม ' + added + ' รายการ' + (files ? ' รูปและวิดีโอ ' + files + ' ไฟล์' : '') + ')' : 'นำคืนส่วนที่ขาดแล้ว ' + added + ' รายการ' + (files ? ' รูปและวิดีโอ ' + files + ' ไฟล์' : '')) + (kept ? ' ส่วนที่มีอยู่แล้วในเครื่อง ' + kept + ' รายการคงไว้ตามเดิม' : '') : 'สมุดในไฟล์นี้มีอยู่ในเครื่องครบแล้ว ไม่ได้เปลี่ยนอะไร', 'ok');
    return { added, kept, books, files };
  } catch (e) {
    if (e && e.code === 'not_backup') { say && say('ไฟล์นี้ไม่ใช่ไฟล์สำรองสมุดของ BURIN', 'err'); return null; }
    console.warn('restore', e); say && say(e && (e.name === 'QuotaExceededError' || e.code === 'quota_or_state') ? 'พื้นที่ในเครื่องไม่พอ นำคืนได้ไม่ครบ' : 'นำคืนไม่สำเร็จ ลองอีกครั้ง', 'err'); return null;
  } finally { KEEP.busy = false; }
}
function keepPick(say) {
  const inp = document.createElement('input'); inp.type = 'file';
  inp.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) keepLoad(f, say); };
  document.body.appendChild(inp); inp.click();
}

/* ----- the section in Settings ----- */
async function keepRender() {
  const box = $('#keepSet'); if (!box) return;
  /* an account in the cloud: the section stays, says where the notebooks are, and has no buttons */
  const cloud = !!(S.store && S.store.kind === 'cloud');
  if (!keepLocal() && !cloud) { box.hidden = true; return; }
  box.hidden = false;
  $('#keepBtns').hidden = cloud; $('#keepMsg').hidden = cloud;
  if (cloud) { $('#keepNote').textContent = 'สมุดของบัญชีนี้เก็บบนคลาวด์ ซิงก์ทุกเครื่องที่เข้าระบบด้วยบัญชีเดียวกัน ไม่ต้องสำรองในเครื่อง'; return; }
  const msg = $('#keepMsg');
  const say = (t, k) => { msg.innerHTML = '<div class="note' + (k === 'err' ? ' err' : k === 'ok' ? ' ok' : '') + '"></div>'; msg.firstChild.textContent = t; return msg.firstChild; };
  $('#bKeepSave').onclick = () => keepSave(say).then(() => keepNote());
  $('#bKeepLoad').onclick = () => keepPick((t, k) => { const e = say(t, k); if (k) keepNote(); return e; });
  await keepNote();
}
async function keepNote() {
  const el = $('#keepNote'); if (!el) return;
  const s = await keepState(), bk = keepNum('tp-keep-bak'), B = keepBooks();
  const line = (t, extra) => '<div>' + esc(t) + (extra ? ' <span class="nowrap">' + esc(extra) + '</span>' : '') + '</div>';
  let h = line('มีสมุด', B.n + ' เล่ม') + (s.used ? line('ใช้พื้นที่', keepSize(s.used)) : '');
  h += line(s.persisted === 'yes' ? 'เบราว์เซอร์จะเก็บข้อมูลของแอปไว้ถาวร' : 'เบราว์เซอร์อาจลบข้อมูลของแอปเมื่อพื้นที่เหลือน้อย หรือเมื่อไม่ได้เปิดแอปนาน');
  h += bk ? line('สำรองครั้งล่าสุด', keepDate(bk)) : line('ยังไม่เคยสำรองสมุด');
  if (keepIos() && !keepStandalone()) h += line('บน iPad และ iPhone ให้เพิ่มแอปลงหน้าจอโฮม Safari จะไม่ลบสมุด ก่อนเพิ่ม ให้สำรองสมุดก่อน แล้วนำคืนในแอปบนหน้าจอโฮม เพราะแอปบนหน้าจอโฮมไม่เห็นสมุดที่อยู่ใน Safari');
  h += line('ไฟล์สำรองเก็บสมุดทุกเล่ม รูป และวิดีโอในเครื่องนี้ การนำคืนเพิ่มเฉพาะส่วนที่ยังไม่มีในเครื่อง ไม่ทับและไม่ลบของที่มีอยู่');
  el.innerHTML = h;
}

/* ----- the note at the top of the notebook list in the menu: add to the home screen (Safari), or save a backup.
   It sits in the menu, so it never covers the page while writing ----- */
function keepQuiet() {
  return !!(S.present || S.show || S.student || (LIVE && LIVE.ch));
}
function keepWhich() {
  if (!keepLocal()) return '';
  const B = keepBooks(); if (!B.n || !B.has) return '';
  const t = now();
  if (keepIos() && !keepStandalone()) {
    const a = store_ls.get('tp-keep-a2hs');
    if (a !== 'never' && t - (+a || 0) > 7 * KEEP_DAY) return 'home';
  }
  const bk = keepNum('tp-keep-bak'), later = keepNum('tp-keep-later');
  if (B.last > bk && t - bk > 7 * KEEP_DAY && t - later > 3 * KEEP_DAY) return 'backup';
  return '';
}
function keepCard(kind, host) {
  const c = document.createElement('div'); c.id = 'keepCard'; c.className = 'keepcard'; c.setAttribute('role', 'status'); c.dataset.k = kind;
  const bk = keepNum('tp-keep-bak');
  const txt = kind === 'home'
    ? ['เพิ่ม BURIN ลงหน้าจอโฮม เพื่อไม่ให้ Safari ลบสมุดที่ไม่ได้เปิดนาน', bk ? 'แอปบนหน้าจอโฮมไม่เห็นสมุดใน Safari เมื่อเปิดแอปจากหน้าจอโฮมแล้ว ให้นำคืนจากไฟล์สำรองที่เมนู ตั้งค่า' : 'แอปบนหน้าจอโฮมไม่เห็นสมุดใน Safari ให้สำรองสมุดก่อน แล้วนำคืนในแอปบนหน้าจอโฮม']
    : [bk ? 'สมุดเปลี่ยนไปตั้งแต่สำรองครั้งล่าสุด' : 'ยังไม่เคยสำรองสมุดในเครื่องนี้', 'สมุดเก็บในเบราว์เซอร์ของเครื่องนี้เท่านั้น สำรองเป็นไฟล์ไว้ เผื่อเครื่องหายหรือข้อมูลถูกลบ'];
  c.innerHTML = '<div class="kt"><b></b><span></span></div><div class="kmsg" hidden></div><div class="kb"></div>';
  c.querySelector('b').textContent = txt[0]; c.querySelector('.kt span').textContent = txt[1];
  const bar = c.querySelector('.kb'), m = c.querySelector('.kmsg');
  const say = (t, k) => { m.hidden = false; m.className = 'kmsg' + (k === 'err' ? ' err' : ''); m.textContent = t; return m; };
  const btn = (t, f, solid) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (solid ? ' solid' : ''); b.textContent = t; b.onclick = f; bar.appendChild(b); return b; };
  const close = () => c.remove();
  if (kind === 'home') {
    btn('สำรองสมุดก่อน', async () => { const r = await keepSave(say); if (r) c.querySelector('.kt span').textContent = 'ต่อไป แตะปุ่มแชร์ของ Safari แล้วเลือก เพิ่มไปยังหน้าจอโฮม เปิดแอปจากหน้าจอโฮม แล้วนำคืนที่เมนู ตั้งค่า'; }, true);
    btn('วิธีเพิ่ม', () => { say('แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ที่แถบบนของ Safari แล้วเลือก เพิ่มไปยังหน้าจอโฮม'); });
    btn('ภายหลัง', () => { store_ls.set('tp-keep-a2hs', String(now())); close(); });
    btn('ไม่ต้องเตือนอีก', () => { store_ls.set('tp-keep-a2hs', 'never'); close(); });
  } else {
    btn('สำรองตอนนี้', async () => { const r = await keepSave(say); if (r) setTimeout(close, 6000); }, true);
    btn('ภายหลัง', () => { store_ls.set('tp-keep-later', String(now())); close(); });
  }
  host.appendChild(c);
  return c;
}
/* the menu was opened: show the note when there is something to say (the note stays until it is answered) */
function keepBanner() {
  const host = $('#keepBan'); if (!host) return '';
  const old = $('#keepCard');
  if (keepQuiet()) { if (old) old.remove(); return ''; }
  const kind = keepWhich();
  if (old && old.dataset.k === kind) return kind;
  if (old) old.remove();
  if (!kind) return '';
  keepCard(kind, host); return kind;
}
/* a few seconds after the app opens: ask the browser to keep this site's storage */
async function keepBoot() {
  if (KEEP.asked) return store_ls.get('tp-keep-pst') || '';
  KEEP.asked = true;
  if (!keepBooks().has && !(S.store && S.store.kind === 'cloud')) { KEEP.asked = false; return 'wait'; }
  const r = await keepPersist(); store_ls.set('tp-keep-pst', r); return r;
}

