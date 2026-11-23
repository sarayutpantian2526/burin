/* BURIN part: cloudset (loaded when first used) */
/* ---------- the cloud settings (task 1.4): on a site whose config.js names a cloud project, that project is the
   default ("คลาวด์ BURIN") and a person's own Supabase is under an advanced heading. Going to one and back keeps every
   notebook: each project keeps its own notebooks, its own sign-in (cloudAuthKey in the main file) and its own queue of
   work not sent yet, so nothing is copied, moved or deleted by switching. The space the account uses is shown against
   its limit when the database can tell (my_usage, version 2 of setup.sql). The section is drawn in #cloudBox of the main
   file (#csBox, and the form #cloudCfg that was already there). "cloudset" in flags.json turns it off: as before ---------- */
const CS = { u: null, at: 0, busy: false, own: null };
const csHost = (u) => (/^https:\/\/([^/]+)/.exec(String(u || '')) || [])[1] || '';
const csCur = () => String(CLOUD.cfg.url || '').trim().replace(/\/+$/, '');
const csOnSite = () => !!CLOUD.cfg.site && csCur() === CLOUD.cfg.site.url;
/* the person's own project: the one in use, or the last one used on this device */
function csOwn() {
  if (!csOnSite()) return { url: csCur(), key: CLOUD.cfg.key };
  try { const o = JSON.parse(store_ls.get('tp-cloud-own') || 'null'); if (o && o.url && o.key) return { url: String(o.url), key: String(o.key) }; } catch (e) { /* none */ }
  return { url: '', key: '' };
}
/* 200 MB is 209715200 bytes; a number never parts from its unit at the end of a line */
function csSize(n) {
  n = Math.max(0, +n || 0);
  const [v, u, d] = n >= 1073741824 ? [n / 1073741824, 'GB', 2] : n >= 1048576 ? [n / 1048576, 'MB', 1] : [n / 1024, 'KB', 0];
  const t = v >= 100 ? String(Math.round(v)) : d ? v.toFixed(d).replace(/\.?0+$/, '') : v.toFixed(0);
  return (t === '0' && n > 0 ? '1' : t) + ' ' + u;
}
/* what the account uses: { used, docs, files, hw, quota } (quota null: no limit), or null when the database cannot tell */
async function csUsage(force) {
  if (!(CLOUD.state === 'on' && CLOUD.client && CLOUD.user)) return null;
  if (!force && CS.u && Date.now() - CS.at < 20e3) return CS.u;
  if ((await dbVersion(CLOUD.client, 3000)) < 2) return null;
  const r = await Promise.race([Promise.resolve(CLOUD.client.rpc('my_usage')), new Promise((res) => setTimeout(() => res(null), 8000))]).catch(() => null);
  const row = r && !r.error ? (Array.isArray(r.data) ? r.data[0] : r.data) : null;
  if (!row) return null;
  CS.u = { used: +row.used || 0, docs: +row.docs || 0, files: +row.files || 0, hw: +row.homework || 0, quota: row.quota == null ? null : +row.quota };
  CS.at = Date.now();
  return CS.u;
}
/* work of this account that has not gone up yet: it waits on this device and goes up when this cloud is used again */
function csLeft() {
  if (!S.store || S.store.kind !== 'cloud' || !CLOUD.user) return 0;
  let n = 0;
  try { n += S.store.pending ? S.store.pending() : 0; } catch (e) { /* none */ }
  try { const q = JSON.parse(store_ls.get('tp-uq-' + CLOUD.user.id) || '[]'); if (Array.isArray(q)) n += q.length; } catch (e) { /* none */ }
  return n;
}
function csStyle() {
  if ($('#csStyle')) return;
  const s = document.createElement('style'); s.id = 'csStyle';
  s.textContent = '#csBox { display: flex; flex-direction: column; gap: 10px; margin: 10px 0; }\n#csBox[hidden] { display: none; }\n'
    + '#csBox .csnow { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }\n'
    + '#csBox .csnow small, #csBox .csuse small { color: var(--muted); font-size: 12px; line-height: 1.6; }\n'
    + '#csBox .csuse { display: flex; flex-direction: column; gap: 6px; padding: 0 2px; }\n#csBox .csuse[hidden] { display: none; }\n'
    + '#csBox .cshead { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; font-size: 14px; }\n'
    + '#csBox .csbar { height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; }\n'
    + '#csBox .csbar i { display: block; height: 100%; width: 0; background: var(--accent); border-radius: 4px; }\n'
    + '#csBox .csbar.warn i { background: var(--warn); }\n#csBox .csbar.full i { background: var(--danger); }\n'
    + '#csBox .nw, #cloudCfg .nw { white-space: nowrap; }\n#csBox .csparts { display: flex; flex-wrap: wrap; gap: 2px 14px; }\n'
    + '#cloudCfg .cshint { margin-top: 2px; }\n#cloudBtns + #cloudDiag + #cloudCfg, #cloudBox #cloudCfg { margin-top: 10px; }';
  document.head.appendChild(s);
}
function csUseFill(el) {
  csUsage().then((u) => {
    if (!u || !el.isConnected) { el.hidden = true; return; }
    const q = u.quota, pc = q ? Math.min(100, (u.used / Math.max(1, q)) * 100) : 0, full = !!q && u.used >= q;
    el.hidden = false;
    el.innerHTML = '<div class="cshead"><b>พื้นที่ที่ใช้</b><span class="nw"></span></div>' + (q ? '<div class="csbar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div>' : '') + '<small class="csparts"></small>';
    el.querySelector('.cshead span').textContent = q ? csSize(u.used) + tr(' จาก ', ' of ') + csSize(q) : csSize(u.used) + tr(' ไม่จำกัดพื้นที่', ', no limit');
    if (q) {
      const bar = el.querySelector('.csbar'); bar.classList.toggle('warn', pc >= 90 && !full); bar.classList.toggle('full', full);
      bar.setAttribute('aria-valuenow', String(Math.round(pc))); bar.setAttribute('aria-label', 'ใช้พื้นที่ไป ' + Math.round(pc) + ' เปอร์เซ็นต์');
      bar.querySelector('i').style.width = Math.max(pc, u.used > 0 ? 1.5 : 0) + '%';
    }
    const parts = el.querySelector('.csparts');
    for (const [t, v] of [['สมุดและหน้า', u.docs], ['รูปและวิดีโอ', u.files], ['งานที่นักเรียนส่ง', u.hw]]) { if (t === 'งานที่นักเรียนส่ง' && !v) continue; const s = document.createElement('span'); s.className = 'nw'; s.textContent = t + ' ' + csSize(v); parts.appendChild(s); }
    if (q) { const s = document.createElement('span'); s.className = 'nw'; s.textContent = full ? tr('พื้นที่เต็มแล้ว', 'The space is full') : tr('เหลืออีก ', 'Left: ') + csSize(q - u.used); parts.appendChild(s); }
    if (full || pc >= 90) el.appendChild(exEl('div', 'note ' + (full ? 'err' : 'warn'), esc(full ? QUOTA_MSG : 'พื้นที่ใกล้เต็มแล้ว ลบสมุด รูป หรือวิดีโอที่ไม่ใช้ แล้วลบถาวรในถังขยะ เพื่อให้มีที่ว่าง')));
  }).catch(() => { el.hidden = true; });
}
function csRender() {
  const box = $('#csBox'), cfg = $('#cloudCfg'); if (!box || !cfg || !CLOUD.cfg.site) return;
  csStyle();
  const on = csOnSite(), st = CLOUD.state;
  box.hidden = false; box.innerHTML = '';
  const now = exEl('div', 'csnow', '<b></b><small></small>');
  now.querySelector('b').textContent = on ? 'ใช้คลาวด์ BURIN' : 'ใช้ Supabase ของตัวเอง';
  now.querySelector('small').textContent = on ? 'คลาวด์ที่มากับแอป ไม่ต้องตั้งค่าอะไรเพิ่ม' : 'โปรเจกต์ ' + csHost(csCur()) + ' สมุดบนคลาวด์ BURIN ยังอยู่ครบ กลับไปใช้ได้ทุกเมื่อ';
  box.appendChild(now);
  if (st === 'error') $('#cloudNote').textContent = on ? 'เชื่อมคลาวด์ BURIN ไม่สำเร็จ ตรวจการต่ออินเทอร์เน็ตแล้วกด ลองใหม่' : 'เชื่อม Supabase ของตัวเองไม่สำเร็จ ตรวจ Project URL และ key หรือการต่ออินเทอร์เน็ต หรือกลับไปใช้คลาวด์ BURIN';
  const use = exEl('div', 'csuse'); use.id = 'csUse'; use.hidden = true; box.appendChild(use);
  if (st === 'on') csUseFill(use);
  if (!on) {
    const row = exEl('div', 'row2'), b = document.createElement('button');
    b.type = 'button'; b.className = 'btn solid'; b.id = 'csBack'; b.textContent = 'กลับไปใช้คลาวด์ BURIN';
    b.onclick = () => csSwitch(CLOUD.cfg.site, b);
    row.appendChild(b); box.appendChild(row);
  }
  /* the form that was already there, now under an advanced heading, filled with the person's own project */
  cfg.hidden = false;
  const sm = cfg.querySelector('summary');
  sm.querySelector('b').textContent = 'ขั้นสูง: ใช้ Supabase ของตัวเอง';
  sm.querySelector('small').textContent = 'สำหรับผู้ที่ตั้งโปรเจกต์ Supabase เอง สมุดบนคลาวด์ BURIN ไม่หาย สลับกลับได้ทุกเมื่อ';
  if (!CS.own) { const o = csOwn(); CS.own = o; $('#cUrl').value = o.url; $('#cKey').value = o.key; }
  const save = $('#cSave');
  save.textContent = on ? 'สลับไปใช้ Supabase นี้' : 'บันทึกแล้วเชื่อมต่อใหม่';
  save.onclick = () => csSwitch({ url: $('#cUrl').value, key: $('#cKey').value }, save);
  if (!cfg.querySelector('.cshint')) {
    cfg.querySelector('.aibody').appendChild(exEl('div', 'note small cshint',
      'ใส่ Project URL และ Publishable key จาก Supabase (Project Settings, API Keys) แล้วรันไฟล์ setup.sql ในโปรเจกต์นั้นครั้งแรกครั้งเดียว '
      + 'ผู้เรียนที่เข้าห้องเรียนสด ส่งการบ้าน หรือเปิดเลคเชอร์ที่แชร์จากบัญชีบน Supabase ของตัวเอง ต้องตั้ง Supabase เดียวกันในเครื่องของตัวเองด้วย'));
  }
  if (!on && st === 'error') cfg.open = true;
}
/* go to another cloud: everything open is saved and sent first; work that cannot go up now (offline) stays on this
   device for this account and goes up when this cloud is used again, so the person is asked before going */
