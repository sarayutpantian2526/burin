/* BURIN part: measure (loaded when first used) */
/* ---------- the iPad as a measuring instrument: a stopwatch with laps and repeated trials, the microphone (the strongest
   frequency and the loudness), and the motion sensor (acceleration over time, with its period). Every reading can go to
   an experiment card, to statistics, or onto the page as a table. Sensors run only while measuring and stop on close ---------- */
const MZ = { tab: 'sw', sw: { run: false, t0: 0, acc: 0, laps: [], rows: [], raf: 0 }, au: { st: null, ctx: null, an: null, raf: 0, rows: [], f: 0, db: -Infinity }, ac: { on: false, data: [], t0: 0, raf: 0 } };
const mzSig = (x, n) => (isFinite(x) ? (Math.abs(x) < 1e-9 ? '0' : String(+Number(x).toPrecision(n || 4))) : '');
function mzStats(v) { const n = v.length, m = v.reduce((a, b) => a + b, 0) / (n || 1), sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0; return { n, m, sd, se: n > 1 ? sd / Math.sqrt(n) : 0 }; }
function openMeasure(tab) {
  closeSheets(); let sh = $('#measSheet');
  if (!sh) {
    sh = document.createElement('div'); sh.id = 'measSheet'; sh.className = 'sheet meassheet';
    sh.innerHTML = '<div class="panel wide" role="dialog" aria-label="เครื่องมือวัด"><div class="mvhead"><h2>เครื่องมือวัด</h2><button type="button" class="btn" data-a="x">ปิด</button></div>'
      + '<div class="chips mztabs" role="tablist"><button type="button" class="chip" data-t="sw">จับเวลา</button><button type="button" class="chip" data-t="au">เสียง</button><button type="button" class="chip" data-t="ac">ความเร่ง</button></div><div class="mzbody"></div></div>';
    document.body.appendChild(sh);
    sh.querySelector('[data-a="x"]').onclick = mzClose;
    sh.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => mzTab(b.dataset.t); });
  }
  sh.hidden = false; mzTab(tab || MZ.tab);
}
function mzClose() { mzStopAll(); const sh = $('#measSheet'); if (sh) sh.hidden = true; }
function mzStopAll() {
  const A = MZ.au; cancelAnimationFrame(A.raf); A.raf = 0; if (A.st) { A.st.getTracks().forEach((t) => t.stop()); A.st = null; } if (A.ctx) { try { A.ctx.close(); } catch (e) { /* closed */ } A.ctx = null; }
  mzAccStop(); cancelAnimationFrame(MZ.sw.raf); MZ.sw.raf = 0;
}
function mzTab(t) {
  mzStopAll(); MZ.tab = t; const sh = $('#measSheet');
  sh.querySelectorAll('[data-t]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === t ? 'true' : 'false'));
  const box = sh.querySelector('.mzbody'); box.innerHTML = '';
  if (t === 'sw') mzSw(box); else if (t === 'au') mzAu(box); else mzAc(box);
}
/* the results under every tool: the table so far and what to do with it */
function mzOut(box, rows, head, opts) {
  const o = box.querySelector('.mzout') || box.appendChild(Object.assign(document.createElement('div'), { className: 'mzout' }));
  if (!rows.length) { o.innerHTML = '<div class="note small">ยังไม่มีค่าที่จดไว้</div>'; return; }
  let h = '<div class="vatw"><table class="vatbl"><thead><tr><th>ครั้งที่</th>' + head.map((x) => '<th>' + esc(x) + '</th>').join('') + '</tr></thead><tbody>'
    + rows.map((r, i) => '<tr><td>' + (i + 1) + '</td>' + r.map((v) => '<td>' + esc(typeof v === 'number' ? mzSig(v) : String(v == null ? '' : v)) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  const ys = rows.map((r) => r[opts.yi]).filter(isFinite);
  if (ys.length) { const T = mzStats(ys); h += '<div class="dsres"><span><i>ค่าเฉลี่ย ' + esc(head[opts.yi]) + '</i> <b>' + mzSig(T.m) + ' ± ' + mzSig(T.se, 2) + '</b> (n = ' + T.n + ', ส่วนเบี่ยงเบนมาตรฐาน ' + mzSig(T.sd, 3) + ')</span></div>'; }
  h += '<div class="row2"><button type="button" class="btn solid" data-o="lab">ทำเป็นการ์ดการทดลอง</button><button type="button" class="btn" data-o="st">ส่งไปสถิติ</button><button type="button" class="btn" data-o="tb">วางเป็นตาราง</button><button type="button" class="btn" data-o="clr">ล้างค่าที่จด</button></div>';
  o.innerHTML = h;
  const nm = (x) => String(x).replace(/\s*\([^)]*\)\s*$/, ''), un = (x) => ((String(x).match(/\(([^)]*)\)\s*$/) || [])[1] || '');
  o.querySelector('[data-o="lab"]').onclick = () => {
    const xi = opts.xi, ok = rows.filter((r) => isFinite(r[opts.yi]) && (xi == null || isFinite(r[xi]))); if (!ok.length) return;
    const w = 640, at = viewSpot(w, 760), xs = xi == null ? 'ครั้งที่' : head[xi];
    addItem({ type: 'lab', tpl: 'blank', title: opts.title, xn: nm(xs), xu: xi == null ? '' : un(xs), yn: nm(head[opts.yi]), yu: un(head[opts.yi]), xt: 'x', yt: 'x', trials: 1, f: 'm', fn: 'ความชัน', fu: '',
      plan: { iv: nm(xs), dv: nm(head[opts.yi]), cv: '', hyp: '' }, rows: ok.map((r, i) => [xi == null ? i + 1 : r[xi], r[opts.yi]]), x: at[0], y: at[1], w });
    mzClose(); toast('วางการ์ดการทดลองแล้ว', 1800);
  };
  o.querySelector('[data-o="st"]').onclick = () => { const txt = head.map((x) => nm(x).replace(/\s+/g, '_')).join(' ') + '\n' + rows.map((r) => r.map((v) => (isFinite(v) ? v : '')).join(' ')).join('\n'); mzClose(); need('stats').then(() => openStats(txt)); };
  o.querySelector('[data-o="tb"]').onclick = () => { const w = 560, at = viewSpot(w, 300); addItem({ type: 'text', x: at[0], y: at[1], w, md: '**' + opts.title + '**\n\n| ครั้งที่ | ' + head.join(' | ') + ' |\n|---|' + head.map(() => '---').join('|') + '|\n' + rows.map((r, i) => '| ' + (i + 1) + ' | ' + r.map((v) => (typeof v === 'number' ? mzSig(v) : v)).join(' | ') + ' |').join('\n') }); mzClose(); toast('วางตารางแล้ว', 1400); };
  o.querySelector('[data-o="clr"]').onclick = () => { rows.length = 0; mzOut(box, rows, head, opts); };
}
/* ----- stopwatch ----- */
function mzSw(box) {
  const W2 = MZ.sw;
  box.innerHTML = '<div class="mzbig" aria-live="off">0.00 s</div><div class="row2 mzsw"><button type="button" class="btn solid" data-s="go">เริ่ม</button><button type="button" class="btn" data-s="lap">รอบ</button><button type="button" class="btn" data-s="save">จดเวลานี้</button><button type="button" class="btn" data-s="zero">ตั้งศูนย์</button></div>'
    + '<div class="vaset"><label class="field"><span>หารด้วยจำนวนรอบ (เช่น แกว่ง 10 รอบ)</span><input data-s="n" inputmode="numeric" value="1"></label><label class="field"><span>ค่าตัวแปรต้นของครั้งนี้ (ไม่ใส่ก็ได้)</span><input data-s="x" inputmode="decimal" placeholder="เช่น 0.50"></label><label class="field"><span>ชื่อและหน่วยตัวแปรต้น</span><input data-s="xn" value="L (m)"></label></div>'
    + '<div class="mzlaps note small"></div>';
  const big = box.querySelector('.mzbig'), go = box.querySelector('[data-s="go"]'), laps = box.querySelector('.mzlaps');
  const now = () => (W2.run ? W2.acc + (performance.now() - W2.t0) / 1000 : W2.acc);
  const paint = () => { big.textContent = now().toFixed(2) + ' s'; if (W2.run) W2.raf = requestAnimationFrame(paint); };
  const lapsPaint = () => { laps.textContent = W2.laps.length ? 'รอบ: ' + W2.laps.map((t, i) => (i + 1) + ') ' + (t - (W2.laps[i - 1] || 0)).toFixed(2)).join('  ') : ''; };
  go.onclick = () => { if (W2.run) { W2.acc = now(); W2.run = false; go.textContent = 'เริ่มต่อ'; } else { W2.t0 = performance.now(); W2.run = true; go.textContent = 'หยุด'; paint(); } };
  box.querySelector('[data-s="lap"]').onclick = () => { if (!W2.run) return; W2.laps.push(now()); lapsPaint(); };
  box.querySelector('[data-s="zero"]').onclick = () => { W2.run = false; W2.acc = 0; W2.laps = []; go.textContent = 'เริ่ม'; paint(); lapsPaint(); };
  const head = () => [box.querySelector('[data-s="xn"]').value.trim() || 'x', 'เวลา (s)', 'ต่อรอบ (s)'];
  box.querySelector('[data-s="save"]').onclick = () => {
    const t = now(); if (!(t > 0)) return; const n = Math.max(1, parseInt(box.querySelector('[data-s="n"]').value, 10) || 1), xv = parseFloat(String(box.querySelector('[data-s="x"]').value).replace(',', '.'));
    W2.rows.push([isFinite(xv) ? xv : NaN, +t.toFixed(3), +(t / n).toFixed(4)]); W2.run = false; W2.acc = 0; W2.laps = []; go.textContent = 'เริ่ม'; paint(); lapsPaint(); out();
  };
  const out = () => { const hasX = W2.rows.some((r) => isFinite(r[0])); const rows = hasX ? W2.rows : W2.rows.map((r) => r.slice(1)); const hd = hasX ? head() : head().slice(1); mzOut(box, rows, hd, { yi: hasX ? 2 : 1, xi: hasX ? 0 : null, title: 'จับเวลา' }); };
  paint(); lapsPaint(); out();
}
/* ----- sound: the strongest frequency (with a fraction of a bin from the peak's shape) and the loudness ----- */
function mzAu(box) {
  const A = MZ.au;
  box.innerHTML = '<div class="mzbig"><span data-a="f">–</span> <small>Hz</small> <span class="mzdb" data-a="db"></span></div><canvas class="mzcv" width="640" height="180" aria-label="สเปกตรัมเสียง"></canvas>'
    + '<div class="row2"><button type="button" class="btn solid" data-a="go">เริ่มฟัง</button><button type="button" class="btn" data-a="save">จดค่านี้</button></div>'
    + '<div class="vaset"><label class="field"><span>ค่าตัวแปรต้นของครั้งนี้ (ไม่ใส่ก็ได้)</span><input data-a="x" inputmode="decimal" placeholder="เช่น ความยาวท่อ 0.30"></label><label class="field"><span>ชื่อและหน่วยตัวแปรต้น</span><input data-a="xn" value="L (m)"></label></div>'
    + '<div class="note small">ความดังเป็นค่าเทียบ (dB ต่ำกว่าระดับสูงสุดของไมโครโฟน) ไม่ได้สอบเทียบเป็นเดซิเบลจริง ความถี่แม่นพอสำหรับส้อมเสียง เครื่องดนตรี และการสั่นพ้องในท่อ</div>';
  const fEl = box.querySelector('[data-a="f"]'), dbEl = box.querySelector('[data-a="db"]'), cv = box.querySelector('.mzcv'), c = cv.getContext('2d'), go = box.querySelector('[data-a="go"]');
  const stop = () => { cancelAnimationFrame(A.raf); A.raf = 0; if (A.st) A.st.getTracks().forEach((t) => t.stop()); A.st = null; if (A.ctx) { try { A.ctx.close(); } catch (e) { /* closed */ } } A.ctx = null; go.textContent = 'เริ่มฟัง'; };
  go.onclick = async () => {
    if (A.st) { stop(); return; }
    try {
      A.st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const Ctx = window.AudioContext || window.webkitAudioContext; A.ctx = new Ctx(); const src = A.ctx.createMediaStreamSource(A.st);
      A.an = A.ctx.createAnalyser(); A.an.fftSize = 16384; A.an.smoothingTimeConstant = 0.6; src.connect(A.an); go.textContent = 'หยุดฟัง';
      const F = new Float32Array(A.an.frequencyBinCount), T = new Float32Array(A.an.fftSize), sr = A.ctx.sampleRate, bin = sr / A.an.fftSize;
      const tick = () => {
        A.an.getFloatFrequencyData(F); A.an.getFloatTimeDomainData(T);
        let rms = 0; for (let i = 0; i < T.length; i++) rms += T[i] * T[i]; rms = Math.sqrt(rms / T.length); A.db = 20 * Math.log10(rms || 1e-9);
        let bi = 0, bv = -Infinity; const lo = Math.floor(30 / bin), hi = Math.min(F.length - 2, Math.floor(8000 / bin));
        for (let i = lo; i <= hi; i++) if (F[i] > bv) { bv = F[i]; bi = i; }
        const a = F[bi - 1], b = F[bi], d = F[bi + 1], den = a - 2 * b + d, off = den ? 0.5 * (a - d) / den : 0;
        A.f = bv > -90 && A.db > -60 ? (bi + clamp(off, -0.5, 0.5)) * bin : 0;
        fEl.textContent = A.f ? A.f.toFixed(1) : '–'; dbEl.textContent = isFinite(A.db) ? A.db.toFixed(0) + ' dB' : '';
        c.clearRect(0, 0, cv.width, cv.height); c.strokeStyle = '#2F4BB8'; c.lineWidth = 1.5; c.beginPath();
        for (let x = 0; x < cv.width; x++) { const fr = 30 * Math.pow(8000 / 30, x / cv.width), i = Math.round(fr / bin), y = cv.height - clamp((F[i] + 110) / 90, 0, 1) * (cv.height - 10); if (x) c.lineTo(x, y); else c.moveTo(x, y); }
        c.stroke(); if (A.f) { const x = Math.log(A.f / 30) / Math.log(8000 / 30) * cv.width; c.strokeStyle = '#C2571A'; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, cv.height); c.stroke(); }
        A.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) { stop(); toast('เปิดไมโครโฟนไม่ได้ อนุญาตการใช้ไมโครโฟนในการตั้งค่าของเบราว์เซอร์แล้วลองใหม่', 3600); }
  };
  const head = () => [box.querySelector('[data-a="xn"]').value.trim() || 'x', 'ความถี่ (Hz)', 'ความดัง (dB)'];
  box.querySelector('[data-a="save"]').onclick = () => { if (!A.f) { toast('ยังไม่ได้ยินเสียงที่ชัดพอ', 1800); return; } const xv = parseFloat(String(box.querySelector('[data-a="x"]').value).replace(',', '.')); A.rows.push([isFinite(xv) ? xv : NaN, +A.f.toFixed(1), +A.db.toFixed(1)]); out(); };
  const out = () => { const hasX = A.rows.some((r) => isFinite(r[0])); mzOut(box, hasX ? A.rows : A.rows.map((r) => r.slice(1)), hasX ? head() : head().slice(1), { yi: hasX ? 1 : 0, xi: hasX ? 0 : null, title: 'ความถี่เสียง' }); };
  out();
}
/* ----- motion: acceleration from the iPad's sensor, its strongest period (pendulum, spring, a swing) ----- */
function mzAccStop() { const C = MZ.ac; if (C.on) { window.removeEventListener('devicemotion', mzOnMotion); C.on = false; } cancelAnimationFrame(C.raf); C.raf = 0; }
function mzOnMotion(e) { const C = MZ.ac, g = e.accelerationIncludingGravity || {}, a = e.acceleration || {}; const t = (performance.now() - C.t0) / 1000; if (C.data.length < 20000) C.data.push([t, a.x == null ? NaN : a.x, a.y == null ? NaN : a.y, a.z == null ? NaN : a.z, g.x, g.y, g.z]); }
function mzPeriod(ts, v) {
  /* the strongest repeat: the first clear peak of the autocorrelation, after removing the mean */
  const n = v.length; if (n < 40) return NaN; const dt = (ts[n - 1] - ts[0]) / (n - 1); const m = v.reduce((a, b) => a + b, 0) / n, x = v.map((y) => y - m);
  let r0 = 0; for (const y of x) r0 += y * y; if (!r0) return NaN;
  let prev = 1, down = false, best = NaN;
  for (let L = 2; L < n / 2; L++) { let s = 0; for (let i = 0; i + L < n; i++) s += x[i] * x[i + L]; const r = s / r0; if (r < prev) down = true; else if (down && r > 0.3) { let s2 = 0; for (let i = 0; i + L + 1 < n; i++) s2 += x[i] * x[i + L + 1]; if (s2 / r0 <= r) { best = L * dt; break; } } prev = r; }
  return best;
}
function mzAc(box) {
  const C = MZ.ac;
  box.innerHTML = '<div class="mzbig"><span data-a="v">–</span> <small>m/s²</small></div><canvas class="mzcv" width="640" height="200" aria-label="ความเร่งกับเวลา"></canvas>'
    + '<div class="row2"><button type="button" class="btn solid" data-a="go">เริ่มบันทึก</button><label class="field mzsel"><span>แสดง</span><select data-a="k"><option value="m">ขนาดรวม (ไม่รวม g)</option><option value="1">แกน x</option><option value="2">แกน y</option><option value="3">แกน z</option><option value="g">ขนาดรวม (รวม g)</option></select></label></div>'
    + '<div class="mzac"></div><div class="note small">วางไอแพดบนสิ่งที่เคลื่อนที่ เช่น รถทดลองหรือชิงช้า แกน x ไปทางขวาของจอ แกน y ไปทางด้านบนของจอ แกน z ออกจากจอ</div>';
  const vEl = box.querySelector('[data-a="v"]'), cv = box.querySelector('.mzcv'), c = cv.getContext('2d'), go = box.querySelector('[data-a="go"]'), ks = box.querySelector('[data-a="k"]'), res = box.querySelector('.mzac');
  const val = (r) => { const k = ks.value; if (k === 'm') return Math.hypot(r[1], r[2], r[3]); if (k === 'g') return Math.hypot(r[4], r[5], r[6]); return r[+k]; };
  const draw = () => {
    const D = C.data, n = D.length; c.clearRect(0, 0, cv.width, cv.height); if (n < 2) return;
    const tw = Math.max(5, D[n - 1][0]), vs = D.map(val).filter(isFinite), lo = Math.min(...vs, -1), hi = Math.max(...vs, 1);
    c.strokeStyle = 'rgba(127,127,127,0.4)'; c.beginPath(); const y0 = cv.height - (0 - lo) / (hi - lo) * cv.height; c.moveTo(0, y0); c.lineTo(cv.width, y0); c.stroke();
    c.strokeStyle = '#2F4BB8'; c.lineWidth = 1.5; c.beginPath(); let st = false;
    for (const r of D) { const v = val(r); if (!isFinite(v)) continue; const x = r[0] / tw * cv.width, y = cv.height - (v - lo) / (hi - lo) * cv.height; if (st) c.lineTo(x, y); else { c.moveTo(x, y); st = true; } }
    c.stroke(); const last = val(D[n - 1]); vEl.textContent = isFinite(last) ? last.toFixed(2) : '–';
  };
  const loop = () => { draw(); if (C.on) C.raf = requestAnimationFrame(loop); };
  const summary = () => {
    const D = C.data; if (D.length < 10) { res.innerHTML = ''; return; }
    const ts = D.map((r) => r[0]), vs = D.map(val), ok = vs.map((v, i) => [ts[i], v]).filter((p) => isFinite(p[1])), T = mzStats(ok.map((p) => p[1])), P = mzPeriod(ok.map((p) => p[0]), ok.map((p) => p[1]));
    const mx = Math.max(...ok.map((p) => Math.abs(p[1])));
    res.innerHTML = '<div class="dsres"><span><i>ช่วงเวลา</i> ' + mzSig(ts[ts.length - 1], 3) + ' s, ' + D.length + ' ค่า (' + mzSig(D.length / (ts[ts.length - 1] || 1), 3) + ' ค่าต่อวินาที)</span><span><i>ค่าเฉลี่ย</i> ' + mzSig(T.m, 3) + ' m/s²  <i>มากสุด</i> ' + mzSig(mx, 3) + ' m/s²</span>' + (isFinite(P) ? '<span><i>คาบที่เด่นที่สุด</i> <b>' + mzSig(P, 3) + ' s</b> (ความถี่ ' + mzSig(1 / P, 3) + ' Hz)</span>' : '') + '</div>'
      + '<div class="row2"><button type="button" class="btn solid" data-o="pic">วางกราฟลงหน้า</button><button type="button" class="btn" data-o="st">ส่งไปสถิติ</button></div>';
    res.querySelector('[data-o="st"]').onclick = () => { const step = Math.max(1, Math.floor(D.length / 2000)); const txt = 't a\n' + D.filter((_, i) => i % step === 0).map((r) => r[0].toFixed(3) + ' ' + (isFinite(val(r)) ? val(r).toFixed(3) : '')).join('\n'); mzClose(); need('stats').then(() => openStats(txt)); };
    res.querySelector('[data-o="pic"]').onclick = () => {
      const w = 560, at = viewSpot(w, 360), step = Math.max(1, Math.floor(ok.length / 600)), pts = ok.filter((_, i) => i % step === 0), tw = pts[pts.length - 1][0] || 1, lo = Math.min(...pts.map((p) => p[1]), 0), hi = Math.max(...pts.map((p) => p[1]), 0.1);
      const X = (t) => 40 + t / tw * 500, Y = (v) => 190 - (v - lo) / (hi - lo) * 170;
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 220"><path d="M40 10V190H545" fill="none" stroke="#555"/><path d="M40 ' + Y(0).toFixed(1) + 'H545" stroke="#999" stroke-dasharray="4 4"/><path d="' + pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('') + '" fill="none" stroke="#2F4BB8" stroke-width="1.6"/><text x="545" y="208" text-anchor="end" font-size="13" fill="#555">t (s) 0 ถึง ' + mzSig(tw, 3) + '</text><text x="44" y="22" font-size="13" fill="#555">a (m/s²) ' + mzSig(lo, 3) + ' ถึง ' + mzSig(hi, 3) + '</text></svg>';
      addItem({ type: 'svg', x: at[0], y: at[1], w, svg });
      addItem({ type: 'text', x: at[0], y: at[1] + 230, w, md: 'ความเร่ง ' + ks.selectedOptions[0].textContent + ' ค่าเฉลี่ย ' + mzSig(T.m, 3) + ' m/s², มากสุด ' + mzSig(mx, 3) + ' m/s²' + (isFinite(P) ? ', คาบ ' + mzSig(P, 3) + ' s' : '') });
      mzClose(); toast('วางกราฟความเร่งแล้ว', 1600);
    };
  };
  ks.onchange = () => { draw(); summary(); };
  go.onclick = async () => {
    if (C.on) { mzAccStop(); go.textContent = 'เริ่มบันทึกใหม่'; draw(); summary(); return; }
    if (typeof DeviceMotionEvent === 'undefined') { toast('เครื่องนี้ไม่มีเซนเซอร์ความเร่ง ใช้บนไอแพดหรือโทรศัพท์', 3000); return; }
    try { if (typeof DeviceMotionEvent.requestPermission === 'function') { const p = await DeviceMotionEvent.requestPermission(); if (p !== 'granted') { toast('ยังไม่ได้อนุญาตให้ใช้เซนเซอร์การเคลื่อนไหว', 2600); return; } } } catch (e) { /* asked already */ }
    C.data = []; C.t0 = performance.now(); C.on = true; window.addEventListener('devicemotion', mzOnMotion); go.textContent = 'หยุดบันทึก'; res.innerHTML = ''; loop();
    setTimeout(() => { if (C.on && !C.data.length) toast('ไม่มีค่าจากเซนเซอร์ เครื่องนี้อาจไม่มีเซนเซอร์ความเร่ง', 3000); }, 1500);
  };
  draw(); summary();
}

