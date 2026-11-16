/* BURIN part: imgmeas (loaded when first used) */
/* ---------- measuring on a picture: a scale from a known length (a scale bar, a ruler), then lengths, angles, areas, and
   counting by tapping (cells, colonies, seeds) in up to three groups. The marks can go onto the page over the picture as
   pen lines, with a summary beside it ---------- */
const IM = { it: null, nat: [1, 1], tool: 'scale', sc: null, len: 1, unit: 'mm', cur: [], ms: [], grp: 0 };
const IM_COL = ['#C2571A', '#2E8B57', '#8E44AD'], IM_GRP = ['กลุ่ม ก', 'กลุ่ม ข', 'กลุ่ม ค'];
function openImgMeasure(id) {
  const it = findItem(id); if (!it || it.type !== 'img') return;
  const src = (underImgEl(it) && underImgEl(it).getAttribute('src')) || ((itemsEl.querySelector('[data-id="' + id + '"] img') || {}).currentSrc);
  if (!src) { toast('รูปยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง', 2000); return; }
  closeSheets(); let sh = $('#imSheet');
  if (!sh) {
    sh = document.createElement('div'); sh.id = 'imSheet'; sh.className = 'sheet vidsheet';
    sh.innerHTML = '<div class="panel wide" role="dialog" aria-label="วัดบนรูป"><div class="mvhead"><h2>วัดบนรูป</h2><button type="button" class="btn" data-a="x">ปิด</button></div>'
      + '<div class="chips imtools"><button type="button" class="chip" data-t="scale">ตั้งมาตราส่วน</button><button type="button" class="chip" data-t="len">ความยาว</button><button type="button" class="chip" data-t="ang">มุม</button><button type="button" class="chip" data-t="area">พื้นที่</button><button type="button" class="chip" data-t="count">นับ</button></div>'
      + '<div class="vahint note small"></div><div class="vastage imstage"><img alt="" draggable="false"><canvas class="vaov"></canvas></div>'
      + '<div class="vaset"><label class="field"><span>ความยาวจริงของมาตราส่วน</span><input data-a="len" inputmode="decimal" value="1"></label><label class="field"><span>หน่วย</span><select data-a="unit"><option>nm</option><option>µm</option><option selected>mm</option><option>cm</option><option>m</option><option>km</option></select></label>'
      + '<label class="field imgrp"><span>นับเป็น</span><select data-a="grp"><option value="0">กลุ่ม ก</option><option value="1">กลุ่ม ข</option><option value="2">กลุ่ม ค</option></select></label></div>'
      + '<div class="row2"><button type="button" class="btn" data-a="close">ปิดรูปพื้นที่</button><button type="button" class="btn" data-a="undo">ลบล่าสุด</button><button type="button" class="btn" data-a="clear">ล้างทั้งหมด</button></div><div class="imres"></div></div>';
    document.body.appendChild(sh);
    const q = (a) => sh.querySelector('[data-a="' + a + '"]');
    q('x').onclick = () => { sh.hidden = true; };
    sh.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => imTool(b.dataset.t); });
    q('len').oninput = () => { const v = parseFloat(q('len').value.replace(',', '.')); if (v > 0) { IM.len = v; imPaint(); } };
    q('unit').onchange = () => { IM.unit = q('unit').value; imPaint(); };
    q('grp').onchange = () => { IM.grp = +q('grp').value; };
    q('close').onclick = () => { if (IM.tool === 'area' && IM.cur.length >= 3) { IM.ms.push({ k: 'area', p: IM.cur }); IM.cur = []; imPaint(); } };
    q('undo').onclick = () => { if (IM.cur.length) IM.cur.pop(); else IM.ms.pop(); imPaint(); };
    q('clear').onclick = () => { IM.cur = []; IM.ms = []; imPaint(); };
    sh.querySelector('.vaov').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); imTap(e); });
    window.addEventListener('resize', () => { if (!sh.hidden) imFit(); });
  }
  if (!IM.it || IM.it.id !== id) { IM.sc = null; IM.ms = []; IM.cur = []; }
  IM.it = it; sh.hidden = false;
  const im = sh.querySelector('.imstage img');
  im.onload = () => { IM.nat = [im.naturalWidth, im.naturalHeight]; imFit(); imTool(IM.sc ? 'len' : 'scale'); };
  if (im.getAttribute('src') === src && im.naturalWidth) im.onload(); else im.src = src;
}
function imFit() {
  const sh = $('#imSheet'), im = sh.querySelector('.imstage img'), ov = sh.querySelector('.vaov'), st = sh.querySelector('.imstage');
  const maxW = st.clientWidth || 600, maxH = Math.max(240, window.innerHeight * 0.55), k = Math.min(maxW / IM.nat[0], maxH / IM.nat[1]);
  const w = Math.round(IM.nat[0] * k), h = Math.round(IM.nat[1] * k), dpr = Math.min(2, window.devicePixelRatio || 1);
  im.style.width = w + 'px'; im.style.height = h + 'px'; ov.style.width = w + 'px'; ov.style.height = h + 'px'; ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr); imPaint();
}
function imTool(t) {
  IM.tool = t; IM.cur = []; const sh = $('#imSheet');
  sh.querySelectorAll('[data-t]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === t ? 'true' : 'false'));
  sh.querySelector('.imgrp').hidden = t !== 'count'; sh.querySelector('[data-a="close"]').hidden = t !== 'area';
  sh.querySelector('.vahint').textContent = { scale: 'แตะปลายทั้งสองข้างของสเกลบาร์หรือไม้บรรทัดในรูป แล้วใส่ความยาวจริงและหน่วยด้านล่าง', len: 'แตะจุดเริ่มและจุดปลายของสิ่งที่จะวัด', ang: 'แตะปลายแขนข้างหนึ่ง แล้วจุดยอดมุม แล้วปลายแขนอีกข้าง', area: 'แตะไปรอบขอบของบริเวณที่จะวัด แตะจุดแรกอีกครั้งหรือกดปิดรูปพื้นที่เมื่อครบ', count: 'แตะแต่ละสิ่งที่จะนับ แตะซ้ำที่จุดเดิมเพื่อเอาออก เลือกกลุ่มเพื่อนับแยกประเภท' }[t];
  if (t !== 'scale' && !IM.sc && t !== 'count' && t !== 'ang') sh.querySelector('.vahint').textContent += ' (ยังไม่ได้ตั้งมาตราส่วน ค่าจะเป็นพิกเซล)';
  imPaint();
}
function imTap(e) {
  const ov = $('#imSheet .vaov'), r = ov.getBoundingClientRect(), p = [(e.clientX - r.left) / r.width * IM.nat[0], (e.clientY - r.top) / r.height * IM.nat[1]];
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 12 * IM.nat[0] / r.width;
  if (IM.tool === 'scale') { IM.cur.push(p); if (IM.cur.length === 2) { IM.sc = IM.cur; IM.cur = []; setTimeout(() => imTool('len'), 300); } }
  else if (IM.tool === 'len') { IM.cur.push(p); if (IM.cur.length === 2) { IM.ms.push({ k: 'len', p: IM.cur }); IM.cur = []; } }
  else if (IM.tool === 'ang') { IM.cur.push(p); if (IM.cur.length === 3) { IM.ms.push({ k: 'ang', p: IM.cur }); IM.cur = []; } }
  else if (IM.tool === 'area') { if (IM.cur.length >= 3 && near(p, IM.cur[0])) { IM.ms.push({ k: 'area', p: IM.cur }); IM.cur = []; } else IM.cur.push(p); }
  else { const i = IM.ms.findIndex((m) => m.k === 'dot' && near(m.p[0], p)); if (i >= 0) IM.ms.splice(i, 1); else IM.ms.push({ k: 'dot', p: [p], g: IM.grp }); }
  imPaint();
}
/* real length per picture pixel from the scale, or none (then results stay in pixels) */
function imPer() { if (!IM.sc) return null; const d = Math.hypot(IM.sc[1][0] - IM.sc[0][0], IM.sc[1][1] - IM.sc[0][1]); return d > 1 ? IM.len / d : null; }
function imVal(m) {
  const per = imPer(), u = per ? IM.unit : 'px';
  if (m.k === 'len') { const d = Math.hypot(m.p[1][0] - m.p[0][0], m.p[1][1] - m.p[0][1]) * (per || 1); return [d, u]; }
  if (m.k === 'ang') { const [a, o, b] = m.p, t1 = Math.atan2(a[1] - o[1], a[0] - o[0]), t2 = Math.atan2(b[1] - o[1], b[0] - o[0]); let d = Math.abs(t1 - t2) * 180 / Math.PI; if (d > 180) d = 360 - d; return [d, 'องศา']; }
  if (m.k === 'area') { let s = 0; const P = m.p; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return [Math.abs(s) / 2 * (per || 1) ** 2, u + '²']; }
  return null;
}
const imFmt = (x) => (x >= 1000 || x < 0.01 ? Number(x).toPrecision(3) : String(+Number(x).toPrecision(3)));
function imPaint() {
  const sh = $('#imSheet'); if (!sh || sh.hidden) return; const ov = sh.querySelector('.vaov'), c = ov.getContext('2d'), k = ov.width / IM.nat[0], lw = Math.max(1.5, ov.width / 450);
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, ov.width, ov.height); c.lineCap = 'round'; c.lineJoin = 'round'; c.font = Math.round(lw * 8) + 'px Sarabun, sans-serif';
  const P = (p) => [p[0] * k, p[1] * k], dot = (p, col, r) => { const q = P(p); c.fillStyle = col; c.beginPath(); c.arc(q[0], q[1], r || lw * 2.6, 0, 7); c.fill(); };
  const lab = (p, t, col) => { const q = P(p); c.lineWidth = lw * 2.5; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.strokeText(t, q[0] + lw * 3, q[1] - lw * 3); c.fillStyle = col; c.fillText(t, q[0] + lw * 3, q[1] - lw * 3); };
  const line = (pts, col, close) => { c.strokeStyle = col; c.lineWidth = lw * 1.4; c.beginPath(); pts.forEach((p, i) => { const q = P(p); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); if (close) c.closePath(); c.stroke(); };
  if (IM.sc) { line(IM.sc, '#E39B2D'); IM.sc.forEach((p) => dot(p, '#E39B2D')); lab(IM.sc[1], IM.len + ' ' + IM.unit, '#B7791F'); }
  let n = 0;
  for (const m of IM.ms) {
    if (m.k === 'dot') { dot(m.p[0], IM_COL[m.g || 0], lw * 3.4); continue; }
    n++; const [v, u] = imVal(m), col = '#2F4BB8';
    if (m.k === 'area') { c.fillStyle = 'rgba(47,75,184,0.12)'; c.beginPath(); m.p.forEach((p, i) => { const q = P(p); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); c.fill(); line(m.p, col, true); }
    else line(m.p, col);
    m.p.forEach((p) => dot(p, col));
    lab(m.k === 'ang' ? m.p[1] : m.p[m.p.length - 1], n + ') ' + imFmt(v) + ' ' + u, col);
  }
  if (IM.cur.length) { line(IM.cur, '#C2571A'); IM.cur.forEach((p) => dot(p, '#C2571A')); }
  imRes();
}
function imSummary() {
  const out = []; let n = 0;
  for (const m of IM.ms) { if (m.k === 'dot') continue; n++; const [v, u] = imVal(m); out.push(n + ') ' + ({ len: 'ความยาว', ang: 'มุม', area: 'พื้นที่' })[m.k] + ' ' + imFmt(v) + ' ' + u); }
  const cnt = [0, 0, 0]; IM.ms.forEach((m) => { if (m.k === 'dot') cnt[m.g || 0]++; });
  if (cnt.some(Boolean)) out.push('นับได้ ' + cnt.map((x, i) => (x ? IM_GRP[i] + ' ' + x : '')).filter(Boolean).join(', ') + (cnt.filter(Boolean).length > 1 ? ' รวม ' + (cnt[0] + cnt[1] + cnt[2]) : ''));
  return out;
}
function imRes() {
  const box = $('#imSheet .imres'), L = imSummary();
  if (!L.length) { box.innerHTML = '<div class="note small">ยังไม่มีผลการวัด</div>'; return; }
  box.innerHTML = '<div class="dsres">' + L.map((x) => '<span>' + esc(x) + '</span>').join('') + '</div>' + (IM.sc ? '<div class="note small">มาตราส่วน ' + esc(IM.len + ' ' + IM.unit) + ' ต่อ ' + Math.round(Math.hypot(IM.sc[1][0] - IM.sc[0][0], IM.sc[1][1] - IM.sc[0][1])) + ' พิกเซล</div>' : '')
    + '<div class="row2"><button type="button" class="btn solid" data-o="put">วางลงหน้า เส้นวัดบนรูปและผลข้างรูป</button><button type="button" class="btn" data-o="txt">วางเฉพาะผล</button></div>';
  box.querySelector('[data-o="put"]').onclick = () => imPut(true); box.querySelector('[data-o="txt"]').onclick = () => imPut(false);
}
function imPut(marks) {
  const it = findItem(IM.it.id); if (!it) return; const L = imSummary(); if (!L.length) return;
  const sx = (it.w || 600) / IM.nat[0], ar = it.ar || IM.nat[1] / IM.nat[0], sy = (it.w || 600) * ar / IM.nat[1], pg = (p) => [it.x + p[0] * sx, it.y + p[1] * sy];
  if (marks) {
    const add = [], g = 'g' + uid(), mk = (pts, col, w) => { const f = []; for (const q of pts) f.push(Math.round(q[0] * 10), Math.round(q[1] * 10), 50); add.push({ id: 's' + uid(), k: 'p', c: col, w: w || 2.2, p: f, g }); };
    const circ = (p, r, col) => { const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16 * Math.PI * 2; pts.push([p[0] + r * Math.cos(t), p[1] + r * Math.sin(t)]); } mk(pts, col, 2.4); };
    for (const m of IM.ms) {
      if (m.k === 'dot') { circ(pg(m.p[0]), 5, IM_COL[m.g || 0]); continue; }
      const P2 = m.p.map(pg); mk(m.k === 'area' ? P2.concat([P2[0]]) : P2, '#2F4BB8');
    }
    if (IM.sc) mk(IM.sc.map(pg), '#E39B2D');
    const before = { [DEV]: clone(S.mine) }; for (const st of add) S.mine.push(st); pushUndo({ t: 'layers', before, after: { [DEV]: clone(S.mine) } });
    saveMine(); drawInk(); if (typeof sharpLater === 'function') sharpLater();
  }
  const right = it.x + (it.w || 600) + 16, w = Math.max(220, Math.min(420, W - right - 20)), x = right + w <= W - 10 ? right : it.x, y = right + w <= W - 10 ? it.y : it.y + (it.w || 600) * (it.ar || 0.75) + 12;
  addItem({ type: 'text', x, y, w, md: '**ผลการวัดบนรูป**\n\n' + L.map((x) => '- ' + x).join('\n') + (IM.sc ? '\n- มาตราส่วน ' + IM.len + ' ' + IM.unit + ' จากสเกลในรูป' : '') });
  $('#imSheet').hidden = true; toast('วางผลการวัดแล้ว', 1600);
}

