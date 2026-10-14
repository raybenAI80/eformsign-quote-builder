param(
  [ValidateSet("feature", "platform", "growth", "submission")]
  [string]$Template = "feature",
  [string]$Workspace,
  [string]$TaskTitle,
  [string]$CodeRuntime,
  [string]$RoleRuntime,
  [switch]$DryRunOnly,
  [switch]$SkipVerification,
  [switch]$KeepTaskOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-WorkspacePath {
  param([string]$PathOverride)

  if ([string]::IsNullOrWhiteSpace($PathOverride)) {
    return (Split-Path -Parent $PSScriptRoot)
  }

  return (Resolve-Path -LiteralPath $PathOverride).Path
}

function Get-JsonFile {
  param([string]$LiteralPath)

  if (-not (Test-Path -LiteralPath $LiteralPath)) {
    throw "Required JSON file not found: $LiteralPath"
  }

  return (Get-Content -LiteralPath $LiteralPath -Raw | ConvertFrom-Json -Depth 50)
}

function Get-JsonLines {
  param([string]$LiteralPath)

  if (-not (Test-Path -LiteralPath $LiteralPath)) {
    return @()
  }

  $records = New-Object System.Collections.Generic.List[object]
  foreach ($line in @(Get-Content -LiteralPath $LiteralPath | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })) {
    $records.Add(($line | ConvertFrom-Json -Depth 50)) | Out-Null
  }

  return @($records.ToArray())
}

function Invoke-PwshScript {
  param(
    [string]$ScriptPath,
    [string[]]$Arguments
  )

  $cmdArgs = @("-File", $ScriptPath) + @($Arguments)
  $output = & pwsh @cmdArgs 2>&1

  return [ordered]@{
    output   = @($output)
    exitCode = $LASTEXITCODE
  }
}

function Add-SysIntTask {
  param(
    [string]$WorkspacePath,
    [string]$Title,
    [string]$Notes
  )

  $output = sysint-task add -Workspace $WorkspacePath -Title $Title -Notes $Notes
  if ($output -notmatch '^added\s+([^\s]+)\s+') {
    throw "Could not parse task id from sysint-task add output: $output"
  }

  return $matches[1]
}

function Get-OrchestrationStatePath {
  return (Join-Path $env:USERPROFILE ".codex\data\system-intelligence\orchestration.json")
}

function Get-VerificationStatePath {
  return (Join-Path $env:USERPROFILE ".codex\data\system-intelligence\verifications.jsonl")
}

function Get-OrchestrationState {
  return (Get-JsonFile -LiteralPath (Get-OrchestrationStatePath))
}

function Get-TemplateRecord {
  param(
    $Policy,
    [string]$TemplateName
  )

  $templateRecord = $Policy.orchestration.companyModel.templates.$TemplateName
  if ($null -eq $templateRecord) {
    throw "Company template not found in policy: $TemplateName"
  }

  return $templateRecord
}

function Get-CompanyModel {
  param($Policy)

  if ($null -eq $Policy.orchestration -or $null -eq $Policy.orchestration.companyModel) {
    throw "Workspace policy is missing orchestration.companyModel."
  }

  return $Policy.orchestration.companyModel
}

function Get-CompanyRuntimeRouting {
  param($CompanyModel)

  $runtimeRouting = $CompanyModel.runtimeRouting
  $defaults = if ($null -ne $runtimeRouting -and $null -ne $runtimeRouting.defaults) {
    $runtimeRouting.defaults
  } else {
    $null
  }
  $lanes = if ($null -ne $runtimeRouting -and $null -ne $runtimeRouting.lanes) {
    $runtimeRouting.lanes
  } else {
    [pscustomobject]@{}
  }

  return [pscustomobject]@{
    defaults = [pscustomobject]@{
      code = if ($null -ne $defaults -and -not [string]::IsNullOrWhiteSpace([string]$defaults.code)) { [string]$defaults.code } else { "codex" }
      role = if ($null -ne $defaults -and -not [string]::IsNullOrWhiteSpace([string]$defaults.role)) { [string]$defaults.role } else { "gstack" }
    }
    lanes = $lanes
  }
}

function Get-GatedLanes {
  param($Policy)

  if ($null -ne $Policy.orchestration.companyModel.gatedLanes -and @($Policy.orchestration.companyModel.gatedLanes).Count -gt 0) {
    return @($Policy.orchestration.companyModel.gatedLanes)
  }

  return @("qa", "review-release")
}

