/* BURIN part: export (loaded when first used) */
/* ---------- the whole account in one file (task 1.6): the part m/export.js, switched off with "export" in flags.json.
   For an account in the cloud. One file holds everything the account owns on the server: notebooks, pages, ink,
   settings, pictures and videos, shared lectures, homework and grade books, what learners handed in and the files
   they attached. It is the same .burin file as a backup of a device (keep.js), with more in it:
     BURIN-BACKUP 1 \n <length of the header> \n <header JSON> <pictures and videos> <files handed in>
     header: { app, v, kind: 'account', made, version, email, docs, blobs: [{ id, type, size }],
               acct: { shares, assignments, submissions, files: [{ path, type, size }] } }
   An older app reads it as a backup of a device and brings back the notebooks (it skips what it does not know).
   Making the file only reads. Bringing it into an account only adds what is not there yet (a notebook, a picture,
   a homework, a hand-in): nothing already in the account is replaced or removed, so it can be run again safely.
   The AI key the person connected (settings/ai) is not put in the file ---------- */
const EXP = { busy: false };
const EXP_MAGIC = 'BURIN-BACKUP 1';
function expSize(n) { return n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? Math.max(1, Math.round(n / 1e6)) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB'; }
function expReady() { return !!(S.store && S.store.kind === 'cloud' && CLOUD.client && CLOUD.user && CLOUD.state === 'on'); }
/* what goes into the file and comes back from it: not this device's live room, the list of devices, the AI key, or
   the note that an account was moved from an older server */
function expKeyOk(k) {
  return typeof k === 'string' && k.length > 0 && k.length < 400 && !/^(cloud:|live\/|devices\/)/.test(k) && !/^\/|\/\/|\/$/.test(k) && k !== 'settings/ai' && k !== 'settings/migrated';
}
const expTick = () => new Promise((r) => setTimeout(r, 0));
/* every row a query gives, a page at a time (the server hands out at most a thousand rows at once) */
async function expRows(q, n) {
  n = n || 500; const out = [];
  for (let from = 0; ; from += n) {
    const { data, error } = await q().range(from, from + n - 1);
    if (error) throw error;
    out.push(...(data || [])); if (!data || data.length < n) break;
  }
  return out;
}
/* every file in a folder of a storage bucket and its folders: [{ path (inside root), size, type }] */
async function expFiles(bucket, root) {
  const out = [], sb = CLOUD.client;
  const walk = async (dir) => {
    for (let off = 0; ; off += 1000) {
      const { data: L, error } = await sb.storage.from(bucket).list(dir, { limit: 1000, offset: off });
      if (error) throw error;
      for (const f of L || []) {
        if (!f || !f.name) continue;
        const p = dir + '/' + f.name;
        if (f.id == null && !f.metadata) await walk(p);
        else out.push({ path: p.slice(root.length + 1), size: +((f.metadata && f.metadata.size) || 0), type: String((f.metadata && f.metadata.mimetype) || '') });
      }
      if (!L || L.length < 1000) break;
    }
  };
  await walk(root);
  return out;
}
async function expGet(bucket, path) {
  const { data, error } = await CLOUD.client.storage.from(bucket).download(path);
  return error || !data ? null : data;
}

/* ----- making the file: every part is read from the server, so it is the whole account, not only what this device saw */
async function expMake(say) {
  const sb = CLOUD.client, me = CLOUD.user.id;
  say && say('กำลังรวบรวมสมุดของบัญชี');
  const rows = await expRows(() => sb.from('docs').select('path,data').eq('owner', me).order('path'));
  const parts = []; let books = 0, pages = 0, i = 0;
  for (const r of rows) {
    if (!r || !expKeyOk(r.path) || r.data == null) continue;
    parts.push((parts.length ? ',' : '') + JSON.stringify(r.path) + ':' + JSON.stringify(r.data));
    if (/^notebooks\/[^/]+$/.test(r.path)) books++; else if (/^pages\/[^/]+$/.test(r.path)) pages++;
    if (++i % 300 === 0) await expTick();
  }
  rows.length = 0;
  /* pictures and videos: the copy kept on this device is used when there is one (nothing to download) */
  const files = await expFiles('burin', me), blobs = [], data = [];
  let k = 0, skip = 0;
  for (const f of files) {
    say && say('กำลังรวบรวมรูปและวิดีโอ ' + (++k) + ' จาก ' + files.length);
    if (!okAsset(f.path)) continue;
    let b = null; try { b = await IDB.get('blobs', f.path); } catch (e) { b = null; }
    if (!b) b = await expGet('burin', me + '/' + f.path);
    if (!b) { skip++; continue; }
    blobs.push({ id: f.path, type: b.type || f.type || '', size: b.size }); data.push(b);
  }
  /* shared lectures and room keys, homework and grade books, and what was handed in with its files */
  say && say('กำลังรวบรวมเลคเชอร์ที่แชร์และการบ้าน');
  const shares = await expRows(() => sb.from('shares').select('id,title,data').eq('owner', me).order('id'));
  const assignments = await expRows(() => sb.from('assignments').select('id,title,data,due,open,created_at').eq('owner', me).order('id'));
  const submissions = [], subs = [], subData = [];
  for (let j = 0; j < assignments.length; j += 40) {
    const ids = assignments.slice(j, j + 40).map((a) => a.id);
    submissions.push(...(await expRows(() => sb.from('submissions').select('id,assignment,name,data,created_at').in('assignment', ids).order('id'))));
  }
  let n = 0;
  for (const a of assignments) {
    for (const f of await expFiles('burin-sub', a.id)) {
      say && say('กำลังรวบรวมไฟล์งานที่ส่ง ' + (++n));
      const p = a.id + '/' + f.path, b = await expGet('burin-sub', p);
      if (!b) { skip++; continue; }
      subs.push({ path: p, type: b.type || f.type || '', size: b.size }); subData.push(b);
    }
  }
  const head0 = { app: 'BURIN', v: 1, kind: 'account', made: now(), version: typeof VERSION === 'string' ? VERSION : '', email: CLOUD.user.email || '', blobs, acct: { shares, assignments, submissions, files: subs } };
  const head = new Blob([JSON.stringify(head0).slice(0, -1) + ',"docs":{', new Blob(parts), '}}']);
  parts.length = 0;
  const blob = new Blob([EXP_MAGIC + '\n' + head.size + '\n', head].concat(data, subData), { type: 'application/octet-stream' });
  return { blob, books, pages, files: blobs.length, shares: shares.length, hw: assignments.length, subs: submissions.length, skip };
}
function expName() {
  const d = new Date(), p = (x) => String(x).padStart(2, '0');
  return 'BURIN account ' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + p(d.getMinutes()) + '.burin';
}
function expIos() { const ua = navigator.userAgent || ''; return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); }
function expStandalone() { try { return !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches); } catch (e) { return false; } }
/* the app on the home screen of an iPad saves through the share sheet, which needs a fresh tap when making the file took long */
async function expShare(f, say) {
  const go = () => navigator.share({ files: [f], title: f.name });
  try { await go(); return true; } catch (e) { if (!e || e.name !== 'NotAllowedError') { say && say('ยกเลิกการบันทึกไฟล์'); return false; } }
  return new Promise((res) => {
    const el = say && say('ไฟล์พร้อมแล้ว แตะ บันทึกไฟล์ แล้วเลือก บันทึกไปยังแอปไฟล์');
    if (!el) { res(false); return; }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn solid keepshare'; b.textContent = 'บันทึกไฟล์';
    b.onclick = () => { b.disabled = true; go().then(() => res(true), () => { say('ยกเลิกการบันทึกไฟล์'); res(false); }); };
    el.appendChild(document.createElement('br')); el.appendChild(b);
  });
}
async function expSave(say) {
  if (EXP.busy) return null;
  if (!expReady()) { say && say('เข้าระบบบัญชีคลาวด์ก่อน จึงส่งออกทั้งบัญชีได้', 'err'); return null; }
  EXP.busy = true;
  try {
    try { saveMine.flush(); savePage.flush(); } catch (e) { /* save what is there */ }
    if (typeof S.store.flush === 'function') await S.store.flush();
    if (typeof S.store.pending === 'function' && S.store.pending()) { say && say('ยังบันทึกขึ้นคลาวด์ไม่ครบ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง', 'err'); return null; }
    const r = await expMake(say);
    const name = expName();
    let f = null;
    if (expIos() && expStandalone() && navigator.share && navigator.canShare && typeof File === 'function') {
      try { f = new File([r.blob], name, { type: 'application/octet-stream' }); if (!navigator.canShare({ files: [f] })) f = null; } catch (e) { f = null; }
    }
    if (f) { if (!(await expShare(f, say))) return null; }
    else {
      say && say('ไฟล์พร้อมแล้ว ถ้าเห็นหน้าต่างถาม ให้แตะ ดาวน์โหลด');
      const res = await saveFile(name, r.blob);
      if (res && res.status && res.status !== 'saved') { say && say('ยกเลิกการบันทึกไฟล์'); return null; }
    }
    store_ls.set('tp-exp-at-' + CLOUD.user.id, String(now()));
    const bits = ['สมุด ' + r.books + ' เล่ม ' + r.pages + ' หน้า'];
    if (r.files) bits.push('รูปและวิดีโอ ' + r.files + ' ไฟล์');
    if (r.shares) bits.push('เลคเชอร์ที่แชร์และกุญแจห้อง ' + r.shares + ' รายการ');
    if (r.hw) bits.push('การบ้านและสมุดคะแนน ' + r.hw + ' ชิ้น งานที่ส่ง ' + r.subs + ' ชิ้น');
    say && say('ส่งออกแล้ว ' + bits.join(' ') + ' ขนาด ' + expSize(r.blob.size) + (r.skip ? ' มีไฟล์ ' + r.skip + ' ไฟล์ที่อ่านจากคลาวด์ไม่ได้ จึงไม่อยู่ในไฟล์' : '') + (f ? ' ไฟล์อยู่ในที่ที่เลือกไว้ในแอป ไฟล์' : (window.BurinShell && window.BurinShell.platform === 'android' ? ' ไฟล์อยู่ในที่ที่เลือกไว้' : ' บน iPad ไฟล์อยู่ในแอป ไฟล์ โฟลเดอร์ ดาวน์โหลด')), r.skip ? 'err' : 'ok');
    return r;
  } catch (e) {
    if (e && e.code === 'declined') { say && say('ยกเลิกการบันทึกไฟล์'); return null; }
    console.warn('export', e); say && say('ส่งออกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง', 'err'); return null;
  } finally { EXP.busy = false; }
}

