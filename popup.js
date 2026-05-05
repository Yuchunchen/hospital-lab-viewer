'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────
const CONFIG = {
  BASE_URL:        '',   // loaded from chrome.storage.sync
  OPSID:           '',   // loaded from chrome.storage.sync
  REPORT_TITLE:    '',   // loaded from chrome.storage.sync
  ENDPOINT:        '/order/get_lab_orders',
  CACHE_TTL_MS:    6 * 60 * 60 * 1000,   // 6 hours
  LAB_MONTHS_BACK: 12,                    // Lab: show last 1 year
  // Imaging (RAD): show all — no cutoff
};

const CONFIG_DEFAULTS = {
  baseUrl:     'http://ernode.vghb12.vhtt.gov.tw:8000',
  opsid:       '',
  reportTitle: '臺北榮民總醫院玉里分院門診報告',
};

// Load config from chrome.storage.sync; returns a promise.
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
//   1. TABULAR PASTE (e.g. 門診排程):
//        2  賴金英  女  069  000015062J  ...  複診  健保  ...
//      A line with ≥5 tab-separated cells → take ONLY the 5th cell
//      (病歷號 / chart number); ignore all other columns. This stops 姓名／
//      性別／FMP code etc. being treated as candidate chart numbers.
//   2. FREE-FORM:
//        108769A, 000015062J | 000020106J  …
//      Splits on comma, semicolon, pipe, or whitespace.
function splitChartInput(raw) {
  const tokens = [];
  raw.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;

    const cells = line.split('\t');
    if (cells.length >= 5) {
      // Tabular paste — col 5 (index 4) is the chart number.
      const candidate = cells[4].trim();
      if (candidate) tokens.push(candidate);
      return;
    }

    // Free-form line (no tabs / fewer than 5 cells).
    line.split(/[,;|\s]+/).forEach(t => {
      const s = t.trim();
      if (s) tokens.push(s);
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
// RESDTTM: "20260414203800" = YYYYMMDDHHMMSS (Gregorian)
function parseDateResdttm(str) {
  if (!str || str.length < 8) return null;
  const y = +str.slice(0, 4), m = +str.slice(4, 6) - 1, d = +str.slice(6, 8);
  if (!y || !m || !d) return null;
  return new Date(y, m, d);
}

// Taiwan calendar order date: "115/04/14 19:36" → Date
function parseDateTaiwan(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)\/(\d+)\/(\d+)/);
  if (!match) return null;
  return new Date(+match[1] + 1911, +match[2] - 1, +match[3]);
}

function cutoffDateLab() {
  const d = new Date();
  d.setMonth(d.getMonth() - CONFIG.LAB_MONTHS_BACK);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Patient Info Extraction ──────────────────────────────────────────────────
// Header text: "全部醫囑 000123456A 王小明 M 51 歲"
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
      ordseq:      h('ORDSEQ'),    // e.g. O91114471OR0006
      comKey:      h('COM_KEY'),   // e.g. OPD 13461829
      ordapno:     h('ORDAPNO'),   // e.g. 13461829
      resdttm:     h('RESDTTM'),   // e.g. 20260414203800 (Gregorian)
      pfcode:      h('PFCODE'),    // e.g. 90111100
      ordType:     h('ORDTYPE'),   // LAB | RAD

      orderName:   row.cells[0]?.textContent.trim() || '',
      status:      row.cells[1]?.textContent.trim() || '',
      reportText:  row.cells[2]?.textContent.trim() || '',  // full text, CSS not applied
      dept:        row.cells[3]?.textContent.trim() || '',
      orderDate:   row.cells[4]?.textContent.trim() || '',  // Taiwan calendar
      receiveDate: row.cells[5]?.textContent.trim() || '',
    });
  });

  // Next page: find the ">>" anchor and resolve its href
  let nextUrl = null;
  doc.querySelectorAll('a').forEach(a => {
    if (a.textContent.trim() === '>>' && !nextUrl) {
      const href = a.getAttribute('href');
      nextUrl = href ? CONFIG.BASE_URL + href : null;
    }
  });

  // Total record count from footer
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
    if (page > 50) break; // safety

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

// ─── Lab Filter (1 year) ──────────────────────────────────────────────────────
function filterLabRecent(orders) {
  const cutoff = cutoffDateLab();
  return orders.filter(o => {
    const d = parseDateResdttm(o.resdttm) || parseDateTaiwan(o.orderDate);
    return !d || d >= cutoff;  // keep if date unknown
  });
}

