/* BURIN part: figs (loaded when first used) */
/* ---------- figures worked out from the numbers given, with no AI (task 8.19 group 4). What is picked on a page (typed,
   or handwriting the AI read before) and asked for a figure:
     a triangle with some of its sides and angles (สามเหลี่ยม ABC, AB = 5 cm, BC = 7 cm, มุม B = 60°): the rest by the
       laws of cosines and sines, drawn to scale, with the perimeter, the area and its kind (SSA with two answers says so)
     resistors all in series or all in parallel, with the battery voltage or the current: the total resistance, the
       current, the voltage and the power of each, and the circuit drawn
     forces with their sizes and directions (F1 = 10 N ที่ 0°, F2 = 5 N ไปทางขึ้น): the components and the resultant,
       drawn from one point with the resultant dashed
   "figs" in flags.json turns it off (or "localcalc", or "typed"): the figure goes to the AI as before ---------- */
const FG_F = 'font-family="Sarabun, sans-serif"';
const fgEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fgMinus = (s) => String(s).replace(/-/g, '−');
function fgR(v) { if (!isFinite(v)) return String(v); const a = Math.abs(v); const p = a >= 100 ? 4 : 3; return fgMinus(Number(v.toPrecision(p)).toString()); }
/* the text as plain characters: LaTeX signs for degrees, ohms and multiplication, Thai digits, the minus sign */
function fgClean(t) {
  return String(t || '').replace(/\$/g, ' ').replace(/\\text\{([^}]*)\}|\\mathrm\{([^}]*)\}/g, '$1$2').replace(/\^\s*\{?\\circ\}?|\\degree|\^\s*o\b/g, '°').replace(/\\Omega/g, 'Ω')
    .replace(/\\angle/g, '∠').replace(/\\(?:,|;|!|quad| )/g, ' ').replace(/[{}]/g, '').replace(/[−–]/g, '-').replace(/[๐-๙]/g, (d) => '๐๑๒๓๔๕๖๗๘๙'.indexOf(d)).replace(/\s+/g, ' ').trim();
}
const FG_NUM = '([+-]?\\d+(?:\\.\\d+)?)';
const fgT = (x, y, s, size, col, extra) => '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + size + '" ' + FG_F + ' fill="' + (col || '#1A1A1A') + '"' + (extra || '') + '>' + s + '</text>';
const fgSvg = (W, H, body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + Math.ceil(H) + '"><rect width="' + W + '" height="' + Math.ceil(H) + '" fill="#FFFFFF"/>' + body + '</svg>';
const D2R = Math.PI / 180;

/* ----- triangles ----- */
function fgTriParse(t) {
  const tri = /สามเหลี่ยม|triangle|△/i.test(t), V = ((t.match(/(?:สามเหลี่ยม|triangle|△)\s*([A-Z])([A-Z])([A-Z])\b/i) || []).slice(1, 4));
  const names = V.length === 3 && V.every(Boolean) ? V.map((x) => x.toUpperCase()) : ['A', 'B', 'C'];
  const s = [null, null, null], a = [null, null, null]; let unit = '', n = 0;
  const idx = (ch) => names.indexOf(ch);
  /* sides by their two vertices: AB = 5 cm (the side opposite C) */
  const reS = new RegExp('\\b([A-Z])([A-Z])\\s*=\\s*' + FG_NUM + '\\s*(cm|mm|m|km|ซม\\.?|เมตร|หน่วย)?', 'g'); let m;
  while ((m = reS.exec(t))) { const i = idx(m[1]), j = idx(m[2]); if (i < 0 || j < 0 || i === j) continue; const k = 3 - i - j; s[k] = +m[3]; if (m[4]) unit = m[4]; n++; }
  /* sides by small letters (a opposite A) only when the text says it is a triangle */
  if (tri) { const reL = new RegExp('(?:^|[\\s,;(])([abc])\\s*=\\s*' + FG_NUM + '\\s*(cm|mm|m|km|ซม\\.?|เมตร|หน่วย)?', 'g'); while ((m = reL.exec(t))) { const k = 'abc'.indexOf(m[1]); if (s[k] == null) { s[k] = +m[2]; if (m[3]) unit = m[3]; n++; } } }
  /* angles: มุม B = 60°, ∠ABC = 60°, A = 60° */
  const reA = new RegExp('(?:มุม|∠|angle)\\s*([A-Z]{1,3})\\s*=\\s*' + FG_NUM + '\\s*(?:°|องศา|deg)?', 'gi');
  while ((m = reA.exec(t))) { const w = m[1].toUpperCase(), ch = w.length === 3 ? w[1] : w[0], k = idx(ch); if (k >= 0) { a[k] = +m[2]; n++; } }
  const reB = new RegExp('(?:^|[\\s,;(])([A-Z])\\s*=\\s*' + FG_NUM + '\\s*(?:°|องศา)', 'g');
  while ((m = reB.exec(t))) { const k = idx(m[1]); if (k >= 0 && a[k] == null) { a[k] = +m[2]; n++; } }
  if (!tri && !s.some((x) => x != null)) return null;
  if (!tri && n < 3) return null;
  if (s.filter((x) => x != null).length + a.filter((x) => x != null).length < 3 || !s.some((x) => x != null)) return null;
  if (s.some((x) => x != null && x <= 0) || a.some((x) => x != null && (x <= 0 || x >= 180))) return null;
  return { names, s, a, unit: unit.replace(/^ซม\.?$/, 'cm').replace('เมตร', 'm') };
}
/* the rest of the triangle; { s, a, two } or null when it cannot be a triangle */
function fgTriSolve(P) {
  const s = P.s.slice(), a = P.a.slice(); let two = null, used = [];
  for (let it = 0; it < 8; it++) {
    const ka = a.filter((x) => x != null).length, ks = s.filter((x) => x != null).length;
    if (ka === 3 && ks === 3) break;
    if (ka === 2) { const i = a.indexOf(null); a[i] = 180 - a.reduce((p, x) => p + (x || 0), 0); if (a[i] <= 0) return null; used.push('มุมภายในรวมกัน 180°'); continue; }
    if (ks === 3 && ka < 3) {
      const [x, y, z] = s; if (x + y <= z || y + z <= x || x + z <= y) return null;
      for (let i = 0; i < 3; i++) if (a[i] == null) { const p = s[i], q = s[(i + 1) % 3], r = s[(i + 2) % 3]; a[i] = Math.acos((q * q + r * r - p * p) / (2 * q * r)) / D2R; }
      used.push('กฎของโคไซน์'); continue;
    }
    let did = false;
    /* two sides and the angle between them: the third side */
    for (let i = 0; i < 3 && !did; i++) if (s[i] == null && a[i] != null && s[(i + 1) % 3] != null && s[(i + 2) % 3] != null) {
      const q = s[(i + 1) % 3], r = s[(i + 2) % 3]; s[i] = Math.sqrt(q * q + r * r - 2 * q * r * Math.cos(a[i] * D2R)); did = true; used.push('กฎของโคไซน์');
    }
    if (did) continue;
    /* a side with its opposite angle: the law of sines for the others */
    const k = [0, 1, 2].find((i) => s[i] != null && a[i] != null);
    if (k == null) return null;
    const ratio = s[k] / Math.sin(a[k] * D2R);
    for (let i = 0; i < 3 && !did; i++) {
      if (i === k) continue;
      if (a[i] != null && s[i] == null) { s[i] = ratio * Math.sin(a[i] * D2R); did = true; }
      else if (s[i] != null && a[i] == null) {
        const sv = s[i] / ratio; if (sv > 1 + 1e-12) return null;
        const ang = Math.asin(Math.min(1, sv)) / D2R, alt = 180 - ang;
        /* SSA: the obtuse answer works too when it leaves room for the third angle */
        if (Math.abs(alt - ang) > 1e-6 && alt + a[k] < 180 - 1e-9 && !two) two = { i, alt };
        a[i] = ang; did = true;
      }
    }
    if (did) { used.push('กฎของไซน์'); continue; }
    return null;
  }
  if (s.some((x) => x == null || !(x > 0)) || a.some((x) => x == null || !(x > 0))) return null;
  return { s, a, two, used: [...new Set(used)] };
}
function fgTriFig(P) {
  const R = fgTriSolve(P); if (!R) return { svg: fgSvg(600, 70, fgT(20, 42, 'ค่าที่ให้ประกอบเป็นสามเหลี่ยมไม่ได้ ตรวจความยาวด้านและมุมอีกครั้ง', 18, '#C62828')), note: 'ค่าที่ให้ประกอบเป็นสามเหลี่ยมไม่ได้' };
  const { s, a } = R, [A, B, C] = P.names, u = P.unit ? ' ' + P.unit : '';
  /* A at the origin, B along the base (side c), C above it */
  const pts = [[0, 0], [s[2], 0], [s[1] * Math.cos(a[0] * D2R), s[1] * Math.sin(a[0] * D2R)]];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys);
  const sc = Math.min(290 / (x1 - x0 || 1), 220 / (y1 || 1)), ox = 50 - x0 * sc, oy = 270;
  const P2 = pts.map((p) => [ox + p[0] * sc, oy - p[1] * sc]), cx = (P2[0][0] + P2[1][0] + P2[2][0]) / 3, cy = (P2[0][1] + P2[1][1] + P2[2][1]) / 3;
  let g = '<polygon points="' + P2.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '" fill="#E3F2FD" stroke="#1A1A1A" stroke-width="2.2"/>';
  for (let i = 0; i < 3; i++) {
    const p = P2[i], dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1;
    g += fgT(p[0] + dx / d * 18 - 6, p[1] + dy / d * 18 + 6, P.names[i], 20, '#1A1A1A', ' font-weight="600"');
    /* the angle: a small arc and its size, inside */
    const q = P2[(i + 1) % 3], r = P2[(i + 2) % 3], a1 = Math.atan2(q[1] - p[1], q[0] - p[0]), a2 = Math.atan2(r[1] - p[1], r[0] - p[0]);
    let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const rr = 22, e1 = [p[0] + rr * Math.cos(a1), p[1] + rr * Math.sin(a1)], e2 = [p[0] + rr * Math.cos(a1 + da), p[1] + rr * Math.sin(a1 + da)];
    if (Math.abs(a[i] - 90) < 1e-6) { const k = 14, u1 = [Math.cos(a1), Math.sin(a1)], u2 = [Math.cos(a2), Math.sin(a2)]; g += '<polyline points="' + [[p[0] + u1[0] * k, p[1] + u1[1] * k], [p[0] + (u1[0] + u2[0]) * k, p[1] + (u1[1] + u2[1]) * k], [p[0] + u2[0] * k, p[1] + u2[1] * k]].map((z) => z[0].toFixed(1) + ',' + z[1].toFixed(1)).join(' ') + '" fill="none" stroke="#C62828" stroke-width="1.6"/>'; }
    else g += '<path d="M' + e1[0].toFixed(1) + ',' + e1[1].toFixed(1) + ' A' + rr + ',' + rr + ' 0 0 ' + (da > 0 ? 1 : 0) + ' ' + e2[0].toFixed(1) + ',' + e2[1].toFixed(1) + '" fill="none" stroke="#C62828" stroke-width="1.6"/>';
    const mid = a1 + da / 2, lx = p[0] + 44 * Math.cos(mid), ly = p[1] + 44 * Math.sin(mid);
    g += fgT(lx - 16, ly + 5, fgR(a[i]) + '°', 14, '#C62828');
    /* the side opposite this vertex: its length outside, at the middle */
    const mx = (q[0] + r[0]) / 2, my = (q[1] + r[1]) / 2, ex = mx - cx, ey = my - cy, ed = Math.hypot(ex, ey) || 1;
    g += fgT(mx + ex / ed * 16 - 14, my + ey / ed * 16 + 5, fgR(s[i]) + u, 15, '#1565C0');
  }
  const per = s[0] + s[1] + s[2], area = 0.5 * s[1] * s[2] * Math.sin(a[0] * D2R);
  const kindS = Math.abs(s[0] - s[1]) < 1e-6 * per && Math.abs(s[1] - s[2]) < 1e-6 * per ? 'ด้านเท่า' : (Math.abs(s[0] - s[1]) < 1e-6 * per || Math.abs(s[1] - s[2]) < 1e-6 * per || Math.abs(s[0] - s[2]) < 1e-6 * per) ? 'หน้าจั่ว' : 'ด้านไม่เท่า';
  const big = Math.max(...a), kindA = Math.abs(big - 90) < 1e-6 ? 'มุมฉาก' : big > 90 ? 'มุมป้าน' : 'มุมแหลม';
  const L = 400; let y = 60, info = '';
  const line = (t, col, sz) => { info += fgT(L, y, t, sz || 16, col); y += 28; };
  line('สามเหลี่ยม' + kindS, '#1A1A1A', 17); line('และเป็นสามเหลี่ยม' + kindA, '#1A1A1A', 17);
  for (let i = 0; i < 3; i++) line(P.names[(i + 1) % 3] + P.names[(i + 2) % 3] + ' = ' + fgR(s[i]) + u, P.s[i] == null ? '#1565C0' : '#37474F');
  for (let i = 0; i < 3; i++) line('มุม ' + P.names[i] + ' = ' + fgR(a[i]) + '°', P.a[i] == null ? '#C62828' : '#37474F');
  line('เส้นรอบรูป ' + fgR(per) + u, '#1A1A1A');
  line('พื้นที่ ' + fgR(area) + (P.unit ? ' ' + P.unit + '<tspan dy="-7" font-size="11">2</tspan><tspan dy="7"></tspan>' : ' ตารางหน่วย'), '#1A1A1A');
  let foot = 'ค่าที่คำนวณ (สีน้ำเงินและแดง) ใช้' + R.used.join(' และ ');
  let H = Math.max(y, 300) + 20;
  if (R.two) { const j = R.two.i; info += fgT(20, H, 'ข้อมูลนี้ได้สามเหลี่ยมสองรูป อีกรูปมีมุม ' + P.names[j] + ' = ' + fgR(R.two.alt) + '°', 15, '#6D4C41'); H += 24; }
  info += fgT(20, H, foot, 13, '#78909C'); H += 14;
  return { svg: fgSvg(640, H, g + info), note: 'สามเหลี่ยม คำนวณในเครื่องตามมาตราส่วน' };
}

