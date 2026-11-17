/* BURIN part: sketch (loaded when first used) */

/* ---------- cutting out the background of a picture ----------
   Automatic: a flat background (a diagram, clip art, a scan, a drawing on plain paper) is removed by colour from the border,
   with the colour of the background unmixed out of the soft edge so no white or coloured fringe is left; a photo is split by
   our own colour-model and minimum-cut segmentation (below), which the teacher can steer with a frame and two brushes.
   Then tap a region to remove it or bring it back, remove one colour everywhere, or brush by hand. Everything runs on the
   device and nothing is downloaded.
   The result is a PNG with a see-through background, trimmed to what is left. */
const CUT = { it: null, cv: null, ctx: null, orig: null, cur: null, w: 0, h: 0, mode: 'tap', tol: 28, brush: 18, undo: [], holes: true, how: '', bg: 'grid', busy: false };
const cutDist = (d, i, r, g, b) => { const dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b; return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11) / 2.55; };
async function cutLoad(it) {
  let blob = null;
  if (okAsset(it.asset)) { try { blob = await getAssetBlob(it.asset); } catch (e) { blob = null; } if (!blob && it.asset[0] !== 'L' && it.asset[0] !== 'S') { try { const r = await fetch('/_blob/' + it.asset); if (r.ok) blob = await r.blob(); } catch (e) { /* none */ } } }
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  try { return await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; }); }
  finally { setTimeout(() => URL.revokeObjectURL(u), 2000); }
}
async function openBgCut() {
  const it = S.sel && S.sel.items.length === 1 && findItem(S.sel.items[0]);
  if (!it || it.type !== 'img') { toast('เลือกรูปหนึ่งรูปก่อน', 2000); return; }
  const im = await cutLoad(it); if (!im) { toast('เปิดรูปนี้มาแก้ไม่ได้ รูปจากลิงก์ภายนอกตัดพื้นหลังไม่ได้', 3500); return; }
  const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(im, 0, 0, w, h);
  CUT.it = it.id; CUT.cv = cv; CUT.ctx = c; CUT.w = w; CUT.h = h; CUT.orig = c.getImageData(0, 0, w, h); CUT.cur = c.getImageData(0, 0, w, h); CUT.undo = []; CUT.how = '';
  clearSel(); cutSheet();
}
function cutSheet() {
  let p = $('#cutSheet');
  if (!p) {
    p = document.createElement('div'); p.id = 'cutSheet'; p.className = 'sheet cutsheet no-ink';
    p.innerHTML = '<div class="panel wide" role="dialog" aria-label="ตัดพื้นหลังรูป"><div class="cuth"><h2>ตัดพื้นหลัง</h2><button type="button" class="btn" data-a="close">ยกเลิก</button></div>'
      + '<div class="cutbar"><button type="button" class="btn solid" data-a="auto">ลบพื้นหลังอัตโนมัติ</button><button type="button" class="btn" data-a="photo">แบบภาพถ่าย</button><button type="button" class="btn" data-a="flat">แบบพื้นสีเรียบ</button><label class="cutchk"><input type="checkbox" data-c="holes"> ลบช่องว่างด้านในด้วย</label></div>'
      + '<div class="cutbar"><span class="seg" role="group" aria-label="บอกตำแหน่งวัตถุ"><button type="button" data-m="rect">ลากกรอบรอบวัตถุ</button><button type="button" data-m="mfg">ระบายส่วนที่เป็นวัตถุ</button><button type="button" data-m="mbg">ระบายส่วนที่เป็นพื้นหลัง</button></span><span class="seg" role="group" aria-label="วิธีแก้"><button type="button" data-m="tap">แตะส่วนที่จะลบ</button><button type="button" data-m="color">ลบสีนี้ทั้งรูป</button><button type="button" data-m="keep">แตะส่วนที่จะเก็บคืน</button><button type="button" data-m="erase">ยางลบ</button><button type="button" data-m="restore">แปรงคืน</button></span></div>'
      + '<div class="cutsl"><label><span>ความไวในการเลือกสี</span><input type="range" min="4" max="80" step="1" data-r="tol"></label><label><span>ขนาดแปรง</span><input type="range" min="4" max="80" step="1" data-r="brush"></label><span class="seg cutbgs" role="group" aria-label="พื้นหลังที่ใช้ดู"><button type="button" data-b="grid">ตาราง</button><button type="button" data-b="white">ขาว</button><button type="button" data-b="dark">เข้ม</button></span></div>'
      + '<div class="cutview"><div class="cutstage"><canvas></canvas><canvas class="cutmarks"></canvas></div><div class="cutbusy" hidden><span></span></div></div>'
      + '<div class="cutfoot"><small class="cutmsg">พื้นลายตารางคือส่วนที่โปร่งใส ใช้ยางลบหรือแปรงคืนเก็บรายละเอียดตรงขอบ</small><span class="row2"><button type="button" class="btn" data-a="undo">ย้อนกลับ</button><button type="button" class="btn" data-a="reset">เริ่มใหม่</button><button type="button" class="btn solid" data-a="save">ใช้รูปนี้</button></span></div></div>';
    document.body.appendChild(p);
    p.querySelector('[data-a="close"]').onclick = () => { p.hidden = true; cutFree(); };
    p.querySelector('[data-a="auto"]').onclick = () => cutRun('auto');
    p.querySelector('[data-a="photo"]').onclick = () => cutRun('photo');
    p.querySelector('[data-a="flat"]').onclick = () => cutRun('flat');
    p.querySelector('[data-a="undo"]').onclick = () => { if (CUT.undo.length) { CUT.cur = CUT.undo.pop(); cutDraw(); } };
    p.querySelector('[data-a="reset"]').onclick = () => { cutPush(); CUT.cur = new ImageData(new Uint8ClampedArray(CUT.orig.data), CUT.w, CUT.h); CUT.how = ''; GC.px = null; GC.lab = null; cutMsg(''); cutMarks(); cutDraw(); };
    p.querySelector('[data-a="save"]').onclick = cutSave;
    p.querySelector('[data-c="holes"]').onchange = (e) => { CUT.holes = e.target.checked; };
    p.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => { CUT.mode = b.dataset.m; cutModes(); }; });
    p.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => { CUT.bg = b.dataset.b; cutModes(); }; });
    p.querySelectorAll('[data-r]').forEach((r) => { r.oninput = () => { CUT[r.dataset.r] = +r.value; }; });
    const view = p.querySelector('canvas');
    let drag = null;
    const run = (o) => { cutRunPhoto(o); };
    const at = (e) => { const r = view.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * CUT.w), Math.floor((e.clientY - r.top) / r.height * CUT.h), CUT.w / r.width]; };
    view.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (CUT.busy) return; const [x, y, k] = at(e); if (x < 0 || y < 0 || x >= CUT.w || y >= CUT.h) return;
      cutPush();
      if (CUT.mode === 'tap' || CUT.mode === 'keep') { cutFill(x, y, CUT.mode === 'keep'); cutDraw(); return; }
      if (CUT.mode === 'color') { cutColor(x, y); cutDraw(); return; }
      try { view.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      if (CUT.mode === 'rect') { CUT.undo.pop(); drag = { k, x0: x, y0: y, x1: x, y1: y }; cutMarks(drag); return; }
      if (CUT.mode === 'mfg' || CUT.mode === 'mbg') { CUT.undo.pop(); drag = { k, pts: [[x, y]] }; gcMark(x, y, k, CUT.mode === 'mfg' ? 1 : -1); CUT.strokes.push({ v: CUT.mode === 'mfg' ? 1 : -1, r: CUT.brush * k, pts: drag.pts }); cutMarks(); return; }
      drag = { k }; cutBrush(x, y, k); cutDraw();
    });
    view.addEventListener('pointermove', (e) => {
      if (!drag) return; const [x, y] = at(e);
      if (CUT.mode === 'rect') { drag.x1 = clamp(x, 0, CUT.w - 1); drag.y1 = clamp(y, 0, CUT.h - 1); cutMarks(drag); return; }
      if (drag.pts) { const [px0, py0] = drag.pts[drag.pts.length - 1], steps = Math.max(1, Math.ceil(Math.hypot(x - px0, y - py0) / Math.max(2, CUT.brush * drag.k * 0.5))); for (let s2 = 1; s2 <= steps; s2++) gcMark(px0 + (x - px0) * s2 / steps, py0 + (y - py0) * s2 / steps, drag.k, CUT.mode === 'mfg' ? 1 : -1); drag.pts.push([x, y]); cutMarks(); return; }
      cutBrush(x, y, drag.k); cutDraw();
    });
    const end = () => {
      const d = drag; drag = null; if (!d) return;
      if (CUT.mode === 'rect') { const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1); if (x1 - x0 < 8 || y1 - y0 < 8) { cutMarks(); return; } CUT.frame = [x0, y0, x1, y1]; cutMarks(); run({ rect: true }); return; }
      if (d.pts) run({ again: CUT.how === 'photo' });
    };
    view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
  }
  p.querySelector('[data-r="tol"]').value = CUT.tol; p.querySelector('[data-r="brush"]').value = CUT.brush; p.querySelector('[data-c="holes"]').checked = CUT.holes;
  const view = p.querySelector('canvas'); view.width = CUT.w; view.height = CUT.h;
  const mk = p.querySelector('.cutmarks'); mk.width = CUT.w; mk.height = CUT.h; CUT.strokes = []; CUT.frame = null; GC.px = null; GC.lab = null; GC.rect = null; cutMarks();
  p.hidden = false; cutModes(); cutMsg(''); cutDraw();
}
function cutModes() {
  const p = $('#cutSheet'); if (!p) return;
  p.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === CUT.mode ? 'true' : 'false'));
  p.querySelectorAll('[data-b]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.b === CUT.bg ? 'true' : 'false'));
  p.querySelector('.cutview').dataset.bg = CUT.bg;
}
function cutMsg(t) { const m = $('#cutSheet .cutmsg'); if (m) m.textContent = t || 'พื้นลายตารางคือส่วนที่โปร่งใส สลับดูบนพื้นขาวหรือพื้นเข้มเพื่อหาขอบที่ยังค้าง แล้วใช้ยางลบหรือแปรงคืนเก็บรายละเอียด'; }
function cutBusy(t) { const b = $('#cutSheet .cutbusy'); if (!b) return; CUT.busy = !!t; b.hidden = !t; if (t) b.querySelector('span').textContent = t; }
const cutFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
function cutPush() { CUT.undo.push(new ImageData(new Uint8ClampedArray(CUT.cur.data), CUT.w, CUT.h)); if (CUT.undo.length > 20) CUT.undo.shift(); }
function cutDraw() { const v = $('#cutSheet canvas'); if (!v) return; v.getContext('2d').putImageData(CUT.cur, 0, 0); }
function cutFree() { GC.px = null; GC.nw = null; GC.lab = null; GC.hard = null; }
/* the teacher's marks drawn over the picture: the frame, and green and red strokes */
function cutMarks(drag) {
  const c = $('#cutSheet .cutmarks'); if (!c) return; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  const lw = Math.max(2, Math.max(CUT.w, CUT.h) / 300);
  const f = drag ? [Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.max(drag.x0, drag.x1), Math.max(drag.y0, drag.y1)] : CUT.frame;
  if (f) { g.setLineDash([lw * 4, lw * 3]); g.lineWidth = lw; g.strokeStyle = '#2F4BB8'; g.strokeRect(f[0], f[1], f[2] - f[0], f[3] - f[1]); g.setLineDash([]); }
  for (const s of CUT.strokes || []) { g.strokeStyle = s.v > 0 ? 'rgba(30,160,90,0.55)' : 'rgba(210,50,50,0.55)'; g.lineWidth = s.r * 2; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); s.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (s.pts.length === 1) g.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]); g.stroke(); }
}
async function cutRunPhoto(o) {
  if (CUT.busy) return;
  cutPush();
  try {
    if (o.rect) { if (!GC.px || GC.for !== CUT.orig) { gcPrep(); GC.for = CUT.orig; } const s = GC.s, F = CUT.frame; GC.rect = [Math.floor(F[0] * s), Math.floor(F[1] * s), Math.ceil(F[2] * s), Math.ceil(F[3] * s)]; await cutPhoto({ rect: GC.rect }); }
    else await cutPhoto({ again: !!o.again });
    CUT.how = 'photo'; cutDraw();
    cutMsg('ปรับต่อได้: ระบายสีเขียวบนส่วนที่เป็นวัตถุ ระบายสีแดงบนส่วนที่เป็นพื้นหลัง แล้วรูปจะแยกใหม่ทันที');
  } catch (e) { CUT.cur = CUT.undo.pop() || CUT.cur; cutDraw(); toast('แยกภาพไม่สำเร็จ ลองลากกรอบรอบวัตถุใหม่', 3500); console.warn('cut', e); }
  finally { cutBusy(''); }
}

