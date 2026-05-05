# WORKLOG

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
