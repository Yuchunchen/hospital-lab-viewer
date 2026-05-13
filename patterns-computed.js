// ════════════════════════════════════════════════════════════════════════════
// AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
//
// Source of truth: hospital-lab-patterns repo (computed.js)
//   https://github.com/Yuchunchen/hospital-lab-patterns
//
// To update:
//   1. Edit ../hospital-lab-patterns/patterns/<file>.js
//   2. git commit + git push (in the patterns repo)
//   3. cd hospital-lab-viewer && node sync-patterns.js
//   4. Reload the extension at chrome://extensions
//
// Synced at: 2026-05-13T13:23:07.195Z
// ════════════════════════════════════════════════════════════════════════════
'use strict';

/**
 * computed.js — Derived-value formulas shared by viewer and reporter.
 *
 * Each computation has:
 *   id        unique string
 *   needs     ids of source patterns (looked up from viewer/reporter
 *             catalogs by the consumer)
 *   compute   pure function — receives an input bag keyed by `needs` ids,
 *             returns the computed value (number, string, or {value, tag}).
 *   meta      optional display info {unit, ref, hi, lo}
 *
 * The implementations here mirror those embedded in
 * hospital-lab-viewer/report.js and hospital-lab-reporter/hospital-lab-data.html
 * so that consumers can move to this file without behaviour changes.
 */

// ─── eGFR via CKD-EPI 2021 (race-free) ───────────────────────────────────
//   GFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^-1.200 × 0.9938^age × (1.012 if female)
// Where κ = 0.7 (F) / 0.9 (M); α = -0.241 (F) / -0.302 (M).
function eGFR_CKDEPI_2021({ creatinine, age, gender }) {
  if (creatinine == null || age == null || gender == null) return null;
  const isF = gender === 'F' || gender === '女';
  const k     = isF ? 0.7  : 0.9;
  const alpha = isF ? -0.241 : -0.302;
  const female_factor = isF ? 1.012 : 1.0;
  const ratio = creatinine / k;
  const min = Math.min(ratio, 1);
  const max = Math.max(ratio, 1);
  return +(142 * Math.pow(min, alpha) * Math.pow(max, -1.200)
              * Math.pow(0.9938, age) * female_factor).toFixed(1);
}

// ─── URR (Urea Reduction Ratio) ──────────────────────────────────────────
function URR({ bun_pre, bun_post }) {
  if (bun_pre == null || bun_post == null || bun_pre === 0) return null;
  return +((1 - bun_post / bun_pre) * 100).toFixed(1);
}

// ─── Ca × P product ──────────────────────────────────────────────────────
function CaP({ Ca, P }) {
  if (Ca == null || P == null) return null;
  return +(Ca * P).toFixed(1);
}

// ─── UIBC (Unsaturated Iron Binding Capacity) ───────────────────────────
//   UIBC = TIBC − Fe
function UIBC({ TIBC, Fe }) {
  if (TIBC == null || Fe == null) return null;
  const v = TIBC - Fe;
  return v >= 0 ? +v.toFixed(1) : null;
}

// ─── PSA Free/Total ratio (only meaningful when PSA > 4) ─────────────────
function PSARatio({ PSA, FreePSA }) {
  if (PSA == null || FreePSA == null || PSA <= 4) return null;
  const r = +(FreePSA / PSA * 100).toFixed(1);
  let tag = 'normal';
  if (r < 10) tag = 'warning';
  else if (r < 25) tag = 'caution';
  return { value: r, tag };
}

// ─── GFR stage (KDIGO) ───────────────────────────────────────────────────
function GFRStage({ eGFR }) {
  if (eGFR == null) return null;
  if (eGFR >= 90) return '正常';
  if (eGFR >= 60) return 'CKD2';
  if (eGFR >= 45) return 'CKD3a';
  if (eGFR >= 30) return 'CKD3b';
  if (eGFR >= 15) return 'CKD4';
  return 'CKD5';
}

// ─── UACR stage (mg/g) ───────────────────────────────────────────────────
function UACRStage({ UACR }) {
  if (UACR == null) return null;
  if (UACR < 30)  return '正常';
  if (UACR < 300) return 'A2';
  return 'A3';
}

// ─── UPCR stage (mg/g) ───────────────────────────────────────────────────
function UPCRStage({ UPCR }) {
  if (UPCR == null) return null;
  if (UPCR < 150)  return '正常';
  if (UPCR < 500)  return '輕度';
  if (UPCR < 3500) return '顯著';
  return '腎病範圍';
}

