/* BURIN part: story (loaded when first used) */
/* ---------- a storyboard from a drawing or from what was written (task 8.21, switched off with "story" in flags.json).
   The goal: what the writer imagines becomes real. Circle a sketch and the words around it, tap "สตอรี่บอร์ด":
     with AI: the AI reads what was drawn and written (never the subject of the notebook) and tells it as panels in story
     order, each with what the picture shows, a caption, words a character says and the camera (size of shot and angle).
     It does not draw pictures: it composes each scene from parts the app draws itself (a stick person, a cup, steam,
     arrows of hot and cold air, heat radiated, a thermometer, a clock, plain shapes, and the writer's own drawing), in a
     frame of 160 by 90 seen whole, with where the camera looks. The app frames each shot from its size and that point,
     so changing the shot in the sheet reframes the picture at once. What a rule of science decides is worked out here,
     not by the AI: a hot thing cooling (Newton's law of cooling, T = Ta + (T0 - Ta) e^(-kt)) gives the temperature at
     each panel's time ({T} in the words, T on a thermometer).
     without AI: typed lines or paragraphs become panels (words in quotes are what a character says) and the circled
     drawing is the first picture; panels can be added, and everything typed in.
   The sheet (sbEdit): every panel can be changed (picture, caption, words, shot, angle), moved, removed, or added.
   The page: a storyboard is a picture box (type 'svg') whose picture is the whole sheet drawn once, so older versions of
   the app, the live room, exports and other devices show it as it is; the story itself is kept in the new field
   it.story. The box has two buttons, เล่น and แก้ไข.
   The animation (sbPlay, "ต่อเป็นแอนิเมชัน"): the panels play in turn with the camera easing in, steam rising, the air
   flowing along its arrows, the heat spreading out, the thermometer and the clock moving with the story's time, the words
   below as subtitles and what is said in a speech bubble ---------- */
const SB = { cur: null, item: null, play: null, busy: false, mt: null };
const SB_FW = 160, SB_FH = 90;
const SB_SHOT = [['wide', 'ภาพกว้าง', 1], ['medium', 'ภาพกลาง', 1.45], ['close', 'ภาพใกล้', 2.1], ['xclose', 'ภาพใกล้มาก', 3]];
const SB_ANGLE = [['eye', 'ระดับสายตา'], ['high', 'มุมสูง'], ['low', 'มุมต่ำ'], ['side', 'ด้านข้าง'], ['top', 'มุมบน']];
const SB_COL = { hot: '#D9480F', cold: '#1C7ED6', ink: '#1F2933', gray: '#868E96', green: '#2B8A3E', brown: '#7A4A24', yellow: '#E8A400' };
const SB_K = 0.09; /* a cup of coffee in a room, per minute (a mug without a lid cools 80 to about 50 °C in 10 minutes) */
const SB_FONT = 'Sarabun, Thonburi, sans-serif';

