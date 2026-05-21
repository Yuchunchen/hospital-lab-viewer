'use strict';

// ════════════════════════════════════════════════════════════════════════════
// llm-translate.js — 健檢 CXR 報告翻譯的多後端 LLM adapter。
//
// 唯一對外入口：
//   window.cxrLlmTranslate(reportText, settings)
//     → Promise<{ summary, findings:[{item,status,detail}], hasAbnormal }>
//
// settings（由 cxr.js 從 chrome.storage.local 'cxr_llm_settings' 讀入）：
//   { provider:'mock'|'gemini'|'claude'|'openai', apiKey:'', model:'' }
//
// 設計：每個 provider 的 request 組裝 + response 解析各自獨立（_cxrGemini /
// _cxrClaude / _cxrOpenai），共用同一份 system prompt 與 _cxrNormalize 後處理。
// provider==='mock' 時 _cxrMock 用關鍵字啟發法產生假資料,完全不打網路 —
// 讓 fetch→extract→translate→render pipeline 在沒有 API key 時就能整條跑通。
//
// 注意：本檔與 mapping.js / patterns-computed.js 同頁載入,共用 classic-script
// global lexical scope。所有 top-level 宣告一律 CXR_ 前綴或唯一命名,避免與
// `CATALOG` / `HELPERS` 等既有 const 撞名造成整檔 SyntaxError。
// ════════════════════════════════════════════════════════════════════════════

const CXR_SYSTEM_PROMPT = [
  '你是放射科報告翻譯助手。將英文 CXR（胸部 X 光）報告翻譯為中文白話摘要。',
  '',
  '規則：',
  '1. 用一般人能理解的中文描述,不要逐字直譯,抓住臨床意義。',
  '2. 每一項發現判斷為正常或異常：異常 status="abnormal",正常或無臨床意義 status="normal"。',
  '3. summary 為 2-3 句中文整體摘要。',
  '4. 只輸出 JSON,不要加任何解釋文字或 markdown 圍欄。',
  '',
  'JSON 格式：',
  '{',
  '  "summary": "中文整體摘要",',
  '  "findings": [',
  '    { "item": "心臟", "status": "normal", "detail": "心臟大小正常" }',
  '  ],',
  '  "hasAbnormal": false',
  '}',
].join('\n');

// ─── 共用：把 model 回傳的字串解析成 JSON（容忍 markdown 圍欄） ──────────
function cxrParseModelJson(raw) {
  if (raw == null) throw new Error('LLM 回傳空內容');
  let s = String(raw).trim();
  // 去掉 ```json ... ``` 或 ``` ... ``` 圍欄
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // 退一步：擷取第一個 { 到最後一個 } 之間
  if (s[0] !== '{') {
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  }
  return JSON.parse(s);
}

// ─── 共用：把任意 shape 收斂成穩定的 { summary, findings[], hasAbnormal } ──
function cxrNormalizeResult(obj) {
  const out = {
    summary: typeof obj?.summary === 'string' ? obj.summary.trim() : '',
    findings: [],
    hasAbnormal: false,
  };
  if (Array.isArray(obj?.findings)) {
    out.findings = obj.findings.map(f => ({
      item:   typeof f?.item === 'string' ? f.item.trim() : '',
      status: f?.status === 'abnormal' ? 'abnormal' : 'normal',
      detail: typeof f?.detail === 'string' ? f.detail.trim() : '',
    })).filter(f => f.item || f.detail);
  }
  // hasAbnormal：優先用 model 給的布林,否則由 findings 推導
  if (typeof obj?.hasAbnormal === 'boolean') out.hasAbnormal = obj.hasAbnormal;
  else out.hasAbnormal = out.findings.some(f => f.status === 'abnormal');
  return out;
}

