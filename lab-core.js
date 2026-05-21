'use strict';

// ════════════════════════════════════════════════════════════════════════════
// lab-core.js — Shared utilities for popup.js (Tab 1 報告) 與
// dashboard.js (Tab 2 篩檢 Dashboard，獨立視窗)。
//
// 內容：CONFIG / loadConfig、splitChartInput / formatChartNo、
// parseOrdersPage / fetchAllOrders / fetchIncremental、
// IndexedDB (records / enrichCache / registry)、
// buildSubpageUrl / fetchSubpageText / enrichMissingValues、loadData、
// registry add/list/remove。
//
// 兩個入口都先載 lab-core.js，再載自己的 UI 檔。所有函式以 var/function 宣告
// 為 global,popup.js / dashboard.js 直接使用。
// ════════════════════════════════════════════════════════════════════════════

// ─── Config ───────────────────────────────────────────────────────────────────
var CONFIG = {
  BASE_URL:        '',   // loaded from chrome.storage.sync
  OPSID:           '',   // loaded from chrome.storage.sync
  REPORT_TITLE:    '',   // loaded from chrome.storage.sync
  ENDPOINT:        '/order/get_lab_orders',
  CACHE_TTL_MS:    6 * 60 * 60 * 1000,   // 6 hours
  LAB_MONTHS_BACK: 12,
};

var CONFIG_DEFAULTS = {
  baseUrl:     'http://ernode.vghb12.vhtt.gov.tw:8000',
  opsid:       '',
  reportTitle: '臺北榮民總醫院玉里分院門診報告',
};

function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['baseUrl', 'opsid', 'reportTitle'], (result) => {
      CONFIG.BASE_URL     = result.baseUrl     || CONFIG_DEFAULTS.baseUrl;
      CONFIG.OPSID        = result.opsid        || CONFIG_DEFAULTS.opsid;
      CONFIG.REPORT_TITLE = result.reportTitle  || CONFIG_DEFAULTS.reportTitle;
      resolve();
    });
  });
}

// ─── Split Input Into Multiple IDs ───────────────────────────────────────────
// Two modes (auto-detected per line):
//   1. TABULAR PASTE (≥5 tab cells) → col 5 (index 4) chartno, col 1 visitSerial.
//   2. FREE-FORM: split on comma, semicolon, pipe, or whitespace.
// Returns: Array<{chartno: string, visitSerial: string|null}>
function splitChartInput(raw) {
  const tokens = [];
  raw.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;
    const cells = line.split('\t');
    if (cells.length >= 5) {
      const chartno     = cells[4].trim();
      const visitSerial = cells[0].trim() || null;
      if (chartno) tokens.push({ chartno, visitSerial });
      return;
    }
    line.split(/[,;|\s]+/).forEach(t => {
      const s = t.trim();
      if (s) tokens.push({ chartno: s, visitSerial: null });
    });
  });
  return tokens;
}

// ─── Chart Number Formatting ──────────────────────────────────────────────────
// API requires exactly 9 digits + 1 uppercase letter, e.g. "000810385G"
function formatChartNo(raw) {
  const s = raw.trim();
  if (!s) throw new Error('Please enter a chart number.');
  const last = s[s.length - 1];
  if (!/[a-zA-Z]/.test(last)) throw new Error('Chart number must end with a letter (e.g. 810385G).');
  const letter = last.toUpperCase();
  const digitStr = s.slice(0, -1).replace(/\D/g, '');
  if (!digitStr) throw new Error('No digits found before the letter.');
  if (digitStr.length > 9) throw new Error('Too many digits — maximum 9 before the letter.');
  return digitStr.padStart(9, '0') + letter;
}

// ─── Date Utilities ───────────────────────────────────────────────────────────
function parseDateResdttm(str) {
  if (!str || str.length < 8) return null;
  const y = +str.slice(0, 4), m = +str.slice(4, 6) - 1, d = +str.slice(6, 8);
  if (!y || !m || !d) return null;
  return new Date(y, m, d);
}

