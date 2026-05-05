// ════════════════════════════════════════════════════════════════════════════
// AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
//
// Source of truth: hospital-lab-patterns repo (normalizers.js)
//   https://github.com/Yuchunchen/hospital-lab-patterns
//
// To update:
//   1. Edit ../hospital-lab-patterns/patterns/<file>.js
//   2. git commit + git push (in the patterns repo)
//   3. cd hospital-lab-viewer && node sync-patterns.js
//   4. Reload the extension at chrome://extensions
//
// Synced at: 2026-05-05T21:50:53.523Z
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