/* ----- small helpers ----- */
const sbCol = (c, d) => (SB_COL[c] || (/^#[0-9a-f]{6}$/i.test(c || '') ? c : d || SB_COL.ink));
const sbNum = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
function sbRand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sbF = (v) => Math.round(v * 100) / 100;
/* a line through points with a hand's slight wobble (the same every time for the same element) */
function sbLine(pts, rnd, amp, close) {
  const a = amp == null ? 0.28 : amp;
  return pts.map((p, i) => (i ? 'L' : 'M') + sbF(p[0] + (rnd() - 0.5) * a) + ' ' + sbF(p[1] + (rnd() - 0.5) * a)).join(' ') + (close ? ' Z' : '');
}
function sbArc(cx, cy, r, a0, a1, n) { const out = []; n = n || 20; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; }
const sbCircle = (cx, cy, r, rnd) => sbLine(sbArc(cx, cy, r, 0, Math.PI * 2, 26), rnd, r * 0.06, true);

/* ----- the science the app works out itself ----- */
function sbTemp(st, t) {
  const c = st && st.calc; if (!c || c.k !== 'cool') return null;
  const k = c.r > 0 ? c.r : SB_K, m = Math.max(0, +t || 0);
  return c.Ta + (c.T0 - c.Ta) * Math.exp(-k * m);
}
/* the words of a panel with {T} worked out (a number and its unit kept together with a no-break space) */
function sbWords(st, p, s) {
  const T = sbTemp(st, p.t);
  return String(s || '').replace(/\{T\}/g, T == null ? '' : Math.round(T) + ' °C').replace(/(\d)\s+(°C|องศา|นาที|วินาที|ชั่วโมง|เมตร|กิโลกรัม|%)/g, '$1 $2');
}

/* ----- one panel as drawing operations: { d, s stroke, f fill, w width, dash, o opacity } or { t text, x, y, z size, c colour, a anchor } -----
   tm: seconds into the panel (0 for the still picture), ph: 0 to 1 through the panel, prev: the panel before (for what moves on) */
function sbOps(st, p, tm, ph, prev) {
  const ops = [], els = p.draw || [];
  const T = sbTemp(st, p.t), T0 = prev ? sbTemp(st, prev.t) : T, ease = ph == null ? 1 : ph < 0.15 ? 0 : ph > 0.85 ? 1 : (1 - Math.cos((ph - 0.15) / 0.7 * Math.PI)) / 2;
  const Tnow = T == null ? null : T0 == null ? T : T0 + (T - T0) * ease;
  const anim = tm > 0;
  els.forEach((e, idx) => {
    const rnd = sbRand(idx * 7919 + (e.k || '').length * 131 + 17), col = sbCol(e.c);
    const lw = 0.85;
    switch (e.k) {
      case 'ground': ops.push({ d: sbLine([[0, e.y], [SB_FW, e.y]], rnd, 0.4), s: SB_COL.ink, w: lw });
        for (let x = 6; x < SB_FW; x += 9) ops.push({ d: sbLine([[x, e.y + 0.6], [x - 3, e.y + 3.2]], rnd, 0.2), s: SB_COL.gray, w: 0.5 }); break;
      case 'table': { const a = Math.min(e.x1, e.x2), b = Math.max(e.x1, e.x2);
        ops.push({ d: sbLine([[a, e.y], [b, e.y]], rnd), s: SB_COL.brown, w: 1.4 });
        ops.push({ d: sbLine([[a + 3, e.y], [a + 3, e.y + 12]], rnd) + ' ' + sbLine([[b - 3, e.y], [b - 3, e.y + 12]], rnd), s: SB_COL.brown, w: 1 }); break; }
      case 'sun': { const r = e.r || 8, spin = anim ? tm * 0.4 : 0;
        ops.push({ d: sbCircle(e.x, e.y, r, rnd), s: SB_COL.yellow, f: '#FFE8A3', w: lw });
        for (let i = 0; i < 10; i++) { const a = spin + i * Math.PI / 5; ops.push({ d: sbLine([[e.x + Math.cos(a) * r * 1.3, e.y + Math.sin(a) * r * 1.3], [e.x + Math.cos(a) * r * 1.75, e.y + Math.sin(a) * r * 1.75]], rnd, 0.2), s: SB_COL.yellow, w: 0.8 }); } break; }
      case 'person': ops.push(...sbPerson(e, rnd, tm)); break;
      case 'cup': ops.push(...sbCup(e, rnd)); break;
      case 'steam': ops.push(...sbSteam(e, idx, tm, anim)); break;
      case 'arrow': ops.push(...sbArrow(e, rnd, col, tm, anim)); break;
      case 'waves': ops.push(...sbWaves(e, idx, tm, anim)); break;
      case 'thermo': ops.push(...sbThermo(e, rnd, e.v === 'T' ? Tnow : sbNum(e.v, null))); break;
      case 'clock': { const m0 = prev && prev.t != null ? prev.t : p.t, m = e.m === 'T' || e.m == null ? (p.t == null ? 0 : m0 + (p.t - m0) * ease) : sbNum(e.m, 0); ops.push(...sbClock(e, rnd, m)); break; }
      case 'label': ops.push({ t: sbWords(st, p, e.text), x: e.x, y: e.y, z: e.z || 6, c: col, a: 'middle' }); break;
      case 'circle': ops.push({ d: sbCircle(e.x, e.y, e.r || 5, rnd), s: col, f: e.fill ? sbCol(e.fill) : null, w: lw }); break;
      case 'rect': ops.push({ d: sbLine([[e.x, e.y], [e.x + e.w, e.y], [e.x + e.w, e.y + e.h], [e.x, e.y + e.h]], rnd, 0.3, true), s: col, f: e.fill ? sbCol(e.fill) : null, w: lw }); break;
      case 'line': ops.push({ d: sbLine([[e.x1, e.y1], [e.x2, e.y2]], rnd), s: col, w: lw }); break;
      case 'mine': ops.push(...sbMine(st, e)); break;
      default: break;
    }
  });
  return ops;
}
function sbPerson(e, rnd, tm) {
  const h = e.h || 45, x = e.x, y = e.y, f = e.face === 'left' ? -1 : 1, r = h * 0.11, pose = e.pose || 'stand';
  const bob = tm > 0 ? Math.sin(tm * 2.2) * h * 0.008 : 0, sit = pose === 'sit';
  const hipY = (sit ? y - h * 0.28 : y - h * 0.45) + bob, headY = (sit ? y - h * 0.83 : y - h + r) + bob, neckY = headY + r, shY = neckY + h * 0.06;
  const ops = [], W = 0.95, C = SB_COL.ink;
  ops.push({ d: sbCircle(x, headY, r, rnd), s: C, f: '#FFFFFF', w: W });
  /* the face looks the way the person faces */
  ops.push({ d: sbCircle(x + f * r * 0.35, headY - r * 0.15, r * 0.09, rnd), s: C, f: C, w: 0.4 });
  ops.push({ d: sbLine(sbArc(x + f * r * 0.25, headY + r * 0.15, r * 0.38, 0.25 * Math.PI, 0.75 * Math.PI, 6), rnd, 0.05), s: C, w: 0.55 });
  ops.push({ d: sbLine([[x, neckY], [x, hipY]], rnd), s: C, w: W });
  /* legs */
  if (sit) ops.push({ d: sbLine([[x, hipY], [x + f * h * 0.2, hipY], [x + f * h * 0.22, y]], rnd), s: C, w: W }, { d: sbLine([[x, hipY], [x + f * h * 0.16, hipY + 1], [x + f * h * 0.15, y]], rnd), s: C, w: W });
  else {
    const sw = pose === 'walk' ? Math.sin(tm * 5) * h * 0.12 : h * 0.12;
    ops.push({ d: sbLine([[x, hipY], [x - sw, y]], rnd), s: C, w: W }, { d: sbLine([[x, hipY], [x + sw, y]], rnd), s: C, w: W });
  }
  /* arms: the back one down, the front one as the pose says */
  ops.push({ d: sbLine([[x, shY], [x - f * h * 0.12, shY + h * 0.14], [x - f * h * 0.15, shY + h * 0.27]], rnd), s: C, w: W });
  let hand;
  if (pose === 'hold') hand = [[x + f * h * 0.1, shY + h * 0.15], [x + f * h * 0.26, shY + h * 0.13]];
  else if (pose === 'drink') hand = [[x + f * h * 0.17, shY + h * 0.08], [x + f * h * 0.13, headY + r * 0.6]];
  else if (pose === 'point') hand = [[x + f * h * 0.17, shY - h * 0.02], [x + f * h * 0.33, shY - h * 0.08]];
  else if (pose === 'wave') { const a = tm > 0 ? Math.sin(tm * 6) * 0.35 : 0; hand = [[x + f * h * 0.14, shY - h * 0.08], [x + f * h * (0.18 + 0.1 * Math.sin(a)), shY - h * 0.26]]; }
  else hand = [[x + f * h * 0.12, shY + h * 0.14], [x + f * h * 0.15, shY + h * 0.27]];
  ops.push({ d: sbLine([[x, shY]].concat(hand), rnd), s: C, w: W });
  return ops;
}
function sbCup(e, rnd) {
  const w = e.w || 14, x = e.x, y = e.y, h = w * 0.85, hot = e.hot !== false;
  const ops = [];
  ops.push({ d: sbLine([[x - w / 2, y - h], [x - w * 0.42, y], [x + w * 0.42, y], [x + w / 2, y - h]], rnd, 0.25, true), s: SB_COL.ink, f: '#FFFFFF', w: 0.9 });
  ops.push({ d: sbLine(sbArc(x, y - h, w / 2, 0, Math.PI * 2, 18), rnd, 0.1, true), s: SB_COL.ink, f: hot ? '#8B5A2B' : '#C9A27E', w: 0.6, sy: 0.22, cy: y - h });
  ops.push({ d: sbLine(sbArc(x + w * 0.5, y - h * 0.55, h * 0.24, -Math.PI / 2, Math.PI / 2, 10), rnd, 0.15), s: SB_COL.ink, w: 0.9 });
  return ops;
}
function sbSteam(e, idx, tm, anim) {
  const w = e.w || 12, ops = [], H = w * 1.6 + 6;
  for (let i = 0; i < 3; i++) {
    const x0 = e.x + (i - 1) * w * 0.32, rise = anim ? ((tm * 0.35 + i / 3) % 1) : 0.15 + i * 0.12, op = anim ? Math.sin(Math.PI * rise) : 0.85;
    const y0 = e.y - 1 - rise * H * 0.45, pts = [];
    for (let s = 0; s <= 14; s++) { const u = s / 14; pts.push([x0 + Math.sin(u * Math.PI * 2 + i * 1.7 + (anim ? tm * 2.4 : 0)) * w * 0.12, y0 - u * H * 0.7]); }
    ops.push({ d: sbLine(pts, sbRand(idx * 31 + i), 0.15), s: SB_COL.gray, w: 0.8, o: Math.max(0, Math.min(1, op)) * 0.85 });
  }
  return ops;
}
function sbArrowPts(e) {
  const x1 = e.x1, y1 = e.y1, x2 = e.x2, y2 = e.y2, L = Math.hypot(x2 - x1, y2 - y1) || 1, b = e.b || 0;
  const mx = (x1 + x2) / 2 - (y2 - y1) / L * b * L * 0.4, my = (y1 + y2) / 2 + (x2 - x1) / L * b * L * 0.4, pts = [];
  for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push([(1 - u) * (1 - u) * x1 + 2 * u * (1 - u) * mx + u * u * x2, (1 - u) * (1 - u) * y1 + 2 * u * (1 - u) * my + u * u * y2]); }
  return pts;
}
function sbArrow(e, rnd, col, tm, anim) {
  const pts = sbArrowPts(e), n = pts.length, a = pts[n - 1], b = pts[n - 3], ang = Math.atan2(a[1] - b[1], a[0] - b[0]), hl = 3.2;
  return [{ d: sbLine(pts, rnd, 0.2), s: col, w: 1.15, dash: anim ? [3.2, 2] : null, off: anim ? -tm * 9 : 0 },
    { d: sbLine([[a[0] - hl * Math.cos(ang - 0.45), a[1] - hl * Math.sin(ang - 0.45)], a, [a[0] - hl * Math.cos(ang + 0.45), a[1] - hl * Math.sin(ang + 0.45)]], rnd, 0.1), s: col, w: 1.15 }];
}
function sbWaves(e, idx, tm, anim) {
  const r = e.r || 10, ops = [], n = 8;
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n + 0.2, out = anim ? ((tm * 0.6 + (i % 2) * 0.5) % 1) : 0.4, r0 = r + 1 + out * 5, len = 7, pts = [];
    for (let s = 0; s <= 12; s++) { const u = s / 12, rr = r0 + u * len, wig = Math.sin(u * Math.PI * 3 + (anim ? -tm * 8 : 0)) * 0.9; pts.push([e.x + Math.cos(a) * rr - Math.sin(a) * wig, e.y + Math.sin(a) * rr + Math.cos(a) * wig]); }
    ops.push({ d: sbLine(pts, sbRand(idx * 53 + i), 0.05), s: SB_COL.hot, w: 0.75, o: anim ? 0.35 + 0.65 * Math.sin(Math.PI * out) : 0.9 });
  }
  return ops;
}
function sbThermo(e, rnd, T) {
  const h = e.h || 26, x = e.x, y = e.y, br = h * 0.13, tw = br * 0.9, top = y - h, ops = [], lvl = T == null ? 0.5 : Math.max(0, Math.min(1, T / 100));
  ops.push({ d: sbLine([[x - tw / 2, y - br], [x - tw / 2, top + tw / 2]].concat(sbArc(x, top + tw / 2, tw / 2, Math.PI, Math.PI * 2, 8)).concat([[x + tw / 2, y - br]]), rnd, 0.1), s: SB_COL.ink, f: '#FFFFFF', w: 0.75 });
  const fy = y - br - (h - br - tw / 2) * lvl;
  ops.push({ d: 'M' + sbF(x - tw * 0.22) + ' ' + sbF(y - br) + ' L' + sbF(x - tw * 0.22) + ' ' + sbF(fy) + ' L' + sbF(x + tw * 0.22) + ' ' + sbF(fy) + ' L' + sbF(x + tw * 0.22) + ' ' + sbF(y - br) + ' Z', f: '#E03131' });
  ops.push({ d: sbCircle(x, y, br, rnd), s: SB_COL.ink, f: '#E03131', w: 0.75 });
  for (let i = 1; i < 5; i++) { const ty = y - br - (h - br - tw / 2) * i / 5; ops.push({ d: 'M' + sbF(x + tw / 2) + ' ' + sbF(ty) + ' L' + sbF(x + tw / 2 + 1.4) + ' ' + sbF(ty), s: SB_COL.ink, w: 0.4 }); }
  if (T != null) ops.push({ t: Math.round(T) + ' °C', x: x + tw / 2 + 2.5, y: fy + 1.6, z: Math.max(4.2, h * 0.17), c: '#C92A2A', a: 'start', b: 1 });
  return ops;
}
function sbClock(e, rnd, m) {
  const r = e.r || 8, ops = [{ d: sbCircle(e.x, e.y, r, rnd), s: SB_COL.ink, f: '#FFFFFF', w: 0.8 }];
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ops.push({ d: 'M' + sbF(e.x + Math.cos(a) * r * 0.82) + ' ' + sbF(e.y + Math.sin(a) * r * 0.82) + ' L' + sbF(e.x + Math.cos(a) * r * 0.95) + ' ' + sbF(e.y + Math.sin(a) * r * 0.95), s: SB_COL.ink, w: 0.4 }); }
  const am = (m / 60) * Math.PI * 2 - Math.PI / 2, ah = ((9 * 60 + m) / 720) * Math.PI * 2 - Math.PI / 2;
  ops.push({ d: 'M' + sbF(e.x) + ' ' + sbF(e.y) + ' L' + sbF(e.x + Math.cos(am) * r * 0.78) + ' ' + sbF(e.y + Math.sin(am) * r * 0.78), s: SB_COL.cold, w: 0.75 });
  ops.push({ d: 'M' + sbF(e.x) + ' ' + sbF(e.y) + ' L' + sbF(e.x + Math.cos(ah) * r * 0.5) + ' ' + sbF(e.y + Math.sin(ah) * r * 0.5), s: SB_COL.ink, w: 1 });
  return ops;
}
/* the writer's own drawing, fitted to a width */
function sbMine(st, e) {
  const ink = st && st.ink; if (!ink || !ink.p || !ink.p.length) return [];
  const k = (e.w || 60) / (ink.w || 1), ops = [];
  for (const q of ink.p) ops.push({ d: q[0], s: q[1] || SB_COL.ink, w: Math.max(0.35, (q[2] || 3) * k), tf: [k, e.x, e.y] });
  return ops;
}

