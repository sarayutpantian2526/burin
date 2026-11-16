/* BURIN part: stats (loaded when first used) */

/* ---------- statistics, from describing data to inference and models: every number is computed here (no AI),
   with the probability distributions written out so tests give exact p-values ---------- */
const ST = {};
/* special functions */
ST.lgamma = (x) => { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - ST.lgamma(1 - x);
  x -= 1; let a = c[0]; const t = x + g + 0.5; for (let i = 1; i < 9; i++) a += c[i] / (x + i); return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a); };
ST.erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.5 * x); const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return s * y; };
ST.ncdf = (z) => 0.5 * (1 + ST.erf(z / Math.SQRT2));
ST.npdf = (z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
ST.ninv = (p) => { if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425; let q, r, x;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p <= 1 - pl) { q = p - 0.5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  else { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  /* one Newton step for full precision */
  const e = ST.ncdf(x) - p; return x - e / ST.npdf(x); };
/* regularized incomplete beta (continued fraction) and gamma */
ST.ibeta = (x, a, b) => { if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(ST.lgamma(a + b) - ST.lgamma(a) - ST.lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (x, a, b) => { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d;
    for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-15) break; } return h; };
  return x < (a + 1) / (a + b + 2) ? bt * cf(x, a, b) / a : 1 - bt * cf(1 - x, b, a) / b; };
ST.igamma = (a, x) => { if (x <= 0) return 0;
  if (x < a + 1) { let sum = 1 / a, del = sum, ap = a; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-15) break; } return sum * Math.exp(-x + a * Math.log(x) - ST.lgamma(a)); }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-15) break; }
  return 1 - Math.exp(-x + a * Math.log(x) - ST.lgamma(a)) * h; };
ST.tcdf = (t, df) => { const x = df / (df + t * t), p = 0.5 * ST.ibeta(x, df / 2, 0.5); return t >= 0 ? 1 - p : p; };
ST.chi2cdf = (x, k) => ST.igamma(k / 2, x / 2);
ST.fcdf = (f, d1, d2) => (f <= 0 ? 0 : ST.ibeta(d1 * f / (d1 * f + d2), d1 / 2, d2 / 2));
/* inverse of any increasing cdf by bisection */
ST.inv = (cdf, p, lo, hi) => { for (let i = 0; i < 200 && cdf(hi) < p; i++) hi *= 2; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (cdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
ST.tinv = (p, df) => (p === 0.5 ? 0 : p < 0.5 ? -ST.tinv(1 - p, df) : ST.inv((t) => ST.tcdf(t, df), p, 0, 10));
ST.chi2inv = (p, k) => ST.inv((x) => ST.chi2cdf(x, k), p, 0, Math.max(10, k * 3));
ST.finv = (p, d1, d2) => ST.inv((x) => ST.fcdf(x, d1, d2), p, 0, 10);
ST.lchoose = (n, k) => ST.lgamma(n + 1) - ST.lgamma(k + 1) - ST.lgamma(n - k + 1);
ST.binompmf = (k, n, p) => (k < 0 || k > n ? 0 : Math.exp(ST.lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p)));
ST.binomcdf = (k, n, p) => { let s = 0; for (let i = 0; i <= Math.floor(k); i++) s += ST.binompmf(i, n, p); return Math.min(1, s); };
ST.poispmf = (k, l) => (k < 0 ? 0 : Math.exp(k * Math.log(l) - l - ST.lgamma(k + 1)));
ST.poiscdf = (k, l) => { let s = 0; for (let i = 0; i <= Math.floor(k); i++) s += ST.poispmf(i, l); return Math.min(1, s); };

/* describing one list of numbers */
ST.sum = (a) => a.reduce((s, x) => s + x, 0);
ST.mean = (a) => ST.sum(a) / a.length;
ST.sorted = (a) => a.slice().sort((x, y) => x - y);
ST.quant = (a, p) => { const s = ST.sorted(a), h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[lo + 1] == null ? s[lo] : s[lo + 1]) - s[lo]); };
ST.var = (a, pop) => { const m = ST.mean(a); return ST.sum(a.map((x) => (x - m) ** 2)) / (a.length - (pop ? 0 : 1)); };
ST.sd = (a, pop) => Math.sqrt(ST.var(a, pop));
ST.mode = (a) => { const c = new Map(); for (const x of a) c.set(x, (c.get(x) || 0) + 1); const mx = Math.max(...c.values()); return mx < 2 ? [] : [...c].filter(([, n]) => n === mx).map(([x]) => x); };
ST.ranks = (a) => { const idx = a.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]), r = new Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const av = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = av; i = j + 1; } return r; };
function stDescribe(a) {
  const n = a.length, m = ST.mean(a), s = n > 1 ? ST.sd(a) : 0, sp = ST.sd(a, true), q1 = ST.quant(a, 0.25), q3 = ST.quant(a, 0.75), iqr = q3 - q1;
  const sk = n > 2 && s ? n / ((n - 1) * (n - 2)) * ST.sum(a.map((x) => ((x - m) / s) ** 3)) : NaN;
  const ku = n > 3 && s ? n * (n + 1) / ((n - 1) * (n - 2) * (n - 3)) * ST.sum(a.map((x) => ((x - m) / s) ** 4)) - 3 * (n - 1) ** 2 / ((n - 2) * (n - 3)) : NaN;
  const out = a.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr);
  return { n, mean: m, median: ST.quant(a, 0.5), mode: ST.mode(a), min: Math.min(...a), max: Math.max(...a), range: Math.max(...a) - Math.min(...a), q1, q3, iqr, varS: n > 1 ? ST.var(a) : 0, sd: s, varP: ST.var(a, true), sdP: sp, cv: m ? s / Math.abs(m) * 100 : NaN, se: s / Math.sqrt(n), skew: sk, kurt: ku, outliers: out, p10: ST.quant(a, 0.1), p90: ST.quant(a, 0.9) };
}
const stF = (x, d) => { if (x == null || Number.isNaN(x)) return '-'; if (!isFinite(x)) return x > 0 ? '∞' : '-∞'; const a = Math.abs(x); if (a !== 0 && (a < 1e-4 || a >= 1e7)) return x.toExponential(3); return String(Number(x.toFixed(d == null ? 4 : d))); };
const stP = (p) => (p < 0.0001 ? '< 0.0001' : stF(p, 4));

/* reading data: columns separated by spaces, commas or tabs, one row per line, an optional first row of names */
function stParse(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { names: [], cols: [] };
  const split = (l) => l.split(/\t|,|;|\s+/).map((x) => x.trim()).filter((x) => x !== '');
  let head = split(lines[0]); const isNum = (x) => /^-?\d*\.?\d+(e-?\d+)?$/i.test(x);
  let names = null; if (head.some((x) => !isNum(x))) { names = head; lines.shift(); }
  const rows = lines.map(split);
  const k = Math.max(...rows.map((r) => r.length), names ? names.length : 0);
  /* a single line of many numbers is one list */
  if (rows.length === 1 && !names) return { names: ['ข้อมูล'], cols: [rows[0].map(Number).filter((x) => isFinite(x))] };
  const cols = []; for (let j = 0; j < k; j++) cols.push(rows.map((r) => r[j]).filter((x) => x != null && isNum(x)).map(Number));
  return { names: names || cols.map((_, j) => 'ชุดที่ ' + (j + 1)), cols, raw: rows };
}

