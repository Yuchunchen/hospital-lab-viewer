// ════════════════════════════════════════════════════════════════════════════
// AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
//
// Source of truth: hospital-lab-patterns repo (catalog.js + viewer.js + normalizers.js)
//   https://github.com/Yuchunchen/hospital-lab-patterns
//
// To update:
//   1. Edit ../hospital-lab-patterns/patterns/<file>.js
//   2. git commit + git push (in the patterns repo)
//   3. cd hospital-lab-viewer && node sync-patterns.js
//   4. Reload the extension at chrome://extensions
//
// Synced at: 2026-05-05T21:13:50.289Z
// ════════════════════════════════════════════════════════════════════════════
'use strict';

/**
 * normalizers.js — Named numeric-value transforms used by catalog entries.
 *
 * Why named: catalog entries reference normalizers by string name (e.g.
 * `normalize: 'wbcCount'`) so the catalog can be JSON-serialised for
 * runtime fetch. Functions can't go in JSON; string names can.
 *
 * To add a new normalizer:
 *   1. Add a named function below
 *   2. Reference it from a catalog entry: `normalize: 'yourName'`
 *   3. validate.js will confirm the name resolves
 *
 * NOTE: adding a new normalizer requires extension redistribution
 * (the bundled `normalizers.js` snapshot must be updated on each OPD
 * computer). Existing normalizers are stable and cover both current
 * use-cases below.
 */

