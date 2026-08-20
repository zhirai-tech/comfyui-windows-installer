param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$CudaVersion,
    [Parameter(Mandatory = $true)][string]$PyTorchVersion,
    [Parameter(Mandatory = $true)][string]$IndexUrl,
    [int]$VramGB = 0
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Log($m) { Write-Host ("[install-pytorch] " + $m) }

$venvPython = Join-Path $InstallDir "venv\Scripts\python.exe"
$venvPip = Join-Path $InstallDir "venv\Scripts\pip.exe"

if (-not (Test-Path $venvPython)) {
    Write-Error ("venv python not found: " + $venvPython)
    exit 1
}

Write-Log ("venv python: " + $venvPython)
Write-Log ("CUDA=$CudaVersion PyTorch=$PyTorchVersion Index=$IndexUrl")

& $venvPython -m pip install --upgrade pip setuptools wheel 2>&1 | ForEach-Object { Write-Log $_ }
if ($LASTEXITCODE -ne 0) {
    Write-Log ("pip upgrade exit=$LASTEXITCODE, still continue")
}

function Get-TorchvisionVer($ptVer) {
    $parts = $ptVer -split '\.'
    $major = [int]$parts[0]; $minor = [int]$parts[1]; $patch = [int]$parts[2]
    switch ($minor) {
        3 { return "0.18.$patch" }
        4 { return "0.19.$patch" }
        5 { return "0.20.$patch" }
        default { return "0.$($minor + 15).$patch" }
    }
}
function Get-TorchaudioVer($ptVer) {
    $parts = $ptVer -split '\.'
    $major = [int]$parts[0]; $minor = [int]$parts[1]; $patch = [int]$parts[2]
    return "$major.$minor.$patch"
}

$tvVer = Get-TorchvisionVer $PyTorchVersion
$taVer = Get-TorchaudioVer $PyTorchVersion

if ($CudaVersion -eq "cpu") {
    $torchPkg = "torch==$PyTorchVersion+cpu"
    $tvPkg = "torchvision"
    $taPkg = "torchaudio"
} else {
    $torchPkg = "torch==$PyTorchVersion+$CudaVersion"
    $tvPkg = "torchvision==$tvVer+$CudaVersion"
    $taPkg = "torchaudio==$taVer+$CudaVersion"
}

$attempts = 3
$extraIndex = "https://pypi.tuna.tsinghua.edu.cn/simple"
$mirrors = @(
    $IndexUrl,
    "https://download.pytorch.org/whl/$CudaVersion",
    "https://mirrors.aliyun.com/pytorch-windows/whl/$CudaVersion",
    "https://mirrors.tuna.tsinghua.edu.cn/pytorch/wheels/$CudaVersion"
)

function Try-InstallPackages($pkgs, $idx, $noDeps) {
    $argsList = @(
        "install",
        "--no-input",
        "--retries", "3",
        "--timeout", "300",
        "--progress-bar", "off",
        "--index-url", $idx,
        "--extra-index-url", $extraIndex
    )
    if ($noDeps) { $argsList += "--no-deps" }
    $argsList += $pkgs
    & $venvPip @argsList 2>&1 | ForEach-Object { Write-Log $_ }
    return $LASTEXITCODE
}

for ($i = 1; $i -le $attempts; $i++) {
    Write-Log ("Attempt $i / $attempts installing PyTorch...")

    foreach ($idx in $mirrors) {
        Write-Log ("Looking in indexes: `$idx, `$extraIndex")

        $code = Try-InstallPackages -pkgs @($torchPkg, $tvPkg, $taPkg) -idx $idx -noDeps $false
        Write-Log ("pip exit code: " + $code)
        if ($code -eq 0) { break }

        Write-Log ("Whole install failed, fallback: install torch only first...")
        $code2 = Try-InstallPackages -pkgs @($torchPkg) -idx $idx -noDeps $false
        Write-Log ("pip (torch only) exit code: " + $code2)
        if ($code2 -eq 0) {
            $code3 = Try-InstallPackages -pkgs @($tvPkg, $taPkg) -idx $idx -noDeps $false
            Write-Log ("pip (vision+audio) exit code: " + $code3)
            if ($code3 -eq 0) { $code = 0; break }
        }

        Write-Log ("Packages install failed, try --no-deps fallback...")
        $codeA = Try-InstallPackages -pkgs @($torchPkg) -idx $idx -noDeps $true
        Write-Log ("pip --no-deps torch exit code: " + $codeA)
        if ($codeA -eq 0) {
            $codeB = Try-InstallPackages -pkgs @($tvPkg) -idx $idx -noDeps $true
            $codeC = Try-InstallPackages -pkgs @($taPkg) -idx $idx -noDeps $true
            Write-Log ("pip --no-deps tv/ta exit code: $codeB / $codeC")
            if ($codeB -eq 0 -and $codeC -eq 0) { $code = 0; break }
        }
    }

    if ($code -eq 0) {
        $checkOut = & $venvPython -c "import torch;print('cuda=' + str(torch.cuda.is_available()));print('ver=' + torch.__version__)" 2>&1
        Write-Log $checkOut
        Write-Host "__RESULT__OK"
        exit 0
    }
    Write-Log ("Attempt $i failed (exit=$code), will retry")
}

Write-Error "PyTorch install failed (check network or install manually)"
exit 1
