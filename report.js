'use strict';

// ─── Date helpers ─────────────────────────────────────────────────────────────
// "20260414203800" → "115/04/14"
function resdttmToTaiwan(str) {
  if (!str || str.length < 8) return null;
  const y = +str.slice(0, 4);
  const m = str.slice(4, 6);
  const d = str.slice(6, 8);
  if (!y) return null;
  return `${y - 1911}/${m}/${d}`;
}

// ─── Build result map ─────────────────────────────────────────────────────────
// Returns { testId: [{date, value}, ...] }  — max 3 entries, most recent first
const MAX_HISTORY = 3;

// Filter TEST_MAP by patient gender. 'M' or 'F' entries are shown only for the
// matching gender; entries without a gender field are shown for everyone.
// If patient gender is unknown (''), all entries are returned.
function genderFilteredTests(gender, hivReport) {
  return TEST_MAP.filter(t => {
    // HIV-only entries require the HIV checkbox
    if (t.hivOnly && !hivReport) return false;
    if (!t.gender) return true;
    if (!gender)   return true;
    if (gender === '男' && t.gender === 'M') return true;
    if (gender === '女' && t.gender === 'F') return true;
    return false;
  });
}

// ─── CKD-EPI 2021 eGFR (race-free) ──────────────────────────────────────────
// Returns eGFR given serum creatinine (mg/dL), age (years), gender ('男'/'女').
function calcEGFR(cr, age, gender) {
  const scr = parseFloat(cr);
  if (isNaN(scr) || scr <= 0 || !age) return null;
  const isFemale = gender === '女';
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const sexMul = isFemale ? 1.012 : 1;
  const minRatio = Math.min(scr / kappa, 1);
  const maxRatio = Math.max(scr / kappa, 1);
  return Math.round(
    142 * Math.pow(minRatio, alpha) * Math.pow(maxRatio, -1.200)
        * Math.pow(0.9938, +age) * sexMul
  );
}

// ─── Kidney Disease Staging ──────────────────────────────────────────────────

// GFR stage: G1–G5
function getGFRStage(egfr) {
  if (egfr == null) return null;
  if (egfr >= 90) return { stage: '正常', label: '正常或偏高', range: '≥90' };
  if (egfr >= 60) return { stage: 'CKD2', label: '輕微下降', range: '60–89' };
  if (egfr >= 45) return { stage: 'CKD3a', label: '輕度至中度下降', range: '45–59' };
  if (egfr >= 30) return { stage: 'CKD3b', label: '中度至重度下降', range: '30–44' };
  if (egfr >= 15) return { stage: 'CKD4', label: '重度下降', range: '15–29' };
  return { stage: 'CKD5', label: '腎衰竭', range: '<15' };
}

// UACR stage: A1–A3
function getUACRStage(uacr) {
  if (uacr == null) return null;
  if (uacr < 30)  return { stage: '正常', label: '正常至輕微增加', range: '<30' };
  if (uacr <= 300) return { stage: 'A2', label: '中度增加', range: '30–300' };
  return { stage: 'A3', label: '重度增加', range: '>300' };
}

// UPCR stage
function getUPCRStage(upcr) {
  if (upcr == null) return null;
  if (upcr < 150)   return { stage: '正常', label: '正常', range: '<150' };
  if (upcr <= 500)  return { stage: '輕度', label: '輕度', range: '150–500' };
  if (upcr <= 5000) return { stage: '顯著', label: '顯著', range: '500–5000' };
  return { stage: '腎病範圍', label: '腎病範圍', range: '>5000' };
}

// KDIGO risk matrix: GFR stage × UACR stage → risk level
// Returns { risk, color } where color is CSS for display
function getKDIGORisk(gfrStage, uacrStage) {
  if (!gfrStage || !uacrStage) return null;
  const matrix = {
    '正常':  { '正常': '低',   'A2': '中',   'A3': '高' },
    'CKD2':  { '正常': '低',   'A2': '中',   'A3': '高' },
    'CKD3a': { '正常': '中',   'A2': '高',   'A3': '極高' },
    'CKD3b': { '正常': '高',   'A2': '極高', 'A3': '極高' },
    'CKD4':  { '正常': '極高', 'A2': '極高', 'A3': '極高' },
    'CKD5':  { '正常': '極高', 'A2': '極高', 'A3': '極高' },
  };
  const risk = matrix[gfrStage.stage]?.[uacrStage.stage] || '—';
  const colorMap = { '低': '#1e8449', '中': '#d4ac0d', '高': '#e67e22', '極高': '#c0392b' };
  return { risk, color: colorMap[risk] || '#000' };
}

// Taiwan CKD stage: based on GFR + kidney damage markers (UACR/UPCR)
// Kidney damage marker = UACR ≥ 30 mg/g OR UPCR ≥ 150 mg/g
// Stage 1:  GFR ≥ 90  AND has damage marker
// Stage 2:  GFR 60–89 AND has damage marker
// Stage 3a: GFR 45–59 (regardless of markers)
// Stage 3b: GFR 30–44 (regardless of markers)
// Stage 4:  GFR 15–29
// Stage 5:  GFR < 15
function getTaiwanCKDStage(egfr, upcr, uacr) {
  if (egfr == null) return null;
  if (egfr < 15) return { stage: '第五期', label: '末期腎臟病變', desc: 'GFR<15' };
  if (egfr < 30) return { stage: '第四期', label: '重度腎功能障礙', desc: 'GFR 15–29' };
  if (egfr < 45) return { stage: '第三b期', label: '中至重度腎功能障礙', desc: 'GFR 30–44' };
  if (egfr < 60) return { stage: '第三a期', label: '輕至中度腎功能障礙', desc: 'GFR 45–59' };
  // Stage 1 & 2 require kidney damage marker: UACR ≥ 30 or UPCR ≥ 150
  const hasDamage = (uacr != null && uacr >= 30) || (upcr != null && upcr >= 150);
  if (hasDamage) {
    if (egfr >= 90) return { stage: '第一期', label: '腎功能正常但有腎損傷', desc: 'GFR≥90 且有腎損傷標記' };
    if (egfr >= 60) return { stage: '第二期', label: '輕度腎功能障礙合併腎損傷', desc: 'GFR 60–89 且有腎損傷標記' };
  }
  return null; // GFR ≥ 60 without damage markers → not CKD
}