/* ----- resistors all in series or all in parallel ----- */
function fgCircParse(t) {
  const ser = /อนุกรม|series/i.test(t), par = /ขนาน|parallel/i.test(t); if (ser === par) return null;
  const R = [], re = new RegExp('\\bR\\s*_?\\s*(\\d*)\\s*=\\s*' + FG_NUM + '\\s*(k)?\\s*(?:Ω|โอห์ม|ohms?)?', 'gi'); let m;
  while ((m = re.exec(t))) { const v = +m[2] * (m[3] ? 1000 : 1); if (v > 0) R.push({ n: m[1] ? 'R' + m[1] : 'R' + (R.length + 1), v }); }
  /* a list without names: ตัวต้านทาน 2 Ω 3 Ω และ 6 Ω */
  if (!R.length) { const re2 = new RegExp(FG_NUM + '\\s*(k)?\\s*(?:Ω|โอห์ม|ohms?)', 'gi'); while ((m = re2.exec(t))) { const v = +m[1] * (m[2] ? 1000 : 1); if (v > 0) R.push({ n: 'R' + (R.length + 1), v }); } }
  if (R.length < 2 || R.length > 6) return null;
  const vm = t.match(new RegExp('(?:\\b(?:V|E|ε)\\s*=\\s*|แบตเตอรี่\\s*|ความต่างศักย์\\s*)' + FG_NUM + '\\s*(?:V|โวลต์|volts?)', 'i')) || t.match(new RegExp(FG_NUM + '\\s*(?:V|โวลต์|volts?)\\b', 'i'));
  const im = t.match(new RegExp('\\bI\\s*=\\s*' + FG_NUM + '\\s*(m)?\\s*(?:A|แอมแปร์|amps?)', 'i'));
  return { mode: ser ? 'series' : 'parallel', R, V: vm ? +vm[1] : null, I: im ? +im[1] * (im[2] ? 0.001 : 1) : null };
}
function fgZig(x1, y1, x2, y2) {
  /* a resistor as a zigzag between two points (horizontal or vertical) */
  const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux, lead = (L - 48) / 2, pts = [[x1, y1], [x1 + ux * lead, y1 + uy * lead]];
  for (let k = 1; k <= 6; k++) { const d = lead + k * 8 - 4, w = k % 2 ? 8 : -8; pts.push([x1 + ux * d + nx * w, y1 + uy * d + ny * w]); }
  pts.push([x1 + ux * (lead + 48), y1 + uy * (lead + 48)], [x2, y2]);
  return '<polyline points="' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '" fill="none" stroke="#1A1A1A" stroke-width="2"/>';
}
function fgCircFig(P) {
  const n = P.R.length, Rt = P.mode === 'series' ? P.R.reduce((s, r) => s + r.v, 0) : 1 / P.R.reduce((s, r) => s + 1 / r.v, 0);
  const V = P.V != null ? P.V : P.I != null ? P.I * Rt : null, I = V != null ? V / Rt : null;
  const W = 640, ln = (x1, y1, x2, y2) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#1A1A1A" stroke-width="2"/>';
  let g = '';
  const bx = 60, top = 50, bot = 230, right = Math.max(380, 140 + n * 110);
  /* the battery on the left: long and short plates, + on the long one */
  const my = (top + bot) / 2;
  g += ln(bx, top, bx, my - 12) + ln(bx, my + 12, bx, bot);
  g += '<line x1="' + (bx - 18) + '" y1="' + (my - 12) + '" x2="' + (bx + 18) + '" y2="' + (my - 12) + '" stroke="#1A1A1A" stroke-width="2.4"/><line x1="' + (bx - 9) + '" y1="' + (my + 12) + '" x2="' + (bx + 9) + '" y2="' + (my + 12) + '" stroke="#1A1A1A" stroke-width="5"/>';
  g += fgT(bx - 34, my - 14, '+', 16) + fgT(bx + 24, my + 6, V != null ? fgR(V) + ' V' : 'V', 15, '#1565C0');
  if (P.mode === 'series') {
    const seg = (right - bx) / n;
    for (let i = 0; i < n; i++) { const xa = bx + i * seg, xb = xa + seg; g += fgZig(xa, top, xb, top) + fgT((xa + xb) / 2 - 30, top - 16, P.R[i].n + ' = ' + fgR(P.R[i].v) + ' Ω', 14); }
    g += ln(right, top, right, bot) + ln(bx, bot, right, bot);
  } else {
    g += ln(bx, top, right, top) + ln(bx, bot, right, bot);
    const seg = (right - bx - 60) / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) { const x = n === 1 ? right : bx + 60 + i * seg; g += '<circle cx="' + x + '" cy="' + top + '" r="3" fill="#1A1A1A"/><circle cx="' + x + '" cy="' + bot + '" r="3" fill="#1A1A1A"/>' + fgZig(x, top, x, bot) + fgT(x + 12, my + 5, P.R[i].n, 14) + fgT(x + 12, my + 22, fgR(P.R[i].v) + ' Ω', 13, '#37474F'); }
  }
  /* the numbers: total, current, and each resistor */
  let y = bot + 44, info = '';
  const line = (t, col) => { info += fgT(30, y, t, 16, col); y += 27; };
  line((P.mode === 'series' ? 'ต่ออนุกรม  R<tspan dy="5" font-size="11">รวม</tspan><tspan dy="-5"> = ' : 'ต่อขนาน  1/R<tspan dy="5" font-size="11">รวม</tspan><tspan dy="-5"> = ') + (P.mode === 'series' ? P.R.map((r) => fgR(r.v)).join(' + ') : P.R.map((r) => '1/' + fgR(r.v)).join(' + ')) + '  จึงได้ R</tspan><tspan dy="5" font-size="11">รวม</tspan><tspan dy="-5"> = ' + fgR(Rt) + ' Ω</tspan>', '#1A1A1A');
  if (I != null) {
    line('<tspan font-style="italic">I</tspan> = <tspan font-style="italic">V</tspan>/R<tspan dy="5" font-size="11">รวม</tspan><tspan dy="-5"> = ' + fgR(V) + '/' + fgR(Rt) + ' = ' + fgR(I) + ' A  กำลังรวม ' + fgR(V * I) + ' W</tspan>', '#1A1A1A');
    for (const r of P.R) {
      const Ii = P.mode === 'series' ? I : V / r.v, Vi = Ii * r.v;
      line(r.n + '  กระแส ' + fgR(Ii) + ' A  ความต่างศักย์ ' + fgR(Vi) + ' V  กำลัง ' + fgR(Vi * Ii) + ' W', '#37474F');
    }
    line(P.mode === 'series' ? 'อนุกรม กระแสเท่ากันทุกตัว ความต่างศักย์รวมกันเท่ากับของแบตเตอรี่' : 'ขนาน ความต่างศักย์เท่ากันทุกตัว กระแสรวมกันเท่ากับกระแสจากแบตเตอรี่', '#78909C');
  } else line('บอกความต่างศักย์ของแบตเตอรี่หรือกระแส เพื่อคำนวณกระแสและความต่างศักย์ของแต่ละตัว', '#78909C');
  return { svg: fgSvg(Math.max(W, right + 60), y, g + info), note: 'วงจร' + (P.mode === 'series' ? 'อนุกรม' : 'ขนาน') + ' คำนวณในเครื่อง' };
}