// ─── IndexedDB Cache ──────────────────────────────────────────────────────────
const DB_NAME = 'LabViewerCache';
const DB_VER  = 3;
const STORE   = 'records';
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE, { keyPath: 'key' });
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

// ─── Sub-page fetch for UACR ─────────────────────────────────────────────────
// Derive opdweb URL from ernode base:
//   http://ernode.vghb12.vhyl.gov.tw:8000 → http://opdweb.vghb12.vhyl.gov.tw
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

// UACR regex — same as in mapping.js
const UACR_RE = /(?:U-?ACR|UACR|Alb(?:umin)?\/Cr(?:eatinine)?|Urine\s*Alb\/Cr):\s*([\d.]+)/i;

async function fetchSubpageText(url) {
  const resp = await fetch(url, { credentials: 'omit' });
  if (!resp.ok) return '';
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body?.textContent || '';
}

// Check if UACR is already present in any order's reportText.
// If not, fetch sub-pages (1-year LAB orders only) to find up to 3 values.
async function enrichUACRMulti(labOrders, chartno, onProgress) {
  const hasUACR = labOrders.some(o => UACR_RE.test(o.reportText));
  if (hasUACR) return;

  const cutoff = cutoffDateLab();
  const candidates = labOrders.filter(o => {
    const d = parseDateResdttm(o.resdttm) || parseDateTaiwan(o.orderDate);
    return d && d >= cutoff && o.ordapno;
  });

  let found = 0;
  for (let i = 0; i < candidates.length && found < 3; i++) {
    const order = candidates[i];
    const url = buildSubpageUrl(order.ordapno, chartno);
    if (!url) continue;
    if (onProgress) onProgress(`UACR 搜尋中 ${i + 1}/${candidates.length}（已找到 ${found}/3）`);
    try {
      const text = await fetchSubpageText(url);
      const m = text.match(UACR_RE);
      if (m) {
        order.reportText = (order.reportText ? order.reportText + ' ; ' : '') +
                           `UACR: ${m[1]}`;
        found++;
      }
    } catch { /* skip */ }
  }
}

