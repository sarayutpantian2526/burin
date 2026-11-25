/* BURIN part: account (loaded when first used) */
/* ---------- accounts for everyone (task 1.3): confirm the e-mail with the code it brings, send the code again, a new
   password through a code by e-mail, and deleting the account from inside the app (asked twice).
   The code typed in the app works in the app on the home screen of an iPad too, where a link in the e-mail would open in
   Safari instead (a link still works in the browser that opens it). Every answer says nothing about whether an address has
   an account. The sign-in form (#authSheet) is in the main file: this part shows its steps in #aStep and hides #aMain.
   "account" in flags.json turns it off: the form and the account sheet are as before ---------- */
const AC = { email: '', mode: '', wait: 0, tick: 0, done: false };
const acSay = (t, cls) => { const m = $('#aMsg'); m.innerHTML = t ? '<div class="note ' + (cls || '') + '">' + esc(t) + '</div>' : ''; return m.firstChild; };
/* the steps replace the e-mail and password; "back" shows the form again */
function acStep(html, mode) {
  AC.mode = mode || '';
  const st = $('#aStep'), main = $('#aMain');
  if (!html) { st.innerHTML = ''; st.hidden = true; main.hidden = false; $('#aPassRow').hidden = false; acSay(''); return null; }
  st.innerHTML = html; st.hidden = false; acSay(''); main.hidden = mode !== 'forgot'; $('#aPassRow').hidden = mode === 'forgot';
  const back = st.querySelector('.acback'); if (back) back.onclick = () => acStep('');
  return st;
}
/* the e-mail can be sent again a minute after the last one (what Supabase allows by default) */
function acCool(btn, label) {
  clearInterval(AC.tick);
  const draw = () => { const s = Math.ceil((AC.wait - Date.now()) / 1000); btn.disabled = s > 0; btn.textContent = s > 0 ? 'ส่งอีกครั้งได้ใน ' + s + ' วินาที' : label; if (s <= 0) clearInterval(AC.tick); };
  draw(); AC.tick = setInterval(() => { if (!btn.isConnected) { clearInterval(AC.tick); return; } draw(); }, 1000);
}
const acCode = (v) => String(v || '').replace(/[\s-]/g, '');
const acCodeOk = (v) => /^\d{6,10}$/.test(acCode(v));
function acSignedIn(t) { AC.done = true; acSay(t, 'ok'); setTimeout(() => location.reload(), 500); }

/* after signing up, or signing in to an address not confirmed yet: the code from the e-mail */
function acVerify(email, again) {
  AC.email = email;
  if (!again) AC.wait = Date.now() + 60e3;
  const st = acStep('<div class="note ok acsent"></div>'
    + '<label class="field"><span>รหัสยืนยันจากอีเมล</span><input id="acCode" inputmode="numeric" autocomplete="one-time-code" maxlength="12" spellcheck="false"></label>'
    + '<div class="row2"><button class="btn solid" type="button" id="acGo">ยืนยันอีเมล</button><button class="btn" type="button" id="acResend">ส่งรหัสอีกครั้ง</button></div>'
    + '<div class="note small">ถ้าในอีเมลมีปุ่มหรือลิงก์ยืนยัน กดในเครื่องนี้ได้เช่นกัน แล้วกลับมากดเข้าสู่ระบบ ไม่พบอีเมลให้ดูในกล่องจดหมายขยะ ถ้าเคยสมัครด้วยอีเมลนี้แล้ว กลับไปเข้าสู่ระบบด้วยรหัสผ่านเดิม หรือกด ลืมรหัสผ่าน</div>'
    + '<button class="btn acback" type="button">กลับไปหน้าเข้าสู่ระบบ</button>', 'verify');
  st.querySelector('.acsent').textContent = again ? 'อีเมล ' + email + ' ยังไม่ได้ยืนยัน ใส่รหัสจากอีเมลที่ได้รับ หรือกด ส่งรหัสอีกครั้ง' : 'สร้างบัญชีแล้ว ระบบส่งรหัสยืนยันไปที่ ' + email + ' เปิดอีเมลแล้วใส่รหัสตัวเลขด้านล่าง';
  const code = $('#acCode'), go = $('#acGo'), re = $('#acResend');
  acCool(re, 'ส่งรหัสอีกครั้ง');
  const run = async () => {
    if (!acCodeOk(code.value)) { acSay('ใส่รหัสตัวเลขจากอีเมลให้ครบ', 'err'); return; }
    go.disabled = true; acSay('กำลังยืนยันอีเมล');
    try {
      const sb = await cloudClient(), r = await sb.auth.verifyOtp({ email, token: acCode(code.value), type: 'email' });
      if (r.error) throw r.error;
      if (!(r.data && r.data.session)) { acStep(''); $('#aEmail').value = email; acSay('ยืนยันอีเมลแล้ว ใส่รหัสผ่านแล้วกดเข้าสู่ระบบ', 'ok'); return; }
      acSignedIn('ยืนยันอีเมลแล้ว กำลังโหลดสมุดจากคลาวด์');
    } catch (e) { acSay(authErr(e), 'err'); } finally { go.disabled = AC.done; }
  };
  go.onclick = run;
  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  re.onclick = async () => {
    re.disabled = true; acSay('กำลังส่งรหัสอีกครั้ง');
    try {
      const sb = await cloudClient(), cap = await capToken();
      const r = await sb.auth.resend({ type: 'signup', email, options: cap ? { captchaToken: cap } : undefined });
      if (r.error) throw r.error;
      AC.wait = Date.now() + 60e3; acSay('ส่งรหัสใหม่ไปที่ ' + email + ' แล้ว ใช้รหัสล่าสุดเท่านั้น', 'ok');
    } catch (e) { acSay(authErr(e), 'err'); }
    acCool(re, 'ส่งรหัสอีกครั้ง');
  };
  setTimeout(() => code.focus({ preventScroll: true }), 60);
}

