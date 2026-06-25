<#
.SYNOPSIS
    Toned-down preset for 8-12GB-VRAM cards (RTX 3060/4060/5060-class) with 16GB+ RAM.
    NOT for the 5090 box — use the main setup/ presets there.

.DESCRIPTION
    A small dense model — Qwen2.5-Coder-7B-Instruct @ Q4_K_M (~4.4GB) — fully resident on
    the GPU, no CPU offload needed. Honest caveat: at 7B, tool-calling in an agentic loop
    like OpenCode is noticeably less reliable than the larger Qwen3-Coder-Next presets;
    expect to double-check its tool calls and edits more often, especially on multi-step
    tasks.

    Download the weights first (from the repo root): .\setup\02-download-models.ps1 -Preset small

    UNTESTED — written without access to this tier of hardware.
#>
[CmdletBinding()]
param(
    [int]$CtxSize = 32768,
    [int]$Port = 8080,
    [string]$ModelDir = (Join-Path $PSScriptRoot "..\models\small")
)

$ErrorActionPreference = "Stop"

$serverExe = Get-ChildItem -Path (Join-Path $PSScriptRoot "..\bin\llama.cpp") -Recurse -Filter "llama-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $serverExe) { throw "llama-server.exe not found. Run ..\setup\01-install-llamacpp.ps1 first." }

$modelFile = Get-ChildItem -Path $ModelDir -Filter "*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $modelFile) { throw "No GGUF found in $ModelDir. From the repo root, run: .\setup\02-download-models.ps1 -Preset small" }

Write-Host "Model: $($modelFile.FullName)" -ForegroundColor Green
Write-Host "NOTE:  7B model — tool-calling reliability in OpenCode will be noticeably weaker than the bigger presets." -ForegroundColor Magenta

& $serverExe.FullName `
    --model $modelFile.FullName `
    --host 127.0.0.1 --port $Port `
    -ngl 99 `
    --ctx-size $CtxSize `
    --flash-attn on `
    --jinja `
    --temp 0.7 --top-p 0.8 --top-k 20 --repeat-penalty 1.05
