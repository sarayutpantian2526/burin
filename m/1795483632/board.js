/* BURIN part: board (loaded when first used) */
/* ---------- a photo of a board becomes a page (task 8.20, switched off with "board" in flags.json).
   A whiteboard, a blackboard or a projector screen photographed in class:
     on this device, no AI: the four corners of the board are found (bdFind: the long straight lines of the picture, the
     four that close the largest well-drawn quadrilateral), the teacher can drag them; the board is pulled straight
     (bdWarp, the board's true width to height worked out from the perspective, Zhang and He's whiteboard scanning) and
     its background, shadows and glare are washed out (bdClean: the board's own colour is measured cell by cell and
     every pixel is divided by it, so the marker keeps its colour on white).
     The page: a new page after this one (landscape for a wide board) holding the cleaned board as its picture (locked,
     like an imported PDF page) and the straightened photo as it was (bd.raw), so the two can be compared at any time
     (bd.v: 'clean', 'photo', 'faint' or 'off', the button in the page's own bar).
     The AI (when set up): reads the cleaned board once into blocks with where they are (text, equations in LaTeX with
     vectors as harpoons, tables, figures, graphs) and lays them on the page where they were: text boxes, equations,
     a table, a graph from a function that the app can draw, and every figure cut from the photo. The board picture
     then goes faint behind them. What the AI read is kept on this device with the handwriting readings (task 8.16,
     keyed by the cleaned picture), so the same board laid out again needs no AI. Reading again replaces the boxes the
     last reading put there (bdk), and is one step to undo ---------- */
const BD = { cv: null, q: null, auto: false, out: null, raw: null, name: '', busy: false, drag: -1, view: null, clean: true };
const BD_SRC = 2400, BD_OUT = 2000, BD_FIND = 480, BD_AI = 1568;

/* ----- the photo ----- */
async function bdLoad(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const w0 = im.naturalWidth, h0 = im.naturalHeight; if (!w0 || !h0) throw new Error('no picture');
    const k = Math.min(1, BD_SRC / Math.max(w0, h0)), cv = document.createElement('canvas');
    cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k);
    const c = cv.getContext('2d'); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(im, 0, 0, cv.width, cv.height);
    return cv;
  } finally { URL.revokeObjectURL(url); }
}
function bdData(cv) { return cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height); }

/* ----- the four corners: the long straight edges of the picture (a Hough transform of its edges), then the four lines
   that close the quadrilateral best supported along all its sides, larger ones preferred ----- */
