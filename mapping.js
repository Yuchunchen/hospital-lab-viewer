// ════════════════════════════════════════════════════════════════════════════
// AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
//
// Source of truth: hospital-lab-patterns repo (catalog.js + viewer.js + normalizers.js + lib/resolveRef.js)
//   https://github.com/Yuchunchen/hospital-lab-patterns
//
// To update:
//   1. Edit ../hospital-lab-patterns/patterns/<file>.js
//   2. git commit + git push (in the patterns repo)
//   3. cd hospital-lab-viewer && node sync-patterns.js
//   4. Reload the extension at chrome://extensions
//
// Synced at: 2026-06-18T23:02:42.022Z
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
    pattern: /WBC:\s*([<>]?\s*[\d.]+)(?!\s*[-–]\s*\d)/,
    displayName:'白血球 (WBC)', shortLabel:'WBC',
    unit:'×10³/µL', category:'血液',
    ref:'4.0–11.0 ×10³/µL',
    refLo:4.0, refHi:11.0, hi:11, lo:4,
    normalize: 'wbcCount',
    notes:'Negative lookahead in pattern rejects urine routine "WBC: 0-5". Normalize handles /µL (e.g. 6700) → ×10³/µL (6.7).',
    refHistory: [{ machine:'*', refLo:4, refHi:11, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'RBC',
    pattern: /\bRBC:\s*([<>]?\s*[\d.]+)(?!\s*[-–]\s*\d)/,
    displayName:'紅血球 (RBC)', shortLabel:'RBC',
    unit:'×10⁶/µL', category:'血液',
    ref:'男 4.2–6.2，女 3.7–5.5 ×10⁶/µL',
    refLo:3.7, refHi:6.2,
    loM:4.2, hiM:6.2, loF:3.7, hiF:5.5,
    lo:3.7, hi:6.2,
    notes:'Negative lookahead rejects urine routine "RBC: 0-2/HPF" ranges (2026-05-12, parallel to WBC). vhyl 000012148C surfaced URINE ROUTINE(YL) "RBC: 0-2" being captured as blood RBC=0.',
    refHistory: [{ machine:'*', refLo:3.7, refHi:6.2, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'Hb',
    pattern: /(?:Hb|HGB):\s*([<>]?\s*[\d.]+)/,
    displayName:'血色素 (Hemoglobin)', shortLabel:'Hb',
    unit:'g/dL', category:'血液',
    ref:'男 14–18，女 12–16 g/dL',
    refLo:12, refHi:18,
    loM:14, hiM:18, loF:12, hiF:16,
    lo:12, hi:18,
    notes:'Pattern matches both "Hb:" and "HGB:" labels.',
    refHistory: [
      { machine:'*', refLo:12, refHi:18, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:12.3, refHi:18.3, refLoM:12.3, refHiM:18.3, refLoF:11.3, refHiF:15.3, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md' },
    ] },

  { id:'HCT',
    pattern: /HCT:\s*([<>]?\s*[\d.]+)/,
    displayName:'血比容 (HCT)', shortLabel:'HCT',
    unit:'%', category:'血液',
    ref:'男 39–53，女 33–47 %',
    refLo:33, refHi:53,
    loM:39, hiM:53, loF:33, hiF:47,
    lo:33, hi:53,
    refHistory: [{ machine:'*', refLo:33, refHi:53, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'MCV',
    pattern: /MCV:\s*([<>]?\s*[\d.]+)/,
    displayName:'平均紅血球容積 (MCV)', shortLabel:'MCV',
    unit:'fL', category:'血液',
    ref:'79–99 fL',
    refLo:79, refHi:99, hi:99, lo:79,
    refHistory: [{ machine:'*', refLo:79, refHi:99, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'Platelet',
    pattern: /(?:Platelet|PLATE):\s*([<>]?\s*[\d.]+)/,
    displayName:'血小板 (Platelet)', shortLabel:'PLT',
    unit:'×10³/µL', category:'血液',
    ref:'150–400 ×10³/µL',
    refLo:150, refHi:400, hi:400, lo:150,
    normalize: 'plateletCount',
    notes:'Normalize handles /µL (e.g. 250000) → ×10³/µL (250).',
    refHistory: [
      { machine:'*', refLo:150, refHi:400, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:120, refHi:320, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md' },
    ] },

  // DC 五分類百分比 (differential count, %) — vhyl + vhtt 雙家
  // vhyl: order DC(YL),mnemonic NEUT/LYM/MONO/EOSINO/BASO,值各自一行。
  // vhtt: order Differential Count(D.C),mnemonic Neutrophil / Lymophocyte(EHR 拼字,
  //       非 Lymphocyte)/ Monocyte / Eosinophil / BASO|Basophil(兩變體都見過);reportText run-on 無分隔
  //       (值後直接接下個 label,如 ...Monocyte: 4.4Neutrophil: 73.9...)。
  // 故移除 `\b`:run-on 下「數字接字母」中間無 word boundary,留 `\b` 會抓不到。
  // 改走 CBC 同慣例(HCT/MCV/Platelet 皆無 `\b`,靠「Label:」當分隔)。
  // display-only,永久不放參考值(YC 2026-06-18 取消 Open #2;DC 不做 alarm 上色)。
  // 真機驗證 vhtt(2026-06-18):000032118G / 000019606F(含更正報告)/ 000115014H 皆 BASO;
  //   000105589G 為 Basophil 變體 → Baso pattern 用 (?:BASO|Basophil)。其餘四項跨病人一致。
  { id:'Neut',
    pattern: /(?:NEUT|Neutrophil):\s*([<>]?\s*[\d.]+)/,
    displayName:'嗜中性球 (Neutrophil %)', shortLabel:'Neut%',
    unit:'%', category:'血液' },

  { id:'Lymph',
    pattern: /(?:LYM|Lymophocyte):\s*([<>]?\s*[\d.]+)/,
    displayName:'淋巴球 (Lymphocyte %)', shortLabel:'Lym%',
    unit:'%', category:'血液' },

  { id:'Mono',
    pattern: /(?:MONO|Monocyte):\s*([<>]?\s*[\d.]+)/,
    displayName:'單核球 (Monocyte %)', shortLabel:'Mono%',
    unit:'%', category:'血液' },

  { id:'Eos',
    pattern: /(?:EOSINO|Eosinophil):\s*([<>]?\s*[\d.]+)/,
    displayName:'嗜酸性球 (Eosinophil %)', shortLabel:'Eos%',
    unit:'%', category:'血液' },

  { id:'Baso',
    pattern: /(?:BASO|Basophil):\s*([<>]?\s*[\d.]+)/,
    displayName:'嗜鹼性球 (Basophil %)', shortLabel:'Baso%',
    unit:'%', category:'血液' },

  // ═══════════════════════════════════════════════════════════════════════
  // PROTEINS
  // ═══════════════════════════════════════════════════════════════════════

  { id:'TP',
    pattern: /Total protein\(serum\):\s*([<>]?\s*[\d.]+)/i,
    displayName:'總蛋白 (Total Protein)', shortLabel:'TP',
    unit:'g/dL', category:'蛋白質',
    ref:'6.0–8.3 g/dL',
    refLo:6.0, refHi:8.3, hi:8.3, lo:6.0,
    refHistory: [{ machine:'*', refLo:6.0, refHi:8.3, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'Albumin',
    pattern: /(?:^|[\s;])Albumin(?:\([^)]*\))?:\s*([<>]?\s*[\d.]+)/i,
    displayName:'白蛋白 (Albumin)', shortLabel:'Alb',
    unit:'g/dL', category:'蛋白質',
    ref:'3.5–5.0 g/dL',
    refLo:3.5, refHi:5.0, hi:5.0, lo:3.5,
    meaning:'營養狀態指標',
    notes:'Boundary requirement (^ or whitespace/semicolon) prevents matching "U-Albumin:" or "Microalbumin:".',
    refHistory: [{ machine:'*', refLo:3.5, refHi:5.0, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  // ═══════════════════════════════════════════════════════════════════════
  // LIVER FUNCTION
  // ═══════════════════════════════════════════════════════════════════════

  { id:'GOT',
    pattern: /GOT:\s*([<>]?\s*[\d.]+)/,
    displayName:'天門冬胺酸轉氨酶 (GOT / AST)', shortLabel:'GOT/AST',
    unit:'U/L', category:'肝功能',
    ref:'5–34 U/L',
    refLo:5, refHi:34, hi:34, lo:null,
    refHistory: [
      { machine:'*', refLo:null, refHi:34, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:13, refHi:39, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md' },
    ] },

  { id:'GPT',
    pattern: /GPT:\s*([<>]?\s*[\d.]+)/,
    displayName:'丙胺酸轉氨酶 (GPT / ALT)', shortLabel:'GPT/ALT',
    unit:'U/L', category:'肝功能',
    ref:'男<45，女<34 U/L',
    refLo:7, refHi:45,
    hiM:45, hiF:34,
    hi:45, lo:null,
    refHistory: [
      { machine:'*', refLo:null, refHi:45, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:7, refHi:52, refLoM:7, refHiM:52, refLoF:7, refHiF:52, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md (vhtt 印 universal 7-52,inline 性別 mirror 是為了 suppress outer hiM:45/hiF:34 fallback)' },
    ] },

  { id:'RGT',
    pattern: /(?:r-?GT|R-?GT|γ-?GT|GGT|RGT):\s*([<>]?\s*[\d.]+)/i,
    displayName:'γ-麩胺醯轉移酶 (r-GT / GGT)', shortLabel:'r-GT',
    unit:'U/L', category:'肝功能',
    ref:'男 < 55，女 < 38 U/L',
    refLo:0, refHi:55,
    hiM:55, hiF:38,
    hi:55, lo:null,
    notes:'Pattern matches r-GT, R-GT, γ-GT, GGT, RGT — hospitals use various labels.',
    refHistory: [
      { machine:'*', refLo:null, refHi:55, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:9, refHi:64, validFrom:'2026-06-18', source:'YC cross-reference 2026-06-18 — chartno 000015165F r-GT(TT) 正式報告印 9-64 IU/L(無性別分項)' },
    ] },

  { id:'ALP',
    pattern: /(?:Alk[\s.\-]*P|ALP|Alkaline\s*Phosphatase):\s*([<>]?\s*[\d.]+)/i,
    displayName:'鹼性磷酸酶 (Alk-P / ALP)', shortLabel:'Alk-P',
    unit:'U/L', category:'肝功能',
    ref:'40–130 U/L',
    refLo:34, refHi:130, hi:130, lo:34,
    refHistory: [
      { machine:'*', refLo:34, refHi:130, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:34, refHi:104, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md' },
    ] },

  { id:'TBIL',
    pattern: /T-BIL:\s*([<>]?\s*[\d.]+)/,
    displayName:'總膽紅素 (T-BIL)', shortLabel:'T-BIL',
    unit:'mg/dL', category:'肝功能',
    ref:'0.3–1.0 mg/dL',
    refLo:0.3, refHi:1.0, hi:1.0, lo:null,
    refHistory: [{ machine:'*', refLo:null, refHi:1.0, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'DBIL',
    pattern: /D-BIL:\s*([<>]?\s*[\d.]+)/,
    displayName:'直接膽紅素 (D-BIL)', shortLabel:'D-BIL',
    unit:'mg/dL', category:'肝功能',
    ref:'0.03–0.18 mg/dL',
    refLo:0.03, refHi:0.18, hi:0.18, lo:null,
    refHistory: [{ machine:'*', refLo:null, refHi:0.18, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  // ═══════════════════════════════════════════════════════════════════════
  // LIPIDS
  // ═══════════════════════════════════════════════════════════════════════

  { id:'CHOL',
    pattern: /CHOL:\s*([<>]?\s*[\d.]+)/,
    displayName:'總膽固醇 (Cholesterol)', shortLabel:'CHOL',
    unit:'mg/dL', category:'血脂',
    ref:'< 200 mg/dL',
    refLo:null, refHi:200, hi:200, lo:null,
    refHistory: [{ machine:'*', refLo:null, refHi:200, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'HDLC',
    pattern: /HDLC:\s*([<>]?\s*[\d.]+)/,
    displayName:'高密度膽固醇 (HDL)', shortLabel:'HDL',
    unit:'mg/dL', category:'血脂',
    ref:'男 >40 mg/dL',
    refLo:40, refHi:null, hi:null, lo:40,
    meaning:'俗稱「好膽固醇」',
    refHistory: [{ machine:'*', refLo:40, refHi:null, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'LDL',
    pattern: /LDL-C:\s*([<>]?\s*[\d.]+)/,
    displayName:'低密度膽固醇 (LDL)', shortLabel:'LDL-C',
    unit:'mg/dL', category:'血脂',
    ref:'< 130 mg/dL',
    refLo:null, refHi:130, hi:130, lo:null,
    meaning:'俗稱「壞膽固醇」',
    refHistory: [
      { machine:'*', refLo:null, refHi:130, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:0, refHi:140, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md' },
    ] },

  { id:'TG',
    pattern: /Triglyceride:\s*([<>]?\s*[\d.]+)/,
    displayName:'三酸甘油脂 (Triglyceride)', shortLabel:'TG',
    unit:'mg/dL', category:'血脂',
    ref:'< 150 mg/dL',
    refLo:null, refHi:150, hi:150, lo:null,
    refHistory: [{ machine:'*', refLo:null, refHi:150, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  // ═══════════════════════════════════════════════════════════════════════
  // GLUCOSE
  // ═══════════════════════════════════════════════════════════════════════

  { id:'GluAC',
    // 2026-05-08: bare-Glucose alternation tightened to require the
    // parenthetical site qualifier (Glucose(AC-serum), Glucose(serum), ...).
    // The previous pattern's optional `\([^)]*\)?` was matching urine-routine
    // lines like "Glucose: 4+" inside CHEM EXAM(TT) reports — the [\d.]+
    // capture grabbed the leading 4 of "4+", storing GluAC = 4 mg/dL.
    // Verified bad case: vhtt 000026353G 115/02/26 (urine Glucose: 4+, but
    // serum AC sugar that day was 80). The new alternation only matches
    // Glucose when followed by `(...)`, so urine Glucose: 4+ is rejected.
    // Other label forms (GLU / GLU-AC / Sugar / 飯前血糖) are unaffected.
    pattern: /(?:Glucose\([^)]*\)|GLU[\s-]*(?:AC)?|Sugar(?:\([^)]*\))?|AC[\s-]*Sugar|飯前血糖):\s*([<>]?\s*[\d.]+)(?!\s*\+)/i,
    displayName:'空腹血糖 (AC Sugar)', shortLabel:'空腹血糖',
    unit:'mg/dL', category:'血糖',
    ref:'74–100 mg/dL',
    refLo:74, refHi:100, hi:100, lo:74,
    notes:'Matches Glucose(<site>), GLU, GLU-AC, Sugar(<site>), AC Sugar, 飯前血糖. Bare "Glucose:" intentionally NOT matched — urine routine Glucose: 4+ would otherwise capture "4" as a serum mg/dL value. 2026-05-12: also reject `+`-qualified gradient values (vhyl URINE ROUTINE(YL) GLU: 4+ was capturing 4).',
    refHistory: [
      { machine:'*', refLo:74, refHi:100, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:74, refHi:106, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md' },
    ] },

  { id:'HbA1c',
    pattern: /HBA[I1]C%?:\s*([<>]?\s*[\d.]+)/i,
    displayName:'糖化血色素 (HbA1c)', shortLabel:'HbA1c',
    unit:'%', category:'血糖',
    ref:'4–6 %',
    refLo:4, refHi:6, hi:6, lo:null,
    notes:'Pattern allows HBA1C and HBAIC (some systems print I instead of 1).',
    refHistory: [
      { machine:'*', refLo:null, refHi:6, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:4.3, refHi:5.8, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md' },
    ] },

  // ═══════════════════════════════════════════════════════════════════════
  // RENAL FUNCTION
  // ═══════════════════════════════════════════════════════════════════════

  { id:'BUN',
    pattern: /BUN:\s*([<>]?\s*[\d.]+)/,
    displayName:'血尿素氮 (BUN)', shortLabel:'BUN',
    unit:'mg/dL', category:'腎功能',
    ref:'男 8.9–20.6，女 7.0–18.7 mg/dL',
    refLo:7, refHi:25,
    hiM:20.6, hiF:18.7,
    hi:25.7, lo:null,
    notes:'Fallback hi:25.7 is the original soft buffer for unknown gender; known-gender uses hiM/hiF for precision.',
    refHistory: [
      { machine:'*', refLo:null, refHi:25.7, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:7, refHi:25, refLoM:7, refHiM:25, refLoF:7, refHiF:25, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md (vhtt 印 universal 7-25,inline 性別 mirror 是為了 suppress outer hiM:20.6/hiF:18.7 fallback)' },
    ] },

  // BUN_pre / BUN_post — dialysis-specific. Only the reporter uses these.
  // The orderNameFilter discriminates pre-dialysis (composite panel
  // containing comma in orderName) from post-dialysis (standalone "BUN" order).
  { id:'BUN_pre',
    pattern: /BUN:\s*([<>]?\s*[\d.]+)/,
    orderNameFilter: /,/,
    displayName:'BUN（洗前）', shortLabel:'BUN(洗前)',
    unit:'mg/dL', category:'腎功能',
    ref:'7–25 mg/dL',
    refLo:7, refHi:25, hi:25, lo:7,
    meaning:'透析前 BUN — 與 BUN_post 配對計算 URR',
    notes:'Filter selects orders whose orderName contains a comma (composite dialysis panel).' },

  { id:'BUN_post',
    pattern: /BUN:\s*([<>]?\s*[\d.]+)/,
    orderNameFilter: /^BUN$/i,
    displayName:'BUN（洗後）', shortLabel:'BUN(洗後)',
    unit:'mg/dL', category:'腎功能',
    ref:'',
    refLo:null, refHi:null, hi:null, lo:null,
    meaning:'透析後 BUN — 通常 6–7，與 BUN_pre 配對計算 URR',
    notes:'Filter selects orders where orderName is exactly "BUN" (standalone post-dialysis draw).' },

  { id:'CREAT',
    pattern: /(?:Creatinine\(serum\)|CREAT):\s*([<>]?\s*[\d.]+)/i,
    displayName:'肌酸酐 (Creatinine, Cr)', shortLabel:'Cr',
    unit:'mg/dL', category:'腎功能',
    ref:'男 0.6–1.2，女 0.5–1.0 mg/dL',
    refLo:0.5, refHi:1.3,
    hiM:1.2, hiF:1.0,
    hi:1.2, lo:null,
    notes:'Pattern matches "Creatinine(serum):" and "CREAT:" but NOT "Creatinine(24hrs Urine):".',
    refHistory: [
      { machine:'*', refLo:null, refHi:1.2, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:0.6, refHi:1.3, refLoM:0.7, refHiM:1.3, refLoF:0.6, refHiF:1.2, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md' },
    ] },

  { id:'UA',
    pattern: /(?:UA|Uric\s*acid):\s*([<>]?\s*[\d.]+)/i,
    displayName:'尿酸 (Uric acid, UA)', shortLabel:'UA',
    unit:'mg/dL', category:'腎功能',
    ref:'男 3.3–7.7，女 2.5–6.2 mg/dL',
    refLo:2.5, refHi:7.7,
    hiM:7.7, hiF:6.2,
    hi:7.7, lo:null,
    refHistory: [
      { machine:'*', refLo:null, refHi:7.7, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:2.3, refHi:7.6, refLoM:4.4, refHiM:7.6, refLoF:2.3, refHiF:6.6, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md' },
    ] },

  { id:'eGFR',
    pattern: /(?:Creatinine\(serum\)|CREAT):\s*([<>]?\s*[\d.]+)/i,
    computed:'eGFR',
    displayName:'腎絲球過濾率 (eGFR)', shortLabel:'eGFR',
    unit:'mL/min/1.73m²', category:'腎功能',
    ref:'> 60 mL/min/1.73m²',
    refLo:60, refHi:null, hi:null, lo:60,
    meaning:'腎功能指標',
    notes:'Computed from Creatinine via CKD-EPI 2021 (race-free). Pattern shares Creatinine capture so the same regex works.' },

  { id:'UACR',
    // `RATIO` alternation 補抓 vhtt 110 年中以前舊格式 Urine Microalbumin
    // 報告（label `RATIO: N` 而非新格式 `ALB/CR: N`）。`RATIO:` 也出現在
    // Free PSA 報告，故必須以 `orderNameFilter` 限制在 microalbumin order
    // 內才匹配（FreePSA 那邊也已有對稱的 orderNameFilter）。
    pattern: /(?:U-?ACR|UACR|Alb(?:umin)?\/Cr(?:eatinine)?|Urine\s*Alb\/Cr|RATIO):\s*([<>]?\s*[\d.]+)/i,
    orderNameFilter: /microalbumin/i,
    displayName:'尿白蛋白／肌酸酐比 (UACR)', shortLabel:'UACR',
    unit:'mg/g', category:'腎功能',
    ref:'< 30 mg/g',
    refLo:null, refHi:30, hi:30, lo:null,
    meaning:'腎臟早期傷害指標',
    subpage: {
      // Opt-in to enrichMissingValues sub-page chase. orderName signals
      // that the order is a urine albumin/creatinine panel — broader than
      // strict matching to handle vhyl/vhtt naming variants.
      orderNameMatch: /U-?ACR|UACR|microalbumin|micro-?albumin|urine\s*alb|albumin\/cr|alb\/cr|尿.*白蛋白|微量白蛋白/i,
      // No resultPattern: UACR sub-page already carries the main "UACR:" label.
    },
    notes:'Viewer fetches sub-pages from opdweb (1-year window) when UACR not in main reportText. Sub-page chase opt-in via subpage.orderNameMatch (broad urine regex).' },

  { id:'UPCR',
    // T.PROT/CREAT alternation added 2026-05-08 (Phase 3 CKD): vhtt's
    // Urine total protein(TT) inline reportText uses "T.PROT/CREAT: <值>"
    // (verified across 45+ vhtt patients); RATTC was vhyl-only / legacy.
    // The optional period in T\.? handles both `T.PROT/CREAT` and `TPROT/CREAT`.
    pattern: /(?:U-?PCR|UPCR|RATTC|T\.?PROT\/CREAT|TP\/Cr|Pr(?:otein)?\/Cr(?:eatinine)?|Urine\s*TP\/Cr):\s*([<>]?\s*[\d.]+)/i,
    displayName:'尿蛋白／肌酸酐比 (UPCR)', shortLabel:'UPCR',
    unit:'mg/g', category:'腎功能',
    ref:'< 150 mg/g',
    refLo:null, refHi:150, hi:150, lo:null,
    notes:'RATTC = vhyl/legacy; T.PROT/CREAT = vhtt (Urine total protein inline). Both produce the same numeric ratio.' },

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
    pattern: /NA\(Serum\):\s*([<>]?\s*[\d.]+)/,
    displayName:'鈉 (Na)', shortLabel:'Na',
    unit:'mmol/L', category:'電解質',
    ref:'136–145 mmol/L',
    refLo:136, refHi:145, hi:145, lo:136,
    refHistory: [{ machine:'*', refLo:136, refHi:145, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'K',
    pattern: /K \(Serum\):\s*([<>]?\s*[\d.]+)/,
    displayName:'鉀 (K)', shortLabel:'K',
    unit:'mmol/L', category:'電解質',
    ref:'3.5–5.1 mmol/L',
    refLo:3.5, refHi:5.1, hi:5.1, lo:3.5,
    refHistory: [{ machine:'*', refLo:3.5, refHi:5.1, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'Cl',
    pattern: /Cl\(Serum\):\s*([<>]?\s*[\d.]+)/,
    displayName:'氯 (Cl)', shortLabel:'Cl',
    unit:'mmol/L', category:'電解質',
    ref:'98–107 mmol/L',
    refLo:98, refHi:107, hi:107, lo:98,
    refHistory: [{ machine:'*', refLo:98, refHi:107, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'Ca',
    pattern: /Calcium\(Serum\):\s*([<>]?\s*[\d.]+)/,
    displayName:'鈣 (Ca)', shortLabel:'Ca',
    unit:'mg/dL', category:'電解質',
    ref:'8.6–10.3 mg/dL',
    refLo:8.6, refHi:10.3, hi:10.3, lo:8.6,
    refHistory: [{ machine:'*', refLo:8.6, refHi:10.3, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'FreeCa',
    pattern: /Free Ca\+\+:\s*([<>]?\s*[\d.]+)/,
    displayName:'游離鈣 (Free Ca)', shortLabel:'Free Ca',
    unit:'mmol/L', category:'電解質',
    ref:'1.15–1.32 mmol/L',
    refLo:1.15, refHi:1.32, hi:1.32, lo:1.15,
    refHistory: [{ machine:'*', refLo:1.15, refHi:1.32, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'P',
    pattern: /Phosphorus:\s*([<>]?\s*[\d.]+)/,
    displayName:'磷 (P)', shortLabel:'P',
    unit:'mg/dL', category:'電解質',
    ref:'2.5–5.0 mg/dL',
    refLo:2.5, refHi:5.0, hi:5.0, lo:2.5,
    refHistory: [{ machine:'*', refLo:2.5, refHi:5.0, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'Mg',
    pattern: /MG:\s*([<>]?\s*[\d.]+)/,
    displayName:'鎂 (Magnesium, Mg)', shortLabel:'Mg',
    unit:'mg/dL', category:'電解質',
    ref:'1.6–2.6 mg/dL',
    refLo:1.6, refHi:2.6, hi:2.6, lo:1.6,
    refHistory: [{ machine:'*', refLo:1.6, refHi:2.6, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  // ═══════════════════════════════════════════════════════════════════════
  // IRON METABOLISM
  // ═══════════════════════════════════════════════════════════════════════

  // vhyl sample (2026-05-05): "更正報告 FE: 58TIBC: 267.00TS: 22"
  { id:'Fe',
    pattern: /(?:Fe|Iron)\s*(?:\((?:TT|YL)\))?:\s*([<>]?\s*[\d.]+)/i,
    displayName:'血清鐵 (Fe)', shortLabel:'Fe',
    unit:'µg/dL', category:'鐵代謝',
    ref:'男 65–175，女 50–170 µg/dL',
    refLo:50, refHi:175,
    loM:65, hiM:175, loF:50, hiF:170,
    lo:50, hi:175,
    refHistory: [
      { machine:'*', refLo:50, refHi:175, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:50, refHi:175, refLoM:50, refHiM:175, refLoF:50, refHiF:175, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md + 委外:新南海 (vhtt 印 universal 50-175,inline 性別 mirror 是為了 suppress outer loM:65/hiF:170 fallback)' },
    ] },

  { id:'TIBC',
    pattern: /TIBC:\s*([<>]?\s*[\d.]+)/,
    displayName:'總鐵結合力 (TIBC)', shortLabel:'TIBC',
    unit:'µg/dL', category:'鐵代謝',
    ref:'男 134–415，女 120–480 µg/dL',
    refLo:120, refHi:480,
    loM:134, hiM:415, loF:120, hiF:480,
    lo:120, hi:480,
    refHistory: [{ machine:'*', refLo:120, refHi:480, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  // vhyl sample (2026-05-05): "更正報告 FE: 58TIBC: 267.00TS: 22"
  { id:'TSAT',
    pattern: /(?<![A-Za-z])(?:TSAT|TS|SAT):\s*([<>]?\s*[\d.]+)/,
    displayName:'鐵飽和度 (TSAT)', shortLabel:'TSAT',
    unit:'%', category:'鐵代謝',
    ref:'20–45 %',
    refLo:20, refHi:45, hi:45, lo:20,
    refHistory: [{ machine:'*', refLo:20, refHi:45, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'UIBC', computed:'UIBC', pattern:null,
    displayName:'不飽和鐵結合力 (UIBC)', shortLabel:'UIBC',
    unit:'µg/dL', category:'鐵代謝',
    ref:'110–370 µg/dL',
    refLo:110, refHi:370, lo:110, hi:370,
    notes:'Computed: TIBC − Fe. ernode does not report UIBC directly.' },

  { id:'Ferritin',
    pattern: /(?:Ferritin|FERRITIN):\s*([<>]?\s*[\d.]+)/i,
    displayName:'鐵蛋白 (Ferritin)', shortLabel:'Ferritin',
    unit:'ng/mL', category:'鐵代謝',
    ref:'男 21.81–274.66，女 4.63–204.00 ng/mL',
    refLo:4.63, refHi:274.66,
    loM:21.81, hiM:274.66, loF:4.63, hiF:204.00,
    lo:4.63, hi:274.66,
    notes:'Capture allows leading <> operator (handles "<5.0", ">2000" results).',
    refHistory: [{ machine:'*', refLo:4.63, refHi:274.66, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  // ═══════════════════════════════════════════════════════════════════════
  // PARATHYROID + VITAMINS
  // ═══════════════════════════════════════════════════════════════════════

  { id:'iPTH',
    pattern: /i-PTH:\s*([<>]?\s*[\d.]+)/,
    displayName:'副甲狀腺素 (iPTH)', shortLabel:'i-PTH',
    unit:'pg/mL', category:'副甲狀腺',
    ref:'15–68.3 pg/mL',
    refLo:15, refHi:68.3, hi:68.3, lo:15,
    refHistory: [{ machine:'*', refLo:15, refHi:68.3, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'VitB12',
    pattern: /(?:Vit(?:amin)?\.?\s*B12|VIT\.?\s*B12|B12):\s*([<>]?\s*[\d.]+)/i,
    displayName:'維生素 B12 (Vit. B12)', shortLabel:'Vit B12',
    unit:'pg/mL', category:'維生素',
    ref:'187–883 pg/mL',
    refLo:187, refHi:883, hi:883, lo:187,
    notes:'Matches "Vit. B12:", "Vitamin B12:", "VIT.B12:", "B12:".',
    refHistory: [{ machine:'*', refLo:187, refHi:883, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'FolicAcid',
    pattern: /(?:Folic\s+acid|Folate):\s*([<>]?\s*[\d.]+)/i,
    displayName:'葉酸 (Folic Acid)', shortLabel:'Folate',
    unit:'ng/mL', category:'維生素',
    ref:'3.1–20.5 ng/mL',
    refLo:3.1, refHi:20.5, hi:20.5, lo:3.1,
    notes:'Allows variable internal whitespace (some hospitals print "Folic  acid:" with double space).',
    refHistory: [{ machine:'*', refLo:3.1, refHi:20.5, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  // ═══════════════════════════════════════════════════════════════════════
  // TRACE METALS
  // ═══════════════════════════════════════════════════════════════════════

  // vhtt 2026-05-07: 18-patient survey, 12 had Blood Aluminum results.
  // Main page: "Al鋁: 6" / "Al鋁: <2" (below detection limit).
  // Sub-page (OpdOrderReport.aspx): "Result: 4" — handled by enrichment via
  // the `subpage` config (synthesises "Al鋁: N" back into reportText so the
  // main pattern matches downstream).
  { id:'Aluminum',
    // vhtt 2026-05-07: in-house results use "Al鋁: N", but historical
    // out-sourced results (代檢單位：新南海醫事檢驗所) label the value with
    // the external lab code "BALR0101: N". Both formats live in the main
    // reportText — sub-page enrichment isn't actually needed for any of
    // the patients sampled so far. The `subpage` config below stays for
    // defensive future-proofing (in case a sub-page-only sample appears).
    pattern: /(?:Al鋁|BALR0101):\s*([<>]?\s*[\d.]+)/,
    displayName:'鋁 (Aluminum)', shortLabel:'Al',
    unit:'µg/L', category:'微量元素',
    ref:'<20 µg/L',
    refLo:null, refHi:20, hi:20, lo:null,
    meaning:'鋁中毒監測（長期透析）',
    subpage: {
      // orderName variants observed: "Blood Aluminum", "Blood Aluminum(TT)",
      // and (defensive) any Chinese-only name containing 鋁.
      orderNameMatch: /Aluminum|鋁/i,
      resultPattern:  /Result:\s*([<>]?\s*[\d.]+)/,
      synthLabel:     'Al鋁',
    },
    notes:'Annual test. vhtt confirmed 2026-05-07 (18-patient survey, 12 with data). Main pattern matches both "Al鋁: N" (in-house) and "BALR0101: N" (out-sourced lab code). Capture allows leading <> operator (handles "<2" below detection limit; reporter extractLabValues preserves "<N" as string since 2026-05-07). Ref <20 µg/L per KDOQI guidelines.',
    refHistory: [{ machine:'*', refLo:null, refHi:20, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  // ═══════════════════════════════════════════════════════════════════════
  // TUMOR MARKERS
  // ═══════════════════════════════════════════════════════════════════════

  // vhyl sample (2026-05-05): "正式報告 AFP(YL): < 2.00"
  { id:'AFP',
    pattern: /AFP\s*(?:\((?:TT|YL)\))?:\s*([<>]?\s*[\d.]+)/,
    displayName:'甲胎蛋白 (AFP)', shortLabel:'AFP',
    unit:'ng/mL', category:'癌症指數',
    ref:'< 20 ng/mL（肝臟）',
    refLo:null, refHi:20, hi:20, lo:null,
    refHistory: [
      { machine:'*', refLo:null, refHi:20, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' },
      { machine:'vhtt', refLo:0, refHi:9.0, validFrom:'2026-05-28', source:'YC SOP C 觸發 2026-05-28 cross-reference 12 chart batch — see docs/cross-reference-vhtt-2026-05-28.md' },
    ] },

  // vhyl sample (2026-05-25): "正式報告 CEA(YL): 7.37" — chartno 000023172B
  // 比照 AFP / Fe / TSAT 同期 fix 加 (TT|YL) 可選後綴。
  // 同 section 其他 test (PSA / FreePSA / CA199 / CA125) 在 vhyl 端 value
  // line 都不帶 (YL)，CEA 是異例 — 不擴張本 fix 範圍。
  { id:'CEA',
    pattern: /CEA\s*(?:\((?:TT|YL)\))?:\s*([<>]?\s*[\d.]+)/,
    displayName:'癌胚抗原 (CEA)', shortLabel:'CEA',
    unit:'ng/mL', category:'癌症指數',
    ref:'< 5 ng/mL（大腸直腸）',
    refLo:null, refHi:5, hi:5, lo:null,
    refHistory: [{ machine:'*', refLo:null, refHi:5, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'CA199',
    pattern: /CA.?19.?9:\s*([<>]?[\d.]+)/i,
    displayName:'CA-199', shortLabel:'CA-199',
    unit:'U/mL', category:'癌症指數',
    ref:'< 37 U/mL（胰臟、膽道）',
    refLo:null, refHi:37, hi:37, lo:null,
    refHistory: [{ machine:'*', refLo:null, refHi:37, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'PSA',
    pattern: /\bPSA:\s*([<>]?\s*[\d.]+)/,
    displayName:'攝護腺特異抗原 (PSA)', shortLabel:'PSA',
    unit:'ng/mL', category:'癌症指數',
    ref:'< 4 ng/mL（男性／攝護腺）',
    refLo:null, refHi:4, hi:4, lo:null,
    gender:'M',
    refHistory: [{ machine:'*', refLo:null, refHi:4, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'FreePSA',
    // 2026-05-08: 原本移除 `|RATIO` alternation，錯誤假設 vhtt `RATIO:` 值為
    // Free/Total 比值。2026-05-13 vhtt 端以 3 個病人取樣驗證（000017679E /
    // 000043524F / 000026353G），YC（clinician）確認：vhtt 與 vhyl 的 RATIO
    // 值都是 Free PSA 絕對濃度（ng/mL），報告後接的 boilerplate 是判讀指引，
    // 不是數值語意描述。故加回 `RATIO` alternation。
    // Label 樣式覆蓋：
    //   vhtt: `RATIO: 0.152`               ← Free PSA(TT) / FREE PSA
    //   vhyl: `FREE PSA/PSA RATIO: 0.097`  ← Free PSA(YL)
    //   通用: `Free PSA: N`                ← 其他院區（若有）
    pattern: /(?:Free PSA|FREE PSA\/PSA RATIO|RATIO):\s*([<>]?\s*[\d.]+)/,
    orderNameFilter: /Free\s*PSA/i,
    displayName:'游離 PSA (Free PSA)', shortLabel:'Free PSA',
    unit:'ng/mL', category:'癌症指數',
    gender:'M',
    refHistory: [{ machine:'*', refLo:null, refHi:null, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

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
    gender:'F',
    refHistory: [{ machine:'*', refLo:null, refHi:35, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  // ═══════════════════════════════════════════════════════════════════════
  // THYROID
  // ═══════════════════════════════════════════════════════════════════════

  { id:'TSH',
    pattern: /TSH:\s*([<>]?\s*[\d.]+)/,
    displayName:'促甲狀腺刺激素 (TSH)', shortLabel:'TSH',
    unit:'µIU/mL', category:'甲狀腺',
    ref:'0.35–4.94 µIU/mL',
    refLo:0.35, refHi:4.94, hi:4.94, lo:0.35,
    refHistory: [{ machine:'*', refLo:0.35, refHi:4.94, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'FreeT4',
    pattern: /Free T4:\s*([<>]?\s*[\d.]+)/,
    displayName:'游離甲狀腺素 (Free T4)', shortLabel:'fT4',
    unit:'ng/dL', category:'甲狀腺',
    ref:'0.7–1.48 ng/dL',
    refLo:0.7, refHi:1.48, hi:1.48, lo:0.7,
    refHistory: [{ machine:'*', refLo:0.7, refHi:1.48, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  // ═══════════════════════════════════════════════════════════════════════
  // HEPATITIS / INFECTION (qualitative — values are text, not numbers)
  // ═══════════════════════════════════════════════════════════════════════

  // Raw qualitative pattern — used by reporter for direct table display.
  // Viewer overrides these in its manifest with `computed: '<id>'` to render
  // a patient-friendly verdict (帶原 / 正常) via report.js helpers.

  // vhyl sample (2026-05-05): "正式報告 HBsAg: 0.21HBsAg (YL): Non-Reactive (Non-Reactive)"
  { id:'HBsAg',
    pattern: /HBsAg\s*(?:\((?:TT|YL)\))?:\s*([^\s\d]\S*)/i,
    displayName:'B型肝炎表面抗原 (HBsAg)', shortLabel:'HBsAg',
    category:'肝炎 / 感染',
    qualitative:true,
    notes:'(TT) suffix used at vhtt; alternation handles both hospitals.' },

  // vhyl sample (2026-05-06): aligned to HBsAg/AntiHCV style — accepts
  // optional (TT|YL) hospital tag and stops the value capture before any
  // digits so vhyl's concatenated numeric+qualitative line parses cleanly.
  { id:'AntiHBs',
    pattern: /Anti-HBs\s*(?:\((?:TT|YL)\))?:\s*([^\s\d]\S*)/i,
    displayName:'B型肝炎表面抗體 (Anti-HBs)', shortLabel:'Anti-HBs',
    category:'肝炎 / 感染',
    qualitative:true,
    meaning:'疫苗免疫指標' },

  // vhyl sample (2026-05-05): "正式報告 Anti-HCV: 0.12Anti-HCV (YL): Non-Reactive (Non-Reactive)"
  { id:'AntiHCV',
    pattern: /(?:HCV Ab|Anti-HCV)\s*(?:\((?:TT|YL)\))?:\s*([^\s\d]\S*)/i,
    displayName:'C型肝炎抗體 (Anti-HCV)', shortLabel:'Anti-HCV',
    category:'肝炎 / 感染',
    qualitative:true,
    notes:'vhtt uses "HCV Ab(TT):", vhyl uses "Anti-HCV:".' },

  // Raw numeric titer entries — viewer's computed display wrappers consume
  // these to produce 帶原/正常/有抗體 + (label titer) tuples. vhyl emits
  // "HBsAg: 0.21HBsAg (YL): Non-Reactive" — \[\d.\]+ stops at the next "H"
  // so we get the numeric without the qualitative text bleeding in.
  { id:'HBsAgTiter',
    pattern: /HBsAg:\s*([<>]?\s*[\d.]+)/i,
    displayName:'HBsAg 滴度', shortLabel:'HBsAg titer',
    unit:'', category:'肝炎 / 感染',
    notes:'Numeric titer for HBsAg. Consumed by HBsAgDisplay computed wrapper.',
    refHistory: [{ machine:'*', refLo:null, refHi:null, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'AntiHBsTiter',
    pattern: /Anti-HBs:\s*([<>]?\s*[\d.]+)/i,
    displayName:'Anti-HBs 滴度', shortLabel:'Anti-HBs titer',
    unit:'', category:'肝炎 / 感染',
    notes:'Numeric titer for Anti-HBs. Consumed by AntiHBsDisplay computed wrapper.',
    refHistory: [{ machine:'*', refLo:null, refHi:null, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'AntiHCVTiter',
    pattern: /(?:HCV Ab|Anti-HCV):\s*([<>]?\s*[\d.]+)/i,
    displayName:'Anti-HCV 滴度', shortLabel:'Anti-HCV titer',
    unit:'', category:'肝炎 / 感染',
    notes:'Numeric titer for Anti-HCV. Consumed by HCV computed wrapper.',
    refHistory: [{ machine:'*', refLo:null, refHi:null, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

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
    notes:'Capture allows commas (thousands separator).',
    refHistory: [{ machine:'*', refLo:null, refHi:null, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  { id:'CD4',
    pattern: /LEU3AN:\s*([<>]?\s*[\d.]+)/,
    displayName:'CD4 淋巴球 (LEU3AN)', shortLabel:'CD4',
    category:'HIV',
    refHistory: [{ machine:'*', refLo:null, refHi:null, validFrom:'1900-01-01', source:'migration 起點 — universal ref 既有值' }] },

  // ═══════════════════════════════════════════════════════════════════════
  // URINE — qualitative + quantitative (Phase 3 Early CKD, 2026-05-08)
  // ═══════════════════════════════════════════════════════════════════════
  // CHEM EXAM(TT) reportText comes in two formats verified across 84 vhtt
  // CKD patients:
  //   Format A (long): "Bilirubin: -  Glucose: -  Ketone: -  OB: -  ..."
  //   Format B (short+ref): "BILI: - (-)  GLU: - (-)  KETO: - (-)  OCCL: 1+ (-) ..."
  // The patterns below accept both labels (long + short) and the reference
  // suffix in format B. Capture stops before whitespace so " (-)" is dropped.
  // Catalog only captures the raw qualitative string ('-', '+/-', '1+', '4+',
  // '++', etc.); export-formats/renal-platform-xlsx.js normalises it to
  // bracket notation ([-], [+], [++], ...).

  { id:'UrineOB',
    pattern: /(?:\bOB|\bOCCL):\s*([+\-]+(?:\/[+\-])?|\d+\+)/,
    displayName:'尿潛血 (Occult Blood)', shortLabel:'尿OB',
    category:'尿液', qualitative:true,
    orderNameFilter: /CHEM\s*EXAM|尿液|Urine\s*protein/i,
    notes:'Two label formats: long "OB: -" (vhyl/older) and short "OCCL: 1+ (-)" (vhtt/newer). Capture stops before whitespace so the reference range is dropped.' },

  { id:'UrineGlucose',
    pattern: /(?:\bGlucose|\bGLU):\s*([+\-]+(?:\/[+\-])?|\d+\+)/,
    displayName:'尿糖 (Urine Glucose)', shortLabel:'尿糖',
    category:'尿液', qualitative:true,
    orderNameFilter: /CHEM\s*EXAM|尿液|Urine\s*protein/i,
    notes:'orderNameFilter required to distinguish from serum GluAC; long "Glucose: -" / short "GLU: 4+ (-)". Same capture rule as UrineOB.' },

  { id:'UrineCr',
    pattern: /Creatinine\s*\((?:24hrs?\s*)?Urine\):\s*([<>]?\s*[\d.]+)/i,
    displayName:'尿肌酸酐 (Urine Creatinine)', shortLabel:'尿Cr',
    unit:'mg/dL', category:'尿液',
    notes:'From Urine Microalbumin(TT)+Creatinine(TT) inline. Distinct label from serum CREAT — does not match Creatinine(serum):.' },

  { id:'UrineProtein',
    pattern: /尿蛋白\s+([<>]?\s*[\d.]+)\s*mg\/dL/i,
    displayName:'尿蛋白定量 (Urine Total Protein)', shortLabel:'尿蛋白',
    unit:'mg/dL', category:'尿液',
    subpage: {
      // Inline reportText only carries UPCR (T.PROT/CREAT); the actual
      // protein concentration in mg/dL lives behind the opdweb sub-page.
      orderNameMatch: /Urine\s*total\s*protein|尿蛋白定量/i,
      // No resultPattern: sub-page already prints "尿蛋白 <值> mg/dL" so
      // the main pattern matches it directly after enrichment.
    },
    notes:'Random urine protein concentration. Inline reportText only has UPCR; mg/dL value requires sub-page enrichment via opdweb OpdOrderReport.aspx.' },

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

  // ═══════════════════════════════════════════════════════════════════════
  // EXAMINATIONS (track-only — used by CKD/DM screening Dashboard)
  // ═══════════════════════════════════════════════════════════════════════
  // 為 TASK_BRIEF_ckd_screening_dashboard S1 加入。Pattern 只 match orderName
  // (不 capture 數值) — Dashboard 端拿 orderDate / status，不需 lab value。
  // 此 category「檢查」目前不在任何 manifest 裡，所以是 track-only：viewer /
  // reporter 既有報表不會額外渲染。
  //
  // vhtt order name 實測（Phase 0, 2026-05-21）：
  //   EKG    : `E.K.G.(TT)`                       (unit: ER)
  //   ABI/PVR: `Doppling ex. and pressure recodring`  (unit: ER, 合併一筆)
  //   Fundus : `Fundoscopy(眼底鏡檢查)`             (unit: META)
  // vhyl 預期 ABI / PVR 分開兩筆 order — `\b` word boundary 由各自 id match。

  { id:'EKG',    displayName:'心電圖',
    pattern: /E\.K\.G\.|心電圖|EKG|ECG/i,
    category:'檢查',
    unit:'', ref:'', lo:null, hi:null },

  { id:'ABI',    displayName:'ABI',
    pattern: /\bABI\b|Doppling ex\.|四肢血流探測/i,
    category:'檢查',
    unit:'', ref:'', lo:null, hi:null },

  { id:'PVR',    displayName:'PVR',
    pattern: /\bPVR\b|Doppling ex\./i,
    category:'檢查',
    unit:'', ref:'', lo:null, hi:null },

  { id:'Fundus', displayName:'眼底鏡',
    pattern: /Fundoscopy|眼底鏡|Fundus\s+color/i,
    category:'檢查',
    unit:'', ref:'', lo:null, hi:null },

  // CXR — TASK_BRIEF_health_check_cxr S1（2026-05-21）。健檢 order name 為
  // `PE CXR`（unit: 放射線, IMPRESSION: Z00.00_體檢）；臨床 order 為
  // `CHEST PA or AP View (TT)`。alternation 同時涵蓋兩者，且不誤命中
  // `Chest Left oblique(TT)` 等其他胸部影像。
  { id:'CXR',    displayName:'CXR (胸部X光)', shortLabel:'CXR',
    pattern: /PE\s*CXR|CHEST\s+PA\s+or\s+AP/i,
    category:'檢查',
    unit:'', ref:'', lo:null, hi:null },

  // 健檢影像三項 — TASK_BRIEF_health_check_cxr S1 補充（2026-05-21）。與 CXR
  // 同為 track-only「檢查」,健檢報告視窗（cxr.html）批次抓取 + LLM 翻譯。
  // order name 範例：`PE Whole Body Bone density scan` / `PE85 Coronary
  // Calcium Score CT` / `PE Low Dose Chest CT`。pattern 抓 order name 不誤命中
  // `PE CXR`（CXR）或 `Chest Left oblique`（其他胸部影像）。
  { id:'BMD',  displayName:'骨質密度 (BMD)', shortLabel:'BMD',
    pattern: /Bone\s+density/i,
    category:'檢查',
    unit:null, ref:null, lo:null, hi:null },

  { id:'CAC',  displayName:'冠狀動脈鈣化 (CAC)', shortLabel:'CAC',
    pattern: /Coronary\s+Calcium/i,
    category:'檢查',
    unit:null, ref:null, lo:null, hi:null },

  { id:'LDCT', displayName:'低劑量肺部CT (LDCT)', shortLabel:'LDCT',
    pattern: /Low\s+Dose\s+Chest\s+CT/i,
    category:'檢查',
    unit:null, ref:null, lo:null, hi:null },

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

  // Page 2 layout — 2026-06-17 收斂為 col 1 文字報告 lump + col 2 數值
  // (DC + HIV stacked);col 3 / 4 留空。Reminder box 已移除(不顯示)。
  { id:'BoneDensity', page:2, col:1, section:'骨質疏鬆 (Bone Density)' },
  { id:'Endoscopy',   page:2, col:1, section:'胃鏡 (Endoscopy)' },
  { id:'AbdSono',     page:2, col:1, section:'超音波 (Ultrasound)' },

  // ── Page 2 │ Col 2 │ 白血球分類 (DC) ─────────────────────────────────
  // DC 五分類% display-only(catalog 無 hi/lo)。
  { id:'Neut',  page:2, col:2, section:'白血球分類 (DC)' },
  { id:'Lymph', page:2, col:2, section:'白血球分類 (DC)' },
  { id:'Mono',  page:2, col:2, section:'白血球分類 (DC)' },
  { id:'Eos',   page:2, col:2, section:'白血球分類 (DC)' },
  { id:'Baso',  page:2, col:2, section:'白血球分類 (DC)' },

  // ── Page 2 │ Col 2 │ HIV section (only rendered when HIV checkbox is on)
  { id:'HIVLoad', page:2, col:2, section:'HIV', hivOnly:true },
  { id:'CD4',     page:2, col:2, section:'HIV', hivOnly:true },
  { id:'RPR',     page:2, col:2, section:'HIV', hivOnly:true,
    computed:'RPR',  pattern:null, singleValue:true },
  { id:'TPHA',    page:2, col:2, section:'HIV', hivOnly:true,
    computed:'TPHA', pattern:null, singleValue:true },

];

// ═══════════════════════════════════════════════════════════════════════════
// VIEWER_A5_MANIFEST — A5 landscape single-table printout (v1.4.0)
//
// Used by viewer report.js `buildA5Page()` when the popup "📄 A5單頁"
// checkbox is on. The A5 layout is a flat 4-column rounded table showing
// only the latest value of each test; `section` is metadata for future use
// (e.g. grouping headers) — the current renderer does not honour it.
//
// Order fixed by YC 2026-05-20 cowork session (TASK_BRIEF_viewer_a5_layout).
// All ids must already exist in VIEWER_MANIFEST above (because their
// catalog entry + regex come from there); A5 just re-orders a subset.
// ═══════════════════════════════════════════════════════════════════════════

const VIEWER_A5_MANIFEST = [
  { id:'GluAC',    order:1,  section:'血糖' },
  { id:'HbA1c',    order:2,  section:'血糖' },
  { id:'CHOL',     order:3,  section:'血脂' },
  { id:'TG',       order:4,  section:'血脂' },
  { id:'HDLC',     order:5,  section:'血脂' },
  { id:'LDL',      order:6,  section:'血脂' },
  { id:'BUN',      order:7,  section:'腎' },
  { id:'CREAT',    order:8,  section:'腎' },
  { id:'eGFR',     order:9,  section:'腎' },
  { id:'GOT',      order:10, section:'肝' },
  { id:'GPT',      order:11, section:'肝' },
  { id:'UA',       order:12, section:'其他' },
  { id:'UACR',     order:13, section:'腎' },
  { id:'GFRStage', order:14, section:'腎臟病分期' },
  { id:'EarlyCKD', order:15, section:'腎臟病分期' },
];

// ─── Exports (CommonJS + browser global) ─────────────────────────────────
// VIEWER_MANIFEST stays as the default array export so existing consumers
// (build-json.js, validate.js, index.js) keep working unchanged.
// VIEWER_A5_MANIFEST is attached as a property on the array — opt-in for
// the few consumers that need it.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VIEWER_MANIFEST;
  module.exports.VIEWER_A5_MANIFEST = VIEWER_A5_MANIFEST;
}
if (typeof window !== 'undefined') {
  window.HOSPITAL_LAB_PATTERNS_VIEWER_MANIFEST    = VIEWER_MANIFEST;
  window.HOSPITAL_LAB_PATTERNS_VIEWER_A5_MANIFEST = VIEWER_A5_MANIFEST;
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
  window.HOSPITAL_LAB_PATTERNS_BUNDLED_AT = "2026-06-18T23:02:42.022Z";
}
'use strict';

/**
 * resolveRef.js — shared machine × time × gender reference-range resolver.
 *
 * Given a test id + the current machine + the value's report date + patient
 * gender + the LIVE catalog, returns the reference range to use for the
 * normal/abnormal (黃紅綠) decision:
 *
 *   resolveRef(testId, machineSource, reportDate, patientGender, catalogList)
 *     → { refLo: number|null, refHi: number|null }
 *
 * Algorithm (TASK_BRIEF_ref_range_machine_time_dim §2.2):
 *   1. Find entry by testId in catalogList.
 *   2. No refHistory → fallback chain:
 *        a. BUN_pre / BUN_post → use BUN's refHistory (inherits, §1.1 special).
 *        b. else → outer refLo/refHi (+ outer loM/hiM/loF/hiF for gender).
 *   3. Has refHistory:
 *        a. candidates = machine ∈ [machineSource, '*'] AND validFrom <= date
 *        b. sort: machine-specific beats '*'; same machine → latest validFrom
 *        c. take first = base
 *        d. gender override (3 layers): inline refLoM/.. → outer loM/.. → base
 *   4. candidates empty → fallback chain (step 2).
 *   reportDate missing/unparseable → use today + console.warn once per testId.
 *
 * Date handling: reportDate may arrive as ROC "115/04/14", Gregorian
 * "20260414203800", ISO "2026-04-14", or a Date — all normalised to Western
 * "YYYY-MM-DD" before comparing against validFrom (which is always ISO). This
 * is the §11.3 risk guard: comparing a raw ROC string against an ISO validFrom
 * would sort wrong every time.
 *
 * Packaging: this is CODE, not data — it cannot ride dist/patterns.json
 * (build-json drops functions). sync-patterns.js bundles it into viewer
 * mapping.js and reporter's patterns block. It is wrapped in an IIFE so its
 * helpers never collide with names in the concatenated classic-script scope
 * (CATALOG / TEST_MAP / _resolveManifest / NORMALIZERS …); `var resolveRef`
 * is redeclaration-safe even if a bundle ever includes it twice.
 *
 * It takes the catalog as an argument (not a global) so the viewer can pass
 * its LIVE window.TEST_MAP (post dist-swap) and so the BUN_pre→BUN fallback
 * can look up a sibling entry.
 */

var resolveRef = (function () {
  var warned = {}; // testId → true; throttles the missing-date warning

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // Normalise any supported report-date form to Western "YYYY-MM-DD".
  // Returns null when the input is empty / unrecognised (caller falls to today).
  function normalizeRefDate(d) {
    if (d == null || d === '') return null;

    if (d instanceof Date && !isNaN(d.getTime())) {
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    var s = String(d).trim();
    if (!s) return null;

    // ISO "YYYY-MM-DD..." → take the date head.
    var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];

    // Slash form: ROC "115/04/14" (3-digit yr) or Western "2026/04/14".
    var slash = s.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,2})/);
    if (slash) {
      var y = parseInt(slash[1], 10);
      if (y < 1911) y += 1911; // ROC → Western (4-digit Western years pass through)
      return y + '-' + pad2(parseInt(slash[2], 10)) + '-' + pad2(parseInt(slash[3], 10));
    }

    // Gregorian compact "YYYYMMDD" (+ optional HHMMSS), e.g. RESDTTM.
    var compact = s.match(/^(\d{4})(\d{2})(\d{2})/);
    if (compact) return compact[1] + '-' + compact[2] + '-' + compact[3];

    return null;
  }

  function findById(cat, id) {
    if (!cat) return null;
    for (var i = 0; i < cat.length; i++) {
      if (cat[i] && cat[i].id === id) return cat[i];
    }
    return null;
  }

  function pick(primary, fallback) {
    return primary != null ? primary : (fallback != null ? fallback : null);
  }

  // No-refHistory / no-candidate fallback: outer refLo/refHi + outer gender.
  function outerFallback(entry, gender) {
    var rLo = entry.refLo != null ? entry.refLo : null;
    var rHi = entry.refHi != null ? entry.refHi : null;
    if (gender === 'M' && (entry.loM != null || entry.hiM != null)) {
      return { refLo: pick(entry.loM, rLo), refHi: pick(entry.hiM, rHi) };
    }
    if (gender === 'F' && (entry.loF != null || entry.hiF != null)) {
      return { refLo: pick(entry.loF, rLo), refHi: pick(entry.hiF, rHi) };
    }
    return { refLo: rLo, refHi: rHi };
  }

  // Resolve gender against a chosen refHistory base item (3-layer chain).
  function resolveGender(base, entry, gender) {
    var rLo = base.refLo != null ? base.refLo : null;
    var rHi = base.refHi != null ? base.refHi : null;
    if (gender === 'M') {
      if (base.refLoM != null || base.refHiM != null) {
        return { refLo: pick(base.refLoM, rLo), refHi: pick(base.refHiM, rHi) };
      }
      if (entry.loM != null || entry.hiM != null) {
        return { refLo: pick(entry.loM, rLo), refHi: pick(entry.hiM, rHi) };
      }
    } else if (gender === 'F') {
      if (base.refLoF != null || base.refHiF != null) {
        return { refLo: pick(base.refLoF, rLo), refHi: pick(base.refHiF, rHi) };
      }
      if (entry.loF != null || entry.hiF != null) {
        return { refLo: pick(entry.loF, rLo), refHi: pick(entry.hiF, rHi) };
      }
    }
    return { refLo: rLo, refHi: rHi };
  }

  // ownerEntry supplies the outer gender fallback; rh is the refHistory list
  // to resolve against (BUN's list when resolving BUN_pre / BUN_post).
  function resolveFromHistory(ownerEntry, rh, machineSource, date, gender) {
    var cands = [];
    for (var i = 0; i < rh.length; i++) {
      var h = rh[i];
      if ((h.machine === machineSource || h.machine === '*') && h.validFrom <= date) {
        cands.push(h);
      }
    }
    if (!cands.length) return outerFallback(ownerEntry, gender);

    cands.sort(function (a, b) {
      var aSpec = a.machine === '*' ? 0 : 1;
      var bSpec = b.machine === '*' ? 0 : 1;
      if (aSpec !== bSpec) return bSpec - aSpec;            // machine-specific first
      if (a.validFrom !== b.validFrom) return a.validFrom < b.validFrom ? 1 : -1; // latest first
      return 0;
    });

    return resolveGender(cands[0], ownerEntry, gender);
  }

  function warnOnce(testId) {
    if (warned[testId]) return;
    warned[testId] = true;
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[resolveRef] missing/unparseable reportDate for "' + testId +
        '" — falling back to today (newest ref).');
    }
  }

  return function resolveRef(testId, machineSource, reportDate, patientGender, catalogList) {
    var entry = findById(catalogList, testId);
    if (!entry) return { refLo: null, refHi: null };

    var date = normalizeRefDate(reportDate);
    if (date === null) { warnOnce(testId); date = todayIso(); }

    var rh = entry.refHistory;
    if (!rh || !rh.length) {
      // BUN_pre / BUN_post inherit BUN's refHistory (§1.1 special-case).
      if (testId === 'BUN_pre' || testId === 'BUN_post') {
        var bun = findById(catalogList, 'BUN');
        if (bun && bun.refHistory && bun.refHistory.length) {
          return resolveFromHistory(bun, bun.refHistory, machineSource, date, patientGender);
        }
      }
      return outerFallback(entry, patientGender);
    }

    return resolveFromHistory(entry, rh, machineSource, date, patientGender);
  };
})();

// ─── Exports (CommonJS for tests + browser global for the bundled snapshot) ──
if (typeof module !== 'undefined' && module.exports) {
  module.exports = resolveRef;
}
if (typeof window !== 'undefined') {
  window.resolveRef = resolveRef;
}