/* ----- reading a file: a backup of a device or a whole account. Throws { code: 'not_backup' } for anything else */
function expText(b) {
  if (b && typeof b.text === 'function') return b.text();
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.onerror = () => rej(fr.error); fr.readAsText(b); });
}
async function expRead(file) {
  const top = await expText(file.slice(0, 64));
  const m = /^BURIN-BACKUP 1\n(\d{1,12})\n/.exec(top);
  if (!m) throw { code: 'not_backup' };
  const start = m[0].length, n = +m[1];
  if (start + n > file.size) throw { code: 'not_backup' };
  let head = null;
  try { head = JSON.parse(await expText(file.slice(start, start + n))); } catch (e) { head = null; }
  if (!head || head.app !== 'BURIN' || !head.docs || typeof head.docs !== 'object' || !Array.isArray(head.blobs)) throw { code: 'not_backup' };
  let off = start + n;
  const cut = (list) => {
    const out = [];
    for (const b of list) {
      const size = +(b && b.size), type = b && typeof b.type === 'string' ? b.type : '';
      if (!b || !isFinite(size) || size < 0 || off + size > file.size) throw { code: 'not_backup' };
      out.push(Object.assign({}, b, { type, blob: file.slice(off, off + size, type) })); off += size;
    }
    return out;
  };
  const blobs = cut(head.blobs);
  const A = head.acct && typeof head.acct === 'object' ? head.acct : null;
  const arr = (x) => (Array.isArray(x) ? x.filter((y) => y && typeof y === 'object' && typeof y.id === 'string') : []);
  const acct = A ? { shares: arr(A.shares), assignments: arr(A.assignments), submissions: arr(A.submissions), files: Array.isArray(A.files) ? cut(A.files) : [] } : null;
  return { docs: head.docs, blobs, acct, kind: head.kind === 'account' ? 'account' : 'device', email: typeof head.email === 'string' ? head.email : '', made: +head.made || 0 };
}

