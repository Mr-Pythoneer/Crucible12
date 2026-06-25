<#
.SYNOPSIS
    Toned-down preset for very low VRAM (4-6GB, e.g. RTX 3050/older GTX cards) with 8GB+ RAM.
    NOT for the 5090 box — use the main setup/ presets there.

.DESCRIPTION
    The smallest model in this repo — Qwen2.5-Coder-3B-Instruct @ Q4_K_M (~1.9GB) — fully
    resident on the GPU. Genuinely capable for small completions and simple edits, but
    honest caveat: at 3B, multi-step agentic tool-calling in OpenCode is meaningfully
    weaker than even the 7B tier — treat this as a fallback for hardware too small for
    anything else, not a daily driver if you have any other option (run-6gb.ps1 or up).

    Download the weights first (from the repo root): .\setup\02-download-models.ps1 -Preset tiny

    UNTESTED — written without access to this tier of hardware.
#>
[CmdletBinding()]
param(
    [int]$CtxSize = 16384,
    [int]$Port = 8080,
    [string]$ModelDir = (Join-Path $PSScriptRoot "..\models\tiny")
)

$ErrorActionPreference = "Stop"

$serverExe = Get-ChildItem -Path (Join-Path $PSScriptRoot "..\bin\llama.cpp") -Recurse -Filter "llama-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $serverExe) { throw "llama-server.exe not found. Run ..\setup\01-install-llamacpp.ps1 first." }

$modelFile = Get-ChildItem -Path $ModelDir -Filter "*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $modelFile) { throw "No GGUF found in $ModelDir. From the repo root, run: .\setup\02-download-models.ps1 -Preset tiny" }

Write-Host "Model: $($modelFile.FullName)" -ForegroundColor Green
Write-Host "NOTE:  3B model — the floor of this repo. Multi-step tool-calling will be the weakest of any tier here." -ForegroundColor Magenta

& $serverExe.FullName `
    --model $modelFile.FullName `
    --host 127.0.0.1 --port $Port `
    -ngl 99 `
    --ctx-size $CtxSize `
    --flash-attn on `
    --jinja `
    --temp 0.7 --top-p 0.8 --top-k 20 --repeat-penalty 1.05
