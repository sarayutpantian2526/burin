/* BURIN part: ar (loaded when first used) */
/* ---------- task 9.0: does "see it in the room" (AR) work on this device? The app builds the files here, with no AI
   and no internet: .usdz for AR Quick Look (iPad, iPhone) and .glb for Android and other 3D apps. Three samples
   (a box, a ball with a Thai label, one living model of scene3 that moves), every way of opening the file can be
   tried and marked, and the measurements are copied out for the owner. Both formats use Y up and metres ---------- */
const AR = { log: [], cur: null, built: {}, busy: false };
const AR_CACHE = 'burin-ar', AR_DIR = 'ar-tmp/';

/* small vector helpers of this part (scene3 keeps its own inside its part) */
const aAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], aSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], aMul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const aDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], aCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const aUnit = (a) => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };

/* ----- meshes ----- */
function arMesh() { return { p: [], n: [], uv: [], i: [] }; }
function arVert(m, p, n, uv) { m.p.push(p[0], p[1], p[2]); m.n.push(n[0], n[1], n[2]); m.uv.push(uv[0], uv[1]); return m.p.length / 3 - 1; }
/* a flat four sided face a b c d (counter clockwise seen from the front); two = also a back face */
function arQuad(m, a, b, c, d, two) {
  const u = aSub(b, a), v = aSub(d, a), n = aUnit(aCross(u, v));
  const k = [arVert(m, a, n, [0, 0]), arVert(m, b, n, [1, 0]), arVert(m, c, n, [1, 1]), arVert(m, d, n, [0, 1])];
  m.i.push(k[0], k[1], k[2], k[0], k[2], k[3]);
  if (two) { const nb = aMul(n, -1), q = [arVert(m, a, nb, [0, 0]), arVert(m, b, nb, [1, 0]), arVert(m, c, nb, [1, 1]), arVert(m, d, nb, [0, 1])]; m.i.push(q[0], q[2], q[1], q[0], q[3], q[2]); }
  return m;
}
function arBox(sx, sy, sz) {
  const m = arMesh(), x = sx / 2, y = sy / 2, z = sz / 2, P = (a, b, c) => [a * x, b * y, c * z];
  arQuad(m, P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)); arQuad(m, P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1));
  arQuad(m, P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1)); arQuad(m, P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1));
  arQuad(m, P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1)); arQuad(m, P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1));
  return m;
}
function arSphere(r, seg, rings) {
  const m = arMesh();
  for (let j = 0; j <= rings; j++) for (let i = 0; i <= seg; i++) {
    const th = j / rings * Math.PI, ph = i / seg * 2 * Math.PI, n = [Math.sin(th) * Math.cos(ph), Math.cos(th), -Math.sin(th) * Math.sin(ph)];
    arVert(m, aMul(n, r), n, [i / seg, 1 - j / rings]);
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; if (j) m.i.push(a, b, a + 1); if (j < rings - 1) m.i.push(a + 1, b, b + 1); }
  return m;
}
function arTris(m) { return m.i.length / 3; }

/* ----- colours: the files want linear light, the app picks colours in sRGB ----- */
function arLin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function arRgb(hex) { const h = String(hex || '#5A6472').replace('#', ''), v = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16) || 0; return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; }

/* ----- a label: text on a pale card, drawn here, kept as a picture in the file ----- */
function arLabelCanvas(text) {
  const font = (getComputedStyle(document.documentElement).getPropertyValue('--doc') || '').trim() || 'Sarabun, sans-serif';
  const c = document.createElement('canvas'), g = c.getContext('2d'), px = 56;
  g.font = '600 ' + px + 'px ' + font; const w = Math.min(1024, Math.ceil(g.measureText(text).width) + px * 1.2);
  c.width = 1 << Math.ceil(Math.log2(w)); c.height = 128;
  const x0 = (c.width - w) / 2, r = 26;
  g.fillStyle = 'rgba(255,255,255,0.94)'; g.strokeStyle = 'rgba(20,26,34,0.35)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(x0 + r, 8); g.arcTo(x0 + w - 4, 8, x0 + w - 4, 120, r); g.arcTo(x0 + w - 4, 120, x0 + 4, 120, r); g.arcTo(x0 + 4, 120, x0 + 4, 8, r); g.arcTo(x0 + 4, 8, x0 + w - 4, 8, r); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#141A22'; g.font = '600 ' + px + 'px ' + font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, 66);
  return { canvas: c, aspect: c.width / c.height };
}
function arPng(canvas) { return new Promise((res) => canvas.toBlob((b) => (b ? b.arrayBuffer().then((a) => res(new Uint8Array(a))) : res(new Uint8Array(0))), 'image/png')); }
/* a card that stands upright, facing the front (+z), its bottom edge at y = 0; w is its width in metres */
function arCard(text, w) {
  const L = arLabelCanvas(text), h = w / L.aspect, m = arMesh();
  arQuad(m, [-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h, 0], [-w / 2, h, 0], true);
  return { mesh: m, mat: { c: [1, 1, 1], rough: 0.9, metal: 0, tex: L.canvas, alpha: true }, h };
}

