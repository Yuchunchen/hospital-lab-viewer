'use strict';

/**
 * pattern-loader.js — Fetch latest patterns from GitHub at runtime,
 * cache the RAW JSON in chrome.storage.local for 24h, and override TEST_MAP.
 *
 * Why raw JSON in cache: chrome.storage.local serializes values as JSON,
 * which strips RegExp → {}. So we keep the cache as raw text and re-parse
 * with the regex reviver every time we read it. Round-trips cleanly.
 *
 * Fallback chain:
 *   1. Fresh chrome.storage.local cache (< 24h)             → parse + use
 *   2. Live fetch from raw.githubusercontent.com            → cache + use
 *   3. Bundled mapping.js (TEST_MAP from sync time)         → silent fallback
 *
 * Exposes:
 *   window.loadPatterns(forceRefresh)
 *     → Promise<{ TEST_MAP, source: 'cache'|'remote'|'bundle',
 *                 syncedAt: string, fetchedAt: number }>
 */

(function () {
  const PATTERNS_URL = 'https://raw.githubusercontent.com/Yuchunchen/hospital-lab-patterns/main/dist/patterns.json';
  const CACHE_KEY    = 'patterns_v0_3_raw';     // bumped: stores raw text now, not rehydrated
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;     // 24h

  // ─── Reviver: rehydrate {__regex:[src,flags]} → RegExp ──────────────
  function regexReviver(_key, value) {
    if (value && typeof value === 'object' && Array.isArray(value.__regex) && value.__regex.length === 2) {
      try { return new RegExp(value.__regex[0], value.__regex[1]); }
      catch (e) {
        console.warn('[pattern-loader] failed to compile regex:', value.__regex, e.message);
        return null;
      }
    }
    return value;
  }

  function rehydrateNormalize(entry) {
    if (typeof entry.normalize === 'string' && window.HOSPITAL_LAB_PATTERNS_NORMALIZERS) {
      const fn = window.HOSPITAL_LAB_PATTERNS_NORMALIZERS[entry.normalize];
      if (fn) entry.normalize = fn;
      else delete entry.normalize;
    }
    return entry;
  }

  function resolveManifest(manifest, catalog) {
    const byId = new Map(catalog.map(e => [e.id, e]));
    const out = [];
    manifest.forEach(m => {
      const id = typeof m === 'string' ? m : m.id;
      const base = byId.get(id);
      if (!base) {
        console.warn('[pattern-loader] manifest references unknown id: ' + id);
        return;
      }
      const merged = typeof m === 'string'
        ? Object.assign({}, base)
        : Object.assign({}, base, m);
      rehydrateNormalize(merged);
      out.push(merged);
    });
    return out;
  }

  // ─── Cache stores RAW JSON STRING (not rehydrated objects) ──────────
  // chrome.storage.local JSON-serialises stored values, which would strip
  // any RegExp objects. Storing the raw text and re-parsing avoids that.
  function readCache() {
    return new Promise(resolve => {
      try {
        chrome.storage.local.get(CACHE_KEY, (r) => resolve(r[CACHE_KEY] || null));
      } catch (e) { resolve(null); }
    });
  }

  function writeCache(rawText) {
    return new Promise(resolve => {
      const entry = { rawText: rawText, fetchedAt: Date.now() };
      try {
        chrome.storage.local.set({ [CACHE_KEY]: entry }, () => resolve());
      } catch (e) { resolve(); }
    });
  }

  async function fetchRawText() {
    const resp = await fetch(PATTERNS_URL, { credentials: 'omit', cache: 'no-cache' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.text();
  }

  // Parse + rehydrate raw JSON text → snapshot with real RegExp objects
  function parseSnapshot(rawText) {
    return JSON.parse(rawText, regexReviver);
  }

  function buildTestMap(snapshot) {
    return resolveManifest(snapshot.viewer_manifest, snapshot.catalog);
  }

  async function loadPatterns(forceRefresh) {
    // 1. Cache (skipped on forceRefresh)
    if (!forceRefresh) {
      const cached = await readCache();
      if (cached && cached.rawText && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
        try {
          const snapshot = parseSnapshot(cached.rawText);
          const TEST_MAP = buildTestMap(snapshot);
          return { TEST_MAP, source: 'cache',
                   syncedAt: snapshot.synced_at, fetchedAt: cached.fetchedAt };
        } catch (e) {
          console.warn('[pattern-loader] cache parse failed, refetching:', e.message);
        }
      }
    }

    // 2. Live fetch
    try {
      const rawText = await fetchRawText();
      await writeCache(rawText);
      const snapshot = parseSnapshot(rawText);
      const TEST_MAP = buildTestMap(snapshot);
      return { TEST_MAP, source: 'remote',
               syncedAt: snapshot.synced_at, fetchedAt: Date.now() };
    } catch (e) {
      console.warn('[pattern-loader] remote fetch failed, falling back to bundle:', e.message);
    }

    // 3. Bundle fallback
    return {
      TEST_MAP: window.TEST_MAP || [],
      source: 'bundle',
      syncedAt: window.HOSPITAL_LAB_PATTERNS_BUNDLED_AT || null,
      fetchedAt: null,
    };
  }

  window.loadPatterns = loadPatterns;
})();
