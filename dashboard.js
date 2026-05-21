'use strict';

// ════════════════════════════════════════════════════════════════════════════
// dashboard.js — CKD/DM 收案篩檢 Dashboard。獨立視窗（chrome.windows.create
// 由 popup.js openDashboardWindow() 開啟）。
//
// 流程：textarea 輸入病歷號 → batchScreen (concurrency ≤ 3) → 每位病人 reuse
// lab-core 的 loadData/enrichCache → pattern match (UACR/Sugar/HbA1c/CREAT) +
// orderName match (EKG/ABI/PVR/Fundus + DM EDUCATION) → 算 eGFR/GFRStage/
// TaiwanCKD/EarlyCKD → render 表格 → 排序/篩選/registry add/list。
//
// 本檔不抓 chartno 自己,呼叫 lab-core 的 buildSubpageUrl / fetchSubpageText /
// enrichCacheGet/Put / loadData。
// ════════════════════════════════════════════════════════════════════════════

// ─── 短工具 ─────────────────────────────────────────────────────────────
// 注意：patterns-computed.js 已 top-level `const HELPERS`、mapping.js 已
// top-level `const CATALOG`,classic script 共用 global lexical scope,
// 此檔不能再 const 同名,改用 LAB_ 前綴。
const LAB_HELPERS = (window.HOSPITAL_LAB_PATTERNS_COMPUTED || {}).HELPERS || {};
const LAB_CATALOG = window.HOSPITAL_LAB_PATTERNS_CATALOG || [];

function catById(id) { return LAB_CATALOG.find(c => c.id === id) || null; }

function resdttmToTaiwan(str) {
  if (!str || str.length < 8) return null;
  const y = +str.slice(0, 4);
  const m = str.slice(4, 6);
  const d = str.slice(6, 8);
  if (!y) return null;
  return `${y - 1911}/${m}/${d}`;
}

