/* BURIN part: quantum (loaded when first used) */
/* ---------- energy levels and orbitals worked out here, by the rules of quantum chemistry, with no AI (task 8.19 group 2).
   What is picked on a page (typed, or handwriting the AI read before) and asked for a figure:
     an element or an ion (Fe, Fe3+, Cl-, เหล็ก, Z = 26): its electron configuration by the Aufbau order with the real
       exceptions (Cr, Cu, Mo, Ag, Pd, Au, Pt, the lanthanides and actinides that have one), the orbital boxes of the
       outer subshells by Hund's rule and the Pauli principle, the electrons in each energy level, the period and the
       group, and the four quantum numbers of the last electron
     a configuration someone wrote (1s2 2s2 2p6 3s1, [Ne] 3s1): checked against the ground state, Pauli and the order
     a change of level in hydrogen or a hydrogen-like ion (n = 3 to n = 2, He+): E = -13.6 Z^2/n^2 eV, the energy, the
       wavelength and frequency of the photon, emission or absorption, the series and the colour
   "quantum" in flags.json turns it off (or "localcalc", or "typed"): the figure goes to the AI as before ---------- */
const QN_SYM = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe '
  + 'Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr '
  + 'Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' ');
const QN_TH = { 1: 'ไฮโดรเจน', 2: 'ฮีเลียม', 3: 'ลิเทียม', 4: 'เบริลเลียม', 5: 'โบรอน', 6: 'คาร์บอน', 7: 'ไนโตรเจน', 8: 'ออกซิเจน', 9: 'ฟลูออรีน', 10: 'นีออน',
  11: 'โซเดียม', 12: 'แมกนีเซียม', 13: 'อะลูมิเนียม', 14: 'ซิลิคอน', 15: 'ฟอสฟอรัส', 16: 'กำมะถัน', 17: 'คลอรีน', 18: 'อาร์กอน', 19: 'โพแทสเซียม', 20: 'แคลเซียม',
  21: 'สแกนเดียม', 22: 'ไทเทเนียม', 23: 'วาเนเดียม', 24: 'โครเมียม', 25: 'แมงกานีส', 26: 'เหล็ก', 27: 'โคบอลต์', 28: 'นิกเกิล', 29: 'ทองแดง', 30: 'สังกะสี',
  31: 'แกลเลียม', 32: 'เจอร์เมเนียม', 33: 'อาร์เซนิก', 34: 'ซีลีเนียม', 35: 'โบรมีน', 36: 'คริปทอน', 37: 'รูบิเดียม', 38: 'สทรอนเชียม', 39: 'อิตเทรียม', 40: 'เซอร์โคเนียม',
  41: 'ไนโอเบียม', 42: 'โมลิบดีนัม', 43: 'เทคนีเชียม', 44: 'รูทีเนียม', 45: 'โรเดียม', 46: 'แพลเลเดียม', 47: 'เงิน', 48: 'แคดเมียม', 49: 'อินเดียม', 50: 'ดีบุก',
  51: 'พลวง', 52: 'เทลลูเรียม', 53: 'ไอโอดีน', 54: 'ซีนอน', 55: 'ซีเซียม', 56: 'แบเรียม', 74: 'ทังสเตน', 78: 'แพลทินัม', 79: 'ทองคำ', 80: 'ปรอท', 82: 'ตะกั่ว',
  86: 'เรดอน', 88: 'เรเดียม', 92: 'ยูเรเนียม' };
