#!/usr/bin/env node
'use strict';

/**
 * sync-patterns.js — Bundle catalog + manifest + normalizers + resolver
 * into the extension as a self-contained snapshot. Used as the fallback
 * when runtime fetch from GitHub is unavailable (no network, GitHub
 * blocked, first-time install).
 *
 * Source of truth: hospital-lab-patterns repo
 *   https://github.com/Yuchunchen/hospital-lab-patterns
 *
 * Outputs:
 *   normalizers.js          — copied; exposes window.HOSPITAL_LAB_PATTERNS_NORMALIZERS
 *   mapping.js              — catalog + manifest + resolver (rehydrates normalizers)
 *   patterns-computed.js    — copied as-is from patterns/computed.js
 *
 * Re-run after every pattern change:
 *   node sync-patterns.js
 *   # then reload the extension at chrome://extensions
 */

const fs   = require('fs');
const path = require('path');

const PATTERNS = path.resolve(__dirname, '..', 'hospital-lab-patterns', 'patterns');

if (!fs.existsSync(PATTERNS)) {
  console.error('✗ patterns repo not found at: ' + PATTERNS);
  process.exit(1);
}

function read(name) { return fs.readFileSync(path.join(PATTERNS, name), 'utf8'); }

function banner(sources) {
  return [
    '// ════════════════════════════════════════════════════════════════════════════',
    '// AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY',
    '//',
    '// Source of truth: hospital-lab-patterns repo (' + sources + ')',
    '//   https://github.com/Yuchunchen/hospital-lab-patterns',
    '//',
    '// To update:',
    '//   1. Edit ../hospital-lab-patterns/patterns/<file>.js',
    '//   2. git commit + git push (in the patterns repo)',
    '//   3. cd hospital-lab-viewer && node sync-patterns.js',
    '//   4. Reload the extension at chrome://extensions',
    '//',
    '// Synced at: ' + new Date().toISOString(),
    '// ════════════════════════════════════════════════════════════════════════════',
    '',
  ].join('\n');
}

// ─── normalizers.js ─ copy as-is (small file, used both by mapping.js
//     fallback AND by pattern-loader.js to rehydrate runtime-fetched JSON)
{
  const src = read('normalizers.js');
  fs.writeFileSync(path.join(__dirname, 'normalizers.js'),
    banner('normalizers.js') + src, 'utf8');
  console.log('✓ normalizers.js       ← normalizers.js');
}

// ─── mapping.js ─ catalog + manifest + resolver-with-rehydration
{
  const catalogSrc     = read('catalog.js');
  const manifestSrc    = read('viewer.js');
  const normalizersSrc = read('normalizers.js');

  const resolver = [
    '',
    '// ─── Resolver: merge each manifest entry on top of its catalog entry ──',
    '//      (rehydrates string `normalize` references using NORMALIZERS)',
    'function _resolveManifest(manifest, cat) {',
    '  var byId = new Map(cat.map(function (e) { return [e.id, e]; }));',
    '  var out = [];',
    '  manifest.forEach(function (m) {',
    '    var id = typeof m === "string" ? m : m.id;',
    '    var base = byId.get(id);',
    '    if (!base) {',
    '      console.warn("[mapping.js] manifest references unknown id: " + id);',
    '      return;',
    '    }',
    '    var merged = typeof m === "string"',
    '      ? Object.assign({}, base)',
    '      : Object.assign({}, base, m);',
    '    if (typeof merged.normalize === "string" && NORMALIZERS[merged.normalize]) {',
    '      merged.normalize = NORMALIZERS[merged.normalize];',
    '    }',
    '    out.push(merged);',
    '  });',
    '  return out;',
    '}',
    '',
    'var VIEWER_CATALOG = _resolveManifest(VIEWER_MANIFEST, CATALOG);',
    '',
    '// ─── Backwards-compat alias: TEST_MAP is what popup.js / report.js use ─',
    'var TEST_MAP = VIEWER_CATALOG;',
    'if (typeof window !== "undefined") {',
    '  window.TEST_MAP        = TEST_MAP;',
    '  window.VIEWER_CATALOG  = VIEWER_CATALOG;',
    '  window.HOSPITAL_LAB_PATTERNS_BUNDLED_AT = "' + new Date().toISOString() + '";',
    '}',
    '',
  ].join('\n');

  // Order: normalizers first (defines NORMALIZERS), then catalog, then manifest,
  // then resolver (which can reference all three).
  const out = banner('catalog.js + viewer.js + normalizers.js') +
              normalizersSrc + catalogSrc + manifestSrc + resolver;
  fs.writeFileSync(path.join(__dirname, 'mapping.js'), out, 'utf8');
  console.log('✓ mapping.js           ← catalog.js + viewer.js + normalizers.js + resolver');
}

// ─── patterns-computed.js ─ copy as-is
{
  const src = read('computed.js');
  fs.writeFileSync(path.join(__dirname, 'patterns-computed.js'),
    banner('computed.js') + src, 'utf8');
  console.log('✓ patterns-computed.js ← computed.js');
}

console.log('');
console.log('✓ Sync complete. Reload the extension at chrome://extensions');
