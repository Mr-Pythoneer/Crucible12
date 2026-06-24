<#
.SYNOPSIS
    Downloads the GGUF model weights for the "crucible" and/or "fast" presets.

.DESCRIPTION
    Queries the Hugging Face API for each model repo's file list and downloads
    every file matching the chosen quant pattern (handles multi-part GGUF
    shards automatically — large MoE quants are often split into
    *-00001-of-000NN.gguf files).

.PARAMETER Preset
    "crucible", "fast", or "both". Default: both.

.PARAMETER ModelsDir
    Destination directory. Defaults to ..\models relative to this script.
#>
[CmdletBinding()]
param(
    [ValidateSet("crucible", "fast", "both")]
    [string]$Preset = "both",

    [string]$ModelsDir = (Join-Path $PSScriptRoot "..\models")
)

$ErrorActionPreference = "Stop"

# Quant pattern is a dynamic-quant ("UD-") variant for both — see README for size/quality tradeoffs.
$presets = @{
    crucible = @{
        Repo    = "unsloth/Qwen3-Coder-Next-GGUF"
        Pattern = "*UD-Q4_K_XL*"
        Notes   = "~46GB total, split across VRAM+RAM via --n-cpu-moe"
    }
    fast = @{
        Repo    = "unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF"
        Pattern = "*UD-Q4_K_XL*"
        Notes   = "~18-20GB, fits fully in the 5090's 32GB VRAM"
    }
}

$targets = if ($Preset -eq "both") { $presets.Keys } else { @($Preset) }

New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null

foreach ($name in $targets) {
    $cfg = $presets[$name]
    Write-Host "`n=== $name : $($cfg.Repo) ($($cfg.Notes)) ===" -ForegroundColor Cyan

    $destDir = Join-Path $ModelsDir $name
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null

    Write-Host "Listing files matching '$($cfg.Pattern)' ..."
    $info = Invoke-RestMethod -Uri "https://huggingface.co/api/models/$($cfg.Repo)" -Headers @{ "User-Agent" = "Crucible12-Setup" }
    $files = $info.siblings.rfilename | Where-Object { $_ -like $cfg.Pattern -and $_ -like "*.gguf" }

    if (-not $files) {
        Write-Warning "No files matched '$($cfg.Pattern)' in $($cfg.Repo). Browse https://huggingface.co/$($cfg.Repo)/tree/main and adjust -Pattern, or edit this script."
        continue
    }

    foreach ($file in $files) {
        $outPath = Join-Path $destDir (Split-Path $file -Leaf)
        if (Test-Path $outPath) {
            Write-Host "Already have $file, skipping."
            continue
        }
        $url = "https://huggingface.co/$($cfg.Repo)/resolve/main/$file"
        Write-Host "Downloading $file ..."
        Invoke-WebRequest -Uri $url -OutFile $outPath
    }

    Write-Host "Done: $destDir" -ForegroundColor Green
}

Write-Host "`nModels saved under $ModelsDir (gitignored — never commit these)."
Write-Host "Next: run 03-install-opencode.ps1, then run-crucible.ps1 or run-fast.ps1."