// ─── KDIGO risk grid ─────────────────────────────────────────────────────
//
//             | A1 (UACR<30)   A2 (30–300)   A3 (>=300)
//  G1 (>=90)  | low            moderate       high
//  G2 (60–89) | low            moderate       high
//  G3a(45–59) | moderate       high           very high
//  G3b(30–44) | high           very high      very high
//  G4 (15–29) | very high      very high      very high
//  G5 (<15)   | very high      very high      very high
function KDIGORisk({ eGFR, UACR }) {
  if (eGFR == null || UACR == null) return null;
  const g = eGFR >= 90 ? 1 : eGFR >= 60 ? 2 : eGFR >= 45 ? 3 : eGFR >= 30 ? 4 : eGFR >= 15 ? 5 : 6;
  const a = UACR < 30 ? 1 : UACR < 300 ? 2 : 3;
  const grid = [
    null,
    ['低', '中', '高'],
    ['低', '中', '高'],
    ['中', '高', '極高'],
    ['高', '極高', '極高'],
    ['極高', '極高', '極高'],
    ['極高', '極高', '極高'],
  ];
  return grid[g][a - 1] + '風險';
}

// ─── Taiwan CKD stage (similar to KDIGO but uses UPCR fallback) ─────────
function TaiwanCKD({ eGFR, UACR, UPCR }) {
  if (eGFR == null) return null;
  // Damage marker: UACR ≥ 30 OR UPCR ≥ 150
  const hasDamage = (UACR != null && UACR >= 30) || (UPCR != null && UPCR >= 150);
  if (eGFR >= 90 && !hasDamage) return '正常';
  if (eGFR >= 90)  return '第一期';
  if (eGFR >= 60)  return hasDamage ? '第二期' : '正常';
  if (eGFR >= 45)  return '第三期 3a';
  if (eGFR >= 30)  return '第三期 3b';
  if (eGFR >= 15)  return '第四期';
  return '第五期';
}

// ─── Early CKD class (健保 P1 / P2) ─────────────────────────────────────
function EarlyCKD({ TaiwanCKD: tw, eGFR }) {
  if (eGFR == null) return null;
  if (tw === '正常') return '正常';
  return eGFR >= 45 ? 'P1早期' : 'P2中晚期';
}

// ─── HCV / HBsAg / RPR / TPHA qualitative ───────────────────────────────
//
// These map free-form "Reactive / Non-Reactive" plus an optional numeric
// titer into a user-facing string. Implementations live in each consumer's
// report.js today; the canonical behaviour is captured here for reuse.
function qualitativeFromText({ rawText, label }) {
  if (!rawText) return null;
  // Match a label-prefixed line, e.g. "Anti-HCV: Non-Reactive  1.92"
  const re = new RegExp(`${label}[^:\\n]*:\\s*([^\\s,;]+)(?:\\s+([\\d.]+))?`, 'i');
  const m  = rawText.match(re);
  if (!m) return null;
  const verdict = m[1].toLowerCase();
  const isPositive = /^react/.test(verdict);
  const isNegative = /^non[-\s]?react/.test(verdict);
  let label_zh;
  if (isPositive) label_zh = '帶原';
  else if (isNegative) label_zh = '正常';
  else label_zh = m[1]; // pass-through
  const titer = m[2] ? ` (${label} ${m[2]})` : '';
  return { value: label_zh + titer, tag: isPositive ? 'warning' : 'normal' };
}

// ─── Hepatitis display ──────────────────────────────────────────────────
//
// Three markers (HBsAg / Anti-HBs / Anti-HCV) share one display function;
// the only axis of variation is polarity:
//   antigen   — Reactive = 有疾病 (warning), Non-Reactive = 正常 (normal)
//   antibody  — Reactive = 有抗體 (normal),  Non-Reactive = 無抗體 (warning)
//
// Inputs come from raw catalog entries as arrays of {date, value, ...}
// (the consumer's parse loop produces these). We take the most recent.
// Returns { date, value, tag } or null when the qualitative entry is missing.
function _hepatitisDisplay(qualEntries, titerEntries, label, polarity) {
  const q = (qualEntries && qualEntries[0]) || null;
  if (!q) return null;
  const t = (titerEntries && titerEntries[0]) || null;
  const numStr = t ? t.value : '';

  let displayVal, tag;
  const qualRaw = q.value;
  if (qualRaw === 'Reactive') {
    if (polarity === 'antigen') { displayVal = '帶原';   tag = 'warning'; }
    else                         { displayVal = '有抗體'; tag = 'normal';  }
  } else if (qualRaw === 'Non-Reactive') {
    if (polarity === 'antigen') { displayVal = '正常';   tag = 'normal';  }
    else                         { displayVal = '無抗體'; tag = 'warning'; }
  } else {
    displayVal = qualRaw; tag = 'caution';
  }
  if (numStr) displayVal += ` (${label} ${numStr})`;

  return { date: q.date, value: displayVal, tag };
}

