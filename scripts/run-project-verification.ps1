param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('lint', 'typecheck', 'test')]
    [string]$Name,
    [string]$Workspace = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$workspacePath = [System.IO.Path]::GetFullPath($Workspace)

function Get-PreferredPackageManager {
    param([string]$WorkspacePath)

    if (Test-Path -LiteralPath (Join-Path $WorkspacePath 'pnpm-lock.yaml')) {
        return 'pnpm'
    }
    if (Test-Path -LiteralPath (Join-Path $WorkspacePath 'yarn.lock')) {
        return 'yarn'
    }
    if ((Test-Path -LiteralPath (Join-Path $WorkspacePath 'bun.lockb')) -or (Test-Path -LiteralPath (Join-Path $WorkspacePath 'bun.lock'))) {
        return 'bun'
    }

    return 'npm'
}

function Get-PackageScripts {
    param([string]$WorkspacePath)

    $packageJsonPath = Join-Path $WorkspacePath 'package.json'
    if (-not (Test-Path -LiteralPath $packageJsonPath)) {
        return @{}
    }

    $packageJson = Get-Content -Raw -LiteralPath $packageJsonPath | ConvertFrom-Json -AsHashtable
    if (-not $packageJson.ContainsKey('scripts') -or $null -eq $packageJson.scripts) {
        return @{}
    }

    return [hashtable]$packageJson.scripts
}

function Get-NodeScriptCommand {
    param(
        [string]$WorkspacePath,
        [string[]]$Candidates
    )

    $scripts = Get-PackageScripts -WorkspacePath $WorkspacePath
    if ($scripts.Count -eq 0) {
        return $null
    }

    $packageManager = Get-PreferredPackageManager -WorkspacePath $WorkspacePath
    foreach ($candidate in $Candidates) {
        if ($scripts.ContainsKey($candidate)) {
            switch ($packageManager) {
                'pnpm' { return "pnpm $candidate" }
                'yarn' { return "yarn $candidate" }
                'bun' { return "bun run $candidate" }
                default { return "npm run $candidate" }
            }
        }
    }

    return $null
}

function Get-PyprojectText {
    param([string]$WorkspacePath)

    $pyprojectPath = Join-Path $WorkspacePath 'pyproject.toml'
    if (-not (Test-Path -LiteralPath $pyprojectPath)) {
        return ''
    }

    return Get-Content -Raw -LiteralPath $pyprojectPath
}

function Test-DotNetWorkspace {
    param([string]$WorkspacePath)

    return (@(
            Get-ChildItem -LiteralPath $WorkspacePath -Filter *.sln -File -ErrorAction SilentlyContinue
            Get-ChildItem -LiteralPath $WorkspacePath -Filter *.csproj -File -Recurse -ErrorAction SilentlyContinue
        ).Count -gt 0)
}