/* ----- the three samples ----- */
const AR_SAMPLES = [
  { id: 'box', name: 'กล่อง', note: 'ลูกบาศก์ด้านละ 20\u00a0เซนติเมตร' },
  { id: 'ball', name: 'ลูกบอลกับข้อความ', note: 'ลูกบอลรัศมี 10\u00a0เซนติเมตร มีป้ายข้อความภาษาไทย' },
  { id: 'scene', name: 'แบบจำลองลูกบอลกับพื้นเอียง', note: 'แบบจำลองสามมิติของแอป ลูกบอลตกกระดอนบนพื้นเอียง เล่นซ้ำทุก 4\u00a0วินาที' }
];
async function arSample(id) {
  if (id === 'box') return { id, nodes: [{ name: 'Box', mesh: arBox(0.2, 0.2, 0.2), mat: { c: arRgb('#2F4BB8'), rough: 0.5, metal: 0 }, t: [0, 0.1, 0] }] };
  if (id === 'ball') {
    const card = arCard('ลูกบอล m = 0.5 kg', 0.26);
    return { id, nodes: [{ name: 'Ball', mesh: arSphere(0.1, 32, 20), mat: { c: arRgb('#C2571A'), rough: 0.35, metal: 0 }, t: [0, 0.1, 0] }, Object.assign({ name: 'Label', t: [0, 0.24, 0] }, card)] };
  }
  /* one living model of scene3, worked out here with its own physics and kept as frames in the file */
  await need('scene');
  const tpl = (SCENE_TPL['3d'] || []).find((x) => x[2] && x[2].title === 'ลูกบอลกับพื้นเอียง');
  if (!tpl) throw new Error('ar: no scene3 model');
  const sp = scClean(JSON.parse(JSON.stringify(tpl[2]))), p3Init = MODEV.scene('p3Init'), p3Step = MODEV.scene('p3Step');
  const st = p3Init(sp), fps = 30, secs = 4, frames = [], L = sp.world.size * 1.1, k = 0.3 / L, Y = (q) => [q[0] * k, q[2] * k, -q[1] * k];
  const B = st.bodies[0];
  for (let f = 0; f < fps * secs; f++) { frames.push(Y(B.p)); const n = Math.ceil((1 / fps) / 0.002); for (let i = 0; i < n; i++) p3Step(sp, st, 1 / fps / n); }
  const ground = arQuad(arMesh(), Y([-L, -L, 0]), Y([L, -L, 0]), Y([L, L, 0]), Y([-L, L, 0]), true);
  const nodes = [{ name: 'Ground', mesh: ground, mat: { c: arRgb('#D6E2F0'), rough: 0.9, metal: 0 }, t: [0, 0, 0] }];
  sp.planes.forEach((q, i) => {
    const u = aUnit(Math.abs(q.n[2]) < 0.9 ? aCross(q.n, [0, 0, 1]) : aCross(q.n, [1, 0, 0])), v = aCross(q.n, u), s = q.size;
    const pt = [[-s, -s * 1.5], [s, -s * 1.5], [s, s * 1.5], [-s, s * 1.5]].map(([a, b]) => Y(aAdd(q.p, aAdd(aMul(u, a), aMul(v, b)))));
    nodes.push({ name: 'Slope' + (i + 1), mesh: arQuad(arMesh(), pt[0], pt[1], pt[2], pt[3], true), mat: { c: arRgb('#B0966E'), rough: 0.8, metal: 0 }, t: [0, 0, 0] });
  });
  nodes.push({ name: 'Ball', mesh: arSphere(B.b.r * k, 24, 16), mat: { c: arRgb(B.b.color), rough: 0.35, metal: 0 }, t: frames[0], anim: { fps, frames } });
  const card = arCard(sp.title, 0.3);
  nodes.push(Object.assign({ name: 'Title', t: [0, L * k * 0.9, -L * k] }, card));
  return { id, nodes, fps, frames: frames.length };
}

/* ----- textures of a sample, as PNG bytes (once per node) ----- */
async function arTextures(sc) { for (const nd of sc.nodes) if (nd.mat.tex && !nd.mat.png) nd.mat.png = await arPng(nd.mat.tex); }
function arF(x) { const v = Math.round(x * 1e5) / 1e5; return Object.is(v, -0) ? '0' : String(v); }
function arExtent(p) { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[i + a]); hi[a] = Math.max(hi[a], p[i + a]); } return [lo, hi]; }

/* ----- .usdz: an ASCII USD layer plus the pictures, in a zip that stores (no compression) with every file
   starting on a 64 byte boundary, as AR Quick Look asks ----- */