/* forgot the password: a code by e-mail, then the new password here */
function acForgot() {
  const st = acStep('<div class="note">ใส่อีเมลของบัญชีด้านบน แล้วกดส่งรหัส ระบบจะส่งรหัสสำหรับตั้งรหัสผ่านใหม่ไปที่อีเมลนั้น</div>'
    + '<div class="row2"><button class="btn solid" type="button" id="acSend">ส่งรหัสตั้งรหัสผ่านใหม่</button></div>'
    + '<div id="acReset" hidden>'
    + '<label class="field"><span>รหัสจากอีเมล</span><input id="acRCode" inputmode="numeric" autocomplete="one-time-code" maxlength="12" spellcheck="false"></label>'
    + '<label class="field"><span>รหัสผ่านใหม่ อย่างน้อย 8 ตัว</span><input id="acRPass" type="password" autocomplete="new-password"></label>'
    + '<div class="row2"><button class="btn solid" type="button" id="acRGo">ตั้งรหัสผ่านใหม่</button></div></div>'
    + '<button class="btn acback" type="button">กลับไปหน้าเข้าสู่ระบบ</button>', 'forgot');
  const send = $('#acSend'), box = $('#acReset'), code = $('#acRCode'), pass = $('#acRPass'), go = $('#acRGo');
  let verified = false;
  if (AC.wait > Date.now() && AC.email) acCool(send, 'ส่งรหัสอีกครั้ง');
  send.onclick = async () => {
    const email = $('#aEmail').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { acSay('ใส่อีเมลให้ถูกต้อง', 'err'); return; }
    send.disabled = true; acSay('กำลังส่งรหัส');
    try {
      const sb = await cloudClient(), cap = await capToken();
      const o = { redirectTo: location.origin + location.pathname }; if (cap) o.captchaToken = cap;
      const r = await sb.auth.resetPasswordForEmail(email, o);
      if (r.error) throw r.error;
      AC.email = email; AC.wait = Date.now() + 60e3; verified = false; box.hidden = false;
      acSay('ถ้าอีเมล ' + email + ' มีบัญชี ระบบส่งรหัสไปแล้ว ใส่รหัสจากอีเมลและรหัสผ่านใหม่ด้านบน', 'ok');
      setTimeout(() => code.focus({ preventScroll: true }), 60);
    } catch (e) { acSay(authErr(e), 'err'); }
    acCool(send, 'ส่งรหัสอีกครั้ง');
  };
  const run = async () => {
    if (!verified && !acCodeOk(code.value)) { acSay('ใส่รหัสตัวเลขจากอีเมลให้ครบ', 'err'); return; }
    if (pass.value.length < 8) { acSay('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว', 'err'); return; }
    go.disabled = true; acSay('กำลังตั้งรหัสผ่านใหม่');
    try {
      const sb = await cloudClient();
      if (!verified) {
        const v = await sb.auth.verifyOtp({ email: AC.email, token: acCode(code.value), type: 'recovery' });
        if (v.error) throw v.error;
        verified = true; code.disabled = true;
      }
      const u = await sb.auth.updateUser({ password: pass.value });
      if (u.error) throw u.error;
      acSignedIn('ตั้งรหัสผ่านใหม่แล้ว กำลังเข้าสู่ระบบ');
    } catch (e) { acSay(authErr(e), 'err'); } finally { go.disabled = AC.done; }
  };
  go.onclick = run;
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
}

