/* BURIN part: openin (loaded when first used) */
/* Files opened in BURIN from another app (task 6.1 session 3, switch "openin"): Open in or Share in Google Drive,
   OneDrive, Dropbox, Files, Mail or LINE gives the installed app a copy of the file. The app keeps the copies until the
   page has taken them, and tells the page through BurinShell (the same on iPad and Android, task 6.2):
     BurinShell.files()      -> Promise of [{ id, name, type, size, url }] the files waiting; url is the copy on this
                                device, fetched like any file of the app (capacitor://localhost/_capacitor_file_/...)
     BurinShell.fileDone(id) -> the app removes its copy
     'burin-files' on window -> new files came while the page is open (the page asks files() again)
   Each file goes the way the app already has for it, with nothing new on the page and no AI:
     PDF     the PDF sheet (openPdfFile), new pages in this notebook or a notebook of its own
     picture into the open page (prepImage as in insertImage), several at once in a grid in one undo step
     .burin  a backup: into the account (export.js expLoad) or into this device (keep.js keepLoad), only adds
   Files that come while nothing can take them (signed out, the sign-in or consent sheet, a sheet of the PDF open, the
   teacher's page on a student's device) wait on the app and open as soon as they can. With no notebook open, pictures
   get a notebook of their own and a PDF only the new-notebook button. */
