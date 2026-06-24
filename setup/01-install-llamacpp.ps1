<#
.SYNOPSIS
    Downloads the latest CUDA-enabled Windows build of llama.cpp.

.DESCRIPTION
    Pulls the newest release from ggml-org/llama.cpp, picks the prebuilt Windows
    CUDA asset (highest CUDA toolkit version available, which matters for
    Blackwell/RTX 50-series support), and extracts it to bin\llama.cpp.

    If no prebuilt CUDA asset is found (asset naming on the upstream repo does
    change occasionally), the script prints build-from-source instructions
    instead of guessing at a filename.

.PARAMETER InstallDir
    Where to extract the binaries. Defaults to ..\bin\llama.cpp relative to this script.
#>
[CmdletBinding()]
param(
    [string]$InstallDir = (Join-Path $PSScriptRoot "..\bin\llama.cpp")
)

$ErrorActionPreference = "Stop"

Write-Host "Querying latest llama.cpp release..." -ForegroundColor Cyan
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest" -Headers @{ "User-Agent" = "Crucible12-Setup" }

# Prefer the asset with the highest bundled CUDA toolkit version, e.g. "...-bin-win-cuda-12.8-x64.zip" / "...cu12.4-x64.zip"
$cudaAssets = $release.assets | Where-Object { $_.name -match "win.*cuda.*x64\.zip$" }

if (-not $cudaAssets) {
    Write-Warning "No prebuilt Windows CUDA asset found in release '$($release.tag_name)'."
    Write-Host @"
Build from source instead:
  1. Install Visual Studio 2022 Build Tools (Desktop C++ workload) and CMake.
  2. Install the CUDA Toolkit (12.8 or newer — required for Blackwell/RTX 50-series, sm_120).
  3. git clone https://github.com/ggml-org/llama.cpp
  4. cmake -B build -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=120 -DBUILD_SHARED_LIBS=OFF
  5. cmake --build build --config Release -j

See https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md for details.
"@
    exit 1
}

$asset = $cudaAssets |
    Sort-Object { [version]([regex]::Match($_.name, '(\d+\.\d+)').Value) } -Descending |
    Select-Object -First 1

Write-Host "Selected asset: $($asset.name)" -ForegroundColor Green

$zipPath = Join-Path $env:TEMP $asset.name
Write-Host "Downloading to $zipPath ..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath

if (Test-Path $InstallDir) {
    Write-Host "Removing existing install at $InstallDir ..."
    Remove-Item -Recurse -Force $InstallDir
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "Extracting to $InstallDir ..."
Expand-Archive -Path $zipPath -DestinationPath $InstallDir -Force
Remove-Item $zipPath

$serverExe = Get-ChildItem -Path $InstallDir -Recurse -Filter "llama-server.exe" | Select-Object -First 1
if (-not $serverExe) {
    Write-Warning "llama-server.exe not found after extraction — check $InstallDir manually."
    exit 1
}

Write-Host "`nInstalled: $($serverExe.FullName)" -ForegroundColor Green
Write-Host "Make sure your NVIDIA driver is recent enough for RTX 50-series / Blackwell (CUDA 12.8+)."
Write-Host "Next: run 02-download-models.ps1, then 03-install-opencode.ps1."
