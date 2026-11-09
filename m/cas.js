/* BURIN part: cas (loaded when first used) */

/* ---------- solving equations: an exact algebra engine (nerdamer) does the algebra, numbers with units come from math.js,
   a numeric search finds roots the algebra cannot write down, and AI only reads handwriting or explains the steps ---------- */
const CAS_FUNCS = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sqrt', 'log', 'log10', 'exp', 'abs',
  'diff', 'integrate', 'defint', 'limit', 'sum', 'product', 'factor', 'expand', 'simplify', 'partfrac', 'matrix', 'determinant', 'invert', 'transpose', 'dot', 'cross', 'vector', 'laplace', 'ilt', 'mean', 'median', 'det', 'inv', 'rank', 'rref', 'eig', 'taylor', 'gcd', 'lcm', 'ode'];
const CAS_GREEK = ['alpha', 'beta', 'gamma', 'delta', 'Delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'Lambda', 'mu', 'nu', 'xi', 'rho', 'sigma', 'Sigma', 'tau', 'phi', 'varphi', 'Phi', 'chi', 'psi', 'Psi', 'omega', 'Omega', 'pi'];
const CAS_KEEP = new Set(CAS_FUNCS.concat(CAS_GREEK, ['Infinity', 'e', 'i']));
/* LaTeX or typed math into the plain form the algebra engine reads */
function texToCas(src) {
  let t = String(src || '');
  t = t.replace(/\$+/g, ' ').replace(/\\\(|\\\)|\\\[|\\\]/g, ' ');
  t = t.replace(/[×·∙]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').replace(/π/g, ' pi ').replace(/θ/g, ' theta ').replace(/ω/g, ' omega ').replace(/Δ/g, ' Delta ').replace(/λ/g, ' lambda ').replace(/μ/g, ' mu ').replace(/α/g, ' alpha ').replace(/β/g, ' beta ').replace(/√/g, 'sqrt');
  /* matrices: \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix} becomes [[1,2],[3,4]] */
  t = t.replace(/\\begin\{[pbvBV]?matrix\}([\s\S]*?)\\end\{[pbvBV]?matrix\}/g, (m, body) => '[' + body.split(/\\\\|\\cr/).map((r) => r.trim()).filter(Boolean).map((r) => '[' + r.split('&').map((c) => c.trim()).join(',') + ']').join(',') + ']');
  /* derivatives in time and space: dy/dt, d^2y/dt^2, the dot over a letter, all become primes */
  t = t.replace(/\\frac\{d\^\{?(\d)\}?\s*\\?([A-Za-z]+)\}\{d\s*\\?[A-Za-z]+\^\{?\d\}?\}/g, (m, n, v) => ' ' + v + "'".repeat(+n) + ' ');
  t = t.replace(/\\frac\{d\s*\\?([A-Za-z]+)\}\{d\s*\\?[A-Za-z]+\}/g, " $1' ");
  t = t.replace(/\\ddot\{?\\?([A-Za-z]+)\}?/g, " $1'' ").replace(/\\dot\{?\\?([A-Za-z]+)\}?/g, " $1' ");
  t = t.replace(/\\(?:leq?|leqslant)\b/g, '<=').replace(/\\(?:geq?|geqslant)\b/g, '>=').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/\\(?:lt)\b/g, '<').replace(/\\(?:gt)\b/g, '>');
  t = t.replace(/\\overset\{\\rightharpoonup\}\{([^{}]*)\}/g, '$1');
  t = t.replace(/\\left(?![a-zA-Z])|\\right(?![a-zA-Z])|\\displaystyle|\\limits/g, '').replace(/\\[,;:! ]/g, ' ').replace(/\\quad|\\qquad/g, ' ');
  /* sin squared x: \sin^{2} x is (sin x)^2 */
  t = t.replace(/\\(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)\^\{?(\d+)\}?\s*(\\?[A-Za-z0-9_]+|\([^()]*\))/g, (m, f, n, a) => '(' + f + '(' + a.replace(/^\\/, '') + '))^' + n);
  t = t.replace(/\\(?:vec|overrightarrow|hat|bar|mathbf|boldsymbol|mathit|mathrm|text|operatorname)\{([^{}]*)\}/g, '$1');
  /* calculus written the usual way */
  t = t.replace(/\\int_\{?([^{}\s^]+)\}?\^\{?([^{}\s]+)\}?\s*(.+?)\s*\\?,?\s*d([a-zA-Z])\b/g, 'defint($3,$1,$2,$4)');
  t = t.replace(/\\int\s*(.+?)\s*\\?,?\s*d([a-zA-Z])\b/g, 'integrate($1,$2)');
  t = t.replace(/\\frac\{d\}\{d([a-zA-Z])\}\s*(.+)$/g, (m, v, f) => 'diff(' + f + ',' + v + ')');
  t = t.replace(/\\lim_\{?\s*([a-zA-Z])\s*\\to\s*([^{}]+?)\}?\s+(.+)$/g, 'limit($3,$1,$2)');
  t = t.replace(/\\sum_\{?\s*([a-zA-Z])\s*=\s*([^{}]+?)\}?\^\{?([^{}\s]+)\}?\s*(.+)$/g, 'sum($4,$1,$2,$3)');
  let prev;
  do { prev = t;
    t = t.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))');
    t = t.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, '(($2)^(1/($1)))');
    t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)');
    t = t.replace(/_\{([^{}]*)\}/g, (m, a) => '_' + a.replace(/[^A-Za-z0-9]/g, ''));
    t = t.replace(/\^\{([^{}]*)\}/g, '^($1)');
  } while (t !== prev);
  t = t.replace(/\\(?:cdot|times|ast)/g, '*').replace(/\\div/g, '/').replace(/\\infty/g, 'Infinity').replace(/\\ln\b/g, 'log').replace(/\\log\b/g, 'log10');
  t = t.replace(/\\([A-Za-z]+)/g, ' $1 ');
  t = t.replace(new RegExp('\\b(' + CAS_FUNCS.join('|') + ')\\s+\\(', 'g'), '$1(');
  t = t.replace(/[{}]/g, (c) => (c === '{' ? '(' : ')'));
  /* subscripts join the name: v_0 is one variable v0, v_max is v_max */
  t = t.replace(/([A-Za-z])_([A-Za-z0-9]+)/g, (m, a, b) => (/^\d+$/.test(b) ? a + b : a + '_' + b));
  /* a function written without brackets: sin x becomes sin(x) */
  t = t.replace(new RegExp('\\b(' + CAS_FUNCS.slice(0, 17).join('|') + ')\\s*([A-Za-z0-9_.]+)(?!\\s*\\()', 'g'), '$1($2)');
  /* letters written next to each other multiply (at is a times t) unless the name is a function, a Greek letter or has a subscript */
  t = t.replace(/[A-Za-z][A-Za-z0-9_]*/g, (w) => {
    if (CAS_KEEP.has(w) || /_/.test(w) || /^[A-Za-z]\d+$/.test(w) || w.length === 1) return w;
    const m = w.match(/^([A-Za-z]+)(\d*)$/); if (!m) return w;
    const letters = m[1].split(''); if (m[2]) letters[letters.length - 1] += m[2];
    return letters.join('*');
  });
  t = t.replace(/(\d)\s*\(/g, '$1*(').replace(/\)\s*\(/g, ')*(').replace(/\)\s*([A-Za-z0-9])/g, ')*$1');
  t = t.replace(/([A-Za-z0-9_)])\s+(?=[A-Za-z0-9_(])/g, '$1*');
  t = t.replace(/\s+/g, '').replace(/≠/g, '!=').replace(/[≈≅]/g, '=');
  /* a starting value y(0) = 1 or y'(0) = 0 is a function value, not a product */
  t = t.replace(/([A-Za-z][A-Za-z0-9_]*'*)\*\((-?[\d.]+)\)=/g, '$1($2)=');
  return t;
}
/* the engine's answer back to LaTeX for the page; v0 is written v with a subscript 0 */
function casTex(x) {
  let s; try { s = nerdamer(String(x)).toTeX(); } catch (e) { s = String(x); }
  for (let k = 0; k < 3; k++) s = s.replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{e\^\{([^{}]+)\}\}/g, (m, a, b) => (a.trim() === '1' ? '' : a + '\\,') + 'e^{-' + b + '}');
  s = s.replace(/([A-Za-z])_\{d_\{(\d)\}\}/g, (m, v, k) => v + "'".repeat(+k));
  s = s.replace(/\\begin\{vmatrix\}/g, '\\begin{pmatrix}').replace(/\\end\{vmatrix\}/g, '\\end{pmatrix}').replace(/\\cr\b/g, '\\\\');
  return s.replace(/\\mathrm\{(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|exp)\}/g, '\\$1').replace(/\\mathrm\{log\}/g, '\\ln').replace(/\\mathrm\{(asin|acos|atan)\}/g, (m, f) => '\\arc' + f.slice(1)).replace(/\b([A-Za-z])(\d+)\b/g, '$1_{$2}').replace(/\\cdot\s*/g, '\\,');
}
function casNum(x) {
  try { const v = nerdamer(String(x)).evaluate().text('decimals'); const n = Number(v); if (isFinite(n)) return n; } catch (e) { /* not a plain number */ }
  return null;
}
const casFmt = (n) => { if (n == null) return ''; const a = Math.abs(n); if (a !== 0 && (a < 1e-4 || a >= 1e7)) return n.toExponential(4).replace(/e\+?(-?)(\d+)/, ' \\times 10^{$1$2}'); return String(Number(n.toPrecision(6))); };
/* exact answers with a number beside them when the exact one is not already a plain number */
function casShow(x) {
  const tex = casTex(x), n = casNum(x);
  if (n == null || String(x).replace(/\s/g, '') === String(Number(n.toPrecision(6)))) return { tex, approx: '' };
  return { tex, approx: casFmt(n) };
}
const CAS_PREF = ['x', 'y', 't', 'z', 'n', 'v', 'a', 's', 'm', 'r', 'theta', 'k'];
function casVars(expr) { try { return nerdamer(expr).variables(); } catch (e) { return []; } }
/* roots by search when the algebra cannot give them (sin x = x/2, x^5 - x - 1 = 0): sign changes between sample points, then halving */
function casRootsNumeric(lhs, rhs, v) {
  let f; try { f = nerdamer('(' + lhs + ')-(' + rhs + ')').buildFunction([v]); } catch (e) { return []; }
  const trig = /\b(sin|cos|tan|sec|csc|cot)\(/.test(lhs + rhs), a = trig ? 0 : -100, b = trig ? 2 * Math.PI - 1e-9 : 100, N = 4000, out = [];
  const val = (x) => { try { const y = f(x); return typeof y === 'number' ? y : NaN; } catch (e) { return NaN; } };
  let x0 = a, y0 = val(x0);
  for (let i = 1; i <= N; i++) {
    const x1 = a + (b - a) * i / N, y1 = val(x1);
    if (isFinite(y0) && isFinite(y1)) {
      if (y0 === 0) out.push(x0);
      else if (y0 * y1 < 0) { let lo = x0, hi = x1, fl = y0; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2, fm = val(m); if (!isFinite(fm)) break; if (fl * fm <= 0) hi = m; else { lo = m; fl = fm; } } const r = (lo + hi) / 2; if (Math.abs(val(r)) < 1e-6 * Math.max(1, Math.abs(val(x0)) + Math.abs(val(x1)))) out.push(r); }
    }
    x0 = x1; y0 = y1;
  }
  const uniq = []; for (const r of out) if (!uniq.some((q) => Math.abs(q - r) < 1e-7 * Math.max(1, Math.abs(r)))) uniq.push(Math.abs(r) < 1e-12 ? 0 : r);
  return uniq.slice(0, 12);
}
/* answers the engine gives as huge fractions are its own numeric guesses: those are replaced by the search above */
const casMessy = (s) => /\d{6,}\s*\/\s*\d{6,}/.test(String(s));
async function casReady() { if (!window.nerdamer) await loadLib('cas'); if (!window.nerdamer) throw new Error('cas'); }
/* the main entry: equations (one or several), or an expression with an operation. Returns what to show. */
async function casRun(input, opt) {
  opt = opt || {}; await casReady();
  const raw = String(input || '').trim();
  const parts = raw.split(/\s*(?:;|\n|\\\\)\s*/).map((p) => p.trim()).filter(Boolean);
  const eqs = parts.filter((p) => /[^<>!=]=[^=]/.test(p) && !/^(diff|integrate|defint|limit|sum|product|factor|expand|simplify|partfrac)\(/.test(p));
  const res = { input: parts, kind: '', unknowns: [], vars: [], rows: [], note: '' };
  /* the other kinds of problem go to their own solvers */
  if (parts.some((p) => /[A-Za-z]'/.test(p))) return casOde(parts, opt, res);
  if (/\[\s*\[|\bmatrix\(|^(det|inv|rank|rref|eig|transpose)\(/.test(raw)) return casMatrix(raw, opt, res);
  if (parts.length === 1 && /<|>/.test(parts[0]) && !/=>/.test(parts[0])) return casIneq(parts[0], opt, res);
  { const mm = raw.match(/^taylor\((.+),\s*([A-Za-z]),\s*([^,]+),\s*(\d+)\)$/); if (mm) return casTaylor(mm[1], mm[2], mm[3], +mm[4], res); }
  if (/^(gcd|lcm)\(/.test(raw) || /^factor\(\s*\d+\s*\)$/.test(raw) || (opt.op === 'factor' && /^\d+$/.test(raw))) return casInt(raw, opt, res);
  if (eqs.length >= 2) {
    const vars = [...new Set(eqs.flatMap((e) => casVars(e.replace('=', '-(') + ')')))];
    let unk = (opt.vars && opt.vars.length ? opt.vars : CAS_PREF.filter((v) => vars.includes(v)).concat(vars.filter((v) => !CAS_PREF.includes(v)))).slice(0, eqs.length);
    res.kind = 'system'; res.vars = vars; res.unknowns = unk;
    /* the exact solver is used only for straight-line (linear) systems; a failed attempt on a curved one upsets the engine */
    const linear = eqs.every((e) => { const f = e.replace('=', '-(') + ')'; return unk.every((v) => { try { return !casVars(String(nerdamer('diff(' + f + ',' + v + ')'))).some((w) => unk.includes(w)); } catch (er) { return false; } }); });
    let sol = null; if (linear) { try { sol = nerdamer.solveEquations(eqs, unk); } catch (e) { sol = null; } }
    const pairs = Array.isArray(sol) ? sol.map((p) => (Array.isArray(p) ? p : String(p).split(','))) : [];
    /* not linear, or the engine only guessed: search numerically from many starting points */
    if (!pairs.length || pairs.some((p) => p.length !== 2 || casMessy(p[1]))) {
      if (unk.length === eqs.length && vars.every((v) => unk.includes(v))) {
        const sols = casNewton(eqs, unk);
        if (sols.length) { for (const s0 of sols) res.rows.push({ lhs: '', tex: unk.map((v, k) => casTex(v) + ' = ' + casFmt(s0[k])).join(',\\quad '), approx: '', v: '', val: '' }); res.note = 'ระบบสมการไม่เชิงเส้น คำตอบจากการคำนวณเชิงตัวเลข (พบ ' + sols.length + ' ชุด)'; return res; }
      }
      res.note = 'ระบบสมการนี้ไม่มีคำตอบจริง หรือหาคำตอบไม่ได้'; return res;
    }
    for (const [v, val] of pairs) { const sh = casShow(val); res.rows.push({ lhs: casTex(v), tex: sh.tex, approx: sh.approx, v: String(v), val: String(val) }); }
    return res;
  }
  if (eqs.length === 1) {
    const eq = eqs[0], i = eq.indexOf('='), lhs = eq.slice(0, i), rhs = eq.slice(i + 1);
    const vars = casVars('(' + lhs + ')-(' + rhs + ')');
    const v = opt.v && vars.includes(opt.v) ? opt.v : (CAS_PREF.find((x) => vars.includes(x)) || vars[0]);
    res.kind = 'solve'; res.vars = vars; res.unknowns = v ? [v] : [];
    if (!v) { const a = casNum(lhs), b = casNum(rhs); res.kind = 'check'; res.note = a != null && b != null ? (Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a)) ? 'สมการนี้เป็นจริง' : 'สมการนี้ไม่เป็นจริง ด้านซ้ายได้ ' + casFmt(a) + ' ด้านขวาได้ ' + casFmt(b)) : 'ไม่มีตัวแปรให้หา'; return res; }
    let list = [];
    try { const s = nerdamer.solve(eq, v); list = (s.symbol && s.symbol.elements ? s.symbol.elements : []).map(String); } catch (e) { list = []; }
    if (!list.length || list.some(casMessy)) {
      if (vars.length === 1) {
        const roots = casRootsNumeric(lhs, rhs, v);
        if (roots.length) {
          const trig = /\b(sin|cos|tan)\(/.test(eq);
          for (const r of roots) res.rows.push({ lhs: casTex(v), tex: casFmt(r), approx: trig ? casFmt(r * 180 / Math.PI) + '^{\\circ}' : '', v, val: String(r) });
          res.note = trig ? 'คำตอบจากการคำนวณเชิงตัวเลข ในช่วง 0 ถึง 2π (ตัวเลขหลังเป็นองศา) คำตอบอื่นได้จากการบวกคาบของฟังก์ชัน' : 'คำตอบจากการคำนวณเชิงตัวเลข ค้นในช่วง -100 ถึง 100';
          return res;
        }
      }
      if (!list.length || list.every(casMessy)) { res.note = 'หาคำตอบไม่ได้ สมการอาจไม่มีคำตอบจริง หรือต้องใช้วิธีเชิงตัวเลขที่มีหลายตัวแปร'; return res; }
      list = list.filter((s) => !casMessy(s));
    }
    for (const s of list) { const sh = casShow(s); res.rows.push({ lhs: casTex(v), tex: sh.tex, approx: sh.approx, v, val: s }); }
    return res;
  }
  /* no equals sign: work out the expression */
  const expr = parts.join('*');
  const vars = casVars(expr), v = opt.v && vars.includes(opt.v) ? opt.v : (CAS_PREF.find((x) => vars.includes(x)) || vars[0] || 'x');
  res.vars = vars; res.unknowns = [v];
  const op = opt.op || (/^(diff|integrate|defint|limit|sum|product|factor|expand|simplify|partfrac|determinant|invert|transpose|dot|cross|laplace|ilt)\(/.test(expr) ? 'raw' : 'simplify');
  res.kind = op;
  const call = { raw: expr, simplify: 'simplify(' + expr + ')', factor: 'factor(' + expr + ')', expand: 'expand(' + expr + ')', diff: 'diff(' + expr + ',' + v + ')', diff2: 'diff(' + expr + ',' + v + ',2)', integrate: 'integrate(' + expr + ',' + v + ')', partfrac: 'partfrac(' + expr + ',' + v + ')' }[op] || expr;
  const out = String(nerdamer(call));
  const sh = casShow(out);
  res.rows.push({ lhs: { simplify: '', factor: '', expand: '', diff: '\\frac{d}{d' + v + '}', diff2: '\\frac{d^2}{d' + v + '^2}', integrate: '\\int', partfrac: '' }[op] || '', tex: sh.tex + (op === 'integrate' ? ' + C' : ''), approx: sh.approx, v, val: out, of: casTex(expr) });
  return res;
}
/* physics in the calculator: solve with letters, then put in the known values with their units */
function casWithUnits(val, scope) {
  if (!window.math) return null;
  try { const r = math.evaluate(String(val).replace(/\*\*/g, '^'), Object.assign({}, scope)); return typeof r === 'function' ? null : r; } catch (e) { return null; }
}

/* ----- the solve panel: opened from a selection (handwriting or a typed equation) ----- */
const SOLVE = { src: '', opt: {}, box: null, res: null };
async function solveSelection() {
  if (!S.sel) return;
  const box = S.sel.box.slice(), refs = S.sel.strokes.slice();
  const texts = S.sel.items.map(findItem).filter((it) => it && (!it.type || it.type === 'text')).map((it) => it.md || '');
  let src = '';
  if (texts.length) { const m = texts.join('\n').match(/\$\$?([^$]+)\$\$?/g); src = m ? m.map((x) => x.replace(/\$/g, '')).join('\n') : texts.join('\n'); }
  if (!src && refs.length) {
    if (!needAI('read')) return;
    const img = await inkBlob(refs); if (!img) return;
    const P = solvePanel(); waitCard(P.body, 'AI กำลังอ่านลายมือ', ['อ่านสมการ', 'คำนวณ'], { cancel: false });
    try {
      const r = await AI.run('read', 'The image is handwritten math from a teacher\'s notebook: one equation, several equations (a system), or an expression to work out (derivative, integral, limit, factor and so on). Transcribe it exactly as written, do not solve it. Reply with LaTeX only, one equation per line, no $ signs and no words.', { images: [img.blob], maxTokens: 400 });
      src = String(r.text || '').replace(/```[a-z]*|```/g, '').trim();
    } catch (e) { P.body.innerHTML = '<div class="note err">อ่านลายมือไม่สำเร็จ ' + esc(aiErr(e)) + '</div>'; return; }
  }
  if (!src) { toast('เลือกสมการที่เขียนหรือพิมพ์ไว้ก่อน', 2200); return; }
  SOLVE.src = src.split('\n').map(texToCas).filter(Boolean).join('; '); SOLVE.opt = {}; SOLVE.box = box;
  clearSel(); solveShow();
}
function solvePanel() {
  let p = $('#solvePanel');
  if (!p) {
    p = document.createElement('div'); p.id = 'solvePanel'; p.className = 'solvep no-ink'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'แก้สมการ');
    p.innerHTML = '<div class="sph"><b>แก้สมการ</b><button type="button" class="btn" data-a="x">ปิด</button></div><label class="spin"><span>สมการ (แก้ได้ถ้าอ่านผิด คั่นหลายสมการด้วย ;)</span><input type="text" spellcheck="false" autocapitalize="off" autocomplete="off"></label><div class="spbody"></div>';
    document.body.appendChild(p);
    p.querySelector('[data-a="x"]').onclick = () => { p.hidden = true; };
    const inp = p.querySelector('input');
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { SOLVE.src = inp.value; SOLVE.opt = {}; solveShow(); } });
    inp.addEventListener('change', () => { SOLVE.src = inp.value; SOLVE.opt = {}; solveShow(); });
  }
  p.hidden = false;
  return { p, body: p.querySelector('.spbody'), inp: p.querySelector('input') };
}
async function solveShow() {
  const P = solvePanel(); P.inp.value = SOLVE.src;
  waitLine(P.body, 'กำลังคำนวณ');
  let r;
  try { r = await casRun(SOLVE.src, SOLVE.opt); }
  catch (e) { P.body.innerHTML = '<div class="note err">' + (e && e.message === 'cas' || /load/.test(String(e && e.message)) ? 'โหลดตัวแก้สมการไม่สำเร็จ ตรวจอินเทอร์เน็ต' : 'อ่านสมการนี้ไม่ได้ ตรวจรูปแบบในช่องด้านบน') + '</div>'; return; }
  SOLVE.res = r;
  let h = '';
  if (r.kind === 'solve' && r.vars.length > 1) h += '<div class="spk"><span>หาค่า</span>' + r.vars.map((v) => '<button type="button" class="chip" data-v="' + esc(v) + '" aria-pressed="' + (v === r.unknowns[0]) + '">' + esc(v) + '</button>').join('') + '</div>';
  if (r.kind === 'matrix' && r.mats === 1) h += '<div class="spk"><span>ทำอะไร</span>' + [['det', 'ดีเทอร์มิแนนต์'], ['inv', 'อินเวอร์ส'], ['transpose', 'ทรานสโพส'], ['rank', 'แรงก์'], ['rref', 'ขั้นบันไดลดรูป'], ['eig', 'ค่าเฉพาะ']].map(([k, n]) => '<button type="button" class="chip" data-op="' + k + '" aria-pressed="' + (k === r.mop) + '">' + n + '</button>').join('') + '</div>';
  if (['diff', 'diff2', 'integrate', 'simplify', 'factor', 'expand', 'partfrac', 'ineq'].includes(r.kind) && r.vars.length > 1) h += '<div class="spk"><span>เทียบกับ</span>' + r.vars.map((v) => '<button type="button" class="chip" data-v="' + esc(v) + '" aria-pressed="' + (v === r.unknowns[0]) + '">' + esc(v) + '</button>').join('') + '</div>';
  if (!['solve', 'system', 'check', 'raw', 'matrix', 'ode', 'ineq', 'taylor', 'int'].includes(r.kind)) h += '<div class="spk"><span>ทำอะไร</span>' + [['simplify', 'ทำให้ง่าย'], ['factor', 'แยกตัวประกอบ'], ['expand', 'กระจาย'], ['diff', 'อนุพันธ์'], ['diff2', 'อนุพันธ์อันดับสอง'], ['integrate', 'อินทิเกรต'], ['partfrac', 'เศษส่วนย่อย']].map(([k, n]) => '<button type="button" class="chip" data-op="' + k + '" aria-pressed="' + (k === r.kind) + '">' + n + '</button>').join('') + '</div>';
  if (r.rows.length) {
    h += '<div class="spres">' + r.rows.map((x) => '<div>$' + (x.of != null ? (x.lhs ? x.lhs + '\\left(' + x.of + '\\right)' : x.of) + ' = ' : (x.lhs ? x.lhs + ' = ' : '')) + x.tex + '$' + (x.approx ? ' <span class="spa">$\\approx ' + x.approx + '$</span>' : '') + '</div>').join('') + '</div>';
  }
  if (r.note) h += '<div class="note">' + esc(r.note) + '</div>';
  h += '<div class="row2">' + (r.rows.length ? '<button type="button" class="btn solid" data-a="put">วางคำตอบลงหน้า</button>' : '') + (solveGraphable(r) ? '<button type="button" class="btn" data-a="graph">วาดกราฟ</button>' : '') + (r.rows.length && AI.ready('gen') ? '<button type="button" class="btn" data-a="why">ให้ AI อธิบายวิธีทำ</button>' : '') + '</div><div class="spwhy"></div>';
  P.body.innerHTML = h;
  typeset(P.body.querySelector('.spres') || P.body);
  if (r.svg) { const g = document.createElement('div'); g.className = 'spsvg'; const im = new Image(); im.alt = 'กราฟคำตอบ'; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg); g.appendChild(im); (P.body.querySelector('.spres') || P.body.firstChild).after(g); }
  P.body.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => { SOLVE.opt.v = b.dataset.v; solveShow(); }; });
  P.body.querySelectorAll('[data-op]').forEach((b) => { b.onclick = () => { SOLVE.opt.op = b.dataset.op; solveShow(); }; });
  const put = P.body.querySelector('[data-a="put"]'); if (put) put.onclick = () => solvePut(r);
  const gr = P.body.querySelector('[data-a="graph"]'); if (gr) gr.onclick = () => solveGraph(r);
  const why = P.body.querySelector('[data-a="why"]'); if (why) why.onclick = () => solveWhy(r, P.body.querySelector('.spwhy'));
}
const casRowTex = (x) => (x.of != null ? (x.lhs ? x.lhs + '\\left(' + x.of + '\\right)' : x.of) + ' = ' : (x.lhs ? x.lhs + ' = ' : '')) + x.tex;
function solveLines(r) {
  return r.rows.map((x) => '$' + casRowTex(x) + (x.approx ? ' \\approx ' + x.approx : '') + '$');
}
function solvePut(r) {
  const lines = solveLines(r), w = 520, fs = 26, h = lines.length * fs * 1.8 + 16, b = SOLVE.box || viewSpot(w, h).concat([0, 0]);
  /* the answer continues the writing: under it, from its left edge (placeNear); its graph beside or under the answer */
  const src = b[3] ? b : [b[0], b[1], b[0] + w, b[1]];
  const at = placeNear(src, w, h) || [clamp(src[0], PAGE_M, W - w - PAGE_M), Math.min(src[3] + 16, H - h - PAGE_M)];
  addItem({ type: 'text', x: Math.round(at[0]), y: Math.round(at[1]), w, fs, md: lines.join('\n\n') });
  if (r.svg) { const gw = 520, gh = Math.round(gw * 340 / 560), tb = [at[0], at[1], at[0] + w, at[1] + h]; const ps = picSpot(tb, gw, gh, { fs: 22 }), g = ps ? ps.at : [at[0], Math.min(tb[3] + 16, H - gh - PAGE_M)]; addItem({ type: 'svg', x: Math.round(g[0]), y: Math.round(g[1]), w: ps ? ps.w : gw, svg: r.svg }); }
  toast('วางคำตอบลงหน้าแล้ว', 1500);
}
/* a graph straight from the expression: y = f(x), or the expression itself, with any other letters as sliders */
function solveGraphable(r) {
  const p = r.input; if (!p || p.length !== 1) return false;
  const s = p[0], m = s.match(/^([a-zA-Z])\s*=\s*(.+)$/);
  const e = m ? m[2] : (/=/.test(s) ? '' : s);
  if (!e || /diff|integrate|defint|limit|sum\(|matrix/.test(e)) return false;
  return casVars(e).length >= 1;
}
function solveGraph(r) {
  const s = r.input[0], m = s.match(/^([a-zA-Z])\s*=\s*(.+)$/), e = m ? m[2] : s;
  const vars = casVars(e), xv = vars.includes('x') ? 'x' : vars.includes('t') ? 't' : vars[0];
  const toMath = (q) => q.replace(/\blog10\(/g, 'log10(').replace(/\bpi\b/g, 'pi');
  const g = { type: 'graph', title: '', xvar: xv, exprs: [toMath(e)], params: {}, order: [], xl: xv, yl: m ? m[1] : 'y', x0: -10, x1: 10 };
  if (/\b(sin|cos|tan)\(/.test(e)) { g.x0 = -2 * Math.PI; g.x1 = 2 * Math.PI; }
  if (xv === 't') g.x0 = 0;
  loadLib('math').then(() => placeGraph(g, SOLVE.box || [W / 2 - 280, 200, W / 2 + 280, 260])).catch(() => toast('โหลดตัววาดกราฟไม่สำเร็จ', 2500));
}
async function solveWhy(r, out) {
  waitCard(out, 'AI กำลังเขียนวิธีทำ', null, { cancel: false });
  try {
    const ans = solveLines(r).join('  ');
    /* the steps appear line by line as the AI writes them */
    let shownP = 0;
    const onPartial = (t) => { const paras = String(t).split('\n'), ready = paras.slice(0, -1).join('\n').trim(); const n = paras.length - 1; if (n <= shownP || !ready || !out.isConnected) return; shownP = n; out.innerHTML = '<div class="spsteps">' + mdToHtml(ready) + '</div><div class="note small">AI กำลังเขียนต่อ</div>'; typeset(out); };
    const res = await AI.run('gen', 'A teacher wants the worked steps for this problem: ' + r.input.join('; ') + '\nThe correct final answer, already checked by a computer algebra system, is: ' + ans + '\nWrite the steps in Thai, short and clear, the way a teacher writes them on the board, one step per line, math as LaTeX between $ signs. End with the same final answer. No headings.', { maxTokens: 900, onPartial });
    out.innerHTML = '<div class="spsteps">' + mdToHtml(String(res.text || '').trim()) + '</div><div class="row2"><button type="button" class="btn" data-a="putw">วางวิธีทำลงหน้า</button></div>';
    typeset(out);
    out.querySelector('[data-a="putw"]').onclick = () => { const w = 620, b = SOLVE.box || [40, 200, 40, 200], md0 = String(res.text || '').trim(), at = placeNear(b, w, estTextH(md0, w, 22) + 10) || [clamp(b[0], PAGE_M, W - w - PAGE_M), Math.min(b[3] + 16, H - 300)]; addItem({ type: 'text', x: Math.round(at[0]), y: Math.round(at[1]), w, fs: 22, md: String(res.text || '').trim() }); toast('วางวิธีทำลงหน้าแล้ว', 1500); };
  } catch (e) { out.innerHTML = '<div class="note err">' + esc(aiErr(e)) + '</div>'; }
}

/* ----- systems that are not linear: Newton's method from many starting points, keeping each different answer ----- */
function casNewton(eqs, vars) {
  const n = vars.length; let fs;
  try { fs = eqs.map((e) => { const i = e.indexOf('='); return nerdamer('(' + e.slice(0, i) + ')-(' + e.slice(i + 1) + ')').buildFunction(vars); }); } catch (e) { return []; }
  const F = (x) => fs.map((f) => { try { const y = f(...x); return typeof y === 'number' ? y : NaN; } catch (e) { return NaN; } });
  const solveLin = (A, b) => { const M = A.map((r, i) => r.concat([b[i]])); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; if (Math.abs(M[p][c]) < 1e-14) return null; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c] / M[c][c]; for (let q = c; q <= n; q++) M[r][q] -= k * M[c][q]; } } return M.map((r, i) => r[n] / r[i]); };
  const out = [], seeds = [];
  let rnd = 12345; const R = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  for (let k = 0; k < 120; k++) seeds.push(vars.map(() => (k < 20 ? (R() - 0.5) * 4 : (R() - 0.5) * 40)));
  for (const x0 of seeds) {
    let x = x0.slice(), ok = false;
    for (let it = 0; it < 60; it++) {
      const f = F(x); if (f.some((v) => !isFinite(v))) break;
      const nf = Math.hypot(...f); if (nf < 1e-11) { ok = true; break; }
      const J = []; for (let i = 0; i < n; i++) J.push(new Array(n).fill(0));
      for (let j = 0; j < n; j++) { const h = 1e-7 * Math.max(1, Math.abs(x[j])), xp = x.slice(); xp[j] += h; const fp = F(xp); for (let i = 0; i < n; i++) J[i][j] = (fp[i] - f[i]) / h; }
      const d = solveLin(J, f.map((v) => -v)); if (!d) break;
      let lam = 1; for (let k = 0; k < 20; k++) { const xn = x.map((v, i) => v + lam * d[i]), fn = F(xn); if (fn.every(isFinite) && Math.hypot(...fn) < nf) { x = xn; break; } lam /= 2; if (k === 19) x = xn; }
    }
    if (ok && !out.some((s) => s.every((v, i) => Math.abs(v - x[i]) < 1e-6 * Math.max(1, Math.abs(v))))) out.push(x.map((v) => (Math.abs(v) < 1e-12 ? 0 : v)));
    if (out.length >= 12) break;
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/* ----- inequalities in one unknown: find where the two sides meet or the expression breaks, then test each interval ----- */
function casIneq(p, opt, res) {
  const m = p.match(/^(.*?)(<=|>=|<|>)(.*)$/); if (!m) { res.note = 'อ่านอสมการไม่ได้'; return res; }
  const [, L, op, Rr] = m, expr = '(' + L + ')-(' + Rr + ')', vars = casVars(expr), v = opt.v && vars.includes(opt.v) ? opt.v : (CAS_PREF.find((x) => vars.includes(x)) || vars[0]);
  res.kind = 'ineq'; res.vars = vars; res.unknowns = [v];
  if (!v || vars.length > 1) { res.note = 'แก้อสมการได้เมื่อมีตัวแปรเดียว'; return res; }
  let f; try { f = nerdamer(expr).buildFunction([v]); } catch (e) { res.note = 'อ่านอสมการไม่ได้'; return res; }
  const val = (x) => { try { const y = f(x); return typeof y === 'number' ? y : NaN; } catch (e) { return NaN; } };
  const pts = new Set();
  const addRoots = (q) => { try { const s = nerdamer.solve(q + '=0', v); for (const e of (s.symbol && s.symbol.elements) || []) { const n = casNum(e); if (n != null && !casMessy(e)) pts.add(n); } } catch (e) { /* none */ } };
  let num = expr, den = '1'; try { const E = nerdamer(expr); num = String(E.numerator()); den = String(E.denominator()); } catch (e) { /* keep */ }
  addRoots(num); if (den !== '1') addRoots(den);
  for (const r of casRootsNumeric(num, '0', v)) pts.add(r);
  const P = [...pts].filter(isFinite).sort((a, b) => a - b).filter((x, i, a) => !i || Math.abs(x - a[i - 1]) > 1e-9);
  const test = (y) => (op === '<' ? y < 0 : op === '>' ? y > 0 : op === '<=' ? y <= 1e-12 : y >= -1e-12);
  const edges = [-Infinity].concat(P, [Infinity]), segs = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i], b = edges[i + 1], mid = !isFinite(a) ? (isFinite(b) ? b - 1 : 0) : !isFinite(b) ? a + 1 : (a + b) / 2, y = val(mid);
    if (isFinite(y) && test(y)) segs.push([a, b]);
  }
  const closed = (x) => op.length === 2 && isFinite(val(x)) && Math.abs(val(x)) < 1e-9;
  /* join touching pieces and write them as intervals */
  const parts = []; for (const [a, b] of segs) { const last = parts[parts.length - 1]; if (last && last[1] === a && closed(a)) last[1] = b; else parts.push([a, b]); }
  const fx = (x) => (x === -Infinity ? '-\\infty' : x === Infinity ? '\\infty' : casTex(casExact(x)));
  let tex = parts.map(([a, b]) => (isFinite(a) && closed(a) ? '[' : '(') + fx(a) + ', ' + fx(b) + (isFinite(b) && closed(b) ? ']' : ')')).join(' \\cup ');
  const lone = op.length === 2 ? P.filter((x) => closed(x) && !parts.some(([a, b]) => x >= a && x <= b)) : [];
  if (lone.length) tex += (tex ? ' \\cup ' : '') + '\\{' + lone.map(fx).join(', ') + '\\}';
  res.rows.push({ lhs: '', tex: casTex(v) + ' \\in ' + (tex || '\\varnothing'), approx: '', v, val: '' });
  if (!tex) res.note = 'ไม่มีจำนวนจริงที่ทำให้อสมการนี้เป็นจริง';
  return res;
}
/* a number back as a neat exact value when it is a simple fraction or square root */
function casExact(x) {
  for (let d = 1; d <= 12; d++) { const n = Math.round(x * d); if (Math.abs(n / d - x) < 1e-9) return d === 1 ? String(n) : n + '/' + d; }
  for (let d = 1; d <= 6; d++) { const q = x * d, s = Math.round(q * q); if (Math.abs(Math.sqrt(s) - Math.abs(q)) < 1e-9 && s < 1000) return (x < 0 ? '-' : '') + 'sqrt(' + s + ')' + (d > 1 ? '/' + d : ''); }
  return String(Number(x.toPrecision(6)));
}

/* ----- Taylor series: derivatives at the point ----- */
function casTaylor(f, v, a, n, res) {
  res.kind = 'taylor'; res.vars = [v]; res.unknowns = [v];
  let sum = '0', d = f, fact = 1;
  for (let k = 0; k <= Math.min(n, 12); k++) {
    if (k) { d = String(nerdamer('diff(' + d + ',' + v + ')')); fact *= k; }
    const c = String(nerdamer(d, { [v]: a }));
    if (c !== '0') sum += '+(' + c + ')/' + fact + '*(' + v + '-(' + a + '))^' + k;
  }
  const out = String(nerdamer('expand(' + sum + ')'));
  res.rows.push({ lhs: '', tex: casTex(f) + ' \\approx ' + casTex(out), approx: '', v, val: out });
  res.note = 'อนุกรมเทย์เลอร์รอบ ' + v + ' = ' + a + ' ถึงพจน์กำลัง ' + n;
  return res;
}

/* ----- whole numbers: prime factors, gcd and lcm ----- */
function casInt(raw, opt, res) {
  res.kind = 'int';
  const m = raw.match(/^(gcd|lcm)\((.+)\)$/);
  if (m) { const ns = m[2].split(',').map((x) => Math.round(+x)); const g = (a, b) => (b ? g(b, a % b) : Math.abs(a)); let r = ns[0]; for (const x of ns.slice(1)) r = m[1] === 'gcd' ? g(r, x) : Math.abs(r * x) / g(r, x); res.note = m[1] === 'gcd' ? 'ห.ร.ม. (ตัวหารร่วมมาก)' : 'ค.ร.น. (ตัวคูณร่วมน้อย)'; res.rows.push({ lhs: (m[1] === 'gcd' ? '\\gcd' : '\\operatorname{lcm}') + '(' + ns.join(', ') + ')', tex: String(r), approx: '', v: '', val: String(r) }); return res; }
  let n = Math.round(+String(raw).replace(/^factor\(|\)$/g, '')); const fs = []; for (let p = 2; p * p <= n; p++) while (n % p === 0) { fs.push(p); n /= p; } if (n > 1) fs.push(n);
  const grp = {}; for (const p of fs) grp[p] = (grp[p] || 0) + 1;
  res.rows.push({ lhs: '', tex: String(raw).replace(/^factor\(|\)$/g, '') + ' = ' + Object.entries(grp).map(([p, k]) => p + (k > 1 ? '^{' + k + '}' : '')).join(' \\times '), approx: '', v: '', val: '' });
  return res;
}

/* ----- matrices: exact work (determinant, inverse, transpose, rank, row echelon form) with fractions; eigenvalues by numbers ----- */
const casMat = (s) => 'matrix(' + String(s).trim().replace(/^\[\s*\[/, '[').replace(/\]\s*\]$/, ']') + ')';
function casMatrixOf(raw) {
  const t = String(raw).replace(/\s+/g, '');
  const m = t.match(/\[\[[^\]]*\](?:,\[[^\]]*\])*\]/g) || [];
  return m;
}
function casMatrix(raw, opt, res) {
  res.kind = 'matrix';
  const mats = casMatrixOf(raw), op0 = (raw.match(/^(det|inv|rank|rref|eig|transpose)\(/) || [])[1];
  const op = opt.op || op0 || (mats.length === 1 && raw.replace(/\s/g, '') === mats[0] ? 'det' : 'calc');
  res.mop = op; res.mats = mats.length;
  const N = (x) => nerdamer(x);
  try {
    if (op === 'calc') {
      /* products, sums and powers of matrices written out: [[1,2],[3,4]]*[[5],[6]] */
      let e = raw; for (const m of mats) e = e.split(m).join(casMat(m)); e = e.replace(/\s+/g, '');
      const out = String(N(e)); let itex = raw.replace(/\s+/g, ''); for (const m of mats) itex = itex.split(m).join(' ' + casTex(casMat(m)) + ' '); itex = itex.replace(/\*/g, ' ').replace(/\^(\d+)/g, '^{$1}');
      res.rows.push({ lhs: '', tex: itex + ' = ' + casTex(out), approx: '', v: '', val: out }); return res;
    }
    const A = casMat(mats[0]);
    const rows = mats[0].replace(/^\[\[|\]\]$/g, '').split('],[').map((r) => r.split(',').map((c) => c.trim()));
    const numeric = rows.every((r) => r.every((c) => /^-?\d+(\.\d+)?(\/\d+)?$/.test(c)));
    const Atex = casTex(A);
    if (op === 'det') { const d = casDet(rows, numeric); res.rows.push({ lhs: '', tex: '\\det' + Atex + ' = ' + casTex(d), approx: '', v: '', val: d }); }
    else if (op === 'inv') {
      if (rows.length !== rows[0].length) { res.note = 'อินเวอร์สหาได้เฉพาะเมทริกซ์จัตุรัส'; return res; }
      const d = casDet(rows, numeric); if (d === '0') { res.note = 'ดีเทอร์มิแนนต์เป็น 0 จึงไม่มีอินเวอร์ส'; return res; }
      const r = casInv(rows, numeric, d); res.rows.push({ lhs: '', tex: Atex + '^{-1} = ' + r, approx: '', v: '', val: '' }); }
    else if (op === 'transpose') { const r = String(N('transpose(' + A + ')')); res.rows.push({ lhs: '', tex: Atex + '^{T} = ' + casTex(r), approx: '', v: '', val: r }); }
    else if (op === 'rref' || op === 'rank') {
      if (!numeric || !window.math) { res.note = 'รูปแบบขั้นบันไดและแรงก์ทำได้เมื่อสมาชิกเป็นตัวเลข'; return res; }
      const M = rows.map((r) => r.map((c) => math.fraction(c))); let lead = 0, rank = 0; const R = M.length, C = M[0].length;
      for (let r = 0; r < R && lead < C; r++) {
        let i = r; while (math.equal(M[i][lead], 0)) { i++; if (i === R) { i = r; lead++; if (lead === C) break; } } if (lead === C) break;
        [M[i], M[r]] = [M[r], M[i]]; const lv = M[r][lead]; M[r] = M[r].map((x) => math.divide(x, lv));
        for (let k = 0; k < R; k++) if (k !== r) { const f = M[k][lead]; M[k] = M[k].map((x, j) => math.subtract(x, math.multiply(f, M[r][j]))); }
        lead++; rank++;
      }
      const tex = '\\begin{pmatrix}' + M.map((r) => r.map((x) => { const f = math.fraction(x); return (f.s < 0 && f.n ? '-' : '') + (f.d === 1 ? f.n : '\\frac{' + f.n + '}{' + f.d + '}'); }).join(' & ')).join(' \\\\ ') + '\\end{pmatrix}';
      res.rows.push(op === 'rank' ? { lhs: '', tex: '\\operatorname{rank}' + Atex + ' = ' + rank, approx: '', v: '', val: String(rank) } : { lhs: '', tex: Atex + ' \\sim ' + tex, approx: '', v: '', val: '' });
      if (op === 'rref') res.note = 'รูปแบบขั้นบันไดลดรูป แรงก์ = ' + rank;
    }
    else if (op === 'eig') {
      if (!numeric || !window.math) { res.note = 'ค่าเฉพาะคำนวณได้เมื่อสมาชิกเป็นตัวเลข'; return res; }
      /* the characteristic equation gives exact values when it can; vectors come from the null space of A - lambda I */
      const cp = casDet(rows.map((r, i) => r.map((c, j) => (i === j ? '(' + c + '-L)' : c))), false);
      let ls = []; try { ls = (nerdamer.solve(cp + '=0', 'L').symbol.elements || []).map(String); } catch (e) { ls = []; }
      if (!ls.length || ls.some(casMessy)) { try { const E = math.eigs(rows.map((r) => r.map((c) => math.evaluate(c)))); ls = (E.values.toArray ? E.values.toArray() : E.values).map((x) => String(typeof x === 'number' ? x : math.format(x, 6))); } catch (e) { ls = []; } }
      res.rows.push({ lhs: '', tex: '\\det(A - \\lambda I) = ' + casTex(cp.replace(/\bL\b/g, 'lambda')) + ' = 0', approx: '', v: '', val: '' });
      ls.forEach((l, k) => {
        const sh = casShow(l); let vt = '';
        const lv = casNum(l);
        if (lv != null) { try { const vs = casEigvec(rows, lv); if (vs.length) vt = ',\\quad \\vec{v} = ' + vs.map((x) => '\\begin{pmatrix}' + x.map((q) => casTex(casExact(q))).join(' \\\\ ') + '\\end{pmatrix}').join(',\\ '); } catch (e) { /* value only */ } }
        res.rows.push({ lhs: '\\lambda_{' + (k + 1) + '}', tex: sh.tex + (sh.approx ? ' \\approx ' + sh.approx : '') + vt, approx: '', v: '', val: l }); });
      if (!ls.length) res.note = 'หาค่าเฉพาะไม่ได้';
    }
  } catch (e) { res.note = 'คำนวณเมทริกซ์นี้ไม่ได้ ตรวจขนาดและรูปแบบ เช่น [[1,2],[3,4]]'; }
  return res;
}

/* ----- differential equations (straight or curved, one or several): solved step by step with numbers (Runge-Kutta),
   from the starting values, and drawn as a graph ----- */
function casOde(parts, opt, res) {
  res.kind = 'ode';
  let iv = null, t0 = 0, t1 = 10; const ics = {}, eqs = [];
  for (const p of parts) {
    const r = p.match(/^([A-Za-z])=(-?[\d.]+(?:e-?\d+)?)(?:\.\.|to|ถึง|,)(-?[\d.]+(?:e-?\d+)?)$/);
    if (r) { iv = r[1]; t0 = +r[2]; t1 = +r[3]; continue; }
    const c = p.match(/^([A-Za-z][A-Za-z0-9_]*)('*)\((-?[\d.]+)\)=(.+)$/);
    if (c) { ics[c[1] + c[2]] = casNum(c[4]); if (iv == null) t0 = +c[3]; continue; }
    if (/=/.test(p)) eqs.push(p);
  }
  if (!eqs.length) { res.note = 'ไม่พบสมการเชิงอนุพันธ์'; return res; }
  /* the unknown functions and their highest derivative */
  const order = {}; for (const e of eqs) for (const m of e.matchAll(/([A-Za-z][A-Za-z0-9_]*)('+)/g)) order[m[1]] = Math.max(order[m[1]] || 0, m[2].length);
  const deps = Object.keys(order);
  if (!iv) { const others = new Set(eqs.flatMap((e) => casVars(e.replace(/'+/g, '').replace('=', '-(') + ')'))); iv = others.has('t') || !others.has('x') || deps.includes('x') ? 't' : 'x'; }
  const nm = (v, k) => (k ? v + '_d' + k : v);
  const conv = (e) => e.replace(/([A-Za-z][A-Za-z0-9_]*)('+)/g, (m, v, p) => nm(v, p.length));
  const state = []; for (const v of deps) for (let k = 0; k < order[v]; k++) state.push(nm(v, k));
  /* each equation is solved for the highest derivative it holds */
  const rhs = {}; const used = new Set();
  for (const e of eqs) {
    const ce = conv(e), cand = deps.filter((v) => !used.has(v) && new RegExp('\\b' + nm(v, order[v]) + '\\b').test(ce));
    const v = cand[0]; if (!v) continue; used.add(v);
    let sol; try { sol = nerdamer.solve(ce, nm(v, order[v])); } catch (er) { sol = null; }
    const el = (sol && sol.symbol && sol.symbol.elements || []).map(String).filter((x) => !casMessy(x));
    if (!el.length) { res.note = 'แยกอนุพันธ์อันดับสูงสุดของ ' + v + ' ออกมาไม่ได้'; return res; }
    rhs[v] = el[0]; if (el.length > 1) res.note = 'สมการนี้ให้ ' + nm(v, order[v]) + ' ได้หลายค่า ใช้ค่าแรก';
  }
  if (deps.some((v) => !rhs[v])) { res.note = 'จำนวนสมการน้อยกว่าจำนวนฟังก์ชันที่ไม่รู้'; return res; }
  /* a straight (linear) equation with constant coefficients also gets its formula, worked out from the characteristic equation */
  if (deps.length === 1 && eqs.length === 1) { try { const ex = casOdeExact(conv(eqs[0]), deps[0], order[deps[0]], iv, ics, nm); if (ex) res.exact = ex; } catch (e) { /* numbers only */ } }
  /* first-order form: state' = F(t, state) */
  const args = [iv].concat(state), fns = {};
  try { for (const v of deps) fns[v] = nerdamer(rhs[v]).buildFunction(args); } catch (e) { res.note = 'สมการมีตัวแปรที่ไม่รู้ค่า ใส่ค่าตัวเลขให้ครบ เช่น k = 2'; return res; }
  const extra = [...new Set(deps.flatMap((v) => casVars(rhs[v])))].filter((x) => !args.includes(x));
  if (extra.length) { res.note = 'ใส่ค่าตัวเลขของ ' + extra.join(', ') + ' ก่อน แล้วลองใหม่'; return res; }
  const idx = {}; state.forEach((s, i) => { idx[s] = i; });
  const missing = state.filter((s) => { const k = s.match(/_d(\d)$/), key = k ? s.replace(/_d\d$/, '') + "'".repeat(+k[1]) : s; return ics[key] == null; });
  const y0 = state.map((s) => { const k = s.match(/_d(\d)$/), key = k ? s.replace(/_d\d$/, '') + "'".repeat(+k[1]) : s; return ics[key] == null ? 0 : ics[key]; });
  const F = (t, y) => {
    const out = new Array(state.length).fill(0);
    for (const v of deps) { const n = order[v]; for (let k = 0; k < n - 1; k++) out[idx[nm(v, k)]] = y[idx[nm(v, k + 1)]]; out[idx[nm(v, n - 1)]] = fns[v](t, ...y); }
    return out; };
  /* classical fourth-order Runge-Kutta, small steps, a few hundred points kept for the graph */
  const N = 4000, h = (t1 - t0) / N, keep = Math.max(1, Math.floor(N / 400)), pts = [[t0, y0.slice()]];
  let y = y0.slice(), t = t0, blow = false;
  for (let i = 1; i <= N; i++) {
    const k1 = F(t, y), k2 = F(t + h / 2, y.map((v, j) => v + h / 2 * k1[j])), k3 = F(t + h / 2, y.map((v, j) => v + h / 2 * k2[j])), k4 = F(t + h, y.map((v, j) => v + h * k3[j]));
    y = y.map((v, j) => v + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])); t = t0 + i * h;
    if (y.some((v) => !isFinite(v) || Math.abs(v) > 1e12)) { blow = true; break; }
    if (i % keep === 0) pts.push([t, y.slice()]);
  }
  const GR = { theta: 'θ', phi: 'φ', omega: 'ω', alpha: 'α', beta: 'β', psi: 'ψ', lambda: 'λ' };
  const series = deps.map((v) => ({ name: GR[v] || v, pts: pts.map(([tt, yy]) => [tt, yy[idx[v]]]) }));
  res.svg = casPlotSvg(series, iv);
  res.ode = { iv, deps, t0, t1 };
  const last = pts[pts.length - 1];
  for (const v of deps) res.rows.push({ lhs: casTex(v) + '(' + casFmt(last[0]) + ')', tex: casFmt(last[1][idx[v]]), approx: '', v, val: String(last[1][idx[v]]) });
  const dtex = (x) => casTex(x).replace(/([A-Za-z])_\{d_?\{?(\d)\}?\}/g, (m, v, k) => v + "'".repeat(+k));
  const shown = deps.map((v) => casTex(v) + "'".repeat(order[v]) + ' = ' + dtex(rhs[v]));
  res.rows.unshift({ lhs: '', tex: shown.join(',\\quad '), approx: '', v: '', val: '' });
  if (res.exact) { res.rows.splice(1, 0, { lhs: '', tex: casTex(deps[0]) + '(' + iv + ') = ' + res.exact.gen, approx: '', v: '', val: '' }); if (res.exact.part) res.rows.splice(2, 0, { lhs: '', tex: casTex(deps[0]) + '(' + iv + ') = ' + res.exact.part, approx: '', v: '', val: '' }); }
  res.note = (blow ? 'ค่าพุ่งเป็นอนันต์ก่อนถึงปลายช่วง จึงหยุดคำนวณ ' : '') + 'แก้เชิงตัวเลขด้วยวิธีรุงเง-คุตตา ช่วง ' + iv + ' = ' + t0 + ' ถึง ' + t1 + (missing.length ? ' ไม่ได้ให้ค่าเริ่มต้นของ ' + missing.map((s) => s.replace(/_d(\d)/, (m, k) => "'".repeat(+k))).join(', ') + ' จึงใช้ 0' : '') + ' เปลี่ยนช่วงได้ด้วย เช่น ' + iv + '=0..20';
  return res;
}
/* a plain graph from numbers, drawn straight on the paper: no box, no background */
function casPlotSvg(series, xl) {
  const VW = 560, VH = 340, L = 52, Rm = 16, T = 16, B = 40, pw = VW - L - Rm, ph = VH - T - B, COL = ['#2F4BB8', '#B5432F', '#1F7A55', '#8A5A0C'];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of series) for (const [x, y] of s.pts) { if (!isFinite(y)) continue; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (!isFinite(y0)) return '';
  if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; } const pad = (y1 - y0) * 0.06; y0 -= pad; y1 += pad;
  const X = (x) => L + (x - x0) / (x1 - x0) * pw, Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * ph;
  const nice = (a, b) => { const r = b - a, st = Math.pow(10, Math.floor(Math.log10(r / 5))), m = r / st / 5, step = st * (m >= 5 ? 10 : m >= 2 ? 5 : m >= 1 ? 2 : 1), out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toPrecision(10)); return out; };
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + ' ' + VH + '" font-family="Sarabun, sans-serif" font-size="13">';
  for (const v of nice(y0, y1)) s += '<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="#DDE3EA" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" fill="#535E6C">' + v + '</text>';
  for (const v of nice(x0, x1)) s += '<text x="' + X(v).toFixed(1) + '" y="' + (T + ph + 18) + '" text-anchor="middle" fill="#535E6C">' + v + '</text>';
  if (y0 < 0 && y1 > 0) s += '<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="#6B7686" stroke-width="1.2"/>';
  s += '<line x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (T + ph) + '" stroke="#6B7686" stroke-width="1.2"/>';
  series.forEach((se, k) => { const d = se.pts.filter((p) => isFinite(p[1])).map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(''); s += '<path d="' + d + '" fill="none" stroke="' + COL[k % 4] + '" stroke-width="2.4" stroke-linejoin="round"/>'; s += '<text x="' + (L + pw - 4) + '" y="' + (T + 14 + k * 16) + '" text-anchor="end" fill="' + COL[k % 4] + '" font-style="italic" font-size="15">' + esc(se.name) + '</text>'; });
  s += '<text x="' + (L + pw) + '" y="' + (VH - 4) + '" text-anchor="end" fill="#535E6C" font-style="italic" font-size="15">' + esc(xl) + '</text></svg>';
  return s;
}

/* determinant: exact fractions for numbers, expansion by cofactors for letters (small matrices) */
const casFracTex = (f) => { f = math.fraction(f); return (f.s < 0 && f.n ? '-' : '') + (f.d === 1 ? String(f.n) : '\\frac{' + f.n + '}{' + f.d + '}'); };
const casFracStr = (f) => { f = math.fraction(f); return (f.s < 0 && f.n ? '-' : '') + (f.d === 1 ? String(f.n) : f.n + '/' + f.d); };
function casDet(rows, numeric) {
  const n = rows.length; if (n !== rows[0].length) throw new Error('square');
  if (numeric && window.math) {
    const M = rows.map((r) => r.map((c) => math.fraction(c))); let det = math.fraction(1);
    for (let c = 0; c < n; c++) { let p = c; while (p < n && math.equal(M[p][c], 0)) p++; if (p === n) return '0'; if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; det = math.multiply(det, -1); }
      det = math.multiply(det, M[c][c]); for (let r = c + 1; r < n; r++) { const k = math.divide(M[r][c], M[c][c]); M[r] = M[r].map((x, j) => math.subtract(x, math.multiply(k, M[c][j]))); } }
    return casFracStr(det);
  }
  if (n > 5) throw new Error('big');
  const rec = (m) => { if (m.length === 1) return '(' + m[0][0] + ')'; if (m.length === 2) return '((' + m[0][0] + ')*(' + m[1][1] + ')-(' + m[0][1] + ')*(' + m[1][0] + '))';
    return '(' + m[0].map((c, j) => (j % 2 ? '-' : '+') + '(' + c + ')*' + rec(m.slice(1).map((r) => r.filter((_, k) => k !== j)))).join('') + ')'; };
  return String(nerdamer('expand(' + rec(rows) + ')'));
}
/* inverse: Gauss-Jordan with exact fractions for numbers, the adjugate over the determinant for letters */
function casInv(rows, numeric, det) {
  const n = rows.length;
  if (numeric && window.math) {
    const M = rows.map((r, i) => r.map((c) => math.fraction(c)).concat(rows.map((_, j) => math.fraction(i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) { let p = c; while (math.equal(M[p][c], 0)) p++; [M[p], M[c]] = [M[c], M[p]]; const lv = M[c][c]; M[c] = M[c].map((x) => math.divide(x, lv));
      for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c]; M[r] = M[r].map((x, j) => math.subtract(x, math.multiply(k, M[c][j]))); } }
    return '\\begin{pmatrix}' + M.map((r) => r.slice(n).map(casFracTex).join(' & ')).join(' \\\\ ') + '\\end{pmatrix}';
  }
  const cof = (i, j) => casDet(rows.filter((_, a) => a !== i).map((r) => r.filter((_, b) => b !== j)), false);
  const adj = rows.map((_, i) => rows.map((__, j) => { const c = n === 1 ? '1' : cof(j, i); return ((i + j) % 2 ? '-(' + c + ')' : c); }));
  return '\\frac{1}{' + casTex(det) + '}\\begin{pmatrix}' + adj.map((r) => r.map((c) => casTex(String(nerdamer('expand(' + c + ')')))).join(' & ')).join(' \\\\ ') + '\\end{pmatrix}';
}

/* y'' + a y' + b y = c (any order, constant a, b, c): roots of the characteristic equation give the general solution;
   with all the starting values the constants are found too */
function casOdeExact(ce, v, n, iv, ics, nm) {
  const i = ce.indexOf('='), f = '(' + ce.slice(0, i) + ')-(' + ce.slice(i + 1) + ')', vars = [];
  for (let k = 0; k <= n; k++) vars.push(nm(v, k));
  const coef = vars.map((x) => String(nerdamer('diff(' + f + ',' + x + ')')));
  if (coef.some((c) => casVars(c).length)) return null;
  const sub = {}; for (const x of vars) sub[x] = 0;
  const g = String(nerdamer(f, sub)); if (casVars(g).length) return null;
  const P = coef.map((c, k) => '(' + c + ')*r^' + k).join('+');
  let roots = []; try { roots = (nerdamer.solve(P + '=0', 'r').symbol.elements || []).map(String); } catch (e) { return null; }
  if (!roots.length || roots.some(casMessy)) return null;
  const terms = []; let k = 0;
  const mult = (r) => { let m = 1; while (m < n) { const d = String(nerdamer('diff(' + P + ',r,' + m + ')')); const val = casNum(String(nerdamer(d, { r }))); if (val == null || Math.abs(val) > 1e-9) break; m++; } return m; };
  const seen = new Set();
  for (const r of roots) {
    const re = String(nerdamer('realpart(' + r + ')')), im = String(nerdamer('imagpart(' + r + ')'));
    if (im !== '0') { const key = re + '|' + String(nerdamer('abs(' + im + ')')); if (seen.has(key)) continue; seen.add(key); const b = String(nerdamer('abs(' + im + ')')), ex = re === '0' ? '' : 'e^(' + re + '*' + iv + ')*';
      const m = mult(r); for (let j = 0; j < m; j++) { const tp = j ? iv + (j > 1 ? '^' + j : '') + '*' : ''; terms.push(tp + ex + 'cos(' + b + '*' + iv + ')', tp + ex + 'sin(' + b + '*' + iv + ')'); } }
    else { const m = mult(r); for (let j = 0; j < m; j++) terms.push((j ? iv + (j > 1 ? '^' + j : '') + '*' : '') + (re === '0' ? '1' : 'e^(' + re + '*' + iv + ')')); }
  }
  if (terms.length !== n) return null;
  /* a constant push on the right: y_p = -g / a0 (or a polynomial step up when a0 is 0) */
  let yp = '0'; const a0 = casNum(coef[0]);
  if (g !== '0') { if (a0 && Math.abs(a0) > 1e-12) yp = '(' + String(nerdamer('-(' + g + ')/(' + coef[0] + ')')) + ')'; else { const a1 = casNum(coef[1]); if (!a1) return null; yp = '(' + String(nerdamer('-(' + g + ')/(' + coef[1] + ')')) + ')*' + iv; } }
  const C = terms.map((_, j) => 'C' + (j + 1));
  const gen = C.map((c, j) => c + '*' + terms[j]).join('+') + (yp !== '0' ? '+' + yp : '');
  const out = { gen: casTex(gen) };
  /* starting values */
  const t0 = 0, need = []; for (let j = 0; j < n; j++) { const key = v + "'".repeat(j); if (ics[key] == null) return out; need.push([j, ics[key]]); }
  try {
    const eq = need.map(([j, val]) => { const d = j ? 'diff(' + gen + ',' + iv + ',' + j + ')' : gen; return String(nerdamer(String(nerdamer(d)), { [iv]: t0 })) + '=' + val; });
    const m = {};
    if (n === 1) { const s1 = nerdamer.solve(eq[0], 'C1'); m.C1 = String((s1.symbol.elements || [])[0]); }
    else { const sol = nerdamer.solveEquations(eq, C); for (const [a, b] of sol) m[a] = String(b); }
    if (C.some((c) => m[c] == null || casMessy(m[c]))) return out;
    let part = gen; for (const c of C) part = part.split(c).join('(' + m[c] + ')');
    out.part = casTex(String(nerdamer(part)));
  } catch (e) { /* only the general form */ }
  return out;
}

/* eigenvectors: the null space of A - lambda I for each eigenvalue, scaled so the last free entry is 1 */
function casEigvec(rows, lam) {
  const n = rows.length, M = rows.map((r, i) => r.map((c, j) => math.evaluate(String(c)) - (i === j ? lam : 0)));
  const piv = []; let r = 0;
  for (let c = 0; c < n && r < n; c++) { let p = r; for (let k = r + 1; k < n; k++) if (Math.abs(M[k][c]) > Math.abs(M[p][c])) p = k; if (Math.abs(M[p][c]) < 1e-9) continue; [M[p], M[r]] = [M[r], M[p]]; const v = M[r][c]; M[r] = M[r].map((x) => x / v); for (let k = 0; k < n; k++) if (k !== r) { const f = M[k][c]; M[k] = M[k].map((x, j) => x - f * M[r][j]); } piv.push(c); r++; }
  const free = []; for (let c = 0; c < n; c++) if (!piv.includes(c)) free.push(c);
  return free.map((fc) => { const x = new Array(n).fill(0); x[fc] = 1; piv.forEach((pc, k) => { x[pc] = -M[k][fc]; }); return x; });
}