/* ---------- which kind of picture: a flat background is one or two colours all round the border ---------- */
function cutBorderRefs() {
  const W0 = CUT.w, H0 = CUT.h, O = CUT.orig.data, buckets = new Map(), edge = [];
  for (let x = 0; x < W0; x++) edge.push(x, x + (H0 - 1) * W0);
  for (let y = 1; y < H0 - 1; y++) edge.push(y * W0, y * W0 + W0 - 1);
  let clear = 0;
  for (const p of edge) { const i = p * 4; if (O[i + 3] < 20) { clear++; continue; } const key = (O[i] >> 4) + '|' + (O[i + 1] >> 4) + '|' + (O[i + 2] >> 4); const bk = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 }; bk.n++; bk.r += O[i]; bk.g += O[i + 1]; bk.b += O[i + 2]; buckets.set(key, bk); }
  /* merge neighbouring buckets so a slightly uneven paper counts as one colour */
  const list = [...buckets.values()].sort((a, b) => b.n - a.n), refs = [];
  for (const bk of list) { const c = [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n]; const near = refs.find((r) => Math.hypot(r.c[0] - c[0], r.c[1] - c[1], r.c[2] - c[2]) < 30); if (near) near.n += bk.n; else refs.push({ c, n: bk.n }); }
  refs.sort((a, b) => b.n - a.n);
  const top = refs.filter((r, k) => k < 3 && r.n >= edge.length * 0.04);
  const cover = (top.reduce((s, r) => s + r.n, 0) + clear) / edge.length;
  return { refs: top.map((r) => r.c), cover, clear: clear / edge.length, edge };
}
async function cutRun(kind) {
  if (CUT.busy) return;
  const B = cutBorderRefs();
  if (kind === 'auto') kind = B.clear > 0.6 ? 'flat' : B.cover >= 0.9 && B.refs.length <= 2 ? 'flat' : 'photo';
  cutPush(); CUT.cur = new ImageData(new Uint8ClampedArray(CUT.orig.data), CUT.w, CUT.h);
  if (kind === 'flat') {
    if (!B.refs.length && B.clear < 0.6) { CUT.undo.pop(); toast('ขอบรูปมีหลายสีเกินไป ลองแบบภาพถ่าย หรือแตะส่วนที่จะลบแทน', 3500); return; }
    cutBusy('กำลังลบพื้นหลัง'); await cutFrame();
    cutFlat(B); CUT.how = 'flat'; cutBusy(''); cutDraw();
    cutMsg('ใช้วิธีพื้นสีเรียบ (ลบสีพื้นจากขอบรูป) ถ้ายังไม่ดี ลองแบบภาพถ่าย หรือปรับความไวแล้วกดใหม่');
    return;
  }
  try {
    if (!CUT.frame) GC.rect = null;
    await cutPhoto({}); CUT.how = 'photo'; cutDraw();
    cutMsg('ใช้วิธีภาพถ่าย ถ้ายังไม่ตรง ลากกรอบรอบวัตถุ แล้วระบายสีเขียวบนส่วนที่เป็นวัตถุ สีแดงบนส่วนที่เป็นพื้นหลัง');
  } catch (e) {
    CUT.cur = CUT.undo.pop() || CUT.cur; cutDraw();
    toast('แยกภาพไม่สำเร็จ ลองแบบพื้นสีเรียบหรือลากกรอบรอบวัตถุแทน', 4000);
    console.warn('cut', e);
  } finally { cutBusy(''); }
}

/* ---------- flat background: flood from the border by colour, then unmix the background colour out of the edge ---------- */
function cutFlat(B) {
  const W0 = CUT.w, H0 = CUT.h, O = CUT.orig.data, D = CUT.cur.data, tol = CUT.tol, refs = B.refs, n = W0 * H0;
  const dist = new Float32Array(n), who = new Uint8Array(n);
  for (let p = 0; p < n; p++) { const i = p * 4; if (O[i + 3] < 20) { dist[p] = 0; continue; } let m = 1e9, k = 0; for (let j = 0; j < refs.length; j++) { const c = refs[j], d = cutDist(O, i, c[0], c[1], c[2]); if (d < m) { m = d; k = j; } } dist[p] = m; who[p] = k; }
  const gone = new Uint8Array(n), st = [];
  for (const p of B.edge) if (!gone[p] && dist[p] <= tol) { gone[p] = 1; st.push(p); }
  const grow = () => { while (st.length) { const p = st.pop(), x = p % W0; const nb = [x > 0 ? p - 1 : -1, x < W0 - 1 ? p + 1 : -1, p >= W0 ? p - W0 : -1, p < n - W0 ? p + W0 : -1]; for (const q of nb) if (q >= 0 && !gone[q] && dist[q] <= tol) { gone[q] = 1; st.push(q); } } };
  grow();
  /* enclosed pockets of the background colour (inside a letter, between the arms of a figure) of a fair size */
  if (CUT.holes) {
    const seen = new Uint8Array(n), minA = Math.max(30, n * 0.0004);
    for (let p0 = 0; p0 < n; p0++) {
      if (gone[p0] || seen[p0] || dist[p0] > tol * 0.6) continue;
      const comp = [p0]; seen[p0] = 1;
      for (let k = 0; k < comp.length; k++) { const p = comp[k], x = p % W0; const nb = [x > 0 ? p - 1 : -1, x < W0 - 1 ? p + 1 : -1, p >= W0 ? p - W0 : -1, p < n - W0 ? p + W0 : -1]; for (const q of nb) if (q >= 0 && !seen[q] && !gone[q] && dist[q] <= tol * 0.6) { seen[q] = 1; comp.push(q); } }
      if (comp.length >= minA) for (const p of comp) { gone[p] = 1; st.push(p); }
    }
    grow();
  }
  /* soft edge: pixels next to removed ones get an alpha from how far their colour is from the background, and the background
     colour is taken out of them (I = a F + (1 - a) B, so F = (I - (1 - a) B) / a) */
  const band = new Uint8Array(n);
  for (let p = 0; p < n; p++) { if (!gone[p]) continue; const x = p % W0; for (const q of [x > 0 ? p - 1 : -1, x < W0 - 1 ? p + 1 : -1, p >= W0 ? p - W0 : -1, p < n - W0 ? p + W0 : -1]) if (q >= 0 && !gone[q]) band[q] = 1; }
  for (let pass = 0; pass < 1; pass++) { const add = []; for (let p = 0; p < n; p++) { if (!band[p]) continue; const x = p % W0; for (const q of [x > 0 ? p - 1 : -1, x < W0 - 1 ? p + 1 : -1, p >= W0 ? p - W0 : -1, p < n - W0 ? p + W0 : -1]) if (q >= 0 && !gone[q] && !band[q]) add.push(q); } for (const q of add) band[q] = 2; }
  const hard = Math.max(tol * 3, 60);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (gone[p]) { D[i + 3] = 0; continue; }
    if (!band[p] || O[i + 3] < 20) continue;
    const c = refs[who[p]] || [255, 255, 255];
    const a = clamp((dist[p] - tol * 0.5) / (hard - tol * 0.5), 0, 1);
    if (a >= 1) continue;
    const aa = Math.max(a, 0.02);
    for (let k = 0; k < 3; k++) D[i + k] = clamp(Math.round((O[i + k] - (1 - aa) * c[k]) / aa), 0, 255);
    D[i + 3] = Math.round(O[i + 3] * a);
  }
}

/* ---------- photos: our own segmentation (GrabCut style, written for BURIN) ----------
   Two colour models, one for the object and one for the background, each a mixture of five Gaussians in RGB, are learnt
   from where the object probably is (inside the frame) and where it surely is not (outside the frame, and anything the
   teacher brushes as background). A minimum cut on the picture's grid then chooses object or background for every pixel,
   trading off how well its colour fits each model against keeping neighbours with similar colours together. This repeats
   a few times, each round relearning the models from the last cut. It runs on a reduced copy of the picture; the mask is
   then sharpened back to full size along the picture's own edges with a guided filter. */
