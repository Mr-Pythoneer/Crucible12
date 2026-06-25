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

    For tiers/ (lesser hardware) — the full Qwen2.5-Coder size ladder, not just one point:
      tiny      Qwen2.5-Coder-3B-Instruct   (~1.9GB) — 4-6GB VRAM, or fast CPU-only
      small     Qwen2.5-Coder-7B-Instruct   (~4.4GB) — 6-8GB VRAM
      medium    Qwen2.5-Coder-14B-Instruct  (~9GB)   — 10-12GB VRAM, fills the 7B->30B gap

    Downloads resume automatically if interrupted (uses Invoke-WebRequest -Resume,
    which requires PowerShell 6.1+ — run these scripts with `pwsh`, not legacy
    Windows PowerShell 5.1, or -Resume is silently ignored and re-downloads from 0).

.PARAMETER Preset
    "crucible", "max", "fast", "reasoning", "tiny", "small", "medium", or "all". Default: crucible.

.PARAMETER ModelsDir
    Destination directory. Defaults to ..\models relative to this script.
#>
[CmdletBinding()]
param(
    [ValidateSet("crucible", "max", "fast", "reasoning", "tiny", "small", "medium", "all")]
    [string]$Preset = "crucible",

    [string]$ModelsDir = (Join-Path $PSScriptRoot "..\models")
)

$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSVersion.Major -lt 6) {
    Write-Warning "You're running Windows PowerShell $($PSVersionTable.PSVersion) — these multi-GB downloads work much better under PowerShell 7+ (resume support, modern TLS). Install with 'winget install Microsoft.PowerShell' and re-run this script via 'pwsh', not 'powershell.exe'."
}

function Save-FileWithResume {
    param([string]$Url, [string]$OutFile, [int]$MaxRetries = 6)
    $prevProgressPref = $ProgressPreference
    $ProgressPreference = "SilentlyContinue"   # progress bar makes Invoke-WebRequest dramatically slower
    try {
        for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
            try {
                Invoke-WebRequest -Uri $Url -OutFile $OutFile -Resume
                return
            } catch {
                Write-Warning "Download attempt $attempt/$MaxRetries failed: $($_.Exception.Message)"
                if ($attempt -eq $MaxRetries) { throw }
                Start-Sleep -Seconds ([Math]::Min(60, 5 * $attempt))
            }
        }
    } finally {
        $ProgressPreference = $prevProgressPref
    }
}

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
    tiny = @{
        Repo    = "bartowski/Qwen2.5-Coder-3B-Instruct-GGUF"
        Pattern = "*Q4_K_M*"
        Notes   = "~1.9GB dense model — tiers/ configs for 4-6GB VRAM or fast CPU-only"
    }
    small = @{
        Repo    = "bartowski/Qwen2.5-Coder-7B-Instruct-GGUF"
        Pattern = "*Q4_K_M*"
        Notes   = "~4.4GB dense model — tiers/ configs for 6-8GB VRAM"
    }
    medium = @{
        Repo    = "bartowski/Qwen2.5-Coder-14B-Instruct-GGUF"
        Pattern = "*Q4_K_M*"
        Notes   = "~9GB dense model — tiers/ configs for 10-12GB VRAM (the 7B->30B gap)"
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
        Save-FileWithResume -Url $url -OutFile $outPath
    }

    Write-Host "Done: $destDir" -ForegroundColor Green
}

Write-Host "`nModels saved under $ModelsDir (gitignored — never commit these)."
Write-Host "Next: run 03-install-opencode.ps1, then a launch script (run-max.ps1 / run-crucible.ps1 / run-fast.ps1 / run-reasoning.ps1)."
Write-Host "Reminder: enable DDR5 EXPO/XMP in BIOS for full generation speed on the hybrid presets."
