## Hospital Lab Viewer

Chrome extension that fetches lab and imaging orders from the hospital system (臺北榮民總醫院玉里分院) and generates printable patient reports for health education.

### Reference
grab lab data from the following link
http://ernode.vghb12.vhtt.gov.tw:8000/order/get_lab_orders?chartno=000x&opsid=A123456789
http://ernode.vghb12.vhyl.gov.tw:8000/order/get_lab_orders?chartno=000xF&opsid=A123456789

let ai to learn more mapping pattern  by provide a link  contais new items



### Architecture

- **popup.html / popup.js** — Extension popup UI. Search bar accepts chart numbers, displays lab and imaging orders in tables, and has a print button to generate reports.
- **report.js** — Builds the printable HTML report. Generates A4 landscape pages with test results, text-report blocks, and reminders.
- **mapping.js** — *AUTO-GENERATED*. `TEST_MAP` array defining all tracked lab tests with regex patterns, reference ranges, page/column placement, and display info. Source of truth lives in the sibling repo [`hospital-lab-patterns`](https://github.com/Yuchunchen/hospital-lab-patterns) (`patterns/viewer.js`). Refresh via `node sync-patterns.js` from this folder. Do NOT hand-edit `mapping.js` — changes will be overwritten on next sync.
- **patterns-computed.js** — *AUTO-GENERATED*. Shared computed-value helpers (eGFR, URR, Ca×P, CKD/KDIGO staging, qualitative parsers). Synced from `hospital-lab-patterns/patterns/computed.js`. Available as `window.HOSPITAL_LAB_PATTERNS_COMPUTED`; current `report.js` keeps its own inline copies for now (Phase 2 will switch over).
- **sync-patterns.js** — Run with `node sync-patterns.js` after any pattern change in the sibling repo.
- **report-viewer.html / report-viewer.js** — Standalone page that loads the generated report HTML from `chrome.storage.local` into an iframe for viewing/printing.
- **manifest.json** — Chrome extension manifest.

### Key design decisions

- **API base URL**: `http://ernode.vghb12.vhtt.gov.tw:8000`
- **Page 1**: 4-column grid layout. Col 1: 血糖, 血脂肪, 肝功能. Col 2: 腎功能 (含 UACR/UPCR), 腎臟病分期. Col 3: 血液, 營養／電解質. Col 4: 癌症指數, 甲狀腺, 肝炎.
- **Page 2**: 4-column grid — column 1 holds all text-report blocks (bone density, endoscopy, ultrasound), column 2 holds the reminder box ("其他三個月內檢查"), columns 3–4 are empty placeholders.
- **Reminder box**: White background, dashed orange border. Title: "其他三個月內檢查". Lists lab orders from the past 3 months not captured by TEST_MAP patterns.
- **Multi-patient batch printing**: Input field accepts multiple chart numbers separated by commas, semicolons, pipes, or spaces. Each patient's pages are concatenated into one HTML document. Invalid IDs or fetch errors are silently skipped.
- **Print modes**: Two print buttons — "🎨 彩色列印" (color) and "🖨️ 黑白列印" (B&W). Color mode uses red=high, blue=low. B&W mode uses bold+underline=high, bold+italic=low. Both modes use gray background shade on the most recent value.
- **Report font**: Verdana/Arial for non-Chinese characters, Microsoft JhengHei/PingFang TC for Chinese.
- **Computed values**: eGFR is calculated from Creatinine via CKD-EPI 2021 formula (not reported by the hospital API directly). Free/Total PSA ratio is calculated when PSA > 4, with thresholds: >25% normal, 10-25% caution, <10% warning (marked with *).
- **Regex patterns**: Lab values use patterns matching the actual labels from the ernode API. Patterns support multiple hospital label variants (e.g. `Glucose(AC-serum):` / `GLU:`, `Creatinine(serum):` / `CREAT:`, `r-GT:` / `RGT:`). CREAT/eGFR patterns match both `Creatinine(serum):` and `CREAT:` but NOT `Creatinine(24hrs Urine):`. WBC pattern uses a negative lookahead to reject urine-routine range values like `WBC: 0-5` (only matches single numeric values from blood CBC). WBC/Platelet have `normalize` functions to handle unit differences (e.g. WBC 6700 → 6.7 ×10³/µL). Hemoglobin matches both `Hb:` and `HGB:`. Glucose matches `Glucose(AC-serum):`, `GLU:`, `GLU-AC:`, `Sugar:`, `飯前血糖:` etc.
- **Cache**: IndexedDB with 6-hour TTL. Lab orders filtered to last 12 months; imaging shows all.
- **Kidney disease staging**: In the 腎臟病分期 section (page 1, col 2), six computed entries display 3 time points like regular test blocks:
  - GFR stage (正常/CKD2–CKD5) — one per eGFR date
  - UACR stage (正常/A2/A3) — one per UACR date
  - UPCR stage (正常/輕度/顯著/腎病範圍) — one per UPCR date
  - KDIGO risk (低/中/高/極高風險) — per eGFR date, paired with same-date or 3-month-nearest UACR
  - Taiwan CKD stage (正常/第一期–第五期, 第三期分3a/3b) — per eGFR date, paired with same-date or 3-month-nearest UPCR+UACR. G1/G2 require damage marker (UACR≥30 or UPCR≥150).
  - Early CKD class (健保P1早期/P2中晚期) — derived from Taiwan CKD stage. P1=CKD 1–3a (eGFR≥45), P2=CKD 3b–5 (eGFR<45). Only shown when CKD is present.
- **Staging pairing logic**: KDIGO and Taiwan CKD pair eGFR with UACR/UPCR at the same date first; if not found, fall back to the nearest value within 3 months (90 days). Beyond 3 months → no pairing.
- **UACR sub-page fetch**: UACR values may not appear in the main page reportText. If absent, popup.js fetches sub-pages from opdweb (derived from ernode base URL) for lab orders within 1 year, stopping after finding 3 UACR values.
- **UPCR pattern**: Matches `RATTC:` label from the ernode API (in addition to UPCR/TP/Cr variants).
- **Hepatitis section**: Col 4 肝炎 section with D-BIL, T-BIL (numeric, hi/lo thresholds), and HCV/HBsAg (qualitative: `HCV Ab(TT):` / `HBsAg(TT):` → Reactive=帶原, Non-Reactive=正常). HCV/HBsAg use `_tag` for color coding (warning=帶原, normal=正常). HCV/HBsAg show only the single most-recent result (not 3 timepoints) and are not limited to the 1-year lab window. Display format combines qualitative + numeric: "正常 (HBsAg 0.24)" / "帶原 (Anti-HCV 1.92)". Non-standard qualitative text (not Reactive/Non-Reactive) shown as-is.
- **HIV報表 checkbox**: When checked, adds an HIV section to page 2, col 3 with: HIV virus load (3 timepoints, pattern `HIV virus load:`), CD4 (3 timepoints, pattern `LEU3AN:`), RPR (singleValue, all-time, computed: qualitative `REACT:` + titer `OTHER:`), TPHA (singleValue, all-time, computed: qualitative+numeric from `TPHA(TT)` lines). TEST_MAP entries with `hivOnly:true` are excluded from report unless the checkbox is checked. RPR/TPHA/HIV/CD4 orders are included in all-time filter alongside hepatitis.
- **Gender filtering**: TEST_MAP entries with `gender:'M'` or `gender:'F'` are shown only for matching patients.

### Build

- **Pattern updates**: Edit `../hospital-lab-patterns/patterns/viewer.js` → `git commit && git push` → `cd hospital-lab-viewer && node sync-patterns.js` → reload extension at `chrome://extensions`. See [`../hospital-lab-patterns/docs/learning-workflow.md`](https://github.com/Yuchunchen/hospital-lab-patterns/blob/main/docs/learning-workflow.md) for the Claude-driven pattern-learning recipe.
- **Auto-zip**: After every code change, repackage the extension into `hospital-lab-viewer.zip` in the **parent folder** (`D:\self\Dropbox\1.Project.YuLi\20251005.lab_report\`). Include only the extension files: `manifest.json`, `popup.html`, `popup.js`, `report.js`, `report-viewer.html`, `report-viewer.js`, `mapping.js`, `patterns-computed.js`, `options.html`, `options.js`, `icon16.png`, `icon48.png`, `icon128.png`, `CLAUDE.md`. Exclude `sync-patterns.js`, `.tmp.*` files, and the zip itself.

---

## 工作協定（給 Claude — Cowork 與 Code 模式皆適用）

`mapping.js`、`normalizers.js`、`patterns-computed.js` 都是 **由
sync-patterns.js 自動產生** — 不要手改。

### 每次修改後必做（順序不可顛倒）

1. **若需要新的 pattern 或修改既有 pattern**：先到 `hospital-lab-patterns`
   修改、跑 validate、push 到 GitHub，再回到本 repo。**不要**直接改
   `mapping.js` —— 那只是一份從 patterns repo 來的快照。
2. **重新打包**：`node sync-patterns.js`（會把 sibling repo 的 catalog +
   viewer manifest + normalizers + resolver bundle 進 `mapping.js`）。
3. **手動測**：載入未封裝擴充功能 → 開一筆已知病人的 lab 頁 → popup →
   確認頂部 freshness badge（✓ 表示 fresh / 📦 cached / ⚠ stale）。
4. **更新 WORKLOG.md**：在最頂端新增條目，**繁體中文**。格式見下方。
5. **提示提交**：

   > 變更已完成,sync 已重跑、popup 開啟測過。
   > 建議 commit message：`<scope>: <一句話說明>`
   > 要我現在 git add + commit + push 嗎？

不要自動 push。

### WORKLOG.md 條目範本（繁體中文）

```markdown
## YYYY-MM-DD — 一句話摘要

- 作者：claude（與 YC 共同）
- 範圍：<popup | report | options | pattern-loader | sync-script | manifest>
- 變更：<新增 | 修改 | 移除>
- 檔案：<相對路徑,例如 popup.js>
- 原因：<為什麼這麼做>
- 測試：<開哪一筆 chartNo / 哪個院區（vhtt / vhyl）/ 看到什麼結果>
- 相依：<是否需要 hospital-lab-patterns 先發版？>
```

日期取得：

- PowerShell：`Get-Date -Format yyyy-MM-dd`
- bash：`date +%Y-%m-%d`

### 不要做的事

- 不要手改 `mapping.js`、`normalizers.js`、`patterns-computed.js`
  （皆由 sync 產生）
- 不要自動 `git push`
- 不要刪除 WORKLOG.md 既有條目
- 不要打包 `node_modules/` 或 `examples/`（皆已 gitignore）
- 不要把真實病人 HTML / JSON / 圖片 commit 進去
- 不要動 `manifest.json` 的 `host_permissions`（已是 `https://*/*`），
  除非真的有跨網域 fetch 需要

### 病人資料安全

- `examples/` 與 `*.real.*` 已 gitignore，不要解除
- 任何 commit 前若不確定有沒有夾帶真實資料,先
  `git diff --stat | grep -E "real|examples|chartno"`
- 院區字串（vhtt / vhyl）OK；個案 chartNo 不可 commit