'use strict';

// ════════════════════════════════════════════════════════════════════════════
// cxr.js — 健檢報告批次翻譯（獨立視窗，由 popup / dashboard 開啟）。
//
// 涵蓋四類健檢影像：CXR / BMD（骨密）/ CAC（冠脈鈣化）/ LDCT（低劑量肺CT），
// 各自對應 catalog track-only pattern（match orderName）。
//
// 清單來自 popup → chrome.storage.session 'cxr_chartlist'。
// 第一階段 batch fetch（concurrency 3）每人 reuse lab-core loadData → 四種
// pattern 各取最近一筆 order（每種一列,最多 4 列;沒有就不出該列）→ 子頁面
// OpdOrderReport.aspx 取「報告內容：」之後 free text（去表頭）。
// 第二階段 batch translate（concurrency 5）每列 reportText 經 llm-translate
// （mock / gemini / claude / openai）→ IndexedDB cxrTranslations 快取 →
// render 6 欄表格（病歷號 / 檢查類型 / 開單日期 / 檢查日期 / 原始內容 / 摘要）
// → 檢查類型 + 異常/無報告 篩選 / group 排序 / 統計列 / 列印。
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

// ─── 四類健檢影像 ───────────────────────────────────────────────────────
// 每種對應 catalog 的 track-only pattern（match orderName）。排序序決定同病人
// 內各列的呈現順序（CXR → BMD → CAC → LDCT）。
const CXR_EXAM_TYPES = [
  { id: 'CXR',  order: 0 },
  { id: 'BMD',  order: 1 },
  { id: 'CAC',  order: 2 },
  { id: 'LDCT', order: 3 },
];
function cxrExamOrder(id) {
  const e = CXR_EXAM_TYPES.find(x => x.id === id);
  return e ? e.order : 99;
}

// ─── 子頁面報告 text 擷取（去表頭） ─────────────────────────────────────
// cleaning 三層（「報告內容：」分隔線主路徑 / 表頭欄位行 strip 備援 / 通用清理）
// 已抽到 lab-core.js 的 cleanImagingReport()，與 popup imaging row 共用同一份。
// 子頁面 textContent 與 master orders page cells[2] 同格式,故行為一致。

// ─── 子頁面 fetch（快取優先） ───────────────────────────────────────────
async function cxrFetchSubpage(ordapno, chartno) {
  if (!ordapno) return '';
  let text = null;
  try { text = await enrichCacheGet(ordapno); } catch (_) {}
  if (text) return text;
  const url = buildSubpageUrl(ordapno, chartno);
  if (!url) return '';
  try {
    text = await fetchSubpageText(url);
    if (text) { try { await enrichCachePut(ordapno, text); } catch (_) {} }
  } catch (_) { return ''; }
  return text || '';
}

// ─── 第一階段：抓單人四類影像（每種最近一筆）→ 回傳 rows[] ──────────────
async function cxrFetchPatient(rawChart) {
  const chartno = formatChartNo(rawChart);   // lab-core
  const data = await loadData(chartno, false, () => {});
  const orders = data.allOrders || [...(data.lab || []), ...(data.rad || [])];
  const patientInfo = data.patientInfo || { chartno, name: '', gender: '', age: '' };

  const rows = [];
  for (const et of CXR_EXAM_TYPES) {
    const def = cxrCatById(et.id);
    if (!def || !def.pattern) continue;
    const matches = orders
      .filter(o => def.pattern.test(o.orderName || ''))
      .sort((a, b) => cxrOrderSortKey(b).localeCompare(cxrOrderSortKey(a)));
    const ord = matches[0];
    if (!ord) continue;   // 沒有該檢查 → 不顯示那列

    const subpageText = await cxrFetchSubpage(ord.ordapno, chartno);
    const reportText = cleanImagingReport(subpageText);   // lab-core 共用
    rows.push({
      chartno, patientInfo,
      examType:  et.id,
      examName:  ord.orderName || '',
      orderDate: ord.orderDate || cxrResdttmToTaiwan(ord.resdttm) || '',  // 生效時間
      examDate:  ord.receiveDate || '',                                   // 簽收時間
      ordapno:   ord.ordapno || '',
      reportText,
      status:    reportText ? 'pending' : 'noReport',
      translation: null,
    });
  }

  if (!rows.length) {
    // 四種都沒有 → 一列佔位,避免病人靜默消失
    return [{ chartno, patientInfo, examType: '', examName: '', orderDate: '', examDate: '', ordapno: '', reportText: '', status: 'noReport', translation: null }];
  }
  return rows;
}