// Taiwan Early CKD classification (健保 Pre-ESRD)
// P1 (早期): CKD Stage 1–3a (eGFR ≥ 45) with damage markers
// P2 (中晚期): CKD Stage 3b–5 (eGFR < 45)
function getEarlyCKDClass(ckdStage) {
  if (!ckdStage) return null;
  const s = ckdStage.stage;
  if (s === '第一期' || s === '第二期' || s === '第三a期')
    return { stage: 'P1 早期', label: 'CKD 1–3a（eGFR≥45）' };
  if (s === '第三b期' || s === '第四期' || s === '第五期')
    return { stage: 'P2 中晚期', label: 'CKD 3b–5（eGFR<45）' };
  return null;
}

function buildResultMap(orders, tests, patientInfo) {
  const map = {};

  // Sort by resdttm descending (most recent first); empty resdttm goes last
  const sorted = [...orders].sort((a, b) =>
    (b.resdttm || '0').localeCompare(a.resdttm || '0')
  );

  tests.forEach(test => {
    if (test.kind === 'text') return;   // handled by buildTextResultMap
    if (!test.pattern) { map[test.id] = []; return; }  // computed without pattern (e.g. PSARatio)
    map[test.id] = [];
    sorted.forEach(order => {
      if (map[test.id].length >= MAX_HISTORY) return;
      // Optional orderName filter (e.g. BUN洗前/洗後 uses orderName to distinguish)
      if (test.orderNameFilter && !test.orderNameFilter.test(order.orderName || '')) return;
      const text = order.reportText || '';
      const m = text.match(test.pattern);
      if (!m) return;
      const date = resdttmToTaiwan(order.resdttm) || order.orderDate || '';
      // Deduplicate by date
      if (map[test.id].some(r => r.date === date)) return;

      const orderDate = order.orderDate || '';
      // Computed eGFR: convert Creatinine value to eGFR
      if (test.computed === 'eGFR' && patientInfo) {
        const egfr = calcEGFR(m[1], patientInfo.age, patientInfo.gender);
        if (egfr != null) {
          map[test.id].push({ date, value: String(egfr), orderDate });
        }
      } else {
        let val = m[1];
        // Apply unit normalization if defined (e.g. WBC 6700→6.7, Platelet 250000→250)
        if (test.normalize) {
          const n = parseFloat(val);
          if (!isNaN(n)) val = String(test.normalize(n));
        }
        map[test.id].push({ date, value: val, orderDate });
      }
    });
  });

  // ── Computed: Free PSA / Total PSA ratio ──────────────────────────────
  // Only meaningful when PSA > 4.
  // Pairing: same result date → same orderDate → nearest within 7 days.
  if (map['PSA'] && map['FreePSA']) {
    map['PSARatio'] = [];
    map['PSA'].forEach(psaEntry => {
      const psa = parseFloat(psaEntry.value);
      if (isNaN(psa) || psa <= 4) return;   // ratio only relevant when PSA > 4
      // 1. Exact same result date
      let freeEntry = map['FreePSA'].find(f => f.date === psaEntry.date);
      // 2. Same orderDate (same clinic visit, different report times)
      if (!freeEntry && psaEntry.orderDate) {
        freeEntry = map['FreePSA'].find(f => f.orderDate && f.orderDate === psaEntry.orderDate);
      }
      // 3. Nearest within 7 days
      if (!freeEntry) {
        const ref = parseTwDate(psaEntry.date);
        if (ref) {
          const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
          let best = null, bestDiff = Infinity;
          map['FreePSA'].forEach(f => {
            const d = parseTwDate(f.date);
            if (!d) return;
            const diff = Math.abs(d - ref);
            if (diff <= SEVEN_DAYS && diff < bestDiff) { best = f; bestDiff = diff; }
          });
          freeEntry = best;
        }
      }
      if (!freeEntry) return;
      const free = parseFloat(freeEntry.value);
      if (isNaN(free)) return;
      const ratio = (free / psa * 100).toFixed(1);
      // tag: 'normal' / 'caution' / 'warning' for color coding
      let tag = 'normal';
      if (ratio < 10) tag = 'warning';
      else if (ratio <= 25) tag = 'caution';
      map['PSARatio'].push({ date: psaEntry.date, value: ratio + '%', _tag: tag });
    });
  }

  // ── Computed: Kidney Disease Staging ────────────────────────────────────
  // Each staging entry derives values per-date from eGFR, UACR, or UPCR
  // and uses _tag for color coding (reuses psaRatioStyle).

  // GFR Stage — one entry per eGFR date
  // 正常/CKD2 = normal; CKD3a–CKD5 = hi (偏高 = red)
  if (map['eGFR'] && map['eGFR'].length) {
    map['GFRStage'] = map['eGFR'].map(e => {
      const stg = getGFRStage(parseFloat(e.value));
      if (!stg) return null;
      const tag = (stg.stage === '正常' || stg.stage === 'CKD2') ? 'normal' : 'hi';
      return { date: e.date, value: stg.stage, _tag: tag };
    }).filter(Boolean);
  }

  // UACR Stage — one entry per UACR date
  // Normal = normal; A2/A3 = hi (偏高 = red)
  if (map['UACR'] && map['UACR'].length) {
    map['UACRStage'] = map['UACR'].map(e => {
      const stg = getUACRStage(parseFloat(e.value));
      if (!stg) return null;
      const tag = stg.stage === '正常' ? 'normal' : 'hi';
      return { date: e.date, value: stg.stage, _tag: tag };
    }).filter(Boolean);
  }

  // UPCR Stage — one entry per UPCR date
  // Normal = normal; 輕度/顯著/腎病 = hi (偏高 = red)
  if (map['UPCR'] && map['UPCR'].length) {
    map['UPCRStage'] = map['UPCR'].map(e => {
      const stg = getUPCRStage(parseFloat(e.value));
      if (!stg) return null;
      const tag = stg.stage === '正常' ? 'normal' : 'hi';
      return { date: e.date, value: stg.stage, _tag: tag };
    }).filter(Boolean);
  }

  // Helper: parse Taiwan calendar date "114/03/25" → Date object
  function parseTwDate(str) {
    if (!str) return null;
    const m = str.match(/^(\d+)\/(\d+)\/(\d+)/);
    return m ? new Date(+m[1] + 1911, +m[2] - 1, +m[3]) : null;
  }

  // Helper: find matching entry — same date first, then most recent within 1 month
  function findNearby(entries, refDateStr) {
    if (!entries || !entries.length) return null;
    // 1. Exact same date
    const exact = entries.find(u => u.date === refDateStr);
    if (exact) return exact;
    // 2. Most recent within 1 month (30 days)
    const refDate = parseTwDate(refDateStr);
    if (!refDate) return null;
    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    let best = null, bestDiff = Infinity;
    entries.forEach(u => {
      const d = parseTwDate(u.date);
      if (!d) return;
      const diff = Math.abs(d - refDate);
      if (diff <= ONE_MONTH_MS && diff < bestDiff) {
        best = u; bestDiff = diff;
      }
    });
    return best;
  }

  // KDIGO Risk — combine eGFR + UACR per eGFR date
  // 低 = normal; 中/高/極高 = hi (偏高 = red)
  if (map['eGFR'] && map['eGFR'].length) {
    map['KDIGORisk'] = [];
    map['eGFR'].forEach(e => {
      const gStg = getGFRStage(parseFloat(e.value));
      if (!gStg) return;
      // Match UACR at same date, or fall back to most recent within 1 month
      const uacrEntry = findNearby(map['UACR'], e.date);
      if (!uacrEntry) return;
      const aStg = getUACRStage(parseFloat(uacrEntry.value));
      if (!aStg) return;
      const kdigo = getKDIGORisk(gStg, aStg);
      if (!kdigo) return;
      const tag = kdigo.risk === '低' ? 'normal' : 'hi';
      map['KDIGORisk'].push({ date: e.date, value: kdigo.risk, _tag: tag });
    });
  }

  // Taiwan CKD Stage — combine eGFR + UPCR + UACR per eGFR date
  // 正常 = normal; 第一~五期 = hi (偏高 = red)
  // G1/G2 require damage marker: UACR ≥ 30 or UPCR ≥ 150
  if (map['eGFR'] && map['eGFR'].length) {
    map['TaiwanCKD'] = [];
    map['EarlyCKD'] = [];
    map['eGFR'].forEach(e => {
      const egfr = parseFloat(e.value);
      // Match UPCR/UACR at same date, or fall back to most recent within 1 month
      const upcrEntry = findNearby(map['UPCR'], e.date);
      const upcr = upcrEntry ? parseFloat(upcrEntry.value) : null;
      const uacrEntry = findNearby(map['UACR'], e.date);
      const uacr = uacrEntry ? parseFloat(uacrEntry.value) : null;
      const twCKD = getTaiwanCKDStage(egfr, upcr, uacr);
      if (!twCKD) {
        map['TaiwanCKD'].push({ date: e.date, value: '正常', _tag: 'normal' });
        map['EarlyCKD'].push({ date: e.date, value: '正常', _tag: 'normal' });
      } else {
        map['TaiwanCKD'].push({ date: e.date, value: twCKD.stage, _tag: 'hi' });
        // Early CKD classification (P1/P2)
        const earlyCKD = getEarlyCKDClass(twCKD);
        if (earlyCKD) {
          const earlyTag = earlyCKD.stage.startsWith('P1') ? 'caution' : 'hi';
          map['EarlyCKD'].push({ date: e.date, value: earlyCKD.stage, _tag: earlyTag });
        }
      }
    });
  }

  // ── Computed: Hepatitis display (HBsAg / Anti-HBs / HCV) ────────────
  // Dispatcher delegates to patterns-computed.js helpers, which take the
  // raw qualitative + raw titer entries (already populated by the parse
  // loop above via the extract-only manifest entries) and produce the
  // single 帶原/正常/有抗體 + (label titer) verdict tuple. The previous
  // inline findHepatitis / findAntiHBs regex helpers are gone — catalog
  // is now the single source of truth for hepatitis regexes.
  const _PC = (typeof window !== 'undefined' && window.HOSPITAL_LAB_PATTERNS_COMPUTED)
    ? window.HOSPITAL_LAB_PATTERNS_COMPUTED.HELPERS : null;
  function runHepDisplay(outId, fn, neededIds) {
    if (!fn) { map[outId] = []; return; }
    const inputs = {};
    for (const k of neededIds) inputs[k] = map[k] || [];
    const out = fn(inputs);
    map[outId] = out
      ? [{ date: out.date, value: out.value, _tag: out.tag }]
      : [];
  }
  runHepDisplay('HCV',            _PC && _PC.HCV,            ['AntiHCV', 'AntiHCVTiter']);
  runHepDisplay('HBsAgDisplay',   _PC && _PC.HBsAgDisplay,   ['HBsAg',   'HBsAgTiter']);
  runHepDisplay('AntiHBsDisplay', _PC && _PC.AntiHBsDisplay, ['AntiHBs', 'AntiHBsTiter']);

  // ── Computed: RPR — single most-recent result (all-time) ──────────
  // Format: REACTIVE / NON-REACTIVE / raw English text
  function findRPR() {
    for (const order of sorted) {
      const text = order.reportText || '';
      const qm = text.match(/REACT:\s*(\S+)/);
      if (!qm) continue;
      const date = resdttmToTaiwan(order.resdttm) || order.orderDate || '';
      const qualRaw = qm[1];  // "REACTIVE", "NON-REACTIVE", etc.
      let displayVal, tag;
      if (/^REACTIVE$/i.test(qualRaw)) {
        displayVal = 'REACTIVE'; tag = 'warning';
      } else if (/^NON-REACTIVE$/i.test(qualRaw)) {
        displayVal = 'NON-REACTIVE'; tag = 'normal';
      } else {
        displayVal = qualRaw; tag = 'caution';
      }
      // Append titer if present (e.g. "OTHER: 1:4X")
      const tm = text.match(/OTHER:\s*(\S+)/);
      if (tm) displayVal += ` (${tm[1]})`;
      return [{ date, value: displayVal, _tag: tag }];
    }
    return [];
  }
  map['RPR'] = findRPR();

  // ── Computed: TPHA — single most-recent result (all-time) ─────────
  // Combines qualitative + numeric: "Reactive (TPHA 17.27)"
  function findTPHA() {
    for (const order of sorted) {
      const text = order.reportText || '';
      const qm = text.match(/TPHA\(TT\)[^:]*:\s*(\S+)/);
      if (!qm) continue;
      const date = resdttmToTaiwan(order.resdttm) || order.orderDate || '';
      const qualRaw = qm[1];
      // Look for numeric TPHA value in the same report
      const nm = text.match(/TPHA\(TT\)[^:]*:\s*([\d.]+)/);
      // The qualitative match might be the numeric — check both patterns
      let displayVal, tag;
      if (/^Reactive$/i.test(qualRaw)) {
        displayVal = 'Reactive'; tag = 'warning';
      } else if (/^Non-Reactive$/i.test(qualRaw)) {
        displayVal = 'Non-Reactive'; tag = 'normal';
      } else if (/^\d/.test(qualRaw)) {
        // Only numeric found — skip, look for qualitative in another match
        continue;
      } else {
        displayVal = qualRaw; tag = 'caution';
      }
      // Find numeric value (may be a separate TPHA line)
      const allMatches = [...text.matchAll(/TPHA\(TT\)[^:]*:\s*(\S+)/g)];
      let numStr = '';
      for (const am of allMatches) {
        if (/^[\d.]+$/.test(am[1])) { numStr = am[1]; break; }
      }
      if (numStr) displayVal += ` (TPHA ${numStr})`;
      return [{ date, value: displayVal, _tag: tag }];
    }
    return [];
  }
  map['TPHA'] = findTPHA();

  return map;
}

