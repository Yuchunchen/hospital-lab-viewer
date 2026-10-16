<p align="center"><img src="icon128.png" width="96" alt="玉鳳台院內報告小幫手"></p>

# 玉鳳台院內報告小幫手｜hospital-lab-viewer

> **保護病患資料是本工具的前提**
> - **只在院內網路、只用醫院既有系統**：資料來源是院內 ernode 醫令查詢與 opdweb 報告頁，需填操作人員代號（OPSID）；院外或 VPN 外打不開。本工具不提供任何繞過院內權限的方式。
> - **不設伺服器、不回傳病患資料**：查過的報告只快取在**這台電腦的 Chrome**（IndexedDB，6 小時內重用），不上傳到任何自建伺服器，沒有分析或追蹤程式。
> - **唯一固定的對外連線是下載公開規則**：每 24 小時從 GitHub 下載 `patterns.json`（判讀規則與參考值，不帶任何病患資料）。
> - **健檢影像報告翻譯預設不連網**（mock 模式）。若在健檢報告視窗改用 Gemini／Claude／OpenAI，**影像報告內文會送到該服務**；啟用前請確認符合院內資安規範。

門診打開小幫手 → 輸入病歷號（可多位）→ 一鍵產生病人衛教用的檢驗報告單（A4 橫式，彩色或黑白），異常值依本院區參考值標示。同一個入口也能開「DM 腎病個案管理」批次篩檢與「健檢報告」批次翻譯。版本與變更見 `WORKLOG.md`。