const NORMALIZERS = {
  // WBC: API may report /µL (e.g. 6700) or ×10³/µL (6.7).
  // Normalize to ×10³/µL — divide by 1000 if value > 100.
  wbcCount: function (v) {
    return v > 100 ? +(v / 1000).toFixed(1) : v;
  },

  // Platelet: API may report /µL (e.g. 250000) or ×10³/µL (250).
  // Normalize to ×10³/µL — divide by 1000 if value > 1000.
  plateletCount: function (v) {
    return v > 1000 ? +(v / 1000).toFixed(0) : v;
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NORMALIZERS;
}
if (typeof window !== 'undefined') {
  window.HOSPITAL_LAB_PATTERNS_NORMALIZERS = NORMALIZERS;
}
'use strict';

/**
 * catalog.js — Master human-readable catalog of every lab/imaging entry
 * we know how to detect from the ernode API.
 *
 * Goals:
 *   1. Single source of truth: every test pattern lives here ONCE.
 *   2. Human-readable: organised by clinical category with comments.
 *   3. Universal fields only — NO app-specific layout (page/col/section/cat).
 *      Each consuming app (viewer / reporter) has its own manifest that
 *      picks ids from this catalog and adds layout / overrides.
 *
 * "Track-only" patterns (detect but don't render anywhere) just live here
 * and aren't referenced by any manifest.
 *
 * See ../docs/pattern-spec.md for field definitions, ../docs/learning-workflow.md
 * for the Claude-driven recipe to add new entries.
 */

const CATALOG = [

  // ═══════════════════════════════════════════════════════════════════════
  // HEMATOLOGY (CBC)
  // ═══════════════════════════════════════════════════════════════════════

  { id:'WBC',
    pattern: /WBC:\s*([\d.]+)(?!\s*[-–]\s*\d)/,
    displayName:'白血球 (WBC)', shortLabel:'WBC',
    unit:'×10³/µL', category:'血液',
    ref:'4.0–11.0 ×10³/µL',
    refLo:4.0, refHi:11.0, hi:11, lo:4,
    normalize: 'wbcCount',
    notes:'Negative lookahead in pattern rejects urine routine "WBC: 0-5". Normalize handles /µL (e.g. 6700) → ×10³/µL (6.7).' },

  { id:'RBC',
    pattern: /\bRBC:\s*([\d.]+)/,
    displayName:'紅血球 (RBC)', shortLabel:'RBC',
    unit:'×10⁶/µL', category:'血液',
    ref:'男 4.2–6.2，女 3.7–5.5 ×10⁶/µL',
    refLo:3.7, refHi:6.2,
    loM:4.2, hiM:6.2, loF:3.7, hiF:5.5,
    lo:3.7, hi:6.2 },

  { id:'Hb',
    pattern: /(?:Hb|HGB):\s*([\d.]+)/,
    displayName:'血色素 (Hemoglobin)', shortLabel:'Hb',
    unit:'g/dL', category:'血液',
    ref:'男 14–18，女 12–16 g/dL',
    refLo:12, refHi:18,
    loM:14, hiM:18, loF:12, hiF:16,
    lo:12, hi:18,
    notes:'Pattern matches both "Hb:" and "HGB:" labels.' },

  { id:'HCT',
    pattern: /HCT:\s*([\d.]+)/,
    displayName:'血比容 (HCT)', shortLabel:'HCT',
    unit:'%', category:'血液',
    ref:'男 39–53，女 33–47 %',
    refLo:33, refHi:53,
    loM:39, hiM:53, loF:33, hiF:47,
    lo:33, hi:53 },

  { id:'MCV',
    pattern: /MCV:\s*([\d.]+)/,
    displayName:'平均紅血球容積 (MCV)', shortLabel:'MCV',
    unit:'fL', category:'血液',
    ref:'79–99 fL',
    refLo:79, refHi:99, hi:99, lo:79 },

  { id:'Platelet',
    pattern: /Platelet:\s*([\d.]+)/,
    displayName:'血小板 (Platelet)', shortLabel:'PLT',
    unit:'×10³/µL', category:'血液',
    ref:'150–400 ×10³/µL',
    refLo:150, refHi:400, hi:400, lo:150,
    normalize: 'plateletCount',
    notes:'Normalize handles /µL (e.g. 250000) → ×10³/µL (250).' },

  // ═══════════════════════════════════════════════════════════════════════
  // PROTEINS
  // ═══════════════════════════════════════════════════════════════════════

  { id:'TP',
    pattern: /Total protein\(serum\):\s*([\d.]+)/i,
    displayName:'總蛋白 (Total Protein)', shortLabel:'TP',
    unit:'g/dL', category:'蛋白質',
    ref:'6.0–8.3 g/dL',
    refLo:6.0, refHi:8.3, hi:8.3, lo:6.0 },

  { id:'Albumin',
    pattern: /(?:^|[\s;])Albumin(?:\([^)]*\))?:\s*([\d.]+)/i,
    displayName:'白蛋白 (Albumin)', shortLabel:'Alb',
    unit:'g/dL', category:'蛋白質',
    ref:'3.5–5.0 g/dL',
    refLo:3.5, refHi:5.0, hi:5.0, lo:3.5,
    meaning:'營養狀態指標',
    notes:'Boundary requirement (^ or whitespace/semicolon) prevents matching "U-Albumin:" or "Microalbumin:".' },

  // ═══════════════════════════════════════════════════════════════════════
  // LIVER FUNCTION
  // ═══════════════════════════════════════════════════════════════════════

  { id:'GOT',
    pattern: /GOT:\s*([\d.]+)/,
    displayName:'天門冬胺酸轉氨酶 (GOT / AST)', shortLabel:'GOT/AST',
    unit:'U/L', category:'肝功能',
    ref:'5–34 U/L',
    refLo:5, refHi:34, hi:34, lo:null },

  { id:'GPT',
    pattern: /GPT:\s*([\d.]+)/,
    displayName:'丙胺酸轉氨酶 (GPT / ALT)', shortLabel:'GPT/ALT',
    unit:'U/L', category:'肝功能',
    ref:'男<45，女<34 U/L',
    refLo:7, refHi:45,
    hiM:45, hiF:34,
    hi:45, lo:null },

  { id:'RGT',
    pattern: /(?:r-?GT|R-?GT|γ-?GT|GGT|RGT):\s*([\d.]+)/i,
    displayName:'γ-麩胺醯轉移酶 (r-GT / GGT)', shortLabel:'r-GT',
    unit:'U/L', category:'肝功能',
    ref:'男 < 55，女 < 38 U/L',
    refLo:0, refHi:55,
    hiM:55, hiF:38,
    hi:55, lo:null,
    notes:'Pattern matches r-GT, R-GT, γ-GT, GGT, RGT — hospitals use various labels.' },

  { id:'ALP',
    pattern: /(?:Alk[\s.\-]*P|ALP|Alkaline\s*Phosphatase):\s*([\d.]+)/i,
    displayName:'鹼性磷酸酶 (Alk-P / ALP)', shortLabel:'Alk-P',
    unit:'U/L', category:'肝功能',
    ref:'40–130 U/L',
    refLo:34, refHi:130, hi:130, lo:34 },

  { id:'TBIL',
    pattern: /T-BIL:\s*([\d.]+)/,
    displayName:'總膽紅素 (T-BIL)', shortLabel:'T-BIL',
    unit:'mg/dL', category:'肝功能',
    ref:'0.3–1.0 mg/dL',
    refLo:0.3, refHi:1.0, hi:1.0, lo:null },

  { id:'DBIL',
    pattern: /D-BIL:\s*([\d.]+)/,
    displayName:'直接膽紅素 (D-BIL)', shortLabel:'D-BIL',
    unit:'mg/dL', category:'肝功能',
    ref:'0.03–0.18 mg/dL',
    refLo:0.03, refHi:0.18, hi:0.18, lo:null },

  // ═══════════════════════════════════════════════════════════════════════
  // LIPIDS
  // ═══════════════════════════════════════════════════════════════════════

  { id:'CHOL',
    pattern: /CHOL:\s*([\d.]+)/,
    displayName:'總膽固醇 (Cholesterol)', shortLabel:'CHOL',
    unit:'mg/dL', category:'血脂',
    ref:'< 200 mg/dL',
    refLo:null, refHi:200, hi:200, lo:null },

  { id:'HDLC',
    pattern: /HDLC:\s*([\d.]+)/,
    displayName:'高密度膽固醇 (HDL)', shortLabel:'HDL',
    unit:'mg/dL', category:'血脂',
    ref:'男 >40 mg/dL',
    refLo:40, refHi:null, hi:null, lo:40,
    meaning:'俗稱「好膽固醇」' },

  { id:'LDL',
    pattern: /LDL-C:\s*([\d.]+)/,
    displayName:'低密度膽固醇 (LDL)', shortLabel:'LDL-C',
    unit:'mg/dL', category:'血脂',
    ref:'< 130 mg/dL',
    refLo:null, refHi:130, hi:130, lo:null,
    meaning:'俗稱「壞膽固醇」' },

  { id:'TG',
    pattern: /Triglyceride:\s*([\d.]+)/,
    displayName:'三酸甘油脂 (Triglyceride)', shortLabel:'TG',
    unit:'mg/dL', category:'血脂',
    ref:'< 150 mg/dL',
    refLo:null, refHi:150, hi:150, lo:null },

  // ═══════════════════════════════════════════════════════════════════════
  // GLUCOSE
  // ═══════════════════════════════════════════════════════════════════════

  { id:'GluAC',
    pattern: /(?:Glucose(?:\([^)]*\))?|GLU[\s-]*(?:AC)?|Sugar(?:\([^)]*\))?|AC[\s-]*Sugar|飯前血糖):\s*([\d.]+)/i,
    displayName:'空腹血糖 (AC Sugar)', shortLabel:'空腹血糖',
    unit:'mg/dL', category:'血糖',
    ref:'74–100 mg/dL',
    refLo:74, refHi:100, hi:100, lo:74,
    notes:'Matches Glucose(...), GLU, GLU-AC, Sugar(...), AC Sugar, 飯前血糖 — many hospital label variants.' },

  { id:'HbA1c',
    pattern: /HBA[I1]C%?:\s*([\d.]+)/i,
    displayName:'糖化血色素 (HbA1c)', shortLabel:'HbA1c',
    unit:'%', category:'血糖',
    ref:'4–6 %',
    refLo:4, refHi:6, hi:6, lo:null,
    notes:'Pattern allows HBA1C and HBAIC (some systems print I instead of 1).' },

  // ═══════════════════════════════════════════════════════════════════════
  // RENAL FUNCTION
  // ═══════════════════════════════════════════════════════════════════════

  { id:'BUN',
    pattern: /BUN:\s*([\d.]+)/,
    displayName:'血尿素氮 (BUN)', shortLabel:'BUN',
    unit:'mg/dL', category:'腎功能',
    ref:'男 8.9–20.6，女 7.0–18.7 mg/dL',
    refLo:7, refHi:25,
    hiM:20.6, hiF:18.7,
    hi:25.7, lo:null,
    notes:'Fallback hi:25.7 is the original soft buffer for unknown gender; known-gender uses hiM/hiF for precision.' },

  // BUN_pre / BUN_post — dialysis-specific. Only the reporter uses these.
  // The orderNameFilter discriminates pre-dialysis (composite panel
  // containing comma in orderName) from post-dialysis (standalone "BUN" order).
  { id:'BUN_pre',
    pattern: /BUN:\s*([\d.]+)/,
    orderNameFilter: /,/,
    displayName:'BUN（洗前）', shortLabel:'BUN(洗前)',
    unit:'mg/dL', category:'腎功能',
    ref:'7–25 mg/dL',
    refLo:7, refHi:25, hi:25, lo:7,
    meaning:'透析前 BUN — 與 BUN_post 配對計算 URR',
    notes:'Filter selects orders whose orderName contains a comma (composite dialysis panel).' },

  { id:'BUN_post',
    pattern: /BUN:\s*([\d.]+)/,
    orderNameFilter: /^BUN$/i,
    displayName:'BUN（洗後）', shortLabel:'BUN(洗後)',
    unit:'mg/dL', category:'腎功能',
    ref:'',
    refLo:null, refHi:null, hi:null, lo:null,
    meaning:'透析後 BUN — 通常 6–7，與 BUN_pre 配對計算 URR',
    notes:'Filter selects orders where orderName is exactly "BUN" (standalone post-dialysis draw).' },

  { id:'CREAT',
    pattern: /(?:Creatinine\(serum\)|CREAT):\s*([\d.]+)/i,
    displayName:'肌酸酐 (Creatinine, Cr)', shortLabel:'Cr',
    unit:'mg/dL', category:'腎功能',
    ref:'男 0.6–1.2，女 0.5–1.0 mg/dL',
    refLo:0.5, refHi:1.3,
    hiM:1.2, hiF:1.0,
    hi:1.2, lo:null,
    notes:'Pattern matches "Creatinine(serum):" and "CREAT:" but NOT "Creatinine(24hrs Urine):".' },

  { id:'UA',
    pattern: /(?:UA|Uric\s*acid):\s*([\d.]+)/i,
    displayName:'尿酸 (Uric acid, UA)', shortLabel:'UA',
    unit:'mg/dL', category:'腎功能',
    ref:'男 3.3–7.7，女 2.5–6.2 mg/dL',
    refLo:2.5, refHi:7.7,
    hiM:7.7, hiF:6.2,
    hi:7.7, lo:null },

  { id:'eGFR',
    pattern: /(?:Creatinine\(serum\)|CREAT):\s*([\d.]+)/i,
    computed:'eGFR',
    displayName:'腎絲球過濾率 (eGFR)', shortLabel:'eGFR',
    unit:'mL/min/1.73m²', category:'腎功能',
    ref:'> 60 mL/min/1.73m²',
    refLo:60, refHi:null, hi:null, lo:60,
    meaning:'腎功能指標',
    notes:'Computed from Creatinine via CKD-EPI 2021 (race-free). Pattern shares Creatinine capture so the same regex works.' },

  { id:'UACR',
    pattern: /(?:U-?ACR|UACR|Alb(?:umin)?\/Cr(?:eatinine)?|Urine\s*Alb\/Cr):\s*([\d.]+)/i,
    displayName:'尿白蛋白／肌酸酐比 (UACR)', shortLabel:'UACR',
    unit:'mg/g', category:'腎功能',
    ref:'< 30 mg/g',
    refLo:null, refHi:30, hi:30, lo:null,
    meaning:'腎臟早期傷害指標',
    notes:'Viewer fetches sub-pages from opdweb (1-year window) when UACR not in main reportText.' },

  { id:'UPCR',
    pattern: /(?:U-?PCR|UPCR|RATTC|TP\/Cr|Pr(?:otein)?\/Cr(?:eatinine)?|Urine\s*TP\/Cr):\s*([\d.]+)/i,
    displayName:'尿蛋白／肌酸酐比 (UPCR)', shortLabel:'UPCR',
    unit:'mg/g', category:'腎功能',
    ref:'< 150 mg/g',
    refLo:null, refHi:150, hi:150, lo:null,
    notes:'RATTC label is also used at some sites for total-protein/creatinine ratio.' },

  // ═══════════════════════════════════════════════════════════════════════
  // KIDNEY DISEASE STAGING (computed)
  // ═══════════════════════════════════════════════════════════════════════

  { id:'GFRStage',  computed:'GFRStage',  pattern:null,
    displayName:'GFR 分級 (正常, CKD2-5)', category:'腎臟病分期' },

  { id:'UACRStage', computed:'UACRStage', pattern:null,
    displayName:'微蛋白尿(UACR)分級 (正常, A2-3)', category:'腎臟病分期' },

  { id:'UPCRStage', computed:'UPCRStage', pattern:null,
    displayName:'蛋白尿(UPCR)分級 (正常/輕度/顯著/腎病)', category:'腎臟病分期' },

  { id:'KDIGORisk', computed:'KDIGORisk', pattern:null,
    displayName:'腎臟病風險 (KDIGO, 低/中/高/極高)', category:'腎臟病分期' },

  { id:'TaiwanCKD', computed:'TaiwanCKD', pattern:null,
    displayName:'慢性腎臟病分期 (正常, 第1~5期)', category:'腎臟病分期' },

  { id:'EarlyCKD',  computed:'EarlyCKD',  pattern:null,
    displayName:'健保 CKD 分群 (P1早期/P2中晚期)', category:'腎臟病分期' },

  // ═══════════════════════════════════════════════════════════════════════
  // ELECTROLYTES
  // ═══════════════════════════════════════════════════════════════════════

  { id:'Na',
    pattern: /NA\(Serum\):\s*([\d.]+)/,
    displayName:'鈉 (Na)', shortLabel:'Na',
    unit:'mmol/L', category:'電解質',
    ref:'136–145 mmol/L',
    refLo:136, refHi:145, hi:145, lo:136 },

  { id:'K',
    pattern: /K \(Serum\):\s*([\d.]+)/,
    displayName:'鉀 (K)', shortLabel:'K',
    unit:'mmol/L', category:'電解質',
    ref:'3.5–5.1 mmol/L',
    refLo:3.5, refHi:5.1, hi:5.1, lo:3.5 },

  { id:'Cl',
    pattern: /Cl\(Serum\):\s*([\d.]+)/,
    displayName:'氯 (Cl)', shortLabel:'Cl',
    unit:'mmol/L', category:'電解質',
    ref:'98–107 mmol/L',
    refLo:98, refHi:107, hi:107, lo:98 },

  { id:'Ca',
    pattern: /Calcium\(Serum\):\s*([\d.]+)/,
    displayName:'鈣 (Ca)', shortLabel:'Ca',
    unit:'mg/dL', category:'電解質',
    ref:'8.6–10.3 mg/dL',
    refLo:8.6, refHi:10.3, hi:10.3, lo:8.6 },

  { id:'FreeCa',
    pattern: /Free Ca\+\+:\s*([\d.]+)/,
    displayName:'游離鈣 (Free Ca)', shortLabel:'Free Ca',
    unit:'mmol/L', category:'電解質',
    ref:'1.15–1.32 mmol/L',
    refLo:1.15, refHi:1.32, hi:1.32, lo:1.15 },

  { id:'P',
    pattern: /Phosphorus:\s*([\d.]+)/,
    displayName:'磷 (P)', shortLabel:'P',
    unit:'mg/dL', category:'電解質',
    ref:'2.5–5.0 mg/dL',
    refLo:2.5, refHi:5.0, hi:5.0, lo:2.5 },

  { id:'Mg',
    pattern: /MG:\s*([\d.]+)/,
    displayName:'鎂 (Magnesium, Mg)', shortLabel:'Mg',
    unit:'mg/dL', category:'電解質',
    ref:'1.6–2.6 mg/dL',
    refLo:1.6, refHi:2.6, hi:2.6, lo:1.6 },

  // ═══════════════════════════════════════════════════════════════════════
  // IRON METABOLISM
  // ═══════════════════════════════════════════════════════════════════════

  // vhyl sample (2026-05-05): "更正報告 FE: 58TIBC: 267.00TS: 22"
  { id:'Fe',
    pattern: /(?:Fe|Iron)\s*(?:\((?:TT|YL)\))?:\s*([\d.]+)/i,
    displayName:'血清鐵 (Fe)', shortLabel:'Fe',
    unit:'µg/dL', category:'鐵代謝',
    ref:'男 65–175，女 50–170 µg/dL',
    refLo:50, refHi:175,
    loM:65, hiM:175, loF:50, hiF:170,
    lo:50, hi:175 },

  { id:'TIBC',
    pattern: /TIBC:\s*([\d.]+)/,
    displayName:'總鐵結合力 (TIBC)', shortLabel:'TIBC',
    unit:'µg/dL', category:'鐵代謝',
    ref:'男 134–415，女 120–480 µg/dL',
    refLo:120, refHi:480,
    loM:134, hiM:415, loF:120, hiF:480,
    lo:120, hi:480 },

  // vhyl sample (2026-05-05): "更正報告 FE: 58TIBC: 267.00TS: 22"
  { id:'TSAT',
    pattern: /(?<![A-Za-z])(?:TSAT|TS|SAT):\s*([\d.]+)/,
    displayName:'鐵飽和度 (TSAT)', shortLabel:'TSAT',
    unit:'%', category:'鐵代謝',
    ref:'20–45 %',
    refLo:20, refHi:45, hi:45, lo:20 },

  { id:'Ferritin',
    pattern: /(?:Ferritin|FERRITIN):\s*([<>]?\s*[\d.]+)/i,
    displayName:'鐵蛋白 (Ferritin)', shortLabel:'Ferritin',
    unit:'ng/mL', category:'鐵代謝',
    ref:'男 21.81–274.66，女 4.63–204.00 ng/mL',
    refLo:4.63, refHi:274.66,
    loM:21.81, hiM:274.66, loF:4.63, hiF:204.00,
    lo:4.63, hi:274.66,
    notes:'Capture allows leading <> operator (handles "<5.0", ">2000" results).' },

  // ═══════════════════════════════════════════════════════════════════════
  // PARATHYROID + VITAMINS
  // ═══════════════════════════════════════════════════════════════════════

  { id:'iPTH',
    pattern: /i-PTH:\s*([\d.]+)/,
    displayName:'副甲狀腺素 (iPTH)', shortLabel:'i-PTH',
    unit:'pg/mL', category:'副甲狀腺',
    ref:'15–68.3 pg/mL',
    refLo:15, refHi:68.3, hi:68.3, lo:15 },

  { id:'VitB12',
    pattern: /(?:Vit(?:amin)?\.?\s*B12|VIT\.?\s*B12|B12):\s*([\d.]+)/i,
    displayName:'維生素 B12 (Vit. B12)', shortLabel:'Vit B12',
    unit:'pg/mL', category:'維生素',
    ref:'187–883 pg/mL',
    refLo:187, refHi:883, hi:883, lo:187,
    notes:'Matches "Vit. B12:", "Vitamin B12:", "VIT.B12:", "B12:".' },

  { id:'FolicAcid',
    pattern: /(?:Folic\s+acid|Folate):\s*([\d.]+)/i,
    displayName:'葉酸 (Folic Acid)', shortLabel:'Folate',
    unit:'ng/mL', category:'維生素',
    ref:'3.1–20.5 ng/mL',
    refLo:3.1, refHi:20.5, hi:20.5, lo:3.1,
    notes:'Allows variable internal whitespace (some hospitals print "Folic  acid:" with double space).' },

  // ═══════════════════════════════════════════════════════════════════════
  // TUMOR MARKERS
  // ═══════════════════════════════════════════════════════════════════════

  // vhyl sample (2026-05-05): "正式報告 AFP(YL): < 2.00"
  { id:'AFP',
    pattern: /AFP\s*(?:\((?:TT|YL)\))?:\s*([<>]?\s*[\d.]+)/,
    displayName:'甲胎蛋白 (AFP)', shortLabel:'AFP',
    unit:'ng/mL', category:'癌症指數',
    ref:'< 20 ng/mL（肝臟）',
    refLo:null, refHi:20, hi:20, lo:null },

  { id:'CEA',
    pattern: /CEA:\s*([<>]?[\d.]+)/,
    displayName:'癌胚抗原 (CEA)', shortLabel:'CEA',
    unit:'ng/mL', category:'癌症指數',
    ref:'< 5 ng/mL（大腸直腸）',
    refLo:null, refHi:5, hi:5, lo:null },

  { id:'CA199',
    pattern: /CA.?19.?9:\s*([<>]?[\d.]+)/i,
    displayName:'CA-199', shortLabel:'CA-199',
    unit:'U/mL', category:'癌症指數',
    ref:'< 37 U/mL（胰臟、膽道）',
    refLo:null, refHi:37, hi:37, lo:null },

  { id:'PSA',
    pattern: /\bPSA:\s*([\d.]+)/,
    displayName:'攝護腺特異抗原 (PSA)', shortLabel:'PSA',
    unit:'ng/mL', category:'癌症指數',
    ref:'< 4 ng/mL（男性／攝護腺）',
    refLo:null, refHi:4, hi:4, lo:null,
    gender:'M' },

  { id:'FreePSA',
    pattern: /(?:Free PSA|RATIO):\s*([\d.]+)/,
    displayName:'游離 PSA (Free PSA)', shortLabel:'Free PSA',
    unit:'ng/mL', category:'癌症指數',
    gender:'M' },

  { id:'PSARatio', computed:'PSARatio', pattern:null,
    displayName:'Free/Total PSA 比值', shortLabel:'F/T PSA',
    unit:'%', category:'癌症指數',
    ref:'>25% 正常，10-25% 注意，<10% 警示',
    meaning:'PSA>4 時參考此比值',
    gender:'M' },

  { id:'CA125',
    pattern: /CA[-\s.]?125:\s*([<>]?[\d.]+)/i,
    displayName:'CA-125', shortLabel:'CA-125',
    unit:'U/mL', category:'癌症指數',
    ref:'< 35 U/mL（女性／卵巢）',
    refLo:null, refHi:35, hi:35, lo:null,
    gender:'F' },

  // ═══════════════════════════════════════════════════════════════════════
  // THYROID
  // ═══════════════════════════════════════════════════════════════════════

  { id:'TSH',
    pattern: /TSH:\s*([\d.]+)/,
    displayName:'促甲狀腺刺激素 (TSH)', shortLabel:'TSH',
    unit:'µIU/mL', category:'甲狀腺',
    ref:'0.35–4.94 µIU/mL',
    refLo:0.35, refHi:4.94, hi:4.94, lo:0.35 },

  { id:'FreeT4',
    pattern: /Free T4:\s*([\d.]+)/,
    displayName:'游離甲狀腺素 (Free T4)', shortLabel:'fT4',
    unit:'ng/dL', category:'甲狀腺',
    ref:'0.7–1.48 ng/dL',
    refLo:0.7, refHi:1.48, hi:1.48, lo:0.7 },

  // ═══════════════════════════════════════════════════════════════════════
  // HEPATITIS / INFECTION (qualitative — values are text, not numbers)
  // ═══════════════════════════════════════════════════════════════════════

  // Raw qualitative pattern — used by reporter for direct table display.
  // Viewer overrides these in its manifest with `computed: '<id>'` to render
  // a patient-friendly verdict (帶原 / 正常) via report.js helpers.

  // vhyl sample (2026-05-05): "正式報告 HBsAg: 0.21HBsAg (YL): Non-Reactive (Non-Reactive)"
  { id:'HBsAg',
    pattern: /HBsAg\s*(?:\((?:TT|YL)\))?:\s*([^\s\d]\S*)/,
    displayName:'B型肝炎表面抗原 (HBsAg)', shortLabel:'HBsAg',
    category:'肝炎 / 感染',
    qualitative:true,
    notes:'(TT) suffix used at vhtt; alternation handles both hospitals.' },

  // vhyl sample (2026-05-06): aligned to HBsAg/AntiHCV style — accepts
  // optional (TT|YL) hospital tag and stops the value capture before any
  // digits so vhyl's concatenated numeric+qualitative line parses cleanly.
  { id:'AntiHBs',
    pattern: /Anti-HBs\s*(?:\((?:TT|YL)\))?:\s*([^\s\d]\S*)/,
    displayName:'B型肝炎表面抗體 (Anti-HBs)', shortLabel:'Anti-HBs',
    category:'肝炎 / 感染',
    qualitative:true,
    meaning:'疫苗免疫指標' },

  // vhyl sample (2026-05-05): "正式報告 Anti-HCV: 0.12Anti-HCV (YL): Non-Reactive (Non-Reactive)"
  { id:'AntiHCV',
    pattern: /(?:HCV Ab|Anti-HCV)\s*(?:\((?:TT|YL)\))?:\s*([^\s\d]\S*)/,
    displayName:'C型肝炎抗體 (Anti-HCV)', shortLabel:'Anti-HCV',
    category:'肝炎 / 感染',
    qualitative:true,
    notes:'vhtt uses "HCV Ab(TT):", vhyl uses "Anti-HCV:".' },

  // Raw numeric titer entries — viewer's computed display wrappers consume
  // these to produce 帶原/正常/有抗體 + (label titer) tuples. vhyl emits
  // "HBsAg: 0.21HBsAg (YL): Non-Reactive" — \[\d.\]+ stops at the next "H"
  // so we get the numeric without the qualitative text bleeding in.
  { id:'HBsAgTiter',
    pattern: /HBsAg:\s*([\d.]+)/,
    displayName:'HBsAg 滴度', shortLabel:'HBsAg titer',
    unit:'', category:'肝炎 / 感染',
    notes:'Numeric titer for HBsAg. Consumed by HBsAgDisplay computed wrapper.' },

  { id:'AntiHBsTiter',
    pattern: /Anti-HBs:\s*([\d.]+)/,
    displayName:'Anti-HBs 滴度', shortLabel:'Anti-HBs titer',
    unit:'', category:'肝炎 / 感染',
    notes:'Numeric titer for Anti-HBs. Consumed by AntiHBsDisplay computed wrapper.' },

  { id:'AntiHCVTiter',
    pattern: /(?:HCV Ab|Anti-HCV):\s*([\d.]+)/,
    displayName:'Anti-HCV 滴度', shortLabel:'Anti-HCV titer',
    unit:'', category:'肝炎 / 感染',
    notes:'Numeric titer for Anti-HCV. Consumed by HCV computed wrapper.' },

  // Computed display wrappers — viewer points its manifest at these ids
  // (HCV / HBsAgDisplay / AntiHBsDisplay) to render the patient-friendly
  // verdict tuple. Reporter keeps using raw HBsAg / AntiHBs / AntiHCV.
  { id:'HBsAgDisplay', computed:'HBsAgDisplay', pattern:null,
    needs:['HBsAg','HBsAgTiter'],
    displayName:'B型肝炎(顯示)', shortLabel:'HBsAg',
    category:'肝炎 / 感染',
    qualitative:true, singleValue:true,
    notes:'Computed display wrapper. viewer 用此 id 顯示;reporter 用 raw HBsAg。' },

  { id:'AntiHBsDisplay', computed:'AntiHBsDisplay', pattern:null,
    needs:['AntiHBs','AntiHBsTiter'],
    displayName:'B肝抗體(顯示)', shortLabel:'Anti-HBs',
    category:'肝炎 / 感染',
    qualitative:true, singleValue:true,
    notes:'Anti-HBs polarity 與 HBsAg/HCV 相反:Reactive=有抗體=normal。' },

  // Viewer's computed wrapper — same concept as AntiHCV, but produces
  // 帶原/正常 + numeric titer for the patient handout. Kept as a separate
  // catalog entry so report.js's special-case code can reference id "HCV".
  { id:'HCV', computed:'HCV', pattern:null,
    needs:['AntiHCV','AntiHCVTiter'],
    displayName:'C型肝炎', shortLabel:'HCV',
    category:'肝炎 / 感染',
    qualitative:true, singleValue:true,
    notes:'Computed display wrapper around AntiHCV raw + AntiHCVTiter numeric.' },

  { id:'HIV',
    pattern: /HIV[^:]*:\s*(\S+)/i,
    displayName:'HIV', shortLabel:'HIV',
    category:'肝炎 / 感染',
    qualitative:true },

  { id:'RPR',
    pattern: /REACT:\s*(\S+)/,
    displayName:'RPR 梅毒篩檢', shortLabel:'RPR',
    category:'肝炎 / 感染',
    qualitative:true,
    notes:'Reporter uses raw REACT pattern; viewer overrides with computed wrapper for titer + verdict.' },

  { id:'TPHA',
    pattern: /TPHA(?:\(TT\))?:\s*(\S+)/,
    displayName:'TPHA 梅毒血球凝集試驗', shortLabel:'TPHA',
    category:'肝炎 / 感染',
    qualitative:true },

  // ═══════════════════════════════════════════════════════════════════════
  // HIV MONITORING (only rendered when HIV checkbox is on in viewer)
  // ═══════════════════════════════════════════════════════════════════════

  { id:'HIVLoad',
    pattern: /HIV virus load:\s*([\d,.]+)/,
    displayName:'HIV 病毒量 (Viral Load)', shortLabel:'HIV VL',
    category:'HIV',
    notes:'Capture allows commas (thousands separator).' },

  { id:'CD4',
    pattern: /LEU3AN:\s*([\d.]+)/,
    displayName:'CD4 淋巴球 (LEU3AN)', shortLabel:'CD4',
    category:'HIV' },

  // ═══════════════════════════════════════════════════════════════════════
  // IMAGING / TEXT-BLOCK ENTRIES (page 2 of viewer — fillable text forms)
  // ═══════════════════════════════════════════════════════════════════════

  { id:'BoneDensity',
    kind:'text',
    orderNameMatch: /骨(?:質|密|鬆)|DEXA|BMD|Bone\s*Density|T[-\s]?score/i,
    rows: [
      { label:'AI分析',
        fields:[{ name:'T分數', pattern:/AI[^0-9\-]{0,15}(-?\d+\.?\d*)/i }],
        options:['疏鬆','缺損','正常'] },
      { label:'腰椎',
        fields:[{ name:'T分數', pattern:/(?:腰椎|Lumbar|L[\s-]?spine|L1-?L4)[^0-9\-]{0,15}(-?\d+\.?\d*)/i }],
        options:['疏鬆','缺損','正常'] },
      { label:'髖關節',
        fields:[{ name:'T分數', pattern:/(?:髖(?:關節)?|Hip|Femoral|Femur)[^0-9\-]{0,15}(-?\d+\.?\d*)/i }],
        options:['疏鬆','缺損','正常'] },
    ],
    displayName:'骨密度', category:'影像 / 文字報告' },

  { id:'Endoscopy',
    kind:'text',
    orderNameMatch: /胃鏡|內視鏡|UGI|Endoscop|Gastroscop|EGD|Panendoscop/i,
    rows: [
      { label:'上消化道', options:['胃食道逆流','胃潰瘍','十二指腸潰瘍'], trailing:'胃藥治療' },
      { label:'細菌',     options:['胃幽門桿菌'],                            trailing:'三合一治療' },
    ],
    displayName:'上消化道內視鏡', category:'影像 / 文字報告' },

  { id:'AbdSono',
    kind:'text',
    orderNameMatch: /超音波|Sonograph|Ultrasound|Abd.*Echo|Abdominal\s*US|腹部.*US/i,
    rows: [
      { label:'肝臟', options:['正常','脂肪肝','水泡','血管瘤'] },
      { label:'膽',   options:['正常','膽結石','膽息肉'] },
      { label:'右腎', options:['正常','水泡','萎縮','結石'] },
      { label:'左腎', options:['正常','水泡','萎縮','結石'] },
    ],
    displayName:'腹部超音波', category:'影像 / 文字報告' },

];

