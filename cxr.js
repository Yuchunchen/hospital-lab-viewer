'use strict';

// ════════════════════════════════════════════════════════════════════════════
// cxr.js — 健檢 CXR 批次翻譯（獨立視窗，由 popup / dashboard 開啟）。
//
// 流程：textarea 病歷號 → 第一階段 batch fetch（concurrency 3）每人 reuse
// lab-core loadData → 找最近一筆 CXR order（catalog `CXR` pattern match
// orderName）→ 子頁面 OpdOrderReport.aspx 取「報告內容：」英文 free text →
// 第二階段 batch translate（concurrency 5）每筆 reportText 經 llm-translate
// （mock / gemini / claude / openai）→ IndexedDB cxrTranslations 快取 → render
// 表格（狀態 🔴/✅/⚠️、摘要 truncate+tooltip、異常項目）→ 排序/篩選/列印。
//
// 本檔不自己 fetch / 開 DB,呼叫 lab-core 的 loadData / buildSubpageUrl /
// fetchSubpageText / enrichCacheGet/Put / cxrTxGet/cxrTxPut,翻譯呼叫
// llm-translate 的 window.cxrLlmTranslate。
//
// classic-script 共用 global scope：所有 top-level 宣告一律 CXR_/cxr 前綴,
// 避開 mapping.js `CATALOG` / patterns-computed.js `HELPERS` 等既有 const。
// ════════════════════════════════════════════════════════════════════════════

// ─── Catalog 取用 ──────────────────────────────────────────────────────────
const CXR_CATALOG = window.HOSPITAL_LAB_PATTERNS_CATALOG || [];
function cxrCatById(id) { return CXR_CATALOG.find(c => c.id === id) || null; }

// ─── Settings ──────────────────────────────────────────────────────────────
const CXR_SETTINGS_KEY = 'cxr_llm_settings';
const CXR_MODEL_DEFAULTS = {
  mock:   '',
  gemini: 'gemini-2.5-flash',
  claude: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
};
const CXR_PROVIDER_HINT = {
  mock:   '不呼叫任何 API，用關鍵字啟發產生假摘要 — 用來測整條 pipeline。',
  gemini: 'POST generativelanguage.googleapis.com … :generateContent（key 走 query string）。',
  claude: 'POST api.anthropic.com/v1/messages（x-api-key + browser-access header）。',
  openai: 'POST api.openai.com/v1/chat/completions（Authorization: Bearer）。',
};
let cxrSettings = { provider: 'mock', apiKey: '', model: '' };

function cxrLoadSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get([CXR_SETTINGS_KEY], r => {
      const s = r[CXR_SETTINGS_KEY] || {};
      cxrSettings = {
        provider: s.provider || 'mock',
        apiKey:   s.apiKey   || '',
        model:    s.model    || CXR_MODEL_DEFAULTS[s.provider || 'mock'] || '',
      };
      resolve(cxrSettings);
    });
  });
}

function cxrSaveSettings(s) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [CXR_SETTINGS_KEY]: s }, resolve);
  });
}

// ─── 小工具 ─────────────────────────────────────────────────────────────
function cxrResdttmToTaiwan(str) {
  if (!str || str.length < 8) return null;
  const y = +str.slice(0, 4);
  if (!y) return null;
  return `${y - 1911}/${str.slice(4, 6)}/${str.slice(6, 8)}`;
}

function cxrOrderSortKey(o) {
  if (o.resdttm && o.resdttm.length >= 8) return o.resdttm;
  const m = (o.orderDate || '').match(/(\d+)\/(\d+)\/(\d+)(?:\s+(\d+):(\d+))?/);
  if (m) {
    const y  = String(+m[1] + 1911).padStart(4, '0');
    return `${y}${m[2].padStart(2,'0')}${m[3].padStart(2,'0')}${(m[4]||'00').padStart(2,'0')}${(m[5]||'00').padStart(2,'0')}00`;
  }
  return '0';
}

function cxrEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function cxrRelTime(twDate) {
  const d = parseDateTaiwan(twDate);   // from lab-core.js
  if (!d) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 0) return '';
  if (days <= 30) return `${days}天前`;
  if (days <= 90) return `${Math.round(days / 7)}週前`;
  return `${Math.round(days / 30)}個月前`;
}