// ─── Build text-report map (for kind:'text' entries) ─────────────────────────
// Returns { testId: { date, orderName, text, hits:[matchedKeyword,...] } }
// Picks the MOST RECENT order whose orderName matches test.orderNameMatch.
function buildTextResultMap(orders, tests) {
  const textTests = tests.filter(t => t.kind === 'text');
  if (!textTests.length) return {};

  const sorted = [...orders].sort((a, b) =>
    (b.resdttm || '0').localeCompare(a.resdttm || '0')
  );

  const map = {};
  textTests.forEach(test => {
    for (const order of sorted) {
      const name = order.orderName || '';
      if (!test.orderNameMatch.test(name)) continue;
      const text = (order.reportText || '').trim();
      if (!text) continue;
      const date = resdttmToTaiwan(order.resdttm) || order.orderDate || '';
      map[test.id] = { date, orderName: name.trim(), text };
      break;   // only the most recent
    }
  });
  return map;
}

// ─── Value color ──────────────────────────────────────────────────────────────
// Normal values inherit the default style (black, not bold) — only out-of-range
// values get colored + bolded so they pop on the page.
// isLatest: true for the most-recent (rightmost) value cell
// gender:   '男' / '女' / '' — when entry has loM/hiM/loF/hiF, picks gender-specific
//           thresholds; falls back to test.lo / test.hi (wide envelope) when unknown.
function valueStyle(val, test, bw, isLatest, gender) {
  const n = parseFloat(String(val).replace(/^[<>]\s*/, ''));
  let s = '';
  if (!isNaN(n)) {
    let hi = test.hi, lo = test.lo;
    if (gender === '男' && (test.hiM != null || test.loM != null)) {
      hi = test.hiM != null ? test.hiM : hi;
      lo = test.loM != null ? test.loM : lo;
    } else if (gender === '女' && (test.hiF != null || test.loF != null)) {
      hi = test.hiF != null ? test.hiF : hi;
      lo = test.loF != null ? test.loF : lo;
    }
    const isHigh = hi != null && n > hi;
    const isLow  = lo != null && n < lo;
    if (isHigh) {
      s += bw ? 'font-weight:700;text-decoration:underline;' : 'color:#c0392b;font-weight:700;';
    } else if (isLow) {
      s += bw ? 'font-weight:700;font-style:italic;' : 'color:#2471a3;font-weight:700;';
    }
  }
  if (isLatest) s += 'background:#ddd;padding:0 3px;';
  return s;
}

