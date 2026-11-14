/* BURIN part: video (loaded when first used) */
/* ---------- video analysis: a clip from the camera or the library, a known length in the picture for the scale, an origin,
   then the object is marked frame by frame (by tapping, or followed automatically). The result is a table of t, x, y and
   the velocities, and graphs that go onto the page as experiment cards (slope with its uncertainty) ---------- */
const VA = { url: '', fps: 30, slow: 1, every: 1, mode: 'scale', sc: [], len: 1, org: null, pts: new Map(), k: 0, n: 0, busy: false, stop: false };
const VA_FPS = [24, 25, 30, 60, 120, 240];
function vaEl(sel) { return $('#vidSheet').querySelector(sel); }
function openVideoLab(blob) {
  closeSheets(); let sh = $('#vidSheet');
  if (!sh) {
    sh = document.createElement('div'); sh.id = 'vidSheet'; sh.className = 'sheet vidsheet';
    sh.innerHTML = '<div class="panel wide" role="dialog" aria-label="วิเคราะห์วิดีโอ"><div class="mvhead"><h2>วิเคราะห์วิดีโอ</h2><button type="button" class="btn" data-a="x">ปิด</button></div>'
      + '<div class="vapick"><div class="note small">ตั้งกล้องให้นิ่งและตั้งฉากกับแนวการเคลื่อนที่ วางไม้บรรทัดหรือวัตถุที่รู้ความยาวไว้ในภาพ แสงสว่างพอและวัตถุมีสีต่างจากพื้นหลัง จะติดตามอัตโนมัติได้แม่น</div>'
      + '<div class="row2"><button type="button" class="btn solid" data-a="cam">ถ่ายวิดีโอ</button><button type="button" class="btn" data-a="lib">เลือกวิดีโอจากเครื่อง</button></div>'
      + '<input type="file" accept="video/*" capture="environment" hidden data-a="fcam"><input type="file" accept="video/*" hidden data-a="flib"></div>'
      + '<div class="vawork" hidden><div class="vastage"><video playsinline muted preload="auto"></video><canvas class="vaov"></canvas></div>'
      + '<div class="vactl"><button type="button" class="btn" data-a="prev" aria-label="ย้อนหนึ่งเฟรม">ย้อน</button><input type="range" min="0" value="0" step="1" data-a="seek" aria-label="เลือกเฟรม"><button type="button" class="btn" data-a="next" aria-label="ไปหนึ่งเฟรม">ถัดไป</button><span class="vatime"></span></div>'
      + '<div class="chips vasteps"><button type="button" class="chip" data-m="scale">1 ตั้งมาตราส่วน</button><button type="button" class="chip" data-m="org">2 ตั้งจุดกำเนิด</button><button type="button" class="chip" data-m="track">3 แตะตำแหน่งวัตถุ</button></div>'
      + '<div class="vahint note small"></div>'
      + '<div class="vaset"><label class="field"><span>ความยาวที่รู้ (เมตร)</span><input data-a="len" inputmode="decimal" value="1"></label>'
      + '<label class="field"><span>เฟรมต่อวินาทีของไฟล์</span><select data-a="fps"></select></label>'
      + '<label class="field"><span>วิดีโอช้า (slow motion)</span><select data-a="slow"><option value="1">ความเร็วปกติ</option><option value="4">ช้าลง 4 เท่า (120 fps)</option><option value="8">ช้าลง 8 เท่า (240 fps)</option></select></label>'
      + '<label class="field"><span>เก็บทุกกี่เฟรม</span><select data-a="every"><option>1</option><option>2</option><option>3</option><option>5</option><option>10</option></select></label></div>'
      + '<div class="row2"><button type="button" class="btn" data-a="auto">ติดตามอัตโนมัติจากจุดนี้</button><button type="button" class="btn" data-a="undo">ลบจุดล่าสุด</button><button type="button" class="btn" data-a="clear">ล้างจุดทั้งหมด</button><button type="button" class="btn" data-a="other">เปลี่ยนวิดีโอ</button></div>'
      + '<div class="vares"></div></div></div>';
    document.body.appendChild(sh);
    const q = (a) => sh.querySelector('[data-a="' + a + '"]');
    q('x').onclick = vaClose;
    q('cam').onclick = () => q('fcam').click(); q('lib').onclick = () => q('flib').click();
    for (const k of ['fcam', 'flib']) q(k).onchange = () => { const f = q(k).files[0]; q(k).value = ''; if (f) vaLoad(f); };
    const fs = q('fps'); for (const f of VA_FPS) { const o = document.createElement('option'); o.value = f; o.textContent = f + ' fps'; fs.appendChild(o); }
    fs.onchange = () => { const t = vaTime(VA.k); VA.fps = +fs.value; vaFrames(); VA.pts = new Map(); vaGo(Math.round(t * VA.fps)); vaRes(); };
    q('slow').onchange = () => { VA.slow = +q('slow').value; vaPaint(); vaRes(); };
    q('every').onchange = () => { VA.every = +q('every').value; };
    q('len').oninput = () => { const v = parseFloat(q('len').value.replace(',', '.')); if (v > 0) { VA.len = v; vaPaint(); vaRes(); } };
    q('prev').onclick = () => vaGo(VA.k - 1); q('next').onclick = () => vaGo(VA.k + 1);
    q('seek').oninput = () => vaGo(+q('seek').value);
    sh.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => vaMode(b.dataset.m); });
    q('undo').onclick = () => { const ks = [...VA.pts.keys()].sort((a, b) => a - b); if (!ks.length) return; VA.pts.delete(VA.last != null && VA.pts.has(VA.last) ? VA.last : ks[ks.length - 1]); VA.last = null; vaPaint(); vaRes(); };
    q('clear').onclick = () => { VA.pts = new Map(); vaPaint(); vaRes(); };
    q('other').onclick = () => { vaFree(); sh.querySelector('.vapick').hidden = false; sh.querySelector('.vawork').hidden = true; };
    q('auto').onclick = () => (VA.busy ? (VA.stop = true) : vaAuto());
    const ov = sh.querySelector('.vaov');
    ov.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); vaTap(e); });
    window.addEventListener('resize', () => { if (!sh.hidden && VA.url) vaFit(); });
  }
  sh.hidden = false;
  if (blob) vaLoad(blob); else if (!VA.url) { sh.querySelector('.vapick').hidden = false; sh.querySelector('.vawork').hidden = true; }
}
function vaClose() { const sh = $('#vidSheet'); if (sh) sh.hidden = true; VA.stop = true; vaFree(); if (sh) { sh.querySelector('.vapick').hidden = false; sh.querySelector('.vawork').hidden = true; } }
/* the clip and the work canvas give their memory back when the sheet closes (iPad) */
function vaFree() { const v = $('#vidSheet') && vaEl('video'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); } if (VA.url) URL.revokeObjectURL(VA.url); VA.url = ''; if (VA.cv) { VA.cv.width = VA.cv.height = 1; VA.cv = null; } VA.pts = new Map(); VA.sc = []; VA.org = null; }
function vaLoad(blob) {
  vaFree(); const sh = $('#vidSheet'), v = vaEl('video');
  VA.url = URL.createObjectURL(blob); VA.k = 0; VA.fps = VA.fps || 30;
  sh.querySelector('.vapick').hidden = true; sh.querySelector('.vawork').hidden = false;
  vaEl('.vahint').textContent = 'กำลังเปิดวิดีโอ';
  v.onloadedmetadata = () => { vaGuessFps(v).then((f) => { VA.fps = f; vaEl('[data-a="fps"]').value = String(f); vaFrames(); vaFit(); vaGo(0); vaMode('scale'); vaRes(); }); };
  v.onerror = () => { toast('เปิดวิดีโอนี้ไม่ได้ ลองไฟล์ MP4 หรือ MOV', 3000); };
  v.src = VA.url;
}
/* the frame rate from the frames the browser actually shows while playing a moment; 30 when it cannot tell */
function vaGuessFps(v) {
  return new Promise((res) => {
    if (!v.requestVideoFrameCallback) { res(30); return; }
    const ts = []; let done = false;
    const fin = () => { if (done) return; done = true; v.pause(); v.currentTime = 0; const d = []; for (let i = 1; i < ts.length; i++) { const x = ts[i] - ts[i - 1]; if (x > 0) d.push(x); } d.sort((a, b) => a - b); const md = d.length ? d[Math.floor(d.length / 2)] : 0; const f = md ? 1 / md : 30; res(VA_FPS.reduce((b, x) => (Math.abs(x - f) < Math.abs(b - f) ? x : b), 30)); };
    const cb = (now, meta) => { ts.push(meta.mediaTime); if (ts.length > 12) fin(); else v.requestVideoFrameCallback(cb); };
    v.requestVideoFrameCallback(cb); v.muted = true; v.play().catch(fin); setTimeout(fin, 1500);
  });
}
function vaFrames() { const v = vaEl('video'); VA.n = Math.max(1, Math.floor((v.duration || 0) * VA.fps)); const s = vaEl('[data-a="seek"]'); s.max = String(VA.n - 1); }
const vaTime = (k) => (k / VA.fps) / VA.slow;
function vaFit() {
  const v = vaEl('video'), ov = vaEl('.vaov'), st = vaEl('.vastage'); if (!v.videoWidth) return;
  const maxW = st.clientWidth || 600, maxH = Math.max(220, window.innerHeight * 0.52), k = Math.min(maxW / v.videoWidth, maxH / v.videoHeight);
  const w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k), dpr = Math.min(2, window.devicePixelRatio || 1);
  v.style.width = w + 'px'; v.style.height = h + 'px'; ov.style.width = w + 'px'; ov.style.height = h + 'px'; ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr);
  VA.k2 = k; vaPaint();
}
function vaGo(k) {
  const v = vaEl('video'); k = clamp(Math.round(k), 0, VA.n - 1); VA.k = k;
  vaEl('[data-a="seek"]').value = String(k);
  return new Promise((res) => { const t = (k + 0.5) / VA.fps; if (Math.abs(v.currentTime - t) < 1e-4) { vaPaint(); res(); return; } const on = () => { v.removeEventListener('seeked', on); vaPaint(); res(); }; v.addEventListener('seeked', on); v.currentTime = Math.min(t, Math.max(0, (v.duration || t) - 1e-3)); setTimeout(on, 1500); });
}
function vaMode(m) {
  VA.mode = m; $('#vidSheet').querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === m ? 'true' : 'false'));
  vaEl('.vahint').textContent = m === 'scale' ? 'แตะปลายทั้งสองข้างของสิ่งที่รู้ความยาว เช่น ไม้บรรทัด แล้วใส่ความยาวจริงเป็นเมตรด้านล่าง'
    : m === 'org' ? 'แตะจุดที่จะให้เป็นจุดกำเนิด (0, 0) แกน x ไปทางขวา แกน y ขึ้นด้านบน'
      : 'แตะที่จุดกึ่งกลางของวัตถุ แล้วภาพจะเลื่อนไปเฟรมถัดไปเอง ทำซ้ำจนจบการเคลื่อนที่ หรือแตะหนึ่งจุดแล้วกด ติดตามอัตโนมัติ';
  vaPaint();
}
function vaTap(e) {
  const ov = vaEl('.vaov'), r = ov.getBoundingClientRect(), v = vaEl('video'); if (!v.videoWidth || VA.busy) return;
  const p = [(e.clientX - r.left) / r.width * v.videoWidth, (e.clientY - r.top) / r.height * v.videoHeight];
  if (VA.mode === 'scale') { VA.sc = VA.sc.length >= 2 ? [p] : VA.sc.concat([p]); if (VA.sc.length === 2 && !VA.org) setTimeout(() => vaMode('org'), 350); }
  else if (VA.mode === 'org') { VA.org = p; setTimeout(() => vaMode('track'), 350); }
  else { VA.pts.set(VA.k, p); VA.last = VA.k; vaRes(); if (VA.k + VA.every < VA.n) { vaPaint(); setTimeout(() => vaGo(VA.k + VA.every), 120); return; } }
  vaPaint(); vaRes();
}
/* metres per pixel of the video, from the two taps and the length typed */
function vaMpp() { if (VA.sc.length < 2) return null; const d = Math.hypot(VA.sc[1][0] - VA.sc[0][0], VA.sc[1][1] - VA.sc[0][1]); return d > 2 ? VA.len / d : null; }
function vaData() {
  const mpp = vaMpp(), v = vaEl('video'), o = VA.org || [0, v.videoHeight];
  const ks = [...VA.pts.keys()].sort((a, b) => a - b);
  const rows = ks.map((k) => { const p = VA.pts.get(k); return { k, t: vaTime(k), x: (p[0] - o[0]) * (mpp || 1), y: (o[1] - p[1]) * (mpp || 1) }; });
  if (rows.length) { const t0 = rows[0].t; for (const r of rows) r.t -= t0; }
  /* velocity from the neighbours on both sides; at the two ends a three-point one-sided difference, which is exact for steady acceleration */
  const n = rows.length;
  for (let i = 0; i < n; i++) for (const q of ['x', 'y']) {
    let v = NaN;
    if (i > 0 && i < n - 1) { const dt = rows[i + 1].t - rows[i - 1].t; if (dt > 0) v = (rows[i + 1][q] - rows[i - 1][q]) / dt; }
    else if (n >= 3 && i === 0) { const dt = rows[2].t - rows[0].t; if (dt > 0) v = (-3 * rows[0][q] + 4 * rows[1][q] - rows[2][q]) / dt; }
    else if (n >= 3) { const dt = rows[n - 1].t - rows[n - 3].t; if (dt > 0) v = (3 * rows[n - 1][q] - 4 * rows[n - 2][q] + rows[n - 3][q]) / dt; }
    else if (n === 2) { const dt = rows[1].t - rows[0].t; if (dt > 0) v = (rows[1][q] - rows[0][q]) / dt; }
    rows[i]['v' + q] = v;
  }
  return { rows, unit: mpp ? 'm' : 'px', ok: !!mpp };
}
function vaPaint() {
  const ov = $('#vidSheet') && vaEl('.vaov'), v = ov && vaEl('video'); if (!ov || !v.videoWidth) return;
  const c = ov.getContext('2d'), k = ov.width / v.videoWidth; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, ov.width, ov.height);
  const P = (p) => [p[0] * k, p[1] * k], lw = Math.max(1.5, ov.width / 500);
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (VA.sc.length) { c.strokeStyle = '#E39B2D'; c.fillStyle = '#E39B2D'; c.lineWidth = lw * 1.6; const a = P(VA.sc[0]); c.beginPath(); c.arc(a[0], a[1], lw * 3, 0, 7); c.fill(); if (VA.sc[1]) { const b = P(VA.sc[1]); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.beginPath(); c.arc(b[0], b[1], lw * 3, 0, 7); c.fill(); c.font = Math.round(lw * 9) + 'px Sarabun, sans-serif'; c.fillText(VA.len + ' m', (a[0] + b[0]) / 2 + lw * 4, (a[1] + b[1]) / 2 - lw * 4); } }
  if (VA.org) { const o = P(VA.org), L = Math.min(ov.width, ov.height) * 0.14; c.strokeStyle = '#2E8B57'; c.lineWidth = lw * 1.4; c.beginPath(); c.moveTo(o[0], o[1]); c.lineTo(o[0] + L, o[1]); c.moveTo(o[0], o[1]); c.lineTo(o[0], o[1] - L); c.stroke(); c.fillStyle = '#2E8B57'; c.font = Math.round(lw * 9) + 'px Sarabun, sans-serif'; c.fillText('x', o[0] + L + lw * 2, o[1] + lw * 3); c.fillText('y', o[0] - lw * 3, o[1] - L - lw * 3); }
  const ks = [...VA.pts.keys()].sort((a, b) => a - b);
  c.strokeStyle = 'rgba(47,75,184,0.55)'; c.lineWidth = lw; c.beginPath(); ks.forEach((kk, i) => { const p = P(VA.pts.get(kk)); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke();
  for (const kk of ks) { const p = P(VA.pts.get(kk)), cur = kk === VA.k; c.fillStyle = cur ? '#C2571A' : '#2F4BB8'; c.beginPath(); c.arc(p[0], p[1], lw * (cur ? 3.6 : 2.4), 0, 7); c.fill(); }
  const tm = vaEl('.vatime'); if (tm) tm.textContent = 'เฟรม ' + VA.k + '  t = ' + vaTime(VA.k).toFixed(3) + ' s  จุด ' + VA.pts.size;
}
/* ----- following the object by itself: the patch around the last mark is looked for near where it should be next ----- */
async function vaAuto() {
  const v = vaEl('video'); if (!VA.pts.has(VA.k)) { toast('แตะที่วัตถุในเฟรมนี้ก่อน แล้วค่อยกดติดตามอัตโนมัติ', 2600); return; }
  const btn = vaEl('[data-a="auto"]'); VA.busy = true; VA.stop = false; btn.textContent = 'หยุดติดตาม';
  const sc = Math.min(1, 480 / v.videoWidth), w = Math.round(v.videoWidth * sc), h = Math.round(v.videoHeight * sc);
  const cv = VA.cv || (VA.cv = document.createElement('canvas')); cv.width = w; cv.height = h; const c = cv.getContext('2d', { willReadFrequently: true });
  const gray = () => { c.drawImage(v, 0, 0, w, h); const d = c.getImageData(0, 0, w, h).data, g = new Float32Array(w * h); for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11; return g; };
  const R = 9, win = Math.round(clamp(28 * (VA.every || 1), 20, 70));
  let g = gray(), p = VA.pts.get(VA.k).map((x) => x * sc), vel = [0, 0], lost = 0;
  const patch = (G, x, y) => { const out = new Float32Array((2 * R + 1) ** 2); let i = 0, m = 0; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const xx = clamp(Math.round(x) + dx, 0, w - 1), yy = clamp(Math.round(y) + dy, 0, h - 1); out[i] = G[yy * w + xx]; m += out[i++]; } m /= out.length; for (let j = 0; j < out.length; j++) out[j] -= m; return out; };
  let T = patch(g, p[0], p[1]);
  let added = 0;
  while (!VA.stop && VA.k + VA.every < VA.n) {
    await vaGo(VA.k + VA.every); g = gray();
    const pred = [p[0] + vel[0], p[1] + vel[1]]; let best = Infinity, bp = pred;
    for (let dy = -win; dy <= win; dy += 2) for (let dx = -win; dx <= win; dx += 2) { const x = pred[0] + dx, y = pred[1] + dy; if (x < R || y < R || x > w - R - 1 || y > h - R - 1) continue; const P2 = patch(g, x, y); let s = 0; for (let i = 0; i < P2.length; i++) s += Math.abs(P2[i] - T[i]); if (s < best) { best = s; bp = [x, y]; } }
    { const c0 = bp; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = c0[0] + dx, y = c0[1] + dy; const P2 = patch(g, x, y); let s = 0; for (let i = 0; i < P2.length; i++) s += Math.abs(P2[i] - T[i]); if (s < best) { best = s; bp = [x, y]; } } }
    { /* a fraction of a pixel from the shape of the match around the best place */
      const sad = (x, y) => { const P2 = patch(g, x, y); let t = 0; for (let i = 0; i < P2.length; i++) t += Math.abs(P2[i] - T[i]); return t; };
      const sub = (m, c0, p0) => { const d = m - 2 * c0 + p0; return d > 1e-9 ? clamp(0.5 * (m - p0) / d, -0.5, 0.5) : 0; };
      const fx = sub(sad(bp[0] - 1, bp[1]), best, sad(bp[0] + 1, bp[1])), fy = sub(sad(bp[0], bp[1] - 1), best, sad(bp[0], bp[1] + 1)); bp = [bp[0] + fx, bp[1] + fy]; }
    const score = best / T.length;
    if (!isFinite(score) || score > 26) { lost++; if (lost >= 2) { toast('ติดตามต่อไม่ได้ วัตถุอาจถูกบังหรือออกนอกภาพ แตะตำแหน่งในเฟรมนี้เองแล้วกดติดตามอีกครั้ง', 4000); break; } continue; }
    lost = 0; vel = [bp[0] - p[0], bp[1] - p[1]]; p = bp; T = patch(g, p[0], p[1]);
    VA.pts.set(VA.k, [p[0] / sc, p[1] / sc]); added++; vaPaint(); if (added % 5 === 0) vaRes();
  }
  VA.busy = false; VA.stop = false; btn.textContent = 'ติดตามอัตโนมัติจากจุดนี้'; vaRes();
}
/* ----- results: a table and small graphs, and cards for the page ----- */
function vaRes() {
  const box = $('#vidSheet') && vaEl('.vares'); if (!box) return;
  const D = vaData();
  if (D.rows.length < 2) { box.innerHTML = '<div class="note small">ยังไม่มีข้อมูลพอ แตะตำแหน่งวัตถุอย่างน้อย 3 เฟรม' + (D.ok ? '' : ' และตั้งมาตราส่วนก่อน ไม่อย่างนั้นค่าจะเป็นพิกเซล') + '</div>'; return; }
  const u = D.unit, f = (x) => (isFinite(x) ? sig3(x) : '');
  let tb = '<table class="vatbl"><thead><tr><th>t (s)</th><th>x (' + u + ')</th><th>y (' + u + ')</th><th>vx (' + u + '/s)</th><th>vy (' + u + '/s)</th></tr></thead><tbody>';
  for (const r of D.rows.slice(0, 400)) tb += '<tr><td>' + f(r.t) + '</td><td>' + f(r.x) + '</td><td>' + f(r.y) + '</td><td>' + f(r.vx) + '</td><td>' + f(r.vy) + '</td></tr>';
  tb += '</tbody></table>';
  const gr = [['x', 'x–t'], ['y', 'y–t'], ['vx', 'vx–t'], ['vy', 'vy–t']].map(([k, n]) => '<figure><figcaption>' + n + '</figcaption>' + vaSvg(D.rows, k) + '</figure>').join('');
  box.innerHTML = (D.ok ? '' : '<div class="note small">ยังไม่ได้ตั้งมาตราส่วน ค่าเป็นพิกเซล</div>') + '<div class="vagr">' + gr + '</div>' + '<div class="vatw">' + tb + '</div>'
    + '<div class="exrow"><span class="label">วางลงหน้า</span><span class="chips" data-a="pick"><button type="button" class="chip" data-v="x" aria-pressed="false">กราฟ x–t</button><button type="button" class="chip" data-v="y" aria-pressed="true">กราฟ y–t</button><button type="button" class="chip" data-v="vx" aria-pressed="false">กราฟ vx–t</button><button type="button" class="chip" data-v="vy" aria-pressed="true">กราฟ vy–t</button><button type="button" class="chip" data-v="tbl" aria-pressed="true">ตารางข้อมูล</button></span></div>'
    + '<div class="row2"><button type="button" class="btn solid" data-a="put">วางลงหน้า</button><button type="button" class="btn" data-a="stats">ส่งไปวิเคราะห์สถิติ</button></div>';
  box.querySelectorAll('[data-a="pick"] .chip').forEach((b) => { b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); });
  box.querySelector('[data-a="put"]').onclick = () => { const want = [...box.querySelectorAll('[data-a="pick"] .chip[aria-pressed="true"]')].map((b) => b.dataset.v); vaPut(D, want); };
  box.querySelector('[data-a="stats"]').onclick = () => { const txt = 't x y vx vy\n' + D.rows.map((r) => [r.t, r.x, r.y, r.vx, r.vy].map((x) => (isFinite(x) ? +x.toPrecision(5) : '')).join(' ')).join('\n'); vaClose(); need('stats').then(() => openStats(txt)); };
}
function vaSvg(rows, key) {
  const pts = rows.filter((r) => isFinite(r[key])); if (pts.length < 2) return '<svg viewBox="0 0 160 100"></svg>';
  const xs = pts.map((r) => r.t), ys = pts.map((r) => r[key]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys, 0), y1 = Math.max(...ys, 0);
  const X = (x) => 14 + (x - x0) / ((x1 - x0) || 1) * 140, Y = (y) => 92 - (y - y0) / ((y1 - y0) || 1) * 84;
  return '<svg viewBox="0 0 160 100" aria-hidden="true"><path d="M14 4V92H156" fill="none" stroke="currentColor" stroke-opacity="0.4"/>' + (y0 < 0 && y1 > 0 ? '<path d="M14 ' + Y(0).toFixed(1) + 'H156" stroke="currentColor" stroke-opacity="0.25" stroke-dasharray="3 3"/>' : '')
    + pts.map((r) => '<circle cx="' + X(r.t).toFixed(1) + '" cy="' + Y(r[key]).toFixed(1) + '" r="2" fill="#2F4BB8"/>').join('') + '</svg>';
}
function vaPut(D, want) {
  if (!S.page) return; const u = D.unit, items = [];
  const card = (key, title, yn, yu, fn, fu) => ({ type: 'lab', tpl: 'blank', title, xn: 't', xu: 's', yn, yu, xt: 'x', yt: 'x', trials: 1, f: 'm', fn, fu,
    plan: { iv: 'เวลา t', dv: yn, cv: 'กล้องนิ่ง มาตราส่วนจากความยาว ' + VA.len + ' m', hyp: '' }, rows: D.rows.filter((r) => isFinite(r[key])).map((r) => [+r.t.toPrecision(4), +r[key].toPrecision(4)]) });
  if (want.includes('x')) items.push(card('x', 'วิดีโอ: ตำแหน่ง x กับเวลา', 'x', u, 'vx', u + '/s'));
  if (want.includes('y')) items.push(card('y', 'วิดีโอ: ตำแหน่ง y กับเวลา', 'y', u, 'vy', u + '/s'));
  if (want.includes('vx')) items.push(card('vx', 'วิดีโอ: ความเร็ว vx กับเวลา', 'vx', u + '/s', 'ax', u + '/s²'));
  if (want.includes('vy')) items.push(card('vy', 'วิดีโอ: ความเร็ว vy กับเวลา', 'vy', u + '/s', 'ay', u + '/s²'));
  const w = 640; let [x, y] = viewSpot(w, 700);
  if (want.includes('tbl')) {
    const f = (v) => (isFinite(v) ? sig3(v) : '');
    const md = '**ข้อมูลจากวิดีโอ** (' + VA.fps + ' fps' + (VA.slow > 1 ? ' ช้าลง ' + VA.slow + ' เท่า' : '') + ')\n\n| t (s) | x (' + u + ') | y (' + u + ') | vx (' + u + '/s) | vy (' + u + '/s) |\n|---|---|---|---|---|\n' + D.rows.slice(0, 60).map((r) => '| ' + [r.t, r.x, r.y, r.vx, r.vy].map(f).join(' | ') + ' |').join('\n');
    addItem({ type: 'text', x, y, w, md, fs: 16 }); y += 40 + Math.min(60, D.rows.length) * 26;
  }
  for (const it of items) { addItem(Object.assign(it, { x, y, w })); y += 760; }
  vaClose(); toast('วางผลจากวิดีโอแล้ว การ์ดการทดลองหาความชันพร้อมความไม่แน่นอนให้เอง', 3200);
}

