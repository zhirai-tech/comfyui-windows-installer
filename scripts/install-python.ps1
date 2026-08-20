param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$PythonVersion,
    [Parameter(Mandatory = $true)][string]$Mirror
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Log($m) { Write-Host ("[install-python] " + $m) }

Write-Log "PythonVersion=$PythonVersion Mirror=$Mirror"
Write-Log "InstallDir=$InstallDir"

$staging = Join-Path $InstallDir "_installer"
$target = Join-Path $InstallDir "python_embedded"

$null = New-Item -ItemType Directory -Force -Path $staging, $target

$verParts = $PythonVersion -split '\.'
$major = $verParts[0]; $minor = $verParts[1]; $patch = $verParts[2]

$baseName = "python-$PythonVersion-embed-amd64.zip"
$urls = @(
    "$Mirror/$PythonVersion/$baseName",
    "https://www.python.org/ftp/python/$PythonVersion/$baseName",
    "https://mirrors.huaweicloud.com/python/$PythonVersion/$baseName"
)

$zipPath = Join-Path $staging $baseName

$ok = $false
foreach ($url in $urls) {
    Write-Log ("Trying download: " + $url)
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zipPath -TimeoutSec 180
        if (Test-Path $zipPath -and (Get-Item $zipPath).Length -gt 5MB) {
            $ok = $true
            Write-Log "Download OK"
            break
        }
    }
    catch {
        Write-Log ("Download failed: " + $_.Exception.Message)
    }
}

if (-not $ok) { Write-Error "All python mirror downloads failed"; exit 1 }

Write-Log ("Extract to: " + $target)
Expand-Archive -Path $zipPath -DestinationPath $target -Force

$pythonExe = Join-Path $target "python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Error "Extraction failed: python.exe not found"; exit 1
}

$pipBootstrap = @"
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
"@

$getPipUrl = "https://bootstrap.pypa.io/get-pip.py"
$getPip = Join-Path $staging "get-pip.py"
try {
    Invoke-WebRequest -UseBasicParsing -Uri $getPipUrl -OutFile $getPip -TimeoutSec 120
    & $pythonExe $getPip
    & $pythonExe -m pip install --upgrade pip
} catch {
    Write-Log ("pip bootstrap skipped (venv will handle later): " + $_.Exception.Message)
}

Write-Log ("Finished. Python path: " + $pythonExe)
Write-Host "__RESULT__OK"
