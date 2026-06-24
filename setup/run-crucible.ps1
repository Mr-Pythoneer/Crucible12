<#
.SYNOPSIS
    Launches llama-server with the "crucible" preset: Qwen3-Coder-Next (80B/3B-active MoE),
    split across the RTX 5090's 32GB VRAM and the 9950X3D's 64GB system RAM.

.DESCRIPTION
    -ngl 99 puts every layer the GPU can hold onto the GPU; --n-cpu-moe N then pulls the
    *expert* weights of the first N MoE layers back onto the CPU/RAM, while the dense,
    attention, and shared-expert weights (plus the remaining experts) stay on the GPU.
    Because only ~3B params activate per token, the RAM-resident slice costs little
    throughput — this is what makes the preset use GPU + CPU + RAM together instead of
    just maxing out VRAM.

    -CpuMoe is a starting point, not a measured-optimal value (I have no GPU here to
    benchmark on). Tune it on your machine: start low, watch `nvidia-smi` VRAM usage and
    the prompt-processing speed llama-server prints at startup, and increase -CpuMoe until
    you stop hitting CUDA out-of-memory errors, leaving a few GB of VRAM headroom for the
    KV cache to grow into during long agent sessions.

.PARAMETER CpuMoe
    Number of leading MoE layers whose experts get offloaded to CPU RAM. Default: 16.

.PARAMETER CtxSize
    Context window in tokens. Default: 65536 (model supports up to 262144 natively).
#>
[CmdletBinding()]
param(
    [int]$CpuMoe = 16,
    [int]$CtxSize = 65536,
    [int]$Port = 8080,
    [string]$ModelDir = (Join-Path $PSScriptRoot "..\models\crucible")
)

$ErrorActionPreference = "Stop"

$serverExe = Get-ChildItem -Path (Join-Path $PSScriptRoot "..\bin\llama.cpp") -Recurse -Filter "llama-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $serverExe) { throw "llama-server.exe not found. Run 01-install-llamacpp.ps1 first." }

$modelFile = Get-ChildItem -Path $ModelDir -Filter "*00001-of-*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $modelFile) { $modelFile = Get-ChildItem -Path $ModelDir -Filter "*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1 }
if (-not $modelFile) { throw "No GGUF found in $ModelDir. Run 02-download-models.ps1 first." }

Write-Host "Model:   $($modelFile.FullName)" -ForegroundColor Green
Write-Host "n-cpu-moe: $CpuMoe (raise if VRAM headroom allows, lower if you hit CUDA OOM)" -ForegroundColor Yellow

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
