<#
.SYNOPSIS
    No-GPU / laptop preset. CPU-only inference, no CUDA required at all.
    NOT for the 5090 box — use the main setup/ presets there.

.DESCRIPTION
    Defaults to the SMALLEST model in this repo — Qwen2.5-Coder-3B-Instruct @ Q4_K_M
    (~1.9GB) — run with -ngl 0 (no GPU layers) so it works on a machine with no
    dedicated GPU at all, or where you don't want to install the CUDA build from
    setup/01-install-llamacpp.ps1. 3B was picked as the default here (not 7B) because
    CPU-only generation speed scales down hard with size — start small and step up to
    -Preset small (7B, ~4.4GB) or -Preset medium (14B, ~9GB) via -ModelDir only if your
    CPU genuinely keeps up and you want the quality.

    You still need a llama.cpp build, just not a CUDA one — grab a plain CPU release from
    https://github.com/ggml-org/llama.cpp/releases (look for a "win-*-x64" asset WITHOUT
    "cuda" in the name) and point -ServerExe at it, or edit the discovery logic below.

    Honest expectations: CPU-only generation is commonly single-digit to low-double-digit
    tokens/sec even at 3B, depending on the CPU — noticeably slower than anything else in
    this repo, and the weakest model here for agentic tool-calling. There's no smaller
    preset in this repo to drop down to if it's still too slow; 3B is the floor.

    UNTESTED — written without access to this tier of hardware.
#>
[CmdletBinding()]
param(
    [int]$CtxSize = 8192,
    [int]$Port = 8080,
    [string]$ModelDir = (Join-Path $PSScriptRoot "..\models\tiny"),
    [string]$ServerExe = (Join-Path $PSScriptRoot "..\bin\llama.cpp")
)

$ErrorActionPreference = "Stop"

$exe = Get-ChildItem -Path $ServerExe -Recurse -Filter "llama-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $exe) { throw "llama-server.exe not found under $ServerExe. Grab a CPU-only build from https://github.com/ggml-org/llama.cpp/releases and point -ServerExe at its folder." }

$modelFile = Get-ChildItem -Path $ModelDir -Filter "*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $modelFile) { throw "No GGUF found in $ModelDir. From the repo root, run: .\setup\02-download-models.ps1 -Preset tiny" }

Write-Host "Model: $($modelFile.FullName)" -ForegroundColor Green
Write-Host "Mode:  CPU-only (-ngl 0) — expect single-digit to low-double-digit tok/s." -ForegroundColor Magenta

& $exe.FullName `
    --model $modelFile.FullName `
    --host 127.0.0.1 --port $Port `
    -ngl 0 `
    --ctx-size $CtxSize `
    --jinja `
    --temp 0.7 --top-p 0.8 --top-k 20 --repeat-penalty 1.05
