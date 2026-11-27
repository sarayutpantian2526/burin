/* BURIN part: consent (loaded when first used) */
/* ---------- consent under Thailand's PDPA (task 1.10, the part m/consent.js, switched off with "consent" in flags.json).
   Three moments, each one only on the cloud that comes with the site (config.js) or, for the AI, wherever the AI is
   somebody else's:
     sign-up (pdSignAsk, called by doAuth before the account is made): the age band (20 and over, or under 20 with the
       name of the parent or guardian and their agreement), and agreement to the terms of use and the privacy policy.
       The record goes with the sign-up itself (user_metadata.consent { v, at, age, guardian, by }), so the server
       keeps which version was agreed to and when.
     an account that has not agreed to this version yet (pdLoginAsk, a few seconds after the app opens): the same
       questions in a sheet; agreeing writes user_metadata.consent with updateUser, the other way out is to sign out
       (the notebooks stay on the cloud). Offline, the answer waits on this device (tp-pd-q-<account>) and is sent the
       next time the app opens.
     the first use of an AI that is not on this computer (pdAIAsk, from AI.run in the main file): what is sent, to whom,
       and that it goes from this device straight to that provider; remembered on this device per provider (tp-aiok).
   The texts of the terms and of the policy are here (PD_PRIV, PD_TERMS) and open in a sheet of their own (pdDoc). They
   are a draft for the owner and a lawyer to check: PD_VER changes when they change, and every account is asked again.
   Who runs the service and how to reach them come from config.js (privacyOwner, privacyContact) ---------- */
const PD_VER = '20261125', PD_DATE = '25 พฤศจิกายน 2569';
const PD = { sign: null, form: null, keep: null };
const pdCfg = () => window.BURIN_CONFIG || {};
const pdOwner = () => String(pdCfg().privacyOwner || '').trim() || 'ผู้พัฒนา BURIN';
const pdContact = () => String(pdCfg().privacyContact || '').trim();
/* words the Thai dictionary of the browser cuts in two (loanwords, long titles): a word joiner (U+2060) between the
   pieces keeps each one whole on its line */
const PD_GLUE = ['ซิงก์', 'บอต', 'คลาวด์', 'พระราชบัญญัติ', 'เบราว์เซอร์', 'เซิร์ฟเวอร์', 'ไลบรารี', 'ฟอนต์', 'แชร์'];
let PD_GL = null;
function pdGlue(t) {
  if (PD_GL === null) {
    PD_GL = [];
    try {
      const sg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
      if (sg) for (const w of PD_GLUE) { const ps = Array.from(sg.segment(w), (x) => x.segment); if (ps.length > 1) PD_GL.push([w, ps.join('\u2060')]); }
    } catch (e) { PD_GL = []; }
  }
  for (const [w, g] of PD_GL) t = t.split(w).join(g);
  return t;
}
/* a number stays on one line with the word before and after it (30 วัน, พฤศจิกายน 2569) */
const pdKeep = (t) => pdGlue(String(t).replace(/(\d) /g, '$1 ').replace(/ (\d)/g, ' $1'));
/* a line breaks at its spaces; a number keeps its word (pdKeep first), and a run of Thai longer than a phone line
   (more than 16 letters without a space) is left to the browser, which breaks Thai between words */
function pdPh(t) { return pdKeep(t).split(/ (?!ๆ)/).map((w) => (w.length > 16 ? esc(w) : '<span class="nowrap">' + esc(w) + '</span>')).join(' '); }