/* ----- the camera: the part of the frame the shot shows, looking at the focus ----- */
function sbView(p) {
  const z = (SB_SHOT.find((s) => s[0] === p.shot) || SB_SHOT[0])[2], w = SB_FW / z, h = SB_FH / z;
  const f = p.focus || [SB_FW / 2, SB_FH / 2];
  return [Math.max(0, Math.min(SB_FW - w, f[0] - w / 2)), Math.max(0, Math.min(SB_FH - h, f[1] - h / 2)), w, h];
}
/* where the first person's head is, on the frame after the camera (the speech bubble goes by it) */
function sbHead(p, v) {
  const e = (p.draw || []).find((x) => x.k === 'person'); if (!e) return null;
  const h = e.h || 45, hx = e.x, hy = e.y - h * 1.02;
  return [(hx - v[0]) / v[2] * SB_FW, (hy - v[1]) / v[3] * SB_FH, e.face === 'left' ? -1 : 1];
}

/* ----- Thai words broken into lines at word boundaries only (a number with its unit, a name kept whole) ----- */
let SB_SEG = null, SB_MC = null;
function sbMeasure(t, px) {
  if (!SB_MC) SB_MC = document.createElement('canvas').getContext('2d');
  SB_MC.font = px + 'px ' + SB_FONT; return SB_MC.measureText(t).width;
}
function sbWrap(text, px, maxW, maxLines) {
  if (SB_SEG === null) { try { SB_SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : false; } catch (e) { SB_SEG = false; } }
  const out = [];
  for (const para of String(text || '').split('\n')) {
    /* breaks are allowed at spaces (not the no-break ones) and, inside a long run, between words */
    const tokens = [];
    for (const ph of para.split(/ +/)) {
      if (!ph) continue;
      if (sbMeasure(ph, px) <= maxW || !SB_SEG) { tokens.push([ph, true]); continue; }
      const words = [...SB_SEG.segment(ph)].map((s) => s.segment); words.forEach((w, i) => tokens.push([w, i === words.length - 1]));
    }
    let line = '';
    tokens.forEach(([w], i) => {
      const sp = i > 0 && tokens[i - 1][1] ? ' ' : '', next = line ? line + sp + w : w;
      if (line && sbMeasure(next, px) > maxW) { out.push(line); line = w; } else line = next;
    });
    if (line) out.push(line);
  }
  if (maxLines && out.length > maxLines) { const cut = out.slice(0, maxLines); cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S{0,3}$/, '') + '...'; return cut; }
  return out;
}