function arUsda(sc) {
  const anim = sc.nodes.some((n) => n.anim), o = [];
  const t3 = (a) => '(' + arF(a[0]) + ', ' + arF(a[1]) + ', ' + arF(a[2]) + ')', list = (a, d) => { const r = []; for (let i = 0; i < a.length; i += d) r.push(d === 3 ? '(' + arF(a[i]) + ', ' + arF(a[i + 1]) + ', ' + arF(a[i + 2]) + ')' : '(' + arF(a[i]) + ', ' + arF(a[i + 1]) + ')'); return '[' + r.join(', ') + ']'; };
  o.push('#usda 1.0', '(', '    customLayerData = {', '        string creator = "BURIN"', '    }', '    defaultPrim = "Root"', '    metersPerUnit = 1', '    upAxis = "Y"');
  if (anim) o.push('    startTimeCode = 0', '    endTimeCode = ' + (sc.frames - 1), '    timeCodesPerSecond = ' + sc.fps);
  o.push(')', '', 'def Xform "Root" (', '    kind = "component"', ')', '{', '    def Scope "Materials"', '    {');
  sc.nodes.forEach((nd, i) => {
    const M = '/Root/Materials/M' + i, m = nd.mat;
    o.push('        def Material "M' + i + '"', '        {');
    o.push('            token outputs:surface.connect = <' + M + '/PBR.outputs:surface>', '', '            def Shader "PBR"', '            {', '                uniform token info:id = "UsdPreviewSurface"');
    if (m.png) o.push('                color3f inputs:diffuseColor.connect = <' + M + '/Tex.outputs:rgb>', '                float inputs:opacity.connect = <' + M + '/Tex.outputs:a>');
    else o.push('                color3f inputs:diffuseColor = ' + t3(m.c.map(arLin)));
    o.push('                float inputs:metallic = ' + arF(m.metal), '                float inputs:roughness = ' + arF(m.rough), '                token outputs:surface', '            }');
    if (m.png) o.push('', '            def Shader "St"', '            {', '                uniform token info:id = "UsdPrimvarReader_float2"', '                float2 inputs:fallback = (0, 0)', '                token inputs:varname = "st"', '                float2 outputs:result', '            }',
      '', '            def Shader "Tex"', '            {', '                uniform token info:id = "UsdUVTexture"', '                asset inputs:file = @textures/t' + i + '.png@', '                float2 inputs:st.connect = <' + M + '/St.outputs:result>', '                token inputs:sourceColorSpace = "sRGB"', '                token inputs:wrapS = "clamp"', '                token inputs:wrapT = "clamp"', '                float3 outputs:rgb', '                float outputs:a', '            }');
    o.push('        }');
  });
  o.push('    }');
  sc.nodes.forEach((nd, i) => {
    const m = nd.mesh, ex = arExtent(m.p), tris = [];
    for (let k = 0; k < m.i.length / 3; k++) tris.push(3);
    o.push('', '    def Xform "' + nd.name + '"', '    {');
    if (nd.anim) o.push('        double3 xformOp:translate.timeSamples = {', nd.anim.frames.map((f, k) => '            ' + k + ': ' + t3(f) + ',').join('\n'), '        }');
    else o.push('        double3 xformOp:translate = ' + t3(nd.t));
    o.push('        uniform token[] xformOpOrder = ["xformOp:translate"]', '', '        def Mesh "Geom" (', '            prepend apiSchemas = ["MaterialBindingAPI"]', '        )', '        {',
      '            float3[] extent = [' + t3(ex[0]) + ', ' + t3(ex[1]) + ']', '            int[] faceVertexCounts = [' + tris.join(', ') + ']', '            int[] faceVertexIndices = [' + m.i.join(', ') + ']',
      '            rel material:binding = </Root/Materials/M' + i + '>', '            normal3f[] normals = ' + list(m.n, 3) + ' (', '                interpolation = "vertex"', '            )', '            point3f[] points = ' + list(m.p, 3),
      '            texCoord2f[] primvars:st = ' + list(m.uv, 2) + ' (', '                interpolation = "vertex"', '            )', '            uniform token subdivisionScheme = "none"', '        }', '    }');
  });
  o.push('}', '');
  return o.join('\n');
}
let AR_CRC = null;
function arCrc(u8) {
  if (!AR_CRC) { AR_CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; AR_CRC[n] = c >>> 0; } }
  let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = AR_CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0;
}
function arZip(files) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = arCrc(f.data), at = off + 30 + name.length;
    let pad = (64 - ((at + 4) % 64)) % 64; const extra = 4 + pad;
    const h = new DataView(new ArrayBuffer(30 + name.length + extra));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint16(12, 33, true);
    h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, extra, true);
    new Uint8Array(h.buffer).set(name, 30); h.setUint16(30 + name.length, 0x1986, true); h.setUint16(32 + name.length, pad, true);
    parts.push(new Uint8Array(h.buffer), f.data);
    const c = new DataView(new ArrayBuffer(46 + name.length));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 33, true); c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true); new Uint8Array(c.buffer).set(name, 46); cen.push(new Uint8Array(c.buffer));
    off += h.byteLength + f.data.length;
  }
  const cs = cen.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  return arJoin(parts.concat(cen, [new Uint8Array(e.buffer)]));
}
function arJoin(list) { const n = list.reduce((a, b) => a + b.length, 0), out = new Uint8Array(n); let k = 0; for (const b of list) { out.set(b, k); k += b.length; } return out; }
async function arUsdz(sc) {
  await arTextures(sc);
  const files = [{ name: 'model.usda', data: new TextEncoder().encode(arUsda(sc)) }];
  sc.nodes.forEach((nd, i) => { if (nd.mat.png) files.push({ name: 'textures/t' + i + '.png', data: nd.mat.png }); });
  return arZip(files);
}