const PD_PRIV = () => [
  ['ใครเป็นผู้ดูแลข้อมูล', [
    'BURIN ให้บริการโดย ' + pdOwner() + ' ในฐานะผู้ควบคุมข้อมูลส่วนบุคคลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 นโยบายนี้ใช้กับคลาวด์ BURIN ที่มากับเว็บนี้ สมุดที่เก็บในเครื่องอย่างเดียวและ Supabase ที่ผู้ใช้ตั้งเอง ข้อมูลไม่ได้มาถึงเรา']],
  ['ข้อมูลที่เราเก็บ', [
    'บัญชี: อีเมล และรหัสผ่านที่ถูกแปลงเป็นค่าที่ย้อนกลับไม่ได้โดยระบบบัญชี เราไม่เห็นรหัสผ่านของคุณ',
    'สิ่งที่คุณสร้าง: สมุด หน้า เส้นหมึก กล่องข้อความ รูป วิดีโอ PDF และไฟล์ที่คุณใส่ เลคเชอร์ที่แชร์ ห้องเรียน การบ้าน สมุดคะแนน และงานที่นักเรียนส่ง (ชื่อและรหัสนักเรียนที่ครูกำหนด คำตอบ และไฟล์ที่แนบ)',
    'การตั้งค่า: รวมคีย์ AI ถ้าคุณเชื่อมต่อ AI ไว้ คีย์นี้ซิงก์ไปเครื่องอื่นของบัญชีเดียวกัน และอ่านได้เฉพาะบัญชีของคุณ',
    'เครื่องที่เข้าระบบ: ชื่อและชนิดของเครื่อง และเวลาที่ใช้ล่าสุด เพื่อให้คุณเห็นและออกจากระบบได้ ระบบบัญชีบันทึกที่อยู่ IP และชนิดของเบราว์เซอร์ตอนเข้าระบบไว้ด้วย เพื่อความปลอดภัยของบัญชี',
    'การยอมรับนโยบาย: ฉบับที่ยอมรับ เวลาตามนาฬิกาของเซิร์ฟเวอร์ ช่วงอายุ และชื่อผู้ปกครองเมื่อผู้ใช้อายุต่ำกว่า 20 ปี เก็บเป็นประวัติที่ผู้ใช้แก้หรือลบเองไม่ได้ เพื่อเป็นหลักฐานว่ายอมรับฉบับใดเมื่อไร และถูกลบพร้อมบัญชี',
    'รายงานข้อผิดพลาด: ข้อความของข้อผิดพลาด ตำแหน่งในโค้ด รุ่นของเครื่องและเบราว์เซอร์ เวอร์ชันของแอป และตัวเลขสภาพหน้าจอ เช่น จำนวนหน้าและจำนวนเส้น ไม่มีชื่อ ข้อความ หรือเนื้อหาของสมุด',
    'เราไม่เก็บตำแหน่งที่อยู่ ไม่มีโฆษณา ไม่ใช้ตัวติดตามของบริษัทอื่น และไม่ขายข้อมูล']],
  ['เราใช้ข้อมูลทำอะไร', [
    'ให้บริการที่คุณขอตามข้อตกลงการใช้: เก็บและซิงก์สมุดข้ามเครื่อง ห้องเรียนสด การบ้าน และสมุดคะแนน',
    'ส่งรหัสยืนยันและรหัสตั้งรหัสผ่านใหม่ทางอีเมล',
    'กันบอตและการใช้ผิดวัตถุประสงค์ และแก้ข้อผิดพลาดของแอป ซึ่งเป็นประโยชน์โดยชอบด้วยกฎหมายของผู้ใช้ทุกคน',
    'เมื่อคุณซื้อแผนผ่าน App Store หรือ Google Play ร้านเป็นผู้ขายและรับเงิน เราได้รับเพียงว่าบัญชีนี้มีแผนใดถึงวันไหน ไม่ได้รับข้อมูลบัตรหรือการจ่ายเงิน']],
  ['AI', [
    'BURIN ไม่มี AI ของตัวเอง งานที่ใช้ AI ใช้บัญชี AI ที่คุณเชื่อมต่อเอง เมื่อคุณสั่ง แอปส่งเฉพาะส่วนที่งานนั้นต้องใช้ (เช่น ภาพลายมือที่เลือก หน้าที่เลือก หรือข้อความ) จากเครื่องของคุณไปยังผู้ให้บริการ AI นั้นโดยตรง ไม่ผ่านเซิร์ฟเวอร์ของเรา ผู้ให้บริการ AI ดูแลข้อมูลนั้นตามนโยบายของเขาเอง แอปจะบอกและถามก่อนส่งให้ผู้ให้บริการแต่ละรายครั้งแรก',
    'AI ที่รันในเครื่องของคุณเอง ข้อมูลไม่ออกจากเครื่องนั้น',
    'อย่าส่งข้อมูลส่วนบุคคลของผู้อื่นให้ AI ถ้าไม่จำเป็น เช่น ชื่อเต็มหรือเลขประจำตัวนักเรียน']],
  ['ผู้ที่ช่วยเราให้บริการ', [
    'Supabase: ฐานข้อมูล ระบบบัญชี และที่เก็บไฟล์ เซิร์ฟเวอร์อยู่ที่สิงคโปร์',
    'Resend: ส่งอีเมลรหัสยืนยัน',
    'Cloudflare Turnstile: ตรวจกันบอตตอนสมัครและเข้าระบบ',
    'GitHub Pages: ส่งไฟล์ของตัวแอปมาที่เบราว์เซอร์ ไม่ได้รับข้อมูลในสมุด',
    'jsDelivr, cdnjs และ Google Fonts: ส่งไลบรารีและฟอนต์ที่แอปใช้ เห็นที่อยู่ IP ของเครื่องเหมือนเว็บทั่วไป ไม่ได้รับข้อมูลในสมุด',
    'Wikimedia Commons, Openverse และ Crossref: ได้รับเฉพาะคำค้นเมื่อคุณสั่งค้นภาพหรือแหล่งอ้างอิง',
    'ผู้ให้บริการเหล่านี้อยู่นอกประเทศไทยบางส่วน เราเลือกผู้ให้บริการที่มีมาตรการคุ้มครองข้อมูลตามมาตรฐานสากล และให้ใช้ข้อมูลเฉพาะเพื่อให้บริการแก่เรา เราไม่เปิดเผยข้อมูลแก่ผู้อื่น เว้นแต่กฎหมายบังคับ']],
  ['ครู นักเรียน และห้องเรียน', [
    'ข้อมูลของนักเรียนในห้องเรียนของครู เช่น รายชื่อ รหัสนักเรียน คะแนน และงานที่ส่ง ครูเป็นผู้ตัดสินใจเก็บและใช้ตามหน้าที่สอน BURIN เก็บและประมวลผลแทนครู ครูควรเก็บเท่าที่จำเป็น และใช้รหัสนักเรียนแทนข้อมูลที่ไม่จำเป็น',
    'นักเรียนที่เข้าห้องด้วยรหัสห้องหรือ QR ไม่ต้องมีบัญชี งานที่ส่งเห็นได้เฉพาะครูเจ้าของงานและนักเรียนคนนั้น ครูห้องอื่นและผู้ใช้คนอื่นเห็นไม่ได้']],
  ['ผู้ใช้ที่อายุต่ำกว่า 20 ปี', [
    'ผู้ที่อายุต่ำกว่า 20 ปีและยังไม่บรรลุนิติภาวะ ต้องให้ผู้ปกครองอ่านนโยบายนี้และยินยอมก่อนสร้างบัญชี ถ้าอายุต่ำกว่า 10 ปี ผู้ปกครองต้องเป็นผู้สมัครและยินยอมเอง ผู้ปกครองขอดู แก้ไข หรือลบข้อมูลของผู้เยาว์ได้ตามช่องทางติดต่อด้านล่าง',
    'เราไม่ได้ตรวจเอกสารยืนยันอายุ เราใช้คำตอบที่ผู้ใช้และผู้ปกครองให้ไว้ตอนสร้างบัญชี ถ้าพบว่าบัญชีของผู้เยาว์ไม่ได้รับความยินยอมจากผู้ปกครอง เราจะระงับและลบบัญชีนั้น',
    'นักเรียนที่ใช้ผ่านห้องเรียนของครูโดยไม่มีบัญชี โรงเรียนหรือครูเป็นผู้ดูแลการขอความยินยอมตามระเบียบของโรงเรียน']],
  ['เราเก็บไว้นานเท่าไร', [
    'สมุดและข้อมูลบัญชีเก็บไว้ตราบที่บัญชียังอยู่ สิ่งที่คุณลบไปอยู่ในถังขยะ 30 วันแล้วลบเอง',
    'เมื่อคุณลบบัญชี ข้อมูลและไฟล์ของบัญชีถูกลบทันที สำเนาสำรองของฐานข้อมูลที่ผู้ให้บริการเก็บไว้หมดอายุเองภายใน 7 วัน',
    'รายงานข้อผิดพลาดถูกลบเองเมื่อเก่าเกิน 90 วัน']],
  ['สิทธิ์ของคุณ', [
    'คุณขอดูและขอสำเนาข้อมูลได้ (แท็บตั้งค่า หัวข้อ ข้อมูลทั้งบัญชี ปุ่ม ส่งออกทั้งบัญชี) แก้ไขได้ในแอป ลบบัญชีและข้อมูลทั้งหมดได้เองในแผ่นบัญชี ถอนความยินยอม คัดค้าน หรือขอให้ระงับการใช้ได้ทางช่องทางติดต่อด้านล่าง การถอนความยินยอมไม่กระทบสิ่งที่ทำไปก่อนหน้า',
    'ถ้าเห็นว่าเราไม่ทำตามกฎหมาย ร้องเรียนได้ที่สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)']],
  ['ความปลอดภัย', [
    'การรับส่งข้อมูลทั้งหมดเข้ารหัสด้วย HTTPS ฐานข้อมูลตรวจสิทธิ์ทุกแถว บัญชีหนึ่งอ่านหรือแก้ข้อมูลของบัญชีอื่นไม่ได้ ถ้าเกิดเหตุข้อมูลรั่วที่กระทบคุณ เราจะแจ้งคุณและแจ้ง สคส. ตามที่กฎหมายกำหนด']],
  ['เมื่อนโยบายเปลี่ยน', [
    'เมื่อนโยบายหรือข้อตกลงเปลี่ยนในส่วนที่สำคัญ แอปจะแจ้งและขอให้ยอมรับฉบับใหม่ก่อนใช้คลาวด์ต่อ ถ้าไม่ยอมรับ คุณออกจากระบบ ส่งออก หรือลบบัญชีได้ และสมุดยังอยู่จนกว่าคุณจะลบ']],
  ['ติดต่อ', [pdContact() ? 'ติดต่อเรื่องข้อมูลส่วนบุคคลได้ที่ ' + pdContact() : 'ติดต่อเรื่องข้อมูลส่วนบุคคลผ่านผู้ที่เชิญคุณเข้าใช้ BURIN ระหว่างช่วงทดลองนี้']]
];
const PD_TERMS = () => [
  ['การใช้ BURIN', [
    'BURIN เป็นสมุดสำหรับจด สอน และนำเสนอ ให้บริการโดย ' + pdOwner() + ' เมื่อสร้างบัญชีหรือใช้คลาวด์ BURIN คุณตกลงตามข้อตกลงนี้และนโยบายความเป็นส่วนตัว']],
  ['บัญชี', [
    'ใช้อีเมลที่เป็นของคุณ เก็บรหัสผ่านไว้เอง และรับผิดชอบสิ่งที่ทำผ่านบัญชีของคุณ ผู้ที่อายุต่ำกว่า 20 ปีต้องได้รับความยินยอมจากผู้ปกครอง ผู้ปกครองที่ยินยอมถือว่ายอมรับข้อตกลงนี้แทนผู้เยาว์ และดูแลการใช้ของผู้เยาว์']],
  ['เนื้อหาของคุณ', [
    'สมุดและสิ่งที่คุณสร้างเป็นของคุณ คุณให้สิทธิ์เราเก็บ ซิงก์ แสดง และส่งต่อเนื้อหานั้นเท่าที่จำเป็นต่อบริการที่คุณใช้ เช่น ให้นักเรียนในห้องของคุณเห็น เราไม่นำเนื้อหาของคุณไปใช้อย่างอื่น',
    'คุณรับรองว่ามีสิทธิ์ใช้เนื้อหาที่ใส่ เช่น รูป PDF และวิดีโอ และไม่ละเมิดลิขสิทธิ์หรือสิทธิ์ของผู้อื่น']],
  ['สิ่งที่ห้ามทำ', [
    'ห้ามใช้ BURIN ทำสิ่งผิดกฎหมาย คุกคามผู้อื่น เผยแพร่ข้อมูลส่วนบุคคลของผู้อื่นโดยไม่มีสิทธิ์ เจาะหรือรบกวนระบบ หรือใช้บัญชีของผู้อื่น เราระงับบัญชีที่ทำเช่นนี้ได้']],
  ['AI', [
    'คำตอบจาก AI อาจผิด ครูและผู้เรียนควรตรวจก่อนใช้สอนหรือให้คะแนน การใช้ AI เป็นไปตามเงื่อนไขและค่าใช้จ่ายของผู้ให้บริการ AI ที่คุณเชื่อมต่อเอง']],
  ['แผนและการชำระเงิน', [
    'แผนที่เสียเงินซื้อผ่าน App Store หรือ Google Play ร้านเป็นผู้ขาย การต่ออายุ ยกเลิก และคืนเงินเป็นไปตามเงื่อนไขของร้าน เมื่อแผนหมดอายุ ข้อมูลของคุณยังอยู่ ความสามารถของแผนที่เสียเงินจะปิดจนกว่าจะต่ออายุ']],
  ['การให้บริการ', [
    'เราพยายามให้บริการต่อเนื่องและสำรองข้อมูล แต่ไม่รับประกันว่าบริการจะไม่หยุดหรือไม่มีข้อผิดพลาด ควรส่งออกข้อมูลสำคัญไว้เป็นระยะ ถ้าจะหยุดให้บริการ เราจะแจ้งล่วงหน้าอย่างน้อย 30 วันเพื่อให้คุณส่งออกข้อมูล',
    'ความรับผิดของเราต่อความเสียหายจากการใช้บริการจำกัดเท่าที่กฎหมายอนุญาต และไม่เกินค่าบริการที่คุณจ่ายในช่วง 12 เดือนก่อนเกิดเหตุ']],
  ['เลิกใช้', [
    'คุณเลิกใช้ได้ทุกเมื่อ ส่งออกทั้งบัญชีแล้วลบบัญชีได้เองในแอป']],
  ['กฎหมายที่ใช้', [
    'ข้อตกลงนี้เป็นไปตามกฎหมายไทย']],
  ['ติดต่อ', [pdContact() ? 'ติดต่อได้ที่ ' + pdContact() : 'ติดต่อผ่านผู้ที่เชิญคุณเข้าใช้ BURIN ระหว่างช่วงทดลองนี้']]
];

