# WORKLOG

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
