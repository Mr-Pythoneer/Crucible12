<#
.SYNOPSIS
    Installs Node.js (if needed) and OpenCode (the coding agent CLI).
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found — installing via winget..." -ForegroundColor Cyan
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    Write-Warning "Open a new PowerShell window so PATH picks up Node, then re-run this script."
    exit 0
}

Write-Host "Installing OpenCode (npm install -g opencode-ai)..." -ForegroundColor Cyan
npm install -g opencode-ai

$version = opencode --version
Write-Host "`nOpenCode installed: $version" -ForegroundColor Green
Write-Host "Next: start a llama-server preset (run-crucible.ps1 / run-fast.ps1), then copy the matching"
Write-Host "config\opencode.*.json into your project as opencode.json before launching 'opencode'."
