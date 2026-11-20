/* BURIN part: clean (loaded when first used) */
/* ---------- a clean screen for teaching with the iPad cabled to a TV or projector (task 2.6).
   The rule: once the presentation starts, nothing but the page is ever on screen. An iPad Air 3 in Safari can only
   mirror its screen over the cable (a web page cannot draw something else on the TV, as an installed app such as
   GoodNotes can), so a bar the TV must not show cannot be on the iPad either, not even for a moment.
   So every choice that needs looking at is made before starting, on a card (cleanSetup): the pens, one for each edge of
   the screen (colour, highlighter, eraser or laser), the line width, the whole page on screen (as GoodNotes shows its
   audience the full page) and a cover over the lower half. During the presentation:
     the pen writes with the pen of the edge chosen last;
     a finger tapping an edge takes the pen of that edge (the edge always gives the same pen, so it is never a guess);
     a finger slides the page and pulls to the next page; two fingers tap to undo, three to redo (as everywhere);
     a finger drags the cover down to show the working line by line (dragged to the bottom it is gone);
     three fingers held still for a second leave;
     a presenter clicker or keyboard: page keys turn pages, 1 to 4 take the pens, B or full stop black the screen out
     (any key or touch brings the page back), C the cover, Escape leaves.
   No message, menu, selection bar or AI card shows meanwhile. Leaving puts back the tool, colour, width and finger
   setting from before. All done by the app, no AI, works offline ---------- */