/* ----- the panel's picture as SVG (the sheet, the page) ----- */
function sbOpsSvg(ops) {
  return ops.map((o) => {
    if (o.t != null) return '<text x="' + sbF(o.x) + '" y="' + sbF(o.y) + '" font-size="' + sbF(o.z) + '" fill="' + o.c + '" text-anchor="' + (o.a || 'middle') + '"' + (o.b ? ' font-weight="700"' : '') + ' font-family="' + SB_FONT + '">' + esc(o.t) + '</text>';
    const tf = o.tf ? ' transform="matrix(' + sbF(o.tf[0]) + ' 0 0 ' + sbF(o.tf[0]) + ' ' + sbF(o.tf[1]) + ' ' + sbF(o.tf[2]) + ')"' : o.sy ? ' transform="matrix(1 0 0 ' + o.sy + ' 0 ' + sbF(o.cy * (1 - o.sy)) + ')"' : '';
    const w = o.tf ? o.w / o.tf[0] : o.w;
    return '<path d="' + o.d + '"' + tf + ' fill="' + (o.f || 'none') + '"' + (o.s ? ' stroke="' + o.s + '" stroke-width="' + sbF(w || 1) + '" stroke-linecap="round" stroke-linejoin="round"' : '') + (o.o != null && o.o < 1 ? ' opacity="' + sbF(o.o) + '"' : '') + '/>';
  }).join('');
}
/* a speech bubble in frame units, by the head when there is a person, else at the top */
function sbBubble(text, head, z) {
  if (!text) return null;
  const px = 5.2 * z, maxW = 64 * z, lines = sbWrap(text, px, maxW, 3); if (!lines.length) return null;
  const tw = Math.max(...lines.map((l) => sbMeasure(l, px))) / z, bw = tw + 6, bh = lines.length * 6.6 + 3.6;
  let bx, by, tail = null;
  if (head) {
    bx = head[2] > 0 ? head[0] + 6 : head[0] - 6 - bw; by = head[1] - bh - 4;
    bx = Math.max(2, Math.min(SB_FW - bw - 2, bx)); by = Math.max(2, Math.min(SB_FH - bh - 2, by));
    const tx = Math.max(bx + 4, Math.min(bx + bw - 4, head[0] + head[2] * 3));
    tail = [[tx - 2.5, by + bh], [head[0] + head[2] * 1.5, head[1] - 1], [tx + 2.5, by + bh]];
  } else { bx = 4; by = 4; }
  return { x: bx, y: by, w: bw, h: bh, lines, tail };
}
function sbBubbleSvg(b) {
  if (!b) return '';
  let s = '<rect x="' + sbF(b.x) + '" y="' + sbF(b.y) + '" width="' + sbF(b.w) + '" height="' + sbF(b.h) + '" rx="3" fill="#FFFFFF" stroke="#1F2933" stroke-width="0.6"/>';
  if (b.tail) s += '<path d="M' + b.tail.map((q) => sbF(q[0]) + ' ' + sbF(q[1])).join(' L') + '" fill="#FFFFFF" stroke="#1F2933" stroke-width="0.6" stroke-linejoin="round"/><path d="M' + sbF(b.tail[0][0] + 0.5) + ' ' + sbF(b.tail[0][1]) + ' L' + sbF(b.tail[2][0] - 0.5) + ' ' + sbF(b.tail[2][1]) + '" stroke="#FFFFFF" stroke-width="1"/>';
  b.lines.forEach((l, i) => { s += '<text x="' + sbF(b.x + 3) + '" y="' + sbF(b.y + 6.4 + i * 6.6) + '" font-size="5.2" fill="#1F2933" font-family="' + SB_FONT + '">' + esc(l) + '</text>'; });
  return s;
}
const sbSayText = (st, p) => { const s = sbWords(st, p, p.say).trim(); return s.replace(/^[^:]{1,20}:\s*/, ''); };
/* the picture of one panel: a nested svg whose viewBox is the camera, then the bubble over it */
function sbPicSvg(st, p, x, y, w, prev) {
  const v = sbView(p), h = w * SB_FH / SB_FW, k = w / SB_FW;
  let s = '<svg x="' + sbF(x) + '" y="' + sbF(y) + '" width="' + sbF(w) + '" height="' + sbF(h) + '" viewBox="' + v.map(sbF).join(' ') + '" preserveAspectRatio="xMidYMid slice">'
    + '<rect x="0" y="0" width="' + SB_FW + '" height="' + SB_FH + '" fill="#FFFFFF"/>' + sbOpsSvg(sbOps(st, p, 0, null, prev)) + '</svg>';
  const b = sbBubble(sbSayText(st, p), sbHead(p, v), 1);
  if (b) s += '<g transform="matrix(' + sbF(k) + ' 0 0 ' + sbF(k) + ' ' + sbF(x) + ' ' + sbF(y) + ')">' + sbBubbleSvg(b) + '</g>';
  return s;
}
const sbShotName = (p) => (SB_SHOT.find((s) => s[0] === p.shot) || SB_SHOT[0])[1] + ' ' + (SB_ANGLE.find((s) => s[0] === p.ang) || SB_ANGLE[0])[1];
/* the whole sheet, drawn once for the page: a title, then the panels in rows */
function sbSheetSvg(st) {
  const P = st.panels, cols = P.length > 6 ? 3 : 2, W0 = 960, gap = 18, pw = (W0 - gap * (cols - 1)) / cols, ph = pw * SB_FH / SB_FW;
  const fs = cols === 3 ? 15 : 17, lh = fs * 1.45;
  let y = 0, s = '';
  const tl = sbWrap(st.title || 'สตอรี่บอร์ด', 30, W0 - 20, 2);
  tl.forEach((l, i) => { s += '<text x="0" y="' + (32 + i * 40) + '" font-size="30" font-weight="700" fill="#1F2933" font-family="' + SB_FONT + '">' + esc(l) + '</text>'; });
  y = 32 + (tl.length - 1) * 40 + 22;
  for (let r = 0; r * cols < P.length; r++) {
    const row = P.slice(r * cols, r * cols + cols), texts = row.map((p) => {
      const L = [];
      L.push({ t: sbShotName(p), c: '#5F6B7A', z: fs - 2 });
      for (const l of sbWrap(sbWords(st, p, p.cap), fs, pw - 4, 6)) L.push({ t: l, c: '#1F2933', z: fs });
      const say = sbWords(st, p, p.say).trim(); if (say) for (const l of sbWrap('บทพูด ' + say, fs, pw - 4, 3)) L.push({ t: l, c: '#2F4BB8', z: fs });
      return L;
    });
    const th = Math.max(...texts.map((L) => L.length)) * lh + 12;
    row.forEach((p, i) => {
      const x = i * (pw + gap), n = r * cols + i;
      s += '<rect x="' + sbF(x) + '" y="' + sbF(y) + '" width="' + sbF(pw) + '" height="' + sbF(ph) + '" fill="#FFFFFF"/>' + sbPicSvg(st, p, x, y, pw, P[n - 1]);
      s += '<rect x="' + sbF(x) + '" y="' + sbF(y) + '" width="' + sbF(pw) + '" height="' + sbF(ph) + '" fill="none" stroke="#1F2933" stroke-width="2" rx="4"/>';
      s += '<circle cx="' + sbF(x + 18) + '" cy="' + sbF(y + 18) + '" r="13" fill="#FFFFFF" stroke="#1F2933" stroke-width="2"/><text x="' + sbF(x + 18) + '" y="' + sbF(y + 23.5) + '" font-size="15" font-weight="700" fill="#1F2933" text-anchor="middle" font-family="' + SB_FONT + '">' + (n + 1) + '</text>';
      texts[i].forEach((l, j) => { s += '<text x="' + sbF(x + 2) + '" y="' + sbF(y + ph + 8 + (j + 1) * lh - lh * 0.25) + '" font-size="' + l.z + '" fill="' + l.c + '" font-family="' + SB_FONT + '">' + esc(l.t) + '</text>'; });
    });
    y += ph + th + gap;
  }
  const H0 = Math.ceil(y);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W0 + ' ' + H0 + '">' + s + '</svg>';
}

/* ----- what was circled ----- */
function sbInk(refs) {
  const list = refs.map(findStroke).filter((s) => s && s.p && s.k !== 'h' && s.k !== 'n');
  if (!list.length) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of list) { boxCache.delete(s); const b = sbox(s); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  const w = Math.max(4, x1 - x0), h = Math.max(4, y1 - y0), tol = Math.max(0.6, Math.max(w, h) / 400), p = [];
  let budget = 5000;
  for (const s of list) {
    const n = Math.floor(s.p.length / 3), pts = [];
    for (let i = 0; i < n; i++) pts.push([s.p[i * 3] / 10 - x0, s.p[i * 3 + 1] / 10 - y0]);
    const q = sbSimplify(pts, tol); if (budget - q.length < 0) break; budget -= q.length;
    p.push([q.length === 1 ? 'M' + sbF(q[0][0]) + ' ' + sbF(q[0][1]) + ' l0.2 0' : 'M' + q.map((a) => sbF(a[0]) + ' ' + sbF(a[1])).join(' L'), okHex(s.c) ? s.c : SB_COL.ink, Math.round((s.w || 3) * 10) / 10]);
  }
  return { w: Math.round(w), h: Math.round(h), p };
}
function sbSimplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1; const A = pts[a], B = pts[b], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - A[0]) * dy - (pts[i][1] - A[1]) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/* the writer's drawing in a frame: as large as fits, in the middle, standing on the ground */
function sbMineEl(ink) {
  const k = Math.min(140 / ink.w, 76 / ink.h), w = ink.w * k, h = ink.h * k;
  return { k: 'mine', x: sbF((SB_FW - w) / 2), y: sbF(Math.max(4, 82 - h)), w: sbF(w) };
}