/* ----- .glb: glTF 2.0 in one binary file ----- */
async function arGlb(sc) {
  await arTextures(sc);
  const bin = [], views = [], accs = [], meshes = [], nodes = [], mats = [], images = [], textures = [], chans = [], samps = []; let len = 0;
  const view = (u8, target) => { const pad = (4 - (len % 4)) % 4; if (pad) { bin.push(new Uint8Array(pad)); len += pad; } const v = { buffer: 0, byteOffset: len, byteLength: u8.length }; if (target) v.target = target; views.push(v); bin.push(u8); len += u8.length; return views.length - 1; };
  const acc = (arr, type, ct, target, mm) => { const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), a = { bufferView: view(u8, target), componentType: ct, count: arr.length / ({ SCALAR: 1, VEC2: 2, VEC3: 3 })[type], type }; if (mm) { a.min = mm[0]; a.max = mm[1]; } accs.push(a); return accs.length - 1; };
  sc.nodes.forEach((nd, i) => {
    const m = nd.mesh, P = new Float32Array(m.p), uv = new Float32Array(m.uv);
    for (let k = 1; k < uv.length; k += 2) uv[k] = 1 - uv[k]; /* glTF counts v from the top of a picture */
    const I = m.p.length / 3 > 65535 ? new Uint32Array(m.i) : new Uint16Array(m.i), mt = nd.mat;
    const pbr = { metallicFactor: mt.metal, roughnessFactor: mt.rough, baseColorFactor: mt.png ? [1, 1, 1, 1] : mt.c.map(arLin).concat([1]) };
    if (mt.png) { images.push({ bufferView: view(mt.png), mimeType: 'image/png' }); textures.push({ source: images.length - 1, sampler: 0 }); pbr.baseColorTexture = { index: textures.length - 1 }; }
    mats.push({ name: 'M' + i, pbrMetallicRoughness: pbr, alphaMode: mt.alpha ? 'BLEND' : 'OPAQUE' });
    meshes.push({ name: nd.name, primitives: [{ attributes: Object.assign({ POSITION: acc(P, 'VEC3', 5126, 34962, arExtent(m.p)), NORMAL: acc(new Float32Array(m.n), 'VEC3', 5126, 34962) }, mt.png ? { TEXCOORD_0: acc(uv, 'VEC2', 5126, 34962) } : {}), indices: acc(I, 'SCALAR', I instanceof Uint32Array ? 5125 : 5123, 34963), material: i }] });
    nodes.push({ name: nd.name, mesh: i, translation: nd.t.slice() });
    if (nd.anim) {
      const n = nd.anim.frames.length, T = new Float32Array(n), V = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { T[k] = k / nd.anim.fps; V.set(nd.anim.frames[k], k * 3); }
      samps.push({ input: acc(T, 'SCALAR', 5126, 0, [[0], [T[n - 1]]]), output: acc(V, 'VEC3', 5126), interpolation: 'LINEAR' }); chans.push({ sampler: samps.length - 1, target: { node: i, path: 'translation' } });
    }
  });
  const pad = (4 - (len % 4)) % 4; if (pad) { bin.push(new Uint8Array(pad)); len += pad; }
  const js = { asset: { version: '2.0', generator: 'BURIN' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, materials: mats, accessors: accs, bufferViews: views, buffers: [{ byteLength: len }] };
  if (images.length) { js.images = images; js.textures = textures; js.samplers = [{ magFilter: 9729, minFilter: 9729, wrapS: 33071, wrapT: 33071 }]; }
  if (chans.length) js.animations = [{ name: 'play', channels: chans, samplers: samps }];
  let J = new TextEncoder().encode(JSON.stringify(js)); const jp = (4 - (J.length % 4)) % 4; if (jp) { const t = new Uint8Array(J.length + jp); t.set(J); t.fill(32, J.length); J = t; }
  const head = new DataView(new ArrayBuffer(20)), bh = new DataView(new ArrayBuffer(8));
  head.setUint32(0, 0x46546C67, true); head.setUint32(4, 2, true); head.setUint32(8, 12 + 8 + J.length + 8 + len, true); head.setUint32(12, J.length, true); head.setUint32(16, 0x4E4F534A, true);
  bh.setUint32(0, len, true); bh.setUint32(4, 0x004E4942, true);
  return arJoin([new Uint8Array(head.buffer), J, new Uint8Array(bh.buffer)].concat(bin));
}

