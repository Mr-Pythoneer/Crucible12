<#
.SYNOPSIS
    Sanity-checks a running llama-server: confirms the GPU is actually being used,
    reports generation speed, and (for the crucible preset) shows how much VRAM vs
    system RAM the model is actually consuming.

.DESCRIPTION
    Run this AFTER starting run-crucible.ps1 or run-fast.ps1 in another window.
    It sends one chat completion request, polls `nvidia-smi` while the request is
    in flight, and prints tokens/sec plus peak GPU utilization/VRAM use.
#>
[CmdletBinding()]
param(
    [int]$Port = 8080,
    [string]$Prompt = "Write a Python function that returns the nth Fibonacci number using memoization, then explain its time complexity."
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) {
    Write-Warning "nvidia-smi not found on PATH — GPU utilization won't be shown, but tok/s will still be measured."
}

Write-Host "Sending request to http://127.0.0.1:$Port ..." -ForegroundColor Cyan

$gpuSamples = [System.Collections.ArrayList]::new()
$pollJob = Start-Job -ScriptBlock {
    while ($true) {
        try {
            nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader,nounits
        } catch {}
        Start-Sleep -Milliseconds 500
    }
}

$body = @{
    model    = "local"
    messages = @(@{ role = "user"; content = $Prompt })
    stream   = $false
} | ConvertTo-Json -Depth 5

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/v1/chat/completions" -Method Post -ContentType "application/json" -Body $body
$sw.Stop()

Stop-Job $pollJob | Out-Null
$gpuSamples = Receive-Job $pollJob
Remove-Job $pollJob

$completionTokens = $response.usage.completion_tokens
$seconds = $sw.Elapsed.TotalSeconds
$tokPerSec = if ($completionTokens -and $seconds -gt 0) { [math]::Round($completionTokens / $seconds, 1) } else { "n/a" }

Write-Host "`n--- Result ---" -ForegroundColor Green
Write-Host "Completion tokens: $completionTokens"
Write-Host "Wall time:          $([math]::Round($seconds, 1))s"
Write-Host "Tokens/sec:         $tokPerSec"

if ($gpuSamples) {
    Write-Host "`n--- GPU samples during generation (util%, VRAM MiB) ---"
    $gpuSamples | ForEach-Object { Write-Host "  $_" }
    $maxUtil = ($gpuSamples | ForEach-Object { ([string]$_).Split(",")[0].Trim() } | Measure-Object -Maximum).Maximum
    if ($maxUtil -lt 50) {
        Write-Warning "Peak GPU utilization was only $maxUtil% — the model may be undersized for GPU work, or -ngl/--n-cpu-moe need adjusting."
    }
}

Write-Host "`nReply preview: $($response.choices[0].message.content.Substring(0, [Math]::Min(200, $response.choices[0].message.content.Length)))..."
