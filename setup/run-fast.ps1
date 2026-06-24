<#
.SYNOPSIS
    Launches llama-server with the "fast" preset: Qwen3-Coder-30B-A3B-Instruct,
    fully resident on the RTX 5090's 32GB VRAM. No CPU/RAM offload — lower latency,
    leaves system RAM and CPU free (e.g. for gaming alongside it).

.PARAMETER CtxSize
    Context window in tokens. Default: 131072 (model supports 256K natively, more via Yarn).
#>
[CmdletBinding()]
param(
    [int]$CtxSize = 131072,
    [int]$Port = 8080,
    [string]$ModelDir = (Join-Path $PSScriptRoot "..\models\fast")
)

$ErrorActionPreference = "Stop"

$serverExe = Get-ChildItem -Path (Join-Path $PSScriptRoot "..\bin\llama.cpp") -Recurse -Filter "llama-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $serverExe) { throw "llama-server.exe not found. Run 01-install-llamacpp.ps1 first." }

$modelFile = Get-ChildItem -Path $ModelDir -Filter "*00001-of-*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $modelFile) { $modelFile = Get-ChildItem -Path $ModelDir -Filter "*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1 }
if (-not $modelFile) { throw "No GGUF found in $ModelDir. Run 02-download-models.ps1 first." }

Write-Host "Model: $($modelFile.FullName)" -ForegroundColor Green

& $serverExe.FullName `
    --model $modelFile.FullName `
    --host 127.0.0.1 --port $Port `
    -ngl 99 `
    --ctx-size $CtxSize `
    --flash-attn on `
    --cache-type-k q8_0 --cache-type-v q8_0 `
    --jinja `
    --temp 0.7 --top-p 0.8 --top-k 20 --repeat-penalty 1.05 `
    --threads 16