// ─── IndexedDB cxrTranslations cache 策略（有意行為，勿加 evict） ─────────
// - 鍵 = ordapno（每筆 order 一筆 cache；store keyPath 即 'ordapno'，見 lab-core.js）
// - 同 ordapno 切 provider/model → 下方 cxrTranslateRow 不重用舊 record，但
//   cxrTxPut 仍以 ordapno overwrite（新 provider 的結果覆蓋舊 provider 的）
// - 不需主動 evict 跨 provider record（本案就靠 overwrite 自然 cap 在 1 筆/ordapno）
//   若日後 IndexedDB 真大到爆 → 加 ⚙️「清快取」按鈕，而非 lazy evict（避免 race）

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
    row.translation = { error: e && e.message ? e.message : String(e), kind: e?.kind || 'UNKNOWN' };
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
  results: [],            // 每列 = 一個病人的一種檢查（CXR/BMD/CAC/LDCT）
  sortKey: 'abnormal',    // 預設：異常浮頂（同 status 內按病歷號 group + 檢查類型序）
  sortDir: 'asc',
  filterAbnormal: false,
  filterNoreport: false,
  filterExam: 'all',      // all | CXR | BMD | CAC | LDCT
};

const CXR_EXAM_BADGE = {
  CXR:  { label: 'CXR',  cls: 'badge-cxr'  },
  BMD:  { label: 'BMD',  cls: 'badge-bmd'  },
  CAC:  { label: 'CAC',  cls: 'badge-cac'  },
  LDCT: { label: 'LDCT', cls: 'badge-ldct' },
};

// ─── Render：cell helpers ───────────────────────────────────────────────
function cxrExamBadge(examType) {
  const b = CXR_EXAM_BADGE[examType];
  if (!b) return '<span class="finding-none">—</span>';
  return `<span class="badge ${b.cls}">${b.label}</span>`;
}

function cxrRawCell(row) {
  const t = row.reportText || '';
  if (!t) return '<span class="finding-none">—</span>';
  // 完整顯示（不 truncate）,white-space:pre-wrap 保留換行
  return `<div class="raw-full">${cxrEsc(t)}</div>`;
}

function cxrSummaryCell(row) {
  if (row.status === 'noReport') return '<span class="st-noreport">⚠️ 無報告</span>';
  if (row.status === 'error')    return `<span class="st-error">⚠️ 翻譯失敗：${cxrEsc(row.translation?.error || '')}</span>`;
  if (row.status === 'pending')  return row.skipped ? '<span class="finding-none">—</span>' : '<span class="finding-none">翻譯中…</span>';
  const tx = row.translation || {};
  const s = tx.summary || '';
  const abn = (tx.findings || []).filter(f => f.status === 'abnormal');
  const icon = row.status === 'abnormal' ? '🔴' : '✅';
  const tip = s + (abn.length ? '\n異常：' + abn.map(f => f.item + (f.detail ? '(' + f.detail + ')' : '')).join('、') : '');
  const cls = row.status === 'abnormal' ? 'summary-abn' : '';
  // .abn-list 只在列印時顯示（螢幕靠 clip2 + tooltip）
  const abnList = abn.length
    ? `<div class="abn-list">${abn.map(f => `🔴 ${cxrEsc(f.item)}${f.detail ? '：' + cxrEsc(f.detail) : ''}`).join('<br>')}</div>`
    : '';
  return `<div class="clip2 ${cls}" title="${cxrEsc(tip)}">${icon} ${cxrEsc(s || '—')}</div>${abnList}`;
}