async function csSwitch(t, btn) {
  if (CS.busy) return false;
  const url = String((t && t.url) || '').trim().replace(/\/+$/, ''), key = String((t && t.key) || '').trim();
  if (!/^https:\/\/[^/\s]+$/.test(url) || key.length < 20) { toast('ใส่ Project URL ที่ขึ้นต้นด้วย https:// และ key ให้ครบ', 4000); return false; }
  const site = CLOUD.cfg.site, toSite = !!site && url === site.url;
  if (url === csCur() && (toSite || key === CLOUD.cfg.key)) { toast(toSite ? 'ใช้คลาวด์ BURIN อยู่แล้ว' : 'ใช้ Supabase นี้อยู่แล้ว', 2500); return false; }
  if (LIVE.code && LIVE.role === 'teacher') { toast('ปิดห้องเรียนสดก่อน แล้วจึงสลับคลาวด์', 4000); return false; }
  CS.busy = true;
  const FL = floatLine('กำลังบันทึกงานก่อนสลับคลาวด์');
  try {
    try { saveMine.flush(); savePage.flush(); } catch (e) { /* nothing open */ }
    try { if (S.store && S.store.flush) await Promise.race([S.store.flush(), new Promise((r) => setTimeout(r, 8000))]); } catch (e) { /* offline: it waits */ }
  } finally { FL(); }
  const go = () => {
    if (toSite) store_ls.del('tp-cloud');
    else { store_ls.set('tp-cloud-own', JSON.stringify({ url, key })); CLOUD.saveCfg(url, key); }
    toast(toSite ? 'กำลังกลับไปใช้คลาวด์ BURIN' : 'กำลังเชื่อมต่อ Supabase ของตัวเอง', 3000);
    setTimeout(() => location.reload(), 300);
  };
  const left = csLeft();
  CS.busy = false;
  if (left) {
    popMenu(btn || $('#cloudBox'), 'ยังมีงาน ' + left + ' รายการที่ยังไม่ขึ้นคลาวด์นี้ งานเก็บไว้ในเครื่องนี้ และขึ้นเองเมื่อกลับมาใช้คลาวด์นี้ด้วยบัญชีเดิม', [['สลับเลย', go], ['ยังไม่สลับ', () => {}]]);
    return false;
  }
  go();
  return true;
}