// ─── PSA ratio style ─────────────────────────────────────────────────────────
// tag: 'normal' (>25%), 'caution' (10-25%), 'warning' (<10%)
//       'hi' = out-of-range high,  'lo' = out-of-range low
function psaRatioStyle(tag, bw) {
  if (tag === 'warning' || tag === 'hi') return bw ? 'font-weight:700;text-decoration:underline;' : 'color:#c0392b;font-weight:700;';
  if (tag === 'lo') return bw ? 'font-weight:700;font-style:italic;' : 'color:#2471a3;font-weight:700;';
  if (tag === 'caution') return bw ? 'font-weight:700;font-style:italic;' : 'color:#e67e22;font-weight:700;';
  return '';  // normal
}

// ─── HTML escape ─────────────────────────────────────────────────────────────
function h(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Build one TEXT block (multi-row form layout) ───────────────────────────
// Renders each row of test.rows as:
//   [label] [field1 name][field1 value-blank] [options...] [trailing]
// Values are auto-extracted via field.pattern when present; otherwise the
// cell shows blank underscores (for doctor to hand-fill). Option keywords
// found in reportText are shown red-bold; missing ones are gray.

function escRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildTextBlock(test, entry) {
  const { date = '', orderName = '', text = '' } = entry || {};
  const rows = test.rows || [];

  function optionHit(opt) {
    if (!entry || !text) return false;
    try { return new RegExp(escRegExp(opt), 'i').test(text); }
    catch { return false; }
  }

  const rowsHtml = rows.map(row => {
    const labelCell = `<td class="tg-label">${h(row.label || '')}</td>`;

    const fieldCells = (row.fields || []).map(f => {
      let val = '';
      if (entry && f.pattern) {
        const m = text.match(f.pattern);
        if (m) val = m[1];
      }
      const valHtml = val
        ? `<span class="tg-fill">${h(val)}</span>`
        : '<span class="tg-blank">______</span>';
      return `<td class="tg-field">${h(f.name)}</td><td class="tg-val">${valHtml}</td>`;
    }).join('');

    const optsHtml = (row.options || []).map(opt => {
      const on = optionHit(opt);
      return `<span class="${on ? 'kw-hit' : 'kw-miss'}">${h(opt)}</span>`;
    }).join(' ');

    const trailingHtml = row.trailing
      ? `<span class="tg-trailing"> → ${h(row.trailing)}</span>`
      : '';

    return `<tr>${labelCell}${fieldCells}<td class="tg-opts">${optsHtml}${trailingHtml}</td></tr>`;
  }).join('');

  const metaLine = entry ? `${h(date)}　${h(orderName)}` : '—';

  return `
    <div class="test-block">
      <div class="test-name">${h(test.displayName)}</div>
      <div class="test-ref">${metaLine}</div>
      <table class="tg-grid">${rowsHtml}</table>
    </div>`;
}

// ─── Build one test block (dispatches on kind) ───────────────────────────────
function buildTestBlock(test, resultMap, bw, gender) {
  if (test.kind === 'text') {
    return buildTextBlock(test, resultMap[test.id]);
  }

  // ── Single-value display (e.g. HCV / HBsAg) ──────────────────────
  if (test.singleValue) {
    const entry = (resultMap[test.id] || [])[0];
    if (!entry) {
      return `
      <div class="test-block">
        <div class="test-name">${h(test.displayName)}</div>
        <table class="test-grid">
          <tr class="row-values"><td class="empty-val" colspan="3">—</td></tr>
        </table>
      </div>`;
    }
    let sty = '';
    if (entry._tag) {
      sty = psaRatioStyle(entry._tag, bw);
      sty += 'background:#ddd;padding:0 3px;';
    }
    return `
      <div class="test-block">
        <div class="test-name">${h(test.displayName)}</div>
        <div class="test-ref">${h(entry.date)}</div>
        <table class="test-grid">
          <tr class="row-values"><td colspan="3" style="${sty}">${h(entry.value)}</td></tr>
        </table>
      </div>`;
  }

  // ── Standard 3-timepoint display ──────────────────────────────────
  const vals  = resultMap[test.id] || [];
  const picked = vals.slice(0, MAX_HISTORY);
  const cells  = [];
  for (let i = picked.length; i < MAX_HISTORY; i++) cells.push(null);
  for (let i = picked.length - 1; i >= 0; i--) cells.push(picked[i]);

  const dateRow = cells
    .map(c => `<td>${c ? h(c.date) : ''}</td>`)
    .join('');

  // Find the index of the most recent (rightmost non-null) cell
  let latestIdx = -1;
  for (let i = cells.length - 1; i >= 0; i--) { if (cells[i]) { latestIdx = i; break; } }

  const valRow = cells
    .map((c, i) => {
      if (!c) return '<td class="empty-val">—</td>';
      // PSARatio uses _tag for color coding instead of hi/lo
      if (c._tag) {
        const star = c._tag === 'warning' ? '*' : '';
        let sty = psaRatioStyle(c._tag, bw);
        if (i === latestIdx) sty += 'background:#ddd;padding:0 3px;';
        return `<td style="${sty}">${h(c.value)}${star}</td>`;
      }
      return `<td style="${valueStyle(c.value, test, bw, i === latestIdx, gender)}">${h(c.value)}</td>`;
    })
    .join('');

  const meaningHtml = test.meaning
    ? `<div class="test-meaning">${h(test.meaning)}</div>`
    : '';

  return `
      <div class="test-block">
        <div class="test-name">${h(test.displayName)}</div>
        <div class="test-ref">${h(test.ref)}</div>
        ${meaningHtml}
        <table class="test-grid">
          <tr class="row-dates">${dateRow}</tr>
          <tr class="row-values">${valRow}</tr>
        </table>
      </div>`;
}

// ─── Build one section box ────────────────────────────────────────────────────
function buildSectionBox(sectionName, tests, resultMap, bw, gender) {
  const blocks = tests.map(t => buildTestBlock(t, resultMap, bw, gender)).join('');
  return `
    <div class="section-box">
      <div class="section-title">${h(sectionName)}</div>
      ${blocks}
    </div>`;
}

// ─── Doctor reminder: recent tests NOT in the summary ───────────────────────
// Returns a list of {date, name} for LAB orders within REMIND_MONTHS whose
// reportText contains content but doesn't match any TEST_MAP regex —
// i.e. tests the patient had recently that aren't on this printout.
const REMIND_MONTHS = 3;

function findUnshownOrders(orders, tests) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - REMIND_MONTHS);
  cutoff.setHours(0, 0, 0, 0);

  const seen = new Set();
  const out  = [];

  orders.forEach(order => {
    if (order.ordType !== 'LAB') return;

    // Parse date — prefer resdttm (Gregorian), fall back to nothing
    let date = null;
    if (order.resdttm && order.resdttm.length >= 8) {
      const y = +order.resdttm.slice(0, 4);
      const m = +order.resdttm.slice(4, 6) - 1;
      const d = +order.resdttm.slice(6, 8);
      if (y) date = new Date(y, m, d);
    }
    if (!date || date < cutoff) return;

    const text = (order.reportText || '').trim();
    if (text.length < 4) return;  // empty / status-only — skip

    // Skip if any of our (gender-filtered) mapped tests recognized a value here
    // (text-kind entries don't have a numeric pattern — skip them safely)
    const matched = tests.some(t => t.pattern && t.pattern.test(text));
    if (matched) return;

    const dateStr = resdttmToTaiwan(order.resdttm) || order.orderDate || '';
    const name    = (order.orderName || '').trim() || '(未命名)';
    const key     = dateStr + '|' + name;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ date: dateStr, name });
  });

  // Most recent first
  out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return out;
}