function HBsAgDisplay({ HBsAg, HBsAgTiter }) {
  return _hepatitisDisplay(HBsAg, HBsAgTiter, 'HBsAg', 'antigen');
}
function AntiHBsDisplay({ AntiHBs, AntiHBsTiter }) {
  return _hepatitisDisplay(AntiHBs, AntiHBsTiter, 'Anti-HBs', 'antibody');
}
function HCV({ AntiHCV, AntiHCVTiter }) {
  return _hepatitisDisplay(AntiHCV, AntiHCVTiter, 'Anti-HCV', 'antigen');
}

// ─── Computation registry ───────────────────────────────────────────────
const COMPUTATIONS = [
  { id:'eGFR',       needs:['CREAT', '__patient.age', '__patient.gender'],
    compute: ({ CREAT, age, gender }) => eGFR_CKDEPI_2021({ creatinine: CREAT, age, gender }),
    meta:{ unit:'mL/min/1.73m²', ref:'> 60', lo:60 } },

  { id:'URR',        needs:['BUNPre', 'BUNPost'],
    compute: ({ BUNPre, BUNPost }) => URR({ bun_pre: BUNPre, bun_post: BUNPost }),
    meta:{ unit:'%', ref:'> 65%', lo:65 } },

  { id:'CaP',        needs:['Ca', 'P'],
    compute: ({ Ca, P }) => CaP({ Ca, P }),
    meta:{ unit:'', ref:'< 55', hi:55 } },

  { id:'UIBC',       needs:['TIBC', 'Fe'],
    compute: ({ TIBC, Fe }) => UIBC({ TIBC, Fe }),
    meta:{ unit:'µg/dL', ref:'110–370 µg/dL', lo:110, hi:370 } },

  { id:'PSARatio',   needs:['PSA', 'FreePSA'],
    compute: ({ PSA, FreePSA }) => PSARatio({ PSA, FreePSA }),
    meta:{ unit:'%', ref:'>25 normal, 10-25 caution, <10 warning' } },

  { id:'GFRStage',   needs:['eGFR'],
    compute: ({ eGFR }) => GFRStage({ eGFR }) },

  { id:'UACRStage',  needs:['UACR'],
    compute: ({ UACR }) => UACRStage({ UACR }) },

  { id:'UPCRStage',  needs:['UPCR'],
    compute: ({ UPCR }) => UPCRStage({ UPCR }) },

  { id:'KDIGORisk',  needs:['eGFR', 'UACR'],
    compute: ({ eGFR, UACR }) => KDIGORisk({ eGFR, UACR }) },

  { id:'TaiwanCKD',  needs:['eGFR', 'UACR', 'UPCR'],
    compute: ({ eGFR, UACR, UPCR }) => TaiwanCKD({ eGFR, UACR, UPCR }) },

  { id:'EarlyCKD',   needs:['eGFR', 'TaiwanCKD'],
    compute: ({ eGFR, TaiwanCKD: tw }) => EarlyCKD({ eGFR, TaiwanCKD: tw }) },

  { id:'HBsAgDisplay',   needs:['HBsAg', 'HBsAgTiter'],
    compute: HBsAgDisplay },

  { id:'AntiHBsDisplay', needs:['AntiHBs', 'AntiHBsTiter'],
    compute: AntiHBsDisplay },

  { id:'HCV',            needs:['AntiHCV', 'AntiHCVTiter'],
    compute: HCV },
];

// Pure helpers (also exported for direct use)
const HELPERS = {
  eGFR_CKDEPI_2021,
  URR, CaP, UIBC, PSARatio,
  GFRStage, UACRStage, UPCRStage,
  KDIGORisk, TaiwanCKD, EarlyCKD,
  qualitativeFromText,
  _hepatitisDisplay,
  HBsAgDisplay, AntiHBsDisplay, HCV,
};

// ─── Exports ─────────────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COMPUTATIONS, HELPERS };
}
if (typeof window !== 'undefined') {
  window.HOSPITAL_LAB_PATTERNS_COMPUTED = { COMPUTATIONS, HELPERS };
}
