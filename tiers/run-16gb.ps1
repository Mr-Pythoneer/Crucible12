<#
.SYNOPSIS
    Toned-down preset for ~16GB-VRAM cards (RTX 4070 Ti Super / 4080 / 5070 Ti / 5080-class)
    with 32GB+ system RAM. NOT for the 5090 box — use the main setup/ presets there.

.DESCRIPTION
    Same model as the main repo's "fast" preset (Qwen3-Coder-30B-A3B-Instruct, 3B active
    MoE) — at UD-Q4_K_XL it's ~18-20GB, which is a little too big for 16GB VRAM alone, so
    this offloads a handful of MoE layers to system RAM via --n-cpu-moe and trims the
    default context to leave KV-cache headroom.

    Download the weights first (from the repo root): .\setup\02-download-models.ps1 -Preset fast

    UNTESTED — written without access to this tier of hardware, same as everything else in
    this repo. Start here, watch VRAM with nvidia-smi/Task Manager, and adjust -CpuMoe and
    -CtxSize to taste.
#>
[CmdletBinding()]
param(
    [int]$CpuMoe = 6,
    [int]$CtxSize = 32768,
    [int]$Port = 8080,
    [string]$ModelDir = (Join-Path $PSScriptRoot "..\models\fast")
)

$ErrorActionPreference = "Stop"

$serverExe = Get-ChildItem -Path (Join-Path $PSScriptRoot "..\bin\llama.cpp") -Recurse -Filter "llama-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $serverExe) { throw "llama-server.exe not found. Run ..\setup\01-install-llamacpp.ps1 first." }

$modelFile = Get-ChildItem -Path $ModelDir -Filter "*00001-of-*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $modelFile) { $modelFile = Get-ChildItem -Path $ModelDir -Filter "*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1 }
if (-not $modelFile) { throw "No GGUF found in $ModelDir. From the repo root, run: .\setup\02-download-models.ps1 -Preset fast" }

Write-Host "Model:     $($modelFile.FullName)" -ForegroundColor Green
Write-Host "n-cpu-moe: $CpuMoe (raise if you hit CUDA OOM on a 16GB card, lower if VRAM has headroom)" -ForegroundColor Yellow

& $serverExe.FullName `
    --model $modelFile.FullName `
    --host 127.0.0.1 --port $Port `
    -ngl 99 --n-cpu-moe $CpuMoe `
    --ctx-size $CtxSize `
    --flash-attn on `
    --cache-type-k q8_0 --cache-type-v q8_0 `
    --jinja `
    --temp 0.7 --top-p 0.8 --top-k 20 --repeat-penalty 1.05 `
    --mlock
