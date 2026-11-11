/* BURIN part: work (loaded when first used) */
/* ---------- homework, end to end: the teacher sets each question as "choose an answer" or "show the working", always with a
   due time; learners hand in from the app (answers, pages of their own notebooks or of the teacher's lessons, photos, files)
   or from a link without the app; they see what is set and what they have handed in; the teacher sees every learner's state.
   The cloud decides what is on time (its own clock), so a hand-in cannot be back-dated or carry its own marks ---------- */
const HWX = { view: 'list', sel: null, filter: 'all', bfilter: 'all', q: '' };
const HW_DAY = 86400000;
/* the time left, in words */
function hwLeft(ms) {
  const m = Math.round(Math.abs(ms) / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d ? d + ' วัน' + (h ? ' ' + h + ' ชั่วโมง' : '') : h ? h + ' ชั่วโมง' + (mm ? ' ' + mm + ' นาที' : '') : Math.max(1, mm) + ' นาที';
}
const hwWhen = (t) => new Date(t).toLocaleString(LOC, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/* is the work still accepted, for this learner (their hashed ID): the due time, a new time for the whole class, or for them alone */
function hwState(a, hsid) {
  const A = a.data || {}, t = now(), due = a.due ? Date.parse(a.due) : null, ext = A.ext || {};
  const all = ext.all ? Date.parse(ext.all) : null, mine = hsid && ext.stu && ext.stu[hsid] ? Date.parse(ext.stu[hsid]) : null;
  const until = due == null ? null : Math.max(due, all || 0, mine || 0);
  let st = 'open';
  if (!a.open) st = 'shut'; else if (due == null) st = 'open'; else if (t <= due) st = due - t < HW_DAY ? 'soon' : 'open'; else if (t <= until) st = 'ext'; else st = 'closed';
  return { st, due, until, all, mine, ok: st === 'open' || st === 'soon' || st === 'ext' };
}
function hwStateChip(s, sent) {
  if (sent) return '<em class="hwc ok">ส่งแล้ว</em>';
  if (s.st === 'shut') return '<em class="hwc">ครูปิดรับแล้ว</em>';
  if (s.st === 'closed') return '<em class="hwc bad">เลยกำหนด ปิดรับแล้ว</em>';
  if (s.st === 'ext') return '<em class="hwc warn">ครูขยายเวลา เหลือ ' + hwLeft(s.until - now()) + '</em>';
  if (s.due == null) return '<em class="hwc">ไม่กำหนดเวลา</em>';
  return '<em class="hwc' + (s.st === 'soon' ? ' warn' : '') + '">เหลือ ' + hwLeft(s.due - now()) + '</em>';
}
const hwErrText = (e) => { const m = String((e && (e.message || e.code)) || e || ''); return /row-level security|violates|42501|permission/i.test(m) ? 'ส่งไม่ได้ เพราะเลยกำหนดส่งหรือครูปิดรับงานนี้แล้ว ถ้ามีเหตุจำเป็นให้แจ้งครูขยายเวลา' : 'ส่งไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง'; };
/* ---------- what this device knows: homework seen, hand-in receipts, drafts ---------- */
const hwLS = (k, d) => { try { const v = JSON.parse(store_ls.get(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
function hwRemember(list) {
  const known = hwLS('tp-myhw', []);
  for (const a of list || []) { if (!a || !a.id) continue; const i = known.findIndex((x) => x.id === a.id); const v = { id: a.id, title: a.title || '', due: a.due || null, cls: a.cls || (a.data && a.data.clsId) || null, at: now() }; if (i >= 0) known[i] = Object.assign(known[i], v); else known.push(v); }
  store_ls.set('tp-myhw', JSON.stringify(known.slice(-200)));
  hwEntryShow();
}
function hwReceipts() { return hwLS('tp-hwrc', {}); }
function hwReceiptAdd(aid, sid) {
  const r = hwReceipts(); (r[aid] = r[aid] || []).push({ s: sid, at: now() }); r[aid] = r[aid].slice(-10); store_ls.set('tp-hwrc', JSON.stringify(r));
  const sent = hwLS('tp-sent', []); if (!sent.includes(aid)) { sent.push(aid); store_ls.set('tp-sent', JSON.stringify(sent.slice(-300))); }
  hwEntryShow();
}
/* the classes this device has confirmed a learner in */
function hwIdents() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('tp-ident-') === 0) { const v = hwLS(k, null); if (v && v.sid) out.push({ cls: k.slice(9), who: v }); } } } catch (e) { /* storage blocked */ } return out; }
/* what the cloud says this learner has handed in: by class and ID, and by the receipts kept on this device */
async function hwMine(sb, idents) {
  const rc = hwReceipts(), ids = [].concat(...Object.values(rc).map((l) => l.map((x) => x.s))).slice(-300), got = {};
  const add = (aid, at) => { const g = got[aid] || (got[aid] = { n: 0, last: 0 }); g.n++; g.last = Math.max(g.last, Date.parse(at) || +at || 0); };
  let cloud = false;
  try {
    for (const it of idents.length ? idents : [{ cls: null, who: { sid: null } }]) {
      const { data, error } = await sb.rpc('hw_mine', { p_cls: it.cls, p_sid: it.who.sid, p_ids: ids }); if (error) throw error;
      cloud = true; const seen = new Set(); for (const r of data || []) { if (seen.has(r.s_id)) continue; seen.add(r.s_id); add(r.a_id, r.at); }
      if (ids.length) ids.length = 0; /* the receipts are asked once */
    }
  } catch (e) { cloud = false; }
  if (!cloud) { for (const [aid, l] of Object.entries(rc)) for (const x of l) add(aid, x.at); for (const aid of hwLS('tp-sent', [])) if (!got[aid]) got[aid] = { n: 1, last: 0 }; }
  return { got, cloud };
}
async function hwFetchOne(sb, id) {
  const r = await sb.rpc('hw_get', { p_id: id });
  if (!r.error) return { data: (r.data || [])[0] || null, error: null };
  return sb.from('assignments').select('id,title,data,due,open,created_at').eq('id', id).maybeSingle();
}
async function hwFetchClass(sb, cls) {
  const r = await sb.rpc('hw_class', { p_cls: cls });
  if (!r.error) return r;
  return sb.from('assignments').select('id,title,data,due,open,created_at').eq('data->>clsId', cls).order('created_at', { ascending: true });
}
/* the overlay shared by the learner's pages; inside the app it closes back to the notebook */
function hwOverlay(title) {
  const box = $('#hwStudent'); box.hidden = false; $('#hwsTitle').textContent = title;
  const root = $('#hwsBody'); root.innerHTML = '';
  const b = exEl('div', 'hwhost'); root.appendChild(b); /* a page opened again while this one loads replaces it whole */
  const top = exEl('div', 'hwtop'); b.appendChild(top);
  if (S.nb) { const x = exEl('button', 'btn', 'กลับไปที่สมุด'); x.type = 'button'; x.onclick = hwOverlayClose; top.appendChild(x); }
  return { b, top };
}
function hwOverlayClose() { $('#hwStudent').hidden = true; $('#hwsBody').innerHTML = ''; if (/^#(hw|term|mywork)=?/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); }

/* ---------- learner: every piece of work in one place ---------- */
async function hwHubOpen(clsId) {
  let sb; try { sb = await cloudClient(); } catch (e) { toast('เชื่อมต่อไม่ได้', 3000); return; }
  $('#loading').hidden = true;
  const { b, top } = hwOverlay(clsId ? 'งานทั้งเทอม' : 'งานของฉัน'); const host = exEl('div', ''); b.appendChild(host); waitLine(host, 'กำลังโหลดงาน');
  const known = hwLS('tp-myhw', []), idents = hwIdents();
  const classes = [...new Set([clsId].concat(idents.map((x) => x.cls), known.map((x) => x.cls)).filter(Boolean))].filter((c) => !clsId || c === clsId);
  const list = new Map(); let failed = false;
  for (const c of classes) { const { data, error } = await hwFetchClass(sb, c); if (error) { failed = true; continue; } for (const a of data || []) if (!(a.data && a.data.kind === 'grades')) list.set(a.id, a); }
  if (!clsId) for (const k of known.filter((x) => !x.cls || !classes.includes(x.cls)).slice(-40)) { if (list.has(k.id)) continue; const { data } = await hwFetchOne(sb, k.id).catch(() => ({ data: null })); if (data) list.set(data.id, data); }
  const all = [...list.values()];
  hwRemember(all.map((a) => ({ id: a.id, title: a.title, due: a.due, cls: a.data && a.data.clsId })));
  const myIds = idents.filter((x) => classes.includes(x.cls));
  const mine = await hwMine(sb, myIds);
  if (mine.cloud) { const sent = hwLS('tp-sent', []); for (const aid of Object.keys(mine.got)) if (!sent.includes(aid)) sent.push(aid); store_ls.set('tp-sent', JSON.stringify(sent.slice(-300))); hwEntryShow(); }
  host.innerHTML = '';
  const lbl = clsId && all[0] && all[0].data.cls && all[0].data.cls.label; if (lbl) $('#hwsTitle').textContent = 'งานทั้งเทอม ' + lbl;
  if (failed && !all.length) { host.appendChild(exEl('div', 'note err', 'โหลดงานไม่ได้ ลองอีกครั้ง')); return; }
  /* who is looking: the hashed ID unlocks extensions given to this learner alone */
  const hs = {}; for (const it of idents) hs[it.cls] = await hashKey(it.cls + '|id|' + String(it.who.sid).toLowerCase());
  const rows = all.map((a) => { const cls = a.data && a.data.clsId, s = hwState(a, cls ? hs[cls] : null), g = mine.got[a.id]; return { a, s, g, sent: !!g }; });
  const todo = rows.filter((r) => !r.sent && r.s.ok), late = rows.filter((r) => !r.sent && !r.s.ok), done = rows.filter((r) => r.sent);
  if (myIds.length) { const w = myIds[0].who; top.appendChild(exEl('span', 'hwme', 'ของ <b>' + esc('เลขที่ ' + w.no + ' ' + w.name) + '</b>')); }
  const tiles = exEl('div', 'hwtiles');
  const tile = (n, t, cls, f) => { const x = exEl('button', 'hwtile ' + cls, '<b>' + n + '</b><span>' + t + '</span>'); x.type = 'button'; x.setAttribute('aria-pressed', HWX.filter === f ? 'true' : 'false'); x.onclick = () => { HWX.filter = HWX.filter === f ? 'all' : f; paint(); }; return x; };
  tiles.append(tile(rows.length, 'งานที่ครูมอบหมาย', 'all', 'all'), tile(done.length, 'ส่งแล้ว', 'ok', 'done'), tile(todo.length, 'ยังต้องทำ', 'todo', 'todo'), tile(late.length, 'เลยกำหนดไม่ได้ส่ง', 'bad', 'late'));
  host.appendChild(tiles);
  if (rows.length) { const pct = Math.round(done.length / rows.length * 100); host.appendChild(exEl('div', 'hwprog', '<i style="width:' + pct + '%"></i><span>ส่งแล้ว ' + done.length + ' จาก ' + rows.length + ' งาน (' + pct + '%)</span>')); }
  if (!mine.cloud && rows.length) host.appendChild(exEl('div', 'note small', 'สถานะการส่งอ่านจากเครื่องนี้ ถ้าเคยส่งจากเครื่องอื่นอาจยังไม่ขึ้น'));
  if (!myIds.length && rows.some((r) => r.a.data && r.a.data.cls)) {
    const c0 = rows.find((r) => r.a.data && r.a.data.cls).a.data.cls;
    const idb = exEl('button', 'btn solid', 'ยืนยันตัวตนเพื่อดูว่าส่งงานไหนแล้ว'); idb.type = 'button'; idb.onclick = async () => { await askIdentity(c0); hwHubOpen(clsId); }; host.appendChild(idb);
  }
  const listEl = exEl('div', 'hwlist'); host.appendChild(listEl);
  const paint = () => {
    tiles.querySelectorAll('.hwtile').forEach((x, i) => x.setAttribute('aria-pressed', HWX.filter === ['all', 'done', 'todo', 'late'][i] ? 'true' : 'false'));
    listEl.innerHTML = '';
    const pick = HWX.filter === 'done' ? done : HWX.filter === 'todo' ? todo : HWX.filter === 'late' ? late : todo.concat(late, done);
    const order = (x) => (x.s.until || x.s.due || 9e15);
    const show = HWX.filter === 'all' ? todo.slice().sort((p, q) => order(p) - order(q)).concat(done.slice().sort((p, q) => q.g.last - p.g.last), late) : pick.slice().sort((p, q) => order(p) - order(q));
    if (!show.length) { listEl.appendChild(exEl('div', 'note ok', HWX.filter === 'todo' ? 'ไม่มีงานค้าง เยี่ยมมาก' : rows.length ? 'ไม่มีงานในกลุ่มนี้' : 'ยังไม่มีงานที่มอบหมาย')); return; }
    for (const r of show) {
      const { a, s, g } = r, A = a.data || {}, nq = (A.qs || []).length, nw = (A.qs || []).filter((q) => hwQm(A, q) === 'work').length;
      const el = exEl('div', 'hwrow' + (r.sent ? ' sent' : !s.ok ? ' miss' : s.st === 'soon' ? ' soon' : ''));
      el.innerHTML = '<span class="hwdot" aria-hidden="true"></span><div class="hwri"><b></b><small></small><div class="hwchips">' + hwStateChip(s, r.sent) + (r.sent && g.last ? '<em class="hwc">เมื่อ ' + esc(hwWhen(g.last)) + (g.n > 1 ? ' (ส่ง ' + g.n + ' ครั้ง)' : '') + '</em>' : '') + '</div></div>';
      el.querySelector('b').textContent = a.title;
      el.querySelector('small').textContent = [nq + ' ข้อ' + (nw ? ' แสดงวิธีทำ ' + nw + ' ข้อ' : ''), s.due ? 'ส่งภายใน ' + hwWhen(s.due) : '', A.cls && !clsId ? A.cls.label : ''].filter(Boolean).join(' : ');
      if (s.ok || r.sent) { const go = exEl('button', 'btn' + (!r.sent && s.ok ? ' solid' : ''), r.sent ? (s.ok ? 'ดูหรือส่งใหม่' : 'ดูงาน') : 'ทำงานนี้'); go.type = 'button'; go.onclick = () => { location.hash = 'hw=' + a.id; hwStudentOpen(a.id, clsId); }; el.appendChild(go); }
      listEl.appendChild(el);
    }
  };
  paint();
  if (clsId || classes.length === 1) myGradesForm(host, clsId || classes[0]);
}

/* ---------- learner: one piece of work ---------- */
async function hwStudentOpen(id, termCls) {
  let sb; try { sb = await cloudClient(); } catch (e) { toast('เชื่อมต่อไม่ได้', 3000); return; }
  const { data, error } = await hwFetchOne(sb, id);
  $('#loading').hidden = true;
  const { b, top } = hwOverlay('การบ้าน');
  if (error || !data) { b.appendChild(exEl('div', 'note err', 'ไม่พบงานนี้ ตรวจลิงก์อีกครั้ง')); return; }
  const a = data, A = a.data, L = 'กขคง', qs = A.qs || [];
  $('#hwsTitle').textContent = a.title;
  hwRemember([{ id: a.id, title: a.title, due: a.due, cls: A.clsId }]);
  { const bk = exEl('button', 'btn', termCls || A.clsId ? 'งานทั้งเทอม' : 'งานของฉัน'); bk.type = 'button'; bk.onclick = () => { const c = termCls || A.clsId; location.hash = c ? 'term=' + c : 'mywork'; hwHubOpen(c || null); }; top.prepend(bk); }
  /* who is handing in */
  let stu = null, hsid = null;
  if (A.cls && A.cls.map) { stu = savedIdent(A.cls.id); if (!stu) stu = await askIdentity(A.cls); hsid = await hashKey(A.cls.id + '|id|' + String(stu.sid).toLowerCase()); }
  const s = hwState(a, hsid), mine = await hwMine(sb, A.clsId && stu ? [{ cls: A.clsId, who: stu }] : []), g = mine.got[a.id];
  /* the head: what, by when, and where this learner stands */
  const head = exEl('div', 'hwhero' + (g ? ' sent' : !s.ok ? ' miss' : ''));
  head.innerHTML = '<div class="hwhl"><small>' + esc([A.cls ? A.cls.label : '', A.teacher || ''].filter(Boolean).join(' : ')) + '</small><div class="hwdue"></div></div><div class="hwhr"></div>';
  head.querySelector('.hwdue').innerHTML = s.due ? 'กำหนดส่ง <b>' + esc(hwWhen(s.due)) + '</b> ' + hwStateChip(s, false) + (s.st === 'ext' ? '<br><small>ครูขยายเวลาให้ถึง ' + esc(hwWhen(s.until)) + '</small>' : '') : 'ไม่กำหนดเวลาส่ง';
  head.querySelector('.hwhr').innerHTML = g ? '<span class="hwbig ok">ส่งแล้ว</span><small>' + (g.last ? esc(hwWhen(g.last)) : '') + (g.n > 1 ? ' ส่ง ' + g.n + ' ครั้ง ครูใช้ฉบับล่าสุด' : '') + '</small>' : s.ok ? '<span class="hwbig">ยังไม่ส่ง</span>' : '<span class="hwbig bad">ปิดรับแล้ว</span>';
  b.appendChild(head);
  if (stu) { const who = exEl('div', 'hwwho', '<span>ส่งในนาม <b>' + esc('เลขที่ ' + stu.no + ' ' + stu.name) + '</b></span>'); const ch = exEl('button', 'btn', 'ไม่ใช่ฉัน'); ch.type = 'button'; ch.onclick = () => { store_ls.set('tp-ident-' + A.cls.id, ''); hwStudentOpen(id, termCls); }; who.appendChild(ch); b.appendChild(who); }
  if (!s.ok) {
    b.appendChild(exEl('div', 'note err', s.st === 'shut' ? 'ครูปิดรับงานนี้แล้ว' : 'เลยกำหนดส่งแล้ว ระบบปิดรับอัตโนมัติ ถ้ามีเหตุจำเป็นให้แจ้งครู ครูขยายเวลาให้เฉพาะคนหรือทั้งห้องได้'));
    return;
  }
  if (!A.online && !A.files && A.ver !== 2) { b.appendChild(exEl('div', 'note', 'งานนี้ทำใส่กระดาษ เขียนคำตอบบนกระดาษคำตอบหรือสมุดแล้วส่งครูตามที่ครูนัด ครูจะบันทึกคะแนนให้เอง ไม่ต้องส่งในแอป')); return; }
  /* the form, with a draft kept on this device so leaving the page loses nothing */
  const dkey = 'tp-hwd-' + a.id, dr = hwLS(dkey, {});
  const st = { answers: dr.answers || {}, t0: now(), att: {} };
  for (const [k, l] of Object.entries(dr.pages || {})) st.att[k] = l.filter((x) => x && x.pid).map((x) => ({ kind: 'page', pid: x.pid, label: x.label || '' }));
  const saveDraft = () => { const pages = {}; for (const [k, l] of Object.entries(st.att)) { const p = l.filter((x) => x.kind === 'page').map((x) => ({ pid: x.pid, label: x.label })); if (p.length) pages[k] = p; } store_ls.set(dkey, JSON.stringify({ answers: st.answers, pages, at: now() })); };
  let nm = null;
  if (!stu) { const f = exEl('label', 'field', '<span>ชื่อ นามสกุล หรือ ชื่อเล่นกับเลขที่</span>'); nm = document.createElement('input'); nm.maxLength = 60; nm.value = store_ls.get('tp-sname') || ''; f.appendChild(nm); b.appendChild(f); }
  const mcOnline = A.ver === 2 || A.online;
  const nWork = qs.filter((q) => hwQm(A, q) === 'work').length;
  if (nWork) b.appendChild(exEl('div', 'note hwhow', '<b>ข้อที่มีป้าย "แสดงวิธีทำ"</b> ให้แนบวิธีทำของข้อนั้น เลือกหน้าจากสมุดในแอปนี้ ถ่ายรูปกระดาษ หรือแนบไฟล์ก็ได้ เขียนสูตร การแทนค่า และหน่วยให้ครบ' + (hwWt(A) ? ' ข้อแบบนี้คะแนนวิธีทำ ' + Math.round(hwWt(A) * 100) + '% และคำตอบ ' + Math.round((1 - hwWt(A)) * 100) + '%' : '')));
  const cards = [];
  const attachZone = (key, labelText) => {
    const z = exEl('div', 'hwatt'); z.appendChild(exEl('span', 'hwattl', labelText));
    const thumbs = exEl('div', 'hwthumbs'); z.appendChild(thumbs);
    const draw = () => {
      thumbs.innerHTML = ''; const l = st.att[key] || [];
      l.forEach((x, i) => {
        const t = exEl('div', 'hwthumb');
        if (x.kind === 'page') { t.innerHTML = '<canvas></canvas><small></small>'; t.querySelector('small').textContent = x.label || 'หน้าสมุด'; drawThumb(x.pid, t.querySelector('canvas')).catch(() => {}); }
        else if (/pdf/i.test(x.file.type)) t.innerHTML = '<span class="pdfchip">PDF</span><small>' + esc(x.file.name) + '</small>';
        else { const im = document.createElement('img'); im.alt = 'รูปที่แนบ'; im.src = x.url || (x.url = URL.createObjectURL(x.file)); t.appendChild(im); t.appendChild(exEl('small', '', x.kind === 'photo' ? 'รูปถ่าย' : 'ไฟล์')); }
        const rm = exEl('button', 'hwrm', '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'); rm.type = 'button'; rm.setAttribute('aria-label', 'เอาออก');
        rm.onclick = () => { l.splice(i, 1); if (x.url) URL.revokeObjectURL(x.url); saveDraft(); draw(); prog(); };
        t.appendChild(rm); thumbs.appendChild(t);
      });
      z.classList.toggle('has', !!l.length);
    };
    const add = (items) => { const l = st.att[key] || (st.att[key] = []); for (const x of items) { if (l.length >= 6) { toast('แนบได้สูงสุด 6 รายการต่อข้อ', 2000); break; } l.push(x); } saveDraft(); draw(); prog(); };
    const btns = exEl('div', 'hwattb');
    if (S.store && (S.nbs || []).length) { const pb = exEl('button', 'btn', 'เลือกหน้าจากสมุด'); pb.type = 'button'; pb.onclick = async () => { const got = await hwPickPages(); if (got.length) add(got.map((p) => ({ kind: 'page', pid: p.pid, label: p.label }))); }; btns.appendChild(pb); }
    const mk = (label, accept, capture, kind) => { const fi = document.createElement('input'); fi.type = 'file'; fi.accept = accept; fi.multiple = !capture; if (capture) fi.setAttribute('capture', 'environment'); fi.hidden = true;
      fi.onchange = () => { const ok = [...fi.files].filter((f) => f.size <= 10 * 1024 * 1024); if (ok.length < fi.files.length) toast('ไฟล์ที่ใหญ่เกิน 10 MB ไม่ได้แนบ', 2400); add(ok.map((f) => ({ kind, file: f }))); fi.value = ''; };
      const bt = exEl('button', 'btn', label); bt.type = 'button'; bt.onclick = () => fi.click(); btns.append(bt, fi); };
    mk('ถ่ายรูป', 'image/*', true, 'photo'); mk('แนบไฟล์', 'image/*,application/pdf', false, 'file');
    z.appendChild(btns); draw(); return z;
  };
  qs.forEach((q, i) => {
    const mode = hwQm(A, q), hasC = q.c && q.c.length >= 2;
    const w = exEl('div', 'sqq hwq' + (mode === 'work' ? ' work' : ''), '<div class="hwqh"><b>ข้อ ' + (i + 1) + '</b><em class="hwmode ' + mode + '">' + (mode === 'work' ? 'แสดงวิธีทำ' : 'เลือกตอบ') + '</em></div>' + figHtml(q, 360) + '<div class="exq">' + mdToHtml(q.q) + '</div>');
    if (hasC && mcOnline) {
      const opts = exEl('div', 'exopts');
      q.c.forEach((c, o) => { const btn = exEl('button', 'exopt' + (st.answers[q.id] && st.answers[q.id][0] === o ? ' pick' : ''), '<b>' + L[o] + '</b><span>' + mdToHtml(c) + '</span>'); btn.type = 'button';
        btn.onclick = () => { st.answers[q.id] = [o, Math.round((now() - st.t0) / 1000)]; opts.querySelectorAll('.exopt').forEach((x, k) => x.classList.toggle('pick', k === o)); saveDraft(); prog(); }; opts.appendChild(btn); });
      w.appendChild(opts);
    } else if (hasC) w.appendChild(exEl('div', 'note', q.c.map((c, o) => L[o] + '. ' + mdToHtml(c)).join('&nbsp;&nbsp;&nbsp; ')));
    if (mode === 'work') w.appendChild(attachZone(q.id, 'วิธีทำข้อ ' + (i + 1)));
    cards.push(w); b.appendChild(w);
  });
  if (A.files && !(A.ver === 2 && nWork === qs.length)) { const h = exEl('div', 'sqq hwq'); h.appendChild(exEl('div', 'hwqh', '<b>' + (A.ver === 2 ? 'แนบงานทั้งชุด (ถ้ามี)' : 'แนบกระดาษคำตอบหรือไฟล์') + '</b>')); h.appendChild(exEl('div', 'note small', 'เช่น รูปกระดาษคำตอบที่ทำทั้งชุด ถ่ายให้เห็นทั้งหน้า แสงพอ ตัวหนังสือชัด')); h.appendChild(attachZone('_all', 'งานที่แนบ')); b.appendChild(h); }
  /* the bar that follows: how much is done, and hand in */
  const bar = exEl('div', 'hwbar'), pg = exEl('div', 'hwbp'), res = exEl('div', '');
  const go = exEl('button', 'btn solid', g ? 'ส่งฉบับใหม่' : 'ส่งงาน'); go.type = 'button';
  bar.append(pg, go);
  const need = () => {
    const noAns = [], noWork = [];
    qs.forEach((q, i) => { const mode = hwQm(A, q), hasC = q.c && q.c.length >= 2; if (hasC && mcOnline && !st.answers[q.id]) noAns.push(i + 1); if (mode === 'work' && !(st.att[q.id] || []).length) noWork.push(i + 1); });
    return { noAns, noWork };
  };
  function prog() {
    const n = need(), nc = qs.filter((q) => q.c && q.c.length >= 2 && mcOnline).length;
    pg.innerHTML = (nc ? '<span>ตอบแล้ว <b>' + (nc - n.noAns.length) + '/' + nc + '</b></span>' : '') + (nWork ? '<span>วิธีทำ <b>' + (nWork - n.noWork.length) + '/' + nWork + '</b></span>' : '') + (s.due ? '<span class="hwbt">' + (s.st === 'ext' ? 'ขยายถึง ' + esc(hwWhen(s.until)) : 'ส่งภายใน ' + esc(hwWhen(s.due))) + '</span>' : '');
    cards.forEach((c, i) => { const q = qs[i]; c.classList.toggle('done', !((q.c && q.c.length >= 2 && mcOnline && !st.answers[q.id]) || (hwQm(A, q) === 'work' && !(st.att[q.id] || []).length))); });
  }
  prog();
  const confirmBox = exEl('div', '');
  go.onclick = async () => {
    const name = stu ? stu.name : nm.value.trim(); if (!name) { nm.focus(); toast('ใส่ชื่อก่อนส่ง', 1800); return; }
    const n = need(), anyAtt = Object.values(st.att).some((l) => l.length);
    if (A.ver !== 2 && A.files && !A.online && !anyAtt) { toast('แนบรูปหรือไฟล์งานก่อนส่ง', 2200); return; }
    if ((n.noAns.length || n.noWork.length) && !go.dataset.sure) {
      confirmBox.innerHTML = '';
      const c = exEl('div', 'note advice', (n.noAns.length ? 'ยังไม่ได้เลือกคำตอบข้อ ' + n.noAns.join(', ') + '<br>' : '') + (n.noWork.length ? 'ยังไม่ได้แนบวิธีทำข้อ ' + n.noWork.join(', ') + ' ข้อเหล่านี้จะได้คะแนนเฉพาะส่วนคำตอบ<br>' : '') + 'จะส่งเลยหรือกลับไปทำต่อ');
      const r = exEl('div', 'row2'), y = exEl('button', 'btn solid', 'ส่งเลย'), back = exEl('button', 'btn', 'กลับไปทำต่อ');
      y.onclick = () => { go.dataset.sure = '1'; confirmBox.innerHTML = ''; go.onclick(); }; back.onclick = () => { confirmBox.innerHTML = ''; const k = (n.noAns[0] || n.noWork[0]) - 1; if (cards[k]) cards[k].scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      r.append(y, back); c.appendChild(r); confirmBox.appendChild(c); confirmBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    delete go.dataset.sure;
    if (!stu) store_ls.set('tp-sname', name);
    go.disabled = true;
    const items = []; for (const [k, l] of Object.entries(st.att)) for (const x of l) items.push([k, x]);
    const W8 = waitCard(res, 'กำลังส่งงาน', [items.length ? 'เตรียมและอัปโหลด ' + items.length + ' รายการ' : 'เตรียมคำตอบ', 'บันทึกการส่ง']);
    try {
      const sid = 'w' + uid(), paths = [], qf = {}, src = {}, cnt = {};
      for (const [k, x] of items) {
        let blob = null, ext = 'jpg';
        if (x.kind === 'page') { const r = await hwPageImage(x.pid); if (!r) throw new Error('เปิดหน้าสมุดที่เลือกไม่ได้'); blob = r; }
        else { blob = x.file; ext = /pdf/i.test(x.file.type) ? 'pdf' : 'jpg'; if (ext === 'jpg') { try { const p = await prepImage(x.file); blob = p.blob; ext = /png/.test(p.type) ? 'png' : 'jpg'; } catch (e) { /* as is */ } } }
        const qi = qs.findIndex((q) => q.id === k), tag = qi >= 0 ? 'q' + (qi + 1) : 'g'; cnt[tag] = (cnt[tag] || 0) + 1;
        const path = a.id + '/' + sid + '/' + tag + '-' + cnt[tag] + '.' + ext;
        const { error: ue } = await sb.storage.from('burin-sub').upload(path, blob, { contentType: ext === 'pdf' ? 'application/pdf' : (ext === 'png' ? 'image/png' : 'image/jpeg') });
        if (ue) throw ue; paths.push(path); src[path] = x.kind; if (qi >= 0) (qf[k] = qf[k] || []).push(path);
      }
      W8.step(1);
      const row = { id: sid, assignment: a.id, name, data: { v: 2, answers: st.answers, files: paths, qf, src, at: now(), dev: LIVE.sid, stu: stu ? { sid: stu.sid, no: stu.no } : undefined } };
      const { error: ie } = await sb.from('submissions').insert(row); if (ie) throw ie;
      W8.stop(); hwReceiptAdd(a.id, sid); store_ls.del(dkey);
      for (const l of Object.values(st.att)) for (const x of l) if (x.url) URL.revokeObjectURL(x.url);
      hwDoneCard(sb, a, sid, name, paths.length, st, stu, termCls);
    } catch (e) { W8.stop(); go.disabled = false; res.innerHTML = '<div class="note err">' + esc(e && /หน้าสมุด/.test(e.message || '') ? e.message : hwErrText(e)) + '</div>'; }
  };
  b.appendChild(confirmBox); b.appendChild(res); b.appendChild(bar);
  typeset(b);
}
/* the receipt: what was handed in, when the cloud recorded it, and the instant result when the teacher allows it */
async function hwDoneCard(sb, a, sid, name, nf, st, stu, termCls) {
  const A = a.data, L = 'กขคง';
  const { b } = hwOverlay(a.title);
  let at = now(); try { const { data } = await sb.rpc('hw_mine', { p_cls: null, p_sid: null, p_ids: [sid] }); if (data && data[0]) at = Date.parse(data[0].at) || at; } catch (e) { /* the device time */ }
  const c = exEl('div', 'hwdone');
  c.innerHTML = '<svg class="hwtick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 27l7 7 15-16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><h3>ส่งงานเรียบร้อยแล้ว</h3>'
    + '<dl><dt>งาน</dt><dd></dd><dt>ผู้ส่ง</dt><dd></dd><dt>ส่งเมื่อ</dt><dd>' + esc(new Date(at).toLocaleString(LOC, { dateStyle: 'medium', timeStyle: 'medium' })) + '</dd><dt>คำตอบ</dt><dd>' + Object.keys(st.answers).length + ' ข้อ' + (nf ? ' แนบ ' + nf + ' รายการ' : '') + '</dd><dt>เลขที่ใบรับ</dt><dd class="mono">' + esc(sid.slice(-6).toUpperCase()) + '</dd></dl>';
  c.querySelectorAll('dd')[0].textContent = a.title; c.querySelectorAll('dd')[1].textContent = stu ? 'เลขที่ ' + stu.no + ' ' + name : name;
  b.appendChild(c);
  const r = exEl('div', 'row2');
  const hub = exEl('button', 'btn solid', 'ดูงานทั้งหมดของฉัน'); hub.onclick = () => { const cl = termCls || A.clsId; location.hash = cl ? 'term=' + cl : 'mywork'; hwHubOpen(cl || null); };
  const again = exEl('button', 'btn', 'แก้แล้วส่งใหม่'); again.onclick = () => hwStudentOpen(a.id, termCls);
  r.append(hub, again); b.appendChild(r);
  b.appendChild(exEl('div', 'note small', 'ส่งใหม่ได้จนถึงกำหนดส่ง ครูใช้ฉบับล่าสุด'));
  if (A.instant) {
    const mc = (A.qs || []).filter((q) => hwQm(A, q) === 'mc' && q.a != null);
    if (mc.length) {
      let ok = 0; mc.forEach((q) => { const x = st.answers[q.id]; if (x && x[0] === q.a) ok++; });
      b.appendChild(exEl('div', 'exscore', '<b>' + ok + '<small> / ' + mc.length + '</small></b><span>คะแนนข้อเลือกตอบ' + (mc.length < A.qs.length ? ' ข้อแสดงวิธีทำรอครูตรวจ' : '') + '</span>'));
      A.qs.forEach((q, i) => { if (hwQm(A, q) !== 'mc' || q.a == null) return; const x = st.answers[q.id], right = x && x[0] === q.a; b.appendChild(exEl('div', 'exrev', '<b>' + (i + 1) + '. ' + (right ? 'ถูก' : 'ยังไม่ถูก เฉลย ' + L[q.a]) + '</b>' + (right ? '' : '<div class="note">' + mdToHtml(q.e || '') + '</div>'))); });
      typeset(b);
    }
  }
}
/* ---------- pages from the learner's notebooks (their own, or the lessons the teacher sent) as pictures ---------- */
function hwPickPages() {
  return new Promise((resolve) => {
    const sh = exEl('div', 'hwpick'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'เลือกหน้าจากสมุด');
    const panel = exEl('div', 'hwpickp'); sh.appendChild(panel); document.body.appendChild(sh);
    const chosen = new Map();
    const close = (v) => { sh.remove(); resolve(v); };
    sh.onclick = (e) => { if (e.target === sh) close([]); };
    const nbs = (S.nbs || []).slice(); if (S.nb && S.nid && !nbs.some((n) => n.id === S.nid)) nbs.unshift(Object.assign({ id: S.nid }, S.nb));
    let cur = nbs.find((n) => n.id === S.nid) || nbs[0];
    const draw = () => {
      panel.innerHTML = '';
      const hd = exEl('div', 'hwpickh', '<b>เลือกหน้าที่จะส่ง</b>'); const x = exEl('button', 'btn', 'ยกเลิก'); x.onclick = () => close([]); hd.appendChild(x); panel.appendChild(hd);
      const sel = document.createElement('select'); sel.className = 'traysel'; sel.setAttribute('aria-label', 'สมุด');
      for (const n of nbs) { const o = document.createElement('option'); o.value = n.id; o.textContent = (n.title || 'สมุด') + ' (' + ((n.pages || []).length) + ' หน้า)'; sel.appendChild(o); }
      sel.value = cur ? cur.id : ''; sel.onchange = () => { cur = nbs.find((n) => n.id === sel.value); draw(); }; panel.appendChild(sel);
      const grid = exEl('div', 'hwpickg'); panel.appendChild(grid);
      const pages = (cur && cur.pages) || [];
      if (!pages.length) grid.appendChild(exEl('div', 'note small', 'สมุดเล่มนี้ยังไม่มีหน้า'));
      const io = thumbObserver();
      pages.forEach((pid, i) => {
        const bt = exEl('button', 'pthumb', '<span class="pc"><canvas></canvas></span><span>หน้า ' + (i + 1) + '</span>'); bt.type = 'button';
        bt.setAttribute('aria-pressed', chosen.has(pid) ? 'true' : 'false');
        const cv = bt.querySelector('canvas'); cv.dataset.pid = pid; if (io) io.observe(cv); else drawThumb(pid, cv).catch(() => {});
        bt.onclick = () => { if (chosen.has(pid)) chosen.delete(pid); else chosen.set(pid, { pid, label: (cur.title || 'สมุด') + ' หน้า ' + (i + 1) }); bt.setAttribute('aria-pressed', chosen.has(pid) ? 'true' : 'false'); ok.textContent = chosen.size ? 'แนบ ' + chosen.size + ' หน้า' : 'เลือกหน้าก่อน'; ok.disabled = !chosen.size; };
        grid.appendChild(bt);
      });
      const ok = exEl('button', 'btn solid', chosen.size ? 'แนบ ' + chosen.size + ' หน้า' : 'เลือกหน้าก่อน'); ok.disabled = !chosen.size; ok.onclick = () => close([...chosen.values()]);
      const ft = exEl('div', 'hwpickf'); ft.append(exEl('span', 'note small', 'แตะหน้าเพื่อเลือก เลือกได้หลายหน้าและหลายเล่ม'), ok); panel.appendChild(ft);
    };
    draw();
  });
}
/* a whole page as one picture: paper, the picture of an imported page, the writing and every box on it */
async function hwPageImage(pid) {
  try { await loadLib('h2c'); } catch (e) { return null; }
  const { page, strokes } = await pageData(pid); if (!page) return null;
  const [pw, ph] = pageDims(page), keep = [W, H], k = 1.4;
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-30000px;top:0;pointer-events:none'; document.body.appendChild(host);
  try {
    const pg = document.createElement('div'); pg.style.cssText = 'position:relative;width:' + pw + 'px;height:' + ph + 'px;background:#FFFFFF;overflow:hidden';
    const cv = document.createElement('canvas'); cv.width = Math.round(pw * k); cv.height = Math.round(ph * k); cv.style.cssText = 'position:absolute;left:0;top:0;width:' + pw + 'px;height:' + ph + 'px';
    const c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0);
    const bgs = (page.items || []).filter(isUnderItem);
    W = pw; H = ph; c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); paper(c, page.paper || 'grid');
    let ink = c, ci = null;
    if (bgs.length) { ci = document.createElement('canvas'); ci.width = cv.width; ci.height = cv.height; ci.style.cssText = cv.style.cssText; ink = ci.getContext('2d'); ink.setTransform(k, 0, 0, k, 0, 0); }
    drawInto(ink, strokes, null); [W, H] = keep;
    pg.appendChild(cv);
    if (bgs.length) { const bl = document.createElement('div'); bl.style.cssText = 'position:absolute;left:0;top:0;width:' + pw + 'px;height:' + ph + 'px'; for (const it of bgs) bl.appendChild(buildItemEl(it, true)); pg.appendChild(bl); pg.appendChild(ci); }
    const its = document.createElement('div'); its.style.cssText = 'position:absolute;left:0;top:0;width:' + pw + 'px;height:' + ph + 'px';
    for (const it of page.items || []) if (!isUnderItem(it)) its.appendChild(buildItemEl(it, true));
    pg.appendChild(its); host.appendChild(pg);
    for (const im of pg.querySelectorAll('img')) { if (!im.complete) await new Promise((r) => { im.onload = r; im.onerror = r; setTimeout(r, 6000); }); }
    await typeset(its); if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const shot = await window.html2canvas(pg, { scale: k, backgroundColor: '#FFFFFF', logging: false, useCORS: true });
    return await new Promise((r) => shot.toBlob(r, 'image/jpeg', 0.86));
  } catch (e) { [W, H] = keep; return null; } finally { host.remove(); }
}

/* ---------- teacher: set the work ---------- */
function hwAssignOpen(set) {
  if (CLOUD.state !== 'on') { toast('การมอบหมายงานต้องเข้าระบบคลาวด์ก่อน', 3000); return; }
  if (!set.qs.length) { toast('ชุดนี้ยังไม่มีโจทย์', 2000); return; }
  closeSheets(); $('#hwSheet').hidden = false; HW.set = set;
  const b = $('#hwBody'); b.innerHTML = '';
  b.appendChild(exEl('div', 'note', 'ผู้เรียนเปิดลิงก์หรือสแกน QR แล้วทำได้เลย ไม่ต้องมีบัญชี งานจะปิดรับเองเมื่อถึงกำหนดส่ง ขยายเวลาให้ทั้งห้องหรือรายคนได้ภายหลัง'));
  const f = exEl('div', 'exform');
  f.innerHTML = '<label class="field"><span>ชื่องาน</span><input id="hwTitle" maxlength="120"></label><label class="field"><span>กำหนดส่ง (ต้องระบุ เลยเวลานี้ระบบปิดรับเอง)</span><input id="hwDue" type="datetime-local" required></label>';
  b.appendChild(f); $('#hwTitle').value = 'การบ้าน ' + set.title.replace(/^ชุด /, '');
  const dueIn = $('#hwDue'), toLocal = (t) => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const endOf = (days) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(23, 59, 0, 0); return d.getTime(); };
  dueIn.value = toLocal(endOf(7));
  const DUES = [[1, 'พรุ่งนี้'], [3, '3 วัน'], [7, '1 สัปดาห์'], [14, '2 สัปดาห์']];
  const dc = exChips(b, DUES, (v) => v === 7, (v) => { dueIn.value = toLocal(endOf(v)); dc.querySelectorAll('.chip').forEach((c, i) => c.setAttribute('aria-pressed', DUES[i][0] === v ? 'true' : 'false')); dueSay(); });
  dc.classList.add('hwdues');
  const dueNote = exEl('div', 'note small'); b.appendChild(dueNote);
  const dueSay = () => { const t = Date.parse(dueIn.value); dueNote.textContent = isFinite(t) ? 'ปิดรับ ' + hwWhen(t) + (t > now() ? ' (อีก ' + hwLeft(t - now()) + ')' : ' ซึ่งผ่านไปแล้ว ตั้งเวลาใหม่') : 'ใส่วันและเวลาส่ง'; dueNote.classList.toggle('err', !(isFinite(t) && t > now())); };
  dueIn.oninput = () => { dc.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); dueSay(); }; dueSay();
  const cf = exEl('label', 'field', '<span>ห้องเรียน (ผู้เรียนยืนยันตัวด้วยรหัสหรือเลขที่ ครูเห็นว่าใครส่งหรือยังไม่ส่ง และขยายเวลารายคนได้)</span>'); b.appendChild(cf);
  const fillCls = () => { const old = $('#hwCls'); if (old) old.remove(); cf.appendChild(classSelect('hwCls', true)); };
  if (CLS.loaded) fillCls(); else clsLoad().then(fillCls);
  /* each question: choose an answer (checked at once) or show the working (checked by the teacher, or read by AI) */
  const qm = {}; set.qs.forEach((q) => { qm[q.id] = q.c && q.c.length >= 2 ? 'mc' : 'work'; });
  const opt = { instant: false, files: false, paper: false, wt: 0.5 };
  HW.opt = opt; HW.qm = qm;
  b.appendChild(exEl('h3', '', 'รูปแบบของแต่ละข้อ'));
  const sum = exEl('div', 'note small'); b.appendChild(sum);
  const bulk = exEl('div', 'row2'); const ba = exEl('button', 'btn', 'ทุกข้อเลือกตอบ'), bw = exEl('button', 'btn', 'ทุกข้อแสดงวิธีทำ'); bulk.append(ba, bw); b.appendChild(bulk);
  const ql = exEl('div', 'hwqm'); b.appendChild(ql);
  const wtBox = exEl('div', 'note small hwwt'); b.appendChild(wtBox);
  const drawQ = () => {
    ql.innerHTML = '';
    set.qs.forEach((q, i) => {
      const hasC = q.c && q.c.length >= 2, r = exEl('div', 'hwqmr');
      r.innerHTML = '<span class="sqn">' + (i + 1) + '</span><div class="tqq clamp">' + mdToHtml(q.q) + '</div>';
      const seg = exEl('div', 'hwseg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'รูปแบบข้อ ' + (i + 1));
      for (const [v, t] of [['mc', 'เลือกตอบ'], ['work', 'แสดงวิธีทำ']]) { const x = exEl('button', '', t); x.type = 'button'; x.setAttribute('aria-pressed', qm[q.id] === v ? 'true' : 'false'); if (v === 'mc' && !hasC) { x.disabled = true; x.title = 'ข้อนี้ไม่มีตัวเลือก'; } x.onclick = () => { qm[q.id] = v; drawQ(); }; seg.appendChild(x); }
      r.appendChild(seg); ql.appendChild(r);
    });
    const nm = set.qs.filter((q) => qm[q.id] === 'mc').length, nw = set.qs.length - nm, nwc = set.qs.filter((q) => qm[q.id] === 'work' && q.c && q.c.length >= 2).length;
    sum.innerHTML = '<b>เลือกตอบ ' + nm + ' ข้อ</b> ระบบตรวจให้ทันทีเมื่อส่ง : <b>แสดงวิธีทำ ' + nw + ' ข้อ</b> ผู้เรียนแนบวิธีทำรายข้อ (หน้าสมุด รูปถ่าย หรือไฟล์) ครูให้คะแนนเองหรือให้ AI อ่านก่อนแล้วครูแก้ได้';
    wtBox.innerHTML = ''; wtBox.hidden = !nwc;
    if (nwc) { wtBox.innerHTML = 'ข้อแสดงวิธีทำที่มีตัวเลือก ' + nwc + ' ข้อ: คะแนนแบ่งเป็นวิธีทำกับคำตอบ<br>'; const WTS = [[0.3, 'วิธีทำ 30%'], [0.5, 'วิธีทำ 50%'], [0.7, 'วิธีทำ 70%']]; const c = exChips(wtBox, WTS, (v) => opt.wt === v, (v) => { opt.wt = v; c.querySelectorAll('.chip').forEach((x, k) => x.setAttribute('aria-pressed', WTS[k][0] === v ? 'true' : 'false')); }); }
    typeset(ql);
  };
  ba.onclick = () => { set.qs.forEach((q) => { if (q.c && q.c.length >= 2) qm[q.id] = 'mc'; }); drawQ(); };
  bw.onclick = () => { set.qs.forEach((q) => { qm[q.id] = 'work'; }); drawQ(); };
  drawQ();
  b.appendChild(exEl('h3', '', 'ตัวเลือกเพิ่มเติม'));
  const OPTS = [['instant', 'ให้เห็นคะแนนและเฉลยข้อเลือกตอบทันทีหลังส่ง'], ['files', 'ให้แนบงานทั้งชุดได้ด้วย เช่น รูปกระดาษคำตอบ'], ['paper', 'มีผู้เรียนทำใส่กระดาษ ครูจะบันทึกให้เอง']];
  const oc = exChips(b, OPTS, (v) => !!opt[v], (v) => { opt[v] = !opt[v]; oc.querySelectorAll('.chip').forEach((c, i) => c.setAttribute('aria-pressed', opt[OPTS[i][0]] ? 'true' : 'false')); });
  b.appendChild(exEl('div', 'note small', 'เฉลยทันทีเหมาะกับแบบฝึก ไม่เหมาะกับการสอบ ข้อแสดงวิธีทำไม่เปิดเฉลยให้เห็น เพื่อไม่ให้ลอกเฉลยไปเขียนวิธีทำ'));
  const go = exEl('button', 'btn solid', 'มอบหมายงาน ' + set.qs.length + ' ข้อ'); go.onclick = () => hwAssignCreate(dueIn); b.appendChild(go);
  const out = exEl('div', ''); out.id = 'hwOut'; b.appendChild(out);
  typeset(b);
}
async function hwAssignCreate(dueIn) {
  const set = HW.set, o = HW.opt, qm = HW.qm, out = $('#hwOut');
  const t = Date.parse(dueIn.value);
  if (!isFinite(t) || t <= now()) { out.innerHTML = '<div class="note err">ตั้งกำหนดส่งเป็นเวลาในอนาคตก่อน ระบบใช้เวลานี้ปิดรับงานเอง</div>'; dueIn.focus(); return; }
  const id = Array.from({ length: 9 }, () => CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]).join('').toLowerCase();
  const due = new Date(t).toISOString();
  const qs = set.qs.map((q) => { const x = { id: q.id, t: q.t, ch: q.ch, q: q.q, c: q.c, d: q.d, fig: q.fig }; if (o.instant && qm[q.id] === 'mc') { x.a = q.a || 0; x.e = q.e || ''; } return x; });
  const anyWork = qs.some((q) => qm[q.id] === 'work');
  const data = { ver: 2, title: $('#hwTitle').value.trim() || set.title, setId: set.id, qs, qm: Object.assign({}, qm), online: true, files: !!o.files, instant: !!o.instant, paper: !!o.paper, work: anyWork, wt: anyWork ? o.wt : 0, ext: {}, teacher: (S.nb && S.nb.title) || '' };
  const cls = CLS.list.find((c) => c.id === ($('#hwCls') && $('#hwCls').value));
  if (S.nid && S.nb) data.nb = { id: S.nid, title: S.nb.title || '', room: liveRoomCode(S.nid, cls ? cls.id : null) };
  if (cls) { data.clsId = cls.id; data.cls = await rosterHashed(cls); }
  try {
    const { error } = await CLOUD.client.from('assignments').insert({ id, owner: CLOUD.user.id, title: data.title, data, due, open: true });
    if (error) throw error;
    HW.list = null;
    { const k = {}, m = {}; for (const q of set.qs) { if (q.c && q.c.length >= 2) k[q.id] = q.a || 0; const mm = [q.ans, q.e].filter(Boolean).join('\n'); if (mm) m[q.id] = mm.slice(0, 1500); } HW.keys[id] = k; HW.model[id] = m; Promise.resolve(S.store.set('hwkey/' + id, { k, m, at: now() })).catch(() => {}); } /* the keys and model answers stay with the teacher, not in the work learners can read */
    if (LIVE.role === 'teacher' && data.nb && data.nb.id === LIVE.nbId) setTimeout(() => liveSendHw(true), 500);
    if (cls && !(cls.items || []).some((it) => it.ref === id)) { const P = clsPlan(cls); cls.items = (cls.items || []).concat([{ id: 'k' + uid(), name: data.title.slice(0, 40), max: qs.length, kind: 'hw', ref: id, at: now(), due, cat: P.newCat || (P.cats[0] && P.cats[0].id) || null }]); await clsSave(cls); }
    out.innerHTML = '<div class="livetop"><div class="qr" id="hwQR"></div><div class="lcode"><span>ลิงก์การบ้าน ส่งในกลุ่มแชตของห้องได้เลย ปิดรับ ' + esc(hwWhen(t)) + '</span><small>' + esc(hwLink(id)) + '</small></div></div>';
    const cp = exEl('button', 'btn', 'คัดลอกลิงก์'); cp.onclick = () => navigator.clipboard && navigator.clipboard.writeText(hwLink(id)).then(() => toast('คัดลอกแล้ว', 1200)).catch(() => {}); out.appendChild(cp);
    const see = exEl('button', 'btn', 'ดูว่าใครส่งแล้ว'); see.onclick = () => { $('#hwSheet').hidden = true; EX.tab = 'hw'; HW.cur = id; HWX.view = 'one'; openExam(); }; out.appendChild(see);
    drawQR($('#hwQR'), hwLink(id), 160);
  } catch (e) { out.innerHTML = '<div class="note err">' + esc(hwSqlHint(e)) + '</div>'; }
}

/* ---------- teacher: all the work set, and who has handed in ---------- */
async function hwBoard(body) {
  if (CLOUD.state !== 'on') { body.appendChild(exEl('div', 'note', 'การบ้านใช้คลาวด์ของอาจารย์ เข้าระบบก่อน')); return; }
  let list; try { list = await hwLoad(); } catch (e) { body.appendChild(exEl('div', 'note err', esc(hwSqlHint(e)))); return; }
  if (HWX.view === 'one' && list.some((x) => x.id === HW.cur)) return hwBoardOne(body, list.find((x) => x.id === HW.cur));
  HWX.view = 'list';
  /* the cloud rules that close work on time and keep hand-ins honest come with setup.sql; say so once if they are not there yet */
  if (HWX.sqlOk == null) { try { const r = await CLOUD.client.rpc('hw_mine', { p_cls: null, p_sid: null, p_ids: [] }); HWX.sqlOk = !r.error; } catch (e) { HWX.sqlOk = false; } }
  if (!HWX.sqlOk) body.appendChild(exEl('div', 'note advice', '<b>ปรับฐานข้อมูลอีกครั้งหนึ่ง</b> เพื่อให้ระบบปิดรับงานตามกำหนดส่ง นักเรียนดูได้ว่าส่งงานไหนแล้ว และกันการแก้เวลาส่งหรือใส่คะแนนเอง: เปิด Supabase เมนู SQL Editor วางไฟล์ setup.sql ทั้งไฟล์แล้วกด Run (รันซ้ำได้ ข้อมูลเดิมไม่หาย)'));
  body.appendChild(exEl('div', 'note', 'มอบหมายงานได้จากแท็บชุดโจทย์ กด "มอบหมายเป็นการบ้าน" ที่ชุดนั้น แตะงานเพื่อดูว่าใครส่งแล้ว'));
  if (!list.length) { body.appendChild(exEl('div', 'note', 'ยังไม่มีงานที่มอบหมาย')); return; }
  /* how many handed in, per piece of work, in one request */
  const counts = {};
  try { const { data } = await CLOUD.client.from('submissions').select('id,assignment,name,created_at,data').in('assignment', list.map((x) => x.id)); for (const s of data || []) { const k = (s.data && s.data.stu && s.data.stu.sid) ? 'id:' + s.data.stu.sid : 'n:' + String(s.name || '').trim(); (counts[s.assignment] = counts[s.assignment] || new Set()).add(k); } } catch (e) { /* counts unknown */ }
  if (!CLS.loaded) await clsLoad();
  const sel = HWX.sel || (HWX.sel = new Set()); for (const k of [...sel]) if (!list.some((x) => x.id === k)) sel.delete(k);
  const host = exEl('div', 'hwalist');
  const q = document.createElement('input'); q.type = 'search'; q.className = 'traysel'; q.placeholder = 'ค้นงาน'; q.value = HWX.q || ''; q.setAttribute('aria-label', 'ค้นงาน');
  const shown = () => list.filter((a) => !HWX.q || (a.title + ' ' + ((a.data.cls && a.data.cls.label) || '')).toLowerCase().includes(HWX.q.toLowerCase()));
  const ms = mselBar(body, { sel, all: () => shown().map((a) => a.id), redraw: () => draw(), noun: 'งาน', actions: [
    ['ปิดรับ', async (ids) => { await hwBulk(ids, (a) => ({ open: false })); }],
    ['เปิดรับอีกครั้ง', async (ids) => { await hwBulk(ids, (a) => ({ open: true })); }],
    ['ขยายเวลาทั้งห้อง', (ids, el) => hwExtPick(el, 'ขยายเวลาให้ทั้งห้อง ' + ids.length + ' งาน', async (t) => { await hwBulk(ids, (a) => ({ open: true, data: Object.assign({}, a.data, { ext: Object.assign({}, a.data.ext || {}, { all: new Date(t).toISOString() }) }) })); })],
    ['ลบ', (ids, el) => popMenu(el, 'ลบ ' + ids.length + ' งาน พร้อมงานที่ผู้เรียนส่ง ย้อนกลับไม่ได้', [['ลบเลย', async () => { await hwDelete(ids); }]]), true]
  ] });
  body.appendChild(q); body.appendChild(host);
  q.oninput = debounce(() => { HWX.q = q.value; draw(); }, 200);
  function draw() {
    host.innerHTML = '';
    for (const a of shown()) {
      const s = hwState(a, null), c = a.data.clsId && CLS.list.find((x) => x.id === a.data.clsId), n = counts[a.id] ? counts[a.id].size : null, tot = c ? (c.roster || []).length : 0;
      const el = exEl('div', 'hwacard' + (ms.on() ? ' msel' : '') + (sel.has(a.id) ? ' picked' : ''));
      const nw = (a.data.qs || []).filter((x) => hwQm(a.data, x) === 'work').length;
      el.innerHTML = (ms.on() ? '<span class="mtick" aria-hidden="true"></span>' : '') + '<div class="hwai"><b></b><small></small><div class="hwchips">' + (s.st === 'shut' ? '<em class="hwc">ปิดรับแล้ว</em>' : s.st === 'closed' ? '<em class="hwc bad">เลยกำหนด ปิดรับแล้ว</em>' : s.st === 'ext' ? '<em class="hwc warn">ขยายเวลาทั้งห้อง ถึง ' + esc(hwWhen(s.until)) + '</em>' : s.due ? '<em class="hwc' + (s.st === 'soon' ? ' warn' : ' ok') + '">เปิดรับ เหลือ ' + hwLeft(s.due - now()) + '</em>' : '<em class="hwc warn">ไม่ได้กำหนดเวลาส่ง</em>') + (a.data.ext && a.data.ext.stu && Object.keys(a.data.ext.stu).length ? '<em class="hwc">ขยายรายคน ' + Object.keys(a.data.ext.stu).length + ' คน</em>' : '') + '</div></div>'
        + '<div class="hwan">' + (n == null ? '' : tot ? '<b>' + n + '<small>/' + tot + '</small></b><i><s style="width:' + Math.round(Math.min(1, n / tot) * 100) + '%"></s></i><span>ส่งแล้ว</span>' : '<b>' + n + '</b><span>คนส่งแล้ว</span>') + '</div>';
      el.querySelector('b').textContent = a.title;
      el.querySelector('small').textContent = [c ? classLabel(c) : (a.data.cls && a.data.cls.label) || 'ไม่ได้ผูกห้อง', (a.data.qs || []).length + ' ข้อ' + (nw ? ' แสดงวิธีทำ ' + nw : ''), s.due ? 'ส่ง ' + hwWhen(s.due) : ''].filter(Boolean).join(' : ');
      el.onclick = () => { if (ms.on()) { ms.toggle(a.id); return; } HW.cur = a.id; HWX.view = 'one'; HWX.bsel = null; exRender(); };
      host.appendChild(el);
    }
    if (!host.children.length) host.appendChild(exEl('div', 'note small', 'ไม่พบงานที่ตรงกับคำค้น'));
    ms.sync();
  }
  draw();
}
async function hwBulk(ids, patch) {
  let bad = 0;
  for (const id of ids) { const a = (HW.list || []).find((x) => x.id === id); if (!a) continue; const { error } = await CLOUD.client.from('assignments').update(patch(a)).eq('id', id); if (error) bad++; }
  toast(bad ? 'ไม่สำเร็จ ' + bad + ' งาน' : 'เรียบร้อย ' + ids.length + ' งาน', 1800); HWX.sel = null; exRender();
}
async function hwDelete(ids) {
  for (const id of ids) {
    try { const { data: L } = await CLOUD.client.storage.from('burin-sub').list(id, { limit: 1000 }); const paths = []; for (const f of L || []) { if (f.id) paths.push(id + '/' + f.name); else { const { data: L2 } = await CLOUD.client.storage.from('burin-sub').list(id + '/' + f.name, { limit: 100 }); for (const g of L2 || []) paths.push(id + '/' + f.name + '/' + g.name); } } if (paths.length) await CLOUD.client.storage.from('burin-sub').remove(paths); } catch (e) { /* files stay */ }
    await CLOUD.client.from('assignments').delete().eq('id', id);
    for (const c of CLS.list) if ((c.items || []).some((it) => it.ref === id)) { c.items = c.items.filter((it) => it.ref !== id); await clsSave(c); }
  }
  toast('ลบแล้ว ' + ids.length + ' งาน', 1600); HWX.sel = null; HW.list = null; exRender();
}
/* a new closing time: quick choices or any date and time */
function hwExtPick(anchor, title, done) {
  const box = exEl('div', 'hwext'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', title);
  const p = exEl('div', 'hwextp', '<b></b>'); p.querySelector('b').textContent = title; box.appendChild(p);
  const toLocal = (t) => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const end = (days) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(23, 59, 0, 0); return d.getTime(); };
  const inp = document.createElement('input'); inp.type = 'datetime-local'; inp.value = toLocal(end(1));
  const Q = [[0, 'ถึงสิ้นวันนี้'], [1, 'ถึงพรุ่งนี้'], [3, 'อีก 3 วัน'], [7, 'อีก 1 สัปดาห์']];
  exChips(p, Q, () => false, (v) => { inp.value = toLocal(end(v)); });
  p.appendChild(inp);
  const r = exEl('div', 'row2'), ok = exEl('button', 'btn solid', 'ยืนยัน'), no = exEl('button', 'btn', 'ยกเลิก');
  ok.onclick = async () => { const t = Date.parse(inp.value); if (!isFinite(t) || t <= now()) { toast('เลือกเวลาในอนาคต', 1800); return; } ok.disabled = true; box.remove(); await done(t); };
  no.onclick = () => box.remove(); box.onclick = (e) => { if (e.target === box) box.remove(); };
  r.append(ok, no); p.appendChild(r); document.body.appendChild(box);
}
/* one piece of work: every learner in the class, handed in or not, on time or with more time, the score and each question */
async function hwBoardOne(body, a) {
  const A = a.data, s = hwState(a, null), L = 'กขคง';
  const back = exEl('button', 'btn', 'งานทั้งหมด'); back.onclick = () => { HWX.view = 'list'; exRender(); }; body.appendChild(back);
  const head = exEl('div', 'hwohead');
  head.innerHTML = '<div><h3></h3><small></small></div>';
  head.querySelector('h3').textContent = a.title;
  const c = A.clsId && CLS.list.find((x) => x.id === A.clsId);
  head.querySelector('small').textContent = [c ? classLabel(c) : 'ไม่ได้ผูกห้อง', (A.qs || []).length + ' ข้อ', hwLink(a.id)].join(' : ');
  body.appendChild(head);
  /* the closing time and what can change it */
  const due = exEl('div', 'hwodue');
  due.innerHTML = '<div>' + (s.due ? 'กำหนดส่ง <b>' + esc(hwWhen(s.due)) + '</b>' : '<b>ยังไม่ได้กำหนดเวลาส่ง</b> ตั้งไว้เพื่อให้ระบบปิดรับเอง') + ' ' + (s.st === 'shut' ? '<em class="hwc">ปิดรับแล้ว</em>' : s.st === 'closed' ? '<em class="hwc bad">ปิดรับอัตโนมัติแล้ว</em>' : s.st === 'ext' ? '<em class="hwc warn">ขยายทั้งห้องถึง ' + esc(hwWhen(s.until)) + '</em>' : s.due ? '<em class="hwc ok">เปิดรับ เหลือ ' + hwLeft(s.due - now()) + '</em>' : '') + '</div>';
  const dr = exEl('div', 'row2');
  const setDue = exEl('button', 'btn', s.due ? 'เปลี่ยนกำหนดส่ง' : 'ตั้งกำหนดส่ง'); setDue.onclick = () => hwExtPick(setDue, 'กำหนดส่งใหม่ (งานที่ส่งหลังเวลานี้นับว่าส่งช้า)', async (t) => { await CLOUD.client.from('assignments').update({ due: new Date(t).toISOString(), open: true }).eq('id', a.id); if (c) { const it = (c.items || []).find((x) => x.ref === a.id); if (it) { it.due = new Date(t).toISOString(); await clsSave(c); } } exRender(); });
  const extAll = exEl('button', 'btn', 'ขยายเวลาทั้งห้อง'); extAll.onclick = () => hwExtPick(extAll, 'ให้ทั้งห้องส่งเพิ่มได้ถึง (กำหนดส่งเดิมยังใช้ตัดสินว่าส่งช้า)', async (t) => { await CLOUD.client.from('assignments').update({ open: true, data: Object.assign({}, A, { ext: Object.assign({}, A.ext || {}, { all: new Date(t).toISOString() }) }) }).eq('id', a.id); exRender(); });
  const tog = exEl('button', 'btn', a.open ? 'ปิดรับตอนนี้' : 'เปิดรับอีกครั้ง'); tog.onclick = async () => { await CLOUD.client.from('assignments').update({ open: !a.open }).eq('id', a.id); exRender(); };
  dr.append(setDue, extAll, tog);
  if (A.ext && A.ext.all) { const x = exEl('button', 'btn', 'ยกเลิกการขยายทั้งห้อง'); x.onclick = async () => { const e = Object.assign({}, A.ext); delete e.all; await CLOUD.client.from('assignments').update({ data: Object.assign({}, A, { ext: e }) }).eq('id', a.id); exRender(); }; dr.appendChild(x); }
  due.appendChild(dr); body.appendChild(due);
  let subs; try { subs = await hwLoadSubs(a.id); } catch (e) { body.appendChild(exEl('div', 'note err', esc(hwSqlHint(e)))); return; }
  const allSubs = HW.all[a.id] || subs;
  const tries = (s0) => { const k = hwWhoKey(s0); return allSubs.filter((x) => hwWhoKey(x) === k); };
  /* one row per learner: the roster first, then anyone who handed in without being on it */
  const roster = c ? (c.roster || []).slice().sort((x, y) => x.no - y.no) : [];
  const byId = new Map(); for (const s0 of subs) { const sid = s0.data.stu && s0.data.stu.sid; if (sid) byId.set(String(sid), s0); }
  const ext = (A.ext && A.ext.stu) || {}, hx = {}; for (const r of roster) hx[r.sid] = await hashKey(A.clsId + '|id|' + String(r.sid).toLowerCase());
  const rows = roster.map((r) => ({ key: 'id:' + r.sid, r, s: byId.get(String(r.sid)) || null, ext: ext[hx[r.sid]] ? Date.parse(ext[hx[r.sid]]) : null }));
  for (const s0 of subs) { const sid = s0.data.stu && s0.data.stu.sid; if (sid && roster.some((r) => String(r.sid) === String(sid))) continue; rows.push({ key: hwWhoKey(s0), r: { name: s0.name, no: s0.data.stu ? s0.data.stu.no : '' }, s: s0, ext: null, extra: !!roster.length }); }
  const stat = (x) => { if (!x.s) return x.ext && x.ext > now() ? 'ext' : s.ok ? 'wait' : 'miss'; const sc = hwScore(a, x.s); return sc.checked < sc.n ? 'check' : 'done'; };
  for (const x of rows) { x.st = stat(x); x.late = x.s && s.due && Date.parse(x.s.created_at) > s.due; x.sc = x.s ? hwScore(a, x.s) : null; }
  const n = { all: rows.length, sent: rows.filter((x) => x.s).length, miss: rows.filter((x) => !x.s).length, check: rows.filter((x) => x.st === 'check').length, late: rows.filter((x) => x.late).length };
  const tiles = exEl('div', 'hwtiles');
  const T = [['all', n.all, roster.length ? 'คนในห้อง' : 'คนที่ส่ง', 'all'], ['sent', n.sent, 'ส่งแล้ว', 'ok'], ['miss', n.miss, 'ยังไม่ส่ง', 'bad'], ['check', n.check, 'รอตรวจ', 'todo'], ['late', n.late, 'ส่งหลังกำหนด', 'warn']];
  for (const [k, v, t, cl] of T) { if (!roster.length && k === 'miss') continue; const x = exEl('button', 'hwtile ' + cl, '<b>' + v + '</b><span>' + t + '</span>'); x.type = 'button'; x.setAttribute('aria-pressed', HWX.bfilter === k ? 'true' : 'false'); x.onclick = () => { HWX.bfilter = HWX.bfilter === k ? 'all' : k; exRender(); }; tiles.appendChild(x); }
  body.appendChild(tiles);
  if (roster.length) { const pct = Math.round(n.sent / Math.max(1, roster.length) * 100); body.appendChild(exEl('div', 'hwprog', '<i style="width:' + Math.min(100, pct) + '%"></i><span>ส่งแล้ว ' + n.sent + ' จาก ' + roster.length + ' คน (' + pct + '%)</span>')); }
  /* tools for the whole piece of work */
  const tools = exEl('div', 'row2');
  const needAI = subs.filter((x) => (x.data.files || []).length && !x.data.ai);
  const chk = exEl('button', 'btn solid', 'ตรวจวิธีทำและรูปด้วย AI (' + needAI.length + ' คน)'); chk.disabled = !needAI.length; chk.onclick = () => hwCheckAll(a, needAI); tools.appendChild(chk);
  const imp = exEl('button', 'btn', 'นำคะแนนเข้าสมุดคะแนน'); imp.onclick = () => hwImport(a, subs); tools.appendChild(imp);
  if (c) { const gb = exEl('button', 'btn', 'อัปเดตคะแนนเข้าห้อง ' + c.name); gb.onclick = async () => { const k = await clsSync(c); toast('อัปเดตคะแนน ' + k + ' คน', 1800); }; tools.appendChild(gb); }
  const pr = exEl('button', 'btn', 'พิมพ์กระดาษคำตอบ'); pr.onclick = () => openAnswerSheet(a); tools.appendChild(pr);
  const pe = exEl('button', 'btn', 'บันทึกงานกระดาษแทนผู้เรียน'); pe.onclick = () => hwPaperEntry(a, subs); tools.appendChild(pe);
  const cp = exEl('button', 'btn', 'คัดลอกลิงก์'); cp.onclick = () => navigator.clipboard && navigator.clipboard.writeText(hwLink(a.id)).then(() => toast('คัดลอกแล้ว', 1200)).catch(() => {}); tools.appendChild(cp);
  if (roster.length && n.miss) { const cm = exEl('button', 'btn', 'คัดลอกรายชื่อคนที่ยังไม่ส่ง'); cm.onclick = () => { const txt = 'ยังไม่ส่ง ' + a.title + (s.due ? ' (กำหนดส่ง ' + hwWhen(s.due) + ')' : '') + '\n' + rows.filter((x) => !x.s).map((x) => x.r.no + '. ' + x.r.name).join('\n') + '\nส่งได้ที่ ' + hwLink(a.id); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('คัดลอกแล้ว วางในกลุ่มแชตของห้องได้เลย', 2200)).catch(() => toast('คัดลอกไม่ได้ในเบราว์เซอร์นี้', 2000)); }; tools.appendChild(cm); }
  body.appendChild(tools);
  const msg = exEl('div', ''); msg.id = 'hwMsg'; body.appendChild(msg);
  /* the table */
  const bsel = HWX.bsel || (HWX.bsel = new Set());
  const vis = () => rows.filter((x) => HWX.bfilter === 'all' || (HWX.bfilter === 'sent' && x.s) || (HWX.bfilter === 'miss' && !x.s) || (HWX.bfilter === 'check' && x.st === 'check') || (HWX.bfilter === 'late' && x.late));
  const ms = mselBar(body, { sel: bsel, all: () => vis().map((x) => x.key), redraw: () => draw(), noun: 'คน', actions: [
    ['ให้ส่งเพิ่มได้', (keys, el) => { const who = rows.filter((x) => keys.includes(x.key) && x.r.sid != null); if (!who.length) { toast('ขยายเวลารายคนได้เฉพาะคนในรายชื่อห้อง', 2400); return; } hwExtPick(el, 'ให้ ' + who.length + ' คนส่งได้ถึง', async (t) => { const e = Object.assign({}, A.ext || {}), st0 = Object.assign({}, e.stu || {}); for (const x of who) st0[hx[x.r.sid]] = new Date(t).toISOString(); e.stu = st0; await CLOUD.client.from('assignments').update({ open: true, data: Object.assign({}, A, { ext: e }) }).eq('id', a.id); HWX.bsel = null; toast('ขยายเวลาให้ ' + who.length + ' คนแล้ว', 1800); exRender(); }); }],
    ['ยกเลิกการขยาย', async (keys) => { const e = Object.assign({}, A.ext || {}), st0 = Object.assign({}, e.stu || {}); for (const x of rows) if (keys.includes(x.key) && x.r.sid != null) delete st0[hx[x.r.sid]]; e.stu = st0; await CLOUD.client.from('assignments').update({ data: Object.assign({}, A, { ext: e }) }).eq('id', a.id); HWX.bsel = null; exRender(); }],
    ['ตรวจด้วย AI', (keys) => { const l = rows.filter((x) => keys.includes(x.key) && x.s && (x.s.data.files || []).length).map((x) => x.s); if (!l.length) { toast('คนที่เลือกไม่มีรูปหรือไฟล์ให้ตรวจ', 2000); return; } hwCheckAll(a, l); }],
    ['ลบงานที่ส่ง', (keys, el) => { const l = rows.filter((x) => keys.includes(x.key) && x.s); if (!l.length) { toast('คนที่เลือกยังไม่ได้ส่ง', 1800); return; } popMenu(el, 'ลบงานที่ส่งของ ' + l.length + ' คน ทุกฉบับ ย้อนกลับไม่ได้', [['ลบเลย', async () => { for (const x of l) for (const t0 of tries(x.s)) await CLOUD.client.from('submissions').delete().eq('id', t0.id); HWX.bsel = null; toast('ลบแล้ว', 1400); exRender(); }]]); }, true]
  ] });
  const wrap = exEl('div', 'gwrap'); body.appendChild(wrap);
  function draw() {
    const tb = exEl('table', 'extab grades hwtab');
    let h = '<thead><tr>' + (ms.on() ? '<th></th>' : '') + '<th>ผู้เรียน</th><th>สถานะ</th><th>ส่งเมื่อ</th><th>คะแนน</th><th>รายข้อ</th><th></th></tr></thead><tbody>';
    const list = vis();
    list.forEach((x, i) => {
      const t = x.s ? tries(x.s).length : 0;
      const stc = !x.s ? (x.ext && x.ext > now() ? '<em class="hwc warn">ขยายถึง ' + esc(hwWhen(x.ext)) + '</em>' : s.ok ? '<em class="hwc">ยังไม่ส่ง</em>' : '<em class="hwc bad">ไม่ได้ส่ง</em>') : x.late ? '<em class="hwc warn">ส่งหลังกำหนด</em>' : '<em class="hwc ok">ส่งตรงเวลา</em>';
      const sc = x.sc, dots = sc ? sc.res.map((r, k) => '<i class="' + (r.ok == null ? 'na' : r.ok >= 1 ? 'y' : r.ok > 0 ? 'p' : 'n') + (hwQm(A, r.q) === 'work' ? ' w' : '') + '" title="ข้อ ' + (k + 1) + '"></i>').join('') : '';
      h += '<tr data-i="' + i + '" class="' + (bsel.has(x.key) ? 'picked' : '') + '">' + (ms.on() ? '<td><span class="mtick" aria-hidden="true"></span></td>' : '') + '<td>' + esc((x.r.no ? x.r.no + '. ' : '') + x.r.name) + (x.extra ? ' <small>(ไม่อยู่ในรายชื่อ)</small>' : '') + '</td><td>' + stc + '</td><td>' + (x.s ? esc(new Date(x.s.created_at).toLocaleString(LOC, { dateStyle: 'short', timeStyle: 'short' })) + (t > 1 ? '<br><small>ส่ง ' + t + ' ครั้ง</small>' : '') : '-') + '</td><td class="' + (!sc ? '' : sc.checked < sc.n ? 'na' : sc.got / sc.n < 0.5 ? 'lo' : sc.got / sc.n >= 0.8 ? 'hi' : '') + '">' + (!sc ? '-' : sc.checked ? +sc.got.toFixed(1) + '/' + sc.n + (sc.checked < sc.n ? '<br><small>รอตรวจ ' + (sc.n - sc.checked) + ' ข้อ</small>' : '') : 'รอตรวจ') + '</td><td><span class="hwdots">' + dots + '</span></td><td>' + (x.s ? '<button class="btn sm" data-v="' + i + '">ดูงาน</button>' : '') + '</td></tr>';
    });
    tb.innerHTML = h + '</tbody>';
    tb.querySelectorAll('tr[data-i]').forEach((tr) => { tr.onclick = (e) => { const x = list[+tr.dataset.i]; if (ms.on()) { ms.toggle(x.key); return; } if (e.target.closest('button[data-v]') && x.s) hwDetail(a, x.s, list.filter((y) => y.s).map((y) => y.s)); }; });
    wrap.innerHTML = ''; wrap.appendChild(list.length ? tb : exEl('div', 'note small', 'ไม่มีใครในกลุ่มนี้'));
    ms.sync();
  }
  draw();
  if (!subs.length) return;
  /* each question across the class */
  const per = (A.qs || []).map((q) => { let k = 0, ok = 0; for (const s0 of subs) { const r = hwScore(a, s0).res.find((x) => x.q.id === q.id); if (r && r.ok != null) { k++; ok += r.ok; } } return { q, n: k, p: k ? ok / k : null }; });
  body.appendChild(exEl('h3', '', 'ภาพรวมรายข้อ'));
  const pt = exEl('div', 'exper');
  per.forEach((x, i) => pt.appendChild(exEl('div', '', '<span>ข้อ ' + (i + 1) + ' <em class="hwmode ' + hwQm(A, x.q) + '">' + (hwQm(A, x.q) === 'work' ? 'วิธีทำ' : 'เลือกตอบ') + '</em>' + (hwKeyFor(a, x.q) != null ? ' <em class="lkey">ตอบ ' + L[hwKeyFor(a, x.q)] + '</em>' : '') + ' <small>' + esc(String(x.q.q).replace(/\$[^$]*\$/g, '…').slice(0, 50)) + '</small></span><i><s style="width:' + Math.round((x.p || 0) * 100) + '%"></s></i><b>' + (x.p == null ? '-' : Math.round(x.p * 100) + '%') + '</b>')));
  body.appendChild(pt);
  const hard = per.filter((x) => x.p != null && x.p < 0.5);
  if (hard.length) body.appendChild(exEl('div', 'note advice', '<b>ควรสอนซ้ำ</b> ข้อ ' + hard.map((x) => per.indexOf(x) + 1).join(', ') + ' ผู้เรียนได้คะแนนไม่ถึงครึ่ง' + (hard[0].q.e ? ' เช่นข้อ ' + (per.indexOf(hard[0]) + 1) + ' ประเด็นสำคัญคือ ' + mdToHtml(hard[0].q.e) : '')));
  typeset(body);
}
const hwWhoKey = (s0) => (s0.data && s0.data.stu && s0.data.stu.sid) ? 'id:' + s0.data.stu.sid : 'n:' + String(s0.name || '').trim();
/* one learner's work: each question with its own working beside it, the marks the teacher can change, earlier hand-ins */
async function hwDetail(a, s, peers) {
  const box = $('#exBody'); box.innerHTML = ''; const L = 'กขคง', A = a.data;
  const top = exEl('div', 'row2');
  const back = exEl('button', 'btn', 'กลับไปรายชื่อ'); back.onclick = () => exRender(); top.appendChild(back);
  const i = (peers || []).indexOf(s);
  if (peers && peers.length > 1) { const pv = exEl('button', 'btn', 'คนก่อนหน้า'); pv.disabled = i <= 0; pv.onclick = () => hwDetail(a, peers[i - 1], peers); const nx = exEl('button', 'btn', 'คนถัดไป'); nx.disabled = i >= peers.length - 1; nx.onclick = () => hwDetail(a, peers[i + 1], peers); top.append(pv, nx); }
  box.appendChild(top);
  const sc = hwScore(a, s), due = a.due ? Date.parse(a.due) : null, late = due && Date.parse(s.created_at) > due;
  box.appendChild(exEl('div', 'exscore', '<b>' + +sc.got.toFixed(1) + '<small> / ' + sc.n + '</small></b><span>' + esc((s.data.stu ? 'เลขที่ ' + s.data.stu.no + ' ' : '') + s.name) + ' ส่งเมื่อ ' + esc(new Date(s.created_at).toLocaleString(LOC)) + (late ? ' <em class="hwc warn">หลังกำหนด</em>' : '') + (sc.checked < sc.n ? ' <em class="hwc">รอตรวจ ' + (sc.n - sc.checked) + ' ข้อ</em>' : '') + '</span>'));
  const all = (HW.all[a.id] || []).filter((x) => hwWhoKey(x) === hwWhoKey(s));
  if (all.length > 1) { const v = exEl('div', 'row2'); v.appendChild(exEl('span', 'label', 'ฉบับที่ส่ง')); all.forEach((x, k) => { const bt = exEl('button', 'btn sm' + (x.id === s.id ? ' solid' : ''), (k + 1) + '. ' + new Date(x.created_at).toLocaleString(LOC, { dateStyle: 'short', timeStyle: 'short' })); bt.onclick = () => hwDetail(a, x, peers); v.appendChild(bt); }); box.appendChild(v); }
  if (s.data.ai && s.data.ai.summary) box.appendChild(exEl('div', 'note advice', '<b>ความเห็นจาก AI</b> ' + mdToHtml(s.data.ai.summary)));
  const files = s.data.files || [], qf = s.data.qf || {}, inQ = new Set([].concat(...Object.values(qf)));
  const urls = {}; for (const p of files) { try { const { data } = await CLOUD.client.storage.from('burin-sub').createSignedUrl(p, 3600); if (data) urls[p] = data.signedUrl; } catch (e) { /* not readable */ } }
  const gallery = (paths) => { const g = exEl('div', 'hwfiles'); for (const p of paths) { const u = urls[p]; if (!u) continue; const an = exEl('a', '', /\.pdf$/i.test(p) ? '<span class="pdfchip">เปิดไฟล์ PDF</span>' : '<img alt="งานที่ส่ง" src="' + esc(u) + '">'); an.href = u; an.target = '_blank'; an.rel = 'noopener'; if (s.data.src && s.data.src[p] === 'page') an.appendChild(exEl('small', '', 'หน้าสมุด')); g.appendChild(an); } return g; };
  const rest = files.filter((p) => !inQ.has(p));
  if (rest.length) { box.appendChild(exEl('h3', '', 'งานที่แนบทั้งชุด')); box.appendChild(gallery(rest)); }
  if (files.length && !s.data.ai) { const b = exEl('button', 'btn solid', 'ให้ AI ตรวจงานนี้'); b.onclick = async () => { b.disabled = true; const wt = document.createElement('div'); b.after(wt); waitCard(wt, 'AI กำลังตรวจงานนี้', ['อ่านคำตอบและวิธีทำ', 'ให้คะแนนและคำแนะนำ'], { cancel: false }); try { await hwCheckOne(a, s); wt.remove(); hwDetail(a, s, peers); } catch (e) { wt.remove(); b.disabled = false; b.textContent = 'ให้ AI ตรวจงานนี้'; toast(aiErr(e), 4000); } }; box.appendChild(b); }
  const save = async (patch) => { s.data = Object.assign({}, s.data, patch); await CLOUD.client.from('submissions').update({ data: s.data }).eq('id', s.id); hwDetail(a, s, peers); };
  for (const r of sc.res) {
    const k = sc.res.indexOf(r), mode = hwQm(A, r.q), W = hwW(A, r.q), hasC = r.q.c && r.q.c.length >= 2;
    const d = exEl('div', 'exrev hwrev ' + mode, '<div class="hwqh"><b>ข้อ ' + (k + 1) + '</b><em class="hwmode ' + mode + '">' + (mode === 'work' ? 'แสดงวิธีทำ' : 'เลือกตอบ') + '</em><span class="hwqs">' + (r.ok == null ? 'รอตรวจ' : 'ได้ ' + +r.ok.toFixed(2)) + '</span></div><div class="exq">' + mdToHtml(r.q.q) + '</div>'
      + (hasC ? '<div class="note">ตอบ ' + (r.choice >= 0 ? L[r.choice] + '. ' + mdToHtml(r.q.c[r.choice] || '') : 'ไม่ได้เลือก') + (r.key != null ? ' เฉลย ' + L[r.key] : '') + (r.src ? ' (' + r.src + ')' : '') + '</div>' : '') + (r.note ? '<div class="note">' + mdToHtml(r.note) + '</div>' : ''));
    if (mode === 'work') {
      const mine = qf[r.q.id] || [];
      d.appendChild(mine.length ? gallery(mine) : exEl('div', 'note small', files.length ? 'ไม่ได้แนบวิธีทำแยกข้อนี้ ดูในงานที่แนบทั้งชุด' : 'ไม่ได้แนบวิธีทำ'));
      if (W) d.appendChild(exEl('div', 'note small', (hasC ? 'คำตอบ ' + (r.ans == null ? 'ยังไม่มีข้อมูล' : r.ans ? 'ถูก' : 'ผิด') + ' (' + Math.round((1 - W) * 100) + '%) ' : '') + 'วิธีทำ ' + (r.wk == null ? 'ยังไม่ได้ตรวจ' : r.wk >= 1 ? 'ครบ' : r.wk > 0 ? 'บางส่วน' : 'ไม่มีหรือผิด') + ' (' + Math.round(W * 100) + '%)'));
      const row = exEl('div', 'row2');
      for (const [v, t] of [[1, 'วิธีทำครบ'], [0.5, 'วิธีทำบางส่วน'], [0, 'ไม่มีวิธีทำหรือผิด']]) { const b = exEl('button', 'btn' + (r.wk === v ? ' solid' : ''), t); b.onclick = () => save({ manualWork: Object.assign({}, s.data.manualWork || {}, { [r.q.id]: v }) }); row.appendChild(b); }
      if (!hasC) for (const [v, t] of [[1, 'คำตอบถูก'], [0, 'คำตอบผิด']]) { const b = exEl('button', 'btn' + (r.ans === v ? ' solid' : ''), t); b.onclick = () => save({ manualAns: Object.assign({}, s.data.manualAns || {}, { [r.q.id]: v }) }); row.appendChild(b); }
      d.appendChild(row);
    } else {
      const row = exEl('div', 'row2');
      for (const [v, t] of [[1, 'ให้ถูก'], [0.5, 'ให้ครึ่งคะแนน'], [0, 'ให้ผิด']]) { const b = exEl('button', 'btn' + (s.data.manual && s.data.manual[r.q.id] === v ? ' solid' : ''), t); b.onclick = () => save({ manual: Object.assign({}, s.data.manual || {}, { [r.q.id]: v }) }); row.appendChild(b); }
      d.appendChild(row);
    }
    box.appendChild(d);
  }
  typeset(box);
}