/* ----- a small still picture of the sample (also the thing to tap for AR Quick Look) ----- */
function arThumb(sc, W, H) {
  const c = document.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1); c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = '#F3F5F8'; g.fillRect(0, 0, W, H);
  const yaw = 0.6, pitch = 0.42, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), spp = Math.sin(pitch);
  const all = []; let r = 0.01, mid = [0, 0, 0], cnt = 0;
  for (const nd of sc.nodes) { const m = nd.mesh; for (let i = 0; i < m.p.length; i += 3) { const q = [m.p[i] + nd.t[0], m.p[i + 1] + nd.t[1], m.p[i + 2] + nd.t[2]]; mid = aAdd(mid, q); cnt++; } }
  mid = aMul(mid, 1 / Math.max(1, cnt));
  const view = (q) => { const x = q[0] - mid[0], y = q[1] - mid[1], z = q[2] - mid[2], x1 = x * cy - z * sy, z1 = x * sy + z * cy, y1 = y * cp - z1 * spp, z2 = y * spp + z1 * cp; return [x1, y1, z2]; };
  for (const nd of sc.nodes) { const m = nd.mesh; for (let i = 0; i < m.p.length; i += 3) { const v = view([m.p[i] + nd.t[0], m.p[i + 1] + nd.t[1], m.p[i + 2] + nd.t[2]]); r = Math.max(r, Math.abs(v[0]), Math.abs(v[1])); } }
  const s = Math.min(W, H) * 0.44 / r, X = (v) => [W / 2 + v[0] * s, H / 2 - v[1] * s], light = aUnit([0.4, 0.9, 0.5]);
  for (const nd of sc.nodes) {
    const m = nd.mesh, P = (k) => view([m.p[k * 3] + nd.t[0], m.p[k * 3 + 1] + nd.t[1], m.p[k * 3 + 2] + nd.t[2]]);
    if (nd.mat.tex) { const a = P(0), b = P(1), d = P(3), A = X(a), Bq = X(b), D = X(d); all.push({ z: (a[2] + b[2] + d[2]) / 3, img: nd.mat.tex, A, B: Bq, D }); continue; }
    for (let k = 0; k < m.i.length; k += 3) {
      const ia = m.i[k], ib = m.i[k + 1], ic = m.i[k + 2], a = P(ia), b = P(ib), cc = P(ic), nz = (b[0] - a[0]) * (cc[1] - a[1]) - (b[1] - a[1]) * (cc[0] - a[0]);
      if (nz <= 0) continue; /* back faces */
      const n = [m.n[ia * 3], m.n[ia * 3 + 1], m.n[ia * 3 + 2]], l = 0.45 + 0.55 * Math.max(0, aDot(n, light));
      all.push({ z: (a[2] + b[2] + cc[2]) / 3, pts: [X(a), X(b), X(cc)], col: 'rgb(' + nd.mat.c.map((x) => Math.round(255 * Math.min(1, x * l))).join(',') + ')' });
    }
  }
  all.sort((p, q) => p.z - q.z);
  for (const t of all) {
    if (t.img) { g.save(); const w = t.img.width, h = t.img.height; g.setTransform(dpr * (t.B[0] - t.A[0]) / w, dpr * (t.B[1] - t.A[1]) / w, dpr * (t.D[0] - t.A[0]) / h, dpr * (t.D[1] - t.A[1]) / h, dpr * t.A[0], dpr * t.A[1]); g.translate(0, h); g.scale(1, -1); g.drawImage(t.img, 0, 0); g.restore(); continue; }
    g.fillStyle = t.col; g.strokeStyle = t.col; g.lineWidth = 1; g.lineJoin = 'round'; g.beginPath(); g.moveTo(t.pts[0][0], t.pts[0][1]); g.lineTo(t.pts[1][0], t.pts[1][1]); g.lineTo(t.pts[2][0], t.pts[2][1]); g.closePath(); g.fill(); g.stroke();
  }
  return c;
}

/* ----- build both files of a sample, with the time it took and the memory the files and pictures hold ----- */
function arHeap() { try { return performance.memory ? performance.memory.usedJSHeapSize : 0; } catch (e) { return 0; } }
async function arBuild(id) {
  const h0 = arHeap(), t0 = performance.now();
  const sc = await arSample(id), t1 = performance.now();
  const usdz = await arUsdz(sc), t2 = performance.now();
  const glb = await arGlb(sc), t3 = performance.now();
  const h1 = arHeap(), tris = sc.nodes.reduce((a, n) => a + arTris(n.mesh), 0), tex = sc.nodes.reduce((a, n) => a + (n.mat.png ? n.mat.png.length + n.mat.tex.width * n.mat.tex.height * 4 : 0), 0);
  const out = { id, sc, usdz, glb, tris, ms: { model: Math.round(t1 - t0), usdz: Math.round(t2 - t1), glb: Math.round(t3 - t2) }, heap: h1 && h0 ? h1 - h0 : 0, held: usdz.length + glb.length + tex };
  AR.built[id] = out; return out;
}