function cxrCompare(a, b, key) {
  // abnormal：status 浮頂（abnormal=0 > normal/pending=1 > noReport=2 > error=3），
  // 同 status 內 tie-break 仍按 group（病歷號 asc → 檢查類型序 asc）。
  if (key === 'abnormal') {
    const rank = { abnormal: 0, normal: 1, noReport: 2, error: 3, pending: 1 };
    const ra = rank[a.status] ?? 9;
    const rb = rank[b.status] ?? 9;
    if (ra !== rb) return ra - rb;
    const c = String(a.chartno || '').localeCompare(String(b.chartno || ''));
    return c !== 0 ? c : cxrExamOrder(a.examType) - cxrExamOrder(b.examType);
  }
  // group：病歷號 asc → 檢查類型序 asc
  if (key === 'group') {
    const c = String(a.chartno || '').localeCompare(String(b.chartno || ''));
    return c !== 0 ? c : cxrExamOrder(a.examType) - cxrExamOrder(b.examType);
  }
  function lift(r) {
    switch (key) {
      case 'chartno':   return r.chartno || '';
      case 'examType':  return cxrExamOrder(r.examType);
      case 'orderDate': return r.orderDate || '';
      case 'examDate':  return r.examDate || '';
      case 'raw':       return r.reportText || '';
      case 'summary':   return r.translation?.summary || '';
      default:          return '';
    }
  }
  const va = lift(a), vb = lift(b);
  let base = (typeof va === 'number' && typeof vb === 'number')
    ? va - vb
    : String(va).localeCompare(String(vb));
  if (base !== 0) return base;
  // tiebreak：病歷號 + 檢查類型序（維持 group 感）
  const c = String(a.chartno || '').localeCompare(String(b.chartno || ''));
  return c !== 0 ? c : cxrExamOrder(a.examType) - cxrExamOrder(b.examType);
}

function cxrRenderStats() {
  const el = document.getElementById('cxr-stats');
  if (!el) return;
  const rows = cxrState.results;
  if (!rows.length) { el.textContent = ''; return; }
  const patients = new Set(rows.map(r => r.chartno)).size;
  const cnt = { CXR: 0, BMD: 0, CAC: 0, LDCT: 0 };
  let abn = 0, none = 0, err = 0;
  rows.forEach(r => {
    if (cnt[r.examType] != null) cnt[r.examType]++;
    if (r.status === 'abnormal') abn++;
    else if (r.status === 'noReport') none++;
    else if (r.status === 'error') err++;
  });
  el.innerHTML =
    `完成 <b>${patients}</b> 位 · CXR <b>${cnt.CXR}</b> / BMD <b>${cnt.BMD}</b> / CAC <b>${cnt.CAC}</b> / LDCT <b>${cnt.LDCT}</b> 筆` +
    ` · 🔴異常 <b>${abn}</b> · ⚠️無報告 <b>${none}</b>` + (err ? ` · 錯誤 <b>${err}</b>` : '');
}

