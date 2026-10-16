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