/* every analysis returns { title, rows: [[label, value]], tables: [{head, rows}], text: plain-language conclusion, svg } */
const ST_TESTS = [
  ['desc', 'สถิติเชิงพรรณนา', 'ค่ากลาง การกระจาย ควอร์ไทล์ ความเบ้ ความโด่ง ค่าผิดปกติ'],
  ['freq', 'ตารางแจกแจงความถี่และฮิสโทแกรม', 'แบ่งชั้นให้อัตโนมัติ ความถี่สะสม ความถี่สัมพัทธ์'],
  ['box', 'แผนภาพกล่อง', 'เทียบหลายกลุ่มบนแกนเดียวกัน'],
  ['ci', 'ช่วงความเชื่อมั่นของค่าเฉลี่ย', 'ใช้การแจกแจง t'],
  ['t1', 't-test หนึ่งกลุ่ม', 'เทียบค่าเฉลี่ยกับค่าที่กำหนด'],
  ['t2', 't-test สองกลุ่มอิสระ', 'Welch และแบบรวมความแปรปรวน'],
  ['tp', 't-test แบบจับคู่', 'ก่อนและหลัง วัดซ้ำกลุ่มเดิม'],
  ['anova', 'ANOVA ทางเดียว', 'เทียบค่าเฉลี่ยตั้งแต่สามกลุ่ม'],
  ['corr', 'สหสัมพันธ์', 'เพียร์สันและสเปียร์แมน พร้อมการทดสอบ'],
  ['reg', 'การถดถอยเชิงเส้น', 'คอลัมน์สุดท้ายเป็นตัวแปรตาม คอลัมน์อื่นเป็นตัวแปรอิสระ (หนึ่งหรือหลายตัว)'],
  ['chigof', 'ไคสแควร์ ความสอดคล้อง', 'ความถี่ที่สังเกตได้เทียบสัดส่วนที่คาดไว้'],
  ['chiind', 'ไคสแควร์ ความเป็นอิสระ', 'ตารางการณ์จร แถวและคอลัมน์'],
  ['prop', 'สัดส่วน', 'z-test และช่วงความเชื่อมั่นของสัดส่วน หนึ่งหรือสองกลุ่ม'],
  ['mw', 'Mann-Whitney U', 'เทียบสองกลุ่มอิสระ ไม่อิงการแจกแจงปกติ'],
  ['wil', 'Wilcoxon signed-rank', 'เทียบข้อมูลจับคู่ ไม่อิงการแจกแจงปกติ'],
  ['kw', 'Kruskal-Wallis', 'เทียบตั้งแต่สามกลุ่ม ไม่อิงการแจกแจงปกติ'],
  ['norm', 'ทดสอบการแจกแจงปกติ', 'Jarque-Bera จากความเบ้และความโด่ง'],
  ['dist', 'เครื่องคิดความน่าจะเป็น', 'ปกติ t ไคสแควร์ F ทวินาม ปัวซอง']
];
function stRun(kind, data, o) {
  const cols = data.cols.filter((c) => c.length), names = data.names, a = o.alpha || 0.05, tail = o.tail || 'two';
  const pv = (stat, cdf) => (tail === 'two' ? 2 * Math.min(cdf(stat), 1 - cdf(stat)) : tail === 'greater' ? 1 - cdf(stat) : cdf(stat));
  const H = (p, h0, h1) => (p < a ? 'ปฏิเสธ H₀ ที่ระดับนัยสำคัญ ' + a + ' (p ' + (p < 0.0001 ? '< 0.0001' : '= ' + stF(p, 4)) + ') จึงสรุปได้ว่า ' + h1 : 'ไม่ปฏิเสธ H₀ ที่ระดับนัยสำคัญ ' + a + ' (p = ' + stF(p, 4) + ') ข้อมูลยังไม่พอจะสรุปว่า ' + h1);
  const tailT = tail === 'two' ? 'ไม่เท่ากับ' : tail === 'greater' ? 'มากกว่า' : 'น้อยกว่า';
  const need = (n, msg) => { if (cols.length < n) throw new Error(msg); };
  const R = { title: (ST_TESTS.find((x) => x[0] === kind) || [])[1] || '', rows: [], tables: [], text: '', svg: '' };
  if (kind === 'desc') {
    need(1, 'ใส่ข้อมูลอย่างน้อยหนึ่งชุด');
    const D = cols.map(stDescribe), lab = [['n', 'n'], ['ค่าเฉลี่ย', 'mean'], ['มัธยฐาน', 'median'], ['ฐานนิยม', 'mode'], ['ต่ำสุด', 'min'], ['สูงสุด', 'max'], ['พิสัย', 'range'], ['Q1', 'q1'], ['Q3', 'q3'], ['พิสัยระหว่างควอร์ไทล์', 'iqr'], ['ความแปรปรวน (ตัวอย่าง)', 'varS'], ['ส่วนเบี่ยงเบนมาตรฐาน (ตัวอย่าง)', 'sd'], ['ความแปรปรวน (ประชากร)', 'varP'], ['ส่วนเบี่ยงเบนมาตรฐาน (ประชากร)', 'sdP'], ['สัมประสิทธิ์การแปรผัน (%)', 'cv'], ['ความคลาดเคลื่อนมาตรฐาน', 'se'], ['ความเบ้', 'skew'], ['ความโด่งส่วนเกิน', 'kurt'], ['เปอร์เซ็นไทล์ที่ 10', 'p10'], ['เปอร์เซ็นไทล์ที่ 90', 'p90'], ['ค่าผิดปกติ (เกณฑ์ 1.5 IQR)', 'outliers']];
    R.tables.push({ head: [''].concat(names.slice(0, cols.length)), rows: lab.map(([l, k]) => [l].concat(D.map((d) => (Array.isArray(d[k]) ? (d[k].length ? d[k].map((x) => stF(x)).join(', ') : 'ไม่มี') : stF(d[k]))))) });
    const d = D[0]; R.text = 'ชุดแรกมี ' + d.n + ' ค่า ค่าเฉลี่ย ' + stF(d.mean) + ' มัธยฐาน ' + stF(d.median) + ' ส่วนเบี่ยงเบนมาตรฐาน ' + stF(d.sd) + (isFinite(d.skew) ? (Math.abs(d.skew) < 0.5 ? ' การแจกแจงค่อนข้างสมมาตร' : d.skew > 0 ? ' การแจกแจงเบ้ขวา (หางยาวไปทางค่ามาก)' : ' การแจกแจงเบ้ซ้าย (หางยาวไปทางค่าน้อย)') : '') + (d.outliers.length ? ' และมีค่าผิดปกติ ' + d.outliers.length + ' ค่า' : '');
    R.svg = stBoxSvg(cols, names);
  } else if (kind === 'freq') {
    need(1, 'ใส่ข้อมูลหนึ่งชุด'); const x = cols[0], n = x.length, k = o.bins || Math.max(4, Math.ceil(1 + 3.322 * Math.log10(n))), lo = Math.min(...x), hi = Math.max(...x);
    const w0 = (hi - lo) / k, mag = Math.pow(10, Math.floor(Math.log10(w0 || 1))), w = Math.ceil(w0 / mag * 2) / 2 * mag || 1, start = Math.floor(lo / mag) * mag;
    const bins = []; for (let i = 0; i < k + 1; i++) { const a0 = start + i * w; if (a0 > hi) break; bins.push([a0, a0 + w, 0]); }
    for (const v of x) { const i = Math.min(bins.length - 1, Math.floor((v - start) / w)); bins[i][2]++; }
    let cum = 0; R.tables.push({ head: ['ชั้น', 'จุดกึ่งกลาง', 'ความถี่', 'ความถี่สะสม', 'ความถี่สัมพัทธ์'], rows: bins.map(([a0, b0, f]) => { cum += f; return [stF(a0, 3) + ' ถึงน้อยกว่า ' + stF(b0, 3), stF((a0 + b0) / 2, 3), f, cum, stF(f / n, 3)]; }) });
    R.text = 'แบ่ง ' + bins.length + ' ชั้น กว้างชั้นละ ' + stF(w, 3) + ' (ตามกฎของสเตอร์เจส)';
    R.svg = stHistSvg(bins, names[0]);
  } else if (kind === 'box') { need(1, 'ใส่ข้อมูลอย่างน้อยหนึ่งชุด'); R.svg = stBoxSvg(cols, names); R.text = 'เส้นกลางกล่องคือมัธยฐาน ขอบกล่องคือ Q1 และ Q3 หนวดยาวถึงค่าที่ไม่ผิดปกติ จุดคือค่าผิดปกติ'; }
  else if (kind === 'ci') {
    need(1, 'ใส่ข้อมูลหนึ่งชุด'); const x = cols[0], n = x.length, m = ST.mean(x), se = ST.sd(x) / Math.sqrt(n), lv = o.level || 0.95, tc = ST.tinv(1 - (1 - lv) / 2, n - 1);
    R.rows = [['n', n], ['ค่าเฉลี่ย', stF(m)], ['ความคลาดเคลื่อนมาตรฐาน', stF(se)], ['t วิกฤต (df = ' + (n - 1) + ')', stF(tc)], ['ช่วงความเชื่อมั่น ' + lv * 100 + '%', stF(m - tc * se) + ' ถึง ' + stF(m + tc * se)]];
    R.text = 'มั่นใจ ' + lv * 100 + '% ว่าค่าเฉลี่ยประชากรอยู่ระหว่าง ' + stF(m - tc * se) + ' ถึง ' + stF(m + tc * se);
  } else if (kind === 't1') {
    need(1, 'ใส่ข้อมูลหนึ่งชุด'); const x = cols[0], n = x.length, m = ST.mean(x), mu = +o.mu || 0, se = ST.sd(x) / Math.sqrt(n), t = (m - mu) / se, df = n - 1, p = pv(t, (z) => ST.tcdf(z, df));
    R.rows = [['H₀', 'μ = ' + mu], ['H₁', 'μ ' + { two: '≠', greater: '>', less: '<' }[tail] + ' ' + mu], ['ค่าเฉลี่ย', stF(m)], ['t', stF(t)], ['df', df], ['p-value', stP(p)], ['ขนาดอิทธิพล Cohen d', stF((m - mu) / ST.sd(x), 3)]];
    R.text = H(p, '', 'ค่าเฉลี่ยประชากร' + tailT + ' ' + mu);
  } else if (kind === 't2') {
    need(2, 'ใส่ข้อมูลสองชุด (สองคอลัมน์)'); const [x, y] = cols, n1 = x.length, n2 = y.length, m1 = ST.mean(x), m2 = ST.mean(y), v1 = ST.var(x), v2 = ST.var(y);
    const seW = Math.sqrt(v1 / n1 + v2 / n2), tW = (m1 - m2) / seW, dfW = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1)), pW = pv(tW, (z) => ST.tcdf(z, dfW));
    const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2), tP = (m1 - m2) / Math.sqrt(sp2 * (1 / n1 + 1 / n2)), pP = pv(tP, (z) => ST.tcdf(z, n1 + n2 - 2));
    const F = v1 / v2, pF = 2 * Math.min(ST.fcdf(F, n1 - 1, n2 - 1), 1 - ST.fcdf(F, n1 - 1, n2 - 1));
    R.tables.push({ head: ['', names[0], names[1]], rows: [['n', n1, n2], ['ค่าเฉลี่ย', stF(m1), stF(m2)], ['ส่วนเบี่ยงเบนมาตรฐาน', stF(Math.sqrt(v1)), stF(Math.sqrt(v2))]] });
    R.rows = [['Welch t', stF(tW)], ['df (Welch)', stF(dfW, 2)], ['p-value (Welch)', stP(pW)], ['t แบบรวมความแปรปรวน', stF(tP)], ['df', n1 + n2 - 2], ['p-value (รวมความแปรปรวน)', stP(pP)], ['F ทดสอบความแปรปรวนเท่ากัน', stF(F) + ' (p = ' + stP(pF) + ')'], ['Cohen d', stF((m1 - m2) / Math.sqrt(sp2), 3)]];
    R.text = H(pW, '', 'ค่าเฉลี่ยของ ' + names[0] + ' ' + tailT + ' ' + names[1]) + ' (ใช้ผลแบบ Welch ซึ่งไม่ต้องสมมติว่าความแปรปรวนเท่ากัน)';
    R.svg = stBoxSvg(cols.slice(0, 2), names);
  } else if (kind === 'tp') {
    need(2, 'ใส่ข้อมูลสองชุดที่จับคู่กัน'); const n = Math.min(cols[0].length, cols[1].length), d = cols[0].slice(0, n).map((v, i) => v - cols[1][i]), m = ST.mean(d), se = ST.sd(d) / Math.sqrt(n), t = m / se, p = pv(t, (z) => ST.tcdf(z, n - 1)), tc = ST.tinv(1 - a / 2, n - 1);
    R.rows = [['จำนวนคู่', n], ['ผลต่างเฉลี่ย (' + names[0] + ' − ' + names[1] + ')', stF(m)], ['SD ของผลต่าง', stF(ST.sd(d))], ['t', stF(t)], ['df', n - 1], ['p-value', stP(p)], ['ช่วงความเชื่อมั่น ' + (1 - a) * 100 + '% ของผลต่าง', stF(m - tc * se) + ' ถึง ' + stF(m + tc * se)]];
    R.text = H(p, '', 'ค่าเฉลี่ยของผลต่าง' + tailT + ' 0');
  } else if (kind === 'anova') {
    need(2, 'ใส่ข้อมูลอย่างน้อยสองกลุ่ม'); const k = cols.length, all = cols.flat(), N = all.length, gm = ST.mean(all);
    const ssb = ST.sum(cols.map((c) => c.length * (ST.mean(c) - gm) ** 2)), ssw = ST.sum(cols.map((c) => { const m = ST.mean(c); return ST.sum(c.map((x) => (x - m) ** 2)); })), dfb = k - 1, dfw = N - k, F = (ssb / dfb) / (ssw / dfw), p = 1 - ST.fcdf(F, dfb, dfw);
    R.tables.push({ head: ['แหล่งความแปรปรวน', 'SS', 'df', 'MS', 'F', 'p-value'], rows: [['ระหว่างกลุ่ม', stF(ssb), dfb, stF(ssb / dfb), stF(F), stP(p)], ['ภายในกลุ่ม', stF(ssw), dfw, stF(ssw / dfw), '', ''], ['รวม', stF(ssb + ssw), N - 1, '', '', '']] });
    R.rows = [['η² (ขนาดอิทธิพล)', stF(ssb / (ssb + ssw), 3)]];
    R.text = H(p, '', 'มีอย่างน้อยหนึ่งกลุ่มที่ค่าเฉลี่ยต่างจากกลุ่มอื่น');
    R.svg = stBoxSvg(cols, names);
  } else if (kind === 'corr') {
    need(2, 'ใส่ข้อมูลสองคอลัมน์ (x และ y)'); const n = Math.min(cols[0].length, cols[1].length), x = cols[0].slice(0, n), y = cols[1].slice(0, n);
    const r = stR(x, y), t = r * Math.sqrt((n - 2) / (1 - r * r)), p = pv(t, (z) => ST.tcdf(z, n - 2)), rs = stR(ST.ranks(x), ST.ranks(y)), ts = rs * Math.sqrt((n - 2) / (1 - rs * rs)), ps = pv(ts, (z) => ST.tcdf(z, n - 2));
    const z = 0.5 * Math.log((1 + r) / (1 - r)), zc = ST.ninv(1 - a / 2) / Math.sqrt(n - 3);
    R.rows = [['n', n], ['r ของเพียร์สัน', stF(r)], ['r²', stF(r * r)], ['t', stF(t)], ['p-value', stP(p)], ['ช่วงความเชื่อมั่น ' + (1 - a) * 100 + '% ของ r', stF(Math.tanh(z - zc)) + ' ถึง ' + stF(Math.tanh(z + zc))], ['ρ ของสเปียร์แมน', stF(rs) + ' (p = ' + stP(ps) + ')']];
    const st = Math.abs(r) >= 0.7 ? 'สูง' : Math.abs(r) >= 0.4 ? 'ปานกลาง' : Math.abs(r) >= 0.2 ? 'ต่ำ' : 'ต่ำมาก';
    R.text = 'ความสัมพันธ์เชิงเส้น' + (r >= 0 ? 'ทางบวก' : 'ทางลบ') + 'ระดับ' + st + ' (r = ' + stF(r, 3) + ') ' + H(p, '', 'มีความสัมพันธ์เชิงเส้น');
    R.svg = stScatterSvg(x, y, names[0], names[1], stLine(x, y));
  } else if (kind === 'reg') {
    need(2, 'ใส่อย่างน้อยสองคอลัมน์ คอลัมน์สุดท้ายเป็นตัวแปรตาม'); const yv = cols[cols.length - 1], Xc = cols.slice(0, -1), n = Math.min(yv.length, ...Xc.map((c) => c.length)), p0 = Xc.length;
    const X = []; for (let i = 0; i < n; i++) X.push([1].concat(Xc.map((c) => c[i]))); const y = yv.slice(0, n);
    const XtX = stMatMul(stT(X), X), inv = stInv(XtX); if (!inv) throw new Error('ตัวแปรอิสระซ้ำซ้อนกัน คำนวณไม่ได้');
    const b = stMatMul(inv, stMatMul(stT(X), y.map((v) => [v]))).map((r) => r[0]), yh = X.map((r) => ST.sum(r.map((v, j) => v * b[j]))), res = y.map((v, i) => v - yh[i]);
    const sse = ST.sum(res.map((e) => e * e)), my = ST.mean(y), sst = ST.sum(y.map((v) => (v - my) ** 2)), df = n - p0 - 1, mse = sse / df, r2 = 1 - sse / sst, ar2 = 1 - (1 - r2) * (n - 1) / df, F = ((sst - sse) / p0) / mse, pF = 1 - ST.fcdf(F, p0, df);
    const nm = ['ค่าคงที่'].concat(names.slice(0, p0));
    R.tables.push({ head: ['ตัวแปร', 'สัมประสิทธิ์', 'SE', 't', 'p-value'], rows: b.map((v, j) => { const se = Math.sqrt(mse * inv[j][j]), t = v / se; return [nm[j], stF(v), stF(se), stF(t), stP(2 * (1 - ST.tcdf(Math.abs(t), df)))]; }) });
    R.rows = [['R²', stF(r2)], ['R² ปรับแล้ว', stF(ar2)], ['F', stF(F) + ' (df = ' + p0 + ', ' + df + ')'], ['p-value ของโมเดล', stP(pF)], ['ความคลาดเคลื่อนมาตรฐานของการประมาณ', stF(Math.sqrt(mse))]];
    R.text = (names[cols.length - 1] || 'y') + ' = ' + stF(b[0]) + b.slice(1).map((v, j) => (v >= 0 ? ' + ' : ' − ') + stF(Math.abs(v)) + ' ' + nm[j + 1]).join('') + ' โมเดลอธิบายความแปรผันได้ ' + stF(r2 * 100, 1) + '% ' + H(pF, '', 'โมเดลนี้ทำนายได้ดีกว่าการใช้ค่าเฉลี่ย');
    if (p0 === 1) R.svg = stScatterSvg(Xc[0].slice(0, n), y, names[0], names[cols.length - 1], [b[1], b[0]]);
  } else if (kind === 'chigof') {
    need(1, 'ใส่ความถี่ที่สังเกตได้ (และสัดส่วนที่คาดไว้ในคอลัมน์ที่สองถ้ามี)'); const ob = cols[0], k = ob.length, N = ST.sum(ob), pr = cols[1] && cols[1].length === k ? cols[1] : ob.map(() => 1), ps = ST.sum(pr), ex = pr.map((v) => v / ps * N);
    const chi = ST.sum(ob.map((v, i) => (v - ex[i]) ** 2 / ex[i])), p = 1 - ST.chi2cdf(chi, k - 1);
    R.tables.push({ head: ['ประเภท', 'สังเกต', 'คาดหมาย', '(O−E)²/E'], rows: ob.map((v, i) => [i + 1, v, stF(ex[i], 3), stF((v - ex[i]) ** 2 / ex[i], 3)]) });
    R.rows = [['χ²', stF(chi)], ['df', k - 1], ['p-value', stP(p)]].concat(ex.some((e) => e < 5) ? [['คำเตือน', 'มีความถี่คาดหมายน้อยกว่า 5 ผลอาจคลาดเคลื่อน']] : []);
    R.text = H(p, '', 'การแจกแจงที่สังเกตได้ไม่สอดคล้องกับที่คาดไว้');
  } else if (kind === 'chiind') {
    const rows = (data.raw || []).map((r) => r.filter((x) => /^-?\d*\.?\d+$/.test(x)).map(Number)).filter((r) => r.length >= 2);
    if (rows.length < 2) throw new Error('ใส่ตารางการณ์จรอย่างน้อย 2 แถว 2 คอลัมน์');
    const rs = rows.map(ST.sum), cs = rows[0].map((_, j) => ST.sum(rows.map((r) => r[j]))), N = ST.sum(rs); let chi = 0;
    const ex = rows.map((r, i) => r.map((_, j) => rs[i] * cs[j] / N)); rows.forEach((r, i) => r.forEach((v, j) => { chi += (v - ex[i][j]) ** 2 / ex[i][j]; }));
    const df = (rows.length - 1) * (cs.length - 1), p = 1 - ST.chi2cdf(chi, df), V = Math.sqrt(chi / (N * Math.min(rows.length - 1, cs.length - 1)));
    R.tables.push({ head: ['ค่าคาดหมาย'].concat(cs.map((_, j) => 'คอลัมน์ ' + (j + 1))), rows: ex.map((r, i) => ['แถว ' + (i + 1)].concat(r.map((v) => stF(v, 2)))) });
    R.rows = [['χ²', stF(chi)], ['df', df], ['p-value', stP(p)], ['Cramér V', stF(V, 3)]];
    R.text = H(p, '', 'ตัวแปรแถวและคอลัมน์สัมพันธ์กัน (ไม่เป็นอิสระต่อกัน)');
  } else if (kind === 'prop') {
    /* first column: successes, second: totals; one row = one group */
    const rows = (data.raw || []).map((r) => r.filter((x) => /^\d+$/.test(x)).map(Number)).filter((r) => r.length >= 2);
    if (!rows.length) throw new Error('ใส่จำนวนที่สนใจและจำนวนทั้งหมด เช่น 45 100 หนึ่งแถวต่อหนึ่งกลุ่ม');
    const zc = ST.ninv(1 - a / 2);
    if (rows.length === 1) { const [x, n] = rows[0], ph = x / n, p0 = o.p0 != null && o.p0 !== '' ? +o.p0 : 0.5, z = (ph - p0) / Math.sqrt(p0 * (1 - p0) / n), p = pv(z, ST.ncdf), w = zc * Math.sqrt(ph * (1 - ph) / n);
      const den = 1 + zc * zc / n, c = (ph + zc * zc / (2 * n)) / den, h = zc * Math.sqrt(ph * (1 - ph) / n + zc * zc / (4 * n * n)) / den;
      R.rows = [['p̂', stF(ph)], ['H₀', 'p = ' + p0], ['z', stF(z)], ['p-value', stP(p)], ['ช่วงความเชื่อมั่น ' + (1 - a) * 100 + '% (Wald)', stF(ph - w) + ' ถึง ' + stF(ph + w)], ['ช่วงความเชื่อมั่น (Wilson)', stF(c - h) + ' ถึง ' + stF(c + h)]];
      R.text = H(p, '', 'สัดส่วนประชากร' + tailT + ' ' + p0);
    } else { const [[x1, n1], [x2, n2]] = rows, p1 = x1 / n1, p2 = x2 / n2, pp = (x1 + x2) / (n1 + n2), z = (p1 - p2) / Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2)), p = pv(z, ST.ncdf), w = zc * Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
      R.rows = [['p̂₁', stF(p1)], ['p̂₂', stF(p2)], ['z', stF(z)], ['p-value', stP(p)], ['ช่วงความเชื่อมั่นของ p₁ − p₂', stF(p1 - p2 - w) + ' ถึง ' + stF(p1 - p2 + w)]];
      R.text = H(p, '', 'สัดส่วนของสองกลุ่ม' + (tail === 'two' ? 'ต่างกัน' : tail === 'greater' ? ' กลุ่มแรกมากกว่า' : ' กลุ่มแรกน้อยกว่า')); }
  } else if (kind === 'mw') {
    need(2, 'ใส่ข้อมูลสองชุด'); const [x, y] = cols, n1 = x.length, n2 = y.length, rk = ST.ranks(x.concat(y)), R1 = ST.sum(rk.slice(0, n1)), U1 = R1 - n1 * (n1 + 1) / 2, U = Math.min(U1, n1 * n2 - U1);
    const N = n1 + n2, ties = {}; for (const v of x.concat(y)) ties[v] = (ties[v] || 0) + 1; const tc = ST.sum(Object.values(ties).map((t) => t ** 3 - t));
    const sd = Math.sqrt(n1 * n2 / 12 * ((N + 1) - tc / (N * (N - 1)))), z = (U1 - n1 * n2 / 2) / sd, p = pv(z, ST.ncdf);
    R.rows = [['U', stF(U)], ['z (ประมาณด้วยปกติ)', stF(z)], ['p-value', stP(p)], ['มัธยฐาน', stF(ST.quant(x, 0.5)) + ' และ ' + stF(ST.quant(y, 0.5))]];
    R.text = H(p, '', 'การแจกแจงของสองกลุ่มต่างกัน'); R.svg = stBoxSvg(cols.slice(0, 2), names);
  } else if (kind === 'wil') {
    need(2, 'ใส่ข้อมูลสองชุดที่จับคู่กัน'); const n0 = Math.min(cols[0].length, cols[1].length), d = cols[0].slice(0, n0).map((v, i) => v - cols[1][i]).filter((v) => v !== 0), n = d.length, rk = ST.ranks(d.map(Math.abs)), W = ST.sum(rk.filter((_, i) => d[i] > 0));
    const z = (W - n * (n + 1) / 4) / Math.sqrt(n * (n + 1) * (2 * n + 1) / 24), p = pv(z, ST.ncdf);
    R.rows = [['คู่ที่ผลต่างไม่เป็นศูนย์', n], ['W⁺', stF(W)], ['z', stF(z)], ['p-value', stP(p)]]; R.text = H(p, '', 'มัธยฐานของผลต่าง' + tailT + ' 0');
  } else if (kind === 'kw') {
    need(2, 'ใส่ข้อมูลอย่างน้อยสองกลุ่ม'); const all = cols.flat(), N = all.length, rk = ST.ranks(all); let off = 0, Hs = 0;
    for (const c of cols) { const r = rk.slice(off, off + c.length); off += c.length; Hs += ST.sum(r) ** 2 / c.length; }
    Hs = 12 / (N * (N + 1)) * Hs - 3 * (N + 1); { const tc = {}; for (const v of all) tc[v] = (tc[v] || 0) + 1; const c = 1 - ST.sum(Object.values(tc).map((t) => t ** 3 - t)) / (N ** 3 - N); if (c > 0) Hs /= c; } const df = cols.length - 1, p = 1 - ST.chi2cdf(Hs, df);
    R.rows = [['H', stF(Hs)], ['df', df], ['p-value', stP(p)]]; R.text = H(p, '', 'มีอย่างน้อยหนึ่งกลุ่มที่การแจกแจงต่างจากกลุ่มอื่น'); R.svg = stBoxSvg(cols, names);
  } else if (kind === 'norm') {
    need(1, 'ใส่ข้อมูลหนึ่งชุด'); const x = cols[0], n = x.length, m = ST.mean(x), s = ST.sd(x, true), S3 = ST.sum(x.map((v) => ((v - m) / s) ** 3)) / n, K = ST.sum(x.map((v) => ((v - m) / s) ** 4)) / n, JB = n / 6 * (S3 * S3 + (K - 3) ** 2 / 4), p = 1 - ST.chi2cdf(JB, 2);
    R.rows = [['ความเบ้', stF(S3)], ['ความโด่ง', stF(K)], ['Jarque-Bera', stF(JB)], ['p-value', stP(p)]];
    R.text = (p < a ? 'ข้อมูลไม่น่าจะมาจากการแจกแจงปกติ' : 'ไม่มีหลักฐานว่าข้อมูลต่างจากการแจกแจงปกติ') + ' (p = ' + stF(p, 4) + ')' + (n < 30 ? ' ข้อมูลน้อยกว่า 30 ค่า การทดสอบนี้มีกำลังต่ำ' : '');
    R.svg = stHistSvg(null, names[0], x);
  }
  return R;
}
function stR(x, y) { const mx = ST.mean(x), my = ST.mean(y); let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return a / Math.sqrt(b * c); }
function stLine(x, y) { const mx = ST.mean(x), my = ST.mean(y); let a = 0, b = 0; for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; } const s = a / b; return [s, my - s * mx]; }
const stT = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const stMatMul = (A, B) => A.map((r) => B[0].map((_, j) => ST.sum(r.map((v, k) => v * B[k][j]))));
function stInv(A) { const n = A.length, M = A.map((r, i) => r.concat(A.map((_, j) => (i === j ? 1 : 0)))); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; if (Math.abs(M[p][c]) < 1e-12) return null; [M[p], M[c]] = [M[c], M[p]]; const v = M[c][c]; M[c] = M[c].map((x) => x / v); for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c]; M[r] = M[r].map((x, j) => x - k * M[c][j]); } } return M.map((r) => r.slice(n)); }