const GC = { sw: 0, sh: 0, s: 1, px: null, hard: null, rect: null, fg: null, bg: null, nw: null, beta: 0 };
const GC_K = 5, GC_GAMMA = 50, GC_INF = 1e9;
function gcPrep() {
  const W0 = CUT.w, H0 = CUT.h, s = Math.min(1, 360 / Math.max(W0, H0)), sw = Math.max(8, Math.round(W0 * s)), sh = Math.max(8, Math.round(H0 * s));
  const tmp = document.createElement('canvas'); tmp.width = W0; tmp.height = H0; tmp.getContext('2d').putImageData(CUT.orig, 0, 0);
  const c = document.createElement('canvas'); c.width = sw; c.height = sh; const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, sw, sh); g.imageSmoothingQuality = 'high'; g.drawImage(tmp, 0, 0, sw, sh);
  const d = g.getImageData(0, 0, sw, sh).data, n = sw * sh, px = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { px[k * 3] = d[k * 4]; px[k * 3 + 1] = d[k * 4 + 1]; px[k * 3 + 2] = d[k * 4 + 2]; }
  Object.assign(GC, { sw, sh, s: sw / W0, px, hard: new Int8Array(n), rect: null, fg: null, bg: null });
  /* neighbour weights: strong between similar colours, weak across an edge */
  let sum = 0, cnt = 0;
  const NB = [[1, 0], [0, 1], [1, 1], [-1, 1]];
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) for (const [dx, dy] of NB) { const X = x + dx, Y = y + dy; if (X < 0 || X >= sw || Y >= sh) continue; const a = (y * sw + x) * 3, b = (Y * sw + X) * 3; const dr = px[a] - px[b], dg = px[a + 1] - px[b + 1], db = px[a + 2] - px[b + 2]; sum += dr * dr + dg * dg + db * db; cnt++; }
  GC.beta = 1 / (2 * Math.max(1e-6, sum / Math.max(1, cnt)));
  const nw = new Float32Array(n * 4);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) for (let k = 0; k < 4; k++) {
    const [dx, dy] = NB[k], X = x + dx, Y = y + dy; if (X < 0 || X >= sw || Y >= sh) continue;
    const a = (y * sw + x) * 3, b = (Y * sw + X) * 3, dr = px[a] - px[b], dg = px[a + 1] - px[b + 1], db = px[a + 2] - px[b + 2];
    nw[(y * sw + x) * 4 + k] = GC_GAMMA / (k >= 2 ? Math.SQRT2 : 1) * Math.exp(-GC.beta * (dr * dr + dg * dg + db * db));
  }
  GC.nw = nw;
}
/* ---- Gaussian mixtures ---- */
function gmmFit(px, idx, K) {
  const m = idx.length; if (!m) return null;
  /* k-means with spread-out starting centres, on a sample */
  const step = Math.max(1, Math.floor(m / 6000)), smp = []; for (let k = 0; k < m; k += step) smp.push(idx[k]);
  const C = []; { let r = 12345; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }; const first = smp[Math.floor(rnd() * smp.length)]; C.push([px[first * 3], px[first * 3 + 1], px[first * 3 + 2]]);
    const dd = new Float64Array(smp.length);
    while (C.length < K) { let tot = 0; for (let i = 0; i < smp.length; i++) { const p = smp[i] * 3; let best = 1e18; for (const c of C) { const v = (px[p] - c[0]) ** 2 + (px[p + 1] - c[1]) ** 2 + (px[p + 2] - c[2]) ** 2; if (v < best) best = v; } dd[i] = best; tot += best; } if (tot <= 0) break; let t = rnd() * tot, j = 0; while (j < smp.length - 1 && (t -= dd[j]) > 0) j++; const q = smp[j] * 3; C.push([px[q], px[q + 1], px[q + 2]]); } }
  for (let it = 0; it < 6; it++) { const acc = C.map(() => [0, 0, 0, 0]); for (const i of smp) { const p = i * 3; let best = 1e18, bk = 0; for (let k = 0; k < C.length; k++) { const c = C[k], v = (px[p] - c[0]) ** 2 + (px[p + 1] - c[1]) ** 2 + (px[p + 2] - c[2]) ** 2; if (v < best) { best = v; bk = k; } } const a = acc[bk]; a[0] += px[p]; a[1] += px[p + 1]; a[2] += px[p + 2]; a[3]++; } for (let k = 0; k < C.length; k++) if (acc[k][3]) C[k] = [acc[k][0] / acc[k][3], acc[k][1] / acc[k][3], acc[k][2] / acc[k][3]]; }
  const asg = new Uint8Array(m);
  for (let i = 0; i < m; i++) { const p = idx[i] * 3; let best = 1e18, bk = 0; for (let k = 0; k < C.length; k++) { const c = C[k], v = (px[p] - c[0]) ** 2 + (px[p + 1] - c[1]) ** 2 + (px[p + 2] - c[2]) ** 2; if (v < best) { best = v; bk = k; } } asg[i] = bk; }
  return gmmLearn(px, idx, asg, C.length);
}
function gmmLearn(px, idx, asg, K) {
  const S = []; for (let k = 0; k < K; k++) S.push({ n: 0, s: [0, 0, 0], ss: [0, 0, 0, 0, 0, 0, 0, 0, 0] });
  for (let i = 0; i < idx.length; i++) { const p = idx[i] * 3, r = px[p], g = px[p + 1], b = px[p + 2], c = S[asg[i]]; c.n++; c.s[0] += r; c.s[1] += g; c.s[2] += b; const v = [r, g, b]; for (let a = 0; a < 3; a++) for (let e = 0; e < 3; e++) c.ss[a * 3 + e] += v[a] * v[e]; }
  const comps = [];
  for (const c of S) {
    if (c.n < 3) continue;
    const mu = c.s.map((v) => v / c.n), cov = [];
    for (let a = 0; a < 3; a++) for (let e = 0; e < 3; e++) cov.push(c.ss[a * 3 + e] / c.n - mu[a] * mu[e] + (a === e ? 4 : 0));
    const [a, b, cc, d, e, f, g, h, k] = cov, det = a * (e * k - f * h) - b * (d * k - f * g) + cc * (d * h - e * g);
    if (!(det > 1e-9)) continue;
    const inv = [(e * k - f * h) / det, (cc * h - b * k) / det, (b * f - cc * e) / det, (f * g - d * k) / det, (a * k - cc * g) / det, (cc * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
    comps.push({ w: c.n / idx.length, mu, inv, lc: Math.log(c.n / idx.length) - 0.5 * Math.log(det) - 1.5 * Math.log(2 * Math.PI) });
  }
  return comps.length ? comps : null;
}
function gmmComp(G, r, g, b) { let best = -1e18, bk = 0; for (let k = 0; k < G.length; k++) { const c = G[k], x = r - c.mu[0], y = g - c.mu[1], z = b - c.mu[2], q = x * (c.inv[0] * x + c.inv[1] * y + c.inv[2] * z) + y * (c.inv[3] * x + c.inv[4] * y + c.inv[5] * z) + z * (c.inv[6] * x + c.inv[7] * y + c.inv[8] * z), l = c.lc - 0.5 * q; if (l > best) { best = l; bk = k; } } return bk; }
function gmmCost(G, r, g, b) {
  let mx = -1e18; const ls = [];
  for (const c of G) { const x = r - c.mu[0], y = g - c.mu[1], z = b - c.mu[2], q = x * (c.inv[0] * x + c.inv[1] * y + c.inv[2] * z) + y * (c.inv[3] * x + c.inv[4] * y + c.inv[5] * z) + z * (c.inv[6] * x + c.inv[7] * y + c.inv[8] * z), l = c.lc - 0.5 * q; ls.push(l); if (l > mx) mx = l; }
  let s = 0; for (const l of ls) s += Math.exp(l - mx); return -(mx + Math.log(s));
}
/* ---- minimum cut: Boykov-Kolmogorov augmenting paths with search trees grown from both terminals ---- */
function gcMaxflow(n, capS, capT, eFrom, eTo, eCap) {
  const m = eFrom.length * 2, to = new Int32Array(m), cap = new Float64Array(m), next = new Int32Array(m), first = new Int32Array(n).fill(-1);
  for (let i = 0; i < eFrom.length; i++) {
    const a = eFrom[i], b = eTo[i], e = 2 * i;
    to[e] = b; cap[e] = eCap[i]; next[e] = first[a]; first[a] = e;
    to[e + 1] = a; cap[e + 1] = eCap[i]; next[e + 1] = first[b]; first[b] = e + 1;
  }
  const tr = new Float64Array(n), tree = new Uint8Array(n), parent = new Int32Array(n), ts = new Int32Array(n), dist = new Int32Array(n);
  const TERM = -2, ORPH = -3, NONE = -1;
  const act = new Int32Array(n * 4 + 16); let qh = 0, qt = 0; const inq = new Uint8Array(n);
  const push = (i) => { if (inq[i]) return; inq[i] = 1; act[qt] = i; qt = (qt + 1) % act.length; };
  for (let i = 0; i < n; i++) { tr[i] = capS[i] - capT[i]; parent[i] = NONE; if (tr[i] > 0) { tree[i] = 1; parent[i] = TERM; dist[i] = 1; push(i); } else if (tr[i] < 0) { tree[i] = 2; parent[i] = TERM; dist[i] = 1; push(i); } }
  let time = 0; const orph = [];
  while (qh !== qt) {
    const i = act[qh]; qh = (qh + 1) % act.length; inq[i] = 0;
    if (!tree[i]) continue;
    let mid = -1;
    for (let e = first[i]; e >= 0; e = next[e]) {
      const j = to[e];
      if (tree[i] === 1 ? cap[e] > 0 : cap[e ^ 1] > 0) {
        if (!tree[j]) { tree[j] = tree[i]; parent[j] = e ^ 1; ts[j] = ts[i]; dist[j] = dist[i] + 1; push(j); }
        else if (tree[j] !== tree[i]) { mid = tree[i] === 1 ? e : e ^ 1; break; }
        else if (ts[j] <= ts[i] && dist[j] > dist[i]) { parent[j] = e ^ 1; ts[j] = ts[i]; dist[j] = dist[i] + 1; }
      }
    }
    if (mid < 0) continue;
    push(i);
    time++;
    /* the path: source tree side ends at s = from(mid), sink side starts at t = to(mid) */
    const sN = to[mid ^ 1], tN = to[mid];
    let bott = cap[mid];
    for (let k = sN; ; ) { const pe = parent[k]; if (pe === TERM) { if (tr[k] < bott) bott = tr[k]; break; } if (cap[pe ^ 1] < bott) bott = cap[pe ^ 1]; k = to[pe]; }
    for (let k = tN; ; ) { const pe = parent[k]; if (pe === TERM) { if (-tr[k] < bott) bott = -tr[k]; break; } if (cap[pe] < bott) bott = cap[pe]; k = to[pe]; }
    cap[mid] -= bott; cap[mid ^ 1] += bott;
    for (let k = sN; ; ) { const pe = parent[k]; if (pe === TERM) { tr[k] -= bott; if (tr[k] <= 0) { parent[k] = ORPH; orph.push(k); } break; } cap[pe ^ 1] -= bott; cap[pe] += bott; const nx = to[pe]; if (cap[pe ^ 1] <= 0) { parent[k] = ORPH; orph.push(k); } k = nx; }
    for (let k = tN; ; ) { const pe = parent[k]; if (pe === TERM) { tr[k] += bott; if (tr[k] >= 0) { parent[k] = ORPH; orph.push(k); } break; } cap[pe] -= bott; cap[pe ^ 1] += bott; const nx = to[pe]; if (cap[pe] <= 0) { parent[k] = ORPH; orph.push(k); } k = nx; }
    /* adoption */
    while (orph.length) {
      const i2 = orph.pop(), side = tree[i2];
      let best = NONE, bd = 1e9;
      for (let e = first[i2]; e >= 0; e = next[e]) {
        const j = to[e]; if (tree[j] !== side) continue;
        if (side === 1 ? cap[e ^ 1] <= 0 : cap[e] <= 0) continue;
        /* is j still rooted at a terminal? */
        let k = j, d = 0, ok = false;
        for (;;) { if (ts[k] === time) { d += dist[k]; ok = true; break; } const pe = parent[k]; d++; if (pe === TERM) { ts[k] = time; dist[k] = 1; ok = true; break; } if (pe === ORPH || pe === NONE) break; k = to[pe]; }
        if (ok) { if (d < bd) { bd = d; best = e; } for (let k2 = j, dd = d; ts[k2] !== time; k2 = to[parent[k2]]) { ts[k2] = time; dist[k2] = dd--; } }
      }
      if (best !== NONE) { parent[i2] = best; ts[i2] = time; dist[i2] = bd + 1; continue; }
      tree[i2] = 0; parent[i2] = NONE;
      for (let e = first[i2]; e >= 0; e = next[e]) {
        const j = to[e]; if (tree[j] !== side) continue;
        if (side === 1 ? cap[e ^ 1] > 0 : cap[e] > 0) push(j);
        if (parent[j] === (e ^ 1)) { parent[j] = ORPH; orph.push(j); }
      }
    }
  }
  return tree;
}
/* one round: learn both models from the current labels, then cut */
function gcRound(lab, iters) {
  const { sw, sh, px, hard, nw } = GC, n = sw * sh;
  for (let it = 0; it < iters; it++) {
    const fi = [], bi = []; for (let p = 0; p < n; p++) (lab[p] ? fi : bi).push(p);
    if (!fi.length || !bi.length) return lab;
    if (!GC.fg || it > 0 || GC.fresh) { GC.fg = gmmFit(px, Int32Array.from(fi), GC_K); GC.bg = gmmFit(px, Int32Array.from(bi), GC_K); GC.fresh = false; }
    else { const fa = new Uint8Array(fi.length), ba = new Uint8Array(bi.length); for (let i = 0; i < fi.length; i++) { const q = fi[i] * 3; fa[i] = gmmComp(GC.fg, px[q], px[q + 1], px[q + 2]); } for (let i = 0; i < bi.length; i++) { const q = bi[i] * 3; ba[i] = gmmComp(GC.bg, px[q], px[q + 1], px[q + 2]); } GC.fg = gmmLearn(px, Int32Array.from(fi), fa, GC.fg.length) || GC.fg; GC.bg = gmmLearn(px, Int32Array.from(bi), ba, GC.bg.length) || GC.bg; }
    if (!GC.fg || !GC.bg) return lab;
    const capS = new Float64Array(n), capT = new Float64Array(n), R = GC.rect;
    for (let p = 0; p < n; p++) {
      const x = p % sw, y = (p - x) / sw, outside = R && (x < R[0] || y < R[1] || x > R[2] || y > R[3]);
      if (hard[p] > 0) { capS[p] = GC_INF; continue; }
      if (hard[p] < 0 || outside) { capT[p] = GC_INF; continue; }
      const q = p * 3; capS[p] = gmmCost(GC.bg, px[q], px[q + 1], px[q + 2]); capT[p] = gmmCost(GC.fg, px[q], px[q + 1], px[q + 2]);
    }
    const NB = [[1, 0], [0, 1], [1, 1], [-1, 1]], eF = [], eT = [], eC = [];
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) for (let k = 0; k < 4; k++) { const X = x + NB[k][0], Y = y + NB[k][1]; if (X < 0 || X >= sw || Y >= sh) continue; const p = y * sw + x; eF.push(p); eT.push(Y * sw + X); eC.push(nw[p * 4 + k]); }
    const tree = gcMaxflow(n, capS, capT, Int32Array.from(eF), Int32Array.from(eT), Float64Array.from(eC));
    for (let p = 0; p < n; p++) lab[p] = tree[p] === 1 ? 1 : 0;
  }
  return lab;
}
/* the automatic frame for a photo: the object is somewhere inside; the sides of the picture are background, except a side
   whose colours do not look like the other sides (the object is cut off by that edge, like a person at the bottom) */
function gcAutoRect() {
  const { sw, sh, px, hard } = GC, mg = Math.max(2, Math.round(Math.min(sw, sh) * 0.03));
  const side = (k) => { const out = []; if (k === 0) for (let x = 0; x < sw; x++) for (let y = 0; y < mg; y++) out.push(y * sw + x); if (k === 1) for (let x = 0; x < sw; x++) for (let y = sh - mg; y < sh; y++) out.push(y * sw + x); if (k === 2) for (let y = 0; y < sh; y++) for (let x = 0; x < mg; x++) out.push(y * sw + x); if (k === 3) for (let y = 0; y < sh; y++) for (let x = sw - mg; x < sw; x++) out.push(y * sw + x); return out; };
  const S4 = [0, 1, 2, 3].map(side), mean = S4.map((ps) => { const m = [0, 0, 0]; for (const p of ps) { m[0] += px[p * 3]; m[1] += px[p * 3 + 1]; m[2] += px[p * 3 + 2]; } return m.map((v) => v / ps.length); });
  const spread = S4.map((ps, k) => { let s = 0; for (const p of ps) s += Math.hypot(px[p * 3] - mean[k][0], px[p * 3 + 1] - mean[k][1], px[p * 3 + 2] - mean[k][2]); return s / ps.length; });
  const open = [false, false, false, false];
  for (let k = 0; k < 4; k++) { const others = [0, 1, 2, 3].filter((j) => j !== k); const dm = Math.min(...others.map((j) => Math.hypot(mean[k][0] - mean[j][0], mean[k][1] - mean[j][1], mean[k][2] - mean[j][2]))); if (dm > 45 && spread[k] > Math.min(...others.map((j) => spread[j])) * 1.3) open[k] = true; }
  if (open.every(Boolean)) open.fill(false);
  /* only the outermost pixel is surely background; a wider band starts as probably background, so hair or an elbow
     close to the edge can still be won back by the object model */
  GC.rect = [open[2] ? 0 : 1, open[0] ? 0 : 1, open[3] ? sw - 1 : sw - 2, open[1] ? sh - 1 : sh - 2];
  GC.ring = { mg, open };
  void hard;
}
function gcLabelsFromRect() { const { sw, sh } = GC, R = GC.rect, G2 = GC.ring, lab = new Uint8Array(sw * sh); for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let v = x >= R[0] && y >= R[1] && x <= R[2] && y <= R[3] ? 1 : 0; if (v && G2 && ((!G2.open[0] && y < G2.mg) || (!G2.open[1] && y >= sh - G2.mg) || (!G2.open[2] && x < G2.mg) || (!G2.open[3] && x >= sw - G2.mg))) v = 0; lab[y * sw + x] = v; } for (let p = 0; p < lab.length; p++) if (GC.hard[p]) lab[p] = GC.hard[p] > 0 ? 1 : 0; return lab; }
async function cutPhoto(opts) {
  CUT.busy = true; opts = opts || {};
  if (!GC.px || GC.for !== CUT.orig) { gcPrep(); GC.for = CUT.orig; }
  if (opts.rect) { GC.rect = opts.rect; GC.ring = null; } else if (!GC.rect) gcAutoRect();
  cutBusy('กำลังแยกวัตถุออกจากพื้นหลัง'); await cutFrame();
  let lab = opts.again && GC.lab ? GC.lab : gcLabelsFromRect();
  if (!opts.again) GC.fresh = true;
  lab = gcRound(lab, opts.again ? 2 : 5);
  GC.lab = lab;
  cutBusy('กำลังเก็บขอบให้คม'); await cutFrame();
  cutFinish(lab);
}
/* small mask back to full size, sharpened along the picture's own edges, specks dropped and edge colours cleaned */
function cutFinish(lab) {
  const W0 = CUT.w, H0 = CUT.h, n = W0 * H0, O = CUT.orig.data, D = CUT.cur.data, { sw, sh } = GC;
  const mk = document.createElement('canvas'); mk.width = sw; mk.height = sh; const mg = mk.getContext('2d'), md = mg.createImageData(sw, sh);
  for (let k = 0; k < sw * sh; k++) { const v = lab[k] ? 255 : 0; md.data[k * 4] = md.data[k * 4 + 1] = md.data[k * 4 + 2] = v; md.data[k * 4 + 3] = 255; }
  mg.putImageData(md, 0, 0);
  const up = document.createElement('canvas'); up.width = W0; up.height = H0; const ug = up.getContext('2d', { willReadFrequently: true }); ug.imageSmoothingQuality = 'high'; ug.drawImage(mk, 0, 0, W0, H0);
  const U = ug.getImageData(0, 0, W0, H0).data, P = new Float32Array(n), G = new Float32Array(n);
  for (let k = 0; k < n; k++) { P[k] = U[k * 4] / 255; const a = O[k * 4 + 3] / 255; G[k] = ((O[k * 4] * 0.299 + O[k * 4 + 1] * 0.587 + O[k * 4 + 2] * 0.114) * a + 255 * (1 - a)) / 255; }
  const r = Math.max(2, Math.round(Math.max(W0, H0) / 240)), Q = cutGuided(G, P, W0, H0, r, 0.0015);
  const A = new Float32Array(n);
  for (let k = 0; k < n; k++) { const t = clamp((Q[k] - 0.15) / 0.7, 0, 1); A[k] = t * t * (3 - 2 * t); }
  const lb = new Int32Array(n).fill(-1), sizes = [];
  for (let p0 = 0; p0 < n; p0++) {
    if (lb[p0] >= 0 || A[p0] < 0.5) continue;
    const id = sizes.length, st = [p0]; lb[p0] = id; let c = 0;
    while (st.length) { const p = st.pop(); c++; const xx = p % W0; for (const q of [xx > 0 ? p - 1 : -1, xx < W0 - 1 ? p + 1 : -1, p >= W0 ? p - W0 : -1, p < n - W0 ? p + W0 : -1]) if (q >= 0 && lb[q] < 0 && A[q] >= 0.5) { lb[q] = id; st.push(q); } }
    sizes.push(c);
  }
  const big = Math.max(0, ...sizes), keep = sizes.map((s) => s >= big * 0.015);
  for (let p = 0; p < n; p++) { if (lb[p] >= 0) { if (!keep[lb[p]]) A[p] = 0; continue; } if (A[p] <= 0.01) continue; const xx = p % W0, yy = (p - xx) / W0; let ok = false, any = false; for (let dy = -3; dy <= 3 && !ok; dy++) for (let dx = -3; dx <= 3; dx++) { const X = xx + dx, Y = yy + dy; if (X < 0 || Y < 0 || X >= W0 || Y >= H0) continue; const l = lb[Y * W0 + X]; if (l >= 0) { any = true; if (keep[l]) { ok = true; break; } } } if (any && !ok) A[p] = 0; else if (!any && A[p] < 0.2) A[p] = 0; }
  const w = new Float32Array(n), cr = new Float32Array(n), cg = new Float32Array(n), cb = new Float32Array(n);
  for (let k = 0; k < n; k++) { const a = A[k], ww = a * a * a * a; w[k] = ww; cr[k] = O[k * 4] * ww; cg[k] = O[k * 4 + 1] * ww; cb[k] = O[k * 4 + 2] * ww; }
  const bw = cutBox(w, W0, H0, r), br = cutBox(cr, W0, H0, r), bgc = cutBox(cg, W0, H0, r), bb = cutBox(cb, W0, H0, r);
  for (let k = 0; k < n; k++) {
    const i = k * 4, a = A[k];
    D[i] = O[i]; D[i + 1] = O[i + 1]; D[i + 2] = O[i + 2];
    D[i + 3] = Math.round(Math.min(O[i + 3], a * 255));
    if (a > 0.02 && a < 0.97 && bw[k] > 1e-4) { const m = Math.min(1, (1 - a) * 1.5); D[i] = Math.round(O[i] * (1 - m) + br[k] / bw[k] * m); D[i + 1] = Math.round(O[i + 1] * (1 - m) + bgc[k] / bw[k] * m); D[i + 2] = Math.round(O[i + 2] * (1 - m) + bb[k] / bw[k] * m); }
  }
}
/* box mean over a (2r+1) square with an integral image, edges clamped */
function cutBox(src, W0, H0, r) {
  const I = new Float64Array((W0 + 1) * (H0 + 1)), out = new Float32Array(W0 * H0);
  for (let y = 0; y < H0; y++) { let s = 0; for (let x = 0; x < W0; x++) { s += src[y * W0 + x]; I[(y + 1) * (W0 + 1) + x + 1] = I[y * (W0 + 1) + x + 1] + s; } }
  for (let y = 0; y < H0; y++) { const y0 = Math.max(0, y - r), y1 = Math.min(H0, y + r + 1); for (let x = 0; x < W0; x++) { const x0 = Math.max(0, x - r), x1 = Math.min(W0, x + r + 1); out[y * W0 + x] = (I[y1 * (W0 + 1) + x1] - I[y0 * (W0 + 1) + x1] - I[y1 * (W0 + 1) + x0] + I[y0 * (W0 + 1) + x0]) / ((y1 - y0) * (x1 - x0)); } }
  return out;
}
/* guided filter (He, Sun, Tang): the output follows the guide's edges while keeping the input's values */
function cutGuided(I, P, W0, H0, r, eps) {
  const n = W0 * H0, II = new Float32Array(n), IP = new Float32Array(n);
  for (let k = 0; k < n; k++) { II[k] = I[k] * I[k]; IP[k] = I[k] * P[k]; }
  const mI = cutBox(I, W0, H0, r), mP = cutBox(P, W0, H0, r), cII = cutBox(II, W0, H0, r), cIP = cutBox(IP, W0, H0, r);
  const A = new Float32Array(n), Bv = new Float32Array(n);
  for (let k = 0; k < n; k++) { const v = cII[k] - mI[k] * mI[k], cv = cIP[k] - mI[k] * mP[k]; A[k] = cv / (v + eps); Bv[k] = mP[k] - A[k] * mI[k]; }
  const mA = cutBox(A, W0, H0, r), mB = cutBox(Bv, W0, H0, r), Q = new Float32Array(n);
  for (let k = 0; k < n; k++) Q[k] = mA[k] * I[k] + mB[k];
  return Q;
}
/* the teacher's own marks: a frame around the object, and brush strokes for "this is object" and "this is background" */
function gcMark(x, y, k, v) {
  if (!GC.px) { gcPrep(); GC.for = CUT.orig; }
  const s = GC.s, R = Math.max(1, CUT.brush * k * s), cx = x * s, cy = y * s, { sw, sh } = GC;
  for (let yy = Math.max(0, Math.floor(cy - R)); yy <= Math.min(sh - 1, Math.ceil(cy + R)); yy++) for (let xx = Math.max(0, Math.floor(cx - R)); xx <= Math.min(sw - 1, Math.ceil(cx + R)); xx++) if (Math.hypot(xx - cx, yy - cy) <= R) GC.hard[yy * sw + xx] = v;
}
/* ---------- by hand ---------- */
/* remove (or bring back) the connected region around a tapped point whose colour is close to the tapped colour */
function cutFill(x0, y0, keep) {
  const W0 = CUT.w, H0 = CUT.h, O = CUT.orig.data, D = CUT.cur.data, tol = CUT.tol, i0 = (y0 * W0 + x0) * 4;
  const r = O[i0], g = O[i0 + 1], b = O[i0 + 2], seen = new Uint8Array(W0 * H0), st = [x0 + y0 * W0];
  seen[x0 + y0 * W0] = 1;
  while (st.length) {
    const p = st.pop(), x = p % W0, y = (p - x) / W0, i = p * 4, d = cutDist(O, i, r, g, b);
    if (d > tol * 1.35) continue;
    const a = d <= tol ? 1 : 1 - (d - tol) / (tol * 0.35);
    if (keep) { if (a > 0.5) { D[i] = O[i]; D[i + 1] = O[i + 1]; D[i + 2] = O[i + 2]; } D[i + 3] = Math.max(D[i + 3], Math.round(O[i + 3] * a)); } else D[i + 3] = Math.min(D[i + 3], Math.round(255 * (1 - a)));
    if (d > tol) continue;
    if (x > 0 && !seen[p - 1]) { seen[p - 1] = 1; st.push(p - 1); }
    if (x < W0 - 1 && !seen[p + 1]) { seen[p + 1] = 1; st.push(p + 1); }
    if (y > 0 && !seen[p - W0]) { seen[p - W0] = 1; st.push(p - W0); }
    if (y < H0 - 1 && !seen[p + W0]) { seen[p + W0] = 1; st.push(p + W0); }
  }
}
/* remove one colour everywhere in the picture, joined or not (white inside letters, a coloured fill used all over) */
function cutColor(x0, y0) {
  const W0 = CUT.w, n = W0 * CUT.h, O = CUT.orig.data, D = CUT.cur.data, tol = CUT.tol, i0 = (y0 * W0 + x0) * 4, r = O[i0], g = O[i0 + 1], b = O[i0 + 2];
  for (let p = 0; p < n; p++) { const i = p * 4, d = cutDist(O, i, r, g, b); if (d > tol * 1.35) continue; const a = d <= tol ? 1 : 1 - (d - tol) / (tol * 0.35); D[i + 3] = Math.min(D[i + 3], Math.round(255 * (1 - a))); }
}
function cutBrush(x, y, k) {
  const R = Math.max(1, CUT.brush * k), D = CUT.cur.data, O = CUT.orig.data, W0 = CUT.w, H0 = CUT.h;
  for (let yy = Math.max(0, Math.floor(y - R)); yy <= Math.min(H0 - 1, Math.ceil(y + R)); yy++) for (let xx = Math.max(0, Math.floor(x - R)); xx <= Math.min(W0 - 1, Math.ceil(x + R)); xx++) {
    const dd = Math.hypot(xx - x, yy - y); if (dd > R) continue; const i = (yy * W0 + xx) * 4, soft = clamp((R - dd) / Math.max(1, R * 0.25), 0, 1);
    if (CUT.mode === 'erase') D[i + 3] = Math.min(D[i + 3], Math.round(D[i + 3] * (1 - soft)));
    else { if (soft > 0.5) { D[i] = O[i]; D[i + 1] = O[i + 1]; D[i + 2] = O[i + 2]; } D[i + 3] = Math.max(D[i + 3], Math.round(O[i + 3] * soft)); }
  }
}
/* save as PNG, trimmed to what is left, and put it in place of the old picture (undo brings the old one back) */
async function cutSave() {
  if (CUT.busy) return;
  const A = await getAssets(); if (!A) { toast('มุมมองนี้บันทึกรูปไม่ได้', 3000); return; }
  const it = findItem(CUT.it); if (!it) { $('#cutSheet').hidden = true; return; }
  const W0 = CUT.w, H0 = CUT.h, D = CUT.cur.data; let x0 = W0, y0 = H0, x1 = -1, y1 = -1;
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) if (D[(y * W0 + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { toast('ลบออกหมดทั้งรูปแล้ว แตะเริ่มใหม่หรือย้อนกลับ', 3000); return; }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = document.createElement('canvas'); out.width = cw; out.height = ch;
  const full = document.createElement('canvas'); full.width = W0; full.height = H0; full.getContext('2d').putImageData(CUT.cur, 0, 0);
  out.getContext('2d').drawImage(full, x0, y0, cw, ch, 0, 0, cw, ch);
  const blob = await new Promise((res) => out.toBlob(res, 'image/png')); if (!blob) { toast('บันทึกรูปไม่สำเร็จ', 3000); return; }
  const FL = floatLine('กำลังบันทึกรูป');
  try {
  try {
    const r = await A.upload(blob, { type: 'image/png' });
    const sc = (it.w || 480) / W0, before = clone(S.page.items || []);
    const items = before.map((t) => (t.id === it.id ? Object.assign({}, t, { asset: r.id, x: Math.round(t.x + x0 * sc), y: Math.round(t.y + y0 * sc), w: Math.max(20, Math.round(cw * sc)), ar: Math.round(ch / cw * 1000) / 1000, cut: 1 }) : t));
    setItems(items, before);
    $('#cutSheet').hidden = true; cutFree(); toast('ตัดพื้นหลังแล้ว กดย้อนกลับบนหน้าได้ถ้าต้องการรูปเดิม', 3000);
  } catch (e) { toast(assetErr(e), 4500); }
  } finally { FL(); }
}

/* ---------- draw a picture from a reference: our own line finding and colouring, drawn stroke by stroke like a hand ----------
   A reference picture (from the device, a picture on the page, or a search of Wikimedia Commons) becomes real ink:
   - "realistic": the edges of the picture (found with our own Canny edge finder) plus pencil hatching in the dark parts;
   - "cartoon": the picture is simplified into a few flat colour areas first, and the lines are the borders between them,
     so the outlines are clean and closed like a cartoon;
   - with colour: each colour area is filled in with felt-pen strokes (cartoon) or light marker strokes (realistic).
   The lines are drawn first, long outlines before small details, then the colour, all as ordinary strokes you can erase or move. */
const SK = { src: null, style: 'cartoon', color: true, name: '', credit: '' };

function skGray(d, w, h) { const g = new Float32Array(w * h); for (let i = 0; i < w * h; i++) g[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255; return g; }
function skBlur(a, w, h, sig) {
  const r = Math.max(1, Math.ceil(sig * 2.5)), k = []; let s = 0; for (let i = -r; i <= r; i++) { const v = Math.exp(-i * i / (2 * sig * sig)); k.push(v); s += v; } for (let i = 0; i < k.length; i++) k[i] /= s;
  const t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let i = -r; i <= r; i++) v += a[y * w + clamp(x + i, 0, w - 1)] * k[i + r]; t[y * w + x] = v; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let i = -r; i <= r; i++) v += t[clamp(y + i, 0, h - 1) * w + x] * k[i + r]; o[y * w + x] = v; }
  return o;
}
/* Canny: gradient, thin to one pixel along the gradient, keep strong edges and the weak ones joined to them */
function skCanny(g, w, h, lo, hi) {
  const mag = new Float32Array(w * h), dir = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, gx = (g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - 1] + g[i + w - 1]), gy = (g[i + w - 1] + 2 * g[i + w] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - w] + g[i - w + 1]);
    mag[i] = Math.hypot(gx, gy); let a = Math.atan2(gy, gx) * 180 / Math.PI; if (a < 0) a += 180; dir[i] = a < 22.5 || a >= 157.5 ? 0 : a < 67.5 ? 1 : a < 112.5 ? 2 : 3;
  }
  const nms = new Float32Array(w * h), off = [[1, 0], [1, 1], [0, 1], [-1, 1]];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, [dx, dy] = off[dir[i]], m = mag[i]; if (m >= mag[i + dy * w + dx] && m >= mag[i - dy * w - dx]) nms[i] = m; }
  /* thresholds from the picture itself: a share of the strongest edges */
  const vals = []; for (let i = 0; i < w * h; i += 3) if (nms[i] > 0) vals.push(nms[i]); vals.sort((a, b) => a - b);
  const H = vals.length ? vals[Math.floor(vals.length * hi)] : 1, L = H * lo;
  const e = new Uint8Array(w * h), st = [];
  for (let i = 0; i < w * h; i++) if (nms[i] >= H) { e[i] = 1; st.push(i); }
  while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (!e[j] && nms[j] >= L) { e[j] = 1; st.push(j); } } }
  return e;
}
/* k-means colours (a few passes over a sample), then each pixel takes its nearest colour; small specks join their neighbours */
function skQuant(d, w, h, K) {
  const n = w * h, sample = []; for (let i = 0; i < n; i += 7) sample.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
  let C = []; for (let k = 0; k < K; k++) C.push(sample[Math.floor((k + 0.5) / K * sample.length)].slice());
  /* spread the starting colours by brightness so dark and light parts both get one */
  sample.sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2]); C = C.map((_, k) => sample[Math.floor((k + 0.5) / K * sample.length)].slice());
  for (let it = 0; it < 8; it++) {
    const S = C.map(() => [0, 0, 0, 0]);
    for (const p of sample) { let bi = 0, bd = 1e12; for (let k = 0; k < K; k++) { const c = C[k], dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < bd) { bd = dd; bi = k; } } const s = S[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; }
    C = C.map((c, k) => (S[k][3] ? [S[k][0] / S[k][3], S[k][1] / S[k][3], S[k][2] / S[k][3]] : c));
  }
  const lab = new Uint8Array(n);
  for (let i = 0; i < n; i++) { let bi = 0, bd = 1e12; for (let k = 0; k < K; k++) { const c = C[k], dd = (d[i * 4] - c[0]) ** 2 + (d[i * 4 + 1] - c[1]) ** 2 + (d[i * 4 + 2] - c[2]) ** 2; if (dd < bd) { bd = dd; bi = k; } } lab[i] = bi; }
  /* majority filter twice: removes specks and jagged borders */
  for (let pass = 0; pass < 2; pass++) { const o = lab.slice(); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const cnt = new Uint8Array(K); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cnt[lab[(y + dy) * w + x + dx]]++; let bk = lab[y * w + x]; for (let k = 0; k < K; k++) if (cnt[k] > cnt[bk]) bk = k; if (cnt[bk] >= 5) o[y * w + x] = bk; } lab.set(o); }
  return { lab, C };
}
/* smoothing that keeps edges: each pixel is averaged with neighbours of a similar colour only (a simple bilateral filter) */
function skSmooth(d, w, h, passes) {
  let a = new Float32Array(w * h * 3); for (let i = 0; i < w * h; i++) { a[i * 3] = d[i * 4]; a[i * 3 + 1] = d[i * 4 + 1]; a[i * 3 + 2] = d[i * 4 + 2]; }
  const s2 = 2 * 28 * 28;
  for (let p = 0; p < passes; p++) {
    const o = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3; let r = 0, g = 0, b = 0, ws = 0;
      for (let dy = -2; dy <= 2; dy++) { const yy = clamp(y + dy, 0, h - 1); for (let dx = -2; dx <= 2; dx++) { const j = (yy * w + clamp(x + dx, 0, w - 1)) * 3, dc = (a[j] - a[i]) ** 2 + (a[j + 1] - a[i + 1]) ** 2 + (a[j + 2] - a[i + 2]) ** 2, wt = Math.exp(-dc / s2 - (dx * dx + dy * dy) / 8); r += a[j] * wt; g += a[j + 1] * wt; b += a[j + 2] * wt; ws += wt; } }
      o[i] = r / ws; o[i + 1] = g / ws; o[i + 2] = b / ws;
    }
    a = o;
  }
  const out = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { out[i * 4] = a[i * 3]; out[i * 4 + 1] = a[i * 3 + 1]; out[i * 4 + 2] = a[i * 3 + 2]; out[i * 4 + 3] = 255; }
  return out;
}
/* small patches of one colour join the colour around them, so a cartoon has a few clear shapes instead of many specks */
function skMerge(lab, w, h, minA) {
  const comp = new Int32Array(w * h).fill(-1); let id = 0;
  for (let s = 0; s < w * h; s++) {
    if (comp[s] >= 0) continue; const k = lab[s], st = [s], px = []; comp[s] = id;
    while (st.length) { const i = st.pop(); px.push(i); const x = i % w, y = (i / w) | 0; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && comp[j] < 0 && lab[j] === k) { comp[j] = id; st.push(j); } }
    if (px.length < minA) { const cnt = {}; for (const i of px) { const x = i % w, y = (i / w) | 0; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && lab[j] !== k) cnt[lab[j]] = (cnt[lab[j]] || 0) + 1; } let bk = k, bc = 0; for (const q in cnt) if (cnt[q] > bc) { bc = cnt[q]; bk = +q; } if (bk !== k) for (const i of px) lab[i] = bk; }
    id++;
  }
}
/* edge pixels into lines: follow each chain of touching pixels from its loose end */
function skTrace(e, w, h, minLen) {
  const seen = new Uint8Array(w * h), lines = [];
  const nb = (i) => { const x = i % w, y = (i / w) | 0, o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (e[j] && !seen[j]) o.push(j); } return o; };
  const follow = (s) => { const P = []; let i = s; seen[i] = 1; P.push([i % w, (i / w) | 0]); for (;;) { const o = nb(i); if (!o.length) break; let best = o[0]; if (P.length > 1) { const a = P[P.length - 1], b = P[P.length - 2], vx = a[0] - b[0], vy = a[1] - b[1]; let bd = -9; for (const j of o) { const d = (j % w - a[0]) * vx + (((j / w) | 0) - a[1]) * vy; if (d > bd) { bd = d; best = j; } } } i = best; seen[i] = 1; P.push([i % w, (i / w) | 0]); } return P; };
  const deg = (i) => { const x = i % w, y = (i / w) | 0; let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && e[yy * w + xx]) c++; } return c; };
  for (let i = 0; i < w * h; i++) if (e[i] && !seen[i] && deg(i) === 1) { const P = follow(i); if (P.length >= minLen) lines.push(P); }
  for (let i = 0; i < w * h; i++) if (e[i] && !seen[i]) { const P = follow(i); if (P.length >= minLen) lines.push(P); }
  return lines;
}
function skRdp(P, eps) {
  if (P.length < 3) return P.slice(); const a = P[0], z = P[P.length - 1]; let id = -1, md = 0;
  for (let i = 1; i < P.length - 1; i++) { const d = ipSegD(P[i], a, z); if (d > md) { md = d; id = i; } }
  if (md <= eps) return [a, z]; return skRdp(P.slice(0, id + 1), eps).slice(0, -1).concat(skRdp(P.slice(id), eps));
}
function skChaikin(P) { if (P.length < 3) return P; const o = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(P[P.length - 1]); return o; }
/* the order a person draws in: the long outlines first, then the middle-sized lines, then small details; within each, the
   next line is the one starting nearest to where the pen is */