function bdFind(cv) {
  const k = Math.min(1, BD_FIND / Math.max(cv.width, cv.height)), w = Math.max(8, Math.round(cv.width * k)), h = Math.max(8, Math.round(cv.height * k));
  const t = document.createElement('canvas'); t.width = w; t.height = h;
  const c = t.getContext('2d', { willReadFrequently: true }); c.drawImage(cv, 0, 0, w, h);
  const d = c.getImageData(0, 0, w, h).data; t.width = t.height = 1;
  let g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114;
  g = bdBlur(bdBlur(g, w, h), w, h);
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h), mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const a = g[i - w - 1], b = g[i - w], cc = g[i - w + 1], dd = g[i - 1], f = g[i + 1], gg = g[i + w - 1], hh = g[i + w], ii = g[i + w + 1];
    const X = (cc + 2 * f + ii) - (a + 2 * dd + gg), Y = (gg + 2 * hh + ii) - (a + 2 * b + cc);
    gx[i] = X; gy[i] = Y; mag[i] = Math.sqrt(X * X + Y * Y);
  }
  /* the strongest edges only: the top 9 percent, but never the noise of a plain picture */
  const sorted = Array.from(mag.filter((v, i) => i % 3 === 0)).sort((p, q) => p - q), T = Math.max(14, sorted[Math.floor(sorted.length * 0.87)] || 0);
  const D = Math.ceil(Math.hypot(w, h)), NR = 2 * D + 1, acc = new Float32Array(180 * NR), cs = new Float32Array(180), sn = new Float32Array(180);
  for (let a = 0; a < 180; a++) { cs[a] = Math.cos(a * Math.PI / 180); sn[a] = Math.sin(a * Math.PI / 180); }
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x, m = mag[i]; if (m < T) continue;
    let th = Math.round(Math.atan2(gy[i], gx[i]) * 180 / Math.PI); th = ((th % 180) + 180) % 180;
    for (let da = -3; da <= 3; da++) { const a = (th + da + 180) % 180, r = Math.round(x * cs[a] + y * sn[a]) + D; acc[a * NR + r] += m; }
  }
  /* the peaks: each a line x cos a + y sin a = r */
  const peaks = [];
  for (let a = 0; a < 180; a++) for (let r = 1; r < NR - 1; r++) {
    const v = acc[a * NR + r]; if (v <= 0) continue;
    let top = true;
    for (let da = -4; da <= 4 && top; da++) for (let dr = -6; dr <= 6; dr++) {
      if (!da && !dr) continue; let aa = a + da, rr = r + dr; if (aa < 0) { aa += 180; rr = NR - 1 - rr; } else if (aa >= 180) { aa -= 180; rr = NR - 1 - rr; }
      if (rr < 0 || rr >= NR) continue; const u = acc[aa * NR + rr]; if (u > v || (u === v && (da < 0 || (!da && dr < 0)))) { top = false; break; }
    }
    if (top) peaks.push({ a, r: r - D, v });
  }
  peaks.sort((p, q) => q.v - p.v);
  const hz = [], vt = [];
  for (const p of peaks.slice(0, 90)) { if (Math.abs(p.a - 90) < 35) { if (hz.length < 12) hz.push(p); } else if (p.a < 40 || p.a > 140) { if (vt.length < 12) vt.push(p); } }
  const yAt = (p, x) => (p.r - x * cs[p.a]) / (sn[p.a] || 1e-6), xAt = (p, y) => (p.r - y * sn[p.a]) / (Math.abs(cs[p.a]) < 1e-6 ? 1e-6 : cs[p.a]);
  const cross = (p, q) => { const det = cs[p.a] * sn[q.a] - sn[p.a] * cs[q.a]; if (Math.abs(det) < 1e-6) return null; return [(p.r * sn[q.a] - sn[p.a] * q.r) / det, (cs[p.a] * q.r - p.r * cs[q.a]) / det]; };
  /* how much of a side is a real edge: points along it with a strong edge that runs the same way */
  const side = (P, Q) => {
    const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]), n = Math.max(12, Math.min(90, Math.round(L / 4))), nx = -(Q[1] - P[1]) / (L || 1), ny = (Q[0] - P[0]) / (L || 1);
    let hit = 0, seen = 0;
    for (let s = 0; s <= n; s++) {
      const fx = P[0] + (Q[0] - P[0]) * s / n, fy = P[1] + (Q[1] - P[1]) * s / n; let ok = false, inside = false;
      for (let o = -2; o <= 2 && !ok; o++) {
        const x = Math.round(fx + nx * o), y = Math.round(fy + ny * o); if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue; inside = true;
        const i = y * w + x, m = mag[i]; if (m < T * 0.6) continue;
        if (Math.abs(gx[i] * nx + gy[i] * ny) / m > 0.85) ok = true;
      }
      if (inside) { seen++; if (ok) hit++; }
    }
    return seen < n * 0.5 ? hit / (n + 1) * 0.7 : hit / Math.max(1, seen);
  };
  /* how bright the inside is, against the brightest of the picture: the board, or the picture a projector throws,
     is the brightest thing in the photo (a projector screen's frame or the wall around it is not) */
  const lumS = Array.from(g.filter((v, i) => i % 5 === 0)).sort((p, q) => p - q), top95 = Math.max(1, lumS[Math.floor(lumS.length * 0.95)] || 255);
  const bright = (Q4) => {
    const m = bdSq(Q4); let s = 0, n = 0;
    for (let a = 1; a < 16; a++) for (let b = 1; b < 16; b++) {
      const u = a / 16, v = b / 16, z = m[6] * u + m[7] * v + 1, x = Math.round((m[0] * u + m[1] * v + m[2]) / z), y = Math.round((m[3] * u + m[4] * v + m[5]) / z);
      if (x < 0 || y < 0 || x >= w || y >= h) continue; s += Math.min(1, g[y * w + x] / top95); n++;
    }
    return n ? s / n : 0;
  };
  let best = null;
  for (let i = 0; i < hz.length; i++) for (let j = 0; j < hz.length; j++) {
    const T0 = hz[i], B0 = hz[j]; if (yAt(T0, w / 2) > yAt(B0, w / 2) - h * 0.2) continue;
    for (let p = 0; p < vt.length; p++) for (let q = 0; q < vt.length; q++) {
      const L0 = vt[p], R0 = vt[q]; if (xAt(L0, h / 2) > xAt(R0, h / 2) - w * 0.2) continue;
      const tl = cross(T0, L0), tr = cross(T0, R0), br = cross(B0, R0), bl = cross(B0, L0); if (!tl || !tr || !br || !bl) continue;
      const Q4 = [tl, tr, br, bl];
      if (Q4.some((P) => P[0] < -w * 0.06 || P[0] > w * 1.06 || P[1] < -h * 0.06 || P[1] > h * 1.06)) continue;
      const area = bdArea(Q4) / (w * h); if (area < 0.18 || !bdConvex(Q4)) continue;
      const sv = [side(tl, tr), side(tr, br), side(br, bl), side(bl, tl)], mean = (sv[0] + sv[1] + sv[2] + sv[3]) / 4, low = Math.min(sv[0], sv[1], sv[2], sv[3]);
      const score = mean * 0.6 + low * 0.4 + area * 0.3 + bright(Q4) * 0.6;
      if (!best || score > best.score) best = { score, q: Q4, low };
    }
  }
  if (!best || best.low < 0.25 || best.score < 0.9) {
    const m = 0.04; return { q: [[cv.width * m, cv.height * m], [cv.width * (1 - m), cv.height * m], [cv.width * (1 - m), cv.height * (1 - m)], [cv.width * m, cv.height * (1 - m)]], auto: false };
  }
  return { q: best.q.map((P) => [clamp(P[0] / k, 0, cv.width), clamp(P[1] / k, 0, cv.height)]), auto: true, score: Math.round(best.score * 100) / 100 };
}
function bdBlur(a, w, h) {
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; s += a[yy * w + xx]; n++; } }
    o[y * w + x] = s / n;
  }
  return o;
}
function bdArea(q) { let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
function bdConvex(q) {
  let sg = 0;
  for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4], z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(z) < 1e-9) return false; const s = z > 0 ? 1 : -1; if (sg && s !== sg) return false; sg = s; }
  return true;
}

/* ----- straight: the board's width to height from the perspective of its corners (Zhang and He, the camera's centre
   at the middle of the photo), then each pixel of the straight board read from the photo ----- */