/* ----- forces from one point ----- */
const FG_DIR = [[/ขวา|ตะวันออก|\bright\b|\beast\b|\+x/i, 0], [/ซ้าย|ตะวันตก|\bleft\b|\bwest\b|-x/i, 180], [/ขึ้น|เหนือ|\bup\b|\bnorth\b|\+y/i, 90], [/ลง|ใต้|\bdown\b|\bsouth\b|-y/i, 270]];
function fgForceParse(t) {
  const F = [], re = new RegExp('\\b([FfWwTN])\\s*_?\\s*(\\d*)\\s*=\\s*' + FG_NUM + '\\s*(k)?\\s*(?:N|นิวตัน)\\b', 'g'); let m;
  const hits = []; while ((m = re.exec(t))) hits.push({ m, at: m.index, end: re.lastIndex });
  for (let i = 0; i < hits.length; i++) {
    const { m: h, end } = hits[i], rest = t.slice(end, i + 1 < hits.length ? hits[i + 1].at : t.length);
    let ang = null; const am = rest.match(new RegExp('^[^0-9]{0,24}?' + FG_NUM + '\\s*(?:°|องศา|deg)'));
    if (am) ang = +am[1];
    if (ang == null) for (const [r, v] of FG_DIR) if (r.test(rest.slice(0, 30))) { ang = v; break; }
    if (ang == null) return null;
    F.push({ n: h[1].toUpperCase() + (h[2] || ''), v: +h[3] * (h[4] ? 1000 : 1), ang });
  }
  return F.length >= 2 && F.length <= 6 ? F : null;
}
/* the name of a vector with the half-arrow over it, as written by hand */
function fgVecName(x, y, name, col) {
  const base = name.replace(/\d+$/, ''), sub = name.slice(base.length), w = 11 + (sub ? 7 * sub.length : 0);
  return fgT(x, y, '<tspan font-style="italic">' + fgEsc(base) + '</tspan>' + (sub ? '<tspan dy="5" font-size="12">' + sub + '</tspan>' : ''), 17, col)
    + '<path d="M' + (x + 1) + ',' + (y - 17) + ' L' + (x + w) + ',' + (y - 17) + ' L' + (x + w - 5) + ',' + (y - 21) + '" fill="none" stroke="' + col + '" stroke-width="1.4"/>';
}
function fgArrow(x1, y1, x2, y2, col, dash) {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 11;
  return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + (x2 - Math.cos(a) * h * 0.6).toFixed(1) + '" y2="' + (y2 - Math.sin(a) * h * 0.6).toFixed(1) + '" stroke="' + col + '" stroke-width="2.6"' + (dash ? ' stroke-dasharray="7 5"' : '') + '/>'
    + '<polygon points="' + x2.toFixed(1) + ',' + y2.toFixed(1) + ' ' + (x2 - h * Math.cos(a - 0.4)).toFixed(1) + ',' + (y2 - h * Math.sin(a - 0.4)).toFixed(1) + ' ' + (x2 - h * Math.cos(a + 0.4)).toFixed(1) + ',' + (y2 - h * Math.sin(a + 0.4)).toFixed(1) + '" fill="' + col + '"/>';
}
function fgForceFig(F) {
  let sx = 0, sy = 0; for (const f of F) { sx += f.v * Math.cos(f.ang * D2R); sy += f.v * Math.sin(f.ang * D2R); }
  const R = Math.hypot(sx, sy), th = (Math.atan2(sy, sx) / D2R + 360) % 360, zero = R < 1e-9 * Math.max(...F.map((f) => f.v));
  const big = Math.max(R, ...F.map((f) => f.v)), sc = 130 / big, cx = 200, cy = 190, cols = ['#1565C0', '#2E7D32', '#6A1B9A', '#EF6C00', '#00838F', '#5D4037'];
  let g = '<line x1="40" y1="' + cy + '" x2="360" y2="' + cy + '" stroke="#CFD8DC" stroke-width="1"/><line x1="' + cx + '" y1="30" x2="' + cx + '" y2="350" stroke="#CFD8DC" stroke-width="1"/>' + fgT(362, cy + 5, 'x', 13, '#90A4AE') + fgT(cx + 4, 38, 'y', 13, '#90A4AE');
  F.forEach((f, i) => { const ex = cx + f.v * sc * Math.cos(f.ang * D2R), ey = cy - f.v * sc * Math.sin(f.ang * D2R), col = cols[i % cols.length]; g += fgArrow(cx, cy, ex, ey, col) + fgVecName(ex + (Math.cos(f.ang * D2R) >= 0 ? 6 : -30), ey + (Math.sin(f.ang * D2R) > 0 ? -6 : 20), f.n, col); });
  if (!zero) { const ex = cx + R * sc * Math.cos(th * D2R), ey = cy - R * sc * Math.sin(th * D2R); g += fgArrow(cx, cy, ex, ey, '#C62828', true) + fgVecName(ex + (Math.cos(th * D2R) >= 0 ? 6 : -28), ey + (Math.sin(th * D2R) > 0 ? -6 : 20), 'R', '#C62828'); }
  g += '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#1A1A1A"/>';
  let y = 50, info = ''; const L = 400;
  const line = (t, col, sz) => { info += fgT(L, y, t, sz || 15, col); y += 26; };
  line('แตกแรงเป็นองค์ประกอบ', '#546E7A');
  for (const f of F) line(f.n + ' = ' + fgR(f.v) + ' N ที่ ' + fgR(f.ang) + '°', '#37474F');
  line('Σ<tspan font-style="italic">F</tspan><tspan dy="5" font-size="11">x</tspan><tspan dy="-5"> = ' + fgR(Math.abs(sx) < 1e-9 ? 0 : sx) + ' N</tspan>', '#1A1A1A');
  line('Σ<tspan font-style="italic">F</tspan><tspan dy="5" font-size="11">y</tspan><tspan dy="-5"> = ' + fgR(Math.abs(sy) < 1e-9 ? 0 : sy) + ' N</tspan>', '#1A1A1A');
  if (zero) line('แรงลัพธ์เป็นศูนย์ วัตถุอยู่ในสมดุล', '#2E7D32', 16);
  else { line('แรงลัพธ์ ' + fgR(R) + ' N', '#C62828', 17); line('ทิศ ' + fgR(th) + '° จากแกน +x', '#C62828', 16); }
  const H = Math.max(y, 370) + 18;
  info += fgT(20, H - 8, 'มุมวัดทวนเข็มนาฬิกาจากแกน +x ความยาวลูกศรตามขนาดแรง', 12, '#78909C');
  return { svg: fgSvg(640, H, g + info), note: zero ? 'แรงลัพธ์เป็นศูนย์ คำนวณในเครื่อง' : 'แรงลัพธ์ ' + fgR(R) + ' N คำนวณในเครื่อง' };
}

/* the figure for a piece of text, or null when it is none of these (the AI makes the figure as before) */
function fgFigure(text) {
  const t = fgClean(text); if (!t || t.length > 600) return null;
  const c = fgCircParse(t); if (c) return fgCircFig(c);
  const f = fgForceParse(t); if (f) return fgForceFig(f);
  const p = fgTriParse(t); if (p) return fgTriFig(p);
  return null;
}

