/* BURIN part: data (loaded when first used) */
/* ---------- handwriting into data: a table of results or a graph plotted by hand is read once (by the AI, numbers exactly
   as written), shown as a table that can be corrected, then everything else is computed here: the best straight line with
   its uncertainty, a check of the line the student drew, an experiment card, statistics or a typed table ---------- */
function dsNum(v) { const x = parseFloat(String(v).replace(/[−–]/g, '-').replace(',', '.').replace(/[^0-9eE+\-.]/g, '')); return isFinite(x) ? x : NaN; }
function dsFit(xs, ys) {
  const n = xs.length; if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
  if (!sxx) return null; const m = sxy / sxx, c = my - m * mx;
  let ss = 0; for (let i = 0; i < n; i++) ss += (ys[i] - m * xs[i] - c) ** 2;
  const s2 = n > 2 ? ss / (n - 2) : 0, sm = Math.sqrt(s2 / sxx), sc = Math.sqrt(s2 * (1 / n + mx * mx / sxx));
  return { m, c, sm, sc, r2: syy ? 1 - ss / syy : 1, n };
}
async function dataSelection() {
  if (!S.sel) return;
  const refs = S.sel.strokes.slice(), box = S.sel.box.slice();
  const texts = S.sel.items.map(findItem).filter((it) => it && (!it.type || it.type === 'text') && it.md).map((it) => it.md).join('\n').slice(0, 3000);
  if (!refs.length && !texts) return;
  if (!needAI('read')) return;
  openAI();
  const B = busyCard('อ่านเป็นข้อมูล');
  try {
    const img = refs.length ? await inkBlob(refs) : null;
    const res = await AI.run('read', 'This is handwriting from a science notebook: either a TABLE of measured values or a GRAPH plotted by hand on axes. Read it exactly; do not correct, round or invent any value.\n'
      + 'If it is a table, answer:\n@@TABLE\nthen one row per line, cells separated by a tab, the first row the column headings with units in brackets as written, e.g. "t (s)\tx (m)". Numbers exactly as written (keep the decimals).\n'
      + 'If it is a graph, answer:\n@@GRAPH\n@@X name (unit) of the horizontal axis\n@@Y name (unit) of the vertical axis\n@@PTS\nthen each plotted point as "x<tab>y" in the units of the axes, read from the scale marked on the axes as accurately as possible.\n'
      + 'If a straight line was drawn through the points, also give @@LINE x1 y1 x2 y2 : two points on that drawn line, far apart, in the units of the axes.\nNo other words.' + (texts ? '\nTyped text in the selection:\n' + texts : ''),
      { images: img ? [img.blob] : [], maxTokens: 2500, cache: false, signal: B.ctl.signal, noCtx: true });
    const t = String(res.text || '');
    let head = [], rows = [], kind = /@@GRAPH/.test(t) ? 'graph' : 'table', line = null, xn = 'x', yn = 'y';
    if (kind === 'graph') {
      xn = ((t.match(/@@X\s*(.+)/) || [])[1] || 'x').trim(); yn = ((t.match(/@@Y\s*(.+)/) || [])[1] || 'y').trim();
      const pts = (t.split(/@@PTS/)[1] || '').split(/@@LINE/)[0];
      rows = pts.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\t|,|\s{2,}|\s/).filter(Boolean).slice(0, 2)).filter((r) => r.length === 2 && r.every((v) => isFinite(dsNum(v))));
      head = [xn, yn];
      const lm = t.match(/@@LINE\s+([^\n]+)/); if (lm) { const v = lm[1].trim().split(/[\s,]+/).map(dsNum); if (v.length >= 4 && v.slice(0, 4).every(isFinite)) line = v.slice(0, 4); }
    } else {
      const ls = (t.split(/@@TABLE/)[1] || t).split('\n').map((l) => l.trim()).filter((l) => l && !/^\|?\s*-{2,}/.test(l));
      const cells = ls.map((l) => (l.includes('\t') ? l.split('\t') : l.replace(/^\||\|$/g, '').split(/\s*\|\s*|\s{2,}/)).map((c) => c.trim()));
      if (cells.length && cells[0].some((c) => !isFinite(dsNum(c)))) { head = cells[0]; rows = cells.slice(1); } else { rows = cells; head = (cells[0] || []).map((_, i) => 'คอลัมน์ ' + (i + 1)); }
    }
    if (!rows.length) throw { msg: 'อ่านเป็นตารางหรือกราฟไม่ได้ ลองวงเฉพาะตารางหรือกราฟ และเขียนตัวเลขให้ชัด' };
    dsCard(B.d, { kind, head, rows, line, box });
  } catch (e) { B.d.innerHTML = '<span class="k">อ่านเป็นข้อมูล</span><div class="note err">' + esc(e && e.msg ? e.msg : aiErr(e)) + '</div>'; }
}
function dsCard(d, D) {
  const nc = Math.max(D.head.length, ...D.rows.map((r) => r.length));
  const grid = () => [...d.querySelectorAll('.dsgrid tbody tr')].map((tr) => [...tr.querySelectorAll('input')].map((i) => i.value.trim()));
  const heads = () => [...d.querySelectorAll('.dsgrid thead input')].map((i) => i.value.trim());
  let h = '<span class="k">' + (D.kind === 'graph' ? 'จุดที่อ่านจากกราฟ' : 'ตารางที่อ่านได้') + '</span><div class="note small">ตรวจตัวเลขเทียบกับที่เขียน แก้ในช่องได้ก่อนใช้</div><div class="dswrap"><table class="dsgrid"><thead><tr>';
  for (let c = 0; c < nc; c++) h += '<th><input value="' + esc(D.head[c] || '') + '"></th>';
  h += '</tr></thead><tbody>' + D.rows.map((r) => '<tr>' + Array.from({ length: nc }, (_, c) => '<td><input inputmode="decimal" value="' + esc(r[c] == null ? '' : r[c]) + '"></td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  const opt = () => Array.from({ length: nc }, (_, c) => '<option value="' + c + '">' + esc(D.head[c] || 'คอลัมน์ ' + (c + 1)) + '</option>').join('');
  h += '<div class="row2 dsxy"><label class="field"><span>แกนนอน</span><select data-a="x">' + opt() + '</select></label><label class="field"><span>แกนตั้ง</span><select data-a="y">' + opt() + '</select></label></div><div class="dsfit"></div>'
    + '<div class="row"><button class="btn solid" data-a="lab">ทำเป็นการ์ดการทดลอง</button><button class="btn" data-a="st">ส่งไปสถิติ</button><button class="btn" data-a="tb">วางเป็นตารางพิมพ์</button></div>';
  d.innerHTML = h;
  const sx = d.querySelector('[data-a="x"]'), sy = d.querySelector('[data-a="y"]'); sx.value = '0'; sy.value = String(Math.min(1, nc - 1));
  const cols = () => { const g = grid(), x = +sx.value, y = +sy.value, xs = [], ys = []; for (const r of g) { const a = dsNum(r[x]), b = dsNum(r[y]); if (isFinite(a) && isFinite(b)) { xs.push(a); ys.push(b); } } return { xs, ys }; };
  const paint = () => {
    const { xs, ys } = cols(), F = dsFit(xs, ys), out = d.querySelector('.dsfit'), hd = heads();
    if (!F) { out.innerHTML = '<div class="note small">ต้องมีตัวเลขอย่างน้อย 2 แถวในสองคอลัมน์ที่เลือก</div>'; return; }
    let s = '<div class="dsres"><span><i>เส้นตรงที่ดีที่สุด</i> ความชัน ' + esc(sig3(F.m)) + ' ± ' + esc(sig3(F.sm)) + ', จุดตัดแกนตั้ง ' + esc(sig3(F.c)) + ' ± ' + esc(sig3(F.sc)) + ', R² ' + F.r2.toFixed(4) + ' (' + F.n + ' จุด)</span>';
    if (D.line && +sx.value === 0 && +sy.value === 1) {
      const [x1, y1, x2, y2] = D.line, ms = x2 !== x1 ? (y2 - y1) / (x2 - x1) : NaN, diff = isFinite(ms) && F.m ? Math.abs(ms - F.m) / Math.abs(F.m) * 100 : NaN;
      const ok = isFinite(diff) && (Math.abs(ms - F.m) <= 2 * F.sm || diff <= 5);
      s += '<span><i>เส้นที่ลากเอง</i> ความชัน ' + esc(sig3(ms)) + (isFinite(diff) ? ' ต่างจากเส้นที่ดีที่สุด ' + diff.toFixed(1) + '%' : '') + ' <b>' + (ok ? 'อยู่ในเกณฑ์ดี' : 'ควรลากใหม่ให้ผ่านกลางกลุ่มจุด') + '</b></span>';
    }
    s += '</div>' + dsSvg(xs, ys, F, D.line && +sx.value === 0 && +sy.value === 1 ? D.line : null, hd[+sx.value], hd[+sy.value]);
    out.innerHTML = s;
  };
  d.querySelectorAll('input').forEach((i) => { i.oninput = paint; }); sx.onchange = paint; sy.onchange = paint; paint();
  const unitOf = (hd) => { const m = String(hd || '').match(/\(([^)]*)\)\s*$/); return m ? m[1] : ''; }, nameOf = (hd) => String(hd || '').replace(/\s*\([^)]*\)\s*$/, '') || 'x';
  d.querySelector('[data-a="lab"]').onclick = () => {
    const hd = heads(), x = +sx.value, y = +sy.value, g = grid().filter((r) => isFinite(dsNum(r[x])) && isFinite(dsNum(r[y]))); if (g.length < 2) { toast('ต้องมีอย่างน้อย 2 แถว', 2000); return; }
    const w = 640, at = viewSpot(w, 760);
    addItem({ type: 'lab', tpl: 'blank', title: 'ข้อมูลจากลายมือ: ' + nameOf(hd[y]) + ' กับ ' + nameOf(hd[x]), xn: nameOf(hd[x]), xu: unitOf(hd[x]), yn: nameOf(hd[y]), yu: unitOf(hd[y]), xt: 'x', yt: 'x', trials: 1, f: 'm', fn: 'ความชัน', fu: '',
      plan: { iv: nameOf(hd[x]), dv: nameOf(hd[y]), cv: '', hyp: '' }, rows: g.map((r) => [dsNum(r[x]), dsNum(r[y])]), x: at[0], y: at[1], w });
    toast('วางการ์ดการทดลองแล้ว แก้ชื่อผลและสูตรจากความชันได้ในการ์ด', 2600);
  };
  d.querySelector('[data-a="st"]').onclick = () => { const hd = heads().map((x, i) => (x || 'c' + (i + 1)).replace(/\s+/g, '_')), txt = hd.join(' ') + '\n' + grid().map((r) => r.map((v) => (isFinite(dsNum(v)) ? dsNum(v) : '')).join(' ')).join('\n'); need('stats').then(() => openStats(txt), () => toast('โหลดส่วนสถิติไม่สำเร็จ', 2400)); };
  d.querySelector('[data-a="tb"]').onclick = () => { const hd = heads(), g = grid(); const md = '| ' + hd.join(' | ') + ' |\n|' + hd.map(() => '---').join('|') + '|\n' + g.map((r) => '| ' + r.join(' | ') + ' |').join('\n'); proofPut(md, D.box, g.length + 2); toast('วางตารางแล้ว', 1400); };
}
function dsSvg(xs, ys, F, line, xl, yl) {
  const x0 = Math.min(...xs, 0), x1 = Math.max(...xs), y0 = Math.min(...ys, 0), y1 = Math.max(...ys);
  const X = (x) => 34 + (x - x0) / ((x1 - x0) || 1) * 250, Y = (y) => 150 - (y - y0) / ((y1 - y0) || 1) * 136;
  let s = '<svg class="dssvg" viewBox="0 0 300 172" role="img" aria-label="กราฟข้อมูล"><path d="M34 10V150H290" fill="none" stroke="currentColor" stroke-opacity="0.45"/>';
  s += '<path d="M' + X(x0).toFixed(1) + ' ' + Y(F.m * x0 + F.c).toFixed(1) + 'L' + X(x1).toFixed(1) + ' ' + Y(F.m * x1 + F.c).toFixed(1) + '" stroke="#2E8B57" stroke-width="1.6"/>';
  if (line) s += '<path d="M' + X(line[0]).toFixed(1) + ' ' + Y(line[1]).toFixed(1) + 'L' + X(line[2]).toFixed(1) + ' ' + Y(line[3]).toFixed(1) + '" stroke="#C2571A" stroke-width="1.4" stroke-dasharray="5 4"/>';
  s += xs.map((x, i) => '<circle cx="' + X(x).toFixed(1) + '" cy="' + Y(ys[i]).toFixed(1) + '" r="2.6" fill="#2F4BB8"/>').join('');
  s += '<text x="290" y="166" text-anchor="end" font-size="10" fill="currentColor">' + esc(xl || '') + '</text><text x="36" y="9" font-size="10" fill="currentColor">' + esc(yl || '') + '</text></svg>';
  return s + '<div class="note small">เส้นสีเขียวคือเส้นตรงที่ดีที่สุดจากการคำนวณ' + (line ? ' เส้นประสีส้มคือเส้นที่ลากเอง' : '') + '</div>';
}
/* ---------- the whole class's measurements, live: the teacher asks for one value (or a pair), every learner sends
   theirs from their own device, and the class sees the spread, the mean with its uncertainty and any odd value at once ---------- */
