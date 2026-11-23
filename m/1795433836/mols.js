/* BURIN part: mols (loaded when first used) */
/* ---------- names of substances to their structures, with no AI (task 8.19 group 5). A table of the substances met in
   the Thai school curriculum (Thai name, English name, formula when it names one substance only, SMILES) comes with the
   app. What is picked on a page (typed, or handwriting the AI read before) and asked for a figure: each substance
   found in the table is drawn by the structure drawer the app already has (moleculeSvg); a reaction written with an
   arrow keeps its sides. When the AI names a molecule, a name in the table takes the table's structure.
   "mols" in flags.json turns it off (or "localcalc", or "typed"): everything goes to the AI as before ---------- */
/* [Thai names (| between), English names (| between), formula or '', SMILES] */
const ML_LIST = [
  ['น้ำ', 'water', 'H2O', '[H]O[H]'], ['ไฮโดรเจนเปอร์ออกไซด์', 'hydrogen peroxide', 'H2O2', 'OO'],
  ['แก๊สไฮโดรเจน', 'hydrogen gas', 'H2', '[H][H]'], ['แก๊สออกซิเจน', 'oxygen gas', 'O2', 'O=O'], ['แก๊สไนโตรเจน', 'nitrogen gas', 'N2', 'N#N'],
  ['แก๊สคลอรีน', 'chlorine gas', 'Cl2', 'ClCl'], ['แก๊สฟลูออรีน', 'fluorine gas', 'F2', 'FF'], ['โบรมีนเหลว', 'bromine liquid', 'Br2', 'BrBr'], ['ไอโอดีนของแข็ง', 'iodine solid', 'I2', 'II'],
  ['โอโซน', 'ozone', 'O3', '[O-][O+]=O'],
  ['คาร์บอนไดออกไซด์', 'carbon dioxide', 'CO2', 'O=C=O'], ['คาร์บอนมอนอกไซด์', 'carbon monoxide', 'CO', '[C-]#[O+]'],
  ['แอมโมเนีย', 'ammonia', 'NH3', 'N'], ['ไฮโดรเจนคลอไรด์|กรดไฮโดรคลอริก', 'hydrogen chloride|hydrochloric acid', 'HCl', 'Cl'],
  ['ไฮโดรเจนฟลูออไรด์|กรดไฮโดรฟลูออริก', 'hydrogen fluoride|hydrofluoric acid', 'HF', 'F'], ['ไฮโดรเจนโบรไมด์', 'hydrogen bromide', 'HBr', 'Br'],
  ['ไฮโดรเจนซัลไฟด์', 'hydrogen sulfide', 'H2S', '[H]S[H]'], ['ไฮโดรเจนไซยาไนด์', 'hydrogen cyanide', 'HCN', 'C#N'],
  ['ซัลเฟอร์ไดออกไซด์', 'sulfur dioxide', 'SO2', 'O=S=O'], ['ซัลเฟอร์ไตรออกไซด์', 'sulfur trioxide', 'SO3', 'O=S(=O)=O'],
  ['ไดไนโตรเจนมอนอกไซด์|แก๊สหัวเราะ', 'nitrous oxide', 'N2O', '[N-]=[N+]=O'],
  ['กรดซัลฟิวริก', 'sulfuric acid', 'H2SO4', 'OS(=O)(=O)O'], ['กรดไนตริก', 'nitric acid', 'HNO3', 'O[N+](=O)[O-]'], ['กรดฟอสฟอริก', 'phosphoric acid', 'H3PO4', 'OP(=O)(O)O'],
  ['กรดคาร์บอนิก', 'carbonic acid', 'H2CO3', 'OC(=O)O'],
  ['โซเดียมคลอไรด์|เกลือแกง', 'sodium chloride', 'NaCl', '[Na+].[Cl-]'], ['โซเดียมไฮดรอกไซด์|โซดาไฟ', 'sodium hydroxide', 'NaOH', '[Na+].[OH-]'],
  ['โพแทสเซียมไฮดรอกไซด์', 'potassium hydroxide', 'KOH', '[K+].[OH-]'], ['แคลเซียมไฮดรอกไซด์|น้ำปูนใส', 'calcium hydroxide', 'Ca(OH)2', '[Ca+2].[OH-].[OH-]'],
  ['แคลเซียมคาร์บอเนต|หินปูน', 'calcium carbonate', 'CaCO3', '[Ca+2].[O-]C([O-])=O'], ['แคลเซียมออกไซด์|ปูนดิบ', 'calcium oxide', 'CaO', '[Ca+2].[O-2]'],
  ['โซเดียมคาร์บอเนต', 'sodium carbonate', 'Na2CO3', '[Na+].[Na+].[O-]C([O-])=O'], ['โซเดียมไฮโดรเจนคาร์บอเนต|เบกกิ้งโซดา|โซดาทำขนม', 'sodium bicarbonate|sodium hydrogen carbonate|baking soda', 'NaHCO3', '[Na+].OC([O-])=O'],
  ['โพแทสเซียมเปอร์แมงกาเนต|ด่างทับทิม', 'potassium permanganate', 'KMnO4', '[K+].[O-][Mn](=O)(=O)=O'], ['คอปเปอร์(II)ซัลเฟต|จุนสี', 'copper(II) sulfate|copper sulfate', 'CuSO4', '[Cu+2].[O-]S([O-])(=O)=O'],
  ['แอมโมเนียมคลอไรด์', 'ammonium chloride', 'NH4Cl', '[NH4+].[Cl-]'], ['ซิลเวอร์ไนเตรต', 'silver nitrate', 'AgNO3', '[Ag+].[O-][N+]([O-])=O'], ['โพแทสเซียมไนเตรต|ดินประสิว', 'potassium nitrate', 'KNO3', '[K+].[O-][N+]([O-])=O'],
  ['แมกนีเซียมออกไซด์', 'magnesium oxide', 'MgO', '[Mg+2].[O-2]'],
  ['โบรอนไตรฟลูออไรด์', 'boron trifluoride', 'BF3', 'FB(F)F'], ['เบริลเลียมคลอไรด์', 'beryllium chloride', 'BeCl2', 'Cl[Be]Cl'], ['ฟอสฟอรัสไตรคลอไรด์', 'phosphorus trichloride', 'PCl3', 'ClP(Cl)Cl'],
  ['ฟอสฟอรัสเพนตะคลอไรด์', 'phosphorus pentachloride', 'PCl5', 'ClP(Cl)(Cl)(Cl)Cl'], ['ซัลเฟอร์เฮกซะฟลูออไรด์', 'sulfur hexafluoride', 'SF6', 'FS(F)(F)(F)(F)F'],
  ['คาร์บอนเตตระคลอไรด์', 'carbon tetrachloride|tetrachloromethane', 'CCl4', 'ClC(Cl)(Cl)Cl'],
  /* hydrocarbons */
  ['มีเทน', 'methane', 'CH4', 'C'], ['อีเทน', 'ethane', 'C2H6', 'CC'], ['โพรเพน', 'propane', 'C3H8', 'CCC'], ['บิวเทน', 'butane|n-butane', '', 'CCCC'],
  ['2-เมทิลโพรเพน|ไอโซบิวเทน', '2-methylpropane|isobutane', '', 'CC(C)C'], ['เพนเทน', 'pentane', '', 'CCCCC'], ['เฮกเซน', 'hexane', '', 'CCCCCC'],
  ['เฮปเทน', 'heptane', '', 'CCCCCCC'], ['ออกเทน', 'octane', '', 'CCCCCCCC'], ['2,2,4-ไตรเมทิลเพนเทน|ไอโซออกเทน', '2,2,4-trimethylpentane|isooctane', '', 'CC(C)CC(C)(C)C'],
  ['โนเนน', 'nonane', '', 'CCCCCCCCC'], ['เดคเคน', 'decane', '', 'CCCCCCCCCC'],
  ['ไซโคลโพรเพน', 'cyclopropane', '', 'C1CC1'], ['ไซโคลบิวเทน', 'cyclobutane', '', 'C1CCC1'], ['ไซโคลเพนเทน', 'cyclopentane', '', 'C1CCCC1'], ['ไซโคลเฮกเซน', 'cyclohexane', '', 'C1CCCCC1'],
  ['เอทีน|เอทิลีน', 'ethene|ethylene', 'C2H4', 'C=C'], ['โพรพีน|โพรพิลีน', 'propene|propylene', 'C3H6', 'C=CC'], ['บิวต-1-อีน|1-บิวทีน', 'but-1-ene|1-butene', '', 'C=CCC'],
  ['บิวต-2-อีน|2-บิวทีน', 'but-2-ene|2-butene', '', 'CC=CC'], ['บิวตา-1,3-ไดอีน', 'buta-1,3-diene|1,3-butadiene', '', 'C=CC=C'], ['ไซโคลเฮกซีน', 'cyclohexene', '', 'C1CCC=CC1'],
  ['เอไทน์|แก๊สอะเซทิลีน|อะเซทิลีน', 'ethyne|acetylene', 'C2H2', 'C#C'], ['โพรไพน์', 'propyne', '', 'CC#C'],
  ['เบนซีน', 'benzene', 'C6H6', 'c1ccccc1'], ['โทลูอีน|เมทิลเบนซีน', 'toluene|methylbenzene', '', 'Cc1ccccc1'], ['สไตรีน', 'styrene', '', 'C=Cc1ccccc1'],
  ['แนฟทาลีน|ลูกเหม็น', 'naphthalene', '', 'c1ccc2ccccc2c1'],
  /* compounds with oxygen, nitrogen or halogens */
  ['ฟีนอล', 'phenol', '', 'Oc1ccccc1'], ['แอนิลีน', 'aniline', '', 'Nc1ccccc1'], ['ไนโตรเบนซีน', 'nitrobenzene', '', '[O-][N+](=O)c1ccccc1'],
  ['เมทานอล', 'methanol', 'CH3OH', 'CO'], ['เอทานอล', 'ethanol', 'C2H5OH', 'CCO'], ['โพรแพน-1-ออล|1-โพรพานอล', 'propan-1-ol|1-propanol', '', 'CCCO'],
  ['โพรแพน-2-ออล|2-โพรพานอล|ไอโซโพรพิลแอลกอฮอล์', 'propan-2-ol|2-propanol|isopropyl alcohol', '', 'CC(C)O'], ['บิวแทน-1-ออล|1-บิวทานอล', 'butan-1-ol|1-butanol', '', 'CCCCO'],
  ['กลีเซอรอล|กลีเซอรีน', 'glycerol|glycerine', '', 'OCC(O)CO'], ['เอทิลีนไกลคอล|เอเทน-1,2-ไดออล', 'ethylene glycol|ethane-1,2-diol', '', 'OCCO'],
  ['เมทานาล|ฟอร์มาลดีไฮด์', 'methanal|formaldehyde', 'HCHO', 'C=O'], ['เอทานาล|แอซีตัลดีไฮด์', 'ethanal|acetaldehyde', 'CH3CHO', 'CC=O'], ['โพรพานาล', 'propanal', '', 'CCC=O'],
  ['เบนซาลดีไฮด์', 'benzaldehyde', '', 'O=Cc1ccccc1'], ['โพรพาโนน|แอซีโตน', 'propanone|acetone', '', 'CC(C)=O'], ['บิวทาโนน', 'butanone', '', 'CCC(C)=O'],
  ['กรดเมทาโนอิก|กรดฟอร์มิก|กรดมด', 'methanoic acid|formic acid', 'HCOOH', 'OC=O'], ['กรดเอทาโนอิก|กรดแอซีติก|กรดน้ำส้ม', 'ethanoic acid|acetic acid', 'CH3COOH', 'CC(=O)O'],
  ['กรดโพรพาโนอิก', 'propanoic acid', '', 'CCC(=O)O'], ['กรดบิวทาโนอิก', 'butanoic acid|butyric acid', '', 'CCCC(=O)O'], ['กรดออกซาลิก', 'oxalic acid', '', 'OC(=O)C(=O)O'],
  ['กรดซิตริก|กรดมะนาว', 'citric acid', '', 'OC(=O)CC(O)(CC(=O)O)C(=O)O'], ['กรดแลกติก', 'lactic acid', '', 'CC(O)C(=O)O'], ['กรดเบนโซอิก', 'benzoic acid', '', 'OC(=O)c1ccccc1'],
  ['กรดซาลิซิลิก', 'salicylic acid', '', 'OC(=O)c1ccccc1O'], ['กรดปาล์มิติก', 'palmitic acid', '', 'CCCCCCCCCCCCCCCC(=O)O'], ['กรดสเตียริก', 'stearic acid', '', 'CCCCCCCCCCCCCCCCCC(=O)O'],
  ['กรดโอเลอิก', 'oleic acid', '', 'CCCCCCCC/C=C\\CCCCCCCC(=O)O'],
  ['เอทิลเอทาโนเอต|เอทิลแอซีเตต', 'ethyl ethanoate|ethyl acetate', '', 'CCOC(C)=O'], ['เมทิลเอทาโนเอต|เมทิลแอซีเตต', 'methyl ethanoate|methyl acetate', '', 'COC(C)=O'],
  ['เมทิลซาลิซิเลต', 'methyl salicylate', '', 'COC(=O)c1ccccc1O'], ['แอสไพริน|กรดแอซีทิลซาลิซิลิก', 'aspirin|acetylsalicylic acid', '', 'CC(=O)Oc1ccccc1C(=O)O'],
  ['ไดเอทิลอีเทอร์|อีเทอร์', 'diethyl ether', '', 'CCOCC'], ['ไดเมทิลอีเทอร์', 'dimethyl ether', '', 'COC'],
  ['เมทิลเอมีน|เมทานามีน', 'methylamine|methanamine', '', 'CN'], ['เอทิลเอมีน|เอทานามีน', 'ethylamine|ethanamine', '', 'CCN'], ['ไดเมทิลเอมีน', 'dimethylamine', '', 'CNC'],
  ['ไตรเมทิลเอมีน', 'trimethylamine', '', 'CN(C)C'], ['ยูเรีย', 'urea', '', 'NC(N)=O'], ['เอทานาไมด์|แอซีตาไมด์', 'ethanamide|acetamide', '', 'CC(N)=O'],
  ['คลอโรมีเทน', 'chloromethane', 'CH3Cl', 'CCl'], ['ไดคลอโรมีเทน', 'dichloromethane', 'CH2Cl2', 'ClCCl'], ['คลอโรฟอร์ม|ไตรคลอโรมีเทน', 'chloroform|trichloromethane', 'CHCl3', 'ClC(Cl)Cl'],
  ['คลอโรอีเทน', 'chloroethane', '', 'CCCl'], ['ไวนิลคลอไรด์|คลอโรอีทีน', 'vinyl chloride|chloroethene', '', 'C=CCl'],
  /* molecules of life and everyday medicines */
  ['กลูโคส', 'glucose', 'C6H12O6', 'OCC1OC(O)C(O)C(O)C1O'], ['ฟรักโทส', 'fructose', '', 'OCC1OC(O)(CO)C(O)C1O'],
  ['ซูโครส|น้ำตาลทราย', 'sucrose', 'C12H22O11', 'OCC1OC(OC2(CO)OC(CO)C(O)C2O)C(O)C(O)C1O'], ['ไกลซีน', 'glycine', '', 'NCC(=O)O'], ['อะลานีน', 'alanine', '', 'CC(N)C(=O)O'],
  ['เซรีน', 'serine', '', 'NC(CO)C(=O)O'], ['ซิสเทอีน', 'cysteine', '', 'NC(CS)C(=O)O'], ['วาลีน', 'valine', '', 'CC(C)C(N)C(=O)O'], ['ลิวซีน', 'leucine', '', 'CC(C)CC(N)C(=O)O'],
  ['เฟนิลอะลานีน', 'phenylalanine', '', 'NC(Cc1ccccc1)C(=O)O'], ['กรดกลูตามิก', 'glutamic acid', '', 'NC(CCC(=O)O)C(=O)O'], ['กรดแอสปาร์ติก', 'aspartic acid', '', 'NC(CC(=O)O)C(=O)O'],
  ['ไลซีน', 'lysine', '', 'NCCCCC(N)C(=O)O'], ['อะดีนีน', 'adenine', '', 'Nc1ncnc2[nH]cnc12'], ['กัวนีน', 'guanine', '', 'NC1=Nc2[nH]cnc2C(=O)N1'], ['ไซโทซีน', 'cytosine', '', 'NC1=NC(=O)NC=C1'],
  ['ไทมีน', 'thymine', '', 'CC1=CNC(=O)NC1=O'], ['ยูราซิล', 'uracil', '', 'O=C1C=CNC(=O)N1'], ['คาเฟอีน', 'caffeine', '', 'Cn1cnc2c1c(=O)n(C)c(=O)n2C'],
  ['นิโคติน', 'nicotine', '', 'CN1CCCC1c1cccnc1'], ['พาราเซตามอล', 'paracetamol|acetaminophen', '', 'CC(=O)Nc1ccc(O)cc1'], ['ไอบูโพรเฟน', 'ibuprofen', '', 'CC(C)Cc1ccc(cc1)C(C)C(=O)O'],
  ['วิตามินซี|กรดแอสคอร์บิก', 'vitamin c|ascorbic acid', '', 'OCC(O)C1OC(=O)C(O)=C1O']
];
/* names without spaces, case or hyphen differences; formulas as written */
const mlKey = (s) => String(s).toLowerCase().replace(/[\s\-–,]+/g, '');
const ML = (() => {
  const name = new Map(), form = new Map();
  for (const [th, en, f, sm] of ML_LIST) {
    const show = th.split('|')[0];
    for (const n of th.split('|').concat(en.split('|'))) if (n) name.set(mlKey(n), { name: show, smiles: sm });
    if (f) form.set(f, { name: show, smiles: sm });
  }
  return { name, form };
})();
/* one substance: a name (Thai or English, with or without แก๊ส, สาร) or a formula, a coefficient in front taken away */
function mlFind(tok) {
  let t = String(tok || '').replace(/\\ce\{([^}]*)\}|\\mathrm\{([^}]*)\}|\\text\{([^}]*)\}/g, '$1$2$3').replace(/[$]/g, '').replace(/_\{?(\d+)\}?/g, '$1')
    .replace(/[₀-₉]/g, (d) => '₀₁₂₃₄₅₆₇₈₉'.indexOf(d)).replace(/\((?:g|l|s|aq)\)\s*$/i, '').trim();
  if (!t) return null;
  const f = t.replace(/^\d+\s*(?=[A-Z(])/, '').replace(/\s+/g, '');
  if (ML.form.has(f)) return ML.form.get(f);
  const k = mlKey(t), bare = mlKey(t.replace(/^(?:สาร|แก๊ส|ก๊าซ)\s*/, ''));
  /* found by name: shown with the name as written (กรดแอซีติก stays กรดแอซีติก) */
  for (const x of [k, bare, mlKey('แก๊ส') + bare]) if (ML.name.has(x)) return { name: t.replace(/\s+/g, ' ').slice(0, 40), smiles: ML.name.get(x).smiles };
  return null;
}
/* the substances of a piece of text, with their sides of a reaction; null unless every piece is in the table */
function mlParse(text) {
  const t = String(text || '').replace(/\\(?:right|long)?(?:rightarrow|to)\b/g, '→').replace(/-+>|⟶|⇌|<=>/g, '→').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 300) return null;
  const sides = t.split('→'); if (sides.length > 2) return null;
  const out = [];
  for (let s = 0; s < sides.length; s++) {
    const toks = sides[s].split(/\s\+\s|\+(?=\s*\d*\s*[A-Zก-๙a-z])|,|\n|\sและ\s/).map((x) => x.trim()).filter(Boolean);
    if (!toks.length) return null;
    for (const tk of toks) { const m = mlFind(tk); if (!m) return null; out.push({ name: m.name, smiles: m.smiles, role: sides.length === 2 ? (s ? 'product' : 'reactant') : '' }); }
  }
  return out.length && out.length <= 5 ? out : null;
}
/* the table's structure for a name the AI gave, or '' */
function mlSmiles(name) { const m = mlFind(name); return m ? m.smiles : ''; }

