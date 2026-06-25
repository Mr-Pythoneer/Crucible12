<#
.SYNOPSIS
    Launches llama-server with the "reasoning" SECONDARY preset: gpt-oss-120b (native MXFP4).
    The strongest raw one-shot coder/reasoner that fits this box — NOT the agentic default.

.DESCRIPTION
    gpt-oss-120b is ~117B total / ~5.1B active, shipped natively in MXFP4 (~59-63GB) — a
    format the RTX 5090's Blackwell tensor cores accelerate in hardware (mostly faster
    PREFILL). Strong reasoning (near o4-mini) and high raw-code scores.

    WHY IT'S A SECONDARY, NOT THE DEFAULT: its tool-calling depends on OpenAI's "Harmony"
    channel format and is documented-flaky outside its native harness — there's an open
    OpenCode issue (#7185) where it emits reasoning but never actually calls the tools.
    For day-to-day agentic work in OpenCode, the Qwen3-Coder-Next presets are more reliable.
    Reach for this one for hard one-shot problems / reasoning-heavy tasks.

    Requires a RECENT llama.cpp build (b8967+ added native Blackwell MXFP4 MMQ for the
    prefill speedup) and DDR5 EXPO/XMP in BIOS (RAM-bandwidth-bound generation).

    NOTE: there's an open llama.cpp issue where --chat-template-kwargs reasoning_effort
    is sometimes ignored depending on build/template version (ggml-org/llama.cpp#15130).
    If -ReasoningEffort doesn't seem to change behavior, update llama.cpp first.

.PARAMETER CpuMoe
    Leading MoE layers whose experts offload to CPU RAM. Default: 20.
.PARAMETER ReasoningEffort
    gpt-oss reasoning effort: low | medium | high. Default: high (best for hard tasks).
#>
[CmdletBinding()]
param(
    [int]$CpuMoe = 20,
    [ValidateSet("low","medium","high")]
    [string]$ReasoningEffort = "high",
    [int]$CtxSize = 131072,
    [int]$Port = 8080,
    [string]$ModelDir = (Join-Path $PSScriptRoot "..\models\reasoning")
)

$ErrorActionPreference = "Stop"

$serverExe = Get-ChildItem -Path (Join-Path $PSScriptRoot "..\bin\llama.cpp") -Recurse -Filter "llama-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $serverExe) { throw "llama-server.exe not found. Run 01-install-llamacpp.ps1 first." }

$modelFile = Get-ChildItem -Path $ModelDir -Filter "*00001-of-*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $modelFile) { $modelFile = Get-ChildItem -Path $ModelDir -Filter "*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1 }
if (-not $modelFile) { throw "No GGUF found in $ModelDir. Run 02-download-models.ps1 -Preset reasoning first." }

Write-Host "Model:     $($modelFile.FullName)" -ForegroundColor Green
Write-Host "Reasoning: $ReasoningEffort" -ForegroundColor Yellow
Write-Host "NOTE:      Secondary preset. Tool-calling in OpenCode can be flaky (Harmony format, OpenCode #7185)." -ForegroundColor Magenta
Write-Host "REMINDER:  Use a recent llama.cpp build (b8967+) and DDR5 EXPO/XMP in BIOS." -ForegroundColor Magenta

# gpt-oss carries its own chat template / tool parser; --jinja applies it. Sampling per model card (temp 1.0).
& $serverExe.FullName `
    --model $modelFile.FullName `
    --host 127.0.0.1 --port $Port `
    -ngl 99 --n-cpu-moe $CpuMoe `
    --ctx-size $CtxSize `
    --flash-attn on `
    --jinja `
    --chat-template-kwargs "{`"reasoning_effort`":`"$ReasoningEffort`"}" `
    --temp 1.0 --top-p 1.0 --top-k 0 `
    --threads 16 `
    --mlock