function parseDateTaiwan(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)\/(\d+)\/(\d+)/);
  if (!match) return null;
  return new Date(+match[1] + 1911, +match[2] - 1, +match[3]);
}

// ─── Patient Info Extraction ──────────────────────────────────────────────────
function parsePatientInfo(doc, chartno) {
  const headerText = doc.querySelector('table.Header')?.textContent || '';
  const rest = chartno ? headerText.split(chartno)[1] || '' : headerText;
  const m = rest.match(/\s+(.+?)\s+([MF])\s+(\d+)\s*歲/);
  if (!m) return null;
  return {
    chartno,
    name:   m[1].trim(),
    gender: m[2] === 'M' ? '男' : '女',
    age:    m[3],
  };
}

// ─── HTML Parsing ─────────────────────────────────────────────────────────────
function parseOrdersPage(html, chartno) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const grid = doc.querySelector('table.Grid');
  if (!grid) return { orders: [], nextUrl: null, total: 0, patientInfo: null };
  const patientInfo = parsePatientInfo(doc, chartno);

  const orders = [];

  grid.querySelectorAll('tr.Row').forEach(row => {
    if (row.cells.length < 6) return;

    const h = name => row.querySelector(`input[name="${name}"]`)?.value?.trim() || '';

    orders.push({
      ordseq:      h('ORDSEQ'),    // O91114471OR0006
      comKey:      h('COM_KEY'),   // OPD 13461829
      ordapno:     h('ORDAPNO'),   // 13461829
      resdttm:     h('RESDTTM'),   // 20260414203800 (Gregorian)
      pfcode:      h('PFCODE'),    // 90111100
      ordType:     h('ORDTYPE'),   // LAB | RAD

      orderName:   row.cells[0]?.textContent.trim() || '',
      status:      row.cells[1]?.textContent.trim() || '',
      reportText:  row.cells[2]?.textContent.trim() || '',
      dept:        row.cells[3]?.textContent.trim() || '',
      orderDate:   row.cells[4]?.textContent.trim() || '',
      receiveDate: row.cells[5]?.textContent.trim() || '',
    });
  });

  let nextUrl = null;
  doc.querySelectorAll('a').forEach(a => {
    if (a.textContent.trim() === '>>' && !nextUrl) {
      const href = a.getAttribute('href');
      nextUrl = href ? CONFIG.BASE_URL + href : null;
    }
  });

  const footerText = doc.querySelector('tr.Footer')?.textContent || '';
  const totalMatch = footerText.match(/總筆數：(\d+)/);
  const total = totalMatch ? +totalMatch[1] : 0;

  return { orders, nextUrl, total, patientInfo };
}

// ─── Fetch All Pages ──────────────────────────────────────────────────────────
async function fetchAllOrders(chartno, onProgress) {
  let url = `${CONFIG.BASE_URL}${CONFIG.ENDPOINT}?chartno=${chartno}&opsid=${CONFIG.OPSID}`;
  const all = [];
  let page = 0, total = 0, patientInfo = null;

  while (url) {
    page++;
    if (page > 50) break;

    const resp = await fetch(url, { credentials: 'omit' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} — server error`);
    const html = await resp.text();

    const { orders, nextUrl, total: t, patientInfo: pi } = parseOrdersPage(html, chartno);
    if (page === 1) { if (t) total = t; if (pi) patientInfo = pi; }
    all.push(...orders);

    if (onProgress) onProgress(all.length, total || '?');
    if (!nextUrl || (total && all.length >= total)) break;
    url = nextUrl;
  }

  return { orders: all, total, patientInfo };
}

// ─── Incremental Fetch (stable-frontier) ─────────────────────────────────────
// ernode 回傳 newest-first;簽收的報告 immutable,只有 `未執行` 會變狀態。
// 一旦碰到「整頁皆已知且狀態未變」就可以停。
async function fetchIncremental(chartno, cachedOrders, onProgress) {
  const knownMap = new Map();
  cachedOrders.forEach((o, i) => knownMap.set(o.ordseq, { idx: i, status: o.status }));

  const newOrders = [];
  let url = `${CONFIG.BASE_URL}${CONFIG.ENDPOINT}?chartno=${chartno}&opsid=${CONFIG.OPSID}`;
  let page = 0, total = 0, patientInfo = null;

  while (url) {
    page++;
    if (page > 50) break;

    const resp = await fetch(url, { credentials: 'omit' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} — server error`);
    const html = await resp.text();
    const { orders, nextUrl, total: t, patientInfo: pi } = parseOrdersPage(html, chartno);
    if (page === 1) { if (t) total = t; if (pi) patientInfo = pi; }

    let allKnown = true;
    for (const order of orders) {
      const known = knownMap.get(order.ordseq);
      if (!known) {
        newOrders.push(order);
        allKnown = false;
      } else if (known.status !== order.status) {
        cachedOrders[known.idx] = order;
        allKnown = false;
      }
    }

    if (onProgress) onProgress(cachedOrders.length + newOrders.length, total || '?');
    if (allKnown || !nextUrl) break;
    url = nextUrl;
  }

  const merged = newOrders.concat(cachedOrders);
  return { orders: merged, total, patientInfo, pagesChecked: page };
}