// ─── Load (cache-first) ───────────────────────────────────────────────────────
async function loadData(rawInput, forceRefresh, onProgress) {
  const chartno  = formatChartNo(rawInput);
  const cacheKey = `v3:${chartno}`;

  if (!forceRefresh) {
    const cached = await cacheGet(cacheKey);
    if (cached && (Date.now() - cached.ts) < CONFIG.CACHE_TTL_MS)
      return { ...cached.payload, fromCache: true, cachedAt: new Date(cached.ts) };
  }

  const { orders: all, total, patientInfo } = await fetchAllOrders(chartno, onProgress);
  const labAll    = all.filter(o => o.ordType === 'LAB');
  const labRecent = filterLabRecent(labAll);
  const radAll    = all.filter(o => o.ordType === 'RAD');  // imaging: show all

  // Include hepatitis + RPR/TPHA orders from ALL time (not limited to 1 year).
  // HBsAg / Anti-HBs / Anti-HCV results are lifelong markers — once positive
  // (or once vaccinated for Anti-HBs), they stay positive — so we surface the
  // most recent value regardless of when it was tested.
  const recentIds = new Set(labRecent.map(o => o.ordseq));
  labAll.forEach(o => {
    if (!recentIds.has(o.ordseq) && /HBsAg|HCV Ab|Anti-HBs|REACT:|TPHA|HIV virus load|LEU3AN/.test(o.reportText)) {
      labRecent.push(o);
    }
  });

  // Enrich UACR from sub-pages if not found in main page reportText
  await enrichUACRMulti(labRecent, chartno, onProgress);

  const payload = {
    chartno,
    patientInfo,
    lab:          labRecent,
    rad:          radAll,
    recentCount:  labRecent.length + radAll.length,
    totalFetched: total,
    fromCache:    false,
    fetchedAt:    new Date().toISOString(),
  };

  await cachePut(cacheKey, payload);
  return { ...payload, cachedAt: null };
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function makeExpandableCell(text) {
  const td = document.createElement('td');
  td.title = text;
  if (text.length <= 80) {
    td.textContent = text;
    return td;
  }
  const short = el('span', 'r-short', escHtml(text.slice(0, 80)) + '…');
  const full  = el('span', 'r-full hidden', escHtml(text));
  const btn   = el('button', 'expand-btn', '+');
  btn.addEventListener('click', () => {
    const expanded = full.classList.toggle('hidden');
    short.classList.toggle('hidden', !expanded);
    btn.textContent = expanded ? '+' : '−';
  });
  td.append(short, full, btn);
  return td;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderSection(orders, title) {
  const isRad = orders.length && orders[0].ordType === 'RAD';
  const section = el('div', 'section');
  const hdr = el('div', 'section-title', title + `<span class="count">${orders.length}</span>`);

  if (!orders.length) {
    const msg = isRad ? 'No imaging records found.' : 'No lab records in the past year.';
    section.append(hdr, el('div', 'empty', msg));
    return section;
  }

  const wrap  = el('div', 'table-wrap');
  const table = document.createElement('table');

  // Header row
  const thead = document.createElement('thead');
  const hrow  = document.createElement('tr');
  ['醫囑', '狀態', isRad ? '報告' : '結果', '單位', '生效時間', '簽收時間']
    .forEach(h => { const th = document.createElement('th'); th.textContent = h; hrow.appendChild(th); });
  thead.appendChild(hrow);

  // Data rows
  const tbody = document.createElement('tbody');
  orders.forEach(o => {
    const tr = document.createElement('tr');
    if (o.status.includes('執行中')) tr.classList.add('pending');
    if (o.status.includes('更正'))   tr.classList.add('corrected');

    [o.orderName, o.status, null, o.dept, o.orderDate, o.receiveDate]
      .forEach((val, i) => {
        if (i === 2) {
          tr.appendChild(makeExpandableCell(o.reportText));
        } else {
          const td = document.createElement('td');
          td.textContent = val || '';
          td.title = val || '';
          tr.appendChild(td);
        }
      });

    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrap.appendChild(table);
  section.append(hdr, wrap);
  return section;
}

function renderResults(data, resultsEl) {
  resultsEl.innerHTML = '';

  const meta = el('div', 'meta');
  const printBtns = `<label class="page1-only-label"><input type="checkbox" id="page1-only-cb" checked /> 僅第1頁</label>` +
                     `<label class="page1-only-label"><input type="checkbox" id="hiv-report-cb" /> HIV報表</label>` +
                     ` <button class="btn-print btn-debug" id="debug-btn">檢查比對</button>` +
                     ` <button class="btn-print" id="print-color-btn">🎨 彩色列印</button>` +
                     ` <button class="btn-print btn-print-bw" id="print-bw-btn">🖨️ 黑白列印</button>`;
  if (data.fromCache) {
    const ts = data.cachedAt ? new Date(data.cachedAt).toLocaleString() : '?';
    meta.innerHTML =
      `<span class="cache-badge">📦 Cached</span> ${ts}` +
      ` &nbsp; <button class="btn-small" id="refresh-btn">↻ Refresh</button>` +
      ` &nbsp; ${printBtns}`;
  } else {
    const ts = new Date(data.fetchedAt).toLocaleString();
    meta.innerHTML =
      `<span class="fresh-badge">✓ Fresh</span> ${ts}` +
      ` &nbsp; <span class="total-note">Total ${data.totalFetched} → ${data.recentCount} shown (Lab 1y / Imaging all)</span>` +
      ` &nbsp; ${printBtns}`;
  }

  const bar = el('div', 'chartno-display',
    `Chart: <strong>${data.chartno}</strong> &nbsp; <span class="period">Lab: 1 year · Imaging: all</span>`);

  resultsEl.append(bar, meta);
  resultsEl.append(renderSection(data.lab, '🧪 Lab Orders'));
  resultsEl.append(renderSection(data.rad, '🖼️ Radiology / Imaging'));

  document.getElementById('refresh-btn')?.addEventListener('click', () => doSearch(true));

  // Shared print handler — bw: true for black & white
  async function handlePrint(bw) {
    const input      = document.getElementById('chartno-input');
    const statusEl   = document.getElementById('status');
    const tokens     = splitChartInput(input.value);
    const page1Only  = document.getElementById('page1-only-cb')?.checked || false;
    const hivReport  = document.getElementById('hiv-report-cb')?.checked || false;

    // If only one ID (or the displayed data matches), use it directly
    if (tokens.length <= 1) {
      const allOrders = [...(data.lab || []), ...(data.rad || [])];
      const info = {
        ...(data.patientInfo || { chartno: data.chartno, name: '', gender: '', age: '' }),
        printDate: new Date().toLocaleDateString('zh-TW'),
      };
      const html = generateReport(info, allOrders, bw, CONFIG.REPORT_TITLE, page1Only, hivReport);
      try {
        await chrome.storage.local.set({ reportHtml: html, reportGeneratedAt: Date.now() });
        await chrome.tabs.create({ url: chrome.runtime.getURL('report-viewer.html') });
      } catch (e) {
        if (statusEl) { statusEl.textContent = 'Print failed: ' + e.message; statusEl.className = 'status error'; }
      }
      return;
    }

    // Multiple IDs — fetch each, skip errors
    const patients = [];
    let skipped = 0;
    for (let i = 0; i < tokens.length; i++) {
      let chartno;
      try { chartno = formatChartNo(tokens[i]); } catch { skipped++; continue; }

      if (statusEl) {
        statusEl.textContent = `列印：正在載入 ${i + 1}/${tokens.length} (${chartno})…`;
        statusEl.className = 'status loading';
      }

      try {
        const d = await loadData(tokens[i], false, () => {});
        const allOrders = [...(d.lab || []), ...(d.rad || [])];
        if (!allOrders.length) { skipped++; continue; }
        const info = {
          ...(d.patientInfo || { chartno: d.chartno, name: '', gender: '', age: '' }),
          printDate: new Date().toLocaleDateString('zh-TW'),
        };
        patients.push({ patientInfo: info, orders: allOrders });
      } catch {
        skipped++;
      }
    }

    if (!patients.length) {
      if (statusEl) { statusEl.textContent = 'No valid patients found.'; statusEl.className = 'status error'; }
      return;
    }

    const html = generateMultiReport(patients, bw, CONFIG.REPORT_TITLE, page1Only, hivReport);
    try {
      await chrome.storage.local.set({ reportHtml: html, reportGeneratedAt: Date.now() });
      await chrome.tabs.create({ url: chrome.runtime.getURL('report-viewer.html') });
      if (statusEl) {
        const msg = skipped ? `已產生 ${patients.length} 位報告（跳過 ${skipped} 筆）` : `已產生 ${patients.length} 位報告`;
        statusEl.textContent = msg;
        statusEl.className = 'status';
      }
    } catch (e) {
      if (statusEl) { statusEl.textContent = 'Print failed: ' + e.message; statusEl.className = 'status error'; }
    }
  }

  document.getElementById('print-color-btn')?.addEventListener('click', () => handlePrint(false));
  document.getElementById('print-bw-btn')?.addEventListener('click', () => handlePrint(true));

  // ── Debug / Comparison mode ────────────────────────────────────────
  document.getElementById('debug-btn')?.addEventListener('click', async () => {
    const allOrders = [...(data.lab || []), ...(data.rad || [])];
    const info = data.patientInfo || { chartno: data.chartno, name: '', gender: '', age: '' };
    const hivReport = document.getElementById('hiv-report-cb')?.checked || false;
    const html = generateDebugReport(info, allOrders, hivReport);
    try {
      await chrome.storage.local.set({ reportHtml: html, reportGeneratedAt: Date.now() });
      await chrome.tabs.create({ url: chrome.runtime.getURL('report-viewer.html') });
    } catch (e) {
      const statusEl = document.getElementById('status');
      if (statusEl) { statusEl.textContent = 'Debug view failed: ' + e.message; statusEl.className = 'status error'; }
    }
  });
}

// ─── Live Hint ────────────────────────────────────────────────────────────────
function updateHint(raw) {
  const hint = document.getElementById('chartno-hint');
  if (!raw.trim()) { hint.textContent = ''; return; }
  const tokens = splitChartInput(raw);
  const formatted = [];
  tokens.forEach(t => {
    try { formatted.push(formatChartNo(t)); } catch { /* skip */ }
  });
  if (formatted.length) {
    hint.textContent = '→ ' + formatted.join(', ');
    hint.style.color = '#2e86c1';
  } else {
    hint.textContent = '';
  }
}

// ─── Search Entry Point ───────────────────────────────────────────────────────
async function doSearch(forceRefresh = false) {
  const input     = document.getElementById('chartno-input');
  const statusEl  = document.getElementById('status');
  const resultsEl = document.getElementById('results');
  const btn       = document.getElementById('search-btn');

  // Split input into tokens; validate that at least one is a valid chart number
  const tokens = splitChartInput(input.value);
  const validTokens = [];
  tokens.forEach(t => {
    try { formatChartNo(t); validTokens.push(t); } catch { /* skip */ }
  });

  if (!validTokens.length) {
    statusEl.textContent = 'Please enter at least one valid chart number.';
    statusEl.className   = 'status error';
    return;
  }

  statusEl.className = 'status loading';
  resultsEl.innerHTML = '';
  btn.disabled = true;

  // Search and display the first valid ID in the popup table
  const firstToken = validTokens[0];
  statusEl.textContent = forceRefresh ? 'Fetching page 1…' : 'Loading…';

  try {
    const data = await loadData(firstToken, forceRefresh, (fetched, total) => {
      statusEl.textContent = typeof fetched === 'string'
        ? `${fetched}…`
        : `Fetched ${fetched} / ${total} orders…`;
    });
    statusEl.textContent = validTokens.length > 1
      ? `顯示第 1 筆；列印時將產生全部 ${validTokens.length} 位報告`
      : '';
    statusEl.className = 'status';
    renderResults(data, resultsEl);
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
    statusEl.className   = 'status error';
  } finally {
    btn.disabled = false;
  }
}

// ─── Patterns freshness UI ───────────────────────────────────────────────────
// Updates the badge in the popup header to show whether TEST_MAP came from
// a fresh GitHub fetch, the local cache, or the bundled snapshot.
function renderPatternsStatus(result) {
  const el = document.getElementById('patterns-status');
  if (!el) return;
  el.classList.remove('fresh', 'cached', 'bundle');

  if (result.source === 'remote') {
    el.classList.add('fresh');
    el.textContent = '✓ patterns just synced';
    el.title = 'Fetched from GitHub. Click to re-fetch.';
  } else if (result.source === 'cache') {
    el.classList.add('cached');
    const ageMin = Math.round((Date.now() - result.fetchedAt) / 60000);
    const ageStr = ageMin < 60 ? ageMin + 'min' : Math.round(ageMin / 60) + 'h';
    el.textContent = '📦 patterns ' + ageStr + ' old';
    el.title = 'From local cache. Click to force-refresh from GitHub.';
  } else {
    el.classList.add('bundle');
    el.textContent = '⚠ patterns from bundle (offline?)';
    el.title = 'Could not reach GitHub. Using bundled snapshot. Click to retry.';
  }
}

async function refreshPatterns(forceRefresh) {
  const el = document.getElementById('patterns-status');
  if (el && forceRefresh) { el.textContent = '⟳ syncing…'; el.title = ''; }
  try {
    const result = await window.loadPatterns(forceRefresh);
    if (result && result.TEST_MAP && result.source !== 'bundle') {
      window.TEST_MAP = result.TEST_MAP;
    }
    renderPatternsStatus(result || { source: 'bundle' });
  } catch (e) {
    console.warn('[popup] pattern refresh failed:', e);
    renderPatternsStatus({ source: 'bundle' });
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();

  const input    = document.getElementById('chartno-input');
  const statusEl = document.getElementById('status');

  // Warn if OPSID is not configured
  if (!CONFIG.OPSID) {
    statusEl.textContent = '請先至設定頁面輸入操作人員代號 (OPSID)。右鍵點擊擴充功能圖示 → 選項';
    statusEl.className = 'status error';
  }

  // Kick off pattern refresh in the background — UI is usable immediately
  // with the bundled TEST_MAP; once the fetch resolves, TEST_MAP is replaced
  // with the latest from GitHub (or stays bundled if offline).
  refreshPatterns(false);
  document.getElementById('patterns-status')?.addEventListener('click', () => refreshPatterns(true));

  document.getElementById('search-btn').addEventListener('click', () => doSearch(false));
  // Textarea: plain Enter triggers search; Shift+Enter inserts a newline.
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSearch(false);
    }
  });
  input.addEventListener('input',   () => updateHint(input.value));
  input.focus();
});
