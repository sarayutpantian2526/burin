/* BURIN part: scene (loaded when first used) */
/* ---------- living models: a drawing or a description becomes a model that moves by the rules of its subject.
   One description format (spec) for every subject; each subject has its own small engine:
   phys  : bodies, surfaces, springs, ropes and pulleys, fields; every force shown as a free-body diagram while it moves
   chem  : particles in a box; temperature, collisions, reactions that need enough collision energy, membranes
   bio   : the same particles plus living agents that move, eat, reproduce and die; populations over time
   math  : functions, curves and points driven by sliders and a running parameter t
   The spec is plain data, so a model is saved with the page, synced, and sent to students like any other box. ---------- */
const SCN = new Map();
let scnRaf = 0, scnLast = 0;
const SC_COL = { W: '#C2571A', N: '#2E8B57', f: '#B8860B', T: '#7B4FC9', Fs: '#D14D8B', F: '#1F6FD1', FE: '#E0A100', FB: '#0E9AA7', Fg: '#C2571A', D: '#7A8699', net: '#14181F', v: '#2F4BB8', a: '#C2410C' };
const SC_FNAME = { W: 'น้ำหนัก', N: 'แรงปฏิกิริยาตั้งฉาก', f: 'แรงเสียดทาน', T: 'แรงตึงเชือก', Fs: 'แรงสปริง', F: 'แรงกระทำ', FE: 'แรงไฟฟ้า', FB: 'แรงแม่เหล็ก', Fg: 'แรงโน้มถ่วง', D: 'แรงต้าน', net: 'แรงลัพธ์' };
const SC_SYM = { W: 'mg', N: 'N', f: 'f', T: 'T', Fs: 'F_s', F: 'F', FE: 'qE', FB: 'qvB', Fg: 'F_g', D: 'D', net: 'ΣF' };
const scNum = (v, d, lo, hi) => { v = Number(v); if (!isFinite(v)) v = d; return clamp(v, lo, hi); };
const scCol = (c, d) => (/^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? c : d);
const scTxt = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').slice(0, n || 40);
const SC_PAL = ['#2F4BB8', '#C2571A', '#2E8B57', '#7B4FC9', '#D14D8B', '#0E9AA7', '#B8860B', '#5A6472'];

/* clean anything that came from AI or another device before it runs */
function scClean(sp) {
  sp = sp && typeof sp === 'object' ? sp : {};
  const dom = ['phys', 'chem', 'bio', 'math'].includes(sp.domain) ? sp.domain : 'phys';
  const o = { v: 1, domain: dom, title: scTxt(sp.title || 'แบบจำลอง', 60), note: scTxt(sp.note, 200) };
  const params = Array.isArray(sp.params) ? sp.params.slice(0, 8) : [];
  o.params = params.map((p) => ({ key: scTxt(p.key, 40).replace(/[^A-Za-z0-9_.]/g, ''), label: scTxt(p.label, 40), min: scNum(p.min, 0, -1e6, 1e6), max: scNum(p.max, 10, -1e6, 1e6), step: scNum(p.step, 0.1, 1e-6, 1e5) })).filter((p) => p.key && p.max > p.min);
  if (sp.dim === 3) return sc3Clean(sp, o);
  if (dom === 'phys') {
    const wd = sp.world || {};
    o.bare = !!sp.bare;
    o.world = { w: scNum(wd.w, 10, 0.1, 1e9), h: scNum(wd.h, 6, 0.1, 1e9), g: scNum(wd.g, 9.8, 0, 1000), x0: scNum(wd.x0, 0, -1e9, 1e9), y0: scNum(wd.y0, 0, -1e9, 1e9) };
    o.bodies = (Array.isArray(sp.bodies) ? sp.bodies : []).slice(0, 8).map((b, i) => ({
      id: scTxt(b.id || 'B' + (i + 1), 8).replace(/[^A-Za-z0-9_]/g, '') || 'B' + (i + 1), label: scTxt(b.label || b.id || 'วัตถุ', 20), shape: b.shape === 'ball' ? 'ball' : b.shape === 'person' ? 'person' : 'box', act: ['stand', 'walk', 'run', 'jump', 'longjump', 'fall', 'squat', 'idle', 'wave', 'dance'].includes(b.act) ? b.act : 'walk', hgt: scNum(b.hgt, 1.7, 0.5, 2.5), v: scNum(b.v, b.act === 'run' ? 4 : b.act === 'jump' ? 2.6 : b.act === 'longjump' ? 6 : 1.4, 0, 12), ang: scNum(b.ang, 20, 0, 80), push: scNum(b.push, 0.6, 0, 5),
      m: scNum(b.m, 1, 1e-6, 1e30), x: scNum(b.x, 1, -1e12, 1e12), y: scNum(b.y, 1, -1e12, 1e12), vx: scNum(b.vx, 0, -1e9, 1e9), vy: scNum(b.vy, 0, -1e9, 1e9),
      w: scNum(b.w, 0.6, 1e-6, 1e12), h: scNum(b.h, 0.4, 1e-6, 1e12), r: scNum(b.r, 0.25, 1e-6, 1e12), q: scNum(b.q, 0, -1e3, 1e3), e: scNum(b.e, b.shape === 'ball' ? 0.5 : 0, 0, 1),
      fixed: !!b.fixed, color: scCol(b.color, SC_PAL[i % SC_PAL.length]), img: okAsset(b.img) ? b.img : '', ink: !!b.ink, hull: Array.isArray(b.hull) && b.hull.length >= 3 ? b.hull.slice(0, 48).map((q) => [scNum(q && q[0], 0, -1e6, 1e6), scNum(q && q[1], 0, -1e6, 1e6)]) : null, skin: scNum(b.skin, 0.012, 0, 1), wheel: !!b.wheel
    }));
    o.surfaces = (Array.isArray(sp.surfaces) ? sp.surfaces : []).slice(0, sp.bare ? 40 : 12).map((s) => ({ x1: scNum(s.x1, 0, -1e12, 1e12), y1: scNum(s.y1, 0, -1e12, 1e12), x2: scNum(s.x2, 10, -1e12, 1e12), y2: scNum(s.y2, 0, -1e12, 1e12), mu: scNum(s.mu, 0, 0, 5), mus: scNum(s.mus != null ? s.mus : s.mu, 0, 0, 5) }));
    o.springs = (Array.isArray(sp.springs) ? sp.springs : []).slice(0, 6).map((s) => ({ a: scTxt(s.a, 8), b: scTxt(s.b, 8), ax: scNum(s.ax, 0, -1e12, 1e12), ay: scNum(s.ay, 0, -1e12, 1e12), k: scNum(s.k, 20, 1e-6, 1e9), L0: scNum(s.L0, 1, 0, 1e12) }));
    o.ropes = (Array.isArray(sp.ropes) ? sp.ropes : []).slice(0, 6).map((r) => ({ a: scTxt(r.a, 8), b: scTxt(r.b, 8), ax: scNum(r.ax, 0, -1e12, 1e12), ay: scNum(r.ay, 0, -1e12, 1e12), via: Array.isArray(r.via) && r.via.length === 2 ? [scNum(r.via[0], 0, -1e12, 1e12), scNum(r.via[1], 0, -1e12, 1e12)] : null, pr: scNum(r.pr, 0, 0, 1e9), L: r.L == null ? null : scNum(r.L, 1, 0, 1e12), rod: !!r.rod, snap: !!r.snap }));
    o.forces = (Array.isArray(sp.forces) ? sp.forces : []).slice(0, 8).map((f) => ({ on: scTxt(f.on, 8), fx: scNum(f.fx, 0, -1e12, 1e12), fy: scNum(f.fy, 0, -1e12, 1e12), label: scTxt(f.label || 'F', 6) }));
    const fl = sp.fields || {};
    o.fields = { E: Array.isArray(fl.E) ? [scNum(fl.E[0], 0, -1e9, 1e9), scNum(fl.E[1], 0, -1e9, 1e9)] : null, B: fl.B == null ? 0 : scNum(fl.B, 0, -1e6, 1e6), drag: scNum(fl.drag, 0, 0, 1e6),
      central: fl.central ? { x: scNum(fl.central.x, 0, -1e12, 1e12), y: scNum(fl.central.y, 0, -1e12, 1e12), GM: scNum(fl.central.GM, 1, 0, 1e30), r: scNum(fl.central.r, 0.3, 0, 1e12), label: scTxt(fl.central.label || '', 16) } : null };
    const sh = sp.show || {};
    o.show = { fbd: sh.fbd !== false, v: !!sh.v, a: !!sh.a, net: !!sh.net, trail: sh.trail !== false, energy: !!sh.energy, graph: ['x', 'y', 'v', 'vx', 'vy', 'grf', 'none'].includes(sh.graph) ? sh.graph : 'v' };
    o.speed = scNum(sp.speed, 1, 0.01, 1e6);
  } else if (dom === 'chem' || dom === 'bio') {
    const bx = sp.box || {};
    o.box = { w: scNum(bx.w, 100, 20, 400), h: scNum(bx.h, 60, 20, 300) };
    o.T = scNum(sp.T, 300, 1, 5000);
    o.species = (Array.isArray(sp.species) ? sp.species : []).slice(0, 8).map((s, i) => ({
      id: scTxt(s.id || 'S' + i, 10).replace(/[^A-Za-z0-9_]/g, '') || 'S' + i, label: scTxt(s.label || s.id, 20), color: scCol(s.color, SC_PAL[i % SC_PAL.length]),
      n: Math.round(scNum(s.n, 20, 0, 400)), r: scNum(s.r, 1.2, 0.3, 6), m: scNum(s.m, 1, 0.05, 100), fixed: !!s.fixed, side: ['left', 'right', 'all'].includes(s.side) ? s.side : 'all',
      agent: !!s.agent, speed: scNum(s.speed, 6, 0, 100), eats: Array.isArray(s.eats) ? s.eats.slice(0, 4).map((x) => scTxt(x, 10)) : [], gain: scNum(s.gain, 4, 0, 100),
      burn: scNum(s.burn, 0.4, 0, 100), birth: scNum(s.birth, 8, 0, 1000), life: scNum(s.life, 0, 0, 1e4), regrow: scNum(s.regrow, 0, 0, 100), cap: Math.round(scNum(s.cap, 300, 1, 400)), immigrate: s.immigrate !== false
    }));
    o.reactions = (Array.isArray(sp.reactions) ? sp.reactions : []).slice(0, 8).map((r) => ({ from: (Array.isArray(r.from) ? r.from : []).slice(0, 2).map((x) => scTxt(x, 10)), to: (Array.isArray(r.to) ? r.to : []).slice(0, 2).map((x) => scTxt(x, 10)), Ea: scNum(r.Ea, 1, 0, 100), k: scNum(r.k, 0, 0, 100) })).filter((r) => r.from.length && r.to.length);
    o.membrane = sp.membrane ? { x: scNum(sp.membrane.x, 0.5, 0.05, 0.95), move: !!sp.membrane.move, pass: (Array.isArray(sp.membrane.pass) ? sp.membrane.pass : []).slice(0, 8).map((x) => scTxt(x, 10)) } : null;
    o.thermostat = sp.thermostat !== false && dom === 'chem';
  } else {
    const vw = sp.view || {};
    o.view = { xmin: scNum(vw.xmin, -6, -1e9, 1e9), xmax: scNum(vw.xmax, 6, -1e9, 1e9), ymin: scNum(vw.ymin, -4, -1e9, 1e9), ymax: scNum(vw.ymax, 4, -1e9, 1e9) };
    if (o.view.xmax <= o.view.xmin) o.view.xmax = o.view.xmin + 1; if (o.view.ymax <= o.view.ymin) o.view.ymax = o.view.ymin + 1;
    const t = sp.t || {}; o.t = { min: scNum(t.min, 0, -1e6, 1e6), max: scNum(t.max, 6.2832, -1e6, 1e6), speed: scNum(t.speed, 1, 0, 1e4), loop: t.loop !== false };
    o.vars = {}; for (const [k, v] of Object.entries(sp.vars || {}).slice(0, 8)) if (/^[a-zA-Z]\w{0,9}$/.test(k) && !/^(t|x|e|pi)$/.test(k)) o.vars[k] = scNum(v, 1, -1e9, 1e9);
    const ex = (s) => scTxt(s, 260).replace(/[^0-9A-Za-z_+\-*/^().,\s<>=!?:]/g, '');
    o.items = (Array.isArray(sp.items) ? sp.items : []).slice(0, 12).map((it, i) => ({
      type: ['func', 'curve', 'point', 'segment', 'vector', 'tangent', 'area', 'text'].includes(it.type) ? it.type : 'func', color: scCol(it.color, SC_PAL[i % SC_PAL.length]), label: scTxt(it.label, 24),
      expr: ex(it.expr), x: ex(it.x), y: ex(it.y), x1: ex(it.x1), y1: ex(it.y1), x2: ex(it.x2), y2: ex(it.y2), tmin: ex(it.tmin), tmax: ex(it.tmax), at: ex(it.at), a: ex(it.a), b: ex(it.b), n: ex(it.n), of: Math.round(scNum(it.of, 0, 0, 11)), trace: !!it.trace, text: scTxt(it.text, 60)
    }));
  }
  return o;
}
/* sliders change one number inside the spec: "B1.m", "g", "S1.mu", "F1.fx", "T", "A.n", "a" */
function scGet(sp, key) {
  if (sp.dim === 3) return sc3Get(sp, key);
  const [h, k] = key.split('.');
  if (!k) { if (sp.domain === 'math') return sp.vars ? sp.vars[h] : undefined; if (h === 'g') return sp.world && sp.world.g; if (h === 'T') return sp.T; if (h === 'B') return sp.fields && sp.fields.B; if (h === 'drag') return sp.fields && sp.fields.drag; if (h === 'speed') return sp.speed; if (h === 'mu') return sp.surfaces && sp.surfaces[0] ? sp.surfaces[0].mu : 0; return undefined; }
  const arr = scTarget(sp, h); return arr ? arr[k] : undefined;
}
function scSet(sp, key, v) {
  if (sp.dim === 3) { sc3Set(sp, key, v); return; }
  const [h, k] = key.split('.');
  if (!k) { if (sp.domain === 'math') { sp.vars = sp.vars || {}; sp.vars[h] = v; } else if (h === 'g') sp.world.g = v; else if (h === 'T') sp.T = v; else if (h === 'B') sp.fields.B = v; else if (h === 'drag') sp.fields.drag = v; else if (h === 'speed') sp.speed = v; else if (h === 'mu') (sp.surfaces || []).forEach((x) => { x.mu = v; x.mus = v * 1.3; }); return; }
  const t = scTarget(sp, h); if (t && k in t) t[k] = k === 'n' ? Math.round(v) : v;
}
function scTarget(sp, h) {
  if (sp.domain === 'phys') {
    const b = (sp.bodies || []).find((x) => x.id === h); if (b) return b;
    let m = h.match(/^S(\d+)$/); if (m && sp.surfaces[m[1] - 1]) return sp.surfaces[m[1] - 1];
    m = h.match(/^K(\d+)$/); if (m && sp.springs[m[1] - 1]) return sp.springs[m[1] - 1];
    m = h.match(/^F(\d+)$/); if (m && sp.forces[m[1] - 1]) return sp.forces[m[1] - 1];
    m = h.match(/^R(\d+)$/); if (m && sp.ropes[m[1] - 1]) return sp.ropes[m[1] - 1];
    if (h === 'E' && sp.fields.E) return { get x() { return sp.fields.E[0]; }, set x(v) { sp.fields.E[0] = v; }, get y() { return sp.fields.E[1]; }, set y(v) { sp.fields.E[1] = v; } };
    if (h === 'C' && sp.fields.central) return sp.fields.central;
  } else if (sp.domain === 'chem' || sp.domain === 'bio') {
    const s = (sp.species || []).find((x) => x.id === h); if (s) return s;
    const m = h.match(/^R(\d+)$/); if (m && sp.reactions[m[1] - 1]) return sp.reactions[m[1] - 1];
  }
  return null;
}

/* ---------- physics: impulses per step so contact and rope forces come out as real numbers for the diagram ---------- */
function phInit(sp) {
  const st = { t: 0, bodies: sp.bodies.map((b) => Object.assign({}, b, { ang: 0, om: 0, F: {}, trail: [], contact: null, x0: b.x })), hist: [], acc: {} };
  for (const b of st.bodies) if (b.hull) { const r2 = b.hull.reduce((a, q) => a + q[0] * q[0] + q[1] * q[1], 0) / b.hull.length; b.I = Math.max(1e-9, 0.4 * b.m * r2); b.hsz = Math.max(...b.hull.map((q) => Math.hypot(q[0], q[1]))); }
  for (const b of st.bodies) if (b.shape === 'person') { psStep(sp, { t: -0.004 }, b, 0.004); }
  /* a body drawn slightly into a surface starts resting on it */
  for (const b of st.bodies) if (b.shape !== 'person' && !b.hull) for (const s of sp.surfaces) {
    const ex = s.x2 - s.x1, ey = s.y2 - s.y1, L2 = ex * ex + ey * ey || 1e-12, u = clamp(((b.x - s.x1) * ex + (b.y - s.y1) * ey) / L2, 0, 1);
    const px = s.x1 + ex * u, py = s.y1 + ey * u, d = Math.hypot(b.x - px, b.y - py), pen = phR(b) - d;
    if (pen > 0 && d > 1e-9 && u > 0 && u < 1) { const L = Math.sqrt(L2); let nx = -ey / L, ny = ex / L; if (nx * (b.x - px) + ny * (b.y - py) < 0) { nx = -nx; ny = -ny; } b.x = px + nx * phR(b); b.y = py + ny * phR(b); }
    else if (pen > 0 && d > 1e-9) { b.x += (b.x - px) / d * pen; b.y += (b.y - py) / d * pen; }
  }
  for (const r of sp.ropes) if (r.snap && r.L && !r.via && !r.a) { const b = phBody(st, r.b); if (b) { let dx = b.x - r.ax, dy = b.y - r.ay; if (Math.abs(dx) > r.L * 0.98) dx = Math.sign(dx) * r.L * 0.98; dy = -Math.sqrt(Math.max(0, r.L * r.L - dx * dx)); b.x = r.ax + dx; b.y = r.ay + dy; } }
  for (const r of sp.ropes) if (r.L == null) r.L = phRopeLen(st, r) || 1;
  return st;
}
const phBody = (st, id) => st.bodies.find((b) => b.id === id);
function phEnd(st, id, ax, ay) { const b = id && phBody(st, id); return b ? b : { x: ax, y: ay, fixed: true, m: Infinity, vx: 0, vy: 0, F: {} }; }
function phTan(r, e, other) { if (!r.via) return null; const side = e.x < r.via[0] || (e.x === r.via[0] && other.x > e.x) ? -1 : 1; return [r.via[0] + side * (r.pr || 0), r.via[1]]; }
function phRopeLen(st, r) { const a = phEnd(st, r.a, r.ax, r.ay), b = phEnd(st, r.b, r.ax, r.ay); if (r.via) { const ta = phTan(r, a, b), tb = phTan(r, b, a); return Math.hypot(a.x - ta[0], a.y - ta[1]) + Math.hypot(b.x - tb[0], b.y - tb[1]); } return Math.hypot(a.x - b.x, a.y - b.y); }
const phR = (b) => (b.shape === 'ball' ? b.r : b.h / 2);
function phAdd(b, k, fx, fy) { const o = b.F[k] || (b.F[k] = [0, 0]); o[0] += fx; o[1] += fy; }

/* ---------- a person: the centre of mass moves by mechanics (inverted pendulum when walking, spring-mass when running,
   free flight when jumping, rotation about the feet when falling); arms and legs follow it; the ground force comes
   out of the motion itself: N = m(g + ay), friction = m ax ---------- */
function psGround(sp, x) { let best = null; for (const s of sp.surfaces) { if (Math.abs(s.y2 - s.y1) > Math.abs(s.x2 - s.x1) * 0.2) continue; const a = Math.min(s.x1, s.x2), b = Math.max(s.x1, s.x2); if (x < a || x > b) continue; const y = s.y1 + (s.y2 - s.y1) * (x - s.x1) / ((s.x2 - s.x1) || 1); if (best == null || y > best) best = y; } return best == null ? 0 : best; }
function psKin(b, sp, t) {
  const g = sp.world.g || 9.8, H = b.hgt, Lg = 0.5 * H, ys = Lg * 0.98, x0 = b.x0, gr = psGround(sp, x0);
  const K = { hx: x0, hy: gr + ys, fl: [x0 - 0.06 * H, gr], fr: [x0 + 0.06 * H, gr], lean: 0, swing: 0, air: false, tuck: 0, phase: 'ยืน', rot: 0 };
  const walkLike = (v, tt, run) => {
    if (!run) {
      const sl = 0.42 * H, xh = x0 + v * tt, k = Math.floor((xh - x0) / sl), xf = x0 + sl * (k + 0.5), u = ((xh - x0) / sl) - k;
      /* the hip rises over the stance leg and dips when both feet are down: about 5 cm up and down per step */
      const A = clamp(0.025 * (H / 1.7) * (v / 1.4), 0.008, 0.04); K.hx = xh; K.hy = gr + ys - 0.02 - A * Math.cos(2 * Math.PI * u);
      const sw = [xf - sl + 2 * sl * u, gr + 0.07 * Lg * Math.sin(Math.PI * u)];
      if (k % 2) { K.fl = [xf, gr]; K.fr = sw; } else { K.fr = [xf, gr]; K.fl = sw; }
      K.swing = (k % 2 ? 1 : -1) * Math.cos(Math.PI * u); K.phase = 'เดิน: ขาหลักแกว่งแบบลูกตุ้มกลับหัว'; K.lean = 0.04;
    } else {
      const Tst = Math.max(0.18, 0.33 - 0.02 * v), Tf = 0.12 + 0.015 * v, T = Tst + Tf, vy0 = g * Tf / 2, A = vy0 * Tst / Math.PI, k = Math.floor(tt / T), u = tt / T - k;
      const xh = x0 + v * tt; K.hx = xh; const y0 = gr + Lg * 0.95;
      if (u * T < Tst) { const w = u * T / Tst; K.hy = y0 - A * Math.sin(Math.PI * w); const xf = x0 + v * (k * T + Tst / 2); if (k % 2) { K.fl = [xf, gr]; K.fr = [xh - 0.15 * H, gr + 0.28 * Lg]; } else { K.fr = [xf, gr]; K.fl = [xh - 0.15 * H, gr + 0.28 * Lg]; } K.phase = 'วิ่ง: เท้าแตะพื้น'; }
      else { const tf = u * T - Tst; K.hy = y0 + vy0 * tf - 0.5 * g * tf * tf; K.air = true; const fw = [xh + 0.18 * H, gr + 0.12 * Lg + (K.hy - y0)], bk = [xh - 0.2 * H, gr + 0.3 * Lg + (K.hy - y0)]; if (k % 2) { K.fl = bk; K.fr = fw; } else { K.fr = bk; K.fl = fw; } K.phase = 'วิ่ง: ลอยตัว'; }
      K.swing = (k % 2 ? 1 : -1) * Math.cos(Math.PI * 2 * u) * 1.4; K.lean = 0.12 + 0.01 * v;
    }
  };
  if (b.act === 'walk') walkLike(b.v, t, false);
  else if (b.act === 'run') walkLike(b.v, t, true);
  else if (b.act === 'squat') { const c = 0.32 * Lg, T = 2.4, u = (t % T) / T; K.hy = gr + ys - c * (1 - Math.cos(2 * Math.PI * u)) / 2; K.phase = 'สควอต'; }
  else if (b.act === 'jump' || b.act === 'longjump') {
    const c = 0.24 * Lg, run = b.act === 'longjump', vr = run ? clamp(b.v, 2, 11) : 0, ang = (run ? b.ang : 90) * Math.PI / 180;
    const vyT = run ? clamp(vr * Math.tan(ang), 0.5, 6) : Math.max(0.3, b.v), vxT = run ? vr : 0;
    const Tc = run ? 0.16 : 0.45, Ta = 2 * c / Math.max(vyT, 0.3), Tfl = 2 * vyT / g, Tl = 2 * c / Math.max(vyT, 0.3), Tr = 0.6, Tw = 0.4, Trun = run ? 1.6 : 0;
    let tt = t; const xRun = run ? x0 + vr * Trun : x0;
    if (run && tt < Trun) { walkLike(vr, tt, true); K.phase = 'วิ่งเข้าหา'; }
    else {
      tt -= Trun;
      const ph = [Tw, Tc, Ta, Tfl, Tl, Tr]; let i = 0; while (i < ph.length && tt > ph[i]) { tt -= ph[i]; i++; }
      const xs = xRun; K.hx = xs; K.fl = [xs - 0.06 * H, gr]; K.fr = [xs + 0.06 * H, gr];
      if (i === 0) { K.hy = gr + ys; K.phase = 'เตรียม'; }
      else if (i === 1) { K.hy = gr + ys - c * (1 - Math.cos(Math.PI * tt / Tc)) / 2; K.phase = run ? 'วางเท้าถีบ' : 'ย่อตัว'; if (run) { K.hx = xs + vr * tt; K.fl = [xs + vr * Tc * 0.6, gr]; K.fr = [K.hx - 0.2 * H, gr + 0.3 * Lg]; } }
      else if (i === 2) { const a = vyT * vyT / (2 * c); K.hy = gr + ys - c + 0.5 * a * tt * tt; K.hx = xs + (run ? vr * (Tc + tt) : 0); if (run) { K.fl = [xs + vr * Tc * 0.6, gr]; K.fr = [K.hx + 0.15 * H, gr + 0.35 * Lg]; } K.phase = 'ถีบตัว แรงจากพื้นมากกว่าน้ำหนัก'; K.swing = -1.6 * tt / Ta; }
      else if (i === 3) { K.air = true; K.hy = gr + ys + vyT * tt - 0.5 * g * tt * tt; K.hx = xs + vxT * (Tc + Ta + tt); K.tuck = Math.sin(Math.PI * tt / Tfl) * 0.8; const dy = K.hy - (gr + ys); K.fl = [K.hx - 0.06 * H + (run ? 0.25 * H * tt / Tfl : 0), gr + dy + 0.02]; K.fr = [K.hx + 0.06 * H + (run ? 0.25 * H * tt / Tfl : 0), gr + dy + 0.02]; K.phase = 'ลอยตัว มีแต่น้ำหนักกระทำ'; K.swing = -1.6; }
      else { const xl = xs + vxT * (Tc + Ta + Tfl); K.hx = xl + (i === 4 && run ? vxT * tt * (1 - tt / (2 * Tl)) : run ? vxT * Tl / 2 : 0); K.fl = [ (run ? xl + vxT * Tl / 2 : xl) - 0.06 * H, gr]; K.fr = [(run ? xl + vxT * Tl / 2 : xl) + 0.06 * H, gr];
        if (i === 4) { const a = vyT * vyT / (2 * c); K.hy = gr + ys - vyT * tt + 0.5 * a * tt * tt; K.phase = 'ลงพื้น งอเข่ารับแรงกระแทก'; }
        else if (i === 5) { K.hy = gr + ys - c + c * (1 - Math.cos(Math.PI * Math.min(1, tt / Tr))) / 2; K.phase = 'ยืดตัวกลับ'; }
        else { K.hy = gr + ys; K.phase = 'ยืน'; } }
    }
  } else if (b.act === 'idle') {
    /* standing there alive: breathing, a small shift of weight, arms hanging loose */
    const u = 2 * Math.PI * t / 3.2; K.hy = gr + ys - 0.006 * H * (1 + Math.sin(u)); K.hx = x0 + 0.012 * H * Math.sin(u / 2); K.swing = 0.1 * Math.sin(u / 2); K.lean = 0.02 * Math.sin(u / 2); K.phase = 'ยืนหายใจ';
  } else if (b.act === 'wave') {
    const u = 2 * Math.PI * t * 1.5; K.hy = gr + ys - 0.004 * H * (1 + Math.sin(u / 3)); K.aF = 1.8; K.fF = 2.55 + 0.32 * Math.sin(u); K.swing = 0; K.phase = 'โบกมือทักทาย';
  } else if (b.act === 'dance') {
    const u = 2 * Math.PI * t * 1.1, bt = Math.abs(Math.sin(u)); K.hy = gr + ys - 0.07 * Lg * (1 - bt); K.hx = x0 + 0.05 * H * Math.sin(u / 2); K.lean = 0.1 * Math.sin(u / 2);
    const lift = 0.12 * Lg; K.fl = [x0 - 0.09 * H, gr + (Math.sin(u / 2) > 0.3 ? lift * (Math.sin(u / 2) - 0.3) : 0)]; K.fr = [x0 + 0.09 * H, gr + (Math.sin(u / 2) < -0.3 ? lift * (-Math.sin(u / 2) - 0.3) : 0)];
    K.aF = 1.25 + 0.5 * Math.sin(u); K.fF = K.aF + 0.8; K.aB = -(1.25 + 0.5 * Math.sin(u + Math.PI)); K.fB = K.aB - 0.8; K.phase = 'เต้น';
  } else if (b.act === 'fall') {
    const T0 = 0.6, L = ys + 0.25 * H; let th = 0;
    if (t > T0) { /* rigid fall about the feet: theta'' = (g/L) sin(theta), started by a push */
      const n = Math.ceil((t - T0) / 0.002); let a = 0.02, w = b.push / L; for (let i = 0; i < n; i++) { const dt = (t - T0) / n; w += (g / L) * Math.sin(a) * dt * 1.5; a += w * dt; if (a > 1.45) { a = 1.45; w = 0; } } th = a; }
    K.rot = th; K.hx = x0 + L * Math.sin(th) * (ys / L); K.hy = gr + ys * Math.cos(th); K.phase = t < T0 ? 'ยืน แล้วถูกผลัก' : th >= 1.45 ? 'ล้มลงพื้น' : 'หมุนรอบเท้า';
  }
  return K;
}
function psStep(sp, st, b, dt) {
  const t = st.t + dt, h = 0.004, k0 = psKin(b, sp, t - h), k1 = psKin(b, sp, t), k2 = psKin(b, sp, t + h);
  const g = sp.world.g || 9.8; b.x = k1.hx; b.y = k1.hy; b.vx = (k2.hx - k0.hx) / (2 * h); b.vy = (k2.hy - k0.hy) / (2 * h);
  const ax = (k2.hx - 2 * k1.hx + k0.hx) / (h * h), ay = (k2.hy - 2 * k1.hy + k0.hy) / (h * h);
  b.ax = clamp(ax, -4 * g, 4 * g); b.ay = clamp(ay, -g, 5 * g); /* impacts are capped so the graph stays readable */ b.kin = k1; b.F = {};
  phAdd(b, 'W', 0, -b.m * g);
  const N = b.m * (g + b.ay); const onG = !k1.air && N > 1e-6;
  if (onG) { phAdd(b, 'N', 0, N); if (Math.abs(b.ax) > 0.05) phAdd(b, 'f', b.m * b.ax, 0); }
  const fs = [k1.fl, k1.fr].filter((f) => f[1] <= psGround(sp, f[0]) + 0.02); b.foot = fs.length ? [fs.reduce((a, f) => a + f[0], 0) / fs.length, fs[0][1]] : null;
  b.F.net = [onG ? b.m * b.ax : 0, -b.m * g + (onG ? N : 0)];
}
function psIK(H, F, L1, L2, dir) { const dx = F[0] - H[0], dy = F[1] - H[1], d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1e-6), a = Math.atan2(dy, dx), c = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d || 1), -1, 1), k = a + dir * Math.acos(c); return [H[0] + L1 * Math.cos(k), H[1] + L1 * Math.sin(k)]; }
function psDraw(c, b, X, Y, sc) {
  const K = b.kin || { hx: b.x, hy: b.y, fl: [b.x - 0.1, b.y - 0.8], fr: [b.x + 0.1, b.y - 0.8], lean: 0, swing: 0, tuck: 0, rot: 0 };
  const H = b.hgt, Lg = 0.5 * H, hip = [K.hx, K.hy], dir = (b.vx || 0) >= 0 ? 1 : -1, rot = K.rot || 0, lean = (K.lean || 0) * dir + rot;
  const tor = 0.3 * H, sh = [hip[0] + tor * Math.sin(lean), hip[1] + tor * Math.cos(lean)], head = [sh[0] + 0.1 * H * Math.sin(lean), sh[1] + 0.1 * H * Math.cos(lean)];
  const lw = Math.max(3, 0.045 * H * sc), col = b.color;
  const seg = (a, z, w2, cl) => { c.strokeStyle = cl || col; c.lineWidth = w2 || lw; c.lineCap = 'round'; c.beginPath(); c.moveTo(X(a[0]), Y(a[1])); c.lineTo(X(z[0]), Y(z[1])); c.stroke(); };
  const leg = (F, back) => { let foot = F; if (rot) { const L = Math.hypot(F[0] - hip[0], F[1] - hip[1]); foot = F; void L; } const kn = psIK(hip, foot, Lg / 2, Lg / 2, dir * (K.tuck ? 1 : 1) * 1); seg(hip, kn, lw, back ? scTint(col, 0.35) : col); seg(kn, foot, lw, back ? scTint(col, 0.35) : col); seg(foot, [foot[0] + 0.07 * H * dir, foot[1]], lw * 0.8, back ? scTint(col, 0.35) : col); };
  const arm = (s, back) => { const a = -s * 0.7 + (K.air ? -1.2 * dir * 0 : 0), el = [sh[0] + 0.16 * H * Math.sin(a + rot), sh[1] - 0.16 * H * Math.cos(a + rot)], hd = [el[0] + 0.15 * H * Math.sin(a + 0.5 * dir + rot), el[1] - 0.15 * H * Math.cos(a + 0.5 * dir + rot)]; const cl = back ? scTint(col, 0.35) : col; seg(sh, el, lw * 0.85, cl); seg(el, hd, lw * 0.85, cl); };
  arm(-(K.swing || 0), true); leg(K.fl, true);
  seg(hip, sh, lw * 1.2);
  leg(K.fr, false); arm(K.swing || 0, false);
  c.fillStyle = '#FFFFFF'; c.strokeStyle = col; c.lineWidth = lw * 0.8; c.beginPath(); c.arc(X(head[0]), Y(head[1]), Math.max(5, 0.065 * H * sc), 0, 6.283); c.fill(); c.stroke();
  /* centre of mass marker */
  const cx = X(hip[0]), cy = Y(hip[1] + 0.03 * H), r = Math.max(4, 0.03 * H * sc); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.fill(); c.fillStyle = '#14181F'; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, 0, Math.PI / 2); c.lineTo(cx, cy); c.moveTo(cx, cy); c.arc(cx, cy, r, Math.PI, Math.PI * 1.5); c.lineTo(cx, cy); c.fill(); c.strokeStyle = '#14181F'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.stroke();
}
function phStep(sp, st, dt) {
  const g = sp.world.g, B = st.bodies.filter((b) => b.shape !== 'person'), fl = sp.fields;
  for (const b of st.bodies) if (b.shape === 'person') psStep(sp, st, b, dt);
  for (const b of B) b.F = {};
  for (const b of B) {
    if (b.fixed) continue;
    if (g) phAdd(b, 'W', 0, -b.m * g);
    if (fl.E && b.q) phAdd(b, 'FE', b.q * fl.E[0], b.q * fl.E[1]);
    if (fl.B && b.q) phAdd(b, 'FB', b.q * b.vy * fl.B, -b.q * b.vx * fl.B);
    if (fl.central) { const dx = fl.central.x - b.x, dy = fl.central.y - b.y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2) || 1e-9, f = fl.central.GM * b.m / Math.max(r2, 1e-12); phAdd(b, 'Fg', f * dx / r, f * dy / r); }
    if (fl.drag) phAdd(b, 'D', -fl.drag * b.vx, -fl.drag * b.vy);
  }
  for (const f of sp.forces) { const b = phBody(st, f.on); if (b && !b.fixed) phAdd(b, 'F', f.fx, f.fy); }
  for (const s of sp.springs) {
    const a = phEnd(st, s.a, s.ax, s.ay), b = phEnd(st, s.b, s.ax, s.ay); const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1e-9, f = s.k * (L - s.L0);
    if (!a.fixed) phAdd(a, 'Fs', f * dx / L, f * dy / L); if (!b.fixed) phAdd(b, 'Fs', -f * dx / L, -f * dy / L);
  }
  for (const b of B) { if (b.fixed) continue; let fx = 0, fy = 0; for (const v of Object.values(b.F)) { fx += v[0]; fy += v[1]; } b.vx += fx / b.m * dt; b.vy += fy / b.m * dt; }
  /* contacts with surfaces */
  const cons = [];
  for (const b of B) {
    if (b.fixed) continue; b.contact = null; if (b.hull) continue;
    for (const s of sp.surfaces) {
      const ex = s.x2 - s.x1, ey = s.y2 - s.y1, L2 = ex * ex + ey * ey || 1e-12; let u = ((b.x - s.x1) * ex + (b.y - s.y1) * ey) / L2; u = clamp(u, 0, 1);
      const px = s.x1 + ex * u, py = s.y1 + ey * u; let nx = b.x - px, ny = b.y - py; const d = Math.hypot(nx, ny);
      if (d < 1e-9) continue; nx /= d; ny /= d; const pen = phR(b) - d;
      if (pen > -0.02 * phR(b) - 1e-6) cons.push({ b, s, nx, ny, pen, jn: 0, jt: 0, vn0: b.vx * nx + b.vy * ny });
    }
  }
  /* body to body (as circles) */
  const pairs = [];
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j]; if (a.fixed && b.fixed) continue; const ra = a.shape === 'ball' ? a.r : Math.max(a.w, a.h) / 2, rb = b.shape === 'ball' ? b.r : Math.max(b.w, b.h) / 2;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < ra + rb && d > 1e-9) pairs.push({ a, b, nx: dx / d, ny: dy / d, pen: ra + rb - d, j: 0, vn0: (b.vx - a.vx) * dx / d + (b.vy - a.vy) * dy / d });
  }
  /* bodies with their real outline: every corner of the outline can touch a surface, so they tip, tumble, rest flat and roll */
  const hcs = [];
  for (const b of B) {
    if (b.fixed || !b.hull) continue; const cs = Math.cos(b.ang), sn = Math.sin(b.ang), skin = b.skin;
    for (const s of sp.surfaces) {
      const ex = s.x2 - s.x1, ey = s.y2 - s.y1, L = Math.hypot(ex, ey); if (L < 1e-9) continue; let nx = -ey / L, ny = ex / L; if ((b.x - s.x1) * nx + (b.y - s.y1) * ny < 0) { nx = -nx; ny = -ny; }
      for (const v of b.hull) {
        const rx = cs * v[0] - sn * v[1], ry = sn * v[0] + cs * v[1], px = b.x + rx, py = b.y + ry, u = ((px - s.x1) * ex + (py - s.y1) * ey) / (L * L); if (u < 0 || u > 1) continue;
        const pen = skin - ((px - s.x1) * nx + (py - s.y1) * ny); if (pen > -0.004 && pen < b.hsz) hcs.push({ b, s, nx, ny, rx, ry, pen, jn: 0, jt: 0, vn0: (b.vx - b.om * ry) * nx + (b.vy + b.om * rx) * ny });
      }
    }
  }
  const ropes = sp.ropes.map((r) => ({ r, a: phEnd(st, r.a, r.ax, r.ay), b: phEnd(st, r.b, r.ax, r.ay), j: 0 }));
  const beta = 0.2 / dt;
  for (let it = 0; it < 12; it++) {
    for (const c of cons) {
      const b = c.b, vn = b.vx * c.nx + b.vy * c.ny, bounce = c.vn0 < -1.2 ? -b.e * c.vn0 : 0;
      let dj = (bounce - vn + (c.pen > 0.01 * phR(b) ? Math.min(beta * c.pen * 0.2, 0.5) : 0)) * b.m; const nj = Math.max(0, c.jn + dj); dj = nj - c.jn; c.jn = nj;
      b.vx += dj * c.nx / b.m; b.vy += dj * c.ny / b.m;
      const tx = -c.ny, ty = c.nx, vt = b.vx * tx + b.vy * ty; let djt = -vt * b.m; const lim = (Math.abs(c.jt + djt) <= c.s.mus * c.jn) ? Infinity : c.s.mu * c.jn;
      const nt = clamp(c.jt + djt, -lim, lim); djt = nt - c.jt; c.jt = nt; b.vx += djt * tx / b.m; b.vy += djt * ty / b.m;
    }
    for (const c of hcs) {
      const b = c.b, I = b.I, rn = c.rx * c.ny - c.ry * c.nx, vn = (b.vx - b.om * c.ry) * c.nx + (b.vy + b.om * c.rx) * c.ny, bounce = c.vn0 < -1 ? -b.e * c.vn0 : 0;
      let dj = (bounce - vn + (c.pen > 0.003 ? Math.min(beta * c.pen * 0.2, 0.5) : 0)) / (1 / b.m + rn * rn / I); const nj = Math.max(0, c.jn + dj); dj = nj - c.jn; c.jn = nj;
      b.vx += dj * c.nx / b.m; b.vy += dj * c.ny / b.m; b.om += dj * rn / I;
      const tx = -c.ny, ty = c.nx, rt = c.rx * ty - c.ry * tx, vt = (b.vx - b.om * c.ry) * tx + (b.vy + b.om * c.rx) * ty; let djt = -vt / (1 / b.m + rt * rt / I);
      const rf = b.wheel ? 0.03 : 1, lim = Math.abs(c.jt + djt) <= c.s.mus * rf * c.jn ? Infinity : c.s.mu * rf * c.jn; const nt = clamp(c.jt + djt, -lim, lim); djt = nt - c.jt; c.jt = nt;
      b.vx += djt * tx / b.m; b.vy += djt * ty / b.m; b.om += djt * rt / I;
    }
    for (const p of pairs) {
      const ia = p.a.fixed ? 0 : 1 / p.a.m, ib = p.b.fixed ? 0 : 1 / p.b.m; if (!ia && !ib) continue;
      const vn = (p.b.vx - p.a.vx) * p.nx + (p.b.vy - p.a.vy) * p.ny, e = Math.min(p.a.e, p.b.e), tgt = p.vn0 < -0.05 ? -e * p.vn0 : 0;
      let dj = (tgt - vn + beta * Math.max(0, p.pen - 0.005) * 0.5) / (ia + ib); const nj = Math.max(0, p.j + dj); dj = nj - p.j; p.j = nj;
      p.a.vx -= dj * p.nx * ia; p.a.vy -= dj * p.ny * ia; p.b.vx += dj * p.nx * ib; p.b.vy += dj * p.ny * ib;
    }
    for (const R of ropes) {
      const { r, a, b } = R; const pa = r.via ? (R.ta || (R.ta = phTan(r, a, b))) : [b.x, b.y], pb = r.via ? (R.tb || (R.tb = phTan(r, b, a))) : [a.x, a.y];
      let uax = pa[0] - a.x, uay = pa[1] - a.y; const la = Math.hypot(uax, uay) || 1e-9; uax /= la; uay /= la;
      let ubx = pb[0] - b.x, uby = pb[1] - b.y; const lb = Math.hypot(ubx, uby) || 1e-9; ubx /= lb; uby /= lb;
      const len = r.via ? la + lb : la, C = len - r.L; if (C < -1e-4 && !r.rod) { R.slack = true; continue; }
      R.slack = false;
      const ia = a.fixed ? 0 : 1 / a.m, ib = b.fixed ? 0 : 1 / b.m; if (!ia && !ib) continue;
      const rate = -(a.vx * uax + a.vy * uay) - (b.vx * ubx + b.vy * uby);
      let dj = (rate + beta * C * 0.5) / (ia + ib); const nj = r.rod ? R.j + dj : Math.max(0, R.j + dj); dj = nj - R.j; R.j = nj;
      a.vx += dj * uax * ia; a.vy += dj * uay * ia; b.vx += dj * ubx * ib; b.vy += dj * uby * ib;
      R.ua = [uax, uay]; R.ub = [ubx, uby];
    }
  }
  for (const c of cons) { if (c.jn <= 1e-9 && c.pen < 0) continue; phAdd(c.b, 'N', c.jn * c.nx / dt, c.jn * c.ny / dt); if (Math.abs(c.jt) > 1e-9) phAdd(c.b, 'f', c.jt * -c.ny / dt, c.jt * c.nx / dt); if (c.jn > 1e-9) c.b.contact = c.s; }
  for (const c of hcs) { if (c.jn <= 1e-9) continue; phAdd(c.b, 'N', c.jn * c.nx / dt, c.jn * c.ny / dt); if (Math.abs(c.jt) > 1e-9) phAdd(c.b, 'f', c.jt * -c.ny / dt, c.jt * c.nx / dt); c.b.contact = c.s; }
  for (const R of ropes) if (R.j && R.ua) { if (!R.a.fixed) phAdd(R.a, 'T', R.j * R.ua[0] / dt, R.j * R.ua[1] / dt); if (!R.b.fixed) phAdd(R.b, 'T', R.j * R.ub[0] / dt, R.j * R.ub[1] / dt); }
  for (const b of B) {
    if (b.fixed) continue;
    const ax0 = b.vx, ay0 = b.vy; b.x += b.vx * dt; b.y += b.vy * dt;
    let fx = 0, fy = 0; for (const v of Object.values(b.F)) { fx += v[0]; fy += v[1]; } b.F.net = [fx, fy]; b.ax = fx / b.m; b.ay = fy / b.m;
    if (b.hull) { b.ang += b.om * dt; b.om *= 0.9997; }
    else if (b.contact) { const s = b.contact; b.ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1); if (Math.abs(b.ang) > Math.PI / 2) b.ang += Math.PI; }
    void ax0; void ay0;
  }
  for (const c of cons) if (c.pen > 0) { c.b.x += c.nx * c.pen * 0.6; c.b.y += c.ny * c.pen * 0.6; }
  { const deep = new Map(); for (const c of hcs) if (c.pen > 0.002 && (!deep.has(c.b) || deep.get(c.b).pen < c.pen)) deep.set(c.b, c); for (const c of deep.values()) { const k = Math.min(c.pen - 0.002, 0.02) * 0.6; c.b.x += c.nx * k; c.b.y += c.ny * k; } }
  for (const r of sp.ropes) { if (r.via || r.a || !r.b) continue; const b = phBody(st, r.b); if (b && (b.img || b.ink) && !b.contact) { b.ang = Math.atan2(b.x - r.ax, -(b.y - r.ay)); b.om = 0; } }
  st.t += dt;
}
function phBounds(sp, st) {
  let x0 = sp.world.x0, y0 = sp.world.y0;
  const p = !sp.bare && st.bodies.find((b) => b.shape === 'person' && ['walk', 'run', 'longjump'].includes(b.act)); if (p) x0 = Math.max(x0, p.x - sp.world.w * 0.35);
  const x1 = x0 + sp.world.w, y1 = y0 + sp.world.h; return [x0, y0, x1, y1];
}
function phDraw(c, w, h, sp, st, rt) {
  const [x0, y0, x1, y1] = phBounds(sp, st), pad = sp.bare ? 0 : 16, sc = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0));
  const ox = pad + ((w - 2 * pad) - (x1 - x0) * sc) / 2, oy = pad + ((h - 2 * pad) - (y1 - y0) * sc) / 2;
  const X = (x) => ox + (x - x0) * sc, Y = (y) => h - oy - (y - y0) * sc; rt.map = { X, Y, sc, x0, y0, ox, oy, h };
  /* fields */
  const fl = sp.fields;
  if (fl.E && (fl.E[0] || fl.E[1])) { c.strokeStyle = 'rgba(224,161,0,0.35)'; c.lineWidth = 1.2; const L = Math.hypot(fl.E[0], fl.E[1]), ux = fl.E[0] / L, uy = fl.E[1] / L; for (let i = 1; i < 6; i++) for (let j = 1; j < 4; j++) { const px = ox + (w - 2 * ox) * i / 6, py = oy + (h - 2 * oy) * j / 4; scArrow(c, px - ux * 14, py + uy * 14, px + ux * 14, py - uy * 14, 'rgba(224,161,0,0.45)', 1.2, 6); } c.fillStyle = '#B07D00'; c.font = '13px Sarabun, sans-serif'; c.fillText('สนามไฟฟ้า E', 10, 18); }
  if (fl.B) { c.fillStyle = 'rgba(14,154,167,0.45)'; c.font = '14px sans-serif'; for (let i = 1; i < 8; i++) for (let j = 1; j < 5; j++) { const px = ox + (w - 2 * ox) * i / 8, py = oy + (h - 2 * oy) * j / 5; c.fillText(fl.B > 0 ? '•' : '×', px - 3, py + 4); } c.fillStyle = '#0B7480'; c.font = '13px Sarabun, sans-serif'; c.fillText('สนามแม่เหล็ก B ' + (fl.B > 0 ? 'พุ่งออกจากจอ' : 'พุ่งเข้าจอ'), 10, fl.E ? 36 : 18); }
  if (fl.central) { const cx = X(fl.central.x), cy = Y(fl.central.y), r = Math.max(6, fl.central.r * sc); const gr = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r); gr.addColorStop(0, '#FFE08A'); gr.addColorStop(1, '#E39B2D'); c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.fill(); if (fl.central.label) { c.fillStyle = '#7A4A0C'; c.font = '13px Sarabun, sans-serif'; c.fillText(fl.central.label, cx + r + 4, cy - r); } }
  /* surfaces with hatching */
  for (const s of sp.bare ? [] : sp.surfaces) {
    c.strokeStyle = '#3B4350'; c.lineWidth = 3; c.beginPath(); c.moveTo(X(s.x1), Y(s.y1)); c.lineTo(X(s.x2), Y(s.y2)); c.stroke();
    const L = Math.hypot(X(s.x2) - X(s.x1), Y(s.y2) - Y(s.y1)), n = Math.floor(L / 12), dx = (X(s.x2) - X(s.x1)) / L, dy = (Y(s.y2) - Y(s.y1)) / L;
    c.strokeStyle = 'rgba(59,67,80,0.35)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i <= n; i++) { const px = X(s.x1) + dx * i * 12, py = Y(s.y1) + dy * i * 12; c.moveTo(px, py); c.lineTo(px - 7 * dy - 5 * dx, py + 7 * dx - 5 * dy); } c.stroke();
    if (s.mu || s.mus) { c.fillStyle = '#5A6472'; c.font = '12px Sarabun, sans-serif'; c.fillText('μ = ' + fmtNum(s.mu), (X(s.x1) + X(s.x2)) / 2 + 6, (Y(s.y1) + Y(s.y2)) / 2 + 18); }
  }
  /* springs and ropes */
  for (const s of sp.springs) { const a = phEnd(st, s.a, s.ax, s.ay), b = phEnd(st, s.b, s.ax, s.ay); scSpring(c, X(a.x), Y(a.y), X(b.x), Y(b.y)); if (a.fixed) scPin(c, X(a.x), Y(a.y)); if (b.fixed) scPin(c, X(b.x), Y(b.y)); }
  for (const r of sp.ropes) {
    const a = phEnd(st, r.a, r.ax, r.ay), b = phEnd(st, r.b, r.ax, r.ay);
    const ta = r.via && phTan(r, a, b), tb = r.via && phTan(r, b, a), pr = Math.max(9, (r.pr || 0) * sc);
    if (r.via) { c.fillStyle = '#FFFFFF'; c.strokeStyle = '#3B4350'; c.lineWidth = 2; c.beginPath(); c.arc(X(r.via[0]), Y(r.via[1]), pr, 0, 6.283); c.fill(); c.stroke(); c.beginPath(); c.arc(X(r.via[0]), Y(r.via[1]), 3, 0, 6.283); c.fillStyle = '#3B4350'; c.fill(); }
    c.strokeStyle = r.rod ? '#3B4350' : '#6B5B45'; c.lineWidth = r.rod ? 3 : 1.6; c.beginPath();
    if (r.via) { c.moveTo(X(a.x), Y(a.y)); c.lineTo(X(ta[0]), Y(ta[1])); c.arc(X(r.via[0]), Y(r.via[1]), pr, ta[0] < r.via[0] ? Math.PI : 0, tb[0] < r.via[0] ? Math.PI : 0, ta[0] > r.via[0]); c.lineTo(X(b.x), Y(b.y)); }
    else { c.moveTo(X(a.x), Y(a.y)); c.lineTo(X(b.x), Y(b.y)); }
    c.stroke();
    if (a.fixed && !r.a) scPin(c, X(a.x), Y(a.y)); if (b.fixed && !r.b) scPin(c, X(b.x), Y(b.y));
  }
  /* trails */
  if (sp.show.trail) for (const b of st.bodies) { if (b.trail.length < 2) continue; c.strokeStyle = b.color + '55'; c.lineWidth = 2; c.setLineDash([3, 4]); c.beginPath(); b.trail.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])))); c.stroke(); c.setLineDash([]); }
  /* bodies */
  for (const b of st.bodies) {
    if (b.ink && rt.inkDraw) { rt.inkDraw(c, b, X, Y); continue; }
    if (b.shape === 'person') { psDraw(c, b, X, Y, sc); continue; }
    const bx = X(b.x), by = Y(b.y);
    if (b.img) { const im = scSprite(b.img), ww = Math.max(10, b.w * sc), hh = Math.max(8, b.h * sc); c.save(); c.translate(bx, by); c.rotate(-b.ang); if (im) c.drawImage(im, -ww / 2, -hh / 2, ww, hh); else { c.setLineDash([4, 3]); c.strokeStyle = '#9AA3B2'; c.strokeRect(-ww / 2, -hh / 2, ww, hh); c.setLineDash([]); } c.restore(); continue; }
    c.save(); c.translate(bx, by); c.rotate(-b.ang);
    const grad = c.createLinearGradient(0, -20, 0, 20); grad.addColorStop(0, scTint(b.color, 0.35)); grad.addColorStop(1, b.color);
    c.fillStyle = grad; c.strokeStyle = scTint(b.color, -0.35); c.lineWidth = 1.6;
    if (b.shape === 'ball') { c.beginPath(); c.arc(0, 0, Math.max(5, b.r * sc), 0, 6.283); c.fill(); c.stroke(); }
    else { const ww = Math.max(10, b.w * sc), hh = Math.max(8, b.h * sc); scRound(c, -ww / 2, -hh / 2, ww, hh, 4); c.fill(); c.stroke(); }
    c.restore();
    c.fillStyle = '#FFFFFF'; c.font = 'bold 12px Sarabun, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.label.slice(0, 6), bx, by); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    if (b.shape === 'person') continue;
    if (b.q) { c.fillStyle = b.q > 0 ? '#C2410C' : '#1F6FD1'; c.font = 'bold 13px sans-serif'; c.fillText(b.q > 0 ? '+' : '−', bx + Math.max(6, (b.shape === 'ball' ? b.r : b.w / 2) * sc) + 2, by - 6); }
  }
  /* free-body diagrams */
  const fs = rt.fscale; const used = new Set();
  for (const b of st.bodies) {
    if (b.fixed) continue; const bx = X(b.x), by = Y(b.y);
    if (sp.show.fbd) for (const [k, v] of Object.entries(b.F)) {
      if (k === 'net') continue; const L = Math.hypot(v[0], v[1]); if (L < 1e-9 || L * fs < 3) continue; used.add(k);
      const at = b.shape === 'person' && (k === 'N' || k === 'f') && b.foot ? [X(b.foot[0]), Y(b.foot[1])] : [bx, by];
      const ex = at[0] + v[0] * fs, ey = at[1] - v[1] * fs; scArrow(c, at[0], at[1], ex, ey, SC_COL[k] || '#333', 2.6, 9);
      scLabel(c, SC_SYM[k] || k, ex + (v[0] >= 0 ? 4 : -22), ey + (v[1] >= 0 ? -4 : 14), SC_COL[k]);
    }
    if (sp.show.net && b.F.net) { const v = b.F.net; if (Math.hypot(v[0], v[1]) * fs > 3) { c.setLineDash([6, 4]); scArrow(c, bx, by, bx + v[0] * fs, by - v[1] * fs, SC_COL.net, 2, 9); c.setLineDash([]); used.add('net'); } }
    if (sp.show.v) { const vs = rt.vscale; if (Math.hypot(b.vx, b.vy) * vs > 3) { scArrow(c, bx, by, bx + b.vx * vs, by - b.vy * vs, SC_COL.v, 2, 8); scLabel(c, 'v', bx + b.vx * vs + 4, by - b.vy * vs - 4, SC_COL.v); } }
    if (sp.show.a && b.ax != null) { const as = rt.ascale; if (Math.hypot(b.ax, b.ay) * as > 3) { scArrow(c, bx, by, bx + b.ax * as, by - b.ay * as, SC_COL.a, 2, 8); scLabel(c, 'a', bx + b.ax * as + 4, by - b.ay * as - 4, SC_COL.a); } }
  }
  /* legend */
  if (sp.show.fbd && used.size && !sp.bare) { let lx = w - 8, ly = 16; c.font = '12px Sarabun, sans-serif'; for (const k of [...used]) { const t = SC_FNAME[k] || k, tw = c.measureText(t).width; c.fillStyle = SC_COL[k] || '#333'; c.fillRect(lx - tw - 18, ly - 8, 10, 3); c.fillStyle = '#3B4350'; c.fillText(t, lx - tw, ly - 3); ly += 16; } }
  if (sp.show.energy) phEnergy(c, w, h, sp, st);
}
function phEnergy(c, w, h, sp, st) {
  let K = 0, U = 0, Us = 0; const g = sp.world.g;
  for (const b of st.bodies) if (!b.fixed) { K += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy); U += b.m * g * (b.y - sp.world.y0); }
  for (const s of sp.springs) { const a = phEnd(st, s.a, s.ax, s.ay), b = phEnd(st, s.b, s.ax, s.ay); const x = Math.hypot(b.x - a.x, b.y - a.y) - s.L0; Us += 0.5 * s.k * x * x; }
  const E = K + U + Us, mx = Math.max(Math.abs(E), K, U + Us, 1e-9) * 1.1, bw = 16, bh = 80, x = 12, y = h - 18;
  [['Ek', K, '#2F4BB8'], ['Ep', U, '#2E8B57'], ['Es', Us, '#D14D8B'], ['E', E, '#14181F']].forEach(([n, v, col], i) => { const hh = Math.max(0, v) / mx * bh; c.fillStyle = col; c.fillRect(x + i * (bw + 8), y - hh, bw, hh); c.fillStyle = '#3B4350'; c.font = '11px sans-serif'; c.fillText(n, x + i * (bw + 8), y + 12); });
}
/* ---------- particles (chemistry) and agents (biology) ---------- */
function ptInit(sp) {
  const st = { t: 0, P: [], hist: [], wallJ: 0, wallT: 0, press: 0, born: 0, mx: sp.membrane ? sp.membrane.x : 0, mv: 0, gone0: {} };
  const W = sp.box.w, H = sp.box.h, mx = sp.membrane ? sp.membrane.x * W : null;
  sp.species.forEach((s, si) => { for (let i = 0; i < s.n; i++) st.P.push(ptMake(sp, si, s.side === 'left' && mx ? [1.5, mx - 1.5] : s.side === 'right' && mx ? [mx + 1.5, W - 1.5] : [1.5, W - 1.5], H)); });
  return st;
}
function ptMake(sp, si, xr, H) {
  const s = sp.species[si], a = Math.random() * 6.283, v = s.agent ? s.speed : (s.fixed ? 0 : ptSpeed(sp, s) * (0.6 + Math.random() * 0.8));
  return { s: si, x: xr[0] + Math.random() * (xr[1] - xr[0]), y: s.r + Math.random() * (H - 2 * s.r), vx: v * Math.cos(a), vy: v * Math.sin(a), en: s.agent ? s.birth * 0.6 : 0, age: 0 };
}
const ptSpeed = (sp, s) => 12 * Math.sqrt((sp.T / 300) / s.m);
function ptStep(sp, st, dt) {
  const W = sp.box.w, H = sp.box.h, P = st.P, S = sp.species, mx = sp.membrane ? st.mx * W : null;
  const idx = new Map(S.map((s, i) => [s.id, i]));
  /* agents steer, burn energy, age, reproduce; plants regrow */
  const born = [];
  for (const p of P) {
    const s = S[p.s]; if (!s.agent) continue; p.age += dt; p.en -= s.burn * dt;
    const a = Math.atan2(p.vy, p.vx) + (Math.random() - 0.5) * 1.6 * dt * 4; p.vx = s.speed * Math.cos(a); p.vy = s.speed * Math.sin(a);
    if (s.birth && p.en >= s.birth && P.length + born.length < 400 && P.filter((q) => q.s === p.s).length < s.cap) { p.en /= 2; born.push(Object.assign({}, p, { vx: -p.vx, vy: -p.vy, age: 0 })); }
  }
  for (const s of S) if (s.regrow && !s.agent) { const si = idx.get(s.id), n = P.filter((p) => p.s === si).length; if (n < s.cap && Math.random() < s.regrow * dt) born.push(ptMake(sp, si, [1.5, W - 1.5], H)); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i], s = S[p.s]; if (s.agent && (p.en <= 0 || (s.life && p.age > s.life))) P.splice(i, 1); }
  /* a species that died out here comes back from outside now and then (a small population would otherwise vanish by chance) */
  S.forEach((s, si) => { if (!s.agent || !s.immigrate) return; if (P.some((p) => p.s === si)) { st.gone0[si] = 0; return; } st.gone0[si] = (st.gone0[si] || 0) + dt; if (st.gone0[si] > 4) { st.gone0[si] = 0; P.push(ptMake(sp, si, [1.5, W - 1.5], H)); } });
  P.push(...born);
  /* unimolecular reactions (decay, back reactions, enzyme releasing product) */
  const split = [];
  for (const r of sp.reactions) if (r.from.length === 1 && r.k) { const si = idx.get(r.from[0]), t0 = idx.get(r.to[0]); if (si == null || t0 == null) continue; for (const p of P) if (p.s === si && Math.random() < r.k * dt) { p.s = t0; if (r.to[1] != null && idx.has(r.to[1])) split.push(Object.assign({}, p, { s: idx.get(r.to[1]), vx: -p.vy, vy: p.vx, x: p.x + 0.5 })); } }
  P.push(...split);
  /* move and bounce off walls and the membrane */
  for (const p of P) {
    const s = S[p.s]; if (s.fixed) continue; const ox = p.x; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < s.r) { p.x = s.r; if (p.vx < 0) { st.wallJ += 2 * s.m * -p.vx; p.vx = -p.vx; } } if (p.x > W - s.r) { p.x = W - s.r; if (p.vx > 0) { st.wallJ += 2 * s.m * p.vx; p.vx = -p.vx; } }
    if (p.y < s.r) { p.y = s.r; if (p.vy < 0) { st.wallJ += 2 * s.m * -p.vy; p.vy = -p.vy; } } if (p.y > H - s.r) { p.y = H - s.r; if (p.vy > 0) { st.wallJ += 2 * s.m * p.vy; p.vy = -p.vy; } }
    if (mx != null && (ox - mx) * (p.x - mx) < 0 && !sp.membrane.pass.includes(s.id)) {
      p.x = ox;
      if (sp.membrane.move) { const M = 60, v0 = p.vx, v1 = 2 * st.mv - v0; st.mv += s.m * (v0 - v1) / M; p.vx = v1; } else p.vx = -p.vx;
    }
  }
  /* collisions on a grid; reactions happen only when the collision is hard enough (activation energy) */
  const cell = 6, grid = new Map(), key = (x, y) => (x * 1000 + y);
  P.forEach((p, i) => { const k = key(Math.floor(p.x / cell), Math.floor(p.y / cell)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); });
  const gone = new Set(), add = [];
  P.forEach((p, i) => {
    if (gone.has(i)) return; const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) for (const j of grid.get(key(gx, gy)) || []) {
      if (j <= i || gone.has(j) || gone.has(i)) continue; const q = P[j], sa = S[p.s], sb = S[q.s];
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), rr = sa.r + sb.r; if (d >= rr || d < 1e-9) continue;
      const nx = dx / d, ny = dy / d;
      /* eating */
      if (sa.agent && sa.eats.includes(sb.id)) { p.en += sa.gain; gone.add(j); continue; }
      if (sb.agent && sb.eats.includes(sa.id)) { q.en += sb.gain; gone.add(i); continue; }
      const vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny; if (vn > 0) continue;
      const rx = sp.reactions.find((r) => r.from.length === 2 && ((r.from[0] === sa.id && r.from[1] === sb.id) || (r.from[0] === sb.id && r.from[1] === sa.id)));
      const mu = sa.m * sb.m / (sa.m + sb.m), Ecol = 0.5 * mu * vn * vn, kT = 0.5 * 144 / 1; /* energy of a typical collision at 300 K in these units */
      if (rx && Ecol > rx.Ea * kT * 0.5) {
        const t0 = idx.get(rx.to[0]), t1 = rx.to[1] != null ? idx.get(rx.to[1]) : null; if (t0 == null) continue;
        if (t1 == null) { const M = sa.m + sb.m; add.push({ s: t0, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, vx: (sa.m * p.vx + sb.m * q.vx) / M, vy: (sa.m * p.vy + sb.m * q.vy) / M, en: 0, age: 0 }); gone.add(i); gone.add(j); }
        else { p.s = t0; q.s = t1; }
        continue;
      }
      if (sa.agent || sb.agent) continue;
      const ia = sa.fixed ? 0 : 1 / sa.m, ib = sb.fixed ? 0 : 1 / sb.m; const jn = -2 * vn / (ia + ib || 1);
      p.vx -= jn * nx * ia; p.vy -= jn * ny * ia; q.vx += jn * nx * ib; q.vy += jn * ny * ib;
      const push = (rr - d) / 2; if (ia) { p.x -= nx * push; p.y -= ny * push; } if (ib) { q.x += nx * push; q.y += ny * push; }
    }
  });
  if (gone.size) { const keep = P.filter((_, i) => !gone.has(i)); P.length = 0; P.push(...keep); }
  P.push(...add);
  /* thermostat keeps the set temperature (the heat bath around the box) */
  if (sp.thermostat) { let ke = 0, n = 0; for (const p of P) { const s = S[p.s]; if (s.fixed || s.agent) continue; ke += 0.5 * s.m * (p.vx * p.vx + p.vy * p.vy); n++; } if (n) { const tgt = n * 0.5 * 144 * (sp.T / 300), f = Math.sqrt(clamp(1 + 0.08 * (tgt / Math.max(ke, 1e-9) - 1), 0.8, 1.25)); for (const p of P) if (!S[p.s].fixed && !S[p.s].agent) { p.vx *= f; p.vy *= f; } } }
  if (sp.membrane && sp.membrane.move) { st.mv += -0.06 * (st.mx - sp.membrane.x) * dt * sp.box.w; st.mv *= 0.995; /* the stretched side pushes back (like water pressure in a column) */ st.mx = clamp(st.mx + st.mv * dt / W, 0.15, 0.85); if (st.mx <= 0.15 || st.mx >= 0.85) st.mv = 0; }
  st.wallT += dt; if (st.wallT > 0.5) { st.press = st.wallJ / st.wallT / (2 * (W + H)); st.wallJ = 0; st.wallT = 0; }
  st.t += dt;
}
function ptDraw(c, w, h, sp, st, rt) {
  const W = sp.box.w, H = sp.box.h, graphH = rt.showGraph ? Math.round(h * 0.32) : 0, ah = h - graphH - 8, sc = Math.min((w - 16) / W, (ah - 8) / H), ox = (w - W * sc) / 2, oy = 6;
  c.fillStyle = sp.domain === 'bio' ? '#F3F8EE' : '#F6F8FC'; c.fillRect(ox, oy, W * sc, H * sc); c.strokeStyle = '#3B4350'; c.lineWidth = 2; c.strokeRect(ox, oy, W * sc, H * sc);
  if (sp.membrane) { const mx = ox + (st.mx || sp.membrane.x) * W * sc; c.strokeStyle = '#B8860B'; c.lineWidth = 3; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(mx, oy); c.lineTo(mx, oy + H * sc); c.stroke(); c.setLineDash([]); c.fillStyle = '#8A5A0C'; c.font = '12px Sarabun, sans-serif'; c.fillText('เยื่อเลือกผ่าน', mx + 4, oy + 14); }
  for (const p of st.P) {
    const s = sp.species[p.s], px = ox + p.x * sc, py = oy + (H - p.y) * sc, r = Math.max(2, s.r * sc);
    const gr = c.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.15, px, py, r); gr.addColorStop(0, scTint(s.color, 0.5)); gr.addColorStop(1, s.color); c.fillStyle = gr;
    c.beginPath(); if (s.agent) { const a = Math.atan2(-p.vy, p.vx); c.ellipse(px, py, r * 1.3, r * 0.9, a, 0, 6.283); } else c.arc(px, py, r, 0, 6.283); c.fill();
  }
  /* legend and counts */
  let lx = ox + 6, ly = oy + H * sc + 2; void ly;
  const counts = sp.species.map((_, i) => st.P.filter((p) => p.s === i).length);
  rt.read = sp.species.map((s, i) => [s.label, counts[i]]);
  if (sp.domain === 'chem') rt.read.push(['อุณหภูมิ', fmtNum(sp.T) + ' K']), rt.read.push(['ความดัน (สัมพัทธ์)', fmtNum(Math.round(st.press * 100))]);
  if (sp.membrane && sp.membrane.move) rt.read.push(['ปริมาตรซ้าย : ขวา', Math.round(st.mx * 100) + ' : ' + Math.round(100 - st.mx * 100)]);
  void lx;
  if (graphH) scGraph(c, 8, h - graphH, w - 16, graphH - 6, st.hist, sp.species.map((s) => s.color), sp.species.map((s) => s.label), 'เวลา', sp.domain === 'bio' ? 'จำนวน' : 'จำนวนอนุภาค');
}
/* ---------- maths ---------- */
function mtScope(sp, t) { return Object.assign({ t, pi: Math.PI, e: Math.E }, sp.vars || {}); }
function mtEval(expr, scope, rt) {
  if (!expr) return NaN; if (!window.math) return NaN;
  let f = rt.cache.get(expr); if (!f) { try { f = window.math.compile(expr); } catch (e) { f = { evaluate: () => NaN }; } rt.cache.set(expr, f); }
  try { const v = f.evaluate(scope); return typeof v === 'number' ? v : Number(v); } catch (e) { return NaN; }
}
function mtDraw(c, w, h, sp, st, rt) {
  const V = sp.view, X = (x) => (x - V.xmin) / (V.xmax - V.xmin) * w, Y = (y) => h - (y - V.ymin) / (V.ymax - V.ymin) * h;
  c.strokeStyle = '#EDF0F5'; c.lineWidth = 1; const stepx = scNice((V.xmax - V.xmin) / 12), stepy = scNice((V.ymax - V.ymin) / 8);
  c.beginPath(); for (let x = Math.ceil(V.xmin / stepx) * stepx; x <= V.xmax; x += stepx) { c.moveTo(X(x), 0); c.lineTo(X(x), h); } for (let y = Math.ceil(V.ymin / stepy) * stepy; y <= V.ymax; y += stepy) { c.moveTo(0, Y(y)); c.lineTo(w, Y(y)); } c.stroke();
  c.strokeStyle = '#8A93A3'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, Y(0)); c.lineTo(w, Y(0)); c.moveTo(X(0), 0); c.lineTo(X(0), h); c.stroke();
  c.fillStyle = '#8A93A3'; c.font = '11px sans-serif';
  const ex = Math.max(1, Math.ceil(34 / Math.max(1, X(stepx) - X(0)))), ey = Math.max(1, Math.ceil(18 / Math.max(1, Y(0) - Y(stepy))));
  for (let i = Math.ceil(V.xmin / stepx); i * stepx <= V.xmax; i++) if (i && i % ex === 0) c.fillText(fmtNum(+(i * stepx).toFixed(6)), X(i * stepx) + 2, clamp(Y(0) + 12, 12, h - 2));
  for (let i = Math.ceil(V.ymin / stepy); i * stepy <= V.ymax; i++) if (i && i % ey === 0) c.fillText(fmtNum(+(i * stepy).toFixed(6)), clamp(X(0) + 3, 2, w - 30), Y(i * stepy) - 2);
  const t = st.t, sc = mtScope(sp, t); rt.read = [['t', fmtNum(+t.toFixed(2))]].concat(Object.entries(sp.vars || {}).map(([k, v]) => [k, fmtNum(v)]));
  const funcs = sp.items.filter((x) => x.type === 'func');
  const fy = (it, x) => mtEval(it.expr, Object.assign({}, sc, { x }), rt);
  for (const it of sp.items) {
    c.strokeStyle = it.color; c.fillStyle = it.color; c.lineWidth = 2.4;
    if (it.type === 'func') { c.beginPath(); let pen = false; for (let i = 0; i <= 400; i++) { const x = V.xmin + (V.xmax - V.xmin) * i / 400, y = fy(it, x); if (!isFinite(y) || Math.abs(y) > 1e6) { pen = false; continue; } pen ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)); pen = true; } c.stroke(); if (it.label) scLabel(c, it.label, w - 70, Y(fy(it, V.xmax - (V.xmax - V.xmin) * 0.08)) - 6, it.color); }
    else if (it.type === 'curve') { const a = it.tmin ? mtEval(it.tmin, sc, rt) : sp.t.min, b = it.tmax ? mtEval(it.tmax, sc, rt) : t; c.beginPath(); for (let i = 0; i <= 300; i++) { const u = a + (b - a) * i / 300, s2 = Object.assign({}, sc, { t: u }), x = mtEval(it.x, s2, rt), y = mtEval(it.y, s2, rt); i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)); } c.stroke(); }
    else if (it.type === 'point') { const x = mtEval(it.x, sc, rt), y = mtEval(it.y, sc, rt); if (isFinite(x) && isFinite(y)) { if (it.trace) { const tr = rt.traces[sp.items.indexOf(it)] || (rt.traces[sp.items.indexOf(it)] = []); tr.push([x, y]); if (tr.length > 600) tr.shift(); c.globalAlpha = 0.45; c.beginPath(); tr.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])))); c.stroke(); c.globalAlpha = 1; } c.beginPath(); c.arc(X(x), Y(y), 6, 0, 6.283); c.fill(); if (it.label) scLabel(c, it.label, X(x) + 8, Y(y) - 8, it.color); rt.read.push([it.label || 'จุด', '(' + fmtNum(+x.toFixed(3)) + ', ' + fmtNum(+y.toFixed(3)) + ')']); } }
    else if (it.type === 'segment' || it.type === 'vector') { const x1 = mtEval(it.x1, sc, rt), y1 = mtEval(it.y1, sc, rt), x2 = mtEval(it.x2, sc, rt), y2 = mtEval(it.y2, sc, rt); if ([x1, y1, x2, y2].every(isFinite)) { if (it.type === 'vector') scArrow(c, X(x1), Y(y1), X(x2), Y(y2), it.color, 2.4, 10); else { c.beginPath(); c.moveTo(X(x1), Y(y1)); c.lineTo(X(x2), Y(y2)); c.stroke(); } if (it.label) scLabel(c, it.label, (X(x1) + X(x2)) / 2 + 6, (Y(y1) + Y(y2)) / 2 - 6, it.color); } }
    else if (it.type === 'tangent') { const f = funcs[it.of] || funcs[0]; if (!f) continue; const x0 = mtEval(it.at || 't', sc, rt), h2 = 1e-4, y0 = fy(f, x0), m = (fy(f, x0 + h2) - fy(f, x0 - h2)) / (2 * h2); if (isFinite(m)) { c.setLineDash([6, 4]); c.beginPath(); c.moveTo(X(V.xmin), Y(y0 + m * (V.xmin - x0))); c.lineTo(X(V.xmax), Y(y0 + m * (V.xmax - x0))); c.stroke(); c.setLineDash([]); c.beginPath(); c.arc(X(x0), Y(y0), 5, 0, 6.283); c.fill(); rt.read.push(['ความชัน', fmtNum(+m.toFixed(3))]); } }
    else if (it.type === 'area') { const f = funcs[it.of] || funcs[0]; if (!f) continue; const a = mtEval(it.a || '0', sc, rt), b = mtEval(it.b || 't', sc, rt), n = Math.round(mtEval(it.n || '0', sc, rt) || 0); c.globalAlpha = 0.25; let sum = 0;
      if (n > 0) { const dx = (b - a) / n; for (let i = 0; i < n; i++) { const x = a + i * dx, y = fy(f, x); sum += y * dx; c.fillRect(Math.min(X(x), X(x + dx)), Math.min(Y(0), Y(y)), Math.abs(X(x + dx) - X(x)), Math.abs(Y(y) - Y(0))); } }
      else { c.beginPath(); c.moveTo(X(a), Y(0)); for (let i = 0; i <= 200; i++) { const x = a + (b - a) * i / 200, y = fy(f, x); c.lineTo(X(x), Y(y)); if (i) sum += (y + fy(f, a + (b - a) * (i - 1) / 200)) / 2 * (b - a) / 200; } c.lineTo(X(b), Y(0)); c.closePath(); c.fill(); }
      c.globalAlpha = 1; rt.read.push(['พื้นที่', fmtNum(+sum.toFixed(3))]); }
    else if (it.type === 'text') { const x = mtEval(it.x, sc, rt), y = mtEval(it.y, sc, rt); if (isFinite(x) && isFinite(y)) scLabel(c, it.text, X(x), Y(y), it.color); }
  }
}
function scNice(raw) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-12)))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }

/* ---------- drawing helpers ---------- */
function scArrow(c, x1, y1, x2, y2, col, lw, head) {
  const L = Math.hypot(x2 - x1, y2 - y1); if (L < 1) return; const ux = (x2 - x1) / L, uy = (y2 - y1) / L, hd = Math.min(head || 9, L * 0.5);
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw || 2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - ux * hd * 0.8, y2 - uy * hd * 0.8); c.stroke();
  c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - ux * hd - uy * hd * 0.5, y2 - uy * hd + ux * hd * 0.5); c.lineTo(x2 - ux * hd + uy * hd * 0.5, y2 - uy * hd - ux * hd * 0.5); c.closePath(); c.fill();
}
function scLabel(c, t, x, y, col) { c.font = 'italic bold 14px "Times New Roman", serif'; c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.strokeText(t, x, y); c.fillStyle = col || '#14181F'; c.fillText(t, x, y); }
function scSpring(c, x1, y1, x2, y2) { const L = Math.hypot(x2 - x1, y2 - y1), n = 12, ux = (x2 - x1) / (L || 1), uy = (y2 - y1) / (L || 1), A = 7; c.strokeStyle = '#D14D8B'; c.lineWidth = 2; c.beginPath(); c.moveTo(x1, y1); for (let i = 1; i < n; i++) { const t = i / n, s = i % 2 ? A : -A; c.lineTo(x1 + ux * L * t - uy * s, y1 + uy * L * t + ux * s); } c.lineTo(x2, y2); c.stroke(); }
function scPin(c, x, y) { c.fillStyle = '#3B4350'; c.beginPath(); c.arc(x, y, 4, 0, 6.283); c.fill(); c.strokeStyle = 'rgba(59,67,80,0.4)'; c.lineWidth = 1; c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(x + i * 5 - 4, y - 8); c.lineTo(x + i * 5 + 4, y - 14); } c.stroke(); c.beginPath(); c.moveTo(x - 14, y - 8); c.lineTo(x + 14, y - 8); c.strokeStyle = '#3B4350'; c.lineWidth = 2; c.stroke(); }
function scRound(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function scTint(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; if (k > 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; } return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')'; }
function scGraph(c, x, y, w, h, hist, cols, names, xn, yn) {
  c.fillStyle = '#FFFFFF'; c.fillRect(x, y, w, h); c.strokeStyle = '#D6DCE4'; c.lineWidth = 1; c.strokeRect(x, y, w, h);
  c.fillStyle = '#5A6472'; c.font = '11px Sarabun, sans-serif'; c.fillText(yn, x + 4, y + 12); c.fillText(xn, x + w - 30, y + h - 4);
  if (hist.length < 2) return; let mx = 1e-9, mn = 0; for (const r of hist) for (let k = 1; k < r.length; k++) { if (isFinite(r[k])) { mx = Math.max(mx, r[k]); mn = Math.min(mn, r[k]); } }
  const t0 = hist[0][0], t1 = hist[hist.length - 1][0] || 1, pad = 16, X = (t) => x + 6 + (t - t0) / Math.max(t1 - t0, 1e-9) * (w - 12), Y = (v) => y + h - pad - (v - mn) / (mx - mn || 1) * (h - pad - 18);
  if (mn < 0) { c.strokeStyle = '#E3E7EE'; c.beginPath(); c.moveTo(x, Y(0)); c.lineTo(x + w, Y(0)); c.stroke(); }
  for (let k = 1; k < hist[0].length; k++) { c.strokeStyle = cols[k - 1] || '#333'; c.lineWidth = 2; c.beginPath(); hist.forEach((r, i) => (i ? c.lineTo(X(r[0]), Y(r[k])) : c.moveTo(X(r[0]), Y(r[k])))); c.stroke(); }
  let lx = x + 60; names.forEach((n, i) => { c.fillStyle = cols[i]; c.fillRect(lx, y + 6, 10, 3); c.fillStyle = '#3B4350'; c.fillText(n, lx + 14, y + 12); lx += c.measureText(n).width + 30; });
}

/* ---------- runtime: one animation loop for every model on the page ---------- */
function scRuntime(it) {
  let r = SCN.get(it.id);
  if (!r) { r = { playing: false, st: null, cache: new Map(), traces: {}, showGraph: true, read: [] }; SCN.set(it.id, r); }
  if (!r.st) scReset(it, r);
  return r;
}
function scReset(it, r) {
  const sp = it.spec; r.traces = {}; r.ended = false; r.E0 = null; r.mir = null; r.peek = 0; r.turning = null; r.turned = false; r.bind = null; r.back = null; r.roll = 0; r.lastPos = null;
  if (sp.dim === 3) { sc3Reset(sp, r); return; }
  if (sp.domain === 'phys') {
    r.st = phInit(sp);
    let maxF = 0; for (const b of r.st.bodies) if (!b.fixed) maxF = Math.max(maxF, b.m * sp.world.g, Math.hypot(...(sp.forces.find((f) => f.on === b.id) ? [sp.forces.find((f) => f.on === b.id).fx, sp.forces.find((f) => f.on === b.id).fy] : [0, 0])));
    if (sp.fields.central) for (const b of r.st.bodies) { const d = Math.hypot(b.x - sp.fields.central.x, b.y - sp.fields.central.y); maxF = Math.max(maxF, sp.fields.central.GM * b.m / Math.max(d * d, 1e-12)); }
    if (sp.fields.E) for (const b of r.st.bodies) maxF = Math.max(maxF, Math.abs(b.q) * Math.hypot(...sp.fields.E));
    if (sp.fields.B) for (const b of r.st.bodies) maxF = Math.max(maxF, Math.abs(b.q * sp.fields.B) * Math.hypot(b.vx, b.vy));
    for (const s of sp.springs) maxF = Math.max(maxF, s.k * sp.world.w * 0.3);
    const span = Math.min(sp.world.w, sp.world.h); r.fscale = 0; r.fmax = maxF || 1;
    let vmax = 0; for (const b of r.st.bodies) vmax = Math.max(vmax, Math.hypot(b.vx, b.vy)); r.vmax = vmax || Math.sqrt(sp.world.g * span) || 1; void span;
  } else if (sp.domain === 'math') { r.st = { t: sp.t.min }; }
  else r.st = ptInit(sp);
}
function scTick(ts) {
  scnRaf = 0; const dtw = scnLast ? Math.min(0.05, (ts - scnLast) / 1000) : 0.016; scnLast = ts; let any = false;
  for (const [id, r] of SCN) {
    if (!r.playing) continue; const it = findItem(id); if (!it) { r.playing = false; continue; }
    if (!r.cv || !r.cv.isConnected) continue;
    any = true; if (offView(r.cv)) continue; const sp = it.spec;
    if (sp.dim === 3) { sc3Tick(sp, r, dtw); scRender(it, r); continue; }
    if (sp.domain === 'phys') { if (r.turning != null) { r.turning += dtw / 0.4; if (r.turning >= 0.5 && !r.turned) { ipTurn(it, r); r.turned = true; } if (r.turning >= 1) { r.turning = null; r.turned = false; } scRender(it, r); continue; } if (r.peek) { r.peek -= dtw; if (r.peek <= 0) { r.peek = 0; r.turning = 0; r.turned = false; } scRender(it, r); continue; } const sim = dtw * (sp.speed || 1) * (r.slow ? 0.25 : 1), n = Math.max(1, Math.ceil(sim / 0.004)); for (let i = 0; i < n; i++) phStep(sp, r.st, sim / n); for (const b of r.st.bodies) { b.trail.push([b.x, b.y]); if (b.trail.length > 400) b.trail.shift(); }
      const pick = sp.show.graph; if (pick !== 'none') { r.st.hist.push([r.st.t].concat(r.st.bodies.filter((b) => !b.fixed).map((b) => pick === 'x' ? b.x : pick === 'y' ? b.y : pick === 'vx' ? b.vx : pick === 'vy' ? b.vy : pick === 'grf' ? (b.F.N ? b.F.N[1] : 0) : Math.hypot(b.vx, b.vy)))); if (r.st.hist.length > 600) r.st.hist.shift(); }
      const [x0, y0, x1, y1] = phBounds(sp, r.st), far = sp.bare ? 0.3 : Math.max(x1 - x0, y1 - y0) * 3; const edge = sp.bare && it.rig && it.rig.edge;
      if (sp.bare && it.rig && it.rig.kind === 'person') ipSense(it, r);
      if (edge && edge !== 'stay') ipEdge(it, r, x0, x1);
      else if (sp.bare && r.st.bodies.some((b) => b.shape === 'person' && (b.x < x0 - 0.5 || b.x > x1 + 0.5))) { r.playing = false; r.ended = true; } if (!r.st.bodies.some((b) => b.shape === 'person') && r.st.bodies.every((b) => b.fixed || b.x < x0 - far || b.x > x1 + far || b.y < y0 - far || b.y > y1 + far)) { r.playing = false; r.ended = true; } }
    else if (sp.domain === 'math') { r.st.t += dtw * sp.t.speed * (r.slow ? 0.25 : 1); if (r.st.t > sp.t.max) { if (sp.t.loop) { r.st.t = sp.t.min; r.traces = {}; } else { r.st.t = sp.t.max; r.playing = false; r.ended = true; } } }
    else { const sim = dtw * (r.slow ? 0.25 : 1), n = Math.max(1, Math.ceil(sim / 0.01)); for (let i = 0; i < n; i++) ptStep(sp, r.st, sim / n); if (!r.st.lastH || r.st.t - r.st.lastH > 0.2) { r.st.lastH = r.st.t; r.st.hist.push([r.st.t].concat(sp.species.map((_, i) => r.st.P.filter((p) => p.s === i).length))); if (r.st.hist.length > 500) r.st.hist.shift(); } }
    if (sp.bare && r.ended) { /* left the paper: come back to where it was drawn and, like a moving picture, play again */ scReset(it, r); r.playing = animOn(); const pb = itemsEl.querySelector('.item[data-id="' + id + '"] [data-s="play"]'); if (pb) pb.textContent = r.playing ? 'หยุด' : 'เล่น'; }
    scRender(it, r);
  }
  if (any) scnRaf = requestAnimationFrame(scTick); else scnLast = 0;
}
function scRender(it, r) {
  const cv = r.cv; if (!cv) return; const sp = it.spec;
  const w = cv.clientWidth || 520, h = cv.clientHeight || 320, dpr = Math.min(4, (window.devicePixelRatio || 1) * Math.max(1, (S.base || 1) * (S.zoom || 1)));
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  let c = cv.getContext('2d');
  if (sp.bare) { const cap = Math.min(dpr, Math.sqrt(9e6 / Math.max(1, w * h))); if (cv.width !== Math.round(w * cap) || cv.height !== Math.round(h * cap)) { cv.width = Math.round(w * cap); cv.height = Math.round(h * cap); } c.setTransform(cap, 0, 0, cap, 0, 0); c.clearRect(0, 0, w, h); }
  else if (sp.clean) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.setTransform(dpr, 0, 0, dpr, 0, 0); }
  else { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, w, h); }
  if (sp.dim === 3) { if (sc3Render(c, w, h, sp, r) === false) loadLib('math').then(() => scRender(it, r)).catch(() => {}); if (r.ro) r.ro.innerHTML = (r.read || []).map(([k, v]) => '<span><b>' + esc(String(k)) + '</b> ' + esc(String(v)) + '</span>').join(''); return; }
  if (sp.domain === 'phys') {
    const gh = sp.show.graph !== 'none' && r.showGraph && !sp.bare ? Math.round(h * 0.28) : 0, ah = h - gh;
    const span = Math.min(sp.world.w, sp.world.h), pxPerM = Math.min((w - 32) / sp.world.w, (ah - 32) / sp.world.h);
    r.fscale = (span * 0.22 * pxPerM) / (r.fmax || 1); r.vscale = (span * 0.25 * pxPerM) / (r.vmax || 1); r.ascale = (span * 0.22 * pxPerM) / Math.max(sp.world.g || 1, 1e-9);
    phDraw(c, w, ah, sp, r.st, r);
    const live = r.st.bodies.filter((b) => !b.fixed);
    r.read = [['t', fmtNum(+r.st.t.toFixed(2)) + ' s']].concat(live.slice(0, 3).map((b) => [b.label, 'v = ' + fmtNum(+Math.hypot(b.vx, b.vy).toFixed(2)) + ' m/s' + (b.ax != null ? ', a = ' + fmtNum(+Math.hypot(b.ax, b.ay).toFixed(2)) + ' m/s²' : '')]));
    for (const b of live.filter((x) => x.shape === 'person').slice(0, 2)) { const N = b.F.N ? b.F.N[1] : 0; r.read.push([b.label || 'คน', (b.kin ? b.kin.phase + ', ' : '') + 'แรงจากพื้น ' + fmtNum(Math.round(N)) + ' N = ' + fmtNum(+(N / (b.m * (sp.world.g || 9.8))).toFixed(2)) + ' เท่าของน้ำหนัก']); }
    if (sp.show.fbd) for (const b of live.slice(0, 2)) { const parts = Object.entries(b.F).filter(([k, v]) => k !== 'net' && Math.hypot(v[0], v[1]) > 1e-6).map(([k, v]) => (SC_SYM[k] || k) + ' ' + fmtNum(+Math.hypot(v[0], v[1]).toFixed(2))); if (parts.length) r.read.push(['แรงบน ' + b.label + ' (N)', parts.join(', ')]); }
    if (gh) scGraph(c, 8, ah + 2, w - 16, gh - 8, r.st.hist, live.map((b) => b.color), live.map((b) => b.label), 't (s)', { x: 'x (m)', y: 'y (m)', vx: 'vx (m/s)', vy: 'vy (m/s)', v: 'อัตราเร็ว (m/s)', grf: 'แรงปฏิกิริยาจากพื้น (N)' }[sp.show.graph] || '');
  } else if (sp.domain === 'math') {
    if (!window.math) { c.fillStyle = '#5A6472'; c.font = '14px Sarabun, sans-serif'; c.fillText('กำลังโหลดเครื่องคำนวณ', 16, 24); loadLib('math').then(() => scRender(it, r)).catch(() => {}); return; }
    mtDraw(c, w, h, sp, r.st, r);
  } else ptDraw(c, w, h, sp, r.st, r);
  if (r.ro) r.ro.innerHTML = (r.read || []).map(([k, v]) => '<span><b>' + esc(String(k)) + '</b> ' + esc(String(v)) + '</span>').join('');
}

/* ---------- the box on the page ---------- */
function buildScene(d, it, forExport) {
  it.spec = scClean(it.spec);
  const sp = it.spec, r = scRuntime(it);
  if (sp.bare) { d.classList.add('bare'); d.style.setProperty('--bh', (it.h || 400) + 'px'); r.inkDraw = (c, b, X, Y) => ipDrawInk(c, findItem(it.id) || it, r, b, X, Y); }
  const head = document.createElement('div'); head.className = 'gh';
  head.innerHTML = '<span></span>' + (forExport ? '' : '<span class="sbtns"><button type="button" data-s="play">เล่น</button><button type="button" data-s="reset">เริ่มใหม่</button><button type="button" data-s="slow" aria-pressed="false">ช้า</button>' + ((it.ink && it.ink.length) || (it.pics && it.pics.length) ? '<button type="button" data-s="back" title="เอาภาพเดิมกลับมาบนหน้า">คืนเป็นภาพวาด</button>' : '') + '</span>');
  head.firstChild.textContent = sp.title; d.appendChild(head);
  const cv = document.createElement('canvas'); cv.className = 'simcv scncv'; d.appendChild(cv); r.cv = cv;
  if (!forExport && sp.domain !== 'math') {
    const tg = document.createElement('div'); tg.className = 'scntog';
    const tog = (label, get, set) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = label; b.setAttribute('aria-pressed', get() ? 'true' : 'false'); b.onclick = () => { const live = findItem(it.id) || it; set(live.spec, !get(live.spec)); b.setAttribute('aria-pressed', get(live.spec) ? 'true' : 'false'); scRender(live, r); savePage(); }; tg.appendChild(b); };
    if (sp.domain === 'phys' && sp.dim === 3) {
      tog('แผนภาพแรง', (s) => (s || sp).show.fbd, (s, v) => { s.show.fbd = v; }); tog('แรงลัพธ์', (s) => (s || sp).show.net, (s, v) => { s.show.net = v; });
      tog('ความเร็ว', (s) => (s || sp).show.v, (s, v) => { s.show.v = v; }); tog('เส้นทาง', (s) => (s || sp).show.trail, (s, v) => { s.show.trail = v; });
    } else if (sp.domain === 'phys') {
      tog('แผนภาพแรง', (s) => (s || sp).show.fbd, (s, v) => { s.show.fbd = v; }); tog('แรงลัพธ์', (s) => (s || sp).show.net, (s, v) => { s.show.net = v; });
      tog('ความเร็ว', (s) => (s || sp).show.v, (s, v) => { s.show.v = v; }); tog('ความเร่ง', (s) => (s || sp).show.a, (s, v) => { s.show.a = v; });
      tog('พลังงาน', (s) => (s || sp).show.energy, (s, v) => { s.show.energy = v; }); tog('เส้นทาง', (s) => (s || sp).show.trail, (s, v) => { s.show.trail = v; });
      const gs = document.createElement('select'); gs.className = 'traysel'; gs.setAttribute('aria-label', 'กราฟ');
      for (const [k, n] of [['v', 'กราฟอัตราเร็ว'], ['x', 'กราฟตำแหน่ง x'], ['y', 'กราฟตำแหน่ง y'], ['vx', 'กราฟ vx'], ['vy', 'กราฟ vy'], ['grf', 'กราฟแรงปฏิกิริยาจากพื้น'], ['none', 'ไม่แสดงกราฟ']]) { const o = document.createElement('option'); o.value = k; o.textContent = n; if (sp.show.graph === k) o.selected = true; gs.appendChild(o); }
      gs.onchange = () => { const live = findItem(it.id) || it; live.spec.show.graph = gs.value; r.st.hist = []; scRender(live, r); savePage(); }; tg.appendChild(gs);
    } else { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = 'กราฟ'; b.setAttribute('aria-pressed', r.showGraph ? 'true' : 'false'); b.onclick = () => { r.showGraph = !r.showGraph; b.setAttribute('aria-pressed', r.showGraph ? 'true' : 'false'); scRender(findItem(it.id) || it, r); }; tg.appendChild(b); }
    d.appendChild(tg);
  }
  const ro = document.createElement('div'); ro.className = 'sro'; d.appendChild(ro); r.ro = ro;
  if (sp.note) { const hint = document.createElement('div'); hint.className = 'shint'; hint.textContent = sp.note; d.appendChild(hint); }
  const g = document.createElement('div'); g.className = 'gsl';
  for (const p of sp.params) {
    const v0 = scGet(sp, p.key); if (v0 == null || !isFinite(v0)) continue;
    const lab = document.createElement('span'); lab.textContent = p.label || p.key; const out = document.createElement('output'); out.textContent = fmtNum(v0);
    if (forExport) { g.append(lab, document.createElement('span'), out); continue; }
    const rg = document.createElement('input'); rg.type = 'range'; rg.min = p.min; rg.max = p.max; rg.step = p.step; rg.value = v0; rg.setAttribute('aria-label', p.label || p.key);
    rg.addEventListener('input', () => { const live = findItem(it.id); if (!live) return; scSet(live.spec, p.key, +rg.value); out.textContent = fmtNum(+rg.value); const R = scRuntime(live); if (live.spec.domain === 'math') { R.traces = {}; scRender(live, R); return; } if (live.spec.domain === 'chem' && p.key === 'T') { scRender(live, R); return; } scReset(live, R); scRender(live, R); });
    rg.addEventListener('change', () => savePage());
    g.append(lab, rg, out);
  }
  d.appendChild(g);
  /* paused: drag a body to put it somewhere else, then play */
  if (!forExport && sp.dim === 3) sc3Bind(cv, it, r);
  if (!forExport && sp.domain === 'phys' && sp.dim !== 3) {
    cv.addEventListener('pointerdown', (e) => {
      const live = findItem(it.id) || it, R = scRuntime(live); if (R.playing || !R.map) return;
      const rc = cv.getBoundingClientRect(), mx = (e.clientX - rc.left) * (cv.clientWidth / rc.width), my = (e.clientY - rc.top) * (cv.clientHeight / rc.height);
      const hit = R.st.bodies.find((b) => !b.fixed && Math.hypot(R.map.X(b.x) - mx, R.map.Y(b.y) - my) < 24); if (!hit) return;
      e.stopPropagation(); e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
      const move = (ev) => { const qx = (ev.clientX - rc.left) * (cv.clientWidth / rc.width), qy = (ev.clientY - rc.top) * (cv.clientHeight / rc.height); hit.x = R.map.x0 + (qx - R.map.ox) / R.map.sc; hit.y = R.map.y0 + (R.map.h - R.map.oy - qy) / R.map.sc; scRender(live, R); };
      const up = () => { cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); const b0 = live.spec.bodies.find((b) => b.id === hit.id); if (b0) { b0.x = +hit.x.toFixed(3); b0.y = +hit.y.toFixed(3); savePage(); } };
      cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up);
    });
  }
  if (forExport) { const tmp = { st: null, cache: new Map(), traces: {}, showGraph: false, read: [], cv, inkDraw: sp.bare ? (c, b, X, Y) => ipDrawInk(c, it, tmp, b, X, Y) : null }; SCN.set('__x' + it.id, tmp); scReset(it, tmp); if (sp.domain === 'math') tmp.st.t = (sp.t.min + sp.t.max) / 2; requestAnimationFrame(() => { scRender(it, tmp); SCN.delete('__x' + it.id); }); return; }
  requestAnimationFrame(() => scRender(findItem(it.id) || it, r));
  const pb = head.querySelector('[data-s="play"]'), rb = head.querySelector('[data-s="reset"]'), sb = head.querySelector('[data-s="slow"]');
  /* plays by itself when it first appears (unless every moving picture was stopped with the page button) */
  if (r.auto == null && !sp.bare) { r.auto = 1; if (animOn()) r.playing = true; }
  if (r.playing && !scnRaf) scnRaf = requestAnimationFrame(scTick);
  pb.textContent = r.playing ? 'หยุด' : 'เล่น'; sb.setAttribute('aria-pressed', r.slow ? 'true' : 'false');
  pb.onclick = () => { const live = findItem(it.id) || it, R = scRuntime(live); if (R.ended) { scReset(live, R); } R.playing = !R.playing; pb.textContent = R.playing ? 'หยุด' : 'เล่น'; if (R.playing && !scnRaf) scnRaf = requestAnimationFrame(scTick); };
  rb.onclick = () => { const live = findItem(it.id) || it, R = scRuntime(live); R.playing = false; scReset(live, R); pb.textContent = 'เล่น'; scRender(live, R); };
  sb.onclick = () => { r.slow = !r.slow; sb.setAttribute('aria-pressed', r.slow ? 'true' : 'false'); };
  const bk = head.querySelector('[data-s="back"]'); if (bk) bk.onclick = () => restoreInk(findItem(it.id));
  /* a model of orbitals, surfaces or curves can sit on the paper without its box; the box comes back from its small handle */
  const frameSwap = (v) => { const before = clone(S.page.items || []), items = clone(before), x = items.find((t) => t.id === it.id); if (!x) return; x.spec.clean = v; if (v) x.spec.pen = x.spec.pen !== false; setItems(items, before); };
  if (!forExport && !sp.bare && sp.dim === 3 && sp.domain === 'math' && !sp.clean) { const sb0 = head.querySelector('.sbtns'); const nf = document.createElement('button'); nf.type = 'button'; nf.textContent = 'ไม่มีกรอบ'; nf.title = 'วางบนกระดาษแบบไม่มีกรอบ ลงสีแบบสีไม้ ยังหมุนได้'; nf.onclick = () => frameSwap(true); sb0.appendChild(nf); }
  if (sp.clean && !forExport) {
    d.classList.add('clean');
    const hb = document.createElement('button'); hb.type = 'button'; hb.className = 'lifedot scnhandle cleandot no-ink'; hb.title = 'ปรับแบบจำลอง'; hb.setAttribute('aria-label', 'ปรับแบบจำลอง'); hb.setAttribute('aria-expanded', r.open ? 'true' : 'false');
    hb.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="5" cy="10" r="1.6" fill="currentColor"/><circle cx="10" cy="10" r="1.6" fill="currentColor"/><circle cx="15" cy="10" r="1.6" fill="currentColor"/></svg>';
    hb.addEventListener('pointerdown', (e) => e.stopPropagation());
    const pill = document.createElement('div'); pill.className = 'scnpill cleanpill no-ink'; pill.hidden = !r.open; pill.addEventListener('pointerdown', (e) => e.stopPropagation());
    hb.onclick = (e) => { e.stopPropagation(); r.open = !r.open; pill.hidden = !r.open; hb.setAttribute('aria-expanded', r.open ? 'true' : 'false'); };
    const sb2 = head.querySelector('.sbtns');
    sb2.querySelectorAll('[data-s="play"],[data-s="reset"],[data-s="slow"]').forEach((x) => { if (!sp.t || !sp.t.speed) x.hidden = true; });
    const pen = document.createElement('button'); pen.type = 'button'; pen.textContent = sp.pen ? 'สีเรียบ' : 'สีไม้'; pen.onclick = () => { const before = clone(S.page.items || []), items = clone(before), x = items.find((t) => t.id === it.id); if (!x) return; x.spec.pen = !x.spec.pen; setItems(items, before); };
    const fr = document.createElement('button'); fr.type = 'button'; fr.textContent = 'แสดงกรอบ'; fr.onclick = () => frameSwap(false);
    sb2.append(pen, fr);
    [...d.children].filter((x) => x !== cv).forEach((x) => pill.appendChild(x));
    d.appendChild(hb); d.appendChild(pill);
  }
  if (sp.bare) {
    /* a small floating bar beside the drawing instead of a box */
    /* folded away by default: only a small round button sits at the corner of the drawing; tap it for the controls */
    const DB = ipBox(it.ink || [], it.pics || []), hx = clamp(Math.round(DB[0] - (it.x || 0) - 34), 0, Math.max(0, (it.w || W) - 40)), hy = clamp(Math.round(DB[1] - (it.y || 0) - 34), 0, Math.max(0, (it.h || 400) - 40));
    const hb = document.createElement('button'); hb.type = 'button'; hb.className = 'lifedot scnhandle no-ink'; hb.title = 'ปรับภาพเคลื่อนไหว'; hb.setAttribute('aria-label', 'ปรับภาพเคลื่อนไหว'); hb.setAttribute('aria-expanded', r.open ? 'true' : 'false');
    hb.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z" fill="currentColor"/></svg>';
    hb.style.left = hx + 'px'; hb.style.top = hy + 'px'; hb.addEventListener('pointerdown', (e) => e.stopPropagation());
    const pill = document.createElement('div'); pill.className = 'scnpill no-ink'; pill.hidden = !r.open; pill.style.left = Math.min(hx, Math.max(0, (it.w || W) - 450)) + 'px'; pill.style.top = (hy + 34) + 'px';
    pill.addEventListener('pointerdown', (e) => e.stopPropagation());
    hb.onclick = (e) => { e.stopPropagation(); r.open = !r.open; pill.hidden = !r.open; hb.setAttribute('aria-expanded', r.open ? 'true' : 'false'); };
    if (r.auto == null) { r.auto = 1; if (animOn()) { r.playing = true; if (!scnRaf) scnRaf = requestAnimationFrame(scTick); pb.textContent = 'หยุด'; } }
    const sb2 = head.querySelector('.sbtns');
    const fb = document.createElement('button'); fb.type = 'button'; fb.textContent = 'แรง'; fb.setAttribute('aria-pressed', sp.show.fbd ? 'true' : 'false'); fb.onclick = () => { const live = findItem(it.id) || it; live.spec.show.fbd = !live.spec.show.fbd; fb.setAttribute('aria-pressed', live.spec.show.fbd ? 'true' : 'false'); scRender(live, r); savePage(); };
    const mb = document.createElement('button'); mb.type = 'button'; mb.textContent = 'ปรับค่า'; mb.setAttribute('aria-pressed', 'false'); mb.onclick = () => { const o = pill.classList.toggle('open'); mb.setAttribute('aria-pressed', o ? 'true' : 'false'); };
    sb2.insertBefore(fb, bk || null); sb2.insertBefore(mb, bk || null);
    const fold = document.createElement('button'); fold.type = 'button'; fold.textContent = 'ย่อ'; fold.title = 'ย่อแถบนี้ เหลือปุ่มเล็กที่มุมภาพ'; fold.onclick = () => { r.open = false; pill.hidden = true; hb.setAttribute('aria-expanded', 'false'); };
    const del = document.createElement('button'); del.type = 'button'; del.textContent = 'ลบ'; del.onclick = () => { const live = findItem(it.id); if (!live) return; const before = clone(S.page.items || []); setItems(before.filter((t) => t.id !== it.id), before); SCN.delete(it.id); }; sb2.appendChild(del);
    sb2.appendChild(fold);
    [...d.children].filter((x) => x !== cv).forEach((x) => pill.appendChild(x));
    d.appendChild(hb); d.appendChild(pill);
  }
}
function insertScene(spec, at) {
  if (!S.page) return; const w = 520; const [x, y] = at || viewSpot(w, 520);
  addItem({ type: 'scene', spec: scClean(spec), x, y, w });
  toast('วางแบบจำลองแล้ว กดเล่น เปิดปิดแผนภาพแรงและกราฟได้ เลื่อนแถบเพื่อเปลี่ยนค่า', 3000);
}

/* ---------- ready-made models for every subject ---------- */
const SCENE_TPL = {
  phys: [
    ['พื้นเอียงมีแรงเสียดทาน', 'กล่องไถลลงพื้นเอียง แรงเสียดทานสถิตยึดไว้ได้ถ้าพื้นฝืดพอ', { domain: 'phys', title: 'กล่องบนพื้นเอียง', world: { w: 8, h: 5 }, bodies: [{ id: 'A', label: 'A', shape: 'box', m: 2, x: 1.6, y: 3.45, w: 0.8, h: 0.5 }], surfaces: [{ x1: 0.5, y1: 4, x2: 7, y2: 0.4, mu: 0.2, mus: 0.3 }, { x1: 0, y1: 0.4, x2: 8, y2: 0.4, mu: 0.4 }, { x1: 7.95, y1: 0.4, x2: 7.95, y2: 1.6 }], params: [{ key: 'S1.mu', label: 'μk ของพื้นเอียง', min: 0, max: 1, step: 0.05 }, { key: 'S1.mus', label: 'μs ของพื้นเอียง', min: 0, max: 1.2, step: 0.05 }, { key: 'A.m', label: 'มวล (kg)', min: 0.5, max: 10, step: 0.5 }], note: 'ลองเพิ่ม μs จนกล่องไม่ไถล แล้วสังเกตแรงเสียดทานกับ mg sinθ' }],
    ['เครื่องแอตวูด', 'มวลสองก้อนคล้องรอก แรงตึงเชือกเท่ากันทั้งสองข้าง', { domain: 'phys', title: 'เครื่องแอตวูด', world: { w: 4, h: 5 }, bodies: [{ id: 'A', label: 'A', m: 3, x: 1.4, y: 1.8, w: 0.5, h: 0.5 }, { id: 'B', label: 'B', m: 2, x: 2.6, y: 1.8, w: 0.5, h: 0.5, color: '#C2571A' }], ropes: [{ a: 'A', b: 'B', via: [2, 4.4], pr: 0.6 }], surfaces: [{ x1: 0, y1: 0.2, x2: 4, y2: 0.2 }], params: [{ key: 'A.m', label: 'มวล A (kg)', min: 0.5, max: 8, step: 0.5 }, { key: 'B.m', label: 'มวล B (kg)', min: 0.5, max: 8, step: 0.5 }], show: { graph: 'v' } }],
    ['โพรเจกไทล์', 'ขว้างลูกบอล เห็นแรงโน้มถ่วงอย่างเดียวตลอดทาง', { domain: 'phys', title: 'การเคลื่อนที่แบบโพรเจกไทล์', world: { w: 45, h: 18 }, bodies: [{ id: 'A', label: '', shape: 'ball', r: 0.5, m: 0.5, x: 1, y: 1, vx: 14, vy: 14, e: 0 }], surfaces: [{ x1: 0, y1: 0.5, x2: 45, y2: 0.5 }], params: [{ key: 'A.vx', label: 'ความเร็วต้นแนวราบ (m/s)', min: 0, max: 25, step: 0.5 }, { key: 'A.vy', label: 'ความเร็วต้นแนวดิ่ง (m/s)', min: 0, max: 25, step: 0.5 }, { key: 'g', label: 'g (m/s²)', min: 1, max: 20, step: 0.1 }], show: { v: true, graph: 'vy' } }],
    ['มวลติดสปริง', 'การสั่นแบบฮาร์มอนิกอย่างง่ายบนพื้นลื่น', { domain: 'phys', title: 'มวลติดสปริง', world: { w: 4, h: 1.6 }, bodies: [{ id: 'A', label: 'm', m: 1, x: 2.6, y: 0.45, w: 0.5, h: 0.4 }], springs: [{ a: '', b: 'A', ax: 0.2, ay: 0.45, k: 40, L0: 1.8 }], surfaces: [{ x1: 0, y1: 0.25, x2: 4, y2: 0.25 }], params: [{ key: 'K1.k', label: 'k (N/m)', min: 5, max: 200, step: 5 }, { key: 'A.m', label: 'มวล (kg)', min: 0.2, max: 5, step: 0.1 }, { key: 'A.x', label: 'ตำแหน่งเริ่มต้น (m)', min: 1.2, max: 3.4, step: 0.05 }], show: { graph: 'x', energy: true } }],
    ['ลูกตุ้มอย่างง่าย', 'เชือกยาวคงที่ แรงตึงเปลี่ยนตามตำแหน่ง', { domain: 'phys', title: 'ลูกตุ้มอย่างง่าย', world: { w: 4, h: 3.4 }, bodies: [{ id: 'A', label: '', shape: 'ball', r: 0.12, m: 0.5, x: 3.1, y: 1.7, e: 0 }], ropes: [{ a: '', b: 'A', ax: 2, ay: 3.2 }], params: [{ key: 'A.m', label: 'มวล (kg)', min: 0.1, max: 3, step: 0.1 }, { key: 'g', label: 'g (m/s²)', min: 1, max: 20, step: 0.1 }], show: { graph: 'x', trail: true } }],
    ['การชนในแนวเส้นตรง', 'ปรับมวลและสัมประสิทธิ์การกระดอนแล้วดูโมเมนตัม', { domain: 'phys', title: 'การชนของรถสองคัน', world: { w: 10, h: 2.4 }, bodies: [{ id: 'A', label: 'A', m: 2, x: 2, y: 0.55, vx: 3, w: 0.8, h: 0.5, e: 1 }, { id: 'B', label: 'B', m: 1, x: 6, y: 0.55, vx: 0, w: 0.8, h: 0.5, e: 1, color: '#C2571A' }], surfaces: [{ x1: 0, y1: 0.3, x2: 10, y2: 0.3 }], params: [{ key: 'A.m', label: 'มวล A (kg)', min: 0.5, max: 6, step: 0.5 }, { key: 'B.m', label: 'มวล B (kg)', min: 0.5, max: 6, step: 0.5 }, { key: 'A.e', label: 'การกระดอน e', min: 0, max: 1, step: 0.1 }], show: { fbd: false, v: true, graph: 'vx' } }],
    ['ดาวเทียมโคจร', 'แรงโน้มถ่วงชี้เข้าศูนย์กลางตลอด ความเร็วตั้งฉากกับแรง', { domain: 'phys', title: 'ดาวเทียมโคจรรอบโลก', world: { w: 12, h: 8, x0: -6, y0: -4, g: 0 }, bodies: [{ id: 'A', label: '', shape: 'ball', r: 0.15, m: 1, x: 0, y: 3, vx: 2.3, vy: 0 }], fields: { central: { x: 0, y: 0, GM: 16, r: 0.8, label: 'โลก' } }, params: [{ key: 'A.vx', label: 'ความเร็วต้น (m/s)', min: 0.5, max: 4, step: 0.05 }], show: { v: true, graph: 'v' } }],
    ['ประจุในสนามแม่เหล็ก', 'แรงแม่เหล็กตั้งฉากกับความเร็ว อนุภาคเคลื่อนเป็นวงกลม', { domain: 'phys', title: 'ประจุในสนามแม่เหล็ก', world: { w: 10, h: 7, x0: -5, y0: -3.5, g: 0 }, bodies: [{ id: 'A', label: '', shape: 'ball', r: 0.15, m: 1, q: 1, x: 0, y: -2, vx: 2, vy: 0 }], fields: { B: 1 }, params: [{ key: 'B', label: 'B (T)', min: -2, max: 2, step: 0.1 }, { key: 'A.vx', label: 'ความเร็ว (m/s)', min: 0.5, max: 4, step: 0.1 }], show: { v: true } }],
    ['ประจุในสนามไฟฟ้า', 'แรงไฟฟ้าคงที่ เส้นทางเป็นพาราโบลาแบบโพรเจกไทล์', { domain: 'phys', title: 'ประจุในสนามไฟฟ้า', world: { w: 10, h: 6, x0: 0, y0: -3, g: 0 }, bodies: [{ id: 'A', label: '', shape: 'ball', r: 0.15, m: 1, q: 1, x: 0.5, y: 0, vx: 3, vy: 0 }], fields: { E: [0, 1] }, params: [{ key: 'E.y', label: 'E (N/C)', min: -3, max: 3, step: 0.1 }, { key: 'A.q', label: 'ประจุ q (C)', min: -2, max: 2, step: 0.1 }], show: { v: true, graph: 'vy' } }]
  ],
  person: [
    ['คนเดิน', 'จุดศูนย์กลางมวลขึ้นลงเป็นส่วนโค้ง แรงจากพื้นเปลี่ยนตามจังหวะก้าว', { domain: 'phys', title: 'การเดิน', world: { w: 6, h: 2.6 }, bodies: [{ id: 'P', label: 'คน', shape: 'person', act: 'walk', m: 60, hgt: 1.7, x: 1, y: 1, v: 1.4, color: '#2F4BB8' }], surfaces: [{ x1: -5, y1: 0.3, x2: 400, y2: 0.3, mu: 0.6 }], params: [{ key: 'P.v', label: 'ความเร็วเดิน (m/s)', min: 0.5, max: 2.2, step: 0.1 }, { key: 'P.m', label: 'มวล (kg)', min: 20, max: 120, step: 1 }], show: { graph: 'grf', trail: false } }],
    ['คนวิ่ง', 'มีช่วงลอยตัว แรงจากพื้นตอนเท้าแตะสูงกว่าน้ำหนักหลายเท่า', { domain: 'phys', title: 'การวิ่ง', world: { w: 7, h: 2.8 }, bodies: [{ id: 'P', label: 'คน', shape: 'person', act: 'run', m: 60, hgt: 1.7, x: 1, y: 1, v: 4, color: '#C2571A' }], surfaces: [{ x1: -5, y1: 0.3, x2: 800, y2: 0.3, mu: 0.8 }], params: [{ key: 'P.v', label: 'ความเร็ววิ่ง (m/s)', min: 2, max: 9, step: 0.5 }, { key: 'P.m', label: 'มวล (kg)', min: 20, max: 120, step: 1 }], show: { graph: 'grf', trail: false } }],
    ['กระโดดตัวตรง', 'ย่อ ถีบ ลอย ลง ดูแรงจากพื้นแต่ละช่วงเทียบกับน้ำหนัก', { domain: 'phys', title: 'กระโดดตัวตรง', world: { w: 3, h: 3 }, bodies: [{ id: 'P', label: 'คน', shape: 'person', act: 'jump', m: 60, hgt: 1.7, x: 1.5, y: 1, v: 2.6, color: '#2E8B57' }], surfaces: [{ x1: 0, y1: 0.3, x2: 3, y2: 0.3 }], params: [{ key: 'P.v', label: 'ความเร็วตอนพ้นพื้น (m/s)', min: 0.5, max: 4, step: 0.1 }, { key: 'P.m', label: 'มวล (kg)', min: 20, max: 120, step: 1 }], show: { graph: 'grf', trail: true }, note: 'ช่วงถีบตัวแรงจากพื้นมากกว่าน้ำหนัก ช่วงลอยตัวแรงจากพื้นเป็นศูนย์ ลองเพิ่มความเร็วตอนพ้นพื้นแล้วดูความสูง' }],
    ['กระโดดไกล', 'วิ่งเข้าหาแล้วกระโดด จุดศูนย์กลางมวลเคลื่อนที่แบบโพรเจกไทล์', { domain: 'phys', title: 'กระโดดไกล', world: { w: 9, h: 3 }, bodies: [{ id: 'P', label: 'คน', shape: 'person', act: 'longjump', m: 60, hgt: 1.7, x: 0.5, y: 1, v: 6, ang: 20, color: '#7B4FC9' }], surfaces: [{ x1: -5, y1: 0.3, x2: 200, y2: 0.3, mu: 0.8 }], params: [{ key: 'P.v', label: 'ความเร็ววิ่งเข้าหา (m/s)', min: 2, max: 10, step: 0.5 }, { key: 'P.ang', label: 'มุมกระโดด (องศา)', min: 5, max: 45, step: 1 }], show: { graph: 'y', trail: true } }],
    ['คนถูกผลักล้ม', 'เมื่อจุดศูนย์กลางมวลพ้นฐานรองรับ ร่างกายหมุนรอบเท้าลงพื้น', { domain: 'phys', title: 'สมดุลและการล้ม', world: { w: 3.4, h: 2.4 }, bodies: [{ id: 'P', label: 'คน', shape: 'person', act: 'fall', m: 60, hgt: 1.7, x: 0.8, y: 1, push: 0.6, color: '#D14D8B' }], surfaces: [{ x1: 0, y1: 0.3, x2: 3.4, y2: 0.3, mu: 0.8 }], params: [{ key: 'P.push', label: 'แรงผลัก (ความเร็วเชิงมุมเริ่มต้น)', min: 0.1, max: 2, step: 0.1 }], show: { graph: 'grf', trail: true } }],
    ['สควอต', 'ย่อขึ้นลง แรงจากพื้นต่ำกว่าน้ำหนักตอนเริ่มย่อ สูงกว่าตอนชะลอ', { domain: 'phys', title: 'สควอต', world: { w: 2.4, h: 2.4 }, bodies: [{ id: 'P', label: 'คน', shape: 'person', act: 'squat', m: 60, hgt: 1.7, x: 1.2, y: 1, color: '#0E9AA7' }], surfaces: [{ x1: 0, y1: 0.3, x2: 2.4, y2: 0.3 }], params: [{ key: 'P.m', label: 'มวล (kg)', min: 20, max: 150, step: 1 }], show: { graph: 'grf', trail: false } }]
  ],
  chem: [
    ['แก๊สในกล่อง', 'อุณหภูมิสูงขึ้น อนุภาคเร็วขึ้น ชนผนังแรงขึ้น ความดันสูงขึ้น', { domain: 'chem', title: 'ทฤษฎีจลน์ของแก๊ส', box: { w: 100, h: 60 }, T: 300, species: [{ id: 'G', label: 'โมเลกุลแก๊ส', n: 60, r: 1.4, color: '#2F4BB8' }], params: [{ key: 'T', label: 'อุณหภูมิ (K)', min: 50, max: 1200, step: 10 }, { key: 'G.n', label: 'จำนวนโมเลกุล', min: 5, max: 200, step: 5 }] }],
    ['อัตราการเกิดปฏิกิริยา', 'A + B เป็น C เมื่อชนแรงพอ อุณหภูมิและความเข้มข้นมีผลต่ออัตรา', { domain: 'chem', title: 'A + B → C', box: { w: 100, h: 60 }, T: 300, species: [{ id: 'A', label: 'A', n: 50, r: 1.3, color: '#2F4BB8' }, { id: 'B', label: 'B', n: 50, r: 1.3, color: '#C2571A' }, { id: 'C', label: 'C', n: 0, r: 1.8, m: 2, color: '#2E8B57' }], reactions: [{ from: ['A', 'B'], to: ['C'], Ea: 2.5 }], params: [{ key: 'T', label: 'อุณหภูมิ (K)', min: 100, max: 1200, step: 10 }, { key: 'R1.Ea', label: 'พลังงานก่อกัมมันต์', min: 0, max: 6, step: 0.1 }, { key: 'A.n', label: 'จำนวน A', min: 5, max: 120, step: 5 }], note: 'เพิ่มอุณหภูมิหรือลดพลังงานก่อกัมมันต์ เส้น C ในกราฟจะชันขึ้น' }],
    ['สมดุลเคมี', 'A กลายเป็น B และ B กลับเป็น A จนอัตราไปและกลับเท่ากัน', { domain: 'chem', title: 'สมดุล A ⇌ B', box: { w: 100, h: 60 }, T: 300, species: [{ id: 'A', label: 'A', n: 80, r: 1.3, color: '#2F4BB8' }, { id: 'B', label: 'B', n: 0, r: 1.3, color: '#D14D8B' }], reactions: [{ from: ['A'], to: ['B'], k: 0.3 }, { from: ['B'], to: ['A'], k: 0.15 }], params: [{ key: 'R1.k', label: 'อัตราไปข้างหน้า', min: 0, max: 1, step: 0.01 }, { key: 'R2.k', label: 'อัตราย้อนกลับ', min: 0, max: 1, step: 0.01 }] }],
    ['การแพร่ของแก๊ส', 'แก๊สสองชนิดเริ่มแยกกัน แล้วผสมกันเองตามการเคลื่อนที่แบบสุ่ม', { domain: 'chem', title: 'การแพร่', box: { w: 100, h: 60 }, T: 300, species: [{ id: 'A', label: 'แก๊สเบา', n: 50, r: 1.2, m: 1, side: 'left', color: '#2F4BB8' }, { id: 'B', label: 'แก๊สหนัก', n: 50, r: 1.6, m: 4, side: 'right', color: '#C2571A' }], membrane: { x: 0.5, pass: ['A', 'B'] }, params: [{ key: 'T', label: 'อุณหภูมิ (K)', min: 100, max: 1200, step: 10 }] }]
  ],
  bio: [
    ['ออสโมซิส', 'น้ำผ่านเยื่อเลือกผ่านได้ น้ำตาลผ่านไม่ได้', { domain: 'bio', title: 'ออสโมซิสผ่านเยื่อเลือกผ่าน', box: { w: 100, h: 60 }, T: 300, species: [{ id: 'W', label: 'โมเลกุลน้ำ', n: 90, r: 0.9, m: 1, color: '#4C8DF6' }, { id: 'S', label: 'น้ำตาล', n: 25, r: 2.2, m: 6, side: 'right', color: '#E39B2D' }], membrane: { x: 0.5, pass: ['W'], move: true }, params: [{ key: 'S.n', label: 'จำนวนน้ำตาล', min: 0, max: 60, step: 1 }], thermostat: true, note: 'เยื่อขยับได้ ด้านที่มีน้ำตาลขยายตัวเพราะน้ำเข้ามา เพิ่มน้ำตาลแล้วดูว่าขยายมากขึ้นไหม' }],
    ['ผู้ล่าและเหยื่อ', 'กระต่ายกินหญ้า สุนัขจิ้งจอกกินกระต่าย ประชากรขึ้นลงเป็นจังหวะ', { domain: 'bio', title: 'ผู้ล่ากับเหยื่อ', box: { w: 120, h: 70 }, species: [{ id: 'G', label: 'หญ้า', n: 100, r: 1, fixed: true, color: '#7BC86C', regrow: 12, cap: 140 }, { id: 'R', label: 'กระต่าย', n: 30, r: 1.6, agent: true, speed: 8, eats: ['G'], gain: 3, burn: 0.4, birth: 5, color: '#B8B0A2' }, { id: 'F', label: 'สุนัขจิ้งจอก', n: 3, r: 2, agent: true, speed: 7.5, eats: ['R'], gain: 4, burn: 1, birth: 18, color: '#D9692B' }], params: [{ key: 'G.regrow', label: 'หญ้างอกต่อวินาที', min: 0, max: 30, step: 1 }, { key: 'F.n', label: 'จิ้งจอกเริ่มต้น', min: 0, max: 15, step: 1 }], note: 'กราฟประชากรเหยื่อขึ้นก่อน ผู้ล่าขึ้นตามมา แล้วสลับกันลง' }],
    ['เอนไซม์กับสารตั้งต้น', 'เอนไซม์จับสารตั้งต้น แล้วปล่อยผลิตภัณฑ์ เอนไซม์กลับมาใช้ซ้ำ', { domain: 'bio', title: 'การทำงานของเอนไซม์', box: { w: 100, h: 60 }, T: 310, species: [{ id: 'E', label: 'เอนไซม์', n: 8, r: 2.6, m: 8, color: '#7B4FC9' }, { id: 'S', label: 'สารตั้งต้น', n: 60, r: 1.1, color: '#E39B2D' }, { id: 'ES', label: 'เอนไซม์จับสาร', n: 0, r: 2.8, m: 9, color: '#B07ADB' }, { id: 'P', label: 'ผลิตภัณฑ์', n: 0, r: 1.1, color: '#2E8B57' }], reactions: [{ from: ['E', 'S'], to: ['ES'], Ea: 0.3 }, { from: ['ES'], to: ['E', 'P'], k: 0.8 }], params: [{ key: 'E.n', label: 'จำนวนเอนไซม์', min: 1, max: 30, step: 1 }, { key: 'T', label: 'อุณหภูมิ (K)', min: 270, max: 330, step: 1 }], thermostat: true }],
    ['การเติบโตของประชากร', 'อาหารจำกัด ประชากรโตเร็วแล้วชะลอ ได้กราฟรูปตัว S', { domain: 'bio', title: 'การเติบโตของประชากรเมื่ออาหารจำกัด', box: { w: 110, h: 65 }, species: [{ id: 'F', label: 'อาหาร', n: 80, r: 0.9, fixed: true, color: '#7BC86C', regrow: 10, cap: 120 }, { id: 'Y', label: 'ยีสต์', n: 3, r: 1.4, agent: true, speed: 6, eats: ['F'], gain: 2.5, burn: 0.35, birth: 5, color: '#C9A15B' }], params: [{ key: 'F.regrow', label: 'อาหารเพิ่มต่อวินาที', min: 0, max: 30, step: 1 }] }]
  ],
  math: [
    ['วงกลมหนึ่งหน่วยกับกราฟไซน์', 'จุดหมุนบนวงกลม ความสูงของจุดคือ sin t', { domain: 'math', title: 'วงกลมหนึ่งหน่วยกับ sin t', view: { xmin: -1.5, xmax: 7, ymin: -1.6, ymax: 1.6 }, t: { min: 0, max: 6.2832, speed: 1 }, vars: { a: 1 }, items: [{ type: 'curve', x: 'a*cos(t)', y: 'a*sin(t)', tmin: '0', tmax: '2*pi', color: '#C6CCD6' }, { type: 'point', x: 'a*cos(t)', y: 'a*sin(t)', label: 'P', color: '#2F4BB8' }, { type: 'segment', x1: '0', y1: '0', x2: 'a*cos(t)', y2: 'a*sin(t)', color: '#2F4BB8' }, { type: 'func', expr: 'a*sin(x)', color: '#E3E7EE' }, { type: 'point', x: 't', y: 'a*sin(t)', trace: true, label: 'sin t', color: '#C2571A' }, { type: 'segment', x1: 'a*cos(t)', y1: 'a*sin(t)', x2: 't', y2: 'a*sin(t)', color: '#C2571A' }], params: [{ key: 'a', label: 'แอมพลิจูด', min: 0.2, max: 1.5, step: 0.1 }] }],
    ['พาราโบลาปรับค่าได้', 'y = ax² + bx + c เลื่อนแถบแล้วดูรูปกราฟเปลี่ยน', { domain: 'math', title: 'y = ax² + bx + c', view: { xmin: -6, xmax: 6, ymin: -6, ymax: 8 }, t: { min: 0, max: 0, speed: 0 }, vars: { a: 1, b: 0, c: -2 }, items: [{ type: 'func', expr: 'a*x^2+b*x+c', label: 'y', color: '#2F4BB8' }, { type: 'point', x: '-b/(2*a)', y: 'c-b^2/(4*a)', label: 'จุดยอด', color: '#C2571A' }], params: [{ key: 'a', label: 'a', min: -3, max: 3, step: 0.1 }, { key: 'b', label: 'b', min: -5, max: 5, step: 0.1 }, { key: 'c', label: 'c', min: -5, max: 5, step: 0.1 }] }],
    ['เส้นสัมผัสและอนุพันธ์', 'เส้นสัมผัสเลื่อนไปตามกราฟ ความชันคือค่าอนุพันธ์', { domain: 'math', title: 'เส้นสัมผัสของ y = x³ − 3x', view: { xmin: -3, xmax: 3, ymin: -4, ymax: 4 }, t: { min: -2.4, max: 2.4, speed: 0.6 }, items: [{ type: 'func', expr: 'x^3-3*x', color: '#2F4BB8' }, { type: 'tangent', of: 0, at: 't', color: '#C2571A' }, { type: 'point', x: 't', y: '3*t^2-3', trace: true, label: "y'", color: '#2E8B57' }] }],
    ['ผลรวมรีมันน์', 'สี่เหลี่ยมยิ่งแคบ ผลรวมยิ่งใกล้พื้นที่ใต้กราฟ', { domain: 'math', title: 'พื้นที่ใต้กราฟ y = x²', view: { xmin: -0.5, xmax: 3.5, ymin: -1, ymax: 9.5 }, t: { min: 0, max: 0, speed: 0 }, vars: { n: 6 }, items: [{ type: 'func', expr: 'x^2', color: '#2F4BB8' }, { type: 'area', of: 0, a: '0', b: '3', n: 'n', color: '#E39B2D' }], params: [{ key: 'n', label: 'จำนวนสี่เหลี่ยม', min: 1, max: 60, step: 1 }], note: 'พื้นที่จริงคือ 9' }]
  ]
};
const SCENE_SUBJ = [['phys', 'ฟิสิกส์'], ['person', 'ร่างกายและการเคลื่อนไหว'], ['chem', 'เคมี'], ['bio', 'ชีววิทยา'], ['math', 'คณิตศาสตร์'], ['3d', 'สามมิติ']];
/* more ready-made models for every subject: earth and space, statistics, health, and extra chemistry, biology, maths */
SCENE_TPL.earth = [
  ['กฎข้อที่สองของเคปเลอร์', 'วงโคจรรี ดาวเคราะห์เร็วขึ้นเมื่อใกล้ดวงอาทิตย์ ช้าลงเมื่อไกล', { domain: 'phys', title: 'วงโคจรรีรอบดวงอาทิตย์', world: { w: 14, h: 9, x0: -9, y0: -4.5, g: 0 }, bodies: [{ id: 'A', label: '', shape: 'ball', r: 0.15, m: 1, x: 0, y: 3.4, vx: 1.6, vy: 0 }], fields: { central: { x: 0, y: 0, GM: 16, r: 0.6, label: 'ดวงอาทิตย์' } }, params: [{ key: 'A.vx', label: 'ความเร็วที่จุดไกลสุด', min: 0.8, max: 2.2, step: 0.05 }], show: { v: true, graph: 'v' }, note: 'กราฟอัตราเร็วสูงสุดตอนผ่านจุดใกล้ดวงอาทิตย์ที่สุด' }],
  ['ความเร็วหลุดพ้น', 'เพิ่มความเร็วต้นจนวงโคจรเปิดออก ยานไม่กลับมาอีก', { domain: 'phys', title: 'ความเร็ววงโคจรและความเร็วหลุดพ้น', world: { w: 16, h: 10, x0: -8, y0: -5, g: 0 }, bodies: [{ id: 'A', label: 'ยาน', shape: 'ball', r: 0.15, m: 1, x: 0, y: 2.5, vx: 2.5, vy: 0 }], fields: { central: { x: 0, y: 0, GM: 16, r: 0.8, label: 'โลก' } }, params: [{ key: 'A.vx', label: 'ความเร็วต้น (m/s)', min: 1, max: 4.2, step: 0.05 }], show: { v: true, graph: 'v' }, note: 'วงกลมเมื่อ v = √(GM/r) = 2.53 หลุดพ้นเมื่อ v ≥ √(2GM/r) = 3.58' }],
  ['ตกบนโลก ดวงจันทร์ ดาวอังคาร', 'ปล่อยลูกบอลจากความสูงเดียวกัน เลือกค่า g ของแต่ละที่', { domain: 'phys', title: 'การตกอิสระกับค่า g', world: { w: 4, h: 6, g: 1.62 }, bodies: [{ id: 'A', label: '', shape: 'ball', r: 0.15, m: 1, x: 2, y: 5.5, e: 0 }], surfaces: [{ x1: 0, y1: 0, x2: 4, y2: 0 }], params: [{ key: 'g', label: 'g (m/s²) โลก 9.8 ดวงจันทร์ 1.62 อังคาร 3.71', min: 0.5, max: 25, step: 0.01 }], show: { v: true, graph: 'y' } }],
  ['ขว้างบอลบนดาวอังคาร', 'มุมและความเร็วเท่ากัน แต่ g ต่างกัน ระยะไกลต่างกันมาก', { domain: 'phys', title: 'โพรเจกไทล์บนดาวเคราะห์อื่น', world: { w: 60, h: 24, g: 3.71 }, bodies: [{ id: 'A', label: '', shape: 'ball', r: 0.5, m: 0.5, x: 1, y: 1, vx: 10, vy: 10, e: 0 }], surfaces: [{ x1: 0, y1: 0, x2: 60, y2: 0 }], params: [{ key: 'g', label: 'g (m/s²)', min: 1, max: 25, step: 0.01 }, { key: 'A.vx', label: 'vx (m/s)', min: 2, max: 20, step: 0.5 }, { key: 'A.vy', label: 'vy (m/s)', min: 2, max: 20, step: 0.5 }], show: { v: true, graph: 'y' } }],
  ['มุมเงยของดวงอาทิตย์ตลอดปี', 'มุมเงยตอนเที่ยงเปลี่ยนตามวันในปีและละติจูด ที่มาของฤดูกาล', { domain: 'math', title: 'มุมเงยของดวงอาทิตย์ตอนเที่ยง', view: { xmin: 0, xmax: 365, ymin: 0, ymax: 100 }, t: { min: 0, max: 365, speed: 30 }, vars: { lat: 14 }, items: [{ type: 'func', expr: 'min(90, 90 - abs(lat - 23.44*sin(2*pi*(x-80)/365)))', label: 'มุมเงย (องศา)', color: '#E39B2D' }, { type: 'point', x: 't', y: 'min(90, 90 - abs(lat - 23.44*sin(2*pi*(t-80)/365)))', label: 'วันที่ t', color: '#C2571A' }], params: [{ key: 'lat', label: 'ละติจูด (องศาเหนือ) กรุงเทพฯ 13.7', min: -60, max: 70, step: 0.5 }], note: 'แกนนอนคือวันที่ของปี 80 คือราววันวิษุวัต 21 มีนาคม' }],
  ['ความยาวกลางวันตามละติจูด', 'ยิ่งไกลเส้นศูนย์สูตร กลางวันฤดูร้อนยิ่งยาว ฤดูหนาวยิ่งสั้น', { domain: 'math', title: 'ความยาวช่วงกลางวัน (ชั่วโมง)', view: { xmin: 0, xmax: 365, ymin: 0, ymax: 24 }, t: { min: 0, max: 365, speed: 30 }, vars: { lat: 14 }, items: [{ type: 'func', expr: '24/pi*acos(max(-1, min(1, -tan(lat*pi/180)*tan(23.44*pi/180*sin(2*pi*(x-80)/365)))))', label: 'ชั่วโมง', color: '#2F4BB8' }, { type: 'point', x: 't', y: '24/pi*acos(max(-1, min(1, -tan(lat*pi/180)*tan(23.44*pi/180*sin(2*pi*(t-80)/365)))))', color: '#C2571A' }], params: [{ key: 'lat', label: 'ละติจูด (องศาเหนือ)', min: -66, max: 66, step: 0.5 }] }],
  ['ข้างขึ้นข้างแรม', 'ส่วนสว่างของดวงจันทร์ที่เห็นจากโลกตลอดเดือนจันทรคติ', { domain: 'math', title: 'สัดส่วนส่วนสว่างของดวงจันทร์', view: { xmin: 0, xmax: 29.53, ymin: -0.1, ymax: 1.2 }, t: { min: 0, max: 29.53, speed: 3 }, items: [{ type: 'func', expr: '(1-cos(2*pi*x/29.53))/2', label: 'ส่วนสว่าง', color: '#E39B2D' }, { type: 'point', x: 't', y: '(1-cos(2*pi*t/29.53))/2', label: 'วันที่ t', color: '#2F4BB8' }, { type: 'text', x: '0.5', y: '1.1', text: 'เดือนดับ', color: '#667' }, { type: 'text', x: '13.6', y: '1.1', text: 'เพ็ญ', color: '#667' }] }]
];
SCENE_TPL.stat = [
  ['การแจกแจงปกติ', 'ปรับค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐาน แรเงาพื้นที่ระหว่าง a ถึง b', { domain: 'math', title: 'การแจกแจงปกติ N(μ, σ²)', view: { xmin: -6, xmax: 6, ymin: -0.05, ymax: 0.85 }, t: { min: 0, max: 0, speed: 0 }, vars: { mu: 0, s: 1, a: -1, b: 1 }, items: [{ type: 'func', expr: 'exp(-(x-mu)^2/(2*s^2))/(s*sqrt(2*pi))', color: '#2F4BB8' }, { type: 'area', of: 0, a: 'a', b: 'b', n: '120', color: '#E39B2D' }], params: [{ key: 'mu', label: 'μ', min: -3, max: 3, step: 0.1 }, { key: 's', label: 'σ', min: 0.4, max: 3, step: 0.05 }, { key: 'a', label: 'a', min: -6, max: 6, step: 0.1 }, { key: 'b', label: 'b', min: -6, max: 6, step: 0.1 }], note: 'μ ± σ ครอบคลุมราว 68% μ ± 2σ ราว 95%' }],
  ['การแจกแจง t เทียบกับปกติ', 'องศาความเป็นอิสระน้อย หางหนากว่า ยิ่งมากยิ่งใกล้ปกติ', { domain: 'math', title: 'การแจกแจง t', view: { xmin: -5, xmax: 5, ymin: -0.02, ymax: 0.45 }, t: { min: 0, max: 0, speed: 0 }, vars: { v: 3 }, items: [{ type: 'func', expr: 'exp(-x^2/2)/sqrt(2*pi)', label: 'ปกติ', color: '#C6CCD6' }, { type: 'func', expr: 'gamma((v+1)/2)/(sqrt(v*pi)*gamma(v/2))*(1+x^2/v)^(-(v+1)/2)', label: 't', color: '#2F4BB8' }], params: [{ key: 'v', label: 'องศาความเป็นอิสระ', min: 1, max: 60, step: 1 }] }],
  ['การแจกแจงไคกำลังสอง', 'รูปร่างเบ้ขวา ยิ่งองศาความเป็นอิสระมากยิ่งสมมาตร', { domain: 'math', title: 'การแจกแจงไคกำลังสอง', view: { xmin: 0, xmax: 30, ymin: -0.02, ymax: 0.5 }, t: { min: 0, max: 0, speed: 0 }, vars: { k: 4 }, items: [{ type: 'func', expr: 'larger(x,0) ? x^(k/2-1)*exp(-x/2)/(2^(k/2)*gamma(k/2)) : 0', color: '#2F4BB8' }], params: [{ key: 'k', label: 'องศาความเป็นอิสระ', min: 1, max: 20, step: 1 }], note: 'ค่าเฉลี่ยเท่ากับ k ความแปรปรวนเท่ากับ 2k' }],
  ['ช่วงความเชื่อมั่นกับขนาดตัวอย่าง', 'ความกว้างของช่วงลดลงตาม 1/√n ต้องเพิ่ม n สี่เท่าจึงแคบลงครึ่งหนึ่ง', { domain: 'math', title: 'ความกว้างช่วงความเชื่อมั่น 95%', view: { xmin: 0, xmax: 400, ymin: 0, ymax: 12 }, t: { min: 0, max: 0, speed: 0 }, vars: { s: 10, n: 50 }, items: [{ type: 'func', expr: 'larger(x,1) ? 2*1.96*s/sqrt(x) : NaN', label: 'ความกว้าง', color: '#2F4BB8' }, { type: 'point', x: 'n', y: '2*1.96*s/sqrt(n)', label: 'n ที่เลือก', color: '#C2571A' }], params: [{ key: 's', label: 'ส่วนเบี่ยงเบนมาตรฐาน', min: 1, max: 30, step: 0.5 }, { key: 'n', label: 'ขนาดตัวอย่าง n', min: 2, max: 400, step: 1 }] }],
  ['เส้นตรงกับข้อมูล', 'ปรับจุดตัดและความชันให้เส้นผ่านกลุ่มข้อมูลมากที่สุด แล้วเทียบกับเส้นกำลังสองน้อยสุด', { domain: 'math', title: 'การถดถอยเชิงเส้น', view: { xmin: 0, xmax: 10, ymin: 0, ymax: 12 }, t: { min: 0, max: 0, speed: 0 }, vars: { a: 2, b: 0.6 }, items: [{ type: 'point', x: '1', y: '2.6', color: '#667' }, { type: 'point', x: '2', y: '3.1', color: '#667' }, { type: 'point', x: '3', y: '4.4', color: '#667' }, { type: 'point', x: '4', y: '4.2', color: '#667' }, { type: 'point', x: '5', y: '5.9', color: '#667' }, { type: 'point', x: '6', y: '6.1', color: '#667' }, { type: 'point', x: '7', y: '7.5', color: '#667' }, { type: 'point', x: '8', y: '7.9', color: '#667' }, { type: 'point', x: '9', y: '9.4', color: '#667' }, { type: 'func', expr: 'a + b*x', label: 'เส้นของเรา', color: '#C2571A' }, { type: 'func', expr: '1.403 + 0.840*x', label: 'กำลังสองน้อยสุด', color: '#C6CCD6' }], params: [{ key: 'a', label: 'จุดตัดแกน y', min: -2, max: 6, step: 0.05 }, { key: 'b', label: 'ความชัน', min: -1, max: 2, step: 0.01 }], note: 'เส้นกำลังสองน้อยสุดของข้อมูลชุดนี้คือ y = 1.403 + 0.840x' }],
  ['การแจกแจงเอกซ์โพเนนเชียล', 'เวลารอเหตุการณ์ครั้งถัดไป ค่าเฉลี่ยเท่ากับ 1/λ', { domain: 'math', title: 'การแจกแจงเอกซ์โพเนนเชียล', view: { xmin: 0, xmax: 6, ymin: -0.05, ymax: 2.2 }, t: { min: 0, max: 0, speed: 0 }, vars: { L: 1, c: 1 }, items: [{ type: 'func', expr: 'L*exp(-L*x)', color: '#2F4BB8' }, { type: 'area', of: 0, a: '0', b: 'c', n: '80', color: '#E39B2D' }], params: [{ key: 'L', label: 'λ', min: 0.2, max: 2, step: 0.05 }, { key: 'c', label: 'P(X ≤ c) แรเงาถึง c', min: 0, max: 6, step: 0.05 }] }]
];
SCENE_TPL.health = [
  ['การระบาดของโรค (SIR)', 'ผู้ติดเชื้อชนผู้ยังไม่ติดแล้วแพร่เชื้อ ผู้ป่วยหายแล้วมีภูมิคุ้มกัน', { domain: 'bio', title: 'แบบจำลองการระบาด S I R', box: { w: 110, h: 65 }, T: 300, species: [{ id: 'S', label: 'ยังไม่ติดเชื้อ', n: 150, r: 1.1, color: '#2F4BB8' }, { id: 'I', label: 'ติดเชื้อ', n: 3, r: 1.1, color: '#D1453B' }, { id: 'R', label: 'หายแล้ว', n: 0, r: 1.1, color: '#2E8B57' }], reactions: [{ from: ['S', 'I'], to: ['I', 'I'], Ea: 0 }, { from: ['I'], to: ['R'], k: 0.08 }], params: [{ key: 'R2.k', label: 'อัตราการหาย', min: 0.01, max: 0.5, step: 0.01 }, { key: 'S.n', label: 'จำนวนคน', min: 20, max: 300, step: 10 }], note: 'กราฟผู้ติดเชื้อขึ้นเป็นยอดแล้วลดลง อัตราการหายยิ่งสูง ยอดยิ่งต่ำ' }],
  ['วัคซีนกับภูมิคุ้มกันหมู่', 'เพิ่มคนที่ได้รับวัคซีน เชื้อหาทางแพร่ได้ยากขึ้น', { domain: 'bio', title: 'ภูมิคุ้มกันหมู่', box: { w: 110, h: 65 }, T: 300, species: [{ id: 'S', label: 'ยังไม่มีภูมิ', n: 70, r: 1.1, color: '#2F4BB8' }, { id: 'V', label: 'ได้วัคซีน', n: 80, r: 1.1, color: '#8A94A6' }, { id: 'I', label: 'ติดเชื้อ', n: 3, r: 1.1, color: '#D1453B' }, { id: 'R', label: 'หายแล้ว', n: 0, r: 1.1, color: '#2E8B57' }], reactions: [{ from: ['S', 'I'], to: ['I', 'I'], Ea: 0 }, { from: ['I'], to: ['R'], k: 0.08 }], params: [{ key: 'V.n', label: 'จำนวนคนได้วัคซีน', min: 0, max: 200, step: 10 }, { key: 'S.n', label: 'จำนวนคนไม่มีภูมิ', min: 10, max: 200, step: 10 }] }],
  ['ระดับยาในเลือด', 'ยาเข้าสู่เลือดแล้วถูกกำจัด ระดับขึ้นถึงยอดแล้วลด ครึ่งชีวิตขึ้นกับอัตรากำจัด', { domain: 'math', title: 'ความเข้มข้นของยาในเลือด', view: { xmin: 0, xmax: 24, ymin: 0, ymax: 12 }, t: { min: 0, max: 24, speed: 3 }, vars: { D: 500, V: 50, ka: 1.2, ke: 0.17 }, items: [{ type: 'func', expr: 'larger(x,-1e-9) ? D*ka/(V*(ka-ke))*(exp(-ke*x)-exp(-ka*x)) : 0', label: 'mg/L', color: '#2F4BB8' }, { type: 'point', x: 't', y: 'D*ka/(V*(ka-ke))*(exp(-ke*t)-exp(-ka*t))', color: '#C2571A' }], params: [{ key: 'D', label: 'ขนาดยา (mg)', min: 100, max: 1000, step: 50 }, { key: 'ka', label: 'อัตราดูดซึม (ต่อชั่วโมง)', min: 0.2, max: 3, step: 0.05 }, { key: 'ke', label: 'อัตรากำจัด (ต่อชั่วโมง)', min: 0.05, max: 0.6, step: 0.01 }], note: 'ครึ่งชีวิตของยา = 0.693/ke ตัวอย่างนี้ใช้สอนแนวคิด ไม่ใช่ขนาดยาจริง' }],
  ['ชีพจรระหว่างออกกำลังกาย', 'ชีพจรขึ้นสู่ระดับคงที่ตามความหนัก แล้วลดลงช่วงพัก', { domain: 'math', title: 'อัตราการเต้นของหัวใจ', view: { xmin: 0, xmax: 20, ymin: 50, ymax: 200 }, t: { min: 0, max: 20, speed: 2 }, vars: { rest: 70, I: 0.7, age: 20, tau: 1.2 }, items: [{ type: 'func', expr: 'smaller(x,10) ? rest + I*(208-0.7*age-rest)*(1-exp(-x/tau)) : rest + I*(208-0.7*age-rest)*(1-exp(-10/tau))*exp(-(x-10)/(1.8*tau))', label: 'ครั้งต่อนาที', color: '#D1453B' }, { type: 'func', expr: '208-0.7*age', label: 'ชีพจรสูงสุด', color: '#C6CCD6' }, { type: 'point', x: 't', y: 'smaller(t,10) ? rest + I*(208-0.7*age-rest)*(1-exp(-t/tau)) : rest + I*(208-0.7*age-rest)*(1-exp(-10/tau))*exp(-(t-10)/(1.8*tau))', color: '#2F4BB8' }], params: [{ key: 'I', label: 'ความหนัก (สัดส่วนของชีพจรสำรอง)', min: 0.3, max: 1, step: 0.05 }, { key: 'age', label: 'อายุ (ปี)', min: 10, max: 80, step: 1 }, { key: 'rest', label: 'ชีพจรขณะพัก', min: 40, max: 100, step: 1 }], note: 'ออกกำลัง 10 นาทีแรกแล้วพัก ชีพจรสูงสุดประมาณ 208 − 0.7 × อายุ' }]
];
SCENE_TPL.chem.push(
  ['การสลายตัวของสารกัมมันตรังสี', 'นิวเคลียสสลายแบบสุ่มทีละตัว จำนวนที่เหลือลดลงครึ่งหนึ่งทุกครึ่งชีวิต', { domain: 'chem', title: 'การสลายตัวและครึ่งชีวิต', box: { w: 100, h: 60 }, T: 300, species: [{ id: 'P', label: 'นิวเคลียสตั้งต้น', n: 200, r: 1, color: '#C2571A' }, { id: 'D', label: 'นิวเคลียสลูก', n: 0, r: 1, color: '#2F4BB8' }], reactions: [{ from: ['P'], to: ['D'], k: 0.1 }], params: [{ key: 'R1.k', label: 'ค่าคงที่การสลาย', min: 0.01, max: 0.5, step: 0.01 }, { key: 'P.n', label: 'จำนวนเริ่มต้น', min: 20, max: 300, step: 10 }], note: 'ครึ่งชีวิต = 0.693 / ค่าคงที่การสลาย' }],
  ['ตัวเร่งปฏิกิริยา', 'ตัวเร่งลดพลังงานก่อกัมมันต์ ปฏิกิริยาเร็วขึ้นโดยตัวเร่งไม่ถูกใช้หมด', { domain: 'chem', title: 'A + K → AK แล้ว AK → P + K', box: { w: 100, h: 60 }, T: 300, species: [{ id: 'A', label: 'สารตั้งต้น', n: 80, r: 1.2, color: '#2F4BB8' }, { id: 'K', label: 'ตัวเร่ง', n: 6, r: 2.2, m: 6, color: '#7B4FC9' }, { id: 'AK', label: 'สารเชิงซ้อน', n: 0, r: 2.4, m: 7, color: '#B07ADB' }, { id: 'P', label: 'ผลิตภัณฑ์', n: 0, r: 1.2, color: '#2E8B57' }], reactions: [{ from: ['A', 'K'], to: ['AK'], Ea: 0.6 }, { from: ['AK'], to: ['P', 'K'], k: 0.6 }], params: [{ key: 'K.n', label: 'จำนวนตัวเร่ง', min: 0, max: 30, step: 1 }, { key: 'T', label: 'อุณหภูมิ (K)', min: 200, max: 800, step: 10 }] }]
);
SCENE_TPL.bio.push(
  ['การแพร่ผ่านเยื่อหุ้มเซลล์', 'ออกซิเจนผ่านเยื่อได้ โปรตีนโมเลกุลใหญ่ผ่านไม่ได้', { domain: 'bio', title: 'เยื่อเลือกผ่าน', box: { w: 100, h: 60 }, T: 310, species: [{ id: 'O', label: 'ออกซิเจน', n: 70, r: 0.9, m: 1, side: 'left', color: '#4C8DF6' }, { id: 'Pr', label: 'โปรตีน', n: 12, r: 2.6, m: 10, side: 'left', color: '#C2571A' }], membrane: { x: 0.5, pass: ['O'] }, params: [{ key: 'T', label: 'อุณหภูมิ (K)', min: 270, max: 330, step: 1 }] }]
);
SCENE_TPL.math.push(
  ['เอกซ์โพเนนเชียลกับลอการิทึม', 'สองกราฟสะท้อนกันรอบเส้น y = x เพราะเป็นฟังก์ชันผกผันกัน', { domain: 'math', title: 'y = aˣ และ y = logₐ x', view: { xmin: -4, xmax: 6, ymin: -4, ymax: 6 }, t: { min: 0, max: 0, speed: 0 }, vars: { a: 2 }, items: [{ type: 'func', expr: 'a^x', label: 'aˣ', color: '#2F4BB8' }, { type: 'func', expr: 'larger(x,0) ? log(x)/log(a) : NaN', label: 'logₐ x', color: '#C2571A' }, { type: 'func', expr: 'x', label: 'y = x', color: '#C6CCD6' }], params: [{ key: 'a', label: 'ฐาน a', min: 0.2, max: 5, step: 0.05 }] }],
  ['การแปลงกราฟไซน์', 'y = A sin(B(x − C)) + D แต่ละค่าย่อ ขยาย เลื่อนกราฟอย่างไร', { domain: 'math', title: 'y = A sin(B(x − C)) + D', view: { xmin: -7, xmax: 7, ymin: -5, ymax: 5 }, t: { min: 0, max: 0, speed: 0 }, vars: { A: 1, B: 1, C: 0, D: 0 }, items: [{ type: 'func', expr: 'sin(x)', color: '#E3E7EE' }, { type: 'func', expr: 'A*sin(B*(x-C))+D', label: 'y', color: '#2F4BB8' }], params: [{ key: 'A', label: 'A แอมพลิจูด', min: -3, max: 3, step: 0.1 }, { key: 'B', label: 'B', min: 0.2, max: 4, step: 0.05 }, { key: 'C', label: 'C เลื่อนแนวนอน', min: -3.2, max: 3.2, step: 0.05 }, { key: 'D', label: 'D เลื่อนแนวตั้ง', min: -3, max: 3, step: 0.1 }] }],
  ['ลิมิตของ sin x / x', 'เมื่อ x เข้าใกล้ 0 ค่าเข้าใกล้ 1 แม้ที่ x = 0 จะหาค่าไม่ได้', { domain: 'math', title: 'lim sin x / x', view: { xmin: -10, xmax: 10, ymin: -0.5, ymax: 1.3 }, t: { min: -6, max: 6, speed: 1 }, items: [{ type: 'func', expr: 'equal(x,0) ? NaN : sin(x)/x', color: '#2F4BB8' }, { type: 'point', x: 't', y: 'equal(t,0) ? NaN : sin(t)/t', trace: true, label: 'x', color: '#C2571A' }, { type: 'func', expr: '1', color: '#E3E7EE' }] }]
);
SCENE_SUBJ.splice(0, SCENE_SUBJ.length, ['phys', 'ฟิสิกส์'], ['earth', 'โลกและอวกาศ'], ['chem', 'เคมี'], ['bio', 'ชีววิทยา'], ['health', 'สุขภาพและสาธารณสุข'], ['person', 'ร่างกายและการเคลื่อนไหว'], ['math', 'คณิตศาสตร์'], ['stat', 'สถิติ'], ['3d', 'สามมิติ']);
function sceneDomainFor() { const sj = curSubj()[0]; return ({ sport: 'person', chem: 'chem', bio: 'bio', med: 'health', nurse: 'health', pharm: 'health', ph: 'health', earth: 'earth', math: 'math', stat: 'stat', econ: 'stat', fin: 'stat', mkt: 'stat', log: 'stat' })[sj] || 'phys'; }

/* ---------- from a sketch or a sentence to a model, with the connected AI ---------- */
function sceneSchema() {
  return 'Reply with one JSON object only (no markdown), using this format. Every number in SI units; coordinates in metres with y pointing up.\n'
    + '{"domain":"phys|chem|bio|math","title":"short Thai title","note":"one Thai sentence telling the teacher what to try",\n'
    + ' PHYSICS: "world":{"w":width,"h":height,"x0":left,"y0":bottom,"g":9.8},\n'
    + '  "bodies":[{"id":"A","label":"A","shape":"box|ball|person","m":kg,"x":..,"y":..,"vx":..,"vy":..,"w":..,"h":..,"r":..,"q":charge,"e":bounce 0..1,"fixed":false,"color":"#RRGGBB"}],\n'
    + '  for a human figure (stick figure) use "shape":"person","act":"stand|walk|run|jump|longjump|fall|squat","hgt":height m,"v":walking/running speed or take-off vertical speed,"ang":long-jump angle deg,"push":push for fall, with x = where the person stands and a long horizontal ground surface (make it long, the view follows a moving person),\n'
    + '  "surfaces":[{"x1":..,"y1":..,"x2":..,"y2":..,"mu":kinetic,"mus":static}]  (ground, inclines and walls as line segments; a resting box centre is h/2 above its surface along the normal),\n'
    + '  "springs":[{"a":"bodyId or empty for a wall point","b":"bodyId","ax":wallX,"ay":wallY,"k":N/m,"L0":natural length}],\n'
    + '  "ropes":[{"a":"bodyId or empty","b":"bodyId or empty","ax":anchorX,"ay":anchorY,"via":[pulleyX,pulleyY] or null,"pr":pulley radius (bodies hang straight below pulleyX-pr and pulleyX+pr),"rod":false}]  (length is taken from the start positions),\n'
    + '  "forces":[{"on":"A","fx":N,"fy":N,"label":"F"}], "fields":{"E":[Ex,Ey],"B":Bz (out of screen positive),"drag":b,"central":{"x":..,"y":..,"GM":..,"r":drawRadius,"label":"Thai"}},\n'
    + '  "show":{"fbd":true,"net":false,"v":false,"a":false,"energy":false,"trail":true,"graph":"v|x|y|vx|vy|grf|none"} (grf = ground reaction force, good for people),\n'
    + ' CHEMISTRY or BIOLOGY (particles in a box, box about 100 x 60 units): "box":{"w":100,"h":60},"T":kelvin,\n'
    + '  "species":[{"id":"A","label":"Thai","n":count<=200,"r":1..3,"m":1..10,"color":"#RRGGBB","side":"left|right|all","fixed":false,\n'
    + '    for living things also "agent":true,"speed":5..12,"eats":["id"],"gain":energy per meal,"burn":energy per second,"birth":energy to reproduce,"life":seconds or 0; for plants "fixed":true,"regrow":per second,"cap":max}],\n'
    + '  "reactions":[{"from":["A","B"],"to":["C"],"Ea":0..6 (collision energy needed, in units of kT at 300 K)} or {"from":["A"],"to":["B"],"k":rate per second}],\n'
    + '  "membrane":{"x":0..1 position,"pass":["ids that can cross"]},\n'
    + ' MATHS: "view":{"xmin":..,"xmax":..,"ymin":..,"ymax":..},"t":{"min":..,"max":..,"speed":units per second,"loop":true},"vars":{"a":1},\n'
    + '  "items":[{"type":"func","expr":"a*sin(x)"},{"type":"curve","x":"cos(t)","y":"sin(t)","tmin":"0","tmax":"2*pi"},{"type":"point","x":"cos(t)","y":"sin(t)","trace":true,"label":"P"},{"type":"segment|vector","x1":"0","y1":"0","x2":"..","y2":".."},{"type":"tangent","of":0,"at":"t"},{"type":"area","of":0,"a":"0","b":"t","n":"0 or count"},{"type":"text","x":"..","y":"..","text":".."}]  (math.js expressions of x, t and vars),\n'
    + ' ALL: "params":[{"key":"A.m | B.vx | S1.mu | K1.k | F1.fx | R1.Ea | g | T | B | E.y | A.n | a","label":"Thai with unit","min":..,"max":..,"step":..}] (2 to 4 sliders that matter most for the lesson)}\n'
    + ' 3D (only when the user asks for three dimensions or the idea needs depth, e.g. helix in a magnetic field, conical pendulum, inclined orbit, gas in a box, surfaces z=f(x,y)): add "dim":3, z is up.\n'
    + '  PHYSICS 3D: "world":{"size":half width in m,"g":9.8,"ground":true|false,"mu":0.3},"bodies":[{"id":"A","shape":"ball|box","m":kg,"r":m,"p":[x,y,z],"v":[vx,vy,vz],"q":C,"e":0..1,"color":"#hex"}],"planes":[{"p":[x,y,z],"n":[nx,ny,nz],"mu":..,"size":m}],"ropes":[{"b":"A","anchor":[x,y,z]}],"springs":[{"a":"","b":"A","anchor":[x,y,z],"k":..,"L0":..}],"forces":[{"on":"A","f":[fx,fy,fz]}],"fields":{"E":[..],"B":[..],"central":{"p":[0,0,0],"GM":..,"r":..},"drag":..},"show":{"fbd":true,"v":false,"trail":true,"net":false}; slider keys A.x A.vz A.m B.z E.x K1.k F1.y g mu\n'
    + '  CHEM/BIO 3D: "box":{"w":60,"h":40,"d":40},"T":300,"species":[{"id","label","n" up to 160,"r","m","color","side"}],"reactions":[...],"membrane":{"x","pass"}; slider keys T, A.n, RX1.Ea\n'
    + '  MATHS 3D: "view":{"L":3},"t":{..},"vars":{..},"items":[{"type":"surface","expr":"f(x,y,t)"},{"type":"curve","x":"..(s)","y":"..","z":"..","s0":"0","s1":"2*pi"},{"type":"point|tangent","x":"..(t)","y":"..","z":".."},{"type":"vector","x","y","z"}]\n'
    + 'Make the numbers realistic and the scene fit inside the world box with some margin. Use bright, distinct colours.';
}
async function sceneFromAI(desc, img) {
  const dom = sceneDomainFor();
  const prompt = 'You turn a teacher\'s ' + (img ? 'hand-drawn sketch' : 'description') + ' into a moving model for a Thai classroom. The notebook subject suggests the domain "' + dom + '", but follow what the sketch or description actually shows.\n'
    + (desc ? 'Teacher\'s words: ' + desc + '\n' : '') + (pageText() ? 'Text on the same page, for context:\n' + pageText().slice(0, 1500) + '\n' : '')
    + 'Build the model so it moves by the real laws of the subject; for forces, include every body, surface, rope, spring and field shown so the free-body diagram is complete.\n' + sceneSchema();
  const r = await AI.run(img ? 'draw' : 'gen', prompt, img ? { images: [img], maxTokens: 2500 } : { maxTokens: 2500 });
  const m = String(r.text || '').match(/\{[\s\S]*\}/); if (!m) throw { code: 'empty_completion' };
  return scClean(JSON.parse(m[0]));
}
async function sceneFromSelection() {
  if (!S.sel || !S.sel.strokes.length) { toast('วงรอบภาพที่วาดก่อน'); return; }
  if (!needAI('draw')) return;
  const refs = S.sel.strokes.slice(); const img = await inkBlob(refs); if (!img) return;
  const B = floatWait('กำลังทำให้ภาพขยับได้', ['อ่านภาพที่วาด', 'สร้างแบบจำลองตามหลักวิชา', 'วางลงหน้า']);
  try {
    B.step(1); const spec = await sceneFromAI('', img.blob); B.step(2);
    const box = img.box; insertScene(spec, [clamp(box[2] + 20, 0, W - 640) , box[1]]); B.close();
  } catch (e) { B.close(); toast('ทำให้ขยับไม่สำเร็จ ลองวาดให้ชัดขึ้นหรือพิมพ์อธิบายเพิ่ม', 3500); }
}
/* ---------- lasso a drawing or a picture, then choose how it moves: the picture itself becomes the body ---------- */
const SPRITES = new Map();
/* a picture given by link (a teacher's picture on a learner's copy) */
function scSpriteUrl(u) {
  if (!okSigned(u)) return null;
  let s = SPRITES.get(u);
  if (!s) { s = { im: new Image(), ok: false }; SPRITES.set(u, s); s.im.onload = () => { s.ok = true; for (const [k, r] of SCN) { const it = findItem(k); if (it && r.cv && r.cv.isConnected && !r.playing) scRender(it, r); } }; s.im.src = u; }
  return s.ok ? s.im : null;
}
function scSprite(id) {
  let s = SPRITES.get(id);
  if (!s) {
    s = { im: new Image(), ok: false }; SPRITES.set(id, s);
    s.im.onload = () => { s.ok = true; for (const [k, r] of SCN) { const it = findItem(k); if (it && r.cv && r.cv.isConnected && !r.playing) scRender(it, r); } };
    if (blobUrls.has(id)) s.im.src = blobUrls.get(id); else { const box = document.createElement('span'); box.appendChild(s.im); setAssetSrc(s.im, id); }
  }
  return s.ok ? s.im : null;
}
/* the selected strokes and pictures on a clear background, cut tight */
/* ---------- what moves and what stays. A drawing that is coloured, on a page with a coloured background (sky, ground, a
   picture underneath), is circled loosely: the circle catches bits of the background too. The object is what its outline
   holds: the outline lines and the colour mostly inside them move; colour mostly outside (the background) stays, and so
   does a picture larger than the object (a photo it sits on). The object's colour that ran over its edge is trimmed to the
   edge, the object is solid (paper white inside its outline) so it does not show what it passes over, and where it leaves a
   hole in a coloured background the hole is filled from the colour around it ---------- */
const MV_SOFT = new Set(['brush', 'marker', 'crayon', 'water', 'oil', 'spray', 'soft', 'chalk']);
/* an outline line, as opposed to colouring */
const mvIsLine = (s) => s.k !== 'h' && s.k !== 'n' && !(s.o > 0 && s.o < 0.85) && (s.w || 3) <= 9 && !MV_SOFT.has(s.t);
const mvPts = (s) => { const p = s.p || [], o = []; for (let j = 0; j + 1 < p.length; j += 3) o.push([p[j] / 10, p[j + 1] / 10]); return o; };
/* the same points with more in between (every 3 px), so a long straight piece of colour is judged along its length */
function mvDense(p) { const o = []; for (let j = 0; j + 2 < p.length + 1; j += 3) { if (j >= 3) { const ax = p[j - 3], ay = p[j - 2], az = p[j - 1], bx = p[j], by = p[j + 1], bz = p[j + 2], L = Math.hypot(bx - ax, by - ay) / 10, n = Math.min(200, Math.floor(L / 3)); for (let i = 1; i < n; i++) { const t = i / n; o.push(Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t), Math.round(az + (bz - az) * t)); } } o.push(p[j], p[j + 1], p[j + 2]); } return o; }
/* the shape the outlines hold, on a coarse grid: lines are thickened to close small gaps, then everything the page edge
   cannot reach is inside */
function mvShape(strokes) {
  const lines = strokes.filter(mvIsLine), use = lines.length ? lines : strokes;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of use) for (const [x, y] of mvPts(s)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (!(x1 > x0) && !(y1 > y0)) return null;
  const pad = 14; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const m = clamp(320 / Math.max(x1 - x0, y1 - y0), 0.2, 1), mw = Math.max(4, Math.ceil((x1 - x0) * m)), mh = Math.max(4, Math.ceil((y1 - y0) * m));
  const cv = document.createElement('canvas'); cv.width = mw; cv.height = mh; const c = cv.getContext('2d');
  c.setTransform(m, 0, 0, m, -x0 * m, -y0 * m); c.strokeStyle = '#000'; c.fillStyle = '#000'; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const s of use) { const P = mvPts(s); if (!P.length) continue; c.lineWidth = (s.w || 3) + (lines.length ? 7 : 2); c.beginPath(); c.moveTo(P[0][0], P[0][1]); if (P.length === 1) c.lineTo(P[0][0] + 0.1, P[0][1]); for (const q of P) c.lineTo(q[0], q[1]); c.stroke(); }
  const d = c.getImageData(0, 0, mw, mh).data, N = mw * mh, ink = new Uint8Array(N), out = new Uint8Array(N), st = [];
  for (let i = 0; i < N; i++) ink[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  const push = (i) => { if (!out[i] && !ink[i]) { out[i] = 1; st.push(i); } };
  for (let x = 0; x < mw; x++) { push(x); push((mh - 1) * mw + x); } for (let y = 0; y < mh; y++) { push(y * mw); push(y * mw + mw - 1); }
  while (st.length) { const i = st.pop(), x = i % mw, y = (i / mw) | 0; if (x > 0) push(i - 1); if (x < mw - 1) push(i + 1); if (y > 0) push(i - mw); if (y < mh - 1) push(i + mw); }
  const inside = new Uint8Array(N); let nIn = 0, nInk = 0; for (let i = 0; i < N; i++) { if (!out[i]) { inside[i] = 1; nIn++; } if (ink[i]) nInk++; }
  const at = (x, y) => { const X = Math.floor((x - x0) * m), Y = Math.floor((y - y0) * m); return X >= 0 && Y >= 0 && X < mw && Y < mh && inside[Y * mw + X] === 1; };
  /* how deep each inside point is (in page px), to trim colour at the drawn edge rather than at the widened one */
  const dist = new Uint8Array(N), q = []; for (let i = 0; i < N; i++) if (!inside[i]) q.push(i); else dist[i] = 255;
  for (let h0 = 0; h0 < q.length; h0++) { const i = q[h0], x = i % mw, y = (i / mw) | 0, dv = dist[i] + 1; if (dv > 40) continue; for (const j of [x > 0 ? i - 1 : -1, x < mw - 1 ? i + 1 : -1, y > 0 ? i - mw : -1, y < mh - 1 ? i + mw : -1]) if (j >= 0 && dist[j] > dv) { dist[j] = dv; q.push(j); } }
  const deep = (x, y, need) => { const X = Math.floor((x - x0) * m), Y = Math.floor((y - y0) * m); return X >= 0 && Y >= 0 && X < mw && Y < mh && inside[Y * mw + X] === 1 && dist[Y * mw + X] / m >= need; };
  return { x0, y0, x1, y1, m, mw, mh, inside, at, deep, band: lines.length ? 3.5 : 1, solid: lines.length > 0 && nIn > nInk * 1.25, lines: new Set(lines.map((q) => q.id)) };
}
/* which of the circled strokes belong to the object */
function mvSplit(list) {
  const sh = mvShape(list.map((r) => r.s)); if (!sh || !sh.lines.size) return { keep: list, drop: [] };
  const bw = sh.x1 - sh.x0, bh = sh.y1 - sh.y0, keep = [], drop = [];
  for (const r of list) {
    if (sh.lines.has(r.s.id)) { keep.push(r); continue; }
    const P = mvPts({ p: mvDense(r.s.p || []) }); if (!P.length) { keep.push(r); continue; }
    let k = 0; for (const q of P) if (sh.at(q[0], q[1])) k++;
    const f = k / P.length, b = sbox(r.s), big = (b[2] - b[0]) * (b[3] - b[1]) > 1.5 * bw * bh;
    if (f >= 0.6 || (f > 0.2 && !big)) keep.push(r); else drop.push(r);
  }
  return { keep, drop };
}
/* colour trimmed at the object's edge (the same stroke, its points outside the outline left out) */
function mvTrim(s, sh) {
  if (sh.lines.has(s.id) || !sh.solid) return s;
  const need = sh.band + Math.max(0, (s.w || 3) / 2 - 1.5), p = mvDense(s.p || []), q = []; let cut = false; for (let j = 0; j + 2 < p.length + 1; j += 3) { if (sh.deep(p[j] / 10, p[j + 1] / 10, need)) q.push(p[j], p[j + 1], p[j + 2]); else cut = true; }
  return q.length >= 3 && cut ? Object.assign({}, s, { p: q }) : s;
}
/* the object made solid: paper white across what its outline holds, drawn under it as close rows of white */
function mvFill(sh) {
  if (!sh || !sh.solid) return [];
  const out = [], step = Math.max(1, Math.round(3 * sh.m)), w = 3 / 1 + 1.8;
  for (let Y = 0; Y < sh.mh; Y += step) {
    let X = 0;
    while (X < sh.mw) {
      const ok = (X) => sh.deep(sh.x0 + (X + 0.5) / sh.m, sh.y0 + (Y + 0.5) / sh.m, sh.band);
      while (X < sh.mw && !ok(X)) X++; const a = X;
      while (X < sh.mw && ok(X)) X++; const z = X;
      if (z > a) { const y = sh.y0 + (Y + 0.5) / sh.m; out.push({ id: 'u' + uid(), k: 'p', c: '#FFFFFF', w: w * Math.max(1, step / sh.m / 3), p: [Math.round((sh.x0 + a / sh.m) * 10), Math.round(y * 10), 50, Math.round((sh.x0 + z / sh.m) * 10), Math.round(y * 10), 50] }); }
    }
  }
  return out.length > 600 ? [] : out;
}
/* the hole the object leaves in a coloured background, filled from the colour around it (only where nothing else is
   drawn), as a picture under the writing */
async function mvPatch(sh, objIds) {
  if (!sh || !sh.solid) return null;
  const pad = 56, X0 = sh.x0 - pad, Y0 = sh.y0 - pad, X1 = sh.x1 + pad, Y1 = sh.y1 + pad, k = clamp(Math.min(window.devicePixelRatio || 1, 2) * Math.min(1, 520 / Math.max(X1 - X0, Y1 - Y0)), 0.3, 2); /* drawn at the screen's own sharpness, so crayon and brush grain match */
  const w = Math.max(4, Math.round((X1 - X0) * k)), h = Math.max(4, Math.round((Y1 - Y0) * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, -X0 * k, -Y0 * k);
  for (const it of (S.page.items || []).filter((t) => t.type === 'img')) { const el = itemsEl.querySelector('.item[data-id="' + it.id + '"] img'); if (el && el.complete && el.naturalWidth) { const b = itemBox(it); if (b[2] < X0 || b[0] > X1 || b[3] < Y0 || b[1] > Y1) continue; try { c.drawImage(el, b[0], b[1], b[2] - b[0], b[3] - b[1]); } catch (e) { /* skip */ } } }
  const rest = allStrokes().filter((r) => !objIds.has(r.s.id) && r.layer !== 'teacher').filter((r) => { const b = sbox(r.s); return !(b[2] < X0 || b[0] > X1 || b[3] < Y0 || b[1] > Y1); });
  drawInto(c, rest, null);
  let img; try { img = c.getImageData(0, 0, w, h); } catch (e) { return null; } /* a picture from another site cannot be read */
  const d = img.data, N = w * h, ins = new Uint8Array(N), ring = new Uint8Array(N);
  const inAt = (x, y) => sh.at(X0 + (x + 0.5) / k, Y0 + (y + 0.5) / k);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inAt(x, y)) ins[y * w + x] = 1;
  const r = Math.max(2, Math.round(16 * k)); /* the white margin often left when colouring round a drawing */
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (ins[i]) continue; let near = false; for (let dy = -r; dy <= r && !near; dy += Math.max(1, r >> 1)) for (let dx = -r; dx <= r && !near; dx += Math.max(1, r >> 1)) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && ins[Y * w + X]) near = true; } if (near) ring[i] = 1; }
  const colored = (i) => d[i * 4 + 3] > 40 && !(d[i * 4] > 235 && d[i * 4 + 1] > 235 && d[i * 4 + 2] > 235);
  let nr = 0, nc = 0, nh = 0, ni = 0; for (let i = 0; i < N; i++) { if (ring[i]) { nr++; if (colored(i)) nc++; } if (ins[i]) { ni++; if (!colored(i)) nh++; } }
  if (!nr || nc < 0.3 * nr || nh < 0.12 * ni) return null; /* no coloured background round it, or nothing left uncovered */
  /* known colour spreads inward ring by ring into the uncovered part of the hole */
  const known = new Uint8Array(N), hole = new Uint8Array(N);
  for (let i = 0; i < N; i++) { if ((ins[i] || ring[i]) && !colored(i)) hole[i] = 1; else if (colored(i)) known[i] = 1; }
  { /* a wider white gap, when the colour closes round it all the way (one that runs out to open paper is left alone) */
    const reg = new Uint8Array(N), st = []; let edge = false;
    for (let i = 0; i < N; i++) if (hole[i]) { reg[i] = 1; st.push(i); }
    while (st.length && !edge) { const i = st.pop(), x = i % w, y = (i / w) | 0; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { edge = true; break; } for (const j of [i - 1, i + 1, i - w, i + w]) if (!reg[j] && !colored(j)) { reg[j] = 1; st.push(j); } }
    if (!edge) for (let i = 0; i < N; i++) if (reg[i]) hole[i] = 1;
  }
  const src = new Uint8ClampedArray(d); /* the background as drawn, for its texture */
  const out = new Uint8ClampedArray(N * 4); let left = 0; for (let i = 0; i < N; i++) if (hole[i]) left++;
  /* ring by ring from the known colour inward: each wave takes the average of the neighbours already known */
  let wave = []; const queued = new Uint8Array(N);
  const nb = (i) => { const x = i % w, y = (i / w) | 0, o = []; if (x > 0) o.push(i - 1); if (x < w - 1) o.push(i + 1); if (y > 0) o.push(i - w); if (y < h - 1) o.push(i + w); return o; };
  for (let i = 0; i < N; i++) if (hole[i] && !known[i] && nb(i).some((j) => known[j])) { wave.push(i); queued[i] = 1; }
  for (let pass = 0; pass < 2000 && wave.length; pass++) {
    const vals = wave.map((i) => { let R = 0, G = 0, B = 0, A = 0, n = 0; for (const j of nb(i)) if (known[j]) { R += d[j * 4]; G += d[j * 4 + 1]; B += d[j * 4 + 2]; A += d[j * 4 + 3]; n++; } return [R / n, G / n, B / n, A / n]; });
    const next = [];
    wave.forEach((i, t) => { const v = vals[t]; d[i * 4] = out[i * 4] = v[0]; d[i * 4 + 1] = out[i * 4 + 1] = v[1]; d[i * 4 + 2] = out[i * 4 + 2] = v[2]; d[i * 4 + 3] = out[i * 4 + 3] = v[3]; known[i] = 1; });
    for (const i of wave) for (const j of nb(i)) if (hole[j] && !known[j] && !queued[j]) { queued[j] = 1; next.push(j); }
    wave = next;
  }
  /* the colour alone looks flat beside crayon or brush: each filled point takes the texture of a nearby piece of the same
     background (a small square fully coloured, outside the hole), repeated */
  const T = Math.max(8, Math.round(26 * k)), tiles = [];
  for (let ty = 0; ty + T <= h; ty += T >> 1) for (let tx = 0; tx + T <= w; tx += T >> 1) {
    let n = 0, R = 0, G = 0, B = 0, A = 0, bad = false;
    for (let y = ty; y < ty + T && !bad; y++) for (let x = tx; x < tx + T; x++) { const i = y * w + x; if (ins[i] || ring[i]) { bad = true; break; } const a = src[i * 4 + 3]; if (a > 10) n++; R += src[i * 4] * a; G += src[i * 4 + 1] * a; B += src[i * 4 + 2] * a; A += a; }
    if (bad || n < 0.3 * T * T || !A) continue;
    tiles.push({ tx, ty, R: R / A, G: G / A, B: B / A, n });
  }
  { const mx = Math.max(0, ...tiles.map((t) => t.n)); for (let i = tiles.length - 1; i >= 0; i--) if (tiles[i].n < 0.8 * mx) tiles.splice(i, 1); } /* only the fullest pieces: a texture, not the edge of a patch of colour */
  /* a few pixels past the hole too, under the thin ragged edge of the colour round it, so no pale seam is left */
  { const r2 = Math.max(1, Math.round(4 * k)), add = [];
    for (let i = 0; i < N; i++) { if (hole[i] || !(src[i * 4 + 3] > 0 && src[i * 4 + 3] < 200)) continue; const x = i % w, y = (i / w) | 0; let near = false; for (let dy = -r2; dy <= r2 && !near; dy++) for (let dx = -r2; dx <= r2; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && hole[Y * w + X]) { near = true; break; } } if (near) add.push(i); }
    for (const i of add) { out[i * 4] = src[i * 4]; out[i * 4 + 1] = src[i * 4 + 1]; out[i * 4 + 2] = src[i * 4 + 2]; out[i * 4 + 3] = 255; } }
  if (tiles.length) {
    for (let i = 0; i < N; i++) {
      if (!out[i * 4 + 3]) continue; const x = i % w, y = (i / w) | 0, r0 = out[i * 4], g0 = out[i * 4 + 1], b0 = out[i * 4 + 2]; /* the colour spread in, matched to the nearest texture of that colour */
      let best = null, bd = 1e9; for (const t of tiles) { const dd = (t.R - r0) ** 2 + (t.G - g0) ** 2 + (t.B - b0) ** 2 + 0.002 * ((t.tx - x) ** 2 + (t.ty - y) ** 2); if (dd < bd) { bd = dd; best = t; } }
      if (!best || bd > 5000) continue;
      const j = (best.ty + (y % T)) * w + best.tx + (x % T); out[i * 4] = src[j * 4]; out[i * 4 + 1] = src[j * 4 + 1]; out[i * 4 + 2] = src[j * 4 + 2]; out[i * 4 + 3] = src[j * 4 + 3];
    }
  }
  const pc = document.createElement('canvas'); pc.width = w; pc.height = h; pc.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
  const blob = await new Promise((res) => pc.toBlob(res, 'image/png')); if (!blob) return null;
  return { blob, x: X0, y: Y0, w: X1 - X0, ar: (Y1 - Y0) / (X1 - X0) };
}
/* applied to a moving drawing as it is made: what it draws (trimmed, solid), what comes back as ink, and the hole's fill */
async function mvApply(item, opt) {
  opt = opt || {};
  const orig = (item.ink || []).map(clone); if (!orig.length) return [];
  const sh = mvShape(orig); if (!sh) return [];
  item.orig = orig;
  if (!opt.person) { item.ink = orig.map((s) => mvTrim(s, sh)); const u = mvFill(sh); if (u.length) item.under = u; }
  if (opt.noPatch) return [];
  try {
    const P = await mvPatch(sh, new Set(orig.map((s) => s.id))); if (!P) return [];
    const A = await getAssets(); if (!A) return [];
    const up = await A.upload(P.blob, { type: 'image/png' }); blobUrls.set(up.id, URL.createObjectURL(P.blob));
    const pid = 'i' + uid(); item.patch = pid;
    return [{ id: pid, by: DEV, type: 'img', asset: up.id, x: Math.round(P.x), y: Math.round(P.y), w: Math.round(P.w), ar: +P.ar.toFixed(4), mvfill: 1 }];
  } catch (e) { return []; }
}
async function spriteFromSel() {
  const sel = S.sel; if (!sel) return null;
  let list = sel.strokes.map((r) => { const s = findStroke(r); return s ? { s, r } : null; }).filter(Boolean);
  let imgs = sel.items.map(findItem).filter((it) => it && it.type === 'img');
  if (!list.length && !imgs.length) return null;
  /* the background caught by the circle stays where it is */
  if (list.length > 1) list = mvSplit(list).keep;
  if (list.length) { let a = 1e9, b = 1e9, c2 = -1e9, d2 = -1e9; for (const r of list) { const q = sbox(r.s); a = Math.min(a, q[0]); b = Math.min(b, q[1]); c2 = Math.max(c2, q[2]); d2 = Math.max(d2, q[3]); } const area = Math.max(1, (c2 - a) * (d2 - b)); imgs = imgs.filter((it) => { const q = itemBox(it), ia = (q[2] - q[0]) * (q[3] - q[1]); return !(ia > 2.5 * area && q[0] <= a + 4 && q[1] <= b + 4 && q[2] >= c2 - 4 && q[3] >= d2 - 4); }); }
  if (!list.length && !imgs.length) return null;
  const sh = list.length ? mvShape(list.map((r) => r.s)) : null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const r of list) { boxCache.delete(r.s); const b = sbox(r.s), pw = (r.s.w || 3) / 2 + 2; x0 = Math.min(x0, b[0] - pw); y0 = Math.min(y0, b[1] - pw); x1 = Math.max(x1, b[2] + pw); y1 = Math.max(y1, b[3] + pw); }
  for (const it of imgs) { const b = itemBox(it); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  const w = Math.max(4, x1 - x0), h = Math.max(4, y1 - y0), k = clamp(Math.sqrt(500000 / (w * h)), 0.5, 3);
  const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  const c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  for (const it of imgs) { const el = itemsEl.querySelector('.item[data-id="' + it.id + '"] img'); if (el && el.complete && el.naturalWidth) { const b = itemBox(it); try { c.drawImage(el, b[0], b[1], b[2] - b[0], b[3] - b[1]); } catch (e) { /* picture from another site */ } } }
  if (sh) for (const u of mvFill(sh)) drawStroke(c, u);
  if (list.length) drawInto(c, list.map((r) => ({ s: sh ? mvTrim(r.s, sh) : r.s })), null);
  let blob = null; try { blob = await new Promise((res) => cv.toBlob(res, 'image/png')); } catch (e) { blob = null; }
  if (!blob) return null;
  return { blob, box: [x0, y0, x1, y1], ar: h / w, refs: list.map((r) => r.r), items: imgs.map((it) => it.id), ink: list.map((r) => clone(r.s)) };
}
function spriteBody(img, ar, S0, extra) { const w = ar >= 1 ? S0 / ar : S0, h = ar >= 1 ? S0 : S0 * ar; return Object.assign({ id: 'A', label: 'วัตถุ', shape: 'box', img, w: +w.toFixed(3), h: +h.toFixed(3), m: 1, e: 0, hull: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], skin: 0.004 }, extra || {}); }
function ipHull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  let h = lo.slice(0, -1).concat(up.slice(0, -1)); if (h.length > 40) { const k = h.length / 40; h = Array.from({ length: 40 }, (_, i) => h[Math.floor(i * k)]); } return h;
}
const MOTIONS = [
  ['fall', 'ตกอิสระ', 'ปล่อยจากที่สูง ตกลงพื้นแล้วกระดอน', (im, ar) => ({ domain: 'phys', title: 'ตกอิสระ', world: { w: 6, h: 7 }, bodies: [spriteBody(im, ar, 1.3, { x: 3, y: 6, e: 0.6 })], surfaces: [{ x1: 0, y1: 0.3, x2: 6, y2: 0.3 }], params: [{ key: 'g', label: 'g (m/s²)', min: 1, max: 20, step: 0.1 }, { key: 'A.e', label: 'การกระดอน e', min: 0, max: 0.95, step: 0.05 }, { key: 'A.y', label: 'ความสูงเริ่มต้น (m)', min: 1, max: 6.5, step: 0.1 }], show: { v: true, graph: 'y' } })],
  ['throw', 'ขว้างเป็นโพรเจกไทล์', 'มีแรงโน้มถ่วงอย่างเดียว เส้นทางเป็นพาราโบลา', (im, ar) => ({ domain: 'phys', title: 'โพรเจกไทล์', world: { w: 40, h: 16 }, bodies: [spriteBody(im, ar, 2.8, { x: 1.8, y: 1.8, vx: 12, vy: 14 })], surfaces: [{ x1: 0, y1: 0.5, x2: 40, y2: 0.5 }], params: [{ key: 'A.vx', label: 'ความเร็วต้นแนวราบ (m/s)', min: 0, max: 25, step: 0.5 }, { key: 'A.vy', label: 'ความเร็วต้นแนวดิ่ง (m/s)', min: 0, max: 25, step: 0.5 }, { key: 'g', label: 'g (m/s²)', min: 1, max: 20, step: 0.1 }], show: { v: true, graph: 'vy' } })],
  ['incline', 'ไถลลงพื้นเอียง', 'แรงเสียดทานสถิตยึดไว้ได้ถ้าพื้นฝืดพอ', (im, ar) => ({ domain: 'phys', title: 'ไถลลงพื้นเอียง', world: { w: 8, h: 5 }, bodies: [spriteBody(im, ar, 1.1, { x: 1.8, y: 3.6, m: 2 })], surfaces: [{ x1: 0.5, y1: 4, x2: 7, y2: 0.4, mu: 0.2, mus: 0.3 }, { x1: 0, y1: 0.4, x2: 8, y2: 0.4, mu: 0.4 }, { x1: 7.95, y1: 0.4, x2: 7.95, y2: 1.6 }], params: [{ key: 'S1.mu', label: 'μk ของพื้นเอียง', min: 0, max: 1, step: 0.05 }, { key: 'S1.mus', label: 'μs ของพื้นเอียง', min: 0, max: 1.2, step: 0.05 }, { key: 'A.m', label: 'มวล (kg)', min: 0.5, max: 10, step: 0.5 }], show: { graph: 'v' } })],
  ['pull', 'ถูกดึงบนพื้นราบ', 'แรงดึงคงที่ สู้กับแรงเสียดทาน', (im, ar) => ({ domain: 'phys', title: 'ถูกดึงบนพื้นราบ', world: { w: 12, h: 3.5 }, bodies: [spriteBody(im, ar, 1.3, { x: 1.2, y: 1.2, m: 2 })], surfaces: [{ x1: 0, y1: 0.4, x2: 12, y2: 0.4, mu: 0.2, mus: 0.3 }], forces: [{ on: 'A', fx: 10, fy: 0, label: 'F' }], params: [{ key: 'F1.fx', label: 'แรงดึง (N)', min: 0, max: 40, step: 0.5 }, { key: 'S1.mu', label: 'μk', min: 0, max: 1, step: 0.05 }, { key: 'A.m', label: 'มวล (kg)', min: 0.5, max: 10, step: 0.5 }], show: { graph: 'v' } })],
  ['const', 'เคลื่อนที่ด้วยความเร็วคงที่', 'ไม่มีแรงลัพธ์ ความเร็วไม่เปลี่ยน', (im, ar) => ({ domain: 'phys', title: 'ความเร็วคงที่', world: { w: 12, h: 3, g: 0 }, bodies: [spriteBody(im, ar, 1.3, { x: 1, y: 1.5, vx: 2 })], params: [{ key: 'A.vx', label: 'ความเร็ว (m/s)', min: -4, max: 6, step: 0.1 }], show: { v: true, graph: 'x', fbd: false } })],
  ['pend', 'แกว่งเป็นลูกตุ้ม', 'แขวนด้วยเชือก แรงตึงเปลี่ยนตามตำแหน่ง', (im, ar) => ({ domain: 'phys', title: 'ลูกตุ้ม', world: { w: 4, h: 3.6 }, bodies: [spriteBody(im, ar, 0.85, { x: 3.1, y: 1.7, m: 0.5 })], ropes: [{ a: '', b: 'A', ax: 2, ay: 3.4 }], params: [{ key: 'A.x', label: 'ตำแหน่งปล่อย (m)', min: 0.6, max: 3.4, step: 0.05 }, { key: 'g', label: 'g (m/s²)', min: 1, max: 20, step: 0.1 }], show: { graph: 'x', trail: true } })],
  ['springh', 'ติดสปริงแนวราบ', 'สั่นแบบฮาร์มอนิกอย่างง่ายบนพื้นลื่น', (im, ar) => ({ domain: 'phys', title: 'ติดสปริงแนวราบ', world: { w: 4, h: 1.8 }, bodies: [spriteBody(im, ar, 0.7, { x: 2.6, y: 0.6 })], springs: [{ a: '', b: 'A', ax: 0.2, ay: 0.6, k: 40, L0: 1.8 }], surfaces: [{ x1: 0, y1: 0.25, x2: 4, y2: 0.25 }], params: [{ key: 'K1.k', label: 'k (N/m)', min: 5, max: 200, step: 5 }, { key: 'A.m', label: 'มวล (kg)', min: 0.2, max: 5, step: 0.1 }, { key: 'A.x', label: 'ตำแหน่งเริ่มต้น (m)', min: 1.2, max: 3.4, step: 0.05 }], show: { graph: 'x', energy: true } })],
  ['springv', 'แขวนกับสปริงแนวดิ่ง', 'สั่นขึ้นลงรอบจุดสมดุล', (im, ar) => ({ domain: 'phys', title: 'แขวนกับสปริง', world: { w: 3, h: 4.2 }, bodies: [spriteBody(im, ar, 0.8, { x: 1.5, y: 1.4 })], springs: [{ a: '', b: 'A', ax: 1.5, ay: 4, k: 30, L0: 1.6 }], params: [{ key: 'K1.k', label: 'k (N/m)', min: 5, max: 120, step: 1 }, { key: 'A.m', label: 'มวล (kg)', min: 0.2, max: 4, step: 0.1 }, { key: 'A.y', label: 'ตำแหน่งปล่อย (m)', min: 0.4, max: 3, step: 0.05 }], show: { graph: 'y', energy: true } })],
  ['orbit', 'โคจรรอบศูนย์กลาง', 'แรงดึงเข้าศูนย์กลาง ความเร็วตั้งฉากกับแรง', (im, ar) => ({ domain: 'phys', title: 'การโคจร', world: { w: 12, h: 8, x0: -6, y0: -4, g: 0 }, bodies: [spriteBody(im, ar, 1.2, { x: 0, y: 3, vx: 2.3 })], fields: { central: { x: 0, y: 0, GM: 16, r: 0.8, label: '' } }, params: [{ key: 'A.vx', label: 'ความเร็วต้น (m/s)', min: 0.5, max: 4, step: 0.05 }], show: { v: true, graph: 'v' } })]
];
const PERSON_MOVES = [['walk', 'เดิน'], ['run', 'วิ่ง'], ['idle', 'ยืนหายใจ'], ['wave', 'โบกมือ'], ['dance', 'เต้น'], ['jump', 'กระโดดตัวตรง'], ['longjump', 'กระโดดไกล'], ['fall', 'ถูกผลักล้ม'], ['squat', 'สควอต']];
/* the pieces inside what was circled: strokes that touch or nearly touch belong to one piece, each picture is its own piece */
function motionPieces(sp) {
  const parts = [];
  for (const r of sp.refs) { const st = findStroke(r); if (!st) continue; const b = sbox(st); parts.push({ refs: [r], items: [], b: b.slice() }); }
  for (const id of sp.items) { const it = findItem(id); if (it) parts.push({ refs: [], items: [id], b: itemBox(it).slice() }); }
  const m = 14, near = (a, c) => a[0] - m < c[2] && c[0] - m < a[2] && a[1] - m < c[3] && c[1] - m < a[3];
  let merged = true;
  while (merged) { merged = false;
    for (let i = 0; i < parts.length && !merged; i++) for (let k = i + 1; k < parts.length; k++) if (near(parts[i].b, parts[k].b)) {
      const A = parts[i], B = parts[k]; A.refs = A.refs.concat(B.refs); A.items = A.items.concat(B.items); A.b = [Math.min(A.b[0], B.b[0]), Math.min(A.b[1], B.b[1]), Math.max(A.b[2], B.b[2]), Math.max(A.b[3], B.b[3])]; parts.splice(k, 1); merged = true; break; }
  }
  parts.sort((a, c) => (a.b[1] + a.b[3]) / 2 - (c.b[1] + c.b[3]) / 2 > 40 ? 1 : (c.b[1] + c.b[3]) / 2 - (a.b[1] + a.b[3]) / 2 > 40 ? -1 : a.b[0] - c.b[0]);
  return parts.map((q, k) => ({ n: k + 1, refs: q.refs, items: q.items, box: q.b }));
}
/* plain words to a behaviour, for when no AI is connected: เดิน วิ่ง บิน ว่าย กระโดด หมุน ไหว ... with left, right, fast, slow */
const MV_WORDS = [[/กลิ้ง/, 'roll'], [/สี่ขา|หมา|แมว|ม้า|ช้าง|วัว/, 'walk4'], [/กระโดด|ดึ๋ง/, 'hop'], [/บิน|กระพือ|นก|ผีเสื้อ/, 'flap'], [/ว่าย|ปลา/, 'swim'], [/ขับ|วิ่ง|รถ|รถไฟ/, 'drive'], [/หมุน|กังหัน|ล้อ/, 'spin'], [/พลิ้ว|ธง|ผ้า/, 'flutter'],
  [/ไหว|ลม|ต้นไม้|หญ้า|ดอกไม้/, 'sway'], [/หายใจ/, 'breathe'], [/เต้นตุบ|หัวใจ|กะพริบ|เต้น/, 'beat'], [/ลอย|ลูกโป่ง|เมฆ/, 'bob'], [/ดุ๊กดิ๊ก|โยก/, 'wiggle'], [/ไฟ|เปลว|เทียน|ควัน/, 'flicker'], [/สั่น|กระดิ่ง/, 'shake'], [/เดิน/, 'walk4']];
function motionWords(t) {
  const o = {}; for (const [re, k] of MV_WORDS) if (re.test(t)) { o.k = k; break; }
  /* falling, dropping, bouncing, rolling down a slope, being thrown or knocked: real physics on the page */
  if (/ตก|ร่วง|หล่น|กระเด้ง|กระดอน|กลิ้งลง|ไหลลง|ไถล|เอียง|ลาด|ขว้าง|โยน|ปา|ปล่อย|ชนแล้ว|กระเด็น|แรงโน้มถ่วง/.test(t)) { o.k = 'phys'; o.phys = {}; if (/กลิ้ง|ลูกบอล|วงกลม|ล้อ/.test(t)) o.phys.round = 1; if (/ขว้าง|โยน|ปา/.test(t)) { o.phys.vx = /ซ้าย/.test(t) ? -500 : 500; o.phys.vy = -600; } if (/กระเด้ง|ลูกบอล|ยาง/.test(t)) o.phys.e = 0.72; }
  if (/นิ่ง|อยู่กับที่|ไม่ขยับ/.test(t)) o.k = 'none';
  /* faces and voices: shouting, talking, laughing, smiling, sad, crying, surprised, angry */
  for (const [re, e] of [[/ตะโกน|ร้องเรียก|แผดเสียง|ตวาด|เชียร์/, 'shout'], [/หัวเราะ|ขำ/, 'laugh'], [/ร้องไห้|น้ำตา/, 'cry'], [/ตกใจ|อึ้ง|ประหลาดใจ/, 'surprise'], [/โกรธ|โมโห|หงุดหงิด/, 'angry'], [/เศร้า|เสียใจ|ผิดหวัง/, 'sad'], [/ยิ้ม|ดีใจ|มีความสุข/, 'happy'], [/พูด|คุย|บอก|อธิบาย|เล่า/, 'talk']]) if (re.test(t)) { o.expr = e; break; }
  if (o.expr && !o.k) o.k = 'breathe';
  /* what the real thing would show while doing it */
  const fx = [], add = (type, at, text) => { if (!fx.some((f) => f.type === type)) fx.push(Object.assign({ type }, at ? { at } : {}, text ? { text } : {})); };
  if (/เห่า/.test(t)) { add('mouth'); add('sound'); add('say', 'mouth', 'โฮ่ง!'); }
  if (/ร้องเหมียว|แมวร้อง/.test(t)) { add('mouth'); add('say', 'mouth', 'เหมียว'); }
  if (/ขัน|ไก่/.test(t) && /ขัน|ร้อง/.test(t)) { add('mouth'); add('say', 'mouth', 'เอ้กอี๊!'); }
  if (/ร้องเพลง|ฮัมเพลง|ผิวปาก|เพลง|ดนตรี/.test(t)) { add('notes'); if (!o.expr) add('mouth'); }
  if (/บีบแตร|แตร|ฮอร์น/.test(t)) { add('sound', 'front'); add('say', 'front', 'ปี๊น!'); }
  if (/คำราม/.test(t)) { add('mouth'); add('sound'); add('say', 'mouth', 'แฮ่!'); }
  if (/หอน/.test(t)) { add('mouth'); add('say', 'mouth', 'โฮ้ว'); }
  if (/ร้อง|เสียง|ดัง/.test(t) && !fx.length && !o.expr) { add('mouth'); add('sound'); }
  if (/นอน|หลับ|ง่วง/.test(t)) add('zzz');
  if (/รัก|หลงรัก|ชอบมาก/.test(t)) add('hearts');
  if (/มึน|เวียนหัว|งง/.test(t)) add('stars');
  if (/คิด|สงสัย|ไม่เข้าใจ/.test(t)) add('question');
  if (/ร้อน|เหนื่อย|เหงื่อ/.test(t)) add('sweat'); if (/ร้อนมาก|เดือด|ระอุ|ไอน้ำ|ต้ม/.test(t)) add('steam');
  if (/หนาว|สั่น/.test(t)) add('shake'); if (/หิมะ/.test(t)) add('snow'); if (/ฝน/.test(t)) add('rain'); if (/ใบไม้ร่วง|ใบไม้ปลิว/.test(t)) add('leaves');
  if (/ไฟไหม้|ลุกไหม้|ติดไฟ/.test(t)) add('fire'); if (/ควัน/.test(t)) add('smoke'); if (/ประกาย|ช็อต|สปาร์ก/.test(t)) add('sparks');
  if (/เปียก|หยดน้ำ|น้ำหยด/.test(t)) add('drops'); if (/กระเซ็น|สาดน้ำ|ตกน้ำ/.test(t)) add('splash', 'bottom'); if (/ฟอง/.test(t)) add('bubbles');
  if (/สว่าง|ส่องแสง|เรืองแสง|ไฟเปิด/.test(t)) add('glow'); if (/วิบวับ|แวววาว|เงาวับ|ระยิบ/.test(t)) add('shine', [0.3, 0.3]);
  if (/ลมพัด|ลมแรง|พายุ/.test(t)) add('wind'); if (/ฟ้าผ่า|สายฟ้า/.test(t)) add('bolt'); if (/เร็วมาก|พุ่ง|ซิ่ง/.test(t)) add('speed');
  if (/ฝุ่น/.test(t)) add('dust', 'bottom');
  if (fx.length) o.fx = fx;
  /* sleeping, or only making a sound, is done standing still unless the words also say it goes somewhere */
  const goes = /เดิน|วิ่ง|บิน|ว่าย|กระโดด|ขับ|ไปทาง|ไปมา|เคลื่อน|กลิ้ง/.test(t);
  if (/นอน|หลับ/.test(t) && !goes) { o.k = 'breathe'; o.edge = 'stay'; }
  else if (fx.length && !goes && !o.expr && ['walk4', 'drive', 'flap', 'swim', 'hop'].includes(o.k) && fx.some((f) => ['mouth', 'sound', 'say', 'notes'].includes(f.type))) { o.k = o.k === 'flap' ? 'bob' : 'breathe'; o.edge = 'stay'; }
  if (/ซ้าย/.test(t)) o.face = -1; else if (/ขวา/.test(t)) o.face = 1;
  if (/เร็วมาก/.test(t)) o.sp = 2.4; else if (/เร็ว/.test(t)) o.sp = 1.7; else if (/ช้ามาก/.test(t)) o.sp = 0.35; else if (/ช้า/.test(t)) o.sp = 0.6;
  if (/วนรอบ|วนกลับ|วนไป|วนมา|ทะลุ|อีกฝั่ง/.test(t)) o.edge = 'wrap'; else if (/แอบ|โผล่/.test(t)) o.edge = 'peek'; else if (/ไม่ไปไหน|ที่เดิม/.test(t)) o.edge = 'stay'; else if (/หันกลับ|เดินกลับ|กลับไปกลับมา/.test(t)) o.edge = 'bounce';
  if (/ชน|โต้ตอบ|หลบ|บนเส้น|บนพื้น|ข้าม/.test(t)) o.touch = 1;
  return o;
}

/* without AI: "นกบินโฉบมาที่คน" names who moves (the first thing named) and where it goes (the thing after ที่ หา ใส่ ...).
   A stick figure is recognised by its shape, so with two drawings the other one is the bird, the car, the ball ... */
const MV_NOUNS = [['person', /คน|ผู้ชาย|ผู้หญิง|เด็ก|นักเรียน|ครู|ชาย|หญิง/], ['flyer', /นก|ผีเสื้อ|ค้างคาว|เครื่องบิน|แมลง|ผึ้ง/], ['fish', /ปลา/], ['car', /รถ/], ['animal', /หมา|แมว|ม้า|ช้าง|วัว|กระต่าย|กบ|สุนัข/], ['ball', /ลูกบอล|บอล|ก้อน|วงกลม|ลูก/]];
function motionTargeted(text, pieces) {
  if (pieces.length < 2) return null;
  const found = []; for (const [kind, re] of MV_NOUNS) { const m = re.exec(text); if (m) found.push([kind, m.index]); }
  if (!found.length) return null; found.sort((a, b) => a[1] - b[1]);
  const isPerson = (p) => { try { const st = p.refs.map(findStroke).filter(Boolean); if (st.length < 4) return false; const rg = ipRig(st); return !!(rg.headC && rg.legs.filter(Boolean).length === 2); } catch (e) { return false; } };
  const people = pieces.filter(isPerson), others = pieces.filter((p) => !people.includes(p));
  const pick = (kind, not) => { const pool = (kind === 'person' ? people : others).filter((p) => p !== not); if (pool.length) return pool[0]; const rest = pieces.filter((p) => p !== not); return rest.length === 1 ? rest[0] : null; };
  const subj = pick(found[0][0]); if (!subj) return null;
  const tm = /(?:ที่|หา|ใส่|ไปยัง|เข้าหา|ถึง|ไล่|ตาม)\s*(?:ตัว)?\s*([^\s]+)/.exec(text.slice(found[0][1] + 1));
  let target = null; if (tm) { const nk = MV_NOUNS.find(([, re]) => re.test(tm[1])); if (nk) target = pick(nk[0], subj); }
  if (!target && found[1]) target = pick(found[1][0], subj);
  const w = motionWords(text), flyer = found[0][0] === 'flyer' || w.k === 'flap', sub = flyer ? 'flap' : found[0][0] === 'fish' ? 'swim' : found[0][0] === 'animal' ? 'walk4' : found[0][0] === 'person' ? undefined : w.k;
  const plan = pieces.map((p) => ({ n: p.n, group: p.n, k: 'none' }));
  const me = plan.find((q) => q.n === subj.n);
  if (target && /โฉบ|ไปหา|เข้าหา|มาหา|พุ่ง|ไปที่|มาที่|บินไป|บินมา|วิ่งไป|วิ่งมา|ไล่|จิก|ชน|ตาม/.test(text)) {
    const a = subj.box, b = target.box, ax = (a[0] + a[2]) / 2, ay = (a[1] + a[3]) / 2, bx = (b[0] + b[2]) / 2, by = (b[1] + b[3]) / 2, dx = bx - ax, dy = by - ay;
    const sp = clamp(w.sp || 1, 0.3, 3), T = (Math.hypot(dx, dy) / 260 + 0.8) / sp, up = -Math.max(60, (a[3] - a[1]) * 1.5);
    /* a swoop: dive in an arc to just above the target, pull up and away, circle back to where it started */
    const keys = flyer || /โฉบ/.test(text)
      ? [{ t: 0, dx: 0, dy: 0 }, { t: T * 0.35, dx: dx * 0.45, dy: dy * 0.2 + up * 0.4 }, { t: T * 0.75, dx: dx * 0.88, dy: dy - (b[3] - b[1]) * 0.55 }, { t: T, dx: dx, dy: dy - (b[3] - b[1]) * 0.75 }, { t: T * 1.3, dx: dx * 1.12 + Math.sign(dx || 1) * 60, dy: dy * 0.3 + up }, { t: T * 1.9, dx: dx * 0.6, dy: up * 1.4 }, { t: T * 2.5, dx: 0, dy: 0 }]
      : [{ t: 0, dx: 0, dy: 0 }, { t: T, dx: dx - Math.sign(dx || 1) * ((a[2] - a[0]) / 2 + (b[2] - b[0]) / 2 + 6), dy: 0 }, { t: T + 0.8, dx: dx - Math.sign(dx || 1) * ((a[2] - a[0]) / 2 + (b[2] - b[0]) / 2 + 6), dy: 0 }, { t: 2 * T + 0.8, dx: 0, dy: 0 }];
    Object.assign(me, { k: 'path', path: { loop: true, keys }, sub, face: Math.sign(dx) || 1 });
    /* the one being swooped at or chased comes alive too, standing and breathing, so it can duck and flinch away */
    const tq = plan.find((q) => q.n === target.n); if (tq) Object.assign(tq, { k: 'breathe' });
  } else Object.assign(me, w.k ? w : { k: sub || 'auto' });
  return plan;
}
const MV_LAST = { plan: '' };
async function motionPlan(text, sp, pieces) {
  MV_LAST.plan = '';
  /* with AI: it sees the numbered pieces and the request and says what each piece does; pieces in the same group move as one */
  if (AI.ready('read')) {
    try {
      const cv = document.createElement('canvas'), im = await createImageBitmap(sp.blob), k = im.width / (sp.box[2] - sp.box[0]);
      cv.width = im.width; cv.height = im.height; const c = cv.getContext('2d'); c.drawImage(im, 0, 0);
      c.font = 'bold ' + Math.round(18 * Math.max(1, k)) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const p of pieces) { const x = ((p.box[0] + p.box[2]) / 2 - sp.box[0]) * k, y = (p.box[1] - sp.box[1]) * k + 14 * k; c.fillStyle = '#B5432F'; c.beginPath(); c.arc(x, y, 13 * k, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillText(String(p.n), x, y + 1); }
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      const kinds = LIFE_KINDS.map((x) => x[0] + ' (' + x[2] + ')').join('; ');
      const boxes = pieces.map((p) => 'piece ' + p.n + ': x ' + Math.round(p.box[0]) + ' to ' + Math.round(p.box[2]) + ', y ' + Math.round(p.box[1]) + ' to ' + Math.round(p.box[3])).join('; ');
      const r = await AI.run('read', 'A teacher circled a drawing on a notebook page; the pieces are numbered 1 to ' + pieces.length + ' in red. The page is ' + W + ' units wide and ' + H + ' units tall, y grows downward. Piece boxes in page units: ' + boxes + '.\nThe teacher wrote how it should move: "' + text.slice(0, 500) + '".\n'
        + 'First recognise what each piece is (for example ball, wheel, car body, stick figure head, tree, bird, ramp line) and which pieces form one object; pieces of one object share a group number and move together. A piece the teacher does not mention and that is scenery (ground, slope, table) does not move: give it mode "none".\n'
        + 'Judge how detailed the teacher was. If the request is short or vague (for example only "นกบิน" or "ให้ขยับ"), complete it the way the real thing behaves: real speed and timing, natural arcs and pauses, wings beating, legs stepping, gravity and bounce, other pieces reacting when something comes close, and keep it believable for a science class. If the request is detailed, follow it exactly and add nothing that changes what was asked.\n'
        + 'Then choose for each group the motion that does what the teacher asked, as naturally as possible:\n'
        + '- "physics": a real rigid body on the page. It falls with gravity, rolls down drawn slopes, bounces off lines, pictures and the page edges, and knocks into other moving things. Use it for falling, dropping, rolling down, bouncing, throwing, sliding, colliding, anything that should obey real physics. Give phys: vx, vy start velocity in page units per second (y down, so negative vy is upward; a throw is about 300 to 900), bounce 0 to 0.9 (ball 0.7, rock 0.3, clay 0.05), friction 0 to 1, gravity 1 (0 for space), round true for balls, wheels, circles, spin start turn in radians per second.\n'
        + '- "preset": one of these behaviours when it fits well: ' + kinds + '.\n'
        + '- "path": any other movement described (circle around, climb up then come down, jump onto something, wave, spin three times, grow, shrink, go to a place). Give path.keys as a list of key frames {t seconds from start, dx, dy offset in page units from where it is drawn, rot degrees, scale}, first key t 0 with dx 0 dy 0, and loop true or false; path.anim is the behaviour the body keeps doing while it follows the path (flap for a bird beating its wings, walk4, swim, wiggle, or none). To go to another piece (swoop at it, run to it, chase it), aim the keys at that piece using the boxes above. Use enough keys (6 to 20) for a smooth natural motion and keep it on the page.\n'
        + 'Only the pieces the teacher asks to move should move; every other piece gets mode "none" (it may still react when something hits it).\n'
        + 'A drawn person or face can also show a feeling or make a sound: give "expr" one of shout, talk, laugh, happy, sad, cry, surprise, angry when the teacher asks for it or it clearly fits (shouting, calling out, cheering = shout). The app then redraws the mouth, eyes and eyebrows to match and adds sound lines, tears or the like, so the face really changes; pick a body motion that suits it (breathe or wiggle when standing, a path when it goes somewhere). Put all pieces of one person in one group.\n'
        + 'Make every thing, whatever it is, believable with "fx": a list (at most 5) of what the real thing would show while doing what was asked, each {"type", "at", "text"}. type is one of ' + LIFE_FX.join(', ') + ' (sound = sound lines, say = the sound word written by it, mouth = its mouth opening and closing as it makes the sound, notes = music notes, zzz = sleeping, steam = hot steam, drops = dripping water, glow = light, shine = a glint, speed = speed lines, shake = trembling marks). at is front, back, top, bottom, center, mouth, or [u, v] in the piece box (0 to 1 from the drawn left and top, the way it was drawn). text is the Thai sound word for say, at most 8 letters (a dog barking: โฮ่ง!, a car horn: ปี๊น!, a cat: เหมียว, a rooster: เอ้กอี๊!, a bell: กริ๊ง). For example: a dog barking gets mouth at its head, sound and say; a kettle boiling gets steam at the spout; a sleeping cat gets zzz; a singing bird gets notes and mouth; a car racing gets speed and dust; a lamp turned on gets glow. Add nothing that the teacher would not expect.\n'
        + 'Also give "plan": one short Thai sentence saying what will happen, written for the teacher (mention anything you added to make it natural).\n'
        + 'Reply with JSON only: {"plan":"...","pieces":[{"n":1,"group":1,"what":"ball","mode":"physics","k":"","face":"right","speed":1,"edge":"bounce","touch":true,"phys":{"vx":0,"vy":0,"bounce":0.6,"friction":0.3,"gravity":1,"round":true,"spin":0},"path":null}]}\nface is left or right, speed 0.3 to 3, edge is wrap, bounce, peek or stay, touch true when it should walk on or bump into other things.', { images: [blob], maxTokens: 2200 });
      const j = JSON.parse(String(r.text || '').replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
      if (j && typeof j.plan === 'string' && j.plan.trim()) MV_LAST.plan = j.plan.trim().slice(0, 200);
      if (j && Array.isArray(j.pieces) && j.pieces.length) return j.pieces.map((q) => {
        const o = { n: +q.n, group: +q.group || +q.n, what: String(q.what || '').slice(0, 40), k: q.k, face: q.face === 'left' ? -1 : q.face === 'right' ? 1 : 0, sp: +q.speed || 1, edge: q.edge, touch: q.touch ? 1 : 0, expr: ['shout', 'talk', 'laugh', 'happy', 'sad', 'cry', 'surprise', 'angry'].includes(q.expr) ? q.expr : undefined,
          fx: Array.isArray(q.fx) ? q.fx.filter((f) => f && LIFE_FX.includes(f.type)).slice(0, 5).map((f) => ({ type: f.type, at: Array.isArray(f.at) ? [clamp(+f.at[0] || 0, -0.5, 1.5), clamp(+f.at[1] || 0, -0.5, 1.5)] : ['front', 'back', 'top', 'bottom', 'center', 'mouth'].includes(f.at) ? f.at : undefined, text: f.text ? String(f.text).replace(/[<>]/g, '').slice(0, 10) : undefined, color: /^#[0-9a-f]{6}$/i.test(f.color || '') ? f.color : undefined, rate: f.rate ? clamp(+f.rate, 0.3, 3) : undefined })) : undefined };
        if (q.mode === 'none') o.k = 'none';
        else if (q.mode === 'physics' || q.k === 'phys') { const f = q.phys || {}; o.k = 'phys'; o.phys = { vx: clamp(+f.vx || 0, -2500, 2500), vy: clamp(+f.vy || 0, -2500, 2500), e: clamp(f.bounce == null ? 0.5 : +f.bounce, 0, 0.95), mu: clamp(f.friction == null ? 0.35 : +f.friction, 0, 1.5), g: clamp(f.gravity == null ? 1 : +f.gravity, 0, 3), spin: clamp(+f.spin || 0, -40, 40) }; if (f.round != null) o.phys.round = f.round ? 1 : 0; }
        else if (q.mode === 'path' && q.path && Array.isArray(q.path.keys) && q.path.keys.length >= 2) { o.k = 'path'; o.sub = LIFE_KINDS.some((x) => x[0] === q.path.anim) ? q.path.anim : (/bird|นก|butterfly|bat/i.test(o.what) ? 'flap' : undefined); o.path = { loop: q.path.loop !== false, keys: q.path.keys.slice(0, 40).map((k) => ({ t: clamp(+k.t || 0, 0, 60), dx: clamp(+k.dx || 0, -W, W), dy: clamp(+k.dy || 0, -H, H), rot: clamp(+k.rot || 0, -3600, 3600), scale: clamp(+k.scale || 1, 0.1, 5) })) }; }
        return o;
      });
    } catch (e) { /* fall back to the words */ }
  }
  /* without AI: "ชิ้นที่ 1 ..." lines go to that piece, anything else applies to the whole drawing */
  const per = {}; const re = /ชิ้น(?:ที่)?\s*(\d+)([^]*?)(?=ชิ้น(?:ที่)?\s*\d+|$)/g; let m;
  while ((m = re.exec(text))) per[+m[1]] = motionWords(m[2]);
  if (Object.keys(per).length) return pieces.map((p) => Object.assign({ n: p.n, group: p.n }, per[p.n] || { k: 'auto' }));
  { const tg = motionTargeted(text, pieces); if (tg) return tg; }
  const all = motionWords(text); return pieces.map((p) => Object.assign({ n: p.n, group: 1 }, all.k ? all : Object.assign({ k: 'auto' }, all)));
}
async function motionDo(text, sp, pieces) {
  const plan = await motionPlan(text, sp, pieces);
  const groups = new Map(); for (const q of plan) { const p = pieces.find((x) => x.n === q.n); if (!p) continue; const g = groups.get(q.group) || { plan: q, refs: [], items: [], box: [1e9, 1e9, -1e9, -1e9] }; g.refs.push(...p.refs); g.items.push(...p.items); g.box = [Math.min(g.box[0], p.box[0]), Math.min(g.box[1], p.box[1]), Math.max(g.box[2], p.box[2]), Math.max(g.box[3], p.box[3])]; groups.set(q.group, g); }
  let made = 0;
  for (const g of groups.values()) {
    const q = g.plan; if (q.k === 'none') continue;
    const sub = { refs: g.refs, items: g.items, box: g.box };
    let k = q.k, f = q.face || 0;
    const ex = Object.assign(q.expr ? { expr: q.expr } : {}, q.fx && q.fx.length ? { fx: q.fx } : {});
    if (k === 'phys' || k === 'path') { await placeLife(sub, k, 'stay', f, k === 'phys' ? Object.assign({ touch: 1 }, q.phys || {}, ex) : Object.assign({ path: q.path }, q.sub ? { sub: q.sub } : {}, ex)); made++; continue; }
    if (!k || k === 'auto' || !LIFE_KINDS.some((x) => x[0] === k)) { const a = await lifeAuto(Object.assign({}, sp, sub)); if (Array.isArray(a)) { k = a[0]; f = f || a[1]; } else k = a; if (k === 'person') k = q.expr ? 'breathe' : 'wiggle'; }
    const before = new Set((S.page.items || []).map((x) => x.id));
    await placeLife(sub, k, (q.expr || q.fx) && !LIFE_KINDS.find((x) => x[0] === k)[3] ? 'stay' : (q.edge || 'bounce'), f, ex);
    const it = (S.page.items || []).find((x) => x.type === 'life' && !before.has(x.id));
    if (it && (q.sp && q.sp !== 1 || q.touch)) lifeSet(it, Object.assign({}, q.sp && q.sp !== 1 ? { sp: clamp(q.sp, 0.2, 3) } : {}, q.touch ? { touch: 1 } : {}));
    made++;
  }
  if (made && MV_LAST.plan) { toast(MV_LAST.plan, 5500); return; }
  toast(made ? 'ให้ภาพเคลื่อนไหวแล้ว ' + made + ' ชิ้น แตะปุ่มเล็กข้างภาพเพื่อปรับทีละชิ้น' : 'ไม่มีชิ้นไหนต้องขยับตามที่บอก', 3000);
}
async function openMotionPick() {
  const sp = await spriteFromSel(); if (!sp) { toast('วงรอบภาพที่วาดหรือรูปที่แทรกก่อน'); return; }
  let sh = $('#motionSheet');
  if (!sh) { sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'motionSheet'; sh.innerHTML = '<div class="panel wide mvpanel" role="dialog" aria-label="เลือกการเคลื่อนที่"><div class="mvhead"><h2>ให้ภาพนี้เคลื่อนที่แบบไหน</h2><button class="btn" type="button" data-a="x">ยกเลิก</button></div><div class="mvbody"></div></div>'; document.body.appendChild(sh); sh.querySelector('[data-a="x"]').onclick = () => { sh.hidden = true; }; }
  const body = sh.querySelector('.mvbody'); body.innerHTML = '';
  const url = URL.createObjectURL(sp.blob), pieces = motionPieces(sp);
  const done = () => { sh.hidden = true; URL.revokeObjectURL(url); if (typeof selQuiet === 'function') selQuiet(); };
  const go = async (make, person) => { done(); try { await placeMotion(sp, make, person); } catch (e) { toast('ทำให้ภาพเคลื่อนที่ไม่สำเร็จ ' + (e && e.code ? assetErr(e) : ''), 3500); } };
  let edge = 'bounce'; try { edge = store_ls.get('tp-edge') || 'bounce'; } catch (e) { /* default */ }
  const goHere = async (kind, act) => { done(); try { await placeInPlace(sp, kind, act, edge); } catch (e) { toast('ทำให้ภาพเคลื่อนที่ไม่สำเร็จ', 3000); } };
  const goLife = async (k) => { done(); try { let f = 0; if (k === 'auto') { k = await lifeAuto(sp); if (Array.isArray(k)) { f = k[1]; k = k[0]; } } if (k === 'person') await placeInPlace(sp, null, edge === 'stay' ? 'idle' : 'walk', edge); else await placeLife(sp, k, edge, f); } catch (e) { toast('ทำให้ภาพมีชีวิตไม่สำเร็จ', 3000); } };
  /* the picture with its pieces numbered, beside a box to say in words how it should move */
  const top = document.createElement('div'); top.className = 'mvtop';
  const fig = document.createElement('div'); fig.className = 'mvfig'; const img = document.createElement('img'); img.alt = 'ภาพที่เลือก'; img.src = url; fig.appendChild(img);
  if (pieces.length > 1) for (const p of pieces) { const bdg = document.createElement('span'); bdg.className = 'mvnum'; bdg.textContent = p.n; bdg.style.left = (((p.box[0] + p.box[2]) / 2 - sp.box[0]) / Math.max(1, sp.box[2] - sp.box[0]) * 100).toFixed(1) + '%'; bdg.style.top = ((p.box[1] - sp.box[1]) / Math.max(1, sp.box[3] - sp.box[1]) * 100).toFixed(1) + '%'; fig.appendChild(bdg); }
  const say = document.createElement('div'); say.className = 'mvsay';
  say.innerHTML = '<label for="mvText"><b>บอกเองว่าอยากให้ขยับแบบไหน</b>' + (pieces.length > 1 ? '<small>ในภาพมี ' + pieces.length + ' ชิ้น ดูหมายเลขในภาพ</small>' : '') + '</label><textarea id="mvText" rows="3"></textarea><div class="mvrow"><button type="button" class="btn solid">ทำตามนี้</button><small></small></div>';
  const ta = say.querySelector('textarea'); ta.placeholder = pieces.length > 1 ? 'เช่น ชิ้นที่ 1 รถวิ่งไปทางขวาเร็ว ๆ ชิ้นที่ 2 ต้นไม้ไหวตามลม' : 'เช่น วิ่งไปทางซ้ายช้า ๆ แล้วหันกลับที่ขอบ หรือ กระโดดข้ามสิ่งที่ขวาง';
  say.querySelector('.mvrow small').textContent = AI.ready('read') ? 'AI จะอ่านคำบอกและดูภาพให้' : 'ใช้คำง่าย ๆ เช่น เดิน วิ่ง บิน ว่าย กระโดด หมุน ไหว ลอย ซ้าย ขวา เร็ว ช้า ชน';
  ta.value = ''; /* a fresh request every time: the words written for the last picture never carry over */
  say.querySelector('.btn').onclick = async () => { const t = ta.value.trim(); if (!t) { ta.focus(); return; } try { store_ls.set('tp-mv-say', t); } catch (e) { /* fine */ } done(); try { await motionDo(t, sp, pieces); } catch (e) { toast('ทำให้ภาพเคลื่อนไหวไม่สำเร็จ', 3000); } };
  top.append(fig, say); body.appendChild(top);
  /* or pick from ready-made choices, one group at a time */
  const tabs = document.createElement('div'); tabs.className = 'seg mvtabs'; tabs.setAttribute('role', 'tablist');
  const panes = {};
  const T = [['life', 'ภาพมีชีวิต'], ['phys', 'ตามหลักฟิสิกส์'], ['sim', 'กล่องแบบจำลอง']];
  for (const [k, n] of T) { const b = document.createElement('button'); b.type = 'button'; b.dataset.t = k; b.textContent = n; b.setAttribute('role', 'tab'); tabs.appendChild(b); panes[k] = document.createElement('div'); panes[k].className = 'mvpane'; }
  body.append(tabs, ...Object.values(panes));
  const show = (k) => { for (const b of tabs.children) b.setAttribute('aria-selected', b.dataset.t === k ? 'true' : 'false'); for (const [kk, el] of Object.entries(panes)) el.hidden = kk !== k; try { store_ls.set('tp-mv-tab', k); } catch (e) { /* fine */ } };
  for (const b of tabs.children) b.onclick = () => show(b.dataset.t);
  const card = (name, hint, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mvopt'; b.innerHTML = '<b></b><span></span>'; b.querySelector('b').textContent = name; b.querySelector('span').textContent = hint; b.onclick = fn; return b; };
  /* living pictures: what happens at the edge, then the behaviours */
  const er = document.createElement('div'); er.className = 'mvedge'; er.innerHTML = '<span>ถึงขอบกระดาษแล้ว</span>';
  for (const [k, n] of [['bounce', 'หันกลับ'], ['wrap', 'วนกลับมาอีกฝั่ง'], ['peek', 'แอบโผล่ที่ขอบ'], ['stay', 'ไม่ไปไหน']]) { const c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = n; c.setAttribute('aria-pressed', k === edge ? 'true' : 'false'); c.onclick = () => { edge = k; try { store_ls.set('tp-edge', k); } catch (e) { /* fine */ } er.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', x === c ? 'true' : 'false')); }; er.appendChild(c); }
  const gl = document.createElement('div'); gl.className = 'mvgrid';
  gl.appendChild(card('เลือกให้อัตโนมัติ', 'ดูจากรูปทรง' + (AI.ready('read') ? ' และให้ AI ช่วยดู' : ''), () => goLife('auto')));
  for (const [k, name, hint] of LIFE_KINDS) gl.appendChild(card(name, hint, () => goLife(k)));
  panes.life.append(er, gl);
  const g1 = document.createElement('div'); g1.className = 'mvgrid';
  for (const [k, name, hint] of IP_KINDS) g1.appendChild(card(name, hint, () => goHere(k)));
  panes.phys.appendChild(exEl('p', 'mvnote', 'ภาพเคลื่อนที่ตามกฎของนิวตันตรงที่วาด เส้นอื่นรอบ ๆ เช่น พื้น พื้นเอียง ผนัง เป็นพื้นผิวให้ชนและไถล'));
  panes.phys.appendChild(g1);
  if (sp.refs.length) {
    panes.phys.appendChild(exEl('p', 'mvnote', 'ถ้าภาพเป็นคน ให้แขนขาขยับตามจริง'));
    const pc = document.createElement('div'); pc.className = 'chips';
    for (const [act, name] of PERSON_MOVES) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = name; b.onclick = () => goHere(null, act); pc.appendChild(b); }
    panes.phys.appendChild(pc);
  }
  const grid = document.createElement('div'); grid.className = 'mvgrid';
  for (const [k, name, hint, make] of MOTIONS) grid.appendChild(card(name, hint, () => go(make)));
  panes.sim.appendChild(exEl('p', 'mvnote', 'แยกออกเป็นกล่องแบบจำลอง มีกราฟและแผนภาพแรงครบ'));
  panes.sim.appendChild(grid);
  if (AI.ready('draw')) { const ai = document.createElement('button'); ai.type = 'button'; ai.className = 'btn mvai'; ai.textContent = 'ให้ AI ดูภาพแล้วสร้างสถานการณ์ให้เอง'; ai.onclick = () => go('ai'); panes.sim.appendChild(ai); }
  let t0 = 'life'; try { t0 = store_ls.get('tp-mv-tab') || 'life'; } catch (e) { /* default */ } show(panes[t0] ? t0 : 'life');
  sh.hidden = false;
}
async function placeMotion(sp, make, person) {
  let spec;
  if (person) {
    const t = SCENE_TPL.person.find((x) => x[2].bodies[0].act === person); spec = JSON.parse(JSON.stringify(t[2]));
  } else {
    const A = await getAssets(); if (!A) throw { code: 'no_assets' };
    const up = await A.upload(sp.blob, { type: 'image/png' }); blobUrls.set(up.id, URL.createObjectURL(sp.blob));
    if (make === 'ai') {
      const B = floatWait('AI กำลังดูภาพ', ['อ่านภาพ', 'สร้างสถานการณ์ตามหลักวิชา', 'วางลงหน้า']);
      const ink = await inkBlob(sp.refs).catch(() => null);
      try { B.step(1); spec = await sceneFromAI('', (ink && ink.blob) || sp.blob); B.close(); } catch (e) { B.close(); throw e; }
      const b = spec.domain === 'phys' && spec.bodies.find((x) => !x.fixed && x.shape !== 'person');
      if (b) { const S0 = Math.max(b.w, b.h, b.r * 2); Object.assign(b, spriteBody(up.id, sp.ar, S0, { id: b.id, m: b.m, x: b.x, y: b.y, vx: b.vx, vy: b.vy, e: b.e, q: b.q })); b.shape = 'box'; }
    } else spec = make(up.id, sp.ar);
  }
  const bw = sp.box[2] - sp.box[0], w = Math.round(clamp(Math.max(480, bw * 2.4), 420, W - 40)), x = Math.round(clamp(sp.box[0] - 20, 10, W - w - 10)), y = Math.round(clamp(sp.box[1] - 40, 10, H - 200));
  /* the drawing moves into the box; it can come back as ink */
  const removed = [], touched = new Set();
  for (const r of sp.refs) { const arr = layerArr(r.layer); const i = arr.findIndex((s) => s.id === r.id); if (i >= 0) { removed.push({ layer: r.layer, stroke: arr[i] }); arr.splice(i, 1); touched.add(r.layer); } }
  if (removed.length) { pushUndo({ t: 'erase', removed }); saveLayers(touched); drawInk(); }
  const keepImgs = sp.items.map(findItem).filter(Boolean).map(clone);
  const before = clone(S.page.items || []);
  const item = { id: 'i' + uid(), by: DEV, type: 'scene', spec: scClean(spec), x, y, w, ink: sp.ink.slice(0, 400), pics: keepImgs.slice(0, 6) };
  const extra = person ? [] : await mvApply(item, {}); delete item.under; if (item.orig) { item.ink = item.orig; delete item.orig; }
  setItems(before.filter((t) => !sp.items.includes(t.id)).concat([item], extra), before);
  clearSel();
  toast('ภาพเคลื่อนที่ได้แล้ว กดเล่น ปรับค่าด้วยแถบเลื่อน', 2600);
}
function restoreInk(it) {
  if (!it || !S.page) return;
  const mine = layerArr(DEV), have = new Set(mine.map((s) => s.id));
  const ink0 = it.orig || it.ink || [];
  for (const s of ink0.concat(it.hide || [])) if (!have.has(s.id)) mine.push(clone(s));
  if (ink0.length || (it.hide || []).length) { saveLayers(new Set([DEV])); drawInk(); }
  const before = clone(S.page.items || []);
  setItems(before.filter((t) => t.id !== it.id && t.id !== it.patch).concat((it.back || (it.spec && it.spec.bare ? [] : it.pics) || []).map(clone)), before);
  SCN.delete(it.id);
}

/* ---------- the drawing moves right on the paper: the lines around it become the floor, slopes and walls it meets;
   a drawn string becomes a pendulum, a drawn zigzag a spring; a drawn stick figure walks with its own arms and legs ---------- */
const ipPts = (s) => { const o = []; for (let i = 0; i + 1 < s.p.length; i += 3) o.push([s.p[i] / 10, s.p[i + 1] / 10]); return o; };
const ipLen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
function ipRdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let mi = 0, md = 0; for (let i = 1; i < pts.length - 1; i++) { const d = ipSegD(pts[i], pts[0], pts[pts.length - 1]); if (d > md) { md = d; mi = i; } }
  if (md <= eps) return [pts[0], pts[pts.length - 1]];
  const a = ipRdp(pts.slice(0, mi + 1), eps), b = ipRdp(pts.slice(mi), eps); return a.slice(0, -1).concat(b);
}
const ipWrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const ipAng = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const ipRot = (p, o, th, n) => { const c = Math.cos(th), s = Math.sin(th), dx = p[0] - o[0], dy = p[1] - o[1]; return [n[0] + c * dx - s * dy, n[1] + s * dx + c * dy]; };
function ipBox(strokes, pics) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of strokes) for (const p of ipPts(s)) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  for (const q of pics || []) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + q.w); y1 = Math.max(y1, q.y + q.h); }
  return [x0, y0, x1, y1];
}
/* where the joints of a drawn stick figure are */
function ipRig(strokes) {
  /* points every couple of units along each line: a straight arm drawn quickly may be stored as just its two ends */
  const B = ipBox(strokes), Hd = Math.max(20, B[3] - B[1]), all = []; for (const s of strokes) { const P = ipPts(s); if (P.length) all.push(P[0]); for (let q = 1; q < P.length; q++) { const a = P[q - 1], z = P[q], n = Math.max(1, Math.ceil(Math.hypot(z[0] - a[0], z[1] - a[1]) / 2.5)); for (let m = 1; m <= n; m++) all.push([a[0] + (z[0] - a[0]) * m / n, a[1] + (z[1] - a[1]) * m / n]); } }
  let headC = null, headR = 0;
  for (const s of strokes) { const P = ipPts(s); if (P.length < 6) continue; const b = ipBox([s]), bw = b[2] - b[0], bh = b[3] - b[1], sz = Math.max(bw, bh); if (Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 0.4 * sz && bh > 0.06 * Hd && bh < 0.45 * Hd && (b[1] + b[3]) / 2 < B[1] + 0.4 * Hd && bw / Math.max(1, bh) > 0.5 && bw / Math.max(1, bh) < 2) { if (!headC || b[1] < headC[1] - headR) { headC = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; headR = sz / 2; } } }
  if (!headC) { const top = all.filter((p) => p[1] < B[1] + 0.1 * Hd); headC = [top.reduce((a, p) => a + p[0], 0) / Math.max(1, top.length) || (B[0] + B[2]) / 2, B[1] + 0.1 * Hd]; headR = 0.1 * Hd; }
  const neck = [headC[0], headC[1] + headR];
  /* the hip is where the two legs meet: scan up from the feet while the ink still splits into two or more parts */
  let hipY = neck[1] + 0.44 * (B[3] - neck[1]);
  { const gap = Math.max(4, 0.04 * Hd); let last = null, first = null; const dense = [];
    for (const s of strokes) { const P = ipPts(s); for (let q = 1; q < P.length; q++) { const a = P[q - 1], z = P[q], n = Math.max(1, Math.ceil(Math.hypot(z[0] - a[0], z[1] - a[1]) / 1.5)); for (let m = 0; m < n; m++) dense.push([a[0] + (z[0] - a[0]) * m / n, a[1] + (z[1] - a[1]) * m / n]); } }
    for (let y = B[3] - 2; y > neck[1] + 0.1 * (B[3] - neck[1]); y -= 2) {
      const xs = dense.filter((p) => Math.abs(p[1] - y) < 1.2).map((p) => p[0]).sort((a, z) => a - z); if (!xs.length) continue;
      let n = 1; for (let q = 1; q < xs.length; q++) if (xs[q] - xs[q - 1] > gap) n++;
      if (n >= 2) { const sp = xs[xs.length - 1] - xs[0]; if (!first) first = [y, sp]; last = [y, sp]; } else if (last != null) break;
    }
    /* the legs only look apart a little below where they really join: follow their spread back up to where it would be zero */
    if (last) { let y = last[0]; if (first && first[1] - last[1] > 2 && first[0] - last[0] > 4) y = last[0] - last[1] * (first[0] - last[0]) / (first[1] - last[1]); y = Math.max(y, last[0] - 0.12 * Hd);
      if (y > neck[1] + 0.2 * (B[3] - neck[1]) && y < B[3] - 0.12 * Hd) hipY = y; } }
  const band = all.filter((p) => Math.abs(p[1] - hipY) < 0.05 * Hd).map((p) => p[0]).sort((a, b) => a - b);
  const hip = [band.length ? band[Math.floor(band.length / 2)] : neck[0], hipY];
  const sh = [neck[0] + 0.2 * (hip[0] - neck[0]), neck[1] + 0.2 * (hip[1] - neck[1])];
  const near = (grp, q) => { let best = null, bd = 1e9; for (const p of grp) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; best = p; } } return best; };
  const legs = [all.filter((p) => p[1] > hip[1] + 0.1 * Hd && p[0] < hip[0]), all.filter((p) => p[1] > hip[1] + 0.1 * Hd && p[0] >= hip[0])].map((g) => {
    if (g.length < 2) return null; let ft = g[0]; for (const p of g) if (p[1] > ft[1] + 0.5 || (Math.abs(p[1] - ft[1]) <= 0.5 && Math.abs(p[0] - hip[0]) > Math.abs(ft[0] - hip[0]))) ft = p;
    const mid = [(hip[0] + ft[0]) / 2, (hip[1] + ft[1]) / 2], k = near(g, mid), L = Math.hypot(ft[0] - hip[0], ft[1] - hip[1]);
    return { kn: k && Math.hypot(k[0] - mid[0], k[1] - mid[1]) < 0.25 * L ? k : mid, ft };
  });
  if (!legs[0] && legs[1]) legs[0] = { kn: [2 * hip[0] - legs[1].kn[0], legs[1].kn[1]], ft: [2 * hip[0] - legs[1].ft[0], legs[1].ft[1]] };
  if (!legs[1] && legs[0]) legs[1] = { kn: [2 * hip[0] - legs[0].kn[0], legs[0].kn[1]], ft: [2 * hip[0] - legs[0].ft[0], legs[0].ft[1]] };
  const tx = (y) => neck[0] + (hip[0] - neck[0]) * clamp((y - neck[1]) / ((hip[1] - neck[1]) || 1), 0, 1);
  const armPts = all.filter((p) => p[1] > neck[1] && p[1] < hip[1] + 0.1 * Hd && Math.abs(p[0] - tx(p[1])) > 0.07 * Hd && Math.hypot(p[0] - headC[0], p[1] - headC[1]) > headR * 1.2);
  const arms = [armPts.filter((p) => p[0] < tx(p[1])), armPts.filter((p) => p[0] >= tx(p[1]))].map((g) => {
    if (g.length < 3) return null; let hd = g[0]; for (const p of g) if (Math.hypot(p[0] - sh[0], p[1] - sh[1]) > Math.hypot(hd[0] - sh[0], hd[1] - sh[1])) hd = p;
    const mid = [(sh[0] + hd[0]) / 2, (sh[1] + hd[1]) / 2], e = near(g, mid); return { el: e || mid, hd };
  });
  return { kind: 'person', headC, headR, neck, sh, hip, legs, arms, foot: Math.max(...legs.filter(Boolean).map((l) => l.ft[1]), B[3]) };
}
/* bones of the drawing, each point of the ink follows the nearest bone */
function ipBones(R) {
  const b = [['torso', R.hip, R.sh], ['head', R.sh, R.headC]];
  R.legs.forEach((l, i) => { if (l) { b.push(['th' + i, R.hip, l.kn]); b.push(['sh' + i, l.kn, l.ft]); } });
  R.arms.forEach((a, i) => { if (a) { b.push(['ua' + i, R.sh, a.el]); b.push(['fa' + i, a.el, a.hd]); } });
  return b;
}
/* each point follows its nearest bone; near a joint it blends the two bones that meet there, so lines bend smoothly instead of breaking */
function ipBind(strokes, R) {
  const bones = ipBones(R), Hd = Math.max(20, R.foot - (R.headC[1] - R.headR)), bw = 0.07 * Hd;
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  const adj = (i, j) => { const a = bones[i], b = bones[j]; return same(a[1], b[1]) || same(a[1], b[2]) || same(a[2], b[1]) || same(a[2], b[2]); };
  return strokes.map((s) => ipPts(s).map((p) => {
    if (Math.hypot(p[0] - R.headC[0], p[1] - R.headC[1]) < R.headR * 1.25) return [1, 1, 0];
    /* a point on the left leg or arm stays with the left one, even right where both legs leave the hip */
    const sideOf = (nm) => (/^(th|sh|ua|fa)0$/.test(nm) ? -1 : /^(th|sh|ua|fa)1$/.test(nm) ? 1 : 0), ps = p[0] < R.hip[0] - 0.01 * Hd ? -1 : p[0] > R.hip[0] + 0.01 * Hd ? 1 : 0;
    const ds = bones.map((bn, i) => { const sd = sideOf(bn[0]); let d = i === 1 ? 1e9 : ipSegD(p, bn[1], bn[2]); if (sd && ps && sd !== ps && (p[1] > R.hip[1] || /^(ua|fa)/.test(bn[0]))) d += 0.05 * Hd; return [d, i]; }).sort((a, b) => a[0] - b[0]);
    const [d1, i1] = ds[0]; const nx = ds.slice(1).find(([, j]) => adj(i1, j));
    const blen = (i) => Math.hypot(bones[i][2][0] - bones[i][1][0], bones[i][2][1] - bones[i][1][1]);
    const bwk = nx ? Math.min(bw, 0.35 * Math.min(blen(i1), blen(nx[1]))) : bw;
    if (nx && nx[0] - d1 < bwk) { const w2 = 0.5 * (1 - (nx[0] - d1) / bwk); return [i1, nx[1], w2]; }
    return [i1, i1, 0];
  }));
}
/* joints of the model person in world units */
function psJoints(b) {
  const K = b.kin || { hx: b.x, hy: b.y, fl: [b.x - 0.1, b.y - 0.8], fr: [b.x + 0.1, b.y - 0.8], lean: 0, swing: 0, tuck: 0, rot: 0 };
  const H = b.hgt, Lg = 0.5 * H, hip = [K.hx, K.hy], dir = (b.vx || 0) >= 0 ? 1 : -1, rot = K.rot || 0, lean = (K.lean || 0) * dir + rot;
  const tor = 0.3 * H, sh = [hip[0] + tor * Math.sin(lean), hip[1] + tor * Math.cos(lean)], head = [sh[0] + 0.1 * H * Math.sin(lean), sh[1] + 0.1 * H * Math.cos(lean)];
  const arm = (s, ua, fa) => { const a = ua != null ? ua * dir : -s * 0.7, f = fa != null ? fa * dir : a + 0.5 * dir, el = [sh[0] + 0.16 * H * Math.sin(a + rot), sh[1] - 0.16 * H * Math.cos(a + rot)], hd = [el[0] + 0.15 * H * Math.sin(f + rot), el[1] - 0.15 * H * Math.cos(f + rot)]; return [el, hd]; };
  const [eB, hB] = arm(-(K.swing || 0), K.aB, K.fB), [eF, hF] = arm(K.swing || 0, K.aF, K.fF);
  return { K, H, Lg, hip, sh, head, dir, fl: K.fl, fr: K.fr, kl: psIK(hip, K.fl, Lg / 2, Lg / 2, dir), kr: psIK(hip, K.fr, Lg / 2, Lg / 2, dir), eB, hB, eF, hF };
}
/* at the edge of the paper a walking drawing comes round the other side, turns back, or peeks out and then turns back.
   Turning back mirrors the drawing about where it stands, so it faces the way it walks */
function ipEdge(it, r, x0, x1) {
  const b = r.st.bodies.find((q) => q.shape === 'person' || !q.fixed); if (!b) return;
  const span = x1 - x0, half = (it.rig.kind === 'person' ? 0.22 * b.hgt : Math.max(b.w || 0, b.h || 0) / 2) || 0.3, m = r.mir || { s: 1, O: 0 }, Kp = W / Math.max(1e-6, span);
  const disp = (m.s * b.x * Kp + m.O) / Kp, goingRight = (b.vx || 0) * m.s >= 0, e = it.rig.edge;
  if (e === 'wrap') { if (goingRight && disp - half > x1) ipShift(r, b, -(span + 2 * half) * m.s); else if (!goingRight && disp + half < x0) ipShift(r, b, (span + 2 * half) * m.s); }
  else if (e === 'bounce') { if ((goingRight && disp + half > x1) || (!goingRight && disp - half < x0)) { if (b.shape === 'person') { r.turning = 0; r.turned = false; } else ipTurn(it, r); } }
  else if (e === 'peek') { if ((goingRight && disp - half * 0.15 > x1) || (!goingRight && disp + half * 0.15 < x0)) r.peek = 2.4; }
}

/* a drawn person walking on the page cannot walk through writing, pictures, boxes or other moving drawings:
   it stops short, startles for a moment, then turns back. The ground line it walks on is not in the way */
function ipSense(it, r) {
  const b = r.st.bodies.find((q) => q.shape === 'person'); if (!b || r.turning != null || r.peek) return;
  const K = W / Math.max(1e-6, it.spec.world.w || 1), m = r.mir || { s: 1, O: 0 };
  if (!r.inkB) { r.inkB = ipBox(it.ink || [], []); r.cx0 = b.x * K; }
  const B = r.inkB, bw = B[2] - B[0], bh = B[3] - B[1], cx = m.s * b.x * K + m.O, dx = cx - r.cx0;
  const box = [B[0] + dx, B[1], B[2] + dx, B[3]];
  const mv = r.pcx == null ? 0 : cx - r.pcx; r.pcx = cx; if (Math.abs(mv) > 0.01) r.pdir = Math.sign(mv); const dir = r.pdir || 0; if (!dir) return;
  const reach = Math.max(8, bw * 0.25), f0 = dir > 0 ? box[2] : box[0], za = Math.min(f0, f0 + dir * reach), zb = Math.max(f0, f0 + dir * reach);
  const yTop = box[1] + bh * 0.05, feet = box[3];
  let hit = false;
  for (const rr of allStrokes()) {
    const q = sbox(rr.s), w = q[2] - q[0], h = q[3] - q[1], ground = (w > 2.5 * h && w > 60) || w > 260;
    const yb = ground ? feet - bh * 0.35 : feet - 3;
    if (q[2] < za || q[0] > zb || q[3] < yTop || q[1] > yb) continue;
    if (typeof lifeTopIn === 'function' && lifeTopIn(rr.s, za, zb, yTop, yb) == null) continue;
    hit = true; break;
  }
  if (!hit) for (const o of (S.page && S.page.items) || []) {
    if (o.id === it.id || o.lock) continue; const q = o.type === 'life' && o.B && typeof LIFE !== 'undefined' && LIFE.get(o.id) ? lifeBox(o, LIFE.get(o.id)) : (o.spec && o.spec.bare) ? null : itemBox(o);
    if (!q || q[2] - q[0] < 4) continue; if (q[2] < za || q[0] > zb || q[3] < yTop || q[1] > feet - 3) continue; hit = true; break;
  }
  if (!hit) return;
  /* stop, a short startled pause, then turn round (the pause leads into the turn) */
  r.peek = 0.45;
}
function ipShift(r, b, dx) { if (b.shape === 'person') b.x0 += dx; b.x += dx; }
function ipTurn(it, r) {
  const b = r.st.bodies.find((q) => q.shape === 'person' || !q.fixed); if (!b) return;
  const span = W / Math.max(1e-6, (it.spec.world.w || 1)), m = r.mir || { s: 1, O: 0 }, here = m.s * b.x * span + m.O;
  r.mir = { s: -m.s, O: 2 * here - m.O };
  if (b.shape !== 'person') { b.vx = -b.vx; r.mir = null; }
}
/* draw the moving ink of a body (rigid, with turning wheels) or of a drawn person */
function ipDrawInk(c, it, r, b, X, Y) {
  const rig = it.rig || {}, ry = it.y || 0, P = (w) => [X(w[0]), Y(w[1]) + ry];
  c.save(); c.translate(0, -ry); if (r.mir) { c.translate(r.mir.O, 0); c.scale(r.mir.s, 1); }
  if (r.turning != null && rig.kind === 'person') { const f = Math.max(0.1, Math.abs(Math.cos(Math.PI * r.turning))), hx = X(b.x); c.translate(hx, 0); c.scale(f, 1); c.translate(-hx, 0); }
  if (rig.kind === 'person') {
    const J = psJoints(b), E0 = r.E0 || (r.E0 = J), d = (k) => [P(J[k])[0] - P(E0[k])[0], P(J[k])[1] - P(E0[k])[1]];
    const A = (j, a, z) => ipAng(P(j[a]), P(j[z]));
    const R = rig, hipN = [R.hip[0] + d('hip')[0], R.hip[1] + d('hip')[1]];
    const Jn = psJoints(Object.assign({}, b, { kin: Object.assign({}, J.K, { swing: 0, aF: null, aB: null, fF: null, fB: null }) }));
    const dT = ipWrap(A(J, 'hip', 'sh') - A(E0, 'hip', 'sh')), shN = ipRot(R.sh, R.hip, dT, hipN);
    const T = [[R.hip, hipN, dT], [R.sh, shN, dT]];
    const pdir = -J.dir;
    R.legs.forEach((l, i) => {
      if (!l) return; const fk = i ? 'fr' : 'fl', df = d(fk), ft = [l.ft[0] + df[0], l.ft[1] + df[1]];
      const L1 = Math.hypot(l.kn[0] - R.hip[0], l.kn[1] - R.hip[1]), L2 = Math.hypot(l.ft[0] - l.kn[0], l.ft[1] - l.kn[1]);
      const kn = psIK(hipN, ft, L1, L2, pdir), ftN = (() => { const a = ipAng(kn, ft); return [kn[0] + L2 * Math.cos(a), kn[1] + L2 * Math.sin(a)]; })();
      T.push([R.hip, hipN, ipWrap(ipAng(hipN, kn) - ipAng(R.hip, l.kn))]); T.push([l.kn, kn, ipWrap(ipAng(kn, ftN) - ipAng(l.kn, l.ft))]);
    });
    R.arms.forEach((a, i) => {
      if (!a) return; const ek = i ? 'eF' : 'eB', hk = i ? 'hF' : 'hB';
      const ov = (i ? J.K.aF : J.K.aB) != null, flip = r.mir && r.mir.s < 0 ? -1 : 1;
      /* a raised or waving arm turns to the pose itself; a swinging arm swings a little around how it was drawn */
      /* a raised arm goes up on its own side of the body, never across the face */
      const side = Math.sign(a.hd[0] - R.sh[0]) || 1, tgt = (ang) => (Math.sign(Math.cos(ang)) === side || Math.abs(Math.cos(ang)) < 1e-3 ? ang : Math.PI - ang);
      /* a swinging arm moves its hand forward and back (scissors), whichever side of the body it was drawn on */
      const swg = (i ? 1 : -1) * (J.K.swing || 0);
      let du = ov ? ipWrap(tgt(A(J, 'sh', ek)) - ipAng(R.sh, a.el)) : -0.42 * swg, elN = ipRot(a.el, R.sh, du, shN);
      let df = ov ? ipWrap(tgt(A(J, ek, hk)) - ipAng(a.el, a.hd)) : -0.42 * swg - 0.18 * Math.max(0, swg); void flip; void Jn;
      /* arms drawn straight out to the side hang down a little while walking, as real arms do */
      if (!ov && ['walk', 'run', 'idle', 'wave'].includes(b.act)) { const walking = b.act === 'walk' || b.act === 'run', relax = (walking ? 0.9 : 0.6) * ipWrap(Math.PI / 2 - side * (walking ? 0.12 : 0.5) - ipAng(R.sh, a.el)); if (Math.abs(relax) > 0.15) { du += relax; elN = ipRot(a.el, R.sh, du, shN); df += relax; } }
      /* a raised arm never passes through the drawn head: it opens outward a little until it clears */
      if (ov && R.headC) { const hN = ipRot(R.headC, R.sh, dT, shN), rr = R.headR * 1.25, hand = () => { const e = ipRot(a.el, R.sh, du, shN); return [e, ipRot(a.hd, a.el, df, e)]; };
        for (let it = 0; it < 14; it++) { const [e, h] = hand(); if (Math.hypot(e[0] - hN[0], e[1] - hN[1]) > rr && Math.hypot(h[0] - hN[0], h[1] - hN[1]) > rr && ipSegD(hN, e, h) > R.headR * 1.05) break; du += side * 0.07; df += side * 0.09; }
        elN = ipRot(a.el, R.sh, du, shN); }
      T.push([R.sh, shN, du]); T.push([a.el, elN, df]);
    });
    /* bone order matches ipBones: torso, head, then legs, then arms */
    const binds = r.bind || (r.bind = ipBind(it.ink, rig));
    /* the far arm and leg (drawn first, lighter) so crossing limbs read as one in front of the other */
    if (!r.back) { const names = ipBones(rig).map((x) => x[0]); r.back = binds.map((bi) => { const n = bi.filter((q) => /^(th0|sh0|ua0|fa0)$/.test(names[q[0]])).length; return n > 0.6 * bi.length; }); }
    const order = it.ink.map((s, si) => si).sort((a, z) => (r.back[z] ? 1 : 0) - (r.back[a] ? 1 : 0));
    order.forEach((si) => { const s = it.ink[si]; c.globalAlpha = r.back[si] ? 0.45 : 1;
      const bi = binds[si], q = s.p.slice();
      for (let k = 0, j = 0; k + 1 < q.length; k += 3, j++) {
        const bb = bi[j] || [0, 0, 0], p0 = [s.p[k] / 10, s.p[k + 1] / 10], t1 = T[bb[0]] || T[0], a = ipRot(p0, t1[0], t1[2], t1[1]);
        let np = a; if (bb[2] > 0) { const t2 = T[bb[1]] || T[0], z = ipRot(p0, t2[0], t2[2], t2[1]); np = [a[0] * (1 - bb[2]) + z[0] * bb[2], a[1] * (1 - bb[2]) + z[1] * bb[2]]; }
        q[k] = np[0] * 10; q[k + 1] = np[1] * 10;
      }
      drawStroke(c, Object.assign({}, s, { p: q }));
    });
    c.globalAlpha = 1;
  } else {
    const at = P([b.x, b.y]);
    c.translate(at[0], at[1]); c.rotate(-b.ang); c.translate(-rig.cx, -rig.cy);
    const wheels = rig.wheels || [], inW = new Set(); wheels.forEach((w) => w.i.forEach((k) => inW.add(k)));
    if (wheels.length) { const last = r.lastPos || [b.x, b.y]; const ds = (b.x - last[0]) * Math.cos(b.ang) + (b.y - last[1]) * Math.sin(b.ang); r.roll = (r.roll || 0) + ds; r.lastPos = [b.x, b.y]; }
    for (const q of it.pics || []) { const im = q.asset ? scSprite(q.asset) : q.url ? scSpriteUrl(q.url) : null; if (im) c.drawImage(im, q.x, q.y, q.w, q.h); }
    for (const u of it.under || []) drawStroke(c, u);
    it.ink.forEach((s, k) => { if (!inW.has(k)) drawStroke(c, s); });
    for (const w of wheels) { const kpx = rig.K || 100; c.save(); c.translate(w.cx, w.cy); c.rotate((r.roll || 0) * kpx / Math.max(4, w.r)); c.translate(-w.cx, -w.cy); w.i.forEach((k) => it.ink[k] && drawStroke(c, it.ink[k])); c.restore(); }
  }
  c.restore();
}
/* build the moving drawing from the selection */
const IP_KINDS = [
  ['fall', 'ปล่อยให้ตก', 'ตกลงมา ชน ไถล หรือกลิ้งไปตามเส้นที่วาดไว้รอบ ๆ'],
  ['throw', 'ขว้างออกไป', 'มีความเร็วต้น เคลื่อนที่แบบโพรเจกไทล์ แล้วชนเส้นที่วาด'],
  ['push', 'ถูกดึงไปทางขวา', 'แรงดึงคงที่ สู้กับแรงเสียดทานของพื้นที่วาด'],
  ['const', 'เลื่อนด้วยความเร็วคงที่', 'ไม่มีแรงลัพธ์ ไม่มีแรงโน้มถ่วง'],
  ['pend', 'แกว่งเป็นลูกตุ้ม', 'ใช้เส้นเชือกที่วาดต่อกับภาพ ปลายอีกข้างเป็นจุดหมุน'],
  ['spring', 'สั่นติดสปริง', 'ใช้สปริงซิกแซกที่วาดต่อกับภาพ']
];
function ipAttach(B, others, want) {
  let best = null;
  for (const r of others) {
    const P = ipPts(r.s); if (P.length < 2) continue; const a = P[0], z = P[P.length - 1], chord = Math.hypot(z[0] - a[0], z[1] - a[1]); if (chord < 25) continue;
    const ratio = ipLen(P) / chord, isS = ratio > 1.45, ok = want === 'spring' ? isS : !isS && ratio < 1.25; if (!ok) continue;
    const inB = (p) => p[0] > B[0] - 16 && p[0] < B[2] + 16 && p[1] > B[1] - 16 && p[1] < B[3] + 16;
    const end = inB(a) && !inB(z) ? z : inB(z) && !inB(a) ? a : null; if (!end) continue;
    if (!best || chord > best.chord) best = { r, end, chord };
  }
  return best;
}
async function placeInPlace(sp, kind, act, edge) {
  const body = sp.refs.map((r) => { const s = findStroke(r); return s ? { r, s: clone(s) } : null; }).filter(Boolean);
  const pics = sp.items.map(findItem).filter(Boolean).map((it) => { const b = itemBox(it); return { asset: it.asset, x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1], item: clone(it) }; }).filter((q) => okAsset(q.asset));
  if (!body.length && !pics.length) throw { code: 'empty' };
  const B = ipBox(body.map((x) => x.s), pics), sel = new Set(sp.refs.map((r) => r.layer + ':' + r.id));
  const others = allStrokes().filter((r) => r.layer !== 'teacher' && !sel.has(r.layer + ':' + r.s.id));
  const att = kind === 'pend' || kind === 'spring' ? ipAttach(B, others, kind) : null;
  const person = !!act;
  let rig, K = 100;
  if (person) {
    rig = ipRig(body.map((x) => x.s));
    /* legs drawn very short make a shuffling walk: lengthen them a little, keeping the feet on the ground and lifting the body */
    const top0 = rig.headC ? rig.headC[1] - rig.headR : B[1], leg0 = rig.foot - rig.hip[1], tall = rig.foot - top0;
    if (['walk', 'run', 'dance', 'jump', 'longjump'].includes(act) && leg0 > 4 && leg0 < 0.36 * tall) {
      const f = Math.min(1.6, 0.4 * tall / leg0), hipY = rig.hip[1], ft = rig.foot;
      for (const x of body) { const q = x.s.p; for (let j = 1; j < q.length; j += 3) { const y = q[j] / 10, ny = y >= hipY ? ft - (ft - y) * f : y - (f - 1) * leg0; q[j] = Math.round(ny * 10); } boxCache.delete(x.s); }
      rig = ipRig(body.map((x) => x.s)); rig.fixed = +(f.toFixed(2));
    }
    K = (rig.foot - (rig.headC ? rig.headC[1] - rig.headR : B[1])) / (0.95 * 1.7); rig.K = K;
  }
  const toW = (p) => [p[0] / K, (H - p[1]) / K];
  let top = B[1]; if (att) top = Math.min(top, att.end[1]);
  const ry0 = Math.round(clamp(top - 90, 0, H - 200)), ry1 = H;
  const surf = [];
  for (const r of others) { if (att && r === att.r) continue; if (r.s.k === 'h' || r.s.k === 'n' || (MV_SOFT.has(r.s.t) && (r.s.w || 3) > 14)) continue; /* colouring (a sky, a lawn) is not a floor or a wall */ const P = ipRdp(ipPts(r.s), 3); for (let i = 1; i < P.length && surf.length < 40; i++) { const a = P[i - 1], z = P[i]; if (Math.hypot(z[0] - a[0], z[1] - a[1]) < 18) continue; if (Math.max(a[1], z[1]) < ry0) continue; const A = toW(a), Z = toW(z); surf.push({ x1: +A[0].toFixed(3), y1: +A[1].toFixed(3), x2: +Z[0].toFixed(3), y2: +Z[1].toFixed(3), mu: 0.25, mus: 0.35 }); } }
  const spec = { domain: 'phys', bare: true, title: '', world: { w: W / K, h: (ry1 - ry0) / K, x0: 0, y0: 0, g: kind === 'const' ? 0 : 9.8 }, bodies: [], surfaces: surf, ropes: [], springs: [], forces: [], params: [], show: { fbd: false, trail: false, graph: 'none' } };
  const c = [(B[0] + B[2]) / 2, (B[1] + B[3]) / 2], cw = toW(c);
  const muP = { key: 'mu', label: 'แรงเสียดทานของพื้น μ', min: 0, max: 1, step: 0.05 };
  if (person) {
    const hw = toW(rig.hip), fy = toW([0, rig.foot])[1];
    if (!surf.some((s) => Math.min(s.x1, s.x2) <= hw[0] && Math.max(s.x1, s.x2) >= hw[0] && Math.abs((s.y1 + s.y2) / 2 - fy) < 0.15)) spec.surfaces.unshift({ x1: -50, y1: fy, x2: W / K + 50, y2: fy, mu: 0.8 });
    const v = { walk: 1.3, run: 4, jump: 2.4, longjump: 5.5, fall: 0, squat: 0 }[act] || 0;
    /* the model's leg length follows the drawn legs, so steps fit the legs that were drawn */
    const hgt = +clamp(2 * ((rig.foot - rig.hip[1]) / K) / 0.98, 0.6, 2.3).toFixed(3);
    spec.bodies.push({ id: 'P', label: 'คน', shape: 'person', act, m: 60, hgt, x: hw[0], y: hw[1], v: v || 0, ang: 20, push: 0.6, ink: true });
    spec.params = act === 'walk' || act === 'run' ? [{ key: 'P.v', label: act === 'walk' ? 'ความเร็วเดิน (m/s)' : 'ความเร็ววิ่ง (m/s)', min: act === 'walk' ? 0.5 : 2, max: act === 'walk' ? 2.2 : 8, step: 0.1 }] : act === 'jump' ? [{ key: 'P.v', label: 'ความเร็วตอนพ้นพื้น (m/s)', min: 0.5, max: 4, step: 0.1 }] : act === 'longjump' ? [{ key: 'P.v', label: 'ความเร็ววิ่งเข้าหา (m/s)', min: 2, max: 10, step: 0.5 }, { key: 'P.ang', label: 'มุมกระโดด (องศา)', min: 5, max: 45, step: 1 }] : act === 'fall' ? [{ key: 'P.push', label: 'แรงผลัก', min: 0.1, max: 2, step: 0.1 }] : [];
    spec.params.push({ key: 'P.m', label: 'มวล (kg)', min: 20, max: 120, step: 1 });
  } else {
    const hp = []; for (const x of body) for (const p of ipPts(x.s)) hp.push([(p[0] - c[0]) / K, -(p[1] - c[1]) / K]); for (const q of pics) for (const p of [[q.x, q.y], [q.x + q.w, q.y], [q.x + q.w, q.y + q.h], [q.x, q.y + q.h]]) hp.push([(p[0] - c[0]) / K, -(p[1] - c[1]) / K]);
    const sw = body.length ? body.reduce((a, x) => a + (x.s.w || 3), 0) / body.length : 2;
    const bd = { id: 'A', label: 'วัตถุ', shape: 'box', ink: true, m: 1, x: cw[0], y: cw[1], w: Math.max(0.05, (B[2] - B[0]) / K), h: Math.max(0.05, (B[3] - B[1]) / K), e: 0.3, hull: ipHull(hp).map((q) => [+q[0].toFixed(4), +q[1].toFixed(4)]), skin: (sw / 2 + 1.5) / K };
    spec.bodies.push(bd);
    if (kind === 'fall') spec.params = [{ key: 'A.e', label: 'การกระดอน e', min: 0, max: 0.95, step: 0.05 }, muP, { key: 'g', label: 'g (m/s²)', min: 1, max: 20, step: 0.1 }];
    if (kind === 'throw') { bd.vx = 4.5; bd.vy = 4.5; spec.show.v = true; spec.show.trail = true; spec.params = [{ key: 'A.vx', label: 'ความเร็วต้นแนวราบ (m/s)', min: -8, max: 8, step: 0.1 }, { key: 'A.vy', label: 'ความเร็วต้นแนวดิ่ง (m/s)', min: 0, max: 8, step: 0.1 }, { key: 'A.e', label: 'การกระดอน e', min: 0, max: 0.95, step: 0.05 }]; }
    if (kind === 'push') { bd.m = 2; spec.forces.push({ on: 'A', fx: 8, fy: 0, label: 'F' }); spec.params = [{ key: 'F1.fx', label: 'แรงดึง (N)', min: -20, max: 20, step: 0.5 }, muP, { key: 'A.m', label: 'มวล (kg)', min: 0.5, max: 10, step: 0.5 }]; }
    if (kind === 'const') { bd.vx = 1.5; spec.show.v = true; spec.params = [{ key: 'A.vx', label: 'ความเร็ว (m/s)', min: -4, max: 4, step: 0.1 }]; }
    if (kind === 'pend') {
      const pv = att ? toW(att.end) : [cw[0], cw[1] + 2 * Math.max(bd.h, 0.6)], L = Math.hypot(cw[0] - pv[0], cw[1] - pv[1]);
      if (Math.abs(cw[0] - pv[0]) < 0.1 * L) { bd.x = pv[0] + L * Math.sin(0.5); bd.y = pv[1] - L * Math.cos(0.5); }
      spec.ropes.push({ a: '', b: 'A', ax: pv[0], ay: pv[1], L, snap: true }); spec.show.trail = true;
      spec.params = [{ key: 'A.x', label: 'ตำแหน่งปล่อย (m)', min: +(pv[0] - L * 0.95).toFixed(2), max: +(pv[0] + L * 0.95).toFixed(2), step: 0.01 }, { key: 'A.m', label: 'มวล (kg)', min: 0.1, max: 5, step: 0.1 }, { key: 'g', label: 'g (m/s²)', min: 1, max: 20, step: 0.1 }];
    }
    if (kind === 'spring') {
      const an = att ? toW(att.end) : [cw[0], cw[1] + 2 * Math.max(bd.h, 0.6)], L0 = Math.hypot(cw[0] - an[0], cw[1] - an[1]);
      const vert = Math.abs(cw[0] - an[0]) < Math.abs(cw[1] - an[1]);
      if (!vert) { bd.x += (cw[0] > an[0] ? 1 : -1) * 0.3 * L0; spec.surfaces.length || spec.surfaces.push({ x1: -50, y1: cw[1] - bd.h / 2, x2: 50 + W / K, y2: cw[1] - bd.h / 2 }); spec.surfaces.forEach((s) => { s.mu = 0; s.mus = 0; }); }
      spec.springs.push({ a: '', b: 'A', ax: an[0], ay: an[1], k: 20, L0 });
      spec.params = [{ key: 'K1.k', label: 'k (N/m)', min: 2, max: 100, step: 1 }, { key: 'A.m', label: 'มวล (kg)', min: 0.2, max: 5, step: 0.1 }];
      spec.show.energy = false;
    }
    const wheels = [];
    body.forEach((x, i) => { const P = ipPts(x.s); if (P.length < 8 || body.length < 2) return; const b = ipBox([x.s]), bw = b[2] - b[0], bh = b[3] - b[1], sz = Math.max(bw, bh); if (Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) > 0.35 * sz) return; if (bw / Math.max(1, bh) < 0.7 || bw / Math.max(1, bh) > 1.4) return; if ((b[1] + b[3]) / 2 < B[1] + 0.45 * (B[3] - B[1])) return; if (sz < 0.1 * (B[2] - B[0]) || sz > 0.7 * (B[2] - B[0])) return; wheels.push({ i: [i], cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, r: sz / 2 }); });
    for (const w of wheels) body.forEach((x, i) => { if (w.i.includes(i) || wheels.some((o) => o.i.includes(i))) return; const b = ipBox([x.s]); if (b[0] >= w.cx - w.r && b[2] <= w.cx + w.r && b[1] >= w.cy - w.r && b[3] <= w.cy + w.r) w.i.push(i); });
    rig = { kind: 'rigid', cx: c[0], cy: c[1], K, wheels };
    if (kind === 'const') rig.edge = edge || 'bounce';
    if (wheels.length) spec.bodies[0].wheel = true;
  }
  if (person && (act === 'walk' || act === 'run')) rig.edge = edge || 'bounce';
  /* move the ink off the page into the moving drawing (and the string or spring the model now draws) */
  const removed = [], touched = new Set(), take = body.map((x) => x.r).concat(att ? [{ layer: att.r.layer, id: att.r.s.id }] : []);
  for (const r of take) { const arr = layerArr(r.layer); const i = arr.findIndex((s) => s.id === r.id); if (i >= 0) { removed.push({ layer: r.layer, stroke: arr[i] }); arr.splice(i, 1); touched.add(r.layer); } }
  if (removed.length) { pushUndo({ t: 'erase', removed }); saveLayers(touched); drawInk(); }
  const before = clone(S.page.items || []);
  const item = { id: 'i' + uid(), by: DEV, type: 'scene', spec: scClean(spec), x: 0, y: ry0, w: W, h: ry1 - ry0, ink: body.map((x) => x.s), hide: att ? [clone(att.r.s)] : [], pics: pics.map((q) => ({ asset: q.asset, x: q.x, y: q.y, w: q.w, h: q.h })), back: pics.map((q) => q.item), rig, ctl: [Math.round(clamp(B[0] - 20, 4, W - 380)), 0] };
  const extra = await mvApply(item, { person });
  setItems(before.filter((t) => !sp.items.includes(t.id)).concat([item], extra), before);
  clearSel();
  if (!animOn()) animSet(true, true);
  setTimeout(() => { const R = SCN.get(item.id); const live = findItem(item.id); if (R && live) { R.playing = true; if (!scnRaf) scnRaf = requestAnimationFrame(scTick); const pb = itemsEl.querySelector('.item[data-id="' + item.id + '"] [data-s="play"]'); if (pb) pb.textContent = 'หยุด'; } }, 350);
  toast(person ? 'ภาพคนที่วาดขยับแขนขาตามการเคลื่อนไหวจริงแล้ว' : 'ภาพเคลื่อนที่บนกระดาษแล้ว เส้นที่วาดไว้รอบ ๆ เป็นพื้นผิวที่ชนได้', 2800);
}
function renderScenePicker(box, dom, q) {
  box.innerHTML = ''; q = String(q || '').trim().toLowerCase();
  const own = sceneDomainFor();
  /* search across every subject */
  const sr = document.createElement('label'); sr.className = 'field scnsearch'; sr.innerHTML = '<span>ค้นหาแบบจำลอง</span><input type="search" placeholder="เช่น สปริง วงโคจร การระบาด ปกติ เอนไซม์">';
  const si = sr.querySelector('input'); si.value = q; let tm = 0; si.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { renderScenePicker(box, dom, si.value); const n = box.querySelector('.scnsearch input'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
  box.appendChild(sr);
  const tabs = document.createElement('div'); tabs.className = 'chips'; box.appendChild(tabs);
  /* the notebook's own subject first */
  const order = SCENE_SUBJ.slice().sort((a, b) => (a[0] === own ? -1 : b[0] === own ? 1 : 0));
  for (const [k, n] of order) { const cnt = (SCENE_TPL[k] || []).length + (k === 'phys' ? Object.keys(SIMS).length : 0); const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = n + ' ' + cnt; b.setAttribute('aria-pressed', !q && k === dom ? 'true' : 'false'); b.onclick = () => renderScenePicker(box, k); tabs.appendChild(b); }
  const ai = document.createElement('div'); ai.className = 'scnai';
  ai.innerHTML = '<label class="field"><span>ไม่มีแบบที่ต้องการ อธิบายสิ่งที่อยากให้ขยับ แล้วให้ AI สร้าง</span><textarea rows="2" placeholder="เช่น กล่อง 2 kg ถูกดึงด้วยแรง 10 N ทำมุม 30 องศา บนพื้นที่มีแรงเสียดทาน 0.2"></textarea></label><button class="btn solid" type="button">สร้างแบบจำลอง</button><div class="note small">หรือวาดภาพบนหน้า วงรอบด้วยบ่วงเลือก แล้วกด "ขยับได้"</div>';
  ai.querySelector('button').onclick = async () => {
    const t = ai.querySelector('textarea').value.trim(); if (!t) return; if (!needAI('gen')) return; if (typeof convNote === 'function') convNote('asked', t);
    const bt = ai.querySelector('button'); bt.disabled = true;
    const wt = document.createElement('div'); bt.after(wt); waitCard(wt, 'AI กำลังสร้างแบบจำลอง', ['อ่านคำอธิบาย', 'สร้างตามหลักวิชา'], { cancel: false });
    try { const spec = await sceneFromAI(t, null); $('#simSheet').hidden = true; insertScene(spec); } catch (e) { toast('สร้างไม่สำเร็จ ลองอธิบายให้ชัดขึ้น', 3000); }
    wt.remove(); bt.disabled = false;
  };
  const doms = q ? SCENE_SUBJ.map((x) => x[0]) : [dom];
  let shown = 0;
  for (const d of doms) {
    const list = (SCENE_TPL[d] || []).filter(([name, hint]) => !q || (name + ' ' + hint).toLowerCase().includes(q));
    if (q && list.length) { const h = document.createElement('h3'); h.textContent = (SCENE_SUBJ.find((x) => x[0] === d) || [0, ''])[1]; box.appendChild(h); }
    const grid = document.createElement('div'); grid.className = 'simgrid';
    for (const [name, hint, spec] of list) {
      shown++;
      const b = document.createElement('button'); b.className = 'simpick'; b.type = 'button';
      b.innerHTML = '<canvas class="scnprev"></canvas><b></b><span></span>'; b.querySelector('b').textContent = name; b.querySelector('span').textContent = hint;
      b.onclick = () => { $('#simSheet').hidden = true; insertScene(JSON.parse(JSON.stringify(spec))); };
      grid.appendChild(b);
      const cv = b.querySelector('canvas'); const it = { id: '__p' + name, spec: scClean(JSON.parse(JSON.stringify(spec))) }; const r = { st: null, cache: new Map(), traces: {}, showGraph: false, read: [], cv };
      scReset(it, r); if (it.spec.domain === 'math') r.st.t = (it.spec.t.min + it.spec.t.max) / 2 || 1;
      requestAnimationFrame(() => { cv.style.width = '100%'; cv.style.height = '150px'; scRender(it, r); });
    }
    box.appendChild(grid);
    /* the hand-built physics laboratory models belong to physics only */
    if (d === 'phys' && typeof renderSimPicker === 'function') {
      const sg = document.createElement('div'); sg.className = 'simgrid'; renderSimPicker(sg, q);
      if (sg.children.length) { const h = document.createElement('h3'); h.textContent = 'ห้องปฏิบัติการฟิสิกส์ ปรับค่าละเอียด'; box.appendChild(h); box.appendChild(sg); shown += sg.children.length; }
    }
  }
  if (q && !shown) box.appendChild(Object.assign(document.createElement('div'), { className: 'note', textContent: 'ไม่พบแบบจำลองที่ตรงกับคำค้น ลองคำอื่น หรือให้ AI สร้างจากคำอธิบายด้านล่าง' }));
  box.appendChild(ai);
}


/* ---------- living models in three dimensions: z is up. Physics (bodies, planes, ropes, springs, fields),
   particles in a box (chemistry, biology) and surfaces or curves (maths). Drag to turn, pinch or wheel to zoom. ---------- */
const v3 = (a) => (Array.isArray(a) ? [scNum(a[0], 0, -1e9, 1e9), scNum(a[1], 0, -1e9, 1e9), scNum(a[2], 0, -1e9, 1e9)] : [0, 0, 0]);
const vAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], vMul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], vLen = (a) => Math.hypot(a[0], a[1], a[2]), vCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vUnit = (a) => { const L = vLen(a) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };
function sc3Clean(sp, o) {
  o.dim = 3;
  if (sp.clean) o.clean = true; /* no frame: the model sits on the paper like a drawing */
  if (sp.pen) o.pen = true; /* coloured as if with coloured pencils */
  if (o.domain === 'phys') {
    const wd = sp.world || {};
    o.world = { size: scNum(wd.size, 4, 0.1, 1e9), g: scNum(wd.g, 9.8, 0, 1000), ground: wd.ground !== false, mu: scNum(wd.mu, 0.3, 0, 5), tz: scNum(wd.tz, 0, -1e9, 1e9) };
    o.bodies = (Array.isArray(sp.bodies) ? sp.bodies : []).slice(0, 8).map((b, i) => ({ id: scTxt(b.id || 'B' + (i + 1), 8).replace(/[^A-Za-z0-9_]/g, '') || 'B' + (i + 1), label: scTxt(b.label || '', 20), shape: b.shape === 'box' ? 'box' : 'ball', m: scNum(b.m, 1, 1e-6, 1e30), r: scNum(b.r, 0.2, 1e-6, 1e9), p: v3(b.p), v: v3(b.v), q: scNum(b.q, 0, -1e3, 1e3), e: scNum(b.e, 0.6, 0, 1), fixed: !!b.fixed, color: scCol(b.color, SC_PAL[i % SC_PAL.length]) }));
    o.planes = (Array.isArray(sp.planes) ? sp.planes : []).slice(0, 4).map((q) => ({ p: v3(q.p), n: vUnit(v3(q.n)), mu: scNum(q.mu, 0.3, 0, 5), size: scNum(q.size, 2, 0.1, 1e6) }));
    o.springs = (Array.isArray(sp.springs) ? sp.springs : []).slice(0, 6).map((s) => ({ a: scTxt(s.a, 8), b: scTxt(s.b, 8), anchor: v3(s.anchor), k: scNum(s.k, 20, 1e-6, 1e9), L0: scNum(s.L0, 1, 0, 1e9) }));
    o.ropes = (Array.isArray(sp.ropes) ? sp.ropes : []).slice(0, 6).map((r) => ({ b: scTxt(r.b, 8), anchor: v3(r.anchor), L: r.L == null ? null : scNum(r.L, 1, 0, 1e9) }));
    o.forces = (Array.isArray(sp.forces) ? sp.forces : []).slice(0, 6).map((f) => ({ on: scTxt(f.on, 8), f: v3(f.f), label: scTxt(f.label || 'F', 6) }));
    const fl = sp.fields || {};
    o.fields = { E: fl.E ? v3(fl.E) : null, B: fl.B ? v3(fl.B) : null, drag: scNum(fl.drag, 0, 0, 1e6), central: fl.central ? { p: v3(fl.central.p), GM: scNum(fl.central.GM, 1, 0, 1e30), r: scNum(fl.central.r, 0.3, 0, 1e9), label: scTxt(fl.central.label || '', 16) } : null };
    const sh = sp.show || {}; o.show = { fbd: sh.fbd !== false, v: !!sh.v, trail: sh.trail !== false, net: !!sh.net };
    o.speed = scNum(sp.speed, 1, 0.01, 1e6);
  } else if (o.domain === 'chem' || o.domain === 'bio') {
    const bx = sp.box || {}; o.box = { w: scNum(bx.w, 60, 10, 200), h: scNum(bx.h, 40, 10, 200), d: scNum(bx.d, 40, 10, 200) };
    o.T = scNum(sp.T, 300, 1, 5000);
    o.species = (Array.isArray(sp.species) ? sp.species : []).slice(0, 6).map((s, i) => ({ id: scTxt(s.id || 'S' + i, 10).replace(/[^A-Za-z0-9_]/g, '') || 'S' + i, label: scTxt(s.label || s.id, 20), color: scCol(s.color, SC_PAL[i % SC_PAL.length]), n: Math.round(scNum(s.n, 20, 0, 160)), r: scNum(s.r, 1.4, 0.3, 6), m: scNum(s.m, 1, 0.05, 100), side: ['left', 'right', 'all'].includes(s.side) ? s.side : 'all' }));
    o.reactions = (Array.isArray(sp.reactions) ? sp.reactions : []).slice(0, 6).map((r) => ({ from: (Array.isArray(r.from) ? r.from : []).slice(0, 2).map((x) => scTxt(x, 10)), to: (Array.isArray(r.to) ? r.to : []).slice(0, 2).map((x) => scTxt(x, 10)), Ea: scNum(r.Ea, 1, 0, 100), k: scNum(r.k, 0, 0, 100) })).filter((r) => r.from.length && r.to.length);
    o.membrane = sp.membrane ? { x: scNum(sp.membrane.x, 0.5, 0.05, 0.95), pass: (Array.isArray(sp.membrane.pass) ? sp.membrane.pass : []).slice(0, 6).map((x) => scTxt(x, 10)) } : null;
  } else {
    const vw = sp.view || {}; o.view = { L: scNum(vw.L, 3, 0.1, 1e6) };
    const t = sp.t || {}; o.t = { min: scNum(t.min, 0, -1e6, 1e6), max: scNum(t.max, 6.2832, -1e6, 1e6), speed: scNum(t.speed, 1, 0, 1e4), loop: t.loop !== false };
    o.vars = {}; for (const [k, v] of Object.entries(sp.vars || {}).slice(0, 8)) if (/^[a-zA-Z]\w{0,9}$/.test(k) && !/^(t|x|y|z|e|pi)$/.test(k)) o.vars[k] = scNum(v, 1, -1e9, 1e9);
    const ex = (s) => scTxt(s, 140).replace(/[^0-9A-Za-z_+\-*/^().,\s<>=!]/g, '');
    o.items = (Array.isArray(sp.items) ? sp.items : []).slice(0, 8).map((it, i) => ({ type: ['surface', 'curve', 'point', 'vector', 'tangent', 'orbital'].includes(it.type) ? it.type : 'surface', o: scTxt(it.o, 60).replace(/[^a-z0-9,]/g, ''), dir: it.dir ? v3(it.dir) : null, pick: /^[a-zA-Z]\w{0,9}$/.test(it.pick || '') ? it.pick : '', col2: scCol(it.col2, '#E39B2D'), color: scCol(it.color, SC_PAL[i % SC_PAL.length]), label: scTxt(it.label, 24), expr: ex(it.expr), x: ex(it.x), y: ex(it.y), z: ex(it.z), s0: ex(it.s0), s1: ex(it.s1), n: Math.round(scNum(it.n, 26, 6, 48)), range: Array.isArray(it.range) ? it.range.slice(0, 4).map((v) => scNum(v, 0, -1e6, 1e6)) : null, trace: !!it.trace }));
  }
  return o;
}
function sc3Target(sp, h) {
  const b = (sp.bodies || []).find((x) => x.id === h); if (b) return { get m() { return b.m; }, set m(v) { b.m = v; }, get q() { return b.q; }, set q(v) { b.q = v; }, get e() { return b.e; }, set e(v) { b.e = v; }, get r() { return b.r; }, set r(v) { b.r = v; }, get x() { return b.p[0]; }, set x(v) { b.p[0] = v; }, get y() { return b.p[1]; }, set y(v) { b.p[1] = v; }, get z() { return b.p[2]; }, set z(v) { b.p[2] = v; }, get vx() { return b.v[0]; }, set vx(v) { b.v[0] = v; }, get vy() { return b.v[1]; }, set vy(v) { b.v[1] = v; }, get vz() { return b.v[2]; }, set vz(v) { b.v[2] = v; } };
  const vec = (a) => a && { get x() { return a[0]; }, set x(v) { a[0] = v; }, get y() { return a[1]; }, set y(v) { a[1] = v; }, get z() { return a[2]; }, set z(v) { a[2] = v; } };
  if (h === 'B' && sp.fields) return vec(sp.fields.B); if (h === 'E' && sp.fields) return vec(sp.fields.E);
  if (h === 'C' && sp.fields && sp.fields.central) return sp.fields.central;
  let m = h.match(/^K(\d+)$/); if (m && sp.springs && sp.springs[m[1] - 1]) return sp.springs[m[1] - 1];
  m = h.match(/^R(\d+)$/); if (m && sp.ropes && sp.ropes[m[1] - 1]) return sp.ropes[m[1] - 1];
  m = h.match(/^F(\d+)$/); if (m && sp.forces && sp.forces[m[1] - 1]) return vec(sp.forces[m[1] - 1].f);
  m = h.match(/^RX(\d+)$/); if (m && sp.reactions && sp.reactions[m[1] - 1]) return sp.reactions[m[1] - 1];
  if (sp.species) { const s = sp.species.find((x) => x.id === h); if (s) return s; }
  return null;
}
function sc3Get(sp, key) { const [h, k] = key.split('.'); if (!k) { if (sp.domain === 'math') return sp.vars[h]; if (h === 'g') return sp.world.g; if (h === 'T') return sp.T; if (h === 'drag') return sp.fields.drag; if (h === 'mu') return sp.world.mu; return undefined; } const t = sc3Target(sp, h); return t ? t[k] : undefined; }
function sc3Set(sp, key, v) { const [h, k] = key.split('.'); if (!k) { if (sp.domain === 'math') sp.vars[h] = v; else if (h === 'g') sp.world.g = v; else if (h === 'T') sp.T = v; else if (h === 'drag') sp.fields.drag = v; else if (h === 'mu') { sp.world.mu = v; (sp.planes || []).forEach((q) => { q.mu = v; }); } return; } const t = sc3Target(sp, h); if (t) t[k] = k === 'n' ? Math.round(v) : v; }

/* ----- physics ----- */
function p3Init(sp) {
  const st = { t: 0, bodies: sp.bodies.map((b) => ({ id: b.id, b, p: b.p.slice(), v: b.v.slice(), F: {}, trail: [] })), hist: [] };
  for (const r of sp.ropes) if (r.L == null) { const B = st.bodies.find((x) => x.id === r.b); r.L = B ? vLen(vSub(B.p, r.anchor)) || 1 : 1; }
  return st;
}
function p3Add(B, k, f) { const o = B.F[k] || (B.F[k] = [0, 0, 0]); o[0] += f[0]; o[1] += f[1]; o[2] += f[2]; }
function p3Step(sp, st, dt) {
  const g = sp.world.g, fl = sp.fields, BB = st.bodies.filter((x) => !x.b.fixed);
  for (const B of st.bodies) B.F = {};
  for (const B of BB) {
    const b = B.b; if (g) p3Add(B, 'W', [0, 0, -b.m * g]);
    if (fl.E && b.q) p3Add(B, 'FE', vMul(fl.E, b.q));
    if (fl.B && b.q) p3Add(B, 'FB', vMul(vCross(B.v, fl.B), b.q));
    if (fl.central) { const d = vSub(fl.central.p, B.p), r = vLen(d) || 1e-9; p3Add(B, 'Fg', vMul(d, fl.central.GM * b.m / Math.max(r * r * r, 1e-12))); }
    if (fl.drag) p3Add(B, 'D', vMul(B.v, -fl.drag));
  }
  for (const f of sp.forces) { const B = BB.find((x) => x.id === f.on); if (B) p3Add(B, 'F', f.f); }
  for (const s of sp.springs) {
    const A = st.bodies.find((x) => x.id === s.a), Bq = st.bodies.find((x) => x.id === s.b), pa = A ? A.p : s.anchor, pb = Bq ? Bq.p : s.anchor;
    const d = vSub(pb, pa), L = vLen(d) || 1e-9, f = vMul(d, s.k * (L - s.L0) / L);
    if (A && !A.b.fixed) p3Add(A, 'Fs', f); if (Bq && !Bq.b.fixed) p3Add(Bq, 'Fs', vMul(f, -1));
  }
  const p0 = new Map();
  for (const B of BB) { let F = [0, 0, 0]; for (const v of Object.values(B.F)) F = vAdd(F, v); B.v = vAdd(B.v, vMul(F, dt / B.b.m)); p0.set(B, B.p.slice()); B.p = vAdd(B.p, vMul(B.v, dt)); }
  /* constraints on positions, the impulse they needed becomes tension, normal force and friction */
  const planes = sp.planes.slice(); if (sp.world.ground) planes.unshift({ p: [0, 0, 0], n: [0, 0, 1], mu: sp.world.mu, ground: true });
  for (const B of BB) {
    const b = B.b, vin = B.v.slice();
    for (const r of sp.ropes) if (r.b === B.id) { const d = vSub(B.p, r.anchor), L = vLen(d); if (L > r.L) { const u = vMul(d, 1 / L); B.p = vAdd(r.anchor, vMul(u, r.L)); const vr = vDot(B.v, u); if (vr > 0) { B.v = vSub(B.v, vMul(u, vr)); p3Add(B, 'T', vMul(u, -b.m * vr / dt)); } } }
    for (const q of planes) {
      const rad = b.r, d = vDot(vSub(B.p, q.p), q.n); if (d >= rad) continue;
      if (!q.ground) { const w = vSub(vSub(B.p, q.p), vMul(q.n, d)); if (Math.abs(w[0]) > q.size || Math.abs(w[1]) > q.size * 1.5 || d < -rad * 2) continue; }
      B.p = vAdd(B.p, vMul(q.n, rad - d));
      const vn = vDot(B.v, q.n); if (vn < 0) {
        const bounce = vn < -1 ? -b.e * vn : 0, dvn = bounce - vn; B.v = vAdd(B.v, vMul(q.n, dvn)); p3Add(B, 'N', vMul(q.n, b.m * dvn / dt));
        const vt = vSub(B.v, vMul(q.n, vDot(B.v, q.n))), vtl = vLen(vt), cut = Math.min(vtl, q.mu * dvn * (bounce ? 0.3 : 1));
        if (vtl > 1e-9 && cut > 0) { const dv = vMul(vt, -cut / vtl); B.v = vAdd(B.v, dv); p3Add(B, 'f', vMul(dv, b.m / dt)); }
      }
    }
    void vin;
  }
  for (let i = 0; i < BB.length; i++) for (let j = i + 1; j < BB.length; j++) {
    const A = BB[i], C = BB[j], d = vSub(C.p, A.p), L = vLen(d), R = A.b.r + C.b.r; if (L >= R || L < 1e-9) continue;
    const n = vMul(d, 1 / L), rv = vDot(vSub(C.v, A.v), n); if (rv >= 0) continue;
    const e = Math.min(A.b.e, C.b.e), J = -(1 + e) * rv / (1 / A.b.m + 1 / C.b.m);
    A.v = vSub(A.v, vMul(n, J / A.b.m)); C.v = vAdd(C.v, vMul(n, J / C.b.m)); const push = (R - L) / 2; A.p = vSub(A.p, vMul(n, push)); C.p = vAdd(C.p, vMul(n, push));
  }
  for (const B of BB) { let F = [0, 0, 0]; for (const [k, v] of Object.entries(B.F)) if (k !== 'net') F = vAdd(F, v); B.F.net = F; B.a = vMul(F, 1 / B.b.m); }
  st.t += dt;
}
function p3Draw(c, w, h, sp, st, rt) {
  const L = sp.world.size, P = cam3(rt, w, h, L, sp.world.tz), g = new G3(P);
  if (sp.world.ground) {
    const n = 8, s = L * 1.1; c.save();
    const corner = [[-s, -s], [s, -s], [s, s], [-s, s]].map((q) => P(q[0], q[1], 0)); c.fillStyle = 'rgba(214,226,240,0.45)'; c.beginPath(); corner.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fill(); c.restore();
    for (let i = -n; i <= n; i++) { const t = i / n * s; g.line([[t, -s, 0], [t, s, 0]], '#C9D3E0', 1, { alpha: 0.7, bias: 1e3 }); g.line([[-s, t, 0], [s, t, 0]], '#C9D3E0', 1, { alpha: 0.7, bias: 1e3 }); }
    /* shadows */
    for (const B of st.bodies) { const q = P(B.p[0], B.p[1], 0), r = Math.max(2, B.b.r * q[3]); c.fillStyle = 'rgba(20,26,34,' + clamp(0.28 - B.p[2] / (L * 6), 0.05, 0.28) + ')'; c.beginPath(); c.ellipse(q[0], q[1], r, r * 0.45, 0, 0, 6.283); c.fill(); }
  }
  for (const q of sp.planes) {
    const u = vUnit(Math.abs(q.n[2]) < 0.9 ? vCross(q.n, [0, 0, 1]) : vCross(q.n, [1, 0, 0])), v = vCross(q.n, u), s = q.size;
    const pts = [[-s, -s * 1.5], [s, -s * 1.5], [s, s * 1.5], [-s, s * 1.5]].map(([a, b]) => vAdd(q.p, vAdd(vMul(u, a), vMul(v, b))));
    const pp = pts.map((x) => P(...x)); c.fillStyle = 'rgba(176,150,110,0.35)'; c.beginPath(); pp.forEach((x, i) => (i ? c.lineTo(x[0], x[1]) : c.moveTo(x[0], x[1]))); c.closePath(); c.fill();
    g.line(pts.concat([pts[0]]), '#8A6B44', 1.6);
  }
  axes3(g, L * 0.35, ['x', 'y', 'z']);
  const fl = sp.fields;
  if (fl.B && vLen(fl.B) > 1e-9) { const u = vUnit(fl.B); for (const a of [-1, 0, 1]) for (const b2 of [-1, 1]) { const o = vAdd([a * L * 0.6, b2 * L * 0.6, 0], vMul(u, -L * 0.5)); g.arrow(o, vAdd(o, vMul(u, L * 0.35)), '#0E9AA7', 1.4); } g.text(vAdd([L * 0.6, L * 0.6, 0], vMul(u, -L * 0.1)), 'B', '#0E9AA7', 14); }
  if (fl.E && vLen(fl.E) > 1e-9) { const u = vUnit(fl.E); for (const a of [-1, 1]) for (const b2 of [-1, 1]) { const o = [a * L * 0.5, b2 * L * 0.5, L * 0.3]; g.arrow(o, vAdd(o, vMul(u, L * 0.3)), '#E0A100', 1.4); } }
  if (fl.central) g.ball(fl.central.p, fl.central.r, '#E39B2D', { glow: true });
  for (const s of sp.springs) {
    const A = st.bodies.find((x) => x.id === s.a), Bq = st.bodies.find((x) => x.id === s.b), pa = A ? A.p : s.anchor, pb = Bq ? Bq.p : s.anchor, d = vSub(pb, pa), Ld = vLen(d) || 1e-9, ax = vMul(d, 1 / Ld);
    const u = vUnit(Math.abs(ax[2]) < 0.9 ? vCross(ax, [0, 0, 1]) : vCross(ax, [1, 0, 0])), v = vCross(ax, u), rr = L * 0.04, pts = [pa];
    for (let i = 1; i < 60; i++) { const t = i / 60, a = t * 14 * Math.PI; pts.push(vAdd(vAdd(pa, vMul(d, t)), vAdd(vMul(u, rr * Math.cos(a)), vMul(v, rr * Math.sin(a))))); } pts.push(pb);
    g.line(pts, '#D14D8B', 1.8); if (!A) g.ball(s.anchor, L * 0.025, '#3B4350');
  }
  for (const r of sp.ropes) { const B = st.bodies.find((x) => x.id === r.b); if (!B) continue; g.line([r.anchor, B.p], '#6B5B45', 1.6); g.ball(r.anchor, L * 0.025, '#3B4350'); }
  if (sp.show.trail) for (const B of st.bodies) if (B.trail.length > 1) g.line(B.trail, B.b.color, 1.6, { alpha: 0.45 });
  for (const B of st.bodies) {
    const b = B.b;
    if (b.shape === 'box') { const s = b.r, cs = [-1, 1]; const V = []; for (const x of cs) for (const y of cs) for (const z of cs) V.push(vAdd(B.p, [x * s, y * s, z * s])); for (const [i, j] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) g.line([V[i], V[j]], b.color, 2.4); }
    else g.ball(B.p, b.r, b.color);
    if (b.label) g.text(vAdd(B.p, [0, 0, b.r * 1.6]), b.label, '#14181F', 13);
  }
  const fs = rt.fscale3 || 1, vs = rt.vscale3 || 1, used = new Set();
  for (const B of st.bodies) {
    if (B.b.fixed) continue;
    if (sp.show.fbd) for (const [k, f] of Object.entries(B.F)) { if (k === 'net' || vLen(f) * fs < L * 0.02) continue; const tip = vAdd(B.p, vMul(f, fs)); g.arrow(B.p, tip, SC_COL[k] || '#333', 2.6); g.text(tip, SC_SYM[k] || k, SC_COL[k] || '#333', 14); used.add(k); }
    if (sp.show.net && B.F.net && vLen(B.F.net) * fs > L * 0.02) { const tip = vAdd(B.p, vMul(B.F.net, fs)); g.arrow(B.p, tip, SC_COL.net, 2); g.text(tip, 'ΣF', SC_COL.net, 14); used.add('net'); }
    if (sp.show.v && vLen(B.v) * vs > L * 0.02) { const tip = vAdd(B.p, vMul(B.v, vs)); g.arrow(B.p, tip, SC_COL.v, 2); g.text(tip, 'v', SC_COL.v, 14); }
  }
  g.draw(c);
  if (used.size) { let lx = w - 8, ly = 16; c.font = '12px Sarabun, sans-serif'; for (const k of used) { const t = SC_FNAME[k] || k, tw = c.measureText(t).width; c.fillStyle = SC_COL[k] || '#333'; c.fillRect(lx - tw - 18, ly - 8, 10, 3); c.fillStyle = '#3B4350'; c.fillText(t, lx - tw, ly - 3); ly += 16; } }
}
/* ----- particles in a box ----- */
function c3Init(sp) {
  const P = [], B = sp.box, mx = sp.membrane ? sp.membrane.x * B.w : B.w / 2;
  sp.species.forEach((s, si) => { for (let i = 0; i < s.n; i++) P.push(c3Make(sp, si, s.side === 'left' ? [s.r, mx - s.r] : s.side === 'right' ? [mx + s.r, B.w - s.r] : [s.r, B.w - s.r])); });
  return { t: 0, P, hist: [], hits: 0, pres: 0, lastH: 0 };
}
function c3Make(sp, si, xr) { const s = sp.species[si], B = sp.box, sd = 12 * Math.sqrt((sp.T / 300) / s.m), gs = () => { let u = 0; for (let k = 0; k < 6; k++) u += Math.random(); return (u - 3) / 1.4; }; return { s: si, p: [xr[0] + Math.random() * (xr[1] - xr[0]), s.r + Math.random() * (B.d - 2 * s.r), s.r + Math.random() * (B.h - 2 * s.r)], v: [gs() * sd, gs() * sd, gs() * sd] }; }
function c3Step(sp, st, dt) {
  const B = sp.box, P = st.P, dims = [B.w, B.d, B.h], kT = 72 * sp.T / 300, mx = sp.membrane ? sp.membrane.x * B.w : null;
  for (const q of P) {
    const s = sp.species[q.s]; for (let k = 0; k < 3; k++) { q.p[k] += q.v[k] * dt; if (q.p[k] < s.r) { q.p[k] = s.r; q.v[k] = Math.abs(q.v[k]); st.hits += s.m * Math.abs(q.v[k]); } if (q.p[k] > dims[k] - s.r) { q.p[k] = dims[k] - s.r; q.v[k] = -Math.abs(q.v[k]); st.hits += s.m * Math.abs(q.v[k]); } }
    if (mx != null && !sp.membrane.pass.includes(s.id)) { const prev = q.p[0] - q.v[0] * dt; if ((prev - mx) * (q.p[0] - mx) < 0 || Math.abs(q.p[0] - mx) < s.r) { q.p[0] = prev < mx ? mx - s.r : mx + s.r; q.v[0] = -q.v[0]; } }
  }
  const dead = new Set(), born = [];
  for (let i = 0; i < P.length; i++) { if (dead.has(i)) continue; const a = P[i], sa = sp.species[a.s];
    for (let j = i + 1; j < P.length; j++) { if (dead.has(j)) continue; const b = P[j], sb = sp.species[b.s], d = vSub(b.p, a.p), R = sa.r + sb.r; if (Math.abs(d[0]) > R || Math.abs(d[1]) > R || Math.abs(d[2]) > R) continue; const L = vLen(d); if (L >= R || L < 1e-9) continue;
      const n = vMul(d, 1 / L), rv = vDot(vSub(b.v, a.v), n); if (rv >= 0) continue;
      const rx = sp.reactions.find((r) => r.from.length === 2 && ((r.from[0] === sa.id && r.from[1] === sb.id) || (r.from[1] === sa.id && r.from[0] === sb.id)));
      const mu = sa.m * sb.m / (sa.m + sb.m), En = 0.5 * mu * rv * rv;
      if (rx && En > rx.Ea * kT) { dead.add(i); dead.add(j); const M = sa.m + sb.m, vcm = vMul(vAdd(vMul(a.v, sa.m), vMul(b.v, sb.m)), 1 / M), cen = vMul(vAdd(a.p, b.p), 0.5); rx.to.forEach((id, k) => { const si = sp.species.findIndex((s) => s.id === id); if (si >= 0) born.push({ s: si, p: vAdd(cen, [k ? 1.5 : -1.5, 0, 0]), v: vAdd(vcm, [k ? 3 : -3, 0, 0]) }); }); break; }
      const J = 2 * rv / (1 / sa.m + 1 / sb.m); a.v = vAdd(a.v, vMul(n, J / sa.m)); b.v = vSub(b.v, vMul(n, J / sb.m)); const push = (R - L) / 2; a.p = vSub(a.p, vMul(n, push)); b.p = vAdd(b.p, vMul(n, push));
    } }
  for (const r of sp.reactions) if (r.from.length === 1 && r.k > 0) { const si = sp.species.findIndex((s) => s.id === r.from[0]); P.forEach((q, i) => { if (q.s === si && !dead.has(i) && Math.random() < r.k * dt) { dead.add(i); r.to.forEach((id, k) => { const sj = sp.species.findIndex((s) => s.id === id); if (sj >= 0) born.push({ s: sj, p: vAdd(q.p, [k ? 1 : -1, 0, 0]), v: q.v.slice() }); }); } }); }
  if (dead.size) st.P = P.filter((_, i) => !dead.has(i)).concat(born.slice(0, 400 - P.length + dead.size));
  /* thermostat: keep the set temperature */
  let K = 0, n = 0; for (const q of st.P) { K += 0.5 * sp.species[q.s].m * vDot(q.v, q.v); n++; } if (n) { const target = n * 1.5 * (144 * sp.T / 300), f = Math.sqrt(target / Math.max(K, 1e-9)); const k = Math.pow(f, Math.min(1, dt * 4)); for (const q of st.P) q.v = vMul(q.v, k); }
  st.t += dt;
}
function c3Draw(c, w, h, sp, st, rt) {
  const B = sp.box, gh = rt.showGraph ? Math.round(h * 0.28) : 0, ah = h - gh, L = Math.max(B.w, B.d, B.h) * 0.62, P = cam3(rt, w, ah, L, 0), g = new G3((x, y, z) => P(x - B.w / 2, y - B.d / 2, z - B.h / 2));
  const V = []; for (const x of [0, B.w]) for (const y of [0, B.d]) for (const z of [0, B.h]) V.push([x, y, z]);
  for (const [i, j] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) g.line([V[i], V[j]], '#3B4350', 1.4, { alpha: 0.7 });
  if (sp.membrane) { const x = sp.membrane.x * B.w; g.line([[x, 0, 0], [x, B.d, 0], [x, B.d, B.h], [x, 0, B.h], [x, 0, 0]], '#B8860B', 2, { dash: [6, 5] }); }
  for (const q of st.P) { const s = sp.species[q.s]; g.ball(q.p, s.r, s.color); }
  g.draw(c);
  if (gh) scGraph(c, 8, ah + 2, w - 16, gh - 8, st.hist, sp.species.map((s) => s.color), sp.species.map((s) => s.label), 't (s)', 'จำนวนอนุภาค');
}
/* ----- maths: surfaces and curves ----- */
function m3Scope(sp, t, extra) { return Object.assign({ t, pi: Math.PI, e: Math.E }, sp.vars || {}, extra || {}); }
function m3Col(f) { const a = [[47, 75, 184], [14, 154, 167], [46, 139, 87], [227, 155, 45], [194, 87, 26]], x = clamp(f, 0, 0.9999) * 4, i = Math.floor(x), u = x - i, A = a[i], Bc = a[i + 1]; return 'rgb(' + Math.round(A[0] + (Bc[0] - A[0]) * u) + ',' + Math.round(A[1] + (Bc[1] - A[1]) * u) + ',' + Math.round(A[2] + (Bc[2] - A[2]) * u) + ')'; }
function m3Draw(c, w, h, sp, st, rt) {
  if (!window.math) { c.fillStyle = '#5A6472'; c.font = '14px Sarabun, sans-serif'; c.fillText('กำลังโหลดเครื่องคำนวณ', 16, 24); return false; }
  const L = sp.view.L, P = cam3(rt, w, h, L * 1.2, 0), g = new G3(P), t = st.t, gp = sp.pen ? new G3(P) : null;
  if (!sp.clean) axes3(g, L, ['x', 'y', 'z'], { neg: [1, 1, 1] });
  for (const it of sp.items) {
    if (it.type === 'surface' && it.expr) {
      const [x0, x1, y0, y1] = it.range && it.range.length === 4 ? it.range : [-L, L, -L, L], n = it.n, Z = [];
      let zmin = 1e9, zmax = -1e9;
      for (let i = 0; i <= n; i++) { Z.push([]); for (let j = 0; j <= n; j++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * j / n, z = mtEval(it.expr, m3Scope(sp, t, { x, y }), rt); Z[i].push(isFinite(z) ? clamp(z, -L * 3, L * 3) : NaN); if (isFinite(z)) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); } } }
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const xs = [x0 + (x1 - x0) * i / n, x0 + (x1 - x0) * (i + 1) / n], ys = [y0 + (y1 - y0) * j / n, y0 + (y1 - y0) * (j + 1) / n], zz = [Z[i][j], Z[i + 1][j], Z[i + 1][j + 1], Z[i][j + 1]];
        if (zz.some((v) => !isFinite(v))) continue; const zm = (zz[0] + zz[1] + zz[2] + zz[3]) / 4;
        g.poly([[xs[0], ys[0], zz[0]], [xs[1], ys[0], zz[1]], [xs[1], ys[1], zz[2]], [xs[0], ys[1], zz[3]]], m3Col((zm - zmin) / Math.max(zmax - zmin, 1e-9)), 'rgba(255,255,255,0.35)');
      }
    } else if (it.type === 'curve') {
      const s0 = mtEval(it.s0 || '0', m3Scope(sp, t), rt), s1 = mtEval(it.s1 || '2*pi', m3Scope(sp, t), rt), pts = [];
      for (let k = 0; k <= 160; k++) { const s = s0 + (s1 - s0) * k / 160, sc = m3Scope(sp, t, { s }), p = [mtEval(it.x, sc, rt), mtEval(it.y, sc, rt), mtEval(it.z, sc, rt)]; if (p.every(isFinite)) pts.push(p); }
      g.line(pts, it.color, 2.4);
    } else if (it.type === 'point' || it.type === 'tangent') {
      const sc = m3Scope(sp, t, { s: t }), p = [mtEval(it.x, sc, rt), mtEval(it.y, sc, rt), mtEval(it.z, sc, rt)]; if (!p.every(isFinite)) continue;
      g.ball(p, L * 0.035, it.color); if (it.label) g.text(vAdd(p, [0, 0, L * 0.08]), it.label, it.color, 13);
      if (it.type === 'tangent') { const hh = 1e-3, sc2 = m3Scope(sp, t, { s: t + hh }), q = [mtEval(it.x, sc2, rt), mtEval(it.y, sc2, rt), mtEval(it.z, sc2, rt)], d = vUnit(vSub(q, p)); g.arrow(p, vAdd(p, vMul(d, L * 0.45)), '#C2571A', 2.4); }
      if (it.trace) { const tr = rt.traces[it.label || 'p'] || (rt.traces[it.label || 'p'] = []); tr.push(p); if (tr.length > 600) tr.shift(); g.line(tr, it.color, 1.6, { alpha: 0.55 }); }
    } else if (it.type === 'orbital') { orb3Draw(gp || g, it, sp, L, rt); continue;
    } else if (it.type === 'vector') {
      const sc = m3Scope(sp, t), p = [mtEval(it.x, sc, rt), mtEval(it.y, sc, rt), mtEval(it.z, sc, rt)]; if (p.every(isFinite)) { g.arrow([0, 0, 0], p, it.color, 2.4); if (it.label) g.text(p, it.label, it.color, 13); }
    }
  }
  g.draw(c); if (gp) pencilDraw(c, w, h, gp, rt); return true;
}
/* ----- atomic orbitals as solid shapes: the surface is r = |psi(direction)|^2 (the angular part), coloured by the sign
   of psi, so the two phases show; hybrids mix s and p along a direction. Shaded towards the viewer as it turns ----- */
const ORB_NAMES = { s: 's', px: 'p_x', py: 'p_y', pz: 'p_z', dxy: 'd_xy', dxz: 'd_xz', dyz: 'd_yz', dx2y2: 'd_x²−y²', dz2: 'd_z²', sp: 'sp', sp2: 'sp²', sp3: 'sp³' };
function orbPsi(o, u, dir) {
  const [x, y, z] = u, Ys = 0.2821, Yp = 0.4886, Yd = 1.0925;
  switch (o) {
    case 's': return Ys; case 'px': return Yp * x; case 'py': return Yp * y; case 'pz': return Yp * z;
    case 'dxy': return Yd * x * y; case 'dxz': return Yd * x * z; case 'dyz': return Yd * y * z; case 'dx2y2': return Yd / 2 * (x * x - y * y); case 'dz2': return 0.3154 * (3 * z * z - 1);
    default: { const d = vUnit(dir || [0, 0, 1]), p = Yp * vDot(u, d); if (o === 'sp') return (Ys + p) / Math.SQRT2; if (o === 'sp2') return (Ys + Math.SQRT2 * p) / Math.sqrt(3); if (o === 'sp3') return (Ys + Math.sqrt(3) * p) / 2; return Ys; }
  }
}
function orb3Draw(g, it, sp, L, rt) {
  const list = (it.o || 'pz').split(',').filter((k) => ORB_NAMES[k] || /^sp[23]?$/.test(k));
  let o = list[0] || 'pz';
  if (it.pick && sp.vars && list.length > 1) o = list[clamp(Math.round(sp.vars[it.pick]) - 1, 0, list.length - 1)];
  const many = sp.items.filter((x) => x.type === 'orbital').length, n1 = many > 2 ? 20 : 26, n2 = many > 2 ? 30 : 40, R = L * 0.85, dir = it.dir; /* fewer faces when several orbitals turn together (iPad) */
  /* the biggest value over all directions sets the size, so every orbital fills the same space */
  let mx = 0; const U = [];
  for (let i = 0; i <= n1; i++) { U.push([]); const th = Math.PI * i / n1; for (let j = 0; j <= n2; j++) { const ph = 2 * Math.PI * j / n2, u = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)], v = orbPsi(o, u, dir); U[i].push([u, v]); mx = Math.max(mx, v * v); } }
  const k = R / (mx || 1), cm = rt.cam || CAM0, V = [Math.sin(cm.yaw) * Math.cos(cm.pitch), -Math.cos(cm.yaw) * Math.cos(cm.pitch), Math.sin(cm.pitch)];
  const Lt = vUnit(vAdd(V, [0.25, -0.15, 0.45])), P = (e) => vMul(e[0], e[1] * e[1] * k);
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#2F4BB8'), c1 = hex(it.color), c2 = hex(it.col2);
  const mixc = (c, f) => { const n = parseInt(c.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255, m = (v) => Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)); return 'rgb(' + m(r) + ',' + m(gg) + ',' + m(b) + ')'; };
  for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) {
    const a = U[i][j], b = U[i + 1][j], c = U[i + 1][j + 1], d = U[i][j + 1], vm = (a[1] + b[1] + c[1] + d[1]) / 4;
    const pa = P(a), pb = P(b), pc = P(c), pd = P(d), cen = vMul(vAdd(vAdd(pa, pb), vAdd(pc, pd)), 0.25);
    if (vLen(cen) < R * 0.012) continue; /* the pinched middle where the lobes meet */
    let nv = vCross(vSub(pc, pa), vSub(pd, pb)); if (vLen(nv) < 1e-12) continue; nv = vUnit(nv); if (vDot(nv, cen) < 0) nv = vMul(nv, -1);
    const lit = sp.pen ? 0.92 + 0.42 * Math.max(0, vDot(nv, Lt)) : 0.55 + 0.6 * Math.max(0, vDot(nv, Lt)) + 0.12 * Math.max(0, vDot(nv, V));
    const fc = mixc(vm >= 0 ? c1 : c2, clamp(lit, 0.45, 1.35));
    g.poly([pa, pb, pc, pd], fc, sp.pen ? fc : null); /* in pencil the faces are closed up, so no seams show through the grain */
  }
  if (sp.pen) g.ball([0, 0, 0], L * 0.02, '#3A3F48'); else g.ball([0, 0, 0], L * 0.025, '#333333');
  const nm = list.length > 1 && !it.pick ? list.map((x) => ORB_NAMES[x] || x).join(', ') : (ORB_NAMES[o] || o);
  rt.read = [['ออร์บิทัล', nm], ['สี', 'น้ำเงิน เฟสบวก, ส้ม เฟสลบ']];
}
/* ----- coloured pencil: the shape is drawn on a layer of its own, its colour broken into short slanted strokes so the
   paper shows through, with a soft pencil line round the outside. The grain stays put on the paper while the shape turns ----- */
let PENCIL_TEX = null;
function pencilTex() {
  if (PENCIL_TEX) return PENCIL_TEX;
  const T = document.createElement('canvas'); T.width = T.height = 120; const c = T.getContext('2d');
  c.fillStyle = 'rgba(0,0,0,0.42)'; c.fillRect(0, 0, 120, 120);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  c.lineCap = 'round';
  for (let i = 0; i < 190; i++) {
    const x = rnd() * 120, y = rnd() * 120, L = 8 + rnd() * 26, a = -0.62 + (rnd() - 0.5) * 0.18;
    c.strokeStyle = 'rgba(0,0,0,' + (0.35 + rnd() * 0.55).toFixed(2) + ')'; c.lineWidth = 0.8 + rnd() * 1.6;
    /* drawn again one tile over in each direction, so the tiles join without a seam */
    for (const ox of [-120, 0, 120]) for (const oy of [-120, 0, 120]) { c.beginPath(); c.moveTo(x + ox, y + oy); c.lineTo(x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L); c.stroke(); }
  }
  PENCIL_TEX = T; return T;
}
function pencilDraw(c, w, h, gp, rt) {
  const M = c.getTransform(), cw = c.canvas.width, ch = c.canvas.height;
  const mk = (k) => { const x = rt[k] && rt[k].width === cw && rt[k].height === ch ? rt[k] : (rt[k] = document.createElement('canvas')); if (x.width !== cw) x.width = cw; if (x.height !== ch) x.height = ch; const g = x.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, cw, ch); return [x, g]; };
  const [A, a] = mk('_penA'), [O, o] = mk('_penO');
  a.setTransform(M); gp.draw(a); a.setTransform(1, 0, 0, 1, 0, 0);
  /* the outline: the shape grown a little in every direction, less the shape itself */
  const r = Math.max(1, 1.25 * M.a);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) o.drawImage(A, dx * r, dy * r);
  o.globalCompositeOperation = 'source-in'; o.fillStyle = 'rgba(52,58,72,0.85)'; o.fillRect(0, 0, cw, ch);
  o.globalCompositeOperation = 'destination-out'; o.drawImage(A, 0, 0);
  /* the colour, broken by the pencil grain */
  a.globalCompositeOperation = 'destination-in'; const pat = a.createPattern(pencilTex(), 'repeat'); a.fillStyle = pat; a.fillRect(0, 0, cw, ch);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(A, 0, 0); c.drawImage(O, 0, 0); c.restore();
}
/* ----- one entry for the runtime ----- */
function sc3Reset(sp, r) {
  if (sp.domain === 'phys') {
    r.st = p3Init(sp); let mf = 0; for (const B of r.st.bodies) mf = Math.max(mf, B.b.m * sp.world.g); if (sp.fields.central) for (const B of r.st.bodies) { const d = vLen(vSub(B.p, sp.fields.central.p)); mf = Math.max(mf, sp.fields.central.GM * B.b.m / Math.max(d * d, 1e-9)); }
    if (sp.fields.B) for (const B of r.st.bodies) mf = Math.max(mf, Math.abs(B.b.q) * vLen(vCross(B.v, sp.fields.B))); for (const s of sp.springs) mf = Math.max(mf, s.k * sp.world.size * 0.3); for (const f of sp.forces) mf = Math.max(mf, vLen(f.f));
    let vm = 0; for (const B of r.st.bodies) vm = Math.max(vm, vLen(B.v)); r.fscale3 = sp.world.size * 0.35 / (mf || 1); r.vscale3 = sp.world.size * 0.35 / (vm || Math.sqrt(sp.world.g * sp.world.size) || 1);
  } else if (sp.domain === 'math') r.st = { t: sp.t.min };
  else r.st = c3Init(sp);
}
function sc3Tick(sp, r, dtw) {
  const sim = dtw * (sp.speed || 1) * (r.slow ? 0.25 : 1);
  if (sp.domain === 'phys') { const n = Math.max(1, Math.ceil(sim / 0.002)); for (let i = 0; i < n; i++) p3Step(sp, r.st, sim / n); for (const B of r.st.bodies) { B.trail.push(B.p.slice()); if (B.trail.length > 500) B.trail.shift(); } }
  else if (sp.domain === 'math') { r.st.t += dtw * sp.t.speed * (r.slow ? 0.25 : 1); if (r.st.t > sp.t.max) { if (sp.t.loop) { r.st.t = sp.t.min; r.traces = {}; } else { r.st.t = sp.t.max; r.playing = false; r.ended = true; } } }
  else { const s2 = dtw * (r.slow ? 0.25 : 1), n = Math.max(1, Math.ceil(s2 / 0.01)); for (let i = 0; i < n; i++) c3Step(sp, r.st, s2 / n); if (r.st.t - r.st.lastH > 0.2) { r.st.lastH = r.st.t; r.st.hist.push([r.st.t].concat(sp.species.map((_, i) => r.st.P.filter((q) => q.s === i).length))); if (r.st.hist.length > 500) r.st.hist.shift(); } }
}
function sc3Render(c, w, h, sp, r) {
  if (sp.domain === 'phys') {
    p3Draw(c, w, h, sp, r.st, r);
    const live = r.st.bodies.filter((B) => !B.b.fixed);
    r.read = [['t', fmtNum(+r.st.t.toFixed(2)) + ' s']].concat(live.slice(0, 3).map((B) => [B.b.label || B.id, 'v = ' + fmtNum(+vLen(B.v).toFixed(2)) + ' m/s, สูง ' + fmtNum(+B.p[2].toFixed(2)) + ' m']));
    if (sp.show.fbd) for (const B of live.slice(0, 2)) { const parts = Object.entries(B.F).filter(([k, v]) => k !== 'net' && vLen(v) > 1e-6).map(([k, v]) => (SC_SYM[k] || k) + ' ' + fmtNum(+vLen(v).toFixed(2))); if (parts.length) r.read.push(['แรงบน ' + (B.b.label || B.id) + ' (N)', parts.join(', ')]); }
  } else if (sp.domain === 'math') { r.read = [['t', fmtNum(+r.st.t.toFixed(2))]]; return m3Draw(c, w, h, sp, r.st, r); }
  else { c3Draw(c, w, h, sp, r.st, r); r.read = sp.species.map((s, i) => [s.label, r.st.P.filter((q) => q.s === i).length]).concat([['อุณหภูมิ', sp.T + ' K']]); }
  return true;
}
/* drag to turn, two fingers or the wheel to zoom, double tap to face front */
function sc3Bind(cv, it, r) {
  const pts = new Map(); let pinch0 = 0, zoom0 = 1, lastTap = 0; cv.style.touchAction = 'none';
  const cam = () => r.cam || (r.cam = Object.assign({}, CAM0));
  const redraw = () => { if (!r.playing) scRender(findItem(it.id) || it, r); };
  cv.addEventListener('pointerdown', (e) => { e.stopPropagation(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom0 = cam().zoom; } const t = now(); if (pts.size === 1 && t - lastTap < 320) { r.cam = Object.assign({}, CAM0); redraw(); } lastTap = t; });
  cv.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; e.stopPropagation(); const p0 = pts.get(e.pointerId), dx = e.clientX - p0[0], dy = e.clientY - p0[1]; pts.set(e.pointerId, [e.clientX, e.clientY]); const c = cam(); if (pts.size >= 2) { const [a, b] = [...pts.values()]; if (pinch0) c.zoom = clamp(zoom0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0, 0.4, 4); } else { c.yaw -= dx * 0.009; c.pitch = clamp(c.pitch + dy * 0.009, -1.5707, 1.5707); } redraw(); });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); const c = cam(); c.zoom = clamp(c.zoom * Math.exp(-e.deltaY * 0.0015), 0.4, 4); redraw(); }, { passive: false });
}
const SCENE_TPL3 = [
  ['โพรเจกไทล์ 3 มิติ มีลมด้านข้าง', 'ลมผลักด้านข้างด้วยแรงคงที่ เส้นทางเบนออกจากระนาบ', { domain: 'phys', dim: 3, title: 'โพรเจกไทล์มีลมพัด', world: { size: 12, mu: 0.4 }, bodies: [{ id: 'A', label: '', r: 0.3, m: 0.5, p: [-8, -4, 0.3], v: [9, 3, 11], e: 0.4 }], forces: [{ on: 'A', f: [0, 0.8, 0], label: 'F' }], params: [{ key: 'F1.y', label: 'แรงลมด้านข้าง (N)', min: -2, max: 2, step: 0.1 }, { key: 'A.vz', label: 'ความเร็วต้นแนวดิ่ง (m/s)', min: 2, max: 16, step: 0.5 }], show: { v: true } }],
  ['ลูกตุ้มกรวย', 'มวลวนเป็นวงกลมแนวราบ แรงตึงเชือกกับน้ำหนักรวมกันเป็นแรงสู่ศูนย์กลาง', { domain: 'phys', dim: 3, title: 'ลูกตุ้มกรวย', world: { size: 2.5, ground: false }, bodies: [{ id: 'A', label: '', r: 0.12, m: 0.5, p: [1.25, 0, 0.83], v: [0, 2.66, 0] }], ropes: [{ b: 'A', anchor: [0, 0, 3], L: 2.5 }], params: [{ key: 'A.vy', label: 'ความเร็วต้น (m/s)', min: 0.5, max: 5, step: 0.05 }], show: { net: true, trail: true }, note: 'ความเร็วที่พอดีทำให้วนเป็นวงกลมราบ ถ้าเร็วหรือช้ากว่านี้ทางเดินจะส่ายขึ้นลง' }],
  ['ประจุเคลื่อนเป็นเกลียว', 'ความเร็วส่วนที่ขนานกับ B คงที่ ส่วนที่ตั้งฉากวนเป็นวงกลม จึงได้เกลียว', { domain: 'phys', dim: 3, title: 'ประจุในสนามแม่เหล็ก 3 มิติ', world: { size: 3, g: 0, ground: false, tz: 1.5 }, bodies: [{ id: 'A', label: '', r: 0.08, m: 1, q: 1, p: [0, -1, 0], v: [1, 0, 0.35] }], fields: { B: [0, 0, 1] }, params: [{ key: 'A.vz', label: 'ความเร็วแนวขนาน B (m/s)', min: 0, max: 1, step: 0.05 }, { key: 'B.z', label: 'B (T)', min: 0.3, max: 3, step: 0.1 }], show: { v: true, fbd: true } }],
  ['ดาวเทียมวงโคจรเอียง', 'แรงโน้มถ่วงชี้เข้าศูนย์กลางเสมอ ระนาบวงโคจรคงที่', { domain: 'phys', dim: 3, title: 'วงโคจรในสามมิติ', world: { size: 5, g: 0, ground: false }, bodies: [{ id: 'A', label: '', r: 0.12, m: 1, p: [3.5, 0, 0], v: [0, 1.9, 1.1] }], fields: { central: { p: [0, 0, 0], GM: 16, r: 0.6, label: 'โลก' } }, params: [{ key: 'A.vy', label: 'ความเร็วต้นแนว y (m/s)', min: 0.5, max: 3, step: 0.05 }, { key: 'A.vz', label: 'ความเร็วต้นแนว z (m/s)', min: 0, max: 2, step: 0.05 }], show: { v: true } }],
  ['มวลแขวนสปริงแกว่งสามมิติ', 'สปริงดึงกลับเข้าหาจุดแขวน น้ำหนักดึงลง เส้นทางเป็นวงรีหมุน', { domain: 'phys', dim: 3, title: 'มวลติดสปริงสามมิติ', world: { size: 2.5, ground: false, tz: 1.2 }, bodies: [{ id: 'A', label: '', r: 0.12, m: 0.5, p: [0.8, 0, 1.2], v: [0, 1.2, 0] }], springs: [{ a: '', b: 'A', anchor: [0, 0, 3], k: 12, L0: 1.2 }], params: [{ key: 'K1.k', label: 'k (N/m)', min: 4, max: 40, step: 1 }, { key: 'A.vy', label: 'ความเร็วต้นด้านข้าง (m/s)', min: 0, max: 3, step: 0.1 }], show: { trail: true } }],
  ['ลูกบอลตกกระดอนบนพื้นเอียง', 'กระดอนออกตามแนวตั้งฉากพื้นเอียง แล้วไถลลงตามความชัน', { domain: 'phys', dim: 3, title: 'ลูกบอลกับพื้นเอียง', world: { size: 4, mu: 0.3 }, bodies: [{ id: 'A', label: '', r: 0.2, m: 0.5, p: [-1, 0, 3.2], v: [0, 0, 0], e: 0.7 }], planes: [{ p: [0, 0, 1], n: [0.42, 0, 0.91], mu: 0.3, size: 2.2 }], params: [{ key: 'A.e', label: 'การกระดอน e', min: 0, max: 0.95, step: 0.05 }, { key: 'mu', label: 'μ', min: 0, max: 1, step: 0.05 }], show: { trail: true } }],
  ['การชนสองมิติบนโต๊ะลื่น', 'ชนเยื้องศูนย์ โมเมนตัมรวมคงที่ทั้งสองแกน', { domain: 'phys', dim: 3, title: 'การชนเยื้องศูนย์', world: { size: 3, g: 0, ground: false }, bodies: [{ id: 'A', label: 'A', r: 0.25, m: 1, p: [-2, -0.2, 0], v: [2, 0, 0], e: 1 }, { id: 'B', label: 'B', r: 0.25, m: 1, p: [0, 0.15, 0], v: [0, 0, 0], e: 1, color: '#C2571A' }], params: [{ key: 'B.y', label: 'ระยะเยื้อง (m)', min: -0.45, max: 0.45, step: 0.01 }, { key: 'B.m', label: 'มวล B (kg)', min: 0.5, max: 4, step: 0.1 }], show: { v: true, fbd: false, trail: true } }],
  ['แก๊สในกล่องสามมิติ', 'อนุภาควิ่งทุกทิศ อุณหภูมิสูงขึ้นวิ่งเร็วขึ้น', { domain: 'chem', dim: 3, title: 'แก๊สในกล่อง 3 มิติ', box: { w: 60, h: 40, d: 40 }, T: 300, species: [{ id: 'G', label: 'โมเลกุลแก๊ส', n: 70, r: 1.5, color: '#2F4BB8' }], params: [{ key: 'T', label: 'อุณหภูมิ (K)', min: 50, max: 1200, step: 10 }] }],
  ['ปฏิกิริยา A + B ในสามมิติ', 'ชนแรงพอจึงเกิดปฏิกิริยา เพิ่มอุณหภูมิแล้ว C เกิดเร็วขึ้น', { domain: 'chem', dim: 3, title: 'A + B → C แบบ 3 มิติ', box: { w: 60, h: 40, d: 40 }, T: 300, species: [{ id: 'A', label: 'A', n: 60, r: 1.4, color: '#2F4BB8' }, { id: 'B', label: 'B', n: 60, r: 1.4, color: '#C2571A' }, { id: 'C', label: 'C', n: 0, r: 1.9, m: 2, color: '#2E8B57' }], reactions: [{ from: ['A', 'B'], to: ['C'], Ea: 1.6 }], params: [{ key: 'T', label: 'อุณหภูมิ (K)', min: 100, max: 1200, step: 10 }, { key: 'RX1.Ea', label: 'พลังงานก่อกัมมันต์', min: 0, max: 5, step: 0.1 }] }],
  ['การแพร่ผ่านเยื่อในสามมิติ', 'โมเลกุลเล็กผ่านเยื่อได้ โมเลกุลใหญ่ผ่านไม่ได้', { domain: 'bio', dim: 3, title: 'เยื่อเลือกผ่าน 3 มิติ', box: { w: 70, h: 40, d: 40 }, T: 310, species: [{ id: 'W', label: 'น้ำ', n: 90, r: 1, color: '#4C8DF6', side: 'left' }, { id: 'S', label: 'น้ำตาล', n: 25, r: 2.2, m: 6, color: '#E39B2D', side: 'right' }], membrane: { x: 0.5, pass: ['W'] } }],
  ['พื้นผิวคลื่น', 'z = sin(r − t) คลื่นวงกลมแผ่ออกจากจุดกลาง', { domain: 'math', dim: 3, title: 'พื้นผิว z = a sin(√(x² + y²) − t)', view: { L: 4 }, t: { min: 0, max: 62.8, speed: 2 }, vars: { a: 0.8 }, items: [{ type: 'surface', expr: 'a*sin(sqrt(x^2+y^2)*1.6-t)', n: 30 }], params: [{ key: 'a', label: 'แอมพลิจูด', min: 0, max: 1.5, step: 0.05 }] }],
  ['เกลียวกับเวกเตอร์สัมผัส', 'จุดเดินบนเกลียว ลูกศรคือทิศของความเร็ว', { domain: 'math', dim: 3, title: 'เกลียว r(s) = (cos s, sin s, s/4)', view: { L: 2.5 }, t: { min: 0, max: 18.85, speed: 1.2 }, items: [{ type: 'curve', x: 'cos(s)', y: 'sin(s)', z: 's/4-2.3', s0: '0', s1: '6*pi', color: '#2F4BB8' }, { type: 'tangent', x: 'cos(s)', y: 'sin(s)', z: 's/4-2.3', label: 'P', color: '#C2571A' }] }],
  ['พื้นผิวอานม้า', 'z = (x² − y²)/4 จุดอานม้าเป็นได้ทั้งต่ำสุดและสูงสุดตามแนวที่มอง', { domain: 'math', dim: 3, title: 'z = (x² − y²)/4', view: { L: 3 }, t: { min: 0, max: 6.2832, speed: 1 }, vars: { k: 4 }, items: [{ type: 'surface', expr: '(x^2-y^2)/k', n: 26 }, { type: 'point', x: '2.2*cos(t)', y: '2.2*sin(t)', z: '(4.84*cos(t)^2-4.84*sin(t)^2)/k', label: 'P', trace: true, color: '#C2571A' }], params: [{ key: 'k', label: 'k', min: 1, max: 10, step: 0.5 }] }]
];
const SP3 = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], SP2 = [[1, 0, 0], [-0.5, 0.866, 0], [-0.5, -0.866, 0]];
SCENE_TPL3.push(
  ['ออร์บิทัล s', 'ทรงกลม ความน่าจะพบอิเล็กตรอนเท่ากันทุกทิศ', { domain: 'math', dim: 3, title: 'ออร์บิทัล s', view: { L: 1.6 }, t: { min: 0, max: 1, speed: 0 }, items: [{ type: 'orbital', o: 's', color: '#2F4BB8' }] }],
  ['ออร์บิทัล p', 'สองพูตามแกน เฟสตรงข้ามกัน เลือก px py pz ได้', { domain: 'math', dim: 3, title: 'ออร์บิทัล p', view: { L: 1.6 }, t: { min: 0, max: 1, speed: 0 }, vars: { k: 3 }, items: [{ type: 'orbital', o: 'px,py,pz', pick: 'k', color: '#2F4BB8' }], params: [{ key: 'k', label: '1 px, 2 py, 3 pz', min: 1, max: 3, step: 1 }] }],
  ['ออร์บิทัล d', 'สี่พูหรือสองพูมีวงแหวน เลือกได้ทั้งห้าแบบ', { domain: 'math', dim: 3, title: 'ออร์บิทัล d', view: { L: 1.6 }, t: { min: 0, max: 1, speed: 0 }, vars: { k: 1 }, items: [{ type: 'orbital', o: 'dxy,dxz,dyz,dx2y2,dz2', pick: 'k', color: '#2F4BB8' }], params: [{ key: 'k', label: '1 dxy, 2 dxz, 3 dyz, 4 dx²−y², 5 dz²', min: 1, max: 5, step: 1 }] }],
  ['ออร์บิทัล p ทั้งสามแกน', 'px py pz ตั้งฉากกันตามแกน x y z', { domain: 'math', dim: 3, title: 'ออร์บิทัล px py pz', view: { L: 1.6 }, t: { min: 0, max: 1, speed: 0 }, items: [{ type: 'orbital', o: 'px', color: '#B23A3A', col2: '#F2B8B8' }, { type: 'orbital', o: 'py', color: '#2E7D4F', col2: '#B5DEC4' }, { type: 'orbital', o: 'pz', color: '#2F4BB8', col2: '#BAC6F0' }] }],
  ['ไฮบริด sp', 'สองออร์บิทัลชี้ตรงข้าม มุม 180 องศา เช่น BeCl2 C2H2', { domain: 'math', dim: 3, title: 'ไฮบริด sp', view: { L: 1.6 }, t: { min: 0, max: 1, speed: 0 }, items: [{ type: 'orbital', o: 'sp', dir: [1, 0, 0], color: '#2F4BB8' }, { type: 'orbital', o: 'sp', dir: [-1, 0, 0], color: '#2E8B57' }] }],
  ['ไฮบริด sp²', 'สามออร์บิทัลในระนาบ มุม 120 องศา เช่น BF3 C2H4', { domain: 'math', dim: 3, title: 'ไฮบริด sp²', view: { L: 1.6 }, t: { min: 0, max: 1, speed: 0 }, items: SP2.map((d, i) => ({ type: 'orbital', o: 'sp2', dir: d, color: ['#2F4BB8', '#2E8B57', '#8E44AD'][i] })) }],
  ['ไฮบริด sp³', 'สี่ออร์บิทัลชี้ไปมุมทรงสี่หน้า มุม 109.5 องศา เช่น CH4', { domain: 'math', dim: 3, title: 'ไฮบริด sp³', view: { L: 1.6 }, t: { min: 0, max: 1, speed: 0 }, items: SP3.map((d, i) => ({ type: 'orbital', o: 'sp3', dir: d, color: ['#2F4BB8', '#2E8B57', '#8E44AD', '#B23A3A'][i] })) }]
);
SCENE_TPL['3d'] = SCENE_TPL3;


/* ---------- living pictures, like the moving photographs of a wizarding newspaper: any drawing gets a behaviour that loops
   by itself on the page (sway, flutter, breathe, beat, bob, spin, wiggle, hop, flap, swim, flicker, shake, drive),
   can travel across the paper, and at the edge of the page comes back round, turns back, or peeks out from the edge ---------- */
const LIFE_KINDS = [
  ['sway', 'ไหวตามลม', 'ต้นไม้ ดอกไม้ หญ้า โคนนิ่ง ยอดไหว', 0],
  ['flutter', 'พลิ้ว', 'ธง ผ้า ผม ริบบิ้น พลิ้วเป็นคลื่นจากด้านซ้าย', 0],
  ['breathe', 'หายใจ', 'ตัวละครยืนนิ่ง อกขยับขึ้นลงเบา ๆ', 0],
  ['beat', 'เต้นตุบ ๆ', 'หัวใจ ดาว ไฟกะพริบ', 0],
  ['bob', 'ลอยขึ้นลง', 'ลูกโป่ง เรือ ผี เมฆ', 1],
  ['spin', 'หมุน', 'กังหัน ล้อ ดาว นาฬิกา', 0],
  ['wiggle', 'ดุ๊กดิ๊ก', 'ตัวการ์ตูนน่ารัก โยกซ้ายขวา', 1],
  ['hop', 'กระโดดดึ๋ง', 'กระต่าย กบ ลูกบอล กระโดดไปข้างหน้า', 1],
  ['flap', 'กระพือปีก', 'นก ผีเสื้อ ค้างคาว บินไป', 1],
  ['swim', 'ว่ายน้ำ', 'ปลา ปลาวาฬ หางสะบัดเป็นคลื่น', 1],
  ['flicker', 'เปลวไฟ', 'ไฟ เทียน ควัน ไหววูบวาบ', 0],
  ['shake', 'สั่น', 'กระดิ่ง นาฬิกาปลุก คนหนาว', 0],
  ['drive', 'วิ่งไป', 'รถ รถไฟ เรือ ล้อหมุนไปด้วย', 1],
  ['walk4', 'เดินสี่ขา', 'หมา แมว ม้า ช้าง ขาก้าวสลับเป็นคู่ทแยง', 1],
  ['roll', 'กลิ้ง', 'ก้อนหิน ลูกบอล ผลไม้ กลิ้งไปตามพื้น ชนแล้วกระเด้ง', 1]
];
/* every living picture notices the page unless the teacher turns it off: it stands on lines, cannot pass through writing,
   pictures or other living pictures, and reacts the way the real thing would */
const lifeTouch = (b) => b.touch !== 0;
/* which way a drawing faces: the end with the tail fans out, the end with the head stands taller */
function lifeFace(ink, B, kind) {
  const bw = B[2] - B[0], bh = B[3] - B[1], pts = []; for (const s of ink) for (const p of ipPts(s)) pts.push(p);
  if (!pts.length || bw < 10) return 1;
  const end = (lo, hi) => pts.filter((p) => p[0] >= lo && p[0] <= hi);
  if (kind === 'walk4') { const top = (a) => a.length ? Math.min(...a.map((p) => p[1])) : B[3]; const L = top(end(B[0], B[0] + 0.3 * bw)), R = top(end(B[2] - 0.3 * bw, B[2])); return Math.abs(L - R) < 0.05 * bh ? 1 : (R < L ? 1 : -1); }
  const spread = (a) => a.length ? Math.max(...a.map((p) => p[1])) - Math.min(...a.map((p) => p[1])) : 0;
  const L = spread(end(B[0], B[0] + 0.1 * bw)), R = spread(end(B[2] - 0.1 * bw, B[2]));
  return Math.abs(L - R) < 0.08 * bh ? 1 : (L > R ? 1 : -1);
}
const LIFE_EDGE = [['wrap', 'ออกขอบหนึ่งแล้ววนกลับมาอีกขอบ'], ['bounce', 'หันกลับเมื่อถึงขอบ'], ['peek', 'แอบที่ขอบ แล้วกลับมา'], ['stay', 'อยู่กับที่']];
const LIFE = new Map(); let lifeRaf = 0, lifeLast = 0;
function lifeRegion(B, beh) {
  /* a body that falls and bounces may go anywhere on the paper; a path goes where its key frames go */
  if (beh.k === 'phys') return [0, 0, W, H];
  if (beh.k === 'path' && beh.path && Array.isArray(beh.path.keys)) {
    let x0 = B[0], y0 = B[1], x1 = B[2], y1 = B[3]; const r = Math.hypot(B[2] - B[0], B[3] - B[1]) / 2, cx = (B[0] + B[2]) / 2, cy = (B[1] + B[3]) / 2;
    for (const k of beh.path.keys) { const s = Math.max(0.2, +k.scale || +k.s || 1); x0 = Math.min(x0, cx + (+k.dx || 0) - r * s); x1 = Math.max(x1, cx + (+k.dx || 0) + r * s); y0 = Math.min(y0, cy + (+k.dy || 0) - r * s); y1 = Math.max(y1, cy + (+k.dy || 0) + r * s); }
    return [Math.max(0, Math.round(x0 - 20)), Math.max(0, Math.round(y0 - 20)), Math.min(W, Math.round(x1 + 20)), H]; /* down to the bottom of the page, where its shadow can fall */
  }
  const bw = B[2] - B[0], bh = B[3] - B[1], mv = beh.move && beh.edge !== 'stay';
  const up = beh.k === 'hop' ? bh * 1.3 : beh.k === 'flap' ? bh * 0.8 : beh.k === 'bob' ? bh * 0.35 : beh.k === 'roll' ? bw * 0.3 : beh.k === 'flicker' ? bh * 1.2 + 30 : beh.k === 'swim' ? bh * 0.9 : bh * 0.3; /* room above for sparks, smoke and bubbles */
  const y0 = Math.max(0, Math.round(B[1] - up - 20 - (Array.isArray(beh.fx) && beh.fx.length ? bh * 0.9 + 50 : 0) - (lifeTouch(beh) ? Math.max(bh * 2, 120) : 0))), y1 = Math.min(H, Math.round(B[3] + bh * 0.25 + 20));
  const fxOn = Array.isArray(beh.fx) && beh.fx.length, sx = fxOn ? 0.9 : beh.k === 'beat' || beh.k === 'flicker' || beh.k === 'spin' ? 0.65 : 0.4;
  return mv ? [0, y0, W, y1] : [Math.max(0, Math.round(B[0] - bw * sx - 20)), y0, Math.min(W, Math.round(B[2] + bw * sx + 20)), y1];
}
async function placeLife(sp, kind, edge, face, extra) {
  const body = sp.refs.map((r) => { const s = findStroke(r); return s ? { r, s: clone(s) } : null; }).filter(Boolean);
  const pics = sp.items.map(findItem).filter(Boolean).map((it) => { const b = itemBox(it); return { asset: it.asset, x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1], item: clone(it) }; }).filter((q) => okAsset(q.asset));
  if (!body.length && !pics.length) throw { code: 'empty' };
  const B = ipBox(body.map((x) => x.s), pics), meta = kind === 'path' ? ['path', 'ตามที่บอก', '', 0] : kind === 'phys' ? ['phys', 'ตามหลักฟิสิกส์', '', 1] : LIFE_KINDS.find((k) => k[0] === kind) || LIFE_KINDS[0];
  const beh = Object.assign({ k: meta[0], amp: 1, sp: 1, move: meta[3] ? 1 : 0, edge: meta[3] ? (edge || 'bounce') : 'stay', dir: 1, face: face === -1 || face === 1 ? face : lifeFace(body.map((x) => x.s), B, meta[0]) }, extra || {});
  if (beh.k === 'roll') { beh.k = 'phys'; beh.round = 1; if (beh.vx == null) beh.vx = (beh.face || 1) * 260 * (beh.sp || 1); if (beh.mu == null) beh.mu = 0.25; if (beh.e == null) beh.e = 0.45; beh.rolling = 1; }
  if (beh.k === 'phys') { beh.edge = 'stay'; beh.move = 0; if (beh.round == null) beh.round = lifeRoundish(body.map((x) => x.s), B) ? 1 : 0; }
  const wheels = [];
  body.forEach((x, i) => { const P = ipPts(x.s); if (P.length < 8 || body.length < 2) return; const b = ipBox([x.s]), bw = b[2] - b[0], bh = b[3] - b[1], sz = Math.max(bw, bh); if (Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) > 0.35 * sz || bw / Math.max(1, bh) < 0.7 || bw / Math.max(1, bh) > 1.4 || (b[1] + b[3]) / 2 < B[1] + 0.45 * (B[3] - B[1]) || sz < 0.1 * (B[2] - B[0]) || sz > 0.7 * (B[2] - B[0])) return; wheels.push({ i: [i], cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, r: sz / 2 }); });
  const removed = [], touched = new Set();
  for (const x of body) { const arr = layerArr(x.r.layer); const i = arr.findIndex((s) => s.id === x.r.id); if (i >= 0) { removed.push({ layer: x.r.layer, stroke: arr[i] }); arr.splice(i, 1); touched.add(x.r.layer); } }
  if (removed.length) { pushUndo({ t: 'erase', removed }); saveLayers(touched); drawInk(); }
  if (!animOn()) animSet(true, true);
  const R0 = lifeRegion(B, beh), before = clone(S.page.items || []);
  const item = { id: 'i' + uid(), by: DEV, type: 'life', x: R0[0], y: R0[1], w: R0[2] - R0[0], h: R0[3] - R0[1], B, beh, wheels, ink: body.map((x) => x.s), pics: pics.map((q) => ({ asset: q.asset, x: q.x, y: q.y, w: q.w, h: q.h })), back: pics.map((q) => q.item) };
  const mvx = await mvApply(item, {});
  setItems(before.filter((t) => !sp.items.includes(t.id)).concat([item], mvx), before);
  clearSel(); toast('ภาพมีชีวิตแล้ว เล่นวนเองทุกครั้งที่เปิดหน้านี้ แตะปุ่มเล็กข้างภาพเพื่อปรับ', 3000);
}
function lifeSet(it, patch) {
  const live = findItem(it.id); if (!live) return; Object.assign(live.beh, patch);
  const R0 = lifeRegion(live.B, live.beh); const before = clone(S.page.items || []);
  const items = S.page.items.map((x) => (x.id === live.id ? Object.assign({}, live, { beh: Object.assign({}, live.beh), x: R0[0], y: R0[1], w: R0[2] - R0[0], h: R0[3] - R0[1] }) : x));
  const rt = LIFE.get(live.id); if (rt) { rt.dx = 0; rt.dir = live.beh.face || 1; rt.state = 'go'; rt.legs = null; rt.wings = null; rt.hull = null; rt.v = 0; }
  setItems(items, before);
}
function buildLife(d, it, forExport) {
  d.classList.add('life', 'no-ink'); d.style.height = (it.h || 100) + 'px';
  const cv = document.createElement('canvas'); cv.className = 'lifecv'; cv.style.width = '100%'; cv.style.height = (it.h || 100) + 'px'; d.appendChild(cv);
  let rt = LIFE.get(it.id); if (!rt) { rt = { t: 0, dx: 0, dir: (it.beh && it.beh.face) || 1, state: 'go', st0: 0, playing: animOn(), roll: 0 }; LIFE.set(it.id, rt); }
  rt.cv = cv;
  if (forExport) { requestAnimationFrame(() => lifeDraw(it, rt)); return; }
  const B = it.B, dot = document.createElement('button'); dot.type = 'button'; dot.className = 'lifedot'; dot.title = 'ปรับภาพเคลื่อนไหว'; dot.setAttribute('aria-label', 'ปรับภาพเคลื่อนไหว');
  dot.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z" fill="currentColor"/></svg>';
  dot.style.left = Math.max(0, B[0] - it.x - 6) + 'px'; dot.style.top = Math.max(0, B[1] - it.y - 30) + 'px';
  dot.onclick = (e) => { e.stopPropagation(); lifePanel(d, it, dot); };
  dot.addEventListener('pointerdown', (e) => e.stopPropagation());
  d.appendChild(dot);
  if (!lifeRaf) lifeRaf = requestAnimationFrame(lifeTick);
}
function lifePanel(d, it, dot) {
  const old = d.querySelector('.lifepanel'); if (old) { old.remove(); return; }
  const live = findItem(it.id) || it, rt = LIFE.get(it.id), p = document.createElement('div'); p.className = 'lifepanel';
  p.style.left = dot.style.left; p.style.top = (parseFloat(dot.style.top) + 30) + 'px';
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  const sel = document.createElement('select'); sel.className = 'traysel'; for (const [k, n] of LIFE_KINDS) { const o = document.createElement('option'); o.value = k; o.textContent = n; sel.appendChild(o); } sel.value = live.beh.k;
  sel.onchange = () => { const m = LIFE_KINDS.find((x) => x[0] === sel.value); lifeSet(it, { k: sel.value, move: m[3] ? 1 : 0, edge: m[3] ? (live.beh.edge === 'stay' ? 'bounce' : live.beh.edge) : 'stay' }); };
  p.appendChild(sel);
  const chips = document.createElement('div'); chips.className = 'chips';
  for (const [k, n] of LIFE_EDGE) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = n; b.setAttribute('aria-pressed', (live.beh.edge || 'stay') === k ? 'true' : 'false'); b.onclick = () => lifeSet(it, { edge: k, move: k === 'stay' ? 0 : 1 }); chips.appendChild(b); }
  p.appendChild(chips);
  const fc = document.createElement('div'); fc.className = 'chips';
  for (const [f, n] of [[-1, 'หันหน้าไปทางซ้าย'], [1, 'หันหน้าไปทางขวา']]) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = n; b.setAttribute('aria-pressed', (live.beh.face || 1) === f ? 'true' : 'false'); b.title = 'บอกว่าภาพที่วาดหันหน้าไปทางไหน หัวจะนำเวลาเคลื่อนที่ หางหรือขาหลังตามหลัง'; b.onclick = () => lifeSet(it, { face: f }); fc.appendChild(b); }
  p.appendChild(fc);
  { const es = document.createElement('select'); es.className = 'traysel'; es.title = 'สีหน้าและเสียงของภาพคนหรือหน้าที่วาด'; for (const [k, n] of LIFE_EXPR) { const o = document.createElement('option'); o.value = k; o.textContent = 'สีหน้า: ' + n; es.appendChild(o); } es.value = live.beh.expr || 'none';
    es.onchange = () => { const R = LIFE.get(it.id); if (R) R.face = undefined; lifeSet(it, { expr: es.value }); }; p.appendChild(es); }
  /* tell it what else it does, in plain words: barks, sings, sleeps, is hot, it is raining ... */
  { const r = document.createElement('div'); r.className = 'mrow'; const inp = document.createElement('input'); inp.placeholder = 'บอกเพิ่ม เช่น เห่า ร้องเพลง หลับ ร้อน ฝนตก'; inp.maxLength = 80;
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn'; ok.textContent = 'ใส่'; ok.onclick = () => { const w = typeof motionWords === 'function' ? motionWords(inp.value) : {}; const patch = {}; if (w.fx) patch.fx = w.fx; if (w.expr) patch.expr = w.expr; if (!w.fx && !w.expr) { toast('ยังไม่รู้จักคำนี้ ลองคำอื่น เช่น เห่า ร้องเพลง หลับ ตะโกน', 2600); return; } const R = LIFE.get(it.id); if (R) R.face = undefined; lifeSet(it, patch); toast('เพิ่มให้แล้ว', 1500); };
    const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'btn'; clr.textContent = 'ล้าง'; clr.onclick = () => lifeSet(it, { fx: [], expr: 'none' });
    r.append(inp, ok, clr); p.appendChild(r); }
  { const tc = document.createElement('div'); tc.className = 'chips'; const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = 'โต้ตอบกับสิ่งอื่นบนหน้า';
    b.title = 'เดินบนเส้นที่วาด หันกลับเมื่อชนลายมือ รูป หรือภาพเคลื่อนไหวอื่น กระโดดข้ามสิ่งที่เตี้ย'; b.setAttribute('aria-pressed', lifeTouch(live.beh) ? 'true' : 'false');
    b.onclick = () => lifeSet(it, { touch: lifeTouch(live.beh) ? 0 : 1 }); tc.appendChild(b);
    const fb = document.createElement('button'); fb.type = 'button'; fb.className = 'chip'; fb.textContent = 'รายละเอียดให้สมจริง'; fb.title = 'ประกายไฟและควัน ฟองน้ำ ฝุ่นตอนลงพื้น ควันท่อ ลม คลื่นชีพจร และท่าทางตกใจ';
    fb.setAttribute('aria-pressed', live.beh.fx !== 0 ? 'true' : 'false'); fb.onclick = () => lifeSet(it, { fx: live.beh.fx !== 0 ? 0 : 1 }); tc.appendChild(fb); p.appendChild(tc); }
  const sl = (label, key, min, max) => { const l = document.createElement('label'); l.className = 'lifesl'; l.innerHTML = '<span>' + label + '</span>'; const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = 0.05; r.value = live.beh[key]; r.oninput = () => { const L = findItem(it.id); if (L) L.beh[key] = +r.value; }; r.onchange = () => savePage(); l.appendChild(r); p.appendChild(l); };
  sl('ความเร็ว', 'sp', 0.2, 3); sl('ความแรงของท่าทาง', 'amp', 0.2, 2.5);
  const row = document.createElement('div'); row.className = 'row2';
  const pb = document.createElement('button'); pb.type = 'button'; pb.className = 'btn'; pb.textContent = rt && rt.playing ? 'หยุด' : 'เล่น'; pb.onclick = () => { const R = LIFE.get(it.id); if (!R) return; R.playing = !R.playing; pb.textContent = R.playing ? 'หยุด' : 'เล่น'; if (R.playing && !lifeRaf) lifeRaf = requestAnimationFrame(lifeTick); };
  const bk = document.createElement('button'); bk.type = 'button'; bk.className = 'btn'; bk.textContent = 'คืนเป็นภาพวาด'; bk.onclick = () => { LIFE.delete(it.id); restoreInk(findItem(it.id)); };
  const dl = document.createElement('button'); dl.type = 'button'; dl.className = 'btn danger'; dl.textContent = 'ลบ'; dl.onclick = () => { const before = clone(S.page.items || []); setItems(before.filter((x) => x.id !== it.id), before); LIFE.delete(it.id); };
  const fo = document.createElement('button'); fo.type = 'button'; fo.className = 'btn'; fo.textContent = 'ย่อ'; fo.onclick = () => p.remove();
  row.append(pb, bk, dl, fo); p.appendChild(row); d.appendChild(p);
}
function lifeTick(ts) {
  lifeRaf = 0; const dt = lifeLast ? Math.min(0.05, (ts - lifeLast) / 1000) : 0.016; lifeLast = ts; let any = false;
  const vr = vp.getBoundingClientRect();
  for (const [id, rt] of LIFE) {
    if (!rt.cv || !rt.cv.isConnected) { if (rt.cv && !rt.cv.isConnected) LIFE.delete(id); continue; }
    const it = findItem(id); if (!it) continue; any = true; if (!rt.playing) continue;
    const r = rt.cv.getBoundingClientRect(); if (r.bottom < vr.top || r.top > vr.bottom || r.right < vr.left || r.left > vr.right) continue;
    rt.t += dt * (it.beh.sp || 1); lifeMove(it, rt, dt); lifeDraw(it, rt);
  }
  if (any) lifeRaf = requestAnimationFrame(lifeTick); else lifeLast = 0;
}
const LIFE_SPEED = { hop: 110, flap: 140, swim: 80, drive: 200, bob: 35, wiggle: 45, walk4: 70, roll: 90 };
/* legs of a four-legged drawing: ink below the belly, grouped where there are gaps between them */
function lifeLegs(it) {
  const B = it.B, bw = B[2] - B[0], bh = B[3] - B[1];
  /* legs drawn as their own lines: tall thin strokes in the lower part, each swings about its top */
  const ls = []; it.ink.forEach((s, i) => { const b = ipBox([s]), w = b[2] - b[0], h = b[3] - b[1]; if (h > 1.4 * w && h > 0.15 * bh && b[3] > B[1] + 0.75 * bh && (b[1] + b[3]) / 2 > B[1] + 0.5 * bh) ls.push({ i, px: (b[0] + b[2]) / 2, top: b[1], bot: b[3] }); });
  if (ls.length >= 2) {
    ls.sort((a, z) => a.px - z.px); const n = ls.length, L = ls.reduce((a, l) => a + l.bot - l.top, 0) / n;
    return { strokes: true, L, yz: Math.min(...ls.map((l) => l.top)), legs: ls.map((l, k) => ({ i: l.i, px: l.px, top: l.top, ph: n === 4 ? [0, Math.PI, Math.PI, 0][k] : (k % 2) * Math.PI })) };
  }
  const yz = B[1] + 0.7 * bh, xs = [];
  for (const s of it.ink) for (const p of ipPts(s)) if (p[1] > yz) xs.push(p[0]);
  xs.sort((a, b) => a - b); const cl = []; let cur = null;
  for (const x of xs) { if (cur && x - cur[1] <= Math.max(6, 0.05 * bw)) cur[1] = x; else { cur = [x, x]; cl.push(cur); } }
  let legs = cl.filter((c) => c[1] - c[0] < 0.32 * bw);
  if (legs.length < 2) legs = [[B[0], (B[0] + B[2]) / 2], [(B[0] + B[2]) / 2, B[2]]];
  const L = Math.max(4, B[3] - yz), n = legs.length;
  return { yz, L, legs: legs.map((c, i) => ({ x0: c[0] - 4, x1: c[1] + 4, px: (c[0] + c[1]) / 2, ph: n === 4 ? [0, Math.PI, Math.PI, 0][i] : (i % 2) * Math.PI })) };
}
/* wings of a bird drawn from the side: smaller strokes sitting on top of the body stroke */
function lifeWings(it) {
  if (it.ink.length < 2) return [];
  const bx = it.ink.map((s) => ipBox([s])), area = bx.map((b) => (b[2] - b[0]) * (b[3] - b[1])), bi = area.indexOf(Math.max(...area)), b0 = bx[bi], cyb = (b0[1] + b0[3]) / 2;
  const out = [];
  it.ink.forEach((s, i) => { if (i === bi) return; const b = bx[i], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; if (cy < cyb && cx > b0[0] && cx < b0[2] && area[i] > 0.04 * area[bi]) { const P = ipPts(s); let pv = P[0], d = 1e9; for (const p of P) { const q = Math.hypot(p[0] - (b0[0] + b0[2]) / 2, p[1] - cyb); if (q < d) { d = q; pv = p; } } out.push({ i, pv }); } });
  return out;
}
/* travelling and what happens at the edge of the paper. Speed eases in and out, turning back is a quick turn on the spot,
   animals stop for a moment now and then, a hopping thing only moves forward while it is in the air */
const lifeNoise = (t, s) => Math.sin(t * 0.37 + s) * 0.6 + Math.sin(t * 0.91 + 2 * s) * 0.3 + Math.sin(t * 2.3 + 3 * s) * 0.1;
function lifeTarget(it, rt) {
  const b = it.beh, base = (LIFE_SPEED[b.k] || 60) * (b.sp || 1), t = rt.t + rt.seed;
  if (rt.state !== 'go') return 0;
  if (b.k === 'hop') { const u = (rt.hp % 1); return u > 0.18 ? base * 1.5 : 0; }
  if (b.k === 'swim') return base * (1 + 0.35 * Math.sin(t * 6));
  if (b.k === 'wiggle') return base * (0.6 + 0.4 * Math.abs(Math.sin(t * 7)));
  if (b.k === 'bob') return base * (0.7 + 0.3 * lifeNoise(t, 1));
  if (b.k === 'flap') return base * (0.9 + 0.15 * Math.sin(t * 0.8));
  return base;
}
/* ----- living pictures that notice the page: they walk on lines drawn under them, turn back when they bump into
   writing, pictures or another living picture, and a hopping one jumps over anything low. Each picture chooses this for itself ----- */
const LIFE_GROUND = ['walk4', 'drive', 'roll', 'hop', 'wiggle'];
let lifeWorld = { t: 0, strokes: [], boxes: [] };
function lifeWorldNow() {
  const now = performance.now(); if (now - lifeWorld.t < 400) return lifeWorld;
  const strokes = []; for (const r of allStrokes()) { const b = sbox(r.s), w = b[2] - b[0], h = b[3] - b[1]; strokes.push({ b, s: r.s, ground: (w > 2.5 * h && w > 60) || w > 260 }); }
  const boxes = []; for (const it of (S.page && S.page.items) || []) { if (it.type === 'life' || it.lock || (it.spec && it.spec.bare)) continue; const b = itemBox(it); if (b[2] - b[0] > 4 && b[3] - b[1] > 4) boxes.push(b); }
  lifeWorld = { t: now, strokes, boxes }; return lifeWorld;
}
/* where this picture is on the page right now, roughly */
function lifeBox(it, rt) { const B = it.B; if (it.beh && (it.beh.k === 'phys' || it.beh.k === 'path')) { const px = rt.px || 0, py = rt.py || 0; return [B[0] + px, B[1] + py, B[2] + px, B[3] + py]; } return [B[0] + (rt.dx || 0), B[1] + (rt.gy || 0) + (rt.alt || 0), B[2] + (rt.dx || 0), B[3] + (rt.gy || 0) + (rt.alt || 0)]; }
/* the highest point of a pen line inside a rectangle, or null: the line is followed segment by segment, so a long straight
   line drawn with only two points still counts */
function lifeTopIn(s, xa, xb, ya, yb) {
  const P = ipPts(s); let top = null;
  const clip = (x1, y1, x2, y2) => { let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
    for (const [pp, q] of [[-dx, x1 - xa], [dx, xb - x1], [-dy, y1 - ya], [dy, yb - y1]]) { if (pp === 0) { if (q < 0) return null; } else { const r = q / pp; if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } } }
    return Math.min(y1 + t0 * dy, y1 + t1 * dy); };
  if (P.length === 1) { const q = P[0]; return q[0] >= xa && q[0] <= xb && q[1] >= ya && q[1] <= yb ? q[1] : null; }
  for (let i = 1; i < P.length; i++) { const y = clip(P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]); if (y != null && (top == null || y < top)) top = y; }
  return top;
}
function lifeSense(it, rt, dt) {
  const b = it.beh, k = b.k, B = it.B, bw = B[2] - B[0], bh = B[3] - B[1], Wd = lifeWorldNow();
  const box = lifeBox(it, rt), feet = box[3];
  /* ground: the top of any ink just under the feet, so it climbs a drawn hill or walks along a drawn floor */
  if (LIFE_GROUND.includes(k)) {
    const g0 = rt.gy || 0, up = Math.max(bh * 2, 120), xa = box[0] + bw * 0.25, xb = box[2] - bw * 0.25, ya = Math.max(B[3] - up, B[3] + g0 - bh * 0.6), yb = Math.min(B[3] + bh * 0.25, B[3] + g0 + bh * 0.25); let top = null;
    for (const o of Wd.strokes) { if (!o.ground) continue; const q = o.b; if (q[2] < xa || q[0] > xb || q[3] < ya || q[1] > yb) continue; const y = lifeTopIn(o.s, xa, xb, ya, yb); if (y != null && (top == null || y < top)) top = y; }
    /* with no line under it, it settles back down to where it was drawn */
    const tgt = top == null ? (g0 < 0 ? Math.min(0, g0 + bh * 0.25) : 0) : top - B[3];
    rt.gy = (rt.gy || 0) + (tgt - (rt.gy || 0)) * Math.min(1, dt * 8);
  }
  if (rt.state !== 'go' || !b.move || b.edge === 'stay') return;
  /* something ahead? */
  const reach = Math.max(10, (rt.v || 0) * 0.35), dir = rt.dir, f0 = dir > 0 ? box[2] : box[0], za = Math.min(f0, f0 + dir * reach), zb = Math.max(f0, f0 + dir * reach);
  const yTop = box[1] + bh * 0.1, yBot = feet - bh * 0.4;
  const jumpH = k === 'hop' ? bh * 1.1 * (b.amp || 1) : 0;
  const tall = (top) => (k === 'hop' ? top < feet - jumpH * 0.8 : true);
  let hit = false;
  /* for pen lines look only a short way ahead, so a gentle slope is climbed while a steep line or a wall turns it back */
  const sr = Math.max(6, Math.min(reach, bh * 0.5)), sa = dir > 0 ? f0 : f0 - sr, sb = dir > 0 ? f0 + sr : f0;
  for (const o of Wd.strokes) { const yb2 = o.ground ? yBot : feet - 3; const q = o.b; if (q[2] < sa || q[0] > sb || q[3] < yTop || q[1] > yb2) continue;
    const topY = lifeTopIn(o.s, sa, sb, yTop, yb2);
    if (topY != null && tall(topY)) { hit = true; break; } }
  if (!hit) for (const q of Wd.boxes) { if (q[2] < za || q[0] > zb || q[3] < yTop || q[1] > yBot) continue; if (dir > 0 ? q[0] < box[2] - 4 : q[2] > box[0] + 4) continue; if (tall(q[1])) { hit = true; break; } }
  if (!hit) for (const [id2, r2] of LIFE) { if (id2 === it.id) continue; const o = findItem(id2); if (!o || !o.beh || !o.B) continue; const q = lifeBox(o, r2);
    /* a loose physical thing in the way gets kicked or pushed along instead of being walked through */
    if (o.beh.k === 'phys') { if (q[2] < za || q[0] > zb || q[3] < yTop || q[1] > yBot) continue; if (r2.px == null) continue; if ((dir > 0 ? q[0] - box[2] : box[0] - q[2]) < -3) { hit = true; rt.met = id2; break; } /* it cannot move any further: it is in the way */ const push = Math.max(rt.v || 0, 60) * 1.6; if (dir > 0 ? r2.vx < push : r2.vx > -push) { r2.vx = dir * push; r2.vy = Math.min(r2.vy || 0, -push * 0.25); r2.sleep = 0; } rt.v *= 0.6; continue; } if (q[2] < za || q[0] > zb || q[3] < yTop || q[1] > yBot) continue; if (dir > 0 ? q[0] < box[2] - 4 : q[2] > box[0] + 4) continue; hit = true; rt.met = id2; break; }
  if (!hit) return;
  if (k === 'hop' && rt.hp % 1 > 0.05) return;
  lifeReact(it, rt, k, 1);
}

/* how a living picture reacts when it runs into something, like the real thing would. Nothing passes through anything:
   boxed in on both sides it waits and looks around instead of walking through */
function lifeReact(it, rt, k, hard) {
  if (rt.state === 'turn' || (rt.scare || 0) > 0.6) return;
  const boxed = rt.t - (rt.lastBump || -9) < 1.2; rt.lastBump = rt.t;
  rt.bump = 1; rt.scare = Math.min(1, (rt.scare || 0) + 0.8 * hard);
  const bw = it.B[2] - it.B[0];
  if (boxed) { rt.v = 0; rt.state = 'rest'; rt.st0 = rt.t; rt.restFor = 1.5 + Math.random() * 2; rt.turnAfter = true; return; }
  if (k === 'flap') { rt.v *= -0.4; rt.climb = 1; rt.state = 'turn'; rt.tp = 0; rt.flipped = false; return; } /* a bird startles: flaps hard, rises and turns away */
  if (k === 'swim') { rt.v = 0; rt.state = 'turn'; rt.tp = 0.2; rt.flipped = false; rt.dart = 1; return; } /* a fish flicks round and darts off */
  if (k === 'walk4' || k === 'wiggle' || k === 'hop') { rt.recoil = -rt.dir * Math.min(24, bw * 0.15); rt.v = 0; rt.jolt = 1; rt.state = 'rest'; rt.st0 = rt.t; rt.restFor = 0.45 + Math.random() * 0.5; rt.turnAfter = true; return; } /* an animal jumps back, freezes, then turns */
  if (k === 'drive') { rt.recoil = -rt.dir * Math.min(14, bw * 0.08); rt.v = 0; rt.state = 'rest'; rt.st0 = rt.t; rt.restFor = 0.5; rt.turnAfter = true; return; } /* a car bumps, stops, reverses */
  rt.v *= 0.3; rt.state = 'turn'; rt.tp = 0; rt.flipped = false;
}

/* something coming at a standing drawing makes it flinch: it ducks, leans and steps away from that side, then recovers */
function lifeThreat(it, rt, dt) {
  if (rt.flinch) rt.flinch = Math.max(0, rt.flinch - dt * 1.4);
  const b = it.beh; if ((b.move && b.edge !== 'stay') || !lifeTouch(b)) return;
  const me = lifeBox(it, rt), cx = (me[0] + me[2]) / 2, cy = (me[1] + me[3]) / 2, sz = Math.max(me[2] - me[0], me[3] - me[1]);
  for (const [id2, r2] of LIFE) {
    if (id2 === it.id) continue; const o = findItem(id2); if (!o || !o.beh || !o.B) continue;
    const q = lifeBox(o, r2), ox = (q[0] + q[2]) / 2, oy = (q[1] + q[3]) / 2, d = Math.hypot(ox - cx, oy - cy) - (sz + Math.max(q[2] - q[0], q[3] - q[1])) / 2;
    const seen = rt.seen || (rt.seen = {}), prev = seen[id2]; seen[id2] = [ox, oy];
    if (d > sz * 0.7 || !prev) continue;
    const closing = Math.hypot(prev[0] - cx, prev[1] - cy) - Math.hypot(ox - cx, oy - cy);
    if (closing > 0.3 || (d < 0 && closing > 0.05)) { rt.flinch = 1; rt.flinchDir = ox > cx ? -1 : 1; rt.flinchUp = oy < cy; }
  }
}
function lifeMove(it, rt, dt) {
  if (it.beh.k === 'phys') { lifePhys(it, rt, dt); return; }
  if (it.beh.k === 'path') { const q = lifePathAt(it, rt.t); rt.px = q.dx; rt.py = q.dy; rt.dx = 0; return; }
  lifeThreat(it, rt, dt);
  const b = it.beh, k = b.k, B = it.B, bw = B[2] - B[0], base = (LIFE_SPEED[k] || 60) * (b.sp || 1);
  if (rt.seed == null) rt.seed = Math.random() * 50;
  if (rt.hp == null) { rt.hp = 0; rt.gp = 0; rt.v = 0; rt.alt = 0; rt.rest = 6 + Math.random() * 8; }
  if (!b.move || b.edge === 'stay') { if (lifeTouch(b)) { try { lifeSense(it, rt, dt); } catch (e) { /* ignore */ } } rt.dx = 0; rt.v = 0; rt.hp += dt * (b.sp || 1) / 0.95; rt.gp += dt * (b.sp || 1) * 2.2; return; }
  /* states: go, slow (coming to the edge or a rest), turn, peek, rest */
  if (rt.state === 'turn') { rt.tp += dt / 0.38; if (rt.tp >= 0.5 && !rt.flipped) { rt.dir = -rt.dir; rt.flipped = true; } if (rt.tp >= 1) { rt.state = 'go'; rt.tp = 0; } }
  else if (rt.state === 'peek') { if (rt.t - rt.st0 > 2.6) { rt.state = 'turn'; rt.tp = 0; rt.flipped = false; } }
  else if (rt.state === 'rest') { if (rt.t - rt.st0 > rt.restFor) { if (rt.turnAfter) { rt.turnAfter = false; rt.state = 'turn'; rt.tp = 0; rt.flipped = false; } else rt.state = 'go'; rt.rest = rt.t + 7 + Math.random() * 9; } }
  else if ((k === 'walk4' || k === 'hop' || k === 'wiggle') && rt.t > rt.rest && (k !== 'hop' || rt.hp % 1 < 0.05)) { rt.state = 'rest'; rt.st0 = rt.t; rt.restFor = 1 + Math.random() * 1.6; }
  const tgt = lifeTarget(it, rt), acc = k === 'hop' ? 30 : k === 'drive' ? 1.6 : 3.2;
  rt.v += (tgt - rt.v) * Math.min(1, dt * acc);
  rt.dx += rt.dir * rt.v * dt;
  /* gait clocks follow the real speed so feet do not slide */
  if (k === 'hop') { if (rt.state === 'go' || rt.hp % 1 > 0.02) rt.hp += dt * (b.sp || 1) / 0.95; }
  if (k === 'walk4') { const L = (rt.legs && rt.legs.L) || bw * 0.3; rt.gp += dt * rt.v / (0.242 * L); }
  if (k === 'flap') { const fl = ((rt.t + rt.seed) % 3.4) < 2.3; rt.alt = clamp(rt.alt + (fl ? -1 : 0.7) * dt * (B[3] - B[1]) * 0.22, -(B[3] - B[1]) * 0.7, (B[3] - B[1]) * 0.5); }
  if (lifeTouch(b)) { try { lifeSense(it, rt, dt); } catch (e) { /* keep moving without sensing */ } } else rt.gy = 0;
  if (rt.bump) rt.bump = Math.max(0, rt.bump - dt * 4);
  if (rt.recoil) { const step = rt.recoil * Math.min(1, dt * 10); rt.dx += step; rt.recoil -= step; if (Math.abs(rt.recoil) < 0.3) rt.recoil = 0; }
  if (rt.scare) rt.scare = Math.max(0, rt.scare - dt * 0.9);
  if (rt.jolt) rt.jolt = Math.max(0, rt.jolt - dt * 3);
  if (k === 'flap' && rt.climb) { rt.alt = Math.max(-(B[3] - B[1]) * 1.6, (rt.alt || 0) - dt * (B[3] - B[1]) * 2.4 * rt.climb); rt.climb = Math.max(0, rt.climb - dt * 1.2); }
  if (k === 'swim' && rt.dart) { rt.v = Math.max(rt.v, (LIFE_SPEED.swim || 80) * (b.sp || 1) * (1 + 2 * rt.dart)); rt.dart = Math.max(0, rt.dart - dt * 1.5); }
  const left = B[0] + rt.dx, right = left + bw;
  if (rt.state !== 'go') return;
  if (b.edge === 'wrap') { if (left > W + 10) rt.dx -= W + bw + 20; else if (right < -10) rt.dx += W + bw + 20; }
  else if (b.edge === 'bounce') { const ahead = rt.v * rt.v / (2 * Math.max(1, acc * base * 0.6)); if ((rt.dir > 0 && right + ahead > W - 6) || (rt.dir < 0 && left - ahead < 6)) { if (k === 'hop' && rt.hp % 1 > 0.05) return; rt.state = 'turn'; rt.tp = 0; rt.flipped = false; } }
  else if (b.edge === 'peek') { if ((rt.dir > 0 && left + bw * 0.55 > W) || (rt.dir < 0 && right - bw * 0.55 < 0)) { rt.state = 'peek'; rt.st0 = rt.t; } }
}
function lifeDraw(it, rt) {
  const cv = rt.cv; if (!cv) return; const w = it.w, h = it.h, dpr = Math.min(3, (window.devicePixelRatio || 1) * Math.max(1, (S.base || 1) * (S.zoom || 1))), cap = Math.min(dpr, Math.sqrt(6e6 / Math.max(1, w * h)));
  if (cv.width !== Math.round(w * cap) || cv.height !== Math.round(h * cap)) { cv.width = Math.round(w * cap); cv.height = Math.round(h * cap); }
  const c = cv.getContext('2d'); c.setTransform(cap, 0, 0, cap, 0, 0); c.clearRect(0, 0, w, h); c.translate(-it.x, -it.y);
  if (rt.seed == null) rt.seed = Math.random() * 50;
  const B = it.B, b = it.beh, A = (b.amp || 1) * (1 + (b.k === 'flap' ? 0.5 * (rt.scare || 0) : 0)), T0 = rt.t, t = T0 + rt.seed + (b.k === 'flap' ? (rt.wingX = (rt.wingX || 0) + (rt.scare || 0) * 0.03) : 0), bw = B[2] - B[0], bh = B[3] - B[1], cx = (B[0] + B[2]) / 2, cy = (B[1] + B[3]) / 2, TAU = Math.PI * 2;
  const face = b.face || 1, moving = b.move && b.edge !== 'stay', isPath = b.k === 'path', k = isPath && b.sub ? b.sub : b.k, base = (LIFE_SPEED[k] || 60) * (b.sp || 1), vr = moving ? clamp((rt.v || 0) / Math.max(1, base), 0, 1.6) : 1;
  /* whole-body motion: offset, rotation and squash about a pivot */
  let ox = rt.dx, oy = 0, rot = 0, sx = 1, sy = 1, px = cx, py = B[3];
  if (k === 'bob') { oy = -(Math.sin(t * 1.7) * 0.7 + Math.sin(t * 0.63) * 0.3) * bh * 0.12 * A; rot = (Math.sin(t * 1.1) * 0.05 + lifeNoise(t, 2) * 0.03) * A; py = cy; }
  else if (k === 'spin') { rot = T0 * 2.2 * face; px = cx; py = cy; }
  else if (k === 'wiggle') { const st = Math.sin(t * 7); rot = st * 0.11 * A; oy = -Math.abs(st) * bh * 0.03 * A * (moving ? vr : 0.5); sy = 1 + Math.abs(Math.cos(t * 7)) * 0.03 * A; }
  else if (k === 'hop') {
    const u = (rt.hp == null ? T0 / 0.95 : rt.hp) % 1;
    if (u < 0.18) { const q = u / 0.18, d = Math.sin(Math.PI * q); sy = 1 - 0.2 * A * d; sx = 1 + 0.12 * A * d; }
    else { const q = (u - 0.18) / 0.82; oy = -4 * q * (1 - q) * bh * 1.1 * A; sy = 1 + 0.1 * A * Math.sin(Math.PI * Math.min(1, q * 1.6)) * (1 - q); sx = 2 - sy; rot = -face * (0.5 - q) * 0.25 * A; }
  }
  else if (k === 'breathe') { const br = Math.sin(t * 2.2); sy = 1 + br * 0.03 * A; sx = 1 - br * 0.01 * A; rot = Math.sin(t * 0.45) * 0.012 * A; }
  else if (k === 'beat') { const u = ((T0 * (b.sp || 1) * 0 + T0) % 1.05) / 1.05, pulse = Math.exp(-Math.pow((u - 0.12) / 0.05, 2)) + 0.6 * Math.exp(-Math.pow((u - 0.32) / 0.05, 2)); sx = sy = 1 + 0.13 * A * pulse; py = cy; }
  else if (k === 'shake') { const on = (t % 2.4) < 1.3 ? 1 : 0.08; rot = Math.sin(t * 38) * 0.07 * A * on; oy = -Math.abs(Math.sin(t * 19)) * 1.5 * on; py = B[1]; }
  else if (k === 'flap') { const fl = (t % 3.4) < 2.3; oy = (rt.alt || 0) + (fl ? Math.sin(t * 9 + Math.PI) * bh * 0.06 * A : Math.sin(t * 1.3) * bh * 0.03); rot = -face * (fl ? 0.07 : -0.05); py = cy; }
  else if (k === 'drive') { const bump = Math.sin(rt.dx * 0.05) * 0.6 + Math.sin(rt.dx * 0.13 + 1) * 0.4; oy = -Math.abs(bump) * 1.8 * A; rot = -rt.dir * ((LIFE_SPEED.drive * (b.sp || 1) - (rt.v || 0)) / Math.max(1, LIFE_SPEED.drive)) * 0.03 * (rt.state === 'go' ? 1 : -1) + bump * 0.006; }
  else if (k === 'swim') { oy = (Math.sin(t * 1.3) * 0.7 + lifeNoise(t, 3) * 0.3) * bh * 0.14 * A; rot = Math.cos(t * 1.3) * 0.06 * A * face; py = cy; }
  else if (k === 'flicker') { sy = 1 + (Math.sin(t * 11) * 0.5 + Math.sin(t * 17.3) * 0.5) * 0.05 * A; sx = 1 - (sy - 1) * 0.5; }
  let gait = null;
  if (k === 'walk4') { gait = rt.legs || (rt.legs = lifeLegs(it)); const gp = rt.gp != null ? rt.gp : T0 * 2.2; gait.ph0 = gp; gait.a = moving ? Math.min(1, vr) : 0.25; oy = -Math.abs(Math.cos(gp)) * 0.03 * bh * A * gait.a; rot = Math.sin(gp) * 0.012 * A * gait.a; }
  if (k === 'roll') {
    const r0 = Math.max(4, Math.min(bw, bh) / 2); rot = (moving ? rt.dx : T0 * 50) / r0; px = cx; py = cy;
    /* an uneven rock rolls on its lowest point: lift it so that point touches the ground line */
    const pts = rt.hull || (rt.hull = (() => { const a = []; for (const s of it.ink) { const P = ipPts(s); for (let q = 0; q < P.length; q += Math.max(1, Math.floor(P.length / 30))) a.push(P[q]); } return a.length ? a : [[B[0], B[1]], [B[2], B[3]]]; })());
    let lo = -1e9; const cr = Math.cos(rot), sr = Math.sin(rot); for (const p of pts) { const y = cy + (p[0] - cx) * sr + (p[1] - cy) * cr; if (y > lo) lo = y; }
    oy = B[3] - lo;
  }
  if (k === 'phys') { ox = rt.px || 0; oy = rt.py || 0; rot = rt.ang || 0; px = cx; py = cy; sx = sy = 1; }
  /* a path the AI or the teacher's words gave: the body follows it while its own movement (wings beating, legs walking) goes on */
  let pathDir = 0;
  if (isPath) { const q = lifePathAt(it, T0), q2 = lifePathAt(it, T0 + 0.06); pathDir = Math.abs(q2.dx - q.dx) > 0.2 ? Math.sign(q2.dx - q.dx) : (rt.pathDir || 0); rt.pathDir = pathDir; const wob = k === 'flap' ? Math.sin(t * 9 + Math.PI) * bh * 0.05 * A : 0; ox = q.dx; oy = q.dy + wob; rot = q.rot + (k === 'flap' ? -(pathDir || face) * clamp((q2.dy - q.dy) * 0.02, -0.35, 0.35) : 0); sx = sy = q.s; px = cx; py = cy; }
  if (lifeTouch(b) && LIFE_GROUND.includes(k)) oy += rt.gy || 0;
  if (rt.bump) { const q = rt.bump; sx *= 1 - 0.12 * q; sy *= 1 + 0.08 * q; }
  /* the body goes with the face: leaning in to shout, shaking with laughter, slumping when sad, jumping back when surprised */
  const ex = b.expr && b.expr !== 'none' ? b.expr : null;
  if (ex) { const bu = lifeBurst(T0);
    if (ex === 'shout') { rot += face * 0.07 * bu; oy -= bh * 0.015 * bu; sy *= 1 + 0.02 * bu; }
    else if (ex === 'laugh') { rot += Math.sin(T0 * 15) * 0.035; oy -= Math.abs(Math.sin(T0 * 15)) * bh * 0.012; }
    else if (ex === 'sad' || ex === 'cry') { sy *= 0.985 + 0.01 * Math.sin(T0 * 1.6); rot += face * 0.025; if (ex === 'cry') rot += Math.sin(T0 * 9) * 0.01 * (Math.sin(T0 * 1.3) > 0 ? 1 : 0); }
    else if (ex === 'surprise') { const q = (T0 % 3.2) < 0.35 ? Math.sin(Math.PI * (T0 % 3.2) / 0.35) : 0; oy -= q * bh * 0.05; rot -= face * q * 0.05; }
    else if (ex === 'angry') { rot += Math.sin(T0 * 30) * 0.012 * (Math.sin(T0 * 1.7) > 0.2 ? 1 : 0); }
    else if (ex === 'happy') { oy -= Math.abs(Math.sin(T0 * 3)) * bh * 0.01; }
    else if (ex === 'talk') { rot += Math.sin(T0 * 2.1) * 0.02; }
  }
  if (rt.jolt) { oy -= Math.sin(Math.PI * rt.jolt) * bh * 0.18; rot += rt.dir * 0.08 * rt.jolt; }
  if (rt.scare && k !== 'flap' && k !== 'phys' && k !== 'path') rot += Math.sin(T0 * 40) * 0.02 * rt.scare;
  /* turning back: the drawing turns on the spot like a page flipping, instead of jumping to face the other way */
  let tsx = 1; if (rt.state === 'turn') tsx = Math.max(0.1, Math.abs(Math.cos(Math.PI * (rt.tp || 0))));
  const flip = isPath ? (pathDir !== 0 && pathDir !== face) : (moving && k !== 'spin' && k !== 'roll' && k !== 'phys' && rt.dir !== face);
  const peekLean = rt.state === 'peek' ? Math.sin((T0 - rt.st0) * 2.4) * 0.1 + 0.06 : 0;
  /* a soft shadow on the ground under anything off the ground, smaller and fainter the higher it is */
  if (['flap', 'hop', 'phys', 'bob'].includes(k) || isPath) {
    const gy = lifeGroundBelow(cx + ox, B[3] + Math.max(0, oy)), lift = gy - (B[3] + oy);
    if (lift > 2 && lift < 600) { const f = clamp(1 - lift / 400, 0.15, 1); c.save(); c.globalAlpha = 0.16 * f; c.fillStyle = '#1B2230'; c.beginPath(); c.ellipse(cx + ox, gy - 2, bw * 0.42 * (0.6 + 0.4 * f), Math.max(2, bh * 0.08 * f), 0, 0, 6.2832); c.fill(); c.restore(); }
  }
  /* a hard landing or a bounce squashes the body a little along the hit, then it springs back */
  if (rt.sq) { const d = rt.sqN || [0, 1], ang = Math.atan2(d[1], d[0]), q = rt.sq; c.translate(cx + ox, cy + oy); c.rotate(ang); c.scale(1 - 0.22 * q, 1 + 0.12 * q); c.rotate(-ang); c.translate(-cx - ox, -cy - oy); }
  c.save();
  if (rt.flinch) { const f = Math.sin(Math.min(1, rt.flinch) * Math.PI / 2), fd = rt.flinchDir || 1; c.translate(cx + fd * bw * 0.14 * f, B[3]); c.rotate(fd * 0.2 * f); c.scale(1 + 0.05 * f, 1 - (rt.flinchUp ? 0.22 : 0.08) * f); c.translate(-cx, -B[3]); }
  c.translate(px + ox, py + oy); c.scale(flip ? -tsx : tsx, 1); c.rotate(rot + peekLean * face); c.scale(sx, sy); c.translate(-px, -py);
  const gust = 0.65 + 0.35 * lifeNoise(t * 0.8, 4);
  /* shape deformation per point */
  const deform = (x, y) => {
    if (k === 'sway') { const u = clamp((B[3] - y) / Math.max(1, bh), 0, 1); const bend = Math.sin(t * 1.6 + u * 0.9) * bh * 0.1 * A * gust * u * u; return [x + bend + Math.sin(t * 9 + x * 0.13 + y * 0.07) * bh * 0.008 * A * u, y + Math.abs(bend) * 0.12 * u]; }
    if (k === 'flutter') { const v = clamp((face > 0 ? x - B[0] : B[2] - x) / Math.max(1, bw), 0, 1); return [x - face * Math.abs(Math.sin(v * TAU * 1.1 - t * 5)) * bw * 0.02 * v, y + Math.sin(v * TAU * 1.2 - t * 5.5 * (0.8 + 0.3 * gust)) * bh * 0.1 * A * gust * v]; }
    if (k === 'swim') { const v = clamp((face > 0 ? B[2] - x : x - B[0]) / Math.max(1, bw), 0, 1); return [x, y + Math.sin(v * TAU * 0.9 - t * 6) * bh * 0.14 * A * v * v * (0.6 + 0.4 * Math.min(1.4, vr))]; }
    if (k === 'walk4') {
      const fx = face > 0 ? (x - B[0]) / bw : (B[2] - x) / bw;
      if (!gait.strokes && y > gait.yz) {
        let lg = null; for (const g of gait.legs) if (x >= g.x0 && x <= g.x1) { lg = g; break; }
        if (lg) { const ph = gait.ph0 + lg.ph, phi = 0.38 * A * gait.a * Math.sin(ph), wt = clamp((y - gait.yz) / (0.3 * gait.L), 0, 1), th = -face * phi * wt, dx0 = x - lg.px, dy0 = y - gait.yz, lift = Math.max(0, Math.cos(ph)) * 0.12 * gait.L * wt * A * gait.a; return [lg.px + dx0 * Math.cos(th) - dy0 * Math.sin(th), gait.yz + dx0 * Math.sin(th) + dy0 * Math.cos(th) - lift]; }
      }
      /* the head nods with each step, the tail wags */
      if (fx > 0.72 && y < cy + bh * 0.1) return [x, y + Math.sin(gait.ph0 * 2) * bh * 0.025 * A * (fx - 0.72) / 0.28];
      if (fx < 0.12 && y < (gait.yz || cy)) { const wv = (0.12 - fx) / 0.12; return [x, y + Math.sin(t * 7) * bh * 0.08 * A * wv]; }
      return null;
    }
    if (k === 'flap') { const fl = (t % 3.4) < 2.3, d = (x - cx) / Math.max(1, bw / 2), side = Math.max(0, Math.abs(d) - 0.18), a = fl ? Math.sin(t * 9) : 0.3; return [x - Math.sign(d) * Math.abs(a) * side * bw * 0.04, y - a * bh * 0.45 * A * side]; }
    if (k === 'flicker') { const u = clamp((B[3] - y) / Math.max(1, bh), 0, 1); return [x + (Math.sin(t * 13 + y * 0.09) + Math.sin(t * 7.3 + y * 0.05)) * bw * 0.04 * A * u * u, y - Math.abs(Math.sin(t * 9 + x * 0.05)) * bh * 0.08 * A * u]; }
    if (k === 'breathe') { const u = clamp((B[3] - y) / Math.max(1, bh), 0, 1), mid = Math.exp(-Math.pow((u - 0.55) / 0.25, 2)); return [x + (x - cx) * Math.sin(t * 2.2) * 0.025 * A * mid, y]; }
    return null;
  };
  const wings = k === 'flap' ? (rt.wings || (rt.wings = lifeWings(it))) : [], wingSet = new Set(wings.map((q) => q.i));
  const legOf = new Map(); if (gait && gait.strokes) for (const g of gait.legs) legOf.set(g.i, g);
  const deforms = ['sway', 'flutter', 'swim', 'flicker', 'breathe', 'walk4'].includes(k) || (k === 'flap' && !wings.length);
  for (const q of it.pics || []) { const im = q.asset ? scSprite(q.asset) : q.url ? scSpriteUrl(q.url) : null; if (im) c.drawImage(im, q.x, q.y, q.w, q.h); }
  const inW = new Set(); (it.wheels || []).forEach((wl) => wl.i.forEach((i) => inW.add(i)));
  /* a drawn person flinching throws the arms up over the head */
  let armUp = null;
  if (rt.flinch > 0.02 && it.ink.length >= 4 && typeof ipRig === 'function') {
    if (rt.rig === undefined) { try { const rg = ipRig(it.ink); rt.rig = rg && rg.headC && rg.legs && rg.legs.filter(Boolean).length === 2 ? rg : null; } catch (e) { rt.rig = null; } }
    const R = rt.rig;
    if (R) { const Hd = Math.max(20, B[3] - B[1]), f = Math.sin(Math.min(1, rt.flinch) * Math.PI / 2), tx = (y) => R.neck[0] + (R.hip[0] - R.neck[0]) * clamp((y - R.neck[1]) / ((R.hip[1] - R.neck[1]) || 1), 0, 1);
      armUp = (x, y) => { if (y <= R.neck[1] || y >= R.hip[1] + 0.1 * Hd || Math.abs(x - tx(y)) <= 0.07 * Hd || Math.hypot(x - R.headC[0], y - R.headC[1]) <= R.headR * 1.2) return [x, y]; const left = x < tx(y), a = (left ? 1 : -1) * 1.9 * f, dx = x - R.sh[0], dy = y - R.sh[1], ca = Math.cos(a), sa = Math.sin(a); return [R.sh[0] + dx * ca - dy * sa, R.sh[1] + dx * sa + dy * ca]; }; }
  }
  const fc = ex ? lifeFaceParts(it, rt) : null, hide = new Set(fc ? (['laugh', 'surprise'].includes(ex) ? fc.eyes.concat([fc.mouth]) : [fc.mouth]).filter((q) => q != null) : []);
  /* the object's white, under it, when it moves as one piece (legs, wings or arms that swing leave it out) */
  if ((it.under || []).length && !legOf.size && !wingSet.size && !armUp) for (const u of it.under) { if (!deforms) { drawStroke(c, u); continue; } const p = u.p.slice(); for (let j = 0; j + 1 < p.length; j += 3) { const n = deform(p[j] / 10, p[j + 1] / 10); if (n) { p[j] = n[0] * 10; p[j + 1] = n[1] * 10; } } drawStroke(c, Object.assign({}, u, { p })); }
  it.ink.forEach((s, i) => {
    if (inW.has(i) || hide.has(i)) return;
    if (legOf.has(i)) { const g = legOf.get(i), ph = gait.ph0 + g.ph, th = -face * 0.38 * A * gait.a * Math.sin(ph), lift = Math.max(0, Math.cos(ph)) * 0.12 * gait.L * A * gait.a; c.save(); c.translate(g.px, g.top - lift * 0.5); c.rotate(th); c.translate(-g.px, -g.top); drawStroke(c, s); c.restore(); return; }
    if (wingSet.has(i)) { const wg = wings.find((q) => q.i === i), fl = (t % 3.4) < 2.3, a = -face * (fl ? Math.sin(t * 9) * 0.6 : -0.15) * A; c.save(); c.translate(wg.pv[0], wg.pv[1]); c.rotate(a); c.translate(-wg.pv[0], -wg.pv[1]); drawStroke(c, s); c.restore(); return; }
    if (armUp) { const p = s.p.slice(); for (let j = 0; j + 1 < p.length; j += 3) { let x = p[j] / 10, y = p[j + 1] / 10; if (deforms) { const n = deform(x, y); if (n) { x = n[0]; y = n[1]; } } const n2 = armUp(x, y); p[j] = n2[0] * 10; p[j + 1] = n2[1] * 10; } drawStroke(c, Object.assign({}, s, { p })); return; }
    if (!deforms) { drawStroke(c, s); return; }
    const p = s.p.slice(); for (let j = 0; j + 1 < p.length; j += 3) { const n = deform(p[j] / 10, p[j + 1] / 10); if (n) { p[j] = n[0] * 10; p[j + 1] = n[1] * 10; } }
    drawStroke(c, Object.assign({}, s, { p }));
  });
  if ((it.wheels || []).length) { for (const wl of it.wheels) { c.save(); c.translate(wl.cx, wl.cy); c.rotate((k === 'drive' || moving ? rt.dx * (flip ? -1 : 1) : T0 * 60) / Math.max(4, wl.r)); c.translate(-wl.cx, -wl.cy); wl.i.forEach((i) => it.ink[i] && drawStroke(c, it.ink[i])); c.restore(); } }
  if (fc) lifeExpr(c, it, rt, fc, ex, T0, face, A);
  c.restore();
  /* what the real thing would bring with it, drawn around the picture in the same light hand: sparks and smoke over a flame,
     bubbles from a fish, dust where feet land, exhaust and speed lines behind a car, pulse rings round a beating heart,
     wind through a tree, and a startled "!" with a drop of sweat when something rushes at it */
  if (b.fx !== 0) { c.setTransform(cap, 0, 0, cap, 0, 0); c.translate(-it.x, -it.y); lifeFx(c, it, rt, { k, t, T0, A, B, bw, bh, cx, cy, ox, oy, face: flip ? -face : face, moving, vr }); }
}

/* ----- faces: a drawn person can shout, talk, laugh, smile, be sad, cry, be surprised or angry; the drawn mouth (and for
   laughing or surprise the eyes) is redrawn by hand to match, eyebrows and tears and sound lines are added ----- */
const LIFE_EXPR = [['none', 'ปกติ'], ['shout', 'ตะโกน'], ['talk', 'พูด'], ['laugh', 'หัวเราะ'], ['happy', 'ยิ้ม ดีใจ'], ['sad', 'เศร้า'], ['cry', 'ร้องไห้'], ['surprise', 'ตกใจ'], ['angry', 'โกรธ']];
/* shouting comes in bursts, a few syllables at a time, with a breath between */
function lifeBurst(t) { const u = t % 2.3; return u < 1.35 ? 0.55 + 0.45 * Math.abs(Math.sin(u * 7.2)) : Math.max(0, 1 - (u - 1.35) * 6) * 0.3; }
function lifeFaceParts(it, rt) {
  if (rt.face !== undefined) return rt.face;
  let R = null; try { R = typeof ipRig === 'function' && it.ink.length >= 2 ? ipRig(it.ink) : null; } catch (e) { R = null; }
  if (!R || !R.headC) { /* a face drawn on its own: the biggest closed line is the head */
    let bi = -1, ba = 0; it.ink.forEach((s, i) => { const b = ipBox([s]), a = (b[2] - b[0]) * (b[3] - b[1]); if (a > ba) { ba = a; bi = i; } });
    if (bi < 0) return (rt.face = null); const b = ipBox([it.ink[bi]]); R = { headC: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], headR: Math.max(b[2] - b[0], b[3] - b[1]) / 2 };
  }
  const hc = R.headC, r = R.headR, parts = [];
  it.ink.forEach((s, i) => { const P = ipPts(s); if (!P.length) return; if (P.every((p) => Math.hypot(p[0] - hc[0], p[1] - hc[1]) < r * 0.92)) { const b = ipBox([s]); parts.push({ i, b, cy: (b[1] + b[3]) / 2, cx: (b[0] + b[2]) / 2 }); } });
  let mouth = null; for (const q of parts) if (q.cy > hc[1] + 0.12 * r && (!mouth || q.b[2] - q.b[0] > mouth.b[2] - mouth.b[0])) mouth = q;
  const eyes = parts.filter((q) => q !== mouth && q.cy < hc[1] + 0.12 * r);
  const mw = mouth ? Math.max(0.25 * r, mouth.b[2] - mouth.b[0]) : 0.55 * r, m = mouth ? [mouth.cx, mouth.cy] : [hc[0], hc[1] + 0.42 * r];
  const ep = eyes.length ? eyes.map((q) => [q.cx, q.cy]) : [[hc[0] - 0.35 * r, hc[1] - 0.12 * r], [hc[0] + 0.35 * r, hc[1] - 0.12 * r]];
  return (rt.face = { hc, r, mouth: mouth ? mouth.i : null, eyes: eyes.map((q) => q.i), m, mw, ep, ink: (it.ink[0] && it.ink[0].c) || '#2B3A67', lw: (it.ink[0] && it.ink[0].w) || 3 });
}
function lifeExpr(c, it, rt, F, ex, t, face, A) {
  const { hc, r, m, mw, ep } = F, ink = F.ink, lw = Math.max(1.6, F.lw * 0.9);
  c.save(); c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
  const line = (pts) => { c.beginPath(); pts.forEach((p, q) => (q ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); };
  const brows = (inner, outer) => { for (const e of ep) { const sd = e[0] < hc[0] ? -1 : 1, y = e[1] - 0.28 * r; line([[e[0] - sd * 0.02 * r, y + inner * r], [e[0] + sd * 0.24 * r, y + outer * r]]); } };
  const arc = (cx, cy, rx, ry, a0, a1, fill) => { c.beginPath(); c.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, a0, a1); if (fill) c.fill(); else c.stroke(); };
  if (ex === 'shout') {
    const bu = lifeBurst(t), open = 0.26 + 0.44 * bu;
    arc(m[0], m[1] + 0.04 * r, mw * 0.42 * (1 + 0.2 * bu), r * open * 0.42, 0, 6.2832, true);
    if (open > 0.3) { c.fillStyle = 'rgba(214,92,92,0.9)'; arc(m[0], m[1] + 0.04 * r + r * open * 0.24, mw * 0.24, r * open * 0.14, 0, 6.2832, true); c.fillStyle = ink; }
    brows(0.1, -0.06);
    /* the voice going out in front of the mouth */
    c.globalAlpha = 0.25 + 0.6 * bu; const ox = m[0] + face * (mw * 0.5 + 0.25 * r);
    for (let q = 0; q < 3; q++) { const ph = ((t * 2.2 + q / 3) % 1), rr = r * (0.3 + 0.9 * ph); c.globalAlpha = (0.2 + 0.7 * bu) * (1 - ph); c.beginPath(); c.arc(ox, m[1], rr, face > 0 ? -0.6 : Math.PI - 0.6, face > 0 ? 0.6 : Math.PI + 0.6); c.stroke(); }
  } else if (ex === 'talk') {
    const o = (Math.sin(t * 1.4) > -0.4 ? Math.abs(Math.sin(t * 9.5)) : 0) * 0.22 + 0.04;
    arc(m[0], m[1], mw * 0.32, r * o * 0.45, 0, 6.2832, true);
  } else if (ex === 'laugh') {
    const o = 0.3 + 0.12 * Math.abs(Math.sin(t * 15));
    c.beginPath(); c.moveTo(m[0] - mw * 0.5, m[1] - 0.04 * r); c.quadraticCurveTo(m[0], m[1] + r * o * 1.4, m[0] + mw * 0.5, m[1] - 0.04 * r); c.closePath(); c.fill();
    for (const e of ep) arc(e[0], e[1] + 0.05 * r, 0.14 * r, 0.12 * r, Math.PI * 1.1, Math.PI * 1.9);
    c.globalAlpha = 0.7; c.font = Math.round(r * 0.5) + 'px sans-serif'; c.fillText('ฮ่า', hc[0] + face * r * 1.15, hc[1] - r * (0.6 + 0.15 * Math.sin(t * 6)));
  } else if (ex === 'happy') {
    c.beginPath(); c.moveTo(m[0] - mw * 0.55, m[1] - 0.06 * r); c.quadraticCurveTo(m[0], m[1] + 0.32 * r, m[0] + mw * 0.55, m[1] - 0.06 * r); c.stroke();
    c.fillStyle = 'rgba(240,120,140,0.35)'; for (const e of ep) arc(e[0] + (e[0] < hc[0] ? -0.08 : 0.08) * r, e[1] + 0.3 * r, 0.13 * r, 0.08 * r, 0, 6.2832, true);
  } else if (ex === 'sad' || ex === 'cry') {
    c.beginPath(); c.moveTo(m[0] - mw * 0.45, m[1] + 0.1 * r); c.quadraticCurveTo(m[0], m[1] - 0.16 * r, m[0] + mw * 0.45, m[1] + 0.1 * r); c.stroke();
    brows(-0.08, 0.06);
    if (ex === 'cry') { c.fillStyle = 'rgba(70,140,225,0.85)'; for (const [q, e] of ep.entries()) { const u = ((t * 0.9 + q * 0.45) % 1), x = e[0] + (e[0] < hc[0] ? -0.04 : 0.04) * r, y = e[1] + 0.12 * r + u * 0.9 * r, d = 0.06 * r; c.globalAlpha = 1 - u * 0.7; c.beginPath(); c.moveTo(x, y - d * 1.8); c.quadraticCurveTo(x + d, y, x, y + d * 0.7); c.quadraticCurveTo(x - d, y, x, y - d * 1.8); c.fill(); } }
  } else if (ex === 'surprise') {
    arc(m[0], m[1] + 0.02 * r, 0.13 * r, 0.2 * r, 0, 6.2832);
    for (const e of ep) { arc(e[0], e[1], 0.13 * r, 0.15 * r, 0, 6.2832); arc(e[0], e[1], 0.04 * r, 0.04 * r, 0, 6.2832, true); }
    brows(-0.14, -0.14);
    c.globalAlpha = (t % 3.2) < 1.2 ? 1 : 0.4; line([[hc[0] + face * r * 1.1, hc[1] - r * 1.05], [hc[0] + face * r * 1.1, hc[1] - r * 0.7]]); arc(hc[0] + face * r * 1.1, hc[1] - r * 0.55, lw * 0.6, lw * 0.6, 0, 6.2832, true);
  } else if (ex === 'angry') {
    line([[m[0] - mw * 0.4, m[1] + 0.02 * r], [m[0] - mw * 0.13, m[1] - 0.03 * r], [m[0] + mw * 0.13, m[1] + 0.03 * r], [m[0] + mw * 0.4, m[1] - 0.02 * r]]);
    brows(0.12, -0.1);
    c.strokeStyle = 'rgba(107,114,128,0.5)'; for (let q = 0; q < 2; q++) { const u = (t * 0.8 + q * 0.5) % 1, x = hc[0] + (q ? 1 : -1) * r * 0.75, y = hc[1] - r * (1 + u * 0.8); c.globalAlpha = 1 - u; arc(x, y, r * (0.12 + u * 0.15), r * (0.1 + u * 0.12), 0, 6.2832); }
  }
  c.restore();
}
/* ----- effects any picture can carry, so whatever it is and whatever it is asked to do looks real: the sound it makes
   (sound lines, the sound word, its mouth opening), music notes, sleep, love, dizziness, heat and cold, water, smoke, fire,
   light, sparkle, wind, rain, snow, falling leaves, speed, thought. Each sits at an anchor on the picture: front, top,
   back, bottom, centre, mouth, or a point [u, v] in its box (0 to 1 from its drawn left and top), and turns with it ----- */
const LIFE_FX = ['sound', 'say', 'mouth', 'notes', 'zzz', 'hearts', 'stars', 'sweat', 'tears', 'steam', 'smoke', 'fire', 'sparks', 'drops', 'splash', 'glow', 'shine', 'wind', 'rain', 'snow', 'leaves', 'speed', 'question', 'exclaim', 'bolt', 'bubbles', 'dust', 'shake'];
function lifeAnchor(it, rt, o, at) {
  const { B, bw, bh, ox, oy, face } = o, d = (it.beh && it.beh.face) || 1;
  let u = 0.5, v = 0.5;
  if (Array.isArray(at)) { u = clamp(+at[0] || 0, -0.5, 1.5); v = clamp(+at[1] || 0, -0.5, 1.5); }
  else if (at === 'front') { u = d > 0 ? 0.92 : 0.08; v = 0.35; } else if (at === 'back') { u = d > 0 ? 0.05 : 0.95; v = 0.5; }
  else if (at === 'top') { u = 0.5; v = 0; } else if (at === 'bottom') { u = 0.5; v = 1; }
  else if (at === 'mouth') { const F = lifeFaceParts(it, rt); if (F && F.mouth != null) return [F.m[0] + ox, F.m[1] + oy, F.r * 0.8]; u = d > 0 ? 0.9 : 0.1; v = 0.3; }
  /* the picture may be drawn facing one way and now facing the other */
  if (face !== d) u = 1 - u;
  return [B[0] + u * bw + ox, B[1] + v * bh + oy, clamp(Math.max(bw, bh) * 0.12, 6, 40)];
}
function lifeFxOne(c, it, rt, o, f, P, emit) {
  const ty = LIFE_FX.includes(f.type) ? f.type : null; if (!ty) return;
  const { T0, bw, bh, face } = o, [ax, ay, ar] = lifeAnchor(it, rt, o, f.at || (['sound', 'say', 'mouth', 'notes'].includes(ty) ? 'mouth' : ['zzz', 'hearts', 'stars', 'question', 'exclaim', 'steam', 'sweat', 'bolt'].includes(ty) ? 'top' : ['dust', 'splash'].includes(ty) ? 'bottom' : ['speed'].includes(ty) ? 'back' : 'center'));
  const sz = Math.max(8, Math.max(bw, bh)), R = Math.random, col = f.color && /^#[0-9a-f]{6}$/i.test(f.color) ? f.color : null, ink = '#2B3A67';
  /* sounds come in bursts: a bark, a honk, a call, then a pause */
  const burst = (T0 * (f.rate || 1)) % 1.6 < 0.9 ? Math.abs(Math.sin(((T0 * (f.rate || 1)) % 1.6) * 7)) : 0;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  const key = 'fx' + ty + (f.at || '');
  const em = (rate, make) => { rt[key] = (rt[key] || 0) + rate * clamp(T0 - (rt[key + 't'] == null ? T0 : rt[key + 't']), 0, 0.1); rt[key + 't'] = T0; while (rt[key] >= 1) { rt[key] -= 1; if (P.length < 90) P.push(Object.assign({ age: 0 }, make())); } };
  if (ty === 'sound') { c.strokeStyle = col || ink; c.lineWidth = 2; for (let q = 0; q < 3; q++) { const ph = ((T0 * 2.2 + q / 3) % 1), rr = ar * (0.4 + 1.6 * ph); c.globalAlpha = (0.15 + 0.75 * burst) * (1 - ph); c.beginPath(); c.arc(ax, ay, rr, face > 0 ? -0.6 : Math.PI - 0.6, face > 0 ? 0.6 : Math.PI + 0.6); c.stroke(); } }
  else if (ty === 'say') { const tx = String(f.text || '').slice(0, 10); if (tx && burst > 0.2) { const fs = clamp(sz * 0.18, 12, 40); c.globalAlpha = Math.min(1, burst * 1.3); c.font = '700 ' + Math.round(fs * (0.9 + 0.2 * burst)) + 'px sans-serif'; c.fillStyle = col || ink; c.textAlign = face > 0 ? 'left' : 'right'; c.fillText(tx, ax + face * ar * 0.9, ay - ar * 0.6); } }
  else if (ty === 'mouth') { const op = 0.15 + 0.85 * burst; c.fillStyle = '#1F2533'; c.globalAlpha = 0.9; c.beginPath(); c.ellipse(ax, ay, ar * 0.45, Math.max(1, ar * 0.32 * op), 0, 0, 6.2832); c.fill(); if (op > 0.5) { c.fillStyle = 'rgba(214,92,92,0.9)'; c.beginPath(); c.ellipse(ax, ay + ar * 0.12 * op, ar * 0.25, ar * 0.1 * op, 0, 0, 6.2832); c.fill(); } }
  else if (ty === 'notes') em(1.4 * (f.rate || 1), () => ({ ty: 'note', x: ax + face * ar * 0.5, y: ay - ar * 0.3, vx: face * (10 + R() * 12), vy: -(18 + R() * 10), life: 2, r: clamp(sz * 0.07, 5, 16), col: col || ink }));
  else if (ty === 'zzz') em(0.9, () => ({ ty: 'z', x: ax + face * ar * 0.4, y: ay - 4, vx: face * 10, vy: -16, life: 2.4, r: clamp(sz * 0.08, 6, 18), col: col || ink }));
  else if (ty === 'hearts') em(1.1, () => ({ ty: 'heart', x: ax + (R() - 0.5) * ar * 2, y: ay - 4, vx: (R() - 0.5) * 10, vy: -(16 + R() * 10), life: 1.8, r: clamp(sz * 0.06, 5, 14), col: col || '#D9405A' }));
  else if (ty === 'stars') { c.fillStyle = col || '#E0A526'; c.strokeStyle = col || '#E0A526'; c.lineWidth = 1.6; for (let q = 0; q < 3; q++) { const a = T0 * 3 + q * 2.094, x = ax + Math.cos(a) * ar * 1.2, y = ay - ar * 0.5 + Math.sin(a) * ar * 0.35, r = clamp(sz * 0.04, 4, 10); c.globalAlpha = 0.6 + 0.4 * Math.sin(a); c.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.45 : r, an = k * Math.PI / 5 - Math.PI / 2; c.lineTo(x + rr * Math.cos(an), y + rr * Math.sin(an)); } c.closePath(); c.fill(); } }
  else if (ty === 'sweat' || ty === 'tears') em(ty === 'tears' ? 1.6 : 0.8, () => ({ ty: 'drop', x: ax + (ty === 'sweat' ? face * ar * 0.6 : (R() - 0.5) * ar * 0.6), y: ay + (ty === 'sweat' ? 0 : ar * 0.2), vx: 0, vy: ty === 'tears' ? 30 : 12, g: 1, life: 1.1, r: clamp(sz * 0.035, 3, 8), col: col || 'rgba(70,140,225,0.85)' }));
  else if (ty === 'steam' || ty === 'smoke') em(ty === 'steam' ? 1.5 : 2, () => ({ ty: 'smoke', x: ax + (R() - 0.5) * ar * 0.6, y: ay, vx: (R() - 0.5) * 10, vy: -(20 + R() * 10), life: 2.2, r: clamp(sz * 0.05, 4, 14) }));
  else if (ty === 'fire') { em(8, () => ({ ty: 'ember', x: ax + (R() - 0.5) * ar, y: ay, vx: (R() - 0.5) * 16, vy: -(40 + R() * 40), life: 0.8 + R() * 0.5, r: 1.3 + R() * 1.5 })); c.globalAlpha = 0.85; for (let q = 0; q < 3; q++) { const fx0 = ax + (q - 1) * ar * 0.35, hh = ar * (0.9 + 0.35 * Math.sin(T0 * 11 + q * 2)); c.fillStyle = q === 1 ? '#F4A23B' : '#D9602A'; c.beginPath(); c.moveTo(fx0 - ar * 0.22, ay); c.quadraticCurveTo(fx0 - ar * 0.25, ay - hh * 0.5, fx0 + Math.sin(T0 * 9 + q) * ar * 0.08, ay - hh); c.quadraticCurveTo(fx0 + ar * 0.25, ay - hh * 0.5, fx0 + ar * 0.22, ay); c.closePath(); c.fill(); } }
  else if (ty === 'sparks') em(10, () => { const a = R() * 6.283, sp = 40 + R() * 60; return { ty: 'ember', x: ax, y: ay, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, r: 1.2 + R() }; });
  else if (ty === 'drops' || ty === 'splash') em(ty === 'splash' ? 6 : 2, () => ({ ty: 'drop', x: ax + (R() - 0.5) * ar, y: ay, vx: ty === 'splash' ? (R() - 0.5) * 80 : 0, vy: ty === 'splash' ? -(40 + R() * 40) : 20, g: 1, life: ty === 'splash' ? 0.7 : 1.2, r: clamp(sz * 0.03, 2.5, 7), col: col || 'rgba(70,140,225,0.85)' }));
  else if (ty === 'glow') { const g = c.createRadialGradient(ax, ay, 0, ax, ay, sz * 0.9), a = 0.22 + 0.06 * Math.sin(T0 * 3); const cc = col || '#FFD25A'; g.addColorStop(0, cc + Math.round(a * 255).toString(16).padStart(2, '0')); g.addColorStop(1, cc + '00'); c.fillStyle = g; c.fillRect(ax - sz, ay - sz, sz * 2, sz * 2); }
  else if (ty === 'shine') { const ph = (T0 * 0.7) % 1; if (ph < 0.35) { const k = Math.sin(Math.PI * ph / 0.35), r = clamp(sz * 0.08, 5, 16) * k; c.strokeStyle = col || '#E0A526'; c.lineWidth = 2; c.globalAlpha = k; c.beginPath(); c.moveTo(ax - r, ay); c.lineTo(ax + r, ay); c.moveTo(ax, ay - r); c.lineTo(ax, ay + r); c.moveTo(ax - r * 0.5, ay - r * 0.5); c.lineTo(ax + r * 0.5, ay + r * 0.5); c.moveTo(ax + r * 0.5, ay - r * 0.5); c.lineTo(ax - r * 0.5, ay + r * 0.5); c.stroke(); } }
  else if (ty === 'wind') em(1.2, () => ({ ty: 'wind', x: ax - sz * 0.8, y: ay + (R() - 0.5) * sz * 0.8, vx: 70 + R() * 30, vy: 0, life: 1.3, r: sz * 0.25 }));
  else if (ty === 'rain' || ty === 'snow') em(ty === 'rain' ? 14 : 6, () => ({ ty: ty === 'rain' ? 'rain' : 'flake', x: ax + (R() - 0.5) * sz * 1.4, y: ay - sz * 0.6, vx: ty === 'snow' ? (R() - 0.5) * 12 : -10, vy: ty === 'rain' ? 220 : 30, life: ty === 'rain' ? 0.6 : 2.4, r: ty === 'rain' ? 8 : 2.5, col: col }));
  else if (ty === 'leaves') em(0.8, () => ({ ty: 'leaf', x: ax + (R() - 0.5) * sz * 0.8, y: ay - sz * 0.2, vx: 14 + R() * 10, vy: 22 + R() * 10, life: 3, r: clamp(sz * 0.05, 4, 10), col: col || (R() < 0.5 ? '#C9822B' : '#7FA14A') }));
  else if (ty === 'speed') { c.strokeStyle = col || ink; c.lineWidth = 1.6; for (let q = 0; q < 3; q++) { const yy = ay + (q - 1) * bh * 0.2, L = bw * (0.25 + 0.1 * Math.sin(T0 * 9 + q)); c.globalAlpha = 0.35; c.beginPath(); c.moveTo(ax - face * 6, yy); c.lineTo(ax - face * (6 + L), yy); c.stroke(); } }
  else if (ty === 'question' || ty === 'exclaim') { const fs = clamp(sz * 0.22, 14, 44); c.globalAlpha = 0.65 + 0.35 * Math.sin(T0 * 4); c.fillStyle = col || ink; c.font = '700 ' + Math.round(fs) + 'px sans-serif'; c.textAlign = 'center'; c.fillText(ty === 'question' ? '?' : '!', ax + face * ar * 0.6, ay - 6 - Math.abs(Math.sin(T0 * 3)) * 4); }
  else if (ty === 'bolt') { if ((T0 % 2.6) < 0.25) { c.strokeStyle = col || '#E0A526'; c.lineWidth = 3; const h = sz * 0.6; c.beginPath(); c.moveTo(ax, ay - h); c.lineTo(ax - h * 0.15, ay - h * 0.45); c.lineTo(ax + h * 0.1, ay - h * 0.4); c.lineTo(ax - h * 0.05, ay); c.stroke(); } }
  else if (ty === 'bubbles') em(1.2, () => ({ ty: 'bubble', x: ax, y: ay, vx: face * 6, vy: -26 - R() * 12, life: 2.2, r: 1.6 + R() * 3 }));
  else if (ty === 'dust') em(2.5, () => ({ ty: 'dust', x: ax + (R() - 0.5) * bw * 0.6, y: ay - 1, vx: (R() - 0.5) * 40, vy: -(6 + R() * 10), life: 0.6, r: clamp(sz * 0.03, 3, 8) }));
  else if (ty === 'shake') { if ((T0 % 2.4) < 1.3) { c.strokeStyle = col || ink; c.lineWidth = 1.8; c.globalAlpha = 0.45; for (const sd of [-1, 1]) for (let q = 0; q < 2; q++) { c.beginPath(); c.arc(ax + sd * (bw * 0.5 + 6 + q * 7), ay, bh * (0.2 + q * 0.1), sd > 0 ? -0.6 : Math.PI - 0.6, sd > 0 ? 0.6 : Math.PI + 0.6); c.stroke(); } } }
  c.restore();
}
/* ----- extra touches that make a moving picture feel real (see lifeDraw): small particles living for a moment ----- */
function lifeFx(c, it, rt, o) {
  const { k, t, T0, A, B, bw, bh, cx, cy, ox, oy, face, moving, vr } = o;
  const now0 = T0, dt = clamp(now0 - (rt.fxT == null ? now0 : rt.fxT), 0, 0.1); rt.fxT = now0;
  const P = rt.fx || (rt.fx = []), X = cx + ox, Y = cy + oy, top = B[1] + oy, bot = B[3] + oy, sz = Math.max(bw, bh), u0 = Math.max(4, sz / 40);
  const emit = (rate, make) => { rt['fxa' + k] = (rt['fxa' + k] || 0) + rate * dt; while (rt['fxa' + k] >= 1) { rt['fxa' + k] -= 1; if (P.length < 80) P.push(Object.assign({ age: 0 }, make())); } };
  const R = Math.random;
  if (k === 'flicker') {
    /* a warm glow on the paper, embers rising and a thin smoke over the tip */
    const gl = 0.16 + 0.05 * Math.sin(t * 13) + 0.03 * Math.sin(t * 7.7), g = c.createRadialGradient(X, bot - bh * 0.35, 0, X, bot - bh * 0.35, sz * 0.95);
    g.addColorStop(0, 'rgba(255,170,70,' + gl.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,170,70,0)'); c.fillStyle = g; c.fillRect(X - sz, bot - bh * 0.35 - sz, sz * 2, sz * 2);
    emit(7 * A, () => ({ ty: 'ember', x: X + (R() - 0.5) * bw * 0.4, y: top + bh * 0.15, vx: (R() - 0.5) * 18, vy: -(40 + R() * 40) * Math.max(0.6, u0 / 6), life: 0.9 + R() * 0.6, r: 1.2 + R() * 1.4 }));
    emit(1.6, () => ({ ty: 'smoke', x: X + (R() - 0.5) * bw * 0.15, y: top, vx: (R() - 0.5) * 8, vy: -22 - R() * 10, life: 2.4, r: u0 * 1.2 }));
  } else if (k === 'swim') {
    emit(0.9, () => ({ ty: 'bubble', x: X + face * bw * 0.46, y: Y - bh * 0.12, vx: face * 6, vy: -26 - R() * 12, life: 2.2 + R(), r: 1.6 + R() * 2.4 * Math.max(1, u0 / 6) }));
  } else if (k === 'drive' && moving) {
    emit(2.6 * Math.max(0.3, vr), () => ({ ty: 'puff', x: X - face * bw * 0.52, y: bot - bh * 0.18, vx: -face * (14 + R() * 10), vy: -6 - R() * 8, life: 0.9, r: u0 * 0.9 }));
    if (vr > 0.55) { c.save(); c.strokeStyle = 'rgba(43,58,103,' + (0.22 * Math.min(1, vr - 0.4)).toFixed(3) + ')'; c.lineWidth = 1.6; c.lineCap = 'round'; for (let q = 0; q < 3; q++) { const yy = top + bh * (0.3 + q * 0.18), x0 = X - face * (bw * 0.58 + (q % 2) * 8), L = bw * (0.18 + 0.08 * Math.sin(t * 9 + q)); c.beginPath(); c.moveTo(x0, yy); c.lineTo(x0 - face * L, yy); c.stroke(); } c.restore(); }
  } else if (k === 'hop') {
    const u = (rt.hp == null ? T0 / 0.95 : rt.hp) % 1;
    if (rt.fxU != null && u < rt.fxU) for (let q = 0; q < 6; q++) { const sd = q % 2 ? 1 : -1; P.push({ ty: 'dust', x: X + sd * bw * (0.25 + R() * 0.15), y: B[3] + (rt.gy || 0) - 1, vx: sd * (20 + R() * 25), vy: -(8 + R() * 10), life: 0.5, r: u0 * 0.7, age: 0 }); }
    rt.fxU = u;
  } else if ((k === 'roll' || k === 'walk4') && moving) {
    emit((k === 'roll' ? 3 : 1.6) * Math.max(0.3, vr), () => ({ ty: 'dust', x: X - face * bw * 0.3, y: B[3] + (rt.gy || 0) - 1, vx: -face * (10 + R() * 12), vy: -(4 + R() * 8), life: 0.45, r: u0 * 0.55 }));
  } else if (k === 'flap') {
    if ((t % 3.4) < 2.3) emit(2.2, () => ({ ty: 'air', x: X - face * bw * 0.45, y: Y + (R() - 0.5) * bh * 0.5, vx: -face * 40, vy: 0, life: 0.45, r: bw * 0.16 }));
  } else if (k === 'beat') {
    const u = (T0 % 1.05) / 1.05;
    if (rt.fxU != null && rt.fxU < 0.12 && u >= 0.12) P.push({ ty: 'ring', x: X, y: Y, vx: 0, vy: 0, life: 0.7, r: sz * 0.5, age: 0 });
    rt.fxU = u;
  } else if (k === 'shake') {
    if ((t % 2.4) < 1.3) { c.save(); c.strokeStyle = 'rgba(43,58,103,0.45)'; c.lineWidth = 1.8; c.lineCap = 'round'; const j = Math.sin(t * 40) > 0 ? 1 : 0; for (const sd of [-1, 1]) for (let q = 0; q < 2; q++) { const rr = bh * (0.22 + q * 0.12); c.beginPath(); c.arc(X + sd * (bw * 0.5 + 6 + q * 7 + j), Y - bh * 0.1, rr, sd > 0 ? -0.6 : Math.PI - 0.6, sd > 0 ? 0.6 : Math.PI + 0.6); c.stroke(); } c.restore(); }
  } else if (k === 'sway' || k === 'flutter') {
    emit(0.45, () => ({ ty: 'wind', x: B[0] - bw * 0.2, y: top + bh * (0.15 + R() * 0.5), vx: 60 + R() * 30, vy: 0, life: 1.4, r: bw * 0.22 }));
  } else if (k === 'spin') {
    c.save(); c.strokeStyle = 'rgba(43,58,103,0.25)'; c.lineWidth = 1.8; c.lineCap = 'round'; const rr = sz * 0.62, a0 = T0 * 2.2 * face; for (let q = 0; q < 2; q++) { c.beginPath(); c.arc(X, Y, rr, a0 + q * Math.PI - face * 0.9, a0 + q * Math.PI, face < 0); c.stroke(); } c.restore();
  } else if (k === 'wiggle') {
    emit(0.5, () => ({ ty: 'spark', x: X + (R() - 0.5) * bw * 1.1, y: top + R() * bh * 0.4, vx: 0, vy: -10, life: 0.9, r: u0 * 0.9 }));
  }
  /* whatever else the teacher's words call for, anchored on the picture (see lifeFxList) */
  if (Array.isArray(it.beh.fx)) for (const f of it.beh.fx.slice(0, 6)) lifeFxOne(c, it, rt, o, f, P, emit);
  /* feelings: startled by something rushing at it */
  const fr = Math.max(rt.flinch || 0, (rt.scare || 0) * 0.8);
  if (fr > 0.15 && k !== 'phys') {
    c.save(); c.globalAlpha = Math.min(1, fr * 1.4); c.strokeStyle = '#2B3A67'; c.fillStyle = '#2B3A67'; c.lineWidth = 2; c.lineCap = 'round';
    const hx = X, hy = top - Math.max(10, bh * 0.12);
    for (const a of [-0.5, 0, 0.5]) { const L = Math.max(8, bh * 0.12); c.beginPath(); c.moveTo(hx + Math.sin(a) * L * 0.6, hy - Math.cos(a) * L * 0.6); c.lineTo(hx + Math.sin(a) * L * 1.5, hy - Math.cos(a) * L * 1.5); c.stroke(); }
    const sx0 = X + face * bw * 0.32, sy0 = top + bh * 0.12, d = Math.max(3, bh * 0.05); c.fillStyle = 'rgba(80,150,230,0.85)'; c.beginPath(); c.moveTo(sx0, sy0 - d * 1.6); c.quadraticCurveTo(sx0 + d, sy0, sx0, sy0 + d * 0.6); c.quadraticCurveTo(sx0 - d, sy0, sx0, sy0 - d * 1.6); c.fill();
    c.restore();
  }
  /* move and draw the particles */
  for (let q = P.length - 1; q >= 0; q--) {
    const p = P[q]; p.age += dt; if (p.age >= p.life) { P.splice(q, 1); continue; }
    const f = p.age / p.life; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.ty === 'bubble') p.x += Math.sin((p.age + q) * 6) * 0.4;
    if (p.ty === 'dust') p.vy += 60 * dt;
    c.save();
    if (p.ty === 'ember') { c.globalAlpha = (1 - f) * 0.9; c.fillStyle = f < 0.4 ? '#F4A23B' : '#D9602A'; c.beginPath(); c.arc(p.x + Math.sin(p.age * 9 + q) * 2, p.y, p.r * (1 - f * 0.5), 0, 6.2832); c.fill(); }
    else if (p.ty === 'smoke') { c.globalAlpha = 0.08 * Math.sin(Math.PI * f); c.fillStyle = '#6B7280'; c.beginPath(); c.arc(p.x + Math.sin(p.age * 2 + q) * 5, p.y, p.r * (1 + f * 2.8), 0, 6.2832); c.fill(); }
    else if (p.ty === 'bubble') { c.globalAlpha = 0.75 * (1 - f * 0.6); c.strokeStyle = '#3B82C4'; c.lineWidth = 1.3; c.beginPath(); c.arc(p.x, p.y, p.r * (1 + f * 0.4), 0, 6.2832); c.stroke(); c.beginPath(); c.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, 6.2832); c.stroke(); }
    else if (p.ty === 'puff' || p.ty === 'dust') { c.globalAlpha = (p.ty === 'puff' ? 0.28 : 0.35) * (1 - f); c.strokeStyle = '#6B7280'; c.lineWidth = 1.4; c.beginPath(); c.arc(p.x, p.y, p.r * (1 + f * (p.ty === 'puff' ? 1.6 : 0.8)), 0, 6.2832); c.stroke(); }
    else if (p.ty === 'air' || p.ty === 'wind') { c.globalAlpha = (p.ty === 'air' ? 0.35 : 0.22) * Math.sin(Math.PI * f); c.strokeStyle = '#2B3A67'; c.lineWidth = 1.5; c.lineCap = 'round'; const dir = Math.sign(p.vx) || 1; c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(p.x - dir * p.r * 0.5, p.y - p.r * 0.18, p.x - dir * p.r, p.y); c.stroke(); }
    else if (p.ty === 'ring') { c.globalAlpha = 0.4 * (1 - f); c.strokeStyle = '#C8323C'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, p.r * (1 + f * 0.7), 0, 6.2832); c.stroke(); }
    else if (p.ty === 'note') { c.globalAlpha = Math.sin(Math.PI * f); c.fillStyle = p.col; c.strokeStyle = p.col; c.lineWidth = Math.max(1.2, p.r * 0.18); c.beginPath(); c.ellipse(p.x, p.y, p.r * 0.45, p.r * 0.33, -0.4, 0, 6.2832); c.fill(); c.beginPath(); c.moveTo(p.x + p.r * 0.4, p.y); c.lineTo(p.x + p.r * 0.4, p.y - p.r * 1.3); c.quadraticCurveTo(p.x + p.r * 0.9, p.y - p.r * 1.1, p.x + p.r * 0.9, p.y - p.r * 0.7); c.stroke(); }
    else if (p.ty === 'z') { c.globalAlpha = Math.sin(Math.PI * f) * 0.9; c.fillStyle = p.col; c.font = '700 ' + Math.round(p.r * (1 + f)) + 'px sans-serif'; c.fillText('z', p.x, p.y); }
    else if (p.ty === 'heart') { c.globalAlpha = Math.sin(Math.PI * f); c.fillStyle = p.col; const r = p.r; c.beginPath(); c.moveTo(p.x, p.y + r * 0.8); c.bezierCurveTo(p.x - r * 1.4, p.y - r * 0.2, p.x - r * 0.6, p.y - r * 1.2, p.x, p.y - r * 0.4); c.bezierCurveTo(p.x + r * 0.6, p.y - r * 1.2, p.x + r * 1.4, p.y - r * 0.2, p.x, p.y + r * 0.8); c.fill(); }
    else if (p.ty === 'drop') { if (p.g) p.vy += 160 * dt; c.globalAlpha = 1 - f * 0.7; c.fillStyle = p.col; const d = p.r; c.beginPath(); c.moveTo(p.x, p.y - d * 1.8); c.quadraticCurveTo(p.x + d, p.y, p.x, p.y + d * 0.7); c.quadraticCurveTo(p.x - d, p.y, p.x, p.y - d * 1.8); c.fill(); }
    else if (p.ty === 'rain') { c.globalAlpha = 0.5; c.strokeStyle = p.col || '#4C8FD6'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 2, p.y + p.r); c.stroke(); }
    else if (p.ty === 'flake') { c.globalAlpha = 0.85 * (1 - f * 0.5); c.strokeStyle = p.col || '#7FA7D9'; c.lineWidth = 1.2; const r = p.r; for (let a = 0; a < 3; a++) { const an = a * 1.047; c.beginPath(); c.moveTo(p.x - r * Math.cos(an), p.y - r * Math.sin(an)); c.lineTo(p.x + r * Math.cos(an), p.y + r * Math.sin(an)); c.stroke(); } p.x += Math.sin(p.age * 3 + q) * 0.4; }
    else if (p.ty === 'leaf') { c.globalAlpha = 1 - f * 0.6; c.fillStyle = p.col; c.translate(p.x + Math.sin(p.age * 3 + q) * 8, p.y); c.rotate(p.age * 2 + q); c.beginPath(); c.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, 6.2832); c.fill(); }
    else if (p.ty === 'spark') { c.globalAlpha = Math.sin(Math.PI * f) * 0.8; c.strokeStyle = '#E0A526'; c.lineWidth = 1.5; c.lineCap = 'round'; const r = p.r * (0.6 + 0.4 * Math.sin(Math.PI * f)); c.beginPath(); c.moveTo(p.x - r, p.y); c.lineTo(p.x + r, p.y); c.moveTo(p.x, p.y - r); c.lineTo(p.x, p.y + r); c.stroke(); }
    c.restore();
  }
}
/* ----- a path the AI wrote for any movement the teacher described: key frames of offset, turn and size, eased between ----- */
function lifePathAt(it, t) {
  const P = it.beh.path || {}, K = (Array.isArray(P.keys) ? P.keys : []).map((k) => ({ t: Math.max(0, +k.t || 0), dx: +k.dx || 0, dy: +k.dy || 0, rot: (+k.rot || 0) * Math.PI / 180, s: clamp(+k.scale || +k.s || 1, 0.1, 5) })).sort((a, b) => a.t - b.t);
  if (!K.length) return { dx: 0, dy: 0, rot: 0, s: 1 };
  if (K[0].t > 0) K.unshift({ t: 0, dx: 0, dy: 0, rot: 0, s: 1 });
  const dur = Math.max(0.2, K[K.length - 1].t);
  let u = P.loop === false ? Math.min(t, dur) : t % dur;
  let i = 0; while (i < K.length - 2 && u > K[i + 1].t) i++;
  const n = K.length, loop = P.loop !== false, at = (j) => K[loop ? (j + n - 1) % (n - 1) : clamp(j, 0, n - 1)] || K[clamp(j, 0, n - 1)];
  const a = K[i], b = K[Math.min(i + 1, n - 1)], q = b.t > a.t ? clamp((u - a.t) / (b.t - a.t), 0, 1) : 1;
  /* the path passes through every key with a continuous speed (Catmull-Rom), only the very ends ease in and out */
  const p0 = i > 0 ? K[i - 1] : (loop && n > 2 ? at(n - 2) : a), p3 = i + 2 < n ? K[i + 2] : (loop && n > 2 ? K[1] : b);
  const cr = (k) => { const v0 = p0[k], v1 = a[k], v2 = b[k], v3 = p3[k]; return 0.5 * (2 * v1 + (-v0 + v2) * q + (2 * v0 - 5 * v1 + 4 * v2 - v3) * q * q + (-v0 + 3 * v1 - 3 * v2 + v3) * q * q * q); };
  const e = q * q * (3 - 2 * q);
  return { dx: cr('dx'), dy: cr('dy'), rot: a.rot + (b.rot - a.rot) * e, s: a.s + (b.s - a.s) * e };
}

/* the top of the nearest line or box under a point: where a shadow falls */
function lifeGroundBelow(x, y) {
  const Wd = lifeWorldNow(); let g = H;
  for (const o of Wd.strokes) { const q = o.b; if (!o.ground || q[0] > x || q[2] < x || q[3] < y) continue; const t = lifeTopIn(o.s, x - 2, x + 2, y, H); if (t != null && t < g) g = t; }
  for (const q of Wd.boxes) if (q[0] <= x && q[2] >= x && q[1] >= y && q[1] < g) g = q[1];
  return g;
}
/* is the drawing round enough to roll like a ball or a wheel */
function lifeRoundish(ink, B) {
  const bw = B[2] - B[0], bh = B[3] - B[1]; if (!ink.length || Math.abs(bw - bh) > 0.3 * Math.max(bw, bh)) return false;
  const cx = (B[0] + B[2]) / 2, cy = (B[1] + B[3]) / 2, r = (bw + bh) / 4; let n = 0, off = 0;
  for (const s of ink) for (const p of ipPts(s)) { n++; off += Math.abs(Math.hypot(p[0] - cx, p[1] - cy) - r); }
  return n > 6 && off / n < 0.22 * r;
}
/* ----- real physics on the paper: the drawing is a rigid body made of a few circles. It falls, rolls down a drawn slope,
   bounces off pen lines, pictures, boxes and the edges of the page, is pushed by a walking or driving picture, and two of
   them knock each other away with momentum shared by their sizes. Friction makes a round thing roll and a flat one slide ----- */
const PHYS_G = 1500;
function lifeBodyShape(it) {
  const B = it.B, bw = Math.max(4, B[2] - B[0]), bh = Math.max(4, B[3] - B[1]), cx = (B[0] + B[2]) / 2, cy = (B[1] + B[3]) / 2;
  if (it.beh.round) { const r = (bw + bh) / 4; return { cx, cy, circles: [[0, 0, r]], m: Math.PI * r * r / 1000, I: 0.5 * (Math.PI * r * r / 1000) * r * r }; }
  const long = Math.max(bw, bh), short = Math.min(bw, bh), n = clamp(Math.ceil(long / short), 1, 8), r = short / 2, circles = [];
  for (let i = 0; i < n; i++) { const o = n === 1 ? 0 : -long / 2 + r + (long - 2 * r) * i / (n - 1); circles.push(bw >= bh ? [o, 0, r] : [0, o, r]); }
  const m = bw * bh / 1000; return { cx, cy, circles, m, I: m * (bw * bw + bh * bh) / 12 };
}
function lifeSegs(box) {
  const segs = [], Wd = lifeWorldNow();
  for (const o of Wd.strokes) { const q = o.b; if (q[2] < box[0] || q[0] > box[2] || q[3] < box[1] || q[1] > box[3]) continue; const P = ipPts(o.s), rad = (o.s.w || 3) / 2; if (P.length === 1) segs.push([P[0][0], P[0][1], P[0][0], P[0][1], rad, 0, 0]); for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; if (Math.max(a[0], b[0]) < box[0] || Math.min(a[0], b[0]) > box[2] || Math.max(a[1], b[1]) < box[1] || Math.min(a[1], b[1]) > box[3]) continue; segs.push([a[0], a[1], b[0], b[1], rad, 0, 0]); } }
  const rect = (q, ux, uy, who) => { segs.push([q[0], q[1], q[2], q[1], 0, ux, uy, who], [q[2], q[1], q[2], q[3], 0, ux, uy, who], [q[2], q[3], q[0], q[3], 0, ux, uy, who], [q[0], q[3], q[0], q[1], 0, ux, uy, who]); };
  for (const q of Wd.boxes) if (!(q[2] < box[0] || q[0] > box[2] || q[3] < box[1] || q[1] > box[3])) rect(q, 0, 0);
  /* other moving pictures that are not physical bodies push like a moving wall */
  for (const [id2, r2] of LIFE) { const o = findItem(id2); if (!o || !o.beh || !o.B || o.beh.k === 'phys') continue; if (!(o.beh.move || o.beh.k === 'path')) continue; const q = lifeBox(o, r2); if (q[2] < box[0] || q[0] > box[2] || q[3] < box[1] || q[1] > box[3]) continue; const ux = o.beh.k === 'path' ? 0 : (r2.dir || 1) * (r2.v || 0); rect(q, ux, 0, id2); }
  segs.push([0, H, W, H, 0, 0, 0], [0, 0, 0, H, 0, 0, 0], [W, 0, W, H, 0, 0, 0], [0, 0, W, 0, 0, 0, 0]);
  return segs;
}
function lifeImpulse(rt, sh, n, rx, ry, rel, e, mu, other) {
  /* rel: velocity of the contact point relative to what it touches */
  const vn = rel[0] * n[0] + rel[1] * n[1]; if (vn >= 0) return 0;
  const rn = rx * n[1] - ry * n[0];
  const inv = 1 / sh.m + rn * rn / sh.I + (other ? 1 / other.sh.m + other.rn * other.rn / other.sh.I : 0);
  const ee = Math.abs(vn) < 40 ? 0 : e; /* slow contacts settle instead of jittering */
  const j = -(1 + ee) * vn / inv;
  if (Math.abs(vn) > 160) { rt.sq = Math.min(1, Math.max(rt.sq || 0, Math.abs(vn) / 1400)); rt.sqN = n; }
  rt.vx += j * n[0] / sh.m; rt.vy += j * n[1] / sh.m; rt.w += (rx * n[1] - ry * n[0]) * j / sh.I;
  if (other) { other.rt.vx -= j * n[0] / other.sh.m; other.rt.vy -= j * n[1] / other.sh.m; other.rt.w -= other.rn * j / other.sh.I; }
  /* friction along the surface */
  const tx = rel[0] - vn * n[0], ty = rel[1] - vn * n[1], tl = Math.hypot(tx, ty);
  if (tl > 1e-6) {
    const t0 = tx / tl, t1 = ty / tl, rt_ = rx * t1 - ry * t0, invT = 1 / sh.m + rt_ * rt_ / sh.I;
    const jt = clamp(-tl / invT, -mu * j, mu * j);
    rt.vx += jt * t0 / sh.m; rt.vy += jt * t1 / sh.m; rt.w += (rx * t1 - ry * t0) * jt / sh.I;
  }
  return j;
}
function lifePhys(it, rt, dt) {
  const b = it.beh, sh = rt.sh || (rt.sh = lifeBodyShape(it));
  if (rt.px == null) { rt.px = 0; rt.py = 0; rt.vx = +b.vx || 0; rt.vy = +b.vy || 0; rt.ang = 0; rt.w = +b.spin || 0; rt.sleep = 0; }
  const g = PHYS_G * (b.g == null ? 1 : +b.g), e = clamp(b.e == null ? 0.5 : +b.e, 0, 0.95), mu = clamp(b.mu == null ? 0.35 : +b.mu, 0, 1.5);
  const reach = Math.max(...sh.circles.map((c) => Math.hypot(c[0], c[1]) + c[2])) + 6;
  const C0 = [sh.cx + rt.px, sh.cy + rt.py], sp = Math.hypot(rt.vx, rt.vy) * dt + 10;
  const segs = lifeSegs([C0[0] - reach - sp, C0[1] - reach - sp, C0[0] + reach + sp, C0[1] + reach + sp]);
  const steps = clamp(Math.ceil(dt / (1 / 240)), 1, 12), h = dt / steps;
  for (let k = 0; k < steps; k++) {
    rt.vy += g * h; rt.vx *= 1 - 0.02 * h; rt.vy *= 1 - 0.02 * h; rt.w *= 1 - 0.3 * h;
    rt.px += rt.vx * h; rt.py += rt.vy * h; rt.ang += rt.w * h;
    const ca = Math.cos(rt.ang), sa = Math.sin(rt.ang), cx = sh.cx + rt.px, cy = sh.cy + rt.py;
    for (const c of sh.circles) {
      const ox = c[0] * ca - c[1] * sa, oy = c[0] * sa + c[1] * ca, X = cx + ox, Y = cy + oy, r = c[2];
      for (const s of segs) {
        const ex = s[2] - s[0], ey = s[3] - s[1], L2 = ex * ex + ey * ey, u = L2 ? clamp(((X - s[0]) * ex + (Y - s[1]) * ey) / L2, 0, 1) : 0;
        const qx = s[0] + ex * u, qy = s[1] + ey * u, dx = X - qx, dy = Y - qy, d = Math.hypot(dx, dy), R = r + s[4];
        if (d >= R || d < 1e-6) continue;
        const n = [dx / d, dy / d], pen = R - d;
        rt.px += n[0] * pen * 0.9; rt.py += n[1] * pen * 0.9;
        const rx = ox - n[0] * r, ry = oy - n[1] * r;
        const vx = rt.vx - rt.w * ry - s[5], vy = rt.vy + rt.w * rx - s[6];
        const jj = lifeImpulse(rt, sh, n, rx, ry, [vx, vy], e, mu, null);
        if (s[7] && jj > sh.m * 120) { const o2 = findItem(s[7]), r2 = LIFE.get(s[7]); if (o2 && r2 && r2.state === 'go') lifeReact(o2, r2, o2.beh.k, 1); }
      }
    }
    /* other physical bodies on the page */
    for (const [id2, r2] of LIFE) {
      if (id2 <= it.id) continue; const o = findItem(id2); if (!o || !o.beh || o.beh.k !== 'phys' || r2.px == null) continue;
      const s2 = r2.sh || (r2.sh = lifeBodyShape(o)), c2 = Math.cos(r2.ang), s2a = Math.sin(r2.ang), X2 = s2.cx + r2.px, Y2 = s2.cy + r2.py;
      for (const c of sh.circles) {
        const ox = c[0] * ca - c[1] * sa, oy = c[0] * sa + c[1] * ca, X = cx + ox, Y = cy + oy;
        for (const d2 of s2.circles) {
          const ox2 = d2[0] * c2 - d2[1] * s2a, oy2 = d2[0] * s2a + d2[1] * c2, dx = X - (X2 + ox2), dy = Y - (Y2 + oy2), d = Math.hypot(dx, dy), R = c[2] + d2[2];
          if (d >= R || d < 1e-6) continue;
          const n = [dx / d, dy / d], pen = (R - d) / 2; rt.px += n[0] * pen; rt.py += n[1] * pen; r2.px -= n[0] * pen; r2.py -= n[1] * pen;
          const rx = ox - n[0] * c[2], ry = oy - n[1] * c[2], rx2 = ox2 + n[0] * d2[2], ry2 = oy2 + n[1] * d2[2];
          const va = [rt.vx - rt.w * ry, rt.vy + rt.w * rx], vb = [r2.vx - r2.w * ry2, r2.vy + r2.w * rx2];
          lifeImpulse(rt, sh, n, rx, ry, [va[0] - vb[0], va[1] - vb[1]], Math.min(e, clamp(o.beh.e == null ? 0.5 : +o.beh.e, 0, 0.95)), mu, { rt: r2, sh: s2, rn: rx2 * n[1] - ry2 * n[0] });
          r2.sleep = 0;
        }
      }
    }
  }
  if (rt.sq) rt.sq = Math.max(0, rt.sq - dt * 7);
  /* settle a body lying still, so it does not shiver */
  if (Math.hypot(rt.vx, rt.vy) < 6 && Math.abs(rt.w) < 0.15) { rt.sleep = (rt.sleep || 0) + dt; if (rt.sleep > 0.4) { rt.vx = 0; rt.w = 0; if (Math.abs(rt.vy) < 6) rt.vy = 0; } } else rt.sleep = 0;
}
/* choose a behaviour for a drawing: AI looks at it when connected, otherwise its shape decides */
async function lifeAuto(sp) {
  const strokes = sp.refs.map((r) => findStroke(r)).filter(Boolean), keys = LIFE_KINDS.map((k) => k[0]);
  if (AI.ready('read')) {
    try {
      const ask = AI.run('read', 'This is a small hand drawing on a notebook page. Pick how it should come alive, like a moving picture in a magic newspaper. Answer with exactly two words and nothing else: first one word from this list: person (a stick figure or human), ' + keys.join(', ') + '; then left or right, the way the head or front of the thing points. Guide: plants and trees sway, flags and cloth flutter, hearts beat, balloons and clouds bob, windmills spin, rabbits and frogs hop, birds and butterflies flap, fish swim, fire flickers, cars and trains drive, dogs cats horses and other four-legged animals walk4, rocks and balls and fruit roll, cute characters wiggle, a resting creature breathes. Example answer: walk4 left', { images: [sp.blob], maxTokens: 20, cache: false });
      const r = await Promise.race([ask, new Promise((res) => setTimeout(() => res(null), 9000))]);
      const w = r && String(r.text || '').toLowerCase().match(/[a-z0-9]+/g);
      const hit = w && w.find((x) => x === 'person' || keys.includes(x)), f = w && (w.includes('left') ? -1 : w.includes('right') ? 1 : 0);
      if (hit === 'person') return 'person'; if (hit) return f ? [hit, f] : hit;
    } catch (e) { /* fall back to the shape */ }
  }
  if (strokes.length >= 4) { try { const rg = ipRig(strokes); if (rg.headC && rg.legs.filter(Boolean).length === 2 && rg.arms.filter(Boolean).length) return 'person'; } catch (e) { /* not a figure */ } }
  const B = sp.box, bw = B[2] - B[0], bh = B[3] - B[1];
  let round = 0; for (const s of strokes) { const P = ipPts(s); if (P.length < 8) continue; const b = ipBox([s]), z = Math.max(b[2] - b[0], b[3] - b[1]); if (Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 0.35 * z && (b[1] + b[3]) / 2 > B[1] + 0.55 * bh && z < 0.6 * bw) round++; }
  if (round >= 2 && bw > bh) return 'drive';
  if (bw > bh * 0.9 && strokes.length) { const g = lifeLegs({ B, ink: strokes }); if (g.strokes && g.legs.length >= 3) return 'walk4'; }
  if (strokes.length === 1 && Math.abs(bw - bh) < 0.35 * Math.max(bw, bh)) { const P = ipPts(strokes[0]); if (P.length > 8 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 0.3 * Math.max(bw, bh)) return 'roll'; }
  if (bw > 1.6 * bh) return 'swim';
  if (bh > 1.6 * bw) return 'sway';
  return 'wiggle';
}
/* started from the app's play-all button: the moving drawings and models that were waiting start again */
function animKick(on) { if (on && !lifeRaf && LIFE.size) lifeRaf = requestAnimationFrame(lifeTick); if (on && !scnRaf && SCN.size) scnRaf = requestAnimationFrame(scTick); }