function cxrRenderTable() {
  cxrRenderStats();
  const tbody = document.getElementById('result-body');
  let rows = cxrState.results.slice();

  if (cxrState.filterExam !== 'all') rows = rows.filter(r => r.examType === cxrState.filterExam);
  if (cxrState.filterAbnormal)       rows = rows.filter(r => r.status === 'abnormal');
  if (cxrState.filterNoreport)       rows = rows.filter(r => r.status === 'noReport');

  rows.sort((a, b) => {
    const c = cxrCompare(a, b, cxrState.sortKey);
    return cxrState.sortDir === 'desc' ? -c : c;
  });

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-table">無資料</td></tr>';
  } else {
    tbody.innerHTML = rows.map(r => {
      if (r.status === 'error') {
        return `<tr class="row-error"><td class="col-chartno">${cxrEsc(r.chartno)}</td><td colspan="5">⚠️ ${cxrEsc(r.error || '錯誤')}</td></tr>`;
      }
      const name = r.patientInfo?.name || '';
      const orderCell = r.orderDate ? cxrEsc(r.orderDate) : '<span class="finding-none">—</span>';
      const examCell = r.examDate
        ? `${cxrEsc(r.examDate)}<span class="rel">${cxrEsc(cxrRelTime(r.examDate))}</span>`
        : '<span class="finding-none">—</span>';
      return (
        `<tr>` +
          `<td class="col-chartno">${cxrEsc(r.chartno)}${name ? `<span class="pt-name">${cxrEsc(name)}</span>` : ''}</td>` +
          `<td>${cxrExamBadge(r.examType)}</td>` +
          `<td>${orderCell}</td>` +
          `<td>${examCell}</td>` +
          `<td class="raw-cell">${cxrRawCell(r)}</td>` +
          `<td class="summary-cell">${cxrSummaryCell(r)}</td>` +
        `</tr>`
      );
    }).join('');
  }

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

  cxrSetStatus(`第一階段：抓取 ${uniq.length} 位病人的四類影像 order…`);
  cxrSetProgress(0, uniq.length, '抓取');

  // 第一階段：fetch（concurrency 3 — ernode）。每人回傳 rows[]（每種檢查一列）。
  const perPatient = new Array(uniq.length).fill(null);
  await cxrRunPool(uniq, async (chartno, i) => {
    try { perPatient[i] = await cxrFetchPatient(chartno); }
    catch (e) { perPatient[i] = [{ chartno, examType: '', status: 'error', error: e && e.message ? e.message : String(e) }]; }
  }, 3, (d, t) => cxrSetProgress(d, t, '抓取'));

  cxrState.results = perPatient.flat().filter(Boolean);
  cxrRenderTable();

  // 第二階段：translate（concurrency 5 — LLM）只翻有報告的列
  // Mode A（provider≠mock 且有 API Key）：自動 batch translate（維持現況）。
  // Mode B（mock 或 Key 空）：跳過翻譯、摘要留白並提示，不送網路（PHI UX 對齊）。
  const toTranslate = cxrState.results.filter(r => r.status === 'pending' && r.reportText);
  const llmReady = cxrSettings.provider !== 'mock' && !!cxrSettings.apiKey;

  if (toTranslate.length && llmReady) {
    cxrSetStatus(`第二階段：翻譯 ${toTranslate.length} 筆報告（provider: ${cxrSettings.provider}）…`);
    cxrSetProgress(0, toTranslate.length, '翻譯');
    await cxrRunPool(toTranslate, async (row) => { await cxrTranslateRow(row); }, 5,
      (d, t) => { cxrSetProgress(d, t, '翻譯'); cxrRenderTable(); });
  } else if (toTranslate.length) {
    // Mode B：LLM 未設定 → 跳過翻譯。pending row 標 skipped（摘要欄留白，不顯「翻譯中…」），
    // render 後 return，避免落到下方「完成」status 蓋掉本提示。
    toTranslate.forEach(r => { r.skipped = true; });
    cxrRenderTable();
    const reason = cxrSettings.provider === 'mock' ? 'mock 模式'
                 : !cxrSettings.apiKey ? `${cxrSettings.provider} 無 API Key`
                 : '未設定';
    cxrSetStatus(`完成抓取 ${toTranslate.length} 筆。LLM 未設定（${reason}）— 摘要空白。請點右上 ⚙️ 設定 provider + API Key 後重跑。`);
    return;
  }

  cxrRenderTable();
  const rows = cxrState.results;
  const patients = new Set(rows.map(r => r.chartno)).size;
  const abn = rows.filter(r => r.status === 'abnormal').length;
  const none = rows.filter(r => r.status === 'noReport').length;
  const err = rows.filter(r => r.status === 'error').length;
  cxrSetStatus(`完成：${patients} 位 · ${rows.length} 列 · 🔴異常 ${abn} · ⚠️無報告 ${none}` + (err ? ` · 錯誤 ${err}` : '') + '。表格 header 可點擊排序。');
}

// ─── 列印（完整內容 + 摘要,異常紅字;頁首含各類檢查統計） ──────────────
function cxrPrint() {
  const rows = cxrState.results;
  const patients = new Set(rows.map(r => r.chartno)).size;
  const cnt = { CXR: 0, BMD: 0, CAC: 0, LDCT: 0 };
  let abn = 0, none = 0;
  rows.forEach(r => {
    if (cnt[r.examType] != null) cnt[r.examType]++;
    if (r.status === 'abnormal') abn++;
    else if (r.status === 'noReport') none++;
  });
  const today = new Date();
  const dateStr = `${today.getFullYear() - 1911}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`;
  document.getElementById('print-meta').textContent =
    `列印日期 ${dateStr} ｜ ${patients} 位 ｜ CXR ${cnt.CXR} / BMD ${cnt.BMD} / CAC ${cnt.CAC} / LDCT ${cnt.LDCT} ｜ 🔴異常 ${abn} ｜ ⚠️無報告 ${none}`;
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
  document.querySelectorAll('input[name="filter-exam"]').forEach(radio => {
    radio.addEventListener('change', e => {
      if (e.target.checked) { cxrState.filterExam = e.target.value; cxrRenderTable(); }
    });
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