/* ----- look ----- */
function pdStyle() {
  if ($('#pdStyle')) return;
  const s = document.createElement('style'); s.id = 'pdStyle';
  s.textContent = '.pdbox { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1.5px solid var(--line); border-radius: 14px; }\n'
    + '.pdbox .seg { display: flex; flex-wrap: wrap; gap: 6px; }\n.pdbox .seg button { min-height: 44px; flex: 1 1 140px; }\n'
    + '.pdchk { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.6; cursor: pointer; }\n.pdchk input { width: 22px; height: 22px; flex: none; margin-top: 2px; }\n'
    + '.pdlinks { display: flex; flex-wrap: wrap; gap: 8px; }\n.pdlinks .btn { min-height: 40px; }\n'
    + '.pddoc h3 { margin: 14px 0 4px; font-size: 16px; color: var(--ink); }\n.pddoc p { margin: 0 0 8px; font-size: 15px; line-height: 1.7; overflow-wrap: break-word; word-break: normal; line-break: auto; }\n'
    + '.pdai ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 15px; line-height: 1.6; }\n'
    + '.pdtop { display: flex; justify-content: space-between; align-items: center; gap: 10px; }\n#pdDocSheet, #pdSheet, #pdAISheet { z-index: 30; }';
  document.head.appendChild(s);
}
/* a sheet of this part, made once and put on top of the sheets already open */
function pdSheetOf(id, label) {
  pdStyle();
  let sh = $('#' + id);
  if (!sh) {
    sh = document.createElement('div'); sh.className = 'sheet'; sh.id = id; sh.hidden = true;
    sh.innerHTML = '<div class="panel" role="dialog" aria-modal="true"></div>';
  }
  sh.firstChild.setAttribute('aria-label', label);
  document.body.appendChild(sh);
  return sh;
}