// ─── IndexedDB Cache ──────────────────────────────────────────────────────────
// DB_VER bump 4 → 5 (2026-05-21): 加 `registry` store 給 Dashboard 個案管理用。
// DB_VER bump 5 → 6 (2026-05-21): 加 `cxrTranslations` store 給健檢 CXR Tab
//   存 LLM 翻譯結果（key = ordapno;value 帶 provider/model 以便換後端時失效）。
// 既有 STORE / ENRICH_STORE / REGISTRY_STORE 不動;onupgradeneeded 用
// if (!contains) 寫法,任何舊版本升上來都會補建欠缺的 store。
var DB_NAME      = 'LabViewerCache';
var DB_VER       = 6;
var STORE        = 'records';
var ENRICH_STORE = 'enrichCache';
var REGISTRY_STORE = 'registry';
var CXR_TX_STORE = 'cxrTranslations';
var _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(ENRICH_STORE))
        db.createObjectStore(ENRICH_STORE, { keyPath: 'ordapno' });
      if (!db.objectStoreNames.contains(REGISTRY_STORE))
        db.createObjectStore(REGISTRY_STORE, { keyPath: 'chartno' });
      if (!db.objectStoreNames.contains(CXR_TX_STORE))
        db.createObjectStore(CXR_TX_STORE, { keyPath: 'ordapno' });
    };
    req.onsuccess = () => { _db = req.result; res(_db); };
    req.onerror   = () => rej(req.error);
  });
}

async function cacheGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror   = () => rej(r.error);
  });
}

async function cachePut(key, payload) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE, 'readwrite').objectStore(STORE)
                .put({ key, payload, ts: Date.now() });
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}

async function enrichCacheGet(ordapno) {
  if (!ordapno) return null;
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(ENRICH_STORE, 'readonly').objectStore(ENRICH_STORE).get(ordapno);
    r.onsuccess = () => res(r.result ? r.result.text : null);
    r.onerror   = () => rej(r.error);
  });
}

async function enrichCachePut(ordapno, text) {
  if (!ordapno || !text) return;
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(ENRICH_STORE, 'readwrite').objectStore(ENRICH_STORE)
                .put({ ordapno: String(ordapno), text, ts: Date.now() });
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}

// ─── Registry (個案管理) ──────────────────────────────────────────────────
// schema: { chartno, name, enrollDate, category, lastScreenDate, notes }
//   chartno: '000080885F'
//   category: 'Early-CKD' | 'Pre-ESRD' | 'DM'  (字串;同病人可多角色,以逗號分隔)
async function registryPut(record) {
  if (!record || !record.chartno) throw new Error('registryPut: chartno required');
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(REGISTRY_STORE, 'readwrite').objectStore(REGISTRY_STORE)
                .put({ ...record, ts: Date.now() });
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}