/* ----- bringing a file into the account this device is signed in with: only adds */
async function expLoad(file, say) {
  if (EXP.busy) return null;
  if (!expReady()) { say && say('เข้าระบบบัญชีคลาวด์ก่อน จึงนำเข้าได้', 'err'); return null; }
  EXP.busy = true;
  const sb = CLOUD.client, me = CLOUD.user.id;
  const n = { docs: 0, books: 0, kept: 0, files: 0, shares: 0, hw: 0, subs: 0, subFiles: 0, skip: 0 };
  try {
    say && say('กำลังอ่านไฟล์');
    const r = await expRead(file);
    /* pictures and videos first, so a page never shows up before its picture is in the account */
    const have = new Set((await expFiles('burin', me)).map((f) => f.path));
    let k = 0;
    for (const b of r.blobs) {
      if (!okAsset(b.id)) continue;
      if (have.has(b.id)) continue;
      say && say('กำลังนำเข้ารูปและวิดีโอ ' + (++k));
      const { error } = await sb.storage.from('burin').upload(me + '/' + b.id, b.blob, { contentType: b.type || 'application/octet-stream', upsert: false });
      if (error && !/exist|duplicate/i.test(String(error.message || error))) n.skip++; else { n.files++; have.add(b.id); }
    }
    /* the notebooks: what the account already has on the server (or on this device, not yet sent) stays as it is.
       Pages and the rest first, the notebooks last, so a notebook never shows up before its pages */
    say && say('กำลังนำเข้าสมุด');
    const onServer = new Set((await expRows(() => sb.from('docs').select('path').eq('owner', me).order('path'))).map((x) => x.path));
    const keys = Object.keys(r.docs).filter(expKeyOk).sort((a, b) => (/^notebooks\//.test(a) ? 1 : 0) - (/^notebooks\//.test(b) ? 1 : 0));
    let i = 0;
    for (const key of keys) {
      const d = r.docs[key];
      if (!d || typeof d !== 'object') continue;
      if (onServer.has(key) || S.store.peek(key) != null) { n.kept++; continue; }
      await S.store.set(key, d); n.docs++;
      if (/^notebooks\/[^/]+$/.test(key)) n.books++;
      if (++i % 200 === 0) { say && say('กำลังนำเข้าสมุด ' + n.docs + ' รายการ'); await expTick(); }
    }
    if (typeof S.store.flush === 'function') await S.store.flush();
    /* shared lectures and room keys, homework, hand-ins and their files (only in a file of a whole account) */
    if (r.acct) {
      say && say('กำลังนำเข้าเลคเชอร์ที่แชร์และการบ้าน');
      const myShares = new Set((await expRows(() => sb.from('shares').select('id').eq('owner', me).order('id'))).map((x) => x.id));
      for (const x of r.acct.shares) {
        if (myShares.has(x.id)) continue;
        const { error } = await sb.from('shares').insert({ id: x.id, owner: me, title: String(x.title || ''), data: x.data == null ? {} : x.data });
        if (error) n.skip++; else n.shares++;
      }
      const mine = new Set((await expRows(() => sb.from('assignments').select('id').eq('owner', me).order('id'))).map((x) => x.id));
      for (const x of r.acct.assignments) {
        if (mine.has(x.id)) continue;
        const row = { id: x.id, owner: me, title: String(x.title || ''), data: x.data == null ? {} : x.data, due: x.due || null, open: !!x.open };
        if (x.created_at) row.created_at = x.created_at;
        const { error } = await sb.from('assignments').insert(row);
        if (error) n.skip++; else { n.hw++; mine.add(x.id); }
      }
      /* hand-ins go only to homework of this account (a homework of another account with the same name is left alone) */
      const ids = [...new Set(r.acct.submissions.map((x) => x.assignment))].filter((id) => mine.has(id));
      const got = new Set();
      for (let j = 0; j < ids.length; j += 40) { const part = ids.slice(j, j + 40); for (const x of await expRows(() => sb.from('submissions').select('id').in('assignment', part).order('id'))) got.add(x.id); }
      for (const x of r.acct.submissions) {
        if (!mine.has(x.assignment) || got.has(x.id)) continue;
        const row = { id: x.id, assignment: x.assignment, name: String(x.name || ''), data: x.data == null ? {} : x.data };
        if (x.created_at) row.created_at = x.created_at;
        const { error } = await sb.from('submissions').insert(row);
        if (error) n.skip++; else { n.subs++; got.add(x.id); }
      }
      const subHave = new Map();
      let m2 = 0;
      for (const f of r.acct.files) {
        const p = String(f.path || ''), aid = p.split('/')[0];
        if (!mine.has(aid) || !/^[A-Za-z0-9_-]{1,80}(\/[A-Za-z0-9._-]{1,120}){1,3}$/.test(p) || /\.\./.test(p)) continue;
        if (!subHave.has(aid)) subHave.set(aid, new Set((await expFiles('burin-sub', aid).catch(() => [])).map((y) => aid + '/' + y.path)));
        if (subHave.get(aid).has(p)) continue;
        say && say('กำลังนำเข้าไฟล์งานที่ส่ง ' + (++m2));
        const { error } = await sb.storage.from('burin-sub').upload(p, f.blob, { contentType: f.type || 'application/octet-stream', upsert: false });
        if (error && !/exist|duplicate/i.test(String(error.message || error))) n.skip++; else n.subFiles++;
      }
    }
    const left = typeof S.store.pending === 'function' ? S.store.pending() : 0;
    const bits = [];
    if (n.books) bits.push('สมุด ' + n.books + ' เล่ม');
    if (n.docs) bits.push('รวม ' + n.docs + ' รายการ');
    if (n.files) bits.push('รูปและวิดีโอ ' + n.files + ' ไฟล์');
    if (n.shares) bits.push('เลคเชอร์ที่แชร์และกุญแจห้อง ' + n.shares + ' รายการ');
    if (n.hw) bits.push('การบ้านและสมุดคะแนน ' + n.hw + ' ชิ้น');
    if (n.subs) bits.push('งานที่ส่ง ' + n.subs + ' ชิ้น');
    let t = bits.length ? 'นำเข้าแล้ว ' + bits.join(' ') : 'ทุกอย่างในไฟล์นี้มีอยู่ในบัญชีแล้ว ไม่ได้เปลี่ยนอะไร';
    if (n.kept && bits.length) t += ' ส่วนที่มีอยู่แล้วในบัญชี ' + n.kept + ' รายการคงไว้ตามเดิม';
    if (n.skip) t += ' มี ' + n.skip + ' รายการที่นำเข้าไม่ได้ (อาจเป็นของบัญชีอื่นบนเซิร์ฟเวอร์นี้)';
    if (left) t += ' ยังส่งขึ้นคลาวด์ไม่ครบ แอปจะส่งต่อให้เองเมื่อต่ออินเทอร์เน็ต';
    say && say(t, n.skip || left ? 'err' : 'ok');
    return n;
  } catch (e) {
    if (e && e.code === 'not_backup') { say && say('ไฟล์นี้ไม่ใช่ไฟล์สำรองสมุดของ BURIN', 'err'); return null; }
    console.warn('import', e); say && say('นำเข้าไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง ส่วนที่นำเข้าแล้วยังอยู่ ลองซ้ำได้โดยไม่ซ้ำซ้อน', 'err'); return n.docs || n.files ? n : null;
  } finally { EXP.busy = false; }
}
function expPick(say) {
  const inp = document.createElement('input'); inp.type = 'file';
  inp.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) expLoad(f, say); };
  document.body.appendChild(inp); inp.click();
}