function bdRatio(q, W, H) {
  const c = (p) => [p[0] - W / 2, p[1] - H / 2, 1];
  const X = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], Dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const m1 = c(q[0]), m2 = c(q[1]), m4 = c(q[2]), m3 = c(q[3]);
  const wd = (Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) + Math.hypot(q[2][0] - q[3][0], q[2][1] - q[3][1])) / 2;
  const ht = (Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]) + Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1])) / 2;
  const plain = wd / (ht || 1);
  try {
    const k2 = Dt(X(m1, m4), m3) / Dt(X(m2, m4), m3), k3 = Dt(X(m1, m4), m2) / Dt(X(m3, m4), m2);
    const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]], n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
    const Dm = Math.max(W, H); let f2 = -(n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2]);
    if (!(f2 > 0.16 * Dm * Dm && f2 < 16 * Dm * Dm)) f2 = 0.72 * Dm * Dm; /* a phone's ordinary lens when the corners cannot tell */
    const r = Math.sqrt((n2[0] * n2[0] / f2 + n2[1] * n2[1] / f2 + n2[2] * n2[2]) / (n3[0] * n3[0] / f2 + n3[1] * n3[1] / f2 + n3[2] * n3[2]));
    if (isFinite(r) && r > 0.2 && r < 5 && Math.abs(Math.log(r / plain)) < 0.6) return r;
  } catch (e) { /* the plain measure */ }
  return clamp(plain, 0.2, 5);
}
/* the unit square to the four corners (top left, top right, bottom right, bottom left), as Heckbert wrote it */
function bdSq(q) {
  const x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3; let g = 0, hh = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) { const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, den = dx1 * dy2 - dx2 * dy1; g = (sx * dy2 - dx2 * sy) / den; hh = (dx1 * sy - sx * dy1) / den; }
  return [x1 - x0 + g * x1, x3 - x0 + hh * x3, x0, y1 - y0 + g * y1, y3 - y0 + hh * y3, y0, g, hh];
}
function bdWarp(cv, q, maxSide) {
  const W = cv.width, H = cv.height, r = bdRatio(q, W, H), M = maxSide || BD_OUT;
  const top = Math.max(Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), Math.hypot(q[2][0] - q[3][0], q[2][1] - q[3][1]));
  let ow = Math.round(Math.min(M, Math.max(200, top * 1.05))), oh = Math.round(ow / r);
  if (oh > M) { oh = M; ow = Math.round(oh * r); }
  const src = bdData(cv).data, out = new ImageData(ow, oh), o = out.data, m = bdSq(q);
  for (let y = 0; y < oh; y++) {
    const v = (y + 0.5) / oh;
    for (let x = 0; x < ow; x++) {
      const u = (x + 0.5) / ow, z = m[6] * u + m[7] * v + 1;
      let sx = (m[0] * u + m[1] * v + m[2]) / z - 0.5, sy = (m[3] * u + m[4] * v + m[5]) / z - 0.5;
      sx = sx < 0 ? 0 : sx > W - 1.001 ? W - 1.001 : sx; sy = sy < 0 ? 0 : sy > H - 1.001 ? H - 1.001 : sy;
      const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy, i0 = (iy * W + ix) * 4, i1 = i0 + W * 4, j = (y * ow + x) * 4;
      const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
      o[j] = src[i0] * a + src[i0 + 4] * b + src[i1] * c + src[i1 + 4] * d;
      o[j + 1] = src[i0 + 1] * a + src[i0 + 5] * b + src[i1 + 1] * c + src[i1 + 5] * d;
      o[j + 2] = src[i0 + 2] * a + src[i0 + 6] * b + src[i1 + 2] * c + src[i1 + 6] * d;
      o[j + 3] = 255;
    }
  }
  return out;
}

/* ----- clean: the board's own colour, measured in cells (the brightest part of each, so writing does not count),
   evened out with its neighbours, then every pixel divided by it: shadows, glare and the board's tint go white and the
   marker keeps its colour, a little deeper. A blackboard (dark background) is turned the other way first ----- */
function bdClean(id) {
  const W = id.width, H = id.height, s = id.data, out = new ImageData(W, H), o = out.data;
  let lumSum = 0, nS = 0; for (let i = 0; i < s.length; i += 4 * 97) { lumSum += s[i] * 0.299 + s[i + 1] * 0.587 + s[i + 2] * 0.114; nS++; }
  const dark = lumSum / nS < 95;
  const px = new Uint8ClampedArray(W * H * 3);
  for (let i = 0, j = 0; i < s.length; i += 4, j += 3) { if (dark) { px[j] = 255 - s[i]; px[j + 1] = 255 - s[i + 1]; px[j + 2] = 255 - s[i + 2]; } else { px[j] = s[i]; px[j + 1] = s[i + 1]; px[j + 2] = s[i + 2]; } }
  const cell = Math.max(16, Math.round(Math.max(W, H) / 40)), cx = Math.ceil(W / cell), cy = Math.ceil(H / cell), bg = new Float32Array(cx * cy * 4);
  const hist = new Uint32Array(256);
  for (let gy = 0; gy < cy; gy++) for (let gx = 0; gx < cx; gx++) {
    hist.fill(0); let n = 0;
    const x0 = gx * cell, y0 = gy * cell, x1 = Math.min(W, x0 + cell), y1 = Math.min(H, y0 + cell);
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const j = (y * W + x) * 3; hist[(px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114) | 0]++; n++; }
    let want = n * 0.3, thr = 255; for (; thr > 0; thr--) { want -= hist[thr]; if (want <= 0) break; }
    let r = 0, g = 0, b = 0, m = 0;
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const j = (y * W + x) * 3, L = px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114; if (L >= thr) { r += px[j]; g += px[j + 1]; b += px[j + 2]; m++; } }
    const k = (gy * cx + gx) * 4; m = m || 1; bg[k] = r / m; bg[k + 1] = g / m; bg[k + 2] = b / m; bg[k + 3] = (r + g + b) / m / 3;
  }
  /* a cell full of writing or of a drawing reads too dark: the middle of its 5 by 5 neighbours (by brightness) instead,
     then a light blur so no cell edge shows */
  const md = new Float32Array(bg.length);
  for (let gy = 0; gy < cy; gy++) for (let gx = 0; gx < cx; gx++) {
    const ns = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = gy + dy, xx = gx + dx; if (yy < 0 || xx < 0 || yy >= cy || xx >= cx) continue; ns.push((yy * cx + xx) * 4); }
    ns.sort((a, b) => bg[a + 3] - bg[b + 3]);
    const k = (gy * cx + gx) * 4, own = bg[k + 3], mid = ns[Math.floor(ns.length * 0.6)];
    const pick = own < bg[mid + 3] * 0.92 ? mid : k;
    md[k] = bg[pick]; md[k + 1] = bg[pick + 1]; md[k + 2] = bg[pick + 2]; md[k + 3] = bg[pick + 3];
  }
  const sm = new Float32Array(bg.length);
  for (let gy = 0; gy < cy; gy++) for (let gx = 0; gx < cx; gx++) {
    const k = (gy * cx + gx) * 4; let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = gy + dy, xx = gx + dx; if (yy < 0 || xx < 0 || yy >= cy || xx >= cx) continue; const q = (yy * cx + xx) * 4, wt = dx || dy ? 1 : 2; r += md[q] * wt; g += md[q + 1] * wt; b += md[q + 2] * wt; n += wt; }
    sm[k] = Math.max(1, r / n); sm[k + 1] = Math.max(1, g / n); sm[k + 2] = Math.max(1, b / n);
  }
  for (let y = 0; y < H; y++) {
    const fy = clamp((y + 0.5) / cell - 0.5, 0, cy - 1), y0 = Math.floor(fy), y1 = Math.min(cy - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = clamp((x + 0.5) / cell - 0.5, 0, cx - 1), x0 = Math.floor(fx), x1 = Math.min(cx - 1, x0 + 1), tx = fx - x0;
      const a = (y0 * cx + x0) * 4, b = (y0 * cx + x1) * 4, c = (y1 * cx + x0) * 4, d = (y1 * cx + x1) * 4;
      const wa = (1 - tx) * (1 - ty), wb = tx * (1 - ty), wc = (1 - tx) * ty, wd = tx * ty;
      const j = (y * W + x) * 3, i = (y * W + x) * 4;
      const rr = Math.min(1.2, px[j] / (sm[a] * wa + sm[b] * wb + sm[c] * wc + sm[d] * wd));
      const rg = Math.min(1.2, px[j + 1] / (sm[a + 1] * wa + sm[b + 1] * wb + sm[c + 1] * wc + sm[d + 1] * wd));
      const rb = Math.min(1.2, px[j + 2] / (sm[a + 2] * wa + sm[b + 2] * wb + sm[c + 2] * wc + sm[d + 2] * wd));
      const L = rr * 0.299 + rg * 0.587 + rb * 0.114, sat = Math.max(rr, rg, rb) - Math.min(rr, rg, rb);
      /* the board itself (near its own colour, no colour of its own) goes white; a faint coloured marker does not */
      if (L > 0.9 && sat < 0.07) { o[i] = o[i + 1] = o[i + 2] = 255; o[i + 3] = 255; continue; }
      /* how much of a stroke this is; a faint stroke is deepened more than a dark one */
      const st = clamp(Math.max((0.92 - L) / 0.3, (sat - 0.05) / 0.15), 0, 1), gain = 2.1 - 1.1 * st;
      let R = 1 - (1 - Math.min(1, rr)) * gain, G = 1 - (1 - Math.min(1, rg)) * gain, B = 1 - (1 - Math.min(1, rb)) * gain;
      const fade = clamp(Math.max((0.92 - L) / 0.08, (sat - 0.05) / 0.06), 0, 1); /* the faint edge of a stroke blends into white instead of a hard cut */
      R = 1 - (1 - R) * fade; G = 1 - (1 - G) * fade; B = 1 - (1 - B) * fade;
      if (dark) { const v = R * 0.299 + G * 0.587 + B * 0.114; R = G = B = v; } /* chalk on a blackboard: dark strokes on white (the chalk's colour is not kept) */
      o[i] = clamp(R, 0, 1) * 255; o[i + 1] = clamp(G, 0, 1) * 255; o[i + 2] = clamp(B, 0, 1) * 255; o[i + 3] = 255;
    }
  }
  return out;
}