const CLEAN = { on: false, edge: 32, tap: null, hold: null, keep: null, flow: null, set: null, cover: false, coverY: 0.5 };
const CLEAN_EDGES = [['l', 'ขอบซ้าย'], ['t', 'ขอบบน'], ['r', 'ขอบขวา'], ['b', 'ขอบล่าง']];
const CLEAN_TOOLS = [['hl', 'ไฮไลต์'], ['eraser', 'ยางลบ'], ['laser', 'เลเซอร์']];
function cleanDefaults() {
  const cur = okHex(S.color) ? S.color : (S.recent[0] || '#1F3A8A');
  const red = cur.toLowerCase() === '#b42318' ? '#14181F' : '#B42318';
  return { pens: { l: { t: 'pen', c: cur }, t: { t: 'pen', c: red }, r: { t: 'hl' }, b: { t: 'laser' } }, w: S.width, whole: true, cover: false };
}
function cleanLoad() {
  const d = cleanDefaults();
  try {
    const v = JSON.parse(store_ls.get('tp-clean-set') || 'null');
    if (v && v.pens) for (const [k] of CLEAN_EDGES) { const p = v.pens[k]; if (p && (p.t === 'pen' ? okHex(p.c) : ['hl', 'eraser', 'laser'].includes(p.t))) d.pens[k] = p.t === 'pen' ? { t: 'pen', c: p.c } : { t: p.t }; }
    if (v && [0, 1, 2].includes(v.w)) d.w = v.w;
    if (v && typeof v.whole === 'boolean') d.whole = v.whole;
    if (v && typeof v.cover === 'boolean') d.cover = v.cover;
  } catch (e) { /* the defaults */ }
  return d;
}
function cleanCss() {
  if (document.getElementById('cleanCss')) return;
  const st = document.createElement('style'); st.id = 'cleanCss';
  /* the app's bars and messages, and on the page what the audience screen hides too: the teacher's answer boxes (เฉลย),
     the answer buttons of questions, the handles of boxes, the controls of moving models, the selection frame */
  const off = ['.dock', '.pagenav', '#bExitFull', '.addpage', '#nbScroll', '#livePill', '#exMini', '#updBar', '#toast', '.selbar', '.convbar', '.peekcard', '#pull', '#aiFloat', '.aiat', '.busy', '#tabMenu', '#ai', '.sheet',
    '.item.teacher', '.item .qkey', '.item .tgrab', '.item .tsize', '.lifedot', '.lifepanel', '.cleandot', '.lockban', '.diarybar', '#sel', '.peek', '.fpeek'];
  st.textContent = off.map((s) => 'body.clean ' + s).join(', ') + ' { display: none !important; }\n'
    + 'body.clean .item.qon { outline: none !important; }\n'
    + '#cleanCover { position: absolute; left: 0; right: 0; bottom: 0; z-index: 4; background: #3A3F4A; background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 12px, rgba(255,255,255,0) 12px 24px); box-shadow: 0 -2px 10px rgba(0,0,0,0.35); touch-action: none; }\n'
    + '#cleanBlank { position: absolute; inset: 0; z-index: 50; background: #000; touch-action: none; }\n'
    + '#cleanSet { position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.45); }\n'
    + '#cleanSet > div { box-sizing: border-box; width: calc(100% - 24px); max-width: 520px; max-height: calc(100% - 24px); overflow-y: auto; padding: 16px 18px; border-radius: 16px; background: var(--surface); color: var(--fg); box-shadow: var(--shadow); font-size: 15px; line-height: 1.6; }\n'
    + '#cleanSet h2 { margin: 0 0 2px; font-size: 18px; }\n'
    + '#cleanSet .csub { margin: 0 0 10px; color: var(--muted); font-size: 14px; }\n'
    + '#cleanSet .crow { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); }\n'
    + '#cleanSet .crow > b { flex: none; width: 64px; font-size: 14px; }\n'
    + '#cleanSet .cch { display: flex; flex-wrap: wrap; gap: 4px; }\n'
    + '#cleanSet .cch button { min-width: 40px; height: 40px; padding: 0 8px; border-radius: 10px; border: 2px solid transparent; background: var(--surface-2); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }\n'
    + '#cleanSet .cch button.sw { padding: 0; }\n'
    + '#cleanSet .cch button.sw i { display: block; width: 22px; height: 22px; margin: auto; border-radius: 50%; }\n'
    + '#cleanSet .cch button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft, var(--surface-2)); font-weight: 700; }\n'
    + '#cleanSet .copt { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); }\n'
    + '#cleanSet .copt small { display: block; color: var(--muted); font-size: 13px; line-height: 1.4; }\n'
    + '#cleanSet ul { margin: 4px 0 8px; padding-left: 20px; font-size: 14px; }\n'
    + '#cleanSet .cgo { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; border-top: 1px solid var(--line); }\n'
    + '#cleanSet .cgo button { min-height: 44px; padding: 0 18px; border: 0; border-radius: 12px; font: inherit; font-weight: 600; cursor: pointer; background: var(--surface-2); color: var(--fg); }\n'
    + '#cleanSet .cgo button.go { background: var(--accent); color: var(--accent-fg, #fff); }\n';
  document.head.appendChild(st);
}
/* ---- the card before starting: the pens of the edges, the width, the whole page, the cover ---- */
function cleanSetup() {
  cleanCss();
  const old = document.getElementById('cleanSet'); if (old) old.remove();
  const set = cleanLoad();
  const box = document.createElement('div'); box.id = 'cleanSet'; box.className = 'no-ink';
  box.innerHTML = '<div role="dialog" aria-modal="true" aria-label="เตรียมนำเสนอ"><h2>ต่อสาย จอสะอาด</h2>'
    + '<p class="csub">เมื่อเริ่มแล้ว จอจะเห็นแต่หน้ากระดาษ ไม่มีแถบหรือปุ่มใด ทั้งบน iPad และทีวี เลือกปากกาไว้ที่นี่ก่อน แล้วระหว่างนำเสนอใช้นิ้วแตะขอบจอเพื่อหยิบปากกาของขอบนั้น</p>'
    + '<div id="csEdges"></div>'
    + '<div class="crow"><b>ขนาดเส้น</b><span class="cch" id="csW"></span></div>'
    + '<div class="copt"><span>ทั้งหน้า<small>หน้ากระดาษพอดีจอ ไม่ต้องเลื่อนดู</small></span><button type="button" class="tg" role="switch" id="csWhole"><i></i></button></div>'
    + '<div class="copt"><span>ม่านบังครึ่งล่าง<small>ใช้นิ้วลากม่านลงเพื่อเปิดทีละบรรทัด ลากจนสุดม่านหายไป</small></span><button type="button" class="tg" role="switch" id="csCover"><i></i></button></div>'
    + '<ul><li>นิ้วเลื่อนหน้า ดึงเพื่อไปหน้าถัดไป</li><li>แตะสองนิ้ว ย้อนกลับ แตะสามนิ้ว ทำซ้ำ</li><li>แตะค้างสามนิ้ว 1 วินาที ออกจากจอสะอาด</li><li>รีโมตนำเสนอ ปุ่มเปลี่ยนหน้า เปลี่ยนหน้า ปุ่ม B พักจอ ปุ่ม Esc ออก</li></ul>'
    + '<div class="cgo"><button type="button" class="no">ยกเลิก</button><button type="button" class="go">เริ่มนำเสนอ</button></div></div>';
  document.body.appendChild(box);
  const draw = () => {
    const ed = box.querySelector('#csEdges'); ed.innerHTML = '';
    for (const [k, name] of CLEAN_EDGES) {
      const row = document.createElement('div'); row.className = 'crow'; row.innerHTML = '<b></b><span class="cch"></span>'; row.querySelector('b').textContent = name;
      const ch = row.querySelector('.cch'), p = set.pens[k];
      const cols = []; for (const c of S.recent.concat(['#14181F', '#B42318', '#1D7350'])) if (!cols.some((x) => x.toLowerCase() === c.toLowerCase())) cols.push(c);
      for (const c of cols.slice(0, 5)) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.innerHTML = '<i></i>'; b.querySelector('i').style.background = c;
        b.setAttribute('aria-label', name + ' ปากกา' + colorName(c)); b.dataset.k = k; b.dataset.v = c;
        b.setAttribute('aria-pressed', p.t === 'pen' && p.c.toLowerCase() === c.toLowerCase() ? 'true' : 'false');
        b.onclick = () => { set.pens[k] = { t: 'pen', c }; draw(); }; ch.appendChild(b);
      }
      for (const [t, tn] of CLEAN_TOOLS) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = tn; b.dataset.k = k; b.dataset.v = t;
        b.setAttribute('aria-pressed', p.t === t ? 'true' : 'false'); b.onclick = () => { set.pens[k] = { t }; draw(); }; ch.appendChild(b);
      }
      ed.appendChild(row);
    }
    const wb = box.querySelector('#csW'); wb.innerHTML = '';
    ['เล็ก', 'กลาง', 'ใหญ่'].forEach((n, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = n; b.setAttribute('aria-pressed', set.w === i ? 'true' : 'false'); b.onclick = () => { set.w = i; draw(); }; wb.appendChild(b); });
    box.querySelector('#csWhole').setAttribute('aria-checked', set.whole ? 'true' : 'false');
    box.querySelector('#csCover').setAttribute('aria-checked', set.cover ? 'true' : 'false');
  };
  box.querySelector('#csWhole').onclick = () => { set.whole = !set.whole; draw(); };
  box.querySelector('#csCover').onclick = () => { set.cover = !set.cover; draw(); };
  box.querySelector('.no').onclick = () => box.remove();
  box.querySelector('.go').onclick = () => { store_ls.set('tp-clean-set', JSON.stringify(set)); box.remove(); cleanStart(set); };
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); box.remove(); } });
  draw();
  try { box.querySelector('.go').focus({ preventScroll: true }); } catch (e) { /* fine */ }
}
/* ---- a pen of an edge ---- */
function cleanPen(k) {
  const p = CLEAN.set && CLEAN.set.pens[k]; if (!p) return;
  if (p.t === 'pen') { S.color = p.c; setTool('pen'); }
  else setTool(p.t);
}
/* ---- the whole page on screen: fits both ways, and the next page comes at once in the same place ---- */
function cleanFit() {
  if (!CLEAN.on || !CLEAN.set || !CLEAN.set.whole) return;
  const vw = vp.clientWidth, vh = vp.clientHeight, pw = W * S.base, ph = H * S.base; if (!pw || !ph) return;
  const z = Math.max(0.5, Math.min(1, (vh - 24) / ph, (vw - 24) / pw));
  S.zoom = z; S.tx = (vw - pw * z) / 2; S.ty = Math.max(12, (vh - ph * z) / 2); S.pull = 0;
  applyT(); resizeLater();
}
/* ---- the cover: a sheet over the lower part, dragged down by a finger to show the working line by line ---- */
function cleanCoverSet(on) {
  CLEAN.cover = !!on;
  let cv = document.getElementById('cleanCover');
  if (!on) { if (cv) cv.remove(); return; }
  if (!cv) {
    cv = document.createElement('div'); cv.id = 'cleanCover'; cv.className = 'no-ink'; cv.setAttribute('aria-label', 'ม่านบัง ลากลงเพื่อเปิด');
    vp.appendChild(cv);
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'pen') return; /* the pen does not move the cover (nor write on it) */
      e.preventDefault(); e.stopPropagation();
      const id = e.pointerId, r = vp.getBoundingClientRect(), dy = e.clientY - cv.getBoundingClientRect().top;
      const mv = (ev) => { if (ev.pointerId !== id) return; ev.stopPropagation(); CLEAN.coverY = clamp((ev.clientY - dy - r.top) / r.height, 0.02, 1); cleanCoverPlace(); };
      const up = (ev) => {
        if (ev.pointerId !== id) return; mv(ev);
        window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
        /* let go at the foot of the screen (or the cover nearly off it): all is shown, the cover goes */
        if (CLEAN.coverY > 0.92 || ev.clientY > Math.min(r.bottom, window.innerHeight) - 48) cleanCoverSet(false);
      };
      window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
    });
  }
  cleanCoverPlace();
}
function cleanCoverPlace() { const cv = document.getElementById('cleanCover'); if (cv) cv.style.top = Math.round(CLEAN.coverY * 1000) / 10 + '%'; }
/* ---- the pause: the screen goes black; any touch or key brings the page back ---- */
function cleanBlankSet(on) {
  let bl = document.getElementById('cleanBlank');
  document.body.classList.toggle('cblank', !!on);
  if (!on) { if (bl) bl.remove(); return; }
  if (!bl) {
    bl = document.createElement('div'); bl.id = 'cleanBlank'; bl.className = 'no-ink';
    bl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); cleanBlankSet(false); });
    vp.appendChild(bl);
  }
}
function cleanKeys(e) {
  if (!CLEAN.on || (e.target && e.target.closest && e.target.closest('input,select,textarea,[contenteditable="true"]'))) return;
  const k = String(e.key || '').toLowerCase(), code = e.code || '';
  if (document.body.classList.contains('cblank')) { if (['shift', 'control', 'alt', 'meta'].includes(k)) return; e.preventDefault(); e.stopPropagation(); cleanBlankSet(false); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  if (k === 'b' || k === '.' || code === 'KeyB' || code === 'Period') { stop(); cleanBlankSet(true); }
  else if (k === 'c' || code === 'KeyC') { stop(); cleanCoverSet(!CLEAN.cover); if (CLEAN.cover) { CLEAN.coverY = 0.5; cleanCoverPlace(); } }
  else if (/^Digit[1-4]$/.test(code) || /^[1-4]$/.test(k)) { stop(); cleanPen(CLEAN_EDGES[(+(code.slice(5) || k)) - 1][0]); }
  else if (['p', 'h', 'e', 'l', 't', 'k', 's'].includes(k) || /^Key[PHELTKS]$/.test(code)) stop(); /* the letter shortcuts for tools stay out: a key pressed by mistake would leave a tool that cannot be seen */
}
/* ---- touches: an edge gives its pen; three fingers held still leave ---- */
function cleanEdgeAt(x, y) {
  const r = vp.getBoundingClientRect(), e = CLEAN.edge;
  const d = [['l', x - r.left], ['r', r.right - x], ['t', y - r.top], ['b', r.bottom - y]].filter((a) => a[1] < e).sort((a, b) => a[1] - b[1]);
  return d.length ? d[0][0] : null;
}
function cleanHold(e) {
  if (e.pointerType !== 'touch') return;
  const h = CLEAN.hold || (CLEAN.hold = { pts: new Map(), t: 0 });
  if (e.type === 'pointerdown') {
    h.pts.set(e.pointerId, [e.clientX, e.clientY, e.clientX, e.clientY]);
    clearTimeout(h.t);
    if (h.pts.size === 3) h.t = setTimeout(() => { const still = [...h.pts.values()].every((p) => Math.hypot(p[2] - p[0], p[3] - p[1]) < 30); if (CLEAN.on && h.pts.size === 3 && still) { h.pts.clear(); setFocus(false); } }, 1000);
  } else if (e.type === 'pointermove') { const p = h.pts.get(e.pointerId); if (p) { p[2] = e.clientX; p[3] = e.clientY; } }
  else { h.pts.delete(e.pointerId); if (h.pts.size < 3) clearTimeout(h.t); }
}
function cleanDown(e) {
  if (!CLEAN.on) return;
  cleanHold(e);
  if (e.pointerType === 'pen' || (e.target && e.target.closest && e.target.closest('#cleanCover, #cleanBlank'))) { if (e.pointerType === 'pen') CLEAN.tap = null; return; }
  /* a palm, a hand resting while the pen writes, or a second finger is never a tap on the edge */
  const big = (e.width || 0) > 70 || (e.height || 0) > 70, pen = S.penDown > 0 || now() - (S.lastPen || 0) < 650;
  const edge = cleanEdgeAt(e.clientX, e.clientY);
  if (CLEAN.tap || big || pen || !e.isPrimary || !edge || (e.pointerType === 'mouse' && e.button !== 0)) { if (CLEAN.tap && CLEAN.tap.id !== e.pointerId) CLEAN.tap = null; return; }
  CLEAN.tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: now(), edge, eat: !!S.finger || e.pointerType === 'mouse' };
  /* a finger that draws (or a mouse) would leave a dot at the edge: the edge is for taking a pen */
  if (CLEAN.tap.eat) { e.stopPropagation(); e.preventDefault(); }
}
function cleanMove(e) {
  if (!CLEAN.on) return;
  cleanHold(e);
  const tp = CLEAN.tap;
  if (tp && tp.id === e.pointerId) { if (Math.hypot(e.clientX - tp.x, e.clientY - tp.y) > 14) tp.moved = true; if (tp.eat) e.stopPropagation(); }
}
function cleanUp(e) {
  if (!CLEAN.on) return;
  cleanHold(e);
  const tp = CLEAN.tap; if (!tp || tp.id !== e.pointerId) return;
  CLEAN.tap = null; if (tp.eat) e.stopPropagation();
  if (e.type === 'pointerup' && !tp.moved && now() - tp.t < 600) cleanPen(tp.edge);
}
/* ---- in and out ---- */
function cleanStart(set) {
  if (!set) { cleanSetup(); return; }
  if (CLEAN.on || S.present || S.show) return;
  cleanCss();
  CLEAN.on = true; S.clean = true; CLEAN.set = set; CLEAN.tap = null; CLEAN.hold = null;
  CLEAN.keep = { tool: S.tool, color: S.color, width: S.width, finger: S.finger };
  /* fingers slide the page while nothing can be seen (the pen writes); as before when leaving */
  if (S.finger) { S.finger = false; syncToggles(); }
  S.width = set.w;
  cleanPen('l');
  CLEAN.flow = FLOW.on;
  /* one page at a time: the pages above and below are pictures made for the teacher's screen (answer boxes included) */
  if (FLOW.on) { FLOW.on = false; try { renderPeeks().catch(() => {}); } catch (e) { /* fine */ } }
  closePops(); if (S.sel) clearSel();
  document.body.classList.add('clean');
  window.addEventListener('pointerdown', cleanDown, true);
  window.addEventListener('pointermove', cleanMove, true);
  window.addEventListener('pointerup', cleanUp, true);
  window.addEventListener('pointercancel', cleanUp, true);
  window.addEventListener('keydown', cleanKeys, true);
  setFocus(true);
  if (set.cover) { CLEAN.coverY = 0.5; cleanCoverSet(true); }
}
function cleanEnd() {
  if (!CLEAN.on) return;
  cleanBlankSet(false); cleanCoverSet(false);
  CLEAN.on = false; S.clean = false; CLEAN.tap = null; CLEAN.hold = null;
  if (CLEAN.flow !== null && FLOW.on !== CLEAN.flow) { FLOW.on = CLEAN.flow; try { renderPeeks().catch(() => {}); } catch (e) { /* fine */ } }
  CLEAN.flow = null;
  window.removeEventListener('pointerdown', cleanDown, true);
  window.removeEventListener('pointermove', cleanMove, true);
  window.removeEventListener('pointerup', cleanUp, true);
  window.removeEventListener('pointercancel', cleanUp, true);
  window.removeEventListener('keydown', cleanKeys, true);
  document.body.classList.remove('clean', 'cblank');
  const k = CLEAN.keep || {};
  S.color = k.color; S.width = k.width;
  if (S.finger !== k.finger) { S.finger = !!k.finger; syncToggles(); }
  setTool(k.tool || 'pen');
  CLEAN.keep = null; CLEAN.set = null;
}

