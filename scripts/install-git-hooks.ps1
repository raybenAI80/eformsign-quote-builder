param(
    [string]$Workspace = (Split-Path -Parent $PSScriptRoot),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$workspacePath = [System.IO.Path]::GetFullPath($Workspace)
$configPath = Join-Path $workspacePath '.harness\project-harness.json'

if (-not (Test-Path -LiteralPath $configPath)) {
    throw "Missing harness config: $configPath"
}

$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$requiredNames = @('lint', 'typecheck', 'test')
foreach ($name in $requiredNames) {
    $commandText = [string]$config.verification.commands.$name.command
    if ([string]::IsNullOrWhiteSpace($commandText) -or $commandText -match '^__.+__$') {
        throw "Cannot install git hooks until verification command '$name' is configured."
    }
}

$gitDir = & git -C $workspacePath rev-parse --git-dir 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($gitDir)) {
    throw "Workspace is not a git repository: $workspacePath"
}

$gitDirPath = if ([System.IO.Path]::IsPathRooted($gitDir)) {
    $gitDir
} else {
    Join-Path $workspacePath $gitDir
}

$hookDir = Join-Path $gitDirPath 'hooks'
New-Item -ItemType Directory -Force -Path $hookDir | Out-Null

$workspaceScriptPath = (Join-Path $workspacePath 'scripts\run-completion-gate.ps1').Replace('\', '/')
$hooks = @(
    @{ Name = 'pre-commit'; Mode = 'pre-commit' },
    @{ Name = 'pre-push'; Mode = 'pre-push' }
)

foreach ($hook in $hooks) {
    $hookPath = Join-Path $hookDir $hook.Name
    if ((Test-Path -LiteralPath $hookPath) -and -not $Force) {
        throw "Refusing to overwrite existing hook without -Force: $hookPath"
    }

    @(
        '#!/bin/sh'
        ('pwsh -NoProfile -ExecutionPolicy Bypass -File "{0}" -Mode {1}' -f $workspaceScriptPath, $hook.Mode)
        'exit $?'
    ) | Set-Content -LiteralPath $hookPath
}

Write-Output "PROJECT_HARNESS_GIT_HOOKS_INSTALLED: $hookDir"