/* the charts: on the paper, no box */
const ST_COL = ['#2F4BB8', '#B5432F', '#1F7A55', '#8A5A0C', '#6B4BB8', '#2A7F8F'];
function stAxes(VW, VH, L, T, pw, ph, x0, x1, y0, y1, xl, yl, xticks) {
  const nice = (a, b) => { const r = b - a || 1, st = Math.pow(10, Math.floor(Math.log10(r / 5))), m = r / st / 5, step = st * (m >= 5 ? 10 : m >= 2 ? 5 : m >= 1 ? 2 : 1), o = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) o.push(+v.toPrecision(10)); return o; };
  const X = (x) => L + (x - x0) / (x1 - x0) * pw, Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * ph;
  let s = '';
  for (const v of nice(y0, y1)) s += '<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="#DDE3EA"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" fill="#535E6C">' + v + '</text>';
  if (xticks !== false) for (const v of nice(x0, x1)) s += '<text x="' + X(v).toFixed(1) + '" y="' + (T + ph + 18) + '" text-anchor="middle" fill="#535E6C">' + v + '</text>';
  s += '<line x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (T + ph) + '" stroke="#6B7686" stroke-width="1.2"/><line x1="' + L + '" x2="' + (L + pw) + '" y1="' + (T + ph) + '" y2="' + (T + ph) + '" stroke="#6B7686" stroke-width="1.2"/>';
  if (xl) s += '<text x="' + (L + pw) + '" y="' + (VH - 4) + '" text-anchor="end" fill="#535E6C" font-size="14">' + esc(xl) + '</text>';
  if (yl) s += '<text x="' + (L + 4) + '" y="' + (T - 4) + '" fill="#535E6C" font-size="14">' + esc(yl) + '</text>';
  return { s, X, Y };
}
function stHistSvg(bins, name, raw) {
  if (!bins) { const x = raw, k = Math.max(4, Math.ceil(1 + 3.322 * Math.log10(x.length))), lo = Math.min(...x), hi = Math.max(...x), w = (hi - lo) / k || 1; bins = []; for (let i = 0; i < k; i++) bins.push([lo + i * w, lo + (i + 1) * w, 0]); for (const v of x) bins[Math.min(k - 1, Math.floor((v - lo) / w))][2]++; }
  const VW = 560, VH = 320, L = 48, T = 22, pw = 492, ph = 256, x0 = bins[0][0], x1 = bins[bins.length - 1][1], y1 = Math.max(...bins.map((b) => b[2])) * 1.1 || 1;
  const A = stAxes(VW, VH, L, T, pw, ph, x0, x1, 0, y1, name, 'ความถี่');
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + ' ' + VH + '" font-family="Sarabun, sans-serif" font-size="13">' + A.s;
  for (const [a0, b0, f] of bins) s += '<rect x="' + (A.X(a0) + 1).toFixed(1) + '" y="' + A.Y(f).toFixed(1) + '" width="' + Math.max(1, A.X(b0) - A.X(a0) - 2).toFixed(1) + '" height="' + (A.Y(0) - A.Y(f)).toFixed(1) + '" fill="#2F4BB8" fill-opacity="0.55" stroke="#2F4BB8"/>';
  return s + '</svg>';
}
function stBoxSvg(cols, names) {
  const VW = 560, k = cols.length, VH = 70 + k * 56, L = 110, T = 16, pw = 430, ph = k * 56, all = cols.flat(), lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.06 || 1;
  const x0 = lo - pad, x1 = hi + pad, X = (x) => L + (x - x0) / (x1 - x0) * pw;
  const A = stAxes(VW, VH, L, T, pw, ph, x0, x1, 0, 1, '', '', true);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + ' ' + VH + '" font-family="Sarabun, sans-serif" font-size="13">' + A.s.replace(/<line x1="\d+" x2="[\d.]+" y1="[\d.]+" y2="[\d.]+" stroke="#DDE3EA"\/><text[^>]*>[^<]*<\/text>/g, '');
  cols.forEach((c, i) => { const d = stDescribe(c), y = T + 28 + i * 56, col = ST_COL[i % 6], lw = Math.min(...c.filter((v) => v >= d.q1 - 1.5 * d.iqr)), hw = Math.max(...c.filter((v) => v <= d.q3 + 1.5 * d.iqr));
    s += '<text x="' + (L - 10) + '" y="' + (y + 4) + '" text-anchor="end" fill="#14181F" font-size="14">' + esc(names[i] || '') + '</text>';
    s += '<line x1="' + X(lw) + '" x2="' + X(d.q1) + '" y1="' + y + '" y2="' + y + '" stroke="' + col + '" stroke-width="1.6"/><line x1="' + X(d.q3) + '" x2="' + X(hw) + '" y1="' + y + '" y2="' + y + '" stroke="' + col + '" stroke-width="1.6"/>';
    s += '<line x1="' + X(lw) + '" x2="' + X(lw) + '" y1="' + (y - 8) + '" y2="' + (y + 8) + '" stroke="' + col + '" stroke-width="1.6"/><line x1="' + X(hw) + '" x2="' + X(hw) + '" y1="' + (y - 8) + '" y2="' + (y + 8) + '" stroke="' + col + '" stroke-width="1.6"/>';
    s += '<rect x="' + X(d.q1) + '" y="' + (y - 16) + '" width="' + Math.max(1, X(d.q3) - X(d.q1)) + '" height="32" fill="' + col + '" fill-opacity="0.18" stroke="' + col + '" stroke-width="1.6" rx="3"/><line x1="' + X(d.median) + '" x2="' + X(d.median) + '" y1="' + (y - 16) + '" y2="' + (y + 16) + '" stroke="' + col + '" stroke-width="2.6"/>';
    s += '<path d="M' + (X(d.mean) - 5) + ' ' + y + 'l5 -5l5 5l-5 5z" fill="#fff" stroke="' + col + '" stroke-width="1.4"/>';
    for (const v of d.outliers) s += '<circle cx="' + X(v) + '" cy="' + y + '" r="3.5" fill="none" stroke="' + col + '" stroke-width="1.4"/>'; });
  return s + '</svg>';
}
function stScatterSvg(x, y, xl, yl, line) {
  const VW = 560, VH = 340, L = 52, T = 22, pw = 488, ph = 274, px = (Math.max(...x) - Math.min(...x)) * 0.06 || 1, py = (Math.max(...y) - Math.min(...y)) * 0.08 || 1;
  const x0 = Math.min(...x) - px, x1 = Math.max(...x) + px, y0 = Math.min(...y) - py, y1 = Math.max(...y) + py, A = stAxes(VW, VH, L, T, pw, ph, x0, x1, y0, y1, xl, yl);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + ' ' + VH + '" font-family="Sarabun, sans-serif" font-size="13">' + A.s;
  for (let i = 0; i < x.length; i++) s += '<circle cx="' + A.X(x[i]).toFixed(1) + '" cy="' + A.Y(y[i]).toFixed(1) + '" r="4" fill="#2F4BB8" fill-opacity="0.7"/>';
  if (line) { const [m, c] = line; s += '<line x1="' + A.X(x0).toFixed(1) + '" y1="' + A.Y(m * x0 + c).toFixed(1) + '" x2="' + A.X(x1).toFixed(1) + '" y2="' + A.Y(m * x1 + c).toFixed(1) + '" stroke="#B5432F" stroke-width="2.2"/>'; }
  return s + '</svg>';
}
/* a curve of the chosen distribution with the area asked about shaded */
function stDistSvg(pdf, lo, hi, a0, b0, label) {
  const VW = 560, VH = 300, L = 48, T = 16, pw = 496, ph = 244, N = 240; const xs = [], ys = []; for (let i = 0; i <= N; i++) { const x = lo + (hi - lo) * i / N; xs.push(x); ys.push(pdf(x)); }
  const y1 = Math.max(...ys.filter(isFinite)) * 1.1 || 1, A = stAxes(VW, VH, L, T, pw, ph, lo, hi, 0, y1, label, '');
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + ' ' + VH + '" font-family="Sarabun, sans-serif" font-size="13">' + A.s;
  const sh = xs.map((x, i) => [x, ys[i]]).filter(([x]) => x >= a0 && x <= b0); if (sh.length) s += '<path d="M' + A.X(sh[0][0]).toFixed(1) + ' ' + A.Y(0).toFixed(1) + sh.map(([x, y]) => 'L' + A.X(x).toFixed(1) + ' ' + A.Y(Math.min(y, y1)).toFixed(1)).join('') + 'L' + A.X(sh[sh.length - 1][0]).toFixed(1) + ' ' + A.Y(0).toFixed(1) + 'Z" fill="#2F4BB8" fill-opacity="0.3"/>';
  s += '<path d="' + xs.map((x, i) => (i ? 'L' : 'M') + A.X(x).toFixed(1) + ' ' + A.Y(Math.min(ys[i], y1)).toFixed(1)).join('') + '" fill="none" stroke="#2F4BB8" stroke-width="2.2"/>';
  return s + '</svg>';
}
function stDist(o) {
  const d = o.dist || 'norm', a = o.a === '' || o.a == null ? -Infinity : +o.a, b = o.b === '' || o.b == null ? Infinity : +o.b, p1 = +o.p1, p2 = +o.p2;
  const D = {
    norm: { name: 'ปกติ', cdf: (x) => ST.ncdf((x - p1) / p2), pdf: (x) => ST.npdf((x - p1) / p2) / p2, inv: (p) => p1 + p2 * ST.ninv(p), lo: p1 - 4 * p2, hi: p1 + 4 * p2, par: 'μ = ' + p1 + ', σ = ' + p2 },
    t: { name: 't', cdf: (x) => ST.tcdf(x, p1), pdf: (x) => Math.exp(ST.lgamma((p1 + 1) / 2) - ST.lgamma(p1 / 2)) / Math.sqrt(p1 * Math.PI) * Math.pow(1 + x * x / p1, -(p1 + 1) / 2), inv: (p) => ST.tinv(p, p1), lo: -5, hi: 5, par: 'df = ' + p1 },
    chi2: { name: 'ไคสแควร์', cdf: (x) => ST.chi2cdf(x, p1), pdf: (x) => (x <= 0 ? 0 : Math.exp((p1 / 2 - 1) * Math.log(x) - x / 2 - (p1 / 2) * Math.log(2) - ST.lgamma(p1 / 2))), inv: (p) => ST.chi2inv(p, p1), lo: 0, hi: Math.max(10, p1 + 5 * Math.sqrt(2 * p1)), par: 'df = ' + p1 },
    f: { name: 'F', cdf: (x) => ST.fcdf(x, p1, p2), pdf: (x) => (x <= 0 ? 0 : Math.exp(0.5 * (p1 * Math.log(p1 * x) + p2 * Math.log(p2) - (p1 + p2) * Math.log(p1 * x + p2)) - Math.log(x) - (ST.lgamma(p1 / 2) + ST.lgamma(p2 / 2) - ST.lgamma((p1 + p2) / 2)))), inv: (p) => ST.finv(p, p1, p2), lo: 0, hi: 5, par: 'df₁ = ' + p1 + ', df₂ = ' + p2 },
    binom: { name: 'ทวินาม', cdf: (x) => ST.binomcdf(x, p1, p2), pmf: (k) => ST.binompmf(k, p1, p2), disc: true, lo: 0, hi: p1, par: 'n = ' + p1 + ', p = ' + p2, mean: p1 * p2, var: p1 * p2 * (1 - p2) },
    pois: { name: 'ปัวซอง', cdf: (x) => ST.poiscdf(x, p1), pmf: (k) => ST.poispmf(k, p1), disc: true, lo: 0, hi: Math.ceil(p1 + 5 * Math.sqrt(p1) + 5), par: 'λ = ' + p1, mean: p1, var: p1 }
  }[d];
  const R = { title: 'การแจกแจง' + D.name + ' (' + D.par + ')', rows: [], tables: [], text: '', svg: '' };
  if (D.disc) {
    const ka = isFinite(a) ? Math.ceil(a) : 0, kb = isFinite(b) ? Math.floor(b) : D.hi, P = ST.sum(Array.from({ length: Math.max(0, kb - ka + 1) }, (_, i) => D.pmf(ka + i)));
    R.rows = [['P(' + ka + ' ≤ X ≤ ' + kb + ')', stF(P, 6)], ['ค่าเฉลี่ย', stF(D.mean)], ['ความแปรปรวน', stF(D.var)]];
    if (o.k !== '' && o.k != null) R.rows.unshift(['P(X = ' + o.k + ')', stF(D.pmf(+o.k), 6)]);
    const ks = Array.from({ length: Math.min(60, D.hi + 1) }, (_, i) => i), VW = 560, VH = 280, L = 48, T = 16, pw = 496, ph = 224, ym = Math.max(...ks.map(D.pmf)) * 1.1, A = stAxes(VW, VH, L, T, pw, ph, -0.5, ks.length - 0.5, 0, ym, 'X', '');
    R.svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + ' ' + VH + '" font-family="Sarabun, sans-serif" font-size="13">' + A.s + ks.map((k) => '<rect x="' + (A.X(k - 0.35)).toFixed(1) + '" y="' + A.Y(D.pmf(k)).toFixed(1) + '" width="' + (A.X(0.35) - A.X(-0.35)).toFixed(1) + '" height="' + (A.Y(0) - A.Y(D.pmf(k))).toFixed(1) + '" fill="#2F4BB8" fill-opacity="' + (k >= ka && k <= kb ? 0.75 : 0.2) + '"/>').join('') + '</svg>';
    R.text = 'ความน่าจะเป็นที่ X อยู่ระหว่าง ' + ka + ' ถึง ' + kb + ' คือ ' + stF(P, 6);
  } else {
    const P = D.cdf(b) - D.cdf(a);
    R.rows = [['P(' + (isFinite(a) ? a : '-∞') + ' < X < ' + (isFinite(b) ? b : '∞') + ')', stF(P, 6)]];
    if (o.q !== '' && o.q != null) R.rows.push(['ค่า x ที่ P(X < x) = ' + o.q, stF(D.inv(+o.q), 5)]);
    R.svg = stDistSvg(D.pdf, D.lo, D.hi, isFinite(a) ? a : D.lo, isFinite(b) ? b : D.hi, 'x');
    R.text = 'พื้นที่ใต้โค้งที่แรเงาคือ ' + stF(P, 6);
  }
  return R;
}