function buildReminderBox(unshown) {
  if (!unshown.length) return '';
  const items = unshown
    .map(o => `<li>${h(o.date)} — ${h(o.name)}</li>`)
    .join('');
  return `
    <div class="reminder-box">
      <div class="reminder-title">其他三個月內檢查 (${unshown.length}項)</div>
      <ul class="reminder-list">${items}</ul>
    </div>`;
}

// ─── Build one column ─────────────────────────────────────────────────────────
function buildColumn(pageNum, colNum, resultMap, tests, bw, gender) {
  const colTests = tests.filter(t => t.page === pageNum && t.col === colNum);
  if (!colTests.length) return '<div class="report-col"></div>';

  const order   = [];
  const bySection = {};
  colTests.forEach(t => {
    if (!bySection[t.section]) { order.push(t.section); bySection[t.section] = []; }
    bySection[t.section].push(t);
  });

  const html = order.map(s => buildSectionBox(s, bySection[s], resultMap, bw, gender)).join('');
  return `<div class="report-col">${html}</div>`;
}

// ─── Embedded CSS ────────────────────────────────────────────────────────────
const REPORT_CSS = `
  @page { size: A4 landscape; margin: 4mm; }
  *, *::before, *::after { box-sizing: border-box; }

  body {
    font-family: Verdana, Arial, "Microsoft JhengHei", "PingFang TC", sans-serif;
    margin: 0; padding: 0; font-size: 9pt; color: #222;
    -webkit-print-color-adjust: exact !important;
    color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* ── Page ──────────────────────────────────────────── */
  .page {
    position: relative;          /* anchor for .visit-serial-overlay */
    width: 100%;
    padding: 2mm 3mm 1.5mm;
    display: flex;
    flex-direction: column;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }

  .page-header {
    font-size: 11pt; font-weight: 700; margin-bottom: 0.3mm;
  }
  .page-sub {
    font-size: 7pt; color: #555; margin-bottom: 2mm;
  }

  /* ── 看診序號 overlay ─────────────────────────────────
     Tabular-paste mode prints the OPD visit serial (大字, 右上角) so 護
     理站可以快速依叫號順序分發報表。Free-form / 單一 chartno 模式不顯示。
     position:absolute → 不影響 4-column flex/grid layout. */
  .visit-serial-overlay {
    position: absolute;
    top: 5mm;
    right: 8mm;
    font-size: 48pt;
    font-weight: 900;
    color: #AAAAAA;              /* 淺灰 watermark 風,不搶 lab data 視線 */
    line-height: 1;
    z-index: 1000;
    -webkit-print-color-adjust: exact !important;
    color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @media print {
    .visit-serial-overlay {
      position: absolute;
      top: 5mm;
      right: 8mm;
    }
  }

  /* ── 4-column grid ─────────────────────────────────── */
  .report-4cols {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    column-gap: 4px;
    width: 100%;
    align-items: start;
  }

  .report-col {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  /* ── Section box ───────────────────────────────────── */
  .section-box {
    border: 0.7pt solid #666;
    border-radius: 2mm;
    padding: 3px 6px 4px;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: 10pt; font-weight: 700; margin-bottom: 1px;
  }

  /* ── Test block ────────────────────────────────────── */
  .test-block { margin-top: 2px; }

  .test-name {
    font-size: 9pt; font-weight: 700;
    border-top: 0.5pt solid #bbb;
    padding-top: 1px; line-height: 1.2;
  }
  .test-ref {
    font-size: 7pt; color: #226622; line-height: 1.15;
  }
  .test-meaning {
    font-size: 7pt; color: #888; line-height: 1.15;
  }

  /* ── 3-date grid ───────────────────────────────────── */
  .test-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-top: 1px;
  }
  .test-grid td { padding: 0 1px; text-align: center; border: none; }

  .row-dates td { font-size: 6.5pt; color: #888; line-height: 1.15; }

  .row-values td {
    font-size: 12pt; font-weight: 400; line-height: 1.1; color: #000;
  }
  .row-values td.empty-val {
    font-size: 10pt; color: #ccc; font-weight: 400;
  }

  /* ── Legend ────────────────────────────────────────── */
  .legend {
    font-size: 6.5pt; color: #555; margin-top: 1mm;
    display: flex; gap: 8px;
  }
  .legend span { white-space: nowrap; }
  .leg-hi { color: #c0392b; font-weight: 700; }
  .leg-lo { color: #2471a3; font-weight: 700; }
  .leg-ok { color: #000;    font-weight: 400; }

  /* ── Doctor reminder (recent tests not shown on summary) ─────── */
  .reminder-box {
    margin-top: 1.5mm;
    border: 0.7pt dashed #d68910;
    border-radius: 2mm;
    padding: 3px 6px 4px;
    background: #fff;
    page-break-inside: avoid;
  }
  .reminder-title {
    font-size: 7pt;
    font-weight: 700;
    color: #9a6d00;
    margin-bottom: 2px;
  }
  .reminder-list {
    margin: 0;
    padding-left: 15px;
    color: #333;
    columns: 3;
    column-gap: 10px;
  }
  .reminder-list li {
    font-size: 6.5pt;
    line-height: 1.35;
    break-inside: avoid;
  }

  /* ── Text-report blocks (kind:'text') — multi-row form table ────── */
  table.tg-grid {
    width: 100%;
    border-collapse: collapse;
    margin-top: 3px;
  }
  table.tg-grid td {
    padding: 1px 3px;
    vertical-align: middle;
    font-size: 8pt;
    line-height: 1.4;
    border: none;
  }
  .tg-label {
    font-weight: 700;
    white-space: nowrap;
    color: #1a5276;
  }
  .tg-field {
    color: #555;
    white-space: nowrap;
    padding-left: 4px;
  }
  .tg-val {
    text-align: center;
    min-width: 32px;
    white-space: nowrap;
  }
  .tg-fill {
    font-family: monospace;
    font-weight: 700;
    color: #000;
    border-bottom: 0.5pt solid #888;
    padding: 0 4px;
  }
  .tg-blank {
    color: #bbb;
    letter-spacing: 1px;
    font-family: monospace;
  }
  .tg-opts { padding-left: 4px; }
  .tg-trailing {
    color: #555;
    font-size: 7.5pt;
  }
  .kw-hit  { color: #b03a2e; font-weight: 700; margin-right: 4px; }
  .kw-miss { color: #999;    margin-right: 4px; }

  /* (Print button is provided by the viewer page, not the report HTML.) */

  /* ── Black & White mode ────────────────────────────── */
  body.bw, body.bw * { color: #000 !important; }
  body.bw .section-box    { border-color: #000; }
  body.bw .test-name      { border-top-color: #000; }
  body.bw .row-values td.empty-val { color: #000 !important; }
  body.bw .tg-blank       { color: #000 !important; }
  /* BW: lighter gray shading for latest values */
  body.bw .row-values td[style*="background"] { background: #eee !important; }
  /* Reminder box — gray to visually separate */
  body.bw .reminder-box   { border-color: #999; }
  body.bw .reminder-box, body.bw .reminder-box * { color: #666 !important; }
  body.bw .reminder-title { color: #666 !important; }
  body.bw .reminder-list, body.bw .reminder-list li { color: #666 !important; }
`;

