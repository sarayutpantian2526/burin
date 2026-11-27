/* BURIN part: animals (loaded when first used) */
/* ---------- task 9.10: animals of the school curriculum, alive in three dimensions. Each one is built here from
   simple solids (ellipsoids, tubes, thin sheets) with a pencil line round its own shape, coloured like coloured
   pencils (or flat colour), with no frame on the paper. It goes about its own life in a loop (walks and grazes,
   pecks, swims, hops, burrows, flies to a flower and drinks) and answers a tap the way the real animal does
   (runs away, jumps away, flies off, pulls into its shell, puffs up, squirts ink). Turn it with a finger or a pen,
   two fingers or the wheel to zoom, double tap for the first view (the 3D model of scene3: sc3Bind).
   Nothing here uses AI; "animals" in flags.json turns the part off ----- */
const AN_I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const anAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], anSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], anMul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const anDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], anLen = (a) => Math.hypot(a[0], a[1], a[2]);
const anCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const anUnit = (a) => { const L = anLen(a) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };
const anLerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const anCl = (v, a, b) => (v < a ? a : v > b ? b : v);
const anSm = (u) => { u = anCl(u, 0, 1); return u * u * (3 - 2 * u); };
/* up over the first part, held, down over the last part */
const anBell = (u, e) => { e = e || 0.2; return anSm(Math.min(u / e, (1 - u) / e, 1)); };
function anRz(a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
/* nose down for a positive angle */
function anRy(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
/* left side up for a positive angle */
function anRx(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function anMm(A, B) { const o = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return o; }
function anMv(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
function anMs(...m) { return m.reduce((a, b) => anMm(a, b), AN_I); }
/* colours: #rrggbb only; f below 1 darker, above 1 towards white */
function anHex(c) { return /^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : '#888888'; }
function anMix(c, f) {
  const n = parseInt(anHex(c).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => Math.round(f < 1 ? v * f : v + (255 - v) * Math.min(1, f - 1));
  return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
}
function anTint(c, k) { const n = parseInt(anHex(c).slice(1), 16), m = (v) => ('0' + Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)).toString(16)).slice(-2); return '#' + m(n >> 16) + m((n >> 8) & 255) + m(n & 255); }
/* two legs bones from the hip to the foot: where the knee goes, bent towards the hint */
function anIK(H, F, l1, l2, hint) {
  let d = anSub(F, H), L = anLen(d); const mx = (l1 + l2) * 0.999;
  if (L > mx) { d = anMul(d, mx / L); L = mx; }
  if (L < 1e-6) return anAdd(H, anMul(anUnit(hint), l1));
  const u = anMul(d, 1 / L), a = (l1 * l1 - l2 * l2 + L * L) / (2 * L), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let w = anSub(hint, anMul(u, anDot(hint, u))); w = anLen(w) < 1e-6 ? anCross(u, [0, 1, 0]) : anUnit(w);
  return anAdd(H, anAdd(anMul(u, a), anMul(w, hh)));
}

/* ----- the builder: solids in the animal's own frame (x forward, y left, z up), shaded towards the viewer, with a
   pencil line where a solid turns away (its outline seen from here). Everything goes into the G3 lists of scene3:
   g (coloured, may be pencil), gs (sharp: eyes, so they stay bright) ----- */
class AnB {
  constructor(g, gs, P, E, pen) {
    this.g = g; this.gs = gs; this.P = P; this.E = E; this.pen = pen; this.M = AN_I; this.T = [0, 0, 0]; this.st = []; this.clip = false; this.sc = 1;
    const V = anUnit(E); this.V = V; this.Lt = anUnit(anAdd(V, [0.3, -0.2, 0.75]));
    this.ec = pen ? 'rgba(40,44,56,0.95)' : 'rgba(36,40,50,0.8)'; this.n = 0;
  }
  /* sc: a part drawn bigger or smaller (a cat's head on a lion), its eyes and lines too */
  push(t, M, sc) { this.st.push([this.M, this.T, this.sc]); this.T = this.w(t || [0, 0, 0]); if (M) this.M = anMm(this.M, M); if (sc) { this.M = anMm(this.M, [sc, 0, 0, 0, sc, 0, 0, 0, sc]); this.sc *= sc; } }
  pop() { const s = this.st.pop(); this.M = s[0]; this.T = s[1]; this.sc = s[2]; }
  w(p) { const q = anMv(this.M, p); return [this.T[0] + q[0], this.T[1] + q[1], this.T[2] + q[2]]; }
  d(v) { return anMv(this.M, v); }
  shade(col, n) {
    if (String(col).charAt(0) !== '#') return col; /* see-through wings: as they are */
    const l = Math.max(0, anDot(n, this.Lt)), lit = this.pen ? 0.72 + 0.62 * l : 0.6 + 0.55 * l + 0.1 * Math.max(0, anDot(n, this.V));
    return anMix(col, anCl(lit, 0.45, 1.32));
  }
  edge(a, b) { this.g.line([a, b], this.ec, this.pen ? 2 : 1.2, { bias: -0.004 }); }
  /* a grid of points (rows i, columns j that go round): faces, their outside found from ref(i); the faces that turn
     away are left out and a line drawn where they meet the ones that face us */
  mesh(G, colf, ref, wrap, caps) {
    const n1 = G.length - 1, n2 = G[0].length - 1, F = [];
    for (let i = 0; i < n1; i++) {
      F.push([]);
      for (let j = 0; j < n2; j++) {
        const a = G[i][j], b = G[i + 1][j], c = G[i + 1][j + 1], d = G[i][j + 1];
        const cen = [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4, (a[2] + b[2] + c[2] + d[2]) / 4];
        let n = anCross(anSub(c, a), anSub(d, b)); const nl = anLen(n);
        if (nl < 1e-12) { F[i].push(null); continue; }
        n = anMul(n, 1 / nl); if (anDot(n, anSub(cen, ref(i, j))) < 0) n = anMul(n, -1);
        const hid = this.clip && cen[2] < -0.004;
        F[i].push({ a, b, c, d, n, f: !hid && anDot(n, anSub(this.E, cen)) > 0, hid });
      }
    }
    for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) {
      const f = F[i][j]; if (!f || !f.f) continue;
      const fc = this.shade(colf(i, j), f.n); this.g.poly([f.a, f.b, f.c, f.d], fc, fc); this.n++;
    }
    const vis = (f) => f && f.f;
    for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) {
      const f = F[i][j]; if (!f || f.hid) continue;
      const jr = j + 1 < n2 ? j + 1 : (wrap ? 0 : -1);
      if (jr >= 0) { const g = F[i][jr]; if (g && !g.hid && vis(f) !== vis(g)) this.edge(G[i][j + 1], G[i + 1][j + 1]); }
      if (i + 1 < n1) { const g = F[i + 1][j]; if (g && !g.hid && vis(f) !== vis(g)) this.edge(G[i + 1][j], G[i + 1][j + 1]); }
    }
    if (caps) for (const [i, row, ci] of caps) {
      /* the flat end of a tube: one face, with its rim where it and the side turn differently */
      const ring = row.slice(0, n2); let n = [0, 0, 0]; for (let k = 0; k < ring.length; k++) { const p = ring[k], q = ring[(k + 1) % ring.length]; n = anAdd(n, [(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])]); }
      if (anLen(n) < 1e-12) continue; n = anUnit(n);
      const cen = ring.reduce((s, p) => anAdd(s, anMul(p, 1 / ring.length)), [0, 0, 0]); if (anDot(n, anSub(cen, ref(ci, 0))) < 0) n = anMul(n, -1);
      if (this.clip && cen[2] < -0.004) continue;
      const fv = anDot(n, anSub(this.E, cen)) > 0;
      if (fv) { const fc = this.shade(colf(Math.min(i, n1 - 1), 0), n); this.g.poly(ring, fc, fc); }
      for (let j = 0; j < n2; j++) { const s = F[Math.min(i, n1 - 1)][j]; if (s && !s.hid && vis(s) !== fv) this.edge(row[j], row[j + 1]); }
    }
  }
  /* an ellipsoid round c, radii r along its own x y z, turned by M; col a colour or a function of the point on the
     unit sphere; def moves points (bulges) */
  ell(c, r, M, col, o) {
    o = o || {}; const n1 = o.n1 || 9, n2 = o.n2 || 12, G = [], U = [];
    const Mw = M ? anMm(this.M, M) : this.M, cw = this.w(c);
    for (let i = 0; i <= n1; i++) {
      G.push([]); U.push([]); const th = Math.PI * i / n1;
      for (let j = 0; j <= n2; j++) {
        const ph = 2 * Math.PI * j / n2, u = [Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph)];
        let p = [r[0] * u[0], r[1] * u[1], r[2] * u[2]]; if (o.def) p = anAdd(p, o.def(u));
        G[i].push(anAdd(cw, anMv(Mw, p))); U[i].push(u);
      }
    }
    const cf = typeof col === 'function' ? (i, j) => { const a = U[i][j], b = U[i + 1][j + 1]; return col(anUnit(anAdd(a, b))); } : () => col;
    this.mesh(G, cf, () => cw, true);
    return cw;
  }
  /* a tube through points (in this frame), radius rad(t) or [side, up], round in `sides`; col a colour or col(t, a) */
  tube(pts, rad, col, o) {
    o = o || {}; const n = o.sides || 8, W = pts.map((p) => this.w(p)), m = W.length; if (m < 2) return;
    const T = W.map((p, i) => anUnit(anSub(W[Math.min(m - 1, i + 1)], W[Math.max(0, i - 1)])));
    let hint = this.d(o.up || [0, 0, 1]); if (Math.abs(anDot(hint, T[0])) > 0.95) hint = this.d([1, 0, 0]); if (Math.abs(anDot(hint, T[0])) > 0.95) hint = this.d([0, 1, 0]);
    let N = anUnit(anSub(hint, anMul(T[0], anDot(hint, T[0]))));
    const G = [], R = [];
    for (let i = 0; i < m; i++) {
      if (i) { const q = anSub(N, anMul(T[i], anDot(N, T[i]))); if (anLen(q) > 1e-9) N = anUnit(q); }
      const B = anCross(T[i], N), t = i / (m - 1), rr = typeof rad === 'function' ? rad(t) : rad, ry = Array.isArray(rr) ? rr[0] : rr, rz = Array.isArray(rr) ? rr[1] : rr;
      G.push([]); R.push(W[i]);
      for (let j = 0; j <= n; j++) { const a = 2 * Math.PI * j / n; G[i].push(anAdd(W[i], anAdd(anMul(B, ry * Math.cos(a)), anMul(N, Math.max(rz, 1e-5) * Math.sin(a))))); }
    }
    const cf = typeof col === 'function' ? (i, j) => col((i + 0.5) / (m - 1), (j + 0.5) / n * 6.2832) : () => col;
    const caps = []; if (o.cap !== false) { caps.push([0, G[0], 0]); caps.push([m - 1, G[m - 1], m - 1]); }
    this.mesh(G, cf, (i) => anLerp(R[Math.min(i, m - 1)], R[Math.min(i + 1, m - 1)], 0.5), true, caps);
  }
  /* a thin flat part (a wing, a fin, an ear): one face seen from both sides, with its pencil edge */
  sheet(pts, col, o) {
    o = o || {}; const W = pts.map((p) => this.w(p)); let n = [0, 0, 0];
    for (let k = 0; k < W.length; k++) { const p = W[k], q = W[(k + 1) % W.length]; n = anAdd(n, [(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])]); }
    n = anUnit(n); const cen = W.reduce((s, p) => anAdd(s, anMul(p, 1 / W.length)), [0, 0, 0]);
    if (this.clip && cen[2] < -0.004) return;
    if (anDot(n, anSub(this.E, cen)) < 0) n = anMul(n, -1);
    const fc = this.shade(col, n); this.g.poly(W, fc, o.stroke || fc);
    if (o.edge !== false) for (let k = 0; k < W.length - (o.open ? 1 : 0); k++) this.g.line([W[k], W[(k + 1) % W.length]], o.ec || this.ec, this.pen ? 1.1 : 1, { bias: -0.004 });
  }
  /* a thin line of a given width in this frame (feelers, the legs of insects, whiskers) */
  line(pts, col, wd, o) {
    const W = pts.map((p) => this.w(p)), mid = W[Math.floor(W.length / 2)], k = this.P(mid[0], mid[1], mid[2])[3];
    if (this.clip && mid[2] < -0.004) return;
    this.g.line(W, col || this.ec, Math.max(0.8, (wd || 0.01) * this.sc * k), o);
  }
  /* an eye: a dark ball with its shine, only when it faces us (out is the way it looks out of the head) */
  eye(p, r, out, col) {
    const w = this.w(p), o = this.d(out || [1, 0, 0]); if (anDot(o, anSub(this.E, w)) < -0.15 * anLen(anSub(this.E, w))) return;
    if (this.clip && w[2] < 0) return;
    this.gs.ball(w, r * this.sc, col || '#17191E');
  }
  ball(p, r, col) { const w = this.w(p); if (this.clip && w[2] < 0) return; this.g.ball(w, r * this.sc, col); }
}

/* ----- a life in a loop: each animal has its steps (move somewhere, then do something there), and an answer to a tap.
   Seeded, so the same animal does the same things in the same order (tests, and every device in a class) ----- */
function anRng(s) { s.seed = (s.seed * 16807) % 2147483647; return s.seed / 2147483647; }
function anNew(D) {
  const s = { t: 0, x: 0, y: 0, z: D.z0 || 0, h: D.h0 == null ? 0.5 : D.h0, v: 0, vz: 0, mv: 0, ph: 0, si: 0, aT: 0, act: D.loop[0][0], ap: 0, tg: null, rx: null, rk: 0, seed: 20261121 + D.id.length * 97, hop: null, rest: 0, trail: null, ink: [], fx: {} };
  if (D.start) D.start(s);
  return s;
}
/* out on the paper (frameless, switch "onpage"): set while such an animal takes its steps. Its ground has no edge, and
   it heads along the page, left or right, the way AN_FREE.dir says */
let AN_FREE = null;
function anRoam(D, p) { if (AN_FREE) return p; const r = Math.hypot(p[0], p[1]), m = D.roam * 1.2; return r > m ? [p[0] * m / r, p[1] * m / r] : p; }
const anFar = (D, s) => !AN_FREE && Math.hypot(s.x, s.y) > D.roam;
function anTarget(D, s) {
  if (AN_FREE) {
    const F = AN_FREE; if (anRng(s) < 0.2) F.dir = -F.dir;
    const L = D.roam * (1.5 + 2 * anRng(s)), sd = (anRng(s) - 0.5) * 0.4 * D.roam, R = F.R;
    return [s.x + R[0] * L * F.dir - R[1] * sd, s.y + R[1] * L * F.dir + R[0] * sd].concat(D.go === 'fly' || D.go === 'swim' ? [D.zLo + (D.zHi - D.zLo) * anRng(s)] : []);
  }
  for (let k = 0; k < 6; k++) {
    const a = anRng(s) * 6.2832, r = D.roam * (0.3 + 0.7 * Math.sqrt(anRng(s))), p = [r * Math.cos(a), r * Math.sin(a)];
    if (Math.hypot(p[0] - s.x, p[1] - s.y) > D.roam * 0.45) return p.concat(D.go === 'fly' || D.go === 'swim' ? [D.zLo + (D.zHi - D.zLo) * anRng(s)] : []);
  }
  return [-s.x * 0.5, -s.y * 0.5].concat(D.go === 'fly' || D.go === 'swim' ? [(D.zLo + D.zHi) / 2] : []);
}
const anAng = (a) => { while (a > Math.PI) a -= 6.2832; while (a < -Math.PI) a += 6.2832; return a; };
/* move towards tg (x, y and for flyers z) at speed spd; true when there */
function anMove(D, s, dt, tg, spd, bolt) {
  if (D.go === 'hop') return anHopTo(D, s, dt, tg, spd);
  if (!tg) { s.v = Math.max(0, s.v - (D.acc || 2) * dt); s.vz *= Math.max(0, 1 - 4 * dt); s.x += Math.cos(s.mh == null ? s.h : s.mh) * s.v * dt; s.y += Math.sin(s.mh == null ? s.h : s.mh) * s.v * dt; return true; }
  const dx = tg[0] - s.x, dy = tg[1] - s.y, dist = Math.hypot(dx, dy), air = tg.length > 2;
  const dz = air ? tg[2] - s.z : 0;
  if (dist < (D.near || 0.03) && Math.abs(dz) < 0.03) { s.v = Math.max(0, s.v - (D.acc || 2) * dt * 2); return true; }
  const want = Math.atan2(dy, dx);
  /* a crab goes sideways: its body turns to whichever side is nearer */
  let face = want; if (D.side) { const l = anAng(want - Math.PI / 2 - s.h), r = anAng(want + Math.PI / 2 - s.h); face = Math.abs(l) < Math.abs(r) ? want - Math.PI / 2 : want + Math.PI / 2; }
  const err = anAng(face - s.h), tr = (D.turn || 2.5) * (bolt ? 3 : 1) * dt; s.h = anAng(s.h + anCl(err, -tr, tr));
  const go = D.side || air ? 1 : Math.max(bolt ? 0.45 : 0, Math.cos(err)), slow = Math.min(1, dist / (D.brake || 0.15) + 0.25);
  const vt = spd * go * slow; s.v += anCl(vt - s.v, -(D.acc || 2) * dt, (D.acc || 2) * dt);
  s.mh = D.side ? want : (air ? want : s.h);
  s.x += Math.cos(s.mh) * s.v * dt; s.y += Math.sin(s.mh) * s.v * dt;
  if (air) { const vz = anCl(dz * 2.2, -spd, spd); s.vz += (vz - s.vz) * Math.min(1, 6 * dt); s.z += s.vz * dt; }
  const q = anRoam(D, [s.x, s.y]); s.x = q[0]; s.y = q[1];
  return false;
}
/* hoppers (frogs, the grasshopper, a sparrow on the ground): turn, crouch, leap along an arc, rest */
function anHopTo(D, s, dt, tg, spd, big) {
  if (s.hop) {
    const H = s.hop; H.u = Math.min(1, H.u + dt / H.T);
    const p = anLerp(H.a, H.b, H.u); s.x = p[0]; s.y = p[1]; s.z = (H.z0 || 0) * (1 - H.u) + 4 * H.H * H.u * (1 - H.u);
    s.v = H.len / H.T; if (H.u >= 1) { s.hop = null; s.z = 0; s.v = 0; s.rest = D.hopRest || 0.35; } return false;
  }
  s.v = 0; if (s.rest > 0) { s.rest -= dt; return false; }
  if (!tg) return true;
  const dx = tg[0] - s.x, dy = tg[1] - s.y, dist = Math.hypot(dx, dy); if (dist < 0.05) return true;
  const err = anAng(Math.atan2(dy, dx) - s.h), tr = (D.turn || 4) * dt; s.h = anAng(s.h + anCl(err, -tr, tr));
  if (Math.abs(err) > 0.25) return false;
  const len = Math.min(dist, big ? D.jumpLen : D.hopLen), b = anRoam(D, [s.x + Math.cos(s.h) * len, s.y + Math.sin(s.h) * len]);
  s.hop = { u: 0, a: [s.x, s.y, 0], b: [b[0], b[1], 0], len, T: (big ? 1.25 : 1) * (D.hopT || 0.45), H: (big ? D.jumpH : D.hopH) || 0.2 };
  return false;
}
function anNext(D, s) {
  /* out on the paper its day is not a fixed round: the next of its own doings is drawn at random (not the same one again),
     each for longer or shorter, as a real one does (owner 22 พ.ย. 2569); in its box the round stays as it was */
  if (AN_FREE && D.loop.length > 2) { let i = s.si; for (let k = 0; k < 5 && i === s.si; k++) i = Math.floor(anRng(s) * D.loop.length); s.si = i; s.durK = 0.6 + anRng(s) * 0.9; }
  else s.si = (s.si + 1) % D.loop.length;
  s.porg = null; s.aT = 0; s.ap = 0; s.tg = null; s.act = D.loop[s.si][0]; if (D.enter) D.enter(s, s.act); }
function anStep(D, s, dt) {
  s.t += dt;
  if (s.rx) anRx1(D, s, dt);
  else if (D.air && s.z > 0.002) {
    /* came back from flying off: glides down to a spot on the ground */
    if (!s.landTg) { const p = anTarget(D, s), k = AN_FREE ? 1 : 0.6; s.landTg = [p[0] * k, p[1] * k, 0]; }
    const save = D.go; D.go = 'fly'; anMove(D, s, dt, s.landTg, D.fast * 0.7); D.go = save;
    if (s.z < 0.02 && Math.hypot(s.landTg[0] - s.x, s.landTg[1] - s.y) < 0.06) { s.z = 0; s.vz = 0; s.landTg = null; s.v = 0; }
    s.act = 'land';
  } else {
    const cur = D.loop[s.si], act = cur[0], dur = cur[1] * (AN_FREE && s.durK ? s.durK : 1); s.act = act; s.aT += dt; s.ap = Math.min(1, s.aT / dur);
    if (D.tick && D.tick(s, dt, act) === true) { /* the animal moves itself in this step */ }
    else if (act === 'go' || act === 'fly' || act === 'run') {
      if (!s.tg) s.tg = anTarget(D, s);
      const done = anMove(D, s, dt, s.tg, act === 'run' ? D.fast : D.spd);
      if ((done && !s.hop) || s.aT > dur * (AN_FREE ? 2.5 : 1)) { if (D.go === 'hop' && s.hop) { /* lands first */ } else anNext(D, s); }
    } else if (act === 'land' || act === 'hang') {
      let p = D.perch(s); if (AN_FREE) { if (!s.porg) s.porg = [s.x - p[0], s.y - p[1]]; p = [p[0] + s.porg[0], p[1] + s.porg[1], p[2]]; } const there = anMove(D, s, dt, p, D.spd * 0.8);
      if (there) { s.x += (p[0] - s.x) * Math.min(1, 6 * dt); s.y += (p[1] - s.y) * Math.min(1, 6 * dt); s.z += (p[2] - s.z) * Math.min(1, 6 * dt); s.perched = true; } else { s.perched = false; s.aT = Math.min(s.aT, dur * 0.2); }
      if (s.aT >= dur) { s.perched = false; anNext(D, s); }
    } else { anMove(D, s, dt, null); if (s.aT >= dur && !s.hop) anNext(D, s); }
  }
  /* walking, swimming or flying shows in the legs, fins and wings: the gait goes on with the distance */
  const v = Math.abs(s.v); s.mv += (anCl(v / (D.spd || 1), 0, 1.6) - s.mv) * Math.min(1, 8 * dt);
  s.ph += (v / (D.stride || 0.3)) * 6.2832 * dt + (D.go === 'fly' && !s.perched ? (D.flap || 0) * 6.2832 * dt : 0);
  if (s.trail) anTrail(s);
  s.ink = s.ink.filter((q) => (q.t += dt) < 3.2);
}
/* the answer to a tap: kinds shared by many animals; dir is the way away from the finger, on the ground */
const AN_RX = {
  flee: { T: 2.4 }, dart: { T: 1.6 }, jump: { T: 1.4 }, flyoff: { T: 2.8 }, hide: { T: 4.2 }, puff: { T: 3.2 }, threat: { T: 3.0 }, ink: { T: 2.6 }, flip: { T: 1.2 }, burrow: { T: 5.5 }, trumpet: { T: 3.0 }, drop: { T: 4.4 }
};
function anReact(D, s, dir) {
  if (s.rx && s.rx.t < 0.5) return false; /* a second tap at once does not start it again */
  const k = D.react, d = anUnit([dir[0], dir[1], 0]);
  s.rx = { k, t: 0, d, T: (AN_RX[k] || { T: 2 }).T, tg: null }; s.hop = null; s.rest = 0; s.perched = false;
  if (k === 'ink') for (let i = 0; i < 26; i++) s.ink.push({ t: 0, p: [s.x, s.y, s.z], v: [(anRng(s) - 0.5) * 0.5 - d[0] * 0.25, (anRng(s) - 0.5) * 0.5 - d[1] * 0.25, (anRng(s) - 0.3) * 0.25], r: 0.02 + anRng(s) * 0.03 });
  if (D.onReact) D.onReact(s);
  return true;
}
function anRx1(D, s, dt) {
  const R = s.rx; R.t += dt; const k = R.k, u = R.t / R.T;
  /* going after something on the page (hunting, chasing, playing, going to look, a biter to its animal), or eating */
  if (AN_DO[k]) {
    if (k === 'eat') { anMove(D, s, dt, null); s.act = (D.Q && D.Q.down) || s.act; }
    else if (k === 'wait' || k === 'wdo') { anMove(D, s, dt, null); if (R.wk === 'sniff') s.act = (D.Q && D.Q.down) || s.act; }
    else if (R.tg) { if (D.go === 'hop') anHopTo(D, s, dt, R.tg.slice(0, 2), R.spd, k !== 'stalk'); else { const air = D.go === 'fly' || D.go === 'swim' || (D.air && R.tg.length > 2); if (air && D.air && D.go !== 'fly') { const sv = D.go; D.go = 'fly'; anMove(D, s, dt, R.tg, R.spd, k === 'hunt'); D.go = sv; } else anMove(D, s, dt, air ? R.tg : R.tg.slice(0, 2), R.spd, k === 'hunt' || k === 'chase' || k === 'lunge' || k === 'charge'); } }
    s.rk = 0; if (R.t >= R.T) { s.rx = null; s.tg = null; s.aT = 0; }
    return;
  }
  const away = (len) => { const p = anRoam(D, [s.x + R.d[0] * len, s.y + R.d[1] * len]); return p; };
  if (k === 'flee' || k === 'dart' || (k === 'threat' && R.t > 1.1) || (k === 'trumpet' && R.t > 1.8) || k === 'ink' || k === 'flip') {
    if (!R.tg) R.tg = away(D.fleeLen || 0.7);
    const spd = k === 'flip' ? D.fast * 1.6 : k === 'ink' ? D.fast * 1.3 : D.fast;
    if (D.go === 'hop') { if (!R.tg2) { R.tg2 = 1; s.hop = null; s.rest = 0; } anHopTo(D, s, dt, R.tg, spd, true); }
    else if (k === 'flip' || k === 'ink') { /* backwards, fast, the body stays facing the finger */ const b = R.d; s.v = spd * Math.max(0, 1 - u * 0.9); s.x += b[0] * s.v * dt; s.y += b[1] * s.v * dt; const q = anRoam(D, [s.x, s.y]); s.x = q[0]; s.y = q[1]; const fa = k === 'ink' && D.mantle ? Math.atan2(b[1], b[0]) : Math.atan2(-b[1], -b[0]); s.h = anAng(s.h + anCl(anAng(fa - s.h), -6 * dt, 6 * dt)); s.mh = Math.atan2(b[1], b[0]); }
    else anMove(D, s, dt, D.go === 'fly' || D.go === 'swim' ? R.tg.concat([s.z]) : R.tg, spd, true);
  } else if (k === 'jump') { if (!R.tg) { R.tg = away(D.jumpLen || 0.6); s.hop = null; s.rest = 0; } anHopTo(D, s, dt, R.tg, D.fast, true); if (!s.hop && R.t > 0.2 && Math.hypot(R.tg[0] - s.x, R.tg[1] - s.y) < 0.06) R.t = Math.max(R.t, R.T - 0.3); }
  else if (k === 'flyoff') {
    if (!R.tg) { const p = away(D.roam * 0.9); R.tg = [p[0], p[1], D.zHi]; s.perched = false; }
    if (R.t > 1.3 && !R.tg2) { R.tg2 = 1; const p = anTarget(D, s); R.tg = [p[0], p[1], D.zHi * 0.9]; }
    const air = D.air || D.go === 'fly'; if (air) { const save = D.go; D.go = 'fly'; anMove(D, s, dt, R.tg, D.fast); D.go = save; } else anMove(D, s, dt, R.tg, D.fast);
  } else { anMove(D, s, dt, null); }
  /* how far into its pose (pulled in, puffed up, claws up): up fast, held, down slowly */
  const T = R.T, up = k === 'burrow' ? 0.6 : 0.3, dn = k === 'hide' ? 1.5 : 0.8; s.rk = anSm(Math.min(R.t / up, (T - R.t) / dn, 1));
  if (D.rxTick) D.rxTick(s, dt, R);
  if (R.t >= T) { s.rx = null; s.rk = 0; s.tg = null; s.aT = 0; if (D.after) D.after(s); }
}
/* the body of a worm follows where its head has been */
function anTrail(s) {
  const tr = s.trail, h = [s.x, s.y, s.z], last = tr[0];
  if (!last || anLen(anSub(h, last)) > 0.008) { tr.unshift(h); if (tr.length > 400) tr.pop(); }
}
function anAlong(s, dist) {
  const tr = s.trail; let acc = 0, prev = [s.x, s.y, s.z];
  for (let i = 0; i < tr.length; i++) { const q = tr[i], l = anLen(anSub(q, prev)); if (acc + l >= dist && l > 1e-9) return anLerp(prev, q, (dist - acc) / l); acc += l; prev = q; }
  const a = tr.length > 1 ? anUnit(anSub(tr[tr.length - 1], tr[tr.length - 2])) : [-Math.cos(s.h), -Math.sin(s.h), 0];
  return anAdd(prev, anMul(a, dist - acc));
}

/* ----- four legs (cow, buffalo, elephant, cat, dog): a barrel with chest and rump, legs found from hip to foot (the
   feet step on the ground in the order of a real walk), neck and head that go down to graze or sniff ----- */
function anLegs(b, s, Q, body, col, foot, k) {
  /* walk: left hind, left fore, right hind, right fore, a quarter of a step apart */
  const mv = Math.min(1.3, s.mv) * (k.still ? 0 : 1), A = Q.step * mv, lift = Q.lift * Math.min(1, mv);
  const legs = [[Q.fx, 1, 0.5], [Q.fx, -1, 1.5], [Q.hx, 1, 0], [Q.hx, -1, 1]];
  for (const [x0, side, off] of legs) {
    const front = x0 > 0, p = s.ph + off * Math.PI, hip = body([x0 + (front ? 0.02 : 0), side * Q.hy, front ? Q.fz : Q.hz]);
    let fx = x0 + A * Math.sin(p), fz = lift * Math.max(0, Math.cos(p)), fy = side * Q.fy;
    if (!front && k.sit) { fx = x0 + 0.1 * k.sit + (1 - k.sit) * (fx - x0); fz *= 1 - k.sit; }
    if (k.tuck) { fx = x0 + (fx - x0) * (1 - k.tuck) + (front ? -0.05 : 0.05) * k.tuck; fy *= 1 - 0.3 * k.tuck; }
    const fl = front ? (Q.fl || 1) : 1, F = [fx, fy, fz + (k.lift || 0)], l = Q.l1 * fl, knee = anIK(hip, F, l, Q.l2 * fl, front ? [1, 0, 0.1] : [-1, 0, 0.1]);
    b.tube([hip, knee, F], (t) => (t < 0.5 ? Q.lr - (Q.lr - Q.lr2) * t * 0.8 : Q.lr2 * (1.06 - 0.12 * t)), col, { sides: 7 });
    if (foot) b.ell([F[0] + Q.hoof * 0.15, F[1], F[2] + Q.hoof * 0.5], [Q.hoof * 1.1, Q.hoof * 0.95, Q.hoof * 0.6], null, foot, { n1: 5, n2: 8 });
  }
}
function anQuad(b, s, C, D) {
  const Q = D.Q, rxk = s.rx ? s.rx.k : '', rk = s.rk;
  const graze = s.act === Q.down ? anBell(s.ap, 0.18) : 0, sit = s.act === 'sit' ? anBell(s.ap, 0.16) : 0;
  const look = s.act === 'look' ? anBell(s.ap, 0.2) * Math.sin(s.aT * 2.2) * 0.55 : 0;
  const arch = rxk === 'threat' && Q.arch ? anSm(Math.min(1, s.rx.t / 0.25)) * (s.rx.t < 1.1 ? 1 : Math.max(0, 1 - (s.rx.t - 1.1) * 2)) : 0;
  const bob = 0.012 * Math.min(1.3, s.mv) * Math.cos(2 * s.ph) + 0.004 * Math.sin(s.t * 1.3);
  const bp = -0.42 * sit, piv = [Q.fx, 0, Q.fz];
  /* the body, pitched about the shoulders when it sits */
  const body = (p) => { const q = anMv(anRy(bp), anSub(p, piv)); return anAdd(piv, [q[0], q[1], q[2] + bob + arch * 0.06]); };
  const bodyM = anRy(bp), cb = Q.coat ? (u) => Q.coat(u, C) : (u) => (u[2] < -0.42 ? C.b2 : (Q.spots && Math.sin(u[0] * 9 + 1.3) * Math.sin(u[1] * 7 + u[2] * 5) > 0.42 ? C.s : C.b));
  /* a pangolin rolls up in a ball of scales */
  if (Q.ball && rxk === 'hide' && rk > 0.5) { const r = Q.bx * 0.7; b.ell([0, 0, r], [r * 1.05, r, r], null, cb, { n1: 10, n2: 12 }); if (Q.spines) for (let i = 0; i < 60; i++) { const th = Math.acos(1 - (i + 0.5) / 60 * 1.7), ph = i * 2.4, u = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]; b.line([[u[0] * r, u[1] * r, r + u[2] * r], [u[0] * r * 1.7, u[1] * r * 1.7, r + u[2] * r * 1.7]], i % 3 ? '#E8DCC0' : '#2A221C', 0.004); } return; }
  const archDef = (u) => [0, 0, u[2] > 0 ? arch * 0.08 * (1 - u[0] * u[0]) : 0];
  b.ell(body([0, 0, Q.zh]), [Q.bx, Q.by, Q.bz], bodyM, cb, { def: archDef, n1: 12, n2: 14 });
  b.ell(body([Q.bx * 0.55, 0, Q.zh + Q.bz * 0.08]), [Q.bx * 0.5, Q.by * 0.95, Q.bz * 1.02], bodyM, cb, { n1: 7, n2: 10 });
  b.ell(body([-Q.bx * 0.58, 0, Q.zh + Q.bz * 0.06]), [Q.bx * 0.48, Q.by * 0.92, Q.bz * 0.98], bodyM, cb, { n1: 7, n2: 10 });
  if (Q.udder) b.ell(body([-Q.bx * 0.45, 0, Q.zh - Q.bz * 0.9]), [0.07, 0.06, 0.05], null, C.m, { n1: 5, n2: 8 });
  if (Q.extra) Q.extra(b, s, C, D, body, bodyM);
  anLegs(b, s, Q, body, Q.legCol ? (u) => Q.legCol(C) : (u) => C.b, C.d, { sit, tuck: arch * 0.4 });
  /* neck and head: up while it walks, down to the ground to graze (or to sniff), turning while it looks round */
  let na = Q.na + (Q.naD - Q.na) * graze + 0.35 * sit, ha = Q.ha + (Q.haD - Q.ha) * graze - 0.25 * sit, hy = look;
  if (rxk === 'flee' || rxk === 'threat') { na += 0.25 * rk; ha -= 0.3 * rk; }
  if (rxk === 'trumpet') { na += 0.2 * rk; ha -= 0.55 * rk; }
  if (Q.down === 'graze' && graze > 0.9) ha += 0.05 * Math.sin(s.t * 9); /* chewing */
  if (Q.down === 'sniff' && graze > 0.5) hy += 0.25 * Math.sin(s.t * 3.1);
  const S = body([Q.sx, 0, Q.sz]), nd = anMv(anRz(hy), [Math.cos(na), 0, Math.sin(na)]), N = anAdd(S, anMul(nd, Q.nl));
  if (Q.nl > 0.02) b.tube([S, anLerp(S, N, 0.5), N], (t) => Q.nr * (1 - 0.25 * t), C.b, { sides: 8 });
  const HM = anMs(anRz(hy), anRy(ha)), H = anAdd(N, anMv(HM, [Q.hr[0] * 0.55, 0, 0]));
  b.push(H, HM);
  b.ell([0, 0, 0], Q.hr, null, C.b, { n1: 8, n2: 10 });
  Q.head(b, s, C, D, { rk, rxk, graze, sit });
  b.pop();
  /* the tail */
  const T0 = body([-Q.bx * 0.98, 0, Q.zh + Q.bz * 0.55]); Q.tail(b, s, C, D, T0, { rk, rxk, sit, arch });
}
const AN_EAR = (b, x, y, z, len, up, wd, col, droop) => { for (const sd of [1, -1]) b.sheet([[x + wd, sd * y, z], [x - wd * 0.3, sd * (y + len), z + up - droop], [x - wd, sd * y, z - wd * 0.3]], col); };
function anHorn(b, pts, r0, col) { for (const sd of [1, -1]) b.tube(pts.map((p) => [p[0], sd * p[1], p[2]]), (t) => r0 * (1 - 0.85 * t), col, { sides: 6 }); }
function anTailHang(b, s, T0, len, r, col, tuft, sway) {
  const a = Math.sin(s.t * 1.7) * 0.25 + sway, pts = [];
  for (let i = 0; i <= 5; i++) { const u = i / 5; pts.push(anAdd(T0, [-0.05 * u - 0.02, Math.sin(a * u * 1.5) * len * 0.35 * u, -len * u])); }
  b.tube(pts, (t) => r * (1 - 0.5 * t), col, { sides: 6 });
  if (tuft) b.ell(anAdd(pts[5], [0, 0, -0.03]), [0.025, 0.025, 0.05], null, tuft, { n1: 5, n2: 7 });
}
const AN_COW_HEAD = (b, s, C, D, k) => {
  b.ell([D.Q.hr[0] * 0.85, 0, -0.02], [0.065, 0.068, 0.062], null, C.m, { n1: 6, n2: 9 });
  b.eye([0.02, 0.068, 0.035], 0.017, [0.3, 1, 0.3]); b.eye([0.02, -0.068, 0.035], 0.017, [0.3, -1, 0.3]);
  AN_EAR(b, -0.06, 0.06, 0.04, 0.11, -0.01, 0.035, C.b, 0.02);
  if (D.id === 'buffalo') anHorn(b, [[-0.05, 0.05, 0.06], [-0.07, 0.15, 0.07], [-0.15, 0.25, 0.09], [-0.26, 0.28, 0.13], [-0.34, 0.22, 0.17]], 0.034, C.h);
  else anHorn(b, [[-0.06, 0.05, 0.07], [-0.07, 0.1, 0.11], [-0.05, 0.13, 0.16]], 0.022, C.h);
};
const AN_EL_HEAD = (b, s, C, D, k) => {
  /* the trunk hangs and swings, curls up when it trumpets; ears flap, spread wide when alarmed */
  const up = k.rxk === 'trumpet' ? k.rk : 0, sw = Math.sin(s.t * 1.1) * 0.25 * (1 - up), pts = [];
  let p = [0.17, 0, -0.06], a = 1.35 - 0.2 * k.graze;
  for (let i = 0; i < 9; i++) { pts.push(p); const da = 0.05 + 0.03 * Math.sin(s.t * 1.3) - up * 0.42; a += da; p = anAdd(p, [Math.cos(a) * 0.075 * (1 - up * 0.2), sw * 0.02 * i, -Math.sin(a) * 0.075]); }
  pts.push(p); b.tube(pts, (t) => 0.065 * (1 - 0.6 * t), C.b, { sides: 8 });
  for (const sd of [1, -1]) b.tube([[0.12, sd * 0.09, -0.08], [0.2, sd * 0.12, -0.13], [0.27, sd * 0.11, -0.12]], (t) => 0.02 * (1 - 0.7 * t), C.h, { sides: 6 });
  b.eye([0.07, 0.15, 0.03], 0.016, [0.4, 1, 0.2]); b.eye([0.07, -0.15, 0.03], 0.016, [0.4, -1, 0.2]);
  const fl = 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(s.t * 1.6)) + 0.9 * (k.rxk === 'trumpet' ? k.rk : 0);
  for (const sd of [1, -1]) {
    const R = anRz(-sd * (0.25 + fl)), ear = [[0, 0, 0.15], [-0.07, 0, 0.26], [-0.3, 0, 0.19], [-0.38, 0, -0.08], [-0.28, 0, -0.27], [-0.07, 0, -0.18]];
    b.push([-0.02, sd * 0.13, 0.02], R); b.sheet(ear.map((q) => [q[0], sd * 0.01, q[2]]), C.e); b.pop();
  }
};
const AN_CAT_HEAD = (b, s, C, D, k) => {
  const dog = D.id === 'dog', mo = dog && k.rxk === 'threat' ? Math.abs(Math.sin(s.rx.t * 9)) * k.rk : 0;
  if (dog) {
    b.ell([0.085, 0, -0.025], [0.07, 0.045, 0.04], null, C.b, { n1: 6, n2: 8 });
    b.push([0.05, 0, -0.045], anRy(0.5 * mo)); b.ell([0.05, 0, -0.01], [0.06, 0.035, 0.015], null, C.b2, { n1: 5, n2: 8 }); b.pop();
    b.ball([0.155, 0, -0.015], 0.016, '#1E1E22');
    for (const sd of [1, -1]) { const fl = 0.15 * Math.sin(s.t * 2 + sd); b.sheet([[-0.01, sd * 0.06, 0.05], [-0.04, sd * (0.1 + fl * 0.1), -0.06], [-0.07, sd * 0.07, 0.04]], C.e); }
  } else {
    b.ell([0.06, 0, -0.02], [0.04, 0.045, 0.03], null, C.b2, { n1: 6, n2: 8 }); b.ball([0.098, 0, -0.005], 0.009, '#C98A8A');
    const flat = k.rxk === 'threat' ? k.rk : 0;
    for (const sd of [1, -1]) b.sheet([[0.0, sd * 0.025, 0.055], [-0.03 - 0.03 * flat, sd * (0.05 + 0.04 * flat), 0.115 - 0.05 * flat], [-0.06, sd * 0.06, 0.04], [-0.03, sd * 0.045, 0.06]], C.b);
    for (const sd of [1, -1]) for (const dz of [-0.006, 0.006]) b.line([[0.085, sd * 0.03, -0.015 + dz], [0.11, sd * 0.1, -0.005 + dz * 3]], 'rgba(60,60,70,0.55)', 0.0035);
  }
  b.eye([0.045, 0.042, 0.025], dog ? 0.013 : 0.016, [0.6, 1, 0.2], dog ? null : '#4E6B2A'); b.eye([0.045, -0.042, 0.025], dog ? 0.013 : 0.016, [0.6, -1, 0.2], dog ? null : '#4E6B2A');
};
function anTailUp(b, s, C, D, T0, k) {
  /* a cat holds its tail up in a curve (bushed out and straight up when frightened); a dog wags */
  const dog = D.id === 'dog', pts = [], wag = dog ? Math.sin(s.t * (k.sit ? 11 : 7)) * (0.35 + 0.4 * k.sit + 0.5 * (k.rxk === 'threat' ? k.rk : 0)) : Math.sin(s.t * 1.3) * 0.25;
  const L = D.Q.tl, n = 7;
  for (let i = 0; i <= n; i++) {
    const u = i / n, up = dog ? 0.75 + 0.4 * u : 0.35 + 1.6 * u * (1 - 0.5 * u) + 0.6 * k.arch, back = dog ? 0.6 : 1 - 0.6 * k.arch;
    pts.push(anAdd(T0, [-L * u * Math.cos(up) * back * 0.8, Math.sin(wag * u) * L * 0.6 * u, L * u * Math.sin(up) * 0.8 + (k.sit && !dog ? -0.25 * u : 0)]));
  }
  b.tube(pts, (t) => D.Q.tr * (1 + (dog ? 0 : 0.8 * k.arch)) * (1 - 0.45 * t), C.b, { sides: 7 });
}

/* ----- small things on the ground: grass, a flower, sand, soil, a twig. Drawn with the animal (pencil too) ----- */
function anGrass(b, x, y, k, col) {
  const n = 6; for (let i = 0; i < n; i++) { const a = i / n * 6.28 + x * 7, r = 0.02 * k, lean = 0.35 + 0.2 * Math.sin(i * 2.3 + y * 5);
    b.sheet([[x + Math.cos(a) * r, y + Math.sin(a) * r, 0], [x + Math.cos(a) * (r + 0.05 * k * lean), y + Math.sin(a) * (r + 0.05 * k * lean), 0.1 * k * (0.8 + 0.3 * Math.sin(i * 3.1))], [x + Math.cos(a + 0.3) * r, y + Math.sin(a + 0.3) * r, 0]], col || '#5E9E3A', { edge: false }); }
}
function anFlower(b, p, col, k) {
  k = k || 1; const top = [p[0], p[1], p[2] * 1];
  b.tube([[p[0], p[1], 0], [p[0] + 0.01, p[1], top[2] * 0.5], top], 0.008 * k, '#4E8A34', { sides: 5, cap: false });
  for (let i = 0; i < 2; i++) b.sheet([[p[0], p[1], top[2] * 0.35], [p[0] + (i ? 0.07 : -0.07) * k, p[1] + 0.02, top[2] * 0.45], [p[0] + (i ? 0.03 : -0.03) * k, p[1], top[2] * 0.55]], '#5E9E3A', { edge: false });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; b.sheet([[top[0], top[1], top[2]], [top[0] + Math.cos(a - 0.35) * 0.06 * k, top[1] + Math.sin(a - 0.35) * 0.06 * k, top[2] + 0.012], [top[0] + Math.cos(a) * 0.075 * k, top[1] + Math.sin(a) * 0.075 * k, top[2] + 0.018], [top[0] + Math.cos(a + 0.35) * 0.06 * k, top[1] + Math.sin(a + 0.35) * 0.06 * k, top[2] + 0.012]], col || '#E85A8A'); }
  b.ball([top[0], top[1], top[2] + 0.012], 0.022 * k, '#F2C230');
}
/* flat patches lie under everything, drawn straight on the paper; the shadow is soft and gets lighter as it rises */
function anPatch(c, P, cx, cy, rx, ry, fill, line, dots) {
  const q = []; for (let i = 0; i < 28; i++) { const a = i / 28 * 6.283, w = 1 + 0.06 * Math.sin(a * 3 + cx * 9) + 0.04 * Math.sin(a * 5 + cy * 7); q.push(P(cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w, 0)); }
  c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fillStyle = fill; c.fill();
  if (line) { c.strokeStyle = line; c.lineWidth = 1; c.stroke(); }
  if (dots) { let sd = 11; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }; c.fillStyle = dots; for (let i = 0; i < 60; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()), p = P(cx + Math.cos(a) * rx * r * 0.92, cy + Math.sin(a) * ry * r * 0.92, 0); c.fillRect(p[0], p[1], 1.6, 1.6); } }
}
function anShadow(c, P, x, y, z, rx, ry, h) {
  const al = anCl(0.13 - z * 0.08, 0.03, 0.13), q = [], ch = Math.cos(h), sh = Math.sin(h);
  for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283, u = Math.cos(a) * rx, v = Math.sin(a) * ry; q.push(P(x + u * ch - v * sh, y + u * sh + v * ch, 0)); }
  c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fillStyle = 'rgba(40,44,52,' + al.toFixed(3) + ')'; c.fill();
}
const AN_TUFTS = [[0.42, -0.3], [-0.36, 0.38], [0.1, 0.5], [-0.5, -0.2], [0.55, 0.25], [-0.1, -0.55]];
const anGrassField = (b) => { for (const [x, y] of AN_TUFTS) anGrass(b, x * 0.8, y * 0.8, 1.3); };

/* ----- the animals: Thai name, group, what it does in its loop, how it answers a touch ----- */
const AN_WALK = { go: 'เดิน', look: 'มองรอบตัว', flee: 'ตกใจ วิ่งหนี' };
const AN = {};
function anDef(id, d) { d.id = id; d.acts = Object.assign({}, AN_WALK, d.acts || {}); AN[id] = d; }
const AN_QCOW = { bx: 0.4, by: 0.17, bz: 0.19, zh: 0.5, fx: 0.27, hx: -0.27, hy: 0.1, fy: 0.1, fz: 0.48, hz: 0.5, l1: 0.27, l2: 0.27, lr: 0.055, lr2: 0.032, hoof: 0.03, step: 0.11, lift: 0.07, sx: 0.38, sz: 0.58, nl: 0.3, nr: 0.085, na: 0.45, naD: -1.05, ha: 0.95, haD: 1.75, hr: [0.13, 0.07, 0.075], down: 'graze', head: AN_COW_HEAD, tail: (b, s, C, D, T0, k) => anTailHang(b, s, T0, 0.36, 0.02, C.b, C.d, 0) };
anDef('cow', { th: 'วัว', en: 'cow', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', hint: 'เดินแล้วก้มกินหญ้า แตะแล้วตกใจวิ่งหนี', kw: 'โค วัวพื้นเมือง สัตว์กินพืช', go: 'walk', spd: 0.14, fast: 0.42, stride: 0.34, turn: 1.4, roam: 0.24, R: 0.85, tz: 0.32, react: 'flee', fleeLen: 0.5,
  loop: [['go', 7], ['graze', 6], ['look', 2.6], ['go', 6], ['graze', 5]], acts: { graze: 'ก้มกินหญ้า' }, C: { b: '#A0663A', b2: '#E6D2B4', d: '#3A2A20', m: '#5C4237', h: '#E6DCC4' },
  Q: AN_QCOW, draw: anQuad, props: anGrassField, sh: [0.5, 0.2] });
anDef('buffalo', { th: 'ควาย', en: 'water buffalo', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', hint: 'เดินช้า ๆ แล้วก้มเล็มหญ้า เขาโค้งยาว แตะแล้ววิ่งหนี', kw: 'กระบือ สัตว์กินพืช ไถนา', go: 'walk', spd: 0.11, fast: 0.36, stride: 0.34, turn: 1.2, roam: 0.24, R: 0.88, tz: 0.32, react: 'flee', fleeLen: 0.5,
  loop: [['go', 7], ['graze', 7], ['look', 2.6], ['go', 5]], acts: { graze: 'ก้มเล็มหญ้า' }, C: { b: '#4C4B52', b2: '#77737A', d: '#26262A', m: '#38373C', h: '#6A6258' },
  Q: Object.assign({}, AN_QCOW, { bx: 0.43, by: 0.2, bz: 0.21, zh: 0.48, fz: 0.46, hz: 0.48, l1: 0.26, l2: 0.26, lr: 0.06, hr: [0.14, 0.075, 0.08], na: 0.25, naD: -1.1, ha: 1.1, sz: 0.56 }), draw: anQuad, props: anGrassField, sh: [0.52, 0.22] });
anDef('elephant', { th: 'ช้าง', en: 'elephant', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', hint: 'เดิน แกว่งงวง โบกหู แตะแล้วชูงวงร้อง กางหู แล้วถอยหนี', kw: 'ช้างเอเชีย สัตว์กินพืช งวง งา', go: 'walk', spd: 0.12, fast: 0.3, stride: 0.42, turn: 1.0, roam: 0.2, R: 1.02, tz: 0.5, react: 'trumpet', fleeLen: 0.4,
  loop: [['go', 7], ['look', 3], ['graze', 5], ['go', 6]], acts: { graze: 'ใช้งวงเก็บหญ้า', trumpet: 'ชูงวงร้อง กางหู แล้วถอยหนี' }, C: { b: '#8D8987', b2: '#9C9896', d: '#5E5A58', e: '#9A908E', h: '#F2EBDC' },
  Q: Object.assign({}, AN_QCOW, { bx: 0.44, by: 0.25, bz: 0.29, zh: 0.8, fx: 0.25, hx: -0.27, hy: 0.14, fy: 0.15, fz: 0.75, hz: 0.78, l1: 0.385, l2: 0.385, lr: 0.11, lr2: 0.095, hoof: 0.06, step: 0.12, lift: 0.08, sx: 0.4, sz: 0.92, nl: 0.04, nr: 0.2, na: 0.3, naD: -0.1, ha: 0.25, haD: 0.55, hr: [0.17, 0.16, 0.18], head: AN_EL_HEAD, tail: (b, s, C, D, T0) => anTailHang(b, s, T0, 0.4, 0.018, C.b, C.d, 0) }), draw: anQuad, props: anGrassField, sh: [0.55, 0.3] });
anDef('cat', { th: 'แมว', en: 'cat', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', hint: 'เดินย่อง นั่งแกว่งหาง แตะแล้วหลังโก่ง ขนพอง แล้ววิ่งหนี', kw: 'แมวบ้าน สัตว์กินเนื้อ', go: 'walk', spd: 0.15, fast: 0.6, stride: 0.22, turn: 2.2, roam: 0.24, R: 0.62, tz: 0.2, react: 'threat', fleeLen: 0.45,
  loop: [['go', 5], ['sit', 6], ['go', 4], ['look', 2.4]], acts: { sit: 'นั่งแกว่งหาง', threat: 'หลังโก่ง ขนพอง ขู่ แล้ววิ่งหนี' }, C: { b: '#D9A15A', b2: '#F4E6CC', d: '#C98A8A' },
  Q: { bx: 0.27, by: 0.085, bz: 0.09, zh: 0.27, fx: 0.18, hx: -0.18, hy: 0.05, fy: 0.05, fz: 0.27, hz: 0.28, l1: 0.15, l2: 0.15, lr: 0.03, lr2: 0.018, hoof: 0.018, step: 0.08, lift: 0.05, sx: 0.24, sz: 0.31, nl: 0.08, nr: 0.05, na: 0.75, naD: 0.2, ha: 0.1, haD: 0.9, hr: [0.07, 0.065, 0.06], down: 'sniff', arch: true, tl: 0.36, tr: 0.018, head: AN_CAT_HEAD, tail: anTailUp }, draw: anQuad, sh: [0.34, 0.12] });
anDef('dog', { th: 'สุนัข', en: 'dog', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', hint: 'เดินดมกลิ่น นั่งกระดิกหาง แตะแล้วกระโดดถอย เห่า', kw: 'หมา สุนัขบ้าน สัตว์กินเนื้อ', go: 'walk', spd: 0.17, fast: 0.55, stride: 0.26, turn: 2.2, roam: 0.24, R: 0.66, tz: 0.22, react: 'threat', fleeLen: 0.35,
  loop: [['go', 5], ['sniff', 4], ['go', 4], ['sit', 5]], acts: { sniff: 'ดมกลิ่นที่พื้น', sit: 'นั่งกระดิกหาง', threat: 'กระโดดถอย เห่า กระดิกหาง' }, C: { b: '#B9814A', b2: '#EAD3B2', d: '#5A3A22', e: '#8B5A33' },
  Q: { bx: 0.29, by: 0.1, bz: 0.11, zh: 0.33, fx: 0.2, hx: -0.2, hy: 0.06, fy: 0.06, fz: 0.33, hz: 0.34, l1: 0.18, l2: 0.18, lr: 0.035, lr2: 0.022, hoof: 0.022, step: 0.09, lift: 0.06, sx: 0.27, sz: 0.38, nl: 0.12, nr: 0.06, na: 0.7, naD: -0.75, ha: 0.25, haD: 1.35, hr: [0.08, 0.06, 0.06], down: 'sniff', tl: 0.22, tr: 0.02, head: AN_CAT_HEAD, tail: anTailUp }, draw: anQuad, sh: [0.36, 0.13] });

/* ----- one frame on the canvas of the model box (scene3 calls this for a spec with an animal) ----- */
let AN_PEN = null;
function anColors(D, sp) { const C = Object.assign({}, D.C); if (sp.col && /^#[0-9a-f]{6}$/i.test(sp.col)) { C.b = sp.col; C.b2 = anTint(sp.col, 0.5); if (C.e) C.e = anTint(sp.col, -0.12); } return C; }
function anDraw(c, w, h, sp, r) {
  const D = AN[sp.animal];
  if (!D) { c.fillStyle = '#5A6472'; c.font = '14px Sarabun, sans-serif'; c.fillText('ไม่รู้จักสัตว์ชนิดนี้', 16, 24); return true; }
  const s = r.st.an || (r.st.an = anNew(D)), t0 = performance.now();
  if (!AN_PEN) { try { AN_PEN = MODEV.scene ? MODEV.scene('pencilTex') : null; } catch (e) { AN_PEN = null; } }
  const R = D.R || 1.1, tz = D.tz || 0, cm = r.cam || CAM0, Dd = R * 3.2 / (cm.zoom || 1), P0 = cam3(r, w, h, R, tz);
  const E = [Math.sin(cm.yaw) * Math.cos(cm.pitch) * Dd, -Math.cos(cm.yaw) * Math.cos(cm.pitch) * Dd, Math.sin(cm.pitch) * Dd + tz];
  /* out on the paper: the view goes with the animal (its box moves on the page), no patch of ground under it */
  const pg = r.pg && !sp.thumb ? r.pg : null, ox = pg ? s.x : 0, oy = pg ? s.y : 0, P = pg ? (x, y, z) => P0(x - ox, y - oy, z) : P0;
  if (pg) { E[0] += ox; E[1] += oy; }
  const pen = !!sp.pen, C = anColors(D, sp), g = new G3(P), gs = new G3(P), b = new AnB(g, gs, P, E, pen);
  /* in pencil on the paper (no frame), the grain goes straight onto this canvas while only the animal is on it, and the
     ground and shadow go in under it afterwards: no second canvas to fill and copy every frame (owner 21 พ.ย. 2569: it lagged) */
  const direct = pen && AN_PEN && sp.clean, under = sp.thumb ? () => {} : () => {
    if (D.ground && !pg) D.ground(c, P, s, C, D);
    if (D.sh && !s.hidden) anShadow(c, P, s.x, s.y, Math.max(0, s.z), D.sh[0] * (s.shk || 1), D.sh[1] * (s.shk || 1), s.h);
  };
  if (!direct) under();
  /* on the paper its flower, branch or stump is there only while it sits on it */
  if (D.props && !(sp.thumb && D.props === anGrassField) && (!pg || s.porg)) { if (pg) b.push([s.porg[0], s.porg[1], 0]); D.props(b, s, C); if (pg) b.pop(); }
  b.clip = !!D.clip;
  if (!s.hidden) { const tl = pg && pg.sl ? pg.sl * Math.cos(s.h - cm.yaw) : 0; b.push([s.x, s.y, s.z], tl ? anMm(anRz(s.h), anRy(-tl)) : anRz(s.h)); D.draw(b, s, C, D); b.pop(); }
  /* on the paper the view goes with the animal, so its ink goes along around it (left behind it would be cut off the canvas) */
  for (const q of s.ink) { const u = q.t / 3.2, p = anAdd(pg ? anAdd(q.p, [s.x - q.p[0], s.y - q.p[1], 0]) : q.p, anMul(q.v, Math.min(q.t, 1.6))); gs.L.push({ t: 'b', d: P(p[0], p[1], p[2])[2] - 1e-4, q: P(p[0], p[1], p[2]), r: Math.max(2, q.r * (1 + u * 2.5) * P(p[0], p[1], p[2])[3]), col: 'rgba(30,30,40,' + (0.32 * (1 - u)).toFixed(2) + ')', ink: 1 }); }
  if (direct) { g.draw(c); anGrain(c, g, r); c.save(); c.globalCompositeOperation = 'destination-over'; under(); c.restore(); }
  else if (pen && AN_PEN) anPencil(c, g, r); else g.draw(c);
  anSharp(c, gs);
  if (r.box && r.anM && !sp.thumb) { const bx = anClip(c.canvas, w, h, [g, gs], s, P, D, r.anM, !pg), q = P(s.x, s.y, 0), q0 = q[0]; r.anBB = bx; if (pg && bx) { pg.ext = [bx[0] - q0, bx[1] - q0]; pg.headH = Math.max(0, q[1] - bx[2] - Math.max(0, s.z) * q[3]); } }
  const doing = r.pg && r.pg.gone ? 'ถูก' + r.pg.gone.by + 'จับกิน อีกสักพักจะมีตัวใหม่เดินเข้ามา' : s.rx && s.rx.say ? ((AN_WSAY1[D.id] || {})[s.rx.wk || ''] || s.rx.say) : s.rx ? ((AN_SAY[D.id] || {})[s.rx.k] || D.acts[s.rx.k] || AN_DO[s.rx.k] || D.acts.flee) : (D.acts[s.act] || '');
  /* the menu of the box shows the first two: the animal with its group, and the trait exam questions ask about */
  r.read = [['สัตว์', D.th + ' (' + D.grp + ')']]; if (D.fact) r.read.push(['จุดเด่น', D.fact]); r.read.push(['กำลัง', doing]);
  r.anFaces = b.n; const ms = performance.now() - t0; r.anMs = r.anMs == null ? ms : r.anMs * 0.9 + ms * 0.1;
  return true;
}
/* coloured pencil, the light way: the animal on a layer of its own, its colour broken by the grain of the paper
   (the grain of scene3, so it matches the orbitals); its outline is already drawn by the solids themselves */
function anPencil(c, g, r) {
  const M = c.getTransform(), cw = c.canvas.width, ch = c.canvas.height;
  let L = r.anLayer; if (!L) L = r.anLayer = document.createElement('canvas'); if (L.width !== cw) L.width = cw; if (L.height !== ch) L.height = ch;
  const a = L.getContext('2d'); a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over'; a.clearRect(0, 0, cw, ch);
  a.setTransform(M); g.draw(a); a.setTransform(1, 0, 0, 1, 0, 0);
  a.globalCompositeOperation = 'destination-in'; a.fillStyle = a.createPattern(AN_PEN(), 'repeat'); a.fillRect(0, 0, cw, ch); a.globalCompositeOperation = 'source-over';
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(L, 0, 0); c.restore();
}
/* the grain of the paper over what is drawn, inside the box round the animal only */
function anGrain(c, g, r) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const add = (q, m) => { if (q[0] - m < x0) x0 = q[0] - m; if (q[0] + m > x1) x1 = q[0] + m; if (q[1] - m < y0) y0 = q[1] - m; if (q[1] + m > y1) y1 = q[1] + m; };
  for (const e of g.L) { if (e.t === 'p') for (const q of e.q) add(q, 2); else if (e.t === 'l') { add(e.a, e.lw); add(e.b, e.lw); } else if (e.t === 'b') add(e.q, e.r + 1); }
  if (x1 < x0) return;
  const M = c.getTransform(), X0 = Math.floor(Math.max(0, M.a * x0 + M.e)), Y0 = Math.floor(Math.max(0, M.d * y0 + M.f)), X1 = Math.ceil(Math.min(c.canvas.width, M.a * x1 + M.e)), Y1 = Math.ceil(Math.min(c.canvas.height, M.d * y1 + M.f));
  if (X1 <= X0 || Y1 <= Y0) return;
  if (!r.anPat || r.anPatC !== c) { r.anPat = c.createPattern(AN_PEN(), 'repeat'); r.anPatC = c; }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.beginPath(); c.rect(X0, Y0, X1 - X0, Y1 - Y0); c.clip();
  c.globalCompositeOperation = 'destination-in'; c.fillStyle = r.anPat; c.fillRect(X0, Y0, X1 - X0, Y1 - Y0); c.restore();
}
/* eyes and ink: bright on top of the pencil */
function anSharp(c, gs) {
  gs.L.sort((m, n) => n.d - m.d);
  for (const e of gs.L) {
    if (e.ink) { c.fillStyle = e.col; c.beginPath(); c.arc(e.q[0], e.q[1], e.r, 0, 6.283); c.fill(); continue; }
    const [x, y] = e.q, rr = e.r; c.fillStyle = e.col; c.beginPath(); c.arc(x, y, rr, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(x - rr * 0.32, y - rr * 0.34, Math.max(0.8, rr * 0.3), 0, 6.283); c.fill();
  }
}
function anTick(sp, r, dt) { const D = AN[sp.animal]; if (!D) return; const s = r.st.an || (r.st.an = anNew(D)); const n = Math.max(1, Math.ceil(dt / 0.02)); for (let i = 0; i < n; i++) anStep(D, s, dt / n); }
/* a tap at (x, y) on the canvas: the animal answers, away from the finger */
function anTap(sp, r, x, y, w, h) {
  const D = AN[sp.animal]; if (!D || !r.st) return false; const s = r.st.an || (r.st.an = anNew(D));
  const P = cam3(r, w, h, D.R || 1.1, D.tz || 0), q = r.pg ? P(0, 0, s.z + 0.15) : P(s.x, s.y, s.z + 0.15), cm = r.cam || CAM0;
  let dx = q[0] - x, dy = q[1] - y; if (Math.hypot(dx, dy) < 4) { dx = Math.cos(s.h + 2.4); dy = Math.sin(s.h + 2.4); }
  /* on the screen to on the ground: right is (cos yaw, sin yaw), up the screen is away from the viewer */
  const cy = Math.cos(cm.yaw), sy = Math.sin(cm.yaw), d = [dx * cy + dy * sy, dx * sy - dy * cy];
  return anReact(D, s, d);
}

/* ----- out on the paper (owner 22 พ.ย. 2569, switch "onpage"): a frameless animal walks over the whole page. Its box goes
   with it (the box is only the canvas round the animal); the page is seen from the side: what holds it up is the top of a
   box, a line of ink, or the level where it was put down; the side of a box or a steep line stops it and it turns back;
   flyers and swimmers go over what is low enough; two animals that meet answer each other. Nothing is saved while it
   walks: where it is goes with the page the next time the page is saved for another reason ----- */
const AN_PAGE = new Map();
let AN_CLK = 0;
let AN_ENV = null;
function anPageOn(sp) { return !!(sp && sp.clean && !sp.stay && !sp.thumb && (typeof flagOn !== 'function' || flagOn('onpage')) && (typeof planOn !== 'function' || planOn('onpage'))); }
/* everything on the page an animal can stand on or bump into, as segments; built again at most twice a second, and only
   when the lines or the boxes changed */
function anEnvSig() {
  let n = 0, a = 0; for (const r of allStrokes()) { const p = r.s.p || []; n++; a = (a * 31 + p.length + (p[0] | 0) + (p[1] | 0)) % 2147483647; }
  let b = 0; for (const it of visibleItems()) { if (AN_PAGE.has(it.id)) continue; b = (b * 17 + Math.round((it.x || 0) + (it.y || 0) * 3 + (it.w || 0) * 7)) % 2147483647; }
  return n + ':' + a + ':' + b + ':' + S.pid + ':' + visibleItems().length;
}
let AN_ENVT = 0;
function anEnv(dt) {
  /* a line or a box added or taken away, or another page: at once; else looked at again every half second of the
     animals' time (so a test that drives it is the same every run) */
  let n = S.mine.length + visibleItems().length; for (const k in S.others) n += S.others[k].length;
  AN_ENVT += dt; if (AN_ENV && AN_ENVT < 0.5 && AN_ENV.n === n && AN_ENV.pid === S.pid) return AN_ENV;
  AN_ENVT = 0; const t = performance.now(), sig = anEnvSig(); if (AN_ENV && AN_ENV.sig === sig) return AN_ENV;
  const L = [], on = new Set();
  /* lines of ink: every few points, with the box of each line to skip it quickly */
  for (const r of allStrokes()) {
    const st = r.s, p = st.p || []; if (st.on) { on.add(st.on); if (AN_PAGE.has(st.on)) continue; }
    if (p.length < 6) continue; const seg = []; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, px = p[0] / 10, py = p[1] / 10;
    const step = p.length > 900 ? 9 : p.length > 180 ? 6 : 3; /* every point of a short line (its corners), every second or third of a long one */
    for (let i = step; ; i += step) { const j = Math.min(i, p.length - 3), x = p[j] / 10, y = p[j + 1] / 10; if (Math.hypot(x - px, y - py) > 0.5) { seg.push([px, py, x, y]); px = x; py = y; } if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (j >= p.length - 3) break; }
    const f0 = p[0] / 10, g0 = p[1] / 10; x0 = Math.min(x0, f0); x1 = Math.max(x1, f0); y0 = Math.min(y0, g0); y1 = Math.max(y1, g0);
    if (seg.length) L.push({ b: [x0, y0, x1, y1], seg, k: 'L:' + (st.id || p[0] + ',' + p[1] + ',' + p.length) });
  }
  /* boxes: their top to stand on and their sides to bump into (a text box only where its words are) */
  const R = [];
  for (const it of visibleItems()) {
    if (AN_PAGE.has(it.id) || isBgItem(it) || it.type === 'life' || (it.spec && (it.spec.bare || it.spec.clean))) continue;
    if (it.type === 'scene' && it.fr === 0 && it.spec && it.spec.domain === 'phys' && it.spec.dim !== 3 && (typeof flagOn !== 'function' || flagOn('pagemove')) && (typeof planOn !== 'function' || planOn('pagemove'))) continue; /* a frameless model out on the paper: its bodies are met (anActors), not its box */
    const el = itemsEl.querySelector('[data-id="' + it.id + '"]'); if (!el || el.hidden || !el.offsetHeight) continue;
    const b = !it.type || it.type === 'text' ? tightItemBox(it) : itemBox(it); if (b[2] - b[0] < 4 || b[3] - b[1] < 4) continue;
    R.push({ id: it.id, b, seg: [[b[0], b[1], b[2], b[1]], [b[0], b[1], b[0], b[3]], [b[2], b[1], b[2], b[3]]] });
  }
  AN_ENV = { t, sig, L, R, on, n, pid: S.pid }; return AN_ENV;
}
/* the segments near x0..x1 (and the boxes the animal is not standing inside) */
function anEnvNear(E, x0, x1, skip) {
  const out = []; for (const l of E.L) if (l.b[2] >= x0 && l.b[0] <= x1 && !skip.has(l.k)) for (const q of l.seg) out.push(q);
  for (const o of E.R) if (!skip.has(o.id) && o.b[2] >= x0 && o.b[0] <= x1) for (const q of o.seg) out.push(q);
  return out;
}
/* the highest thing under x from height top down to lim, and its slope; null if nothing */
function anSupport(segs, x, top, lim) {
  let best = null, sl = 0;
  for (const q of segs) {
    const a = Math.min(q[0], q[2]), b = Math.max(q[0], q[2]); if (x < a || x > b || b - a < 0.01) continue;
    const y = q[1] + (q[3] - q[1]) * (x - q[0]) / (q[2] - q[0]); if (y < top || y > lim) continue;
    if (best == null || y < best) { best = y; sl = (q[3] - q[1]) / (q[2] - q[0]); }
  }
  return best == null ? null : [best, sl];
}
/* does a level line at height y from x0 to x1 cross anything (with steep: only what is steeper than that) */
function anHits(segs, x0, x1, y, steep) {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  for (const q of segs) {
    if ((q[1] - y) * (q[3] - y) > 0 || q[1] === q[3]) continue;
    if (steep && Math.abs(q[3] - q[1]) < steep * Math.abs(q[2] - q[0])) continue; /* only a wall: steeper than this */
    const x = q[0] + (q[2] - q[0]) * (y - q[1]) / (q[3] - q[1]); if (x >= a && x <= b) return true;
  }
  return false;
}
/* only the animal and its shadow take a finger or the pen (with a frame, the box too): round it everything goes through to
   the page (a clip of the canvas, which is bigger than the box; out on the paper the box itself takes nothing, .onpage) */
function anClip(cv, w, h, gl, s, P, D, M, box) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const add = (x, y, m) => { if (x - m < x0) x0 = x - m; if (x + m > x1) x1 = x + m; if (y - m < y0) y0 = y - m; if (y + m > y1) y1 = y + m; };
  for (const g of gl) for (const e of g.L) { if (e.t === 'p') for (const q of e.q) add(q[0], q[1], 2); else if (e.t === 'l') { add(e.a[0], e.a[1], e.lw); add(e.b[0], e.b[1], e.lw); } else if (e.t === 'b') add(e.q[0], e.q[1], e.r + 1); }
  if (D.sh) { const q = P(s.x, s.y, 0); add(q[0], q[1], D.sh[0] * q[3] + 2); }
  if (x1 < x0) { x0 = w / 2 - 20; x1 = w / 2 + 20; y0 = h / 2 - 20; y1 = h / 2 + 20; }
  const ext = [x0, x1, y0, y1];
  /* in its box (with a frame, or kept at its place): the whole box still takes a finger as before (to turn it), and the
     animal where it goes past it */
  if (box) { x0 = Math.min(x0, 0); y0 = Math.min(y0, 0); x1 = Math.max(x1, w); y1 = Math.max(y1, h); }
  const W2 = w + M[0] + M[2], H2 = h + M[1] + M[3]; x0 += M[0]; x1 += M[0]; y0 += M[1]; y1 += M[1];
  const m = 8, v = [Math.max(0, y0 - m), Math.max(0, W2 - x1 - m), Math.max(0, H2 - y1 - m), Math.max(0, x0 - m)].map((x) => Math.floor(x / 4) * 4);
  const k = v.join(); if (cv._clip === k) return ext; cv._clip = k;
  const css = 'inset(' + v.map((x) => x + 'px').join(' ') + ')'; cv.style.clipPath = css; cv.style.webkitClipPath = css;
  return ext;
}
function anUnclip(r) { const cv = r.cv; if (!cv) return; const el = cv.closest('.item'); if (el) el.classList.remove('onpage'); }
/* is (x, y) on the way it has come (within 2 points of it) */
function anOnTrail(T, x, y) {
  for (let i = 0; i < T.length; i++) { const a = T[i], b = T[i + 1] || a, dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0; if (Math.hypot(a[0] + dx * u - x, a[1] + dy * u - y) < 2) return true; }
  return false;
}
/* one tick of an animal out on the paper: 'draw' or 'skip' (this frame not drawn); false when it is not one (then it
   lives in its box as before) */
function anPage(it, r, dt) {
  const sp = it.spec, D = AN[sp.animal]; if (!D || !r.st) return false;
  if (!anPageOn(sp) || !r.cv || !r.cv.isConnected || (AN_ENV && AN_ENV.on.has(it.id))) {
    if (r.pg) { r.pg = null; r.st.an = null; } AN_PAGE.delete(it.id); anUnclip(r); return false;
  }
  const el = r.cv.closest('.item'); if (!el) return false; if (!el.classList.contains('onpage')) el.classList.add('onpage');
  const bx = r.box || r.cv, s = r.st.an || (r.st.an = anNew(D)), cm = r.cam || CAM0, cw = bx.clientWidth, ch = bx.clientHeight; if (!cw || !ch) return false;
  const P = cam3(r, cw, ch, D.R || 1.1, D.tz || 0), o = P(0, 0, 0), k = o[3], fx0 = bx.offsetLeft + o[0], fy0 = bx.offsetTop + o[1];
  let pg = r.pg;
  /* the page saved a moment ago and read back (the store's echo, or another device's copy of an older save) carries a
     place it has just walked through: that is not a move, it stays where it is now */
  if (pg && (pg.lx !== it.x || pg.ly !== it.y) && pg.trail && anOnTrail(pg.trail.concat([[pg.lx, pg.ly]]), it.x, it.y)) { it.x = pg.lx; it.y = pg.ly; }
  /* put down, moved, undone or come back from another device: it stands where its box now is */
  if (!pg || pg.lx !== it.x || pg.ly !== it.y) {
    pg = r.pg = { dir: Math.cos(s.h - cm.yaw) >= 0 ? 1 : -1, fx: it.x + fx0, fy: it.y + fy0, vy: 0, sl: 0, hold: 0, bt: 0, meet: {}, face: null };
    pg.floor = pg.fy; pg.land = 1; pg.at = [it.x, it.y]; /* where it was put down */ pg.trail = [[it.x, it.y]]; if (s.perched && !s.porg) s.porg = [s.x, s.y];
  }
  pg.R = [Math.cos(cm.yaw), Math.sin(cm.yaw)];
  /* the animals' own clock (seconds): one that is not ticking any more (deleted, another page) falls behind and is left out */
  if (pg.clock == null) pg.clock = AN_CLK; pg.clock += dt; if (pg.clock > AN_CLK) AN_CLK = pg.clock;
  AN_PAGE.set(it.id, { it, r, D, s, pg, k, w: cw, h: ch, t: pg.clock });
  /* picked, or its handles out: it waits */
  if (el.classList.contains('picked') || el.classList.contains('hkon') || (S.sel && S.sel.items && S.sel.items.includes(it.id))) return 'skip';
  const E = anEnv(dt);
  /* eaten: away for a while, then another of its kind walks in from the nearest edge of the page, on the same line */
  if (pg.gone) {
    pg.gone.back -= dt; if (pg.gone.back > 0) return pg.gone.drawn ? 'skip' : ((pg.gone.drawn = 1), 'draw');
    const left = pg.fx < W / 2; pg.fx = left ? cw * 0.3 : W - cw * 0.3; pg.fy = pg.floor; pg.dir = left ? 1 : -1; pg.gone = null; s.hidden = false; s.rx = null; s.tg = null; pg.calm = 6;
  }
  /* a leap up or down to another line (or at a flyer): along its arc, nothing else this step */
  if (pg.leap) {
    const L = pg.leap; L.u = Math.min(1, L.u + dt / L.T); pg.fx = L.x0 + (L.x1 - L.x0) * L.u; pg.fy = L.y0 + (L.y1 - L.y0) * L.u - 4 * L.H * L.u * (1 - L.u) + (L.y1 - L.y0) * 0;
    s.h = anAng(s.h + anCl(anAng(Math.atan2(pg.R[1] * Math.sign(L.x1 - L.x0 || 1), pg.R[0] * Math.sign(L.x1 - L.x0 || 1)) - s.h), -8 * dt, 8 * dt));
    if (L.u >= 1) { pg.fy = L.y1; pg.floor = L.y1; pg.leap = null; pg.vy = 0; }
    it.x = Math.round((pg.fx - fx0) * 10) / 10; it.y = Math.round((pg.fy - fy0) * 10) / 10; pg.lx = it.x; pg.ly = it.y; el.style.left = it.x + 'px'; el.style.top = it.y + 'px';
    return 'draw';
  }
  /* who meets whom, ten times a second (not every frame: light on an iPad with many animals) */
  pg.socT = (pg.socT || 0) + dt; if (pg.socT >= 0.1) { anSocial(it.id, pg.socT, E); pg.socT = 0; }
  const zb = s.z, fb = pg.fy, x0 = s.x, y0 = s.y, step = 0.02, n = Math.max(1, Math.ceil(dt / step));
  AN_FREE = pg; try { for (let i = 0; i < n; i++) anStep(D, s, dt / n); } finally { AN_FREE = null; }
  const stepUp = Math.max(4, ch * 0.1), body = ch * 0.3, air = (D.go === 'fly' || D.go === 'swim' || (D.air && !s.hop)) && s.z > 0.02, zp = air ? s.z * k : 0;
  let dx = ((s.x - x0) * pg.R[0] + (s.y - y0) * pg.R[1]) * k;
  if (pg.hold > 0) { pg.hold -= dt; dx = 0; s.v = 0; if (pg.face != null) s.h = anAng(s.h + anCl(anAng(pg.face - s.h), -4 * dt, 4 * dt)); }
  /* what bumps is the front of the animal (its nose, or its tail going backwards), not the middle of its feet (owner
     22 พ.ย. 2569: it walked half into a line before it stopped); from the last picture of it */
  const nx = pg.fx + dx, ex = pg.ext || [-cw * 0.25, cw * 0.25], sg = dx >= 0 ? 1 : -1, front = anCl(sg > 0 ? ex[1] : -ex[0], 4, cw * 0.48) * sg;
  /* the boxes it stands in front of (put down over them) do not stop it */
  const skip = new Set(); for (const q of E.R) if (pg.fx > q.b[0] && pg.fx < q.b[2] && pg.fy - zp > q.b[1] + stepUp && pg.fy - zp - body < q.b[3]) skip.add(q.id);
  /* a line drawn across its body (owner 23 พ.ย. 2569: a cat with lines written over it stood stuck on them): it is not a
     wall or ground for this animal until it has walked clear of it, so it walks off it whichever way it goes */
  {
    const ex0 = pg.ext || [-cw * 0.25, cw * 0.25], fe0 = pg.fy - zp, bx = [pg.fx + ex0[0], fe0 - (pg.headH || body), pg.fx + ex0[1], fe0 - stepUp];
    const over = (l) => l.b[2] >= bx[0] && l.b[0] <= bx[2] && l.b[3] >= bx[1] && l.b[1] <= bx[3] && l.seg.some((q) => Math.max(q[0], q[2]) >= bx[0] && Math.min(q[0], q[2]) <= bx[2] && Math.max(q[1], q[3]) >= bx[1] && Math.min(q[1], q[3]) <= bx[3]);
    const first = !pg.under; if (first) { pg.under = new Set(); pg.known = new Set(); }
    if (pg.envSeen !== E) {
      pg.envSeen = E;
      for (const l of E.L) if (!pg.known.has(l.k)) {
        pg.known.add(l.k); if (!over(l)) continue; pg.under.add(l.k);
        /* written over just now (not there when it was put down): the pen came across it, so it starts away from the line,
           the way it answers a touch */
        if (!first && !s.rx && !s.hidden) { const side = (l.b[0] + l.b[2]) / 2 > pg.fx ? -1 : 1; pg.dir = side; anReact(D, s, [pg.R[0] * side, pg.R[1] * side, 0]); }
      }
    }
    if (pg.under.size) for (const l of E.L) if (pg.under.has(l.k)) { if (over(l)) skip.add(l.k); else pg.under.delete(l.k); }
  }
  /* the nose sweeps from where it was last time (turning round brings the nose round to the other side: it does not jump
     through a line that way) */
  const nose0 = pg.nose != null && pg.noseSg === sg ? pg.nose : pg.fx + front;
  const segs = anEnvNear(E, Math.min(pg.fx, nose0, nx + front) - 2, Math.max(pg.fx, nose0, nx + front) + 2, skip), fe = pg.fy - zp;
  let blocked = (nx + front < 4 && dx < 0) || (nx + front > W - 4 && dx > 0), sup = null;
  if (!blocked && Math.abs(dx) > 1e-4) {
    /* the feet trip on what is higher than a step; the nose (or tail) stops at a wall: a side of a box or a steep line */
    blocked = anHits(segs, pg.fx, nx, fe - stepUp - 1) || anHits(segs, nose0, nx + front, fe - stepUp - 1, 1.6) || anHits(segs, nose0, nx + front, fe - body, 1.6);
    if (!blocked) { sup = anSupport(segs, nx, fe - stepUp, Math.max(pg.floor, pg.fy) + 60); if (!air && sup && sup[0] < pg.fy - 0.5 && Math.abs(sup[1]) > 1.6 && Math.sign(dx) === Math.sign(-sup[1])) blocked = true; }
  }
  if (blocked) {
    /* bumped into something: stops, and goes the other way */
    if (pg.bt <= 0) {
      pg.dir = dx > 0 ? -1 : dx < 0 ? 1 : -pg.dir; pg.bt = 0.6; s.tg = null; s.v *= 0.2; s.hop = null;
      if (s.rx && s.rx.tg) { s.rx.tg = [2 * s.x - s.rx.tg[0], 2 * s.y - s.rx.tg[1]].concat(s.rx.tg.slice(2)); if (s.rx.d) s.rx.d = [-s.rx.d[0], -s.rx.d[1], 0]; }
    }
  } else pg.fx = nx;
  if (Math.abs(dx) > 1e-4) { pg.nose = pg.fx + front; pg.noseSg = sg; }
  pg.bt -= dt;
  /* what holds it up where it is now */
  if (!sup || blocked) sup = anSupport(anEnvNear(E, pg.fx - 1, pg.fx + 1, skip), pg.fx, fe - stepUp, Math.max(pg.floor, pg.fy) + 60);
  /* nothing under it: the level where it was put down, unless it is already lower (a line under it was rubbed out) */
  let gy = sup ? sup[0] : pg.floor >= pg.fy - stepUp ? pg.floor : pg.fy, sl = sup ? sup[1] : 0;
  if (air) { s.z = Math.max(0, s.z + (gy - pg.fy) / k); pg.fy = gy; pg.vy = 0; }
  else if (gy < pg.fy) { pg.fy = gy; pg.vy = 0; }
  else if (gy > pg.fy + 0.5) { pg.vy += 2400 * dt; pg.fy = Math.min(gy, pg.fy + pg.vy * dt); sl = 0; }
  else { pg.fy = gy; pg.vy = 0; }
  /* a flyer or swimmer has a ceiling too (owner 22 พ.ย. 2569: a bird ringed round with ink flew out over the top): what is
     drawn above its head, where it is, it does not rise through */
  if (D.go === 'fly' || D.go === 'swim' || D.air) {
    const hh = pg.headH || body, top = fb - zb * k - hh; /* the top of its head before this step (it may have risen through a line in this step) */ let ceil = -1e9;
    /* over the width of its body, not only above its feet (its head is to one side, where a ring curves lower) */
    const ex = pg.ext || [-cw * 0.2, cw * 0.2], xa = pg.fx + ex[0] * 0.8, xb = pg.fx + ex[1] * 0.8, near = anEnvNear(E, xa - 1, xb + 1, skip);
    for (let i = 0; i <= 6; i++) { const X = xa + (xb - xa) * i / 6; for (const q of near) { const a = Math.min(q[0], q[2]), b = Math.max(q[0], q[2]); if (X < a || X > b || b - a < 0.01) continue; const y = q[1] + (q[3] - q[1]) * (X - q[0]) / (q[2] - q[0]); if (y < top - 1 && y > ceil) ceil = y; } }
    if (ceil > -1e9) { const zmax = Math.max(0, (pg.fy - ceil - 3 - hh) / k); if (s.z > zmax) { s.z = zmax; if (s.vz > 0) s.vz = 0; } }
  }
  /* where it lands after being put down is its level from then on (the paper under it) */
  if (pg.land && !pg.vy) { pg.floor = pg.fy; pg.land = 0; }
  /* leans with the slope it walks on */
  const want = D.clip ? 0 : anCl(Math.atan(-sl), -0.6, 0.6); pg.sl += (want - pg.sl) * Math.min(1, 8 * dt);
  /* how fast it goes along the page now, for the moving pictures it meets (pagewalk.js: a ball it walks into is kicked on) */
  pg.vx = pg.pfx != null && dt > 0 ? (pg.fx - pg.pfx) / dt : 0; pg.pfx = pg.fx;
  it.x = Math.round((pg.fx - fx0) * 10) / 10; it.y = Math.round((pg.fy - fy0) * 10) / 10; pg.lx = it.x; pg.ly = it.y;
  el.style.left = it.x + 'px'; el.style.top = it.y + 'px';
  /* where it has been in the last 15 seconds (to know its own echo, above) */
  pg.trT = (pg.trT || 0) + dt; if (pg.trT >= 0.25) { pg.trT = 0; (pg.trail || (pg.trail = [])).push([it.x, it.y]); if (pg.trail.length > 60) pg.trail.shift(); }
  r.anAcc = (r.anAcc || 0) + dt; if (r.anAcc < (r.anMs > 14 ? 0.05 : 0.03)) return 'skip'; r.anAcc = 0;
  return 'draw';
}
/* ----- who meets whom out on the paper (owner 22 พ.ย. 2569: as in nature, every kind of thing, not too cruel but true):
   each animal's size, what it eats, how high it can leap up and drop down, and how it lives (in a herd, alone and
   keeping its ground, shy, tame, dangerous to hunters, playful). Read by anSocial for other animals and for the drawn
   pictures that move (people, vehicles, balls, things) ----- */
const anList = (t) => { const o = {}; for (const part of t.split('|')) { const [k, v] = part.split(':'); for (const id of v.trim().split(/\s+/)) o[id] = isNaN(+k) ? k : +k; } return o; };
/* size: 1 tiny (insects, worms) ... 6 huge (elephant, whale) */
const AN_SIZE = anList('1:ant mosquito housefly bee butterfly dragonfly grasshopper cockroach spider scorpion caterpillar worm planaria hydra leech snail tadpole beetle centipede millipede sponge anemone urchin starfish clam shrimp seahorse|'
  + '2:rat frog ricefrog toad gecko houselizard gardenlizard bird parrot crab fish squid catfish mudskipper caecilian kiwi bat octopus turtle platypus echidna pangolin owl jellyfish|'
  + '3:cat chicken duck cobra monkey penguin flamingo peacock anteater dog|4:goat pig deer kangaroo seal ostrich emu cassowary panda bear dolphin shark crocodile orangutan|'
  + '5:lion tiger cow buffalo horse zebra camel|6:elephant rhino hippo giraffe whale');
/* what each one hunts and eats (all in this book of animals) */
const AN_EATS = {
  lion: 'deer zebra buffalo giraffe horse goat pig cow ostrich camel', tiger: 'deer pig buffalo goat cow horse monkey',
  cat: 'rat bird parrot kiwi gecko houselizard gardenlizard cockroach grasshopper fish mudskipper', dog: 'rat kiwi',
  crocodile: 'deer zebra buffalo pig goat fish catfish duck turtle dog monkey', shark: 'fish seal squid octopus catfish penguin turtle', dolphin: 'fish squid',
  whale: 'shrimp', seal: 'fish squid octopus shrimp catfish penguin', penguin: 'fish squid shrimp', owl: 'rat frog ricefrog toad gecko houselizard bird bat',
  bat: 'mosquito housefly butterfly beetle grasshopper', cobra: 'rat frog ricefrog toad bird gecko houselizard gardenlizard',
  frog: 'mosquito housefly ant cockroach grasshopper worm caterpillar spider', ricefrog: 'mosquito housefly ant grasshopper caterpillar',
  toad: 'mosquito housefly ant cockroach grasshopper worm caterpillar beetle', gecko: 'mosquito housefly ant cockroach butterfly grasshopper spider houselizard',
  houselizard: 'mosquito housefly ant cockroach', gardenlizard: 'ant grasshopper cockroach caterpillar butterfly',
  chicken: 'worm ant grasshopper caterpillar cockroach centipede spider houselizard housefly', duck: 'snail worm tadpole shrimp grasshopper',
  bird: 'worm caterpillar grasshopper ant mosquito housefly spider butterfly', peacock: 'worm grasshopper cobra gardenlizard centipede', ostrich: 'grasshopper caterpillar',
  emu: 'grasshopper caterpillar', cassowary: 'grasshopper caterpillar', kiwi: 'worm caterpillar spider', flamingo: 'shrimp',
  spider: 'mosquito housefly butterfly ant grasshopper cockroach', scorpion: 'cockroach grasshopper spider', centipede: 'cockroach spider ant worm grasshopper',
  dragonfly: 'mosquito housefly', mudskipper: 'ant housefly mosquito shrimp worm', catfish: 'shrimp worm tadpole snail',
  octopus: 'crab shrimp clam fish', squid: 'shrimp fish', starfish: 'clam', seahorse: 'shrimp',
  anteater: 'ant', pangolin: 'ant', echidna: 'ant', platypus: 'worm shrimp tadpole', pig: 'worm snail', monkey: 'grasshopper caterpillar spider',
  orangutan: 'ant caterpillar', rat: 'cockroach', turtle: 'jellyfish snail worm', crab: 'clam worm', bear: 'fish catfish ant bee deer'
};
/* how often a catch works, from field studies (a lion about one hunt in four) */
const AN_CATCH = { lion: 0.3, tiger: 0.35, cat: 0.5, dog: 0.3, owl: 0.5, crocodile: 0.5, shark: 0.5, cobra: 0.5, bat: 0.6, dragonfly: 0.8, spider: 0.7, anteater: 0.95, pangolin: 0.95, echidna: 0.95, starfish: 0.9, flamingo: 0.9, whale: 0.95 };
/* a chase that is not a hunt: the dog runs after the cat, the chicken and the duck; the cat plays with what flutters */
const AN_CHASE = { dog: 'cat chicken duck goat', cat: 'butterfly dragonfly', monkey: 'butterfly', parrot: '', seal: '' };
/* shells and spines: hiding saves them, except from the ones that know how to open them */
const AN_ARMOR = 'turtle snail clam pangolin echidna urchin crab millipede'.split(' '), AN_CRACK = { duck: 'snail', crocodile: 'turtle', octopus: 'crab clam', starfish: 'clam' };
const AN_HERD = 'cow buffalo zebra deer elephant horse goat penguin flamingo fish ant giraffe camel kangaroo'.split(' ');
const AN_TERR = 'tiger cat bear hippo rhino crocodile cobra scorpion shark'.split(' ');
const AN_DANGER = 'elephant rhino hippo buffalo'.split(' '); /* big ones that stand up to hunters, and hunters keep away from */
const AN_PLAY = 'cat dog monkey orangutan seal dolphin parrot'.split(' ');
const AN_TAME = 'cow buffalo horse goat pig chicken duck dog cat camel'.split(' ');
const AN_BITE = { mosquito: 1, housefly: 1, leech: 1 }; /* they go to a big warm animal (or a person) and bite, then off */
/* leaping up and dropping down to another line, in heights of its own box */
const AN_UP = anList('1.5:gecko houselizard gardenlizard spider grasshopper monkey cockroach|1.1:cat|0.9:orangutan kangaroo|0.7:frog ricefrog toad tiger goat|0.6:lion deer rat mudskipper|0.45:dog pig horse zebra|0.3:cow buffalo ostrich emu cassowary');
const AN_DOWN = anList('3:cat monkey gecko houselizard gardenlizard spider grasshopper cockroach ant|2.2:frog ricefrog toad rat goat orangutan kangaroo|1.5:dog tiger lion deer|0.35:elephant rhino hippo giraffe');
const AN_DO = { hunt: 'ล่าเหยื่อ', stalk: 'ย่องเข้าหาเหยื่อ', eat: 'กินเหยื่อ', chase: 'วิ่งไล่', play: 'เล่นไล่จับ', go2: 'เดินเข้าไปดู', bite: 'บินไปกัด', wait: 'ซุ่มนิ่งรอเหยื่อ', lunge: 'พุ่งงับ', charge: 'วิ่งเข้าใส่ ขู่ไล่', spar: 'ประลองกัน', wgo: 'เดินไปหา', wdo: 'พัก' };
/* each kind its own way (owner 22 พ.ย. 2569: the behaviour that is truly its own): how it hunts, how long it eats, how it
   meets danger and its own kind.
   h: stalk (creeps up, then a short run: lion, cheetah-like), pounce (creeps, then leaps onto it: cat, tiger), ambush (still
   until the prey is close, then a lunge: crocodile, frog, toad, spider, cobra, gecko, mantis-like), pursuit (barks, then a
   long run: dog), swoop (comes straight and silent from the air: owl), aerial (catches insects in the air: bat, dragonfly),
   browse (walks to its food and takes it: anteater, pangolin, echidna, flamingo, whale, starfish, duck, chicken).
   lunge: how near (in widths of its box) an ambush hunter lets it come. eat: seconds it eats. */
const AN_STYLE = {
  lion: { h: 'stalk', T: 6, eat: 8 }, tiger: { h: 'pounce', T: 9, eat: 8 }, cat: { h: 'pounce', T: 8, eat: 4 }, dog: { h: 'pursuit', T: 12, eat: 4 },
  crocodile: { h: 'ambush', lunge: 1.1, eat: 7 }, frog: { h: 'ambush', lunge: 0.9, eat: 1.2 }, ricefrog: { h: 'ambush', lunge: 0.9, eat: 1.2 }, toad: { h: 'ambush', lunge: 0.8, eat: 1.2 },
  spider: { h: 'ambush', lunge: 0.8, eat: 5 }, cobra: { h: 'ambush', lunge: 1.0, eat: 9 }, gecko: { h: 'ambush', lunge: 0.9, eat: 1.5 }, houselizard: { h: 'ambush', lunge: 0.9, eat: 1.5 },
  gardenlizard: { h: 'ambush', lunge: 0.9, eat: 1.5 }, scorpion: { h: 'ambush', lunge: 0.7, eat: 5 }, mudskipper: { h: 'ambush', lunge: 0.8, eat: 1.5 }, catfish: { h: 'browse', eat: 2 },
  owl: { h: 'swoop', T: 8, eat: 4 }, bat: { h: 'aerial', T: 5, eat: 1 }, dragonfly: { h: 'aerial', T: 5, eat: 1.5 }, shark: { h: 'stalk', T: 8, eat: 5 }, dolphin: { h: 'pursuit', T: 8, eat: 2 },
  seal: { h: 'pursuit', T: 8, eat: 2 }, penguin: { h: 'pursuit', T: 6, eat: 1.5 }, bear: { h: 'pursuit', T: 8, eat: 6 }, octopus: { h: 'ambush', lunge: 1.0, eat: 5 }, squid: { h: 'ambush', lunge: 0.9, eat: 3 },
  anteater: { h: 'browse', eat: 4 }, pangolin: { h: 'browse', eat: 4 }, echidna: { h: 'browse', eat: 4 }, flamingo: { h: 'browse', eat: 2 }, whale: { h: 'browse', eat: 3 }, starfish: { h: 'browse', eat: 10 },
  turtle: { h: 'browse', eat: 4 }, crab: { h: 'browse', eat: 3 }, rat: { h: 'browse', eat: 1.5 }, monkey: { h: 'browse', eat: 1.5 }, orangutan: { h: 'browse', eat: 2 },
  duck: { h: 'browse', eat: 1.5 }, chicken: { h: 'browse', eat: 1.2 }, bird: { h: 'browse', eat: 1.2 }, kiwi: { h: 'browse', eat: 1.5 }, peacock: { h: 'pursuit', T: 5, eat: 3 }, pig: { h: 'browse', eat: 2 }
};
/* what it says it is doing, its own words (the line under the animal) */
const AN_SAY = {
  lion: { stalk: 'หมอบย่องเข้าใกล้ทีละนิด', hunt: 'วิ่งไล่ระยะสั้น', eat: 'กินเหยื่อ แล้วจะนอนพัก' }, tiger: { stalk: 'ย่องซุ่มเงียบ ๆ', hunt: 'กระโจนตะครุบ', eat: 'กินเหยื่อ' },
  cat: { stalk: 'หมอบย่อง ส่ายก้น', hunt: 'กระโจนตะครุบ', eat: 'กินเหยื่อ', chase: 'ไล่ตะปบเล่น' }, dog: { hunt: 'เห่าแล้ววิ่งไล่', chase: 'เห่าแล้ววิ่งไล่', eat: 'กินเหยื่อ' },
  crocodile: { wait: 'ลอยนิ่งซุ่มรอ', lunge: 'พุ่งงับ', eat: 'งับเหยื่อแล้วกลืน' }, frog: { wait: 'นั่งนิ่งรอแมลง', lunge: 'แลบลิ้นงับแมลง', eat: 'กลืนแมลง' },
  ricefrog: { wait: 'นั่งนิ่งรอแมลง', lunge: 'แลบลิ้นงับแมลง', eat: 'กลืนแมลง' }, toad: { wait: 'นั่งนิ่งรอแมลง', lunge: 'แลบลิ้นงับแมลง', eat: 'กลืนแมลง' },
  spider: { wait: 'รออยู่นิ่ง ๆ', lunge: 'พุ่งกัด ฉีดพิษ', eat: 'ห่อเหยื่อด้วยใย แล้วดูดกิน' }, cobra: { wait: 'นอนนิ่งรอ', lunge: 'ฉก', eat: 'กลืนเหยื่อทั้งตัว' },
  gecko: { wait: 'เกาะนิ่ง จ้องแมลง', lunge: 'พุ่งงับแมลง', eat: 'กลืนแมลง' }, houselizard: { wait: 'เกาะนิ่ง จ้องแมลง', lunge: 'พุ่งงับแมลง', eat: 'กลืนแมลง' },
  gardenlizard: { wait: 'นิ่ง จ้องแมลง', lunge: 'พุ่งงับแมลง', eat: 'กลืนแมลง' }, scorpion: { wait: 'ซุ่มรอ', lunge: 'หนีบด้วยก้ามแล้วต่อย', eat: 'กินเหยื่อ' },
  owl: { hunt: 'บินโฉบลงมาเงียบ ๆ', eat: 'กลืนเหยื่อทั้งตัว' }, bat: { hunt: 'บินไล่งับแมลงกลางอากาศ', eat: 'งับแมลง' }, dragonfly: { hunt: 'บินไล่จับแมลงกลางอากาศ', eat: 'กินแมลง' },
  anteater: { hunt: 'เดินดมหามด', eat: 'แลบลิ้นยาวเลียมด' }, pangolin: { hunt: 'เดินดมหามด', eat: 'แลบลิ้นเลียมด' }, echidna: { hunt: 'เดินดมหามด', eat: 'แลบลิ้นเลียมด' },
  flamingo: { hunt: 'เดินไปหาอาหาร', eat: 'ก้มหัวกรองกุ้งจากน้ำ' }, whale: { hunt: 'ว่ายไปหากุ้งเคย', eat: 'อ้าปากกรองกุ้งเคย' }, starfish: { hunt: 'คืบไปหาหอย', eat: 'ง้างเปลือกหอยแล้วกิน' },
  octopus: { wait: 'ซ่อนตัวนิ่ง', lunge: 'ใช้หนวดรวบ', eat: 'กินเหยื่อ' }, shark: { stalk: 'ว่ายวนเข้าหา', hunt: 'พุ่งงับ', eat: 'งับเหยื่อ' },
  elephant: { charge: 'กางหู ชูงวง วิ่งเข้าใส่' }, rhino: { charge: 'ก้มหัว วิ่งพุ่งชน' }, hippo: { charge: 'อ้าปากกว้าง วิ่งเข้าใส่' }, buffalo: { charge: 'ก้มเขา วิ่งเข้าใส่เป็นฝูง' },
  goat: { spar: 'ก้มหัวชนกัน' }, deer: { spar: 'ใช้เขาประลองกัน' }, kangaroo: { spar: 'ยืนชกกัน' },
  chicken: { hunt: 'เดินเข้าไปจิก', eat: 'จิกกิน' }, duck: { hunt: 'เดินเข้าไปไซ้', eat: 'ไซ้กิน' }, bird: { hunt: 'กระโดดเข้าไปจิก', eat: 'จิกกิน' }, peacock: { hunt: 'วิ่งเข้าไปจิกงู', eat: 'จิกกินงู' }
};
/* the ones that stand still a moment, ears up, looking, before they bound away */
const AN_FREEZE = 'deer zebra giraffe horse goat kangaroo camel rat'.split(' ');
/* the ones that kick back at a hunter that reaches them: half the catches fail, and the hunter backs off */
const AN_KICK = 'zebra giraffe horse ostrich emu cassowary kangaroo camel'.split(' ');
/* the ones that run at a hunter (the herd of buffalo all together) */
const AN_CHARGE = 'elephant rhino hippo buffalo'.split(' ');
/* two of one kind that spar and then stay together (goats and deer with horns or antlers, kangaroos boxing) */
const AN_SPAR = 'goat deer kangaroo'.split(' ');
const anSz = (D) => AN_SIZE[D.id] || 3, anEats = (A, B) => (' ' + (AN_EATS[A.id] || '') + ' ').indexOf(' ' + B.id + ' ') >= 0;
const anChases = (A, B) => (' ' + (AN_CHASE[A.id] || '') + ' ').indexOf(' ' + B.id + ' ') >= 0;
const anFlies = (D) => D.go === 'fly' || !!D.air;
/* can a see b: near enough, not too far up or down, and no box (text, picture) in between */
function anSees(E, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y; if (Math.abs(dx) > a.w * 6 || Math.abs(dy) > a.h * 4) return false;
  for (const q of E.R) { const B = q.b; if (anSegRect(a.x, a.y, b.x, b.y, B)) return false; }
  return true;
}
function anSegRect(x0, y0, x1, y1, B) {
  if (Math.max(x0, x1) < B[0] || Math.min(x0, x1) > B[2] || Math.max(y0, y1) < B[1] || Math.min(y0, y1) > B[3]) return false;
  if ((x0 > B[0] && x0 < B[2] && y0 > B[1] && y0 < B[3]) || (x1 > B[0] && x1 < B[2] && y1 > B[1] && y1 < B[3])) return false; /* one of them is in front of it */
  const side = (px, py) => Math.sign((x1 - x0) * (py - y0) - (y1 - y0) * (px - x0));
  const s1 = side(B[0], B[1]), s2 = side(B[2], B[1]), s3 = side(B[0], B[3]), s4 = side(B[2], B[3]);
  return !(s1 === s2 && s2 === s3 && s3 === s4);
}
/* where an animal is now, for the others: its feet, its body (from the last picture of it), its eyes */
function anWhere(A) {
  const p = A.pg, ex = p.ext || [-A.w * 0.25, A.w * 0.25], z = Math.max(0, A.s.z) * A.k, hh = p.headH || A.h * 0.3;
  return { x: p.fx, y: p.fy - z - hh * 0.6, g: p.fy, top: p.fy - z - hh, bot: p.fy - z, x0: p.fx + ex[0], x1: p.fx + ex[1], w: A.w, h: A.h };
}
/* can A get to where B is: on its own level by walking, a line up or down by a leap, anywhere by flying */
function anReach(A, a, b, B) {
  const dl = b.g - a.g, same = Math.abs(dl) < A.h * 0.2;
  if (anFlies(A.D)) return 'fly';
  if (A.D.go === 'swim') return same ? 'walk' : '';
  const high = B && anFlies(B.D) ? b.g - b.bot : 0; /* a flyer up in the air: only a leap reaches it */
  if (same && high < A.h * 0.35) return 'walk';
  const up = (AN_UP[A.D.id] || 0.12) * A.h, down = (AN_DOWN[A.D.id] || 0.9) * A.h;
  if ((dl < 0 && -dl + high <= up) || (same && high <= up)) return 'leap';
  if (dl > 0 && dl <= down) return 'leap';
  return '';
}
/* a leap to another line (or at a flyer): an arc from here to there, and its level is that line afterwards */
function anLeap(A, tx, ty) {
  const p = A.pg, d = Math.abs(tx - p.fx), up = Math.max(0, p.fy - ty);
  p.leap = { x0: p.fx, y0: p.fy, x1: tx, y1: ty, u: 0, T: 0.35 + Math.min(0.5, (d + up) / 900), H: up + A.h * 0.25 };
  A.s.v = 0; A.s.hop = null;
}
function anLook(A, d, T) { const p = A.pg; p.hold = Math.max(p.hold, T); p.face = Math.atan2(p.R[1] * d, p.R[0] * d); A.s.tg = null; }
/* a goal on the page as a target in the animal's own world (its page moves are along R) */
function anGoal(A, a, gx, gy) {
  const s = A.s, d = (gx - a.x) / A.k, t = [s.x + A.pg.R[0] * d, s.y + A.pg.R[1] * d];
  if (anFlies(A.D) || A.D.go === 'swim') t.push(Math.max(A.D.zLo || 0, (a.g - gy) / A.k));
  return t;
}
function anDrive(A, k, tg, spd, T) { const s = A.s; if (s.rx && !AN_DO[s.rx.k] && s.rx.t < s.rx.T) return false; s.rx = { k, t: (s.rx && s.rx.k === k) ? s.rx.t : 0, T: T || 8, tg, spd, d: [0, 0, 0] }; s.hop = null; return true; }
function anFree(A) { if (A.s.rx && AN_DO[A.s.rx.k]) { A.s.rx = null; A.s.rk = 0; A.s.tg = null; } }
/* the startled answer, away from what frightens it */
function anScare(A, from) { const p = A.pg, d = from >= 0 ? -1 : 1; anFree(A); p.dir = d; return anReact(A.D, A.s, [p.R[0] * d, p.R[1] * d, 0]); }
/* B is eaten: it is gone from the page for a while (nothing of the notebook is deleted), and another of its kind walks in
   from the nearest edge of the page later */
function anEaten(A, B) {
  const p = B.pg; B.s.rx = null; B.s.hidden = true; p.gone = { by: A.D.th, back: 25 }; p.hold = 0; p.leap = null;
  anFree(A); A.s.rx = { k: 'eat', t: 0, T: (AN_STYLE[A.D.id] || {}).eat || 6, d: [0, 0, 0] }; A.s.act = (A.D.Q && A.D.Q.down) || 'look'; A.pg.full = 45; A.pg.hunt = null;
}
/* busy with something that matters (not just a thing it likes to do when nothing is going on, which anything interrupts) */
const anBusy = (X) => !!(X.s.rx && X.s.rx.k !== 'wgo' && X.s.rx.k !== 'wdo');
function anSocial(id, dt, E) {
  const A = AN_PAGE.get(id), t = A.t, p = A.pg; if (!A || p.gone) return;
  p.full = Math.max(0, (p.full || 0) - dt); p.calm = Math.max(0, (p.calm || 0) - dt); p.froze = Math.max(0, (p.froze || 0) - dt);
  if (p.thenWarn && !anBusy(A)) { p.thenWarn = 0; anReact(A.D, A.s, [p.R[0], p.R[1], 0]); } /* after its charge, the warning pose */
  /* what just happened stays with it a while: after a fright it keeps looking round (and does nothing else of its own);
     after a run that came to nothing a hunter rests, panting; after a meal it lies down */
  const k0 = A.s.rx && A.s.rx.k; if (k0 && 'flee dart jump flyoff hide burrow ink flip puff'.indexOf(k0) >= 0) p.scared = 1;
  else if (!k0 && p.scared) { p.scared = 0; p.alertT = 5 + anRng(A.s) * 4; p.alook = 0; }
  if (k0 === 'eat') p.ate = 1; else if (!k0 && p.ate) { p.ate = 0; const i = A.D.loop.findIndex((x) => x[0] === 'rest' || x[0] === 'sit'); if (anDrive(A, 'wdo', null, 0, 10)) { A.s.rx.say = 'นอนพักหลังกินอิ่ม'; A.s.rx.wk = 'rest'; if (i >= 0) A.s.act = A.D.loop[i][0]; } p.wish = null; }
  if (p.alertT > 0) { p.alertT -= dt; p.alook -= dt; if (p.alook <= 0 && !anBusy(A) && !p.hunt) { p.alook = 1.4; anLook(A, anRng(A.s) < 0.5 ? -1 : 1, 1); if (!(A.s.rx && A.s.rx.wk === 'alert') && anDrive(A, 'wdo', null, 0, Math.max(1, p.alertT))) { A.s.rx.say = 'ระแวง มองรอบตัว'; A.s.rx.wk = 'alert'; } } }
  const a = anWhere(A), dA = A.D;
  /* the one it is after now: keep at it, catch it, or give up */
  if (p.hunt) {
    const B = AN_PAGE.get(p.hunt.id), H = p.hunt; H.t += H.stalk ? dt * 0.35 : dt; /* creeping up, unseen, takes as long as it takes */
    if (!B || B.pg.gone || t - B.t > 0.4 || !B.r.cv || !B.r.cv.isConnected) { p.hunt = null; anFree(A); }
    else {
      const b = anWhere(B), how = anReach(A, a, b, B), seen = anSees(E, a, b), side = b.x >= a.x ? 1 : -1;
      if (!how || !seen || H.t > H.T) { p.hunt = null; anFree(A); p.full = Math.max(p.full, H.eat ? 10 : 6); if (how === '' && seen) anLook(A, side, 2); else if (H.eat && H.t > 2 && anDrive(A, 'wdo', null, 0, 4)) { A.s.rx.say = 'หอบ พักเหนื่อย'; A.s.rx.wk = 'rest'; const i = dA.loop.findIndex((x) => x[0] === 'rest' || x[0] === 'sit'); if (i >= 0) A.s.act = dA.loop[i][0]; } }
      else {
        const nose = side > 0 ? a.x1 : a.x0, touch = (side > 0 ? nose >= b.x0 - 4 : nose <= b.x1 + 4) && a.bot >= b.top - 4 && a.top <= b.bot + 4;
        if (touch && H.eat) {
          /* the moment of the catch: does it work (a hiding shell is hard to open, unless it knows how) */
          const crack = (' ' + (AN_CRACK[dA.id] || '') + ' ').indexOf(' ' + B.D.id + ' ') >= 0, hid = B.s.rx && (B.s.rx.k === 'hide' || B.s.rx.k === 'burrow' || B.s.rx.k === 'puff') && AN_ARMOR.indexOf(B.D.id) >= 0;
          const kick = AN_KICK.indexOf(B.D.id) >= 0 && anSz(B.D) >= anSz(dA) - 1, ok = anRng(A.s) < (AN_CATCH[dA.id] || 0.6) * (hid && !crack ? 0.15 : 1) * (kick ? 0.5 : 1);
          if (ok) { anEaten(A, B); return; }
          if (kick) { /* a zebra, giraffe, ostrich kicks back: the hunter backs off */ anFree(B); anReact(B.D, B.s, [B.pg.R[0] * side, B.pg.R[1] * side, 0]); p.hunt = null; anFree(A); p.dir = -side; p.full = Math.max(p.full, 10); return; }
          if (!anBusy(B)) anScare(B, a.x - b.x); H.miss = (H.miss || 0) + 1; if (H.miss > 2) H.t = H.T + 1;
        } else if (touch) { /* a chase for play: it got there, sniffs, and the other runs on */ if (!anBusy(B)) anScare(B, a.x - b.x); p.hunt = null; anFree(A); anLook(A, side, 1.2); p.full = Math.max(p.full, 8); }
        else if (how === 'leap' && !p.leap && Math.abs(b.x - a.x) < A.w * 1.4) anLeap(A, b.x - side * A.w * 0.2, b.g);
        else {
          const ST = AN_STYLE[dA.id] || { h: 'stalk' }, gap = Math.abs(b.x - a.x), fastS = (dA.fast || dA.spd * 2) * 1.05;
          if (H.eat && ST.h === 'ambush' && !H.lunged) {
            /* an ambush hunter does not go after it: still, watching, until it comes close, then one lunge */
            if (gap > (ST.lunge || 1) * A.w + (b.x1 - b.x0) * 0.5) { anDrive(A, 'wait', null, 0, 0.4); A.pg.face = Math.atan2(p.R[1] * side, p.R[0] * side); A.s.h = anAng(A.s.h + anCl(anAng(A.pg.face - A.s.h), -3 * dt, 3 * dt)); H.t = Math.min(H.t, 2); }
            else { H.lunged = 1; H.t = H.T - 1.2; anDrive(A, 'lunge', anGoal(A, a, b.x + side * A.w * 0.2, b.y), fastS * 1.8, 1.2); }
          } else if (H.eat && ST.h === 'pounce' && !H.pounced && gap < A.w * 1.3 && !anFlies(B.D)) {
            /* creeps up, then the leap onto it */
            H.pounced = 1; anFree(A); anLeap(A, b.x - side * A.w * 0.15, b.g); p.leap.H = A.h * 0.35;
          } else if (ST.h === 'pursuit' && !H.barked) {
            /* the dog barks first (its own warning, as it does at a finger), then the long run */
            H.barked = 1; anFree(A); anReact(dA, A.s, [p.R[0] * -side, p.R[1] * -side, 0]); A.s.rx.T = Math.min(A.s.rx.T, 0.8);
          } else if (ST.h === 'pursuit' && A.s.rx && !AN_DO[A.s.rx.k]) { /* still barking */ }
          else {
            /* creeps up while far (a hunter that is seen too soon loses it), runs the last part; an owl, a bat, a dragonfly
               come straight; a browser just walks to its food */
            const far = gap > A.w * 1.6 && !B.s.rx && !anFlies(dA) && ST.h !== 'browse' && ST.h !== 'pursuit', spd = ST.h === 'browse' ? (dA.spd || 0.1) * 1.1 : far && H.eat ? (dA.spd || 0.1) * 0.7 : fastS;
            H.stalk = far && H.eat; anDrive(A, H.stalk ? 'stalk' : (H.eat ? 'hunt' : 'chase'), anGoal(A, a, b.x, b.y), spd, 60);
          }
          if (how === 'fly' && b.g > a.g + A.h * 0.2) p.floor = Math.max(p.floor, b.g); /* a flyer comes down to the line it hunts on */
        }
      }
    }
  }
  for (const [jd, B] of AN_PAGE) {
    if (jd === id || t - B.t > 0.4 || !B.r.cv || !B.r.cv.isConnected || B.pg.gone) continue;
    const b = anWhere(B), dB = B.D, dx = b.x - a.x, side = dx >= 0 ? 1 : -1, dist = Math.abs(dx), near = (a.w + b.w) * 0.5;
    if (Math.abs(dx) > a.w * 6 || Math.abs(b.g - a.g) > a.h * 4) continue;
    const seen = anSees(E, a, b), how = anReach(A, a, b, B), sameLine = Math.abs(b.g - a.g) < a.h * 0.25;
    if (!seen) continue;
    /* a hunter of it close by: run (or hide, fly off, puff up) before it gets there, if it can get there at all; a big one
       that stands up to hunters warns it off instead */
    /* (ants do not run from an anteater, nor shrimp from a whale or a flamingo: too small and slow to get away from one
       that just walks up and takes them) */
    if ((anEats(dB, dA) || anChases(dB, dA)) && (AN_STYLE[dB.id] || {}).h !== 'browse') {
      const bReach = anReach(B, b, a, A), stalk = B.s.rx && B.s.rx.k === 'stalk', alert = (stalk ? 0.8 : 1.7) * Math.max(a.w, b.w);
      /* a deer, a zebra: first stands still, head up, looking at it, then bounds away when it comes on */
      if (bReach && AN_FREEZE.indexOf(dA.id) >= 0 && dist < alert * 1.8 && dist >= alert * 0.7 && !p.froze && !anBusy(A)) { anLook(A, side, 1.1); p.froze = 8; continue; }
      if (bReach && dist < alert && !anBusy(A) && !p.calm) {
        if (AN_DANGER.indexOf(dA.id) >= 0 && anSz(dA) >= anSz(dB) - 1 && anRng(A.s) < 0.6) { anFree(A); anReact(dA, A.s, [p.R[0] * -side, p.R[1] * -side, 0]); p.calm = 3; if (B.pg.hunt && B.pg.hunt.id === id) { B.pg.hunt.t = B.pg.hunt.T + 1; } continue; }
        /* a good jumper gets away up onto a higher line when there is one close by */
        const up = (AN_UP[dA.id] || 0) * a.h; let perch = null;
        if (up > a.h * 0.5 && !anFlies(dA)) for (const xx of [a.x - side * a.w * 0.6, a.x - side * a.w * 1.2, a.x]) { const sp = anSupport(anEnvNear(E, xx - 1, xx + 1, new Set()), xx, a.g - up, a.g - a.h * 0.3); if (sp) { perch = [xx, sp[0]]; break; } }
        if (perch && !p.leap) { anFree(A); anLeap(A, perch[0], perch[1]); p.calm = 2; continue; }
        anScare(A, dx); p.calm = 1.5; continue;
      }
      if (!bReach && dist < alert * 1.5 && !p.calm && !anBusy(A)) { anLook(A, side, 1.5); p.calm = 8; continue; } /* out of its reach: watches it, calm */
    }
    /* something it hunts (or chases for fun) that it can see: goes after it, unless just fed or tired */
    if (!p.hunt && !p.full && !anBusy(A) && (anEats(dA, dB) || anChases(dA, dB))) {
      if (AN_DANGER.indexOf(dB.id) >= 0 && anSz(dB) > anSz(dA) && !(dA.id === 'lion' || dA.id === 'tiger' || dA.id === 'crocodile')) continue;
      if (how) { const ST = AN_STYLE[dA.id] || {}; p.hunt = { id: jd, t: 0, T: anEats(dA, dB) ? (ST.h === 'ambush' ? 40 : ST.T || 10) : 4, eat: anEats(dA, dB) }; continue; }
      if (dist < a.w * 3 && !p.calm) { /* it cannot get there (another line, too high): watches, and waits under it */ anLook(A, side, 2.5); p.calm = 6; continue; }
    }
    /* an elephant, rhino, hippo or buffalo that sees a big hunter close by on its line: trumpets, snorts, warns it off */
    if (AN_DANGER.indexOf(dA.id) >= 0 && 'lion tiger crocodile dog'.indexOf(dB.id) >= 0 && sameLine && dist < near * 1.8 && !p.calm && !anBusy(A)) {
      /* runs at it a little way, then its warning; a herd of buffalo all run at it together */
      const go = (X, x) => { const w = anWhere(X); anFree(X); anDrive(X, 'charge', anGoal(X, w, b.x, w.y), (X.D.fast || X.D.spd * 2), 1.1); X.pg.thenWarn = 1; X.pg.calm = 6; };
      go(A); if (AN_HERD.indexOf(dA.id) >= 0) for (const [kd, C] of AN_PAGE) if (kd !== id && C.D === dA && !C.pg.gone && Math.abs(C.pg.fx - a.x) < a.w * 3 && Math.abs(C.pg.fy - a.g) < a.h * 0.3 && !C.pg.calm) go(C);
      if (B.pg.hunt) B.pg.hunt.t = B.pg.hunt.T + 1; B.pg.dir = side; B.pg.calm = 4; anFree(B); continue;
    }
    /* a hunter that is a big one's prey-size: keeps away from elephants, rhinos, hippos and buffalo */
    if (AN_DANGER.indexOf(dB.id) >= 0 && (AN_EATS[dA.id] || '').length && anSz(dB) > anSz(dA) && sameLine && dist < near * 1.6 && !p.hunt && !p.calm) { anFree(A); p.dir = -side; p.calm = 4; continue; }
    /* biters: to a big animal close by, bite, and off again */
    if (AN_BITE[dA.id] && anSz(dB) >= 3 && dist < a.w * 4 && !p.calm && !anBusy(A)) {
      if (dist < near && Math.abs(a.y - b.y) < b.h * 0.6) { anLook(B, -side, 0.8); anScare(A, dx); p.calm = 6; }
      else anDrive(A, 'bite', anGoal(A, a, b.x, b.top + b.h * 0.1), (dA.fast || 0.2), 3);
      continue;
    }
    if ((p.hunt && p.hunt.id === jd) || (B.pg.hunt && B.pg.hunt.id === id)) continue; /* one is after the other: no meeting manners */
    if (!sameLine || dist > near || (A.pg.meet[jd] || 0) > t || (B.pg.meet[id] || 0) > t) continue;
    /* they meet on one line */
    A.pg.meet[jd] = B.pg.meet[id] = t + 6;
    if (dA === dB) {
      if (AN_SPAR.indexOf(dA.id) >= 0) { /* goats, deer, kangaroos: face each other and spar a moment (heads, antlers, boxing), then go on together */ anFree(A); anFree(B); anDrive(A, 'spar', anGoal(A, a, b.x, a.y), (dA.fast || dA.spd * 2) * 0.6, 0.7); anDrive(B, 'spar', anGoal(B, b, a.x, b.y), (dB.fast || dB.spd * 2) * 0.6, 0.7); A.pg.meet[jd] = B.pg.meet[id] = t + 10; p.dir = B.pg.dir; continue; }
      if (AN_TERR.indexOf(dA.id) >= 0) { /* keeping its ground: both warn, then go their ways */ anFree(A); anFree(B); anReact(dA, A.s, [p.R[0] * -side, p.R[1] * -side, 0]); anReact(dB, B.s, [B.pg.R[0] * side, B.pg.R[1] * side, 0]); p.dir = -side; B.pg.dir = side; continue; }
      anLook(A, side, 1.8); anLook(B, -side, 1.8);
      if (AN_HERD.indexOf(dA.id) >= 0) { /* a herd goes on together */ p.dir = B.pg.dir; } else { p.dir = -side; B.pg.dir = side; }
      continue;
    }
    if (AN_PLAY.indexOf(dA.id) >= 0 && anSz(dB) <= 2 && !anEats(dB, dA)) { anLook(A, side, 1.4); continue; } /* curious: has a look */
    /* two that have nothing to do with each other: the smaller makes way, the bigger walks on */
    const sa = anSz(dA), sb = anSz(dB);
    if (sa < sb) { anLook(A, side, 0.6); p.dir = -side; } else if (sa > sb) { anLook(B, -side, 0.6); B.pg.dir = side; } else { anLook(A, side, 0.8); anLook(B, -side, 0.8); p.dir = -side; B.pg.dir = side; }
  }
  /* the drawn pictures that move: people, vehicles, balls, things, and drawings made to move (birds, fish, hoppers) */
  const acts = anActors();
  for (const O of acts) {
    const ox = (O.box[0] + O.box[2]) / 2, oy = (O.box[1] + O.box[3]) / 2, og = O.box[3], dx = ox - a.x, side = dx >= 0 ? 1 : -1, dist = Math.max(0, Math.abs(dx) - (O.box[2] - O.box[0]) / 2);
    if (Math.abs(dx) > a.w * 6 || Math.abs(og - a.g) > a.h * 4 || p.calm || anBusy(A) || p.hunt) continue;
    if (!anSees(E, a, { x: ox, y: oy })) continue;
    const coming = O.vx * -side > 0, fast = Math.abs(O.vx) > Math.max(120, a.w * 0.8), sameLine = Math.abs(og - a.g) < Math.max(a.h, O.box[3] - O.box[1]) * 0.5;
    if (O.kind === 'person') {
      if (AN_DANGER.indexOf(dA.id) >= 0 || AN_TERR.indexOf(dA.id) >= 0) { if (dist < a.w * 1.2 && sameLine) { anReact(dA, A.s, [p.R[0] * -side, p.R[1] * -side, 0]); p.calm = 6; } } /* warns, never attacks a person */
      else if (dA.id === 'dog' && dist < a.w * 4) { if (dist > a.w * 0.6) anDrive(A, 'go2', anGoal(A, a, ox - side * a.w * 0.5, a.y), dA.spd * 1.5, 3); else { anLook(A, side, 2.5); p.calm = 6; } }
      else if (AN_TAME.indexOf(dA.id) >= 0) { if (dist < a.w * 1.5) { anLook(A, side, 1.5); p.calm = 6; } }
      else if (dist < a.w * 2 && (sameLine || anFlies(dA))) { anScare(A, dx); p.calm = 3; } /* a wild one keeps away from people */
      continue;
    }
    if (fast && coming && dist < a.w * 2.5 && (sameLine || anFlies(dA))) { /* something big coming fast: out of the way */
      if (AN_DANGER.indexOf(dA.id) >= 0) { anReact(dA, A.s, [p.R[0] * -side, p.R[1] * -side, 0]); p.calm = 4; } else { anScare(A, dx); p.calm = 2; }
      continue;
    }
    if (O.kind === 'ball' && AN_PLAY.indexOf(dA.id) >= 0 && sameLine && dist < a.w * 4) { /* a ball: the playful ones run after it */
      if (dist > a.w * 0.3) anDrive(A, 'play', anGoal(A, a, ox, a.y), dA.fast || dA.spd * 2, 2); else { anLook(A, side, 1.2); p.calm = 3; }
      continue;
    }
    /* a drawing made to move like a small creature: the cat and the playful ones go after it (it is only a drawing: chased, never caught) */
    if ((O.kind === 'flyer' || O.kind === 'fish' || O.kind === 'hopper') && (AN_PLAY.indexOf(dA.id) >= 0 || (AN_EATS[dA.id] || '').length) && anSz(dA) >= 2 && dist < a.w * 4 && (sameLine || anFlies(dA) || O.kind === 'flyer')) {
      if (dist > a.w * 0.3) anDrive(A, 'play', anGoal(A, a, ox, oy), dA.fast || dA.spd * 2, 2.5); else { anLook(A, side, 1.2); p.calm = 4; }
      continue;
    }
    if (dist < a.w * 0.8 && sameLine) { anLook(A, side, 1); p.calm = 4; } /* anything else close by: has a look */
  }
  /* nothing going on: now and then something it likes to do, its own kind of thing, with what is on the page */
  if (!anBusy(A) && !p.hunt && !p.calm && !(p.hold > 0) && !p.leap && !(p.alertT > 0)) anWish(A, a, dt, E);
}
/* what each likes to do when nothing is going on (more of a word, more often):
   perch  up onto something higher near by (a box, a line above) and sit there: cats, monkeys, birds, geckos, goats
   explore  leap up or down to another line and look round: monkeys, frogs, grasshoppers, kangaroos
   sniff  walk to a line drawn near by and smell it, head down: dogs, pigs, rats, bears, anteaters
   edge  run to the side of a box and stay pressed against it: rats, cockroaches, crabs
   bask  lie still a long while: crocodiles, turtles, lizards, snakes, seals
   group  go to the nearest of its kind and stay by it: herds, penguins, a pride of lions
   rest  sit or lie down for a while: big cats, bears, pandas, hippos
   patrol  walk a long way one way, round its ground: tigers, cats */
const AN_WISH = {
  cat: 'perch perch rest sniff explore patrol', tiger: 'patrol patrol rest', lion: 'rest rest group', dog: 'sniff sniff group explore', monkey: 'perch explore explore group sniff patrol', orangutan: 'perch rest',
  gecko: 'perch explore bask', houselizard: 'perch explore', gardenlizard: 'bask perch', spider: 'perch bask', goat: 'perch explore group', kangaroo: 'explore group', frog: 'explore bask',
  ricefrog: 'explore bask', toad: 'bask', grasshopper: 'explore explore', rat: 'edge sniff explore', cockroach: 'edge edge', crab: 'edge', bird: 'perch explore', parrot: 'perch perch',
  chicken: 'sniff group', duck: 'group', pig: 'sniff sniff rest', bear: 'sniff rest', anteater: 'sniff', pangolin: 'sniff edge', echidna: 'sniff', cow: 'group rest', buffalo: 'group rest',
  horse: 'group', zebra: 'group', deer: 'group', elephant: 'group', giraffe: 'group', camel: 'rest', crocodile: 'bask bask', turtle: 'bask', cobra: 'bask', penguin: 'group group',
  flamingo: 'group', ostrich: 'group', emu: 'group', panda: 'rest rest', rhino: 'rest', hippo: 'rest group', seal: 'bask group', snail: 'perch', caterpillar: 'perch', millipede: 'edge',
  centipede: 'edge', scorpion: 'edge bask', owl: 'perch rest', peacock: 'group', kiwi: 'sniff', platypus: 'sniff', beetle: 'perch'
};
const AN_WSAY = { perch: 'ขึ้นไปนั่งบนที่สูง', explore: 'กระโดดไปสำรวจอีกบรรทัด', sniff: 'ก้มดมกลิ่นเส้นที่วาด', edge: 'หลบชิดขอบกล่อง', bask: 'นอนนิ่งอาบแดด', group: 'เดินไปรวมกับพวกเดียวกัน', rest: 'พักผ่อน', patrol: 'เดินตรวจตราอาณาเขต' };
const AN_WSAY1 = { bird: { perch: 'บินขึ้นไปเกาะที่สูง' }, parrot: { perch: 'บินขึ้นไปเกาะที่สูง' }, owl: { perch: 'บินขึ้นไปเกาะที่สูง' }, monkey: { perch: 'ปีนขึ้นที่สูง', explore: 'ห้อยโหนไปสำรวจ' },
  lion: { group: 'ไปนอนรวมฝูง', rest: 'นอนพักใต้ร่มไม้' }, crocodile: { bask: 'นอนอ้าปากผึ่งแดด' }, turtle: { bask: 'ยืดคอผึ่งแดด' }, penguin: { group: 'ไปยืนเบียดรวมฝูง' }, dog: { sniff: 'ดมกลิ่นไปทั่ว' },
  pig: { sniff: 'ใช้จมูกดุนหาอาหาร' }, rat: { edge: 'วิ่งเลาะชิดขอบ' }, cockroach: { edge: 'วิ่งไปหลบตามขอบ' }, goat: { perch: 'ปีนขึ้นที่สูง' }, cat: { perch: 'กระโดดขึ้นไปนั่งบนที่สูง' } };
/* everything it may do when nothing is going on: what it is known to like (AN_WISH), its own doings from its day (not
   walking or flying about), and what its build and its ways allow: a flyer goes off to another line, a climber or a good
   jumper goes up, a herd animal joins the others, one that keeps its ground walks round it, a big one lies down */
const AN_WL = new Map();
function anWishes(D) {
  if (AN_WL.has(D.id)) return AN_WL.get(D.id);
  const o = (AN_WISH[D.id] || '').split(' ').filter(Boolean);
  for (const [a] of D.loop) if (['go', 'run', 'fly', 'land', 'hang', 'look'].indexOf(a) < 0 && o.indexOf('act:' + a) < 0) o.push('act:' + a, 'act:' + a);
  if (anFlies(D) && o.indexOf('tour') < 0) o.push('tour', 'tour');
  if ((AN_UP[D.id] || 0) >= 0.6 && o.indexOf('perch') < 0) o.push('perch');
  if (AN_HERD.indexOf(D.id) >= 0 && o.indexOf('group') < 0) o.push('group');
  if (AN_TERR.indexOf(D.id) >= 0 && o.indexOf('patrol') < 0) o.push('patrol');
  if (anSz(D) >= 4 && !anFlies(D) && D.go !== 'swim' && o.indexOf('rest') < 0) o.push('rest');
  if (!o.length) o.push('patrol');
  AN_WL.set(D.id, o); return o;
}
function anWish(A, a, dt, E) {
  const p = A.pg, D = A.D, s = A.s, w = p.wish;
  if (w) {
    w.t += dt; const near = Math.abs(a.x - w.x) < A.w * 0.15;
    if (w.t > 9) { p.wish = null; return; }
    if (!near) { if (anDrive(A, 'wgo', anGoal(A, a, w.x, a.y), (D.spd || 0.1) * (w.k === 'edge' ? 2.2 : 1.1), Math.max(1, 9.2 - w.t))) { s.rx.say = AN_WSAY[w.k]; s.rx.wk = w.k; } return; }
    p.wish = null; anFree(A);
    if ((w.k === 'perch' || w.k === 'explore') && w.y != null) { anLeap(A, w.x2 != null ? w.x2 : w.x, w.y); p.after = { k: w.k, T: w.k === 'perch' ? 7 : 3 }; return; }
    if (anDrive(A, 'wdo', null, 0, w.k === 'bask' ? 9 : w.k === 'edge' ? 5 : w.k === 'group' ? 4 : 3)) { s.rx.say = AN_WSAY[w.k]; s.rx.wk = w.k; }
    if (w.k === 'sniff') s.act = (D.Q && D.Q.down) || 'sniff';
    return;
  }
  /* just landed up there: sits a while */
  if (p.after) { const f = p.after; p.after = null; if (anDrive(A, 'wdo', null, 0, f.T)) { s.rx.say = AN_WSAY[f.k]; s.rx.wk = f.k; } return; }
  p.wishT = (p.wishT == null ? 4 + anRng(s) * 6 : p.wishT) - dt; if (p.wishT > 0) return;
  p.wishT = 7 + anRng(s) * 9;
  const list = anWishes(D); if (!list.length) return;
  const k = list[Math.floor(anRng(s) * list.length)], up = (AN_UP[D.id] || (anFlies(D) ? 2.5 : 0.12)) * A.h, R = new Set();
  if (k === 'perch' || k === 'explore') {
    /* the highest thing above it that it can get up onto, close by (for explore: also back down to its own level) */
    let best = null;
    for (let i = -4; i <= 4; i++) { if (!i) continue; const xx = a.x + i * A.w * 0.5; if (xx < A.w * 0.3 || xx > W - A.w * 0.3) continue; const sp = anSupport(anEnvNear(E, xx - 1, xx + 1, R), xx, a.g - up, a.g - A.h * 0.25); if (sp && (!best || (k === 'perch' ? sp[0] < best[1] : Math.abs(i) < Math.abs(best[2])))) best = [xx, sp[0], i]; }
    if (!best && k === 'explore' && p.floor > a.g + A.h * 0.25 && p.floor - a.g <= (AN_DOWN[D.id] || 0.9) * A.h) best = [a.x + (anRng(s) < 0.5 ? -1 : 1) * A.w * 0.8, p.floor, 1]; /* down again from up there */
    if (!best) return;
    p.wish = { k, x: best[0] - Math.sign(best[2]) * A.w * 0.5, y: best[1], t: 0 }; p.wish.x = Math.max(A.w * 0.3, Math.min(W - A.w * 0.3, p.wish.x)); p.wish.lx = best[0];
    if (Math.abs(a.x - p.wish.x) < A.w * 0.15) { anLeap(A, best[0], best[1]); p.wish = null; p.after = { k, T: k === 'perch' ? 7 : 3 }; } else p.wish.x2 = best[0];
    return;
  }
  if (k === 'sniff') {
    /* the nearest line drawn on its own level, or close above it */
    let bx = null; for (const l of E.L) { if (l.b[3] < a.g - A.h * 0.6 || l.b[1] > a.g + 4) continue; const cx = Math.max(l.b[0], Math.min(l.b[2], a.x)); if (Math.abs(cx - a.x) > A.w * 3) continue; if (bx == null || Math.abs(cx - a.x) < Math.abs(bx - a.x)) bx = cx; }
    if (bx == null) return; const sd = Math.sign(bx - a.x || 1), ex = p.ext || [-A.w * 0.25, A.w * 0.25]; p.wish = { k, x: bx - sd * (Math.abs(sd > 0 ? ex[1] : ex[0]) + 4), t: 0 }; return; /* its nose at the line */
  }
  if (k === 'edge') {
    /* the side of a box standing on its level */
    let bx = null; for (const q of E.R) { const B = q.b; if (B[3] < a.g - 4 || B[1] > a.g - A.h * 0.2) continue; for (const ex of [B[0] - A.w * 0.3, B[2] + A.w * 0.3]) if (Math.abs(ex - a.x) < A.w * 4 && (bx == null || Math.abs(ex - a.x) < Math.abs(bx - a.x))) bx = ex; }
    if (bx == null) return; p.wish = { k, x: bx, t: 0 }; return;
  }
  if (k === 'group') {
    let o = null; for (const [, B] of AN_PAGE) { if (B === A || B.D !== D || B.pg.gone || AN_CLK - B.t > 0.4 || Math.abs(B.pg.fy - a.g) > A.h * 0.25) continue; const d = Math.abs(B.pg.fx - a.x); if (d < A.w * 6 && d > A.w * 0.7 && (!o || d < Math.abs(o.pg.fx - a.x))) o = B; }
    if (!o) return; p.wish = { k, x: o.pg.fx - Math.sign(o.pg.fx - a.x) * A.w * 0.6, t: 0 }; return;
  }
  if (k.indexOf('act:') === 0) {
    /* one of its own doings (grazing, preening, calling, digging, the peacock's fan), for a good while */
    const nm = k.slice(4), i = D.loop.findIndex((x) => x[0] === nm); if (i < 0) return; s.si = i; s.aT = 0; s.act = nm; s.tg = null; s.durK = 1.3 + anRng(s) * 0.8; return;
  }
  if (k === 'tour') {
    /* a flyer goes off to another line or a box top, above or below, and comes down there */
    const opts = []; for (let i = -6; i <= 6; i++) { if (!i) continue; const xx = a.x + i * A.w * 0.6; if (xx < A.w * 0.4 || xx > W - A.w * 0.4) continue; const sp = anSupport(anEnvNear(E, xx - 1, xx + 1, R), xx, a.g - A.h * 4, a.g + A.h * 3); if (sp && Math.abs(sp[0] - a.g) > A.h * 0.3) opts.push([xx, sp[0]]); }
    if (!opts.length) return; const o = opts[Math.floor(anRng(s) * opts.length)];
    if (o[1] > a.g) p.floor = o[1]; /* lower down: that is where it lives now */
    if (anDrive(A, 'wgo', anGoal(A, a, o[0], o[1] - A.h * 0.4).slice(0, 2).concat([Math.max(0.15, (a.g - o[1]) / A.k + 0.2)]), (D.fast || D.spd * 2) * 0.8, 4)) { s.rx.say = 'บินไปเกาะที่อื่น'; s.rx.wk = 'tour'; }
    return;
  }
  if (k === 'patrol') { const d = anRng(s) < 0.5 ? -1 : 1; p.wish = { k, x: Math.max(A.w * 0.4, Math.min(W - A.w * 0.4, a.x + d * A.w * 4)), t: 0 }; return; }
  if (k === 'bask' || k === 'rest') {
    if (k === 'rest') { const i = D.loop.findIndex((x) => x[0] === 'rest' || x[0] === 'sit'); if (i >= 0) { s.si = i; s.aT = 0; s.act = D.loop[i][0]; s.tg = null; return; } }
    if (anDrive(A, 'wdo', null, 0, k === 'bask' ? 9 : 5)) { s.rx.say = AN_WSAY[k]; s.rx.wk = k; }
  }
}
/* every moving drawing on the page, once a frame: [kind, box, vx] (kind person, vehicle, ball, thing, flyer, fish, hopper,
   still); a drawing that moves by itself (life.js) gives its speed from where it was the frame before */
let AN_ACT = { t: 0, list: [], prev: new Map() };
function anActors() {
  /* by the animals' own clock (seconds), not the wall clock: the same steps give the same speeds every time (a test that
     drives the steps itself ran a little differently each run) */
  const now = AN_CLK, n = visibleItems().length; if (AN_ACT.ok && AN_ACT.n === n && now >= AN_ACT.t && now - AN_ACT.t < 0.03) return AN_ACT.list; /* a picture added or taken away: at once */
  const out = [], dts = Math.max(0.016, AN_ACT.ok && now > AN_ACT.t ? now - AN_ACT.t : 0.016);
  if (typeof ipActors === 'function') { try { for (const o of ipActors()) out.push(o); } catch (e) { /* not ready */ } }
  if (typeof LIFE !== 'undefined' && LIFE && typeof lifeBox === 'function') for (const o of visibleItems()) {
    if (o.type !== 'life' || !o.B) continue; const L = LIFE.get(o.id); if (!L) continue; const box = lifeBox(o, L), beh = o.beh || {};
    const kind = beh.round ? 'ball' : (o.wheels && o.wheels.length) ? 'vehicle' : beh.k === 'flap' ? 'flyer' : beh.k === 'swim' ? 'fish' : beh.k === 'hop' ? 'hopper' : (beh.k === 'phys' || beh.k === 'path') ? 'thing' : 'still';
    const cx = (box[0] + box[2]) / 2, pv = AN_ACT.prev.get(o.id), vx = pv != null ? (cx - pv) / dts : 0; AN_ACT.prev.set(o.id, cx);
    out.push({ id: o.id, kind, box, vx });
  }
  AN_ACT = { t: now, list: out, prev: AN_ACT.prev, ok: 1, n }; return out;
}
/* the body of an animal on the page, for the drawn pictures that walk (they stop at it, not at its empty box) */
function anVis(id) { const A = AN_PAGE.get(id); if (!A || A.pg.gone || AN_CLK - A.t > 0.4) return null; const a = anWhere(A); return [a.x0, a.top, a.x1, a.g, A.pg.vx || 0]; }

/* ----- birds (chicken, duck, sparrow): body, neck and head that peck, legs with the ankle bent back, wings folded
   on the sides or spread and beating when it flies or flutters away ----- */
function anBird(b, s, C, D) {
  const Q = D.Q, air = (s.z > 0.01 && !s.hop) || (s.rx && s.rx.k === 'flyoff'), flut = s.rx && s.rx.k === 'flee' ? s.rk : 0;
  const peck = s.act === Q.down ? anBell(s.ap, 0.1) * Math.pow(Math.max(0, Math.sin(s.aT * Q.pr)), 2) : 0;
  const mv = Math.min(1.3, s.mv), hop = s.hop ? Math.sin(Math.PI * s.hop.u) : 0;
  const roll = Q.waddle ? Math.sin(s.ph) * 0.12 * mv : 0, bz = Q.zb + (air ? 0 : 0.008 * Math.abs(Math.sin(s.ph)) * mv);
  const bp = air ? 0.05 : -0.12 + 0.35 * peck;
  b.push([0, 0, bz], anMs(anRx(roll), anRy(bp)));
  const cb = (u) => (u[2] < -0.3 || u[0] > 0.55 ? C.b2 : C.b);
  b.ell([0, 0, 0], Q.br, null, cb, { n1: 10, n2: 12 });
  b.ell([Q.br[0] * 0.55, 0, Q.br[2] * 0.2], [Q.br[0] * 0.55, Q.br[1] * 0.85, Q.br[2] * 0.8], null, cb, { n1: 7, n2: 10 });
  /* tail */
  Q.tail(b, s, C, D);
  /* wings: folded on the sides, or spread and beating */
  const fl = air ? Math.sin(s.t * Q.flap * 6.283) : flut ? Math.sin(s.t * 22) : 0, spread = air ? 1 : flut;
  for (const sd of (Q.noWings ? [] : [1, -1])) {
    if (spread > 0.05) {
      b.push([0.03, sd * Q.br[1] * 0.7, Q.br[2] * 0.45], anRx(sd * (0.15 + 0.85 * fl * spread)));
      b.sheet([[0.06, 0, 0], [0.02, sd * Q.ws * spread, 0.01], [-0.06, sd * Q.ws * 0.9 * spread, 0], [-0.12, sd * Q.ws * 0.45 * spread, -0.005], [-0.1, 0, 0]], C.w || C.b);
      b.pop();
    } else b.ell([-0.02, sd * Q.br[1] * 0.82, Q.br[2] * 0.15], [Q.br[0] * 0.8, Q.br[1] * 0.22, Q.br[2] * 0.62], anRy(-0.12), C.w || C.b, { n1: 7, n2: 9 });
  }
  b.pop();
  /* legs: from inside the body to the feet; tucked up when flying */
  const hipz = bz - Q.br[2] * 0.55, L = (Q.zb - Q.br[2] * 0.55) * 0.58;
  for (const sd of [1, -1]) {
    const p = s.ph + (sd > 0 ? 0 : Math.PI), H = [-0.01, sd * Q.br[1] * 0.45, hipz];
    let F = Q.hop ? [0.02 - 0.04 * hop, sd * Q.br[1] * 0.45, 0] : [0.02 + Q.step * Math.sin(p) * mv, sd * Q.br[1] * 0.45, Q.lift * Math.max(0, Math.cos(p)) * Math.min(1, mv)];
    if (air) F = [-0.08, sd * 0.04, hipz - L * 0.9]; else F[2] -= s.z; /* on the ground while it hops */
    if (Q.oneLeg && !air && sd < 0 && s.act === 'rest') { const up = anBell(s.ap, 0.15); F = anLerp(F, [H[0] + 0.02, H[1], hipz - L * 0.55], up); }
    const K = anIK(H, F, L, L, [-1, 0, 0.2]);
    b.tube([H, K], 0.018 * Q.k, C.b2, { sides: 5 }); b.tube([K, F], 0.008 * Q.k, C.f, { sides: 5 });
    if (Q.web) b.sheet([[F[0] - 0.01, F[1], F[2] + 0.002], [F[0] + 0.07 * Q.k, F[1] + 0.035 * Q.k, F[2]], [F[0] + 0.075 * Q.k, F[1] - 0.035 * Q.k, F[2]]], C.f);
    else for (const a of [-0.45, 0, 0.45, Math.PI]) b.line([F, [F[0] + Math.cos(a) * 0.05 * Q.k, F[1] + Math.sin(a) * 0.05 * Q.k, F[2]]], C.f, 0.007 * Q.k);
  }
  /* neck and head: pecks at the ground; a hen's head stays still while the body steps on */
  const bob = Q.bob ? ((s.ph / 6.283) % 1) * 0.04 * mv : 0, look = s.act === 'look' ? Math.sin(s.aT * 3) * 0.6 : 0;
  const N0 = [Q.br[0] * 0.75, 0, bz + Q.br[2] * 0.5], hd = peck, Hc = [N0[0] + Q.nx + 0.04 * hd - bob, 0, N0[2] + Q.nz * (1 - hd) - (bz - 0.04) * hd * 0.95];
  b.tube([N0, anLerp(N0, Hc, 0.5), Hc], (t) => Q.nr * (1 - 0.3 * t), C.n || C.b, { sides: 7 });
  b.push(Hc, anMs(anRz(look), anRy(0.25 + 1.25 * hd)));
  b.ell([0, 0, 0], Q.hr, null, C.n || C.b, { n1: 7, n2: 9 });
  Q.head(b, s, C, D);
  b.eye([Q.hr[0] * 0.35, Q.hr[1] * 0.8, Q.hr[2] * 0.25], 0.011 * Q.k, [0.3, 1, 0.2]); b.eye([Q.hr[0] * 0.35, -Q.hr[1] * 0.8, Q.hr[2] * 0.25], 0.011 * Q.k, [0.3, -1, 0.2]);
  b.pop();
}
const AN_BEAK = (len, r, col) => (b) => b.tube([[0.03, 0, 0], [0.03 + len * 0.6, 0, -r * 0.3], [0.03 + len, 0, -r * 0.8]], (t) => r * (1 - 0.95 * t), col, { sides: 6 });
const AN_QHEN = { zb: 0.24, br: [0.17, 0.11, 0.12], k: 1, ws: 0.24, flap: 7, step: 0.07, lift: 0.05, nx: 0.05, nz: 0.12, nr: 0.045, hr: [0.06, 0.045, 0.05], down: 'peck', pr: 9, bob: true,
  head: (b, s, C) => { AN_BEAK(0.06, 0.02, C.f)(b); for (let i = 0; i < 4; i++) b.sheet([[0.04 - i * 0.025, 0, 0.035], [0.035 - i * 0.025, 0, 0.075 - Math.abs(i - 1.5) * 0.01], [0.015 - i * 0.025, 0, 0.04]], C.c, { edge: false }); b.ell([0.05, 0, -0.045], [0.012, 0.008, 0.02], null, C.c, { n1: 5, n2: 6 }); },
  tail: (b, s, C) => { for (let i = -2; i <= 2; i++) b.sheet([[-0.13, i * 0.02, 0.04], [-0.26, i * 0.035, 0.2 - Math.abs(i) * 0.02], [-0.2, i * 0.03, 0.03]], C.t || C.b); } };
anDef('chicken', { th: 'ไก่', en: 'chicken', grp: 'สัตว์ปีก (นก)', hint: 'เดินคุ้ยจิกกินอาหาร แตะแล้วกระพือปีกวิ่งหนี', kw: 'ไก่บ้าน แม่ไก่ สัตว์ปีก', go: 'walk', spd: 0.16, fast: 0.6, stride: 0.13, turn: 3, roam: 0.2, R: 0.44, tz: 0.18, react: 'flee', fleeLen: 0.45,
  loop: [['go', 3.5], ['peck', 3.5], ['look', 1.6], ['go', 3], ['peck', 4]], acts: { peck: 'จิกกินอาหาร', flee: 'กระพือปีก วิ่งหนี' }, C: { b: '#B5652E', b2: '#D9A066', t: '#5A3A22', f: '#E6B23A', c: '#D63A2E', n: '#C27838' },
  Q: AN_QHEN, draw: anBird, sh: [0.2, 0.12] });
anDef('duck', { th: 'เป็ด', en: 'duck', grp: 'สัตว์ปีก (นก)', hint: 'เดินเตาะแตะ ไซ้ขน แตะแล้วกระพือปีกวิ่งหนี ร้องก้าบ', kw: 'เป็ดบ้าน สัตว์ปีก ตีนพังผืด', go: 'walk', spd: 0.12, fast: 0.42, stride: 0.12, turn: 2.4, roam: 0.2, R: 0.46, tz: 0.18, react: 'flee', fleeLen: 0.45,
  loop: [['go', 4], ['peck', 3], ['go', 3], ['look', 2]], acts: { peck: 'ไซ้หาอาหาร', flee: 'กระพือปีก วิ่งหนี' }, C: { b: '#F1EEE6', b2: '#E2DCCD', f: '#E8942C', c: '#E8942C' },
  Q: Object.assign({}, AN_QHEN, { zb: 0.2, br: [0.2, 0.12, 0.1], waddle: true, bob: false, nx: 0.06, nz: 0.13, nr: 0.04, hr: [0.065, 0.045, 0.048], web: true, pr: 6,
    head: (b, s, C) => b.ell([0.085, 0, -0.012], [0.045, 0.026, 0.01], anRy(0.15), C.f, { n1: 6, n2: 8 }),
    tail: (b, s, C) => b.sheet([[-0.16, 0.05, 0.02], [-0.25, 0, 0.09], [-0.16, -0.05, 0.02]], C.b) }), draw: anBird, sh: [0.22, 0.13] });
anDef('bird', { th: 'นก', en: 'sparrow', grp: 'สัตว์ปีก (นก)', hint: 'นกกระจอก กระโดดจิกเมล็ดพืช แตะแล้วบินหนี แล้วร่อนลงที่ใหม่', kw: 'นกกระจอก สัตว์ปีก บิน', go: 'hop', air: true, spd: 0.3, fast: 0.9, hopLen: 0.09, hopH: 0.035, hopT: 0.22, hopRest: 0.25, turn: 5, roam: 0.16, zLo: 0.2, zHi: 0.55, R: 0.28, tz: 0.12, react: 'flyoff',
  loop: [['go', 2.6], ['peck', 2.8], ['look', 1.4], ['go', 2], ['peck', 2.4]], acts: { go: 'กระโดด', peck: 'จิกกินเมล็ดพืช', flyoff: 'บินหนี', land: 'ร่อนลง' }, C: { b: '#8A6A48', b2: '#E2D6C2', w: '#6E5234', t: '#5A4430', f: '#B89878', n: '#9C7A56' },
  Q: Object.assign({}, AN_QHEN, { zb: 0.07, br: [0.07, 0.042, 0.045], k: 0.4, ws: 0.13, flap: 11, hop: true, bob: false, nx: 0.018, nz: 0.035, nr: 0.028, hr: [0.032, 0.028, 0.03], pr: 10,
    head: (b, s, C) => { AN_BEAK(0.022, 0.009, '#3A342E')(b); b.ell([-0.005, 0, 0.015], [0.026, 0.026, 0.016], null, '#6E5A48', { n1: 5, n2: 8 }); },
    tail: (b, s, C) => b.sheet([[-0.06, 0.012, 0.01], [-0.13, 0.02, 0.03], [-0.13, -0.02, 0.03], [-0.06, -0.012, 0.01]], C.t) }), draw: anBird, sh: [0.07, 0.045] });

/* ----- in the water: a sandy or pebbly bottom under it ----- */
const anSand = (c, P, s, C, D) => anPatch(c, P, 0, 0, D.R * 0.95, D.R * 0.75, 'rgba(226,206,160,0.55)', 'rgba(170,140,90,0.45)', 'rgba(150,120,80,0.5)');
const anPond = (c, P, s, C, D) => anPatch(c, P, 0, 0, D.R * 0.95, D.R * 0.75, 'rgba(150,190,215,0.35)', 'rgba(90,140,180,0.5)', 'rgba(110,120,120,0.45)');
/* a fish: a body that bends in a wave down to the tail, its fins; it darts away when touched */
function anFish(b, s, C, D) {
  const n = 12, sw = 0.5 + 1.2 * Math.min(1.5, s.mv) + (s.rx ? 1.5 * s.rk : 0), A = 0.035 + 0.02 * Math.min(1.5, s.mv), L = 0.42, pts = [];
  s.fx.w = (s.fx.w || 0) + 0.016 * sw * 6;
  for (let i = 0; i <= n; i++) { const u = i / n, amp = A * (0.15 + u * u); pts.push([L * 0.45 - L * u, amp * Math.sin(u * 5 - s.fx.w), 0]); }
  const H = 0.1, prof = (t) => { const r = H * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.88 + 0.06)), 0.75) * (1 - 0.55 * Math.max(0, t - 0.75) / 0.25); return [r * 0.42, r]; };
  b.tube(pts, prof, (t, a) => (Math.sin(a) > 0.2 ? C.b : Math.sin(a) < -0.35 ? C.b2 : (Math.sin(t * 22) > 0.6 && t > 0.2 && t < 0.8 ? C.d : C.b)), { sides: 10 });
  const tail = pts[n], tb = pts[n - 1], fw = Math.sin(s.fx.w * 1.1) * 0.03;
  b.sheet([[tail[0] + 0.02, tail[1], 0], [tail[0] - 0.12, tail[1] + fw + 0.02, 0.09], [tail[0] - 0.08, tail[1] + fw, 0], [tail[0] - 0.12, tail[1] + fw + 0.02, -0.09]], C.f);
  const m = pts[5]; b.sheet([[m[0] + 0.1, m[1], 0.08], [m[0], m[1], 0.14], [m[0] - 0.14, pts[8][1], 0.07]], C.f);
  b.sheet([[pts[7][0] + 0.02, pts[7][1], -0.07], [pts[8][0] - 0.02, pts[8][1], -0.11], [pts[9][0], pts[9][1], -0.06]], C.f);
  for (const sd of [1, -1]) { const fl = 0.3 + 0.35 * Math.sin(s.t * 6 + sd); b.sheet([[0.09, sd * 0.035, -0.03], [0.02, sd * (0.05 + 0.04 * fl), -0.06], [0.035, sd * 0.04, -0.03]], C.f); }
  b.eye([0.16, 0.03, 0.025], 0.014, [0.3, 1, 0.1]); b.eye([0.16, -0.03, 0.025], 0.014, [0.3, -1, 0.1]);
  b.line([[0.205, 0.01, -0.02], [0.2, 0, -0.025], [0.205, -0.01, -0.02]], 'rgba(60,50,50,0.7)', 0.004);
}
anDef('fish', { th: 'ปลา', en: 'fish', grp: 'ปลา', hint: 'ปลานิล ว่ายน้ำโบกหางและครีบ แตะแล้วสะบัดหางพุ่งหนี', kw: 'ปลานิล ปลาน้ำจืด เหงือก ครีบ', go: 'swim', spd: 0.16, fast: 0.8, stride: 0.2, turn: 1.8, acc: 3, roam: 0.24, zLo: 0.18, zHi: 0.34, z0: 0.26, R: 0.5, tz: 0.2, react: 'dart', fleeLen: 0.55,
  loop: [['go', 5], ['hover', 2.5], ['go', 5], ['go', 4]], acts: { go: 'ว่ายน้ำ', hover: 'ลอยตัว โบกครีบ', dart: 'สะบัดหาง พุ่งหนี' }, C: { b: '#6F8A86', b2: '#E6E2D2', d: '#4E6662', f: '#8A9EA0' },
  draw: anFish, ground: anPond, sh: [0.2, 0.06] });
/* a squid: the mantle goes first, fins wave at its tip, arms trail; touched, it squirts ink and shoots away */
function anSquid(b, s, C, D) {
  const sq = s.rx && s.rx.k === 'ink' ? Math.max(0, Math.sin(s.rx.t * 9)) * s.rk : 0, pts = [];
  for (let i = 0; i <= 8; i++) pts.push([0.24 - 0.3 * i / 8, 0, 0]);
  b.tube(pts, (t) => { const r = 0.062 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.6)), 0.7) * (1 - 0.18 * sq); return r; }, (t, a) => (Math.sin(t * 31 + a * 3) > 0.7 ? C.d : C.b), { sides: 10 });
  const wv = s.t * 6;
  for (const sd of [1, -1]) b.sheet([[0.24, 0, 0], [0.16, sd * 0.07, 0.008 * Math.sin(wv)], [0.08, sd * 0.05, 0.01 * Math.sin(wv + 1)], [0.05, 0, 0]], C.f);
  b.ell([-0.09, 0, 0], [0.045, 0.045, 0.042], null, C.b, { n1: 7, n2: 9 });
  b.eye([-0.085, 0.04, 0.012], 0.018, [0, 1, 0.2]); b.eye([-0.085, -0.04, 0.012], 0.018, [0, -1, 0.2]);
  const spread = 0.3 + 0.15 * Math.sin(s.t * 2) - 0.2 * sq;
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * 6.283, ten = k === 2 || k === 7, L = ten ? 0.3 : 0.17, q = [];
    for (let i = 0; i <= 5; i++) { const u = i / 5, w = Math.sin(s.t * 2.5 + k + u * 3) * 0.02 * u; q.push([-0.12 - L * u, Math.cos(a) * (0.025 + spread * 0.1 * u) + w, Math.sin(a) * (0.022 + spread * 0.08 * u) + w * 0.5]); }
    b.tube(q, (t) => (ten && t > 0.8 ? 0.012 : 0.011 * (1 - 0.7 * t)), C.b, { sides: 5 });
  }
}
anDef('squid', { th: 'ปลาหมึก', en: 'squid', grp: 'หอยและหมึก (มอลลัสก์)', hint: 'ปลาหมึกกล้วย ว่ายไปมาเหนือพื้นทราย ครีบพลิ้ว แตะแล้วพ่นหมึกพุ่งหนี', kw: 'หมึก หมึกกล้วย สัตว์ไม่มีกระดูกสันหลัง หมึกดำ', go: 'swim', mantle: true, spd: 0.1, fast: 0.7, stride: 0.2, turn: 1.2, roam: 0.2, zLo: 0.16, zHi: 0.26, z0: 0.2, R: 0.42, tz: 0.16, react: 'ink', fleeLen: 0.5,
  loop: [['go', 5], ['hover', 3], ['go', 5]], acts: { go: 'ว่ายไปมาเหนือพื้นทราย', hover: 'ลอยนิ่ง ครีบพลิ้ว', ink: 'พ่นหมึก พุ่งหนี' }, C: { b: '#E3B49C', b2: '#F2DCCF', d: '#A0523A', f: '#EBC7B4' },
  draw: anSquid, ground: anSand, sh: [0.18, 0.06] });
/* a crab walks sideways on eight legs, picks food to its mouth with its claws, raises them when touched, then scuttles away */
function anCrab(b, s, C, D) {
  const thr = s.rx && s.rx.k === 'threat' && s.rx.t < 1.2 ? s.rk : 0, eat = s.act === 'eat' ? anBell(s.ap, 0.15) : 0, mv = Math.min(1.4, s.mv), z0 = 0.075;
  b.ell([0, 0, z0], [0.085, 0.12, 0.04], null, (u) => (u[2] < -0.3 ? C.b2 : C.b), { n1: 8, n2: 12, def: (u) => [0, 0, u[2] > 0 ? 0.012 * (1 - u[1] * u[1]) : 0] });
  for (const sd of [1, -1]) { b.tube([[0.06, sd * 0.03, z0 + 0.02], [0.08, sd * 0.035, z0 + 0.05 + 0.02 * thr]], 0.006, C.b, { sides: 5 }); b.eye([0.08, sd * 0.035, z0 + 0.055 + 0.02 * thr], 0.011, [1, sd * 0.3, 0.4]); }
  for (let k = 0; k < 4; k++) for (const sd of [1, -1]) {
    const x0 = 0.03 - k * 0.035, p = s.ph + k * 1.6 + (sd > 0 ? 0 : Math.PI), H = [x0, sd * 0.105, z0 - 0.005];
    const F = [x0 * 2.4 + 0.035 + 0.02 * Math.cos(p) * mv, sd * (0.22 - 0.012 * k + 0.03 * Math.sin(p) * mv), 0.025 * Math.max(0, Math.sin(p)) * Math.min(1, mv) + 0.04 * thr];
    const K = anIK(H, F, 0.085, 0.1, [0, sd * 0.3, 1]); b.tube([H, K, F], (t) => 0.012 * (1 - 0.6 * t), C.b, { sides: 5 });
  }
  for (const sd of [1, -1]) {
    const lift = thr * 1.0 + eat * Math.max(0, Math.sin(s.aT * 4 + (sd > 0 ? 0 : Math.PI))) * 0.35;
    const S0 = [0.07, sd * 0.07, z0], E0 = [0.13, sd * (0.14 + 0.04 * thr), z0 + 0.01 + 0.1 * lift], Cw = [0.17 - 0.07 * eat * lift, sd * (0.11 + 0.08 * thr), z0 + 0.03 + 0.16 * lift];
    b.tube([S0, E0, Cw], 0.016, C.b, { sides: 6 });
    b.push(Cw, anMs(anRz(sd * (0.4 + 0.3 * thr)), anRy(-0.6 * lift)));
    b.ell([0.03, 0, 0], [0.05, 0.026, 0.024], null, C.c, { n1: 7, n2: 9 });
    const op = 0.25 + 0.25 * thr * Math.abs(Math.sin(s.t * 6)); b.tube([[0.07, 0, 0.005], [0.11, 0, 0.005 + 0.03 * op]], (t) => 0.009 * (1 - 0.6 * t), C.c, { sides: 5 }); b.tube([[0.07, 0, -0.008], [0.11, 0, -0.012]], (t) => 0.009 * (1 - 0.6 * t), C.c, { sides: 5 });
    b.pop();
  }
}
anDef('crab', { th: 'ปู', en: 'crab', grp: 'สัตว์ขาปล้อง (ครัสเตเชียน)', hint: 'ปูนา เดินด้านข้าง ใช้ก้ามหยิบอาหาร แตะแล้วชูก้ามขู่ แล้ววิ่งหนีไปข้าง ๆ', kw: 'ปูนา ปูทะเล ก้าม สัตว์ไม่มีกระดูกสันหลัง', go: 'walk', side: true, spd: 0.1, fast: 0.45, stride: 0.12, turn: 3, roam: 0.18, R: 0.38, tz: 0.06, react: 'threat', fleeLen: 0.5,
  loop: [['go', 3], ['eat', 3.5], ['go', 3], ['look', 1.5]], acts: { go: 'เดินด้านข้าง', eat: 'ใช้ก้ามหยิบอาหารเข้าปาก', look: 'ยกตาดู', threat: 'ชูก้ามขู่ แล้ววิ่งหนี' }, C: { b: '#6E4E3A', b2: '#C8AE8A', c: '#7E5A40' },
  draw: anCrab, ground: anSand, sh: [0.2, 0.2] });
/* a shrimp walks on the bottom with its feelers sweeping; touched, it curls its tail and shoots backwards */
function anShrimp(b, s, C, D) {
  const curl = s.rx && s.rx.k === 'flip' ? s.rk : 0, pts = [], n = 9;
  for (let i = 0; i <= n; i++) { const u = i / n, a = (0.12 + 1.9 * curl) * u * u; pts.push([0.12 - 0.3 * u * Math.cos(a * 0.6), 0, 0.05 - 0.3 * u * Math.sin(a * 0.6) * 0.5 - 0.02 * u * u]); }
  b.tube(pts, (t) => { const r = 0.032 * (1 - 0.6 * t * t); return [r * 0.85, r]; }, (t) => (Math.sin(t * 36) > 0.75 ? C.d : C.b), { sides: 9 });
  const T = pts[n]; for (let k = -2; k <= 2; k++) b.sheet([[T[0], T[1], T[2]], [T[0] - 0.06, k * 0.018, T[2] - 0.015 - curl * 0.04], [T[0] - 0.05, k * 0.018 + 0.012, T[2] - 0.01 - curl * 0.04]], C.f);
  b.tube([[0.12, 0, 0.065], [0.19, 0, 0.08]], (t) => 0.006 * (1 - 0.9 * t), C.b, { sides: 4 });
  for (const sd of [1, -1]) {
    b.eye([0.13, sd * 0.022, 0.07], 0.01, [0.6, sd, 0.3]);
    const sw = Math.sin(s.t * 1.4 + sd) * 0.4; b.line([[0.14, sd * 0.012, 0.06], [0.2, sd * (0.04 + 0.03 * sw), 0.09], [0.27, sd * (0.09 + 0.07 * sw), 0.07], [0.31, sd * (0.13 + 0.06 * sw), 0.03]], C.d, 0.003);
    for (let k = 0; k < 5; k++) { const x = 0.1 - k * 0.025, p = s.ph + k * 1.2 + (sd > 0 ? 0 : 3.14), lf = Math.max(0, Math.sin(p)) * 0.015 * Math.min(1, s.mv); b.line([[x, sd * 0.02, 0.03], [x + 0.01, sd * 0.06, 0.02 + lf], [x + 0.02 + 0.02 * Math.cos(p) * s.mv, sd * 0.07, 0]], C.d, 0.004); }
    for (let k = 0; k < 4; k++) { const q = pts[3 + k], b0 = Math.sin(s.t * 12 + k) * 0.01; b.line([[q[0], sd * 0.015, q[2] - 0.02], [q[0] + b0, sd * 0.02, q[2] - 0.045]], C.f, 0.004); }
  }
}
anDef('shrimp', { th: 'กุ้ง', en: 'shrimp', grp: 'สัตว์ขาปล้อง (ครัสเตเชียน)', hint: 'กุ้งฝอย เดินบนพื้นน้ำ หนวดกวาดหาอาหาร แตะแล้วงอหางดีดตัวถอยหลัง', kw: 'กุ้งฝอย กุ้งก้ามกราม สัตว์ไม่มีกระดูกสันหลัง', go: 'walk', spd: 0.07, fast: 0.55, stride: 0.1, turn: 2, roam: 0.16, R: 0.34, tz: 0.06, react: 'flip', fleeLen: 0.5,
  loop: [['go', 4], ['rest', 3], ['go', 3]], acts: { go: 'เดินบนพื้นน้ำ', rest: 'หยุด หนวดกวาดหาอาหาร', flip: 'งอหาง ดีดตัวถอยหลัง' }, C: { b: '#B9C8C8', b2: '#DDE6E4', d: '#6E8A8C', f: '#A6BCC0' },
  draw: anShrimp, ground: anPond, sh: [0.18, 0.06] });
/* a snail: a coiled shell on a soft foot that glides; touched, the feelers and the body pull into the shell */
function anSnail(b, s, C, D) {
  const hide = s.rx && s.rx.k === 'hide' ? s.rk : 0, ext = 1 - hide, rip = Math.sin(s.t * 5) * 0.004 * Math.min(1, s.mv);
  const fx = 0.14 * ext, foot = [[-0.1 * (0.4 + 0.6 * ext), 0, 0.012], [-0.02, 0, 0.016 + rip], [0.06 * ext, 0, 0.02 - rip], [fx, 0, 0.035], [fx + 0.025 * ext, 0, 0.055]];
  if (ext > 0.05) b.tube(foot, (t) => [0.03 * (1 - 0.3 * t) * (0.5 + 0.5 * ext), 0.02 * (1 - 0.2 * t)], C.b, { sides: 8 });
  /* the shell, a tube along a widening spiral */
  const sp = [], N = 26; for (let i = 0; i <= N; i++) { const u = i / N, th = 0.9 + 4.6 * Math.PI * (1 - u), r = 0.075 * Math.exp(-1.25 * (1 - u) * 2.3); sp.push([-0.02 + r * Math.cos(th), 0.035 * (1 - u) - 0.01, 0.085 + r * Math.sin(th)]); }
  b.tube(sp, (t) => 0.004 + 0.052 * Math.pow(t, 1.6), (t) => (Math.sin(t * 40) > 0.4 ? C.d : C.s), { sides: 10, cap: false });
  if (ext > 0.05) {
    const h = [fx + 0.025 * ext, 0, 0.055], sw = Math.sin(s.t * 1.7) * 0.15;
    for (const sd of [1, -1]) {
      const e = [h[0] + 0.05 * ext, sd * (0.025 + 0.012 * ext) + sw * 0.03, h[2] + 0.07 * ext]; b.tube([h, e], 0.006, C.b, { sides: 5 }); b.ball(e, 0.008, '#2A2622');
      b.tube([[h[0] + 0.01, sd * 0.012, h[2] - 0.01], [h[0] + 0.035 * ext, sd * 0.03, h[2] - 0.005]], 0.004, C.b, { sides: 4 });
    }
  }
}
anDef('snail', { th: 'หอยทาก', en: 'snail', grp: 'หอยและหมึก (มอลลัสก์)', hint: 'คลานช้า ๆ ด้วยเท้า หนวดยืดหด แตะแล้วหดเข้าเปลือก แล้วค่อย ๆ ออกมาใหม่', kw: 'หอย หอยทากบก มอลลัสก์ เปลือก', go: 'walk', spd: 0.035, fast: 0.035, stride: 0.06, turn: 0.8, acc: 0.3, brake: 0.05, roam: 0.12, R: 0.26, tz: 0.06, react: 'hide',
  loop: [['go', 8], ['look', 3], ['go', 7]], acts: { go: 'คลานด้วยเท้า', look: 'ยืดหนวดดูรอบตัว', hide: 'หดเข้าเปลือก' }, C: { b: '#B9A98E', s: '#A9733E', d: '#6E4626' },
  draw: anSnail, props: (b) => { anGrass(b, 0.25, -0.2, 0.7); anGrass(b, -0.2, 0.25, 0.6); }, sh: [0.13, 0.06] });

/* ----- frogs and toads: they sit with the hind legs folded in a Z, the throat pumping; a hop throws the legs out
   behind. Touched, a frog leaps far away; a toad puffs itself up big ----- */
function anFrog(b, s, C, D) {
  const Q = D.Q, u = s.hop ? s.hop.u : 0, big = s.hop && s.hop.len > D.hopLen * 1.2;
  const ext = s.hop ? anCl(Math.sin(Math.PI * Math.min(1, u * 1.5)) * 1.2, 0, 1) : 0, puff = s.rx && s.rx.k === 'puff' ? s.rk : 0, k = Q.k * (1 + 0.32 * puff);
  const call = s.act === 'call' ? Math.max(0, Math.sin(s.aT * 7)) * anBell(s.ap, 0.1) : 0, breathe = 0.5 + 0.5 * Math.sin(s.t * 3.5);
  const bp = -0.38 + 0.4 * ext + (big ? -0.2 * Math.cos(Math.PI * u) : 0), z0 = 0.045 * k + 0.02 * puff;
  b.push([0, 0, z0], anRy(bp));
  const cb = (q) => (q[2] < -0.35 ? C.b2 : (Q.stripe && Math.abs(q[1]) < 0.12 && q[2] > 0.5 ? C.s : (Q.spots && Math.sin(q[0] * 13 + q[1] * 9) * Math.sin(q[1] * 11 - q[2] * 7) > 0.5 ? C.d : C.b)));
  b.ell([0, 0, 0], [0.085 * k, 0.06 * k, 0.045 * k], null, cb, { n1: 10, n2: 12 });
  b.ell([0.07 * k, 0, 0.012 * k], [0.05 * k, 0.055 * k, 0.034 * k], null, cb, { n1: 8, n2: 10 });
  if (Q.warts) for (let i = 0; i < 12; i++) { const a = i * 2.4, r = 0.3 + (i % 4) * 0.17; b.ball([(-0.05 + 0.1 * ((i * 0.37) % 1)) * k, Math.sin(a) * 0.04 * k * r * 1.8, (0.035 + 0.01 * Math.cos(a)) * k], 0.007 * k, C.d); }
  for (const sd of [1, -1]) { b.ell([0.085 * k, sd * 0.032 * k, 0.04 * k], [0.018 * k, 0.018 * k, 0.016 * k], null, C.b, { n1: 5, n2: 7 }); b.eye([0.09 * k, sd * 0.036 * k, 0.05 * k], 0.014 * k, [0.4, sd, 0.6], Q.eye); }
  b.line([[0.115 * k, 0.035 * k, -0.002], [0.122 * k, 0, 0.0], [0.115 * k, -0.035 * k, -0.002]], 'rgba(50,50,40,0.7)', 0.003);
  if (Q.sac) b.ell([0.085 * k, 0, -0.03 * k], [0.035 * k * (0.4 + 0.8 * call + 0.1 * breathe), 0.034 * k * (0.4 + 0.9 * call), 0.022 * k * (0.4 + 0.9 * call + 0.1 * breathe)], null, C.v, { n1: 6, n2: 8 });
  b.pop();
  /* legs in the frame of the ground under the frog */
  const toB = (p) => { const q = anMv(anRy(bp), p); return [q[0], q[1], q[2] + z0]; };
  for (const sd of [1, -1]) {
    const Sh = toB([0.06 * k, sd * 0.045 * k, -0.02 * k]), Hd = ext > 0.3 ? anAdd(Sh, [0.06 * k * (1 + ext), sd * 0.03 * k, -0.02 * k]) : [0.1 * k, sd * 0.065 * k, -s.z];
    b.tube([Sh, anIK(Sh, Hd, 0.045 * k, 0.045 * k, [-1, 0, 0]), Hd], 0.011 * k, C.b, { sides: 5 });
    for (const a of [-0.5, 0, 0.5]) b.line([Hd, anAdd(Hd, [Math.cos(a) * 0.022 * k, sd * Math.sin(a + 0.4) * 0.022 * k, 0])], C.b, 0.006 * k);
    /* the hind leg: hip, knee, ankle, toe; folded (Z) when it sits, thrown out behind when it hops */
    const Hp = toB([-0.07 * k, sd * 0.04 * k, -0.01 * k]);
    const fold = [[0.0, sd * 0.1, 0.03 - 0.0], [-0.09, sd * 0.085, 0.012], [0.0, sd * 0.1, 0.0]].map((q) => [q[0] * k, q[1] * k, q[2] * k - s.z]);
    const out = [[-0.14, sd * 0.07, 0.0], [-0.23, sd * 0.06, -0.01], [-0.3, sd * 0.06, -0.01]].map((q) => anAdd(Hp, [q[0] * k, q[1] * k - Hp[1] + sd * 0.0, q[2] * k]));
    const [Kn, An, Te] = fold.map((q, i) => anLerp(q, out[i], ext));
    b.tube([Hp, Kn], (t) => 0.022 * k * (1 - 0.35 * t), C.b, { sides: 6 }); b.tube([Kn, An], 0.013 * k, C.b, { sides: 5 }); b.tube([An, Te], 0.008 * k, C.b, { sides: 5 });
    b.sheet([Te, anAdd(Te, [0.04 * k * (ext > 0.5 ? -1 : 1), sd * 0.025 * k, 0]), anAdd(Te, [0.045 * k * (ext > 0.5 ? -1 : 1), -sd * 0.012 * k, 0])], C.b);
  }
}
const AN_QFROG = { k: 1, sac: true, eye: '#3A2E18', spots: true };
anDef('frog', { th: 'กบ', en: 'frog', grp: 'สัตว์สะเทินน้ำสะเทินบก', hint: 'กบนา นั่งพองคอร้อง กระโดดไปมา แตะแล้วกระโดดไกลหนี', kw: 'กบนา สัตว์ครึ่งบกครึ่งน้ำ', go: 'hop', spd: 0.4, fast: 1, hopLen: 0.14, hopH: 0.07, hopT: 0.42, hopRest: 0.5, jumpLen: 0.42, jumpH: 0.2, turn: 4, roam: 0.16, R: 0.28, tz: 0.06, react: 'jump',
  loop: [['call', 3.5], ['go', 2.5], ['rest', 2], ['go', 2], ['call', 3]], acts: { go: 'กระโดด', rest: 'นั่งนิ่ง', call: 'พองถุงใต้คอส่งเสียงร้อง', jump: 'กระโดดไกลหนี' }, C: { b: '#7C8C46', b2: '#E2DCB4', d: '#4E5A2C', v: '#C8C49A' },
  Q: AN_QFROG, draw: anFrog, props: (b) => { anGrass(b, 0.28, -0.18, 0.8); anGrass(b, -0.26, 0.2, 0.7); }, sh: [0.11, 0.07] });
anDef('ricefrog', { th: 'เขียด', en: 'rice frog', grp: 'สัตว์สะเทินน้ำสะเทินบก', hint: 'ตัวเล็กกว่ากบ มีแถบสีอ่อนกลางหลัง กระโดดเร็วและบ่อย แตะแล้วกระโดดหนีไปไกล', kw: 'เขียดนา สัตว์ครึ่งบกครึ่งน้ำ กบเล็ก', go: 'hop', spd: 0.5, fast: 1, hopLen: 0.12, hopH: 0.06, hopT: 0.32, hopRest: 0.3, jumpLen: 0.38, jumpH: 0.16, turn: 5, roam: 0.14, R: 0.22, tz: 0.04, react: 'jump',
  loop: [['go', 2], ['rest', 1.8], ['go', 2.5], ['call', 2.5]], acts: { go: 'กระโดด', rest: 'นั่งนิ่ง', call: 'ร้อง', jump: 'กระโดดไกลหนี' }, C: { b: '#6A7440', b2: '#E6E0C0', d: '#3E4626', s: '#C8C890', v: '#D8D4A8' },
  Q: { k: 0.72, sac: true, eye: '#2A2416', stripe: true, spots: true }, draw: anFrog, props: (b) => { anGrass(b, 0.2, -0.16, 0.6); anGrass(b, -0.18, 0.18, 0.55); }, sh: [0.08, 0.05] });
anDef('toad', { th: 'คางคก', en: 'toad', grp: 'สัตว์สะเทินน้ำสะเทินบก', hint: 'ผิวขรุขระมีตุ่ม คลานและกระโดดสั้น ๆ แตะแล้วพองตัวให้ดูใหญ่', kw: 'คางคกบ้าน ต่อมพิษ สัตว์ครึ่งบกครึ่งน้ำ', go: 'hop', spd: 0.3, fast: 0.6, hopLen: 0.07, hopH: 0.03, hopT: 0.4, hopRest: 0.7, jumpLen: 0.12, jumpH: 0.04, turn: 2.5, roam: 0.15, R: 0.28, tz: 0.06, react: 'puff',
  loop: [['go', 3.5], ['rest', 3], ['go', 3], ['look', 2]], acts: { go: 'กระโดดสั้น ๆ', rest: 'นั่งนิ่ง', look: 'มองหาแมลง', puff: 'พองตัวให้ดูใหญ่' }, C: { b: '#8C6E48', b2: '#D8C8A4', d: '#5E4630', v: '#C8B48A' },
  Q: { k: 1.05, warts: true, eye: '#5A3A10' }, draw: anFrog, sh: [0.12, 0.08] });
/* ----- worm-shaped: the body follows where the head went. The earthworm crawls by waves of stretching and
   shortening, the caecilian (งูดิน, an amphibian without legs) by side to side bends; both go down into the soil
   and come up somewhere else. Touched, they shorten and dig in at once ----- */
function anDig(D, s, dt, sp) {
  const W = s.fx;
  if (!W.dig) { W.dig = { ph: 0 }; s.h = Math.atan2(-s.y, -s.x) + (anRng(s) - 0.5) * 1.2; }
  const g = W.dig, L = D.L;
  /* near the edge of its patch it bends back towards the middle (under the soil too) */
  if (anFar(D, s)) s.h = anAng(s.h + anCl(anAng(Math.atan2(-s.y, -s.x) - s.h), -2.5 * dt, 2.5 * dt));
  if (g.ph === 0) { /* head goes down, the body slides into the hole after it */
    if (!W.holeA) W.holeA = [s.x, s.y];
    s.v = sp; s.x += Math.cos(s.h) * sp * 0.55 * dt; s.y += Math.sin(s.h) * sp * 0.55 * dt; s.z = Math.max(-L - 0.1, s.z - sp * dt * 1.4);
    const tail = anAlong(s, L); if (tail[2] < -0.02 && s.z <= -L * 0.6) { g.ph = 1; g.t = 0; }
  } else if (g.ph === 1) { /* under the soil for a moment, then somewhere else */
    s.hidden = true; g.t += dt; s.v = 0;
    if (g.t > 0.8) { const p = anTarget(D, s); s.h = Math.atan2(-p[1], -p[0]) + (anRng(s) - 0.5) * 1.4; s.x = p[0] - Math.cos(s.h) * 0.12; s.y = p[1] - Math.sin(s.h) * 0.12; s.z = -0.12; W.holeA = null; W.holeB = [s.x + Math.cos(s.h) * 0.12, s.y + Math.sin(s.h) * 0.12]; s.trail = []; for (let i = 0; i < 60; i++) s.trail.push([s.x - Math.cos(s.h) * i * 0.01, s.y - Math.sin(s.h) * i * 0.01, -0.12 - i * 0.012]); s.hidden = false; g.ph = 2; }
  } else { /* comes up head first */
    s.v = sp; s.x += Math.cos(s.h) * sp * dt; s.y += Math.sin(s.h) * sp * dt; s.z = Math.min(0, s.z + sp * dt * 1.2);
    if (s.z >= 0) { const tail = anAlong(s, L); if (tail[2] >= -0.01) { W.dig = null; W.holeB = null; return true; } }
  }
  return false;
}
function anWormTick(s, dt, act) {
  const D = AN[s.kind];
  if (act === 'dig') { if (anDig(D, s, dt, D.spd * 1.3)) anNext(D, s); return true; }
  if (act === 'go') {
    if (!s.tg) s.tg = anTarget(D, s);
    const pulse = D.worm ? Math.max(0, Math.sin(s.t * 3.2)) * 2 : 1;
    const done = anMove(D, s, dt, s.tg, D.spd * pulse); if (D.wiggle) s.h += Math.cos(s.t * 4.5) * D.wiggle * dt;
    if (done || s.aT > D.loop[s.si][1]) anNext(D, s);
    return true;
  }
  return false;
}
function anWorm(b, s, C, D) {
  /* drawn in the world: the trail is there already; this frame is the worm's own, so undo it */
  b.pop(); b.push([0, 0, 0]);
  const L = D.L * (1 - 0.35 * (s.rx ? s.rk : 0)), n = 22, pts = [];
  for (let i = 0; i <= n; i++) { let d = L * i / n; if (D.worm) d *= 1 + 0.06 * Math.sin(i / n * 9 - s.t * 3.2); const p = anAlong(s, d); pts.push(p); }
  const R0 = D.r * (1 + 0.3 * (s.rx ? s.rk : 0));
  b.tube(pts, (t) => { const pk = D.worm ? 1 + 0.18 * Math.sin(t * 9 - s.t * 3.2 + 1.6) : 1; const r = R0 * pk * (t < 0.06 ? 0.55 + 7 * t : t > 0.85 ? 1 - (t - 0.85) * 3.2 : 1); return [r, r * 0.92]; },
    (t) => (D.worm && t > 0.24 && t < 0.33 ? C.c : Math.sin(t * D.rings) > 0.55 ? C.d : C.b), { sides: 8 });
  if (!D.worm) { const h = pts[0], h1 = pts[1], f = anUnit(anSub(h, h1)), sd = anUnit(anCross([0, 0, 1], f)); b.eye(anAdd(anAdd(h, anMul(f, -0.004)), anAdd(anMul(sd, R0 * 0.62), [0, 0, R0 * 0.45])), 0.0045, sd); b.eye(anAdd(anAdd(h, anMul(f, -0.004)), anAdd(anMul(sd, -R0 * 0.62), [0, 0, R0 * 0.45])), 0.0045, anMul(sd, -1)); }
}
const anSoil = (c, P, s, C, D) => {
  anPatch(c, P, 0, 0, D.R * 0.95, D.R * 0.72, 'rgba(150,112,72,0.42)', 'rgba(110,80,50,0.5)', 'rgba(90,64,40,0.6)');
  for (const h of [s.fx.holeA, s.fx.holeB]) if (h) anPatch(c, P, h[0], h[1], 0.03, 0.022, 'rgba(40,28,18,0.85)', null, null);
};
anDef('worm', { th: 'ไส้เดือน', en: 'earthworm', grp: 'หนอนปล้อง (แอนเนลิด)', hint: 'ไส้เดือนดิน คืบไปด้วยการยืดหดลำตัว มุดลงดินแล้วโผล่ที่ใหม่ แตะแล้วหดตัวมุดดินทันที', kw: 'ไส้เดือนดิน ปล้อง ดิน สัตว์ไม่มีกระดูกสันหลัง', go: 'walk', worm: true, L: 0.34, r: 0.013, rings: 140, spd: 0.045, fast: 0.08, stride: 0.1, turn: 0.9, roam: 0.15, R: 0.3, tz: 0.0, react: 'burrow', clip: true,
  loop: [['go', 8], ['dig', 30], ['go', 6]], acts: { go: 'คืบด้วยการยืดหดลำตัว', dig: 'มุดลงดิน', burrow: 'หดตัว มุดดินหนี' }, C: { b: '#C27C70', d: '#A8645A', c: '#D9A090' },
  start: (s) => { s.kind = 'worm'; s.trail = []; for (let i = 0; i < 80; i++) s.trail.push([-i * 0.01 * Math.cos(0.5), -i * 0.01 * Math.sin(0.5), 0]); }, tick: anWormTick, draw: anWorm, ground: anSoil,
  rxTick: (s, dt, R) => { if (R.t > 0.6) { if (anDig(AN.worm, s, dt, 0.16)) R.t = R.T; else R.t = Math.min(R.t, R.T - 0.05); } } });
anDef('caecilian', { th: 'งูดิน', en: 'caecilian', grp: 'สัตว์สะเทินน้ำสะเทินบก', hint: 'ไม่ใช่งู ไม่มีขา ผิวลื่นเป็นวงปล้อง เลื้อยส่ายตัวแล้วมุดลงดิน แตะแล้วรีบมุดดินหนี', kw: 'เขียดงู สัตว์ครึ่งบกครึ่งน้ำไม่มีขา ดิน', go: 'walk', L: 0.42, r: 0.016, rings: 260, wiggle: 2.2, spd: 0.09, fast: 0.15, stride: 0.1, turn: 1.4, roam: 0.15, R: 0.34, tz: 0.0, react: 'burrow', clip: true,
  loop: [['go', 7], ['dig', 30], ['go', 5]], acts: { go: 'เลื้อยส่ายตัว', dig: 'มุดลงดิน', burrow: 'รีบมุดดินหนี' }, C: { b: '#4C5062', d: '#3A3E4C' },
  start: (s) => { s.kind = 'caecilian'; s.trail = []; for (let i = 0; i < 80; i++) s.trail.push([-i * 0.01, Math.sin(i * 0.15) * 0.02, 0]); }, tick: anWormTick, draw: anWorm, ground: anSoil,
  rxTick: (s, dt, R) => { if (R.t > 0.4) { if (anDig(AN.caecilian, s, dt, 0.22)) R.t = R.T; else R.t = Math.min(R.t, R.T - 0.05); } } });
/* ----- lizards: a body that bends side to side as the legs step in diagonal pairs; they stop and go. Touched, the
   house lizard darts off; the tokay gecko opens its mouth wide at you first ----- */
function anLizard(b, s, C, D) {
  const Q = D.Q, k = Q.k, mv = Math.min(1.6, s.mv), wv = s.ph, n = 14, pts = [];
  const gape = s.rx && s.rx.k === 'threat' && s.rx.t < 1.2 ? s.rk : 0;
  for (let i = 0; i <= n; i++) { const u = i / n, x = (0.13 - 0.55 * u) * k, amp = (0.012 + 0.05 * u * u) * k * (0.4 + 0.6 * Math.min(1, mv)); pts.push([x, amp * Math.sin(u * 5 - wv) + (Q.curl ? 0.02 * Math.sin(s.t * 0.7) * u : 0), 0.025 * k * (1 - u * 0.7)]); }
  const prof = (t) => { const r = (t < 0.12 ? 0.022 + 0.06 * t : t < 0.38 ? 0.03 : 0.03 * (1 - (t - 0.38) / 0.62 * 0.92)) * k; return [r, r * 0.62]; };
  if (Q.crest) for (let i = 1; i < 7; i++) { const p = pts[i], q = pts[i + 1], r = prof(i / n)[1]; b.sheet([[p[0], p[1], p[2] + r * 0.9], [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, p[2] + r * 0.9 + Q.crest * k * (1 - i / 9)], [q[0], q[1], q[2] + r * 0.9]], C.d); }
  b.tube(pts, prof, (t, a) => (Math.sin(a) < -0.3 ? C.b2 : (Q.scutes && Math.sin(a) > 0.3 && Math.sin(t * 70) * Math.cos(a * 4) > 0.3 ? C.d : Q.spot && Math.sin(t * 60) * Math.cos(a * 3) > 0.55 ? C.s : (Q.band && Math.sin(t * 45) > 0.75 && t > 0.4 ? C.d : C.b))), { sides: 8 });
  const H = pts[0], f = anUnit(anSub(pts[0], pts[2])), yaw = Math.atan2(f[1], f[0]);
  b.push(anAdd(H, [f[0] * 0.03 * k, f[1] * 0.03 * k, 0.003 * k]), anMs(anRz(yaw), anRy(s.act === 'look' ? -0.25 : 0)));
  const sn = Q.snout || 1, hc = Q.blush ? anHexMix(C.b, Q.blush, s.act === 'look' ? anBell(s.ap, 0.25) : 0) : C.b;
  b.ell([0.01 * k * sn, 0, 0], [0.045 * k * sn, 0.026 * k, 0.017 * k], null, hc, { n1: 7, n2: 9 });
  b.push([-0.01 * k, 0, -0.008 * k], anRy(0.65 * gape)); b.ell([0.035 * k * sn, 0, -0.003 * k], [0.035 * k * sn, 0.022 * k, 0.007 * k], null, C.b2, { n1: 6, n2: 8 }); b.pop();
  if (gape > 0.2) b.ell([0.02 * k * sn, 0, -0.008 * k], [0.03 * k * sn, 0.018 * k, 0.006 * k], null, Q.mouth || '#C84A4A', { n1: 5, n2: 7 });
  for (const sd of [1, -1]) b.eye([0.015 * k, sd * 0.022 * k, 0.008 * k], 0.008 * k, [0.2, sd, 0.4], Q.eye);
  if (s.act === 'lick' && Math.sin(s.aT * 5) > 0.6) b.line([[0.05 * k, 0, -0.003 * k], [0.075 * k, 0, 0.002 * k], [0.03 * k, 0.02 * k, 0.01 * k]], '#D86A7A', 0.004 * k);
  b.pop();
  /* legs out to the sides, elbows up, the feet in diagonal pairs */
  for (const [ix, front] of [[3, 1], [7, 0]]) for (const sd of [1, -1]) {
    const Hp = anAdd(pts[ix], [0, sd * 0.02 * k, -0.005 * k]), p = s.ph + (front ? 0 : Math.PI) + (sd > 0 ? 0 : Math.PI);
    const F = [Hp[0] + (front ? 0.035 : -0.035) * k + 0.04 * k * Math.sin(p) * Math.min(1, mv), Hp[1] + sd * 0.06 * k, 0.018 * k * Math.max(0, Math.cos(p)) * Math.min(1, mv)];
    const K = anIK(Hp, F, 0.04 * k, 0.04 * k, [front ? -0.3 : 0.3, sd * 0.2, 1]); b.tube([Hp, K, F], (t) => 0.009 * k * (1 - 0.4 * t), C.b, { sides: 5 });
    for (const a of [-0.8, -0.3, 0.2, 0.7]) { const e = anAdd(F, [Math.cos(a + (front ? 0 : 3.14) * 0) * 0.02 * k * (front ? 1 : 1), sd * Math.abs(Math.sin(a)) * 0.02 * k + sd * 0.004, 0]); b.line([F, e], C.b, 0.0035 * k); if (Q.pads) b.ball(e, 0.0045 * k, C.b2); }
  }
}
anDef('houselizard', { th: 'จิ้งจก', en: 'house gecko', grp: 'สัตว์เลื้อยคลาน', hint: 'วิ่งเป็นช่วง ๆ หยุดผงกหัว แลบลิ้น แตะแล้ววิ่งพรวดหนี', kw: 'จิ้งจกบ้าน สัตว์เลื้อยคลาน', go: 'walk', spd: 0.35, fast: 0.9, stride: 0.09, turn: 6, acc: 6, roam: 0.15, R: 0.26, tz: 0.02, react: 'dart', fleeLen: 0.5,
  loop: [['go', 1.1], ['look', 1.6], ['go', 0.9], ['lick', 1.4], ['go', 1.2], ['rest', 2]], acts: { go: 'วิ่งเป็นช่วง ๆ', look: 'หยุดผงกหัว', lick: 'แลบลิ้น', rest: 'หยุดนิ่ง', dart: 'วิ่งพรวดหนี' }, C: { b: '#D6C2A0', b2: '#EEE4D2', d: '#B49C78' },
  Q: { k: 0.8, band: true, eye: '#2A2418' }, draw: anLizard, sh: [0.14, 0.05] });
anDef('gecko', { th: 'ตุ๊กแก', en: 'tokay gecko', grp: 'สัตว์เลื้อยคลาน', hint: 'ตัวสีเทาฟ้ามีจุดส้ม นิ้วมีแผ่นยึดเกาะ เลียตา แตะแล้วอ้าปากกว้างขู่ แล้ววิ่งหนี', kw: 'ตุ๊กแกบ้าน สัตว์เลื้อยคลาน', go: 'walk', spd: 0.2, fast: 0.6, stride: 0.12, turn: 4, acc: 4, roam: 0.15, R: 0.32, tz: 0.03, react: 'threat', fleeLen: 0.45,
  loop: [['go', 1.5], ['lick', 1.6], ['rest', 2.4], ['go', 1.4], ['look', 1.6]], acts: { go: 'คลาน', lick: 'แลบลิ้นเลียตา', rest: 'เกาะนิ่ง', look: 'ผงกหัวมอง', threat: 'อ้าปากกว้างขู่ แล้ววิ่งหนี' }, C: { b: '#7C8CA4', b2: '#C8CEDA', s: '#E07A3A', d: '#5A6680' },
  Q: { k: 1.1, spot: true, pads: true, eye: '#8A7A2A' }, draw: anLizard, sh: [0.2, 0.07] });
/* ----- a turtle: a domed shell, slow steps; touched, it pulls its head and legs into the shell ----- */
function anTurtle(b, s, C, D) {
  const hide = s.rx && s.rx.k === 'hide' ? s.rk : 0, ext = 1 - hide, mv = Math.min(1, s.mv), z0 = 0.045 + 0.012 * ext;
  b.ell([0, 0, z0], [0.17, 0.13, 0.085], null, (u) => (u[2] < -0.1 ? C.b2 : (Math.sin(u[0] * 9) * Math.sin(u[1] * 9) > 0.55 || Math.abs(Math.sin(u[0] * 9)) < 0.12 || Math.abs(Math.sin(u[1] * 9)) < 0.12 ? C.d : C.s)), { n1: 12, n2: 14, def: (u) => [0, 0, u[2] < 0 ? -u[2] * 0.06 : 0] });
  b.ell([0, 0, z0 - 0.005], [0.165, 0.125, 0.018], null, C.b2, { n1: 8, n2: 12 });
  const look = s.act === 'look' ? Math.sin(s.aT * 1.5) * 0.5 : 0, N0 = [0.14, 0, z0 + 0.01], Hh = anAdd(N0, anMv(anRz(look), [0.03 + 0.07 * ext, 0, 0.01 + 0.015 * ext]));
  b.tube([N0, Hh], 0.026 * (0.6 + 0.4 * ext), C.b, { sides: 7 });
  b.push(Hh, anRz(look)); b.ell([0.025, 0, 0.005], [0.04, 0.03, 0.026], null, C.b, { n1: 7, n2: 9 });
  if (ext > 0.3) { b.eye([0.035, 0.022, 0.014], 0.007, [0.3, 1, 0.3]); b.eye([0.035, -0.022, 0.014], 0.007, [0.3, -1, 0.3]); }
  b.pop();
  for (const [x0, sd, off] of [[0.09, 1, 0], [0.09, -1, 1], [-0.09, 1, 1], [-0.09, -1, 0]]) {
    const p = s.ph + off * Math.PI, Hp = [x0, sd * 0.1, z0], F = [x0 + (x0 > 0 ? 0.02 : -0.02) + 0.03 * Math.sin(p) * mv, sd * (0.1 + 0.06 * ext), 0.015 * Math.max(0, Math.cos(p)) * mv];
    const Fi = anLerp(Hp, F, ext); b.tube([Hp, Fi], (t) => 0.026 * (1 - 0.3 * t), C.b, { sides: 6 });
  }
  b.tube([[-0.15, 0, z0], [-0.15 - 0.04 * ext, 0, z0 - 0.02]], (t) => 0.014 * (1 - 0.8 * t), C.b, { sides: 5 });
}
anDef('turtle', { th: 'เต่า', en: 'turtle', grp: 'สัตว์เลื้อยคลาน', hint: 'เดินช้า ๆ ยืดคอมองรอบตัว แตะแล้วหดหัวและขาเข้ากระดอง แล้วค่อย ๆ ยื่นออกมา', kw: 'เต่านา เต่าบก กระดอง สัตว์เลื้อยคลาน', go: 'walk', spd: 0.04, fast: 0.04, stride: 0.1, turn: 0.8, acc: 0.4, brake: 0.06, roam: 0.15, R: 0.36, tz: 0.06, react: 'hide',
  loop: [['go', 7], ['look', 3.5], ['go', 6], ['rest', 3]], acts: { go: 'เดินช้า ๆ', look: 'ยืดคอมองรอบตัว', rest: 'หยุดพัก', hide: 'หดหัวและขาเข้ากระดอง' }, C: { b: '#8C8C62', b2: '#D8CC9C', s: '#6E6A40', d: '#4A4628' },
  draw: anTurtle, props: (b) => { anGrass(b, 0.3, -0.22, 0.8); anGrass(b, -0.28, 0.24, 0.7); }, sh: [0.2, 0.16] });

/* ----- insects: head, thorax and abdomen, six legs stepping in two sets of three, feelers, wings that beat when it
   flies. The butterfly and the bee go to flowers and drink; the ant walks and feels the way; the grasshopper hops ----- */
function anInsect(b, s, C, D) {
  const Q = D.Q, k = Q.k, fly = D.go === 'fly' ? !s.perched && s.z > Q.zb * 1.6 : (s.hop ? s.hop.H > 0.1 : false);
  const mv = Math.min(1.5, s.mv), zb = Q.zb * k;
  b.push([0, 0, fly ? 0 : zb], anRy(fly ? (Q.fp || 0.1) : (Q.bp || 0)));
  /* abdomen, thorax, head */
  const ab = Q.ab, abp = (Q.abUp || 0) + (s.rx && s.rx.k === 'flee' && Q.raise ? -0.6 * s.rk : 0) + (D.id === 'mosquito' && !fly ? -0.25 : 0);
  b.push([-Q.th[0] * 0.8 * k, 0, 0], anRy(abp));
  b.ell([-ab[0] * k, 0, 0], [ab[0] * k, ab[1] * k, ab[2] * k], null, Q.stripes ? (u) => (Math.sin((u[0] + 1) * Q.stripes) > 0.2 ? C.s : C.b) : C.b, { n1: Q.n1 || 9, n2: 9 });
  if (Q.sting) b.tube([[-ab[0] * 2 * k, 0, 0], [-ab[0] * 2 * k - 0.012 * k, 0, -0.002]], (t) => 0.003 * k * (1 - t), '#2A2420', { sides: 4 });
  b.pop();
  if (Q.waist) b.ball([-Q.th[0] * 0.9 * k, 0, 0.002], Q.waist * k, C.b);
  b.ell([0, 0, 0], [Q.th[0] * k, Q.th[1] * k, Q.th[2] * k], null, C.t || C.b, { n1: 7, n2: 9 });
  b.push([Q.th[0] * k + Q.hd[0] * 0.8 * k, 0, Q.hd[2] * 0.3 * k], anRy(Q.hdp || 0.3));
  b.ell([0, 0, 0], [Q.hd[0] * k, Q.hd[1] * k, Q.hd[2] * k], null, C.h || C.b, { n1: 6, n2: 8 });
  for (const sd of [1, -1]) {
    b.eye([Q.hd[0] * 0.3 * k, sd * Q.hd[1] * 0.75 * k, Q.hd[2] * 0.25 * k], (Q.eye || 0.4) * Q.hd[1] * k, [0.4, sd, 0.3], C.e);
    const tap = Math.sin(s.t * (Q.tap || 3) + sd * 1.3) * 0.25, an = Q.ant * k;
    if (an > 0) b.line([[Q.hd[0] * 0.6 * k, sd * Q.hd[1] * 0.4 * k, Q.hd[2] * 0.5 * k], [Q.hd[0] * k + an * 0.45, sd * (an * 0.25 + tap * an * 0.3), Q.hd[2] * k + an * 0.4], [Q.hd[0] * k + an * 0.8, sd * (an * 0.42 + tap * an * 0.5), Q.hd[2] * k + an * (Q.antUp || 0.25)]], C.a || C.b, 0.0035 * k);
    if (Q.club && an > 0) b.ball([Q.hd[0] * k + an * 0.8, sd * (an * 0.42 + tap * an * 0.5), Q.hd[2] * k + an * (Q.antUp || 0.25)], 0.006 * k, C.a || C.b);
  }
  /* the butterfly's tongue uncoils into the flower while it drinks; the mosquito's stays straight */
  if (Q.tongue) { const sip = s.perched ? 1 : 0; if (sip) b.line([[Q.hd[0] * k, 0, -Q.hd[2] * 0.4 * k], [Q.hd[0] * k + 0.01 * k, 0, -Q.hd[2] * k - 0.025 * k]], '#3A2A20', 0.003 * k); else b.line([[Q.hd[0] * k, 0, -Q.hd[2] * 0.5 * k], [Q.hd[0] * k + 0.008 * k, 0, -Q.hd[2] * 0.9 * k], [Q.hd[0] * k + 0.003 * k, 0, -Q.hd[2] * 1.05 * k]], '#3A2A20', 0.003 * k); }
  if (Q.beak) b.line([[Q.hd[0] * k, 0, -Q.hd[2] * 0.3 * k], [Q.hd[0] * k + Q.beak * k, 0, -Q.hd[2] * k - Q.beak * 0.6 * k]], C.a || '#2A2420', 0.003 * k);
  if (Q.horn) b.tube([[Q.hd[0] * 0.6 * k, 0, Q.hd[2] * 0.4 * k], [Q.hd[0] * 1.6 * k, 0, Q.hd[2] * 1.4 * k], [Q.hd[0] * 2.1 * k, 0, Q.hd[2] * 3 * k], [Q.hd[0] * 1.9 * k, 0, Q.hd[2] * 3.8 * k]], (t) => 0.004 * k * (1 - 0.6 * t), C.d || C.b, { sides: 6 });
  if (Q.jaw) for (const sd of [1, -1]) b.line([[Q.hd[0] * 0.9 * k, sd * 0.004 * k, -0.004 * k], [Q.hd[0] * 1.5 * k, sd * 0.001 * k, -0.006 * k]], C.d || '#2A2420', 0.003 * k);
  b.pop();
  /* wings */
  if (Q.wings) Q.wings(b, s, C, D, fly);
  b.pop();
  /* six legs: on the ground in two sets of three, or hanging under it in the air */
  for (let i = 0; i < 3; i++) for (const sd of [1, -1]) {
    const set = (i % 2 === 0) === (sd > 0) ? 0 : Math.PI, p = s.ph + set, hx = (Q.th[0] * (0.5 - i * 0.5)) * k, Hp = [hx, sd * Q.th[1] * 0.6 * k, (fly ? 0 : zb) - Q.th[2] * 0.4 * k];
    const sp = Q.leg * k, fx = hx + [0.9, 0.05, -0.9][i] * sp * 0.6, big = Q.hind && i === 2;
    let F = [fx + 0.25 * sp * Math.sin(p) * Math.min(1, mv), sd * sp * (big ? 0.55 : 0.85), 0.25 * sp * Math.max(0, Math.cos(p)) * Math.min(1, mv)];
    if (fly) F = [hx - 0.15 * sp - (i === 2 ? 0.25 * sp : 0), sd * sp * 0.35, Hp[2] - sp * 0.7];
    if (Q.dead && s.rx && s.rx.k === 'hide') F = anLerp(F, [hx, sd * sp * 0.3, Hp[2] - sp * 0.15], s.rk);
    if (big) { const fold = s.hop ? Math.sin(Math.PI * s.hop.u) : 0, kn = [hx - 0.035 * k - 0.08 * k * fold, sd * 0.03 * k, zb + 0.03 * k - 0.05 * k * fold], ft = [hx + (fold ? -0.1 : 0.01) * k, sd * 0.032 * k, fly ? zb - 0.06 * k : 0]; b.tube([Hp, kn], (t) => 0.007 * k * (1 - 0.4 * t), C.l || C.b, { sides: 5 }); b.line([kn, ft], C.l || C.b, 0.004 * k); continue; }
    const K = anIK(Hp, F, sp * 0.6, sp * 0.72, [0, sd * 0.3, 1]);
    b.line([Hp, K, F], C.l || C.d || '#2A2420', (Q.legw || 0.004) * k);
  }
}
const anWingPair = (shapeF, shapeH, col, o) => (b, s, C, D, fly) => {
  const Q = D.Q, k = Q.k, fl = fly ? Math.sin(s.t * Q.flap * 6.283) : 0;
  const rest = s.perched || !fly ? (o.restA != null ? o.restA + (o.breath ? 0.25 * Math.sin(s.t * 1.2) : 0) : 0.15) : 0;
  for (const sd of [1, -1]) for (const [shape, x0, lag] of [[shapeF, o.fx || 0, 0], [shapeH, o.hx || -0.01, 0.4]]) {
    if (!shape) continue;
    const a = fly ? (o.amp || 0.9) * Math.sin(s.t * Q.flap * 6.283 - lag) + (o.mid || 0.2) : rest;
    b.push([x0 * k, sd * Q.th[1] * 0.5 * k, Q.th[2] * 0.6 * k], anMs(anRx(sd * a), o.sweep ? anRz(sd * o.sweep * (fly ? 0 : 1)) : AN_I));
    b.sheet(shape.map((q) => [q[0] * k, sd * q[1] * k, q[2] * k]), typeof col === 'function' ? col(C) : col, { ec: o.ec ? o.ec(C) : null, stroke: o.stroke });
    if (o.spots) for (const q of o.spots) b.ball([q[0] * k, sd * q[1] * k, 0.0015 * k], q[2] * k, q[3] || '#F4EEE0');
    b.pop();
  }
  void fl;
};
const AN_FLOWERS = [[0.16, -0.12, 0.16, '#E85A8A'], [-0.18, 0.14, 0.13, '#F2D24A']];
const anFlowers = (b) => { for (const f of AN_FLOWERS) anFlower(b, f, f[3], 0.9); };
anDef('butterfly', { th: 'ผีเสื้อ', en: 'butterfly', grp: 'แมลง', hint: 'บินกระพือปีกไปเกาะดอกไม้ ยื่นงวงดูดน้ำหวาน แตะแล้วบินหนีขึ้นสูง', kw: 'แมลง ปีก งวง น้ำหวาน ผสมเกสร', go: 'fly', spd: 0.16, fast: 0.4, stride: 0.2, flap: 0, turn: 3, acc: 1.2, roam: 0.17, zLo: 0.18, zHi: 0.32, z0: 0.24, R: 0.27, tz: 0.12, react: 'flyoff', near: 0.02,
  loop: [['fly', 4.5], ['land', 6], ['fly', 4], ['land', 5]], acts: { fly: 'บินกระพือปีก', land: 'เกาะดอกไม้ ดูดน้ำหวาน', flyoff: 'บินหนีขึ้นสูง' }, C: { b: '#3A3430', w: '#EC8A2E', a: '#2A2420', e: '#1E1A18' },
  perch: (s) => { const f = AN_FLOWERS[s.fi || 0]; return [f[0], f[1], f[2] + 0.03]; }, enter: (s, act) => { if (act === 'land') s.fi = (s.fi || 0) ? 0 : 1; },
  Q: { k: 1.5, zb: 0.012, th: [0.018, 0.009, 0.01], ab: [0.022, 0.007, 0.008], hd: [0.008, 0.008, 0.008], ant: 0.045, club: true, antUp: 0.5, leg: 0.02, flap: 3.2, tongue: true, fp: 0, eye: 0.5,
    wings: anWingPair([[0.005, 0, 0], [0.05, 0.03, 0.002], [0.035, 0.075, 0.003], [0.0, 0.07, 0.002], [-0.01, 0.02, 0]], [[-0.005, 0, 0], [-0.005, 0.055, 0.001], [-0.035, 0.05, 0.001], [-0.045, 0.02, 0]], (C) => C.w, { restA: 1.25, breath: true, amp: 1.1, mid: 0.5, ec: () => 'rgba(30,26,24,0.95)', spots: [[0.035, 0.06, 0.006], [0.02, 0.066, 0.005]] }) },
  draw: anInsect, props: anFlowers, sh: [0.03, 0.02] });
anDef('bee', { th: 'ผึ้ง', en: 'honey bee', grp: 'แมลง', hint: 'บินหึ่งไปมาระหว่างดอกไม้ เก็บน้ำหวานและเกสร แตะแล้วบินวนหนี', kw: 'ผึ้งพันธุ์ แมลง ผสมเกสร น้ำผึ้ง', go: 'fly', spd: 0.22, fast: 0.6, stride: 0.2, flap: 0, turn: 5, acc: 2.5, roam: 0.17, zLo: 0.18, zHi: 0.3, z0: 0.24, R: 0.27, tz: 0.12, react: 'flyoff', near: 0.02,
  loop: [['fly', 2.4], ['land', 4], ['fly', 2.4], ['land', 4]], acts: { fly: 'บินหึ่งหาดอกไม้', land: 'เก็บน้ำหวานและเกสร', flyoff: 'บินวนหนี' }, C: { b: '#3A2E22', s: '#E8B43A', t: '#B88A4A', a: '#2A2420', e: '#1E1A18', l: '#3A2E22' },
  perch: (s) => { const f = AN_FLOWERS[s.fi || 0]; return [f[0], f[1], f[2] + 0.045]; }, enter: (s, act) => { if (act === 'land') s.fi = (s.fi || 0) ? 0 : 1; },
  Q: { k: 2.0, zb: 0.016, th: [0.014, 0.012, 0.012], ab: [0.02, 0.013, 0.013], stripes: 9, sting: true, hd: [0.008, 0.01, 0.009], ant: 0.022, antUp: 0.35, leg: 0.022, flap: 30, eye: 0.45,
    wings: anWingPair([[0, 0, 0], [0.005, 0.03, 0.004], [-0.022, 0.034, 0.004], [-0.02, 0.008, 0]], [[-0.005, 0, 0], [-0.012, 0.02, 0.002], [-0.028, 0.016, 0.002]], 'rgba(220,232,240,0.55)', { restA: 0.15, amp: 0.8, mid: 0.4, sweep: 0.5, stroke: 'rgba(120,130,140,0.5)' }) },
  draw: anInsect, props: anFlowers, sh: [0.03, 0.02] });
anDef('ant', { th: 'มด', en: 'ant', grp: 'แมลง', hint: 'เดินเป็นทาง ใช้หนวดคลำทางและแตะพื้น แตะแล้ววิ่งพล่านหนี', kw: 'มดแดง มดดำ แมลงสังคม', go: 'walk', spd: 0.11, fast: 0.35, stride: 0.075, turn: 4, acc: 3, roam: 0.1, R: 0.16, tz: 0.02, react: 'flee', fleeLen: 0.2,
  loop: [['go', 3], ['look', 1.6], ['go', 2.5], ['go', 2], ['look', 1.2]], acts: { go: 'เดินหาอาหาร', look: 'ใช้หนวดคลำทาง', flee: 'วิ่งพล่านหนี' }, C: { b: '#7A2E1E', a: '#5A2216', e: '#1E1612', d: '#5A2216' },
  Q: { k: 2.2, zb: 0.008, th: [0.009, 0.0045, 0.005], ab: [0.012, 0.008, 0.008], hd: [0.007, 0.0065, 0.006], hdp: 0.15, waist: 0.0028, ant: 0.018, antUp: 0.15, tap: 6, leg: 0.012, legw: 0.0018, abUp: 0.15, raise: true, jaw: true, eye: 0.3 },
  draw: anInsect, sh: [0.04, 0.018] });
anDef('mosquito', { th: 'ยุง', en: 'mosquito', grp: 'แมลง', hint: 'ยุงลาย บินวนเสียงหวี่ ลงเกาะแล้วยกขาหลัง แตะแล้วบินหนี', kw: 'ยุงลาย ไข้เลือดออก แมลง ลูกน้ำ', go: 'fly', spd: 0.14, fast: 0.5, stride: 0.2, turn: 5, acc: 3, roam: 0.13, zLo: 0.08, zHi: 0.2, z0: 0.14, R: 0.2, tz: 0.07, react: 'flyoff', near: 0.02,
  loop: [['fly', 4], ['land', 3.5], ['fly', 3.5]], acts: { fly: 'บินวน', land: 'ลงเกาะ ยกขาหลัง', flyoff: 'บินหนี' }, C: { b: '#2E2E34', t: '#3A3A40', a: '#2A2A30', e: '#1A1A1E', l: '#2E2E34' },
  perch: (s) => { if (!s.pp) { const p = anTarget(AN.mosquito, s); s.pp = [p[0] * 0.7, p[1] * 0.7, 0.054]; } return s.pp; }, enter: (s) => { s.pp = null; },
  Q: { k: 2.4, zb: 0.022, th: [0.009, 0.0055, 0.0065], ab: [0.02, 0.005, 0.005], stripes: 14, hd: [0.004, 0.004, 0.004], hdp: 0.6, ant: 0.012, antUp: 0.2, leg: 0.028, legw: 0.0018, flap: 40, beak: 0.016, bp: -0.1, n1: 11, eye: 0.6,
    wings: anWingPair([[0, 0, 0], [-0.005, 0.012, 0.002], [-0.026, 0.012, 0.002], [-0.024, 0.004, 0]], null, 'rgba(200,210,220,0.5)', { restA: 0.05, amp: 0.7, mid: 0.3, sweep: 0.15, stroke: 'rgba(110,120,130,0.5)' }) },
  draw: anInsect, sh: [0.045, 0.025] });
/* white bands on the black legs of a striped mosquito */
AN.mosquito.C.s = '#E8E8E8';
anDef('dragonfly', { th: 'แมลงปอ', en: 'dragonfly', grp: 'แมลง', hint: 'บินโฉบไปมาแล้วหยุดลอยนิ่งกลางอากาศ เกาะปลายกิ่งไม้ แตะแล้วพุ่งหนี', kw: 'แมลงปอบ้าน แมลง ล่าแมลง', go: 'fly', spd: 0.3, fast: 0.9, stride: 0.2, turn: 6, acc: 4, roam: 0.2, zLo: 0.16, zHi: 0.3, z0: 0.24, R: 0.3, tz: 0.14, react: 'flyoff', near: 0.02,
  loop: [['fly', 1.6], ['hover', 1.2], ['fly', 1.4], ['land', 5]], acts: { fly: 'บินโฉบ', hover: 'ลอยนิ่งกลางอากาศ', land: 'เกาะปลายกิ่งไม้', flyoff: 'พุ่งหนี' }, C: { b: '#2E6E8E', t: '#3E7A5A', a: '#2A2420', e: '#3A5A4A', l: '#2A2420' },
  perch: () => [-0.12, 0.08, 0.245], tick: (s, dt, act) => { if (act === 'hover') { s.v *= Math.max(0, 1 - 6 * dt); s.x += Math.cos(s.h) * s.v * dt; s.y += Math.sin(s.h) * s.v * dt; s.perched = false; if (s.aT >= 1.2) anNext(AN.dragonfly, s); return true; } return false; },
  Q: { k: 1.8, zb: 0.012, th: [0.014, 0.008, 0.009], ab: [0.05, 0.0045, 0.0045], stripes: 22, hd: [0.008, 0.011, 0.009], hdp: 0.1, eye: 0.75, ant: 0.004, leg: 0.014, legw: 0.0018, flap: 18, fp: 0, n1: 12,
    wings: anWingPair([[0.004, 0, 0], [0.006, 0.07, 0.001], [-0.006, 0.075, 0.001], [-0.008, 0, 0]], [[-0.01, 0, 0], [-0.008, 0.066, 0.001], [-0.024, 0.07, 0.001], [-0.024, 0, 0]], 'rgba(210,228,236,0.45)', { fx: 0.004, hx: -0.012, restA: 0.02, amp: 0.35, mid: 0.1, stroke: 'rgba(90,110,120,0.55)' }) },
  draw: anInsect, props: (b) => { b.tube([[-0.13, 0.07, 0], [-0.125, 0.075, 0.12], [-0.12, 0.08, 0.22]], (t) => 0.007 * (1 - 0.5 * t), '#7A5A3A', { sides: 5 }); anGrass(b, 0.2, -0.15, 0.8); }, sh: [0.09, 0.05] });
anDef('grasshopper', { th: 'ตั๊กแตน', en: 'grasshopper', grp: 'แมลง', hint: 'เกาะกินใบหญ้า ขาหลังใหญ่ กระโดดไปมา แตะแล้วดีดตัวกระโดดไกลหนี', kw: 'ตั๊กแตนข้าว แมลง ขาหลัง', go: 'hop', spd: 0.4, fast: 1, hopLen: 0.1, hopH: 0.05, hopT: 0.35, hopRest: 0.4, jumpLen: 0.3, jumpH: 0.16, turn: 4, roam: 0.12, R: 0.2, tz: 0.04, react: 'jump',
  loop: [['eat', 3], ['go', 2], ['rest', 2.5], ['go', 1.5]], acts: { eat: 'กินใบหญ้า', go: 'กระโดด', rest: 'เกาะนิ่ง', jump: 'ดีดตัวกระโดดไกลหนี' }, C: { b: '#7E9A3E', s: '#6A8634', a: '#5A6E2C', e: '#4A3A22', d: '#4E6228', l: '#7E9A3E' },
  Q: { k: 1.6, zb: 0.02, th: [0.016, 0.008, 0.01], ab: [0.026, 0.008, 0.009], hd: [0.009, 0.008, 0.011], hdp: 0.9, ant: 0.026, antUp: 0.3, leg: 0.016, legw: 0.0025, hind: true, eye: 0.45,
    wings: (b, s, C, D, fly) => { const o = s.hop && s.hop.H > 0.1 ? Math.sin(Math.PI * s.hop.u) : 0; for (const sd of [1, -1]) { b.push([0.006, sd * 0.004, 0.008], anRx(sd * (0.05 + 1.0 * o))); b.sheet([[0, 0, 0], [-0.045, sd * 0.006, 0.002], [-0.04, sd * (0.012 + 0.03 * o), 0.001]], o > 0.2 ? '#E4A04A' : C.s); b.pop(); } } },
  draw: anInsect, props: (b) => { anGrass(b, 0.06, -0.05, 0.5); anGrass(b, -0.12, 0.1, 0.45); anGrass(b, 0.14, 0.12, 0.4); }, sh: [0.055, 0.02] });
/* ----- a bat hangs upside down under a branch with its wings wrapped round; now and then, or when touched, it
   drops, flies round on its skin wings and comes back to hang ----- */
const AN_BRANCH = [[-0.3, 0.05, 0.56], [0.3, -0.02, 0.58]];
function anBat(b, s, C, D) {
  const hang = s.perched && (s.act === 'hang') && !s.rx, fl = Math.sin(s.t * 7 * 6.283 / 2.2);
  const wrap = hang ? 1 : 0;
  if (hang) b.push([0, 0, 0], anRy(Math.PI / 2)); else b.push([0, 0, 0], anRy(0.15));
  b.ell([0, 0, 0], [0.045, 0.026, 0.026], null, C.b, { n1: 8, n2: 9 });
  b.ell([0.05, 0, 0.004], [0.022, 0.02, 0.019], null, C.b, { n1: 6, n2: 8 });
  for (const sd of [1, -1]) { b.sheet([[0.045, sd * 0.008, 0.016], [0.05, sd * 0.02, 0.05], [0.038, sd * 0.02, 0.018]], C.b); b.eye([0.066, sd * 0.011, 0.008], 0.005, [0.6, sd, 0.2]); }
  b.ell([0.07, 0, 0.0], [0.008, 0.009, 0.007], null, C.w, { n1: 4, n2: 6 });
  for (const sd of [1, -1]) {
    /* the arm and three long fingers hold the skin of the wing; folded tight when it hangs */
    const a = wrap ? 0 : 0.2 + 0.95 * fl, span = wrap ? 0.25 : 1;
    b.push([0.015, sd * 0.02, 0.01], anRx(sd * a));
    const El = [-0.01, sd * 0.06 * span, 0.005], Wr = [0.03, sd * 0.11 * span, 0.0], T1 = [0.0, sd * 0.2 * span, 0], T2 = [-0.05, sd * 0.19 * span, 0], T3 = [-0.08, sd * 0.13 * span, 0], An = [-0.05, sd * 0.02, -0.005];
    b.sheet([[0, 0, 0], El, Wr, T1, T2, T3, An], C.w, { ec: 'rgba(30,26,30,0.9)' });
    b.line([[0, 0, 0], El, Wr], C.b, 0.006); for (const T of [T1, T2, T3]) b.line([Wr, T], C.b, 0.003);
    b.pop();
  }
  b.line([[-0.04, 0.01, 0], [-0.065, 0.012, hang ? 0 : -0.005]], C.b, 0.004); b.line([[-0.04, -0.01, 0], [-0.065, -0.012, hang ? 0 : -0.005]], C.b, 0.004);
  b.pop();
}
anDef('bat', { th: 'ค้างคาว', en: 'bat', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', hint: 'ห้อยหัวเกาะกิ่งไม้ ห่อปีกหลับ บางครั้งออกบินวน แตะแล้วปล่อยตัวบินหนี แล้วกลับมาห้อยหัว', kw: 'ค้างคาวกินแมลง ปีกพังผืด สัตว์เลี้ยงลูกด้วยน้ำนมที่บินได้', go: 'fly', spd: 0.28, fast: 0.6, stride: 0.2, turn: 3.5, acc: 2.5, roam: 0.26, zLo: 0.3, zHi: 0.5, z0: 0.5, R: 0.46, tz: 0.3, react: 'flyoff', near: 0.02,
  loop: [['hang', 9], ['fly', 4.5], ['hang', 7]], acts: { hang: 'ห้อยหัวเกาะกิ่งไม้ ห่อปีก', fly: 'บินวน', land: 'กลับมาห้อยหัว', flyoff: 'ปล่อยตัว บินหนี' }, C: { b: '#4A3E3A', w: '#5E504A' },
  perch: () => [0, 0.0185, 0.495], start: (s) => { s.x = 0; s.y = 0.0185; s.z = 0.495; s.perched = true; s.h = 0; },
  draw: anBat, props: (b) => { b.tube(AN_BRANCH, 0.012, '#7A5A3A', { sides: 6 }); b.tube([[0.1, 0.01, 0.575], [0.2, 0.08, 0.64]], (t) => 0.007 * (1 - 0.5 * t), '#7A5A3A', { sides: 5 }); }, sh: [0.07, 0.05] });

/* ----- task 9.10, second session: animals that exam questions (contests, entrance exams) like to compare, one or
   more from each group: sponge, cnidarians, flatworm, annelid, molluscs, echinoderm, arthropods that are not insects,
   cartilaginous and bony fish, a mammal of the sea, the egg-laying and the pouched mammals, a bird that cannot fly, a
   venomous snake. Each line under the box says the trait the questions ask about ----- */
/* a body that follows where the head went (as the earthworm), in the world: points from the head back */
function anTrailPts(b, s, L, n) { b.pop(); b.push([0, 0, 0]); const pts = []; for (let i = 0; i <= n; i++) pts.push(anAlong(s, L * i / n)); return pts; }
function anTrailStart(s, k) { s.trail = []; for (let i = 0; i < 160; i++) s.trail.push([-i * 0.008 * Math.cos(0.5), -i * 0.008 * Math.sin(0.5) + (k || 0) * Math.sin(i * 0.12) * 0.01, 0]); }
const anHexMix = (a, b, f) => { const p = parseInt(anHex(a).slice(1), 16), q = parseInt(anHex(b).slice(1), 16), m = (x, y) => ('0' + Math.round(x + (y - x) * f).toString(16)).slice(-2); return '#' + m(p >> 16, q >> 16) + m((p >> 8) & 255, (q >> 8) & 255) + m(p & 255, q & 255); };
/* water going in and out: small dots along their own paths (sponge, clam) */
function anFlow(b, pts, t, n, col) { for (let i = 0; i < n; i++) { const u = (t * 0.35 + i / n) % 1, k = u * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(k)); const p = anLerp(pts[j], pts[j + 1], k - j); b.gs.ball(b.w(p), 0.005, col || 'rgba(70,140,210,0.75)'); } }

/* sponge: a vase with pores; water comes in through the pores and goes out at the top. Touched, it slowly closes the top */
function anSponge(b, s, C, D) {
  const shut = s.rx ? s.rk : 0;
  for (const [x, y, hh, rr] of [[0, 0, 0.26, 0.05], [0.07, 0.05, 0.16, 0.032]]) {
    const pts = []; for (let i = 0; i <= 6; i++) pts.push([x + 0.005 * Math.sin(i), y, hh * i / 6]);
    b.tube(pts, (t) => rr * (0.85 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 0.95))) * (t > 0.85 ? 1 - shut * 0.5 * (t - 0.85) / 0.15 : 1), (t, a) => (Math.sin(t * 38) * Math.sin(a * 5) > 0.55 ? C.d : C.b), { sides: 11 });
    const ro = rr * (0.8 - 0.65 * shut), top = hh + 0.002, ring = []; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; ring.push([x + Math.cos(a) * ro, y + Math.sin(a) * ro, top]); }
    b.sheet(ring, '#4A3424', { edge: false });
    if (shut < 0.5) { for (let k = 0; k < 4; k++) { const a = k * 1.7 + x * 20; anFlow(b, [[x + Math.cos(a) * rr * 3, y + Math.sin(a) * rr * 3, hh * (0.3 + 0.15 * k)], [x + Math.cos(a) * rr * 1.2, y + Math.sin(a) * rr * 1.2, hh * (0.3 + 0.15 * k)], [x, y, hh * 0.5], [x, y, hh + 0.12]], s.t + k * 0.6, 2); } }
  }
}
/* hydra: a column on its foot with tentacles that wave and catch; a bud grows on the side. Touched, it shrinks into a ball */
function anHydra(b, s, C, D) {
  const Q = D.Q || {}, k = s.rx ? s.rk : 0, sw = Math.sin(s.t * 0.8) * (Q.sway == null ? 0.3 : Q.sway) * (1 - k), L = (Q.L || 0.2) * (1 - 0.72 * k), pts = [];
  for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push([Math.sin(sw * u) * L * u * 0.6, 0, L * u * Math.cos(sw * u * 0.6)]); }
  b.tube(pts, (t) => (Q.r || 0.014) * (1 + 1.3 * k) * (t < 0.1 ? 1.4 : 1), C.b, { sides: Q.r ? 12 : 8 });
  if (!Q.r) b.tube([pts[3], anAdd(pts[3], [0.035 * (1 - k), 0.01, 0.025 * (1 - k)])], (t) => 0.008 * (1 - 0.5 * t), C.b, { sides: 6 });
  const top = pts[6], catchK = s.act === 'catch' ? anBell(s.ap, 0.25) : 0;
  const nt = Q.n || 6, tr = Q.r ? Q.r * 0.8 : 0;
  for (let j = 0; j < nt; j++) {
    const a = j / nt * 6.283, ring = Q.r ? (j % 2 ? 0.6 : 1) : 0, q = [anAdd(top, [Math.cos(a) * tr * ring, Math.sin(a) * tr * ring, 0])]; let p = q[0], dir = [Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.8];
    for (let i = 1; i <= 6; i++) { const w = Math.sin(s.t * 1.6 + j + i * 0.6) * 0.25; dir = anUnit(anAdd(dir, [Math.cos(a) * (0.12 - catchK * 0.3) + w * 0.1, Math.sin(a) * (0.12 - catchK * 0.3), -0.18 - catchK * 0.1])); p = anAdd(p, anMul(dir, (Q.tl || 0.026) * (1 - 0.85 * k))); q.push(p); }
    b.tube(q, (t) => (Q.tw || 0.004) * (1 - 0.6 * t), C.t || C.b, { sides: 5 });
  }
}
/* jellyfish: the bell squeezes and opens, it rises a little each beat and sinks between; touched, it beats fast and swims off */
function anJelly(b, s, C, D) {
  const fast = s.rx ? 2 : 1, c = Math.pow(Math.max(0, Math.sin(s.t * 2.4 * fast)), 2);
  b.push([0, 0, 0.02 * c], anRy(-Math.PI / 2));
  b.ell([0, 0, 0], [0.065, 0.085 * (1 - 0.22 * c), 0.085 * (1 - 0.22 * c)], null, C.b, { n1: 10, n2: 14, def: (u) => [u[0] < 0 ? -u[0] * 0.06 : 0, 0, 0] });
  b.pop();
  for (let j = 0; j < 4; j++) { const a = j / 4 * 6.283 + 0.4, q = []; for (let i = 0; i <= 5; i++) { const u = i / 5; q.push([Math.cos(a) * 0.02 + Math.sin(s.t * 1.5 + j + u * 3) * 0.015 * u, Math.sin(a) * 0.02, -0.01 - 0.13 * u]); } b.tube(q, (t) => 0.008 * (1 - 0.7 * t), C.d, { sides: 5 }); }
  for (let j = 0; j < 12; j++) { const a = j / 12 * 6.283, r0 = 0.08 * (1 - 0.2 * c), q = []; for (let i = 0; i <= 4; i++) { const u = i / 4; q.push([Math.cos(a) * r0 + Math.sin(s.t * 2 + j + u * 4) * 0.012 * u, Math.sin(a) * r0, -0.005 - 0.18 * u]); } b.line(q, C.d, 0.0025); }
}
/* planarian: a flat worm that glides; a pointed head with two flaps and two eye spots that look cross-eyed */
function anPlanaria(b, s, C, D) {
  const pts = anTrailPts(b, s, D.L, 14);
  b.tube(pts.map((p) => [p[0], p[1], 0.006]), (t) => { const r = 0.016 * (t < 0.12 ? 0.6 + 3.3 * t : 1 - 0.75 * Math.max(0, t - 0.6) / 0.4); return [r, r * 0.28]; }, (t, a) => (Math.sin(a) < 0 ? C.b2 : C.b), { sides: 8 });
  const h = pts[0], f = anUnit(anSub(pts[0], pts[2])), sd = anUnit(anCross([0, 0, 1], f)), up = [0, 0, 0.009];
  b.sheet([anAdd(anAdd(h, anMul(f, 0.012)), up), anAdd(anAdd(h, anMul(sd, 0.02)), up), anAdd(anAdd(h, anMul(f, -0.008)), up), anAdd(anAdd(h, anMul(sd, -0.02)), up)], C.b);
  for (const k of [1, -1]) b.gs.ball(b.w(anAdd(anAdd(anAdd(h, anMul(f, -0.004)), anMul(sd, 0.006 * k)), [0, 0, 0.011])), 0.0035, '#F4EEE0'), b.gs.ball(b.w(anAdd(anAdd(anAdd(h, anMul(f, -0.004)), anMul(sd, 0.0065 * k)), [0, 0, 0.0115])), 0.0018, '#141414');
}
/* leech: loops along like an inchworm, the front sucker reaches out, then the back sucker comes up behind under an arch */
function anLeechTick(s, dt, act) {
  const D = AN.leech, W = s.fx; if (!W.A) { W.A = [s.x - Math.cos(s.h) * 0.06, s.y - Math.sin(s.h) * 0.06]; W.B = [s.x + Math.cos(s.h) * 0.06, s.y + Math.sin(s.h) * 0.06]; W.ph = 0; }
  if (act !== 'go') return false;
  if (!s.tg) s.tg = anTarget(D, s);
  /* near the edge of its pond it turns back towards the middle */
  const want = anFar(D, s) ? Math.atan2(-s.y, -s.x) : Math.atan2(s.tg[1] - s.y, s.tg[0] - s.x); W.ph += dt * 0.55;
  const u = W.ph % 1, f = [Math.cos(s.h), Math.sin(s.h)], Lc = 0.09, Le = 0.2;
  if (u < 0.5) { const e = anSm(u / 0.5); s.h = anAng(s.h + anCl(anAng(want - s.h), -1.2 * dt, 1.2 * dt)); W.B = [W.A[0] + f[0] * (Lc + (Le - Lc) * e), W.A[1] + f[1] * (Lc + (Le - Lc) * e)]; }
  else { const e = anSm((u - 0.5) / 0.5), d = Le - (Le - Lc) * e; W.A = [W.B[0] - f[0] * d, W.B[1] - f[1] * d]; }
  s.x = (W.A[0] + W.B[0]) / 2; s.y = (W.A[1] + W.B[1]) / 2; s.v = 0.05;
  if (Math.hypot(s.tg[0] - s.x, s.tg[1] - s.y) < 0.05 || s.aT > D.loop[s.si][1]) anNext(D, s);
  return true;
}
function anLeech(b, s, C, D) {
  b.pop(); b.push([0, 0, 0]);
  const W = s.fx; if (!W.A) anLeechTick(s, 0, 'rest');
  const A = [W.A[0], W.A[1], 0.012], B = [W.B[0], W.B[1], 0.012], d = Math.hypot(B[0] - A[0], B[1] - A[1]), L = 0.21, hh = Math.sqrt(Math.max(0, (L * L - d * d) * 3 / 16));
  const ball = s.rx ? s.rk : 0, mid = anLerp(A, B, 0.5), Cm = anAdd(mid, [0, 0, 2 * hh]), pts = [];
  for (let i = 0; i <= 14; i++) { const u = i / 14; let p = anAdd(anAdd(anMul(A, (1 - u) * (1 - u)), anMul(Cm, 2 * u * (1 - u))), anMul(B, u * u)); const a = u * 5.5; p = anLerp(p, anAdd(mid, [Math.cos(a) * 0.025, Math.sin(a) * 0.025, 0.03 + 0.008 * u]), ball); pts.push(p); }
  b.tube(pts, (t) => 0.011 * (1 + 0.6 * ball) * (t < 0.08 || t > 0.92 ? 1.25 : 1), (t, a) => (Math.sin(a * 2) > 0.6 && Math.sin(t * 50) > -0.2 ? C.s : C.b), { sides: 8 });
  b.ell(A, [0.013, 0.013, 0.006], null, C.b, { n1: 5, n2: 8 });
}
/* clam: two shells on a hinge, open to let water through the siphons, a foot that digs; touched, the shells close tight */
function anClam(b, s, C, D) {
  const shut = s.rx ? s.rk : 0, dig = s.act === 'dig' ? anBell(s.ap, 0.2) : 0, open = (0.16 + 0.05 * Math.sin(s.t * 0.8)) * (1 - shut) * (1 - 0.6 * dig);
  const rock = dig * Math.sin(s.t * 3) * 0.12;
  b.push([0, 0, 0.035], anRx(rock));
  const cs = (u) => (Math.sin((u[2] + u[0] * 0.3 + 1) * 11) > 0.55 ? C.d : C.b);
  for (const sd of [1, -1]) { b.push([0, 0, 0.032], anRx(sd * open)); b.ell([0, sd * 0.012, -0.032], [0.07, 0.016, 0.045], null, cs, { n1: 9, n2: 12, def: (u) => [0, sd * u[1] < 0 ? -u[1] * 0.012 : 0, 0] }); b.pop(); }
  if (open > 0.05) {
    b.tube([[-0.06, 0, 0.012], [-0.09, 0, 0.03 + 0.01 * Math.sin(s.t)], [-0.105, 0, 0.05]], 0.009 * (1 - shut), C.f, { sides: 6 });
    b.tube([[-0.055, 0, 0.0], [-0.09, 0, 0.0], [-0.11, 0, 0.01]], 0.008 * (1 - shut), C.f, { sides: 6 });
    anFlow(b, [[-0.16, 0, 0.0], [-0.11, 0, 0.01], [-0.06, 0, 0.0], [-0.06, 0, 0.012], [-0.105, 0, 0.05], [-0.15, 0, 0.11]], s.t, 6);
  }
  if (dig > 0.05) b.tube([[0.05, 0, -0.02], [0.08, 0, -0.03], [0.1 + 0.02 * Math.sin(s.t * 3), 0, -0.035 - 0.01 * dig]], (t) => 0.014 * (1 - 0.4 * t) * dig, C.f, { sides: 6 });
  b.pop();
}
/* octopus: a soft body behind the head, eight arms that crawl along the bottom; its skin changes colour to match the sand.
   Touched, it squirts ink and shoots away with its arms trailing */
function anOctopus(b, s, C, D) {
  const jet = s.rx && s.rx.k === 'ink' ? s.rk : 0, cam = 0.5 + 0.5 * Math.sin(s.t * 0.45), col = anHexMix(C.b, '#D9C49C', cam * 0.75 * (1 - jet));
  const z0 = 0.05 + 0.04 * jet;
  b.ell([-0.03 - 0.03 * jet, 0, z0 + 0.06 - 0.04 * jet], [0.075, 0.06, 0.065], anRy(0.5 - 0.9 * jet), (u) => (Math.sin(u[0] * 9 + u[1] * 7) > 0.75 ? anTint(col, -0.2) : col), { n1: 10, n2: 12 });
  b.ell([0.025, 0, z0], [0.04, 0.045, 0.035], null, col, { n1: 7, n2: 9 });
  for (const sd of [1, -1]) b.eye([0.035, sd * 0.035, z0 + 0.022], 0.011, [0.4, sd, 0.5], '#E8D27A');
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) / 8 * 6.283, q = [];
    for (let i = 0; i <= 7; i++) {
      const u = i / 7, w = Math.sin(s.t * 2.2 + k * 0.8 + u * 3) * 0.25 * (1 - jet);
      const crawl = [0.03 + Math.cos(a + w * u) * (0.03 + 0.17 * u), Math.sin(a + w * u) * (0.03 + 0.17 * u), Math.max(0.006, z0 * (1 - u * 1.4)) + (u > 0.85 ? 0.015 * (u - 0.85) / 0.15 : 0)];
      const trail = [0.04 + 0.24 * u, Math.cos(a) * 0.02 * (1 - u * 0.5), z0 + Math.sin(a) * 0.02 * (1 - u * 0.5)];
      q.push(anLerp(crawl, trail, jet));
    }
    b.tube(q, (t) => 0.012 * (1 - 0.8 * t), col, { sides: 6 });
  }
}
/* sea star: five arms round a disc, glides slowly on tube feet, the arm tips lift and feel; touched, it curls its arms up */
function anStar(b, s, C, D) {
  const cu = s.rx ? s.rk : 0;
  b.ell([0, 0, 0.014], [0.035, 0.035, 0.014], null, C.b, { n1: 7, n2: 10 });
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * 6.283 + s.t * 0.05, q = [];
    for (let i = 0; i <= 6; i++) { const u = i / 6, lift = (0.01 * Math.max(0, Math.sin(s.t * 0.9 + k * 1.3)) + 0.09 * cu) * u * u; q.push([Math.cos(a) * 0.12 * u * (1 - 0.35 * cu * u), Math.sin(a) * 0.12 * u * (1 - 0.35 * cu * u), 0.012 + lift]); }
    b.tube(q, (t) => { const r = 0.022 * (1 - 0.8 * t); return [r, r * 0.5]; }, (t, a2) => (Math.sin(t * 30 + a2 * 4) > 0.8 ? C.d : C.b), { sides: 7 });
  }
}
/* eight legs (spider, scorpion): four on each side, stepping in two sets that cross over */
function anLegs8(b, s, hips, reach, len, col, wd, k) {
  const mv = Math.min(1.5, s.mv);
  hips.forEach(([hx, hz, ang], i) => { for (const sd of [1, -1]) {
    const set = (i % 2 === 0) === (sd > 0) ? 0 : Math.PI, p = s.ph + set, H = [hx, sd * 0.012 * k, hz], a = ang * sd;
    let F = [hx + Math.cos(a) * reach + 0.25 * reach * Math.sin(p) * Math.min(1, mv), sd * Math.abs(Math.sin(a)) * reach, 0.25 * reach * Math.max(0, Math.cos(p)) * Math.min(1, mv)];
    if (s.raise && i === 0) F = [hx + reach * 0.6, sd * reach * 0.4, hz + reach * 0.9 * s.raise];
    const K = anIK(H, F, len, len * 1.15, [0, sd * 0.2, 1]); b.line([H, K, F], col, wd);
  } });
}
function anSpider(b, s, C, D) {
  const thr = s.rx && s.rx.k === 'threat' && s.rx.t < 1.2 ? s.rk : 0; s.raise = thr; const k = 1, z = 0.022;
  b.ell([0.015, 0, z], [0.022, 0.018, 0.011], null, C.b, { n1: 7, n2: 9 });
  b.ell([-0.035, 0, z + 0.008 + 0.01 * thr], [0.036, 0.028, 0.026], anRy(-0.2 - 0.3 * thr), (u) => (Math.abs(u[1]) < 0.25 && u[2] > 0.3 && Math.sin(u[0] * 12) > 0 ? C.s : C.b2), { n1: 9, n2: 10 });
  for (let i = 0; i < 4; i++) for (const sd of [1, -1]) b.gs.ball(b.w([0.034 - (i % 2) * 0.004, sd * (0.004 + 0.004 * Math.floor(i / 2)), z + 0.008]), 0.0025, '#101010');
  for (const sd of [1, -1]) { b.line([[0.03, sd * 0.006, z - 0.004], [0.045, sd * 0.012, z - 0.006 + 0.01 * thr], [0.05, sd * 0.01, z - 0.012]], C.b, 0.004); b.line([[0.035, sd * 0.003, z - 0.006], [0.038, sd * 0.003, z - 0.014]], '#1A1410', 0.003); }
  anLegs8(b, s, [[0.025, z, 0.9], [0.018, z, 1.25], [0.01, z, 1.85], [0.004, z, 2.3]], 0.06, 0.035, C.l || C.b, 0.0035, k);
}
function anScorpion(b, s, C, D) {
  const thr = s.rx && s.rx.k === 'threat' && s.rx.t < 1.2 ? s.rk : 0, strike = thr * Math.max(0, Math.sin(s.t * 7)), z = 0.022;
  b.ell([0.03, 0, z], [0.03, 0.024, 0.011], null, C.b, { n1: 7, n2: 9 });
  for (let i = 0; i < 5; i++) b.ell([0.0 - i * 0.022, 0, z], [0.014, 0.028 - i * 0.002, 0.01], null, C.b, { n1: 5, n2: 8 });
  /* the tail: five segments in an arc over the back, the sting at the end */
  const q = []; let p = [-0.1, 0, z], a = 0.4;
  for (let i = 0; i <= 6; i++) { q.push(p); a += 0.38 + 0.08 * thr + 0.25 * strike; p = anAdd(p, [-Math.cos(a) * 0.022, 0, Math.sin(a) * 0.022]); }
  b.tube(q, (t) => 0.011 * (1 - 0.3 * t), (t) => (Math.sin(t * 22) > 0.7 ? C.d : C.b), { sides: 7 });
  b.ell(p, [0.012, 0.009, 0.009], null, C.b, { n1: 5, n2: 7 }); b.tube([p, anAdd(p, [Math.cos(a) * 0.016, 0, -0.012])], (t) => 0.004 * (1 - t), '#2A1E14', { sides: 4 });
  for (const sd of [1, -1]) {
    const S0 = [0.05, sd * 0.018, z], E0 = [0.075, sd * 0.05, z + 0.01 + 0.02 * thr], Cw = [0.11, sd * 0.05, z + 0.01 + 0.03 * thr];
    b.tube([S0, E0, Cw], 0.006, C.b, { sides: 5 });
    b.push(Cw, anRz(sd * 0.25)); b.ell([0.015, 0, 0], [0.022, 0.012, 0.009], null, C.b, { n1: 6, n2: 8 }); const op = 0.25 + 0.4 * thr; b.line([[0.03, 0, 0.002], [0.05, sd * 0.004, 0.004 + 0.01 * op]], C.d, 0.004); b.line([[0.03, 0, -0.002], [0.05, sd * 0.002, -0.004]], C.d, 0.004); b.pop();
  }
  for (let i = 0; i < 2; i++) b.eye([0.055, (i ? 1 : -1) * 0.005, z + 0.01], 0.003, [0.2, i ? 1 : -1, 1]);
  anLegs8(b, s, [[0.03, z, 1.4], [0.015, z, 1.7], [0.0, z, 2.0], [-0.015, z, 2.3]], 0.055, 0.03, C.b, 0.0035, 1);
}
/* centipede and millipede: many segments following the head; one pair of long legs on each segment, or two pairs of
   short ones. Touched, the centipede darts off; the millipede rolls itself up in a coil */
function anMany(b, s, C, D) {
  const n = D.seg, pts = anTrailPts(b, s, D.L, n), coil = D.coil && s.rx ? s.rk : 0, mv = Math.min(1.5, s.mv);
  if (coil > 0) { const c = anAlong(s, D.L * 0.4); for (let i = 0; i <= n; i++) { const u = i / n, a = u * 4.4 * Math.PI, r = 0.012 + 0.035 * u; pts[i] = anLerp(pts[i], [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, D.r + 0.004 * u], coil); } }
  b.tube(pts.map((p) => [p[0], p[1], p[2] + D.r]), (t) => { const r = D.r * (t < 0.05 ? 0.7 : t > 0.9 ? 1 - (t - 0.9) * 5 : 1); return D.flat ? [r * 1.25, r * 0.55] : [r, r]; }, (t) => (Math.sin(t * n * Math.PI * 2) > 0.3 ? C.d : C.b), { sides: 8 });
  const h = pts[0], f = anUnit(anSub(pts[0], pts[1]));
  if (coil < 0.5) {
    const sd0 = anUnit(anCross([0, 0, 1], f));
    for (const k of [1, -1]) b.line([anAdd(h, [0, 0, D.r]), anAdd(anAdd(h, anMul(f, D.ant * 0.5)), anAdd(anMul(sd0, k * D.ant * 0.3), [0, 0, D.r * 2])), anAdd(anAdd(h, anMul(f, D.ant)), anMul(sd0, k * D.ant * 0.55))], C.l, 0.0025);
    if (D.head) b.ell(anAdd(h, [0, 0, D.r]), [D.r * 1.05, D.r * 1.05, D.r * 1.05], null, D.head, { n1: 6, n2: 8 });
    for (let i = 1; i < n; i++) {
      if (D.legsOn && !D.legsOn(i, n)) continue;
      const p = pts[i], t = anUnit(anSub(pts[i - 1], pts[i + 1])), sd = anUnit(anCross([0, 0, 1], t));
      for (let pr = 0; pr < (D.pairs || 1); pr++) for (const k of [1, -1]) {
        const ph = s.ph * (D.pairs ? 1.4 : 1) - i * 0.7 - pr * 0.35 + (k > 0 ? 0 : Math.PI), sw = Math.sin(ph) * 0.4 * Math.min(1, mv), lift = Math.max(0, Math.cos(ph)) * D.r * 0.8 * Math.min(1, mv);
        const base = anAdd(anAdd(p, anMul(t, pr * D.r * 0.6)), [0, 0, D.r]), dir = anUnit(anAdd(anMul(sd, k), anMul(t, sw)));
        b.line([base, anAdd(anAdd(base, anMul(dir, D.leg * 0.6)), [0, 0, D.r * 0.5 + lift]), anAdd(anAdd(base, anMul(dir, D.leg)), [0, 0, -D.r + lift * 0.3])], C.l, D.legw);
      }
    }
  }
}
/* fish-shaped swimmers with their own build: a shark (tail fin upright, the top lobe longer, gill slits) and a dolphin
   (a mammal: the tail flukes lie flat and beat up and down, it comes up to breathe through the blowhole) */
function anSwim2(b, s, C, D) {
  const Q = D.Q, n = 12, sw = 0.6 + 1.2 * Math.min(1.5, s.mv) + (s.rx ? 1.5 * s.rk : 0), pts = [];
  s.fx.w = (s.fx.w || 0) + 0.016 * sw * 5;
  for (let i = 0; i <= n; i++) { const u = i / n, amp = Q.A * (0.1 + u * u), wv = amp * Math.sin(u * 4.5 - s.fx.w); pts.push([Q.L * 0.42 - Q.L * u, Q.vert ? 0 : wv, Q.vert ? wv : 0]); }
  b.tube(pts, (t) => { const r = Q.H * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.05)), 0.7) * (1 - 0.6 * Math.max(0, t - 0.7) / 0.3); return [r * Q.wr, r]; }, (t, a) => (Math.sin(a) < -0.25 ? C.b2 : C.b), { sides: 10 });
  const T = pts[n], m = pts[Math.round(n * 0.4)], hd = pts[1];
  if (Q.vert) b.sheet([[T[0] + 0.03, T[1], T[2]], [T[0] - 0.05, 0.11 * Q.k, T[2] + 0.01], [T[0] - 0.02, 0, T[2]], [T[0] - 0.05, -0.11 * Q.k, T[2] + 0.01]], C.b);
  else b.sheet([[T[0] + 0.03, T[1], 0], [T[0] - 0.13 * Q.k, T[1], 0.15 * Q.k], [T[0] - 0.04 * Q.k, T[1], 0.01], [T[0] - 0.07 * Q.k, T[1], -0.08 * Q.k]], C.b);
  b.sheet([[m[0] + 0.06 * Q.k, m[1], m[2] + Q.H * 0.85], [m[0] - 0.04 * Q.k, m[1], m[2] + Q.H * 0.85 + Q.fin], [m[0] - 0.07 * Q.k, m[1], m[2] + Q.H * 0.8]], C.b);
  for (const sd of [1, -1]) {
    const p = pts[3], fl = 0.15 * Math.sin(s.t * 2 + sd);
    b.sheet([[p[0] + 0.03 * Q.k, p[1] + sd * Q.H * Q.wr * 0.8, p[2] - Q.H * 0.5], [p[0] - 0.06 * Q.k, p[1] + sd * (Q.H * Q.wr + Q.pec), p[2] - Q.H * 0.8 + fl * 0.03], [p[0] - 0.03 * Q.k, p[1] + sd * Q.H * Q.wr * 0.8, p[2] - Q.H * 0.5]], C.b);
    if (Q.topEyes) { const e = [hd[0] - 0.01 * Q.k, hd[1] + sd * Q.H * Q.wr * 0.35, hd[2] + Q.H * 0.95]; b.ell(e, [0.012 * Q.k, 0.011 * Q.k, 0.011 * Q.k], null, C.b, { n1: 5, n2: 7 }); b.eye(anAdd(e, [0.004 * Q.k, sd * 0.003 * Q.k, 0.007 * Q.k]), 0.008 * Q.k, [0.3, sd * 0.5, 1]); }
    else b.eye([hd[0] - 0.01 * Q.k, hd[1] + sd * Q.H * Q.wr * 0.75, hd[2] + Q.H * 0.12], 0.008 * Q.k, [0.3, sd, 0.1]);
    if (Q.barbels) for (let m = 0; m < 4; m++) { const o = anAdd(pts[0], [0.0, sd * Q.H * (0.15 + 0.12 * m), -Q.H * (m < 2 ? 0.1 : 0.5)]), sw = Math.sin(s.t * 2 + m) * 0.01; b.line([o, anAdd(o, [-0.02 * Q.k, sd * 0.03 * Q.k, -0.01 + sw]), anAdd(o, [-0.04 * Q.k * (m ? 1 : 1.6), sd * 0.05 * Q.k, -0.02 + sw])], C.d, 0.0035 * Q.k); }
    if (Q.gills) for (let g = 0; g < 5; g++) { const x = hd[0] - 0.035 * Q.k - g * 0.012 * Q.k; b.line([[x, hd[1] + sd * Q.H * Q.wr * 0.95, hd[2] + Q.H * 0.25], [x - 0.004, hd[1] + sd * Q.H * Q.wr * 0.95, hd[2] - Q.H * 0.25]], 'rgba(40,50,60,0.8)', 0.003 * Q.k); }
  }
  if (Q.beak) b.tube([anAdd(pts[0], [-0.01, 0, -Q.H * 0.15]), anAdd(pts[0], [0.06 * Q.k, 0, -Q.H * 0.25])], (t) => Q.H * 0.28 * (1 - 0.4 * t), C.b, { sides: 7 });
  if (Q.vert) { const bh = anAdd(pts[2], [0, 0, Q.H * 0.95]); b.ball(bh, 0.006, '#2A3038'); if (s.act === 'breathe' && s.z > 0.4) for (let i = 0; i < 8; i++) { const u = (s.t * 1.2 + i / 8) % 1; b.gs.ball(b.w(anAdd(bh, [Math.sin(i * 2.4) * 0.03 * u, Math.cos(i * 2.4) * 0.03 * u, 0.02 + 0.16 * u])), 0.006 * (1 - u * 0.5), 'rgba(170,205,235,' + (0.8 * (1 - u)).toFixed(2) + ')'); } }
}
/* seahorse: swims upright with its back fin fluttering, holds on to sea grass with its curled tail */
function anSeahorse(b, s, C, D) {
  const hold = s.act === 'hold' ? anBell(s.ap, 0.2) : 0, fl = Math.sin(s.t * 14), bob = 0.006 * Math.sin(s.t * 1.5);
  b.push([0, 0, bob]);
  const trunk = [[0.0, 0, -0.06], [0.014, 0, -0.02], [0.016, 0, 0.02], [0.008, 0, 0.055], [-0.004, 0, 0.08]];
  b.tube(trunk, (t) => 0.016 * (0.6 + 0.7 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.25))), (t) => (Math.sin(t * 40) > 0.5 ? C.d : C.b), { sides: 8 });
  const tl = []; for (let i = 0; i <= 10; i++) { const u = i / 10, a = (1.2 + 3.2 * (0.6 + 0.4 * hold)) * u * u, r = 0.06 * (1 - 0.5 * u); tl.push([-0.01 + Math.sin(a) * r * 0.6 - 0.005 * u, 0, -0.06 - r * (1 - Math.cos(a)) * 0.6 - 0.035 * u]); }
  b.tube(tl, (t) => 0.009 * (1 - 0.8 * t), (t) => (Math.sin(t * 50) > 0.5 ? C.d : C.b), { sides: 6 });
  b.push([0.0, 0, 0.095], anRy(0.15)); b.ell([0, 0, 0], [0.022, 0.012, 0.016], null, C.b, { n1: 7, n2: 8 });
  b.tube([[0.015, 0, -0.003], [0.05, 0, -0.008]], (t) => 0.0055 * (1 - 0.3 * t), C.b, { sides: 6 });
  b.ell([-0.008, 0, 0.016], [0.006, 0.006, 0.01], null, C.d, { n1: 4, n2: 6 });
  for (const sd of [1, -1]) b.eye([0.006, sd * 0.011, 0.004], 0.004, [0.3, sd, 0.2]);
  b.pop();
  b.sheet([[-0.012, 0, 0.03], [-0.03, 0.006 * fl, 0.035], [-0.03, 0.006 * fl, 0.0], [-0.014, 0, -0.005]], C.f);
  b.pop();
}
const anSeaGrass = (b) => { for (const [x, y] of [[0.06, -0.06], [0.08, -0.04], [-0.1, 0.08]]) for (let i = 0; i < 3; i++) { const q = []; for (let k = 0; k <= 5; k++) { const u = k / 5; q.push([x + Math.sin(u * 2 + i) * 0.012 * u, y + i * 0.006, 0.26 * u * (0.8 + 0.15 * i)]); } b.tube(q, (t) => 0.004 * (1 - 0.5 * t), '#4E8A4A', { sides: 4, cap: false }); } };
/* platypus: a flat furry body on short legs out to the sides, a duck-like bill, a flat tail, webbed feet */
function anPlatypus(b, s, C, D) {
  const mv = Math.min(1.4, s.mv), z = 0.045, nod = s.act === 'dig' ? Math.max(0, Math.sin(s.aT * 5)) * 0.35 : 0, roll = Math.sin(s.ph) * 0.06 * mv;
  b.push([0, 0, z], anRx(roll));
  b.ell([0, 0, 0], [0.095, 0.05, 0.032], null, (u) => (u[2] < -0.3 ? C.b2 : C.b), { n1: 10, n2: 12 });
  b.ell([-0.13, 0, -0.008], [0.055, 0.038, 0.009], null, C.b, { n1: 7, n2: 9 });
  b.push([0.09, 0, 0.005], anRy(0.15 + nod)); b.ell([0.01, 0, 0], [0.028, 0.028, 0.022], null, C.b, { n1: 7, n2: 8 });
  b.ell([0.06, 0, -0.006], [0.04, 0.026, 0.006], null, C.m, { n1: 7, n2: 9 });
  for (const sd of [1, -1]) b.eye([0.025, sd * 0.02, 0.01], 0.0045, [0.4, sd, 0.3]);
  b.pop(); b.pop();
  for (const [x0, front] of [[0.055, 1], [-0.05, 0]]) for (const sd of [1, -1]) {
    const p = s.ph + (front ? 0 : Math.PI) + (sd > 0 ? 0 : Math.PI), H = [x0, sd * 0.04, z - 0.01];
    const F = [x0 + 0.03 * Math.sin(p) * Math.min(1, mv), sd * 0.085, 0.012 * Math.max(0, Math.cos(p)) * Math.min(1, mv)];
    const K = anIK(H, F, 0.03, 0.03, [0, sd * 0.3, 1]); b.tube([H, K, F], 0.011, C.b, { sides: 5 });
    b.sheet([F, anAdd(F, [0.03, sd * 0.012, 0]), anAdd(F, [0.025, -sd * 0.012, 0])], C.m);
  }
}
/* kangaroo: sits up on its long feet and tail, bends down to graze, hops on its big hind legs; touched, a long leap */
function anRoo(b, s, C, D) {
  const u = s.hop ? s.hop.u : 0, ext = s.hop ? anCl(Math.sin(Math.PI * Math.min(1, u * 1.4)) * 1.3, 0, 1) : 0;
  const graze = s.act === 'graze' ? anBell(s.ap, 0.2) : 0, look = s.act === 'look' ? anBell(s.ap, 0.2) : 0;
  const pitch = -1.0 + 0.65 * ext + 0.75 * graze - 0.2 * look, zh = 0.1 + 0.05 * ext - 0.02 * graze + 0.02 * look;
  const Hp = [0, 0, zh], BM = anRy(pitch), bodyP = (p) => anAdd(Hp, anMv(BM, p));
  b.ell(bodyP([0.07, 0, 0]), [0.1, 0.06, 0.065], BM, (q) => (q[2] < -0.3 && q[0] > -0.2 ? C.b2 : C.b), { n1: 10, n2: 12 });
  b.ell(bodyP([-0.01, 0, -0.005]), [0.065, 0.07, 0.065], BM, C.b, { n1: 8, n2: 10 });
  const N = bodyP([0.17, 0, 0.01]), hp = pitch * 0.2 + 0.2 + 0.9 * graze, HM = anMs(anRz(look * Math.sin(s.aT * 2) * 0.6), anRy(hp));
  b.tube([bodyP([0.13, 0, 0.0]), N], 0.03, C.b, { sides: 7 });
  b.push(anAdd(N, [0.01, 0, 0.025]), HM);
  b.ell([0.02, 0, 0], [0.045, 0.03, 0.03], null, C.b, { n1: 7, n2: 9 }); b.ell([0.06, 0, -0.01], [0.022, 0.018, 0.017], null, C.b, { n1: 6, n2: 7 }); b.ball([0.08, 0, -0.006], 0.006, '#2A2420');
  for (const sd of [1, -1]) { b.eye([0.035, sd * 0.024, 0.012], 0.006, [0.4, sd, 0.3]); b.sheet([[0.0, sd * 0.014, 0.025], [-0.015, sd * 0.03, 0.08], [-0.03, sd * 0.016, 0.026]], C.b); }
  b.pop();
  for (const sd of [1, -1]) {
    const Sh = bodyP([0.13, sd * 0.03, -0.035]), Hd = graze > 0.5 ? [Sh[0] + 0.04, sd * 0.03, 0] : anAdd(Sh, [0.03, sd * 0.01, -0.05]);
    b.tube([Sh, anLerp(Sh, Hd, 0.5), Hd], 0.008, C.b, { sides: 5 });
    /* the big hind leg: thigh, shin, the long foot flat on the ground or thrown out behind */
    const Th = bodyP([-0.01, sd * 0.05, -0.02]), fold = [[0.06, sd * 0.055, 0.06], [-0.03, sd * 0.05, 0.012], [0.11, sd * 0.05, 0.002]], out = [[-0.04, sd * 0.05, zh - 0.08], [-0.14, sd * 0.05, zh - 0.15], [-0.22, sd * 0.05, zh - 0.17]];
    const [Kn, An, Te] = fold.map((q, i) => { const p = anLerp(q, out[i], ext); return [p[0], p[1], ext > 0 ? p[2] : p[2] - s.z]; });
    b.tube([Th, Kn], (t) => 0.03 * (1 - 0.45 * t), C.b, { sides: 7 }); b.tube([Kn, An], 0.012, C.b, { sides: 6 }); b.tube([An, Te], (t) => 0.011 * (1 - 0.4 * t), C.d, { sides: 6 });
  }
  const T0 = bodyP([-0.07, 0, -0.01]), tl = []; for (let i = 0; i <= 5; i++) { const v = i / 5; tl.push(anLerp([T0[0] - 0.22 * v, 0, T0[2] * (1 - v) + 0.008 * v - s.z * v], [T0[0] - 0.24 * v, 0, T0[2] + 0.02 * v], ext)); }
  b.tube(tl, (t) => 0.026 * (1 - 0.75 * t), C.b, { sides: 7 });
}
/* penguin: stands upright, black back and white front, waddles on short legs with flippers out; touched, it drops on its
   belly and slides away pushing with its flippers */
function anPenguin(b, s, C, D) {
  const lie = s.rx && s.rx.k === 'flee' ? s.rk : 0, mv = Math.min(1.4, s.mv) * (1 - lie), roll = Math.sin(s.ph) * 0.16 * mv;
  const preen = s.act === 'preen' ? Math.max(0, Math.sin(s.aT * 4)) * anBell(s.ap, 0.15) : 0;
  b.push([0, 0, 0.012 + 0.03 * lie], anMs(anRy(lie * 1.42), anRx(roll)));
  const bc = (u) => (u[2] > 0.05 || u[0] > 0.72 ? C.b : C.b2);
  b.ell([0, 0, 0.12], [0.12, 0.065, 0.07], anRy(-Math.PI / 2), bc, { n1: 11, n2: 12 });
  b.push([0.01, 0, 0.245], anMs(anRz(preen * 0.9), anRy(0.15 + preen * 0.9)));
  b.ell([0, 0, 0], [0.045, 0.04, 0.045], null, C.b, { n1: 8, n2: 9 });
  b.tube([[0.035, 0, -0.005], [0.075, 0, -0.012]], (t) => 0.01 * (1 - 0.8 * t), C.f, { sides: 6 });
  for (const sd of [1, -1]) { b.ball([0.022, sd * 0.03, 0.01], 0.008, '#F4F2EC'); b.eye([0.026, sd * 0.034, 0.011], 0.0045, [0.4, sd, 0.2]); }
  b.pop();
  const fa = lie ? 0.9 + 0.5 * Math.sin(s.t * 9) : 0.25 + 0.15 * Math.abs(Math.sin(s.ph)) * mv;
  for (const sd of [1, -1]) { b.push([0.0, sd * 0.06, 0.18], anRx(sd * fa)); b.sheet([[0.015, 0, 0], [0.01, sd * 0.012, -0.11], [-0.025, sd * 0.008, -0.1], [-0.02, 0, 0]], C.b); b.pop(); }
  for (const sd of [1, -1]) { const p = s.ph + (sd > 0 ? 0 : Math.PI); b.ell([0.025 + 0.015 * Math.sin(p) * mv, sd * 0.03, -0.002 + 0.008 * Math.max(0, Math.cos(p)) * mv], [0.03, 0.017, 0.006], null, C.f, { n1: 5, n2: 7 }); }
  b.pop();
}
/* cobra: slithers in waves, flicks its forked tongue; touched, it lifts the front of its body, spreads its hood, then slides away */
function anCobra(b, s, C, D) {
  const n = 26, pts = anTrailPts(b, s, D.L, n), up = s.rx && s.rx.k === 'threat' ? s.rk : 0, iR = Math.round(n * 0.28);
  if (up > 0) {
    const base = pts[iR], f0 = anSub(pts[0], base), f = anUnit([f0[0], f0[1], 0]), Lr = D.L * 0.28;
    for (let i = 0; i < iR; i++) { const d = Lr * (iR - i) / iR, top = anAdd(base, anAdd([0, 0, d * 0.85], anMul(f, d * 0.25 + (i < 3 ? 0.03 * (3 - i) / 3 : 0)))); pts[i] = anLerp(pts[i], top, up); }
  }
  b.tube(pts.map((p) => [p[0], p[1], p[2] + D.r * 0.9]), (t) => { const r = D.r * (t < 0.06 ? 0.75 + 4 * t : t > 0.7 ? 1 - (t - 0.7) / 0.3 * 0.9 : 1); return [r, r * 0.85]; }, (t, a) => (Math.sin(a) < -0.4 ? C.b2 : Math.sin(t * 60) > 0.75 ? C.s : C.b), { sides: 8 });
  const h = anAdd(pts[0], [0, 0, D.r * 0.9]), f = anUnit(anSub(pts[0], pts[2])), sd = anUnit(anCross([0, 0, 1], [f[0], f[1], 0.0001])), uz = anCross(f, sd);
  const M = [f[0], sd[0], uz[0], f[1], sd[1], uz[1], f[2], sd[2], uz[2]];
  b.ell(anAdd(h, anMul(f, 0.012)), [0.024, 0.017, 0.012], M, C.b, { n1: 7, n2: 9 });
  for (const k of [1, -1]) b.eye(anAdd(anAdd(h, anMul(f, 0.02)), anAdd(anMul(sd, k * 0.013), anMul(uz, 0.006))), 0.004, anAdd(anMul(sd, k), f));
  if (Math.sin(s.t * 3.3) > 0.55) { const t0 = anAdd(h, anMul(f, 0.035)), t1 = anAdd(t0, anMul(f, 0.025)); b.line([t0, t1, anAdd(t1, anAdd(anMul(f, 0.01), anMul(sd, 0.006)))], '#C83A4A', 0.0025); b.line([t1, anAdd(t1, anAdd(anMul(f, 0.01), anMul(sd, -0.006)))], '#C83A4A', 0.0025); }
  if (up > 0.15) {
    /* the hood: ribs spread out from the neck, a flat oval facing forwards */
    const p = pts[3], t = anUnit(anSub(pts[1], pts[5])), fh = [Math.cos(s.h), Math.sin(s.h), 0], w = anUnit(anCross(t, fh)), n2 = anCross(t, w);
    const MH = [t[0], w[0], n2[0], t[1], w[1], n2[1], t[2], w[2], n2[2]];
    b.ell(anAdd(p, anMul(n2, -0.006)), [0.07, 0.062 * up, 0.008], MH, (u) => (Math.abs(u[1]) < 0.2 && u[0] > 0 ? C.b2 : C.b), { n1: 8, n2: 10 });
  }
}
const anInsectWingsFlat = (col) => (b, s, C, D) => { for (const sd of [1, -1]) b.sheet([[0.005, sd * 0.001, 0.012], [-0.06, sd * 0.002, 0.012], [-0.06, sd * 0.03, 0.009], [0.0, sd * 0.02, 0.009]], col); };

anDef('sponge', { th: 'ฟองน้ำ', en: 'sponge', grp: 'ฟองน้ำ (พอริเฟอรา)', fact: 'ไม่มีเนื้อเยื่อแท้ น้ำไหลเข้าทางรูพรุนรอบตัว แล้วออกทางช่องเปิดด้านบน', hint: 'เกาะอยู่กับที่ สูบน้ำเข้าทางรูพรุนแล้วออกทางช่องบน แตะแล้วค่อย ๆ ปิดช่องน้ำออก', kw: 'พอริเฟอรา สัตว์ไม่มีกระดูกสันหลัง ข้อสอบ', go: 'walk', spd: 0.001, fast: 0.001, roam: 0.01, R: 0.24, tz: 0.12, react: 'hide',
  loop: [['pump', 10]], acts: { pump: 'สูบน้ำผ่านรูพรุน', hide: 'ค่อย ๆ ปิดช่องน้ำออก' }, C: { b: '#D8A84A', d: '#8A6420' }, draw: anSponge, ground: anSand, sh: [0.07, 0.06] });
anDef('hydra', { th: 'ไฮดรา', en: 'hydra', grp: 'ไนดาเรีย', fact: 'หนวดมีเซลล์เข็มพิษ สืบพันธุ์แบบแตกหน่อได้ (มีหน่อเล็กข้างลำตัว)', hint: 'เกาะพื้นน้ำ แกว่งหนวดจับอาหาร มีหน่องอกข้างตัว แตะแล้วหดตัวเป็นก้อนกลม', kw: 'ไนดาเรีย ซีเลนเทอเรต แตกหน่อ เข็มพิษ', go: 'walk', spd: 0.001, fast: 0.001, roam: 0.01, R: 0.2, tz: 0.1, react: 'hide',
  loop: [['sway', 6], ['catch', 3]], acts: { sway: 'แกว่งหนวดรออาหาร', catch: 'ใช้หนวดจับอาหารเข้าปาก', hide: 'หดตัวเป็นก้อนกลม' }, C: { b: '#9DB86A' }, draw: anHydra, ground: anPond, sh: [0.03, 0.03] });
anDef('jellyfish', { th: 'แมงกะพรุน', en: 'jellyfish', grp: 'ไนดาเรีย', fact: 'สมมาตรแบบรัศมี ไม่มีสมอง หนวดมีเซลล์เข็มพิษ', hint: 'หุบและกางร่มเพื่อว่ายขึ้น แล้วลอยลงช้า ๆ หนวดยาวห้อย แตะแล้วหุบร่มถี่ ๆ ว่ายหนี', kw: 'ไนดาเรีย เข็มพิษ ทะเล', go: 'swim', spd: 0.05, fast: 0.25, turn: 1, roam: 0.16, zLo: 0.18, zHi: 0.3, z0: 0.22, R: 0.32, tz: 0.14, react: 'dart', fleeLen: 0.3,
  loop: [['go', 6], ['hover', 3]], acts: { go: 'หุบกางร่มว่ายน้ำ', hover: 'ลอยตัวช้า ๆ', dart: 'หุบร่มถี่ ๆ ว่ายหนี' }, C: { b: '#E6C2DC', d: '#C892B8' }, draw: anJelly, ground: anPond, sh: [0.08, 0.08] });
anDef('planaria', { th: 'พลานาเรีย', en: 'planarian', grp: 'หนอนตัวแบน', fact: 'ตาเป็นจุดรับแสง ตัดเป็นท่อนแล้วงอกเป็นตัวใหม่ได้', hint: 'หนอนตัวแบนในน้ำจืด เลื่อนไหลไปตามพื้น หัวสามเหลี่ยมตาสองจุด แตะแล้วหดตัวเลี้ยวหนี', kw: 'หนอนตัวแบน แพลทีเฮลมินทีส งอกใหม่', go: 'walk', L: 0.13, spd: 0.035, fast: 0.08, stride: 0.05, turn: 1.4, roam: 0.08, R: 0.13, tz: 0.0, react: 'flee', fleeLen: 0.2,
  loop: [['go', 6], ['rest', 2]], acts: { go: 'เลื่อนไหลไปตามพื้น', rest: 'หยุดนิ่ง', flee: 'หดตัวแล้วเลี้ยวหนี' }, C: { b: '#6A5646', b2: '#9A8470' }, start: (s) => anTrailStart(s), draw: anPlanaria, ground: anPond });
anDef('leech', { th: 'ปลิง', en: 'leech', grp: 'หนอนปล้อง (แอนเนลิด)', fact: 'มีปุ่มดูดที่หัวและท้าย เคลื่อนที่แบบคืบ หลั่งสารกันเลือดแข็ง', hint: 'ปลิงน้ำจืด คืบไปด้วยปุ่มดูดหัวท้ายเป็นซุ้มโค้ง แตะแล้วหดตัวเป็นก้อน', kw: 'ปลิงควาย หนอนปล้อง ปุ่มดูด', go: 'walk', spd: 0.05, fast: 0.05, roam: 0.12, R: 0.22, tz: 0.03, react: 'hide',
  loop: [['go', 10], ['rest', 2.5]], acts: { go: 'คืบไปด้วยปุ่มดูด', rest: 'หยุดนิ่ง', hide: 'หดตัวเป็นก้อน' }, C: { b: '#4E4434', s: '#B08A50' }, tick: anLeechTick, draw: anLeech, ground: anPond });
anDef('clam', { th: 'หอยสองฝา', en: 'clam', grp: 'หอยและหมึก (มอลลัสก์)', fact: 'หายใจและกรองอาหารด้วยเหงือก น้ำเข้าออกทางท่อน้ำ ใช้เท้าขุดทราย', hint: 'หอยลาย เปิดเปลือกกรองอาหารจากน้ำ ยื่นเท้าขุดทราย แตะแล้วหุบเปลือกแน่น', kw: 'หอยลาย หอยแครง หอยกาบ มอลลัสก์ กรองอาหาร', go: 'walk', spd: 0.001, fast: 0.001, roam: 0.01, R: 0.18, tz: 0.03, react: 'hide',
  loop: [['filter', 7], ['dig', 3.5]], acts: { filter: 'เปิดเปลือก กรองอาหารจากน้ำ', dig: 'ยื่นเท้าขุดทราย', hide: 'หุบเปลือกแน่น' }, C: { b: '#C8B48E', d: '#8A6E4A', f: '#E8C8B0' }, draw: anClam, ground: anSand, sh: [0.08, 0.05] });
anDef('octopus', { th: 'หมึกยักษ์', en: 'octopus', grp: 'หอยและหมึก (มอลลัสก์)', fact: 'มีแปดแขน เปลี่ยนสีผิวพรางตัวได้ หัวใจสามดวง', hint: 'หมึกสาย คลานด้วยแปดแขน เปลี่ยนสีกลืนกับพื้น แตะแล้วพ่นหมึกพุ่งหนี', kw: 'หมึกสาย มอลลัสก์ พรางตัว เปลี่ยนสี', go: 'walk', mantle: true, spd: 0.06, fast: 0.5, stride: 0.2, turn: 1.5, roam: 0.15, R: 0.34, tz: 0.06, react: 'ink', fleeLen: 0.35,
  loop: [['go', 5], ['rest', 4], ['go', 4]], acts: { go: 'คลานด้วยแขน เปลี่ยนสีกลืนกับพื้น', rest: 'หยุดนิ่ง พรางตัว', ink: 'พ่นหมึก พุ่งหนี' }, C: { b: '#B4583E' }, draw: anOctopus, ground: anSand, sh: [0.16, 0.16] });
anDef('starfish', { th: 'ดาวทะเล', en: 'sea star', grp: 'เอไคโนเดิร์ม', fact: 'สมมาตรแบบรัศมีห้าแฉก เคลื่อนที่ด้วยระบบท่อน้ำและทิวบ์ฟีต แขนขาดงอกใหม่ได้', hint: 'เคลื่อนที่ช้า ๆ บนพื้นทราย ปลายแขนยกคลำทาง แตะแล้วงอแขนขึ้น', kw: 'ปลาดาว เอไคโนเดิร์ม ทิวบ์ฟีต', go: 'walk', side: true, spd: 0.015, fast: 0.015, stride: 0.1, turn: 0.5, roam: 0.08, R: 0.22, tz: 0.02, react: 'hide',
  loop: [['go', 10], ['rest', 4]], acts: { go: 'เคลื่อนที่ช้า ๆ ด้วยทิวบ์ฟีต', rest: 'หยุดนิ่ง', hide: 'งอแขนขึ้น' }, C: { b: '#E07A3A', d: '#B04A20' }, draw: anStar, ground: anSand, sh: [0.12, 0.12] });
anDef('spider', { th: 'แมงมุม', en: 'spider', grp: 'สัตว์ขาปล้อง (แมง)', fact: 'ไม่ใช่แมลง มีแปดขา ลำตัวสองส่วน ไม่มีหนวด', hint: 'เดินด้วยแปดขา หยุดนิ่งรอเหยื่อ แตะแล้วยกขาคู่หน้าขู่ แล้ววิ่งหนี', kw: 'แมง อะแรคนิด ไม่ใช่แมลง ใยแมงมุม', go: 'walk', spd: 0.08, fast: 0.3, stride: 0.05, turn: 3, acc: 3, roam: 0.12, R: 0.2, tz: 0.03, react: 'threat', fleeLen: 0.25,
  loop: [['go', 2.5], ['rest', 2.5], ['go', 2]], acts: { go: 'เดินด้วยแปดขา', rest: 'หยุดนิ่งรอเหยื่อ', threat: 'ยกขาคู่หน้าขู่ แล้ววิ่งหนี' }, C: { b: '#4A3A2C', b2: '#6A5440', s: '#D8C8A0', l: '#3A2C20' }, draw: anSpider, sh: [0.05, 0.04] });
anDef('scorpion', { th: 'แมงป่อง', en: 'scorpion', grp: 'สัตว์ขาปล้อง (แมง)', fact: 'ไม่ใช่แมลง มีแปดขา ก้ามหนึ่งคู่ เหล็กไนอยู่ปลายหาง', hint: 'เดินด้วยแปดขา ชูหางโค้งเหนือหลัง แตะแล้วชูก้ามและเหล็กไนขู่ แล้ววิ่งหนี', kw: 'แมง อะแรคนิด เหล็กไน ไม่ใช่แมลง', go: 'walk', spd: 0.06, fast: 0.25, stride: 0.05, turn: 2.5, acc: 3, roam: 0.13, R: 0.26, tz: 0.04, react: 'threat', fleeLen: 0.25,
  loop: [['go', 3], ['rest', 3], ['go', 2.5]], acts: { go: 'เดินด้วยแปดขา', rest: 'หยุดนิ่ง', threat: 'ชูก้ามและเหล็กไนขู่ แล้ววิ่งหนี' }, C: { b: '#5E4A32', d: '#3A2C1E' }, draw: anScorpion, sh: [0.1, 0.05] });
anDef('centipede', { th: 'ตะขาบ', en: 'centipede', grp: 'สัตว์ขาปล้อง (ตะขาบและกิ้งกือ)', fact: 'ปล้องละหนึ่งคู่ขา ลำตัวแบน กินสัตว์อื่น ขาคู่แรกเป็นเขี้ยวพิษ', hint: 'วิ่งเร็ว ขาปล้องละคู่เคลื่อนเป็นคลื่น แตะแล้ววิ่งหนี', kw: 'ไคโลโพดา ขาปล้อง เขี้ยวพิษ', go: 'walk', L: 0.22, seg: 16, r: 0.007, flat: true, ant: 0.04, leg: 0.03, legw: 0.0025, spd: 0.12, fast: 0.35, stride: 0.03, turn: 2.5, roam: 0.09, R: 0.17, tz: 0.0, react: 'dart', fleeLen: 0.25,
  loop: [['go', 3], ['rest', 1.5], ['go', 3]], acts: { go: 'วิ่ง ขาเคลื่อนเป็นคลื่น', rest: 'หยุดนิ่ง', dart: 'วิ่งหนี' }, C: { b: '#8A3A20', d: '#6A2A14', l: '#D8A040' }, start: (s) => anTrailStart(s, 1), draw: anMany });
anDef('millipede', { th: 'กิ้งกือ', en: 'millipede', grp: 'สัตว์ขาปล้อง (ตะขาบและกิ้งกือ)', fact: 'ปล้องละสองคู่ขา ลำตัวกลม กินซากพืช ม้วนตัวเมื่อถูกรบกวน', hint: 'เดินช้า ๆ ขาสั้นจำนวนมากเคลื่อนเป็นคลื่น แตะแล้วม้วนตัวเป็นวง', kw: 'ดิพโลโพดา ขาปล้อง ม้วนตัว', go: 'walk', L: 0.2, seg: 22, r: 0.009, pairs: 2, ant: 0.015, leg: 0.013, legw: 0.002, spd: 0.035, fast: 0.035, stride: 0.02, turn: 1.2, roam: 0.08, R: 0.16, tz: 0.0, react: 'hide', coil: true,
  loop: [['go', 7], ['rest', 2]], acts: { go: 'เดินช้า ๆ ขาเคลื่อนเป็นคลื่น', rest: 'หยุดนิ่ง', hide: 'ม้วนตัวเป็นวง' }, C: { b: '#3E322A', d: '#7A5A3A', l: '#C89A6A' }, start: (s) => anTrailStart(s, 1), draw: anMany });
anDef('cockroach', { th: 'แมลงสาบ', en: 'cockroach', grp: 'แมลง', fact: 'เปลี่ยนแปลงรูปร่างแบบไม่สมบูรณ์ ใช้ศึกษาอวัยวะของแมลงในห้องปฏิบัติการ', hint: 'วิ่งเร็ว หนวดยาวกวาดไปมา แตะแล้ววิ่งพรวดหนี', kw: 'แมลง ห้องปฏิบัติการ ผ่าตัด', go: 'walk', spd: 0.14, fast: 0.45, stride: 0.05, turn: 4, acc: 5, roam: 0.1, R: 0.16, tz: 0.01, react: 'dart', fleeLen: 0.2,
  loop: [['go', 1.5], ['rest', 2], ['go', 1.2], ['look', 1.5]], acts: { go: 'วิ่ง', rest: 'หยุดนิ่ง', look: 'กวาดหนวดไปมา', dart: 'วิ่งพรวดหนี' }, C: { b: '#7A4626', t: '#8A5430', h: '#5A3418', a: '#5A3418', e: '#1E1612', l: '#6A3E22' },
  Q: { k: 1.6, zb: 0.008, th: [0.011, 0.013, 0.005], ab: [0.022, 0.013, 0.005], hd: [0.005, 0.006, 0.005], hdp: 0.9, ant: 0.045, antUp: 0.1, tap: 4, leg: 0.022, legw: 0.0025, eye: 0.4, wings: anInsectWingsFlat('#8A5430') }, draw: anInsect, sh: [0.05, 0.03] });
anDef('shark', { th: 'ฉลาม', en: 'shark', grp: 'ปลากระดูกอ่อน', fact: 'โครงร่างเป็นกระดูกอ่อน มีช่องเหงือกห้าถึงเจ็ดช่อง ไม่มีกระเพาะลม', hint: 'ว่ายน้ำวน ครีบหลังตั้ง หางแบ่งพูบนยาวกว่าล่าง แตะแล้วสะบัดหางพุ่งหนี', kw: 'ปลากระดูกอ่อน ช่องเหงือก ฉลามหูดำ', go: 'swim', spd: 0.18, fast: 0.6, stride: 0.2, turn: 1.2, acc: 2, roam: 0.28, zLo: 0.2, zHi: 0.3, z0: 0.25, R: 0.6, tz: 0.2, react: 'dart', fleeLen: 0.5,
  loop: [['go', 6], ['go', 5]], acts: { go: 'ว่ายน้ำวน', dart: 'สะบัดหาง พุ่งหนี' }, C: { b: '#7E8C98', b2: '#E8E6E0' }, Q: { L: 0.62, H: 0.062, wr: 0.85, A: 0.03, k: 1, fin: 0.1, pec: 0.08, gills: true }, draw: anSwim2, ground: anPond, sh: [0.25, 0.08] });
anDef('seahorse', { th: 'ม้าน้ำ', en: 'seahorse', grp: 'ปลา', fact: 'เป็นปลากระดูกแข็ง ตัวผู้ตั้งท้องในถุงหน้าท้อง', hint: 'ว่ายตัวตั้งตรงช้า ๆ ด้วยครีบหลัง ใช้หางม้วนเกาะสาหร่าย แตะแล้วว่ายหนีช้า ๆ', kw: 'ปลา ตัวผู้ตั้งท้อง สาหร่าย', go: 'swim', spd: 0.03, fast: 0.09, turn: 1, roam: 0.1, zLo: 0.12, zHi: 0.2, z0: 0.15, R: 0.22, tz: 0.13, react: 'flee', fleeLen: 0.2,
  loop: [['go', 5], ['hold', 5]], acts: { go: 'ว่ายตัวตั้งตรงด้วยครีบหลัง', hold: 'ใช้หางม้วนเกาะ', flee: 'ว่ายหนีช้า ๆ' }, C: { b: '#E2A43C', d: '#B87A20', f: '#F4D69A' }, draw: anSeahorse, props: anSeaGrass, ground: anPond, sh: [0.03, 0.03] });
anDef('dolphin', { th: 'โลมา', en: 'dolphin', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', fact: 'ไม่ใช่ปลา หายใจด้วยปอดทางรูหายใจ หางแบนโบกขึ้นลง', hint: 'ว่ายน้ำโบกหางขึ้นลง ขึ้นมาหายใจพ่นน้ำทางรูหายใจ แตะแล้วว่ายพุ่งหนี', kw: 'โลมาอิรวดี วาฬ สัตว์เลี้ยงลูกด้วยน้ำนม ไม่ใช่ปลา', go: 'swim', spd: 0.2, fast: 0.6, stride: 0.2, turn: 1.1, acc: 2, roam: 0.3, zLo: 0.18, zHi: 0.3, z0: 0.24, R: 0.72, tz: 0.24, react: 'dart', fleeLen: 0.5,
  loop: [['go', 5], ['breathe', 3.5], ['go', 5]], acts: { go: 'ว่ายน้ำโบกหางขึ้นลง', breathe: 'ขึ้นหายใจพ่นน้ำทางรูหายใจ', dart: 'ว่ายพุ่งหนี' }, C: { b: '#7C8CA0', b2: '#DADDE2' }, Q: { L: 0.7, H: 0.075, wr: 0.85, A: 0.04, k: 1.2, fin: 0.07, pec: 0.06, vert: true, beak: true },
  tick: (s, dt, act) => { if (act === 'breathe') { const up = s.ap < 0.75 ? 0.46 : AN.dolphin.z0; s.z += (up - s.z) * Math.min(1, dt * 1.6); } return false; }, draw: anSwim2, ground: anPond, sh: [0.28, 0.08] });
anDef('platypus', { th: 'ตุ่นปากเป็ด', en: 'platypus', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', fact: 'สัตว์เลี้ยงลูกด้วยน้ำนมที่ออกลูกเป็นไข่ ปากคล้ายเป็ด ตีนมีพังผืด', hint: 'เดินตัวต่ำ ใช้ปากคุ้ยหาอาหารที่พื้น แตะแล้ววิ่งหนี', kw: 'โมโนทรีม ออกลูกเป็นไข่ ออสเตรเลีย', go: 'walk', spd: 0.1, fast: 0.35, stride: 0.07, turn: 2, roam: 0.14, R: 0.3, tz: 0.04, react: 'dart', fleeLen: 0.3,
  loop: [['go', 4], ['dig', 3], ['go', 3]], acts: { go: 'เดินตัวต่ำ', dig: 'ใช้ปากคุ้ยหาอาหาร', dart: 'วิ่งหนี' }, C: { b: '#6E4A30', b2: '#9A7656', m: '#3E3834' }, draw: anPlatypus, ground: anPond, sh: [0.15, 0.07] });
anDef('kangaroo', { th: 'จิงโจ้', en: 'kangaroo', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', fact: 'สัตว์มีกระเป๋าหน้าท้อง ลูกเกิดตัวเล็กมากแล้วโตต่อในกระเป๋า', hint: 'ก้มเล็มหญ้า ยืนตัวตรงมองรอบตัว กระโดดด้วยขาหลัง แตะแล้วกระโดดไกลหนี', kw: 'มาร์ซูเปียล กระเป๋าหน้าท้อง ออสเตรเลีย', go: 'hop', spd: 0.4, fast: 1, hopLen: 0.16, hopH: 0.09, hopT: 0.45, hopRest: 0.45, jumpLen: 0.42, jumpH: 0.18, turn: 3, roam: 0.2, R: 0.5, tz: 0.2, react: 'jump',
  loop: [['graze', 4], ['go', 3], ['look', 2.5], ['go', 2.5]], acts: { graze: 'ก้มเล็มหญ้า', go: 'กระโดดด้วยขาหลัง', look: 'ยืนตัวตรงมองรอบตัว', jump: 'กระโดดไกลหนี' }, C: { b: '#B47E4E', b2: '#E6CCA8', d: '#6E4A2E' }, draw: anRoo, props: anGrassField, sh: [0.18, 0.08] });
anDef('penguin', { th: 'เพนกวิน', en: 'penguin', grp: 'สัตว์ปีก (นก)', fact: 'เป็นนกที่บินไม่ได้ ปีกเป็นครีบใช้ว่ายน้ำ', hint: 'เดินเตาะแตะ กางครีบ ไซ้ขน แตะแล้วล้มลงไถลด้วยท้องหนี', kw: 'นกบินไม่ได้ ขั้วโลกใต้', go: 'walk', spd: 0.07, fast: 0.4, stride: 0.06, turn: 2, roam: 0.12, R: 0.44, tz: 0.14, react: 'flee', fleeLen: 0.25,
  loop: [['go', 4], ['look', 2], ['go', 3], ['preen', 2.5]], acts: { go: 'เดินเตาะแตะ', look: 'มองรอบตัว', preen: 'ไซ้ขน', flee: 'ล้มลงไถลด้วยท้องหนี' }, C: { b: '#262A30', b2: '#F2F0EA', f: '#E88A2E' }, draw: anPenguin, sh: [0.09, 0.07] });
anDef('cobra', { th: 'งูเห่า', en: 'cobra', grp: 'สัตว์เลื้อยคลาน', fact: 'งูพิษ แผ่แม่เบี้ยขู่ ใช้ลิ้นแฉกรับกลิ่น', hint: 'เลื้อยส่ายตัว แลบลิ้น แตะแล้วชูคอแผ่แม่เบี้ยขู่ แล้วเลื้อยหนี', kw: 'งู สัตว์เลื้อยคลาน แม่เบี้ย งูพิษ', go: 'walk', L: 0.55, r: 0.02, wiggle: 2.2, spd: 0.1, fast: 0.3, stride: 0.1, turn: 1.4, roam: 0.14, R: 0.36, tz: 0.04, react: 'threat', fleeLen: 0.35,
  loop: [['go', 6], ['rest', 3], ['go', 5]], acts: { go: 'เลื้อย แลบลิ้นรับกลิ่น', rest: 'นอนนิ่ง', threat: 'ชูคอแผ่แม่เบี้ยขู่ แล้วเลื้อยหนี' }, C: { b: '#5A4A36', b2: '#D8C8A0', s: '#C8B48A' }, start: (s) => { s.kind = 'cobra'; anTrailStart(s, 2); }, tick: anWormTick, draw: anCobra, sh: [0.0001, 0.0001] });

/* ----- third set (owner 21 พ.ย. 2569 asked for more): farm and lab mammals, reptiles, fish of the rice field and the mud,
   a whale, young stages (caterpillar, tadpole), more insects, more sea animals, an owl ----- */
const AN_HORSE_HEAD = (b, s, C, D, k) => {
  b.ell([D.Q.hr[0] * 0.75, 0, -0.025], [0.07, 0.048, 0.05], null, C.b, { n1: 6, n2: 8 });
  b.eye([0.0, 0.05, 0.03], 0.016, [0.2, 1, 0.3]); b.eye([0.0, -0.05, 0.03], 0.016, [0.2, -1, 0.3]);
  for (const sd of [1, -1]) b.sheet([[-0.07, sd * 0.03, 0.05], [-0.08, sd * 0.04, 0.12], [-0.1, sd * 0.035, 0.05]], C.b);
};
const AN_PIG_HEAD = (b, s, C, D, k) => {
  b.tube([[D.Q.hr[0] * 0.6, 0, -0.01], [D.Q.hr[0] * 1.05, 0, -0.015]], 0.04, C.b, { sides: 9 });
  b.ball([D.Q.hr[0] * 1.06, 0.013, -0.012], 0.007, C.d); b.ball([D.Q.hr[0] * 1.06, -0.013, -0.012], 0.007, C.d);
  b.eye([0.03, 0.06, 0.03], 0.011, [0.4, 1, 0.3]); b.eye([0.03, -0.06, 0.03], 0.011, [0.4, -1, 0.3]);
  for (const sd of [1, -1]) b.sheet([[-0.02, sd * 0.05, 0.06], [0.04, sd * 0.11, 0.05], [-0.03, sd * 0.1, 0.0]], C.b);
};
const AN_GOAT_HEAD = (b, s, C, D, k) => {
  b.ell([D.Q.hr[0] * 0.8, 0, -0.02], [0.05, 0.035, 0.04], null, C.b, { n1: 6, n2: 8 });
  b.eye([0.01, 0.042, 0.025], 0.011, [0.3, 1, 0.3], '#7A5A1A'); b.eye([0.01, -0.042, 0.025], 0.011, [0.3, -1, 0.3], '#7A5A1A');
  AN_EAR(b, -0.03, 0.035, 0.02, 0.07, -0.02, 0.022, C.b, 0.02);
  anHorn(b, [[-0.04, 0.025, 0.045], [-0.07, 0.035, 0.1], [-0.13, 0.045, 0.12], [-0.17, 0.05, 0.09]], 0.014, C.h);
  b.tube([[0.07, 0, -0.06], [0.08, 0, -0.1]], (t) => 0.012 * (1 - 0.7 * t), C.m, { sides: 5 });
};
const AN_RAT_HEAD = (b, s, C, D, k) => {
  b.tube([[0.02, 0, -0.005], [0.075, 0, -0.012]], (t) => 0.03 * (1 - 0.7 * t), C.b, { sides: 8 }); b.ball([0.078, 0, -0.012], 0.007, '#D88A8A');
  b.eye([0.02, 0.025, 0.012], 0.009, [0.4, 1, 0.3]); b.eye([0.02, -0.025, 0.012], 0.009, [0.4, -1, 0.3]);
  for (const sd of [1, -1]) { const e = []; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; e.push([-0.015 + Math.cos(a) * 0.018, sd * (0.03 + 0.003 * Math.sin(a)), 0.035 + Math.sin(a) * 0.018]); } b.sheet(e, C.e); }
  for (const sd of [1, -1]) for (const dz of [-0.004, 0.004]) b.line([[0.07, sd * 0.01, -0.01 + dz], [0.1, sd * 0.05, -0.006 + dz * 3]], 'rgba(60,60,70,0.55)', 0.002);
};
const anTailCurl = (b, s, C, D, T0) => { const q = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * 7, r = 0.02 * (1 - i / 14); q.push(anAdd(T0, [-0.02 - i * 0.004, Math.cos(a) * r, Math.sin(a) * r])); } b.tube(q, 0.008, C.b, { sides: 5 }); };
const anTailGround = (b, s, C, D, T0) => { const q = []; for (let i = 0; i <= 8; i++) { const u = i / 8; q.push(anAdd(T0, [-0.3 * u, Math.sin(s.t * 1.2 + u * 3) * 0.04 * u, -T0[2] * Math.min(1, u * 2) + 0.006])); } b.tube(q, (t) => 0.01 * (1 - 0.7 * t), C.e, { sides: 5 }); };
const anTailUpShort = (b, s, C, D, T0) => b.tube([T0, anAdd(T0, [-0.03, 0, 0.05 + 0.01 * Math.sin(s.t * 3)])], (t) => 0.015 * (1 - 0.6 * t), C.b, { sides: 6 });
/* breathing at the surface: whale and dolphin go up, then down again */
const anBreathe = (id) => (s, dt, act) => { if (act === 'breathe') { const D = AN[id], up = s.ap < 0.75 ? D.zHi + 0.16 : D.z0; s.z += (up - s.z) * Math.min(1, dt * 1.6); } return false; };
/* tadpole: a round body and a long tail that waves, a fin round the tail; it swims near the bottom */
function anTadpole(b, s, C, D) {
  const w = (s.fx.w = (s.fx.w || 0) + 0.016 * (1.5 + 3 * Math.min(1.5, s.mv) + (s.rx ? 3 : 0)) * 4);
  b.ell([0, 0, 0], [0.032, 0.026, 0.022], null, (u) => (u[2] < -0.3 ? C.b2 : C.b), { n1: 8, n2: 10 });
  const q = []; for (let i = 0; i <= 7; i++) { const u = i / 7; q.push([-0.025 - 0.07 * u, Math.sin(u * 4 - w) * 0.018 * u, 0]); }
  b.tube(q, (t) => 0.01 * (1 - 0.85 * t), C.b, { sides: 6 });
  const fin = [], fin2 = []; for (let i = 0; i <= 7; i++) { const p = q[i], hh = 0.016 * Math.sin(Math.PI * (0.15 + 0.85 * i / 7)); fin.push([p[0], p[1], hh]); fin2.unshift([p[0], p[1], -hh]); }
  b.sheet(fin.concat(fin2), C.f);
  for (const sd of [1, -1]) b.eye([0.018, sd * 0.018, 0.01], 0.006, [0.4, sd, 0.4]);
}
/* sea urchin: a ball covered in spines that keep moving; touched, the spines bristle towards the finger */
function anUrchin(b, s, C, D) {
  const k = s.rx ? s.rk : 0;
  b.ell([0, 0, 0.032], [0.038, 0.038, 0.03], null, C.b, { n1: 8, n2: 10 });
  for (let i = 0; i < 46; i++) {
    const th = Math.acos(1 - (i + 0.5) / 46 * 1.6), ph = i * 2.4, u = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
    const sw = Math.sin(s.t * 1.5 + i) * 0.12 * (1 - k), d = anUnit([u[0] + sw, u[1] - sw, u[2]]), o = [u[0] * 0.036, u[1] * 0.036, 0.032 + u[2] * 0.028];
    b.line([o, anAdd(o, anMul(d, 0.05 * (1 + 0.35 * k)))], C.d, 0.003);
  }
}
/* owl: sits up on a stump, turns its head far round to look, a flat face with big eyes forward; it flies off when touched */
const AN_STUMP = [0.0, 0.0, 0.08];
function anOwl(b, s, C, D) {
  const perch = s.perched || s.z <= AN_STUMP[2] + 0.002, fl = Math.sin(s.t * 18);
  const look = perch ? Math.sin(s.t * 0.45) * 2.0 * Math.max(0, Math.sin(s.t * 0.2)) : 0;
  b.push([0, 0, 0], anMm(anRy(perch ? 0 : 1.2), [1.5, 0, 0, 0, 1.5, 0, 0, 0, 1.5]));
  b.ell([0, 0, 0.075], [0.075, 0.05, 0.048], anRy(-Math.PI / 2), (u) => (u[2] < -0.1 && Math.sin(u[0] * 18) > 0 ? C.b2 : C.b), { n1: 9, n2: 11 });
  for (const sd of [1, -1]) {
    if (perch) b.ell([-0.01, sd * 0.045, 0.075], [0.055, 0.014, 0.04], anRy(-1.3), C.w, { n1: 6, n2: 8 });
    else { b.push([0, sd * 0.04, 0.09], anRx(sd * (0.2 + 0.8 * fl))); b.sheet([[0.03, 0, 0], [0.02, sd * 0.2, 0.01], [-0.05, sd * 0.18, 0], [-0.07, 0, 0]], C.w); b.pop(); }
    b.tube([[0.01, sd * 0.02, 0.01], [0.02, sd * 0.022, -0.005]], 0.006, C.f, { sides: 4 });
  }
  b.push([0.005, 0, 0.16], anRz(look));
  b.ell([0, 0, 0], [0.045, 0.05, 0.045], null, C.b, { n1: 8, n2: 10 });
  b.ell([0.032, 0, -0.002], [0.012, 0.042, 0.035], null, C.b2, { n1: 6, n2: 9 });
  for (const sd of [1, -1]) { b.eye([0.042, sd * 0.018, 0.005], 0.017, [1, sd * 0.2, 0.1], '#E8B830'); b.sheet([[0.0, sd * 0.025, 0.035], [-0.005, sd * 0.04, 0.07], [-0.02, sd * 0.035, 0.035]], C.b); }
  b.tube([[0.044, 0, -0.008], [0.055, 0, -0.016]], (t) => 0.006 * (1 - 0.7 * t), '#4A3A28', { sides: 5 });
  b.pop(); b.pop();
}

anDef('horse', { th: 'ม้า', en: 'horse', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', fact: 'กินพืช มีกีบเดียว (กีบคี่) ไม่เคี้ยวเอื้อง', hint: 'เดินแล้วก้มเล็มหญ้า สะบัดหาง แตะแล้วควบหนี', kw: 'อาชา สัตว์กินพืช กีบคี่', go: 'walk', spd: 0.16, fast: 0.6, stride: 0.4, turn: 1.4, roam: 0.22, R: 0.95, tz: 0.4, react: 'flee', fleeLen: 0.55,
  loop: [['go', 6], ['graze', 5], ['look', 2.5], ['go', 5]], acts: { graze: 'ก้มเล็มหญ้า', flee: 'ตกใจ ควบหนี' }, C: { b: '#8A5634', b2: '#A8704A', d: '#2E2420', m: '#2E2420' },
  Q: Object.assign({}, AN_QCOW, { bx: 0.38, by: 0.14, bz: 0.17, zh: 0.62, fx: 0.26, hx: -0.26, hy: 0.09, fy: 0.09, fz: 0.6, hz: 0.62, l1: 0.33, l2: 0.33, lr: 0.045, lr2: 0.028, hoof: 0.028, step: 0.13, sx: 0.36, sz: 0.72, nl: 0.36, nr: 0.08, na: 0.9, naD: -0.95, ha: 1.2, haD: 1.75, hr: [0.12, 0.05, 0.06], head: AN_HORSE_HEAD, tail: (b, s, C, D, T0) => anTailHang(b, s, T0, 0.42, 0.035, C.m, null, 0.1) }), draw: anQuad, props: anGrassField, sh: [0.45, 0.18] });
anDef('pig', { th: 'หมู', en: 'pig', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', fact: 'กินทั้งพืชและสัตว์ มีกีบคู่ จมูกแบนใช้ดุนดินหาอาหาร', hint: 'เดินดุดิน หางม้วน แตะแล้วร้องวิ่งหนี', kw: 'สุกร กีบคู่ สัตว์กินทั้งพืชและสัตว์', go: 'walk', spd: 0.1, fast: 0.4, stride: 0.22, turn: 1.6, roam: 0.2, R: 0.62, tz: 0.18, react: 'flee', fleeLen: 0.45,
  loop: [['go', 5], ['sniff', 5], ['go', 4], ['look', 2]], acts: { sniff: 'ใช้จมูกดุนดินหาอาหาร', flee: 'ร้อง วิ่งหนี' }, C: { b: '#E6A79E', b2: '#F0C2BA', d: '#8A4A44' },
  Q: Object.assign({}, AN_QCOW, { bx: 0.3, by: 0.15, bz: 0.15, zh: 0.27, fx: 0.18, hx: -0.18, hy: 0.08, fy: 0.08, fz: 0.25, hz: 0.27, l1: 0.13, l2: 0.13, lr: 0.04, lr2: 0.03, hoof: 0.022, step: 0.07, lift: 0.04, sx: 0.28, sz: 0.3, nl: 0.06, nr: 0.11, na: 0.1, naD: -0.6, ha: 0.25, haD: 1.0, hr: [0.1, 0.09, 0.09], down: 'sniff', head: AN_PIG_HEAD, tail: anTailCurl }), draw: anQuad, sh: [0.33, 0.17] });
anDef('goat', { th: 'แพะ', en: 'goat', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', fact: 'กินพืช เคี้ยวเอื้อง มีกีบคู่ ปีนที่สูงเก่ง', hint: 'เดินเล็มหญ้า มีเครา เขาโค้งไปหลัง แตะแล้ววิ่งหนี', kw: 'แพะ แกะ เคี้ยวเอื้อง กีบคู่', go: 'walk', spd: 0.13, fast: 0.5, stride: 0.26, turn: 2, roam: 0.22, R: 0.66, tz: 0.24, react: 'flee', fleeLen: 0.45,
  loop: [['go', 5], ['graze', 5], ['look', 2.4], ['go', 4]], acts: { graze: 'ก้มเล็มหญ้า', flee: 'ตกใจ วิ่งหนี' }, C: { b: '#E6DED0', b2: '#F2EEE6', d: '#4A3E32', m: '#CEC4B4', h: '#8A7A64' },
  Q: Object.assign({}, AN_QCOW, { bx: 0.27, by: 0.11, bz: 0.12, zh: 0.38, fx: 0.18, hx: -0.18, hy: 0.065, fy: 0.065, fz: 0.37, hz: 0.38, l1: 0.2, l2: 0.2, lr: 0.03, lr2: 0.02, hoof: 0.02, step: 0.09, lift: 0.05, sx: 0.25, sz: 0.44, nl: 0.18, nr: 0.05, na: 0.95, naD: -0.95, ha: 1.0, haD: 1.75, hr: [0.08, 0.04, 0.045], head: AN_GOAT_HEAD, tail: anTailUpShort }), draw: anQuad, props: anGrassField, sh: [0.3, 0.12] });
anDef('rat', { th: 'หนู', en: 'rat', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', fact: 'ฟันหน้างอกยาวตลอดชีวิตจึงต้องแทะ ใช้เป็นสัตว์ทดลอง', hint: 'วิ่งเป็นช่วง ๆ ดมกลิ่น หางยาว แตะแล้ววิ่งหนี', kw: 'หนูบ้าน หนูขาว สัตว์ฟันแทะ สัตว์ทดลอง', go: 'walk', spd: 0.16, fast: 0.6, stride: 0.12, turn: 3.5, acc: 4, roam: 0.16, R: 0.34, tz: 0.06, react: 'flee', fleeLen: 0.35,
  loop: [['go', 2], ['sniff', 2.5], ['go', 1.6], ['look', 1.6]], acts: { sniff: 'ดมกลิ่นหาอาหาร', flee: 'วิ่งหนี' }, C: { b: '#8A8078', b2: '#C8C0B6', d: '#C89A9A', e: '#D8A8A4' },
  Q: { bx: 0.11, by: 0.05, bz: 0.045, zh: 0.075, fx: 0.06, hx: -0.06, hy: 0.03, fy: 0.035, fz: 0.065, hz: 0.07, l1: 0.04, l2: 0.04, lr: 0.012, lr2: 0.008, hoof: 0.008, step: 0.035, lift: 0.02, sx: 0.1, sz: 0.085, nl: 0.02, nr: 0.03, na: 0.4, naD: -0.4, ha: 0.1, haD: 0.6, hr: [0.035, 0.03, 0.03], down: 'sniff', head: AN_RAT_HEAD, tail: anTailGround }, draw: anQuad, sh: [0.12, 0.05] });
anDef('crocodile', { th: 'จระเข้', en: 'crocodile', grp: 'สัตว์เลื้อยคลาน', fact: 'หัวใจสี่ห้อง ผิวเป็นเกล็ดแข็ง วางไข่บนบก', hint: 'นอนนิ่งนาน ๆ แล้วคลานช้า ๆ แตะแล้วอ้าปากขู่ แล้วคลานหนี', kw: 'จระเข้น้ำจืด สัตว์เลื้อยคลาน', go: 'walk', spd: 0.1, fast: 0.4, stride: 0.25, turn: 1.2, acc: 2, roam: 0.1, R: 1.15, tz: 0.04, react: 'threat', fleeLen: 0.4,
  loop: [['rest', 5], ['go', 4], ['rest', 4], ['look', 2]], acts: { go: 'คลานช้า ๆ', rest: 'นอนนิ่งผึ่งแดด', look: 'ยกหัวมอง', threat: 'อ้าปากขู่ แล้วคลานหนี' }, C: { b: '#5C6A3C', b2: '#C8C08A', d: '#3E4828' },
  Q: { k: 3.0, snout: 1.9, scutes: true, eye: '#B89A2A', mouth: '#E8C8B0' }, draw: anLizard, ground: anPond, sh: [0.75, 0.16] });
anDef('gardenlizard', { th: 'กิ้งก่า', en: 'garden lizard', grp: 'สัตว์เลื้อยคลาน', fact: 'เปลี่ยนสีผิวได้ ตัวผู้ผงกหัวและหัวเปลี่ยนเป็นสีแดงเพื่อสื่อสาร', hint: 'วิ่งเป็นช่วง ๆ ผงกหัว หัวเปลี่ยนเป็นสีแดง แตะแล้ววิ่งหนี', kw: 'กิ้งก่าหัวแดง สัตว์เลื้อยคลาน เปลี่ยนสี', go: 'walk', spd: 0.25, fast: 0.8, stride: 0.1, turn: 5, acc: 5, roam: 0.16, R: 0.34, tz: 0.03, react: 'dart', fleeLen: 0.4,
  loop: [['go', 1.2], ['look', 2.4], ['go', 1], ['rest', 2]], acts: { go: 'วิ่งเป็นช่วง ๆ', look: 'ผงกหัว หัวเปลี่ยนเป็นสีแดง', rest: 'เกาะนิ่ง', dart: 'วิ่งพรวดหนี' }, C: { b: '#8C8A52', b2: '#D8D4A4', d: '#5E5C34' },
  Q: { k: 1.1, crest: 0.012, blush: '#C8402A', eye: '#3A2A18' }, draw: anLizard, sh: [0.2, 0.06] });
anDef('whale', { th: 'วาฬ', en: 'whale', grp: 'สัตว์เลี้ยงลูกด้วยน้ำนม', fact: 'สัตว์ที่ใหญ่ที่สุดในโลก ไม่ใช่ปลา หายใจด้วยปอด เลี้ยงลูกด้วยน้ำนม', hint: 'ว่ายช้า ๆ โบกหางขึ้นลง ขึ้นมาพ่นน้ำทางรูหายใจ แตะแล้วดำน้ำหนี', kw: 'วาฬบรูด้า สัตว์เลี้ยงลูกด้วยน้ำนม ไม่ใช่ปลา', go: 'swim', spd: 0.12, fast: 0.35, stride: 0.3, turn: 0.6, acc: 1, roam: 0.3, zLo: 0.2, zHi: 0.3, z0: 0.25, R: 1.0, tz: 0.3, react: 'dart', fleeLen: 0.5,
  loop: [['go', 7], ['breathe', 4], ['go', 6]], acts: { go: 'ว่ายช้า ๆ โบกหางขึ้นลง', breathe: 'ขึ้นหายใจพ่นน้ำทางรูหายใจ', dart: 'ดำน้ำหนี' }, C: { b: '#4E5E72', b2: '#C8CCD2' },
  Q: { L: 1.1, H: 0.12, wr: 0.85, A: 0.04, k: 1.9, fin: 0.04, pec: 0.16, vert: true }, tick: anBreathe('whale'), draw: anSwim2, ground: anPond, sh: [0.45, 0.12] });
anDef('catfish', { th: 'ปลาดุก', en: 'catfish', grp: 'ปลา', fact: 'ไม่มีเกล็ด มีหนวดรับรสสี่คู่ หายใจเอาอากาศจากผิวน้ำได้', hint: 'ว่ายใกล้พื้น ใช้หนวดหาอาหาร แตะแล้วสะบัดหางพุ่งหนี', kw: 'ปลาดุกด้าน ปลาน้ำจืด ไม่มีเกล็ด หนวด', go: 'swim', spd: 0.12, fast: 0.6, stride: 0.2, turn: 1.6, acc: 2.5, roam: 0.22, zLo: 0.06, zHi: 0.12, z0: 0.08, R: 0.45, tz: 0.08, react: 'dart', fleeLen: 0.45,
  loop: [['go', 5], ['hover', 3], ['go', 4]], acts: { go: 'ว่ายใกล้พื้น', hover: 'ใช้หนวดหาอาหาร', dart: 'สะบัดหาง พุ่งหนี' }, C: { b: '#4A4436', b2: '#C8BCA0', d: '#2E2A22' },
  Q: { L: 0.46, H: 0.042, wr: 1.1, A: 0.03, k: 0.9, fin: 0.02, pec: 0.04, barbels: true }, draw: anSwim2, ground: anPond, sh: [0.2, 0.05] });
anDef('mudskipper', { th: 'ปลาตีน', en: 'mudskipper', grp: 'ปลา', fact: 'ปลาที่ขึ้นมาอยู่บนเลนได้ เก็บน้ำไว้ในช่องเหงือกและหายใจทางผิวหนัง', hint: 'ใช้ครีบอกค้ำตัวกระโดดบนเลน ตาโปนอยู่บนหัว แตะแล้วดีดตัวหนี', kw: 'ปลาตีน ป่าชายเลน ปลาขึ้นบก', go: 'hop', spd: 0.3, fast: 0.8, hopLen: 0.07, hopH: 0.03, hopT: 0.3, hopRest: 0.6, jumpLen: 0.25, jumpH: 0.1, turn: 3, roam: 0.14, R: 0.3, tz: 0.04, react: 'jump',
  loop: [['go', 3], ['rest', 3], ['go', 2], ['look', 2]], acts: { go: 'ใช้ครีบอกค้ำตัวกระโดด', rest: 'หมอบนิ่งบนเลน', look: 'กลอกตามอง', jump: 'ดีดตัวหนี' }, C: { b: '#7A6E52', b2: '#C8BC9C', d: '#4A4234' },
  Q: { L: 0.2, H: 0.022, wr: 0.9, A: 0.008, k: 0.45, fin: 0.025, pec: 0.03, topEyes: true }, draw: (b, s, C, D) => { b.push([0, 0, D.Q.H]); anSwim2(b, s, C, D); b.pop(); }, ground: anSoil, sh: [0.09, 0.03] });
anDef('caterpillar', { th: 'หนอนผีเสื้อ', en: 'caterpillar', grp: 'แมลง', fact: 'ตัวหนอนของผีเสื้อ กินใบไม้ ลอกคราบหลายครั้งก่อนเป็นดักแด้', hint: 'คืบไปเป็นคลื่น กินใบไม้ แตะแล้วม้วนตัว', kw: 'หนอน ตัวอ่อน ผีเสื้อ วงจรชีวิต', go: 'walk', L: 0.13, seg: 12, r: 0.011, pairs: 1, ant: 0.006, leg: 0.012, legw: 0.0025, spd: 0.025, fast: 0.025, stride: 0.03, turn: 1, roam: 0.08, R: 0.15, tz: 0.0, react: 'hide', coil: true, head: '#3E4A26',
  legsOn: (i, n) => i <= 3 || (i >= 6 && i <= 9) || i === n - 1, loop: [['go', 6], ['eat', 3]], acts: { go: 'คืบไปเป็นคลื่น', eat: 'กินใบไม้', hide: 'ม้วนตัว' }, C: { b: '#7CA444', d: '#4E7A2A', l: '#5E7A30' }, start: (s) => anTrailStart(s, 1), draw: anMany,
  props: (b) => { b.sheet([[0.04, -0.06, 0.001], [0.12, -0.02, 0.001], [0.07, 0.02, 0.001]], '#5E9E3A'); } });
anDef('tadpole', { th: 'ลูกอ๊อด', en: 'tadpole', grp: 'สัตว์สะเทินน้ำสะเทินบก', fact: 'ตัวอ่อนของกบ หายใจด้วยเหงือก มีหาง โตขึ้นขาหลังงอกก่อนแล้วเปลี่ยนรูปร่างเป็นกบ', hint: 'ว่ายส่ายหางไปมาใกล้พื้น หยุดกินตะไคร่ แตะแล้วว่ายพุ่งหนี', kw: 'ลูกกบ ตัวอ่อน วงจรชีวิต เมทามอร์โฟซิส', go: 'swim', spd: 0.06, fast: 0.3, turn: 3, acc: 3, roam: 0.1, zLo: 0.03, zHi: 0.06, z0: 0.04, R: 0.16, tz: 0.04, react: 'dart', fleeLen: 0.2,
  loop: [['go', 3], ['hover', 2]], acts: { go: 'ว่ายส่ายหาง', hover: 'หยุดกินตะไคร่', dart: 'ว่ายพุ่งหนี' }, C: { b: '#4A4436', b2: '#8A8064', f: '#9A9070' }, draw: anTadpole, ground: anPond, sh: [0.05, 0.03] });
anDef('housefly', { th: 'แมลงวัน', en: 'housefly', grp: 'แมลง', fact: 'มีปีกคู่เดียว ปีกคู่หลังเปลี่ยนเป็นตุ่มช่วยทรงตัว เป็นพาหะนำโรค', hint: 'บินวน ลงเกาะแล้วถูขา แตะแล้วบินหนี', kw: 'แมลงวันบ้าน ปีกคู่เดียว พาหะ', go: 'fly', spd: 0.16, fast: 0.6, stride: 0.2, turn: 6, acc: 4, roam: 0.14, zLo: 0.08, zHi: 0.2, z0: 0.14, R: 0.2, tz: 0.07, react: 'flyoff', near: 0.02,
  loop: [['fly', 3], ['land', 4], ['fly', 2.5]], acts: { fly: 'บินวน', land: 'ลงเกาะ ถูขา', flyoff: 'บินหนี' }, C: { b: '#3A3A3E', t: '#4A4A50', a: '#2A2A2E', e: '#A83A2A', l: '#2E2E34' },
  perch: (s) => { if (!s.pp) { const p = anTarget(AN.housefly, s); s.pp = [p[0] * 0.7, p[1] * 0.7, 0.03]; } return s.pp; }, enter: (s) => { s.pp = null; },
  Q: { k: 1.5, zb: 0.012, th: [0.01, 0.008, 0.008], ab: [0.014, 0.009, 0.008], hd: [0.007, 0.009, 0.008], hdp: 0.4, ant: 0.004, leg: 0.016, legw: 0.0022, flap: 40, eye: 0.75,
    wings: anWingPair([[0, 0, 0], [-0.004, 0.016, 0.003], [-0.03, 0.02, 0.003], [-0.03, 0.006, 0]], null, 'rgba(205,215,225,0.55)', { restA: 0.06, amp: 0.7, mid: 0.3, sweep: 0.35, stroke: 'rgba(110,120,130,0.5)' }) },
  draw: anInsect, sh: [0.04, 0.025] });
anDef('beetle', { th: 'ด้วงกว่าง', en: 'rhinoceros beetle', grp: 'แมลง', fact: 'ปีกคู่หน้าแข็งเป็นปลอกหุ้มปีกคู่หลัง เปลี่ยนแปลงรูปร่างสมบูรณ์', hint: 'เดินช้า ๆ ด้วยหกขา ตัวผู้มีเขายาว แตะแล้วแกล้งตาย หดขานิ่ง', kw: 'ด้วง แมลงปีกแข็ง กว่าง', go: 'walk', spd: 0.04, fast: 0.04, stride: 0.05, turn: 2, roam: 0.1, R: 0.2, tz: 0.03, react: 'hide',
  loop: [['go', 4], ['rest', 3]], acts: { go: 'เดินช้า ๆ', rest: 'หยุดนิ่ง', hide: 'แกล้งตาย หดขานิ่ง' }, C: { b: '#4A2E1E', t: '#3A2418', h: '#2E1C12', a: '#2E1C12', e: '#141010', d: '#2E1C12', l: '#2E1C12' },
  Q: { k: 2.2, zb: 0.012, th: [0.012, 0.012, 0.008], ab: [0.022, 0.014, 0.01], hd: [0.007, 0.008, 0.006], hdp: 0.2, ant: 0.008, leg: 0.02, legw: 0.003, horn: true, dead: true, eye: 0.3,
    wings: (b, s, C, D) => { for (const sd of [1, -1]) b.ell([-0.022 * 2.2, sd * 0.0065 * 2.2, 0.006 * 2.2], [0.026 * 2.2, 0.0075 * 2.2, 0.008 * 2.2], null, '#5E3A22', { n1: 7, n2: 8 }); } },
  draw: anInsect, sh: [0.07, 0.04] });
anDef('anemone', { th: 'ดอกไม้ทะเล', en: 'sea anemone', grp: 'ไนดาเรีย', fact: 'เกาะอยู่กับที่ หนวดมีเข็มพิษ อยู่ร่วมกับปลาการ์ตูนแบบพึ่งพากัน', hint: 'เกาะหินอยู่กับที่ หนวดจำนวนมากพลิ้วตามน้ำ แตะแล้วหดหนวดเข้า', kw: 'ไนดาเรีย ปลาการ์ตูน ภาวะพึ่งพากัน', go: 'walk', spd: 0.001, fast: 0.001, roam: 0.01, R: 0.18, tz: 0.06, react: 'hide',
  loop: [['sway', 6], ['catch', 3]], acts: { sway: 'หนวดพลิ้วตามน้ำ', catch: 'ใช้หนวดจับอาหาร', hide: 'หดหนวดเข้า' }, C: { b: '#C8607A', t: '#F0A0B8' }, Q: { r: 0.035, L: 0.07, n: 26, tl: 0.016, tw: 0.006, sway: 0.08 }, draw: anHydra, ground: anSand, sh: [0.06, 0.06] });
anDef('urchin', { th: 'เม่นทะเล', en: 'sea urchin', grp: 'เอไคโนเดิร์ม', fact: 'มีหนามแหลมรอบตัว เคลื่อนที่ด้วยทิวบ์ฟีต ปากอยู่ด้านล่างมีฟันห้าซี่', hint: 'เคลื่อนที่ช้ามากบนพื้น หนามขยับไปมา แตะแล้วหนามตั้งชันป้องกันตัว', kw: 'หอยเม่น เอไคโนเดิร์ม หนาม', go: 'walk', side: true, spd: 0.016, fast: 0.016, roam: 0.08, R: 0.16, tz: 0.04, react: 'hide',
  loop: [['go', 10], ['rest', 4]], acts: { go: 'เคลื่อนที่ช้ามากด้วยทิวบ์ฟีต', rest: 'หยุดนิ่ง', hide: 'หนามตั้งชันป้องกันตัว' }, C: { b: '#4A2A4E', d: '#2E1A30' }, draw: anUrchin, ground: anSand, sh: [0.06, 0.06] });
anDef('owl', { th: 'นกฮูก', en: 'owl', grp: 'สัตว์ปีก (นก)', fact: 'หากินกลางคืน ตามองไปข้างหน้า หมุนคอได้เกือบรอบตัว', hint: 'เกาะตอไม้ หมุนคอมองรอบตัว แตะแล้วบินหนี แล้วกลับมาเกาะ', kw: 'นกเค้าแมว นักล่ากลางคืน', go: 'fly', spd: 0.25, fast: 0.6, stride: 0.2, turn: 3, acc: 2.5, roam: 0.2, zLo: 0.3, zHi: 0.45, z0: AN_STUMP[2], R: 0.42, tz: 0.18, react: 'flyoff', near: 0.02,
  loop: [['land', 12]], acts: { land: 'เกาะตอไม้ หมุนคอมองรอบตัว', flyoff: 'บินหนี' }, C: { b: '#A27A4E', b2: '#EEE2CA', w: '#8A6440', f: '#C8A040' },
  perch: () => AN_STUMP.slice(), start: (s) => { s.x = 0; s.y = 0; s.z = AN_STUMP[2]; s.perched = true; s.h = -2.1; },
  draw: anOwl, props: (b) => b.tube([[0, 0, 0], [0, 0, AN_STUMP[2] - 0.004]], (t) => 0.05 * (1 - 0.15 * t), '#6E665C', { sides: 10 }), sh: [0.1, 0.1] });

/* ----- fourth set (owner 21 พ.ย. 2569): birds that cannot fly, the ant eaters, the animals children see at a zoo; and
   the mammals and birds put in the groups taught at school ----- */
const anScaled = (fn, k) => (b, s, C, D, x) => { b.push([0, 0, 0], null, k); fn(b, s, C, D, x); b.pop(); };
const AN_GIRAFFE_HEAD = (b, s, C, D) => {
  b.ell([0.1, 0, -0.02], [0.06, 0.04, 0.04], null, C.b, { n1: 6, n2: 8 });
  for (const sd of [1, -1]) { b.tube([[-0.03, sd * 0.025, 0.05], [-0.04, sd * 0.03, 0.11]], 0.009, C.b, { sides: 5 }); b.ball([-0.04, sd * 0.03, 0.115], 0.013, C.d); AN_EAR(b, -0.05, 0.04, 0.035, 0.06, 0.01, 0.018, C.b, 0); b.eye([0.02, sd * 0.05, 0.03], 0.013, [0.3, sd, 0.3]); }
};
const AN_LION_HEAD = (b, s, C, D, k) => { if (D.Q.mane) b.ell([-0.05, 0, -0.03], [0.14, 0.23, 0.25], null, C.m, { n1: 9, n2: 12 }); anScaled(AN_CAT_HEAD, 2.1)(b, s, C, D, k); };
const AN_BEAR_HEAD = (b, s, C, D) => {
  const panda = D.id === 'panda';
  b.ell([0.1, 0, -0.03], [0.07, 0.06, 0.05], null, panda ? C.b : C.b2, { n1: 6, n2: 8 }); b.ball([0.17, 0, -0.025], 0.02, '#1E1A18');
  for (const sd of [1, -1]) {
    b.ell([-0.03, sd * 0.09, 0.09], [0.025, 0.035, 0.035], null, panda ? C.d : C.b, { n1: 5, n2: 7 });
    if (panda) b.ell([0.06, sd * 0.055, 0.025], [0.03, 0.022, 0.035], anRx(sd * 0.5), C.d, { n1: 5, n2: 7 });
    b.eye([0.075, sd * 0.055, 0.03], 0.011, [0.6, sd, 0.3]);
  }
};
const AN_HIPPO_HEAD = (b, s, C, D, k) => {
  const gape = k.rxk === 'threat' ? k.rk * (0.6 + 0.3 * Math.sin(s.t * 3)) : 0.06 * Math.max(0, Math.sin(s.t * 0.7));
  b.ell([0.16, 0, 0.0], [0.13, 0.14, 0.08], null, C.b, { n1: 8, n2: 10 });
  b.push([0.04, 0, -0.06], anRy(0.9 * gape)); b.ell([0.14, 0, -0.01], [0.13, 0.13, 0.04], null, C.b, { n1: 7, n2: 9 });
  if (gape > 0.2) { b.ell([0.12, 0, 0.03], [0.11, 0.11, 0.015], null, '#D88A8A', { n1: 6, n2: 8 }); for (const sd of [1, -1]) b.tube([[0.24, sd * 0.08, 0.02], [0.25, sd * 0.08, 0.08]], (t) => 0.012 * (1 - 0.7 * t), '#F2EADA', { sides: 5 }); }
  b.pop();
  for (const sd of [1, -1]) { b.ball([0.28, sd * 0.05, 0.06], 0.012, C.d); b.ell([0.0, sd * 0.07, 0.11], [0.025, 0.025, 0.02], null, C.b, { n1: 5, n2: 6 }); b.eye([0.01, sd * 0.07, 0.125], 0.012, [0.3, sd, 0.8]); b.ell([-0.08, sd * 0.08, 0.12], [0.015, 0.012, 0.02], null, C.b, { n1: 4, n2: 6 }); }
};
const AN_RHINO_HEAD = (b, s, C, D) => {
  b.ell([0.12, 0, -0.03], [0.1, 0.08, 0.08], null, C.b, { n1: 7, n2: 9 });
  b.tube([[0.18, 0, 0.03], [0.22, 0, 0.13], [0.2, 0, 0.21]], (t) => 0.04 * (1 - 0.95 * t), C.h, { sides: 7 });
  b.tube([[0.09, 0, 0.06], [0.1, 0, 0.12]], (t) => 0.025 * (1 - 0.9 * t), C.h, { sides: 6 });
  for (const sd of [1, -1]) { b.eye([0.02, sd * 0.08, 0.02], 0.009, [0.3, sd, 0.3]); b.tube([[-0.07, sd * 0.05, 0.07], [-0.08, sd * 0.06, 0.13]], (t) => 0.018 * (1 - 0.7 * t), C.b, { sides: 5 }); }
};
const AN_CAMEL_HEAD = (b, s, C, D) => {
  b.ell([0.09, 0, -0.01], [0.07, 0.04, 0.045], null, C.b, { n1: 6, n2: 8 });
  for (const sd of [1, -1]) { b.eye([0.0, sd * 0.045, 0.03], 0.012, [0.3, sd, 0.3]); b.sheet([[-0.07, sd * 0.03, 0.04], [-0.08, sd * 0.05, 0.07], [-0.1, sd * 0.035, 0.04]], C.b); }
};
const AN_DEER_HEAD = (b, s, C, D) => {
  b.ell([0.09, 0, -0.025], [0.05, 0.035, 0.035], null, C.b, { n1: 6, n2: 8 }); b.ball([0.135, 0, -0.025], 0.012, '#1E1A18');
  for (const sd of [1, -1]) {
    b.eye([0.02, sd * 0.045, 0.025], 0.013, [0.3, sd, 0.3]); AN_EAR(b, -0.04, 0.04, 0.03, 0.08, 0.03, 0.025, C.b, 0);
    const a0 = [-0.04, sd * 0.025, 0.06], a1 = [-0.06, sd * 0.07, 0.17], a2 = [-0.1, sd * 0.1, 0.28];
    b.tube([a0, a1, a2], (t) => 0.012 * (1 - 0.6 * t), C.h, { sides: 5 }); b.tube([a1, anAdd(a1, [0.06, sd * 0.01, 0.06])], (t) => 0.008 * (1 - 0.7 * t), C.h, { sides: 4 }); b.tube([anLerp(a1, a2, 0.6), anAdd(anLerp(a1, a2, 0.6), [0.04, sd * 0.03, 0.07])], (t) => 0.007 * (1 - 0.7 * t), C.h, { sides: 4 });
  }
};
const AN_SNOUT_HEAD = (len, r) => (b, s, C, D, k) => {
  b.tube([[0.03, 0, -0.005], [0.03 + len * 0.6, 0, -0.012], [0.03 + len, 0, -0.03]], (t) => r * (1 - 0.7 * t), C.b, { sides: 7 });
  if (D.id === 'anteater' && D.Q.down && s.act === D.Q.down && Math.sin(s.t * 8) > 0) b.line([[0.03 + len, 0, -0.03], [0.05 + len * 1.3, 0, -0.06]], '#C85A6A', 0.004);
  for (const sd of [1, -1]) { b.eye([0.01, sd * D.Q.hr[1] * 0.8, 0.012], 0.007, [0.3, sd, 0.3]); b.ell([-0.03, sd * D.Q.hr[1] * 0.85, 0.02], [0.01, 0.006, 0.012], null, C.b, { n1: 4, n2: 5 }); }
};
const AN_PRIMATE_HEAD = (b, s, C, D) => {
  const big = D.id === 'orangutan';
  b.ell([0.05, 0, -0.01], [0.04, 0.06, 0.06], null, C.f, { n1: 6, n2: 8 });
  if (big) for (const sd of [1, -1]) b.ell([0.03, sd * 0.07, -0.0], [0.02, 0.04, 0.05], null, C.f, { n1: 5, n2: 7 });
  b.ell([0.085, 0, -0.03], [0.025, 0.035, 0.022], null, C.f, { n1: 5, n2: 7 });
  for (const sd of [1, -1]) { b.eye([0.08, sd * 0.022, 0.012], 0.01, [1, sd * 0.2, 0.1]); b.ell([0.0, sd * 0.075, 0.01], [0.012, 0.012, 0.018], null, C.f, { n1: 4, n2: 6 }); }
};
const anTailBushy = (b, s, C, D, T0) => { const q = []; for (let i = 0; i <= 6; i++) { const u = i / 6; q.push(anAdd(T0, [-0.3 * u, Math.sin(s.t * 0.9) * 0.05 * u, -0.05 * u + 0.04 * Math.sin(Math.PI * u)])); } b.tube(q, (t) => [0.03 * (0.6 + 0.8 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1))), 0.08 * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05))], C.b, { sides: 8 }); };
const anTailScaly = (b, s, C, D, T0) => { const q = []; for (let i = 0; i <= 8; i++) { const u = i / 8; q.push(anAdd(T0, [-0.35 * u, Math.sin(s.t * 0.8 + u * 2) * 0.04 * u, -T0[2] * Math.min(1, u * 1.6) + 0.02 * (1 - u)])); } b.tube(q, (t) => 0.05 * (1 - 0.85 * t), D.Q.coat ? (t, a) => (Math.sin(t * 40) > 0.3 ? C.d : C.b) : C.b, { sides: 8 }); };
const anTailNone = () => {};
const anSpines = (n, len) => (b, s, C, D, body, M) => { const Q = D.Q, up = s.rx ? 1 + 0.4 * s.rk : 1; for (let i = 0; i < n; i++) { const u = (i * 0.618) % 1, v = (i * 0.37) % 1, a = (u - 0.5) * 2.4, th = 0.4 + v * 1.5; const p = body([Q.bx * 0.85 * Math.cos(th) * Math.sign(a || 1) * 0, Math.sin(a) * Q.by, Q.zh]); const o = body([Math.cos(a * 1.3) * Q.bx * (u * 1.6 - 0.8), Math.sin(a) * Q.by * 0.9, Q.zh + Q.bz * Math.cos(a) * 0.9]), d = anUnit([o[0] * 0.3 - 0.4, (o[1] - p[1]) * 3, 1]); b.line([o, anAdd(o, anMul(d, len * up))], i % 3 ? '#E8DCC0' : '#2A221C', 0.004); } };
const AN_QBIG = (o) => Object.assign({}, AN_QCOW, { head: AN_COW_HEAD, tail: (b, s, C, D, T0) => anTailHang(b, s, T0, 0.3, 0.018, C.b, C.d, 0) }, o);
const AN_STRIPES = (u, C) => (u[2] < -0.5 ? C.b2 : Math.sin(u[0] * 26 + u[2] * 4) > 0.1 ? C.d : C.b);

anDef('giraffe', { th: 'ยีราฟ', en: 'giraffe', fact: 'สัตว์ที่สูงที่สุด คอยาวแต่มีกระดูกคอเจ็ดชิ้นเท่าคน', hint: 'เดินช้า ๆ ยืดคอกินใบไม้บนยอดไม้ ก้มดื่มน้ำ แตะแล้ววิ่งหนี', kw: 'สวนสัตว์ แอฟริกา คอยาว', go: 'walk', spd: 0.14, fast: 0.45, stride: 0.45, turn: 1, roam: 0.2, R: 1.45, tz: 0.85, react: 'flee', fleeLen: 0.5,
  loop: [['go', 6], ['browse', 6], ['go', 5], ['graze', 4]], acts: { browse: 'ยืดคอกินใบไม้บนยอดไม้', graze: 'ก้มดื่มน้ำ' }, C: { b: '#E0B060', b2: '#F2E2B8', d: '#7A4A22', s: '#8A5428' },
  Q: AN_QBIG({ bx: 0.32, by: 0.15, bz: 0.17, zh: 0.95, fx: 0.2, hx: -0.22, hy: 0.09, fy: 0.09, fz: 0.95, hz: 0.9, l1: 0.5, l2: 0.5, lr: 0.04, lr2: 0.025, hoof: 0.03, step: 0.15, sx: 0.28, sz: 1.08, nl: 0.75, nr: 0.06, na: 1.15, naD: -0.45, ha: 1.4, haD: 1.6, hr: [0.12, 0.055, 0.06],
    coat: (u, C) => (u[2] < -0.5 ? C.b2 : Math.sin(u[0] * 14) * Math.sin(u[1] * 12 + u[2] * 9) > 0.15 ? C.s : C.b), head: AN_GIRAFFE_HEAD, tail: (b, s, C, D, T0) => anTailHang(b, s, T0, 0.45, 0.015, C.b, C.d, 0) }), draw: anQuad,
  tick: (s, dt, act) => { if (act === 'browse') AN.giraffe.Q.na = 1.15 + 0.2 * anBell(s.ap, 0.2); else AN.giraffe.Q.na = 1.15; return false; },
  props: (b) => { b.tube([[0.45, 0.3, 0], [0.46, 0.3, 0.9], [0.44, 0.31, 1.5]], (t) => 0.05 * (1 - 0.5 * t), '#7A5A3A', { sides: 7 }); b.ell([0.42, 0.3, 1.62], [0.25, 0.22, 0.14], null, '#5E9E3A', { n1: 7, n2: 9 }); }, sh: [0.45, 0.2] });
anDef('zebra', { th: 'ม้าลาย', en: 'zebra', fact: 'ลายของแต่ละตัวไม่ซ้ำกัน ลายช่วยให้สับสนเมื่อวิ่งเป็นฝูง', hint: 'เดินเล็มหญ้า สะบัดหาง แตะแล้วควบหนี', kw: 'สวนสัตว์ แอฟริกา กีบคี่', go: 'walk', spd: 0.16, fast: 0.6, stride: 0.4, turn: 1.4, roam: 0.22, R: 0.95, tz: 0.4, react: 'flee', fleeLen: 0.55,
  loop: [['go', 6], ['graze', 5], ['look', 2.5], ['go', 5]], acts: { graze: 'ก้มเล็มหญ้า', flee: 'ตกใจ ควบหนี' }, C: { b: '#F2EEE6', b2: '#F2EEE6', d: '#1E1E22', m: '#1E1E22' },
  Q: Object.assign({}, AN.horse.Q, { coat: AN_STRIPES, legCol: (C) => '#D8D4CC' }), draw: anQuad, props: anGrassField, sh: [0.45, 0.18] });
anDef('lion', { th: 'สิงโต', en: 'lion', fact: 'สัตว์กินเนื้อที่อยู่เป็นฝูง ตัวผู้มีแผงคอ ตัวเมียเป็นผู้ล่าหลัก', hint: 'เดินช้า ๆ นอนพัก แตะแล้วคำรามขู่ แล้วเดินหนี', kw: 'สวนสัตว์ สัตว์กินเนื้อ แผงคอ', go: 'walk', spd: 0.14, fast: 0.4, stride: 0.38, turn: 1.6, roam: 0.2, R: 0.9, tz: 0.32, react: 'threat', fleeLen: 0.35,
  loop: [['go', 5], ['sit', 6], ['look', 2.5], ['go', 4]], acts: { sit: 'นั่งพัก', threat: 'คำรามขู่ แล้วเดินหนี' }, C: { b: '#C8964E', b2: '#E6CC9A', d: '#C98A8A', m: '#6A3E1A' },
  Q: Object.assign({}, AN.cat.Q, { bx: 0.42, by: 0.15, bz: 0.16, zh: 0.5, fx: 0.28, hx: -0.28, hy: 0.09, fy: 0.09, fz: 0.5, hz: 0.52, l1: 0.28, l2: 0.28, lr: 0.06, lr2: 0.04, hoof: 0.04, step: 0.13, lift: 0.07, sx: 0.38, sz: 0.58, nl: 0.12, nr: 0.11, na: 0.4, naD: 0.0, ha: 0.1, haD: 0.5, hr: [0.14, 0.13, 0.12], arch: false, mane: true, head: AN_LION_HEAD, tail: (b, s, C, D, T0) => anTailHang(b, s, T0, 0.5, 0.02, C.b, C.m, 0.2) }), draw: anQuad, sh: [0.48, 0.18] });
anDef('tiger', { th: 'เสือโคร่ง', en: 'tiger', fact: 'แมวใหญ่ที่สุด ลายบนตัวไม่ซ้ำกัน ชอบอยู่ตัวเดียว ว่ายน้ำเก่ง', hint: 'เดินย่องลาดตระเวน นั่งพัก แตะแล้วขู่ แล้วเดินหนี', kw: 'สวนสัตว์ เสือ สัตว์กินเนื้อ ลาย', go: 'walk', spd: 0.15, fast: 0.45, stride: 0.38, turn: 1.6, roam: 0.2, R: 0.9, tz: 0.32, react: 'threat', fleeLen: 0.35,
  loop: [['go', 6], ['sit', 5], ['go', 4], ['look', 2.4]], acts: { go: 'เดินย่อง', sit: 'นั่งพัก', threat: 'ขู่ แล้วเดินหนี' }, C: { b: '#D8822E', b2: '#F2E6D0', d: '#1E1A18' },
  Q: Object.assign({}, AN.lion.Q, { mane: false, coat: AN_STRIPES }), draw: anQuad, sh: [0.48, 0.18] });
anDef('bear', { th: 'หมี', en: 'sun bear', fact: 'หมีหมา หมีที่เล็กที่สุด มีลายรูปเกือกม้าที่อก ลิ้นยาวกินน้ำผึ้งและแมลง', hint: 'เดินต้วมเตี้ยม ดมกลิ่นหาอาหาร ลุกยืนสองขา แตะแล้วยืนขู่ แล้วเดินหนี', kw: 'หมีหมา หมีควาย สวนสัตว์ สัตว์กินเนื้อ', go: 'walk', spd: 0.1, fast: 0.35, stride: 0.26, turn: 1.6, roam: 0.18, R: 0.75, tz: 0.25, react: 'threat', fleeLen: 0.3,
  loop: [['go', 5], ['sniff', 4], ['sit', 4], ['go', 4]], acts: { sniff: 'ดมกลิ่นหาอาหาร', sit: 'นั่งพัก', threat: 'ยืนขู่ แล้วเดินหนี' }, C: { b: '#2A2420', b2: '#C8A06A', d: '#1A1614' },
  Q: Object.assign({}, AN.dog.Q, { bx: 0.3, by: 0.16, bz: 0.15, zh: 0.36, fx: 0.2, hx: -0.2, hy: 0.09, fy: 0.09, fz: 0.36, hz: 0.37, l1: 0.19, l2: 0.19, lr: 0.06, lr2: 0.05, hoof: 0.04, step: 0.09, sx: 0.28, sz: 0.42, nl: 0.06, nr: 0.1, na: 0.3, naD: -0.6, ha: 0.25, haD: 1.1, hr: [0.11, 0.1, 0.1], arch: true, head: AN_BEAR_HEAD, tail: anTailNone,
    coat: (u, C) => (u[0] > 0.55 && u[2] < 0.1 && u[2] > -0.5 && Math.abs(u[1]) < 0.6 ? C.b2 : C.b) }), draw: anQuad, sh: [0.35, 0.18] });
anDef('panda', { th: 'หมีแพนด้า', en: 'giant panda', fact: 'จัดเป็นสัตว์กินเนื้อ แต่กินไผ่เป็นอาหารหลัก มีนิ้วเทียมช่วยจับไผ่', hint: 'เดินต้วมเตี้ยม นั่งกินไผ่ แตะแล้วเดินหนีช้า ๆ', kw: 'แพนด้า สวนสัตว์ จีน ไผ่', go: 'walk', spd: 0.08, fast: 0.25, stride: 0.26, turn: 1.4, roam: 0.16, R: 0.75, tz: 0.25, react: 'flee', fleeLen: 0.3,
  loop: [['sit', 7], ['go', 4], ['sniff', 3]], acts: { sit: 'นั่งกินไผ่', sniff: 'ดมกลิ่น', flee: 'เดินหนีช้า ๆ' }, C: { b: '#F2F0EA', b2: '#F2F0EA', d: '#1E1E20' },
  Q: Object.assign({}, AN.bear.Q, { arch: false, legCol: (C) => C.d, coat: (u, C) => (u[0] > 0.1 && u[0] < 0.6 && u[2] > -0.6 ? C.d : C.b) }), draw: anQuad,
  props: (b) => { for (let i = 0; i < 3; i++) b.tube([[0.35 + i * 0.05, -0.25, 0], [0.36 + i * 0.05, -0.25, 0.6 + i * 0.1]], 0.012, '#7AA04A', { sides: 5, cap: false }); }, sh: [0.35, 0.18] });
anDef('hippo', { th: 'ฮิปโปโปเตมัส', en: 'hippopotamus', fact: 'อยู่ในน้ำเกือบทั้งวัน กินพืช อ้าปากกว้างเพื่อขู่ ญาติใกล้ชิดของวาฬ', hint: 'เดินช้า ๆ อ้าปากหาว แตะแล้วอ้าปากกว้างขู่ แล้วเดินหนี', kw: 'ฮิปโป สวนสัตว์ หมูเด้ง แอฟริกา', go: 'walk', spd: 0.08, fast: 0.3, stride: 0.3, turn: 1.2, roam: 0.18, R: 0.95, tz: 0.25, react: 'threat', fleeLen: 0.35,
  loop: [['go', 5], ['graze', 4], ['look', 3]], acts: { graze: 'ก้มกินหญ้า', look: 'อ้าปากหาว', threat: 'อ้าปากกว้างขู่ แล้วเดินหนี' }, C: { b: '#7A6E78', b2: '#C8A8A8', d: '#3E3640' },
  Q: AN_QBIG({ bx: 0.42, by: 0.24, bz: 0.22, zh: 0.38, fx: 0.26, hx: -0.28, hy: 0.14, fy: 0.15, fz: 0.36, hz: 0.38, l1: 0.18, l2: 0.18, lr: 0.08, lr2: 0.07, hoof: 0.05, step: 0.08, sx: 0.4, sz: 0.44, nl: 0.06, nr: 0.17, na: 0.0, naD: -0.5, ha: 0.1, haD: 0.7, hr: [0.14, 0.13, 0.12], head: AN_HIPPO_HEAD, tail: (b, s, C, D, T0) => anTailHang(b, s, T0, 0.1, 0.02, C.b, null, 0) }), draw: anQuad, ground: anPond, sh: [0.5, 0.28] });
anDef('rhino', { th: 'แรด', en: 'rhinoceros', fact: 'นอแรดทำจากเคราติน สารเดียวกับเส้นผมและเล็บ ไม่ใช่กระดูก', hint: 'เดินช้า ๆ ก้มเล็มหญ้า แตะแล้วก้มหัวพุ่งชน แล้ววิ่งหนี', kw: 'สวนสัตว์ นอ กีบคี่', go: 'walk', spd: 0.1, fast: 0.45, stride: 0.32, turn: 1.2, roam: 0.18, R: 0.95, tz: 0.3, react: 'flee', fleeLen: 0.45,
  loop: [['go', 5], ['graze', 5], ['look', 2.5]], acts: { graze: 'ก้มเล็มหญ้า', flee: 'ก้มหัว วิ่งพุ่ง' }, C: { b: '#8A8680', b2: '#9A9690', d: '#4A4642', h: '#C8BCA8' },
  Q: AN_QBIG({ bx: 0.42, by: 0.2, bz: 0.21, zh: 0.48, fx: 0.27, hx: -0.28, hy: 0.12, fy: 0.13, fz: 0.46, hz: 0.48, l1: 0.24, l2: 0.24, lr: 0.07, lr2: 0.06, hoof: 0.05, step: 0.1, sx: 0.4, sz: 0.52, nl: 0.08, nr: 0.15, na: 0.0, naD: -0.7, ha: 0.4, haD: 1.0, hr: [0.16, 0.1, 0.1], head: AN_RHINO_HEAD }), draw: anQuad, props: anGrassField, sh: [0.48, 0.22] });
anDef('camel', { th: 'อูฐ', en: 'camel', fact: 'โหนกสะสมไขมันไม่ใช่น้ำ ขนตายาวกันทราย ทนแล้งได้นาน', hint: 'เดินโยกตัวช้า ๆ เคี้ยวอาหาร แตะแล้วร้องแล้วเดินหนี', kw: 'สวนสัตว์ ทะเลทราย โหนก เคี้ยวเอื้อง', go: 'walk', spd: 0.14, fast: 0.4, stride: 0.45, turn: 1.2, roam: 0.2, R: 1.15, tz: 0.55, react: 'flee', fleeLen: 0.45,
  loop: [['go', 6], ['graze', 4], ['look', 3]], acts: { go: 'เดินโยกตัว', graze: 'ก้มกินพืช', flee: 'ร้อง แล้วเดินหนี' }, C: { b: '#C89A62', b2: '#D8B482', d: '#5A4632' },
  Q: AN_QBIG({ bx: 0.36, by: 0.15, bz: 0.17, zh: 0.82, fx: 0.24, hx: -0.24, hy: 0.09, fy: 0.09, fz: 0.8, hz: 0.82, l1: 0.43, l2: 0.43, lr: 0.045, lr2: 0.03, hoof: 0.04, step: 0.15, sx: 0.32, sz: 0.86, nl: 0.45, nr: 0.06, na: 0.15, naD: -1.2, ha: -0.2, haD: 1.4, hr: [0.11, 0.05, 0.055], head: AN_CAMEL_HEAD,
    extra: (b, s, C, D, body, M) => b.ell(body([0.0, 0, D.Q.zh + D.Q.bz * 0.9]), [0.13, 0.1, 0.12], M, C.b, { n1: 7, n2: 9 }) }), draw: anQuad, sh: [0.42, 0.18] });
anDef('deer', { th: 'กวาง', en: 'deer', fact: 'เขากวางเป็นกระดูก ผลัดทิ้งและงอกใหม่ทุกปี มีเฉพาะตัวผู้', hint: 'เดินเล็มหญ้า เงยหน้าฟัง แตะแล้วกระโจนหนี', kw: 'กวางป่า สวนสัตว์ เขา เคี้ยวเอื้อง', go: 'walk', spd: 0.14, fast: 0.6, stride: 0.32, turn: 1.8, roam: 0.2, R: 0.85, tz: 0.4, react: 'flee', fleeLen: 0.55,
  loop: [['go', 5], ['graze', 5], ['look', 3]], acts: { graze: 'ก้มเล็มหญ้า', look: 'เงยหน้าฟังเสียง', flee: 'กระโจนหนี' }, C: { b: '#A06A3E', b2: '#E6D2B4', d: '#2E2420', h: '#C8B48E' },
  Q: AN_QBIG({ bx: 0.3, by: 0.11, bz: 0.13, zh: 0.5, fx: 0.2, hx: -0.2, hy: 0.065, fy: 0.065, fz: 0.49, hz: 0.5, l1: 0.27, l2: 0.27, lr: 0.03, lr2: 0.018, hoof: 0.02, step: 0.11, sx: 0.28, sz: 0.58, nl: 0.25, nr: 0.05, na: 0.9, naD: -0.95, ha: 1.0, haD: 1.75, hr: [0.09, 0.045, 0.05], head: AN_DEER_HEAD, tail: anTailUpShort }), draw: anQuad, props: anGrassField, sh: [0.32, 0.12] });
anDef('monkey', { th: 'ลิง', en: 'macaque', fact: 'ไพรเมต มีนิ้วโป้งหยิบจับของได้ ตามองไปข้างหน้ากะระยะได้ดี', hint: 'ลิงแสม เดินสี่ขา นั่งหาเหาเกาตัว แตะแล้วแยกเขี้ยวขู่ แล้ววิ่งหนี', kw: 'ลิงแสม ไพรเมต สวนสัตว์', go: 'walk', spd: 0.14, fast: 0.5, stride: 0.2, turn: 2.5, roam: 0.18, R: 0.55, tz: 0.18, react: 'threat', fleeLen: 0.4,
  loop: [['go', 4], ['sit', 6], ['look', 2]], acts: { go: 'เดินสี่ขา', sit: 'นั่งเกาตัว', threat: 'แยกเขี้ยวขู่ แล้ววิ่งหนี' }, C: { b: '#8A7454', b2: '#B8A27E', d: '#5A4A36', f: '#D8A890' },
  Q: { bx: 0.17, by: 0.08, bz: 0.09, zh: 0.25, fx: 0.11, hx: -0.12, hy: 0.06, fy: 0.06, fz: 0.27, hz: 0.24, l1: 0.13, l2: 0.13, fl: 1.1, lr: 0.025, lr2: 0.018, hoof: 0.018, step: 0.07, lift: 0.04, sx: 0.15, sz: 0.31, nl: 0.04, nr: 0.05, na: 0.6, naD: 0.2, ha: 0.0, haD: 0.5, hr: [0.06, 0.055, 0.06], tl: 0.3, tr: 0.012, head: AN_PRIMATE_HEAD, tail: anTailUp }, draw: anQuad, sh: [0.2, 0.1] });
anDef('orangutan', { th: 'อุรังอุตัง', en: 'orangutan', fact: 'ลิงใหญ่ไม่มีหาง แขนยาวกว่าขา ใช้เครื่องมือได้ ใกล้เคียงกับคน', hint: 'เดินช้า ๆ ด้วยแขนยาว นั่งนิ่งคิด แตะแล้วเดินหนี', kw: 'ลิงใหญ่ ไพรเมต สวนสัตว์ ไม่มีหาง', go: 'walk', spd: 0.07, fast: 0.25, stride: 0.3, turn: 1.4, roam: 0.16, R: 0.75, tz: 0.3, react: 'flee', fleeLen: 0.3,
  loop: [['sit', 6], ['go', 4], ['look', 3]], acts: { go: 'เดินด้วยแขนยาว', sit: 'นั่งนิ่ง', flee: 'เดินหนี' }, C: { b: '#B05A2A', b2: '#C8703A', d: '#4A2A1A', f: '#6A4A3A' },
  Q: { bx: 0.24, by: 0.14, bz: 0.15, zh: 0.36, fx: 0.15, hx: -0.15, hy: 0.1, fy: 0.12, fz: 0.42, hz: 0.32, l1: 0.15, l2: 0.15, fl: 1.55, lr: 0.05, lr2: 0.035, hoof: 0.03, step: 0.08, lift: 0.04, sx: 0.22, sz: 0.48, nl: 0.04, nr: 0.08, na: 0.6, naD: 0.2, ha: 0.0, haD: 0.4, hr: [0.08, 0.08, 0.085], head: AN_PRIMATE_HEAD, tail: anTailNone }, draw: anQuad, sh: [0.3, 0.16] });
anDef('anteater', { th: 'ตัวกินมด', en: 'giant anteater', fact: 'ไม่มีฟัน ใช้ลิ้นยาวเหนียวเลียมดและปลวก เล็บหน้ายาวขุดรัง', hint: 'เดินดมพื้น ยื่นลิ้นยาวเลียมด หางพวงใหญ่ แตะแล้วยืนขู่ แล้วเดินหนี', kw: 'ตัวกินมดยักษ์ กินมด ปลวก ไม่มีฟัน', go: 'walk', spd: 0.1, fast: 0.35, stride: 0.26, turn: 1.6, roam: 0.18, R: 0.75, tz: 0.2, react: 'threat', fleeLen: 0.3,
  loop: [['go', 4], ['sniff', 5], ['go', 4]], acts: { go: 'เดินดมพื้น', sniff: 'ยื่นลิ้นเลียมดและปลวก', threat: 'ยืนขู่ แล้วเดินหนี' }, C: { b: '#6A5848', b2: '#C8B898', d: '#2A2220' },
  Q: Object.assign({}, AN.dog.Q, { bx: 0.3, by: 0.12, bz: 0.14, zh: 0.34, fx: 0.2, hx: -0.2, hy: 0.07, fy: 0.07, fz: 0.34, hz: 0.35, l1: 0.18, l2: 0.18, lr: 0.045, lr2: 0.035, hoof: 0.03, sx: 0.27, sz: 0.36, nl: 0.1, nr: 0.06, na: 0.0, naD: -0.7, ha: 0.3, haD: 1.0, hr: [0.06, 0.045, 0.045], arch: true, head: AN_SNOUT_HEAD(0.22, 0.03), tail: anTailBushy,
    coat: (u, C) => (u[0] > 0.2 && u[2] > -0.1 && Math.abs(u[1] + u[2] * 0.4 - 0.2) < 0.2 ? C.d : u[2] < -0.5 ? C.b2 : C.b) }), draw: anQuad, sh: [0.4, 0.15] });
anDef('pangolin', { th: 'ตัวนิ่ม', en: 'pangolin', fact: 'ตัวลิ่น มีเกล็ดแข็งทั้งตัวทั้งที่เป็นสัตว์เลี้ยงลูกด้วยน้ำนม กินมดและปลวก ม้วนตัวเป็นก้อนเมื่อมีภัย', hint: 'เดินช้า ๆ ดมหามดและปลวก แตะแล้วม้วนตัวเป็นก้อนเกล็ด', kw: 'ตัวลิ่น นิ่ม เกล็ด กินมด ปลวก', go: 'walk', spd: 0.06, fast: 0.06, stride: 0.15, turn: 1.4, roam: 0.14, R: 0.55, tz: 0.1, react: 'hide',
  loop: [['go', 5], ['sniff', 4]], acts: { go: 'เดินช้า ๆ', sniff: 'ดมหามดและปลวก', hide: 'ม้วนตัวเป็นก้อนเกล็ด' }, C: { b: '#8A6E4E', b2: '#C8AA82', d: '#5A4632' },
  Q: Object.assign({}, AN.dog.Q, { bx: 0.18, by: 0.08, bz: 0.08, zh: 0.12, fx: 0.11, hx: -0.11, hy: 0.05, fy: 0.06, fz: 0.11, hz: 0.12, l1: 0.06, l2: 0.06, lr: 0.025, lr2: 0.02, hoof: 0.02, step: 0.04, lift: 0.02, sx: 0.16, sz: 0.13, nl: 0.04, nr: 0.04, na: -0.1, naD: -0.4, ha: 0.2, haD: 0.6, hr: [0.045, 0.035, 0.035], ball: true, head: AN_SNOUT_HEAD(0.06, 0.025), tail: anTailScaly,
    coat: (u, C) => (Math.sin(u[0] * 22) > 0.2 || Math.sin(Math.atan2(u[2], u[1]) * 9) > 0.6 ? C.d : C.b) }), draw: anQuad, sh: [0.22, 0.1] });
anDef('echidna', { th: 'ตัวกินมดหนาม', en: 'echidna', fact: 'สัตว์เลี้ยงลูกด้วยน้ำนมที่ออกลูกเป็นไข่ มีหนามทั้งตัว ใช้จมูกยาวและลิ้นจับมด', hint: 'เดินต้วมเตี้ยม จมูกยาวดุนหามด แตะแล้วม้วนตัวเป็นก้อนหนาม', kw: 'อีคิดนา โมโนทรีม ออกลูกเป็นไข่ หนาม กินมด', go: 'walk', spd: 0.05, fast: 0.05, stride: 0.12, turn: 1.4, roam: 0.12, R: 0.42, tz: 0.08, react: 'hide',
  loop: [['go', 5], ['sniff', 4]], acts: { go: 'เดินต้วมเตี้ยม', sniff: 'ใช้จมูกดุนหามด', hide: 'ม้วนตัวเป็นก้อนหนาม' }, C: { b: '#5A4636', b2: '#7A6450', d: '#2E241C' },
  Q: Object.assign({}, AN.pangolin.Q, { bx: 0.13, by: 0.09, bz: 0.08, zh: 0.1, fx: 0.08, hx: -0.08, hy: 0.06, fy: 0.08, fz: 0.09, hz: 0.1, l1: 0.05, l2: 0.05, sx: 0.12, sz: 0.11, coat: null, spines: true, head: AN_SNOUT_HEAD(0.08, 0.016), tail: anTailNone, extra: anSpines(70, 0.05) }), draw: anQuad, sh: [0.16, 0.1] });
/* a seal hauls itself along on its belly, front flippers pushing; it lifts its head to look; touched, it scoots away */
function anSeal(b, s, C, D) {
  const mv = Math.min(1.4, s.mv), n = 10, pts = [], gal = Math.sin(s.ph) * 0.03 * mv, look = s.act === 'look' ? anBell(s.ap, 0.2) : 0;
  for (let i = 0; i <= n; i++) { const u = i / n, lift = (u < 0.3 ? (0.3 - u) / 0.3 : 0) * (0.06 + 0.12 * look); pts.push([0.3 - 0.62 * u, 0, 0.07 + lift + gal * Math.sin(u * 3.14 + s.ph) - 0.03 * u]); }
  b.tube(pts, (t) => { const r = 0.075 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.12)), 0.6) * (t > 0.8 ? 1 - (t - 0.8) * 2.5 : 1); return [r * 1.05, r]; }, (t, a) => (Math.sin(a) < -0.3 ? C.b2 : Math.sin(t * 40) * Math.cos(a * 5) > 0.6 ? C.d : C.b), { sides: 10 });
  const H = pts[0];
  for (const sd of [1, -1]) { b.eye(anAdd(H, [0.0, sd * 0.035, 0.02]), 0.012, [0.5, sd, 0.3]); for (const dz of [-0.005, 0.005]) b.line([anAdd(H, [0.04, sd * 0.012, -0.01 + dz]), anAdd(H, [0.06, sd * 0.06, -0.012 + dz * 3])], 'rgba(60,60,70,0.55)', 0.002); }
  b.ball(anAdd(H, [0.06, 0, -0.005]), 0.009, '#1E1A18');
  for (const sd of [1, -1]) { const p = pts[3], f = 0.3 * Math.sin(s.ph + (sd > 0 ? 0 : 3)) * mv; b.sheet([anAdd(p, [0.02, sd * 0.06, -0.04]), anAdd(p, [-0.03 + f * 0.05, sd * 0.11, -0.065]), anAdd(p, [-0.05, sd * 0.07, -0.05])], C.d); }
  const T = pts[n]; for (const sd of [1, -1]) b.sheet([T, anAdd(T, [-0.08, sd * 0.06, 0.0]), anAdd(T, [-0.07, sd * 0.01, -0.01])], C.d);
}
anDef('seal', { th: 'แมวน้ำ', en: 'seal', fact: 'สัตว์กินเนื้อที่อยู่ในน้ำ มีไขมันหนาใต้ผิวหนังกันหนาว ใช้ครีบว่ายน้ำ', hint: 'คืบด้วยท้องบนบก เงยหน้ามอง แตะแล้วคืบหนีเร็ว ๆ', kw: 'สิงโตทะเล สวนสัตว์ สัตว์ทะเล', go: 'walk', spd: 0.07, fast: 0.25, stride: 0.2, turn: 1.4, roam: 0.18, R: 0.6, tz: 0.1, react: 'flee', fleeLen: 0.3,
  loop: [['go', 4], ['look', 3], ['rest', 3]], acts: { go: 'คืบด้วยท้อง', look: 'เงยหน้ามอง', rest: 'นอนพัก', flee: 'คืบหนีเร็ว ๆ' }, C: { b: '#7E8690', b2: '#C8CCD0', d: '#4A5058' }, draw: anSeal, ground: anPond, sh: [0.3, 0.1] });
/* birds that cannot fly: big body, small wings, long strong legs; the kiwi is small with a long thin beak */
const AN_QOST = Object.assign({}, AN_QHEN, { zb: 0.95, br: [0.33, 0.24, 0.24], k: 2.8, ws: 0.3, step: 0.2, lift: 0.12, nx: 0.12, nz: 0.48, nr: 0.035, hr: [0.06, 0.045, 0.05], pr: 5, bob: false,
  head: (b, s, C) => { b.ell([0.07, 0, -0.01], [0.04, 0.03, 0.012], null, '#D8B8A0', { n1: 5, n2: 7 }); },
  tail: (b, s, C) => { for (let i = -2; i <= 2; i++) b.sheet([[-0.28, i * 0.04, 0.05], [-0.42, i * 0.07, 0.12 - Math.abs(i) * 0.02], [-0.36, i * 0.05, 0.0]], C.w); } });
anDef('ostrich', { th: 'นกกระจอกเทศ', en: 'ostrich', fact: 'นกที่ใหญ่ที่สุดและวิ่งเร็วที่สุด บินไม่ได้ ไข่ใหญ่ที่สุด', hint: 'เดินก้าวยาว ก้มจิกหาอาหาร แตะแล้ววิ่งหนีเร็วมาก', kw: 'นกบินไม่ได้ แอฟริกา สวนสัตว์', go: 'walk', spd: 0.2, fast: 0.8, stride: 0.5, turn: 1.8, roam: 0.22, R: 1.3, tz: 0.65, react: 'flee', fleeLen: 0.6,
  loop: [['go', 4], ['peck', 3.5], ['look', 2], ['go', 3]], acts: { go: 'เดินก้าวยาว', peck: 'ก้มจิกหาอาหาร', flee: 'วิ่งหนีเร็วมาก' }, C: { b: '#2A2624', b2: '#3A3430', w: '#F2EEE6', f: '#C8A8A0', n: '#D8B8A8', t: '#F2EEE6' },
  Q: AN_QOST, draw: anBird, props: anGrassField, sh: [0.4, 0.22] });
anDef('emu', { th: 'นกอีมู', en: 'emu', fact: 'นกบินไม่ได้ของออสเตรเลีย ตัวผู้เป็นผู้ฟักไข่และเลี้ยงลูก', hint: 'เดินจิกกิน ขนฟูสีน้ำตาล แตะแล้ววิ่งหนี', kw: 'นกบินไม่ได้ ออสเตรเลีย สวนสัตว์', go: 'walk', spd: 0.18, fast: 0.7, stride: 0.45, turn: 1.8, roam: 0.22, R: 1.15, tz: 0.55, react: 'flee', fleeLen: 0.55,
  loop: [['go', 4], ['peck', 4], ['look', 2]], acts: { go: 'เดินก้าวยาว', peck: 'ก้มจิกหาอาหาร', flee: 'วิ่งหนี' }, C: { b: '#6A5640', b2: '#7A6650', w: '#6A5640', f: '#5A5048', n: '#7A8AA0', t: '#6A5640' },
  Q: Object.assign({}, AN_QOST, { zb: 0.8, br: [0.28, 0.2, 0.22], k: 2.4, nz: 0.38, tail: (b, s, C) => b.ell([-0.24, 0, -0.02], [0.08, 0.15, 0.12], null, C.b, { n1: 6, n2: 8 }) }), draw: anBird, props: anGrassField, sh: [0.35, 0.2] });
anDef('cassowary', { th: 'นกคาสโซวารี', en: 'cassowary', fact: 'นกบินไม่ได้ มีหงอนแข็งบนหัว เล็บเท้ายาวคมมาก', hint: 'เดินหาผลไม้ หงอนแข็งบนหัว คอสีฟ้า แตะแล้วยืดตัวขู่ แล้ววิ่งหนี', kw: 'นกบินไม่ได้ เทา ภาคใต้ สวนสัตว์', go: 'walk', spd: 0.16, fast: 0.6, stride: 0.45, turn: 1.8, roam: 0.22, R: 1.15, tz: 0.55, react: 'threat', fleeLen: 0.5,
  loop: [['go', 4], ['peck', 4], ['look', 2]], acts: { go: 'เดินหาผลไม้', peck: 'ก้มเก็บผลไม้', threat: 'ยืดตัวขู่ แล้ววิ่งหนี' }, C: { b: '#1E1C1C', b2: '#2A2626', w: '#1E1C1C', f: '#5A5048', n: '#3A7AC8', c: '#C83A2E', t: '#1E1C1C' },
  Q: Object.assign({}, AN_QOST, { zb: 0.85, br: [0.3, 0.22, 0.24], k: 2.5, nz: 0.36,
    head: (b, s, C) => { b.ell([0.07, 0, -0.01], [0.04, 0.025, 0.012], null, '#3A3430', { n1: 5, n2: 7 }); b.ell([0.0, 0, 0.07], [0.05, 0.015, 0.06], anRy(-0.4), '#8A6A3A', { n1: 6, n2: 8 }); b.ell([0.02, 0, -0.08], [0.015, 0.02, 0.04], null, C.c, { n1: 4, n2: 6 }); },
    tail: (b, s, C) => b.ell([-0.26, 0, -0.04], [0.08, 0.16, 0.14], null, C.b, { n1: 6, n2: 8 }) }), draw: anBird, sh: [0.35, 0.2] });
anDef('kiwi', { th: 'นกกีวี', en: 'kiwi', fact: 'นกบินไม่ได้ของนิวซีแลนด์ รูจมูกอยู่ปลายจะงอยปาก หากินกลางคืนด้วยกลิ่น', hint: 'เดินต้วมเตี้ยม ใช้ปากยาวจิ้มหาไส้เดือนในดิน แตะแล้ววิ่งหนี', kw: 'นกบินไม่ได้ นิวซีแลนด์', go: 'walk', spd: 0.08, fast: 0.35, stride: 0.12, turn: 2.4, roam: 0.14, R: 0.32, tz: 0.1, react: 'flee', fleeLen: 0.3,
  loop: [['go', 3], ['peck', 4], ['look', 2]], acts: { go: 'เดินต้วมเตี้ยม', peck: 'ใช้ปากจิ้มหาไส้เดือนในดิน', flee: 'วิ่งหนี' }, C: { b: '#7A6448', b2: '#8A7458', f: '#C8B49A', n: '#7A6448' },
  Q: Object.assign({}, AN_QHEN, { zb: 0.12, br: [0.1, 0.08, 0.08], k: 1.1, noWings: true, nx: 0.02, nz: 0.03, nr: 0.045, hr: [0.035, 0.03, 0.03], step: 0.05, lift: 0.03, pr: 4, bob: false,
    head: (b, s, C) => b.tube([[0.03, 0, -0.005], [0.08, 0, -0.025], [0.13, 0, -0.05]], (t) => 0.006 * (1 - 0.6 * t), C.f, { sides: 5 }), tail: () => {} }), draw: anBird, ground: anSoil, sh: [0.11, 0.08] });
anDef('peacock', { th: 'นกยูง', en: 'peacock', fact: 'ตัวผู้รำแพนหางที่มีลายวงคล้ายตาเพื่อดึงดูดตัวเมีย ตัวอย่างการคัดเลือกทางเพศ', hint: 'เดินลากหางยาว รำแพนหางเป็นวงกว้าง แตะแล้ววิ่งหนี', kw: 'นกยูงไทย สวนสัตว์ รำแพน', go: 'walk', spd: 0.12, fast: 0.5, stride: 0.16, turn: 2, roam: 0.18, R: 0.75, tz: 0.3, react: 'flee', fleeLen: 0.4,
  loop: [['go', 4], ['peck', 3], ['display', 7], ['go', 3]], acts: { peck: 'จิกกินอาหาร', display: 'รำแพนหาง', flee: 'วิ่งหนี' }, C: { b: '#2A5AA8', b2: '#3A6A8A', w: '#8A7450', f: '#8A8070', n: '#2A6AB8', t: '#3E7A4A' },
  Q: Object.assign({}, AN_QHEN, { zb: 0.3, br: [0.17, 0.1, 0.11], k: 1.2, nx: 0.06, nz: 0.18, nr: 0.03, hr: [0.045, 0.032, 0.035], bob: true,
    head: (b, s, C) => { AN_BEAK(0.035, 0.012, '#8A8070')(b); for (let i = -1; i <= 1; i++) b.line([[-0.01, i * 0.008, 0.03], [-0.02, i * 0.012, 0.07]], '#2A6AB8', 0.003); },
    tail: (b, s, C, D) => { const dsp = s.act === 'display' ? anBell(s.ap, 0.15) : 0;
      for (let i = 0; i < 15; i++) { const a = (i / 14 - 0.5) * (0.35 + 2.75 * dsp), up = -0.22 + 1.75 * dsp, L = 0.5, tip = [-0.14 - Math.cos(up) * L * Math.cos(a), Math.sin(a) * L, -0.02 + Math.sin(up) * L * Math.cos(a) * 0.95 + 0.01 * Math.sin(s.t * 6 + i) * dsp];
        b.sheet([[-0.12, 0, 0.02], anAdd(tip, [0, 0.03, 0]), anAdd(tip, [0, -0.03, 0])], C.t, { edge: false }); b.ball(anLerp([-0.12, 0, 0.02], tip, 0.92), 0.016, '#2A4AA8'); } } }), draw: anBird, sh: [0.25, 0.15] });
anDef('flamingo', { th: 'นกฟลามิงโก', en: 'flamingo', fact: 'สีชมพูมาจากสารสีในกุ้งและสาหร่ายที่กิน ยืนขาเดียวได้นาน', hint: 'ลุยน้ำ ก้มหัวกรองอาหาร ยืนขาเดียว แตะแล้วบินหนี', kw: 'ฟลามิงโก สวนสัตว์ นกลุยน้ำ', go: 'walk', air: true, spd: 0.1, fast: 0.7, stride: 0.25, turn: 1.8, roam: 0.18, zLo: 0.6, zHi: 0.75, R: 0.85, tz: 0.4, react: 'flyoff', fleeLen: 0.4,
  loop: [['go', 4], ['peck', 4], ['rest', 5]], acts: { go: 'ลุยน้ำ', peck: 'ก้มหัวกรองอาหาร', rest: 'ยืนขาเดียว', flyoff: 'บินหนี', land: 'ร่อนลง' }, C: { b: '#F0A0A8', b2: '#F6C0C4', w: '#E87888', f: '#E08A90', n: '#F0A0A8', t: '#E87888' },
  Q: Object.assign({}, AN_QHEN, { zb: 0.62, br: [0.15, 0.09, 0.1], k: 1.3, ws: 0.32, oneLeg: true, nx: 0.08, nz: 0.3, nr: 0.022, hr: [0.035, 0.025, 0.028], pr: 3, bob: false, flap: 4,
    head: (b, s, C) => b.tube([[0.03, 0, 0], [0.06, 0, -0.01], [0.075, 0, -0.04]], (t) => 0.012 * (1 - 0.6 * t), '#2A2420', { sides: 5 }),
    tail: (b, s, C) => b.sheet([[-0.13, 0.03, 0.02], [-0.2, 0, 0.02], [-0.13, -0.03, 0.02]], C.w) }), draw: anBird, ground: anPond, sh: [0.2, 0.12] });
anDef('parrot', { th: 'นกแก้ว', en: 'parrot', fact: 'จะงอยปากงุ้มแข็งกะเทาะเมล็ด นิ้วหน้าสองหลังสอง เลียนเสียงได้', hint: 'กระโดดเดิน ใช้ปากงุ้มกะเทาะเมล็ด แตะแล้วบินหนี แล้วร่อนลงที่ใหม่', kw: 'นกแก้วมาคอว์ สวนสัตว์ เลียนเสียง', go: 'hop', air: true, spd: 0.3, fast: 0.9, hopLen: 0.1, hopH: 0.035, hopT: 0.25, hopRest: 0.5, turn: 5, roam: 0.18, zLo: 0.25, zHi: 0.55, R: 0.36, tz: 0.15, react: 'flyoff',
  loop: [['go', 2.5], ['peck', 3], ['look', 2]], acts: { go: 'กระโดดเดิน', peck: 'กะเทาะเมล็ด', look: 'เอียงคอมอง', flyoff: 'บินหนี', land: 'ร่อนลง' }, C: { b: '#3AA05A', b2: '#8AC85A', w: '#2A6AC8', f: '#5A5048', n: '#D83A2E', t: '#2A6AC8' },
  Q: Object.assign({}, AN.bird.Q, { zb: 0.1, br: [0.09, 0.055, 0.06], k: 0.55, ws: 0.18, nx: 0.025, nz: 0.05, nr: 0.035, hr: [0.04, 0.034, 0.036],
    head: (b, s, C) => b.tube([[0.03, 0, 0.005], [0.05, 0, 0.0], [0.055, 0, -0.025], [0.045, 0, -0.035]], (t) => 0.014 * (1 - 0.8 * t), '#E6DED0', { sides: 6 }),
    tail: (b, s, C) => b.sheet([[-0.07, 0.015, 0.0], [-0.2, 0.012, -0.03], [-0.2, -0.012, -0.03], [-0.07, -0.015, 0.0]], C.t) }), draw: anBird, sh: [0.08, 0.05] });

/* the groups taught at school: mammals by how their young are born and by order, birds that fly or cannot */
const AN_GROUP = {
  'สัตว์เลี้ยงลูกด้วยน้ำนม ออกลูกเป็นไข่': ['platypus', 'echidna'], 'สัตว์เลี้ยงลูกด้วยน้ำนม มีกระเป๋าหน้าท้อง': ['kangaroo'],
  'สัตว์เลี้ยงลูกด้วยน้ำนม กินมดและปลวก': ['anteater', 'pangolin'], 'สัตว์เลี้ยงลูกด้วยน้ำนม ฟันแทะ': ['rat'], 'สัตว์เลี้ยงลูกด้วยน้ำนม บินได้': ['bat'],
  'สัตว์เลี้ยงลูกด้วยน้ำนม กินเนื้อ': ['cat', 'dog', 'lion', 'tiger', 'bear', 'panda', 'seal'],
  'สัตว์เลี้ยงลูกด้วยน้ำนม มีกีบ': ['cow', 'buffalo', 'horse', 'zebra', 'pig', 'goat', 'deer', 'camel', 'giraffe', 'hippo', 'rhino'], 'สัตว์เลี้ยงลูกด้วยน้ำนม มีงวง': ['elephant'],
  'สัตว์เลี้ยงลูกด้วยน้ำนม ในน้ำ': ['dolphin', 'whale'], 'สัตว์เลี้ยงลูกด้วยน้ำนม ไพรเมต': ['monkey', 'orangutan'],
  'สัตว์ปีก (นก)': ['chicken', 'duck', 'bird', 'owl', 'peacock', 'flamingo', 'parrot'], 'สัตว์ปีก (นกที่บินไม่ได้)': ['penguin', 'ostrich', 'emu', 'cassowary', 'kiwi']
};
for (const g in AN_GROUP) for (const k of AN_GROUP[g]) if (AN[k]) AN[k].grp = g;

/* the trait the questions ask about, for the first animals */
const AN_FACT = {
  cow: 'กินพืช กระเพาะมีสี่ห้อง เคี้ยวเอื้อง', buffalo: 'กินพืช เคี้ยวเอื้อง ชอบแช่ปลักโคลนระบายความร้อน', elephant: 'งวงคือจมูกกับริมฝีปากบนที่ยาวออก งาคือฟันตัด',
  cat: 'กินเนื้อ หดเล็บเก็บได้ มองเห็นในที่แสงน้อย', dog: 'รับกลิ่นได้ดีมาก ระบายความร้อนด้วยการหอบ', chicken: 'ไม่มีฟัน ใช้กึ๋นบดอาหาร', duck: 'ตีนมีพังผืดช่วยว่ายน้ำ ขนมีน้ำมันกันน้ำ',
  bird: 'กระดูกกลวงและมีถุงลม ช่วยให้บินได้', fish: 'หายใจด้วยเหงือก มีเส้นข้างลำตัวรับแรงสั่นสะเทือน', squid: 'เคลื่อนที่ด้วยการพ่นน้ำ มีถุงหมึก หัวใจสามดวง',
  crab: 'มีโครงร่างภายนอกแข็ง ต้องลอกคราบจึงโตได้ มีขาสิบขารวมก้าม', shrimp: 'ลอกคราบเมื่อโต หายใจด้วยเหงือกใต้เปลือกหัว', snail: 'เคลื่อนที่ด้วยเท้าที่หลั่งเมือก',
  frog: 'ลูกอ๊อดเปลี่ยนรูปร่างเป็นกบ หายใจทางผิวหนังได้', ricefrog: 'ตัวเล็ก กระโดดเก่ง อาศัยในนาข้าว', toad: 'ผิวแห้งมีตุ่ม มีต่อมพิษหลังตา',
  worm: 'หายใจทางผิวหนัง ไม่มีตา ตัวเดียวมีทั้งสองเพศ', caecilian: 'ไม่ใช่งู เป็นสัตว์สะเทินน้ำสะเทินบกที่ไม่มีขา ตาเล็กมาก', houselizard: 'สลัดหางหนีศัตรูได้ แล้วหางงอกใหม่',
  gecko: 'นิ้วมีขนเล็กมากจำนวนมาก ทำให้เกาะผนังได้', turtle: 'กระดองเชื่อมกับกระดูกสันหลังและซี่โครง', butterfly: 'เปลี่ยนแปลงรูปร่างสมบูรณ์ ไข่ หนอน ดักแด้ ตัวเต็มวัย ปากเป็นงวงดูด',
  bee: 'ผึ้งงานเป็นเพศเมีย บอกทางอาหารด้วยการเต้นรำ ช่วยผสมเกสร', ant: 'แมลงสังคม สื่อสารด้วยสารฟีโรโมน', mosquito: 'ยุงลายเพศเมียกัดดูดเลือด เป็นพาหะไข้เลือดออก ลูกน้ำอยู่ในน้ำ',
  dragonfly: 'ตัวอ่อนอยู่ในน้ำ เปลี่ยนแปลงรูปร่างไม่สมบูรณ์ ตาประกอบใหญ่', grasshopper: 'เปลี่ยนแปลงรูปร่างไม่สมบูรณ์ หายใจทางรูหายใจข้างลำตัว', bat: 'สัตว์เลี้ยงลูกด้วยน้ำนมที่บินได้ ใช้เสียงสะท้อนหาทาง'
};
for (const k in AN_FACT) if (AN[k] && !AN[k].fact) AN[k].fact = AN_FACT[k];

/* ==== more animals go above this line ==== */
/* a small picture of an animal for the shape tool: drawn once here, side on, in pencil; only=true asks for one already made */
const AN_THUMBS = new Map();
function anThumb(id, only) {
  if (AN_THUMBS.has(id) || only) return AN_THUMBS.get(id) || '';
  const D = AN[id]; if (!D) return '';
  let url = '';
  try {
    /* drawn big, then cut to the animal and fitted into the picture, whatever its size and height */
    const W = 280, H = 210, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    /* seen from its left side, a little from the front, whichever way it starts facing */
    const an = anNew(D), r = { st: { t: 0, an }, cam: { yaw: an.h + Math.PI - 0.5, pitch: 0.28, zoom: 1.2 } };
    anDraw(c, W, H, { animal: id, pen: true, clean: true, thumb: true }, r);
    const d = c.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 30) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const w = 112, h = 84, out = document.createElement('canvas'); out.width = w; out.height = h;
    if (x1 > x0) { const bw = x1 - x0 + 6, bh = y1 - y0 + 6, k = Math.min((w - 6) / bw, (h - 6) / bh, 2.5); out.getContext('2d').drawImage(cv, x0 - 3, y0 - 3, bw, bh, (w - bw * k) / 2, (h - bh * k) / 2, bw * k, bh * k); }
    url = out.toDataURL('image/png');
  } catch (e) { url = ''; }
  AN_THUMBS.set(id, url); return url;
}
/* the list for the picker of models and for the shape tool: [id, Thai name, what it does, other words, group] */
const AN_LIST = Object.keys(AN).map((k) => [k, AN[k].th, AN[k].hint, AN[k].kw || '', AN[k].grp]);
function anSpec(id) { const D = AN[id]; return D ? { domain: 'bio', dim: 3, title: D.th, animal: id, clean: true, pen: true, mark: 'ani' } : null; }
/* in the picker of models, subject biology: found by the Thai name, other names and what it does */
if (SCENE_TPL && SCENE_TPL.bio && !SCENE_TPL.bio.anDone) { SCENE_TPL.bio.anDone = 1; for (const [id, th, hint, kw, grp] of AN_LIST) SCENE_TPL.bio.push([th + ' (สามมิติ)', hint, anSpec(id), kw + ' ' + grp + ' สัตว์ ' + AN[id].en]); }