/* ----- the statistics panel ----- */
function openStats(prefill) {
  closeSheets(); let p = $('#statSheet');
  if (!p) {
    p = document.createElement('div'); p.id = 'statSheet'; p.className = 'sheet statsheet';
    p.innerHTML = '<div class="panel wide" role="dialog" aria-label="สถิติ"><div class="mvhead"><h2>สถิติ</h2><button type="button" class="btn" data-a="x">ปิด</button></div>'
      + '<div class="stgrid"><div class="stleft"><label class="field"><span>วิเคราะห์อะไร</span><select class="stkind"></select></label><small class="sthint"></small>'
      + '<label class="field stdata"><span>ข้อมูล คั่นด้วยเว้นวรรค จุลภาค หรือแท็บ แถวละหนึ่งบรรทัด แถวแรกเป็นชื่อคอลัมน์ได้ วางจาก Excel ได้เลย</span><textarea rows="9" spellcheck="false"></textarea></label>'
      + '<div class="stopts"></div><button type="button" class="btn solid" data-a="go">คำนวณ</button></div><div class="stout"></div></div></div>';
    document.body.appendChild(p);
    p.querySelector('[data-a="x"]').onclick = () => { p.hidden = true; };
    const sel = p.querySelector('.stkind'); for (const [k, n] of ST_TESTS) { const o = document.createElement('option'); o.value = k; o.textContent = n; sel.appendChild(o); }
    sel.onchange = () => { stOpts(p); try { store_ls.set('tp-st-kind', sel.value); } catch (e) { /* fine */ } };
    p.querySelector('[data-a="go"]').onclick = () => stGo(p);
    try { sel.value = store_ls.get('tp-st-kind') || 'desc'; p.querySelector('textarea').value = store_ls.get('tp-st-data') || 'ก่อน หลัง\n12 15\n14 18\n11 13\n16 19\n13 17\n15 16\n12 16\n14 17'; } catch (e) { /* defaults */ }
  }
  if (prefill) p.querySelector('textarea').value = prefill;
  stOpts(p); p.hidden = false;
}
function stOpts(p) {
  const k = p.querySelector('.stkind').value, box = p.querySelector('.stopts'), hint = p.querySelector('.sthint');
  hint.textContent = (ST_TESTS.find((x) => x[0] === k) || [])[2] || '';
  p.querySelector('.stdata').hidden = k === 'dist';
  const f = (name, label, val, type) => '<label class="field"><span>' + label + '</span>' + (type === 'tail' ? '<select data-o="tail"><option value="two">สองทาง (≠)</option><option value="greater">ทางเดียว มากกว่า (&gt;)</option><option value="less">ทางเดียว น้อยกว่า (&lt;)</option></select>' : type === 'dist' ? '<select data-o="dist"><option value="norm">ปกติ</option><option value="t">t</option><option value="chi2">ไคสแควร์</option><option value="f">F</option><option value="binom">ทวินาม</option><option value="pois">ปัวซอง</option></select>' : '<input data-o="' + name + '" inputmode="decimal" value="' + val + '">') + '</label>';
  let h = '';
  if (!['desc', 'freq', 'box', 'dist', 'norm', 'ci'].includes(k)) h += f('alpha', 'ระดับนัยสำคัญ α', '0.05');
  if (['t1', 't2', 'tp', 'corr', 'prop', 'mw', 'wil'].includes(k)) h += f('tail', 'สมมติฐานแย้ง', '', 'tail');
  if (k === 't1') h += f('mu', 'ค่าเฉลี่ยตามสมมติฐาน μ₀', '0');
  if (k === 'ci') h += f('level', 'ระดับความเชื่อมั่น', '0.95');
  if (k === 'prop') h += f('p0', 'สัดส่วนตามสมมติฐาน p₀ (กรณีกลุ่มเดียว)', '0.5');
  if (k === 'freq') h += f('bins', 'จำนวนชั้น (เว้นว่างให้เลือกเอง)', '');
  if (k === 'dist') h += f('', 'การแจกแจง', '', 'dist') + f('p1', 'พารามิเตอร์ 1 (μ, df, n หรือ λ)', '0') + f('p2', 'พารามิเตอร์ 2 (σ, df₂ หรือ p)', '1') + f('a', 'ตั้งแต่ a (เว้นว่าง = ลบอนันต์)', '-1.96') + f('b', 'ถึง b (เว้นว่าง = อนันต์)', '1.96') + f('q', 'หาค่าวิกฤตจากความน่าจะเป็นสะสม (ไม่บังคับ)', '0.975') + f('k', 'P(X = k) สำหรับทวินามหรือปัวซอง (ไม่บังคับ)', '');
  box.innerHTML = h;
}
function stGo(p) {
  const k = p.querySelector('.stkind').value, text = p.querySelector('textarea').value, out = p.querySelector('.stout'), o = {};
  for (const el of p.querySelectorAll('[data-o]')) o[el.dataset.o] = el.value;
  if (o.alpha) o.alpha = +o.alpha; if (o.level) o.level = +o.level; if (o.bins) o.bins = +o.bins || 0;
  try { store_ls.set('tp-st-data', text.slice(0, 20000)); } catch (e) { /* fine */ }
  let R;
  try { R = k === 'dist' ? stDist(o) : stRun(k, stParse(text), o); }
  catch (e) { out.innerHTML = '<div class="note err">' + esc(e && e.message || 'คำนวณไม่ได้ ตรวจข้อมูล') + '</div>'; return; }
  const tbl = (t) => '<table class="sttab"><thead><tr>' + t.head.map((x) => '<th>' + esc(x) + '</th>').join('') + '</tr></thead><tbody>' + t.rows.map((r) => '<tr>' + r.map((x) => '<td>' + esc(x) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  out.innerHTML = '<h3>' + esc(R.title) + '</h3>' + R.tables.map(tbl).join('') + (R.rows.length ? tbl({ head: ['ค่า', 'ผล'], rows: R.rows }) : '') + (R.text ? '<p class="sttext">' + esc(R.text) + '</p>' : '')
    + (R.svg ? '<div class="stsvg"><img alt="แผนภาพ" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(R.svg) + '"></div>' : '')
    + '<div class="row2"><button type="button" class="btn solid" data-a="put">วางผลลงหน้า</button>' + (R.svg ? '<button type="button" class="btn" data-a="putg">วางแผนภาพลงหน้า</button>' : '') + '</div>';
  out.querySelector('[data-a="put"]').onclick = () => {
    const md = '**' + R.title + '**\n\n' + R.tables.concat(R.rows.length ? [{ head: ['ค่า', 'ผล'], rows: R.rows }] : []).map((t) => '| ' + t.head.join(' | ') + ' |\n|' + t.head.map(() => '---').join('|') + '|\n' + t.rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n')).join('\n\n') + (R.text ? '\n\n' + R.text : '');
    const w = 600, [x, y] = viewSpot(w, 300); addItem({ type: 'text', x, y, w, fs: 18, md }); p.hidden = true; toast('วางผลลงหน้าแล้ว', 1500);
    /* the chart goes where there is room once the table has its real height */
    if (R.svg) setTimeout(() => { const f = freeSpot(500, 300, [x, y]); const at = f || [x, y + 400]; addItem({ type: 'svg', x: Math.round(at[0]), y: Math.round(at[1]), w: 500, svg: R.svg }); }, 120);
  };
  const pg = out.querySelector('[data-a="putg"]'); if (pg) pg.onclick = () => { const w = 520, [x, y] = viewSpot(w, 320); addItem({ type: 'svg', x, y, w, svg: R.svg }); p.hidden = true; toast('วางแผนภาพลงหน้าแล้ว', 1500); };
}