async function registryGet(chartno) {
  if (!chartno) return null;
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(REGISTRY_STORE, 'readonly').objectStore(REGISTRY_STORE).get(chartno);
    r.onsuccess = () => res(r.result || null);
    r.onerror   = () => rej(r.error);
  });
}

async function registryList() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(REGISTRY_STORE, 'readonly').objectStore(REGISTRY_STORE).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror   = () => rej(r.error);
  });
}

async function registryRemove(chartno) {
  if (!chartno) return;
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(REGISTRY_STORE, 'readwrite').objectStore(REGISTRY_STORE).delete(chartno);
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}

// ─── CXR 翻譯快取 (健檢 CXR Tab) ──────────────────────────────────────────
// key = ordapno（CXR order 的子頁面 id）。CXR 報告簽收後 immutable,但翻譯
// 結果會隨 provider/model 改變,故 value 帶 provider/model;cxr.js 取出後
// 自行比對,不符就重新呼叫 LLM 並覆寫。
// schema: { ordapno, summary, findings:[{item,status,detail}], hasAbnormal,
//           provider, model, ts }
async function cxrTxGet(ordapno) {
  if (!ordapno) return null;
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(CXR_TX_STORE, 'readonly').objectStore(CXR_TX_STORE).get(String(ordapno));
    r.onsuccess = () => res(r.result || null);
    r.onerror   = () => rej(r.error);
  });
}

async function cxrTxPut(record) {
  if (!record || !record.ordapno) return;
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(CXR_TX_STORE, 'readwrite').objectStore(CXR_TX_STORE)
                .put({ ...record, ordapno: String(record.ordapno), ts: Date.now() });
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}

// ─── Sub-page fetch + generic enrichment ─────────────────────────────────────
function getOpdwebBase() {
  try {
    const u = new URL(CONFIG.BASE_URL);
    u.hostname = u.hostname.replace(/^ernode\./, 'opdweb.');
    u.port = '';
    return u.origin;
  } catch { return null; }
}

function buildSubpageUrl(ordapno, chartno) {
  const base = getOpdwebBase();
  if (!base) return null;
  return `${base}/QueryReport/OpdOrderReport.aspx?OrdApNo=${ordapno}&hisnum=${chartno}&opid=${CONFIG.OPSID}`;
}

async function fetchSubpageText(url) {
  const resp = await fetch(url, { credentials: 'omit' });
  if (!resp.ok) return '';
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body?.textContent || '';
}

function applySubpageText(order, subpageText, missingTests) {
  if (!subpageText) return false;
  const additions = [];
  for (const t of missingTests) {
    if (!t.pattern) continue;
    const mMain = subpageText.match(t.pattern);
    if (mMain && mMain[0]) {
      additions.push(mMain[0]);
      continue;
    }
    const sp = t.subpage;
    if (!sp || !sp.resultPattern) continue;
    if (sp.orderNameMatch && !sp.orderNameMatch.test(order.orderName || '')) continue;
    const mSub = subpageText.match(sp.resultPattern);
    if (mSub && mSub[1]) {
      additions.push(`${sp.synthLabel || t.id}: ${String(mSub[1]).trim()}`);
    }
  }
  if (!additions.length) return false;
  order.reportText = (order.reportText ? order.reportText + ' ; ' : '')
                   + additions.join(' ; ');
  return true;
}