/* ----- the section in Settings, for an account in the cloud ----- */
function expRender() {
  const box = $('#expSet'); if (!box) return;
  if (!expReady()) { box.hidden = true; return; }
  box.hidden = false;
  const msg = $('#expMsg');
  /* a number stays on the line of the word after it (2 เล่ม, 7 MB) */
  const say = (t, k) => { msg.innerHTML = '<div class="note' + (k === 'err' ? ' err' : k === 'ok' ? ' ok' : '') + '"></div>'; msg.firstChild.textContent = String(t).replace(/(\d) (?=[^\d\s])/g, '$1\u00a0'); return msg.firstChild; };
  $('#bExpSave').onclick = () => expSave(say).then(() => expNote());
  $('#bExpLoad').onclick = () => expPick(say);
  expNote();
}
function expNote() {
  const el = $('#expNote'); if (!el) return;
  const at = +(store_ls.get('tp-exp-at-' + (CLOUD.user && CLOUD.user.id)) || 0);
  const line = (t, extra) => '<div>' + esc(t) + (extra ? ' <span class="nowrap">' + esc(extra) + '</span>' : '') + '</div>';
  let d = '';
  if (at) { try { d = new Date(at).toLocaleDateString(typeof UI_LANG === 'string' && UI_LANG !== 'th' ? UI_LANG : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { d = new Date(at).toISOString().slice(0, 10); } }
  el.innerHTML = line('ไฟล์เดียวเก็บทุกอย่างของบัญชี สมุด หน้า หมึก รูป วิดีโอ เลคเชอร์ที่แชร์ การบ้าน สมุดคะแนน และงานที่นักเรียนส่ง')
    + line('ใช้เก็บไว้เอง ย้ายไปบัญชีอื่น หรือเปิดในเครื่องที่ไม่ได้เข้าระบบ (การบ้านนำเข้าได้เฉพาะในบัญชีคลาวด์) การนำเข้าเพิ่มเฉพาะส่วนที่ยังไม่มี ไม่ทับและไม่ลบของที่มีอยู่')
    + line('ไฟล์มีข้อมูลส่วนตัวและงานของนักเรียน เก็บไว้ในที่ปลอดภัย คีย์ AI ไม่อยู่ในไฟล์')
    + (at ? line('ส่งออกครั้งล่าสุด', d) : '');
}

