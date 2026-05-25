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
  // S3：往前最多看 5 筆 DM EDUCATION，跳過子頁面 regex 抓不到內容的，
  // 取最近 2 筆「有內容」（此次問題 或 衛教項目 任一非空）的紀錄；5 筆都沒內容也停。
  const candidates = dmOrders.slice(0, 5);
  const out = [];
  for (const o of candidates) {
    if (out.length >= 2) break;
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
    if (!issue && !edu) continue;   // 「有內容」判定：兩者皆空 → 跳過此筆繼續往前看
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
  const upcr  = extractLatestLabValue(lab, catById('UPCR'));

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
  const upcrVal = upcr ? parseFloat(upcr.value) : null;
  const gfrStage  = LAB_HELPERS.GFRStage  ? LAB_HELPERS.GFRStage({ eGFR: egfrVal }) : null;
  // 2026-05-25 順手修 pre-existing bug:UPCR 原本硬寫 null,UPCR-only 病人 staging 算不出 → 改傳 upcrVal
  const taiwanCKD = LAB_HELPERS.TaiwanCKD ? LAB_HELPERS.TaiwanCKD({ eGFR: egfrVal, UACR: uacrVal, UPCR: upcrVal }) : null;
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
    values: { sugar, hba1c, creat, uacr, upcr, egfr },
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
  // S3：表格內直接完整顯示最近兩次有內容紀錄，不 truncate、不 tooltip。
  const lines = dmList.map(d =>
    `<div class="dm-line">` +
      `<span class="dm-date">${escHtml(d.date)}</span> — ` +
      `此次問題: ${escHtml(d.issue || '(無)')} / 衛教: ${escHtml(d.edu || '(無)')}` +
    `</div>`
  );
  return `<div class="dm-cell">${lines.join('')}</div>`;
}

// DM 天數：與 DM 衛教內容欄連動 — 最近一筆「有內容」紀錄 order date 至今天的天數。
// >180 橘字、>365 紅字；無有效紀錄 → 灰底「—」。
function renderDmDaysCell(dmList) {
  if (!dmList || !dmList.length) return '<div class="dm-days-empty">—</div>';
  const days = ageInDays(dmList[0].date);
  if (days == null) return '<div class="dm-days-empty">—</div>';
  let cls = '';
  if (days > 365) cls = 'dm-days-bad';
  else if (days > 180) cls = 'dm-days-warn';
  return `<span${cls ? ` class="${cls}"` : ''}>${days} 天</span>`;
}

// Early CKD / Pre-ESRD 資格：✅ / ❌（依 patterns EarlyCKD computed → P1早期 / P2中晚期）
function renderEligibilityCell(eligible) {
  return eligible
    ? '<span class="elig-yes">✅</span>'
    : '<span class="elig-no">❌</span>';
}

// S3（read-only）：移除「加入個案管理」按鈕，僅保留「報告」跳轉。registry 寫入
// UI 已下線（store 與 registry* 函式保留於 lab-core.js，跨 repo DB 解後再啟用，
// 見 brief § Follow-up #1）。
function renderActions(row) {
  return `<button class="row-action report" data-chartno="${escHtml(row.chartno)}" data-act="report">報告</button>`;
}