const QN_L = 'spdf';
/* the Aufbau (Madelung) order: by n + l, then by n */
const QN_ORDER = (() => { const o = []; for (let n = 1; n <= 7; n++) for (let l = 0; l < Math.min(n, 4); l++) o.push([n, l]); return o.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]); })();
/* ground states that differ from the Aufbau order: electrons moved from one subshell to another */
const QN_EXC = { 24: [['4s', '3d', 1]], 29: [['4s', '3d', 1]], 41: [['5s', '4d', 1]], 42: [['5s', '4d', 1]], 44: [['5s', '4d', 1]], 45: [['5s', '4d', 1]],
  46: [['5s', '4d', 2]], 47: [['5s', '4d', 1]], 57: [['4f', '5d', 1]], 58: [['4f', '5d', 1]], 64: [['4f', '5d', 1]], 78: [['6s', '5d', 1]], 79: [['6s', '5d', 1]],
  89: [['5f', '6d', 1]], 90: [['5f', '6d', 2]], 91: [['5f', '6d', 1]], 92: [['5f', '6d', 1]], 93: [['5f', '6d', 1]], 96: [['5f', '6d', 1]], 103: [['6d', '7p', 1]] };
const QN_CORE = { He: 2, Ne: 10, Ar: 18, Kr: 36, Xe: 54, Rn: 86 };
const qnKey = (n, l) => n + QN_L[l];
const qnCap = (l) => 2 * (2 * l + 1);
/* the configuration of a neutral atom: { '1s': 2, ... } in the order the subshells fill */
function qnFill(e) {
  const c = {}; let left = e;
  for (const [n, l] of QN_ORDER) { if (left <= 0) break; const k = Math.min(left, qnCap(l)); c[qnKey(n, l)] = k; left -= k; }
  return c;
}
function qnAtom(Z) {
  const c = qnFill(Z);
  for (const [a, b, k] of QN_EXC[Z] || []) { c[a] = (c[a] || 0) - k; c[b] = (c[b] || 0) + k; if (!c[a]) delete c[a]; }
  return c;
}
/* an ion: a cation loses electrons from the highest n first (4s before 3d), then the highest l; an anion gains them in the Aufbau order */
function qnIon(Z, q) {
  const c = qnAtom(Z);
  if (q > 0) {
    for (let i = 0; i < q; i++) {
      const ks = Object.keys(c).filter((k) => c[k] > 0).sort((a, b) => (+b[0]) - (+a[0]) || QN_L.indexOf(b[1]) - QN_L.indexOf(a[1]));
      if (!ks.length) return null; c[ks[0]]--; if (!c[ks[0]]) delete c[ks[0]];
    }
  } else if (q < 0) {
    let left = -q;
    for (const [n, l] of QN_ORDER) { if (!left) break; const k = qnKey(n, l), room = qnCap(l) - (c[k] || 0); if (room > 0) { const add = Math.min(room, left); c[k] = (c[k] || 0) + add; left -= add; } }
  }
  return c;
}
/* the subshells as written in Thai textbooks: by n, then l */
const qnSorted = (c) => Object.keys(c).filter((k) => c[k] > 0).sort((a, b) => (+a[0]) - (+b[0]) || QN_L.indexOf(a[1]) - QN_L.indexOf(b[1]));
const qnSum = (c) => Object.keys(c).reduce((s, k) => s + c[k], 0);
/* the noble gas core: the largest one whose subshells are all full here */
function qnCoreOf(c) {
  let best = null;
  for (const [g, z] of Object.entries(QN_CORE)) {
    const cc = qnFill(z);
    if (Object.keys(cc).every((k) => c[k] === cc[k]) && qnSum(c) > z && (!best || z > best[1])) best = [g, z, cc];
  }
  return best;
}
function qnShells(c) { const s = []; for (const k of Object.keys(c)) s[+k[0] - 1] = (s[+k[0] - 1] || 0) + c[k]; return Array.from(s, (x) => x || 0); }
/* period and group of a neutral element from its ground state */
function qnPlace(Z) {
  /* the period from the noble gases that end each row (Pd has no 5s electron yet sits in period 5) */
  const c = qnAtom(Z), n = [2, 10, 18, 36, 54, 86, 118].findIndex((z) => Z <= z) + 1, ns = c[n + 's'] || 0, np = c[n + 'p'] || 0, d = c[(n - 1) + 'd'] || 0;
  if (Z === 2) return { period: 1, group: 18 };
  if ((Z >= 57 && Z <= 71) || (Z >= 89 && Z <= 103)) return { period: n, group: 0, fblock: Z <= 71 ? 'แลนทาไนด์' : 'แอกทิไนด์' };
  if (np) return { period: n, group: 10 + ns + np };
  if (d) return { period: n, group: ns + d };
  return { period: n, group: ns };
}
/* the k-th electron of a subshell (k from 1): boxes m_l = -l ... +l from the left, each box gets one up first (Hund), then down (Pauli) */
function qnLast(key, k) {
  const l = QN_L.indexOf(key[1]), m = 2 * l + 1, up = k <= m, i = up ? k - 1 : k - m - 1;
  return { n: +key[0], l, ml: -l + i, ms: up ? '+1/2' : '-1/2' };
}
function qnLastKey(c) {
  /* the subshell that fills last: the latest one in the Aufbau order that has electrons */
  let last = null; for (const [n, l] of QN_ORDER) if (c[qnKey(n, l)]) last = qnKey(n, l);
  return last;
}
const qnMinus = (v) => String(v).replace(/-/g, '−');
/* a written configuration: [Ne] 3s2 3p5, 1s2 2s2 2p6; null when the text is not one */
function qnReadConfig(t) {
  const s = t.replace(/\\mathrm\{([^}]*)\}|\\text\{([^}]*)\}/g, '$1$2').replace(/[{}$\\]/g, ' ').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(d));
  const re = /([1-7])\s*([spdf])\s*\^?\s*(\d{1,2})/g, out = []; let m, rest = s;
  while ((m = re.exec(s))) {
    /* 1s22s2 written together: a two-digit count larger than the subshell holds is one digit */
    let k = +m[3]; if (m[3].length === 2 && k > qnCap(QN_L.indexOf(m[2]))) { k = +m[3][0]; re.lastIndex -= 1; }
    out.push([m[1] + m[2], k]);
  }
  const core = s.match(/\[\s*(He|Ne|Ar|Kr|Xe|Rn)\s*\]/);
  if (out.length + (core ? 1 : 0) < 2) return null;
  rest = rest.replace(/([1-7])\s*([spdf])\s*\^?\s*(\d{1,2})/g, ' ').replace(/\[\s*(He|Ne|Ar|Kr|Xe|Rn)\s*\]/, ' ').replace(/[,;.\s]+/g, ' ').trim();
  /* only the configuration (a short label in front is fine, such as Na: or "การจัดเรียงอิเล็กตรอน") */
  if (rest.length > 40) return null;
  return { core: core ? core[1] : '', parts: out };
}
function qnFindZ(s) {
  const z = s.match(/(?:เลขอะตอม|Z)\s*=?\s*(\d{1,3})/); if (z && +z[1] >= 1 && +z[1] <= 118) return +z[1];
  for (const k in QN_TH) if (s.includes(QN_TH[k])) return +k;
  return 0;
}
/* what the text asks for: { kind: 'atom', Z, q } | { kind: 'config', ... } | { kind: 'level', Z, n1, n2 } | null */
function qnParse(text) {
  const raw = String(text || '');
  const t = raw.replace(/\\(?:mathrm|text|ce|rm)\s*\{([^{}]*)\}/g, '$1').replace(/\$/g, ' ').replace(/[−–]/g, '-').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 200) return null;
  /* a change of level: n = 3 to n = 2 (two values of n), or one level of hydrogen */
  const ns = [], nre = /\bn\s*_?\s*\{?\s*[ifhl12]?\s*\}?\s*=\s*(\d{1,2})(?![.\d])/gi; let nm;
  while ((nm = nre.exec(t))) if (+nm[1] >= 1 && +nm[1] <= 20) ns.push(+nm[1]);
  /* n of a wave, a string or a medium (refraction) is not an energy level */
  const other = /sin|θ|theta|หักเห|refract|คลื่น|wave|เสียง|ฮาร์มอนิก|harmonic|เชือก|string|ช่องเปิด|slit|\bd\s*sin/i.test(t);
  const hy = /ไฮโดรเจน|hydrogen|ระดับพลังงาน|energy level|\bE\s*_?\s*n\b|โฟตอน|photon|สเปกตรัม|spectrum/i.test(t);
  let hz = 1; if (/He\s*\^?\s*\{?\s*\+/.test(t)) hz = 2; else if (/Li\s*\^?\s*\{?\s*2\s*\+/.test(t)) hz = 3;
  if (ns.length >= 2 && ns[0] !== ns[1] && !other) return { kind: 'level', Z: hz, n1: ns[0], n2: ns[1] };
  if (ns.length === 1 && hy && !other) return { kind: 'level', Z: hz, n1: ns[0], n2: 0 };
  /* a written configuration */
  const wc = qnReadConfig(t); if (wc) return Object.assign({ kind: 'config' }, wc);
  /* an element or an ion, alone or after a few words such as การจัดเรียงอิเล็กตรอนของ */
  const ask = /การจัดเรียงอิเล็กตรอน|จัดเรียงอิเล็กตรอน|electron configuration|ออร์บิทัล|orbital|ธาตุ|element|ไอออน|\bion\b/i.test(t);
  const words = t.replace(/การจัดเรียงอิเล็กตรอน|จัดเรียงอิเล็กตรอน|electron configuration (?:of )?|แผนภาพออร์บิทัล|ออร์บิทัล|orbitals?|ของ|ธาตุ|element|ไอออน|\bion\b|[:,.]/gi, ' ').replace(/\s+/g, ' ').trim();
  const sm = words.match(/^([A-Z][a-z]?)\s*(?:\^?\s*\{?\s*(\d*)\s*([+-])\s*\}?|([+-])\s*(\d*))?$/);
  if (sm && QN_SYM.indexOf(sm[1]) >= 0) {
    const sign = sm[3] || sm[4], num = sm[2] || sm[5];
    const q = sign ? (sign === '+' ? 1 : -1) * (num ? +num : 1) : 0;
    return { kind: 'atom', Z: QN_SYM.indexOf(sm[1]) + 1, q };
  }
  if (ask || words.length <= 12) {
    const Z = qnFindZ(words); if (Z && (ask || words === QN_TH[Z] || /^(?:เลขอะตอม|Z)\s*=?\s*\d+$/.test(words))) return { kind: 'atom', Z, q: 0 };
  }
  return null;
}

/* ----- drawing ----- */
const QN_F = 'font-family="Sarabun, sans-serif"';
const qnEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* "3d" with 6 electrons: 3d then a raised 6 */
function qnSub(k, e, size) { return qnEsc(k) + '<tspan dy="-' + Math.round(size * 0.4) + '" font-size="' + Math.round(size * 0.7) + '">' + e + '</tspan><tspan dy="' + Math.round(size * 0.4) + '"> </tspan>'; }
function qnConfigText(c, core, size) {
  const ks = qnSorted(c).filter((k) => !core || !(k in core[2]));
  return (core ? '[' + core[0] + '] ' : '') + ks.map((k) => qnSub(k, c[k], size)).join('');
}
/* rows of subshells so a long configuration is not cut */
function qnRows(c, per) { const ks = qnSorted(c), r = []; for (let i = 0; i < ks.length; i += per) r.push(ks.slice(i, i + per)); return r; }
function qnSpin(x, y, up, col) {
  const h = 22, x0 = x, ya = up ? y + h / 2 : y - h / 2, yb = up ? y - h / 2 : y + h / 2, hd = up ? 6 : -6;
  return '<line x1="' + x0 + '" y1="' + ya + '" x2="' + x0 + '" y2="' + yb + '" stroke="' + col + '" stroke-width="2"/>'
    + '<polyline points="' + (x0 - 4) + ',' + (yb + hd) + ' ' + x0 + ',' + yb + ' ' + (x0 + 4) + ',' + (yb + hd) + '" fill="none" stroke="' + col + '" stroke-width="2"/>';
}
/* the orbital boxes of the subshells outside the core (or all, for a small atom) */
function qnBoxes(c, keys, y0, W) {
  let x = 20, y = y0, svg = '', rowH = 72;
  for (const k of keys) {
    const l = QN_L.indexOf(k[1]), m = 2 * l + 1, e = c[k] || 0, bw = 30, w = m * bw;
    if (x + w > W - 20) { x = 20; y += rowH; }
    for (let i = 0; i < m; i++) {
      const bx = x + i * bw;
      svg += '<rect x="' + bx + '" y="' + y + '" width="' + bw + '" height="34" fill="#FFFFFF" stroke="#37474F" stroke-width="1.4"/>';
      const up = i < e, dn = e > m && i < e - m;
      if (up && !dn) svg += qnSpin(bx + bw / 2, y + 17, true, '#1565C0');
      if (dn) svg += qnSpin(bx + bw / 2 - 6, y + 17, true, '#1565C0') + qnSpin(bx + bw / 2 + 6, y + 17, false, '#C62828');
    }
    svg += '<text x="' + (x + w / 2) + '" y="' + (y + 52) + '" text-anchor="middle" font-size="15" ' + QN_F + ' fill="#263238">' + k + '</text>';
    x += w + 22;
  }
  return { svg, y: y + rowH };
}
const qnSupNum = (q) => (q ? (Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '−') : '');
function qnAtomFig(Z, q) {
  const c = q ? qnIon(Z, q) : qnAtom(Z); if (!c) return null;
  const e = qnSum(c), sym = QN_SYM[Z - 1], name = QN_TH[Z] || '', W = 600;
  if (e <= 0) return { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 70"><rect width="600" height="70" fill="#FFFFFF"/><text x="20" y="42" font-size="20" ' + QN_F + '>' + qnEsc(sym) + ' ไอออนนี้ไม่มีอิเล็กตรอนเหลือ</text></svg>', note: 'ไอออนนี้ไม่มีอิเล็กตรอน' };
  const core = qnCoreOf(c);
  let y = 34, svg = '';
  const T = (x, yy, s, size, col, extra) => '<text x="' + x + '" y="' + yy + '" font-size="' + size + '" ' + QN_F + ' fill="' + (col || '#1A1A1A') + '"' + (extra || '') + '>' + s + '</text>';
  const head = qnEsc(sym) + (q ? '<tspan dy="-9" font-size="15">' + qnSupNum(q) + '</tspan><tspan dy="9"> </tspan>' : ' ') + (name ? ' ' + qnEsc((q ? 'ไอออนของ' : '') + name) : '') + '  Z = ' + Z + (q ? '  อิเล็กตรอน ' + e + ' ตัว' : '');
  svg += T(20, y, head, 24, '#1A1A1A', ' font-weight="600"'); y += 36;
  svg += T(20, y, 'การจัดเรียงอิเล็กตรอน', 15, '#546E7A'); y += 28;
  for (const r of qnRows(c, 8)) { svg += T(20, y, r.map((k) => qnSub(k, c[k], 20)).join(''), 20); y += 30; }
  if (core) { svg += T(20, y, 'แบบย่อ  ' + qnConfigText(c, core, 20), 20); y += 32; }
  const sh = qnShells(c);
  svg += T(20, y, 'อิเล็กตรอนในแต่ละระดับพลังงาน  ' + sh.join(', '), 17); y += 28;
  const keys = qnSorted(c).filter((k) => !core || !(k in core[2]));
  const bx = qnBoxes(c, keys.length ? keys : qnSorted(c), y, W); svg += bx.svg; y = bx.y + 6;
  let unp = 0; for (const k of qnSorted(c)) { const m = 2 * QN_L.indexOf(k[1]) + 1, n = c[k]; unp += n <= m ? n : 2 * m - n; }
  svg += T(20, y, 'อิเล็กตรอนเดี่ยว ' + unp + ' ตัว' + (unp ? ' (พาราแมกเนติก)' : ' (ไดอะแมกเนติก)'), 17); y += 28;
  const lk = qnLastKey(c), L = lk ? qnLast(lk, c[lk]) : null;
  if (L) {
    svg += T(20, y, 'เลขควอนตัมของอิเล็กตรอนตัวสุดท้าย (' + lk + ')', 15, '#546E7A'); y += 26;
    svg += T(20, y, '<tspan font-style="italic">n</tspan> = ' + L.n + ',  <tspan font-style="italic">l</tspan> = ' + L.l + ',  <tspan font-style="italic">m</tspan><tspan dy="5" font-size="13">l</tspan><tspan dy="-5"> = ' + qnMinus(L.ml) + ',  </tspan><tspan font-style="italic">m</tspan><tspan dy="5" font-size="13">s</tspan><tspan dy="-5"> = ' + qnMinus(L.ms) + '</tspan>', 19); y += 30;
  }
  if (!q) { const P = qnPlace(Z); svg += T(20, y, 'คาบ ' + P.period + (P.group ? '  หมู่ ' + P.group : '  กลุ่ม' + P.fblock), 17); y += 28; }
  if (QN_EXC[Z] && !q) { svg += T(20, y, 'สถานะพื้นต่างจากลำดับการบรรจุทั่วไป (พบจากการทดลอง)', 14, '#6D4C41'); y += 24; }
  svg += T(20, y, 'กล่องเรียง m' + '<tspan dy="4" font-size="11">l</tspan><tspan dy="-4"> จากน้อยไปมาก ลูกศรขึ้นคือ m</tspan><tspan dy="4" font-size="11">s</tspan><tspan dy="-4"> = +1/2</tspan>', 13, '#78909C'); y += 14;
  const H = y + 6;
  return { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="#FFFFFF"/>' + svg + '</svg>', note: 'การจัดเรียงอิเล็กตรอนของ ' + sym + qnSupNum(q) + ' คำนวณในเครื่องตามหลักควอนตัม', c };
}
/* a configuration someone wrote: is it the ground state of the atom with that many electrons? */
function qnConfigFig(P) {
  const c = {}; let e = 0, bad = [];
  if (P.core) { const cc = qnFill(QN_CORE[P.core]); for (const k in cc) c[k] = cc[k]; e += QN_CORE[P.core]; }
  const order = [];
  for (const [k, n] of P.parts) { const l = QN_L.indexOf(k[1]); if (+k[0] <= l) bad.push(k + ' ไม่มีในระดับพลังงาน n = ' + k[0]); else if (n > qnCap(l)) bad.push(k + ' รับอิเล็กตรอนได้ไม่เกิน ' + qnCap(l) + ' ตัว (หลักการกีดกันของเพาลี)'); c[k] = (c[k] || 0) + n; e += n; order.push(k); }
  if (e < 1 || e > 118) return null;
  const Z = e, g = qnAtom(Z), same = Object.keys(g).every((k) => g[k] === (c[k] || 0)) && Object.keys(c).every((k) => (c[k] || 0) === (g[k] || 0));
  const fig = qnAtomFig(Z, 0); if (!fig) return null;
  const msg = bad.length ? 'ที่เขียนผิดหลัก ' + bad.join(' ') : same ? 'ที่เขียนเป็นสถานะพื้นของ ' + QN_SYM[Z - 1] + ' ถูกต้อง' : 'ที่เขียนมีอิเล็กตรอน ' + e + ' ตัว แต่ไม่ใช่สถานะพื้น (อาจเป็นสถานะกระตุ้นหรือไอออน) สถานะพื้นของ ' + QN_SYM[Z - 1] + ' อยู่ด้านล่าง';
  const col = bad.length || !same ? '#C62828' : '#2E7D32';
  /* the verdict goes above the figure of the ground state */
  const m = fig.svg.match(/viewBox="0 0 (\d+) (\d+)"/), W = +m[1], H = +m[2] + 40;
  const inner = fig.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const lines = []; let cur = ''; for (const w of msg.split(' ')) { if ((cur + ' ' + w).length > 52 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } if (cur) lines.push(cur);
  const top = 14 + lines.length * 24;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + (H - 40 + top) + '"><rect width="' + W + '" height="' + (H - 40 + top) + '" fill="#FFFFFF"/>'
    + lines.map((l, i) => '<text x="20" y="' + (28 + i * 24) + '" font-size="17" ' + QN_F + ' fill="' + col + '" font-weight="600">' + qnEsc(l) + '</text>').join('')
    + '<g transform="translate(0 ' + top + ')">' + inner + '</g></svg>';
  return { svg, note: bad.length ? 'ตรวจแล้ว การจัดเรียงที่เขียนผิดหลัก' : same ? 'ตรวจแล้ว การจัดเรียงที่เขียนถูกต้อง' : 'ตรวจแล้ว ที่เขียนไม่ใช่สถานะพื้น', ok: !bad.length && same, Z };
}
const QN_SERIES = ['', 'ไลมาน', 'บัลเมอร์', 'พาเชน', 'แบรกเกตต์', 'ฟุนด์', 'ฮัมฟรีส์'];
function qnColour(nm) {
  if (nm < 380) return ['รังสีอัลตราไวโอเลต', '#6A1B9A'];
  if (nm > 750) return ['รังสีอินฟราเรด', '#8D6E63'];
  const c = nm < 450 ? ['ม่วง', '#7B1FA2'] : nm < 495 ? ['น้ำเงิน', '#1565C0'] : nm < 570 ? ['เขียว', '#2E7D32'] : nm < 590 ? ['เหลือง', '#F9A825'] : nm < 620 ? ['ส้ม', '#EF6C00'] : ['แดง', '#C62828'];
  return ['แสงที่ตามองเห็น สี' + c[0], c[1]];
}
function qnSig(v) { if (!isFinite(v)) return String(v); const a = Math.abs(v); if (a === 0) return '0'; if (a >= 1e5 || a < 1e-3) { const ex = Math.floor(Math.log10(a)), m = v / Math.pow(10, ex); return qnMinus(m.toFixed(2)) + ' × 10<tspan dy="-7" font-size="12">' + qnMinus(ex) + '</tspan><tspan dy="7"></tspan>'; } return qnMinus(Number(v.toPrecision(3)).toString()); }
/* an energy level diagram of hydrogen (or He+, Li2+): E_n = -13.6 Z^2 / n^2 eV, to scale */
function qnLevelFig(Z, n1, n2) {
  const E = (n) => -13.6 * Z * Z / (n * n), top = Math.min(8, Math.max(6, n1, n2 || 0)), W = 600;
  const L = 130, R = 330, y0 = 62, y1 = 340, sy = (e) => y0 + (y1 - y0) * (e / E(1));
  let svg = '';
  const T = (x, y, s, size, col, extra) => '<text x="' + x + '" y="' + y + '" font-size="' + size + '" ' + QN_F + ' fill="' + (col || '#1A1A1A') + '"' + (extra || '') + '>' + s + '</text>';
  const ion = Z === 1 ? 'อะตอมไฮโดรเจน' : Z === 2 ? 'ไอออน He<tspan dy="-7" font-size="12">+</tspan><tspan dy="7"></tspan>' : 'ไอออน Li<tspan dy="-7" font-size="12">2+</tspan><tspan dy="7"></tspan>';
  svg += T(20, 26, 'ระดับพลังงานของ' + ion + '  <tspan font-style="italic">E</tspan><tspan dy="5" font-size="12" font-style="italic">n</tspan><tspan dy="-5"> = ' + qnMinus(-13.6 * Z * Z) + '/</tspan><tspan font-style="italic">n</tspan><tspan dy="-7" font-size="12">2</tspan><tspan dy="7"> eV</tspan>', 17, '#1A1A1A', ' font-weight="600"');
  svg += '<line x1="' + L + '" y1="' + y0 + '" x2="' + R + '" y2="' + y0 + '" stroke="#90A4AE" stroke-width="1.5" stroke-dasharray="6 4"/>' + T(L - 10, y0 + 5, '<tspan font-style="italic">n</tspan> = ∞', 14, '#546E7A', ' text-anchor="end"') + T(R + 8, y0 + 5, '0 eV', 13, '#546E7A');
  let lastY = 1e9;
  for (let n = 1; n <= top; n++) {
    const y = sy(E(n)), hot = n === n1 || n === n2;
    svg += '<line x1="' + L + '" y1="' + y.toFixed(1) + '" x2="' + R + '" y2="' + y.toFixed(1) + '" stroke="' + (hot ? '#1A1A1A' : '#607D8B') + '" stroke-width="' + (hot ? 2.6 : 1.4) + '"/>';
    /* labels only where they do not run into each other (the levels crowd together under 0 eV) */
    if (hot || lastY - y >= 16) {
      if (y - y0 >= 12 || hot) { svg += T(L - 10, y + 5, '<tspan font-style="italic">n</tspan> = ' + n, 14, '#37474F', ' text-anchor="end"') + T(R + 8, y + 5, qnMinus(Number(E(n).toPrecision(3))) + ' eV', 13, '#37474F'); lastY = y; }
    }
  }
  let out = [];
  if (n2) {
    const a = sy(E(n1)), b = sy(E(n2)), down = n2 < n1, dE = Math.abs(E(n2) - E(n1)), nm = 1239.84 / dE, f = dE * 1.602176634e-19 / 6.62607015e-34;
    const [region, col] = qnColour(nm), x = (L + R) / 2, hd = down ? 9 : -9;
    svg += '<line x1="' + x + '" y1="' + a.toFixed(1) + '" x2="' + x + '" y2="' + (b - hd).toFixed(1) + '" stroke="' + col + '" stroke-width="3"/>'
      + '<polygon points="' + (x - 7) + ',' + (b - hd).toFixed(1) + ' ' + (x + 7) + ',' + (b - hd).toFixed(1) + ' ' + x + ',' + b.toFixed(1) + '" fill="' + col + '"/>';
    const lo = Math.min(n1, n2), ser = lo <= 6 && Z === 1 ? 'อนุกรม' + QN_SERIES[lo] : '';
    out = [
      ['จาก <tspan font-style="italic">n</tspan> = ' + n1 + ' ไป <tspan font-style="italic">n</tspan> = ' + n2, '#1A1A1A'],
      [down ? 'คายพลังงาน ปล่อยโฟตอน' : 'ดูดกลืนโฟตอน', '#37474F'],
      ['Δ<tspan font-style="italic">E</tspan> = ' + qnSig(dE) + ' eV', '#1A1A1A'],
      ['<tspan font-style="italic">λ</tspan> = ' + qnSig(nm) + ' nm', col],
      ['<tspan font-style="italic">f</tspan> = ' + qnSig(f) + ' Hz', '#1A1A1A'],
      [region, col]
    ];
    if (ser) out.push([ser, '#37474F']);
  } else {
    const e1 = E(n1);
    out = [['ระดับ <tspan font-style="italic">n</tspan> = ' + n1, '#1A1A1A'], ['<tspan font-style="italic">E</tspan> = ' + qnSig(e1) + ' eV', '#1A1A1A'], ['พลังงานที่ทำให้หลุดจากอะตอม', '#37474F'], ['จากระดับนี้ ' + qnSig(-e1) + ' eV', '#37474F']];
  }
  out.forEach((o, i) => { svg += T(410, 100 + i * 30, o[0], 17, o[1]); });
  const H = 382;
  svg += T(20, H - 10, 'ระยะห่างของเส้นตามมาตราส่วนพลังงาน', 12, '#78909C');
  return { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="#FFFFFF"/>' + svg + '</svg>', note: n2 ? 'แผนภาพระดับพลังงาน คำนวณในเครื่อง' : 'ระดับพลังงาน คำนวณในเครื่อง' };
}
/* the figure for a piece of text, or null when the text is not about atoms (then the AI makes the figure as before) */
function qnFigure(text) {
  const p = qnParse(text); if (!p) return null;
  if (p.kind === 'level') return qnLevelFig(p.Z, p.n1, p.n2);
  if (p.kind === 'config') return qnConfigFig(p);
  if (p.kind === 'atom') return qnAtomFig(p.Z, p.q);
  return null;
}

