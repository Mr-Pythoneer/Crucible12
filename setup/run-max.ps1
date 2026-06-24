<#
.SYNOPSIS
    Launches llama-server with the "max" preset: Qwen3-Coder-Next at UD-Q6_K_XL —
    the most powerful config that's still a fast, reliable agentic coder on this box.

.DESCRIPTION
    Same model as the "crucible" preset (80B total / 3B active MoE, RL-tuned for
    tool-calling) but at near-lossless Q6 instead of Q4. Captures ~80-90% of the
    remaining quality gap to full precision (Unsloth UD KL-divergence ~0.14 vs ~0.41
    at Q4) for only a ~10-25% speed cost — and crucially, IDENTICAL tool-calling
    reliability, because it's the same model just less rounded.

    Q6 weights (~73GB) are ~23GB larger than the Q4 default, so MORE leading MoE
    layers must be offloaded to system RAM: --n-cpu-moe defaults to 26 here vs 16
    for the Q4 preset. Tune as described below.

    *** REQUIRES DDR5 EXPO/XMP ENABLED IN BIOS. *** Generation here is RAM-bandwidth-
    bound; without EXPO, throughput can collapse ~3x (measured ~10 -> 30 tok/s purely
    from enabling it). This is the single highest-impact setting on this machine.

.PARAMETER CpuMoe
    Leading MoE layers whose experts offload to CPU RAM. Default: 26.
    Watch nvidia-smi and LOWER until VRAM sits ~30GB with a few GB of KV headroom.
    RAISE if you hit CUDA out-of-memory at startup.
#>
[CmdletBinding()]
param(
    [int]$CpuMoe = 26,
    [int]$CtxSize = 131072,
    [int]$Port = 8080,
    [string]$ModelDir = (Join-Path $PSScriptRoot "..\models\max")
)

$ErrorActionPreference = "Stop"

$serverExe = Get-ChildItem -Path (Join-Path $PSScriptRoot "..\bin\llama.cpp") -Recurse -Filter "llama-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $serverExe) { throw "llama-server.exe not found. Run 01-install-llamacpp.ps1 first." }

$modelFile = Get-ChildItem -Path $ModelDir -Filter "*00001-of-*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $modelFile) { $modelFile = Get-ChildItem -Path $ModelDir -Filter "*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1 }
if (-not $modelFile) { throw "No GGUF found in $ModelDir. Run 02-download-models.ps1 -Preset max first." }

Write-Host "Model:     $($modelFile.FullName)" -ForegroundColor Green
Write-Host "n-cpu-moe: $CpuMoe (Q6 needs MORE offload than Q4 — lower until VRAM ~30GB, raise on CUDA OOM)" -ForegroundColor Yellow
Write-Host "REMINDER:  DDR5 EXPO/XMP must be ON in BIOS or generation speed drops ~3x." -ForegroundColor Magenta

& $serverExe.FullName `
    --model $modelFile.FullName `
    --host 127.0.0.1 --port $Port `
    -ngl 99 --n-cpu-moe $CpuMoe `
    --ctx-size $CtxSize `
    --flash-attn on `
    --cache-type-k q8_0 --cache-type-v q8_0 `
    --jinja `
    --temp 1.0 --top-p 0.95 --min-p 0.01 --top-k 40 `
    --threads 16 `
    --mlock