async function enrichMissingValues(labOrders, chartno, manifest, opts) {
  opts = opts || {};
  const onProgress = opts.onProgress;
  const maxFetches = opts.maxFetches != null ? opts.maxFetches : 15;

  const tests = (manifest || []).filter(t => t && t.pattern instanceof RegExp);
  if (!tests.length) return;

  const presentIds = new Set();
  for (const o of labOrders) {
    if (!o.reportText) continue;
    for (const t of tests) {
      if (presentIds.has(t.id)) continue;
      if (t.pattern.test(o.reportText)) presentIds.add(t.id);
    }
  }

  const chaseTests = tests.filter(t => t.subpage && t.subpage.orderNameMatch);
  if (!chaseTests.length) return;

  function relevantTestsForOrder(o) {
    const out = [];
    for (const t of chaseTests) {
      if (t.pattern.test(o.reportText || '')) continue;
      if (t.subpage.orderNameMatch.test(o.orderName || '')) out.push(t);
    }
    return out;
  }

  const queue = [];
  for (const o of labOrders) {
    if (!o.ordapno) continue;
    const rel = relevantTestsForOrder(o);
    if (rel.length) queue.push({ order: o, tests: rel });
  }
  if (!queue.length) return;

  let fetched = 0;
  for (let i = 0; i < queue.length && fetched < maxFetches; i++) {
    const { order, tests: relTests } = queue[i];
    const url = buildSubpageUrl(order.ordapno, chartno);
    if (!url) continue;

    let text = null;
    try { text = await enrichCacheGet(order.ordapno); } catch (_) {}

    if (!text) {
      if (onProgress) onProgress(`補抓子頁面 ${fetched + 1}/${maxFetches}（candidate ${i + 1}/${queue.length}）`);
      try {
        text = await fetchSubpageText(url);
        if (text) { try { await enrichCachePut(order.ordapno, text); } catch (_) {} }
      } catch { continue; }
      fetched++;
    }
    if (!text) continue;

    applySubpageText(order, text, relTests);
  }
}

// ─── Load (cache-first + incremental) ────────────────────────────────────────
async function loadData(rawInput, forceRefresh, onProgress) {
  const chartno  = formatChartNo(rawInput);
  const cacheKey = `v4:${chartno}`;

  if (!forceRefresh) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      const age = Date.now() - cached.ts;

      if (age < CONFIG.CACHE_TTL_MS) {
        return { ...cached.payload, fromCache: true, cachedAt: new Date(cached.ts) };
      }

      if (cached.payload.allOrders && cached.payload.allOrders.length > 0) {
        const baseline = cached.payload.allOrders.map(o => ({ ...o }));
        const { orders: merged, total, patientInfo, pagesChecked } =
          await fetchIncremental(chartno, baseline, onProgress);

        const labAll = merged.filter(o => o.ordType === 'LAB');
        const radAll = merged.filter(o => o.ordType === 'RAD');

        try {
          const manifest = (typeof window !== 'undefined' && window.TEST_MAP) || (typeof TEST_MAP !== 'undefined' ? TEST_MAP : []);
          await enrichMissingValues(labAll, chartno, manifest, { onProgress });
        } catch (e) {
          if (typeof console !== 'undefined') console.warn('[enrichMissingValues] failed:', e);
        }

        const payload = {
          chartno,
          patientInfo:  patientInfo || cached.payload.patientInfo,
          lab:          labAll,
          rad:          radAll,
          allOrders:    merged,
          recentCount:  labAll.length + radAll.length,
          totalFetched: total || merged.length,
          fromCache:    false,
          fetchedAt:    new Date().toISOString(),
          incremental:  { pagesChecked },
        };
        if (typeof console !== 'undefined') {
          console.log(`[incremental] ${chartno}: ${pagesChecked} page(s) checked, total ${merged.length}`);
        }
        await cachePut(cacheKey, payload);
        return { ...payload, cachedAt: null };
      }
    }
  }

  const { orders: all, total, patientInfo } = await fetchAllOrders(chartno, onProgress);
  const labAll = all.filter(o => o.ordType === 'LAB');
  const radAll = all.filter(o => o.ordType === 'RAD');

  try {
    const manifest = (typeof window !== 'undefined' && window.TEST_MAP) || (typeof TEST_MAP !== 'undefined' ? TEST_MAP : []);
    await enrichMissingValues(labAll, chartno, manifest, { onProgress });
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[enrichMissingValues] failed:', e);
  }

  const payload = {
    chartno,
    patientInfo,
    lab:          labAll,
    rad:          radAll,
    allOrders:    all,
    recentCount:  labAll.length + radAll.length,
    totalFetched: total,
    fromCache:    false,
    fetchedAt:    new Date().toISOString(),
  };

  await cachePut(cacheKey, payload);
  return { ...payload, cachedAt: null };
}