/* ----- reading the policy or the terms ----- */
function pdDoc(kind) {
  const priv = kind !== 'terms', title = priv ? 'นโยบายความเป็นส่วนตัว' : 'ข้อตกลงการใช้';
  const sh = pdSheetOf('pdDocSheet', title), p = sh.firstChild;
  p.className = 'panel wide pddoc';
  p.innerHTML = '<div class="pdtop"><h2></h2><button class="btn" type="button" id="bPdDocClose">ปิด</button></div><div class="note"></div><div class="pdbody"></div>';
  p.querySelector('h2').textContent = title;
  p.querySelector('.note').innerHTML = pdPh('ฉบับวันที่ ' + PD_DATE);
  const body = p.querySelector('.pdbody');
  for (const [h, ps] of (priv ? PD_PRIV() : PD_TERMS())) {
    const e = document.createElement('h3'); e.textContent = pdKeep(h); body.appendChild(e);
    for (const t of ps) { const q = document.createElement('p'); q.textContent = pdKeep(t); body.appendChild(q); }
  }
  const close = () => { sh.hidden = true; };
  p.querySelector('#bPdDocClose').onclick = close;
  sh.onclick = (e) => { if (e.target === sh) close(); };
  sh.hidden = false; p.scrollTop = 0;
  setTimeout(() => p.querySelector('#bPdDocClose').focus({ preventScroll: true }), 50);
}