// ─── Exports (CommonJS + browser global) ─────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CATALOG;
}
if (typeof window !== 'undefined') {
  window.HOSPITAL_LAB_PATTERNS_CATALOG = CATALOG;
}
'use strict';

/**
 * viewer.js — Manifest for the outpatient handout (hospital-lab-viewer).
 *
 * Each entry references a catalog id (see catalog.js for the master
 * definitions) and adds viewer-specific layout (page/col/section) plus any
 * per-app overrides (e.g. tighter hi/lo thresholds, qualitative computed
 * wrappers).
 *
 * To add a test to the printout:
 *   1. Make sure it exists in catalog.js (add it there if it doesn't).
 *   2. Append a manifest entry below in the appropriate section/column.
 *   3. Run `node sync-patterns.js` from hospital-lab-viewer/.
 *
 * Two equivalent forms accepted:
 *   - String: just the id        e.g.  'WBC'
 *   - Object: id + overrides     e.g.  { id:'WBC', page:1, col:3, section:'血液' }
 *
 * Resolution: index.js merges each manifest entry on top of its catalog
 * entry. Manifest fields override catalog defaults.
 */

const VIEWER_MANIFEST = [

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1
  // ═══════════════════════════════════════════════════════════════════════

  // ── Col 1 │ 血糖 ──────────────────────────────────────────────────────
  { id:'GluAC', page:1, col:1, section:'血糖' },
  { id:'HbA1c', page:1, col:1, section:'血糖' },

  // ── Col 1 │ 血脂肪 ────────────────────────────────────────────────────
  { id:'CHOL', page:1, col:1, section:'血脂肪' },
  { id:'HDLC', page:1, col:1, section:'血脂肪' },
  { id:'LDL',  page:1, col:1, section:'血脂肪' },
  { id:'TG',   page:1, col:1, section:'血脂肪' },

  // ── Col 1 │ 肝功能 ────────────────────────────────────────────────────
  { id:'GOT', page:1, col:1, section:'肝功能' },
  { id:'GPT', page:1, col:1, section:'肝功能' },
  { id:'RGT', page:1, col:1, section:'肝功能' },
  { id:'ALP', page:1, col:1, section:'肝功能' },

  // ── Col 2 │ 腎功能 ────────────────────────────────────────────────────
  { id:'BUN',   page:1, col:2, section:'腎功能' },
  { id:'CREAT', page:1, col:2, section:'腎功能' },
  { id:'UA',    page:1, col:2, section:'腎功能' },
  { id:'eGFR',  page:1, col:2, section:'腎功能' },
  { id:'UACR',  page:1, col:2, section:'腎功能' },
  { id:'UPCR',  page:1, col:2, section:'腎功能' },

  // ── Col 2 │ 腎臟病分期 (computed) ────────────────────────────────────
  { id:'GFRStage',  page:1, col:2, section:'腎臟病分期' },
  { id:'UACRStage', page:1, col:2, section:'腎臟病分期' },
  { id:'UPCRStage', page:1, col:2, section:'腎臟病分期' },
  { id:'KDIGORisk', page:1, col:2, section:'腎臟病分期' },
  { id:'TaiwanCKD', page:1, col:2, section:'腎臟病分期' },
  { id:'EarlyCKD',  page:1, col:2, section:'腎臟病分期' },

  // ── Col 3 │ 血液 ──────────────────────────────────────────────────────
  // Viewer uses tighter clinical-action thresholds for outpatient education
  // than the catalog's broader reference range.
  { id:'RBC',      page:1, col:3, section:'血液' },
  { id:'WBC',      page:1, col:3, section:'血液',
    hi:10, lo:5.0, ref:'5.0–10.0 ×10³/µL' },
  { id:'Hb',       page:1, col:3, section:'血液' },
  { id:'Platelet', page:1, col:3, section:'血液' },

  // ── Col 3 │ 營養／電解質 ─────────────────────────────────────────────
  // Trimmed nutrition column per user request (2026-05-03).
  // Removed: TP, Cl, Ca, P, TIBC, TSAT, Ferritin, iPTH, Mg.
  // Removed dialysis-specific BUN_pre / BUN_post (section 腎功能（透析）).
  { id:'Albumin',   page:1, col:3, section:'營養／電解質' },
  { id:'Na',        page:1, col:3, section:'營養／電解質' },
  { id:'K',         page:1, col:3, section:'營養／電解質' },
  { id:'FreeCa',    page:1, col:3, section:'營養／電解質' },
  { id:'Fe',        page:1, col:3, section:'營養／電解質' },
  { id:'VitB12',    page:1, col:3, section:'營養／電解質' },
  { id:'FolicAcid', page:1, col:3, section:'營養／電解質' },

  // ── Col 4 │ 癌症指數 ─────────────────────────────────────────────────
  { id:'AFP',      page:1, col:4, section:'癌症指數' },
  { id:'CEA',      page:1, col:4, section:'癌症指數' },
  { id:'CA199',    page:1, col:4, section:'癌症指數' },
  { id:'PSA',      page:1, col:4, section:'癌症指數' },
  { id:'FreePSA',  page:1, col:4, section:'癌症指數' },
  { id:'PSARatio', page:1, col:4, section:'癌症指數' },
  { id:'CA125',    page:1, col:4, section:'癌症指數' },

  // ── Col 4 │ 甲狀腺 ───────────────────────────────────────────────────
  { id:'TSH',    page:1, col:4, section:'甲狀腺' },
  { id:'FreeT4', page:1, col:4, section:'甲狀腺' },

  // ── Col 4 │ 肝炎 ─────────────────────────────────────────────────────
  // Bilirubin numerics rendered alongside the qualitative hepatitis tests.
  // HCV / HBsAgDisplay / AntiHBsDisplay are computed wrappers from
  // catalog (singleValue:true) — they consume raw qualitative + raw titer
  // entries (extract-only entries below) and produce 帶原/正常/有抗體 +
  // (label titer) verdict tuples. Phase 2 (viewer): report.js will gain
  // a small dispatcher that runs PATTERNS_COMPUTED.{HCV,HBsAgDisplay,
  // AntiHBsDisplay} against `map` and writes back the verdict entries.
  { id:'DBIL',           page:1, col:4, section:'肝炎' },
  { id:'TBIL',           page:1, col:4, section:'肝炎' },
  { id:'HCV',            page:1, col:4, section:'肝炎' },
  { id:'HBsAgDisplay',   page:1, col:4, section:'肝炎' },
  { id:'AntiHBsDisplay', page:1, col:4, section:'肝炎' },

  // Extract-only entries — no page/col so render skips them, but the
  // parse loop in viewer report.js (which iterates the resolved manifest)
  // populates map[id] with regex matches. Required so HCV /
  // HBsAgDisplay / AntiHBsDisplay computed wrappers have inputs.
  { id:'HBsAg' },
  { id:'HBsAgTiter' },
  { id:'AntiHBs' },
  { id:'AntiHBsTiter' },
  { id:'AntiHCV' },
  { id:'AntiHCVTiter' },

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2 — text-block entries (DEXA / endoscopy / sono)
  // ═══════════════════════════════════════════════════════════════════════

  { id:'BoneDensity', page:2, col:1, section:'骨質疏鬆 (Bone Density)' },
  { id:'Endoscopy',   page:2, col:2, section:'胃鏡 (Endoscopy)' },
  { id:'AbdSono',     page:2, col:3, section:'超音波 (Ultrasound)' },

  // ── Page 2 │ HIV section (only rendered when HIV checkbox is on) ─────
  { id:'HIVLoad', page:2, col:3, section:'HIV', hivOnly:true },
  { id:'CD4',     page:2, col:3, section:'HIV', hivOnly:true },
  { id:'RPR',     page:2, col:3, section:'HIV', hivOnly:true,
    computed:'RPR',  pattern:null, singleValue:true },
  { id:'TPHA',    page:2, col:3, section:'HIV', hivOnly:true,
    computed:'TPHA', pattern:null, singleValue:true },

];

