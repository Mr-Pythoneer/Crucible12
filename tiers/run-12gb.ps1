<#
.SYNOPSIS
    Toned-down preset for 10-12GB-VRAM cards (RTX 3060 12GB / 4070 / 5070-class) with
    16GB+ RAM. NOT for the 5090 box — use the main setup/ presets there.

.DESCRIPTION
    Fills the gap between the 7B tier and the 30B-A3B tier: Qwen2.5-Coder-14B-Instruct
    @ Q4_K_M (~9GB), fully resident on the GPU with several GB of VRAM left for the KV
    cache. Meaningfully stronger coding quality than the 7B tier for not much more
    download size; still a dense (non-MoE) model so it's noticeably slower token-for-
    token than the MoE presets, but everything here fits in VRAM alone so it stays fast
    in practice. Tool-calling reliability is better than 7B but still below the
    30B-A3B/Qwen3-Coder-Next tiers — it's a real step up, not a replacement for them.

    Download the weights first (from the repo root): .\setup\02-download-models.ps1 -Preset medium

    UNTESTED — written without access to this tier of hardware.
#>
[CmdletBinding()]
param(
    [int]$CtxSize = 32768,
    [int]$Port = 8080,
    [string]$ModelDir = (Join-Path $PSScriptRoot "..\models\medium")
)

$ErrorActionPreference = "Stop"

$serverExe = Get-ChildItem -Path (Join-Path $PSScriptRoot "..\bin\llama.cpp") -Recurse -Filter "llama-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $serverExe) { throw "llama-server.exe not found. Run ..\setup\01-install-llamacpp.ps1 first." }

$modelFile = Get-ChildItem -Path $ModelDir -Filter "*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $modelFile) { throw "No GGUF found in $ModelDir. From the repo root, run: .\setup\02-download-models.ps1 -Preset medium" }

Write-Host "Model: $($modelFile.FullName)" -ForegroundColor Green
Write-Host "NOTE:  14B dense model — the best balance of quality and VRAM footprint between the 7B and 30B-A3B tiers." -ForegroundColor Green

& $serverExe.FullName `
    --model $modelFile.FullName `
    --host 127.0.0.1 --port $Port `
    -ngl 99 `
    --ctx-size $CtxSize `
    --flash-attn on `
    --cache-type-k q8_0 --cache-type-v q8_0 `
    --jinja `
    --temp 0.7 --top-p 0.8 --top-k 20 --repeat-penalty 1.05