/* ----- the sheet: the photo with its four corners to drag (a magnifier shows the corner under the finger), then the
   board straight and clean, and where it goes ----- */
function bdPh(t) { return String(t).split(/ (?!ๆ)/).map((w) => '<span class="nowrap">' + esc(w) + '</span>').join(' '); }
function bdStyle() {
  if ($('#bdStyle')) return;
  const s = document.createElement('style'); s.id = 'bdStyle';
  s.textContent = '#bdSheet .bdstage { position: relative; display: flex; justify-content: center; background: var(--surface-2); border-radius: 12px; overflow: hidden; touch-action: none; }\n'
    + '#bdSheet canvas { display: block; touch-action: none; max-width: 100%; }\n#bdSheet .bdprev { display: flex; justify-content: center; background: #FFFFFF; border-radius: 12px; border: 1px solid var(--line); overflow: hidden; }\n'
    + '#bdSheet .bdprev img { display: block; max-width: 100%; max-height: 52vh; }\n#bdSheet .bdrow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }\n'
    + '#bdSheet .bdrow .btn { min-height: 44px; }\n#bdSheet label.bdchk { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-size: 15px; }\n#bdSheet label.bdchk input { width: 22px; height: 22px; }\n'
    + '#bdSheet .seg button { min-height: 40px; }';
  document.head.appendChild(s);
}
function bdSheet() {
  let sh = $('#bdSheet'); if (sh) return sh;
  bdStyle();
  sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'bdSheet'; sh.hidden = true;
  sh.innerHTML = '<div class="panel wide" role="dialog" aria-label="ภาพถ่ายกระดาน"><div class="histtop"><h2>ภาพถ่ายกระดาน</h2><button class="btn" id="bBdClose" type="button">ปิด</button></div>'
    + '<div id="bdOne"><div class="note" id="bdTip"></div><div class="bdstage" id="bdStage"><canvas id="bdCv" aria-label="ภาพถ่ายกับมุมทั้งสี่ของกระดาน ลากจุดเพื่อปรับ"></canvas></div>'
    + '<div class="bdrow"><button class="btn" id="bBdAuto" type="button">หามุมอีกครั้ง</button><button class="btn" id="bBdWhole" type="button">ใช้ทั้งภาพ</button><button class="btn solid" id="bBdNext" type="button">ดึงภาพให้ตรง</button></div></div>'
    + '<div id="bdTwo" hidden><div class="bdprev"><img id="bdPrev" alt="กระดานที่ดึงให้ตรงแล้ว"></div>'
    + '<div class="bdrow"><label class="bdchk"><input type="checkbox" id="bdCleanChk" checked> ' + bdPh('ล้างพื้นหลัง เงา และแสงสะท้อน') + '</label></div>'
    + '<div class="note" id="bdSay"></div>'
    + '<div class="bdrow"><button class="btn" id="bBdBack" type="button">ปรับมุม</button><button class="btn" id="bBdPage" type="button">วางเป็นหน้าใหม่</button><button class="btn solid" id="bBdAI" type="button">วางแล้วให้ AI อ่านเป็นตัวพิมพ์</button></div></div></div>';
  document.body.appendChild(sh);
  sh.addEventListener('click', (e) => { if (e.target === sh && !BD.busy) bdClose(); });
  $('#bBdClose').onclick = () => { if (!BD.busy) bdClose(); };
  $('#bBdAuto').onclick = () => { const f = bdFind(BD.cv); BD.q = f.q; BD.auto = f.auto; bdTip(); bdDraw(); };
  $('#bBdWhole').onclick = () => { const W = BD.cv.width, H = BD.cv.height; BD.q = [[0, 0], [W, 0], [W, H], [0, H]]; BD.auto = false; bdTip(); bdDraw(); };
  $('#bBdNext').onclick = () => bdStraight();
  $('#bBdBack').onclick = () => { $('#bdTwo').hidden = true; $('#bdOne').hidden = false; bdFit(); };
  $('#bdCleanChk').onchange = (e) => { BD.clean = !!e.target.checked; bdPreview(); };
  $('#bBdPage').onclick = () => bdPlace(false);
  $('#bBdAI').onclick = () => bdPlace(true);
  bdPointer($('#bdCv'));
  window.addEventListener('resize', () => { if (!sh.hidden && !$('#bdOne').hidden) bdFit(); });
  return sh;
}
function bdClose() { const sh = $('#bdSheet'); if (sh) sh.hidden = true; if (BD.prevUrl) { URL.revokeObjectURL(BD.prevUrl); BD.prevUrl = null; } BD.cv = null; BD.raw = BD.out = null; }
function bdTip() { $('#bdTip').innerHTML = bdPh(BD.auto ? 'แอปหามุมกระดานให้แล้ว ลากจุดที่มุมทั้งสี่ถ้ายังไม่ตรง แล้วกด ดึงภาพให้ตรง' : 'ยังหาขอบกระดานไม่ชัด ลากจุดทั้งสี่ไปที่มุมกระดาน แล้วกด ดึงภาพให้ตรง'); }
/* open with a photo: the corners are found at once */
async function bdOpen(file) {
  if (!S.nb) return;
  const sh = bdSheet(); closeSheets(); sh.hidden = false;
  $('#bdTwo').hidden = true; $('#bdOne').hidden = false; $('#bdTip').innerHTML = bdPh('กำลังหามุมกระดาน');
  BD.name = (file && file.name) || ''; BD.clean = true; $('#bdCleanChk').checked = true;
  try { BD.cv = await bdLoad(file); } catch (e) { $('#bdTip').innerHTML = bdPh('เปิดภาพนี้ไม่ได้ ใช้ภาพ JPG หรือ PNG'); return; }
  await new Promise((r) => setTimeout(r, 0));
  const f = bdFind(BD.cv); BD.q = f.q; BD.auto = f.auto; bdTip(); bdFit();
}
/* the canvas fits the sheet, the photo kept whole */
function bdFit() {
  const cv = $('#bdCv'), st = $('#bdStage'); if (!cv || !BD.cv) return;
  /* room around the photo, so a corner at its very edge is seen and taken whole */
  const pad = 18, maxW = Math.max(200, (st.clientWidth || 600) - 2 * pad), maxH = Math.max(220, Math.round(window.innerHeight * 0.58));
  const k = Math.min(maxW / BD.cv.width, maxH / BD.cv.height), dpr = Math.min(2, window.devicePixelRatio || 1);
  BD.view = { k, pad, w: Math.round(BD.cv.width * k), h: Math.round(BD.cv.height * k), dpr };
  const cw = BD.view.w + 2 * pad, ch = BD.view.h + 2 * pad;
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px'; cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  bdDraw();
}
function bdDraw(loupe) {
  const cv = $('#bdCv'), V = BD.view; if (!cv || !V || !BD.cv || !BD.q) return;
  const c = cv.getContext('2d'); c.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); c.clearRect(0, 0, V.w + 2 * V.pad, V.h + 2 * V.pad);
  c.translate(V.pad, V.pad); c.drawImage(BD.cv, 0, 0, V.w, V.h);
  const P = BD.q.map((p) => [p[0] * V.k, p[1] * V.k]);
  /* outside the board darker, the board as it is */
  c.save(); c.beginPath(); c.rect(0, 0, V.w, V.h); c.moveTo(P[0][0], P[0][1]); for (let i = 3; i >= 0; i--) c.lineTo(P[i][0], P[i][1]); c.closePath(); c.fillStyle = 'rgba(10,20,40,0.45)'; c.fill('evenodd'); c.restore();
  c.lineWidth = 2.5; c.strokeStyle = '#2F6FEB'; c.beginPath(); P.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.stroke();
  P.forEach((p, i) => { c.beginPath(); c.arc(p[0], p[1], BD.drag === i ? 15 : 12, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.92)'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#2F6FEB'; c.stroke(); });
  if (loupe != null && BD.drag >= 0) {
    /* the corner under the finger, three times larger, in the corner of the photo away from it */
    const p = BD.q[BD.drag], R = 58, Z = 3, right = P[BD.drag][0] < V.w / 2, top = P[BD.drag][1] > V.h / 2, cx = right ? V.w - R - 8 : R + 8, cy = top ? R + 8 : V.h - R - 8;
    const sw = (2 * R / Z) / V.k;
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();
    c.drawImage(BD.cv, p[0] - sw / 2, p[1] - sw / 2, sw, sw, cx - R, cy - R, 2 * R, 2 * R);
    c.strokeStyle = '#E5484D'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - 12, cy); c.lineTo(cx + 12, cy); c.moveTo(cx, cy - 12); c.lineTo(cx, cy + 12); c.stroke();
    c.restore(); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = '#FFFFFF'; c.stroke();
  }
}
function bdPointer(cv) {
  const at = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - BD.view.pad) / BD.view.k, (e.clientY - r.top - BD.view.pad) / BD.view.k]; };
  cv.addEventListener('pointerdown', (e) => {
    if (!BD.view || !BD.q) return;
    const p = at(e), lim = (e.pointerType === 'mouse' ? 22 : 40) / BD.view.k; let bi = -1, bd = Infinity;
    BD.q.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; bi = i; } });
    if (bd > lim * 1.6) return;
    BD.drag = bi; BD.off = [BD.q[bi][0] - p[0], BD.q[bi][1] - p[1]]; e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
    bdDraw(1);
  });
  cv.addEventListener('pointermove', (e) => {
    if (BD.drag < 0) return; const p = at(e);
    BD.q[BD.drag] = [clamp(p[0] + BD.off[0], 0, BD.cv.width), clamp(p[1] + BD.off[1], 0, BD.cv.height)]; e.preventDefault(); bdDraw(1);
  });
  const up = () => { if (BD.drag < 0) return; BD.drag = -1; bdDraw(); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}
