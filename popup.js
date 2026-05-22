'use strict';

// ─── 註：core 工具（config / fetch / parseOrdersPage / IndexedDB / loadData /
// enrich / registry）都搬到 lab-core.js,本檔只留 popup UI 邏輯。

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
    const msg = isRad ? 'No imaging records found.' : 'No lab records found.';
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
          // imaging row：cells[2] 抓到的是 letterhead+表頭+body 全 concat,
          // 在 render 層過 cleanImagingReport（lab-core 共用）只留 finding/impression。
          // lab row 不套（檢驗結果格式,套 imaging cleaning 會破壞）。
          const reportText = isRad ? cleanImagingReport(o.reportText) : o.reportText;
          tr.appendChild(makeExpandableCell(reportText));
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
                     `<label class="page1-only-label"><input type="checkbox" id="a5-layout-cb" /> 📄 A5單頁</label>` +
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
      ` &nbsp; <span class="total-note">Total ${data.totalFetched} → ${data.recentCount} shown (Lab + Imaging: all)</span>` +
      ` &nbsp; ${printBtns}`;
  }

  const bar = el('div', 'chartno-display',
    `Chart: <strong>${data.chartno}</strong> &nbsp; <span class="period">Lab + Imaging: all</span>`);

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
    const a5Layout   = document.getElementById('a5-layout-cb')?.checked || false;

    if (tokens.length <= 1) {
      const allOrders = [...(data.lab || []), ...(data.rad || [])];
      const visitSerial = (tokens.length === 1 ? tokens[0].visitSerial : null);
      const info = {
        ...(data.patientInfo || { chartno: data.chartno, name: '', gender: '', age: '' }),
        printDate: new Date().toLocaleDateString('zh-TW'),
        visitSerial,
      };
      const html = generateReport(info, allOrders, bw, CONFIG.REPORT_TITLE, page1Only, hivReport, a5Layout);
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
      const { chartno: rawChart, visitSerial } = tokens[i];
      let chartno;
      try { chartno = formatChartNo(rawChart); } catch { skipped++; continue; }

      if (statusEl) {
        statusEl.textContent = `列印：正在載入 ${i + 1}/${tokens.length} (${chartno})…`;
        statusEl.className = 'status loading';
      }

      try {
        const d = await loadData(rawChart, false, () => {});
        const allOrders = [...(d.lab || []), ...(d.rad || [])];
        if (!allOrders.length) { skipped++; continue; }
        const info = {
          ...(d.patientInfo || { chartno: d.chartno, name: '', gender: '', age: '' }),
          printDate: new Date().toLocaleDateString('zh-TW'),
          visitSerial,
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

    const html = generateMultiReport(patients, bw, CONFIG.REPORT_TITLE, page1Only, hivReport, a5Layout);
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

  // ── A5 ↔ 僅第1頁 / HIV報表 mutually-exclusive ─────────────────────────
  {
    const a5Cb  = document.getElementById('a5-layout-cb');
    const p1Cb  = document.getElementById('page1-only-cb');
    const hivCb = document.getElementById('hiv-report-cb');
    a5Cb?.addEventListener('change', () => {
      if (a5Cb.checked) {
        if (p1Cb)  { p1Cb.checked  = true;  p1Cb.disabled  = true;  }
        if (hivCb) { hivCb.checked = false; hivCb.disabled = true;  }
      } else {
        if (p1Cb)  p1Cb.disabled  = false;
        if (hivCb) hivCb.disabled = false;
      }
    });
  }

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
    try { formatted.push(formatChartNo(t.chartno)); } catch { /* skip */ }
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

  const tokens = splitChartInput(input.value);
  const validTokens = [];
  tokens.forEach(t => {
    try { formatChartNo(t.chartno); validTokens.push(t); } catch { /* skip */ }
  });

  if (!validTokens.length) {
    statusEl.textContent = 'Please enter at least one valid chart number.';
    statusEl.className   = 'status error';
    return;
  }

  statusEl.className = 'status loading';
  resultsEl.innerHTML = '';
  btn.disabled = true;

  const firstToken = validTokens[0];
  statusEl.textContent = forceRefresh ? 'Fetching page 1…' : 'Loading…';

  try {
    const data = await loadData(firstToken.chartno, forceRefresh, (fetched, total) => {
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

// ─── 統一入口：把 textarea 清單送到獨立視窗 ─────────────────────────────
// popup 是唯一輸入點。按「DM腎病個案管理」/「健檢報告」時：把 textarea 原文
// 存進 chrome.storage.session（{text, ts}，帶 ts 讓相同清單再送也會觸發
// onChanged）→ 若目標視窗已開就 focus（視窗端 storage.onChanged 自動重抓）,
// 否則新開 chrome.windows.create。session 不持久化,關 Chrome 即清。
async function sendListToWindow(pageUrl, storageKey, opts) {
  const raw = (document.getElementById('chartno-input').value || '');
  const statusEl = document.getElementById('status');
  const valid = splitChartInput(raw).filter(t => {
    try { formatChartNo(t.chartno); return true; } catch { return false; }
  });
  if (!valid.length) {
    statusEl.textContent = '請先在上方貼上至少一個有效的病歷號。';
    statusEl.className = 'status error';
    return;
  }
  try {
    await chrome.storage.session.set({ [storageKey]: { text: raw, ts: Date.now() } });
  } catch (e) {
    statusEl.textContent = 'chrome.storage.session 不可用：' + e.message;
    statusEl.className = 'status error';
    return;
  }

  const fullUrl = chrome.runtime.getURL(pageUrl);
  let existing = [];
  try { existing = await chrome.tabs.query({ url: fullUrl }); } catch (_) {}
  if (existing && existing.length) {
    chrome.windows.update(existing[0].windowId, { focused: true });
  } else if (chrome.windows && chrome.windows.create) {
    chrome.windows.create({ url: fullUrl, type: 'popup', width: opts.width, height: opts.height });
  } else {
    chrome.tabs.create({ url: fullUrl });
  }
  statusEl.textContent = `已送 ${valid.length} 筆病歷號到「${opts.label}」`;
  statusEl.className = 'status';
}

function openDashboardWindow() {
  sendListToWindow('dashboard.html', 'dashboard_chartlist', { width: 1400, height: 900, label: 'DM腎病個案管理' });
}

function openCxrWindow() {
  sendListToWindow('cxr.html', 'cxr_chartlist', { width: 1200, height: 860, label: '健檢報告' });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();

  const input    = document.getElementById('chartno-input');
  const statusEl = document.getElementById('status');

  if (!CONFIG.OPSID) {
    statusEl.textContent = '請先至設定頁面輸入操作人員代號 (OPSID)。右鍵點擊擴充功能圖示 → 選項';
    statusEl.className = 'status error';
  }

  refreshPatterns(false);
  document.getElementById('patterns-status')?.addEventListener('click', () => refreshPatterns(true));

  document.getElementById('search-btn').addEventListener('click', () => doSearch(false));
  document.getElementById('dashboard-btn')?.addEventListener('click', openDashboardWindow);
  document.getElementById('cxr-btn')?.addEventListener('click', openCxrWindow);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSearch(false);
    }
  });
  input.addEventListener('input',   () => updateHint(input.value));
  input.focus();

  // Dashboard 的「報告」按鈕會把 chartno 寄存 chrome.storage.local,
  // popup 開啟時偵測,有效期 5 分鐘,自動填入並 search。
  try {
    chrome.storage.local.get(['pendingChartno', 'pendingChartnoTs'], (r) => {
      const ts = r && r.pendingChartnoTs;
      if (r && r.pendingChartno && ts && (Date.now() - ts < 5 * 60 * 1000)) {
        input.value = r.pendingChartno;
        chrome.storage.local.remove(['pendingChartno', 'pendingChartnoTs']);
        doSearch(false);
      }
    });
  } catch (_) {}
});
