# WORKLOG

## 2026-06-17 — Page 2 layout 收斂 + 拔 reminder + sync patterns

- 作者:claude(與 YC 共同,Claude Code workspace root 跨 repo)
- 範圍:report + sync-script bundle(mapping)
- 變更:修改
- 對應 brief:`hospital-lab-patterns/docs/task-briefs/TASK_BRIEF_viewer_wbc_dc_section_done.md`(brief Open #3 延伸)
- 檔案:
  - `report.js`:
    - `buildPage2Column` filter 從 `(t.kind === 'text' || !t.col || t.col <= 2)` 收緊為 `t.kind === 'text'` — 只 lump 文字報告,DC col:2(非 text-kind)不會被誤拉進左欄
    - page 2 render path 改:`hivCol` / `dcCol` 兩個變數合併為單一 `page2Col2 = buildColumn(2, 2, ...)`,grid col 2 一口氣 render DC + HIV(HIV 上游 genderFilteredTests 已依 checkbox 過濾 hivOnly,所以 checkbox 關時 col 2 只有 DC)
    - page 2 grid col 3 / 4 改寫死空 `<div class="report-col"></div>`
    - 拔掉 `reminderHtml = buildReminderBox(findUnshownOrders(...))` 計算 + page 1 / page 2 兩處 render 點 — reminder box 不再顯示。`findUnshownOrders` / `buildReminderBox` 函式定義保留(無 cost,未來要回來再接)
  - `mapping.js`:`node sync-patterns.js` 重產出,viewer manifest 含 BoneDensity/Endoscopy/AbdSono col:1、DC + HIV col:2 新 layout
  - `normalizers.js`、`patterns-computed.js`:line-ending 重寫
- 原因:YC 真機驗收期間決定 page 2 收斂到 2 個 grid col(左 = 三個文字報告,右 = DC + HIV stacked),并拿掉 reminder box(page 1 + page 2 都不要)。viewer manifest + report.js 一輪對齊。
- 設計選擇:
  - manifest 是 source of truth,col 改了 report.js render path 也要同步,不靠 hardcode layout 維持
  - reminder 拔掉但不刪 findUnshownOrders/buildReminderBox 函式(surgical principle:刪可逆,留無害)
  - 不動 page 1 layout / A5 / WBC
- 測試:
  - node smoke:用同步後的 mapping.js manifest 跑 filter 邏輯 — grid col 1 lump=`[BoneDensity,Endoscopy,AbdSono]`、grid col 2 (HIV-on)=`[Neut,Lymph,Mono,Eos,Baso,HIVLoad,CD4,RPR,TPHA]`、grid col 2 (HIV-off)=只剩 DC 5 條、DC 不會誤入左 lump、page 1 col 3 血液 ids 不變、WBC override hi=10 lo=5 不變 ✓
  - 真機:reload extension + popup 點 freshness 強刷(patterns dist 換了)→ 印 000037249G → page 1 沒 reminder,page 2 左 3 個文字 section / 右 DC 5 條(HIV 看 checkbox)留待 YC 真機確認
- 相依:hospital-lab-patterns 同輪 commit + push
- 影響:HIV checkbox 行為不變;reminder 完全消失(可逆,findUnshownOrders 還在);A5 不受影響

## 2026-06-17 — report.js page 2 render:補 AbdSono + 新 grid col 4 給 DC

- 作者:claude(與 YC 共同,Claude Code workspace root 跨 repo)
- 範圍:report
- 變更:修改(viewer-only,patterns 無動)
- 對應 brief:`../hospital-lab-patterns/docs/task-briefs/TASK_BRIEF_viewer_wbc_dc_section_done.md`(brief Open #3 收尾延伸)
- 檔案:
  - `report.js`:
    - `buildPage2Column` filter 從 `(!t.col || t.col <= 2)` 改 `(t.kind === 'text' || !t.col || t.col <= 2)` — 把 AbdSono(col:3 text-kind)拉進左邊 lump,跟 BoneDensity/Endoscopy 一起 stack
    - `hivCol` 加 `tests.filter(t => t.kind !== 'text')` — 防 AbdSono(col:3 text-kind)在 hivCol(buildColumn(2,3))跟左 lump 重複 render
    - 新增 `dcCol = buildColumn(2, 4, ...)` — 讓 grid col 4 真的渲染 manifest 上 page:2 col:4 的 entry(DC 5 條),取代原本寫死的 `<div class="report-col"></div>`
- 原因:6/17 真機測,第 2 頁只看到 BoneDensity + Endoscopy,**AbdSono 跟新 DC section 都沒出現**。查 report.js 發現 page 2 render path 是寫死的 layout:左 lump 只收 col<=2、中間 reminder、col 3 只接 HIV(checkbox)、col 4 寫死空。AbdSono col:3 早就是 pre-existing bug(只有 HIV checkbox 打開才順帶被撈出),DC col:4 是這次新增。一次修
- 設計選擇:
  - 不動 viewer manifest(AbdSono 仍 col:3 / DC 仍 col:4),只動 render path — manifest 是 source of truth,行為靠 report.js 對齊
  - AbdSono 視覺上跟 BoneDensity/Endoscopy 都是 text-kind,放一起合理(都是文字 + 勾選格);DC 是數值,獨立 col 4
  - 不擴張到 page 1 / A5(都沒這個問題)
- 測試:
  - node smoke:解析 viewer manifest 跑新 filter — grid col 1 lump=`[BoneDensity, Endoscopy, AbdSono]`、grid col 3 HIV-on=`[HIVLoad,CD4,RPR,TPHA]`、grid col 4 DC=`[Neut,Lymph,Mono,Eos,Baso]`、AbdSono 不重複命中 ✓
  - 真機:reload extension(無需點 freshness,patterns 沒動;但若你想保險點再 ↻ 也行)→ 印 000037249G → 第 2 頁應該看到 BoneDensity / Endoscopy / AbdSono 在左,中間 reminder,(HIV 看你開不開),最右 DC 5 條
- 相依:無(patterns 沒動,reporter 不受影響)
- 影響:HIV 行為不變(checkbox 開:render HIVLoad/CD4/RPR/TPHA;關:col 3 空);AbdSono 從現在起會固定 render(不再仰賴 HIV checkbox 偶然帶出);DC 在右

## 2026-06-17 — sync patterns:DC section 從 page 1 col 3 移到 page 2 col 4

- 作者:claude(與 YC 共同,Claude Code workspace root 跨 repo)
- 範圍:sync-script bundle(mapping)
- 變更:修改(auto-generated)
- 對應 brief:`hospital-lab-patterns/docs/task-briefs/TASK_BRIEF_viewer_wbc_dc_section_done.md`(brief Open #3)
- 檔案:
  - `mapping.js`:`node sync-patterns.js` 重產出,5 條 DC manifest entry 的 page/col 從 `(1,3)` 改 `(2,4)`,section name 不變
  - `normalizers.js`、`patterns-computed.js`:line-ending 重寫
- 原因:6/16 第一輪 land 後 YC 真機測,page 1 col 3 已被「血液」+ 「營養／電解質」塞滿,DC 5 行擠版。Brief Open #3 預警過,本輪修。Page 2 col 4 原本空,搬過去整列獨立顯示。
- 測試:`node sync-patterns.js` 成功;reload extension + popup 點 freshness 強刷 → DC section 應該出現在 page 2 col 4 留待 YC 真機確認
- 相依:hospital-lab-patterns 同輪 commit + push
- 影響:WBC 維持 page 1 col 3「血液」(hi:10/lo:5);A5 manifest 不含 DC,不受影響

## 2026-06-16 — sync patterns:新增 DC 五分類 + viewer「白血球分類 (DC)」section

- 作者:claude(與 YC 共同,Claude Code workspace root 跨 repo)
- 範圍:sync-script bundle(mapping)
- 變更:修改(auto-generated)
- 對應 brief:`hospital-lab-patterns/docs/task-briefs/TASK_BRIEF_viewer_wbc_dc_section.md`
- 檔案:
  - `mapping.js`:`node sync-patterns.js` 重產出 — 含 5 條新 DC catalog pattern(Neut/Lymph/Mono/Eos/Baso)+ 新 viewer section「白血球分類 (DC)」5 條 manifest entry。WBC 在「血液」section 不動,hi:10/lo:5 viewer override 不變。
  - `normalizers.js`、`patterns-computed.js`:line-ending 重寫,內容相同
- 原因:patterns repo 加 DC 五分類% catalog + viewer 新 section(YC 指定 display-only,無 hi/lo/refHistory),viewer mapping 需重 bundle 才會跟到。OPD handout col 3「血液」下方新增「白血球分類 (DC)」section 顯示 5 DC% — WBC 維持原位顯示。
- 測試:`node sync-patterns.js` 成功;`mapping.js` 含 5 條 DC pattern + 新 section block(grep 確認)。真機 reload extension + 開 vhyl `000037249G` 確認 DC% 在新 section 顯示中性色、console 無 error 留待 YC 在 vhyl 機器上跑(brief T7 / T8 手動部分)
- 相依:hospital-lab-patterns 同輪 commit + push(catalog.js + viewer.js + dist/patterns.json)
- 影響:OPD popup 24h 內透過 `dist/patterns.json` 自動拿到(本地 reload extension 可立即生效;6h orders cache 要點 freshness ↻ 強刷才會用新 regex 重 parse);A5 manifest 不含 DC,A5 版面不變

## 2026-06-04 — sync patterns:Platelet regex 加 PLATE alternation

- 作者:claude(與 YC 共同,Claude Code workspace root 跨 repo)
- 範圍:sync-script bundle(mapping)
- 變更:修改(auto-generated)
- 對應 brief:`hospital-lab-patterns/docs/task-briefs/TASK_BRIEF_platelet_PLATE_alternation_done.md`
- 檔案:
  - `mapping.js`、`normalizers.js`、`patterns-computed.js`:`node sync-patterns.js` 重產出(實際只有 mapping.js Platelet pattern 一行差異;normalizers / patterns-computed 為 line-ending 重寫,內容相同)
- 原因:patterns repo 修 catalog Platelet regex 加 PLATE alternation(`/Platelet:/` → `/(?:Platelet|PLATE):/`),viewer mapping 需重 bundle 才會跟到。修因:ernode CBC 套餐 reportText 印 `PLATE:` 而非 `Platelet:`,舊 regex 漏抓 — vhtt `000030794I` 5/20 CBC 套餐的 Platelet 89 看不到
- 測試:`node sync-patterns.js` 成功;`git diff mapping.js | grep Platelet` 確認 alternation 已進 mapping。真機 reload extension + 開 vhtt `000030794I` 確認 Platelet row 兩筆(89 紅色 + 158)留待 YC 在 vhtt 機器上跑(brief T5)
- 相依:hospital-lab-patterns 同輪 commit + push(catalog.js + dist/patterns.json)
- 影響:OPD popup 24h 內透過 `dist/patterns.json` 自動拿到(本地 reload extension 可立即生效;6h orders cache 要點 freshness ↻ 強刷才會用新 regex 重 parse)

## 2026-05-28 — sync patterns:13 條 vhtt refHistory override(cross-ref 12 chart batch)

- 作者:claude(與 YC 共同,Claude Code workspace root 跨 repo)
- 範圍:sync-script bundle(mapping / normalizers / patterns-computed)
- 變更:修改(auto-generated)
- 對應 brief:`hospital-lab-patterns/docs/task-briefs/TASK_BRIEF_vhtt_refHistory_batch_13_done.md`
- 檔案:
  - `mapping.js`、`normalizers.js`、`patterns-computed.js`:`node sync-patterns.js` 重產出
- 原因:patterns repo 加 13 條 vhtt refHistory override(Hb / Platelet / BUN / CREAT / GOT / GPT / ALP / UA / GluAC / HbA1c / LDL / Fe / AFP),viewer mapping 需重 bundle
- 測試:`node sync-patterns.js` 成功;viewer mapping resolver 含 13 條新 override(catalog 88 → 仍 88,只增 refHistory 末筆);真機 reload extension + 開 vhtt patient 驗證留待 YC 在 vhtt 機器跑(brief §5 success #5 屬 ref_range_followups memory pending 項)
- 相依:hospital-lab-patterns 已 push(commit `5bcd638`)
- 影響:OPD popup 24h 內透過 `dist/patterns.json` 自動拿到(本地 reload extension 可立即生效)

- 作者:claude(與 YC 共同,Claude Code workspace root 跨 repo)
- 範圍:viewer lab-core / report / dashboard / popup / options / sync-script / manifest-bundle
- 變更:新增 / 修改
- 對應 brief:`hospital-lab-patterns/docs/task-briefs/TASK_BRIEF_ref_range_machine_time_dim.md`(Order 5.0)
- 檔案:
  - `lab-core.js`:新增 `CURRENT_MACHINE` cache + `loadMachineSource()` / `getMachineSource()`(sync)/ `setMachineSource()`,讀寫 `chrome.storage.local.currentMachine`
  - `report.js`:`valueStyle()` 加 `reportDate` 參數,hi/lo 改經 `resolveRef(test.id, getMachineSource(), reportDate, gender'男/女'→'M/F', window.TEST_MAP)`;兩個呼叫點傳 `c.date` / `entry.date`;保留 resolveRef 不可用時 legacy 性別 fallback
  - `dashboard.js`:`renderLabCell` hi/lo 改經 `resolveRef`(gender 中性 null、傳 `entry.date`);bootstrap 加 `await loadMachineSource()`
  - `popup.js`:bootstrap 加 `await loadMachineSource()` + 無值時 `showMachineFirstRun()`(兩段式 pick→confirm,§11.5 防誤選)
  - `popup.html`:加 machine-modal 容器 + CSS
  - `options.html` / `options.js`:加「本機院區」下拉,讀寫 `chrome.storage.local.currentMachine`(供日後更改)
  - `sync-patterns.js`:mapping.js 多 bundle `lib/resolveRef.js`(CODE,不走 dist/patterns.json)
  - `mapping.js`(自動產生):重 sync,含 51 條 refHistory 資料 + resolveRef
- 測試:`node sync-patterns.js` 重產;node 模擬 window 載入 mapping.js 對 TEST_MAP 呼叫 resolveRef:WBC vhtt `{4,11}`、GOT `{null,34}`、BUN `{null,25.7}`(零 regression)、RBC M `{4.2,6.2}` / F `{3.7,5.5}`(性別)、ROC `115/04/14` + machine 未設 → universal fallback OK
- 設計:machine 未設時 resolveRef 只 match `'*'` → 回 universal base(seed 自 lo/hi)= **零 regression**,first-run 只為讀 vhyl override。base seed 自 `lo/hi` 非 refLo/refHi(YC 2026-05-28 拍板)
- 相依:需 `hospital-lab-patterns` 先發版(catalog refHistory + lib/resolveRef.js + schema)。schema 屬破壞性改動,**push 前先問**(規則 #3)
- 尚未做:reporter 端 wiring;真機驗證(T18/T19 + 整合 A+B);hospital-lab-viewer.zip 重打包(deploy 時)

## 2026-05-25 — DM Dashboard:加 UPCR 欄 + 欄序重排(18 欄)

- 作者:claude(與 YC 共同,在 vhyl Cowork 動手)
- 範圍:viewer dashboard(html + js;無 lab-core / popup / cxr 變動)
- 變更:新增 / 修改
- 檔案:
  - `dashboard.html`:thead 18 個 `<th data-key>` 依新順序重排;empty row colspan 17→18
  - `dashboard.js`:
    - `screenPatient` line 175 加 `const upcr = extractLatestLabValue(lab, catById('UPCR'));`
    - line 201 加 `const upcrVal = upcr ? parseFloat(upcr.value) : null;`
    - line 204 TaiwanCKD 從 `UPCR: null` 改 `UPCR: upcrVal`(**順手修 pre-existing bug**:Dashboard 原本 UPCR 永遠 null,UPCR-only 病人 staging 算不出來)
    - line 218 row result `values: { sugar, hba1c, creat, uacr, upcr, egfr }` 加 upcr
    - `compareForSort` 加 `case 'upcr'` 數值排序
    - error row colspan 16→17(總欄數 17→18,error 跳過 col-chartno 一欄)
    - `renderTable` row HTML 18 個 `<td>` 依新順序輸出,新增 `${upcrCell}` 在 UACR 之後
    - `exportCsv` header 20 欄 + row 20 cells 依新順序,新增 `'UPCR'` 在 `'UACR'` 之後(CSV 含 性別/年齡 各一欄,故 CSV 比畫面多 2)
- 新欄序(畫面 18 欄):chartno / 姓名 / 最近抽血 / Sugar / HbA1c / EKG / ABI / PVR / 眼底鏡 / UACR / **UPCR** / eGFR / DM衛教 / DM天數 / Early CKD / GFR分期 / Pre-ESRD / ⚡動作
- 動機:`TASK_BRIEF_dm_dashboard_upcr_and_reorder.md`。Dashboard 原本只有 UACR(尿微量白蛋白),臨床上 UPCR(尿蛋白肌酐比)也是 KDIGO A 軸並列指標 — 有些病人只做過 UPCR 沒做 UACR,Dashboard 看不到等於少資訊。欄序重排把同質指標放一起(實驗值 → 影像/檢查 → 蛋白尿系列 → 計算分期 → DM 衛教 → 動作),臨床瀏覽動線更順。
- 跨 repo 副作用:無 — UPCR catalog entry 已於 2026-05-08 加入(`T.PROT/CREAT` alternation);純 viewer own-code 改動,**不需 sync-patterns**。
- 測試:見 brief § 4。`node --check dashboard.js` 通過;grep 確認 18 個 `<th>` 順序對、`UPCR: upcrVal`(非 null)、colspan 17/18、CSV header 含 UPCR;實機 vhyl 16 位 DM 病人重 fetch 待驗收。
- 相依:無;單 commit 在本 repo 即可。**本 commit 在 510782a(同日 ABI/Fundus sync)之上,不覆寫 catalog 修正**。

## 2026-05-25 — sync 拉新 catalog(ABI / Fundus 加 vhyl alternation)

- 作者:claude(與 YC 共同,在 vhyl Cowork 動手)
- 範圍:sync-script(純 sync,無 viewer own-code 改動)
- 變更:自動產生
- 檔案:`mapping.js`(由 `node sync-patterns.js` 重產);`normalizers.js` / `patterns-computed.js` 也重產但內容未變
- 原因:sibling `hospital-lab-patterns` 同日為 vhyl Dashboard ABI / Fundus silent miss 修正擴 alternation。viewer Dashboard 端 EKG/ABI/PVR/Fundus 從 `window.HOSPITAL_LAB_PATTERNS_CATALOG` 直接取,sync 拉新版進 mapping.js 後即吃到新 regex。
- viewer 影響:Dashboard 對 vhyl 病人 ABI / Fundus 正確 match;vhtt 既有行為不變(`Doppling ex.` / `Fundoscopy` alternation 都還在)。
- 測試:vhyl 16 位 DM 病人 Chrome extension reload + popup → Dashboard 重 fetch,ABI / Fundus 兩欄都補上日期(YC 在 vhyl Cowork 2026-05-25 實機驗收 PASS)。
- 相依:patterns repo 同日 commit。

## 2026-05-22 — popup imaging report 套 cleaning（共用 cxr.js 既有邏輯）

- 作者：claude（與 YC 共同）
- 範圍：popup + cxr + lab-core
- 變更：新增（lab-core 共用 function）/ 修改（popup wire-up）/ 移除（cxr 重複邏輯）
- 檔案：
  - `lab-core.js`：新增共用 `cleanImagingReport(rawText)` + helper（`stripImagingHeaderLines` / `cleanImagingReportText` / `IMAGING_HEADER_LABELS`），三層 cleaning：①「報告內容：」分隔線主路徑取 free text ②無分隔線時逐行 strip 已知表頭欄位行（BMD/CAC 格式備援）③通用清理（box 字元 / LDCT 協議括號段 / 檢查項目碼行 / ernode 稽核表單 / 空行收斂）。從 cxr.js 逐字抽出，行為一致。
  - `cxr.js`：移除自有 `CXR_HEADER_LABELS` / `cxrStripHeaderLines` / `cxrCleanReportText` / `cxrExtractReportText`，`cxrFetchPatient` 改 call lab-core 的 `cleanImagingReport(subpageText)`。同一份邏輯，cxr.html 健檢視窗行為不變。
  - `popup.js`：`renderSection` 對 imaging row（`isRad`）在 render 層過 `cleanImagingReport(o.reportText)` 再丟 `makeExpandableCell`；lab row 不套（檢驗結果格式套 imaging cleaning 會破壞）。只 touch render path，不改 `parseOrdersPage` cell 抓法、不污染 data layer。
- 原因：`TASK_BRIEF_imaging_report_cleaning_share`。master orders page 對 imaging row 把整份子頁面（letterhead + 表頭 + body）concat 進 `cells[2].textContent`，popup 直接 truncate 前 80 字 → 使用者只看到 letterhead，看不到 finding/impression（vhtt 000034324I LDCT 回報）。fix 是對既抓到的 `reportText` 套 cleaning 留 body —— 不 fetch 子頁面（點「正式報告」navigate 過去反而只有空殼）。
- 測試：`node --check` 三檔皆 OK（無 const 重複宣告 SyntaxError）；vm-load 真實 lab-core.js 的 node harness 17/17 PASS — 000034324I LDCT 主路徑輸出含「A 6mm subpleural nodule over RUL」「Mild fibrotic change over LLL」、letterhead/表頭/檢查項目碼/協議括號/box/敬告/列印日期全 strip；BMD 備援路徑（無「報告內容：」）逐行 strip 表頭；稽核表單 layer；空值/null 邊界。⏳ 待 YC 實機（vhtt 院內網 + OPSID）：000034324I / 000058895E popup LDCT/CAC/Bone density row 展開看完整 finding、cxr.html 健檢視窗 LDCT 翻譯前後對照無 regression、lab orders（如 80885F）顯示不受影響。
- 相依：純 viewer，不動 patterns catalog / computed / manifest，**不需 sync-patterns**；IndexedDB schema 不變（`DB_VER 6` 不動）。auto-zip 略過（CLAUDE.md 指定的 Dropbox 路徑在 vhtt 不存在，reload 本地 unpacked source 即可）。

## 2026-05-22 — CKD/DM 篩檢 Dashboard S3：四欄資格並排 + CSV + 批次列印（read-only 收尾）

- 作者：claude（與 YC 共同）
- 範圍：dashboard（html + js）
- 變更：修改 / 移除 / 新增
- 檔案：
  - `dashboard.html`：
    - 表頭四欄並排重排（取代 S2 既有單欄 Early-CKD / Pre-ESRD）：`… | GFR分期 | DM 衛教內容 | DM 天數 | Early CKD | Pre-ESRD | ⚡動作`（DM 衛教內容欄從中段移下、新增 DM 天數欄；16→17 欄，colspan 同步 17）。
    - DM 衛教內容欄 CSS 拆掉 S2 的 truncate + title tooltip（`.dm-line` 由 nowrap/ellipsis 改 `white-space:normal` 自動換行，表格內直接完整顯示兩行）；新增 `.dm-days-warn/.dm-days-bad/.dm-days-empty`（DM 天數 >180 橘字 / >365 紅字 / 無內容灰底）、`.elig-yes/.elig-no`（✅/❌）；移除只服務 renderStagingTag 的 `.tag-early/.tag-pre/.tag-none` 與 `.row-action.enrolled`。
    - input-panel 移除「批次加入」、新增「🖨️ 全部列印」+「📄 匯出 CSV」；header 移除「📋 個案名單」（registry 不接 UI）。
    - 新增 `.print-head` + `@media print`（A4 橫印、隱藏 UI 與動作欄、DM 衛教完整展開），沿用 cxr.html 範式。
  - `dashboard.js`：
    - `extractDMEducation` 改為往前最多看 5 筆 DM EDUCATION、跳過子頁面 regex 抓不到內容（此次問題/衛教項目皆空）者、取最近 2 筆有內容的（5 筆都沒內容也停）。
    - `renderDmCell` 改完整顯示無 tooltip；新增 `renderDmDaysCell`（與衛教欄連動，最近一筆有內容紀錄 order date 至今天數）、`renderEligibilityCell`（✅/❌）；移除 `renderStagingTag`。
    - `renderTable` 依新欄序渲染、動作欄加 `action-col` class（列印隱藏）；`compareForSort` 加 `dmDays`。
    - 新增 `exportCsv`/`csvField`/`csvExam`/`downloadCsv`（UTF-8 BOM、日期民國格式、未執行標「已開未做」、四新欄入欄）、`printDashboard`/`getVisibleRows`/`todayISO`（列印篩選後可見列）。
    - read-only：移除 registry 寫入/讀取 UI glue（`enrollPatient`/`batchEnroll`/`refreshRegistrySet`/`loadFromRegistry` + 對應按鈕監聽 + `state.registry` + 列「加入」delegation 分支）。**registry object store 與 `registryPut/Get/List/Remove` 仍保留於 `lab-core.js`（保留但不接 UI），跨 repo 共享 DB 路線拍板後再啟用（brief § Follow-up #1）**。
- 原因：`TASK_BRIEF_ckd_screening_dashboard` S3（2026-05-22 重寫，read-only 篩檢）。四欄資格一目了然、DM 衛教螢幕即完整可讀、產出 CSV / 批次列印供門診清單使用。
- 測試：`node --check dashboard.js` 通過；vm-load node harness 26/26 PASS（csvField escaping、csvExam「已開未做」、renderDmDaysCell 180/365 門檻、renderDmCell 無 tooltip 完整顯示、✅/❌、extractDMEducation 跳過無內容取最近 2 筆 + 全無內容→空）。⏳ 待 YC 實機（vhtt / 院內網 + OPSID）：批次列印 A4 橫印預覽、Tab 1 dialysis 報告 regression、S2 候診/手動/batch/排序篩選 regression。
- 相依：純 viewer，不動 patterns catalog / computed / manifest，**不需 sync-patterns**；registry DB schema 不變（lab-core `DB_VER 6` 不動）。auto-zip 略過（CLAUDE.md 指定的 Dropbox 路徑在 vhtt 不存在，reload 本地 unpacked source 即可）。

## 2026-05-21 — 健檢 CXR：摘要欄不 truncate（拿掉螢幕上 2 行 clip）

- 作者：claude（與 YC 共同）
- 範圍：cxr（html）
- 變更：修改 CSS
- 檔案：
  - `cxr.html`：
    - `.clip2` 螢幕規則簡化為 `line-height: 1.4;`（拿掉 `display:-webkit-box / -webkit-line-clamp:2 / -webkit-box-orient:vertical / overflow:hidden`），摘要不再 2 行截斷。
    - `@media print` 內 `.clip2` override 因螢幕已 unclipped 而失去必要性，移除該行。
    - comment 對齊新行為。
- 原因：YC 反饋「摘要不要 truncate」 — 螢幕表格摘要欄應完整顯示與列印一致；2 行 clip 隱藏異常細節，臨床判讀不便。
- 測試：純 CSS 改動，node 端無 lint；vhtt 實機 reload extension 後肉眼確認 (a) 螢幕摘要完整顯示，row 高度依摘要長度自適應 (b) 列印預覽行為不變（本來就完整）。
- 相依：純 viewer，不動 patterns / reporter；不需 sync-patterns；class name `.clip2` 保留以維持 cxr.js 引用相容。

## 2026-05-21 — 健檢 CXR S2/S3 polish（Mode B + retry + 異常排序 + cache 行為）

- 作者：claude（與 YC 共同）
- 範圍：cxr（js）+ llm-translate（js）
- 變更：修改
- 檔案：
  - `cxr.js`：
    - `cxrRunFromText` 第二階段加 Mode A/B 分流（G1）：Mode A（provider≠mock 且有 API Key）維持自動 batch translate；Mode B（mock 或 Key 空）跳過翻譯、pending row 標 `skipped`（摘要欄留白「—」而非「翻譯中…」），顯示提示 status 後 `return`（避免被下方「完成」status 蓋掉）。
    - `cxrSummaryCell` pending 分支：`skipped` → 留白「—」。
    - `cxrCompare` 加 `'abnormal'` sort key（G4）：status 浮頂 abnormal=0 > normal/pending=1 > noReport=2 > error=3，同 status 內 tie-break 按病歷號 + 檢查類型序；`cxrState.sortKey` 預設 `'group'` → `'abnormal'`（進畫面異常浮頂）。
    - `cxrTranslateRow` catch 改記 `kind`（友善訊息已在 `e.message`）。
    - cache evict 策略 comment（G3）：cxrTranslations key=ordapno，切 provider/model 不重用但 `cxrTxPut` 以 ordapno overwrite，自然 cap 1 筆/ordapno，不主動 evict（有意行為，勿加 evict）。store keyPath 經確認已是 `ordapno`，故 lab-core.js / DB_VER 不動。
  - `llm-translate.js`（G2）：
    - 加 `CxrLlmError`（kind: AUTH/RATE/SERVER/CLIENT/NETWORK）+ `cxrFetchWithRetry`（401/403 不 retry；429 retry 2 次 500ms→2000ms；5xx / network retry 1 次；其他 4xx 不 retry），回傳友善中文訊息取代原 raw `Gemini HTTP {status}: {body}`。
    - `cxrGemini` / `cxrClaude` / `cxrOpenai` 的 `fetch` 換成 `cxrFetchWithRetry`，移除各自 `if (!resp.ok) throw`。
- 原因：G1 避免 mock / 無 Key 時自動 batch 造成困惑、UX 對齊 PHI 不外流；G2 transient 5xx/429 不再永久變 error row、錯誤訊息友善化；G3 文件化既有 cache 行為（避免日後誤加 evict）；G4 異常個案一眼可辨（parent brief S3 成功標準）。
- 測試：`node --check cxr.js` / `llm-translate.js` 皆通過；`cxrFetchWithRetry` node harness 8/8 PASS（AUTH/CLIENT 無 retry、RATE 2 次、SERVER/NETWORK 1 次、retry 後成功）。實機 happy-path（vhtt 50 筆 Gemini batch / 列印）待 YC 跑。
- 相依：純 viewer，不動 patterns / reporter（無 catalog/computed/manifest 改），不需 sync-patterns；parent brief `health_check_cxr` 仍 Open。

## 2026-05-21 — 健檢報告：清理病歷稽核表單 + 空行收斂加嚴

- 作者：claude（與 YC 共同）
- 範圍：cxr（js）
- 變更：修改
- 檔案：
  - `cxr.js` `cxrCleanReportText()`：
    - 新增 (e) 病歷稽核表單清理 — ernode 子頁面常夾帶病歷存取紀錄選項（名稱 / 病人詢問病情 / 病歷稽核 / 病歷審查 / 司法查案 / 保險公司查詢 / 系統稽核 / 病患申請 / 健保需求 / 教學研究 / 病歷複製 / 公文回覆 / 用藥申請 / 查詢原因 / 本科臨床處置決策 / 他科醫師會診 / 其他…），非報告內容，用 `^\s*(關鍵字|其他…)\s*$` 多行 regex 整行刪除。
    - 新增 (f) 只含空白字元的行（spaces/tabs）刪除 `/^\s+$/gm`。
    - (d) 空行收斂從 `\n{3,}→\n\n` 改為 `\n{2,}→\n`（稽核表單刪除後留下大量空行，直接壓成無空行）。
- 原因：子頁面除免責聲明外，還夾帶「病歷稽核」存取紀錄表單選項，送 LLM 翻譯會干擾摘要；刪除後行間空白需一併收斂。
- 測試：`node --check cxr.js` 通過；eval-load node 實測：findings 之間夾雜稽核關鍵字 + 「其他：研究用途」+ 純空白行 → 清理後只留 3 行 findings。
- 相依：純 viewer，不需 patterns / reporter sync。

## 2026-05-21 — 健檢報告：清理免責聲明 + 原始內容完整顯示

- 作者：claude（與 YC 共同）
- 範圍：cxr（html + js）
- 變更：修改
- 檔案：
  - `cxr.js`：
    - 新增 `cxrCleanReportText()`,於 `cxrExtractReportText` extraction 後套用：(a) 刪免責聲明 box（box-drawing 字元行 / 含「敬告」/ 含「請病患妥為保管」）；(b) 刪 LDCT 協議說明整段括號 `(The low dose protocol … evaluation.)`；(c) 刪檢查項目碼行 `檢查項目：\d+ …`；(d) 連續 3+ 空行收斂為 1。送 LLM 前去雜訊。
    - `cxrRawCell` 改為 `<div class="raw-full">` 完整顯示（移除 clip2 truncate + title tooltip）。
  - `cxr.html`：`.raw-cell .raw-full` 用 `white-space:pre-wrap; word-break:break-word` 完整呈現換行；移除原始內容欄的 clip2 行截斷。摘要欄 clip2+tooltip 維持不變。
- 原因：子頁面報告含免責聲明 box / LDCT 協議說明 / 檢查項目碼行等非臨床雜訊,送翻譯浪費 token 又干擾摘要；原始內容欄需求改為完整可讀（醫師核對用）。
- 測試：`node --check cxr.js` 通過；eval-load node 實測：CXR 含 box → 留 2 行 findings；LDCT 含協議段+檢查項目行 → 留 2 行 findings；unit test 四類雜訊全清、空行收斂。
- 相依：純 viewer，不需 patterns / reporter sync。

## 2026-05-21 — 健檢報告擴充：CXR → 四類影像（CXR/BMD/CAC/LDCT）+ 新欄位

- 作者：claude（與 YC 共同）
- 範圍：cxr（html + js）
- 變更：修改
- 檔案：
  - `cxr.js`：
    - `CXR_EXAM_TYPES`（CXR/BMD/CAC/LDCT + 排序序）+ `cxrExamOrder()`。
    - `cxrFetchPatient` 改為每人對 4 種 pattern 各取最近一筆 order → 回傳 rows[]（每種一列，最多 4 列；沒有就不出該列；四種全無 → 一列佔位 status=noReport，避免病人靜默消失）。`cxrFetchSubpage()` 抽出（快取優先）。
    - `cxrExtractReportText` 強化：主路徑取「報告內容：」之後；備援 `cxrStripHeaderLines()` 逐行去掉索引號/姓名/性別/科別/判讀醫師/簽收時間/報告時間/申請序號/檢查項目/IMPRESSION（給 BMD/CAC/LDCT 子頁面格式不同時用）。
    - render 改 6 欄：病歷號（含姓名小字）/ 檢查類型（badge）/ 開單日期（orderDate=生效時間）/ 檢查日期（examDate=簽收時間）/ 原始內容（clip2+tooltip，列印展開）/ 摘要（🔴/✅+clip2，異常紅字，異常項目折入 tooltip + 列印展開 .abn-list）。
    - `cxrCompare` 加 `group`（病歷號→檢查類型序，預設）及各欄排序，tiebreak 維持 group 感。
    - `cxrRenderStats()` 統計列：完成 X 位 · CXR/BMD/CAC/LDCT 各筆數 · 異常 · 無報告。`cxrPrint` 頁首加各類統計。
    - 翻譯仍 per-row（ordapno 為 key）走 IndexedDB cxrTranslations 快取，邏輯不變。
  - `cxr.html`：標題改「健檢報告（CXR/BMD/CAC/LDCT）」；控制列加檢查類型 radio（全部/CXR/BMD/CAC/LDCT），保留只看異常/只看無報告；加 `#cxr-stats` 統計列；thead 改 6 欄；badge / clip2 / abn-list / raw-cell CSS；列印展開 clip2 + 顯示 .abn-list 紅字。
- 原因：`TASK_BRIEF_health_check_cxr` S2 擴充 — 健檢報告從只看 CXR 擴大到四類影像，依賴 patterns 已發版的 BMD/CAC/LDCT pattern（同日 patterns commit 11aebaf）。
- 測試：
  - `node --check cxr.js / llm-translate.js` 通過。
  - eval-load node 實測（shim window/document/chrome）：CXR 子頁面「報告內容：」primary 擷取正確（去表頭 + 去列印日期尾）；BMD 無「報告內容：」走 fallback，10 個表頭欄位全剝除只留 free text；examOrder 0/1/2/3；group 排序＝病歷號→檢查類型序；examDate desc 排序正確。
  - grep 確認無殘留舊 class（summary-clip/findings-cell/col-status 等）。
  - 待手動測（院內網）：BMD/CAC/LDCT 子頁面真實格式、4 種同時 fetch、列印 A4 版面、檢查類型 filter。
- 相依：patterns BMD/CAC/LDCT pattern（commit 11aebaf）；純 viewer，不需 reporter sync。

## 2026-05-21 — UI 重構：popup 統一入口 + 按鈕改名 + Dashboard/CXR 移除輸入區

- 作者：claude（與 YC 共同）
- 範圍：popup / dashboard / cxr（html + js）
- 變更：修改 / 移除
- 檔案：
  - `popup.html`/`popup.js` — 按鈕改名：Search→「報告查詢」、Dashboard→「📊 DM腎病個案管理」、CXR 翻譯→「🩻 健檢報告」。新增 `sendListToWindow()`：DM/健檢按鈕取同一個 textarea 內容 → 存 `chrome.storage.session`（`dashboard_chartlist` / `cxr_chartlist`，value `{text, ts}`，ts 讓相同清單再送也觸發 onChanged）→ 已開視窗則 `chrome.tabs.query` 找到後 `windows.update` focus，否則 `windows.create`。placeholder 更新說明三按鈕。「報告查詢」行為不變。
  - `dashboard.html`/`dashboard.js` — 移除 textarea + 候診清單/手動輸入/開始篩檢；「個案管理名單」改名「📋 個案名單」移到 header（registry 是 popup 拿不到的獨立資料源，保留）；「只看可收案」+「批次加入」保留在精簡控制列。load 時 `chrome.storage.session.get('dashboard_chartlist')` → `screenChartText()`（原 runScreen 改寫、去除 run-btn 依賴）；`storage.onChanged` 監聽 session 變化自動重篩。header「🩻 健檢報告」改成把目前已篩清單帶去 CXR 視窗（避免開到空白）。
  - `cxr.html`/`cxr.js` — 移除 textarea + 候診清單/手動 + 開始翻譯；保留「🖨️ 列印」+「只看異常/只看無報告」。`cxrRun()` 改寫為 `cxrRunFromText(rawText)`；load 讀 `cxr_chartlist` → 自動跑；`storage.onChanged` 自動重翻譯。移除 `cxrLoadFromOpdweb`（無 textarea 後成 dead code）。
  - 兩視窗清掉 textarea#chartno-input / button#run-btn / .action-row 的 dead CSS。
- 原因：把病歷號輸入統一到 popup 一個 textarea，三個按鈕（報告查詢 / DM腎病個案管理 / 健檢報告）吃同一份輸入，獨立視窗只負責呈現，不再各自有輸入區。chrome.storage.session 暫存清單（關 Chrome 即清），重複按按鈕＝更新 storage + focus 已開視窗 + onChanged 自動重抓。
- 測試：
  - `node --check` popup.js / dashboard.js / cxr.js 皆通過。
  - grep 確認：`<textarea>` 只剩 popup.html；dashboard/cxr body 無 textarea；三按鈕文字正確；JS 無殘留 chartno-input / run-btn / loadFromOpdweb / runScreen 參照。
  - 待手動測（需院內網 + OPSID）：popup 送清單 → 新開視窗自動 fetch；視窗已開時再按 → focus + 自動重抓（onChanged）；「📋 個案名單」載入 registry 重篩；dashboard「🩻 健檢報告」帶現有清單到 CXR。
- 相依：純 viewer，不需 patterns / reporter 重 sync。

## 2026-05-21 — 健檢 CXR S2：批次翻譯 pipeline（mock LLM，多後端架構）

- 作者：claude（與 YC 共同）
- 範圍：新增 cxr.html / cxr.js / llm-translate.js；修改 lab-core / popup / dashboard / manifest
- 變更：新增 / 修改
- 檔案：
  - 新增 `cxr.html` — 健檢 CXR 獨立視窗（chrome.windows.create 1200×860）。輸入區（候診清單 chrome.scripting / 手動）、結果表格（病歷號 / 姓名 / CXR日期 / 狀態 / 中文摘要 / 異常項目）、右上齒輪 → LLM 設定 modal、@media print A4 直式（隱藏 UI、摘要不 truncate、異常紅字粗體、頁首統計）。
  - 新增 `cxr.js` — 兩階段 pipeline：①batch fetch（concurrency 3，reuse lab-core loadData）→ catalog `CXR` pattern 找最近一筆 CXR order → 子頁面 OpdOrderReport.aspx 取「報告內容：」之後 `>` 開頭英文 free text；②batch translate（concurrency 5）→ `window.cxrLlmTranslate` → IndexedDB `cxrTranslations` 快取（provider/model 不符才重打，符合 brief test #10）。狀態排序權重「異常→無報告→正常→錯誤」、只看異常 / 只看無報告篩選、列印。
  - 新增 `llm-translate.js` — 多後端 adapter：`window.cxrLlmTranslate(reportText, settings)` → `{summary, findings[], hasAbnormal}`。provider = mock（預設，關鍵字啟發假資料，不打網路）/ gemini（generateContent）/ claude（/v1/messages + browser-access header）/ openai（chat/completions json_object）。各 provider request 組裝 + response 解析獨立，共用 system prompt + `cxrNormalizeResult` 後處理（容忍 markdown 圍欄）。
  - 修改 `lab-core.js` — DB_VER 5 → 6，加 `cxrTranslations` store（keyPath ordapno）+ `cxrTxGet/cxrTxPut`。onupgradeneeded 沿用 if(!contains) 補建寫法，舊版升上來零破壞。
  - 修改 `popup.html`/`popup.js` — search-bar 加「🩻 CXR 翻譯」按鈕 + `openCxrWindow`。
  - 修改 `dashboard.html`/`dashboard.js` — header 加「🩻 CXR 翻譯」按鈕開 cxr.html（Tab 2 ↔ Tab 3 互跳）。
  - 修改 `manifest.json` — web_accessible_resources 加 `cxr.html`。
- 原因：`TASK_BRIEF_health_check_cxr` S2。健檢門診每日 ~50 人，批次抓 CXR 英文報告 → LLM 翻中文白話摘要 + 異常標記。本階段先用 mock provider 把 fetch→extract→translate→render 整條跑通；真實 API 等使用者在設定 modal 填 key、切 provider 即可，程式不用再改。
- 測試：
  - `node --check` 五檔（llm-translate / cxr / lab-core / popup / dashboard）皆通過。
  - mock pipeline node 實測：子頁面樣本（PE CXR 5 行 findings）extraction 正確切 5 行、`列印日期` 雜訊剝除；mock 異常偵測 5 項（心臟肥大 / DJD / 肺門 / 橫膈 / 浸潤）、正常樣本 hasAbnormal=false、空報告 graceful、無 provider fallback 到 mock。
  - 待手動測（需 OPSID + 真實院內網）：opdweb 候診清單讀取、ernode fetch、子頁面實際格式、列印版面、真實 API key 連通。
  - classic-script global scope：cxr.js / llm-translate.js 全用 CXR_/cxr 前綴，未與 mapping.js `CATALOG` / patterns-computed.js `HELPERS` 撞名。
- 相依：依賴 patterns repo 已發版的 `CXR` catalog entry（上一條）。本次純 viewer，不需 reporter / patterns 重發。

## 2026-05-21 — sync：catalog 新增 CXR track-only pattern（health_check_cxr S1）

- 作者：claude（與 YC 共同）
- 範圍：sync-script（重跑 `node sync-patterns.js`）+ manifest snapshot
- 變更：修改（自動產生）
- 檔案：`mapping.js`、`normalizers.js`、`patterns-computed.js`（皆 auto-generated）
- 原因：sibling `hospital-lab-patterns` 在 `TASK_BRIEF_health_check_cxr` S1 把 `CXR` 加進 catalog（track-only，pattern `/PE\s*CXR|CHEST\s+PA\s+or\s+AP/i`，category 檢查）。viewer manifest 沒引用 — 現有單人報表零影響；同步只是把 catalog snapshot 帶進來，讓未來 S2 Dashboard 端拿得到 `CXR` id。reporter 不動。
- 測試：`node sync-patterns.js` 跑通；本 commit 不改 popup/dashboard UI，沿用 sibling repo regex 樣本驗證（PE CXR / CHEST PA or AP View (TT) / Chest Left oblique(TT) 三筆必測通過）。
- 相依：patterns repo 同步 commit（catalog 84 → 85）。

## 2026-05-21 — S2 篩檢 Dashboard：獨立視窗 + 個案管理 registry + DM 衛教 subpage

- 作者：claude（與 YC 共同）
- 範圍：popup + dashboard（新增）+ manifest
- 變更：新增 / 修改
- 檔案：
  - 新增 `lab-core.js` — 把 popup.js 的 fetch / parse / IndexedDB / loadData /
    enrichMissingValues / config / formatChartNo / splitChartInput 抽出共用,
    popup 與 dashboard 兩入口都載入。同時加入 `registry` IndexedDB store
    (DB_VER 4 → 5) 與 `registryPut / registryGet / registryList /
    registryRemove`。
  - 新增 `dashboard.html` + `dashboard.js` — 獨立視窗 Dashboard,3 種輸入源
    (候診清單 chrome.scripting / 手動 / 個案管理名單),batch fetch
    (concurrency ≤ 3) + progress bar,渲染 16 欄表格（病歷號 / 姓名 /
    最近抽血 / UACR / EKG / ABI / PVR / 眼底鏡 / DM衛教 / Sugar / HbA1c /
    eGFR / GFR分期 / Early-CKD / Pre-ESRD / 動作），header 點擊排序、
    「只看可收案」篩選、≤30天/N天前｜31-90天/N週前｜>90天/N個月前
    相對時間、>180 天橘底/>365 天紅底警示、`未執行` 顯示 ⚠️ 已開未做 +
    上次簽收時間、DM EDUCATION 子頁面 fetch（reuse `enrichCacheGet/Put`）
    擷取「此次問題 / 衛教項目」最近 2 次、abnormal lab 紅字、「加入個案
    管理」單列 + 「批次加入」全域、「報告」按鈕透過 chrome.storage.local
    `pendingChartno` 把 chartno 寄存,popup 開啟時自動填入並 search。
  - 修改 `popup.html` — `<script src="lab-core.js">` 在 popup.js 前載入;
    search-bar 新增 `📊 Dashboard` 按鈕。
  - 修改 `popup.js` — 移除已抽出函式（保留 UI / render / handlePrint /
    doSearch / refreshPatterns / bootstrap）;新增 `openDashboardWindow`
    用 `chrome.windows.create({ type:'popup', width:1400, height:900 })`
    開 dashboard.html;bootstrap 讀 `chrome.storage.local.pendingChartno`
    （5 分鐘內有效）自動填入並 search。
  - 修改 `manifest.json` — `permissions` 加 `scripting` + `tabs`（候診清單
    讀 opdweb 用 chrome.scripting.executeScript）;`web_accessible_resources`
    加 `dashboard.html`。
- 原因：`TASK_BRIEF_ckd_screening_dashboard` S2 — 自動化 CKD/DM 收案追蹤,
  取代手動 Excel `0519DM+CKD追蹤日期.xlsx`。S2.8 決定用獨立視窗（chrome.
  windows.create 1400×900）而非 popup tab,Tab 1 popup 保留單人報告流程。
- 設計決策：
  - EKG/ABI/PVR/Fundus pattern 直接從 `window.HOSPITAL_LAB_PATTERNS_CATALOG`
    取（這些 entry 不在 `VIEWER_MANIFEST`,故不在 `TEST_MAP`）;match 對
    `orderName`,非 `reportText`（這四個是 imaging-style order）。Doppling
    合併 order 會同時 match ABI 和 PVR 兩欄,符合 S1 設計。
  - 收案判定 reuse `window.HOSPITAL_LAB_PATTERNS_COMPUTED.HELPERS` 的
    `eGFR_CKDEPI_2021 / GFRStage / TaiwanCKD / EarlyCKD` — 與 viewer
    單人報告同源,確保 dashboard 跟 popup 顯示一致。
  - 排序 key：未執行 order `resdttm` 可能空,fallback 把 orderDate
    （台灣紀年）轉成 `YYYYMMDDHHMMSS` 排序,讓最近開立但未執行的 order
    能正確上浮到「最新」。
  - DM 判定：orderName match `/DM EDUCATION/i` 即為 DM（per brief S2.9）;
    不依賴 lab 值。
  - 候診清單啟發式擷取：跑在 opdweb tab 內,先試 row-level（≥5 cells,
    第 5 欄 match 9 碼 + 1 字母）回傳 tab-paste 字串讓 `splitChartInput`
    處理（保留看診序號）;退而求其次回傳純病歷號 tokens。
  - 「Tab 1 報告頁加入個案管理」按鈕：依 user 明示延到 S3,本輪未做。
- viewer 影響：
  - **popup 行為應與先前等價** — 抽出的函式只是換 script 載入位置,
    DB_VER 4→5 升級用 `if (!contains)` 安全寫法（既有 records /
    enrichCache store 不變,只多 registry store）。`renderResults`、
    `handlePrint`、列印按鈕、A5/HIV checkbox、debug 按鈕完全未動。
  - **新增可選功能** — Dashboard 按鈕,不影響既有單人模式。
- 測試（需 YC 在實機驗證）：
  - 既有單人模式 regression：80885F dialysis、76708I（CKD/DM）、
    任何 vhtt / vhyl 已知病人,確認 popup 行為等價（freshness badge、
    cache hit、列印 page 1 + A5）。
  - Dashboard：
    1. 開啟 popup → 按 `📊 Dashboard` → 1400×900 視窗開啟。
    2. textarea 貼 3 個以上病歷號（含 76708I/125509A/80885F）→ 按
       「開始篩檢」→ progress bar 跳動 → 表格出現 16 欄資料。
    3. UACR/Sugar/HbA1c/eGFR 異常值紅字。
    4. EKG/ABI/PVR/Fundus 日期欄 > 180 天橘底 / > 365 天紅底。
    5. 若有「未執行」EKG/ABI/PVR/Fundus → 顯示 ⚠️ 已開未做 + 上次簽收。
    6. DM EDUCATION 病人（如 76708I）→ DM 衛教欄有兩行「日期 / 此次
       問題 / 衛教」;hover 看完整 tooltip。
    7. 收案判定：eGFR ≥ 45 + 有腎臟損傷 → Early-CKD ✅;eGFR < 45 →
       Pre-ESRD ✅;有 DM EDUCATION → DM tag。
    8. 點 header 排序 / 勾「只看可收案」篩選。
    9. 點某列「加入個案管理」→ status 顯示已加入 → 該列按鈕變「已收案」。
   10. 重整 dashboard → 點「個案管理名單」按鈕 → textarea 自動填入 →
       自動 batch fetch 已收案者。
   11. 點病歷號 link「報告」按鈕 → 開啟瀏覽器右上角 popup → 自動填入並 search。
   12. opdweb 候診清單按鈕（若有 opdweb tab 開著）→ 自動填入。
- 相依：無 patterns repo 變動（純 viewer own-code）;`mapping.js` /
  `patterns-computed.js` 不需重 sync。
- 待續（S3）：CSV export、批次列印、Tab 1 報告頁「加入個案管理」按鈕、
  全量 regression。

## 2026-05-21 — sync 拉新 catalog：EKG / ABI / PVR / Fundus 四個檢查 pattern

- 作者：claude（與 YC 共同）
- 範圍：sync-script（純 sync，無 viewer own-code 改動）
- 變更：修改
- 檔案：`mapping.js`（由 `node sync-patterns.js` 重產，源 patterns repo `patterns/catalog.js`）；`normalizers.js` / `patterns-computed.js` 也一併重產但內容未變。
- 原因：patterns repo 同日 commit 為 `TASK_BRIEF_ckd_screening_dashboard` S1 加入 4 個檢查 entry（EKG / ABI / PVR / Fundus，category =「檢查」）。S2 Dashboard 才會消費；S1 純 sync。
- viewer 影響：**無行為變化**。這四個 catalog entry 不在 `VIEWER_MANIFEST`，`TEST_MAP = _resolveManifest(VIEWER_MANIFEST, CATALOG)` 不會解析到，故 `report.js` 既有單人報表（含 dialysis 80885F）零影響。
- 測試：
  - `node sync-patterns.js` 三個檔案皆 `✓`，無 warning。
  - 機械驗證：grep `mapping.js` 確認四個 id（EKG / ABI / PVR / Fundus）的 `{ id:'…' }` 區塊已 bundle 進來（行 849 起）。
  - Regex 樣本對照測試在 patterns repo 端跑過 6/6 PASS（見 patterns WORKLOG 同日）。
  - **待 YC 載入未封裝擴充功能、開一筆已知病人（建議 80885F dialysis）popup → 確認頂部 freshness badge ✓ fresh、單人報表沒新增意外欄位**。
- 相依：patterns repo 同日 commit 必須先 push。

## 2026-05-20 — sync 拉新版 computed.js（URR / CaxP 命名對齊）

- 作者：claude（與 YC 共同）
- 範圍：sync-script（純 sync，無 viewer own-code 改動）
- 變更：修改
- 檔案：`patterns-computed.js`（由 `node sync-patterns.js` 重產，源 patterns repo `patterns/computed.js`）；`mapping.js` 同時重產（catalog / viewer manifest 內容未變動）。
- 原因：patterns repo 同日 commit 把 COMPUTATIONS 的 URR.needs 從 `['BUNPre','BUNPost']` 對齊成 `['BUN_pre','BUN_post']`，id `CaP` → `CaxP`。reporter 端 brief（`TASK_BRIEF_ckd_egfr_staging`）需要這個對齊才能讓 dispatcher 跑通。
- viewer 影響：**無行為變化**。viewer `report.js` 只用 `HBsAgDisplay` / `AntiHBsDisplay` / `HCV` 三個 helper（從 `window.HOSPITAL_LAB_PATTERNS_COMPUTED.HELPERS` 拿）+ 自己 inline 算 eGFR（不走 COMPUTATIONS dispatcher）— URR / CaxP 兩個沒用到。Sync 只是把新檔複製進來，避免日後 patterns repo 有別的改動時 staleness 累積。
- 測試：載入未封裝擴充功能 → 開一筆已知病人 lab 頁 → popup → 頂部 freshness badge ✓ fresh；肝炎欄位（HBsAg / Anti-HBs / Anti-HCV）顯示正常；eGFR 仍算得出。（**待 YC 在 vhtt / vhyl 各一筆病人驗證 — 風險低，patterns-computed.js 內部函式邏輯未變）。
- 相依：patterns repo 同日 commit 必須先 push。

## 2026-05-20 — A5 列印 driver 相容性:`@page size` 改顯式寬高

- 作者:claude(與 YC 共同)
- 範圍:report / mockup
- 變更:修改
- 動機:YC 實機列印發現 Chrome PDF preview 正常但實機列印時內容轉 90°(紙橫向出,字直向)。Root cause:部分印表機 driver 不認 `@page size: A5 landscape` keyword,fall back 到紙匣預設方向(portrait),自動把 landscape 內容旋轉 fit 進 portrait 紙。
- 改檔:
  - `report.js REPORT_CSS_A5`:`@page { size: A5 landscape; margin: 5mm; }` → `@page { size: 210mm 148mm; margin: 5mm; }`(加註解說明)。
  - `mockups/a5-layout-mockup.html`:同樣換成 explicit dims(Cowork 端先改,本 commit 與 production CSS 一起入 git)。
- 原因:顯式 `WIDTHmm HEIGHTmm` 由 driver 直接套用,不需解讀「landscape」keyword + orientation flag,跨 driver 行為較一致。
- 跨 repo:無 — patterns / reporter 不受影響。
- 相依:本 commit 應 push 在 v1.4.0 commit `02dffd2` 之上(同一波 release,driver 相容性 hotfix)。

## 2026-05-20 — A5 landscape 單表版型(v1.4.0)

- 作者:claude(與 YC 共同)
- 範圍:popup / report / manifest / sync(viewer 自家 print UI 加 A5 路徑)
- 變更:新增 + 修改
- 動機:列印需要比 A4 更精簡的版型 — (1) 病人帶走衛教/紀錄單,A4 太大過密;(2) 醫師 quick glance 只想看最新一筆 + 是否異常。同時把 eGFR 與「慢性腎臟病分期」(EarlyCKD)納入列印項目。設計決議見 `hospital-lab-patterns/docs/task-briefs/TASK_BRIEF_viewer_a5_layout.md` § 10(YC 2026-05-20 cowork)。
- 改檔:
  - `popup.js renderResults`(line 628):printBtns 加 `<input id="a5-layout-cb"> 📄 A5單頁` checkbox;`handlePrint` 讀 `a5Layout` flag 並傳給 `generateReport` / `generateMultiReport`;新增 A5 mutually-exclusive listener — 勾 A5 → 「僅第1頁」自動 checked + disabled、「HIV報表」自動 unchecked + disabled;取消 A5 → 兩者恢復。
  - `report.js`(line 964–end):
    - 新增 `REPORT_CSS_A5` — `@page size: A5 landscape; margin: 5mm`;`.page-a5`、`.excel-style-a5` (圓角 `border-radius: 6px` + `border-collapse: separate` 4 角圓);`.visit-serial-overlay-a5` 字級 40pt(非 A4 的 48pt)。
    - 新增 `buildA5Page(patientInfo, orders, bw, title)` — 讀 `VIEWER_A5_MANIFEST`(從 mapping.js 來,patterns repo source of truth),沿用 `genderFilteredTests` / `buildResultMap` / `valueStyle` / `psaRatioStyle`,渲染單一 4 欄表(名稱 / 數值 / 正常值 / 檢驗日期);只顯示最新一筆(`resultMap[id][0]`);沒值顯示 `—`;所有 row 視覺一致(不對 eGFR/GFRStage/EarlyCKD 加特殊 class — brief § 2.5)。
    - 新增 `LEGEND_A5_COLOR` / `LEGEND_A5_BW`(A5 不顯示「最新數值」灰底 legend,只有 hi/lo + `—`)。
    - `generatePatientPages` signature 加 `a5Layout`;a5Layout=true 時 early-return `buildA5Page`。
    - `generateReport` + `generateMultiReport` signature 加 `a5Layout`;依此選擇 `REPORT_CSS_A5` 或 `REPORT_CSS` 注入(`@page size` 無法 per-element 切換,所以 stylesheet 整份 swap)。
  - `manifest.json`:1.3.0 → 1.4.0(minor — 新使用者可見功能)。
  - `mapping.js`(auto-gen):跑 `node sync-patterns.js` 重新打包,新增 `VIEWER_A5_MANIFEST` 常數(15 個 id,patterns repo 來源)。
  - `mockups/a5-layout-mockup.html`:之前未 commit,本 commit 連同 brief 一起入 git(設計 reference)。
- Spec 邊界(YC 拍板):
  1. A5 模式強制 1 頁、無 HIV column;UI checkbox mutually-exclusive 防呆。
  2. eGFR / EarlyCKD 算不出來時值欄顯示 `—`,不報錯。
  3. 兩個腎臟病分期(`GFRStage` + `EarlyCKD`)都列(brief § 2.4):eGFR 純 G 軸 vs Taiwan Pre-ESRD 二分,某些 case 會分歧但只多 1 列。
  4. A5 manifest 順序固定(brief § 2.3),source of truth 在 patterns repo `VIEWER_A5_MANIFEST`,以後改項目只動一處。
- 測試清單:見 brief § 4(7 case A5 基本 / 3 case UI 互斥 / 3 case 視覺 / 2 case regression)。本 commit 已過 `node --check` 語法檢查 + sync-patterns dry run;實機印表機 / 多病人 batch 待手測。
- 跨 repo:patterns 已先 push `feat(viewer): add VIEWER_A5_MANIFEST + dist wiring (v0.4.0)`(commit `3094167`);本 repo 跑完 sync 後可看到 VIEWER_A5_MANIFEST 出現在 mapping.js line ~995。
- 相依:patterns repo `v0.4.0` 已 push;OPD 端 24h 內透過 dist/patterns.json 自動拿到 A5 list。

## 2026-05-20 — Tabular paste 看診序號右上角 overlay(v1.3.0)

- 作者:claude(與 YC 共同,在 vhyl Cowork 動手)
- 範圍:popup.js / report.js / manifest.json(本 repo,viewer 自家 print UI)
- 變更:新增 + 修改
- 動機:多病人列印時護理站需「看診序號」識別病人(比病歷號好認、與叫號順序對應)。tabular paste 模式從排程畫面 col 1 抓序號,印在每份報表右上角大字 overlay。
- 改檔:
  - `popup.js splitChartInput()`(line 44–66):回傳結構從 `string[]` 改為 `Array<{chartno, visitSerial}>`。tabular path(≥5 tab cells)抓 col 5(chartno)+ col 1(visitSerial);free-form / 單一 chartno → visitSerial = null。
  - `popup.js handlePrint`(line 660+):single-patient path(`tokens.length <= 1`)接 `tokens[0].visitSerial`(若有);multi-patient loop destructure `{chartno, visitSerial}`,visitSerial 進 patientInfo。
  - `popup.js updateHint`(line 755)+ `doSearch`(line 776+):tokens.forEach 改讀 `.chartno`;doSearch firstToken 改傳 `.chartno` 給 loadData。
  - `report.js generatePatientPages`(line 949+):patientInfo destructure 加 `visitSerial = null`;page 1 + page 2 各加 `<div class="visit-serial-overlay">` HTML node(只在 visitSerial 非 null 時 render)。
  - `report.js REPORT_CSS`(line 712+):`.page` 加 `position: relative` 作 overlay anchor;新增 `.visit-serial-overlay` 規則(`position: absolute; top: 5mm; right: 8mm; font-size: 48pt; font-weight: 900; color: #AAAAAA;` watermark 風 / `z-index: 1000;`)+ `@media print` block(印刷模式同位置)。
  - `manifest.json`:1.2.0 → 1.3.0(minor — 新使用者可見功能)。
- Spec 邊界(YC 拍板):
  1. 只 tabular paste(≥5 tab cells)模式產生 visitSerial,free-form 與單一 chartno 不顯示 overlay。
  2. 單行 tabular paste(`tokens.length === 1`)也顯示 overlay(tabular detection 為準,跟 token 數無關)。
  3. 字級 48pt 假設序號 ≤ 2 位數(門診上午 ≤ 99);若未來規則變更需重新評估。
  4. overlay 淺灰字(#AAAAAA watermark 風)、透明背景、B&W + 彩色 + page1Only + HIV mode 都顯示。
- 測試清單:見 `hospital-lab-patterns/docs/task-briefs/TASK_BRIEF_viewer_visit_serial.md` § 4(共 13 case:基本 6 / 跨模式 3 / 視覺 2 / regression + WORKLOG 2)。
- 跨 repo:無 — 不動 patterns / reporter,不跑 sync-patterns。
- 風險:`splitChartInput` 是 breaking change(回傳結構變動),已逐一對齊 4 個 call site;listed in brief § 7。

## 2026-05-19 — Session 切換 SOPs G–J:本 repo pointer 條目

- 作者:claude(與 YC 共同,在 vhyl 動手)
- 範圍:meta-process(本 repo 無 code 動;真正變動在 patterns repo)
- 變更:無檔(僅 pointer 註記)
- patterns repo 同日 commit 加入:`docs/session-state-vhyl.md` / `session-state-vhtt.md` / `session-state-archive/.gitkeep` / `workflow-changelog.md`,PROJECT_CONTEXT § 12「Session 切換 SOPs」+ § 13「Cowork ↔ Chat mode handoff」
- Trigger 對照:「階段完成」→ SOP G(Wrap);「離開 vhyl/vhtt」→ SOP H;「接續 vhtt/vhyl/上次」→ SOP I(Resume);「結束 session」→ SOP J
- 影響本 repo:無 — 各 SOP 步驟內仍會跑「本 repo `WORKLOG.md` 加條目」(rule #2)及「git status / commit / push」(rule #3),機制不變
- 測試:N/A
- 相依:patterns repo 同 commit

## 2026-05-19 — Brief 集中:本 repo 1 條歷史 brief 搬至 patterns/docs/task-briefs/

- 作者:claude(與 YC 共同,在 vhyl 動手)
- 範圍:doc relocation(本 repo 無 code 動)
- 變更:移除
- 檔案:原 `TASK_BRIEF_肝炎硬編對齊vhyl_done.md`(2026-05-05)從 repo root 搬至 `hospital-lab-patterns/docs/task-briefs/TASK_BRIEF_viewer_hepatitis_regex_align_vhyl_done.md`。
- 原因:.gitignore line 25 把 `TASK_BRIEF*.md` 排除,該 brief 從未進 git → 兩台機本機版本可能 drift。集中到 patterns/docs/task-briefs/ 後第一次納入 git 追蹤、跨機可見。
- 新路徑見 patterns WORKLOG 2026-05-19 同日條目(完整對應表)。
- 影響:本 repo `.gitignore` 規則不變(future TASK_BRIEF 仍 ignored,但慣例上 brief 直接寫到 patterns/docs/task-briefs/)。
- 測試:N/A。
- 相依:patterns repo 同 commit 加入 4 個 brief 檔(本 repo 1 + reporter repo 3)。

## 2026-05-19 — Behavior rules:CLAUDE.md 加入 Coding behavior contract

- 作者:claude(與 YC 共同,在 vhyl 動手)
- 範圍:meta-rules(非 viewer code;改的是 CLAUDE.md)
- 變更:新增
- 檔案:`CLAUDE.md`(「不要做的事」前加 § Coding behavior contract,A–C 三條)
- 原因:Karpathy / Forrest Chang 12-rule CLAUDE.md(blocktempo 2026-05-14)經篩選後,挑出原規則 3(外科修改)、7(矛盾模式不混用)、8(新增前讀 caller)三條,對應本專案踩過的失敗模式(尤其 5/13 FreePSA orderNameFilter brief 屬於規則 8 的 case)。
- Cowork 端對應的「思考規則」(#8–#11)加在 patterns/docs/cowork-project-instructions.md。
- 三 repo 共用版本:patterns / viewer / reporter 三個 CLAUDE.md 同 commit 加同一份 contract;下次規則改動需三個一起。
- 測試:N/A(規則層,不跑 sync-patterns / popup smoke)。
- 相依:patterns repo 同 commit + reporter repo 同 commit,三個 repo 一起 push。
- 來源連結:https://www.blocktempo.com/claude-code-12-rules-error-rate-3-percent-karpathy-agent/

## 2026-05-12 — sync 拉新版 catalog(RBC + GluAC negative lookahead)

- 作者:claude(與 YC 共同,在 vhyl 動手)
- 範圍:manifest(sync 拉新版)— 本 repo 端無程式邏輯改動
- 變更:自動產生
- 檔案:`mapping.js`、`normalizers.js`、`patterns-computed.js`(皆 sync 重生)
- 原因:patterns repo 同日修 RBC + GluAC regex,加 negative lookahead 擋
  vhyl URINE ROUTINE(YL) 的 `RBC: 0-2`(range)和 `GLU: 4+`(gradient)誤匹配。
  詳見 patterns WORKLOG 2026-05-12 entry。
- 測試:viewer popup pattern-loader 走 GitHub raw `dist/patterns.json`,
  24h cache。OPD 端無需 redeploy zip — freshness badge 點一下即可強制刷新。
- 相依:patterns repo 同日 commit。

## 2026-05-08 — sync 拉新版 catalog（GluAC 收緊 bare-Glucose）

- 作者：claude（與 YC 共同）
- 範圍：manifest（sync 拉新版）— 本 repo 端無程式邏輯改動
- 變更：自動產生
- 檔案：`mapping.js`、`normalizers.js`、`patterns-computed.js`（皆 sync
  重產）
- 原因：patterns repo 同日修 GluAC regex — 把 bare `Glucose:` alternation
  改成必須帶括號（`Glucose(AC-serum):` / `Glucose(serum):` 才匹配）。
  原 pattern 會被 CHEM EXAM(TT) 尿液例行報告的 `Glucose: 4+` 命中、把
  `4` 當成空腹血糖 mg/dL。Viewer 報表 page 1 col 1 的「血糖」欄會直接
  受惠 — 從此 vhtt 同日有尿液常規 + 真血糖的病人，不會把尿糖 `4+` 誤
  顯示為血糖 4。
- 測試：YC 在 vhtt 000026353G 115/02/26 開 popup 列印報表，原本血糖欄
  位顯示 `4`（且被 alarm 為 ↓），sync 後該日期該欄位應改顯示真實血糖
  （或空白若該日無血清 AC sugar）。
- 相依：patterns repo 同日 commit（catalog GluAC pattern 收緊）。

## 2026-05-08 — sync 拉新版 catalog（FreePSA 移除 RATIO alternation）

- 作者：claude（與 YC 共同）
- 範圍：manifest（sync 拉新版）— 本 repo 端無程式邏輯改動
- 變更：自動產生
- 檔案：`mapping.js`、`normalizers.js`、`patterns-computed.js`（皆 sync
  重產）
- 原因：patterns repo 同日修 FreePSA regex — 移除 `RATIO` alternation
  避免 vhtt `Free PSA(TT)` 報告（只輸出 `RATIO: 0.152` 比值、不輸出
  絕對濃度）被誤抓成 FreePSA 濃度。viewer 端的 PSARatio 顯示由
  `patterns-computed.js` 的 `PSARatio` 函式驅動（`PSA == null ||
  FreePSA == null` 直接 return null），所以 vhtt 病人從此不會看到
  錯誤的 PSARatio；其他院區若有真的 Free PSA 數值仍正常顯示。
- 測試：YC 在 vhtt 病人 000017679E / 000043524F 開 popup 列印報表，
  原本 PSARatio 段被誤觸發顯示「警示」字樣，sync 後該段應變空白
  （PSA > 4 才算的，這兩位 PSA<1，本來就不該觸發 — 修完更乾淨）。
- 相依：patterns repo 同日 commit（catalog FreePSA pattern 修正）。

## 2026-05-07 — incremental fetch（v4 cache，stable-frontier）

- 作者：claude（與 YC 共同）
- 範圍：popup（loadData / 新 fetchIncremental / cache key v3→v4）
- 變更：新增 + 修改
- 檔案：`popup.js`
- 原因：6h TTL 過期就 full re-fetch（5–15 個 API call / patient），但
  signed-off 報告 immutable，95%+ 重抓的資料一模一樣。改用 stable-frontier
  增量演算法：ernode 回傳 newest-first，逐頁掃 cached orders，遇到第
  一頁 ALL ordseq 都 known + status 不變 → 之後頁也都不變 → STOP。
  常見情況（無新醫囑）= 1 個 API call。具體變更：
  - 新增 `fetchIncremental(chartno, cachedOrders, onProgress)`：用
    `Map(ordseq → {idx,status})` 比對，新醫囑 prepend、status 變動的
    in-place overwrite cached entry，allKnown 旗標決定是否提早收手。
  - cache key `v3:` → `v4:`，payload 加 `allOrders`（未經 LAB/RAD 拆
    分的 raw orders）。舊 v3 entry cache miss → graceful 跑一次 full
    fetch 自動升級到 v4。
  - `loadData()` 三條路徑：
    - TTL 內 → 直接回 cache（零 API call）
    - 過 TTL 且有 `allOrders` → `fetchIncremental` 後重跑
      `enrichMissingValues`（sub-page text 仍走 IndexedDB enrichCache，
      ordseq+status unchanged 的舊 order 保留 enriched reportText，
      只有新醫囑 / status 變動的需要再 enrich）
    - forceRefresh 或無 allOrders → 走原本的 `fetchAllOrders` 全頁
- 測試：YC 在實機驗收 — (1) 新病人 first load 走 full fetch，console
  應只有單次 fetchAllOrders；(2) 等 6h 過 TTL 後重開 popup → console
  應印 `[incremental] xxxx: 1 page(s) checked, total N`，DevTools
  Network 只有 1 個 ernode request；(3) ↻ 按鈕仍 force full fetch；
  (4) 有「未執行」醫囑後來變「正式報告」的 case，increment 後該筆
  reportText 應更新到新版。
- 相依：本 repo 內部修改，**不需** patterns repo 改動。Reporter 端會在
  下一個 commit 跟進。

## 2026-05-07 — 移除 viewer 12 個月 lab cutoff（Design Change 0）

- 作者：claude（與 YC 共同）
- 範圍：popup（loadData / CONFIG）+ popup.html / manifest 文案
- 變更：移除
- 檔案：`popup.js`、`popup.html`、`manifest.json`、`CLAUDE.md`
- 原因：incremental fetch 的前置作業 — incremental cache 會儲存 ALL
  orders，再用 `MAX_HISTORY = 3`（report.js）caps 每個 test 的顯示筆數，
  原本的 12 個月 cutoff 已沒必要。同時刪掉 hepatitis / RPR / TPHA / HIV
  的 all-time 特殊 re-add block（labAll.forEach... HBsAg|HCV Ab|...）—
  既然全部 lab 都進來，rare/lifelong markers 自然會被排序到最新 3 筆。
  具體變更：
  - 刪 `cutoffDateLab()`（原 ~95 行）、`filterLabRecent()`（原 ~192 行）
  - `loadData()` 改用 `labAll`，刪 `recentIds` / `labAll.forEach(...)` 區塊
  - `CONFIG.LAB_MONTHS_BACK` 保留但加註解標明 reporter-only（reporter
    端 `extractLabValues()` 仍用自己的 12 個月 cutoff）
  - UI 文案（popup.html sub-title、popup.js period/total-note、empty
    message、manifest.json description）統一改成 "Lab + Imaging: all"
- 測試：手動測待 YC 在實機（vhtt / vhyl）開 popup —
  既有 chartno、有 hepatitis 老紀錄者、有 12 個月外的 lab 紀錄者各
  一筆，確認 (1) 列印報表 hepatitis 仍顯示、(2) 12 個月外的 rare lab
  也會 surface 為最新值、(3) 一般病人 page 1 渲染與先前一致
  （MAX_HISTORY=3 限制下沒看到舊的擠掉新的）。
- 相依：本 repo 內部修改，**不需** patterns repo 改動。後續會在同一
  branch 再加 incremental fetch（v3→v4 cache key bump）。

## 2026-05-07 — findNearby 窗口 90 → 30 天（避免單筆 UACR 跨日配對）

- 作者：claude（與 YC 共同）
- 範圍：report（findNearby helper + KDIGO/TaiwanCKD/EarlyCKD 配對）
- 變更：修改
- 檔案：`report.js`、`CLAUDE.md`（staging pairing logic 描述同步更新）
- 原因：`report.js` 的 `findNearby()` 用 `THREE_MONTHS_MS = 90 * 24 * 60 *
  60 * 1000` 把 UACR / UPCR 配到同 patient 90 天內任一 eGFR 日期，導致
  單筆 UACR 會被多個 eGFR 日期共用、在實際沒有 UACR 的日期顯示誤導
  staging。實際 case 000115014H：UACR 57.20 在 115/02/13，eGFR 在
  114/11/18（87 天前）也被配上 → KDIGO=「中」(錯)；115/02/13 的 eGFR
  也是「中」(對)。改成 30 天窗口後只剩同日精準配對，前者不再產生
  staging。改名 const `THREE_MONTHS_MS` → `ONE_MONTH_MS`，更新對照
  comment（266 行）+ 兩處 caller comment（KDIGO + TaiwanCKD），CLAUDE.md
  的 「3-month-nearest」描述也同步改 1-month 並補上 2026-05-07 緊縮的
  reason 註記。
- 測試：等 OPD 端用 chartno 000115014H 開 popup → 列印報表 → 114/11/18
  eGFR 列 KDIGO 應變空白（無 UACR within 30 days）；115/02/13 eGFR 列
  KDIGO 仍顯示「中」（exact match UACR=57.20）。
- 相依：本 repo 內部修改，**不需** patterns repo 改動 — `findNearby` 是
  report.js 自帶 helper，不在 catalog/manifest/computed 層。

## 2026-05-07 — sync 拉新版 catalog（49 條 numeric capture 加 `[<>]?\s*`）

- 作者：claude（與 YC 共同）
- 範圍：manifest（sync 拉新版）— 本 repo 端無程式邏輯改動
- 變更：自動產生
- 檔案：`mapping.js`、`normalizers.js`、`patterns-computed.js`（皆 sync 重產）
- 原因：patterns repo 同日把 49 條沒加 `[<>]?` 的 numeric capture group 全
  改成 `([<>]?\s*[\d.]+)`，讓 `<0.01` / `<2` / `> N` 這類偵測下限值能
  進 pipeline。viewer 的 `valueStyle()` 早就 strip `<>` 再 parseFloat
  做 alarm，所以 viewer 端零調整只要 sync 拉新版即可。
- 測試：spot-check `TSH: <0.01` 在新 catalog 拉到 `<0.01`，
  `WBC: 0-5`（urine）仍 reject。實機驗收等病人開啟 popup 時透過
  dist/patterns.json 24h 自動拿到。
- 相依：patterns repo 同日 commit（catalog detection-limit regex）。

## 2026-05-07 — sync 拉新版 catalog（肝炎 6 條 regex 加 i flag）

- 作者：claude（與 YC 共同）
- 範圍：manifest（sync 拉新版）— 本 repo 端無程式邏輯改動
- 變更：自動產生
- 檔案：`mapping.js`、`normalizers.js`、`patterns-computed.js`（皆 sync 重產）
- 原因：patterns repo 同日 catalog 6 條肝炎 regex（HBsAg / AntiHBs /
  AntiHCV / HBsAgTiter / AntiHBsTiter / AntiHCVTiter）全加 i flag，
  修 vhtt 全大寫 `ANTI-HCV` match 不到的 bug。本 repo 透過
  `node sync-patterns.js` 拉新版進 mapping.js。
- 測試：viewer 端肝炎透過 patterns-computed.js 的 `_hepatitisDisplay`
  dispatcher（Phase 2 集中化），依賴 catalog 提供的 raw 定性 entries。
  catalog regex 改用 i flag 後新格式 ANTI-HCV 應能進 raw entries 陣列，
  HCV/HBsAgDisplay/AntiHBsDisplay computed 結果隨之正確顯示。
- 相依：patterns repo 同日 commit（catalog hepatitis 6 條 i flag）。

## 2026-05-07 — enrichMissingValues 候選改成 strict subpage opt-in（避免 non-subpage brute-fetch）

- 作者：claude（與 YC 共同）
- 範圍：popup（enrichMissingValues 候選邏輯收緊）
- 變更：修改
- 檔案：`popup.js`、`mapping.js`（sync 拉新版 catalog）
- 原因：reporter 端實測發現原邏輯 `chaseTests = tests.filter(t => t.subpage
  || !presentIds.has(t.id))` 對 globally-missing 的 non-subpage test 會把
  所有 within-cutoff order 推進 queue（實測 queue=132 一筆病人）。本 repo
  雖然在 Chrome extension 環境 CORS 不會 blocked，但同樣 brute-fetch
  浪費。改成 strict opt-in：`tests.filter(t => t.subpage &&
  t.subpage.orderNameMatch)`。UACR 已在 patterns catalog 加
  `subpage.orderNameMatch`（urine-related 廣 regex）保留功能。
- 測試：viewer 端載入有 UACR 病人 → UACR 仍走 sub-page chase（catalog
  opt-in 還在）；載入無 UACR 病人 → 不再 brute-fetch（pre-fix 行為是
  fetch 1 年內所有 order trying to find UACR）。
- 相依：patterns repo 同日 catalog 改動（Aluminum regex + UACR opt-in）。

## 2026-05-07 — enrichMissingValues 改 per-test chase semantics（subpage tests bypass missing check + cutoff）

- 作者：claude（與 YC 共同）
- 範圍：popup（enrichMissingValues 邏輯修正）
- 變更：修改
- 檔案：`popup.js`
- 原因：reporter 端測同一份函式時發現對歷史值場景錯誤 — binary
  missing 邏輯在 OPD 單值顯示沒事，但對歷史欄位會跳過所有 sub-page
  chase。為了讓兩 repo 用同一份 enrichment 邏輯（差只在 cache backend
  與 `buildSubpageUrl` 簽名），同步更新本 repo：
  - 帶 `subpage` config 的 test 永遠 chase（per-order missing），
    無 `subpage` config 的 test 維持原本 binary missing 行為（UACR）
  - 候選清單改為 per-order `relevantTestsForOrder` 計算 — subpage-aware
    test bypass 12-month cutoff，UACR-style 維持 cutoff
- 測試：viewer 端 Aluminum 不在 manifest，本 repo 行為對 UACR 場景
  與 v1 等價（regression-safe）。
- 相依：—

## 2026-05-07 — enrichUACRMulti 重構為通用 enrichMissingValues + IndexedDB enrichCache

- 作者：claude（與 YC 共同）
- 範圍：popup（sub-page enrichment + 持久化 cache）+ manifest（sync 拉新版 catalog）
- 變更：新增 / 修改 / 移除
- 檔案：`popup.js`、`mapping.js`（sync 自動產生）、`patterns-computed.js`（sync 自動產生）
- 原因：原本只有 UACR 一個 test 寫了 sub-page enrichment（test-centric，
  每加一個 sub-page-only test 就要寫一個 enrichXxx），不可維護。改為
  manifest-driven 通用機制：Pass 1 走原本流程抽值 → 算出 manifest 期望
  testIds 中還缺值的 → 只對「請 Click」+ 在 cutoff 內 + 有 ordapno 的
  order 做 selective sub-fetch（上限 maxFetches=15）。子頁面文字以
  ordapno 為 key 持久化進 IndexedDB（DB_VER 3 → 4，新 store
  `enrichCache`），重複載入同病人 0 sub-page request。
  Catalog entry 可選擇性帶 `subpage:{ orderNameMatch, resultPattern,
  synthLabel }` — 子頁面若沒主-page 標籤（如 Aluminum 子頁面只有
  `Result: 4`），enrichment 會用 orderName 翻譯回 `Al鋁: 4` 注入
  reportText，下游 regex 即可命中。Aluminum 已加進 patterns catalog 但
  **沒有**加進 viewer manifest（per YC：門診衛教單不顯示血鋁），所以
  本 repo 端目前 enrichment 仍只會被 UACR 觸發；機制本身已通用化，未來
  若有需要把鋁拉進門診單，只需在 viewer.js 加一行 manifest entry 即可。
- 測試：popup.js 重構後待 vhtt 桌機載入：
  - 既有 UACR sub-page 行為（regression）
  - 第二次載入同病人 → F12 Network 無 OpdOrderReport 請求
  - DB_VER 升級不破壞既有快取（onupgradeneeded 加新 store 不動舊 store）
- 相依：依賴 `hospital-lab-patterns` 同日的 catalog 更新（Aluminum +
  schema `subpage` 欄位放行）— 已透過 `node sync-patterns.js` 拉進
  `mapping.js`。`pattern-loader.js` 的 `__regex` reviver 是遞迴 reviver，
  `subpage.resultPattern` / `subpage.orderNameMatch` 會自動 rehydrate
  為 RegExp，無需另外處理。

## 2026-05-07 — gitignore 加 .claude/

- 作者：claude（與 YC 共同）
- 範圍：sync-script（gitignore 一行）
- 變更：修改
- 檔案：`.gitignore`（加 `.claude/`）
- 原因：本機 Claude Code 權限白名單一直以 untracked 浮現，與 sibling
  `hospital-lab-patterns`（commit `e77b73c` 已忽略）和
  `hospital-lab-reporter`（同日 commit `72f5c01` 已忽略）一致。
- 測試：`git status` 不再列出 `.claude/`。
- 相依：無。

## 2026-05-07 — 跨 repo 文件大整理（patterns repo 端）coordination 記錄

- 作者：claude（與 YC 共同）
- 範圍：docs（無程式碼異動，僅記錄跨 repo 文件大整理對本 repo 的影響）
- 變更：—（本 repo 無檔案變更）
- 檔案：—
- 原因：sibling `hospital-lab-patterns` 本日（2026-05-07）做了文件大整理
  — 搬移 BOOTSTRAP/COWORK_PI 到 `docs/`、新增 4 份中文 SOP（含
  `sop-claude-code-guide.md` / `sop-cowork-guide.md`）、規則 #6 重寫為
  分層更新策略、定義 workspace root CLAUDE.md 機制（Claude Code 從
  `D:\self\hospital-lab` 啟動，自行 cd 到各 repo）。本 repo 的 CLAUDE.md
  / README.md 內容未變，但下次操作建議遵循 sibling 的新指引：
  - 不再 `cd hospital-lab-viewer && claude`，改為從 workspace root 啟動
  - sync-patterns 之前先看 sibling repo `docs/learning-workflow.md`
- 測試：—（無程式碼異動，無需開瀏覽器測）
- 相依：sibling repo `hospital-lab-patterns` 同日 commit
  `0adf376`（workspace 機制）+ `a42f5be`（搬位置）+ `6a4f6c8`（4 份 SOP）
  + `19ee557`（規則 #7）。OPD 端不會收到任何變更，dist/patterns.json 無異動。

## 2026-05-07 — 補齊 CLAUDE.md 檔案清單、新增 README.md

- 作者：YC（Cowork）
- 範圍：docs（CLAUDE.md / README.md，無程式碼變更）
- 變更：修改 + 新增
- 檔案：`CLAUDE.md`、`README.md`（新建）
- 原因：
  1. 原本 `CLAUDE.md` 的 Architecture 段缺三個檔（`pattern-loader.js`、
     `normalizers.js`、`options.html/js`、`ckd_staging.svg/png`）—— 不利
     新進對話的 Claude 快速理解 repo 結構。一併把 Reference 段補上院區
     對照（vhyl 玉里 / vhtt 臺東）和 pattern-learning workflow 連結。
  2. `mapping.js` 條目重新描述（catalog + viewer manifest + normalizers +
     resolver bundle），對應目前 sync-patterns.js 產生的內容。
  3. 肝炎條目改為「Phase 2 complete 2026-05-06」並指明走
     `patterns-computed.js` dispatcher，呼應前一筆 WORKLOG。
  4. 新增 `README.md`：給 GitHub 訪客看的 repo 概覽（用途、檔案配置、
     pattern 來源、Quick start、Privacy 提示）。原本 repo 沒有 README，
     在 GitHub 頁面顯示空白。
- 測試：純文件變更，無需 reload extension。`git diff --stat` 確認只動
  CLAUDE.md（+23 / -10）與新增 README.md。
- 相依：無，patterns repo 不需發版。

## 2026-05-06 — EarlyCKD 非 CKD 時顯示「正常」(Phase B)

- 作者：claude（與 YC 共同）
- 範圍：report（CKD pairing 迴圈）+ patterns-computed / mapping（自動同步）
  + CLAUDE.md / ckd_staging.svg 文件
- 變更：修改
- 檔案：`report.js`、`patterns-computed.js`、`mapping.js`、
  `normalizers.js`、`CLAUDE.md`、`ckd_staging.svg`
- 觸發：patterns repo 已 push commit `437683c`
  （`computed: EarlyCKD 非 CKD 時回傳「正常」(視覺一致性)`）。viewer 端同步
  把獨立的 client-side pairing 迴圈改成在「TaiwanCKD = 正常」分支也 push
  一筆 EarlyCKD「正常」cell，讓使用者不會把空白誤判為「漏抓」（病患
  000151649A：3 筆紀錄中只有 115/02/02 顯示 P1，其餘 2 格空白）。
- sync 結果：`node sync-patterns.js` 重跑，三檔 banner timestamp 刷新。
  `patterns-computed.js:139–143` 確認 `EarlyCKD()` 已是新版（`tw === '正常'`
  回傳 `'正常'`，eGFR null 仍回 null）。
- `report.js` 變更（line 315–318）：在 `if (!twCKD)` 分支多 push 一筆
  `map['EarlyCKD'].push({ date: e.date, value: '正常', _tag: 'normal' })`，
  與 `TaiwanCKD` 同 date 同 tag，視覺一致。`else` 分支不動，仍走原本的
  `getEarlyCKDClass()` → 'P1早期'(_tag='caution') / 'P2中晚期'(_tag='hi')。
  `getEarlyCKDClass()` 內部不需修改（仍可回 null；caller 端自行判斷）。
- 文件同步：
  - `CLAUDE.md` line 42 把「Only shown when CKD is present.」改寫為
    「正常時顯示「正常」(normal tag)；CKD 時顯示 P1=CKD 1–3a (eGFR≥45) /
    P2=CKD 3b–5 (eGFR<45)。只有 eGFR 缺值時才空白。」並把欄位名從
    「健保P1早期/P2中晚期」擴成「健保正常/P1早期/P2中晚期」。
  - `ckd_staging.svg` line 189 sublabel 改寫成「正常時顯示「正常」；
    CKD（第一～五期）時顯示 P1早期 / P2中晚期；僅 eGFR 缺值時空白」。
- 測試：本機環境無法載入 chrome 跑真實病人。改以 node 在
  `patterns-computed.js` 跑 4 組樣本驗證 helper：
  - `EarlyCKD({TaiwanCKD:'正常', eGFR:95})` → `'正常'` ✓
  - `EarlyCKD({TaiwanCKD:'第一期', eGFR:95})` → `'P1早期'` ✓
  - `EarlyCKD({TaiwanCKD:'第三期 3b', eGFR:35})` → `'P2中晚期'` ✓
  - `EarlyCKD({TaiwanCKD:null, eGFR:null})` → `null` ✓
  另以 `node --check report.js` 確認語法 OK。請 YC 在 chrome 載入未封裝
  擴充後跑 vhyl 000151649A，確認 3 筆紀錄的健保 CKD 分群欄各顯示
  「正常 / P1 早期 / 正常」（顏色：normal / caution / normal），與
  「慢性腎臟病分期」列視覺一致。
- 重打包：`hospital-lab-viewer.zip` 已重新生成放在 parent folder
  （14 個白名單檔，約 55KB）。
- 相依：依賴 patterns repo commit `437683c` 已 push 到 GitHub；本輪 viewer
  不需要再對 patterns repo 做變更。Phase C（reporter）尚未開始。

## 2026-05-06 — Item B Phase 2：viewer 肝炎切到 patterns-computed.js

- 作者：claude（與 YC 共同）
- 範圍：report（viewer 肝炎渲染分派）+ mapping / patterns-computed（自動同步）
- 變更：修改
- 檔案：`report.js`、`mapping.js`、`patterns-computed.js`、`normalizers.js`
- 原因：Item B 的目標是把肝炎 regex 集中在 `hospital-lab-patterns`
  catalog 內，不再讓 viewer `report.js` 自己硬編一份。Phase 1（patterns
  repo）已經把 `HBsAgTiter` / `AntiHBsTiter` / `AntiHCVTiter` 三條 raw
  數值，與 `HBsAgDisplay` / `AntiHBsDisplay` 兩條 computed display
  wrapper 加進 catalog；`HCV` 也補上 `needs:['AntiHCV','AntiHCVTiter']`。
  Phase 2 在 viewer 端把 `report.js` 的 `findHepatitis()` 函式（line
  ~336–377，包含 `map['HCV']` 與 `map['HBsAg']` 兩個賦值）跟
  `findAntiHBs` IIFE（line ~383–405）整段刪掉，改成 dispatcher：呼叫
  `window.HOSPITAL_LAB_PATTERNS_COMPUTED.HELPERS.{HCV,HBsAgDisplay,
  AntiHBsDisplay}`，輸入是 parse loop 已從 catalog raw 條目抽出的
  `map['HBsAg']`/`map['HBsAgTiter']` 等，輸出寫回 `map['HCV']`/
  `map['HBsAgDisplay']`/`map['AntiHBsDisplay']`。viewer manifest（在
  catalog 內）已把 `HBsAg` / `AntiHBs` 兩個顯示位改 id 成
  `HBsAgDisplay` / `AntiHBsDisplay`，singleValue render 路徑（`report.js`
  ~line 593）走 `resultMap[test.id]` 自然取到新 id 的值，不需動 render。
  raw `HBsAg` / `HBsAgTiter` / `AntiHBs` / `AntiHBsTiter` / `AntiHCV` /
  `AntiHCVTiter` 六條以 extract-only 形式列在 viewer manifest 末段
  （沒有 page/col，render 自動跳過），讓 parse loop 仍會抽取它們作為
  dispatcher 的輸入。
- 同步：先在 patterns repo push 完 Phase 1，再在 viewer 跑
  `node sync-patterns.js` 把 5 條新 catalog 條目 + 3 個 computed 函式
  （`_hepatitisDisplay` helper + `HBsAgDisplay` / `AntiHBsDisplay` /
  `HCV`）拉進 `mapping.js` 與 `patterns-computed.js`。已用 grep 確認
  `mapping.js:596` 起有三條 *Titer raw、`mapping.js:617` 起有兩條
  Display computed、`mapping.js:837–842` 有六條 extract-only 條目；
  `patterns-computed.js:177` 有 `_hepatitisDisplay` helper、
  `patterns-computed.js:199–207` 有三個 wrapper 函式並註冊在
  `COMPUTATIONS` 與 `HELPERS`。
- 規格驗證：node 跑 4 組樣本確認 dispatcher 行為：
  - vhyl `HBsAgDisplay({HBsAg:Non-Reactive, HBsAgTiter:0.21})` →
    `{value:'正常 (HBsAg 0.21)', tag:'normal'}`
  - vhyl `HCV({AntiHCV:Non-Reactive, AntiHCVTiter:0.12})` →
    `{value:'正常 (Anti-HCV 0.12)', tag:'normal'}`
  - vhyl `AntiHBsDisplay({AntiHBs:Reactive, AntiHBsTiter:120.5})` →
    `{value:'有抗體 (Anti-HBs 120.5)', tag:'normal'}`
  - vhtt `HBsAgDisplay({HBsAg:Reactive, titer:[]})` → `{value:'帶原',
    tag:'warning'}`（無 titer 時不附括號）
  另以 node 跑 vhyl 黏連格式
  `"HBsAg: 0.21HBsAg (YL): Non-Reactive"`，catalog raw HBsAg regex 抓到
  `Non-Reactive`、HBsAgTiter regex 抓到 `0.21`，AntiHCV 同理；vhtt
  `"HBsAg(TT): Reactive"` 抓到 `Reactive` 而 titer 為 undefined（預期）。
- 重打包：`hospital-lab-viewer.zip` 已重新生成放在 parent folder（14 個
  白名單檔，約 55KB）。
- 測試：本機環境無法實機跑 Chrome；請 YC 在 chrome 載入未封裝擴充後：
  1. fetch vhyl `000151649A`，確認肝炎欄位顯示「正常 (HBsAg 0.21)」、
     「正常 (Anti-HCV 0.12)」與 Anti-HBs 實際結果。
  2. fetch 任一 vhtt 病人，確認原 vhtt 顯示不退化（HBsAg 帶原 / 正常
     等仍能顯示）。
  3. 若任一欄空白，F12 console 跑 `map['HBsAg']` / `map['HBsAgTiter']`
     等檢查 raw 條目是否被 parse loop 抽到，再判斷是 sync、parse loop、
     還是 dispatcher 沒跑。
- 相依：依賴 `hospital-lab-patterns` Phase 1 commit（catalog 5 條 +
  computed.js 3 函式 + dist/patterns.json）已先 push。Reporter 不需動，
  Phase 3 只跑 sync 即可。

## 2026-05-06 — sync Phase B：GPT/RGT/BUN/CREAT/UA 加性別感知 hiM/hiF

- 作者：claude（與 YC 共同）
- 範圍：mapping（自動同步）
- 變更：修改
- 檔案：`mapping.js`、`normalizers.js`、`patterns-computed.js`
  （皆由 `node sync-patterns.js` 重新產生，無手改）
- 觸發：`hospital-lab-patterns` 的 Phase B commit `4a1a0b9`
  （`catalog: GPT/RGT/BUN/CREAT/UA 加 gender-aware hiM/hiF`）已 push
  到 GitHub。本輪 viewer 端只跑 sync 把 catalog 的新欄位拉進
  `mapping.js`，讓本機已上線的 `valueStyle()` 性別分支（Phase 2）對
  這 5 條也生效。
- sync 結果：`node sync-patterns.js` 重跑成功，三檔皆有更新。手動以
  `grep hiM:|hiF:` 確認 5 條都帶到新欄位：
  - GPT（`mapping.js:171`）→ `hiM:45, hiF:34`
  - RGT（`mapping.js:180`）→ `hiM:55, hiF:38`
  - BUN（`mapping.js:269`）→ `hiM:20.6, hiF:18.7`
  - CREAT（`mapping.js:302`）→ `hiM:1.2, hiF:1.0`
  - UA（`mapping.js:312`）→ `hiM:7.7, hiF:6.2`
  既有 Phase 1 的 6 條（RBC、Hb、HCT、Fe、TIBC、Ferritin）欄位未受
  影響。
- 行為：因 Phase 2 已把 `valueStyle()` 改為性別感知，sync 完即生效，
  不需要再改 `report.js`。男性病人 GPT 35 / BUN 22 / Cr 1.15 / UA 7.0
  不再被誤判超標；女性病人對應上限亦會收斂為 34 / 18.7 / 1.0 / 6.2。
- 重打包：`hospital-lab-viewer.zip` 已重新生成（14 個白名單檔，
  約 55KB）放在 parent folder。
- 測試：本機環境無法實機載入 chrome 跑真實病人；請 YC 在 chrome
  載入未封裝擴充後跑一筆已知男性 + 一筆已知女性病人，確認頂部
  freshness badge 與 GPT/RGT/BUN/CREAT/UA 顏色判定符合性別預期。
- 相依：依賴 patterns repo 的 commit `4a1a0b9`（已 push 到 GitHub），
  本輪 viewer 不需要再對 patterns repo 做變更。

## 2026-05-06 — viewer 對齊性別感知 threshold（Phase 2）

- 作者：claude（與 YC 共同）
- 範圍：report、mapping（自動同步）
- 變更：修改
- 檔案：`report.js`、`mapping.js`、`normalizers.js`、`patterns-computed.js`
  （後三者由 `node sync-patterns.js` 重新產生）
- 觸發：patterns repo 的 Phase 1 已把 `loM/hiM/loF/hiF` 寫進
  catalog 6 條（RBC、Hb、HCT、Fe、TIBC、Ferritin）。本輪 viewer 接手
  把 alarm 判定改成性別感知，解決女性病人 Fe=58 在 viewer 被誤判過低
  的回報案（vhyl 000151649A）。
- sync 結果：`node sync-patterns.js` 重新打包 mapping.js / normalizers.js /
  patterns-computed.js。手動確認 mapping.js 內六條目都帶了
  `loM/hiM/loF/hiF`（grep 命中 96、105、115、417、426、443 行；對應
  RBC、Hb、HCT、Fe、TIBC、Ferritin），fallback `lo`/`hi` 仍保留為
  `min(loM,loF)`、`max(hiM,hiF)` 寬包絡。
- `valueStyle()` 變更（`report.js:502`）：
  - 簽名加 `gender` 參數（第 5 個）。
  - 新增分支：`gender === '男'` 且條目有 `loM/hiM` 任一 → 使用
    `hiM/loM`（單側存在則只覆蓋該側，另一側仍用 `test.lo/hi`）。
  - 對稱分支：`gender === '女'` 且條目有 `loF/hiF` 任一 → 使用 `hiF/loF`。
  - 性別未知（空字串、null、其他值）或條目沒有性別欄位 → 走原本
    `test.hi`/`test.lo`，舊行為不變。
- Call chain 改動（gender 從 `generatePatientPages` 沿著呼叫鏈傳到
  `valueStyle`）：
  - `buildTestBlock(test, resultMap, bw, gender)` — `report.js:593`
  - `buildSectionBox(sectionName, tests, resultMap, bw, gender)` — `report.js:671`
  - `buildColumn(pageNum, colNum, resultMap, tests, bw, gender)` — `report.js:741`
  - `buildPage2Column(resultMap, tests, bw, gender)` — `report.js:949`
  - 7 個 call site（page1 四欄、HIV col、page2 文字欄）全部加上
    `gender` 引數。`generatePatientPages` 早就 destructure 出 `gender`
    變數（行 995），不需新拉資料來源。`generateDebugReport` 不走
    `valueStyle` 路徑，無需改動。
- gender 格式：與 `calcEGFR` 一致，使用 viewer 既有的 `'男'`/`'女'`
  字串（不是 `'M'`/`'F'`）。
- 測試：本機環境無法載入擴充功能跑真實病人 UI。改以離線單元測試
  覆蓋 TASK_BRIEF §8 全部 12 個案例（女 Fe 58/45、男 Fe 58/70、unknown
  Fe 58、女 Hb 13/11、男 Hb 13、男女 Ferritin 25 與女 Ferritin 250、
  以及條目無性別欄位的 fallback）→ 12/12 全綠。`node --check report.js`
  亦通過。請 YC 在 chrome 載入未封裝擴充後跑 vhyl 000151649A 確認
  Fe=58 不再紅字（該病人為女性）。
- 重打包：`hospital-lab-viewer.zip` 已重新生成（14 個白名單檔，55KB）。
- 相依：依賴 hospital-lab-patterns repo 的 Phase 1 commit 已 push
  到 GitHub；本輪不涉及 patterns repo 變更。
- 下一步：Phase 3（reporter）尚未開始；reporter manifest 對這 6 條
  有 `hi:null lo:null` override，需要 YC 決定要不要也打開 alarm
  顯示（見 TASK_BRIEF §7、§9）。

## 2026-05-05 — viewer hepatitis regex 對齊 vhyl（HCV / HBsAg / AntiHBs）

- 作者：claude（與 YC 共同）
- 範圍：report
- 變更：修改
- 檔案：`report.js`
- 觸發：前一輪 catalog batch 修了 vhyl 的 HBsAg / AntiHCV / AFP / TSAT / Fe，
  但 viewer 對 hepatitis 三項（HCV、HBsAg、Anti-HBs）是在 `report.js`
  自家硬編 regex 處理（因為要同時呈現定性 + 數值，例如
  「正常 (HBsAg 0.24)」），catalog 改動不會自動同步到這裡。使用者
  回報 vhyl 病人 000151649A 在 viewer 仍空白。
- 修改內容：
  - `findHepatitis` HCV：定性 regex 改為
    `/(?:HCV Ab|Anti-HCV)\s*\((?:TT|YL)\):\s*([^\s\d]\S*)/`，
    數值 regex 加入 `HCV Ab` alternation。
  - `findHepatitis` HBsAg：定性 regex 改為
    `/HBsAg\s*\((?:TT|YL)\):\s*([^\s\d]\S*)/`，數值 regex 不變。
  - `findAntiHBs` IIFE：定性 regex 改為 suffix-anchored
    `/Anti-HBs\s*\((?:TT|YL)\):\s*([^\s\d]\S*)/`，移除舊的
    `if (/[\d.]/.test(qualRaw)) continue;` numeric filter（已被
    `[^\s\d]\S*` capture class 取代）。
  - 三處上方加 vhyl / vhtt 樣本註解。
- 設計原則（同 catalog batch）：
  - 定性 regex 用 `\((?:TT|YL)\)` 鎖 suffix，capture 必為定性詞，
    不會誤抓黏連的滴度數字。
  - `[^\s\d]\S*` 雙保險：第一個字元不能是空白或數字，未來新院區
    suffix（例如 `(KH)`）若忘記加進 alternation 也不會誤抓數字行。
- 測試樣本（黏連格式 end-to-end）：
  - vhyl HBsAg：`HBsAg: 0.21HBsAg (YL): Non-Reactive (Non-Reactive)`
    → 顯示「正常 (HBsAg 0.21)」
  - vhyl AntiHCV：`Anti-HCV: 0.12Anti-HCV (YL): Non-Reactive (Non-Reactive)請判讀`
    → 顯示「正常 (Anti-HCV 0.12)」
  - vhyl AntiHBs：`Anti-HBs: <num>Anti-HBs (YL): <Reactive|Non-Reactive>`
    → 顯示「有抗體 / 無抗體 (Anti-HBs <num>)」
  - vhtt 既有樣本（`HBsAg(TT): Non-Reactive` 等）維持原狀，不退化。
- 驗收：side-load 重打包 zip 後重 fetch 000151649A，HBsAg / Anti-HCV /
  Anti-HBs 三項應改為正常顯示。
- 跨 repo：無。本輪只動 viewer，catalog / reporter / patterns repo 不受影響。
- 相依：不需 hospital-lab-patterns 先發版（這次不從 catalog 來）。
- 架構債（下次處理）：
  - viewer manifest 已把 HBsAg / AntiHBs / HCV 標 `pattern:null +
    computed:'<id>'`，意圖是「定性顯示走 computed」，但 computed 函式
    尚未實作，實際走 `report.js` 硬編。長期應該把 `findHepatitis` /
    `findAntiHBs` 邏輯搬進 `patterns-computed.js`，讓 viewer / reporter
    共用同一份。
  - `findAntiHBs` 的 polarity 與 HBsAg / HCV 相反（Reactive = 有抗體
    為正常），未來搬進 computed.js 時需要 polarity 參數化。

## 2026-05-05 — Sync vhyl 5 條 regex 放寬（HBsAg / AntiHCV / AFP / TSAT / Fe）

- 作者：claude（與 YC 共同）
- 範圍：sync-script
- 變更：重 sync（不改 viewer 自身邏輯）
- 檔案：
  - 重跑 `node sync-patterns.js`，從 sibling repo
    `hospital-lab-patterns`（commit `58eed17`）拉取最新 catalog。
  - `mapping.js`：新版 `Synced at: 2026-05-05T15:06:34.085Z`。HBsAg、
    AntiHCV、AFP、TSAT、Fe 共 5 個 entry 的 `pattern` 已更新（每個 entry
    上方帶 `// vhyl sample (2026-05-05): ...` 註解）。
  - `normalizers.js`、`patterns-computed.js`：banner timestamp 刷新；
    內容無實質變動（patterns repo 這次只動 catalog）。
- 原因：
  - 使用者回報 vhyl 病人 000151649A 的 HBsAg / Anti-HCV / AFP、
    000051055E 的 Fe 在 reporter 漏顯示；連帶發現 TSAT 舊 regex
    `/SAT:/` 對 vhyl 的 `TS:` label 不命中。
  - patterns repo 已於 2026-05-05 push commit `58eed17`，依跨 repo
    副作用清單，viewer 必須重 sync 以保 offline fallback 與線上 OPD
    （透過 24h fetch `dist/patterns.json`）兩條路徑都拿到新 regex。
- 驗證：
  - `git diff mapping.js` 確認 5 條 pattern 全部正確替換、註解已帶入。
  - patterns repo 端的 `npm run release` + spot-check（18/18 pass）已
    覆蓋 regex 行為驗證；viewer 端只是純粹 re-bundle，無新 logic。
- 影響：
  - OPD 端 chrome extension 透過 `pattern-loader.js` 在 24 小時內會
    自動從 GitHub raw fetch 新版 `dist/patterns.json`，不需 redeploy
    zip；但 bundled `mapping.js` 仍同步更新，以保 offline fallback
    與線上版一致。
  - 若需立即生效，可在 popup 點擊 freshness badge 強制 refresh，或
    重 reload 擴充功能。

## 2026-05-05 — Milestone snapshot：sync from patterns + 重新打包 zip + 首次 push 上 GitHub

- 作者：claude（與 YC 共同）
- 範圍：sync-script、manifest
- 變更：修改（sync timestamp 刷新；不動 runtime logic）
- 檔案：
  - 重跑 `node sync-patterns.js` → 重新生成
    `mapping.js` / `normalizers.js` / `patterns-computed.js`（皆從
    sibling repo `hospital-lab-patterns` 拉取）。本次內容與上一版
    相同，只更新 banner 中的 `Synced at:` 時間戳。
  - `..\hospital-lab-viewer.zip`：依 `CLAUDE.md` 規則重新打包，供 OPD
    分發。**內含 `pattern-loader.js`**：popup.html 第 288 行於 runtime
    載入，且 popup.js 第 636 行呼叫 `window.loadPatterns(forceRefresh)`，
    若漏掉會 `TypeError`。
- 原因：
  - 距離 OPD 上次安裝已過一段時間，把 milestone 收尾並把現行版本
    rebuild 成乾淨快照供分發。
  - 同步 `hospital-lab-reporter` 在 2026-05-05 push 的 milestone 時程，
    讓兩邊 sibling repo 一起推。
- 測試：
  - 已由 YC 在 `chrome://extensions` reload 擴充功能、開啟 popup 確認
    freshness badge 顯示符合預期（✓ fresh / 📦 cached / ⚠ stale 視
    快取狀態而定）。
- 相依：
  - `hospital-lab-patterns` 在這個 milestone 沒有新發版；只是重新拉
    一次 snapshot。
- 行政：
  - 此為 viewer repo 的**第一筆 git 紀錄**：原本本機目錄沒有 `.git`，
    GitHub 上也尚未開倉（`Yuchunchen/hospital-lab-viewer` 不存在）。
    本次清掉兩個 stray 檔（`CLAUDE.md.tmp.22252.*` 與 `zioIHwqw`
    一個無副檔名的舊 zip）後 `git init -b main`，並由 `gh repo create`
    開立公開倉。