// ─── Build page-2 text-report column (col 1–2 entries only) ─────────────────
function buildPage2Column(resultMap, tests, bw, gender) {
  // Only include page-2 entries without a col, or col 1/2 (text-report blocks)
  const p2Tests = tests.filter(t => t.page === 2 && (!t.col || t.col <= 2));
  if (!p2Tests.length) return '<div class="report-col"></div>';

  const order   = [];
  const bySection = {};
  p2Tests.forEach(t => {
    if (!bySection[t.section]) { order.push(t.section); bySection[t.section] = []; }
    bySection[t.section].push(t);
  });

  const html = order.map(s => buildSectionBox(s, bySection[s], resultMap, bw, gender)).join('');
  return `<div class="report-col">${html}</div>`;
}

// ─── Legend row ───────────────────────────────────────────────────────────────
const LEGEND_COLOR = `
  <div class="legend">
    <span><span class="leg-hi">紅色</span> = 偏高</span>
    <span><span class="leg-lo">藍色</span> = 偏低</span>
    <span><span class="leg-ok">黑色</span> = 正常</span>
    <span><span style="background:#ddd;padding:0 3px;">灰底</span> = 最新數值</span>
    <span>— = 本期未檢驗</span>
  </div>`;

const LEGEND_BW = `
  <div class="legend">
    <span><span style="font-weight:700;text-decoration:underline;">粗體底線</span> = 偏高</span>
    <span><span style="font-weight:700;font-style:italic;">粗體斜體</span> = 偏低</span>
    <span><span style="background:#ddd;padding:0 3px;">灰底</span> = 最新數值</span>
    <span>— = 本期未檢驗</span>
  </div>`;

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * generateReport(patientInfo, orders) → HTML string
 *
 * patientInfo: { chartno, name, gender, age, printDate }
 * orders:      array of order objects from the extension (lab + rad combined)
 */