// ─── State + render loop ────────────────────────────────────────────
const state = {
  results: [],          // batchScreen 結果
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
      case 'upcr':      return r.values?.upcr ? parseFloat(r.values.upcr.value) : null;
      case 'sugar':     return r.values?.sugar ? parseFloat(r.values.sugar.value) : null;
      case 'hba1c':     return r.values?.hba1c ? parseFloat(r.values.hba1c.value) : null;
      case 'egfr':      return r.values?.egfr ? r.values.egfr.value : null;
      case 'gfrStage':  return r.staging?.gfrStage || '';
      case 'dmDays':    return (r.dmEducation && r.dmEducation.length) ? ageInDays(r.dmEducation[0].date) : null;
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
    tbody.innerHTML = '<tr><td colspan="18" class="empty-table">無資料</td></tr>';
    return;
  }

  const html = rows.map(r => {
    if (r.error) {
      return `<tr class="row-error"><td class="col-chartno">${escHtml(r.chartno)}</td><td colspan="17">⚠️ ${escHtml(r.error)}</td></tr>`;
    }
    const uacrCell = renderLabCell(r.values?.uacr, catById('UACR'));
    const upcrCell = renderLabCell(r.values?.upcr, catById('UPCR'));
    const sugCell  = renderLabCell(r.values?.sugar, catById('GluAC'));
    const hbaCell  = renderLabCell(r.values?.hba1c, catById('HbA1c'));
    const ekgCell  = renderExamCell(r.exams?.EKG);
    const abiCell  = renderExamCell(r.exams?.ABI);
    const pvrCell  = renderExamCell(r.exams?.PVR);
    const funCell  = renderExamCell(r.exams?.Fundus);
    const dmCell     = renderDmCell(r.dmEducation);
    const dmDaysCell = renderDmDaysCell(r.dmEducation);
    const egfrCell = renderEgfrCell(r.values?.egfr);

    const recentLabDate = r.recentLab?.date || '';
    const recentLabCell = recentLabDate
      ? `<div>${escHtml(recentLabDate)}</div><span class="rel-time">${escHtml(relativeFromTwDate(recentLabDate))}</span>`
      : '<span style="color:#bdc3c7;">—</span>';

    const earlyCell = renderEligibilityCell(r.enrollEligible?.earlyCKD);
    const preCell   = renderEligibilityCell(r.enrollEligible?.preESRD);
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
        `<td>${sugCell}</td>` +
        `<td>${hbaCell}</td>` +
        `<td>${ekgCell}</td>` +
        `<td>${abiCell}</td>` +
        `<td>${pvrCell}</td>` +
        `<td>${funCell}</td>` +
        `<td>${uacrCell}</td>` +
        `<td>${upcrCell}</td>` +
        `<td>${egfrCell}</td>` +
        `<td class="dm-col">${dmCell}</td>` +
        `<td class="dmdays-col">${dmDaysCell}</td>` +
        `<td class="elig-col">${earlyCell}</td>` +
        `<td>${gfrStageHtml}</td>` +
        `<td class="elig-col">${preCell}</td>` +
        `<td class="action-col">${renderActions(r)}</td>` +
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

// ─── 個案管理（registry）：S3 read-only，UI 已下線 ───────────────────────
// S3 為唯讀篩檢：移除「加入個案管理 / 批次加入 / 個案名單」registry 寫入＋讀取
// UI（enrollPatient / batchEnroll / refreshRegistrySet / loadFromRegistry 一併
// 移除）。registry object store 與 registryPut/Get/List/Remove 仍保留於
// lab-core.js（保留但不接 UI），待跨 repo 共享 DB 路線拍板後於下一個 brief
// 重新接上（brief § Follow-up #1）。

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

// ─── 目前篩選後可見列（filter + sort，排除 error）：供列印與計數共用 ──────
function getVisibleRows() {
  let rows = state.results.filter(r => r && !r.error);
  if (state.filterEligible) {
    rows = rows.filter(r => r.enrollEligible &&
      (r.enrollEligible.earlyCKD || r.enrollEligible.preESRD || r.enrollEligible.DM));
  }
  rows.sort((a, b) => {
    const c = compareForSort(a, b, state.sortKey);
    return state.sortDir === 'desc' ? -c : c;
  });
  return rows;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── CSV 匯出（UTF-8 BOM；日期民國格式；四新欄入欄；未執行標「已開未做」） ─
function csvField(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function csvExam(exam) {
  if (!exam) return '';
  if (exam.isPending) return `已開未做 ${exam.latest.orderDate || exam.latest.date || ''}`.trim();
  return exam.latest.date || exam.latest.orderDate || '';
}

function downloadCsv(filename, csvText) {
  // UTF-8 BOM 讓 Excel 開啟中文不亂碼。
  const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv() {
  const rows = state.results.filter(r => r && !r.error);
  if (!rows.length) { setStatus('尚無篩檢結果可匯出'); return; }
  const headers = ['病歷號', '姓名', '性別', '年齡', '最近抽血',
    'Sugar', 'HbA1c', 'EKG', 'ABI', 'PVR', '眼底鏡',
    'UACR', 'UPCR', 'eGFR',
    'DM衛教-此次問題', 'DM衛教-衛教項目', 'DM天數',
    'EarlyCKD', 'GFR分期', 'PreESRD'];
  const lines = [headers.map(csvField).join(',')];
  for (const r of rows) {
    const dm0 = (r.dmEducation && r.dmEducation[0]) || null;
    const dmDays = dm0 ? ageInDays(dm0.date) : null;
    const line = [
      r.chartno,
      r.patientInfo?.name || '',
      r.patientInfo?.gender || '',
      r.patientInfo?.age || '',
      r.recentLab?.date || '',
      r.values?.sugar?.value || '',
      r.values?.hba1c?.value || '',
      csvExam(r.exams?.EKG),
      csvExam(r.exams?.ABI),
      csvExam(r.exams?.PVR),
      csvExam(r.exams?.Fundus),
      r.values?.uacr?.value || '',
      r.values?.upcr?.value || '',
      r.values?.egfr?.value != null ? r.values.egfr.value : '',
      dm0?.issue || '',
      dm0?.edu || '',
      dmDays != null ? dmDays : '',
      r.enrollEligible?.earlyCKD ? 'Y' : 'N',
      r.staging?.gfrStage || '',
      r.enrollEligible?.preESRD ? 'Y' : 'N',
    ];
    lines.push(line.map(csvField).join(','));
  }
  downloadCsv(`ckd-dm-screening-${todayISO()}.csv`, lines.join('\r\n'));
  setStatus(`已匯出 CSV：${rows.length} 位`);
}

// ─── 批次列印（沿用 cxr.html 範式：填 print-head 後 window.print()。
//     @media print 隱藏 UI／動作欄、A4 橫印、DM 衛教完整展開。
//     列印範圍＝目前篩選後可見列：renderTable 只渲染篩選後的列到 DOM，
//     window.print() 自然只印可見列） ───────────────────────────────────
function printDashboard() {
  if (!state.results.length) { setStatus('尚無篩檢結果可列印'); return; }
  const visible = getVisibleRows();
  const iso = todayISO();
  const titleEl = document.querySelector('.print-head h1');
  if (titleEl) titleEl.textContent = `CKD/DM 收案篩檢 — ${iso}`;
  const dmN    = visible.filter(r => r.isDM).length;
  const earlyN = visible.filter(r => r.enrollEligible?.earlyCKD).length;
  const preN   = visible.filter(r => r.enrollEligible?.preESRD).length;
  const metaEl = document.getElementById('print-meta');
  if (metaEl) {
    metaEl.textContent =
      `列印 ${visible.length} 位 ｜ DM ${dmN} ｜ Early CKD ${earlyN} ｜ Pre-ESRD ${preN}`;
  }
  window.print();
}

// ─── 主要：跑篩檢（清單來自 popup → chrome.storage.session 或 registry） ─
async function screenChartText(rawText) {
  const tokens = splitChartInput(rawText || '');
  const valid = [];
  tokens.forEach(t => {
    try { valid.push(formatChartNo(t.chartno)); } catch (_) {}
  });
  const uniq = [...new Set(valid)];
  if (!uniq.length) {
    setStatus('清單為空或無有效病歷號 — 請在 popup 貼上病歷號清單後按「DM腎病個案管理」', true);
    return;
  }
  setStatus(`開始篩檢 ${uniq.length} 位病人…`);
  setProgress(0, uniq.length);

  try {
    state.results = await batchScreen(uniq, (done, total) => setProgress(done, total));
    renderTable();
    const errCount = state.results.filter(r => r && r.error).length;
    setStatus(`完成：${uniq.length} 位（${errCount} 筆錯誤）。表格 header 可點擊排序。`);
  } catch (e) {
    setStatus('篩檢失敗：' + (e.message || e), true);
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

// ─── 清單來源：popup → chrome.storage.session ─────────────────────────
// popup 是唯一輸入點;按「DM腎病個案管理」會把清單存進 session（{text, ts}）。
// 本視窗載入時讀一次,之後靠 storage.onChanged 偵測 popup 再次送清單（含
// 已開視窗 focus 的情境）自動重新篩檢。
const DASHBOARD_LIST_KEY = 'dashboard_chartlist';

async function loadListFromSession() {
  try {
    const r = await chrome.storage.session.get([DASHBOARD_LIST_KEY]);
    const entry = r[DASHBOARD_LIST_KEY];
    if (entry && entry.text) { screenChartText(entry.text); return true; }
  } catch (_) {}
  return false;
}

// 把目前已篩檢的病歷號帶去「健檢報告」視窗（避免開到空白視窗）。
async function openCxrWithCurrentList() {
  const chartnos = state.results.filter(r => r && r.chartno).map(r => r.chartno);
  if (chartnos.length) {
    try { await chrome.storage.session.set({ cxr_chartlist: { text: chartnos.join('\n'), ts: Date.now() } }); } catch (_) {}
  }
  const url = chrome.runtime.getURL('cxr.html');
  let existing = [];
  try { existing = await chrome.tabs.query({ url }); } catch (_) {}
  if (existing && existing.length) chrome.windows.update(existing[0].windowId, { focused: true });
  else if (chrome.windows && chrome.windows.create) chrome.windows.create({ url, type: 'popup', width: 1200, height: 860 });
  else chrome.tabs.create({ url });
}

// ─── Bootstrap ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  if (!CONFIG.OPSID) {
    setStatus('請先至 popup → 選項頁設定 OPSID,本 Dashboard 才能 fetch ernode', true);
  }
  refreshPatterns(false);

  document.getElementById('print-all')?.addEventListener('click', printDashboard);
  document.getElementById('export-csv')?.addEventListener('click', exportCsv);
  document.getElementById('open-cxr-btn')?.addEventListener('click', openCxrWithCurrentList);

  document.getElementById('filter-eligible')?.addEventListener('change', (e) => {
    state.filterEligible = e.target.checked;
    renderTable();
  });

  // 載入 popup 送來的清單;沒有就提示
  const got = await loadListFromSession();
  if (!got && CONFIG.OPSID) {
    setStatus('請在 popup 貼上病歷號清單後按「DM腎病個案管理」開始篩檢');
  }

  // popup 再次送清單（或 focus 已開視窗時）→ 自動重新篩檢
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session') return;
    const c = changes[DASHBOARD_LIST_KEY];
    if (c && c.newValue && c.newValue.text) screenChartText(c.newValue.text);
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

  // event delegation：列「報告」按鈕 / 病歷號連結 → 跳 Tab 1 詳細報告
  document.getElementById('result-body').addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const chartno = t.dataset.chartno;
    if (!chartno) return;
    if (t.dataset.act === 'report') jumpToReport(chartno);
  });
});
