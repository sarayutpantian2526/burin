/* BURIN part: typed (loaded when first used) */
/* ---------- typed text needs no AI (task 8.15): what is typed is read here, at once and offline. A graph from a typed
   equation, a typed table as data, the units and figures of a typed calculation, a sketch tidied with the shape finder of
   the pen, and advice after practice from the scores. When the app cannot read it, the work goes to the AI as before ---------- */
const TY_GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', theta: 'θ', lambda: 'λ', mu: 'μ', omega: 'ω', phi: 'φ', tau: 'τ', rho: 'ρ', sigma: 'σ' };
/* LaTeX and the signs people type, as math.js reads them; units: µ, Ω and ° as math.js names them */
function tyMath(s, units) {
  let t = String(s == null ? '' : s).replace(/\$/g, ' ').replace(/\\(?:left|right)\s*/g, '').replace(/\\[,;:!]|\\quad|\\qquad|\\ |~/g, ' ');
  t = t.replace(/\\(?:text|mathrm|operatorname|mathit|mathbf|rm)\s*\{([^{}]*)\}/g, ' $1 ');
  for (let k = 0; k < 4; k++) t = t.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))').replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)');
  t = t.replace(/\^\s*\{([^{}]*)\}/g, '^($1)').replace(/_\s*\{([^{}]*)\}/g, '_$1');
  t = t.replace(/\\(?:cdot|times)/g, '*').replace(/\\div/g, '/').replace(/\\pi\b/g, 'pi').replace(/\\ln\b/g, 'LNX').replace(/\\log\b/g, 'log10').replace(/\\(sin|cos|tan|exp)\b/g, '$1');
  t = t.replace(/\\([a-z]+)\b/g, (m, w) => (TY_GREEK[w] ? w : m));
  t = t.replace(/[−–]/g, '-').replace(/[×·⋅]/g, '*').replace(/÷/g, '/').replace(/²/g, '^2').replace(/³/g, '^3').replace(/√\s*\(/g, 'sqrt(').replace(/√\s*([\w.]+)/g, 'sqrt($1)').replace(/π/g, 'pi');
  if (units) t = t.replace(/[µμ]/g, 'u').replace(/Ω/g, 'ohm').replace(/°\s*C\b/g, 'degC').replace(/°/g, ' deg');
  else { for (const [w, g] of Object.entries(TY_GREEK)) t = t.split(g).join(w); t = t.replace(/\bln\s*\(/g, 'LNX(').replace(/\blog\s*\(/g, 'log10('); }
  if (units) t = t.replace(/\bmu(?=[A-Za-z])/g, 'u');
  return t.replace(/LNX/g, 'log').replace(/[{}]/g, (c) => (c === '{' ? '(' : ')')).replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\(\(([\w.]+)\)\/\(([\w.]+)\)\)/g, '($1/$2)').trim();
}
const TY_NAME = /^([A-Za-z][A-Za-z0-9_]*)\s*(?:\(\s*([A-Za-z][A-Za-z0-9_]*)\s*\))?$/;
/* typed equations to a graph item, or null when it is not one function of one variable (the AI makes the rest) */
function tyGraph(text) {
  const M = window.math; if (!M) return null;
  const pieces = String(text || '').replace(/[฀-๿]+/g, '\n').split(/\n|;|,(?=\s*\$?\s*[A-Za-z]\w*\s*(?:\([^)]*\))?\s*=)/).map((x) => x.replace(/\$/g, ' ').trim()).filter((x) => x.includes('='));
  if (!pieces.length) return null;
  const consts = {}, curves = [];
  for (const pc of pieces) {
    if (/[<>≤≥≈≠]|==/.test(pc)) return null;
    const eq = pc.split('='); if (eq.length !== 2) return null;
    const lhs = tyMath(eq[0]), rhs = tyMath(eq[1]), nm = lhs.match(TY_NAME); if (!nm || !rhs) return null;
    /* a value: "g = 9.8 m/s^2" or "a = 2" (a unit written apart from its number, so 3t stays three times t) */
    const cm = rhs.match(/^([+\-]?\d*\.?\d+(?:e[+\-]?\d+)?)(?:\s+(\S.*))?$/i);
    if (cm && !nm[2]) { let ok = !cm[2]; if (cm[2]) { try { M.unit(cm[2]); ok = true; } catch (e) { ok = false; } } if (ok) { consts[nm[1]] = { v: +cm[1], u: cm[2] || '' }; continue; } }
    let syms; try { syms = exprSymbols(rhs, ''); } catch (e) { return null; }
    /* letters run together (ma, mv) are a product the app cannot tell from one name: the AI reads those */
    if (syms.some((x) => /^[A-Za-z]{2,}$/.test(x) && !TY_GREEK[x])) return null;
    curves.push({ name: nm[1], arg: nm[2] || '', rhs, syms, src: pc });
  }
  if (!curves.length) return null;
  const names = curves.map((c) => c.name);
  if (names.includes('x') && names.includes('y')) return null; /* x(t), y(t): a parametric curve */
  let xvar = '';
  for (const c of curves) {
    const free = c.syms.filter((s) => !consts[s]);
    let v = c.arg || (free.includes('x') ? 'x' : free.includes('t') ? 't' : free.includes('theta') ? 'theta' : free.length === 1 ? free[0] : '');
    if (!v || v === c.name || (xvar && v !== xvar)) return null;
    xvar = v;
  }
  const params = {}, order = [];
  for (const c of curves) for (const s of c.syms) {
    if (s === xvar || params[s]) continue;
    const k = consts[s];
    if (k) { const v = k.v, mn = v > 0 ? 0 : v < 0 ? 2 * v : -10, mx = v > 0 ? 2 * v : v < 0 ? 0 : 10; params[s] = { label: s + (k.u ? ' (' + k.u + ')' : ''), v, min: mn, max: mx, step: Math.round((mx - mn) / 100 * 1e6) / 1e6 || 0.1 }; }
    else params[s] = { label: s, v: 1, min: 0, max: 10, step: 0.1 };
    order.push(s);
  }
  const use = curves.slice(0, 3), scope = {}; for (const [k, p] of Object.entries(params)) scope[k] = p.v;
  const trig = use.some((c) => /\b(sin|cos|tan)\s*\(/.test(c.rhs));
  let x0 = xvar === 't' ? 0 : -10, x1 = 10;
  if (xvar === 'theta' && trig) { x0 = 0; x1 = 6.2832; }
  const finite = (a, b) => { let n = 0; for (const c of use) { const code = compileExpr(c.rhs).code; for (let i = 0; i <= 20; i++) { scope[xvar] = a + (b - a) * i / 20; if (isFinite(evalAt(code, scope))) n++; } } return n; };
  try { if (x0 < 0 && !finite(x0, -0.01)) x0 = 0; if (finite(x0, x1) < 3) return null; } catch (e) { return null; }
  const one = use.length === 1 ? use[0] : null, title = use.map((c) => (/\\/.test(c.src) ? (c.arg ? c.name + '(' + c.arg + ')' : c.name) + ' = ' + c.rhs : c.src.replace(/\s+/g, ' '))).join(', ').slice(0, 60);
  return { type: 'graph', title: title || 'กราฟ', xvar, exprs: use.map((c) => c.rhs), params, order, xl: xvar, yl: one ? (one.arg ? one.name + '(' + one.arg + ')' : one.name) : '', x0, x1, y0: null, y1: null };
}
/* a typed table: Markdown, comma, tab or space separated; the largest block with at least two rows of numbers */
const TY_NUM = /^[+\-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+\-]?\d+)?$/;
function tyCells(l) {
  if (l.includes('|')) return l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  if (l.includes('\t')) return l.split('\t').map((c) => c.trim());
  if (/,/.test(l) && !/[฀-๿]/.test(l)) return l.split(',').map((c) => c.trim());
  return l.split(/\s+/).filter(Boolean);
}
function tyTable(text) {
  const ls = String(text || '').replace(/\$/g, '').replace(/[−–]/g, '-').split('\n').map((l) => l.trim());
  const num = (c) => TY_NUM.test(c.replace(/\s/g, ''));
  let best = null, cur = null;
  const close = () => { if (cur && cur.rows.length >= 2 && (!best || cur.rows.length > best.rows.length)) best = cur; cur = null; };
  for (const l of ls) {
    if (!l) { close(); continue; }
    if (/^\|?\s*:?-{2,}/.test(l)) continue;
    const c = tyCells(l), isNum = c.length >= 2 && c.every(num);
    if (isNum && cur && (c.length === cur.n || (!cur.rows.length && cur.named && cur.named.length === c.length))) { if (c.length !== cur.n) { cur.n = c.length; cur.head = cur.named; } cur.rows.push(c); continue; }
    close();
    if (isNum) { cur = { n: c.length, head: null, rows: [c] }; continue; }
    /* a heading line: as many cells, or names with their units, "t (s)  x (m)" */
    const named = l.replace(/^\|/, '').replace(/\|$/, '').match(/[^\s|,\t()]+(?:\s*\([^)]*\))?/g) || [];
    cur = { n: c.length, head: c, rows: [], named };
  }
  close();
  if (!best || best.n < 2) return null;
  let head = best.head;
  if (head && head.length !== best.n) head = best.named && best.named.length === best.n ? best.named : null;
  if (!head) head = Array.from({ length: best.n }, (_, i) => 'คอลัมน์ ' + (i + 1));
  return { head: head.map((h) => h.replace(/[*_`]/g, '').trim()), rows: best.rows };
}
/* typed calculation lines to the steps the unit check works on: [expression, the result as written, the line] */
function tySteps(text) {
  const M = window.math, steps = []; let miss = 0;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.replace(/\$/g, ' ').replace(/\s+/g, ' ').trim(); if (!line || !line.includes('=')) continue;
    const seg = line.split('='); if (seg.length < 2) continue;
    /* the result: the last part, a number with its unit (× 10^n kept for the check) */
    const last = tyMath(seg[seg.length - 1].replace(/\\times|\\cdot/g, '×'), true).replace(/\*\s*10\s*\^/g, '×10^').replace(/[฀-๿].*$/, '').trim();
    if (!/^[+\-]?\d*\.?\d+/.test(last)) continue;
    let expr = '';
    for (let j = seg.length - 2; j >= 0; j--) {
      const e = tyMath(seg[j], true).replace(/[฀-๿]+/g, ' ').trim();
      if (/\d/.test(e) && ((e.match(/\d*\.?\d+/g) || []).length >= 2 || /\b(sqrt|sin|cos|tan|log)\s*\(/.test(e))) { expr = e; break; }
      if (/\d/.test(e)) break;
    }
    if (!expr) continue;
    let ok = false; try { const v = M.evaluate(expr); ok = v != null && (typeof v === 'number' ? isFinite(v) : v.type === 'Unit'); } catch (e) { ok = false; }
    if (ok) steps.push([expr, last, (/\\/.test(line) ? tyMath(line, true) : line).slice(0, 80)]); else miss++;
  }
  return { steps: steps.slice(0, 12), miss };
}
/* a sketch tidied in the notebook: each pen stroke the shape finder knows becomes that clean shape; small strokes
   (letters and labels) stay as written */
function tyTidy(refs) {
  const list = [];
  for (const rf of refs || []) {
    if (rf.layer === 'teacher' && isStudentSide()) continue;
    const s = layerArr(rf.layer).find((x) => x.id === rf.id); if (!s || (s.k && s.k !== 'p') || isLockedRef(s.id)) continue;
    list.push({ rf, s, b: sbox(s) });
  }
  if (!list.length) return null;
  const x0 = Math.min(...list.map((o) => o.b[0])), y0 = Math.min(...list.map((o) => o.b[1])), x1 = Math.max(...list.map((o) => o.b[2])), y1 = Math.max(...list.map((o) => o.b[3]));
  const big = Math.max(36, 0.18 * Math.max(x1 - x0, y1 - y0)), out = [];
  for (const o of list) {
    if (Math.max(o.b[2] - o.b[0], o.b[3] - o.b[1]) < big) continue;
    const sh = recognize(o.s.p); if (!sh) continue;
    let pr = 0, n = 0; for (let i = 2; i < o.s.p.length; i += 3) { pr += o.s.p[i]; n++; }
    out.push({ layer: o.rf.layer, id: o.s.id, p: shapePts(sh, Math.round(n ? pr / n : 55)), name: sh.name });
  }
  return out.length ? out : null;
}
/* after practice: for a chapter that went badly, what kind of question slipped and which wrong ideas the chosen
   answers point to, from the scores alone */
function tyAdvice(R, t, ch) {
  const xs = R.items.filter((x) => x.q.t === t && x.q.ch === ch && x.pick !== x.key); if (!xs.length) return '';
  const kn = { analyze: 'ข้ออ่านกราฟหรือรูป', apply: 'ข้อคำนวณ' }, kinds = {}, mis = [];
  for (const x of xs) {
    const k = kn[qKind(x.q)] || 'ข้อหลักการ'; kinds[k] = (kinds[k] || 0) + 1;
    const oi = x.pick >= 0 ? x.order[x.pick] : -1, w = oi > 0 && x.q.w && x.q.w[oi - 1]; if (w && !mis.includes(w)) mis.push(w);
  }
  const none = xs.filter((x) => x.pick < 0).length, easy = xs.filter((x) => (x.q.d || 1) === 1).length;
  let h = '<b>ที่พลาด</b> ' + Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => esc(k) + ' ' + n + ' ข้อ').join(' ') + (none ? ' ไม่ได้ตอบ ' + none + ' ข้อ' : '');
  if (mis.length) h += '<br><b>ความเข้าใจที่ควรแก้</b> ' + mis.slice(0, 2).map((w) => mdToHtml(w)).join(' ');
  if (easy >= 2) h += '<br>พลาดข้อง่าย ' + easy + ' ข้อ เริ่มจากทบทวนนิยามและหลักการของบทนี้ก่อนฝึกข้อยาก';
  return h;
}