/* the corners in order whatever way they were dragged: top left, top right, bottom right, bottom left */
function bdOrder(q) {
  const c = [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
  const s = q.slice().sort((a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0]));
  let k = 0, best = Infinity; s.forEach((p, i) => { const v = p[0] + p[1]; if (v < best) { best = v; k = i; } });
  return [s[k], s[(k + 1) % 4], s[(k + 2) % 4], s[(k + 3) % 4]];
}
async function bdStraight() {
  if (!BD.cv || BD.busy) return;
  const q = bdOrder(BD.q);
  if (bdArea(q) < BD.cv.width * BD.cv.height * 0.01 || !bdConvex(q)) { toast('มุมทั้งสี่ซ้อนกันหรือไขว้กัน ลากให้เป็นสี่เหลี่ยมก่อน', 3500); return; }
  BD.busy = true; const FL = floatLine('กำลังดึงภาพให้ตรง');
  try {
    await new Promise((r) => setTimeout(r, 30));
    BD.q = q; BD.raw = bdWarp(BD.cv, q); BD.out = null;
    $('#bdOne').hidden = true; $('#bdTwo').hidden = false;
    bdPreview();
  } catch (e) { toast('ดึงภาพไม่สำเร็จ ลองปรับมุมใหม่', 3500); } finally { FL(); BD.busy = false; }
}
function bdCanvas(id) { const c = document.createElement('canvas'); c.width = id.width; c.height = id.height; c.getContext('2d').putImageData(id, 0, 0); return c; }
function bdBlob(cv, q) { return new Promise((r) => cv.toBlob(r, 'image/jpeg', q || 0.88)); }
async function bdPreview() {
  if (!BD.raw) return;
  if (BD.clean && !BD.out) BD.out = bdClean(BD.raw);
  const b = await bdBlob(bdCanvas(BD.clean ? BD.out : BD.raw), 0.8);
  if (BD.prevUrl) URL.revokeObjectURL(BD.prevUrl); BD.prevUrl = URL.createObjectURL(b); $('#bdPrev').src = BD.prevUrl;
  const ai = AI.anyReady && AI.anyReady();
  $('#bdSay').innerHTML = bdPh('ได้หน้าใหม่ต่อจากหน้านี้ ภาพกระดานอยู่ข้างหลัง เขียนทับได้ทันที' + (ai ? ' ถ้าให้ AI อ่าน ข้อความ สมการ ตาราง และรูปจะเป็นกล่องที่แก้ได้ในตำแหน่งเดิม' : ' ให้ AI อ่านเป็นตัวพิมพ์ได้เมื่อตั้งค่า AI แล้ว'));
}

