/* BURIN part: cmds (loaded when first used) */
/* ---------- finding a command by name (task 2.5): the search box of the menu also lists the app's own commands, so a
   button that sits in a group or in a sheet is found by typing a word of it (for example PDF, สามมิติ, ห้องสด).
   The app does this itself, with no AI: the list is read from the buttons on screen (their names, as translated for the
   language in use, and the short line that explains each), plus a few other words people use for the same thing.
   A command found is run the way its button runs, so nothing new happens behind it ---------- */
/* other words for a command, by the id of its button (both Thai and English, whatever the language of the app) */
const CMD_WORDS = {
  bExport: 'pdf ไฟล์ พิมพ์ แบ่งปัน ส่ง export print share',
  bLive: 'สด ถ่ายทอด ห้องสด live class',
  bViewer: 'จอใหญ่ โปรเจกเตอร์ ทีวี จอที่สอง present projector',
  bExam: 'คะแนน การบ้าน แบบฝึก สอบ ข้อสอบ คลัง grades homework exam',
  bConvert: 'ลายมือ ตัวอักษร ocr handwriting',
  bAI: 'ai โจทย์ แบบฝึกหัด quiz',
  bTray: 'โจทย์ quiz',
  bFull: 'เต็มจอ fullscreen',
  bNewPage: 'หน้าใหม่ new page',
  bPages: 'สารบัญ ที่คั่นหน้า ภาพหน้า pages contents bookmark',
  bInsert: 'รูป วิดีโอ กราฟ insert',
  bScan: 'qr คิวอาร์ กล้อง',
  bJoin: 'รหัสห้อง join',
  bMyWorkTop: 'การบ้าน homework',
  iSim: 'สามมิติ 3d แบบจำลอง simulation',
  iGraph: 'กราฟ graph สมการ',
  iPdf: 'pdf สไลด์',
  iImg: 'รูป ภาพ กล้อง photo image',
  iCalc: 'คำนวณ calculator',
  iStk: 'สติกเกอร์ sticker',
  iRec: 'การทดลอง lab',
  shape: 'สามมิติ 3d ออร์บิทัล วงกลม สี่เหลี่ยม เส้นตรง shape',
  laser: 'ชี้ pointer',
  lasso: 'เลือก select',
  text: 'พิมพ์ กล่องข้อความ text',
  keepSet: 'สำรอง นำคืน ไฟล์สำรอง backup restore',
  expSet: 'สำรอง ส่งออกทั้งบัญชี นำเข้า ย้ายเครื่อง backup export import'
};
/* parts of the settings that are filled in only when the settings are opened: whether they will be there */
const CMD_LATER = {
  keepSet: () => flagOn('keep') && !!S.store && (S.store.kind === 'local' || S.store.kind === 'cloud') && !(window.claude && window.claude.use),
  expSet: () => flagOn('export') && !!S.store && S.store.kind === 'cloud' && !S.student && !S.present && !S.show && !(window.claude && window.claude.use)
};
function cmdNorm(s) {
  let t = String(s || '');
  try { t = t.normalize('NFKC'); } catch (e) { /* old engine */ }
  return t.replace(/[​-‍﻿­]/g, '').replace(/\s+/g, '').toLowerCase();
}
function cmdSeen(b) { return !!b && !b.hidden && (b.classList.contains('ovf') || getComputedStyle(b).display !== 'none'); }
/* every command that can be used on this side now: what it is called, the line that explains it, where it is */
function cmdList() {
  const out = [], seen = new Set();
  const add = (key, label, desc, where, run, wk) => { label = String(label || '').trim(); if (!label || seen.has(key)) return; seen.add(key); out.push({ key, label, desc: String(desc || '').trim(), where, words: CMD_WORDS[wk || key] || '', run }); };
  /* the main bar and its groups */
  const skip = { bMenu: 1, bMore: 1, gMake: 1, gTeach: 1, bDiary: 1 };
  const grp = (b) => { const p = b.parentNode; return p && p.classList && p.classList.contains('tgpop') ? p : null; };
  const bar = [...document.querySelectorAll('.top button[id]')].concat([...document.querySelectorAll('.tgpop > button[id]')]);
  for (const b of bar) {
    if (skip[b.id] || !cmdSeen(b)) continue;
    const p = grp(b), gb = p ? $('#' + p.id.replace(/Pop$/, '')) : null;
    const where = gb ? (gb.getAttribute('aria-label') || '') : 'แถบบน';
    add(b.id, grpLabel(b), b.title && b.title !== grpLabel(b) ? b.title : '', where, () => {
      if (!p) { b.click(); return; }
      const near = gb && !gb.hidden && !gb.classList.contains('ovf') && gb.getBoundingClientRect().width ? gb : $('#bMore');
      grpRun(b, near);
    });
  }
  /* what the insert sheet puts on the page */
  for (const b of document.querySelectorAll('#insSheet .insb')) {
    if (!cmdSeen(b)) continue;
    const t = b.querySelector('b'), d = b.querySelector('span');
    add((b.id || '') + '|' + (t ? t.textContent : ''), t ? t.textContent : b.textContent, d ? d.textContent : '', 'แทรก', () => b.click(), b.id);
  }
  /* the writing tools */
  for (const b of document.querySelectorAll('#dock .tool[data-tool]')) {
    if (!cmdSeen(b)) continue;
    add(b.dataset.tool, b.getAttribute('aria-label'), '', 'แถบเครื่องมือ', () => b.click());
  }
  /* the parts of the menu and the headings of its settings */
  for (const b of document.querySelectorAll('#menuTabs button[data-m]')) {
    if (b.dataset.m === 'nb' || !cmdSeen(b)) continue;
    const l = b.querySelector('.lfull');
    add('m-' + b.dataset.m, l ? l.textContent : b.textContent, '', 'เมนู', () => menuTab(b.dataset.m));
  }
  for (const h of document.querySelectorAll('#menu [data-mp] h3')) {
    const pane = h.closest('[data-mp]'); if (!pane || pane.dataset.mp === 'nb') continue;
    let off = false, part = '';
    for (let e = h.parentElement; e && e !== pane; e = e.parentElement) { if (CMD_LATER[e.id]) { part = e.id; if (!CMD_LATER[e.id]()) off = true; break; } if (e.hidden) { off = true; break; } }
    if (off) continue;
    add('h-' + (part || h.textContent), h.textContent, '', 'เมนู', () => { menuTab(pane.dataset.mp); setTimeout(() => { if (h.scrollIntoView) h.scrollIntoView({ block: 'start' }); }, 30); }, part);
  }
  return out;
}
/* the commands that have every word typed, the ones whose name starts with it first */
function cmdFind(q, list) {
  const words = String(q || '').trim().split(/\s+/).map(cmdNorm).filter(Boolean);
  if (!words.length) return [];
  const hits = [];
  for (const c of list || cmdList()) {
    const name = cmdNorm(c.label), all = name + ' ' + cmdNorm(c.desc) + ' ' + cmdNorm(c.words);
    if (!words.every((w) => all.indexOf(w) >= 0)) continue;
    const r = name.indexOf(words[0]) === 0 ? 0 : words.every((w) => name.indexOf(w) >= 0) ? 1 : cmdNorm(c.words).indexOf(words[0]) >= 0 ? 2 : 3;
    hits.push([r, hits.length, c]);
  }
  return hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 8).map((x) => x[2]);
}
/* the commands found, at the top of the menu's search results; tapping one closes the menu and runs it */
function cmdShow(q, box) {
  box.innerHTML = '';
  const hits = cmdFind(q);
  if (!hits.length) { box.hidden = true; return; }
  box.hidden = false;
  const h = document.createElement('h3'); h.className = 'shelfh findh'; h.textContent = 'คำสั่ง'; box.appendChild(h);
  const list = document.createElement('div'); list.className = 'cmdlist'; list.setAttribute('role', 'list'); box.appendChild(list);
  for (const c of hits) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cmdhit'; b.setAttribute('role', 'listitem'); b.dataset.k = c.key;
    b.innerHTML = '<b></b><small></small>';
    b.querySelector('b').textContent = c.label;
    b.querySelector('small').textContent = c.where ? (c.desc ? c.where + ': ' + c.desc : c.where) : c.desc;
    b.onclick = () => cmdRun(c);
    list.appendChild(b);
  }
}
function cmdRun(c) {
  if (!c) return;
  const inMenu = /^(m-|h-)/.test(c.key);
  if (!inMenu) $('#menu').hidden = true;
  c.run();
}