/* opened from the link in the e-mail (in the browser that opened it): signed in already, only the new password */
function acNewPw() {
  closeSheets(); $('#authSheet').hidden = false; acSay('');
  const st = acStep('<div class="note">ตั้งรหัสผ่านใหม่ของบัญชี ' + esc((CLOUD.user && CLOUD.user.email) || '') + '</div>'
    + '<label class="field"><span>รหัสผ่านใหม่ อย่างน้อย 8 ตัว</span><input id="acNPass" type="password" autocomplete="new-password"></label>'
    + '<div class="row2"><button class="btn solid" type="button" id="acNGo">ตั้งรหัสผ่านใหม่</button><button class="btn" type="button" id="acNNo">ไว้ทีหลัง</button></div>', 'newpw');
  $('#aMain').hidden = true;
  const pass = $('#acNPass'), go = $('#acNGo');
  $('#acNNo').onclick = () => { acStep(''); $('#authSheet').hidden = true; };
  const run = async () => {
    if (pass.value.length < 8) { acSay('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว', 'err'); return; }
    go.disabled = true; acSay('กำลังตั้งรหัสผ่านใหม่');
    try {
      const u = await (await cloudClient()).auth.updateUser({ password: pass.value });
      if (u.error) throw u.error;
      acStep(''); $('#authSheet').hidden = true; toast('ตั้งรหัสผ่านใหม่แล้ว ใช้รหัสนี้เข้าระบบในเครื่องอื่น', 4000);
    } catch (e) { acSay(authErr(e), 'err'); go.disabled = false; }
  };
  go.onclick = run;
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  setTimeout(() => pass.focus({ preventScroll: true }), 60);
  return st;
}

/* ----- delete the account: everything of it leaves the cloud for good. Version 2 of the database only
   (delete_my_account); the files go first through the storage service, which the database cannot do ----- */
