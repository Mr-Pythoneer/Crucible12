<#
.SYNOPSIS
    Downloads the GGUF model weights for the Crucible12 presets.

.DESCRIPTION
    Queries the Hugging Face API for each model repo's file list and downloads
    every file matching the chosen quant pattern (handles multi-part GGUF
    shards automatically — large MoE quants are often split into
    *-00001-of-000NN.gguf files).

    Presets (each model runs ONE AT A TIME — they don't coexist in 96GB of memory):
      crucible  Qwen3-Coder-Next @ Q4_K_XL  (~46GB) — DEFAULT, balanced agentic coder
      max       Qwen3-Coder-Next @ Q6_K_XL  (~73GB) — higher fidelity, a bit slower
      fast      Qwen3-Coder-30B-A3B @ Q4    (~18GB) — fully on GPU, lowest latency
      reasoning gpt-oss-120b native MXFP4   (~60GB) — strong reasoning SECONDARY

.PARAMETER Preset
    "crucible", "max", "fast", "reasoning", or "all". Default: crucible.

.PARAMETER ModelsDir
    Destination directory. Defaults to ..\models relative to this script.
#>
[CmdletBinding()]
param(
    [ValidateSet("crucible", "max", "fast", "reasoning", "all")]
    [string]$Preset = "crucible",

    [string]$ModelsDir = (Join-Path $PSScriptRoot "..\models")
)

$ErrorActionPreference = "Stop"

# Quant patterns are dynamic-quant ("UD-") variants — see README for size/quality tradeoffs.
$presets = @{
    max = @{
        Repo    = "unsloth/Qwen3-Coder-Next-GGUF"
        Pattern = "*UD-Q6_K_XL*"
        Notes   = "~73GB, near-lossless Q6 — recommended best agentic coder"
    }
    crucible = @{
        Repo    = "unsloth/Qwen3-Coder-Next-GGUF"
        Pattern = "*UD-Q4_K_XL*"
        Notes   = "~46GB, split across VRAM+RAM via --n-cpu-moe"
    }
    fast = @{
        Repo    = "unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF"
        Pattern = "*UD-Q4_K_XL*"
        Notes   = "~18-20GB, fits fully in the 5090's 32GB VRAM"
    }
    reasoning = @{
        Repo    = "ggml-org/gpt-oss-120b-GGUF"
        Pattern = "*mxfp4*"
        Notes   = "~60GB native MXFP4, strong reasoning SECONDARY"
    }
}

$targets = if ($Preset -eq "all") { $presets.Keys } else { @($Preset) }

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
Write-Host "Next: run 03-install-opencode.ps1, then a launch script (run-max.ps1 / run-crucible.ps1 / run-fast.ps1 / run-reasoning.ps1)."
Write-Host "Reminder: enable DDR5 EXPO/XMP in BIOS for full generation speed on the hybrid presets."