// ─── Exports (CommonJS + browser global) ─────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VIEWER_MANIFEST;
}
if (typeof window !== 'undefined') {
  window.HOSPITAL_LAB_PATTERNS_VIEWER_MANIFEST = VIEWER_MANIFEST;
}

// ─── Resolver: merge each manifest entry on top of its catalog entry ──
//      (rehydrates string `normalize` references using NORMALIZERS)
function _resolveManifest(manifest, cat) {
  var byId = new Map(cat.map(function (e) { return [e.id, e]; }));
  var out = [];
  manifest.forEach(function (m) {
    var id = typeof m === "string" ? m : m.id;
    var base = byId.get(id);
    if (!base) {
      console.warn("[mapping.js] manifest references unknown id: " + id);
      return;
    }
    var merged = typeof m === "string"
      ? Object.assign({}, base)
      : Object.assign({}, base, m);
    if (typeof merged.normalize === "string" && NORMALIZERS[merged.normalize]) {
      merged.normalize = NORMALIZERS[merged.normalize];
    }
    out.push(merged);
  });
  return out;
}

var VIEWER_CATALOG = _resolveManifest(VIEWER_MANIFEST, CATALOG);

// ─── Backwards-compat alias: TEST_MAP is what popup.js / report.js use ─
var TEST_MAP = VIEWER_CATALOG;
if (typeof window !== "undefined") {
  window.TEST_MAP        = TEST_MAP;
  window.VIEWER_CATALOG  = VIEWER_CATALOG;
  window.HOSPITAL_LAB_PATTERNS_BUNDLED_AT = "2026-05-05T21:13:50.289Z";
}