/* ----- what this device says it can do ----- */
function arEnv() {
  const a = document.createElement('a'), ua = navigator.userAgent || '';
  const standalone = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1), android = /Android/.test(ua);
  let rel = false; try { rel = !!(a.relList && a.relList.supports && a.relList.supports('ar')); } catch (e) { rel = false; }
  return { standalone, ios, android, rel, sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), share: !!(navigator.canShare), ua, xr: null };
}
function arEnvText(E) {
  const where = E.standalone ? 'แอปบนหน้าจอโฮม' : 'เบราว์เซอร์';
  const ql = E.rel ? 'เครื่องบอกว่าเปิด AR\u00a0Quick\u00a0Look จากหน้านี้ได้' : 'เครื่องไม่บอกว่าเปิด AR\u00a0Quick\u00a0Look จากหน้านี้ได้';
  const xr = E.xr === true ? 'มี WebXR แบบเห็นห้องจริง' : E.xr === false ? 'ไม่มี WebXR แบบเห็นห้องจริง' : 'ยังไม่ทราบเรื่อง WebXR';
  return 'เปิดจาก' + where + ' ' + ql + ' ' + xr;
}
/* lines break only at the spaces between phrases (a number keeps its unit with a no-break space) */
function arPh(t) { return String(t).split(/ (?!ๆ)/).map((w) => '<span class="nowrap">' + esc(w) + '</span>').join(' '); }
function arKb(n) { return n < 1024 * 1024 ? (n / 1024).toFixed(1) + '\u00a0KB' : (n / 1048576).toFixed(2) + '\u00a0MB'; }

