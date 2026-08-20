param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$RepoPrimary,
    [string]$RepoFallback,
    [string]$ZipMirror,
    [string]$ZipFallback,
    [string]$TargetRef = "master"
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# 强制 UTF-8 输出，避免中文 .NET 异常消息（如“远程服务器返回错误”）被编码成乱码
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding

function Write-Log($m) { Write-Host ("[install-comfyui] " + $m) }

$target = Join-Path $InstallDir "ComfyUI"
$staging = Join-Path $InstallDir "_installer"
$null = New-Item -ItemType Directory -Force -Path $staging
$targetRef = if ([string]::IsNullOrWhiteSpace($TargetRef)) { "master" } else { $TargetRef.Trim() }
$targetRefEncoded = [uri]::EscapeDataString($targetRef)

# 网络自动探测：国内走 gitee 镜像，海外走 github 官方源
function Test-HostLatency {
    param([string]$HostName)
    try {
        $ping = New-Object System.Net.NetworkInformation.Ping
        $reply = $ping.Send($HostName, 1500)
        if ($reply -and $reply.Status -eq [System.Net.NetworkInformation.IPStatus]::Success) {
            return [long]$reply.RoundtripTime
        }
    } catch {}
    return [long]::MaxValue
}

$giteeLat = Test-HostLatency "gitee.com"
$githubLat = Test-HostLatency "github.com"
Write-Log ("Network probe: gitee={0}ms github={1}ms" -f $giteeLat, $githubLat)

if ($RepoFallback -and $githubLat -lt $giteeLat -and $githubLat -ne [long]::MaxValue) {
    Write-Log "github is faster/reachable, prefer github source"
    $tmp = $RepoPrimary; $RepoPrimary = $RepoFallback; $RepoFallback = $tmp
    $tmpZ = $ZipMirror; $ZipMirror = $ZipFallback; $ZipFallback = $tmpZ
} else {
    Write-Log "using gitee-first source"
}

if (Test-Path (Join-Path $target "main.py")) {
    Write-Log "ComfyUI already installed, skipping download"
    Write-Host "__RESULT__OK"
    exit 0
}

# 清理失败残留的 ComfyUI 目录（有目录但无 main.py），避免 git clone 报 already exists
if (Test-Path $target) {
    Write-Log "Removing stale ComfyUI directory before re-download"
    Remove-Item $target -Recurse -Force
}

$gitOk = $false
try {
    $gitVer = & git --version 2>$null
    if ($LASTEXITCODE -eq 0) { $gitOk = $true }
} catch {}

if ($gitOk) {
    Write-Log "Git clone using: $RepoPrimary (ref=$targetRef)"
    Push-Location $InstallDir
    try {
        & git clone --depth 1 --branch $targetRef $RepoPrimary ComfyUI 2>&1 | ForEach-Object { Write-Log $_ }
        if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $target "main.py"))) {
            Pop-Location
            Write-Log "Git clone finished OK"
            Write-Host "__RESULT__OK"
            exit 0
        }
    } catch { Write-Log ("Git primary failed: " + $_.Exception.Message) }
    Pop-Location

    if ($RepoFallback) {
        Write-Log ("Git fallback: " + $RepoFallback + " (ref=" + $targetRef + ")")
        Push-Location $InstallDir
        try {
            & git clone --depth 1 --branch $targetRef $RepoFallback ComfyUI 2>&1 | ForEach-Object { Write-Log $_ }
            if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $target "main.py"))) {
                Pop-Location
                Write-Host "__RESULT__OK"
                exit 0
            }
        } catch {}
        Pop-Location
    }
}

Write-Log "Git not available or clone failed, falling back to ZIP download"

$zipPath = Join-Path $staging "ComfyUI.zip"
$urls = @()
if ($targetRef -eq "master") {
    if ($ZipMirror) { $urls += $ZipMirror }
    if ($ZipFallback) { $urls += $ZipFallback }
    $urls += @(
        "https://gitee.com/mirrors/ComfyUI/repository/archive/master.zip",
        "https://github.com/comfyanonymous/ComfyUI/archive/refs/heads/master.zip"
    )
} else {
    $urls += @(
        "https://gitee.com/mirrors/ComfyUI/repository/archive/$targetRefEncoded.zip",
        "https://github.com/comfyanonymous/ComfyUI/archive/refs/heads/$targetRefEncoded.zip",
        "https://github.com/comfyanonymous/ComfyUI/archive/refs/tags/$targetRefEncoded.zip"
    )
}
$urls = $urls | Select-Object -Unique

$ok = $false
foreach ($url in $urls) {
    Write-Log ("Downloading ZIP: " + $url)
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zipPath -TimeoutSec 300
        if (Test-Path $zipPath -and (Get-Item $zipPath).Length -gt 1MB) { $ok = $true; break }
    } catch { Write-Log ("ZIP download failed: " + $_.Exception.Message) }
}
if (-not $ok) { Write-Error "All ComfyUI download mirrors failed"; exit 1 }

$extractTemp = Join-Path $staging "comfyui_unpack"
if (Test-Path $extractTemp) { Remove-Item $extractTemp -Recurse -Force }
Expand-Archive -Path $zipPath -DestinationPath $extractTemp -Force

$inner = Get-ChildItem $extractTemp -Directory | Select-Object -First 1
if (-not $inner) { Write-Error "ZIP archive has no inner folder"; exit 1 }

if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Move-Item -Path $inner.FullName -Destination $target -Force

if (-not (Test-Path (Join-Path $target "main.py"))) {
    Write-Error "main.py not found after extraction"; exit 1
}
Write-Log "ZIP install finished OK"
Write-Host "__RESULT__OK"