const IN = { busy: false, again: false };
const IN_MAX = { pdf: 300e6, img: 60e6, burin: 800e6 };
const IN_IMG = /^(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/;

function inExt(n) { const m = /\.([A-Za-z0-9]{1,6})$/.exec(String(n || '')); return m ? m[1].toLowerCase() : ''; }
function inKind(f) {
  const t = String(f.type || '').toLowerCase(), e = inExt(f.name);
  if (e === 'burin' || t === 'application/x-burin') return 'burin';
  if (e === 'pdf' || t === 'application/pdf') return 'pdf';
  if (IN_IMG.test(e) || /^image\//.test(t)) return 'img';
  return null;
}
function inMB(n) { return n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(n / 1e6)) + ' MB'; }
function inName(f) { return String(f.name || 'ไฟล์').slice(0, 80); }
function inShown(id) { const e = document.getElementById(id); return !!(e && !e.hidden); }

/* can the page take files now: the notebooks are there and nothing is asked of the person first */
function inBlocked(kinds) {
  if (!S.store) return 'wait';
  if (CLOUD && CLOUD.state === 'signedout' && !(S.store && S.store.kind === 'local')) return 'signin';
  if (['startSheet', 'authSheet', 'pdSheet', 'pdAISheet', 'devSheet'].some(inShown)) return 'signin';
  if (inShown('pdfSheet')) return 'busy';
  if (document.body.classList.contains('nodesk')) return '';
  if (!S.nid || !S.pid || S.pageLoaded !== S.pid) return 'wait';
  if ((kinds.img || kinds.pdf) && /^T/.test(S.pid)) return 'teacher';
  return '';
}
async function inWait(kinds, n) {
  let told = false;
  for (;;) {
    const b = inBlocked(kinds); if (!b) return;
    if (!told && b !== 'wait' && b !== 'busy') {
      told = true;
      toast(b === 'teacher' ? 'ได้รับไฟล์ ' + n + ' ไฟล์แล้ว จะเปิดให้เมื่อกลับมาที่สมุดของตัวเอง' : 'ได้รับไฟล์ ' + n + ' ไฟล์แล้ว จะเปิดให้เมื่อเข้าระบบหรือเลือกที่เก็บสมุดเสร็จ', 5000);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
}

async function inRun() {
  const sh = window.BurinShell; if (!sh || sh.audience || typeof sh.files !== 'function') return;
  if (IN.busy) { IN.again = true; return; }
  IN.busy = true;
  try {
    for (let round = 0; round < 20; round++) {
      IN.again = false;
      let list = []; try { list = await sh.files(); } catch (e) { list = []; }
      list = (Array.isArray(list) ? list : []).filter((f) => f && typeof f.id === 'string' && typeof f.url === 'string');
      if (!list.length) break;
      await inTake(sh, list);
      if (!IN.again) break;
    }
  } finally { IN.busy = false; }
}

async function inTake(sh, list) {
  const done = (f) => Promise.resolve().then(() => sh.fileDone(f.id)).catch(() => {});
  const bad = [], big = [], kinds = {};
  const ok = [];
  for (const f of list) {
    const k = inKind(f);
    if (!k) { bad.push(f); done(f); continue; }
    if (+f.size > IN_MAX[k]) { big.push([f, k]); done(f); continue; }
    kinds[k] = 1; ok.push([f, k]);
  }
  if (bad.length) toast('BURIN เปิดได้เฉพาะ PDF รูป และไฟล์สำรอง .burin ' + (bad.length === 1 ? 'ไฟล์ ' + inName(bad[0]) + ' จึงเปิดไม่ได้' : 'จึงเปิดไม่ได้ ' + bad.length + ' ไฟล์'), 6000);
  if (big.length) {
    const [f, k] = big[0];
    await inPause(bad.length);
    toast('ไฟล์ ' + inName(f) + ' ใหญ่ ' + inMB(+f.size) + ' เกินที่เปิดจากแอปอื่นได้ (' + (k === 'pdf' ? 'PDF ไม่เกิน 300 MB แบ่งไฟล์ก่อน' : k === 'img' ? 'รูปไม่เกิน 60 MB' : 'ไฟล์สำรองไม่เกิน 800 MB ใช้ปุ่มนำคืนหรือนำเข้าในเมนู แท็บ ภาษา การเขียน และจอ แทน') + ')', 7000);
  }
  if (!ok.length) return;
  await inWait(kinds, ok.length);
  /* the copy on the device, as a file of the page; the app's copy goes as soon as the page has it */
  const files = [];
  const FL = floatLine(ok.length > 1 ? 'กำลังรับไฟล์ ' + ok.length + ' ไฟล์' : 'กำลังรับไฟล์');
  try {
    for (const [f, k] of ok) {
      try {
        const r = await fetch(f.url); if (!r.ok) throw new Error('http ' + r.status);
        const b = await r.blob();
        const type = k === 'pdf' ? 'application/pdf' : (f.type || b.type || (k === 'img' ? 'image/' + (inExt(f.name) || 'jpeg').replace('jpg', 'jpeg') : ''));
        files.push([new File([b], String(f.name || 'file'), { type }), k]);
      } catch (e) { toast('รับไฟล์ ' + inName(f) + ' ไม่ได้ ลองเปิดจากแอปเดิมอีกครั้ง', 5000); }
      done(f);
    }
  } finally { FL(); }
  const of = (k) => files.filter((x) => x[1] === k).map((x) => x[0]);
  const imgs = of('img'); if (imgs.length) await inPictures(imgs);
  for (const f of of('burin')) { if (imgs.length) await inPause(1); await inBackup(f); }
  const pdfs = of('pdf');
  for (let i = 0; i < pdfs.length; i++) {
    await inWait({ pdf: 1 }, pdfs.length - i);
    if (pdfs.length > 1) { toast('PDF ที่ ' + (i + 1) + ' จาก ' + pdfs.length + ' ' + inName(pdfs[i]), 2600); await inPause(1); }
    await inPdf(pdfs[i]);
  }
}
function inPause(n) { return n ? new Promise((r) => setTimeout(r, 1800)) : Promise.resolve(); }

/* a PDF: the sheet of the PDF as from the insert sheet; with no notebook open only a notebook of its own */
async function inPdf(f) {
  await openPdfFile(f);
  const here = $('#pdfHere');
  if (!inShown('pdfSheet')) return;
  if (here) here.hidden = !S.nid;
  while (inShown('pdfSheet')) await new Promise((r) => setTimeout(r, 500));
  if (here) here.hidden = false;
}

/* pictures: into the open page, one undo step; a notebook of their own when none is open */
async function inPictures(files) {
  const A = await getAssets();
  if (!A) { toast('มุมมองนี้แทรกรูปไม่ได้', 4000); return; }
  if (!S.nid) {
    try {
      const nid = await createNotebook(String(files[0].name || '').replace(/\.[A-Za-z0-9]{1,6}$/, '').slice(0, 60) || 'รูปจากแอปอื่น');
      openNotebook(nid);
    } catch (e) { onStoreError(e); return; }
    for (let i = 0; i < 40 && !(S.pid && S.pageLoaded === S.pid); i++) await new Promise((r) => setTimeout(r, 150));
    if (!(S.pid && S.pageLoaded === S.pid)) { toast('เปิดสมุดใหม่ไม่ทัน ลองเปิดรูปอีกครั้ง', 4000); return; }
  }
  const pid = S.pid;
  const FL = floatLine(files.length > 1 ? 'กำลังแทรกรูป ' + files.length + ' รูป' : 'กำลังแทรกรูป');
  const got = [];
  let queued = false, fail = 0;
  try {
    for (const f of files) {
      try {
        const p = await prepImage(f);
        const r = await A.upload(p.blob, { type: p.type });
        if (r.queued) queued = true;
        got.push({ id: r.id, ar: p.ar });
      } catch (e) { fail++; if (fail === 1) toast(assetErr(e), 4500); }
    }
  } finally { FL(); }
  if (!got.length || S.pid !== pid) { if (got.length) toast('เปลี่ยนหน้าระหว่างแทรก เปิดรูปอีกครั้งในหน้าที่ต้องการ', 4000); return; }
  /* one picture as the insert sheet puts it; several side by side in rows, the whole set in view */
  const n = got.length, cols = n === 1 ? 1 : n <= 4 ? 2 : 3, gap = 24;
  const rows = []; for (let i = 0; i < n; i += cols) rows.push(got.slice(i, i + cols));
  const size = (w) => { const rh = rows.map((r) => Math.max.apply(null, r.map((g) => Math.round(w * g.ar)))); return { rh, tw: cols * w + (cols - 1) * gap, th: rh.reduce((a, b) => a + b, 0) + (rows.length - 1) * gap }; };
  let w = n === 1 ? 480 : cols === 2 ? 400 : 290;
  if (n > 1) { /* the whole set in the part of the page on the screen, so nothing lands out of sight */
    let vw = W, vh = H; try { const z = vp.getBoundingClientRect(), a = toLogical(z.left, z.top), c = toLogical(z.right, z.bottom); vw = Math.min(W, c[0] - a[0]); vh = Math.min(H, c[1] - a[1]); } catch (e) { /* the page size then */ }
    const s0 = size(w), k = Math.min(1, (vw * 0.9) / s0.tw, (vh * 0.6) / s0.th); w = Math.max(120, Math.floor(w * k));
  }
  const { rh, th } = size(w), tw = Math.min(W - 40, size(w).tw);
  let [x0, y0] = viewSpot(tw, Math.min(th, H - 40));
  x0 = Math.max(20, Math.min(x0, W - 20 - tw)); y0 = Math.max(20, y0);
  const before = clone((S.page && S.page.items) || []), items = before.slice();
  let y = y0;
  rows.forEach((r, ri) => {
    r.forEach((g, ci) => items.push({ id: 'i' + uid(), by: DEV, type: 'img', asset: g.id, x: x0 + ci * (w + gap), y, w, ar: Math.round(g.ar * 1000) / 1000 }));
    y += rh[ri] + gap;
  });
  setItems(items, before);
  toast((n === 1 ? 'แทรกรูปแล้ว' : 'แทรกรูปแล้ว ' + n + ' รูป') + (fail ? ' (แทรกไม่ได้ ' + fail + ' รูป)' : '') + (queued ? ' ยังส่งขึ้นคลาวด์ไม่ได้ เครื่องอื่นจะเห็นเมื่อส่งสำเร็จ' : ' ใช้บ่วงเลือกเพื่อย้าย ขยาย หรือย่อ'), queued ? 6000 : 3500);
}

/* a backup: what is not in the account or on this device yet is added, nothing is replaced or removed */
async function inBackup(f) {
  const say = (t, k) => { toast(t, k ? 8000 : 120000); };
  const cloud = !!(S.store && S.store.kind === 'cloud');
  try {
    if (cloud) { await need('export'); if (typeof expLoad === 'function') await expLoad(f, say); }
    else if (S.store && S.store.kind === 'local') { await need('keep'); if (typeof keepLoad === 'function') await keepLoad(f, say); }
    else toast('มุมมองนี้นำคืนไฟล์สำรองไม่ได้', 4000);
  } catch (e) { toast('เปิดไฟล์สำรองไม่ได้ ส่วนนี้ปิดใช้ชั่วคราวหรือยังโหลดไม่ได้ ลองอีกครั้ง', 5000); }
}