/* ----- the sheet ----- */
function arStyle() {
  if ($('#arStyle')) return;
  const s = document.createElement('style'); s.id = 'arStyle';
  s.textContent = '#arSheet .archips { display: flex; flex-wrap: wrap; gap: 8px; }\n#arSheet .arcard { display: grid; grid-template-columns: 240px 1fr; gap: 14px; align-items: start; }\n'
    + '#arSheet .arpic { display: block; width: 240px; height: 180px; border-radius: 14px; overflow: hidden; border: 1px solid var(--line); background: var(--surface-2); }\n#arSheet .arpic img { width: 240px; height: 180px; display: block; }\n'
    + '#arSheet .armeta { font-size: 13px; color: var(--muted); line-height: 1.6; }\n#arSheet .arways { display: flex; flex-wrap: wrap; gap: 8px; }\n#arSheet .arways a.btn { text-decoration: none; color: inherit; }\n#arSheet .arways a.btn img { width: 26px; height: 20px; border-radius: 4px; object-fit: cover; }\n'
    + '#arSheet .arlog { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }\n#arSheet .arrow { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); }\n#arSheet .arrow span { flex: 1 1 220px; }\n'
    + '#arSheet .arrow .chip[aria-pressed="true"] { background: var(--chrome); color: var(--chrome-fg); }\n#arSheet textarea { width: 100%; min-height: 120px; font-size: 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); color: var(--fg); box-sizing: border-box; padding: 8px; -webkit-user-select: text; user-select: text; }\n'
    + '@media (max-width: 560px) { #arSheet .arcard { grid-template-columns: 1fr; } }';
  document.head.appendChild(s);
}
function arSheet() {
  let sh = $('#arSheet'); if (sh) return sh;
  arStyle();
  sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'arSheet'; sh.hidden = true;
  sh.innerHTML = '<div class="panel wide" role="dialog" aria-label="ลองดูในห้องจริง"><div class="histtop"><h2>ลองดูในห้องจริง</h2><button class="btn" id="bArClose" type="button">ปิด</button></div>'
    + '<div class="note" id="arEnv"></div><div class="note">' + arPh('เลือกวัตถุ แล้วลองเปิดทีละทาง เปิดแล้วกลับมาที่หน้านี้ แตะว่าเห็นวัตถุในห้องหรือไม่ แล้วกด คัดลอกผล ส่งให้ผู้พัฒนา') + '</div>'
    /* iPad Air 3 has no depth sensor: it finds the table from the camera picture alone, so a plain, shiny or dark
       table can leave only the system's see-through square that asks for the device to move */
    + '<div class="note" id="arTip">' + arPh('ถ้าเห็นแต่กรอบสี่เหลี่ยมโปร่ง แปลว่าเครื่องกำลังหาพื้นโต๊ะ ส่องไปที่โต๊ะที่มีลวดลาย หรือวางหนังสือที่เปิดไว้บนโต๊ะ ห่างราว 50\u00a0เซนติเมตร ในที่ที่สว่างพอ แล้วเลื่อนเครื่องช้า ๆ ไปทางซ้ายและขวา ถ้ายังไม่ขึ้น แตะ วัตถุ (Object) ด้านบนของจอ เพื่อหมุนดูโดยไม่ใช้กล้อง') + '</div>'
    + '<div class="archips" id="arPick"></div><div id="arOut"></div><h3>ผลที่ลองแล้ว</h3><div class="arlog" id="arLog"></div>'
    + '<textarea id="arText" readonly aria-label="ผลทั้งหมด"></textarea><div class="row2"><button class="btn solid" id="bArCopy" type="button">คัดลอกผล</button></div></div>';
  document.body.appendChild(sh);
  sh.addEventListener('click', (e) => { if (e.target === sh) sh.hidden = true; });
  $('#bArClose').onclick = () => { sh.hidden = true; };
  $('#bArCopy').onclick = () => { const t = $('#arText'); t.value = arReport(); const done = () => toast('คัดลอกผลแล้ว'); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(done, () => { t.select(); try { document.execCommand('copy'); done(); } catch (x) { /* the text stays to copy by hand */ } }); else { t.select(); try { document.execCommand('copy'); done(); } catch (x) { /* by hand */ } } };
  const pick = $('#arPick');
  AR_SAMPLES.forEach((s) => { const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.dataset.id = s.id; b.textContent = s.name; b.setAttribute('aria-pressed', 'false'); b.onclick = () => arShow(s.id); pick.appendChild(b); });
  return sh;
}
async function arOpen() {
  const sh = arSheet(); sh.hidden = false;
  AR.env = arEnv(); $('#arEnv').innerHTML = arPh(arEnvText(AR.env));
  if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-ar').then((v) => { AR.env.xr = !!v; $('#arEnv').innerHTML = arPh(arEnvText(AR.env)); arText(); }, () => { AR.env.xr = false; });
  else AR.env.xr = false;
  arText();
  if (!AR.cur) arShow('box');
}
function arUrl(id, ext) { const b = AR.built[id]; b.urls = b.urls || {}; if (!b.urls[ext]) b.urls[ext] = URL.createObjectURL(new Blob([ext === 'usdz' ? b.usdz : b.glb], { type: ext === 'usdz' ? 'model/vnd.usdz+zip' : 'model/gltf-binary' })); return b.urls[ext]; }
/* the same file kept for the app's offline helper (sw.js), so it also has an ordinary address on this website */
function arKeep(id) {
  const b = AR.built[id]; if (!window.caches || !AR.env || !AR.env.sw) return Promise.resolve(false);
  return caches.open(AR_CACHE).then((c) => Promise.all([c.put(new Request(AR_DIR + 'burin-' + id + '.usdz'), new Response(new Blob([b.usdz]), { headers: { 'Content-Type': 'model/vnd.usdz+zip' } })), c.put(new Request(AR_DIR + 'burin-' + id + '.glb'), new Response(new Blob([b.glb]), { headers: { 'Content-Type': 'model/gltf-binary' } }))])).then(() => true, () => false);
}
async function arShow(id) {
  if (AR.busy) return; AR.busy = true; AR.cur = id;
  document.querySelectorAll('#arPick .chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === id ? 'true' : 'false'));
  const out = $('#arOut'); out.innerHTML = '<div class="note">' + arPh('กำลังสร้างไฟล์') + '</div>';
  let b;
  try { b = AR.built[id] || await arBuild(id); } catch (e) { out.innerHTML = '<div class="note">' + arPh('สร้างไฟล์ไม่ได้ ลองใหม่อีกครั้ง') + '</div>'; AR.busy = false; return; }
  const kept = await arKeep(id), S0 = AR_SAMPLES.find((s) => s.id === id), pic = arThumb(b.sc, 240, 180).toDataURL('image/png');
  const usdz = arUrl(id, 'usdz'), glb = arUrl(id, 'glb');
  out.innerHTML = '';
  const card = document.createElement('div'); card.className = 'arcard';
  const a = document.createElement('a'); a.className = 'arpic'; a.rel = 'ar'; a.href = usdz; a.id = 'arTap'; const im = document.createElement('img'); im.src = pic; im.alt = 'แตะเพื่อดูในห้องจริง'; a.appendChild(im);
  const meta = document.createElement('div'); meta.className = 'armeta';
  const ln = (t) => '<br>' + arPh(t);
  meta.innerHTML = '<b>' + arPh(S0.name) + '</b>' + ln(S0.note) + ln('ไฟล์ .usdz ' + arKb(b.usdz.length) + ' ไฟล์ .glb ' + arKb(b.glb.length)) + ln('รูปสามเหลี่ยม ' + b.tris.toLocaleString() + '\u00a0รูป')
    + ln('เวลาสร้าง แบบจำลอง ' + b.ms.model + '\u00a0ms .usdz ' + b.ms.usdz + '\u00a0ms .glb ' + b.ms.glb + '\u00a0ms') + ln('ไฟล์และภาพที่ถืออยู่ ' + arKb(b.held)) + (b.heap > 0 ? ln('หน่วยความจำที่เพิ่มขึ้น ' + arKb(b.heap)) : '');
  card.append(a, meta); out.appendChild(card);
  const ways = document.createElement('div'); ways.className = 'arways'; out.appendChild(ways);
  const way = (label, key, el) => { el.className = 'btn'; el.appendChild(document.createTextNode(label)); el.addEventListener('click', () => arTry(id, key)); ways.appendChild(el); return el; };
  /* where AR Quick Look is missing (not iPad or iPhone), a tap would only leave the page for the bare file */
  const stay = (e) => { if (!AR.env.rel && !AR.env.ios) { e.preventDefault(); toast('เครื่องนี้ไม่มี AR\u00a0Quick\u00a0Look ลองบันทึกไฟล์แทน'); } };
  a.addEventListener('click', (e) => { stay(e); arTry(id, 'tap'); });
  if (kept) { const k = document.createElement('a'); k.rel = 'ar'; k.href = AR_DIR + 'burin-' + id + '.usdz'; const ki = document.createElement('img'); ki.src = pic; ki.alt = ''; k.appendChild(ki); way('เปิดจากที่อยู่ในเว็บ', 'web', k).addEventListener('click', stay); }
  const dl = document.createElement('a'); dl.href = usdz; dl.download = 'burin-' + id + '.usdz'; way('บันทึกไฟล์ .usdz', 'save', dl);
  if (navigator.canShare) { const f = new File([b.usdz], 'burin-' + id + '.usdz', { type: 'model/vnd.usdz+zip' }); if (navigator.canShare({ files: [f] })) { const sb = document.createElement('button'); sb.type = 'button'; way('ส่งไฟล์ไปแอปอื่น', 'share', sb).addEventListener('click', () => { navigator.share({ files: [f] }).catch(() => {}); }); } }
  const gl = document.createElement('a'); gl.href = glb; gl.download = 'burin-' + id + '.glb'; way('บันทึกไฟล์ .glb สำหรับ Android', 'glb', gl);
  AR.busy = false; arText();
}
/* one try: noted with the time, and whether this page went out of sight soon after (AR Quick Look opened over it) */
function arTry(id, way) {
  const t = { id, way, at: Date.now(), hid: null, seen: null }; AR.log.unshift(t);
  const gone = () => { if (t.hid == null && Date.now() - t.at < 6000) { t.hid = Date.now() - t.at; arLogShow(); } };
  document.addEventListener('visibilitychange', function f() { if (document.hidden) { gone(); document.removeEventListener('visibilitychange', f); } });
  window.addEventListener('blur', function f() { gone(); window.removeEventListener('blur', f); });
  arLogShow();
}
const AR_WAYS = { tap: 'แตะภาพ', web: 'ที่อยู่ในเว็บ', save: 'บันทึก\u00a0.usdz', share: 'ส่งไปแอปอื่น', glb: 'บันทึก\u00a0.glb' };
function arLogShow() {
  const box = $('#arLog'); if (!box) return; box.innerHTML = '';
  AR.log.slice(0, 20).forEach((t) => {
    const r = document.createElement('div'); r.className = 'arrow'; const S0 = AR_SAMPLES.find((s) => s.id === t.id);
    const sp = document.createElement('span'); sp.innerHTML = arPh(S0.name + ' ทาง' + AR_WAYS[t.way] + (t.hid != null ? ' หน้านี้ถูกบังหลังแตะ ' + (t.hid / 1000).toFixed(1) + '\u00a0วินาที' : '')); r.appendChild(sp);
    [['yes', 'เห็นวัตถุในห้อง'], ['frame', 'ขึ้นแต่กรอบโปร่ง'], ['no', 'ไม่ขึ้น']].forEach(([v, l]) => { const c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = l; c.setAttribute('aria-pressed', t.seen === v ? 'true' : 'false'); c.onclick = () => { t.seen = v; arLogShow(); }; r.appendChild(c); });
    box.appendChild(r);
  });
  arText();
}
function arReport() {
  const E = AR.env || arEnv(), o = ['BURIN ลอง AR รุ่น ' + (typeof VERSION !== 'undefined' ? VERSION : ''), arEnvText(E), E.ua];
  for (const s of AR_SAMPLES) { const b = AR.built[s.id]; if (b) o.push(s.name + ': usdz ' + arKb(b.usdz.length) + ', glb ' + arKb(b.glb.length) + ', สามเหลี่ยม ' + b.tris + ', เวลา ' + b.ms.model + '+' + b.ms.usdz + '+' + b.ms.glb + ' ms, ' + 'ถือ ' + arKb(b.held) + (b.heap > 0 ? ', หน่วยความจำ ' + arKb(b.heap) : '')); }
  AR.log.slice().reverse().forEach((t) => o.push(new Date(t.at).toLocaleTimeString() + ' ' + t.id + ' ' + t.way + (t.hid != null ? ' บัง ' + t.hid + ' ms' : '') + ' ผล ' + (t.seen === 'yes' ? 'เห็น' : t.seen === 'frame' ? 'กรอบโปร่ง' : t.seen === 'no' ? 'ไม่ขึ้น' : 'ยังไม่บอก')));
  return o.join('\n');
}
function arText() { const t = $('#arText'); if (t) t.value = arReport(); }