function Resolve-VerificationCommand {
    param(
        [string]$WorkspacePath,
        [string]$VerificationName
    )

    $pyprojectText = Get-PyprojectText -WorkspacePath $WorkspacePath

    switch ($VerificationName) {
        'lint' {
            $nodeCommand = Get-NodeScriptCommand -WorkspacePath $WorkspacePath -Candidates @('lint', 'lint:ci')
            if ($null -ne $nodeCommand) { return [ordered]@{ kind = 'shell'; command = $nodeCommand } }

            if ($pyprojectText -match '\[tool\.ruff') { return [ordered]@{ kind = 'shell'; command = 'python -m ruff check .' } }
            if ($pyprojectText -match '\[tool\.flake8' -or (Test-Path -LiteralPath (Join-Path $WorkspacePath '.flake8'))) { return [ordered]@{ kind = 'shell'; command = 'python -m flake8 .' } }
            if (Test-Path -LiteralPath (Join-Path $WorkspacePath 'go.mod')) { return [ordered]@{ kind = 'gofmt'; command = 'gofmt -l .' } }
            if (Test-Path -LiteralPath (Join-Path $WorkspacePath 'Cargo.toml')) { return [ordered]@{ kind = 'shell'; command = 'cargo fmt --check' } }
            if (Test-DotNetWorkspace -WorkspacePath $WorkspacePath) { return [ordered]@{ kind = 'shell'; command = 'dotnet format --verify-no-changes' } }
        }
        'typecheck' {
            $nodeCommand = Get-NodeScriptCommand -WorkspacePath $WorkspacePath -Candidates @('typecheck', 'type-check', 'check-types')
            if ($null -ne $nodeCommand) { return [ordered]@{ kind = 'shell'; command = $nodeCommand } }

            if ($pyprojectText -match '\[tool\.mypy') { return [ordered]@{ kind = 'shell'; command = 'python -m mypy .' } }
            if ($pyprojectText -match '\[tool\.pyright') { return [ordered]@{ kind = 'shell'; command = 'python -m pyright' } }
            if (Test-Path -LiteralPath (Join-Path $WorkspacePath 'go.mod')) { return [ordered]@{ kind = 'shell'; command = 'go vet ./...' } }
            if (Test-Path -LiteralPath (Join-Path $WorkspacePath 'Cargo.toml')) { return [ordered]@{ kind = 'shell'; command = 'cargo check' } }
            if (Test-DotNetWorkspace -WorkspacePath $WorkspacePath) { return [ordered]@{ kind = 'shell'; command = 'dotnet build --nologo' } }
        }
        'test' {
            $nodeCommand = Get-NodeScriptCommand -WorkspacePath $WorkspacePath -Candidates @('test', 'test:ci', 'test:unit')
            if ($null -ne $nodeCommand) { return [ordered]@{ kind = 'shell'; command = $nodeCommand } }

            if (
                (Test-Path -LiteralPath (Join-Path $WorkspacePath 'pytest.ini')) -or
                (Test-Path -LiteralPath (Join-Path $WorkspacePath 'tox.ini')) -or
                (Test-Path -LiteralPath (Join-Path $WorkspacePath 'pyproject.toml'))
            ) {
                return [ordered]@{ kind = 'shell'; command = 'python -m pytest' }
            }
            if (Test-Path -LiteralPath (Join-Path $WorkspacePath 'go.mod')) { return [ordered]@{ kind = 'shell'; command = 'go test ./...' } }
            if (Test-Path -LiteralPath (Join-Path $WorkspacePath 'Cargo.toml')) { return [ordered]@{ kind = 'shell'; command = 'cargo test' } }
            if (Test-DotNetWorkspace -WorkspacePath $WorkspacePath) { return [ordered]@{ kind = 'shell'; command = 'dotnet test --nologo' } }
        }
    }

    return $null
}

$resolved = Resolve-VerificationCommand -WorkspacePath $workspacePath -VerificationName $Name
if ($null -eq $resolved) {
    throw ("No auto-detected '{0}' verification command is available for {1}. Update .harness\\project-harness.json with the repository-standard command." -f $Name, $workspacePath)
}

Push-Location $workspacePath
try {
    if ([string]$resolved.kind -eq 'gofmt') {
        $output = @(& gofmt -l .)
        if ($LASTEXITCODE -ne 0) {
            throw "gofmt -l . failed with exit code $LASTEXITCODE"
        }
        if ($output.Count -gt 0) {
            throw ("gofmt reported unformatted files:`n" + ($output -join "`n"))
        }
        Write-Output 'PROJECT_VERIFICATION_OK: gofmt'
        return
    }

    Write-Host ("[project-verification] {0}: {1}" -f $Name, [string]$resolved.command)
    $global:LASTEXITCODE = 0
    Invoke-Expression ([string]$resolved.command)
    if ($LASTEXITCODE -ne 0) {
        throw ("Verification '{0}' failed with exit code {1}" -f $Name, $LASTEXITCODE)
    }
}
finally {
    Pop-Location
}

Write-Output ("PROJECT_VERIFICATION_OK: {0}" -f $Name)