// Generate the page divs (no <html> wrapper) for a single patient.
// Returns an HTML string of one or two .page divs.
const DEFAULT_REPORT_TITLE = '臺北榮民總醫院玉里分院門診報告';

function generatePatientPages(patientInfo, orders, bw, title, page1Only, hivReport) {
  const {
    name = '', chartno = '', gender = '', age = '', printDate = '',
    visitSerial = null,
  } = patientInfo;
  const tests        = genderFilteredTests(gender, hivReport);
  const numMap       = buildResultMap(orders, tests, patientInfo);
  const textMap      = buildTextResultMap(orders, tests);
  const resultMap    = { ...numMap, ...textMap };
  const reminderHtml = buildReminderBox(findUnshownOrders(orders, tests));
  const hasPage2     = !page1Only && tests.some(t => t.page === 2);
  const legendHtml   = bw ? LEGEND_BW : LEGEND_COLOR;
  const headerTitle  = title || DEFAULT_REPORT_TITLE;

  const subInfo = [
    `病患姓名：${h(name)}`,
    `病歷號：${h(chartno)}`,
    `性別：${h(gender)}`,
    `年齡：${h(String(age))}歲`,
    `列印日期：${h(printDate)}`,
  ].join('　');

  // 看診序號 overlay — only rendered when visitSerial is non-null (i.e. the
  // chart number came from a tabular paste with a serial in col 1). Same
  // markup on page 1 and page 2 so multi-patient batch print stays in sync.
  const visitSerialOverlay = visitSerial
    ? `<div class="visit-serial-overlay">${h(String(visitSerial))}</div>`
    : '';

  const page1 = `
    <div class="page">
      ${visitSerialOverlay}
      <div class="page-header">${h(headerTitle)}</div>
      <div class="page-sub">${subInfo}</div>
      <div class="report-4cols">
        ${buildColumn(1, 1, resultMap, tests, bw, gender)}
        ${buildColumn(1, 2, resultMap, tests, bw, gender)}
        ${buildColumn(1, 3, resultMap, tests, bw, gender)}
        ${buildColumn(1, 4, resultMap, tests, bw, gender)}
      </div>
      ${hasPage2 ? '' : reminderHtml}
      ${legendHtml}
    </div>`;

  const hivCol = hivReport ? buildColumn(2, 3, resultMap, tests, bw, gender) : '<div class="report-col"></div>';
  const page2 = hasPage2 ? `
    <div class="page">
      ${visitSerialOverlay}
      <div class="page-header">${h(headerTitle)}</div>
      <div class="page-sub">${subInfo}　（第 2 頁）</div>
      <div class="report-4cols">
        ${buildPage2Column(resultMap, tests, bw, gender)}
        <div class="report-col">${reminderHtml}</div>
        ${hivCol}
        <div class="report-col"></div>
      </div>
      ${legendHtml}
    </div>` : '';

  return page1 + page2;
}