// ─── 子頁面報告 text 擷取 ───────────────────────────────────────────────
// 子頁面 textContent 含「檢查項目：… IMPRESSION：… 報告內容：> line > line …」。
// 取「報告內容：」之後的英文 free text;每行以 `>` 開頭 → 切成多行。
function cxrExtractReportText(subpageText) {
  if (!subpageText) return '';
  const m = subpageText.match(/報告內容[：:]\s*([\s\S]*)/);
  if (!m) return '';
  let body = m[1];
  // 去掉子頁面尾端可能的版面雜訊
  body = body.split(/列印日期|報告醫師|登打人員|頁次/)[0];
  // 以 `>` 標記切行（DOMParser textContent 可能把換行壓掉,故優先用 >）
  const segs = body.split(/\s*>\s*/).map(s => s.trim()).filter(Boolean);
  if (segs.length > 1) return segs.join('\n');
  return body.split(/\r?\n/).map(s => s.trim()).filter(Boolean).join('\n');
}

// ─── 第一階段：抓單人 CXR order + 報告 text ─────────────────────────────
async function cxrFetchPatient(rawChart) {
  const chartno = formatChartNo(rawChart);   // lab-core
  const data = await loadData(chartno, false, () => {});
  const orders = data.allOrders || [...(data.lab || []), ...(data.rad || [])];
  const patientInfo = data.patientInfo || { chartno, name: '', gender: '', age: '' };

  const def = cxrCatById('CXR');
  const matches = orders
    .filter(o => def && def.pattern.test(o.orderName || ''))
    .sort((a, b) => cxrOrderSortKey(b).localeCompare(cxrOrderSortKey(a)));
  const cxr = matches[0];

  if (!cxr) {
    return { chartno, patientInfo, status: 'noReport', cxrDate: '', ordapno: '', reportText: '' };
  }

  const cxrDate = cxrResdttmToTaiwan(cxr.resdttm) || cxr.orderDate || '';
  let subpageText = null;
  if (cxr.ordapno) {
    try { subpageText = await enrichCacheGet(cxr.ordapno); } catch (_) {}
    if (!subpageText) {
      const url = buildSubpageUrl(cxr.ordapno, chartno);
      if (url) {
        try {
          subpageText = await fetchSubpageText(url);
          if (subpageText) { try { await enrichCachePut(cxr.ordapno, subpageText); } catch (_) {} }
        } catch (_) {}
      }
    }
  }
  const reportText = cxrExtractReportText(subpageText);

  return {
    chartno,
    patientInfo,
    status: reportText ? 'pending' : 'noReport',
    cxrDate,
    ordapno: cxr.ordapno || '',
    orderName: cxr.orderName || '',
    reportText,
  };
}

// ─── 第二階段：翻譯單筆（先查快取，provider/model 不符才重打） ─────────
async function cxrTranslateRow(row) {
  if (!row || row.status === 'noReport' || !row.reportText) {
    if (row) row.status = 'noReport';
    return row;
  }
  // 快取命中（同 provider + model）→ 直接用
  if (row.ordapno) {
    let cached = null;
    try { cached = await cxrTxGet(row.ordapno); } catch (_) {}
    if (cached && cached.provider === cxrSettings.provider && cached.model === (cxrSettings.model || CXR_MODEL_DEFAULTS[cxrSettings.provider] || '')) {
      row.translation = cached;
      row.status = cached.hasAbnormal ? 'abnormal' : 'normal';
      row.fromCache = true;
      return row;
    }
  }
  try {
    const tx = await window.cxrLlmTranslate(row.reportText, cxrSettings);
    row.translation = tx;
    row.status = tx.hasAbnormal ? 'abnormal' : 'normal';
    if (row.ordapno) {
      try {
        await cxrTxPut({
          ordapno: row.ordapno,
          summary: tx.summary, findings: tx.findings, hasAbnormal: tx.hasAbnormal,
          provider: cxrSettings.provider,
          model: cxrSettings.model || CXR_MODEL_DEFAULTS[cxrSettings.provider] || '',
        });
      } catch (_) {}
    }
  } catch (e) {
    row.status = 'error';
    row.translation = { error: e && e.message ? e.message : String(e) };
  }
  return row;
}

// ─── 並行池 ─────────────────────────────────────────────────────────────
async function cxrRunPool(items, worker, concurrency, onDone) {
  let next = 0, done = 0;
  async function w() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try { await worker(items[i], i); } catch (_) {}
      done++;
      if (onDone) onDone(done, items.length);
    }
  }
  const n = Math.min(concurrency, items.length) || 0;
  const ws = [];
  for (let i = 0; i < n; i++) ws.push(w());
  await Promise.all(ws);
}

// ─── State ─────────────────────────────────────────────────────────────
const cxrState = {
  results: [],
  sortKey: 'status',
  sortDir: 'asc',
  filterAbnormal: false,
  filterNoreport: false,
};