/* ----- the AI's reply ----- */
function sbPrompt(typed, hasPic) {
  return 'Someone circled ' + (hasPic ? 'a drawing' + (typed ? ' and some words' : '') : 'some words') + ' on a notebook page and wants a storyboard from it: a short sequence of panels that tells it as a story, so what they imagine becomes real.' + (hasPic ? ' The drawing is in the attached image.' : '') + '\n'
    + (typed ? 'The words they typed:\n' + typed + '\n' : '')
    + 'Build the story ONLY from what they drew and wrote: the people, things, events and ideas in it. Do not change the topic and do not bring in anything the page does not suggest.\n'
    + 'Make 3 to 8 panels (about 5 is best) in story order. Reply in exactly this format and nothing else:\n'
    + '@@TITLE a short Thai title\n'
    + '@@CALC cool T0 Ta   (only when something hot cools down in the story: its start temperature and the temperature of the room in °C, from the page or sensible values. The app works out the temperature at each panel itself by Newton\'s law of cooling, so never compute it: write {T} in a caption or in what is said where the temperature of that moment goes, and T on a thermometer)\n'
    + 'Then for each panel:\n'
    + '@@PANEL\n@@PIC what the picture shows, short Thai\n@@CAP the caption (narration), one or two short Thai sentences\n@@SAY speaker: the Thai words a character says (leave this line out when nobody speaks)\n'
    + '@@SHOT wide, medium, close or xclose\n@@ANGLE eye, high, low, side or top\n@@FOCUS x y   (where the camera looks, in the frame below)\n@@TIME minutes since the story began (when time matters)\n'
    + '@@DRAW\nthe scene, one element per line, in a frame 160 wide and 90 tall, y grows downward, the floor at about y 82. Always draw the whole scene as a wide shot would show it, even for a close shot: the app frames the shot itself from SHOT and FOCUS. Elements:\n'
    + 'person x y h pose face   (x y where the feet are, h the height (about 50), pose stand hold drink point wave walk or sit, face left or right; with hold the hand is about 0.26 h in front at 0.3 h below the head)\n'
    + 'cup x y w hot   (x y the middle of its bottom, w its width; cold instead of hot for a cold drink)\nsteam x y w   (rising from x y, as wide as w)\n'
    + 'arrow x1 y1 x2 y2 colour bend   (colour hot for warm air or heat, cold for cool air, ink otherwise; bend from -1 to 1 curves it, 0 straight)\n'
    + 'waves x y r   (heat radiated all around a thing of radius r centred at x y)\nthermo x y h T   (a thermometer standing at x y, h tall; T or a number in °C)\nclock x y r T   (a clock; T shows the story time, or a number of minutes)\n'
    + 'table x1 x2 y\nground y\nsun x y r\nlabel x y size Thai words   (size about 6)\ncircle x y r colour / rect x y w h colour / line x1 y1 x2 y2 colour   (colour hot cold ink gray green brown yellow or #rrggbb)\n'
    + (hasPic ? 'mine x y w   (their own drawing, fitted to width w with its top left at x y; use it in a panel that shows just what they drew)\n' : '')
    + 'Prefer the named elements and keep each scene simple and clear, like a teacher\'s sketch; use the plain shapes for anything else. Put a thing held in a hand where the hand is.\n'
    + 'Write every word for the reader in Thai. Do not use emoji or arrow symbols in the words.';
}
const SB_KINDS = { person: ['x', 'y', 'h', 'pose', 'face'], cup: ['x', 'y', 'w', 'hot'], steam: ['x', 'y', 'w'], arrow: ['x1', 'y1', 'x2', 'y2', 'c', 'b'], waves: ['x', 'y', 'r'], thermo: ['x', 'y', 'h', 'v'], clock: ['x', 'y', 'r', 'm'], table: ['x1', 'x2', 'y'], ground: ['y'], sun: ['x', 'y', 'r'], label: ['x', 'y', 'z'], circle: ['x', 'y', 'r', 'c'], rect: ['x', 'y', 'w', 'h', 'c'], line: ['x1', 'y1', 'x2', 'y2', 'c'], mine: ['x', 'y', 'w'] };
const SB_WORDS = ['pose', 'face', 'hot', 'c', 'v', 'm'];
function sbEl(line, ink) {
  const a = String(line || '').trim().split(/\s+/), k = (a[0] || '').toLowerCase(), keys = SB_KINDS[k]; if (!keys) return null;
  if (k === 'mine' && !ink) return null;
  const e = { k };
  keys.forEach((key, i) => {
    const v = a[i + 1]; if (v == null) return;
    if (SB_WORDS.includes(key)) {
      if (key === 'hot') e.hot = !/cold/i.test(v);
      else if (key === 'v' || key === 'm') e[key] = /^T$/i.test(v) ? 'T' : sbNum(v, undefined);
      else if (key === 'pose') e.pose = ['stand', 'hold', 'drink', 'point', 'wave', 'walk', 'sit'].includes(v) ? v : 'stand';
      else if (key === 'face') e.face = v === 'left' ? 'left' : 'right';
      else e.c = v;
    } else { const n = sbNum(v, NaN); if (isFinite(n)) e[key] = Math.max(-40, Math.min(240, n)); }
  });
  if (k === 'label') e.text = sbClean(a.slice(4).join(' ')).slice(0, 60);
  if (k === 'arrow' && e.b != null) e.b = Math.max(-1, Math.min(1, e.b));
  const need = { person: ['x', 'y'], cup: ['x', 'y'], steam: ['x', 'y'], arrow: ['x1', 'y1', 'x2', 'y2'], waves: ['x', 'y'], thermo: ['x', 'y'], clock: ['x', 'y'], table: ['x1', 'x2', 'y'], ground: ['y'], sun: ['x', 'y'], label: ['x', 'y'], circle: ['x', 'y'], rect: ['x', 'y', 'w', 'h'], line: ['x1', 'y1', 'x2', 'y2'], mine: ['x', 'y', 'w'] }[k];
  if (need.some((q) => !isFinite(e[q]))) return null;
  if (k === 'label' && !e.text) return null;
  return e;
}
/* the words as the app shows them: no emoji or arrow symbols (the app's rule), single spaces */
function sbClean(s) { return String(s || '').replace(/[\u2190-\u21FF\u2794\u27A1\u2B05-\u2B07]/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim(); }
function sbParse(text, ink) {
  const st = { v: 1, title: '', panels: [] }; let cur = null;
  const one = sbClean;
  for (const s of sections(text)) {
    const val = s.arg + (s.text ? (s.arg ? '\n' : '') + s.text : '');
    if (s.key === 'TITLE') st.title = one(val).slice(0, 80);
    else if (s.key === 'CALC') { const a = val.split(/\s+/); if (/^cool/i.test(a[0] || '')) { const T0 = sbNum(a[1], NaN), Ta = sbNum(a[2], NaN), r = sbNum(a[3], NaN); if (isFinite(T0) && isFinite(Ta) && T0 > Ta && T0 < 1000) st.calc = Object.assign({ k: 'cool', T0, Ta }, isFinite(r) && r > 0 && r < 2 ? { r } : {}); } }
    else if (s.key === 'PANEL') { cur = { pic: '', cap: '', say: '', shot: 'wide', ang: 'eye', draw: [] }; st.panels.push(cur); }
    else if (!cur) continue;
    else if (s.key === 'PIC') cur.pic = one(val).slice(0, 200);
    else if (s.key === 'CAP') cur.cap = one(val).slice(0, 300);
    else if (s.key === 'SAY') { const v = one(val); cur.say = /^(ไม่มี|none|-)$/i.test(v) ? '' : v.slice(0, 160); }
    else if (s.key === 'SHOT') { const v = (val.split(/\s+/)[0] || '').toLowerCase(); cur.shot = SB_SHOT.some((x) => x[0] === v) ? v : 'wide'; }
    else if (s.key === 'ANGLE') { const v = (val.split(/\s+/)[0] || '').toLowerCase(); cur.ang = SB_ANGLE.some((x) => x[0] === v) ? v : 'eye'; }
    else if (s.key === 'FOCUS') { const a = val.split(/\s+/).map(Number); if (isFinite(a[0]) && isFinite(a[1])) cur.focus = [Math.max(0, Math.min(SB_FW, a[0])), Math.max(0, Math.min(SB_FH, a[1]))]; }
    else if (s.key === 'TIME') { const n = sbNum(val, NaN); if (isFinite(n) && n >= 0) cur.t = Math.min(100000, n); }
    else if (s.key === 'DRAW') { for (const ln of val.split('\n')) { const e = sbEl(ln, ink); if (e && cur.draw.length < 40) cur.draw.push(e); } }
  }
  st.panels = st.panels.filter((p) => p.cap || p.pic || p.draw.length).slice(0, 12);
  if (ink) st.ink = ink;
  return st;
}
/* ----- without AI: typed lines or paragraphs become panels; words in quotes are what is said ----- */
function sbLocal(typed, ink) {
  const text = String(typed || '').replace(/\r/g, '').replace(/^#+\s*/gm, '').trim();
  let parts = text ? text.split(/\n\s*\n/) : [];
  if (parts.length < 2 && text) parts = text.split('\n');
  parts = parts.map((x) => x.replace(/^\s*(?:ช่อง(?:ที่)?\s*\d+[.:)]?|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 8);
  let title = '';
  if (parts.length > 2 && parts[0].length <= 40 && !/[.!?"“]/.test(parts[0])) title = parts.shift();
  if (!parts.length) parts = [''];
  const shots = ['wide', 'medium', 'close', 'medium', 'wide'];
  const st = { v: 1, title: title || 'สตอรี่บอร์ด', panels: parts.map((t, i) => {
    let say = ''; const q = t.match(/["“]([^"”]{1,160})["”]/); if (q) { say = q[1].trim(); t = t.replace(q[0], ' ').replace(/\s+/g, ' ').trim(); }
    return { pic: '', cap: t.slice(0, 300), say, shot: shots[i % shots.length], ang: 'eye', draw: i === 0 && ink ? [sbMineEl(ink)] : [{ k: 'ground', y: 82 }] };
  }) };
  if (ink) st.ink = ink;
  return st;
}

/* ----- from the selection: the button "สตอรี่บอร์ด" ----- */
async function sbFromSel() {
  if (!S.sel || SB.busy) return;
  const refs = S.sel.strokes.slice(), box = S.sel.box.slice();
  const typed = S.sel.items.map(findItem).filter((it) => it && (!it.type || it.type === 'text')).map((it) => it.md || '').join('\n').trim().slice(0, 3000);
  const ink = refs.length ? sbInk(refs) : null;
  if (!ink && !typed) { toast('วงภาพร่างหรือข้อความที่จะทำเป็นสตอรี่บอร์ด', 3000); return; }
  if (!AI.anyReady()) {
    if (!typed) { clearSel(); sbEdit(null, sbLocal('', ink)); toast('ได้ช่องแรกจากภาพที่วาด เพิ่มช่องและพิมพ์คำบรรยายได้ ถ้าเชื่อม AI แอปจะแบ่งช่องและวาดฉากให้', 6000); return; }
    clearSel(); sbEdit(null, sbLocal(typed, ink)); toast('แบ่งช่องจากข้อความที่พิมพ์แล้ว แก้แต่ละช่องได้', 3500); return;
  }
  const task = ink ? 'read' : 'gen';
  if (!needAI(task)) return;
  const lim = AI.limits ? AI.limits(task) : null;
  const pic = ink && !(lim && !lim.images) ? await strokesBlob(refs.map(findStroke).filter(Boolean).map((s) => ({ s }))) : null;
  SB.busy = true; clearSel(); S.pending.push(box); drawSelBox();
  const ctl = new AbortController();
  const FW = floatWait('กำลังคิดสตอรี่บอร์ด', ['อ่านสิ่งที่วาดและเขียน', 'แบ่งเป็นช่องตามลำดับเรื่อง', 'วาดแต่ละช่อง'], () => ctl.abort(), box);
  setTimeout(() => FW.step(1), 1800);
  try {
    const res = await AI.run(task, sbPrompt(typed, !!pic), Object.assign({ signal: ctl.signal, maxTokens: 3500 }, pic ? { images: [pic.blob] } : {}));
    FW.step(2);
    const st = sbParse(res && res.text, ink);
    if (!st.panels.length) throw { code: 'empty_completion' };
    FW.close(); sbEdit(null, st);
  } catch (e) {
    FW.close();
    if (!(e && e.code === 'cancelled')) {
      toast((e && e.code === 'empty_completion' ? 'AI ตอบกลับมาไม่เป็นสตอรี่บอร์ด' : aiErr(e)) + (typed ? ' แบ่งช่องจากข้อความที่พิมพ์ให้แทน' : ' ลองอีกครั้ง'), 5000);
      if (typed) sbEdit(null, sbLocal(typed, ink));
    }
  } finally { S.pending = S.pending.filter((b) => b !== box); drawSelBox(); SB.busy = false; }
}

/* ----- the sheet: every panel can be changed ----- */
function sbStyle() {
  if ($('#sbStyle')) return;
  const s = document.createElement('style'); s.id = 'sbStyle';
  s.textContent = '#sbSheet .panel { max-width: 1100px; }\n#sbSheet .sbtitle { width: 100%; font: 700 20px/1.3 var(--ui); padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); margin-bottom: 10px; }\n'
    + '#sbGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }\n'
    + '#sbGrid .sbcard { border: 1px solid var(--line); border-radius: 14px; padding: 10px; background: var(--bg); display: flex; flex-direction: column; gap: 6px; }\n'
    + '#sbGrid .sbpic { position: relative; border-radius: 8px; overflow: hidden; border: 1.5px solid #1F2933; background: #FFFFFF; aspect-ratio: 16 / 9; }\n#sbGrid .sbpic svg { display: block; width: 100%; height: 100%; }\n'
    + '#sbGrid .sbnum { position: absolute; left: 6px; top: 6px; min-width: 24px; height: 24px; border-radius: 12px; background: #1F2933; color: #FFFFFF; font: 700 13px/24px var(--ui); text-align: center; }\n'
    + '#sbGrid label { font: 600 12px/1.3 var(--ui); color: var(--muted); display: flex; flex-direction: column; gap: 3px; }\n'
    + '#sbGrid textarea { font: 15px/1.45 var(--ui); padding: 6px 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); resize: vertical; min-height: 44px; word-break: normal; line-break: strict; }\n'
    + '#sbGrid .sbcam { display: flex; gap: 6px; }\n#sbGrid select { flex: 1; min-height: 40px; font: 14px var(--ui); border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); }\n'
    + '#sbGrid .sbtools { display: flex; gap: 6px; }\n#sbGrid .sbtools .btn { flex: 1; min-height: 40px; padding: 0 6px; }\n'
    + '#sbSheet .sbrow { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }\n#sbSheet .sbrow .btn { min-height: 44px; }\n#sbSheet .sbcalc { margin: 0 0 10px; }\n'
    + '#sbPlay { position: fixed; inset: 0; z-index: 9000; background: #101418; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 12px 16px; touch-action: manipulation; }\n'
    + '#sbPlay[hidden] { display: none; }\n#sbPlay canvas { display: block; background: #FFFFFF; border-radius: 10px; max-width: 100%; }\n'
    + '#sbPlay .sbcap { color: #F1F3F5; font: 500 20px/1.5 Sarabun, Thonburi, sans-serif; text-align: center; max-width: 900px; min-height: 3em; word-break: normal; line-break: strict; }\n'
    + '#sbPlay .sbctl { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; }\n#sbPlay .sbctl .btn { min-height: 44px; min-width: 88px; }\n#sbPlay .sbn { color: #ADB5BD; font: 14px var(--ui); min-width: 90px; text-align: center; }\n'
    + '@media (max-width: 620px) { #sbPlay .sbcap { font-size: 16px; } #sbGrid { grid-template-columns: 1fr; } }';
  document.head.appendChild(s);
}
function sbSheet() {
  let sh = $('#sbSheet'); if (sh) return sh;
  sbStyle();
  sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'sbSheet'; sh.hidden = true;
  sh.innerHTML = '<div class="panel wide" role="dialog" aria-label="สตอรี่บอร์ด"><div class="histtop"><h2>สตอรี่บอร์ด</h2><button class="btn" id="bSbClose" type="button">ปิด</button></div>'
    + '<input class="sbtitle" id="sbTitle" aria-label="ชื่อเรื่อง" maxlength="80"><div class="note sbcalc" id="sbCalc" hidden></div><div id="sbGrid"></div>'
    + '<div class="sbrow"><button class="btn" id="bSbAdd" type="button">เพิ่มช่อง</button><button class="btn" id="bSbPlay" type="button">ต่อเป็นแอนิเมชัน</button><button class="btn solid" id="bSbPut" type="button">วางเป็นหน้าใหม่</button></div></div>';
  document.body.appendChild(sh);
  sh.addEventListener('click', (e) => { if (e.target === sh) sbClose(); });
  $('#bSbClose').onclick = () => sbClose();
  $('#sbTitle').oninput = (e) => { if (SB.cur) SB.cur.title = e.target.value; };
  $('#bSbAdd').onclick = () => { const P = SB.cur.panels; if (P.length >= 12) { toast('สตอรี่บอร์ดหนึ่งเรื่องมีได้ 12 ช่อง', 3000); return; } const last = P[P.length - 1]; P.push({ pic: '', cap: '', say: '', shot: 'wide', ang: 'eye', draw: last ? clone(last.draw) : [{ k: 'ground', y: 82 }], focus: last && last.focus ? last.focus.slice() : undefined, t: last ? last.t : undefined }); sbCards(); const ta = $('#sbGrid').lastElementChild.querySelector('textarea[data-f="cap"]'); if (ta) ta.focus(); };
  $('#bSbPlay').onclick = () => sbPlay(null, SB.cur);
  $('#bSbPut').onclick = () => sbPut();
  return sh;
}
function sbClose() { const sh = $('#sbSheet'); if (sh) sh.hidden = true; SB.cur = null; SB.item = null; }
/* open the sheet: a story just made (st), or the storyboard box with that id on this page */
function sbEdit(id, st) {
  if (id) { const it = findItem(id); if (!it || !it.story) return; SB.item = id; SB.cur = clone(it.story); }
  else { SB.item = null; SB.cur = st; }
  if (!SB.cur || !Array.isArray(SB.cur.panels)) return;
  const sh = sbSheet(); closeSheets(); sh.hidden = false;
  $('#sbTitle').value = SB.cur.title || '';
  $('#bSbPut').textContent = SB.item ? 'บันทึกในหน้า' : 'วางเป็นหน้าใหม่';
  const c = SB.cur.calc;
  $('#sbCalc').hidden = !c;
  if (c) $('#sbCalc').innerHTML = bdPhSb('อุณหภูมิในแต่ละช่อง แอปคำนวณเอง ตามกฎการเย็นตัวของนิวตัน เริ่ม ' + Math.round(c.T0) + '\u00A0°C ห้อง ' + Math.round(c.Ta) + '\u00A0°C {T} ในคำบรรยาย คือ อุณหภูมิของช่องนั้น แก้เวลาได้ที่ช่อง นาทีที่');
  sbCards();
}
function bdPhSb(t) { return String(t).split(/ (?!ๆ)/).map((w) => '<span class="nowrap">' + esc(w) + '</span>').join(' '); }
function sbCardPic(i) {
  const st = SB.cur, p = st.panels[i];
  return '<svg viewBox="0 0 ' + SB_FW + ' ' + SB_FH + '" xmlns="http://www.w3.org/2000/svg">' + sbPicSvg(st, p, 0, 0, SB_FW, st.panels[i - 1]) + '</svg>';
}
function sbCards() {
  const g = $('#sbGrid'), st = SB.cur; if (!g || !st) return;
  const opt = (list, v) => list.map((x) => '<option value="' + x[0] + '"' + (x[0] === v ? ' selected' : '') + '>' + x[1] + '</option>').join('');
  g.innerHTML = st.panels.map((p, i) => '<div class="sbcard" data-i="' + i + '"><div class="sbpic"><span class="sbnum">' + (i + 1) + '</span>' + sbCardPic(i) + '</div>'
    + '<label>ภาพ<textarea rows="2" data-f="pic">' + esc(p.pic) + '</textarea></label>'
    + '<label>คำบรรยาย<textarea rows="2" data-f="cap">' + esc(p.cap) + '</textarea></label>'
    + '<label>บทพูด<textarea rows="1" data-f="say">' + esc(p.say) + '</textarea></label>'
    + '<div class="sbcam"><select data-f="shot" aria-label="ขนาดภาพ">' + opt(SB_SHOT, p.shot) + '</select><select data-f="ang" aria-label="มุมกล้อง">' + opt(SB_ANGLE, p.ang) + '</select></div>'
    + (st.calc ? '<label>นาทีที่<textarea rows="1" data-f="t">' + (p.t == null ? '' : p.t) + '</textarea></label>' : '')
    + '<div class="sbtools"><button class="btn" type="button" data-a="left"' + (i ? '' : ' disabled') + '>ไปก่อน</button><button class="btn" type="button" data-a="right"' + (i < st.panels.length - 1 ? '' : ' disabled') + '>ไปหลัง</button><button class="btn danger" type="button" data-a="del"' + (st.panels.length > 1 ? '' : ' disabled') + '>ลบช่อง</button></div></div>').join('');
  g.querySelectorAll('.sbcard').forEach((card) => {
    const i = +card.dataset.i;
    const redraw = () => { if (SB.cur !== st) return; const p = card.querySelector('.sbpic'); p.innerHTML = '<span class="sbnum">' + (i + 1) + '</span>' + sbCardPic(i); const nx = card.nextElementSibling; if (nx && st.calc) { const j = +nx.dataset.i, q = nx.querySelector('.sbpic'); q.innerHTML = '<span class="sbnum">' + (j + 1) + '</span>' + sbCardPic(j); } };
    card.querySelectorAll('textarea,select').forEach((f) => {
      const on = () => {
        const p = st.panels[i], k = f.dataset.f;
        if (k === 't') { const n = parseFloat(f.value); if (isFinite(n) && n >= 0) p.t = n; else delete p.t; } else p[k] = f.value;
        clearTimeout(SB.mt); SB.mt = setTimeout(redraw, f.tagName === 'SELECT' ? 0 : 250);
      };
      f.addEventListener(f.tagName === 'SELECT' ? 'change' : 'input', on);
    });
    card.querySelectorAll('button[data-a]').forEach((b) => { b.onclick = () => {
      const P = st.panels, a = b.dataset.a;
      if (a === 'del') P.splice(i, 1); else { const j = a === 'left' ? i - 1 : i + 1; const t = P[i]; P[i] = P[j]; P[j] = t; }
      sbCards();
    }; });
  });
}
/* the storyboard onto the page: a new page after this one, or the box it came from */
async function sbPut() {
  const st = SB.cur; if (!st || !S.nb) return;
  st.title = ($('#sbTitle').value || '').trim().slice(0, 80) || 'สตอรี่บอร์ด';
  st.panels = st.panels.map((p) => Object.assign(p, { cap: String(p.cap || '').trim(), say: String(p.say || '').trim(), pic: String(p.pic || '').trim() }));
  const svg = sbSheetSvg(st), story = clone(st);
  if (SB.item) {
    const it0 = findItem(SB.item); if (!it0) { toast('ไม่พบสตอรี่บอร์ดเดิมในหน้านี้', 3000); return; }
    const before = clone(S.page.items), items = clone(S.page.items), t = items.find((x) => x.id === SB.item);
    t.svg = svg; t.story = story; setItems(items, before); sbClose(); toast('บันทึกสตอรี่บอร์ดแล้ว', 2500); return;
  }
  const it = { id: 'i' + uid(), by: DEV, type: 'svg', x: 20, y: 20, w: 960, svg, story };
  const pid = 'p' + uid();
  await S.store.set('pages/' + pid, { nb: S.nid, paper: 'blank', items: [it], rev: now() });
  const pages = ((S.nb && S.nb.pages) || []).slice(), at = pages.indexOf(S.pid); pages.splice(at < 0 ? pages.length : at + 1, 0, pid);
  await S.store.update('notebooks/' + S.nid, { pages, updatedAt: now() });
  S.nb = Object.assign({}, S.nb, { pages });
  sbClose(); openPage(pid); renderPageList(); renderTitle();
  toast('วางสตอรี่บอร์ดเป็นหน้า ' + (pages.indexOf(pid) + 1) + ' แล้ว กด เล่น ที่มุมกล่องเพื่อดูเป็นแอนิเมชัน หรือ แก้ไข เพื่อเปลี่ยนแต่ละช่อง', 5000);
}

/* ----- the animation: the panels in turn ----- */
const SB_FADE = 0.5;
const sbDur = (st, p) => Math.min(9, 3.6 + (sbWords(st, p, p.cap).length + sbWords(st, p, p.say).length) * 0.045);
function sbPlayer() {
  let el = $('#sbPlay'); if (el) return el;
  sbStyle();
  el = document.createElement('div'); el.id = 'sbPlay'; el.className = 'no-ink'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'แอนิเมชันจากสตอรี่บอร์ด');
  el.innerHTML = '<canvas id="sbCv" aria-label="ภาพของช่องที่กำลังเล่น"></canvas><div class="sbcap" id="sbCap" aria-live="polite"></div>'
    + '<div class="sbctl"><button class="btn" id="bSbPrev" type="button">ก่อนหน้า</button><button class="btn solid" id="bSbPause" type="button">หยุด</button><button class="btn" id="bSbNext" type="button">ถัดไป</button><span class="sbn" id="sbN"></span><button class="btn" id="bSbStop" type="button">ปิด</button></div>';
  document.body.appendChild(el);
  $('#bSbStop').onclick = () => sbStop();
  $('#bSbPause').onclick = () => sbPause();
  $('#sbCv').onclick = () => sbPause();
  $('#bSbPrev').onclick = () => sbGo(SB.play.i - 1);
  $('#bSbNext').onclick = () => sbGo(SB.play.i + 1);
  window.addEventListener('resize', () => { if (SB.play) sbFitPlay(); });
  document.addEventListener('keydown', (e) => { if (!SB.play) return; if (e.key === 'Escape') sbStop(); else if (e.key === ' ') { e.preventDefault(); sbPause(); } else if (e.key === 'ArrowRight') sbGo(SB.play.i + 1); else if (e.key === 'ArrowLeft') sbGo(SB.play.i - 1); });
  return el;
}
function sbFitPlay() {
  const cv = $('#sbCv'), P = SB.play; if (!cv || !P) return;
  const w = Math.min(window.innerWidth - 32, (window.innerHeight - 190) * SB_FW / SB_FH, 1280), h = w * SB_FH / SB_FW, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.style.width = Math.round(w) + 'px'; cv.style.height = Math.round(h) + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  P.k = cv.width / SB_FW;
}
/* play the storyboard box with that id on this page, or a story from the sheet */
function sbPlay(id, st) {
  if (id) { const it = findItem(id); st = it && it.story; }
  if (!st || !st.panels || !st.panels.length) return;
  const el = sbPlayer(); el.hidden = false;
  SB.play = { st: clone(st), i: 0, tm: 0, run: true, last: 0, raf: 0, k: 1 };
  sbFitPlay(); sbGo(0);
  const loop = (ts) => {
    const P = SB.play; if (!P) return;
    const dt = P.last ? Math.min(0.1, (ts - P.last) / 1000) : 0; P.last = ts;
    if (P.run) { P.tm += dt; const D = sbDur(P.st, P.st.panels[P.i]); if (P.tm >= D) { if (P.i < P.st.panels.length - 1) sbGo(P.i + 1, true); else { P.tm = D; P.run = false; sbCtl(); } } }
    sbFrame();
    P.raf = requestAnimationFrame(loop);
  };
  SB.play.raf = requestAnimationFrame(loop);
}
function sbGo(i, auto) {
  const P = SB.play; if (!P) return;
  i = Math.max(0, Math.min(P.st.panels.length - 1, i));
  P.from = auto ? P.i : null; P.i = i; P.tm = 0; if (!auto) P.run = true;
  const p = P.st.panels[i], say = sbWords(P.st, p, p.say).trim();
  $('#sbCap').textContent = sbWords(P.st, p, p.cap) + (say && !(p.draw || []).some((e) => e.k === 'person') ? ' "' + say.replace(/^[^:]{1,20}:\s*/, '') + '"' : '');
  sbCtl(); sbFrame();
}
function sbCtl() {
  const P = SB.play; if (!P) return;
  $('#bSbPause').textContent = P.run ? 'หยุด' : (P.i === P.st.panels.length - 1 && P.tm > 0 ? 'เล่นอีกครั้ง' : 'เล่นต่อ');
  $('#bSbPrev').disabled = P.i === 0; $('#bSbNext').disabled = P.i === P.st.panels.length - 1;
  $('#sbN').textContent = 'ช่อง ' + (P.i + 1) + ' จาก ' + P.st.panels.length;
}
function sbPause() {
  const P = SB.play; if (!P) return;
  if (!P.run && P.i === P.st.panels.length - 1 && P.tm > 0) { sbGo(0); return; }
  P.run = !P.run; sbCtl();
}
function sbStop() {
  const P = SB.play; if (P) cancelAnimationFrame(P.raf);
  SB.play = null; const el = $('#sbPlay'); if (el) el.hidden = true;
}
/* one frame: the camera eases in a little through the panel; the panel before fades out at the start */
function sbFrame() {
  const P = SB.play, cv = $('#sbCv'); if (!P || !cv) return;
  const c = cv.getContext('2d'), st = P.st, p = st.panels[P.i], D = sbDur(st, p), ph = Math.min(1, P.tm / D);
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, cv.width, cv.height);
  sbDrawPanel(c, st, P.i, Math.max(0.0001, P.tm), ph, P.k, 1);
  if (P.from != null && P.tm < SB_FADE) sbDrawPanel(c, st, P.from, sbDur(st, st.panels[P.from]), 1, P.k, 1 - P.tm / SB_FADE, true);
}
function sbDrawPanel(c, st, i, tm, ph, k, alpha, cover) {
  const p = st.panels[i], v0 = sbView(p), push = 1 + 0.06 * ph, w = v0[2] / push, h = v0[3] / push, v = [v0[0] + (v0[2] - w) / 2, v0[1] + (v0[3] - h) / 2, w, h];
  c.save(); c.globalAlpha = alpha;
  if (cover) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, SB_FW * k, SB_FH * k); }
  const z = k * SB_FW / v[2];
  c.setTransform(z, 0, 0, z, -v[0] * z, -v[1] * z);
  for (const o of sbOps(st, p, tm, ph, st.panels[i - 1])) sbOpCv(c, o, alpha);
  c.setTransform(k, 0, 0, k, 0, 0);
  const b = sbBubble(sbSayText(st, p), sbHead(p, v), 1);
  if (b) {
    c.globalAlpha = alpha * Math.min(1, tm / 0.4);
    c.fillStyle = '#FFFFFF'; c.strokeStyle = '#1F2933'; c.lineWidth = 0.6;
    if (b.tail) { c.beginPath(); c.moveTo(b.tail[0][0], b.tail[0][1]); c.lineTo(b.tail[1][0], b.tail[1][1]); c.lineTo(b.tail[2][0], b.tail[2][1]); c.fill(); c.stroke(); }
    c.beginPath(); if (c.roundRect) c.roundRect(b.x, b.y, b.w, b.h, 3); else c.rect(b.x, b.y, b.w, b.h); c.fill(); c.stroke();
    if (b.tail) { c.strokeStyle = '#FFFFFF'; c.lineWidth = 1; c.beginPath(); c.moveTo(b.tail[0][0] + 0.5, b.tail[0][1]); c.lineTo(b.tail[2][0] - 0.5, b.tail[2][1]); c.stroke(); }
    c.fillStyle = '#1F2933'; c.font = '5.2px ' + SB_FONT; c.textAlign = 'left';
    b.lines.forEach((l, j) => c.fillText(l, b.x + 3, b.y + 6.4 + j * 6.6));
  }
  c.restore();
}
function sbOpCv(c, o, alpha) {
  c.save();
  if (o.o != null) c.globalAlpha = alpha * o.o;
  if (o.t != null) { c.fillStyle = o.c; c.font = (o.b ? '700 ' : '') + o.z + 'px ' + SB_FONT; c.textAlign = o.a === 'start' ? 'left' : 'center'; c.fillText(o.t, o.x, o.y); c.restore(); return; }
  if (o.tf) c.transform(o.tf[0], 0, 0, o.tf[0], o.tf[1], o.tf[2]); else if (o.sy) c.transform(1, 0, 0, o.sy, 0, o.cy * (1 - o.sy));
  let path; try { path = new Path2D(o.d); } catch (e) { c.restore(); return; }
  if (o.f) { c.fillStyle = o.f; c.fill(path); }
  if (o.s) { c.strokeStyle = o.s; c.lineWidth = o.tf ? o.w / o.tf[0] : (o.w || 1); c.lineCap = 'round'; c.lineJoin = 'round'; if (o.dash) { c.setLineDash(o.dash); c.lineDashOffset = o.off || 0; } c.stroke(path); }
  c.restore();
}