function poolStats(v) {
  const n = v.length, s = v.slice().sort((a, b) => a - b), mean = v.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const q = (p) => { const h = (n - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[lo + 1] == null ? s[lo] : s[lo + 1]) - s[lo]); };
  const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
  return { n, mean, sd, se: n > 1 ? sd / Math.sqrt(n) : 0, med: q(0.5), min: s[0], max: s[n - 1], out: n >= 5 ? v.filter((x) => x < lo || x > hi) : [] };
}
function poolRows() { const P = LIVE.pool; if (!P) return []; const out = []; for (const [sid, g] of Object.entries(P.got)) for (const r of g.rows) out.push({ sid, name: g.name, v: r }); return out; }
function poolSection(box) {
  box.innerHTML = '';
  const P = LIVE.pool;
  if (!P) {
    const f = exEl('div', 'poolask', '<label class="field"><span>ค่าที่ให้ผู้เรียนวัด</span><input data-p="n" placeholder="เช่น คาบการแกว่ง T"></label><label class="field"><span>หน่วย</span><input data-p="u" placeholder="เช่น s"></label>'
      + '<label class="field"><span>ตัวแปรต้น (ไม่ใส่ก็ได้)</span><input data-p="xn" placeholder="เช่น ความยาวเชือก L"></label><label class="field"><span>หน่วย</span><input data-p="xu" placeholder="เช่น m"></label>');
    box.appendChild(f);
    const b = exEl('button', 'btn solid', 'ขอข้อมูลจากผู้เรียน'); box.appendChild(b);
    b.onclick = () => {
      const g = (k) => f.querySelector('[data-p="' + k + '"]').value.trim().slice(0, 40);
      if (!g('n')) { toast('ใส่ชื่อค่าที่ให้วัดก่อน', 2000); return; }
      const vars = (g('xn') ? [{ n: g('xn'), u: g('xu') }] : []).concat([{ n: g('n'), u: g('u') }]);
      LIVE.pool = { id: 'pl' + uid(), vars, got: {}, open: true };
      liveSend('pool', { id: LIVE.pool.id, vars }); toast('ส่งคำขอให้ผู้เรียนในห้องแล้ว', 1800); liveRender();
    };
    box.appendChild(exEl('div', 'note small', 'ผู้เรียนแต่ละคนส่งได้หลายค่า ระบบรวมเป็นกราฟ หาค่าเฉลี่ยพร้อมความไม่แน่นอน และชี้ค่าที่ผิดปกติให้'));
    return;
  }
  const rows = poolRows(), two = P.vars.length === 2, nm = (v) => v.n + (v.u ? ' (' + v.u + ')' : '');
  box.appendChild(exEl('div', 'note small', 'ได้รับ ' + rows.length + ' ค่า จาก ' + Object.keys(P.got).length + ' คน' + (P.open ? '' : ' ปิดรับแล้ว')));
  const out = exEl('div', 'poolout', ''); box.appendChild(out);
  out.innerHTML = poolView(P, rows);
  const r2 = exEl('div', 'row2');
  const put = exEl('button', 'btn solid', 'วางผลลงหน้า'); put.onclick = () => poolPut(P, rows); r2.appendChild(put);
  const st = exEl('button', 'btn', 'ส่งไปสถิติ'); st.onclick = () => { const head = P.vars.map((v) => v.n.replace(/\s+/g, '_')).join(' '); need('stats').then(() => openStats(head + '\n' + rows.map((r) => r.v.join(' ')).join('\n'))); }; r2.appendChild(st);
  if (P.open) { const cl = exEl('button', 'btn', 'ปิดรับข้อมูล'); cl.onclick = () => { P.open = false; liveSend('poolend', { id: P.id }); liveRender(); }; r2.appendChild(cl); }
  const nw = exEl('button', 'btn', 'เริ่มชุดใหม่'); nw.onclick = () => { if (P.open) liveSend('poolend', { id: P.id }); LIVE.pool = null; liveRender(); }; r2.appendChild(nw);
  box.appendChild(r2);
  if (two) box.appendChild(exEl('div', 'note small', 'แกนนอน ' + esc(nm(P.vars[0])) + ' แกนตั้ง ' + esc(nm(P.vars[1]))));
}
function poolView(P, rows) {
  if (!rows.length) return '<div class="note small">รอผู้เรียนส่งค่า</div>';
  const nm = (v) => v.n + (v.u ? ' (' + v.u + ')' : '');
  if (P.vars.length === 2) {
    const xs = rows.map((r) => r.v[0]), ys = rows.map((r) => r.v[1]), F = dsFit(xs, ys);
    return (F ? '<div class="dsres"><span><i>เส้นตรงที่ดีที่สุด</i> ความชัน ' + esc(sig3(F.m)) + ' ± ' + esc(sig3(F.sm)) + ', จุดตัด ' + esc(sig3(F.c)) + ' ± ' + esc(sig3(F.sc)) + ', R² ' + F.r2.toFixed(3) + '</span></div>' + dsSvg(xs, ys, F, null, nm(P.vars[0]), nm(P.vars[1])) : '<div class="note small">ต้องมีค่าอย่างน้อย 2 คู่</div>');
  }
  const v = rows.map((r) => r.v[0]), T = poolStats(v), u = P.vars[0].u || '';
  return '<div class="dsres"><span><i>ค่าเฉลี่ย</i> <b>' + esc(sig3(T.mean)) + ' ± ' + esc(sig3(T.se)) + ' ' + esc(u) + '</b> (ความคลาดเคลื่อนมาตรฐาน, n = ' + T.n + ')</span><span><i>ส่วนเบี่ยงเบนมาตรฐาน</i> ' + esc(sig3(T.sd)) + '  <i>มัธยฐาน</i> ' + esc(sig3(T.med)) + '  <i>ช่วง</i> ' + esc(sig3(T.min)) + ' ถึง ' + esc(sig3(T.max)) + '</span>'
    + (T.out.length ? '<span><i>ค่าที่ผิดปกติ</i> <b>' + T.out.map((x) => esc(sig3(x))).join(', ') + '</b> จาก ' + esc(rows.filter((r) => T.out.includes(r.v[0])).map((r) => r.name).slice(0, 4).join(', ')) + '</span>' + (() => { const k = v.filter((x) => !T.out.includes(x)); if (k.length < 2) return ''; const T2 = poolStats(k); return '<span><i>ไม่นับค่าผิดปกติ</i> ' + esc(sig3(T2.mean)) + ' ± ' + esc(sig3(T2.se)) + ' ' + esc(u) + ' (n = ' + T2.n + ')</span>'; })() : '') + '</div>' + poolDots(v, T, nm(P.vars[0]));
}
/* every value as a dot on one line, stacked where they meet, with the mean and the spread marked */
function poolDots(v, T, label) {
  const lo = T.min - (T.max - T.min || 1) * 0.08, hi = T.max + (T.max - T.min || 1) * 0.08, X = (x) => 20 + (x - lo) / (hi - lo) * 280, bins = new Map();
  let s = '<svg class="dssvg" viewBox="0 0 320 150" role="img" aria-label="ค่าที่ทั้งห้องวัดได้"><path d="M20 120H300" stroke="currentColor" stroke-opacity="0.45"/>';
  s += '<rect x="' + X(T.mean - T.sd).toFixed(1) + '" y="18" width="' + Math.max(1, X(T.mean + T.sd) - X(T.mean - T.sd)).toFixed(1) + '" height="102" fill="#2E8B57" fill-opacity="0.08"/><path d="M' + X(T.mean).toFixed(1) + ' 14V120" stroke="#2E8B57" stroke-width="1.6"/>';
  for (const x of v.slice().sort((a, b) => a - b)) { const k = Math.round(X(x) / 7), h = (bins.get(k) || 0); bins.set(k, h + 1); const odd = T.out.includes(x); s += '<circle cx="' + X(x).toFixed(1) + '" cy="' + (114 - h * 7).toFixed(1) + '" r="3.2" fill="' + (odd ? '#C2571A' : '#2F4BB8') + '"/>'; }
  for (const t of [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1]) s += '<text x="' + X(t).toFixed(1) + '" y="136" text-anchor="middle" font-size="10" fill="currentColor">' + esc(sig3(t)) + '</text>';
  return s + '<text x="300" y="148" text-anchor="end" font-size="10" fill="currentColor">' + esc(label) + '</text></svg><div class="note small">เส้นเขียวคือค่าเฉลี่ย แถบจางคือหนึ่งส่วนเบี่ยงเบนมาตรฐาน จุดสีส้มคือค่าที่ผิดปกติ</div>';
}
function poolPut(P, rows) {
  if (!S.page || !rows.length) return;
  const w = 560, at = viewSpot(w, 520), nm = (v) => v.n + (v.u ? ' (' + v.u + ')' : '');
  let md, svg;
  if (P.vars.length === 2) { const xs = rows.map((r) => r.v[0]), ys = rows.map((r) => r.v[1]), F = dsFit(xs, ys); if (!F) return; md = '**ข้อมูลทั้งห้อง** ' + rows.length + ' คู่\n\nความชัน ' + sig3(F.m) + ' ± ' + sig3(F.sm) + ', จุดตัด ' + sig3(F.c) + ' ± ' + sig3(F.sc) + ', $R^2$ = ' + F.r2.toFixed(3); svg = dsSvg(xs, ys, F, null, nm(P.vars[0]), nm(P.vars[1])); }
  else { const v = rows.map((r) => r.v[0]), T = poolStats(v), u = P.vars[0].u || ''; md = '**' + P.vars[0].n + ' ทั้งห้อง** n = ' + T.n + '\n\nค่าเฉลี่ย ' + sig3(T.mean) + ' ± ' + sig3(T.se) + ' ' + u + ' (ความคลาดเคลื่อนมาตรฐาน), ส่วนเบี่ยงเบนมาตรฐาน ' + sig3(T.sd) + ' ' + u + (T.out.length ? '\n\nค่าที่ผิดปกติ ' + T.out.map(sig3).join(', ') : ''); svg = poolDots(v, T, nm(P.vars[0])); }
  addItem({ type: 'text', x: at[0], y: at[1], w, md });
  const sv = svg.replace(/<div[\s\S]*$/, '').replace('class="dssvg"', 'xmlns="http://www.w3.org/2000/svg" style="color:#555"').replace(/currentColor/g, '#555');
  addItem({ type: 'svg', x: at[0], y: at[1] + 120, w, svg: sv });
  toast('วางผลของทั้งห้องแล้ว', 1600);
}
function poolGot(d) {
  const P = LIVE.pool; if (!P || !P.open || !d || d.id !== P.id || typeof d.sid !== 'string' || !Array.isArray(d.vals)) return;
  const v = d.vals.slice(0, P.vars.length).map(Number); if (v.length !== P.vars.length || !v.every(isFinite)) return;
  const lc = LIVE.clsId && CLS.list.find((x) => x.id === LIVE.clsId), r = lc && typeof d.stu === 'string' ? (lc.roster || []).find((x) => x.sid === d.stu) : null;
  const name = r ? r.no + '. ' + r.name : String(liveNames()[d.sid] || d.name || 'ไม่ระบุชื่อ').slice(0, 40);
  const g = P.got[d.sid] || (P.got[d.sid] = { name, rows: [] }); g.name = name; if (g.rows.length < 20) g.rows.push(v);
  clearTimeout(P.t); P.t = setTimeout(liveRender, 250);
}
/* learner: a small card asks for the value(s); each send adds one measurement */
function poolShow(p) {
  if (!p || typeof p.id !== 'string' || !Array.isArray(p.vars)) return;
  let c = $('#poolCard'); if (!c) { c = document.createElement('div'); c.id = 'poolCard'; c.className = 'poolcard no-ink'; document.body.appendChild(c); }
  const vars = p.vars.slice(0, 2).map((v) => ({ n: String(v.n || '').slice(0, 40), u: String(v.u || '').slice(0, 12) }));
  c.dataset.id = p.id; c.hidden = false; const sent = [];
  const paint = () => {
    c.innerHTML = '<b>ผู้สอนขอค่าที่วัดได้</b>' + vars.map((v, i) => '<label class="field"><span>' + esc(v.n + (v.u ? ' (' + v.u + ')' : '')) + '</span><input inputmode="decimal" data-i="' + i + '"></label>').join('')
      + '<div class="row2"><button class="btn solid" type="button" data-a="send">ส่งค่านี้</button><button class="btn" type="button" data-a="hide">ซ่อน</button></div>' + (sent.length ? '<div class="note small">ส่งแล้ว ' + sent.length + ' ค่า: ' + esc(sent.slice(-5).map((r) => r.join(', ')).join(' | ')) + '</div>' : '');
    c.querySelector('[data-a="hide"]').onclick = () => { c.hidden = true; };
    c.querySelector('[data-a="send"]').onclick = () => {
      const vals = [...c.querySelectorAll('input')].map((i) => dsNum(i.value)); if (!vals.every(isFinite)) { toast('ใส่ตัวเลขให้ครบ', 1800); return; }
      liveSend('ans', { id: p.id, sid: LIVE.sid, name: LIVE.name, stu: LIVE.stu || null, vals }); sent.push(vals); toast('ส่งแล้ว', 1200); paint();
      const f = c.querySelector('input'); if (f) f.focus();
    };
  };
  paint();
}
function poolEnd(p) { const c = $('#poolCard'); if (c && (!p || p.id === c.dataset.id)) c.hidden = true; }
/* ---------- checking a worked calculation: the AI only reads the lines as written; the units, the arithmetic and the
   significant figures are checked here with a units-aware calculator ---------- */