// ─── Mock provider：關鍵字啟發,不打網路 ─────────────────────────────────
// 用一組「異常字根」掃描每行英文報告;命中即標 abnormal 並給中文 detail。
// 目的不是臨床正確,而是讓 render / 排序 / 篩選 在開發期有真實感的多樣輸出。
const CXR_MOCK_ABNORMAL = [
  { re: /cardiomegaly|enlarged heart|cardiac.*enlarg/i, item: '心臟', detail: '心臟肥大' },
  { re: /infiltrat/i,                                    item: '肺野', detail: '肺部浸潤(可能發炎或感染)' },
  { re: /effusion/i,                                     item: '肋膜', detail: '肋膜積水' },
  { re: /opacity|opacit/i,                               item: '肺野', detail: '不透明陰影,建議追蹤' },
  { re: /nodule|mass/i,                                  item: '肺野', detail: '結節/腫塊,需進一步檢查' },
  { re: /consolidat/i,                                   item: '肺野', detail: '肺實質化' },
  { re: /atelectasis/i,                                  item: '肺野', detail: '肺塌陷' },
  { re: /pneumothorax/i,                                 item: '肋膜', detail: '氣胸' },
  { re: /tortuous aorta|atherosclerot|aortic.*calcif/i,  item: '主動脈', detail: '主動脈彎曲/動脈硬化變化' },
  { re: /elevated.*diaphragm/i,                          item: '橫膈', detail: '橫膈上升' },
  { re: /prominent.*hil/i,                               item: '肺門', detail: '肺門明顯,建議追蹤' },
  { re: /djd|degenerative|osteoporos|spondylo/i,         item: '骨骼', detail: '退化性/骨質疏鬆變化' },
  { re: /scoliosis/i,                                    item: '脊椎', detail: '脊椎側彎' },
  { re: /fibrosis|fibrotic/i,                            item: '肺野', detail: '纖維化變化' },
  { re: /calcified granuloma|old.*tb|fibrocalcific/i,    item: '肺野', detail: '陳舊性病灶(鈣化肉芽腫)' },
];

function cxrMock(reportText) {
  const lines = String(reportText || '')
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const findings = [];
  for (const line of lines) {
    let matched = false;
    for (const rule of CXR_MOCK_ABNORMAL) {
      if (rule.re.test(line)) {
        findings.push({ item: rule.item, status: 'abnormal', detail: rule.detail });
        matched = true;
        break;
      }
    }
    if (!matched && line.length > 4) {
      findings.push({ item: '其他', status: 'normal', detail: '無明顯臨床意義' });
    }
  }
  const abn = findings.filter(f => f.status === 'abnormal');
  let summary;
  if (!lines.length) {
    summary = '(mock) 無報告內容可翻譯';
  } else if (abn.length) {
    summary = `(mock) 發現 ${abn.length} 項異常：` +
      abn.map(f => f.detail).join('、') + '。建議門診追蹤。';
  } else {
    summary = '(mock) 胸部 X 光未見明顯異常,心臟大小與肺野大致正常。';
  }
  return Promise.resolve(cxrNormalizeResult({
    summary,
    findings: abn.length ? abn : [{ item: '整體', status: 'normal', detail: '未見明顯異常' }],
    hasAbnormal: abn.length > 0,
  }));
}

// ─── Gemini ──────────────────────────────────────────────────────────────
async function cxrGemini(reportText, settings) {
  const model = settings.model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey || '')}`;
  const body = {
    system_instruction: { parts: [{ text: CXR_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: reportText }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return cxrNormalizeResult(cxrParseModelJson(text));
}

// ─── Claude (Anthropic Messages API) ──────────────────────────────────────
async function cxrClaude(reportText, settings) {
  const model = settings.model || 'claude-haiku-4-5-20251001';
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey || '',
      'anthropic-version': '2023-06-01',
      // extension（非 localhost origin）直接呼叫需要這個 header 才不被 CORS 擋
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: CXR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: reportText }],
    }),
  });
  if (!resp.ok) throw new Error(`Claude HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const text = Array.isArray(data?.content)
    ? data.content.filter(b => b.type === 'text').map(b => b.text).join('')
    : '';
  return cxrNormalizeResult(cxrParseModelJson(text));
}

// ─── OpenAI (Chat Completions) ─────────────────────────────────────────────
async function cxrOpenai(reportText, settings) {
  const model = settings.model || 'gpt-4o-mini';
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey || ''}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: CXR_SYSTEM_PROMPT },
        { role: 'user', content: reportText },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  return cxrNormalizeResult(cxrParseModelJson(text));
}

// ─── Dispatcher ────────────────────────────────────────────────────────────
function cxrLlmTranslate(reportText, settings) {
  settings = settings || {};
  switch (settings.provider) {
    case 'gemini': return cxrGemini(reportText, settings);
    case 'claude': return cxrClaude(reportText, settings);
    case 'openai': return cxrOpenai(reportText, settings);
    case 'mock':
    default:       return cxrMock(reportText);
  }
}

if (typeof window !== 'undefined') {
  window.cxrLlmTranslate = cxrLlmTranslate;
}