async function acFiles(sb, bucket, root) {
  const out = [];
  const walk = async (dir) => {
    for (let off = 0; ; off += 1000) {
      const { data: L, error } = await sb.storage.from(bucket).list(dir, { limit: 1000, offset: off });
      if (error) throw error;
      for (const f of L || []) {
        if (!f || !f.name) continue;
        if (f.id == null && !f.metadata) await walk(dir + '/' + f.name); else out.push(dir + '/' + f.name);
      }
      if (!L || L.length < 1000) break;
    }
  };
  await walk(root);
  return out;
}
async function acDropFiles(sb, me, say) {
  const mine = await acFiles(sb, 'burin', me);
  const hw = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from('assignments').select('id').eq('owner', me).range(from, from + 499);
    if (error) throw error;
    hw.push(...(data || []).map((r) => r.id)); if (!data || data.length < 500) break;
  }
  const sub = [];
  for (const id of hw) sub.push(...(await acFiles(sb, 'burin-sub', id)));
  const all = mine.length + sub.length; let n = 0;
  for (const [bucket, list] of [['burin', mine], ['burin-sub', sub]]) {
    for (let i = 0; i < list.length; i += 100) {
      const part = list.slice(i, i + 100);
      const { error } = await sb.storage.from(bucket).remove(part);
      if (error) throw error;
      n += part.length; say && say('กำลังลบไฟล์ของบัญชี ' + n.toLocaleString(LOC) + ' จาก ' + all.toLocaleString(LOC) + ' ไฟล์');
    }
  }
  return mine.map((p) => p.split('/').pop());
}
/* what this device kept for the account: its copy of the notebooks, the queues, the pictures, the AI key */
async function acForget(me, email, pics) {
  try { for (const [k] of await IDB.all('docs')) if (typeof k === 'string' && k.startsWith('cloud:' + me + ':')) await IDB.del('docs', k); } catch (e) { /* no cache */ }
  for (const id of pics || []) { try { await IDB.del('blobs', id); } catch (e) { /* not kept here */ } }
  for (const k of ['tp-cq-' + me, 'tp-uq-' + me, 'tp-migrated-' + me]) store_ls.del(k);
  const l = acctList().filter((x) => x !== email); store_ls.set('tp-accts', JSON.stringify(l));
  if (AI.cfg && AI.cfg.owner === me) { AI.cfg.key = { vendor: 'gemini', url: '', model: '', key: '' }; AI.cfg.owner = ''; try { AI.save(true); } catch (e) { /* kept as it was */ } }
}
async function acDelete(say) {
  const sb = CLOUD.client, me = CLOUD.user && CLOUD.user.id, email = (CLOUD.user && CLOUD.user.email) || '';
  if (!sb || !me) throw new Error('signin');
  try { saveMine.flush(); savePage.flush(); } catch (e) { /* nothing open */ }
  try { if (S.store && S.store.flush) await S.store.flush(); } catch (e) { /* goes anyway */ }
  say('กำลังลบไฟล์ของบัญชี');
  let pics = await acDropFiles(sb, me, say);
  say('กำลังลบบัญชี');
  let r = await sb.rpc('delete_my_account');
  if (!r.error && r.data === 'files') { pics = pics.concat(await acDropFiles(sb, me, say)); r = await sb.rpc('delete_my_account'); }
  if (r.error) throw r.error;
  if (r.data !== 'deleted') throw new Error(r.data === 'files' ? 'files' : String(r.data || 'not deleted'));
  await acForget(me, email, pics);
  try { await sb.auth.signOut({ scope: 'local' }); } catch (e) { /* the account is gone already */ }
  store_ls.set('tp-acct-gone', email || '1');
  CLOUD.state = 'off';
  setTimeout(() => location.reload(), 300);
  return true;
}
/* the section at the end of the account sheet, and the two questions */
function acDelSection(box) {
  const sb = CLOUD.client;
  if (!sb || !CLOUD.user) return;
  dbVersion(sb, 3000).then((v) => {
    if (v < 2 || !box.isConnected) return;
    box.hidden = false;
    box.innerHTML = '<h3>ลบบัญชี</h3><div class="note small">ลบบัญชีนี้และทุกอย่างของบัญชีออกจากคลาวด์ถาวร กู้คืนไม่ได้</div><div class="row2"><button class="btn danger" type="button" id="acDel">ลบบัญชีนี้</button></div><div id="acDelBox"></div>';
    $('#acDel').onclick = () => acDelAsk(box);
  });
}
function acDelAsk(box) {
  const em = (CLOUD.user && CLOUD.user.email) || '', d = box.querySelector('#acDelBox');
  box.querySelector('#acDel').hidden = true;
  d.innerHTML = '<div class="note warn"><b>ลบบัญชีแล้วสิ่งเหล่านี้หายถาวร กู้คืนไม่ได้</b><br>สมุดทุกเล่ม หน้า และเส้นหมึก รูปและวิดีโอ เลคเชอร์ที่แชร์ (ลิงก์ที่ส่งให้คนอื่นจะเปิดไม่ได้) การบ้านที่สั่ง งานที่นักเรียนส่ง และสมุดคะแนน การตั้งค่าและการเชื่อมต่อ AI ของบัญชี ทุกเครื่องที่เข้าระบบด้วยบัญชีนี้จะออกจากระบบ</div>'
    + '<div class="note small">ถ้าอยากเก็บไว้ ส่งออกทั้งบัญชีเป็นไฟล์ก่อน แล้วนำเข้าในบัญชีใหม่หรือเครื่องอื่นได้ภายหลัง</div>'
    + '<div class="row2"><button class="btn" type="button" id="acExp">ส่งออกทั้งบัญชีก่อน</button><button class="btn danger" type="button" id="acNext">ไปต่อ</button><button class="btn solid" type="button" id="acNo">ไม่ลบ</button></div><div id="acDelMsg"></div>';
  const msg = d.querySelector('#acDelMsg');
  const say = (t, cls) => { msg.innerHTML = '<div class="note ' + (cls || '') + '"></div>'; msg.firstChild.textContent = t; return msg.firstChild; };
  const no = () => { d.innerHTML = ''; box.querySelector('#acDel').hidden = false; };
  d.querySelector('#acNo').onclick = no;
  const ex = d.querySelector('#acExp');
  if (!flagOn('export')) ex.hidden = true;
  ex.onclick = () => { ex.disabled = true; need('export').then(() => expSave(say)).catch(() => say('ส่งออกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่', 'err')).then(() => { ex.disabled = false; }); };
  d.querySelector('#acNext').onclick = () => {
    /* the second question: the e-mail typed again, then one more button */
    d.innerHTML = '<label class="field"><span>พิมพ์อีเมลของบัญชีนี้เพื่อยืนยันว่าจะลบ</span><input id="acDelEm" type="email" inputmode="email" autocomplete="off" spellcheck="false" autocapitalize="off"></label>'
      + '<div class="row2"><button class="btn danger" type="button" id="acDelGo" disabled>ลบบัญชีถาวร</button><button class="btn solid" type="button" id="acNo2">ไม่ลบ</button></div><div id="acDelMsg"></div>';
    const inp = d.querySelector('#acDelEm'), go = d.querySelector('#acDelGo'), m2 = d.querySelector('#acDelMsg');
    const say2 = (t, cls) => { m2.innerHTML = '<div class="note ' + (cls || '') + '"></div>'; m2.firstChild.textContent = t; return m2.firstChild; };
    const same = () => inp.value.trim().toLowerCase() === em.toLowerCase() && !!em;
    inp.addEventListener('input', () => { go.disabled = !same(); });
    d.querySelector('#acNo2').onclick = no;
    go.onclick = async () => {
      if (!same()) return;
      go.disabled = true; inp.disabled = true; d.querySelector('#acNo2').disabled = true;
      try { await acDelete(say2); say2('ลบบัญชีแล้ว กำลังกลับไปหน้าเริ่มต้น', 'ok'); }
      catch (e) {
        const t = String((e && e.message) || e);
        say2(/files/.test(t) ? 'ลบไฟล์ของบัญชียังไม่ครบ บัญชียังอยู่ กดลบอีกครั้ง' : /fetch|network|load failed|offline/i.test(t) ? 'ต่อคลาวด์ไม่ได้ บัญชียังอยู่ ตรวจอินเทอร์เน็ตแล้วลองใหม่' : 'ลบบัญชีไม่สำเร็จ บัญชียังอยู่ ลองใหม่อีกครั้ง (' + t.slice(0, 80) + ')', 'err');
        go.disabled = false; inp.disabled = false; d.querySelector('#acNo2').disabled = false;
      }
    };
    setTimeout(() => inp.focus({ preventScroll: true }), 60);
  };
}