function Find-OrchestrationUnitForLane {
  param(
    [string]$WorkspacePath,
    [string]$TaskId,
    [string]$LaneName
  )

  $orchestration = Get-OrchestrationState
  $matches = @(
    $orchestration.units |
      Where-Object {
        [string]$_.workspace -eq $WorkspacePath -and
        [string]$_.task_id -eq $TaskId -and
        [string]$_.lane -eq $LaneName
      } |
      Select-Object -First 1
  )

  if ($matches.Count -eq 0) {
    throw "Lane '$LaneName' not found for task '$TaskId'."
  }

  return $matches[0]
}

function Get-LatestWorkspaceVerification {
  param([string]$WorkspacePath)

  $records = @(
    Get-JsonLines -LiteralPath (Get-VerificationStatePath) |
      Where-Object { [string]$_.workspace -eq $WorkspacePath } |
      Sort-Object timestamp -Descending
  )

  if ($records.Count -eq 0) {
    return $null
  }

  return $records[0]
}

function Test-TimestampStale {
  param(
    [string]$Timestamp,
    [double]$Hours
  )

  if ([string]::IsNullOrWhiteSpace($Timestamp)) {
    return $true
  }

  try {
    $stamp = [datetimeoffset]$Timestamp
  }
  catch {
    return $true
  }

  return (((Get-Date) - $stamp.LocalDateTime).TotalHours -gt $Hours)
}

function Get-LaneRuntime {
  param(
    $LaneRecord,
    $RuntimeRouting,
    [string]$CodeRuntimeName,
    [string]$RoleRuntimeName
  )

  $isCodeLane = [string]$LaneRecord.kind -eq "code"

  if ($isCodeLane -and -not [string]::IsNullOrWhiteSpace($CodeRuntimeName)) {
    return $CodeRuntimeName.Trim().ToLowerInvariant()
  }
  if ((-not $isCodeLane) -and -not [string]::IsNullOrWhiteSpace($RoleRuntimeName)) {
    return $RoleRuntimeName.Trim().ToLowerInvariant()
  }

  $laneName = [string]$LaneRecord.lane
  $laneProperty = $RuntimeRouting.lanes.PSObject.Properties[$laneName]
  if ($null -ne $laneProperty -and -not [string]::IsNullOrWhiteSpace([string]$laneProperty.Value)) {
    return ([string]$laneProperty.Value).Trim().ToLowerInvariant()
  }

  if ($isCodeLane) {
    return ([string]$RuntimeRouting.defaults.code).Trim().ToLowerInvariant()
  }

  return ([string]$RuntimeRouting.defaults.role).Trim().ToLowerInvariant()
}

function Get-RehearsalAgentId {
  param(
    [string]$LaneName,
    [string]$RuntimeName
  )

  if ([string]::IsNullOrWhiteSpace($RuntimeName)) {
    return $null
  }

  return ("rehearsal-{0}-{1}" -f $LaneName, $RuntimeName)
}

function Invoke-LaneActivation {
  param(
    [string]$WorkspacePath,
    [string]$TaskId,
    [string]$LaneName,
    [string]$RuntimeName
  )

  $scriptPath = Join-Path $WorkspacePath "scripts\activate-company-workstream-lane.ps1"
  $args = @(
    "-Workspace", $WorkspacePath,
    "-Task", $TaskId,
    "-Lane", $LaneName
  )

  if (-not [string]::IsNullOrWhiteSpace($RuntimeName)) {
    $args += @("-Runtime", $RuntimeName)
  }

  $agentId = Get-RehearsalAgentId -LaneName $LaneName -RuntimeName $RuntimeName
  if (-not [string]::IsNullOrWhiteSpace($agentId)) {
    $args += @("-AgentId", $agentId)
  }

  return (Invoke-PwshScript -ScriptPath $scriptPath -Arguments $args)
}

function Complete-Lane {
  param(
    [string]$WorkspacePath,
    [string]$TaskId,
    [string]$LaneName,
    [string]$Notes
  )

  $unit = Find-OrchestrationUnitForLane -WorkspacePath $WorkspacePath -TaskId $TaskId -LaneName $LaneName
  sysint-orchestrate done -Workspace $WorkspacePath -UnitRef ([string]$unit.id) -Notes $Notes | Out-Null
}

