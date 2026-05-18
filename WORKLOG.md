# WORKLOG

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