- **報告查詢與列印**：單人或多人批次；🎨 彩色（紅＝高、藍＝低）／🖨️ 黑白（粗體＋底線／粗體＋斜體）；另有 A5 單表版型。
- **腎臟病分期**：eGFR（CKD-EPI 2021）→ CKD 分期 → KDIGO 風險 → 臺灣 CKD 分類 → 早期 CKD 收案判定；UACR／UPCR 分級。
- **肝炎、HIV 區塊**：HBsAg／Anti-HBs／Anti-HCV 定性加效價；HIV 區塊可勾選開關。
- **參考值依院區、性別、年齡與時間**：玉里與臺東試劑不同，參考值分開維護；改版前後的報告用當時的參考值判讀。
- **📊 DM 腎病個案管理**：貼一串病歷號批次篩檢 UACR／血糖／HbA1c／Cr、EKG／ABI／PVR／眼底、DM 衛教，判斷四種收案資格，可匯出 CSV、批次列印。
- **🩻 健檢報告**：CXR／骨密（BMD）／冠脈鈣化（CAC）／低劑量肺 CT（LDCT）報告批次整理成中文白話摘要，標出異常。
- **規則自動更新**：判讀規則來自 [hospital-lab-patterns](https://github.com/Yuchunchen/hospital-lab-patterns)，門診電腦 24 小時內自動拿到新版，**不用重新安裝外掛**；外掛程式本身改版才需要重跑下方腳本。

## 環境需求

- 院內網路可連 ernode（`http://ernode.vghb12.<院區>.gov.tw:8000`）與 opdweb 報告頁。
- Chrome 102 以上（Windows 10／11）。
- 操作人員代號（OPSID）。
- 可連 GitHub（下載外掛與每日規則）：`github.com`、`codeload.github.com`、`raw.githubusercontent.com`。若院內擋 GitHub，外掛仍可用內建規則，只是不會自動更新。

## 院內安裝（未封裝）

### 一鍵下載（PowerShell）
Windows「開始」→ 輸入 `powershell` → 開「Windows PowerShell」→ 把下面整段貼上（Ctrl+V 或按右鍵）→ 按 Enter。不需要系統管理員權限；Windows PowerShell 5.1（Windows 10／11 內建）即可。

腳本會：
1. 從 GitHub 下載本 repo `main` 分支最新程式（zip）。
2. 解壓到**桌面\hospital-lab-viewer**（桌面被 OneDrive 重導也找得到）。資料夾已存在就**保留同一個資料夾、只清空內容再放新檔**；確認 `桌面\hospital-lab-viewer\manifest.json` 存在，否則報錯停止。
3. 安全檢查：桌面同名資料夾若是別的東西、或是 git 開發目錄，**不刪、直接停止**。
4. 把資料夾路徑複製到剪貼簿，用 Chrome 開 `chrome://extensions`，並印出下一步。

<!-- install.ps1 開始：與 scripts/install.ps1 內容相同，改一邊要同步另一邊 -->
```powershell
# 玉鳳台院內報告小幫手（hospital-lab-viewer）下載安裝/更新（Windows PowerShell 5.1 以上）：整段貼進 PowerShell 視窗後按 Enter。
# 下載 GitHub main 分支最新程式 → 桌面\hospital-lab-viewer。更新時資料夾路徑不變、只換內容（路徑決定外掛 ID，換路徑設定會遺失）。
# 不改登錄檔、不改 Chrome 設定；最後一步（載入/重新載入）需在 Chrome 手動按。
& {
  [Net.ServicePointManager]::SecurityProtocol = 'Tls12'
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  $repo = 'Yuchunchen/hospital-lab-viewer'
  $branch = 'main'
  $folder = 'hospital-lab-viewer'
  $marker = '院內報告小幫手'
  $ua = @{ 'User-Agent' = 'hospital-lab-viewer-install' }
  function Fail($why, $hint) {
    Write-Host ''
    Write-Host "失敗：$why" -ForegroundColor Red
    if ($hint) { Write-Host $hint -ForegroundColor Yellow }
  }
  $net = '可能是院內網路擋 GitHub：請資訊室開放 github.com、codeload.github.com、raw.githubusercontent.com，或改用可連外的電腦下載 zip（見 README「手動安裝」）。'
  $desktop = [Environment]::GetFolderPath('Desktop')
  if (-not $desktop) { Fail '找不到桌面資料夾。' '請改用 README「手動安裝」步驟。'; return }
  $dest = Join-Path $desktop $folder
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('hlv-' + [Guid]::NewGuid().ToString('N'))
  # 公司代理伺服器需要登入時，用目前 Windows 帳號
  try { [Net.WebRequest]::DefaultWebProxy.Credentials = [Net.CredentialCache]::DefaultNetworkCredentials } catch { }
  try {
    Write-Host "1/3 下載 $repo（$branch 分支）…"
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    $zip = Join-Path $tmp "$folder.zip"
    try {
      Invoke-WebRequest -UseBasicParsing -Headers $ua -Uri "https://github.com/$repo/archive/refs/heads/$branch.zip" -OutFile $zip
    } catch { Fail "下載失敗：$($_.Exception.Message)" $net; return }
    Write-Host '2/3 解壓縮…'
    $stage = Join-Path $tmp 'unzip'
    try { Expand-Archive -LiteralPath $zip -DestinationPath $stage -Force } catch { Fail "解壓縮失敗：$($_.Exception.Message)" '請重新執行；持續發生請回報維護者。'; return }
    # GitHub 分支 zip 會多包一層 hospital-lab-viewer-main\，往下找到 manifest.json 所在層
    $root = $stage
    for ($i = 0; $i -lt 3 -and -not (Test-Path -LiteralPath (Join-Path $root 'manifest.json')); $i++) {
      $sub = @(Get-ChildItem -LiteralPath $root -Force | Where-Object { $_.Name -ne '__MACOSX' })
      if ($sub.Count -eq 1 -and $sub[0].PSIsContainer) { $root = $sub[0].FullName } else { break }
    }
    $mf = Join-Path $root 'manifest.json'
    if (-not (Test-Path -LiteralPath $mf)) { Fail 'zip 內找不到 manifest.json。' '請回報維護者。'; return }
    $man = Get-Content -LiteralPath $mf -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($man.name -notmatch $marker) { Fail "zip 內的外掛名稱是「$($man.name)」，不是$marker，未安裝。" '請回報維護者。'; return }
    $ver = $man.version
    Write-Host "3/3 放到 $dest …"
    try {
      if (Test-Path -LiteralPath $dest) {
        if (Test-Path -LiteralPath (Join-Path $dest '.git')) { Fail "$dest 是 git 工作目錄（開發用），為避免覆蓋已停止。" '門診電腦請把該資料夾改名後再執行；開發電腦請用 git pull 更新。'; return }
        $old = @(Get-ChildItem -LiteralPath $dest -Force)
        $oldName = ''
        if (Test-Path -LiteralPath (Join-Path $dest 'manifest.json')) { try { $oldName = (Get-Content -LiteralPath (Join-Path $dest 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json).name } catch { } }
        if ($old.Count -gt 0 -and $oldName -notmatch $marker) { Fail "$dest 裡已有其他檔案，不是$marker，為避免誤刪已停止。" '請確認該資料夾內容後自行清空或改名，再重新執行。'; return }
        # 保留資料夾本身（路徑 = 外掛 ID），只清空內容
        $old | Remove-Item -Recurse -Force
      } else {
        New-Item -ItemType Directory -Path $dest | Out-Null
      }
      # 先放 manifest.json：中途失敗時資料夾仍認得出是本外掛，可直接重跑
      Copy-Item -LiteralPath $mf -Destination $dest -Force
      Get-ChildItem -LiteralPath $root -Force | Where-Object { $_.Name -ne 'manifest.json' } | Copy-Item -Destination $dest -Recurse -Force
    } catch {
      $e = $_.Exception
      if ($e -is [UnauthorizedAccessException] -or $e -is [Security.SecurityException]) { Fail "沒有寫入權限：$dest" '可能是桌面被院內政策鎖定或被防毒「受控資料夾存取」阻擋，請資訊室協助。' }
      elseif ($e -is [IO.IOException]) { Fail "無法寫入 ${dest}：$($e.Message)" '請關閉開著該資料夾的檔案總管視窗後重新執行。' }
      else { Fail "無法寫入 ${dest}：$($e.Message)" }
      return
    }
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'manifest.json'))) { Fail "$dest\manifest.json 不存在，安裝未完成。" '請重新執行；持續發生請回報維護者。'; return }
    $clip = ''
    try { Set-Clipboard -Value $dest; $clip = '（路徑已複製到剪貼簿）' } catch { }
    $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    $opened = $false
    if ($chrome) { try { Start-Process -FilePath $chrome -ArgumentList 'chrome://extensions'; $opened = $true } catch { } }
    Write-Host ''
    if (-not $opened) { Write-Host '找不到 Chrome：請自行開 Chrome，網址列輸入 chrome://extensions。' -ForegroundColor Yellow }
    Write-Host "已下載 $marker v$ver 到 $dest $clip" -ForegroundColor Green
    Write-Host '首次安裝：在 chrome://extensions 右上開「開發人員模式」→ 按「載入未封裝項目」→ 貼上路徑（Ctrl+V）→「選擇資料夾」；再按工具列拼圖圖示把小幫手釘選，並到「選項」填 API 網址與 OPSID。'
    Write-Host '更新：在擴充功能頁找到小幫手，按「重新載入」（圓形箭頭）；設定會保留。'
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}
```
<!-- install.ps1 結束 -->

| 腳本訊息 | 原因與處理 |
|---|---|
| 下載失敗 | 院內網路擋 GitHub。請資訊室開放 `github.com`、`codeload.github.com`、`raw.githubusercontent.com`，或在可連外的電腦下載 zip 後照下方「手動安裝」。 |
| 裡已有其他檔案，不是院內報告小幫手 | 桌面已有同名資料夾，腳本不刪；確認內容後自行清空或改名再跑。 |
| 是 git 工作目錄（開發用） | 這台是開發機，桌面放的是 git clone；請改用 `git pull` 更新，或把該資料夾改名。 |
| 沒有寫入權限 | 桌面被院內政策鎖定或防毒「受控資料夾存取」阻擋，請資訊室協助。 |
| 無法寫入（IOException） | 有檔案總管視窗開著該資料夾；關掉後重跑。 |
| 找不到 Chrome | 檔案已放好；自行開 Chrome，網址列輸入 `chrome://extensions`。 |
| 「載入未封裝項目」反灰或不見 | 院內政策停用了開發人員模式，需資訊室協助。 |

### 載入外掛到 Chrome（開發人員模式）並釘選到工具列

腳本或手動解壓後，資料夾應在**桌面\hospital-lab-viewer**，裡面直接看得到 `manifest.json`。首次安裝照下列步驟（更新只需按「重新載入」，不用重做）：

1. 開 Chrome，網址列輸入 `chrome://extensions` 按 Enter。
2. 右上角把**開發人員模式**打開（開關變藍色）。
3. 左上出現「**載入未封裝項目**」，按它。
4. 在檔案視窗左側點**桌面**，選 **hospital-lab-viewer** 資料夾（要選到有 `manifest.json` 的那一層，不要再點進子資料夾），按「選擇資料夾」。
5. 擴充功能頁出現「玉鳳台院內報告小幫手」卡片、開關為開，表示安裝完成。若卡片顯示紅色錯誤，多半是選錯層，回到步驟 3 重選。
6. **釘選**：按 Chrome 網址列右側的**拼圖圖示**（擴充功能），找到小幫手，按右邊的**圖釘**（變藍色）。

注意：資料夾**不要搬移、改名**。路徑決定外掛 ID，搬動後 Chrome 會當成新外掛，設定會不見。

### 首次設定
在小幫手圖示按右鍵 →「選項」：

| 欄位 | 填什麼 |
|---|---|
| API 伺服器網址 | 臺東：`http://ernode.vghb12.vhtt.gov.tw:8000`（預設）；玉里：`http://ernode.vghb12.vhyl.gov.tw:8000` |
| 操作人員代號（OPSID） | 自己的操作人員代號（必填） |
| 報告表頭 | 列印單頁首，例：臺北榮民總醫院玉里分院門診報告 |
| 本機院區 | 臺東分院（vhtt）或玉里分院（vhyl）。決定用哪一院的參考值判讀，**一定要選對**。首次開 popup 也會問一次。 |

按「儲存」。之後點小幫手圖示 → 輸入病歷號 →「報告查詢」即可。

### 手動安裝
1. 在可連外的電腦開 <https://github.com/Yuchunchen/hospital-lab-viewer> → 綠色「Code」→「Download ZIP」。
2. 解壓後會得到 `hospital-lab-viewer-main` 資料夾；把**裡面的檔案**放到 `桌面\hospital-lab-viewer`（確認該資料夾裡直接看得到 `manifest.json`）。
3. 照上面「載入外掛到 Chrome」與「首次設定」。

### 更新
- **規則／參考值**：不用做任何事，24 小時內自動更新。想立刻更新：開 popup，點右上角規則狀態圖示強制重抓。
- **外掛程式**：再貼一次上面那段腳本 → `chrome://extensions` 在小幫手卡片按「重新載入」（圓形箭頭）。設定會保留。
- **手動**：下載新 zip，**覆蓋同一個資料夾**（路徑不變）→ 按「重新載入」。

### 回報問題
院區／電腦、外掛版號（`chrome://extensions` 卡片上）、病歷號以外的操作步驟、截圖、F12 Console 錯誤訊息。**不要把病歷號、姓名、報告內容貼到 GitHub issue**，請私下提供。

## 開發者

判讀規則、參考值與計算值全部來自 sibling repo [hospital-lab-patterns](https://github.com/Yuchunchen/hospital-lab-patterns)。`mapping.js`、`normalizers.js`、`patterns-computed.js` 由 `node sync-patterns.js` 產生，**不要手改**。

```powershell
# patterns 改完後（在 hospital-lab-viewer 資料夾）
node sync-patterns.js
# 開發機直接載入 git 工作目錄：chrome://extensions → 載入未封裝項目 → 選本資料夾
```

```
hospital-lab-viewer/
├── manifest.json             Chrome 擴充功能 manifest（MV3）
├── popup.html / popup.js     主入口：病歷號輸入、報告查詢、開 Dashboard／健檢報告
├── report.js                 列印用報告單（A4 橫式、A5 單表）
├── report-viewer.html/js     列印用 iframe 檢視頁
├── lab-core.js               ernode／opdweb 抓取、IndexedDB 快取、子頁補值
├── pattern-loader.js         執行期抓 dist/patterns.json（24h 快取）
├── mapping.js                自動產生：內建規則（離線備援）
├── normalizers.js            自動產生：單位換算
├── patterns-computed.js      自動產生：eGFR、CKD 分期、肝炎等計算值
├── dashboard.html/js         DM 腎病個案管理（批次篩檢）
├── cxr.html / cxr.js         健檢影像報告批次翻譯
├── llm-translate.js          翻譯後端（mock／Gemini／Claude／OpenAI）
├── options.html / options.js 設定頁
├── scripts/install.ps1       一鍵下載腳本（與本 README 內嵌版相同）
├── sync-patterns.js          從 hospital-lab-patterns 重產自動產生檔
├── CLAUDE.md                 給 Claude 的 repo 規則
└── WORKLOG.md                變更紀錄（繁體中文）
```

隱私：**永遠不要 commit 真實病歷號、姓名或 API 回應**；`examples/`、`data/` 已列入 `.gitignore`。

## 授權

院內使用（Proprietary / internal use）。