function skOrder(lines) {
  const len = (P) => { let s = 0; for (let i = 1; i < P.length; i++) s += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return s; };
  const L = lines.map((P) => ({ P, l: len(P) })).sort((a, b) => b.l - a.l), n = L.length, tiers = [L.slice(0, Math.ceil(n * 0.15)), L.slice(Math.ceil(n * 0.15), Math.ceil(n * 0.5)), L.slice(Math.ceil(n * 0.5))], out = [];
  let pen = [0, 0];
  for (const tier of tiers) { const rest = tier.slice(); while (rest.length) { let bi = 0, bd = 1e12, rev = false; rest.forEach((q, k) => { const a = q.P[0], z = q.P[q.P.length - 1], da = Math.hypot(a[0] - pen[0], a[1] - pen[1]), dz = Math.hypot(z[0] - pen[0], z[1] - pen[1]); if (da < bd) { bd = da; bi = k; rev = false; } if (dz < bd) { bd = dz; bi = k; rev = true; } }); const q = rest.splice(bi, 1)[0], P = rev ? q.P.slice().reverse() : q.P; out.push(P); pen = P[P.length - 1]; } }
  return out;
}
/* filling one colour area by hand: parallel strokes across it, each run of the area becomes one stroke, joined in a zigzag */
function skHatch(lab, w, h, k, step, ang) {
  const ca = Math.cos(ang), sa = Math.sin(ang), diag = Math.hypot(w, h), out = [];
  for (let s = -diag; s <= diag; s += step) {
    let run = null; const runs = [];
    for (let u = -diag; u <= diag; u += 1) { const x = Math.round(w / 2 + u * ca - s * sa), y = Math.round(h / 2 + u * sa + s * ca), inside = x >= 0 && y >= 0 && x < w && y < h && lab[y * w + x] === k; if (inside) { if (!run) run = [[x, y], [x, y]]; else run[1] = [x, y]; } else if (run) { runs.push(run); run = null; } }
    if (run) runs.push(run);
    for (const r of runs) if (Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]) >= step * 0.8) out.push(out.length % 2 ? [r[1], r[0]] : r);
  }
  return out;
}
/* the whole drawing from a picture, in the picture's own pixel units */
function skMake(im, style, color) {
  const N = style === 'real' ? 440 : 380, k0 = Math.min(1, N / Math.max(im.naturalWidth || im.width, im.naturalHeight || im.height));
  const w = Math.max(8, Math.round((im.naturalWidth || im.width) * k0)), h = Math.max(8, Math.round((im.naturalHeight || im.height) * k0));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, w, h); c.drawImage(im, 0, 0, w, h);
  const d = c.getImageData(0, 0, w, h).data;
  const res = { w, h, lines: [], hatch: [], fills: [] };
  let Q = null;
  if (style === 'cartoon') {
    /* simplify into flat colour areas; their borders are the outlines */
    const sm = skSmooth(d, w, h, 2);
    Q = skQuant(sm, w, h, 7);
    skMerge(Q.lab, w, h, Math.round(w * h * 0.0012)); skMerge(Q.lab, w, h, Math.round(w * h * 0.0012));
    const e = new Uint8Array(w * h);
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) { const i = y * w + x; if (Q.lab[i] !== Q.lab[i + 1] || Q.lab[i] !== Q.lab[i + w]) e[i] = 1; }
    /* also the strong edges inside an area (eyes, mouth lines), so faces keep their features */
    const g = skBlur(skGray(d, w, h), w, h, 1.6), ce = skCanny(g, w, h, 0.5, 0.88), fe = skTrace(ce, w, h, 12);
    for (const P of fe) for (const [x, y] of P) e[y * w + x] = 1;
    res.lines = skTrace(e, w, h, 14).map((P) => skChaikin(skChaikin(skRdp(P, 1.4))));
  } else {
    const g = skBlur(skGray(d, w, h), w, h, 1.4), e = skCanny(g, w, h, 0.38, 0.84);
    res.lines = skTrace(e, w, h, 10).map((P) => skChaikin(skRdp(P, 0.9)));
    /* pencil shading: hatching where the picture is dark, cross-hatching where it is darker still */
    const gs = skBlur(g, w, h, 2.5), lv = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) lv[i] = gs[i] < 0.22 ? 2 : gs[i] < 0.42 ? 1 : 0;
    const dk = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) dk[i] = lv[i] >= 1 ? 1 : 0;
    const dk2 = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) dk2[i] = lv[i] >= 2 ? 1 : 0;
    res.hatch = skHatch(dk, w, h, 1, 6, -0.75).concat(skHatch(dk2, w, h, 1, 8, 0.75));
    if (color) Q = skQuant(d, w, h, 8);
  }
  res.lines = skOrder(res.lines);
  if (color && Q) {
    /* colour areas from the largest; the paper-white one is left as paper */
    const area = new Array(Q.C.length).fill(0); for (let i = 0; i < w * h; i++) area[Q.lab[i]]++;
    const order = Q.C.map((c, k) => k).sort((a, b) => area[b] - area[a]);
    for (const k of order) {
      const c = Q.C[k], lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; if (lum > 0.9 || area[k] < w * h * 0.004) continue;
      /* a cartoon gets a touch more colour */
      let [r, gg, b] = c; if (style === 'cartoon') { const m = (r + gg + b) / 3; r = clamp(m + (r - m) * 1.25, 0, 255); gg = clamp(m + (gg - m) * 1.25, 0, 255); b = clamp(m + (b - m) * 1.25, 0, 255); }
      const col = '#' + [r, gg, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      res.fills.push({ col, segs: skHatch(Q.lab, w, h, k, style === 'cartoon' ? 3 : 4, style === 'cartoon' ? 0.5 : -0.5 + k * 0.2) });
    }
  }
  return res;
}
/* the drawing as strokes on the page, in a box at x0,y0 of width dw */
function skStrokes(res, x0, y0, dw, style) {
  const k = dw / res.w, P = (p) => [Math.round((x0 + p[0] * k) * 10), Math.round((y0 + p[1] * k) * 10)];
  const lw = style === 'real' ? clamp(1.1 * k, 1.2, 2.4) : clamp(1.6 * k, 1.8, 3.4), lines = [], hatch = [], fills = [], g = 'g' + uid();
  let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const L of res.lines) { const p = [], wL = style === 'cartoon' && L.length > 60 ? lw * 1.25 : lw; L.forEach((q, i) => { const [x, y] = P(q), t = L.length > 1 ? i / (L.length - 1) : 0; p.push(x, y, Math.round(42 + 22 * Math.sin(Math.PI * t) + 6 * rnd())); }); lines.push({ id: 's' + uid(), k: 'p', c: style === 'real' ? '#2A2E36' : '#1F2533', w: wL, p, g }); }
  for (const s of res.hatch) { const a = P(s[0]), b = P(s[1]); hatch.push({ id: 's' + uid(), k: 'p', c: '#7A8191', w: Math.max(0.7, lw * 0.45), p: [a[0], a[1], 30, b[0], b[1], 30], g }); }
  for (const f of res.fills) {
    /* cartoon: felt pen, solid; realistic: marker, see-through so it layers like real colouring */
    const fw = style === 'cartoon' ? Math.max(2, 3 * k * 1.35) : Math.max(3, 4 * k * 1.6);
    /* the zigzag of each area is one continuous stroke per few rows, the way a hand colours without lifting */
    let cur = null, n = 0;
    for (const s of f.segs) { const a = P(s[0]), b = P(s[1]); if (!cur || n >= 6 || Math.hypot(a[0] - cur.p[cur.p.length - 3], a[1] - cur.p[cur.p.length - 2]) > fw * 30) { cur = { id: 's' + uid(), k: style === 'cartoon' ? 'p' : 'h', c: f.col, w: fw, p: [], g }; fills.push(cur); n = 0; } cur.p.push(a[0], a[1], 50, b[0], b[1], 50); n++; }
  }
  return { lines, hatch, fills };
}
/* drawn by hand on the page: the pen traces each line with a hand's rhythm, then the shading, then the colouring under it.
   Long drawings are sped up to finish in about half a minute */
