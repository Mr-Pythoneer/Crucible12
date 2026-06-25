<#
.SYNOPSIS
    No-GPU / laptop preset. CPU-only inference, no CUDA required at all.
    NOT for the 5090 box — use the main setup/ presets there.

.DESCRIPTION
    Same small model as the 8GB-VRAM tier (Qwen2.5-Coder-7B-Instruct @ Q4_K_M, ~4.4GB),
    run with -ngl 0 (no GPU layers) so it works on a machine with no dedicated GPU at all,
    or where you don't want to install the CUDA build from setup/01-install-llamacpp.ps1.

    You still need a llama.cpp build, just not a CUDA one — grab a plain CPU release from
    https://github.com/ggml-org/llama.cpp/releases (look for a "win-*-x64" asset WITHOUT
    "cuda" in the name) and point -ServerExe at it, or edit the discovery logic below.

    Honest expectations: CPU-only generation on a 7B Q4 model is commonly single-digit to
    low-double-digit tokens/sec depending on the CPU — noticeably slower than anything else
    in this repo, and a smaller/weaker model than the GPU tiers. If it's too slow, try a
    smaller quant or a smaller model (e.g. Qwen2.5-Coder-3B/1.5B-Instruct-GGUF) by changing
    the "small" preset's Repo/Pattern in setup/02-download-models.ps1, or pointing -ModelDir
    at a different folder you've downloaded into manually.

    UNTESTED — written without access to this tier of hardware.
#>
[CmdletBinding()]
param(
    [int]$CtxSize = 8192,
    [int]$Port = 8080,
    [string]$ModelDir = (Join-Path $PSScriptRoot "..\models\small"),
    [string]$ServerExe = (Join-Path $PSScriptRoot "..\bin\llama.cpp")
)

$ErrorActionPreference = "Stop"

$exe = Get-ChildItem -Path $ServerExe -Recurse -Filter "llama-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $exe) { throw "llama-server.exe not found under $ServerExe. Grab a CPU-only build from https://github.com/ggml-org/llama.cpp/releases and point -ServerExe at its folder." }

$modelFile = Get-ChildItem -Path $ModelDir -Filter "*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $modelFile) { throw "No GGUF found in $ModelDir. From the repo root, run: .\setup\02-download-models.ps1 -Preset small" }

Write-Host "Model: $($modelFile.FullName)" -ForegroundColor Green
Write-Host "Mode:  CPU-only (-ngl 0) — expect single-digit to low-double-digit tok/s." -ForegroundColor Magenta

& $exe.FullName `
    --model $modelFile.FullName `
    --host 127.0.0.1 --port $Port `
    -ngl 0 `
    --ctx-size $CtxSize `
    --jinja `
    --temp 0.7 --top-p 0.8 --top-k 20 --repeat-penalty 1.05
