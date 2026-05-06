# WORKLOG

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