/* ----- the page ----- */
async function bdPlace(ai) {
  if (!BD.raw || BD.busy || !S.nb) return;
  const A = await getAssets(); if (!A) { toast('มุมมองนี้เพิ่มรูปไม่ได้', 3500); return; }
  BD.busy = true; const FL = floatLine('กำลังวางหน้ากระดาน');
  try {
    if (BD.clean && !BD.out) BD.out = bdClean(BD.raw);
    const cvShow = bdCanvas(BD.clean ? BD.out : BD.raw);
    const up = await A.upload(await bdBlob(cvShow, 0.88), { type: 'image/jpeg' });
    let raw = null; if (BD.clean) { try { raw = (await A.upload(await bdBlob(bdCanvas(BD.raw), 0.82), { type: 'image/jpeg' })).id; } catch (e) { raw = null; } }
    const ar = Math.round(cvShow.height / cvShow.width * 1000) / 1000, land = ar < 0.95, [PW, PH] = pageDims(land ? { orient: 'land' } : null);
    let w = PW; if (ar * w > PH) w = Math.floor(PH / ar);
    let tb = []; try { tb = pdfInkBoxes(cvShow); } catch (e) { tb = []; }
    cvShow.width = cvShow.height = 1;
    const it = Object.assign({ id: 'i' + uid(), by: DEV, type: 'img', asset: up.id, x: Math.round((PW - w) / 2), y: 0, w, ar, lock: true, gbv: 1, bd: Object.assign({ v: 'clean' }, raw ? { raw } : {}) }, tb.length ? { tb } : {});
    const pid = 'p' + uid();
    await S.store.set('pages/' + pid, Object.assign({ nb: S.nid, paper: 'blank', items: [it], rev: now() }, land ? { orient: 'land' } : {}));
    const pages = ((S.nb && S.nb.pages) || []).slice(), at = pages.indexOf(S.pid); pages.splice(at < 0 ? pages.length : at + 1, 0, pid);
    await S.store.update('notebooks/' + S.nid, { pages, updatedAt: now() });
    S.nb = Object.assign({}, S.nb, { pages });
    bdClose(); openPage(pid); renderPageList(); renderTitle();
    if (up.queued) toast('วางหน้ากระดานแล้ว แต่ยังส่งภาพขึ้นคลาวด์ไม่ได้ เครื่องอื่นจะเห็นเมื่อส่งสำเร็จ', 5000);
    else if (!ai) toast('วางหน้ากระดานแล้ว หน้า ' + (pages.indexOf(pid) + 1) + ' เขียนทับได้เลย', 3000);
    if (ai) {
      /* once the new page is open */
      for (let i = 0; i < 100 && !(S.pid === pid && S.pageLoaded === pid && bdItem()); i++) await new Promise((r) => setTimeout(r, 50));
      if (S.pid === pid) { BD.busy = false; await bdRead(); }
    }
  } catch (e) { toast(typeof assetErr === 'function' ? assetErr(e) : 'วางหน้ากระดานไม่สำเร็จ', 4500); }
  finally { FL(); BD.busy = false; }
}
function bdItem() { return ((S.page && S.page.items) || []).find((x) => x && x.type === 'img' && x.bd && okAsset(x.asset)) || null; }