/* ----- devices of the account (task 4.2): every sign-in from the database (my_devices), and signing one out
   (device_remove), which takes it off at once; its notebooks on that device are not touched ----- */
function devAgent(ua) {
  ua = String(ua || '');
  if (/iPad/.test(ua)) return 'iPad'; if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'โทรศัพท์ Android' : 'แท็บเล็ต Android';
  if (/CrOS/.test(ua)) return 'Chromebook'; if (/Windows/.test(ua)) return 'คอมพิวเตอร์ Windows';
  if (/Macintosh/.test(ua)) return 'Mac หรือ iPad'; if (/Linux/.test(ua)) return 'คอมพิวเตอร์ Linux';
  return 'อุปกรณ์';
}
async function devRows() {
  const { data, error } = await CLOUD.client.rpc('my_devices');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
/* one row per device; the others have a button that signs them out (touched twice) */
function devDraw(box, rows, after) {
  box.innerHTML = '';
  for (const r of rows) {
    const row = exEl('div', ''), mine = !!r.me;
    row.innerHTML = '<span><b></b><small></small></span>' + (mine ? '<span class="me">เครื่องนี้</span>' : '');
    row.querySelector('b').textContent = (mine ? devName() : String(r.name || '').slice(0, 40)) || devAgent(r.agent);
    const at = Date.parse(r.active || r.made || '');
    row.querySelector('small').innerHTML = (isFinite(at) ? 'ใช้ล่าสุด <span class="nw">' + esc(new Date(at).toLocaleString(LOC, { dateStyle: 'medium', timeStyle: 'short' })) + '</span>' : '')
      + (r.screen ? ' : จอแสดงอย่างเดียว ไม่นับ' : !r.seat ? (mine ? ' : รอที่ว่าง' : ' : ไม่ได้ใช้นาน ไม่นับ') : '');
    if (!mine) {
      const x = exEl('button', 'btn', 'ออกจากระบบเครื่องนั้น'); let armed = false;
      x.onclick = async () => {
        if (!armed) { armed = true; x.textContent = 'แตะอีกครั้งเพื่อยืนยัน'; return; }
        x.disabled = true;
        try { const { data, error } = await CLOUD.client.rpc('device_remove', { p_session: r.session }); if (error) throw error; if (data === 'ok' || data === 'none') { row.remove(); if (after) after(); } }
        catch (e) { x.disabled = false; armed = false; x.textContent = 'ออกจากระบบเครื่องนั้น'; toast('ยังเอาเครื่องออกไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง', 3500); }
      };
      row.appendChild(x);
    }
    box.appendChild(row);
  }
}
/* in the sheet of the account */
function devList(dl) {
  const head = exEl('div', 'note small', ''); dl.parentNode.insertBefore(head, dl);
  const load = () => devRows().then((rows) => {
    const used = rows.filter((r) => r.seat).length;
    head.textContent = 'ใช้ ' + used + ' จาก ' + DEVS.max + ' เครื่อง จอที่แสดงอย่างเดียวและจอแสดงผลของห้องไม่นับ เครื่องที่ออกจากระบบแล้ว สมุดในเครื่องนั้นไม่หาย';
    devDraw(dl, rows, load);
  }).catch(() => { head.textContent = 'ดูรายการเครื่องไม่ได้ตอนนี้ ตรวจอินเทอร์เน็ตแล้วเปิดแผ่นนี้อีกครั้ง'; });
  load();
}
/* this device has no seat: the account already uses all of them, or another device signed this one out */
function devFullOpen() {
  let sh = $('#devSheet');
  if (!sh) {
    sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'devSheet';
    sh.innerHTML = '<div class="panel" role="dialog" aria-labelledby="devHead"><h2 id="devHead"></h2><div class="note" id="devSay"></div><div class="devlist" id="devRows"></div>'
      + '<div class="row2"><button class="btn solid" type="button" id="devOut"></button></div></div>';
    document.body.appendChild(sh);
  }
  sh.hidden = false;
  const gone = DEVS.state === 'gone', n = DEVS.max;
  $('#devHead').textContent = gone ? 'เครื่องนี้ออกจากระบบแล้ว' : 'บัญชีนี้ใช้ครบ ' + n + ' เครื่องแล้ว';
  $('#devSay').textContent = gone
    ? 'เครื่องอื่นของบัญชีนี้ให้เครื่องนี้ออกจากระบบ สมุดในเครื่องนี้ยังอยู่ เข้าระบบอีกครั้งเพื่อใช้ต่อ'
    : 'บัญชีหนึ่งใช้ได้พร้อมกัน ' + n + ' เครื่อง เลือกเครื่องที่ไม่ได้ใช้แล้วให้ออกจากระบบ เครื่องนี้จะใช้ได้ทันที สมุดในเครื่องนั้นไม่หาย ถ้าจะใช้เครื่องนั้นอีก เข้าระบบใหม่ที่เครื่องนั้น';
  const out = $('#devOut'); out.textContent = gone ? 'เข้าระบบอีกครั้ง' : 'ออกจากระบบเครื่องนี้';
  out.onclick = () => acctSwitch(gone ? (CLOUD.user && CLOUD.user.email) || '' : null);
  const list = $('#devRows'); list.hidden = gone; list.innerHTML = '';
  if (gone) return;
  const load = () => devRows().then((rows) => {
    devDraw(list, rows, async () => {
      /* a seat may be free now: this device asks again, and opens the account's notebooks when it has one */
      await devHello(CLOUD.client);
      if (!devWaits()) { $('#devSay').textContent = 'เครื่องนี้ใช้ได้แล้ว กำลังเปิดสมุด'; setTimeout(() => location.reload(), 400); } else load();
    });
  }).catch(() => { $('#devSay').textContent = 'ดูรายการเครื่องไม่ได้ตอนนี้ ตรวจอินเทอร์เน็ตแล้วลองเปิดแอปอีกครั้ง'; });
  load();
}

