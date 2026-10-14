param(
  [Parameter(Mandatory = $true)]
  [string]$Task,
  [ValidateSet("feature", "platform", "growth", "submission")]
  [string]$Template = "feature",
  [string]$Workspace,
  [string[]]$ActivateLanes,
  [string]$Runtime,
  [string]$AgentId,
  [string]$Owner,
  [switch]$DryRun
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

function Find-WorkspaceTaskRecord {
  param(
    [string]$TaskRef,
    [string]$WorkspacePath,
    $State
  )

  $matches = @(
    $State.tasks |
      Where-Object {
        [string]$_.workspace -eq $WorkspacePath -and
        (([string]$_.id -eq $TaskRef) -or ([string]$_.title -eq $TaskRef))
      } |
      Sort-Object updated_at -Descending
  )

  if ($matches.Count -eq 0) {
    throw "Task not found in workspace ledger: $TaskRef"
  }

  return $matches[0]
}

function Get-ExistingTaskLanes {
  param(
    [string]$WorkspacePath,
    [string]$TaskId,
    $OrchestrationState
  )

  return @(
    $OrchestrationState.units |
      Where-Object {
        [string]$_.workspace -eq $WorkspacePath -and
        [string]$_.task_id -eq $TaskId
      } |
      ForEach-Object { [string]$_.lane }
  )
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
  $concurrency = if ($null -ne $runtimeRouting -and $null -ne $runtimeRouting.concurrency) {
    $runtimeRouting.concurrency
  } else {
    $null
  }

  return [pscustomobject]@{
    defaults = [pscustomobject]@{
      code = if ($null -ne $defaults -and -not [string]::IsNullOrWhiteSpace([string]$defaults.code)) { [string]$defaults.code } else { "codex" }
      role = if ($null -ne $defaults -and -not [string]::IsNullOrWhiteSpace([string]$defaults.role)) { [string]$defaults.role } else { "gstack" }
    }
    lanes = $lanes
    concurrency = [pscustomobject]@{
      maxActiveWorkers = if ($null -ne $concurrency -and $null -ne $concurrency.maxActiveWorkers) { [int]$concurrency.maxActiveWorkers } else { 6 }
      maxCodeWorkers = if ($null -ne $concurrency -and $null -ne $concurrency.maxCodeWorkers) { [int]$concurrency.maxCodeWorkers } else { 4 }
      maxRoleSessions = if ($null -ne $concurrency -and $null -ne $concurrency.maxRoleSessions) { [int]$concurrency.maxRoleSessions } else { 3 }
      maxConcurrentActivations = if ($null -ne $concurrency -and $null -ne $concurrency.maxConcurrentActivations) { [int]$concurrency.maxConcurrentActivations } else { 4 }
    }
  }
}

function Get-CompanyRolePacks {
  param($CompanyModel)

  if ($null -ne $CompanyModel.rolePacks) {
    return $CompanyModel.rolePacks
  }

  return [pscustomobject]@{}
}

function Join-HintList {
  param([object[]]$Values)

  $items = @($Values | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
  if ($items.Count -eq 0) {
    return ""
  }

  return ($items -join ", ")
}

function Get-UnitTitle {
  param(
    $LaneRecord,
    [string]$TaskTitle
  )

  return ("{0}: {1}" -f ([string]$LaneRecord.titlePrefix), $TaskTitle)
}

function Get-PreferredLaneRuntime {
  param(
    $LaneRecord,
    $RuntimeRouting
  )

  if ($null -eq $LaneRecord -or $null -eq $RuntimeRouting) {
    return $null
  }

  $laneName = [string]$LaneRecord.lane
  $laneProperty = $RuntimeRouting.lanes.PSObject.Properties[$laneName]
  if ($null -ne $laneProperty -and -not [string]::IsNullOrWhiteSpace([string]$laneProperty.Value)) {
    return [string]$laneProperty.Value
  }

  if ([string]$LaneRecord.kind -eq "code") {
    return [string]$RuntimeRouting.defaults.code
  }

  return [string]$RuntimeRouting.defaults.role
}

function Get-LaneRolePackName {
  param($LaneRecord)

  if ($null -eq $LaneRecord) {
    return $null
  }

  $property = $LaneRecord.PSObject.Properties["rolePack"]
  if ($null -eq $property -or [string]::IsNullOrWhiteSpace([string]$property.Value)) {
    return $null
  }

  return [string]$property.Value
}

function Get-RolePackRecord {
  param(
    $RolePacks,
    [string]$PackName
  )

  if ($null -eq $RolePacks -or [string]::IsNullOrWhiteSpace($PackName)) {
    return $null
  }

  $property = $RolePacks.PSObject.Properties[$PackName]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Get-LanePolicyValues {
  param(
    $LaneRecord,
    $RolePacks,
    [string]$PropertyName
  )

  $values = New-Object System.Collections.Generic.List[string]
  $rolePackName = Get-LaneRolePackName -LaneRecord $LaneRecord
  $rolePackRecord = Get-RolePackRecord -RolePacks $RolePacks -PackName $rolePackName

  foreach ($record in @($rolePackRecord, $LaneRecord)) {
    foreach ($value in @(Get-OptionalValues -Record $record -PropertyName $PropertyName)) {
      $text = [string]$value
      if ([string]::IsNullOrWhiteSpace($text) -or $values.Contains($text)) {
        continue
      }
      $values.Add($text) | Out-Null
    }
  }

  return @($values.ToArray())
}

function Get-LanePolicyText {
  param(
    $LaneRecord,
    $RolePacks,
    [string]$PropertyName
  )

  foreach ($value in @(Get-LanePolicyValues -LaneRecord $LaneRecord -RolePacks $RolePacks -PropertyName $PropertyName)) {
    $text = [string]$value
    if (-not [string]::IsNullOrWhiteSpace($text)) {
      return $text
    }
  }

  return $null
}

function Get-LaneGstackValues {
  param(
    $LaneRecord,
    $RolePacks
  )

  return @(Get-LanePolicyValues -LaneRecord $LaneRecord -RolePacks $RolePacks -PropertyName "gstack")
}

function Get-LaneDeliverables {
  param(
    $LaneRecord,
    $RolePacks
  )

  return @(Get-LanePolicyValues -LaneRecord $LaneRecord -RolePacks $RolePacks -PropertyName "deliverables")
}

function Get-LaneUseWhenValues {
  param(
    $LaneRecord,
    $RolePacks
  )

  return @(Get-LanePolicyValues -LaneRecord $LaneRecord -RolePacks $RolePacks -PropertyName "useWhen")
}

function Get-LaneSkipWhenValues {
  param(
    $LaneRecord,
    $RolePacks
  )

  return @(Get-LanePolicyValues -LaneRecord $LaneRecord -RolePacks $RolePacks -PropertyName "skipWhen")
}

function Get-LaneFollowUpGstackValues {
  param(
    $LaneRecord,
    $RolePacks
  )

  return @(Get-LanePolicyValues -LaneRecord $LaneRecord -RolePacks $RolePacks -PropertyName "followUpGstack")
}

function Get-LaneHintSummary {
  param(
    $LaneRecord,
    $RuntimeRouting,
    $RolePacks
  )

  $hints = New-Object System.Collections.Generic.List[string]

  if (-not [string]::IsNullOrWhiteSpace([string]$LaneRecord.kind)) {
    $hints.Add("kind=$([string]$LaneRecord.kind)") | Out-Null
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$LaneRecord.plane)) {
    $hints.Add("plane=$([string]$LaneRecord.plane)") | Out-Null
  }
  $preferredRuntime = Get-PreferredLaneRuntime -LaneRecord $LaneRecord -RuntimeRouting $RuntimeRouting
  if (-not [string]::IsNullOrWhiteSpace($preferredRuntime)) {
    $hints.Add("preferred_runtime=$preferredRuntime") | Out-Null
  }
  $rolePackName = Get-LaneRolePackName -LaneRecord $LaneRecord
  if (-not [string]::IsNullOrWhiteSpace($rolePackName)) {
    $hints.Add("role_pack=$rolePackName") | Out-Null
  }
  if ($LaneRecord.PSObject.Properties["aoEligible"] -and $LaneRecord.aoEligible -eq $true) {
    $hints.Add("ao=eligible") | Out-Null
  }
  $gstackValues = @(Get-LaneGstackValues -LaneRecord $LaneRecord -RolePacks $RolePacks)
  if ($gstackValues.Count -gt 0) {
    $gstackHints = Join-HintList -Values $gstackValues
    if (-not [string]::IsNullOrWhiteSpace($gstackHints)) {
      $hints.Add("gstack=$gstackHints") | Out-Null
    }
  }

  return (Join-HintList -Values $hints)
}

function Get-OptionalValues {
  param(
    $Record,
    [string]$PropertyName
  )

  if ($null -eq $Record) {
    return @()
  }

  $property = $Record.PSObject.Properties[$PropertyName]
  if ($null -eq $property) {
    return @()
  }

  return @($property.Value)
}

function Write-StaffingRunbook {
  param(
    [string]$WorkspacePath,
    [string]$TaskId,
    [string]$TaskTitle,
    [object[]]$LaneRecords,
    [string[]]$GatedLanes,
    $RuntimeRouting,
    $RolePacks
  )

  Write-Output ""
  Write-Output "Runtime routing defaults:"
  Write-Output ("  code={0} role={1}" -f [string]$RuntimeRouting.defaults.code, [string]$RuntimeRouting.defaults.role)
  Write-Output ""
  Write-Output "Concurrency guide:"
  Write-Output ("  max_active_workers={0} max_code_workers={1} max_role_sessions={2} max_concurrent_activations={3}" -f `
      [int]$RuntimeRouting.concurrency.maxActiveWorkers, `
      [int]$RuntimeRouting.concurrency.maxCodeWorkers, `
      [int]$RuntimeRouting.concurrency.maxRoleSessions, `
      [int]$RuntimeRouting.concurrency.maxConcurrentActivations)
  Write-Output ""
  Write-Output "Runtime staffing runbook:"

  foreach ($laneRecord in @($LaneRecords)) {
    $laneName = [string]$laneRecord.lane
    $unitTitle = Get-UnitTitle -LaneRecord $laneRecord -TaskTitle $TaskTitle
    $dependsOn = @(Get-OptionalValues -Record $laneRecord -PropertyName "dependsOn" | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
    $plane = [string]$laneRecord.plane
    $kind = [string]$laneRecord.kind
    $rolePackName = Get-LaneRolePackName -LaneRecord $laneRecord
    $rolePackRecord = Get-RolePackRecord -RolePacks $RolePacks -PackName $rolePackName
    $gstackValues = @(Get-LaneGstackValues -LaneRecord $laneRecord -RolePacks $RolePacks)
    $deliverables = @(Get-LaneDeliverables -LaneRecord $laneRecord -RolePacks $RolePacks)
    $useWhen = @(Get-LaneUseWhenValues -LaneRecord $laneRecord -RolePacks $RolePacks)
    $skipWhen = @(Get-LaneSkipWhenValues -LaneRecord $laneRecord -RolePacks $RolePacks)
    $followUpGstack = @(Get-LaneFollowUpGstackValues -LaneRecord $laneRecord -RolePacks $RolePacks)
    $entryGate = Get-LanePolicyText -LaneRecord $laneRecord -RolePacks $RolePacks -PropertyName "entryGate"
    $preferredRuntime = Get-PreferredLaneRuntime -LaneRecord $laneRecord -RuntimeRouting $RuntimeRouting

    Write-Output ("lane={0} unit=""{1}"" plane={2} kind={3} preferred_runtime={4} depends_on=[{5}]" -f $laneName, $unitTitle, $plane, $kind, $preferredRuntime, (Join-HintList -Values $dependsOn))

    if ($kind -eq "code") {
      Write-Output "  staffing: use ao for isolated coding workers when you need execution-plane separation."
      Write-Output "  bind when the real worker exists:"
      Write-Output ("    sysint-orchestrate bind -Workspace ""{0}"" -Task ""{1}"" -Lane ""{2}"" -Runtime ""<runtime>"" -AgentId ""<agent-id>""" -f $WorkspacePath, $TaskId, $laneName)
      Write-Output "  runtime examples: codex, claude, gemini"
      Write-Output ("  activate helper: pwsh -File "".\scripts\activate-company-workstream-lane.ps1"" -Task ""{0}"" -Lane ""{1}""" -f $TaskId, $laneName)
      Write-Output ("  runtime override: pwsh -File "".\scripts\activate-company-workstream-lane.ps1"" -Task ""{0}"" -Lane ""{1}"" -Runtime ""<runtime>""" -f $TaskId, $laneName)
      continue
    }

    if (-not [string]::IsNullOrWhiteSpace($rolePackName)) {
      Write-Output ("  role pack: {0}" -f $rolePackName)
      if ($null -ne $rolePackRecord -and -not [string]::IsNullOrWhiteSpace([string]$rolePackRecord.description)) {
        Write-Output ("  pack brief: {0}" -f [string]$rolePackRecord.description)
      }
    }
    if (-not [string]::IsNullOrWhiteSpace($entryGate)) {
      Write-Output ("  entry gate: {0}" -f $entryGate)
    }
    if ($gstackValues.Count -gt 0) {
      Write-Output ("  role prompts: {0}" -f (Join-HintList -Values $gstackValues))
      Write-Output ("  first prompt: {0}" -f [string]$gstackValues[0])
    } else {
      Write-Output "  role prompts: no pinned gstack commands in policy"
    }
    if ($useWhen.Count -gt 0) {
      Write-Output ("  use when: {0}" -f (Join-HintList -Values $useWhen))
    }
    if ($skipWhen.Count -gt 0) {
      Write-Output ("  skip when: {0}" -f (Join-HintList -Values $skipWhen))
    }
    if ($followUpGstack.Count -gt 0) {
      Write-Output ("  follow-up prompts: {0}" -f (Join-HintList -Values $followUpGstack))
    }
    if ($deliverables.Count -gt 0) {
      Write-Output ("  deliverables: {0}" -f (Join-HintList -Values $deliverables))
    }
    Write-Output ("  staffing: use {0} in the main session or a dedicated review session." -f $preferredRuntime)
    Write-Output "  bind if you give this lane its own runtime session:"
    Write-Output ("    sysint-orchestrate bind -Workspace ""{0}"" -Task ""{1}"" -Lane ""{2}"" -Runtime ""{3}""" -f $WorkspacePath, $TaskId, $laneName, $preferredRuntime)
    Write-Output ("  activate helper: pwsh -File "".\scripts\activate-company-workstream-lane.ps1"" -Task ""{0}"" -Lane ""{1}""" -f $TaskId, $laneName)
    Write-Output ("  runtime override: pwsh -File "".\scripts\activate-company-workstream-lane.ps1"" -Task ""{0}"" -Lane ""{1}"" -Runtime ""<runtime>""" -f $TaskId, $laneName)

    if ($GatedLanes -contains $laneName) {
      Write-Output "  gate: do not activate this lane until dependencies are completed and fresh sysint verification exists."
    }
  }
}

$workspacePath = Resolve-WorkspacePath -PathOverride $Workspace
$policyPath = Join-Path $workspacePath ".sysint\system-intelligence.json"
$ledgerPath = Join-Path $env:USERPROFILE ".codex\data\system-intelligence\ledger.json"
$orchestrationPath = Join-Path $env:USERPROFILE ".codex\data\system-intelligence\orchestration.json"

$policy = Get-JsonFile -LiteralPath $policyPath
$ledger = Get-JsonFile -LiteralPath $ledgerPath
$orchestration = Get-JsonFile -LiteralPath $orchestrationPath
$companyModel = Get-CompanyModel -Policy $policy
$runtimeRouting = Get-CompanyRuntimeRouting -CompanyModel $companyModel
$rolePacks = Get-CompanyRolePacks -CompanyModel $companyModel

$taskRecord = Find-WorkspaceTaskRecord -TaskRef $Task -WorkspacePath $workspacePath -State $ledger
$taskId = [string]$taskRecord.id
$taskTitle = [string]$taskRecord.title

$templateRecord = $companyModel.templates.$Template
if ($null -eq $templateRecord) {
  throw "Company template not found in policy: $Template"
}

$gatedLanes = if ($null -ne $companyModel.gatedLanes -and @($companyModel.gatedLanes).Count -gt 0) {
  @($companyModel.gatedLanes)
} else {
  @("qa", "review-release")
}

$existingLanes = @(Get-ExistingTaskLanes -WorkspacePath $workspacePath -TaskId $taskId -OrchestrationState $orchestration)
$templateLanes = @($templateRecord.lanes)

Write-Output ("Applying company template '{0}' to task {1}: {2}" -f $Template, $taskId, $taskTitle)
Write-Output ("Template description: {0}" -f [string]$templateRecord.description)

foreach ($laneRecord in $templateLanes) {
  $laneName = [string]$laneRecord.lane
  $unitTitle = Get-UnitTitle -LaneRecord $laneRecord -TaskTitle $taskTitle
  $dependsOn = @(Get-OptionalValues -Record $laneRecord -PropertyName "dependsOn" | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
  $noteText = Get-LaneHintSummary -LaneRecord $laneRecord -RuntimeRouting $runtimeRouting -RolePacks $rolePacks

  if ($existingLanes -contains $laneName) {
    Write-Output ("skip existing lane={0}" -f $laneName)
    continue
  }

  if ($DryRun) {
    Write-Output ("plan lane={0} depends_on=[{1}] notes={2}" -f $laneName, (Join-HintList -Values $dependsOn), $noteText)
    continue
  }

  if ($dependsOn.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($noteText)) {
    & sysint-orchestrate add -Workspace $workspacePath -Task $taskId -Title $unitTitle -Lane $laneName -DependsOn $dependsOn -Notes $noteText
  } elseif ($dependsOn.Count -gt 0) {
    & sysint-orchestrate add -Workspace $workspacePath -Task $taskId -Title $unitTitle -Lane $laneName -DependsOn $dependsOn
  } elseif (-not [string]::IsNullOrWhiteSpace($noteText)) {
    & sysint-orchestrate add -Workspace $workspacePath -Task $taskId -Title $unitTitle -Lane $laneName -Notes $noteText
  } else {
    & sysint-orchestrate add -Workspace $workspacePath -Task $taskId -Title $unitTitle -Lane $laneName
  }
}

Write-StaffingRunbook -WorkspacePath $workspacePath -TaskId $taskId -TaskTitle $taskTitle -LaneRecords $templateLanes -GatedLanes $gatedLanes -RuntimeRouting $runtimeRouting -RolePacks $rolePacks

if ($DryRun) {
  Write-Output "COMPANY_WORKSTREAM_DRY_RUN_OK"
  exit 0
}

if ($null -ne $ActivateLanes -and $ActivateLanes.Count -gt 0) {
  $activationScriptPath = Join-Path $workspacePath "scripts\activate-company-workstream-lane.ps1"
  if (-not (Test-Path -LiteralPath $activationScriptPath)) {
    throw "Missing activation script: $activationScriptPath"
  }
  if ($ActivateLanes.Count -gt [int]$runtimeRouting.concurrency.maxConcurrentActivations) {
    throw ("Requested {0} lane activations, exceeding companyModel.runtimeRouting.concurrency.maxConcurrentActivations={1}. Split the activation into smaller batches." -f $ActivateLanes.Count, [int]$runtimeRouting.concurrency.maxConcurrentActivations)
  }

  Write-Output ""
  Write-Output "Activating requested lanes:"

  foreach ($laneName in $ActivateLanes) {
    $laneRecord = @($templateLanes | Where-Object { [string]$_.lane -eq [string]$laneName } | Select-Object -First 1)
    $activationRuntime = $Runtime
    if ([string]::IsNullOrWhiteSpace($activationRuntime) -and $laneRecord.Count -gt 0) {
      $activationRuntime = Get-PreferredLaneRuntime -LaneRecord $laneRecord[0] -RuntimeRouting $runtimeRouting
    }

    $activationArgs = @(
      "-File", $activationScriptPath,
      "-Workspace", $workspacePath,
      "-Task", $taskId,
      "-Lane", [string]$laneName
    )
    if (-not [string]::IsNullOrWhiteSpace($activationRuntime)) {
      $activationArgs += @("-Runtime", $activationRuntime)
    }
    if ($PSBoundParameters.ContainsKey("AgentId")) {
      $activationArgs += @("-AgentId", $AgentId)
    }
    if (-not [string]::IsNullOrWhiteSpace($Owner)) {
      $activationArgs += @("-Owner", $Owner)
    }

    & pwsh @activationArgs
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to activate lane '$laneName'."
    }
  }
}

Write-Output ""
Write-Output "Recommended next step:"
Write-Output ("1. Activate or bind code lanes first for template '{0}'." -f $Template)
Write-Output "2. Keep gated QA and review lanes pending until dependencies and fresh verification exist."
Write-Output ("3. Run sysint-orchestrate list -Workspace `"{0}`" to inspect the staffed workstream." -f $workspacePath)
Write-Output "COMPANY_WORKSTREAM_OK"