/* ----- the view of the board behind the page: cleaned, faint, the photo as it was, or hidden ----- */
const BD_VIEWS = [['clean', 'ชัด'], ['faint', 'จาง'], ['photo', 'ภาพถ่ายจริง'], ['off', 'ซ่อน']];
/* v given: that view; none: the next one */
function bdView(v) {
  const it = bdItem(); if (!it) return;
  const cur = it.bd.v || 'clean', list = BD_VIEWS.filter((x) => x[0] !== 'photo' || okAsset(it.bd.raw)).map((x) => x[0]);
  const next = v || list[(list.indexOf(cur) + 1) % list.length];
  const before = clone(S.page.items), items = clone(S.page.items), t = items.find((x) => x.id === it.id); t.bd = Object.assign({}, t.bd, { v: next });
  setItems(items, before);
}

/* ----- the AI reading: once, kept with the readings of the handwriting (task 8.16) ----- */
async function bdHash(blob) {
  const u = new Uint8Array(await blob.arrayBuffer()); let h = 2166136261 >>> 0, g = 5381;
  const step = Math.max(1, Math.floor(u.length / 200000));
  for (let i = 0; i < u.length; i += step) { const c = u[i]; h ^= c; h = Math.imul(h, 16777619) >>> 0; g = (Math.imul(g, 33) + c) >>> 0; }
  return u.length.toString(36) + h.toString(36) + g.toString(36);
}
async function bdMemo(h, v) {
  try {
    await flagsReady(); if (!inkOn()) return null; await need('aipages');
    if (v === undefined) return await ikBoard(h);
    await ikBoard(h, v); return v;
  } catch (e) { return null; }
}
function bdPrompt() {
  return 'This is a photo of a classroom board (a whiteboard, blackboard or projector screen), already straightened and cleaned. Lay it out again as an editable notebook page.\n'
    + 'Split everything written or drawn on it into blocks, in reading order (top to bottom, then left to right), and give where each block is.\n'
    + 'Kinds of block:\n'
    + '- text: words, a heading, a list, a label. Transcribe faithfully: Thai stays Thai, keep the line breaks of the board, maths inside text in $...$.\n'
    + '- eq: an equation or a derivation, one equation per line, LaTeX without $ signs. Vectors as \\vec{A} (the app draws a half arrow). \\frac, \\sqrt, subscripts, units with \\,\\mathrm{}, Thai words in \\text{}.\n'
    + '- table: a table drawn on the board, as a Markdown table (a header row, then a |---| row). Keep empty cells empty.\n'
    + '- graph: a plotted graph with axes. If the curve is a known function, write it on one line as y = ... in x; otherwise leave the block empty.\n'
    + '- fig: a drawing, sketch or diagram that is not writing. Write a short Thai caption of what it shows.\n'
    + 'Do not solve, correct or add anything. Leave out the frame of the board, the marker tray, magnets, an eraser, and anything that is not on the board.\n'
    + 'Coordinates: x0 y0 x1 y1, the box of the block on the photo, each from 0 to 1000 (x from the left edge across the width, y from the top edge down the height).\n'
    + 'Reply in exactly this format and nothing else, one block after another:\n'
    + '@@BLOCK kind x0 y0 x1 y1\n(content of the block)';
}
/* what the AI wrote, as blocks with a box (0..1000 of the picture each way) */
function bdParse(text) {
  const out = [];
  for (const s of sections(text)) {
    if (s.key !== 'BLOCK') continue;
    const a = s.arg.split(/\s+/), kind = String(a[0] || '').toLowerCase(), n = a.slice(1, 5).map(Number);
    if (!['text', 'eq', 'table', 'graph', 'fig'].includes(kind) || n.length < 4 || n.some((v) => !isFinite(v))) continue;
    const b = [clamp(Math.min(n[0], n[2]), 0, 1000), clamp(Math.min(n[1], n[3]), 0, 1000), clamp(Math.max(n[0], n[2]), 0, 1000), clamp(Math.max(n[1], n[3]), 0, 1000)];
    if (b[2] - b[0] < 3 || b[3] - b[1] < 3) continue;
    const body = String(s.text || '').replace(/^\s*```\w*\s*$/gm, '').trim();
    if (!body && kind !== 'graph' && kind !== 'fig') continue;
    out.push({ k: kind, b, t: body.slice(0, 4000) });
  }
  return out.slice(0, 80);
}
async function bdShot(blob) {
  const bm = await createImageBitmap(blob), k = Math.min(1, BD_AI / Math.max(bm.width, bm.height)), cv = document.createElement('canvas');
  cv.width = Math.round(bm.width * k); cv.height = Math.round(bm.height * k); cv.getContext('2d').drawImage(bm, 0, 0, cv.width, cv.height); if (bm.close) bm.close();
  const b = await bdBlob(cv, 0.86); cv.width = cv.height = 1; return b;
}
const BD_DONE = new Set();
async function bdRead() {
  const it = bdItem(); if (!it || BD.reading) return;
  let blob = null; try { blob = await getAssetBlob(it.asset); } catch (e) { blob = null; }
  if (!blob) { toast('ยังโหลดภาพกระดานไม่ได้ ลองอีกครั้ง', 3500); return; }
  const h = await bdHash(blob), again = BD_DONE.has(h);
  let blocks = again ? null : await bdMemo(h);
  if (blocks && blocks.length) { BD_DONE.add(h); await bdLay(it, blocks, blob, true); return; }
  if (!needAI('read')) return;
  const lim = AI.limits ? AI.limits('read') : null; if (lim && !lim.images) { toast('แหล่ง AI ที่ตั้งไว้สำหรับอ่านลายมือไม่รับภาพ เลือกแหล่งอื่นที่เมนู หัวข้อผู้ช่วย AI', 5000); return; }
  BD.reading = true;
  const ctl = new AbortController(); let timedOut = false;
  const B = floatWait('กำลังอ่านกระดาน', ['ส่งภาพกระดานให้ AI', 'AI กำลังอ่านข้อความ สมการ ตาราง และรูป', 'วางเป็นกล่องที่แก้ได้'], () => ctl.abort(), [it.x + 40, it.y + 40, it.x + 260, it.y + 100]);
  const limit = setTimeout(() => { timedOut = true; ctl.abort(); }, 150000);
  setTimeout(() => B.step(1), 1500);
  try {
    let res;
    try { res = await AI.run('read', bdPrompt(), { images: [await bdShot(blob)], signal: ctl.signal }); }
    catch (e) { if (e && e.code === 'cancelled' && timedOut) throw { code: 'timeout' }; throw e; }
    B.step(2);
    blocks = bdParse(res && res.text);
    if (!blocks.length) { B.close(); toast('AI ไม่พบสิ่งที่อ่านได้บนกระดานนี้ ภาพกระดานยังอยู่ในหน้า เขียนทับได้', 4500); return; }
    BD_DONE.add(h); bdMemo(h, blocks);
    B.close();
    if (S.page && (S.page.items || []).some((x) => x.id === it.id)) await bdLay(bdItem(), blocks, blob, false);
  } catch (e) { B.close(); if (!(e && e.code === 'cancelled' && !timedOut)) toast(aiErr(e), 5000); }
  finally { clearTimeout(limit); BD.reading = false; }
}
/* the blocks on the page where they were on the board; the boxes of an earlier reading of this board are replaced */
async function bdLay(it, blocks, blob, memo) {
  if (!it) return;
  const W0 = it.w, H0 = it.w * (it.ar || 0.7), X = (v) => it.x + v / 1000 * W0, Y = (v) => it.y + v / 1000 * H0;
  const add = [], cnt = { text: 0, eq: 0, table: 0, graph: 0, fig: 0 };
  let bm = null; const pic = async () => { if (!bm) bm = await createImageBitmap(blob); return bm; };
  const A = await getAssets();
  const cut = async (b) => {
    if (!A) return null;
    const im = await pic(), p = 12, sx = Math.max(0, b[0] / 1000 * im.width - p), sy = Math.max(0, b[1] / 1000 * im.height - p), sw = Math.min(im.width - sx, (b[2] - b[0]) / 1000 * im.width + 2 * p), sh = Math.min(im.height - sy, (b[3] - b[1]) / 1000 * im.height + 2 * p);
    if (sw < 8 || sh < 8) return null;
    const cv = document.createElement('canvas'); cv.width = Math.round(sw); cv.height = Math.round(sh); const c = cv.getContext('2d'); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(im, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    const up = await A.upload(await bdBlob(cv, 0.9), { type: 'image/jpeg' }); const ar = cv.height / cv.width; cv.width = cv.height = 1;
    return { asset: up.id, ar: Math.round(ar * 1000) / 1000, x: Math.round(it.x + sx / im.width * W0), y: Math.round(it.y + sy / im.height * H0), w: Math.max(40, Math.round(sw / im.width * W0)) };
  };
  for (const k of blocks) {
    const x = Math.round(X(k.b[0])), y = Math.round(Y(k.b[1])), bw = X(k.b[2]) - X(k.b[0]), bh = Y(k.b[3]) - Y(k.b[1]);
    if (k.k === 'text' || k.k === 'eq') {
      const lines = k.t.split('\n').map((l) => l.trim()).filter(Boolean); if (!lines.length) continue;
      const md = k.k === 'eq' ? lines.map((l) => '$$' + l.replace(/^\$+|\$+$/g, '').replace(/^\\\[|\\\]$/g, '').trim() + '$$').join('\n') : lines.join('\n');
      const fs = Math.round(clamp(bh / lines.length * (k.k === 'eq' ? 0.5 : 0.62), 14, 48));
      add.push({ type: 'text', x, y, w: Math.round(clamp(bw * 1.15 + fs, 120, it.x + W0 - x)), md, fs }); cnt[k.k]++;
    } else if (k.k === 'table' && /\|/.test(k.t)) {
      const rows = k.t.split('\n').filter((l) => /\|/.test(l) && !/^\s*\|[\s:|-]+\|\s*$/.test(l)).length || 1;
      add.push({ type: 'text', x, y, w: Math.round(clamp(bw, 200, it.x + W0 - x)), md: k.t.split('\n').filter((l) => /\|/.test(l)).join('\n'), fs: Math.round(clamp(bh / rows * 0.42, 13, 28)) }); cnt.table++;
    } else {
      let g = null;
      if (k.k === 'graph' && /=/.test(k.t) && flagOn('typed')) { try { await need('typed'); await loadLib('math'); g = tyGraph(k.t); } catch (e) { g = null; } }
      if (g) { add.push(Object.assign({ x, y, w: Math.round(clamp(bw, 320, 700)) }, g)); cnt.graph++; continue; }
      let c = null; try { c = await cut(k.b); } catch (e) { c = null; }
      if (c) { add.push(Object.assign({ type: 'img' }, c, k.t ? { alt: k.t.slice(0, 120) } : {})); cnt[k.k === 'graph' ? 'graph' : 'fig']++; }
    }
  }
  if (bm && bm.close) bm.close();
  if (!add.length || !S.page) { toast('ไม่มีสิ่งที่วางได้จากการอ่านครั้งนี้', 3500); return; }
  const before = clone(S.page.items || []);
  const items = before.filter((x) => x.bdk !== it.id).map((x) => (x.id === it.id ? Object.assign({}, x, { bd: Object.assign({}, x.bd, { v: 'faint' }) }) : x));
  for (const a of add) items.push(Object.assign({ id: 'i' + uid(), by: DEV, bdk: it.id }, a));
  setItems(items, before);
  const parts = [['text', 'ข้อความ'], ['eq', 'สมการ'], ['table', 'ตาราง'], ['graph', 'กราฟ'], ['fig', 'รูป']].filter((p) => cnt[p[0]]).map((p) => p[1] + ' ' + cnt[p[0]]);
  toast('วางจากกระดานแล้ว ' + parts.join(' ') + (memo ? ' จากที่อ่านไว้แล้ว' : '') + ' แก้ได้ทุกกล่อง ภาพกระดานจางอยู่ข้างหลัง เลือกดูชัด จาง หรือภาพถ่ายจริงได้ที่แถบ หน้านี้ ในลิ้นชักหน้า', 6000);
}