// 狀態排序權重：異常優先 → 無報告 → 正常 → 錯誤
const CXR_STATUS_WEIGHT = { abnormal: 0, noReport: 1, normal: 2, error: 3, pending: 4 };

// ─── Render ─────────────────────────────────────────────────────────────
function cxrStatusCell(status) {
  switch (status) {
    case 'abnormal': return '<span class="st-abnormal">🔴 異常</span>';
    case 'normal':   return '<span class="st-normal">✅ 正常</span>';
    case 'noReport': return '<span class="st-noreport">⚠️ 無報告</span>';
    case 'error':    return '<span class="st-error">⚠️ 錯誤</span>';
    default:         return '<span class="st-error">—</span>';
  }
}

function cxrSummaryCell(row) {
  if (row.status === 'noReport') return '<span class="finding-none">—</span>';
  if (row.status === 'error') {
    return `<span class="st-error">翻譯失敗：${cxrEsc(row.translation?.error || '')}</span>`;
  }
  const s = row.translation?.summary || '';
  if (!s) return '<span class="finding-none">—</span>';
  return `<div class="summary-clip" title="${cxrEsc(s)}">${cxrEsc(s)}</div>`;
}

function cxrFindingsCell(row) {
  const abn = (row.translation?.findings || []).filter(f => f.status === 'abnormal');
  if (!abn.length) return '<span class="finding-none">—</span>';
  return abn.map(f =>
    `<span class="finding-abn">🔴 ${cxrEsc(f.item)}${f.detail ? '：' + cxrEsc(f.detail) : ''}</span>`
  ).join('');
}

function cxrCompare(a, b, key) {
  function lift(r) {
    if (!r || r.error) return null;
    switch (key) {
      case 'chartno': return r.chartno || '';
      case 'name':    return r.patientInfo?.name || '';
      case 'cxrDate': return r.cxrDate || '';
      case 'status':  return CXR_STATUS_WEIGHT[r.status] ?? 9;
      case 'summary': return r.translation?.summary || '';
      case 'findings':return (r.translation?.findings || []).filter(f => f.status === 'abnormal').length;
      default:        return '';
    }
  }
  const va = lift(a), vb = lift(b);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  if (typeof va === 'number' && typeof vb === 'number') return va - vb;
  return String(va).localeCompare(String(vb));
}