// Single-patient report
// bw: true = black & white mode
function generateReport(patientInfo, orders, bw, title, page1Only, hivReport) {
  const pages = generatePatientPages(patientInfo, orders, bw, title, page1Only, hivReport);
  const name    = patientInfo.name || '';
  const chartno = patientInfo.chartno || '';
  const bodyClass = bw ? ' class="bw"' : '';
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <title>病患檢驗報告 — ${h(name)} ${h(chartno)}</title>
  <style>${REPORT_CSS}</style>
</head>
<body${bodyClass}>
  ${pages}
</body>
</html>`;
}

// ─── Debug / Comparison Report ───────────────────────────────────────────────
// Shows raw order data alongside pattern-match results so users can diagnose
// why a test is missing or shows the wrong value.
function generateDebugReport(patientInfo, orders, hivReport) {
  const { name = '', chartno = '', gender = '', age = '' } = patientInfo;
  const tests = genderFilteredTests(gender, hivReport);
  const numMap = buildResultMap(orders, tests, patientInfo);
  const textMap = buildTextResultMap(orders, tests);

  // Sort orders most recent first
  const sorted = [...orders].sort((a, b) =>
    (b.resdttm || '0').localeCompare(a.resdttm || '0')
  );

  // ── Section 1: Pattern match summary ──────────────────────────────────
  let matchSummaryHtml = '';
  tests.forEach(test => {
    if (test.kind === 'text') return;
    if (!test.pattern && !test.computed) return;

    const vals = numMap[test.id] || [];
    const hasData = vals.length > 0;
    const statusClass = hasData ? 'match-ok' : 'match-miss';
    const statusIcon  = hasData ? '✅' : '❌';
    const valsStr     = vals.map(v => `${v.date}: ${v.value}`).join(' ／ ') || '—';
    const patternStr  = test.pattern ? h(test.pattern.toString()) : '(computed)';

    matchSummaryHtml += `
      <tr class="${statusClass}">
        <td>${statusIcon}</td>
        <td><strong>${h(test.id)}</strong></td>
        <td>${h(test.displayName)}</td>
        <td class="mono">${patternStr}</td>
        <td>${valsStr}</td>
      </tr>`;
  });

  // ── Section 2: Raw order data with match highlights ───────────────────
  let rawDataHtml = '';
  sorted.forEach((order, idx) => {
    if (order.ordType !== 'LAB') return;
    const text = (order.reportText || '').trim();
    if (!text) return;
    const date = resdttmToTaiwan(order.resdttm) || order.orderDate || '';

    // Find which patterns matched this order
    const matches = [];
    const misses  = [];
    tests.forEach(test => {
      if (test.kind === 'text' || !test.pattern) return;
      const m = text.match(test.pattern);
      if (m) {
        let captured = m[1];
        if (test.normalize) {
          const n = parseFloat(captured);
          if (!isNaN(n)) captured = String(test.normalize(n)) + ` (原始值: ${m[1]})`;
        }
        matches.push({ id: test.id, captured });
      }
    });

    const matchBadges = matches.length
      ? matches.map(m => `<span class="badge-match">${h(m.id)}=${h(m.captured)}</span>`).join(' ')
      : '<span class="badge-none">無匹配</span>';

    // Highlight matched portions in the reportText
    let highlightedText = h(text);
    tests.forEach(test => {
      if (test.kind === 'text' || !test.pattern) return;
      const m = text.match(test.pattern);
      if (m && m[0]) {
        const escaped = h(m[0]);
        highlightedText = highlightedText.replace(escaped,
          `<mark title="${h(test.id)}">${escaped}</mark>`);
      }
    });

    rawDataHtml += `
      <tr>
        <td>${idx + 1}</td>
        <td class="nowrap">${h(date)}</td>
        <td class="nowrap">${h(order.orderName)}</td>
        <td>${matchBadges}</td>
        <td class="mono raw-text">${highlightedText}</td>
      </tr>`;
  });

  // ── Section 3: Text-report matches ────────────────────────────────────
  let textMatchHtml = '';
  tests.filter(t => t.kind === 'text').forEach(test => {
    const entry = textMap[test.id];
    const statusIcon = entry ? '✅' : '❌';
    const matchInfo = entry
      ? `${entry.date} — ${h(entry.orderName)}`
      : '—';
    textMatchHtml += `
      <tr>
        <td>${statusIcon}</td>
        <td><strong>${h(test.id)}</strong></td>
        <td>${h(test.displayName)}</td>
        <td class="mono">${h((test.orderNameMatch || '').toString())}</td>
        <td>${matchInfo}</td>
      </tr>`;
  });

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <title>檢查比對 — ${h(name)} ${h(chartno)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", sans-serif;
      margin: 0; padding: 16px; font-size: 13px; color: #222; background: #f8f9fa;
    }
    h1 { font-size: 18px; color: #1a5276; margin-bottom: 4px; }
    h2 { font-size: 15px; color: #1a5276; margin: 20px 0 8px; border-bottom: 2px solid #1a5276; padding-bottom: 4px; }
    .patient-info { font-size: 13px; color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    th { background: #d6eaf8; text-align: left; padding: 5px 8px; border: 1px solid #aed6f1;
         font-size: 11px; color: #1a5276; white-space: nowrap; }
    td { padding: 4px 8px; border: 1px solid #e0e0e0; vertical-align: top; }
    tr:nth-child(even) { background: #f5f8fc; }
    tr:hover { background: #eaf6ff; }
    .match-ok { }
    .match-miss { background: #fdecea !important; }
    .match-miss td { color: #c0392b; }
    .mono { font-family: "Cascadia Code", "Fira Code", monospace; font-size: 11px; word-break: break-all; }
    .nowrap { white-space: nowrap; }
    .raw-text { max-width: 500px; white-space: pre-wrap; word-break: break-all; line-height: 1.5; }
    mark { background: #ffe066; padding: 0 2px; border-radius: 2px; }
    .badge-match {
      display: inline-block; background: #d5f5e3; color: #1e8449;
      padding: 1px 6px; border-radius: 9px; font-size: 11px; margin: 1px 2px; white-space: nowrap;
    }
    .badge-none {
      display: inline-block; background: #fadbd8; color: #c0392b;
      padding: 1px 6px; border-radius: 9px; font-size: 11px;
    }
    .legend-box { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; }
    .legend-box span { margin-right: 16px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>🔍 檢查比對模式</h1>
  <div class="patient-info">
    病患：${h(name)}　病歷號：${h(chartno)}　性別：${h(gender)}　年齡：${h(String(age))}歲
    　　Lab 筆數：${sorted.filter(o => o.ordType === 'LAB').length}
  </div>
  <div class="legend-box">
    <span>✅ = 有匹配到資料</span>
    <span>❌ = 未匹配（可能 pattern 不符或無此檢驗）</span>
    <span><mark>黃底</mark> = 原始文字中被匹配的部分</span>
    <span><span class="badge-match">綠色標籤</span> = 匹配的檢驗項與擷取值</span>
  </div>

  <h2>1. 數值檢驗匹配摘要 (TEST_MAP patterns)</h2>
  <table>
    <thead><tr><th></th><th>ID</th><th>項目名稱</th><th>Pattern</th><th>擷取值 (最近3筆)</th></tr></thead>
    <tbody>${matchSummaryHtml}</tbody>
  </table>

  ${textMatchHtml ? `
  <h2>2. 文字報告匹配摘要 (Text reports)</h2>
  <table>
    <thead><tr><th></th><th>ID</th><th>項目名稱</th><th>orderNameMatch</th><th>匹配結果</th></tr></thead>
    <tbody>${textMatchHtml}</tbody>
  </table>` : ''}

  <h2>${textMatchHtml ? '3' : '2'}. 原始 LAB 資料逐筆比對</h2>
  <table>
    <thead><tr><th>#</th><th>日期</th><th>醫囑名稱</th><th>匹配到的項目</th><th>reportText（黃底=匹配處）</th></tr></thead>
    <tbody>${rawDataHtml}</tbody>
  </table>
</body>
</html>`;
}

// Multi-patient report: takes an array of { patientInfo, orders } objects.
// Generates pages for each patient sequentially; skips entries that throw.
function generateMultiReport(patients, bw, title, page1Only, hivReport) {
  const allPages = [];
  patients.forEach(({ patientInfo, orders }) => {
    try {
      allPages.push(generatePatientPages(patientInfo, orders, bw, title, page1Only, hivReport));
    } catch (e) {
      // skip this patient silently
    }
  });
  if (!allPages.length) return '';
  const bodyClass = bw ? ' class="bw"' : '';
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <title>病患檢驗報告（${patients.length} 位）</title>
  <style>${REPORT_CSS}</style>
</head>
<body${bodyClass}>
  ${allPages.join('\n')}
</body>
</html>`;
}
