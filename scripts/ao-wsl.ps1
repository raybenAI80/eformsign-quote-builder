param(
  [string]$Distro = "Ubuntu",
  [string]$Command = "ao status"
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if ($repoRoot -notmatch '^([A-Za-z]):\\(.*)$') {
  throw "Unsupported path format: $repoRoot"
}

$drive = $Matches[1].ToLowerInvariant()
$rest = $Matches[2] -replace '\\', '/'
$wslPath = "/mnt/$drive/$rest"
$configPath = "$wslPath/agent-orchestrator.yaml"
$linuxHome = (& wsl.exe -d $Distro --cd / env -u HOME sh -lc 'printf %s "$HOME"').Trim()

if (-not $wslPath) {
  throw "Failed to resolve WSL path for $repoRoot"
}

if (-not $linuxHome) {
  throw "Failed to resolve WSL home for distro: $Distro"
}

& wsl.exe -d $Distro --cd $wslPath env HOME=$linuxHome AO_CONFIG_PATH=$configPath bash -lc $Command
exit $LASTEXITCODE