/* ----- the questions: age band, the guardian for one under 20, agreement; ok() says when all is answered ----- */
function pdForm(host, onChange) {
  host.innerHTML = '<div class="pdbox"><div class="note">' + pdPh('อายุของผู้ใช้บัญชีนี้') + '</div>'
    + '<div class="seg" role="group" aria-label="อายุของผู้ใช้บัญชีนี้"><button type="button" aria-pressed="false" data-age="adult">' + pdPh('20 ปีขึ้นไป') + '</button><button type="button" aria-pressed="false" data-age="minor">' + pdPh('ต่ำกว่า 20 ปี') + '</button></div>'
    + '<div class="pdminor" hidden><div class="note">' + pdPh('ผู้ที่อายุต่ำกว่า 20 ปี ต้องให้ผู้ปกครองอ่านนโยบายความเป็นส่วนตัวและยินยอมก่อน ถ้าอายุต่ำกว่า 10 ปี ผู้ปกครองต้องเป็นผู้กรอกและกดยินยอมเอง') + '</div>'
    + '<label class="field"><span>' + pdPh('ชื่อผู้ปกครอง') + '</span><input class="pdguard" type="text" maxlength="80" autocomplete="off"></label>'
    + '<label class="pdchk"><input type="checkbox" class="pdgok"><span>' + pdPh('ผู้ปกครองอ่านนโยบายความเป็นส่วนตัวแล้ว และยินยอมให้ใช้บัญชีนี้') + '</span></label></div>'
    + '<label class="pdchk"><input type="checkbox" class="pdok"><span>' + pdPh('ฉันอ่านและยอมรับ ข้อตกลงการใช้ และ นโยบายความเป็นส่วนตัว ของ\u00a0BURIN') + '</span></label>'
    + '<div class="pdlinks"><button class="btn" type="button" data-doc="terms">อ่านข้อตกลงการใช้</button><button class="btn" type="button" data-doc="privacy">อ่านนโยบายความเป็นส่วนตัว</button></div></div>';
  const st = { age: '' }, minor = host.querySelector('.pdminor');
  const g = host.querySelector('.pdguard'), gok = host.querySelector('.pdgok'), ok = host.querySelector('.pdok');
  const F = {
    ok() { return !!st.age && ok.checked && (st.age === 'adult' || (gok.checked && g.value.trim().length >= 2)); },
    rec(by) { const r = { v: PD_VER, at: new Date().toISOString(), age: st.age, by }; if (st.age === 'minor') r.guardian = g.value.trim().slice(0, 80); return r; },
    why() { return !st.age ? 'เลือกอายุของผู้ใช้บัญชีนี้' : st.age === 'minor' && g.value.trim().length < 2 ? 'ใส่ชื่อผู้ปกครอง' : st.age === 'minor' && !gok.checked ? 'ผู้ปกครองต้องกดยินยอม' : !ok.checked ? 'กดยอมรับข้อตกลงการใช้และนโยบายความเป็นส่วนตัว' : ''; }
  };
  const fire = () => { if (onChange) onChange(F); };
  host.querySelectorAll('[data-age]').forEach((b) => {
    b.onclick = () => {
      st.age = b.dataset.age;
      host.querySelectorAll('[data-age]').forEach((x) => { const on = x === b; x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      minor.hidden = st.age !== 'minor'; fire();
    };
  });
  [g, gok, ok].forEach((x) => { x.addEventListener('input', fire); x.addEventListener('change', fire); });
  host.querySelectorAll('[data-doc]').forEach((b) => { b.onclick = () => pdDoc(b.dataset.doc); });
  return F;
}

/* ----- sign-up: asked under the form once the e-mail and password are fine; the answer goes with signUp, or null when
   the person goes back. A second press while it is open waits for the same answer ----- */
function pdSignAsk() {
  if (PD.sign) return PD.sign.p;
  pdStyle();
  let host = $('#aConsent');
  if (!host) { host = document.createElement('div'); host.id = 'aConsent'; const row = $('#aPassRow'); row.parentNode.insertBefore(host, row.nextSibling); }
  host.hidden = false;
  const box = document.createElement('div'), btns = document.createElement('div'), msg = document.createElement('div');
  host.innerHTML = '<h3>' + pdPh('ก่อนสร้างบัญชี') + '</h3>'; host.appendChild(box);
  btns.className = 'row2'; btns.innerHTML = '<button class="btn solid" type="button" id="bPdSign" disabled>ยอมรับและสร้างบัญชี</button><button class="btn" type="button" id="bPdSignNo">ยกเลิก</button>';
  host.appendChild(btns); host.appendChild(msg);
  const go = btns.querySelector('#bPdSign');
  const F = pdForm(box, (f) => { go.disabled = !f.ok(); msg.innerHTML = ''; });
  let done;
  const p = new Promise((res) => { done = res; });
  const end = (r) => { PD.sign = null; host.hidden = true; host.innerHTML = ''; done(r); };
  go.onclick = () => { if (!F.ok()) { msg.innerHTML = '<div class="note err">' + pdPh(F.why()) + '</div>'; return; } end(F.rec('signup')); };
  btns.querySelector('#bPdSignNo').onclick = () => end(null);
  PD.sign = { p };
  setTimeout(() => { try { host.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* old browsers */ } }, 30);
  return p;
}

/* ----- an account of the site's cloud that has not agreed to this version: asked once the app is open ----- */
const pdQKey = (id) => 'tp-pd-q-' + id;
async function pdLoginAsk() {
  const u = CLOUD.user; if (!u || !CLOUD.client) return;
  const meta = u.user_metadata || {}, has = meta.consent && meta.consent.v;
  if (has === PD_VER) { store_ls.del(pdQKey(u.id)); return; }
  /* agreed on this device while offline: sent now, nothing asked */
  let q = null; try { q = JSON.parse(store_ls.get(pdQKey(u.id)) || 'null'); } catch (e) { q = null; }
  if (q && q.v === PD_VER) { pdSend(q); return; }
  const sh = pdSheetOf('pdSheet', 'ยอมรับนโยบายความเป็นส่วนตัว'), p = sh.firstChild;
  p.className = 'panel';
  p.innerHTML = '<h2>' + pdPh(has ? 'นโยบายความเป็นส่วนตัวฉบับใหม่' : 'ก่อนใช้คลาวด์ BURIN ต่อ') + '</h2>'
    + '<div class="note">' + pdPh(has ? 'ข้อตกลงการใช้และนโยบายความเป็นส่วนตัวมีฉบับใหม่ ลงวันที่ ' + PD_DATE + ' อ่านแล้วกดยอมรับเพื่อใช้คลาวด์ต่อ' : 'บัญชีนี้ยังไม่ได้ยอมรับข้อตกลงการใช้และนโยบายความเป็นส่วนตัว ลงวันที่ ' + PD_DATE + ' อ่านแล้วกดยอมรับเพื่อใช้คลาวด์ต่อ') + '</div>'
    + '<div class="pdq"></div><div class="row2"><button class="btn solid" type="button" id="bPdOk" disabled>ยอมรับ</button><button class="btn" type="button" id="bPdOut">ออกจากระบบ</button></div>'
    + '<div class="note">' + pdPh('ถ้าไม่ยอมรับ ออกจากระบบได้ สมุดบนคลาวด์ยังอยู่ เข้าระบบอีกครั้งเมื่อพร้อม') + '</div><div class="pdmsg"></div>';
  const ok = p.querySelector('#bPdOk'), msg = p.querySelector('.pdmsg');
  /* the sheet stays until it is answered: something else of the app that closes all sheets (closeSheets, a key)
     does not let the cloud be used without agreeing */
  let answered = false;
  if (PD.keep) PD.keep.disconnect();
  PD.keep = new MutationObserver(() => { if (sh.hidden && !answered) setTimeout(() => { if (!answered) sh.hidden = false; }, 0); });
  PD.keep.observe(sh, { attributes: true, attributeFilter: ['hidden'] });
  const done = () => { answered = true; if (PD.keep) { PD.keep.disconnect(); PD.keep = null; } };
  const F = pdForm(p.querySelector('.pdq'), (f) => { ok.disabled = !f.ok(); msg.innerHTML = ''; });
  ok.onclick = async () => {
    if (!F.ok()) { msg.innerHTML = '<div class="note err">' + pdPh(F.why()) + '</div>'; return; }
    const r = F.rec('login'); ok.disabled = true;
    const sent = await pdSend(r);
    if (!sent) { store_ls.set(pdQKey(u.id), JSON.stringify(r)); toast('บันทึกการยอมรับไว้ในเครื่องนี้แล้ว จะส่งขึ้นคลาวด์เองเมื่อต่ออินเทอร์เน็ตได้', 4500); }
    done(); sh.hidden = true;
  };
  p.querySelector('#bPdOut').onclick = async () => {
    p.querySelector('#bPdOut').disabled = true; done();
    try { await CLOUD.client.auth.signOut({ scope: 'local' }); } catch (e) { /* the page reloads anyway */ }
    location.reload();
  };
  sh.hidden = false;
}
/* the record to the account (user_metadata.consent); false when it could not be sent */
async function pdSend(r) {
  const u = CLOUD.user;
  try {
    const { data, error } = await CLOUD.client.auth.updateUser({ data: { consent: r } });
    if (error) throw error;
    u.user_metadata = Object.assign({}, u.user_metadata || {}, (data && data.user && data.user.user_metadata) || { consent: r });
    if (!u.user_metadata.consent) u.user_metadata.consent = r;
    store_ls.del(pdQKey(u.id));
    return true;
  } catch (e) { return false; }
}

/* ----- the first use of an AI that is somebody else's: true to go on ----- */
function pdAIAsk(name) {
  const sh = pdSheetOf('pdAISheet', 'ก่อนใช้ AI'), p = sh.firstChild;
  p.className = 'panel pdai';
  p.innerHTML = '<h2>' + pdPh('ก่อนใช้ AI ครั้งแรก') + '</h2>'
    + '<ul><li>' + pdPh('งานที่ใช้ AI ส่งเฉพาะส่วนที่งานนั้นต้องใช้ เช่น ภาพลายมือที่เลือก หน้าที่เลือก หรือข้อความ') + '</li>'
    + '<li class="pdto"></li>'
    + '<li>' + pdPh('ส่งจากเครื่องนี้ไปที่ผู้ให้บริการโดยตรง ไม่ผ่านเซิร์ฟเวอร์ของ BURIN ผู้ให้บริการดูแลข้อมูลตามนโยบายของเขาเอง') + '</li>'
    + '<li>' + pdPh('อย่าส่งชื่อเต็ม เลขประจำตัว หรือข้อมูลส่วนตัวของนักเรียนให้ AI ถ้าไม่จำเป็น') + '</li></ul>'
    + '<div class="row2"><button class="btn solid" type="button" id="bPdAIOk">เข้าใจแล้ว ใช้ AI</button><button class="btn" type="button" id="bPdAINo">ยังไม่ใช้</button></div>'
    + '<div class="pdlinks"><button class="btn" type="button" id="bPdAIDoc">อ่านนโยบายความเป็นส่วนตัว</button></div>';
  p.querySelector('.pdto').innerHTML = pdPh('ผู้ให้บริการที่ตั้งไว้ตอนนี้คือ') + ' <b>' + esc(name) + '</b>';
  return new Promise((res) => {
    const end = (v) => { sh.hidden = true; sh.onclick = null; res(v); };
    p.querySelector('#bPdAIOk').onclick = () => {
      let m = {}; try { m = JSON.parse(store_ls.get('tp-aiok') || '{}') || {}; } catch (e) { m = {}; }
      m[name] = Date.now(); store_ls.set('tp-aiok', JSON.stringify(m)); end(true);
    };
    p.querySelector('#bPdAINo').onclick = () => end(false);
    p.querySelector('#bPdAIDoc').onclick = () => pdDoc('privacy');
    sh.onclick = (e) => { if (e.target === sh) end(false); };
    sh.hidden = false;
    setTimeout(() => p.querySelector('#bPdAIOk').focus({ preventScroll: true }), 50);
  });
}