function sigCount(str) {
  let t = String(str).trim().replace(/^[+\-−]/, '').replace(/\s/g, ''); const m = t.match(/^([0-9]*\.?[0-9]*)(?:[eE×x]\*?10\^?\(?([+\-−]?\d+)\)?)?/); if (!m || !m[1]) return null;
  let d = m[1]; const dot = d.includes('.'); d = d.replace('.', '');
  d = d.replace(/^0+/, ''); if (!d) return dot ? 1 : null;
  if (!dot) { const z = d.match(/0+$/); return { n: d.length - (z ? z[0].length : 0), exact: !dot && !m[2] }; }
  return { n: d.length, exact: false };
}
async function unitCheck() {
  if (!S.sel) return;
  const refs = S.sel.strokes.slice(), box = S.sel.box.slice();
  const texts = S.sel.items.map(findItem).filter((it) => it && (!it.type || it.type === 'text') && it.md).map((it) => it.md).join('\n').slice(0, 3000);
  if (!refs.length && !texts) return; if (!needAI('read')) return;
  openAI(); const B = busyCard('ตรวจหน่วยและเลขนัยสำคัญ');
  try {
    await loadLib('math');
    const img = refs.length ? await inkBlob(refs) : null;
    const res = await AI.run('read', 'This is a worked calculation in a science notebook. Read every line that computes a result, exactly as written (numbers with all their digits, units as written). Do not correct anything.\n'
      + 'For each such line answer one line:\n@@STEP <the expression with its units in math.js syntax, each given quantity with its unit, e.g. (2.0 kg) * (9.8 m/s^2)> | <the result the writer wrote, number and unit, e.g. 19.6 N> | <the line as written, short>\n'
      + 'Units in math.js names: m, cm, mm, km, s, min, h, kg, g, N, J, W, Pa, kPa, V, A, ohm, C, K, degC, mol, L, mL, Hz, rad, deg. Powers with ^. If a value has no unit, write it bare. No other words.' + (texts ? '\nTyped text in the selection:\n' + texts : ''),
      { images: img ? [img.blob] : [], maxTokens: 1500, cache: false, signal: B.ctl.signal, noCtx: true });
    const steps = String(res.text || '').split('\n').filter((l) => /^@@STEP/.test(l.trim())).map((l) => l.trim().replace(/^@@STEP\s*/, '').split('|').map((x) => x.trim()));
    if (!steps.length) throw { msg: 'ไม่พบบรรทัดคำนวณที่อ่านได้ ลองวงเฉพาะบรรทัดคำนวณ' };
    const M = window.math, out = [];
    for (const [expr, wrote, line] of steps.slice(0, 12)) {
      const r = { line: line || expr, expr, wrote, ok: true, msg: [] };
      let val = null; try { val = M.evaluate(expr.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/')); } catch (e) { r.msg.push('อ่านนิพจน์ไม่ได้'); r.ok = false; }
      const wm = String(wrote || '').replace(/−/g, '-').match(/^\s*([+\-]?[0-9.]+(?:\s*[eE]\s*[+\-]?\d+|\s*[×x]\s*10\^?\(?[+\-]?\d+\)?)?)\s*(.*)$/);
      const wnum = wm ? Number(wm[1].replace(/\s/g, '').replace(/[×x]10\^?\(?([+\-]?\d+)\)?/, 'e$1')) : NaN, wunit = wm ? wm[2].trim() : '';
      if (val != null && wm) {
        try {
          const isU = val && typeof val === 'object' && val.type === 'Unit';
          if (isU && wunit) {
            let wu = null; try { wu = M.unit(wunit); } catch (e) { r.msg.push('ไม่รู้จักหน่วย ' + wunit); }
            if (wu && !val.equalBase(wu)) { r.ok = false; r.msg.push('หน่วยไม่สอดคล้อง ผลที่คำนวณได้มีหน่วย ' + val.formatUnits()); }
            else if (wu) { const v = val.toNumber(wunit); r.calc = v; if (Math.abs(v - wnum) > Math.max(1e-12, Math.abs(v) * 0.02)) { r.ok = false; r.msg.push('ค่าที่ถูกคือประมาณ ' + sig3(v) + ' ' + wunit); } }
          } else if (isU && !wunit) { r.ok = false; r.msg.push('ผลลัพธ์ต้องมีหน่วย ' + val.formatUnits()); }
          else if (!isU && wunit && !/^(%|rad|deg)?$/.test(wunit)) { r.msg.push('นิพจน์ไม่มีหน่วยแต่ผลเขียนหน่วย ' + wunit + ' ตรวจว่าลืมใส่หน่วยของข้อมูลหรือไม่'); }
          else if (!isU) { const v = Number(val); r.calc = v; if (isFinite(v) && Math.abs(v - wnum) > Math.max(1e-12, Math.abs(v) * 0.02)) { r.ok = false; r.msg.push('ค่าที่ถูกคือประมาณ ' + sig3(v)); } }
        } catch (e) { r.msg.push('ตรวจหน่วยไม่ได้'); }
      }
      /* significant figures: the result keeps as many as the least precise measured value (for multiplying and dividing) */
      /* only measured values count (a number written with its unit); bare numbers such as 1/2 or 2 are exact */
      const nums = (expr.match(/(?<![\w^.])\d+\.?\d*(?:e[+\-]?\d+)?(?=\s*[a-zA-Zµ°Ω])/g) || []).map((x) => sigCount(x)).filter(Boolean).map((x) => ({ n: x.n }));
      const ws = wm ? sigCount(wm[1]) : null;
      if (nums.length && ws && !/[+\-]\s*\(/.test(expr.replace(/^\s*-/, ''))) { const need = Math.min(...nums.map((x) => x.n)); r.sig = [ws.n, need]; if (ws.n !== need) r.msg.push('เลขนัยสำคัญ ' + ws.n + ' ตัว ควรเป็น ' + need + ' ตัว ตามข้อมูลที่มีเลขนัยสำคัญน้อยที่สุด'); }
      out.push(r);
    }
    const okAll = out.every((r) => r.ok && !r.msg.length);
    B.d.innerHTML = '<span class="k">ตรวจหน่วยและเลขนัยสำคัญ</span>' + (okAll ? '<div class="note">ทุกบรรทัดหน่วยสอดคล้อง ค่าถูก และเลขนัยสำคัญเหมาะสม</div>' : '')
      + '<div class="dsres">' + out.map((r, i) => '<span><i>' + (i + 1) + ')</i> ' + esc(r.line) + ' <b>' + (r.ok && !r.msg.length ? 'ถูกต้อง' : esc(r.msg.join('; ') || 'ถูกต้อง')) + '</b></span>').join('') + '</div>'
      + '<div class="note small">เลขนัยสำคัญตรวจตามกฎการคูณและหาร นับเฉพาะค่าที่วัดซึ่งมีหน่วย ตัวเลขที่ไม่มีหน่วย เช่น 1/2 หรือ 2 นับเป็นค่าที่แน่นอน ส่วนการบวกลบให้ดูตำแหน่งทศนิยมเอง</div>'
      + '<div class="row"><button class="btn" data-a="put">วางผลตรวจบนหน้า</button></div>';
    B.d.querySelector('[data-a="put"]').onclick = () => { const md = '**ตรวจหน่วยและเลขนัยสำคัญ**\n\n' + out.map((r, i) => (i + 1) + ') ' + r.line + ' : ' + (r.ok && !r.msg.length ? 'ถูกต้อง' : r.msg.join('; '))).join('\n\n'); proofPut(md, box, out.length * 2 + 2); toast('วางผลตรวจแล้ว', 1400); };
  } catch (e) { B.d.innerHTML = '<span class="k">ตรวจหน่วยและเลขนัยสำคัญ</span><div class="note err">' + esc(e && e.msg ? e.msg : aiErr(e)) + '</div>'; }
}