function cxrRenderTable() {
  const tbody = document.getElementById('result-body');
  let rows = cxrState.results.slice();

  if (cxrState.filterAbnormal) rows = rows.filter(r => r && r.status === 'abnormal');
  if (cxrState.filterNoreport) rows = rows.filter(r => r && r.status === 'noReport');

  rows.sort((a, b) => {
    const c = cxrCompare(a, b, cxrState.sortKey);
    return cxrState.sortDir === 'desc' ? -c : c;
  });

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-table">無資料</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    if (r.error) {
      return `<tr class="row-error"><td class="col-chartno">${cxrEsc(r.chartno)}</td><td colspan="5">⚠️ ${cxrEsc(r.error)}</td></tr>`;
    }
    const name = r.patientInfo?.name || '';
    const dateCell = r.cxrDate
      ? `<div>${cxrEsc(r.cxrDate)}</div><span style="color:#7f8c8d;font-size:10px;">${cxrEsc(cxrRelTime(r.cxrDate))}</span>`
      : '<span class="finding-none">—</span>';
    return (
      `<tr>` +
        `<td class="col-chartno">${cxrEsc(r.chartno)}</td>` +
        `<td>${cxrEsc(name)} <span style="color:#7f8c8d;font-size:10px;">${cxrEsc((r.patientInfo?.gender||'')+' '+(r.patientInfo?.age||''))}</span></td>` +
        `<td>${dateCell}</td>` +
        `<td class="col-status">${cxrStatusCell(r.status)}</td>` +
        `<td class="summary-cell">${cxrSummaryCell(r)}</td>` +
        `<td class="findings-cell">${cxrFindingsCell(r)}</td>` +
      `</tr>`
    );
  }).join('');

  document.querySelectorAll('table.cxr thead th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.key === cxrState.sortKey) {
      th.classList.add(cxrState.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

// ─── Status / progress ───────────────────────────────────────────────────
function cxrSetStatus(msg, isError) {
  const s = document.getElementById('status');
  s.textContent = msg || '';
  s.className = isError ? 'error' : '';
}

function cxrSetProgress(done, total, label) {
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  const pct = total ? Math.round(done / total * 100) : 0;
  fill.style.width = pct + '%';
  text.textContent = total ? `${label || ''} ${done}/${total} (${pct}%)` : '尚未開始';
}

// ─── 主流程（清單來自 popup → chrome.storage.session 'cxr_chartlist'） ──
async function cxrRunFromText(rawText) {
  const tokens = splitChartInput(rawText || '');   // lab-core
  const valid = [];
  tokens.forEach(t => { try { valid.push(formatChartNo(t.chartno)); } catch (_) {} });
  const uniq = [...new Set(valid)];
  if (!uniq.length) {
    cxrSetStatus('清單為空或無有效病歷號 — 請在 popup 貼上病歷號清單後按「健檢報告」', true);
    return;
  }

  cxrSetStatus(`第一階段：抓取 ${uniq.length} 位病人的 CXR order…`);
  cxrSetProgress(0, uniq.length, '抓取');

  // 第一階段：fetch（concurrency 3 — ernode）
  const rows = uniq.map(c => ({ chartno: c }));
  await cxrRunPool(rows, async (row, i) => {
    try { rows[i] = await cxrFetchPatient(row.chartno); }
    catch (e) { rows[i] = { chartno: row.chartno, error: e && e.message ? e.message : String(e) }; }
  }, 3, (d, t) => cxrSetProgress(d, t, '抓取'));

  cxrState.results = rows;
  cxrRenderTable();

  // 第二階段：translate（concurrency 5 — LLM）只翻有報告的
  const toTranslate = rows.filter(r => r && r.status === 'pending' && r.reportText);
  if (toTranslate.length) {
    cxrSetStatus(`第二階段：翻譯 ${toTranslate.length} 筆 CXR 報告（provider: ${cxrSettings.provider}）…`);
    cxrSetProgress(0, toTranslate.length, '翻譯');
    await cxrRunPool(toTranslate, async (row) => { await cxrTranslateRow(row); }, 5,
      (d, t) => { cxrSetProgress(d, t, '翻譯'); cxrRenderTable(); });
  }

  cxrRenderTable();
  const abn = rows.filter(r => r && r.status === 'abnormal').length;
  const none = rows.filter(r => r && r.status === 'noReport').length;
  const err = rows.filter(r => r && (r.status === 'error' || r.error)).length;
  cxrSetStatus(`完成：${uniq.length} 位 · 🔴異常 ${abn} · ⚠️無報告 ${none}` + (err ? ` · 錯誤 ${err}` : '') + '。表格 header 可點擊排序。');
}

// ─── 列印 ───────────────────────────────────────────────────────────────
function cxrPrint() {
  const rows = cxrState.results.filter(r => r && !r.error);
  const abn = rows.filter(r => r.status === 'abnormal').length;
  const none = rows.filter(r => r.status === 'noReport').length;
  const today = new Date();
  const dateStr = `${today.getFullYear() - 1911}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`;
  document.getElementById('print-meta').textContent =
    `列印日期 ${dateStr} ｜ 總人數 ${rows.length} ｜ 🔴異常 ${abn} ｜ ⚠️無報告 ${none}`;
  window.print();
}

// ─── Settings modal ─────────────────────────────────────────────────────
function cxrUpdateProviderBadge() {
  const badge = document.getElementById('provider-badge');
  const model = cxrSettings.model || CXR_MODEL_DEFAULTS[cxrSettings.provider] || '';
  badge.textContent = `provider: ${cxrSettings.provider}${model ? ' · ' + model : ''}`;
}

function cxrOpenSettings() {
  document.getElementById('set-provider').value = cxrSettings.provider;
  document.getElementById('set-model').value = cxrSettings.model || CXR_MODEL_DEFAULTS[cxrSettings.provider] || '';
  document.getElementById('set-apikey').value = cxrSettings.apiKey || '';
  document.getElementById('model-hint').textContent = CXR_PROVIDER_HINT[cxrSettings.provider] || '';
  document.getElementById('test-result').textContent = '';
  document.getElementById('test-result').className = '';
  document.getElementById('settings-modal').classList.add('open');
}

function cxrCloseSettings() {
  document.getElementById('settings-modal').classList.remove('open');
}

function cxrSettingsFromForm() {
  const provider = document.getElementById('set-provider').value;
  const modelInput = document.getElementById('set-model').value.trim();
  return {
    provider,
    model: modelInput || CXR_MODEL_DEFAULTS[provider] || '',
    apiKey: document.getElementById('set-apikey').value,
  };
}

async function cxrTestConnection() {
  const tr = document.getElementById('test-result');
  const s = cxrSettingsFromForm();
  tr.className = '';
  tr.textContent = '測試中…';
  const sample = [
    'Cardiomegaly with tortuous aorta and atherosclerotic change',
    'Mild infiltration over left lower lung field',
    'No pleural effusion',
  ].join('\n');
  try {
    const out = await window.cxrLlmTranslate(sample, s);
    tr.className = 'ok';
    tr.textContent = `✅ 連線成功（${s.provider}）\n摘要：${out.summary}\n異常項目：${(out.findings||[]).filter(f=>f.status==='abnormal').map(f=>f.item).join('、') || '無'}`;
  } catch (e) {
    tr.className = 'err';
    tr.textContent = `❌ 失敗：${e && e.message ? e.message : String(e)}`;
  }
}

async function cxrSaveFromForm() {
  cxrSettings = cxrSettingsFromForm();
  await cxrSaveSettings(cxrSettings);
  cxrUpdateProviderBadge();
  cxrCloseSettings();
  cxrSetStatus(`已儲存設定：provider=${cxrSettings.provider}${cxrSettings.model ? '，model=' + cxrSettings.model : ''}`);
}

// ─── Patterns refresh（沿用 pattern-loader） ───────────────────────────
async function cxrRefreshPatterns(force) {
  try { await window.loadPatterns(force); } catch (_) {}
}

// ─── 清單來源：popup → chrome.storage.session 'cxr_chartlist' ───────────
const CXR_LIST_KEY = 'cxr_chartlist';

async function cxrLoadListFromSession() {
  try {
    const r = await chrome.storage.session.get([CXR_LIST_KEY]);
    const entry = r[CXR_LIST_KEY];
    if (entry && entry.text) { cxrRunFromText(entry.text); return true; }
  } catch (_) {}
  return false;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();          // lab-core
  await cxrLoadSettings();
  cxrUpdateProviderBadge();
  cxrRefreshPatterns(false);

  if (!CONFIG.OPSID) {
    cxrSetStatus('請先至 popup → 選項頁設定 OPSID，本視窗才能 fetch ernode', true);
  }
  if (!cxrCatById('CXR')) {
    cxrSetStatus('catalog 找不到 CXR pattern — 請先在 popup 重新整理 patterns（或 sync-patterns）', true);
  }

  document.getElementById('print-btn')?.addEventListener('click', cxrPrint);

  document.getElementById('filter-abnormal')?.addEventListener('change', e => {
    cxrState.filterAbnormal = e.target.checked;
    if (e.target.checked) { cxrState.filterNoreport = false; document.getElementById('filter-noreport').checked = false; }
    cxrRenderTable();
  });
  document.getElementById('filter-noreport')?.addEventListener('change', e => {
    cxrState.filterNoreport = e.target.checked;
    if (e.target.checked) { cxrState.filterAbnormal = false; document.getElementById('filter-abnormal').checked = false; }
    cxrRenderTable();
  });

  document.querySelectorAll('table.cxr thead th').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.key;
      if (!k) return;
      if (cxrState.sortKey === k) cxrState.sortDir = cxrState.sortDir === 'asc' ? 'desc' : 'asc';
      else { cxrState.sortKey = k; cxrState.sortDir = 'asc'; }
      cxrRenderTable();
    });
  });

  // settings modal
  document.getElementById('gear-btn')?.addEventListener('click', cxrOpenSettings);
  document.getElementById('close-btn')?.addEventListener('click', cxrCloseSettings);
  document.getElementById('save-btn')?.addEventListener('click', cxrSaveFromForm);
  document.getElementById('test-btn')?.addEventListener('click', cxrTestConnection);
  document.getElementById('set-provider')?.addEventListener('change', e => {
    const p = e.target.value;
    document.getElementById('set-model').value = CXR_MODEL_DEFAULTS[p] || '';
    document.getElementById('model-hint').textContent = CXR_PROVIDER_HINT[p] || '';
  });
  document.getElementById('settings-modal')?.addEventListener('click', e => {
    if (e.target.id === 'settings-modal') cxrCloseSettings();
  });

  // 載入 popup 送來的清單;沒有就提示
  const got = await cxrLoadListFromSession();
  if (!got && CONFIG.OPSID && cxrCatById('CXR')) {
    cxrSetStatus('請在 popup 貼上病歷號清單後按「健檢報告」');
  }

  // popup 再次送清單（或 focus 已開視窗時）→ 自動重新翻譯
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session') return;
    const c = changes[CXR_LIST_KEY];
    if (c && c.newValue && c.newValue.text) cxrRunFromText(c.newValue.text);
  });
});