function Write-Section {
  param([string]$Text)
  Write-Output ""
  Write-Output $Text
}

$workspacePath = Resolve-WorkspacePath -PathOverride $Workspace
$policyPath = Join-Path $workspacePath ".sysint\system-intelligence.json"
$policy = Get-JsonFile -LiteralPath $policyPath
$companyModel = Get-CompanyModel -Policy $policy
$runtimeRouting = Get-CompanyRuntimeRouting -CompanyModel $companyModel
$templateRecord = Get-TemplateRecord -Policy $policy -TemplateName $Template
$templateLanes = @($templateRecord.lanes)
$gatedLanes = @(Get-GatedLanes -Policy $policy)
$staleVerificationHours = if ($null -ne $policy.health -and $null -ne $policy.health.staleVerificationHours) { [double]$policy.health.staleVerificationHours } else { 24 }

$taskTitleToUse = if (-not [string]::IsNullOrWhiteSpace($TaskTitle)) {
  $TaskTitle.Trim()
} else {
  "Company workstream rehearsal [$Template] $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

$taskNotes = "Rehearsal task for the company-style workstream. Safe to keep as completed evidence."
$taskId = Add-SysIntTask -WorkspacePath $workspacePath -Title $taskTitleToUse -Notes $taskNotes
sysint-task start -Workspace $workspacePath -Task $taskId -Notes "Begin company workstream rehearsal with template '$Template'." | Out-Null

$startScriptPath = Join-Path $workspacePath "scripts\start-company-workstream.ps1"
Write-Output ("Company workstream rehearsal task={0} template={1}" -f $taskId, $Template)
Write-Output ("Resolved runtime defaults: code={0} role={1}" -f `
    (Get-LaneRuntime -LaneRecord ([pscustomobject]@{ lane = "backend"; kind = "code" }) -RuntimeRouting $runtimeRouting -CodeRuntimeName $CodeRuntime -RoleRuntimeName $RoleRuntime), `
    (Get-LaneRuntime -LaneRecord ([pscustomobject]@{ lane = "product-strategy"; kind = "non_code" }) -RuntimeRouting $runtimeRouting -CodeRuntimeName $CodeRuntime -RoleRuntimeName $RoleRuntime))

$dryRunResult = Invoke-PwshScript -ScriptPath $startScriptPath -Arguments @(
  "-Workspace", $workspacePath,
  "-Task", $taskId,
  "-Template", $Template,
  "-DryRun"
)

if ($dryRunResult.exitCode -ne 0) {
  throw ("Dry-run staffing failed: {0}" -f ($dryRunResult.output -join [Environment]::NewLine))
}

if (($dryRunResult.output -join [Environment]::NewLine) -notmatch 'COMPANY_WORKSTREAM_DRY_RUN_OK') {
  throw "Dry-run staffing did not emit the expected success marker."
}

Write-Section "Dry-run preview succeeded."

if ($DryRunOnly) {
  if (-not $KeepTaskOpen) {
    sysint-task done -Workspace $workspacePath -Task $taskId -Notes "Dry-run only company workstream rehearsal completed." | Out-Null
  }
  Write-Output "COMPANY_WORKSTREAM_REHEARSAL_DRY_RUN_OK"
  exit 0
}

$applyResult = Invoke-PwshScript -ScriptPath $startScriptPath -Arguments @(
  "-Workspace", $workspacePath,
  "-Task", $taskId,
  "-Template", $Template
)

if ($applyResult.exitCode -ne 0) {
  throw ("Workstream apply failed: {0}" -f ($applyResult.output -join [Environment]::NewLine))
}

if (($applyResult.output -join [Environment]::NewLine) -notmatch 'COMPANY_WORKSTREAM_OK') {
  throw "Workstream apply did not emit the expected success marker."
}

Write-Section "Template applied. Activating non-gated lanes."

foreach ($laneRecord in $templateLanes) {
  $laneName = [string]$laneRecord.lane
  if ($gatedLanes -contains $laneName) {
    continue
  }

  $runtimeName = Get-LaneRuntime -LaneRecord $laneRecord -RuntimeRouting $runtimeRouting -CodeRuntimeName $CodeRuntime -RoleRuntimeName $RoleRuntime
  $activationResult = Invoke-LaneActivation -WorkspacePath $workspacePath -TaskId $taskId -LaneName $laneName -RuntimeName $runtimeName
  if ($activationResult.exitCode -ne 0) {
    throw ("Lane activation failed for '{0}': {1}" -f $laneName, ($activationResult.output -join [Environment]::NewLine))
  }

  Complete-Lane -WorkspacePath $workspacePath -TaskId $taskId -LaneName $laneName -Notes ("Rehearsal completed lane '{0}'." -f $laneName)
  Write-Output ("completed lane={0} runtime={1}" -f $laneName, $runtimeName)
}

$latestVerification = Get-LatestWorkspaceVerification -WorkspacePath $workspacePath
$verificationIsFresh = $false
if ($null -ne $latestVerification -and [string]$latestVerification.status -eq "passed") {
  $verificationIsFresh = -not (Test-TimestampStale -Timestamp ([string]$latestVerification.timestamp) -Hours $staleVerificationHours)
}

if ($gatedLanes.Count -gt 0) {
  Write-Section "Checking gated lane behavior."

  $firstGatedLane = [string]$gatedLanes[0]
  if ($verificationIsFresh) {
    Write-Output ("skip negative gate check for lane={0}; workspace verification is already fresh." -f $firstGatedLane)
  } else {
    $preVerifyLaneRecord = @($templateLanes | Where-Object { [string]$_.lane -eq $firstGatedLane } | Select-Object -First 1)
    $preVerifyRuntime = if ($preVerifyLaneRecord.Count -gt 0) {
      Get-LaneRuntime -LaneRecord $preVerifyLaneRecord[0] -RuntimeRouting $runtimeRouting -CodeRuntimeName $CodeRuntime -RoleRuntimeName $RoleRuntime
    } else {
      ([string]$runtimeRouting.defaults.role).Trim().ToLowerInvariant()
    }
    $preVerifyResult = Invoke-LaneActivation -WorkspacePath $workspacePath -TaskId $taskId -LaneName $firstGatedLane -RuntimeName $preVerifyRuntime
    if ($preVerifyResult.exitCode -eq 0) {
      throw ("Expected gated lane '{0}' to reject activation before fresh verification." -f $firstGatedLane)
    }
    if (($preVerifyResult.output -join [Environment]::NewLine) -notmatch 'fresh passed workspace verification') {
      throw ("Gated lane '{0}' failed for an unexpected reason: {1}" -f $firstGatedLane, ($preVerifyResult.output -join [Environment]::NewLine))
    }
    Write-Output ("confirmed lane={0} stays closed without fresh verification." -f $firstGatedLane)
  }
}

if (-not $SkipVerification) {
  Write-Section "Running workspace verification for gated lanes."
  sysint-task note -Workspace $workspacePath -Task $taskId -Notes "Running sysint-verify during company workstream rehearsal." | Out-Null
  sysint-verify run -Workspace $workspacePath | Out-Null
}

foreach ($laneRecord in $templateLanes) {
  $laneName = [string]$laneRecord.lane
  if (-not ($gatedLanes -contains $laneName)) {
    continue
  }

  $runtimeName = Get-LaneRuntime -LaneRecord $laneRecord -RuntimeRouting $runtimeRouting -CodeRuntimeName $CodeRuntime -RoleRuntimeName $RoleRuntime
  $activationResult = Invoke-LaneActivation -WorkspacePath $workspacePath -TaskId $taskId -LaneName $laneName -RuntimeName $runtimeName
  if ($activationResult.exitCode -ne 0) {
    throw ("Gated lane activation failed for '{0}': {1}" -f $laneName, ($activationResult.output -join [Environment]::NewLine))
  }

  Complete-Lane -WorkspacePath $workspacePath -TaskId $taskId -LaneName $laneName -Notes ("Rehearsal completed gated lane '{0}'." -f $laneName)
  Write-Output ("completed gated lane={0} runtime={1}" -f $laneName, $runtimeName)
}

if (-not $KeepTaskOpen) {
  sysint-task done -Workspace $workspacePath -Task $taskId -Notes "Company workstream rehearsal completed successfully." | Out-Null
}

Write-Section "Rehearsal completed successfully."
Write-Output ("COMPANY_WORKSTREAM_REHEARSAL_OK task={0}" -f $taskId)