// 排序 key：未執行 order 可能沒有 resdttm,需要 fallback 用 orderDate
// （台灣紀年）轉成可比較字串。
function orderSortKey(o) {
  if (o.resdttm && o.resdttm.length >= 8) return o.resdttm;
  const m = (o.orderDate || '').match(/(\d+)\/(\d+)\/(\d+)(?:\s+(\d+):(\d+))?/);
  if (m) {
    const y  = String(+m[1] + 1911).padStart(4, '0');
    const mo = m[2].padStart(2, '0');
    const d  = m[3].padStart(2, '0');
    const hh = (m[4] || '00').padStart(2, '0');
    const mm = (m[5] || '00').padStart(2, '0');
    return `${y}${mo}${d}${hh}${mm}00`;
  }
  return '0';
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function ageInDays(twDate) {
  const d = parseDateTaiwan(twDate);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function relativeFromTwDate(twDate) {
  const days = ageInDays(twDate);
  if (days == null || days < 0) return '';
  if (days <= 30) return `${days}天前`;
  if (days <= 90) return `${Math.round(days / 7)}週前`;
  return `${Math.round(days / 30)}個月前`;
}

function ageClass(twDate) {
  const days = ageInDays(twDate);
  if (days == null) return '';
  if (days > 365) return 'age-bad';
  if (days > 180) return 'age-warn';
  return '';
}

// ─── 取得最近一筆 lab 值 (match reportText) ─────────────────────────────
function extractLatestLabValue(orders, testDef) {
  if (!testDef || !testDef.pattern) return null;
  const sorted = [...orders].sort((a, b) =>
    orderSortKey(b).localeCompare(orderSortKey(a))
  );
  for (const o of sorted) {
    if (testDef.orderNameFilter && !testDef.orderNameFilter.test(o.orderName || '')) continue;
    const text = o.reportText || '';
    const m = text.match(testDef.pattern);
    if (m) {
      const date = resdttmToTaiwan(o.resdttm) || o.orderDate || '';
      const rawVal = m[1] != null ? String(m[1]).trim() : '';
      return { date, value: rawVal, order: o };
    }
  }
  return null;
}

// ─── 取得最近一筆 examination order (match orderName) + 上一筆 ─────────
function extractLatestExam(orders, testDef) {
  if (!testDef || !testDef.pattern) return null;
  const matching = orders.filter(o => testDef.pattern.test(o.orderName || ''));
  if (!matching.length) return null;
  matching.sort((a, b) =>
    orderSortKey(b).localeCompare(orderSortKey(a)) ||
    (b.ordapno || '').localeCompare(a.ordapno || '')
  );
  const latest = matching[0];
  const prev   = matching[1] || null;
  return {
    latest: {
      date:         resdttmToTaiwan(latest.resdttm) || latest.orderDate || '',
      orderDate:    latest.orderDate || '',
      receiveDate:  latest.receiveDate || '',
      status:       latest.status || '',
    },
    prev: prev ? {
      date:         resdttmToTaiwan(prev.resdttm) || prev.orderDate || '',
      orderDate:    prev.orderDate || '',
      receiveDate:  prev.receiveDate || '',
      status:       prev.status || '',
    } : null,
    isPending: (latest.status || '').includes('未執行'),
  };
}

// ─── DM Education subpage fetch + 擷取 此次問題/衛教項目 ─────────────────
async function extractDMEducation(orders, chartno) {
  const dmOrders = orders
    .filter(o => /DM EDUCATION/i.test(o.orderName || ''))
    .sort((a, b) => orderSortKey(b).localeCompare(orderSortKey(a)));
  const top2 = dmOrders.slice(0, 2);
  const out = [];
  for (const o of top2) {
    if (!o.ordapno) continue;
    let text = null;
    try { text = await enrichCacheGet(o.ordapno); } catch (_) {}
    if (!text) {
      const url = buildSubpageUrl(o.ordapno, chartno);
      if (!url) continue;
      try {
        text = await fetchSubpageText(url);
        if (text) { try { await enrichCachePut(o.ordapno, text); } catch (_) {} }
      } catch { continue; }
    }
    if (!text) continue;
    const issueMatch = text.match(/此次問題：\s*([\s\S]*?)(?=衛教項目：)/);
    const eduMatch   = text.match(/衛教項目：\s*([\s\S]*?)(?=┌|$)/);
    const issue = issueMatch ? issueMatch[1].trim().replace(/\s+/g, ' ') : '';
    const edu   = eduMatch   ? eduMatch[1].trim().replace(/\s+/g, ' ')   : '';
    out.push({
      date:  resdttmToTaiwan(o.resdttm) || o.orderDate || '',
      issue,
      edu,
    });
  }
  return out;
}

// ─── 整合單一病人篩檢結果 ─────────────────────────────────────────────
async function screenPatient(rawChart) {
  const chartno = formatChartNo(rawChart);
  const data = await loadData(chartno, false, () => {});
  const lab = data.lab || [];
  const rad = data.rad || [];
  const orders = data.allOrders || [...lab, ...rad];
  const patientInfo = data.patientInfo || { chartno, name:'', gender:'', age:'' };

  const sugar = extractLatestLabValue(lab, catById('GluAC'));
  const hba1c = extractLatestLabValue(lab, catById('HbA1c'));
  const creat = extractLatestLabValue(lab, catById('CREAT'));
  const uacr  = extractLatestLabValue(lab, catById('UACR'));

  let egfr = null;
  if (creat && patientInfo.age && patientInfo.gender) {
    const e = LAB_HELPERS.eGFR_CKDEPI_2021
      ? LAB_HELPERS.eGFR_CKDEPI_2021({
          creatinine: parseFloat(creat.value),
          age:        parseInt(patientInfo.age, 10),
          gender:     patientInfo.gender,
        })
      : null;
    if (e != null) egfr = { date: creat.date, value: e };
  }

  const exams = {
    EKG:    extractLatestExam(orders, catById('EKG')),
    ABI:    extractLatestExam(orders, catById('ABI')),
    PVR:    extractLatestExam(orders, catById('PVR')),
    Fundus: extractLatestExam(orders, catById('Fundus')),
  };

  const dmEducation = await extractDMEducation(orders, chartno);
  const isDM = orders.some(o => /DM EDUCATION/i.test(o.orderName || ''));

  const egfrVal = egfr ? egfr.value : null;
  const uacrVal = uacr ? parseFloat(uacr.value) : null;
  const gfrStage  = LAB_HELPERS.GFRStage  ? LAB_HELPERS.GFRStage({ eGFR: egfrVal }) : null;
  const taiwanCKD = LAB_HELPERS.TaiwanCKD ? LAB_HELPERS.TaiwanCKD({ eGFR: egfrVal, UACR: uacrVal, UPCR: null }) : null;
  const earlyCKD  = LAB_HELPERS.EarlyCKD  ? LAB_HELPERS.EarlyCKD({ TaiwanCKD: taiwanCKD, eGFR: egfrVal }) : null;

  const labSorted = [...lab].sort((a, b) =>
    orderSortKey(b).localeCompare(orderSortKey(a))
  );
  const recentLab = labSorted[0]
    ? { date: resdttmToTaiwan(labSorted[0].resdttm) || labSorted[0].orderDate || '' }
    : null;

  return {
    chartno,
    patientInfo,
    recentLab,
    values: { sugar, hba1c, creat, uacr, egfr },
    exams,
    dmEducation,
    staging: { gfrStage, taiwanCKD, earlyCKD },
    isDM,
    enrollEligible: {
      earlyCKD: earlyCKD === 'P1早期',
      preESRD:  earlyCKD === 'P2中晚期',
      DM:       isDM,
    },
  };
}

// ─── Batch screen with concurrency ≤ 3 ────────────────────────────────
async function batchScreen(chartnos, onProgress) {
  const results = new Array(chartnos.length).fill(null);
  let completed = 0;
  let nextIdx = 0;

  async function worker() {
    while (true) {
      const i = nextIdx++;
      if (i >= chartnos.length) return;
      try {
        results[i] = await screenPatient(chartnos[i]);
      } catch (e) {
        results[i] = {
          chartno: chartnos[i],
          error:   e && e.message ? e.message : String(e),
        };
      }
      completed++;
      onProgress(completed, chartnos.length);
    }
  }

  const n = Math.min(3, chartnos.length);
  const workers = [];
  for (let i = 0; i < n; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

// ─── 渲染：表格 cell helpers ───────────────────────────────────────────
function renderExamCell(exam) {
  if (!exam) return '<span style="color:#bdc3c7;">—</span>';
  const { latest, prev, isPending } = exam;
  if (isPending) {
    const prevDate = (prev && (prev.receiveDate || prev.date)) || '';
    const html =
      `<span class="pending-mark">⚠️ ${escHtml(latest.orderDate || latest.date)} 已開未做</span>` +
      (prevDate ? `<span class="prev-date">上次: ${escHtml(prevDate)}</span>` : '');
    return `<div class="age-warn" style="margin:-5px -6px;padding:5px 6px;">${html}</div>`;
  }
  const date = latest.date || latest.orderDate;
  const rel  = relativeFromTwDate(date);
  const cls  = ageClass(date);
  const inner =
    `<div>${escHtml(date)}</div>` +
    (rel ? `<span class="rel-time">${escHtml(rel)}</span>` : '');
  return cls
    ? `<div class="${cls}" style="margin:-5px -6px;padding:5px 6px;">${inner}</div>`
    : inner;
}

function renderLabCell(entry, testDef) {
  if (!entry) return '<span style="color:#bdc3c7;">—</span>';
  const val = entry.value;
  const num = parseFloat(val);
  let abnormal = false;
  if (testDef && !isNaN(num)) {
    if (testDef.hi != null && num > testDef.hi) abnormal = true;
    if (testDef.lo != null && num < testDef.lo) abnormal = true;
  }
  const rel = relativeFromTwDate(entry.date);
  return (
    `<div${abnormal ? ' class="lab-abnormal"' : ''}>${escHtml(val)}` +
    (testDef && testDef.unit ? ` <span style="color:#7f8c8d;font-size:10px;">${escHtml(testDef.unit)}</span>` : '') +
    `</div>` +
    (entry.date ? `<span class="rel-time">${escHtml(entry.date)} (${escHtml(rel)})</span>` : '')
  );
}

function renderEgfrCell(egfr) {
  if (!egfr) return '<span style="color:#bdc3c7;">—</span>';
  const v = egfr.value;
  const abnormal = (typeof v === 'number') && v < 60;
  const rel = relativeFromTwDate(egfr.date);
  return (
    `<div${abnormal ? ' class="lab-abnormal"' : ''}>${escHtml(v)}` +
    ` <span style="color:#7f8c8d;font-size:10px;">mL/min</span></div>` +
    (egfr.date ? `<span class="rel-time">${escHtml(egfr.date)} (${escHtml(rel)})</span>` : '')
  );
}

function renderDmCell(dmList) {
  if (!dmList || !dmList.length) return '<span style="color:#bdc3c7;">—</span>';
  const lines = dmList.map(d => {
    const issueShort = (d.issue || '').slice(0, 30);
    const eduShort   = (d.edu   || '').slice(0, 30);
    const fullTip = `${d.date}\n此次問題：${d.issue || '(無)'}\n衛教項目：${d.edu || '(無)'}`;
    return (
      `<div class="dm-line" title="${escHtml(fullTip)}">` +
        `<span class="dm-date">${escHtml(d.date)}</span> ` +
        escHtml(issueShort) + (issueShort.length === 30 ? '…' : '') +
        ' / ' +
        escHtml(eduShort)   + (eduShort.length   === 30 ? '…' : '') +
      `</div>`
    );
  });
  return `<div class="dm-cell">${lines.join('')}</div>`;
}

function renderStagingTag(value, classKind, eligible) {
  if (!eligible) return '<span class="tag-none">—</span>';
  return `<span class="tag tag-${classKind}">✅ ${escHtml(value)}</span>`;
}

function renderActions(row, enrolled) {
  const cats = [];
  if (row.enrollEligible) {
    if (row.enrollEligible.earlyCKD) cats.push('Early-CKD');
    if (row.enrollEligible.preESRD)  cats.push('Pre-ESRD');
    if (row.enrollEligible.DM)       cats.push('DM');
  }
  const eligible = cats.length > 0;
  const reportBtn = `<button class="row-action report" data-chartno="${escHtml(row.chartno)}" data-act="report">報告</button>`;
  if (!eligible) return reportBtn;
  if (enrolled) {
    return (
      `<button class="row-action enrolled" disabled>已收案</button>` + reportBtn
    );
  }
  return (
    `<button class="row-action" data-chartno="${escHtml(row.chartno)}" data-act="enroll" data-cats="${escHtml(cats.join(','))}">加入個案管理</button>` +
    reportBtn
  );
}

// ─── State + render loop ────────────────────────────────────────────
const state = {
  results: [],          // batchScreen 結果
  registry: new Set(),  // 已收案的 chartno（在 init 與每次 enroll 後刷新）
  sortKey: 'chartno',
  sortDir: 'asc',
  filterEligible: false,
};

function compareForSort(a, b, key) {
  function lift(r) {
    if (r.error) return null;
    switch (key) {
      case 'chartno':   return r.chartno || '';
      case 'name':      return r.patientInfo?.name || '';
      case 'recentLab': return r.recentLab?.date || '';
      case 'uacr':      return r.values?.uacr ? parseFloat(r.values.uacr.value) : null;
      case 'sugar':     return r.values?.sugar ? parseFloat(r.values.sugar.value) : null;
      case 'hba1c':     return r.values?.hba1c ? parseFloat(r.values.hba1c.value) : null;
      case 'egfr':      return r.values?.egfr ? r.values.egfr.value : null;
      case 'gfrStage':  return r.staging?.gfrStage || '';
      case 'ekg':       return r.exams?.EKG?.latest?.date || '';
      case 'abi':       return r.exams?.ABI?.latest?.date || '';
      case 'pvr':       return r.exams?.PVR?.latest?.date || '';
      case 'fundus':    return r.exams?.Fundus?.latest?.date || '';
      case 'earlyCKD':  return r.enrollEligible?.earlyCKD ? 1 : 0;
      case 'preESRD':   return r.enrollEligible?.preESRD  ? 1 : 0;
      case 'dm':        return r.enrollEligible?.DM ? 1 : 0;
      default:          return '';
    }
  }
  const va = lift(a), vb = lift(b);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;       // null 永遠排到後面
  if (vb == null) return -1;
  if (typeof va === 'number' && typeof vb === 'number') return va - vb;
  return String(va).localeCompare(String(vb));
}

function renderTable() {
  const tbody = document.getElementById('result-body');
  let rows = state.results.slice();

  if (state.filterEligible) {
    rows = rows.filter(r => r && !r.error && r.enrollEligible &&
      (r.enrollEligible.earlyCKD || r.enrollEligible.preESRD || r.enrollEligible.DM));
  }

  rows.sort((a, b) => {
    const c = compareForSort(a, b, state.sortKey);
    return state.sortDir === 'desc' ? -c : c;
  });

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="16" class="empty-table">無資料</td></tr>';
    return;
  }

  const html = rows.map(r => {
    if (r.error) {
      return `<tr class="row-error"><td class="col-chartno">${escHtml(r.chartno)}</td><td colspan="15">⚠️ ${escHtml(r.error)}</td></tr>`;
    }
    const enrolled = state.registry.has(r.chartno);
    const uacrCell = renderLabCell(r.values?.uacr, catById('UACR'));
    const sugCell  = renderLabCell(r.values?.sugar, catById('GluAC'));
    const hbaCell  = renderLabCell(r.values?.hba1c, catById('HbA1c'));
    const ekgCell  = renderExamCell(r.exams?.EKG);
    const abiCell  = renderExamCell(r.exams?.ABI);
    const pvrCell  = renderExamCell(r.exams?.PVR);
    const funCell  = renderExamCell(r.exams?.Fundus);
    const dmCell   = renderDmCell(r.dmEducation);
    const egfrCell = renderEgfrCell(r.values?.egfr);

    const recentLabDate = r.recentLab?.date || '';
    const recentLabCell = recentLabDate
      ? `<div>${escHtml(recentLabDate)}</div><span class="rel-time">${escHtml(relativeFromTwDate(recentLabDate))}</span>`
      : '<span style="color:#bdc3c7;">—</span>';

    const earlyTag = renderStagingTag(r.staging?.earlyCKD || '', 'early', r.enrollEligible?.earlyCKD);
    const preTag   = renderStagingTag(r.staging?.earlyCKD || '', 'pre',   r.enrollEligible?.preESRD);
    const gfrStageHtml = r.staging?.gfrStage
      ? `<span>${escHtml(r.staging.gfrStage)}</span>` +
        (r.staging.taiwanCKD ? `<span class="rel-time">${escHtml(r.staging.taiwanCKD)}</span>` : '')
      : '<span style="color:#bdc3c7;">—</span>';

    const name = r.patientInfo?.name || '';
    const dmTag = r.isDM ? '<span class="tag tag-dm">DM</span> ' : '';

    return (
      `<tr>` +
        `<td class="col-chartno"><a data-chartno="${escHtml(r.chartno)}" data-act="report">${escHtml(r.chartno)}</a></td>` +
        `<td>${dmTag}${escHtml(name)} <span style="color:#7f8c8d;font-size:10px;">${escHtml((r.patientInfo?.gender || '') + ' ' + (r.patientInfo?.age || ''))}</span></td>` +
        `<td>${recentLabCell}</td>` +
        `<td>${uacrCell}</td>` +
        `<td>${ekgCell}</td>` +
        `<td>${abiCell}</td>` +
        `<td>${pvrCell}</td>` +
        `<td>${funCell}</td>` +
        `<td>${dmCell}</td>` +
        `<td>${sugCell}</td>` +
        `<td>${hbaCell}</td>` +
        `<td>${egfrCell}</td>` +
        `<td>${gfrStageHtml}</td>` +
        `<td>${earlyTag}</td>` +
        `<td>${preTag}</td>` +
        `<td>${renderActions(r, enrolled)}</td>` +
      `</tr>`
    );
  });

  tbody.innerHTML = html.join('');

  // Sort-arrow indicator
  document.querySelectorAll('table.dashboard thead th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.key === state.sortKey) {
      th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

// ─── 個案管理（registry）操作 ─────────────────────────────────────────
async function refreshRegistrySet() {
  try {
    const list = await registryList();
    state.registry = new Set(list.map(r => r.chartno));
  } catch (e) {
    console.warn('[dashboard] registryList failed:', e);
  }
}

async function enrollPatient(chartno, cats) {
  const row = state.results.find(r => r && r.chartno === chartno);
  if (!row) return;
  try {
    await registryPut({
      chartno,
      name:            row.patientInfo?.name || '',
      enrollDate:      new Date().toISOString(),
      category:        cats.join(','),
      lastScreenDate:  new Date().toISOString(),
      notes:           '',
    });
    state.registry.add(chartno);
    renderTable();
    setStatus(`已加入個案管理：${chartno} (${cats.join(',')})`);
  } catch (e) {
    setStatus('加入個案管理失敗：' + e.message, true);
  }
}

async function batchEnroll() {
  const eligible = state.results.filter(r =>
    r && !r.error && r.enrollEligible &&
    (r.enrollEligible.earlyCKD || r.enrollEligible.preESRD || r.enrollEligible.DM) &&
    !state.registry.has(r.chartno)
  );
  if (!eligible.length) {
    setStatus('無新的可收案病人（已收案者不重複加入）');
    return;
  }
  if (!confirm(`將 ${eligible.length} 位符合條件的病人加入個案管理？`)) return;
  let n = 0;
  for (const r of eligible) {
    const cats = [];
    if (r.enrollEligible.earlyCKD) cats.push('Early-CKD');
    if (r.enrollEligible.preESRD)  cats.push('Pre-ESRD');
    if (r.enrollEligible.DM)       cats.push('DM');
    try {
      await registryPut({
        chartno:        r.chartno,
        name:           r.patientInfo?.name || '',
        enrollDate:     new Date().toISOString(),
        category:       cats.join(','),
        lastScreenDate: new Date().toISOString(),
        notes:          '',
      });
      state.registry.add(r.chartno);
      n++;
    } catch (_) {}
  }
  renderTable();
  setStatus(`批次加入完成：${n} / ${eligible.length} 位`);
}

// ─── Status / progress ─────────────────────────────────────────────
function setStatus(msg, isError) {
  const s = document.getElementById('status');
  s.textContent = msg || '';
  s.className = isError ? 'error' : '';
}

function setProgress(done, total) {
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  const pct = total ? Math.round(done / total * 100) : 0;
  fill.style.width = pct + '%';
  text.textContent = total ? `${done} / ${total} 完成 (${pct}%)` : '尚未開始';
}

// ─── 輸入源 handlers ───────────────────────────────────────────────
async function loadFromOpdweb() {
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    setStatus('此 Chrome 版本不支援 chrome.scripting,請手動貼入候診清單', true);
    return;
  }
  try {
    const tabs = await chrome.tabs.query({});
    const opdwebTab = tabs.find(t =>
      t.url && /opdweb\.|opdweb/i.test(t.url || '')
    );
    if (!opdwebTab) {
      setStatus('找不到已開啟的 opdweb 候診頁 tab,請手動貼入或開啟 opdweb 後重試', true);
      return;
    }
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: opdwebTab.id },
      func: () => {
        // 啟發式：抓所有 table cell,挑符合 9-digit + 1-letter 的 token
        const tokens = new Set();
        document.querySelectorAll('table td, table th').forEach(c => {
          const t = (c.textContent || '').trim();
          if (/^\d{6,9}[A-Za-z]$/.test(t)) tokens.add(t);
        });
        // 順便也試 row 整段（tab-paste 模式 splitChartInput 會接手）
        const rows = [];
        document.querySelectorAll('table tr').forEach(tr => {
          const cells = [...tr.querySelectorAll('td,th')].map(c => (c.textContent || '').trim());
          if (cells.length >= 5 && /^\d{6,9}[A-Za-z]$/.test(cells[4])) {
            rows.push(cells.join('\t'));
          }
        });
        return { tokens: [...tokens], rows };
      },
    });
    const { tokens = [], rows = [] } = (result && result.result) || {};
    const ta = document.getElementById('chartno-input');
    if (rows.length) {
      ta.value = rows.join('\n');
      setStatus(`已從 opdweb 讀入 ${rows.length} 筆（含看診序號）`);
    } else if (tokens.length) {
      ta.value = tokens.join('\n');
      setStatus(`已從 opdweb 讀入 ${tokens.length} 個病歷號`);
    } else {
      setStatus('opdweb tab 找到但沒看到病歷號欄位,可能格式不同 — 請手動貼入', true);
    }
  } catch (e) {
    setStatus('讀取 opdweb 失敗：' + e.message, true);
  }
}

async function loadFromRegistry() {
  await refreshRegistrySet();
  try {
    const list = await registryList();
    if (!list.length) {
      setStatus('個案管理 registry 是空的');
      return;
    }
    document.getElementById('chartno-input').value =
      list.map(r => r.chartno).join('\n');
    setStatus(`已載入個案管理名單 ${list.length} 筆 — 點擊「開始篩檢」自動 batch fetch`);
    // S2.7: 自動開始 batch fetch
    runScreen();
  } catch (e) {
    setStatus('讀取 registry 失敗：' + e.message, true);
  }
}

// ─── 主要：跑篩檢 ───────────────────────────────────────────────────
async function runScreen() {
  const ta = document.getElementById('chartno-input');
  const tokens = splitChartInput(ta.value);
  const valid = [];
  tokens.forEach(t => {
    try { valid.push(formatChartNo(t.chartno)); } catch (_) {}
  });
  // dedupe
  const uniq = [...new Set(valid)];
  if (!uniq.length) {
    setStatus('請至少輸入一個有效的病歷號', true);
    return;
  }
  const runBtn = document.getElementById('run-btn');
  runBtn.disabled = true;
  setStatus(`開始篩檢 ${uniq.length} 位病人…`);
  setProgress(0, uniq.length);

  await refreshRegistrySet();

  try {
    state.results = await batchScreen(uniq, (done, total) => {
      setProgress(done, total);
    });
    renderTable();
    const errCount = state.results.filter(r => r && r.error).length;
    setStatus(`完成：${uniq.length} 位（${errCount} 筆錯誤）。表格 header 可點擊排序。`);
  } catch (e) {
    setStatus('篩檢失敗：' + (e.message || e), true);
  } finally {
    runBtn.disabled = false;
  }
}

// ─── 報告連結：把 chartno 寄存 chrome.storage.local,popup 開啟時讀取 ─
async function jumpToReport(chartno) {
  try {
    await chrome.storage.local.set({
      pendingChartno: chartno,
      pendingChartnoTs: Date.now(),
    });
    setStatus(`已設定病歷號 ${chartno} → 請點擊瀏覽器右上角擴充功能圖示開啟 popup 查看詳細報告`);
  } catch (e) {
    setStatus('設定 pendingChartno 失敗：' + e.message, true);
  }
}

// ─── Patterns refresh（沿用 pattern-loader） ───────────────────────────
async function refreshPatterns(force) {
  try {
    const result = await window.loadPatterns(force);
    if (result && result.TEST_MAP && result.source !== 'bundle') {
      window.TEST_MAP = result.TEST_MAP;
    }
  } catch (_) {}
}

// ─── Bootstrap ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  if (!CONFIG.OPSID) {
    setStatus('請先至 popup → 選項頁設定 OPSID,本 Dashboard 才能 fetch ernode', true);
  }
  refreshPatterns(false);
  await refreshRegistrySet();

  document.getElementById('src-opdweb')  ?.addEventListener('click', loadFromOpdweb);
  document.getElementById('src-manual')  ?.addEventListener('click', () => {
    document.getElementById('chartno-input').focus();
    setStatus('請在 textarea 自行輸入或貼入病歷號');
  });
  document.getElementById('src-registry')?.addEventListener('click', loadFromRegistry);
  document.getElementById('run-btn')     ?.addEventListener('click', runScreen);
  document.getElementById('batch-enroll')?.addEventListener('click', batchEnroll);
  document.getElementById('open-cxr-btn')?.addEventListener('click', () => {
    const url = chrome.runtime.getURL('cxr.html');
    if (chrome.windows && chrome.windows.create) {
      chrome.windows.create({ url, type: 'popup', width: 1200, height: 860 });
    } else {
      chrome.tabs.create({ url });
    }
  });

  document.getElementById('filter-eligible')?.addEventListener('change', (e) => {
    state.filterEligible = e.target.checked;
    renderTable();
  });

  // sort by clicking header
  document.querySelectorAll('table.dashboard thead th').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.key;
      if (!k || k === 'action' || k === 'dm') return;  // skip action / DM (multi-line)
      if (state.sortKey === k) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = k;
        state.sortDir = 'asc';
      }
      renderTable();
    });
  });

  // event delegation for row buttons / chartno link
  document.getElementById('result-body').addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const chartno = t.dataset.chartno;
    if (!chartno) return;
    if (act === 'enroll') {
      const cats = (t.dataset.cats || '').split(',').filter(Boolean);
      enrollPatient(chartno, cats);
    } else if (act === 'report') {
      jumpToReport(chartno);
    }
  });
});