function skAnimate(parts, pid, done) {
  const lines = parts.lines.concat(parts.hatch), fills = parts.fills, all = fills.concat(lines);
  const commit = () => {
    if (!all.length) return; const before = { [DEV]: clone(S.mine) };
    /* colour goes under the lines on the page */
    for (const st of all) S.mine.push(st); pushUndo({ t: 'layers', before, after: { [DEV]: clone(S.mine) } }); saveMine(); drawInk(); if (done) done();
  };
  if (diaryInstant() || S.pid !== pid) { commit(); return; }
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; for (const s of all) for (let i = 0; i < s.p.length; i += 3) { bx0 = Math.min(bx0, s.p[i] / 10); by0 = Math.min(by0, s.p[i + 1] / 10); bx1 = Math.max(bx1, s.p[i] / 10); by1 = Math.max(by1, s.p[i + 1] / 10); }
  const pad = 12; bx0 -= pad; by0 -= pad; bx1 += pad; by1 += pad;
  const kk = Math.min(2.5, (window.devicePixelRatio || 1) * Math.max(1, (S.base || 1) * (S.zoom || 1)));
  const mk = (z) => { const cv = document.createElement('canvas'); cv.className = 'dqdraw no-ink'; cv.style.cssText = 'position:absolute;left:' + bx0 + 'px;top:' + by0 + 'px;width:' + (bx1 - bx0) + 'px;height:' + (by1 - by0) + 'px;pointer-events:none;z-index:' + z; cv.width = Math.max(1, Math.round((bx1 - bx0) * kk)); cv.height = Math.max(1, Math.round((by1 - by0) * kk)); const c = cv.getContext('2d'); c.setTransform(kk, 0, 0, kk, -bx0 * kk, -by0 * kk); return { cv, c }; };
  const F = mk(1), L = mk(2), T = mk(3), layers = [F, L, T]; for (const q of layers) itemsEl.appendChild(q.cv);
  const len = (s) => { let t = 0; for (let i = 3; i < s.p.length; i += 3) t += Math.hypot(s.p[i] - s.p[i - 3], s.p[i + 1] - s.p[i - 2]) / 10; return t; };
  const seq = lines.map((s) => ({ s, layer: L, len: len(s), fill: false })).concat(fills.map((s) => ({ s, layer: F, len: len(s), fill: true })));
  const natural = seq.reduce((a, q) => a + clamp(120 + Math.sqrt(q.len) * 40, 140, 1400) + 90, 0), budget = 9000 + Math.min(26000, seq.length * 45);
  const speed = Math.max(1, natural / budget);
  const ease = (t) => t * t * t * (10 - 15 * t + 6 * t * t);
  const part = (s, d) => { const p = s.p, out = [p[0], p[1], p[2]]; let acc = 0; for (let i = 3; i < p.length; i += 3) { const L0 = Math.hypot(p[i] - p[i - 3], p[i + 1] - p[i - 2]) / 10; if (acc + L0 >= d) { const a = (d - acc) / Math.max(1e-6, L0); out.push(Math.round(p[i - 3] + (p[i] - p[i - 3]) * a), Math.round(p[i - 2] + (p[i + 1] - p[i - 2]) * a), p[i + 2]); return out; } acc += L0; out.push(p[i], p[i + 1], p[i + 2]); } return out; };
  let i = 0, t0 = 0, cancelled = false;
  const nib = (x, y, col) => { const c = T.c; c.globalAlpha = 0.85; c.fillStyle = col; c.beginPath(); c.arc(x, y, 2.4, 0, 6.2832); c.fill(); c.globalAlpha = 0.16; c.beginPath(); c.arc(x, y, 6, 0, 6.2832); c.fill(); c.globalAlpha = 1; };
  const finish = () => { for (const q of layers) q.cv.remove(); commit(); };
  const frame = (ts) => {
    if (cancelled) return;
    if (S.pid !== pid) { for (const q of layers) q.cv.remove(); commit(); return; }
    for (const q of layers) if (!q.cv.isConnected) itemsEl.appendChild(q.cv);
    /* several short strokes may finish within one frame when the drawing is long */
    let guard = 0;
    while (i < seq.length && guard++ < 40) {
      const q = seq[i]; if (!t0) t0 = ts;
      const T0 = clamp(120 + Math.sqrt(q.len) * 40, 140, 1400) / speed, u = Math.min(1, (ts - t0) / T0);
      if (u < 1) { const pp = part(q.s, q.len * ease(u)), n = pp.length; T.c.clearRect(bx0, by0, bx1 - bx0, by1 - by0); drawStroke(T.c, Object.assign({}, q.s, { p: pp })); nib(pp[n - 3] / 10, pp[n - 2] / 10, q.s.c); break; }
      drawStroke(q.layer.c, q.s); i++; t0 = ts + 70 / speed;
    }
    if (i >= seq.length) { T.c.clearRect(bx0, by0, bx1 - bx0, by1 - by0); setTimeout(finish, 150); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => { cancelled = true; finish(); };
}
/* the sheet: where the picture comes from, which style, colour or not */
async function skLoadUrl(u) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = u; }); }
async function skLoadBlob(b) { const u = URL.createObjectURL(b); try { return await skLoadUrl(u); } finally { setTimeout(() => URL.revokeObjectURL(u), 3000); } }
function openSketch(fromItem) {
  closeSheets();
  let sh = $('#sketchSheet');
  if (!sh) {
    sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'sketchSheet';
    sh.innerHTML = '<div class="panel wide" role="dialog" aria-label="วาดจากภาพอ้างอิง"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2>วาดจากภาพอ้างอิง</h2><button class="btn" type="button" data-a="close">ปิด</button></div>'
      + '<div class="note small">เลือกภาพต้นแบบ แล้วสมุดจะวาดตามทีละเส้นด้วยลายมือ ลงสีให้ด้วยถ้าต้องการ ทุกเส้นเป็นหมึกปกติ ลบหรือย้ายได้ ภาพจากการค้นหามาจาก Wikimedia Commons ซึ่งใช้ซ้ำได้ตามสัญญาอนุญาตที่ระบุ</div>'
      + '<div class="exsetup"><div class="exrow"><span class="label">ภาพต้นแบบ</span><span class="chips"><button class="chip" type="button" data-a="file">เลือกรูปจากเครื่อง</button><button class="chip" type="button" data-a="page" hidden>ใช้รูปที่เลือกบนหน้า</button></span></div>'
      + '<div class="exrow"><span class="label">ค้นหาภาพ</span><div><span class="mrow"><input data-a="q" placeholder="เช่น ไอน์สไตน์ แมว ดอกกุหลาบ" maxlength="80"><button class="btn" type="button" data-a="search">ค้นหา</button></span><div class="skres"></div></div></div>'
      + '<div class="exrow"><span class="label">แบบ</span><span class="chips" data-a="style"><button class="chip" type="button" data-v="cartoon">การ์ตูน เส้นสะอาด</button><button class="chip" type="button" data-v="real">เหมือนจริง แรเงาดินสอ</button></span></div>'
      + '<div class="exrow"><span class="label">สี</span><span class="chips" data-a="color"><button class="chip" type="button" data-v="1">ลงสีด้วย</button><button class="chip" type="button" data-v="0">ลายเส้นอย่างเดียว</button></span></div></div>'
      + '<div class="skprev"></div><div class="row2 exgo"><button class="btn solid" type="button" data-a="go" disabled>เลือกภาพต้นแบบก่อน</button></div><input type="file" accept="image/*" hidden data-a="fi"></div>';
    document.body.appendChild(sh);
    const q = (a) => sh.querySelector('[data-a="' + a + '"]');
    q('close').onclick = () => { sh.hidden = true; };
    q('file').onclick = () => q('fi').click();
    q('fi').onchange = async () => { const f = q('fi').files[0]; q('fi').value = ''; if (!f) return; try { SK.src = await skLoadBlob(f); SK.name = f.name; SK.credit = ''; skPaint(); } catch (e) { toast('เปิดรูปนี้ไม่ได้', 2500); } };
    const search = async () => {
      const t = q('q').value.trim(); if (!t) return; const box = sh.querySelector('.skres'); waitLine(box, 'กำลังค้นใน Wikimedia Commons');
      let res = []; try { res = await commonsSearch(t, 'bitmap', 12); } catch (e) { res = []; }
      if (!res.length && /[฀-๿]/.test(t) && AI.anyReady()) { try { const r = await AI.run('gen', 'Translate this picture search to short English keywords only: ' + t, { noCtx: true, subj: true, maxTokens: 60 }); const en = String(r.text || '').trim().split('\n')[0].slice(0, 60); if (en) res = await commonsSearch(en, 'bitmap', 12); } catch (e) { /* keep empty */ } }
      box.innerHTML = res.length ? '' : '<div class="note small">ไม่พบภาพ ลองคำค้นภาษาอังกฤษ หรือเลือกรูปจากเครื่อง</div>';
      const grid = document.createElement('div'); grid.className = 'skgrid'; box.appendChild(grid);
      for (const m of res) { const b = document.createElement('button'); b.type = 'button'; b.className = 'skpick'; b.innerHTML = '<img alt="" loading="lazy">'; b.querySelector('img').src = m.thumb; b.title = m.name;
        b.onclick = async () => { grid.querySelectorAll('.skpick').forEach((x) => x.classList.toggle('on', x === b)); try { SK.src = await skLoadUrl(m.thumb); SK.name = m.name; SK.credit = m.credit || ''; skPaint(); } catch (e) { toast('โหลดภาพนี้ไม่ได้ ลองภาพอื่น', 2500); } };
        grid.appendChild(b); }
    };
    q('search').onclick = search; q('q').onkeydown = (e) => { if (e.key === 'Enter') search(); };
    sh.querySelectorAll('[data-a="style"] .chip').forEach((b) => { b.onclick = () => { SK.style = b.dataset.v; skPaint(); }; });
    sh.querySelectorAll('[data-a="color"] .chip').forEach((b) => { b.onclick = () => { SK.color = b.dataset.v === '1'; skPaint(); }; });
    q('go').onclick = skGo;
  }
  const pageBtn = sh.querySelector('[data-a="page"]'), one = fromItem || (S.sel && S.sel.items.length === 1 ? findItem(S.sel.items[0]) : null);
  pageBtn.hidden = !(one && one.type === 'img');
  pageBtn.onclick = async () => { const im = await cutLoad(one); if (!im) { toast('เปิดรูปนี้ไม่ได้', 2500); return; } SK.src = im; SK.name = 'รูปบนหน้า'; SK.credit = one.credit || ''; SK.from = itemBox(one); skPaint(); };
  if (one && one.type === 'img') pageBtn.onclick();
  sh.hidden = false; skPaint();
}
function skPaint() {
  const sh = $('#sketchSheet'); if (!sh) return;
  sh.querySelectorAll('[data-a="style"] .chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === SK.style ? 'true' : 'false'));
  sh.querySelectorAll('[data-a="color"] .chip').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === SK.color ? 'true' : 'false'));
  const pv = sh.querySelector('.skprev'), go = sh.querySelector('[data-a="go"]');
  if (!SK.src) { pv.innerHTML = ''; go.disabled = true; go.textContent = 'เลือกภาพต้นแบบก่อน'; return; }
  go.disabled = true; go.textContent = 'วาดลงหน้า'; waitLine(pv, 'กำลังหาเส้นและสีจากภาพ');
  /* a quick look at the result before drawing it (worked out just after the waiting line shows) */
  setTimeout(() => {
  try {
    const res = skMake(SK.src, SK.style, SK.color), k = Math.min(1, 300 / res.w), cv = document.createElement('canvas'); cv.width = Math.round(res.w * k * 2); cv.height = Math.round(res.h * k * 2); cv.style.width = Math.round(res.w * k) + 'px';
    const c = cv.getContext('2d'); c.scale(2, 2); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, res.w * k, res.h * k); const st = skStrokes(res, 0, 0, res.w * k, SK.style);
    for (const s of st.fills) drawStroke(c, s); for (const s of st.hatch.concat(st.lines)) drawStroke(c, s);
    pv.innerHTML = '<div class="skpair"></div>'; const pair = pv.firstChild; const o = SK.src.cloneNode(); o.style.width = Math.round(res.w * k) + 'px'; pair.append(o, cv);
    SK.res = res;
    go.disabled = false;
  } catch (e) { pv.innerHTML = '<div class="note err small">ภาพนี้อ่านไม่ได้ (เว็บต้นทางอาจไม่อนุญาต) ลองภาพอื่นหรือเลือกรูปจากเครื่อง</div>'; SK.res = null; go.disabled = true; }
  }, 40);
}
function skGo() {
  const sh = $('#sketchSheet'); if (!SK.res || !S.page) return; sh.hidden = true;
  const res = SK.res, dw = Math.round(clamp(res.w >= res.h ? 520 : 420, 240, W - 2 * PAGE_M)), dh = Math.round(dw * res.h / res.w);
  const at = (SK.from && placeNear(SK.from, dw, dh, { side: true })) || viewSpot(dw, dh);
  const parts = skStrokes(res, at[0], at[1], dw, SK.style), pid = S.pid;
  const FL = floatLine('สมุดกำลังวาดตามภาพต้นแบบ');
  skAnimate(parts, pid, () => { FL(); if (SK.credit) addItem({ type: 'text', x: at[0], y: Math.min(H - 40, at[1] + dh + 8), w: dw, md: 'ภาพต้นแบบ: ' + SK.credit, fs: 12 }); toast('วาดเสร็จแล้ว ทุกเส้นลบหรือย้ายได้', 2500); });
  SK.from = null;
}

