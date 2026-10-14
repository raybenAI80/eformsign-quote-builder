param(
  [Parameter(Mandatory = $true)]
  [string]$Task,
  [Parameter(Mandatory = $true)]
  [string]$Lane,
  [string]$Workspace,
  [string]$Notes,
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

function Find-OrchestrationUnitForLane {
  param(
    [string]$WorkspacePath,
    [string]$TaskId,
    [string]$LaneName,
    $OrchestrationState
  )

  $matches = @(
    $OrchestrationState.units |
      Where-Object {
        [string]$_.workspace -eq $WorkspacePath -and
        [string]$_.task_id -eq $TaskId -and
        [string]$_.lane -eq $LaneName
      } |
      Select-Object -First 1
  )

  if ($matches.Count -eq 0) {
    throw "Lane '$LaneName' is not planned for task $TaskId. Run start-company-workstream first."
  }

  return $matches[0]
}

function Get-CompanyModel {
  param($Policy)

  if ($null -eq $Policy.orchestration -or $null -eq $Policy.orchestration.companyModel) {
    throw "Workspace policy is missing orchestration.companyModel."
  }

  return $Policy.orchestration.companyModel
}

function Get-CompanyActivationPolicy {
  param($CompanyModel)

  if ($null -ne $CompanyModel.activation) {
    return $CompanyModel.activation
  }

  return [pscustomobject]@{
    requireDependencyCompletion           = $true
    requireFreshVerificationForGatedLanes = $true
    requireBoundRuntimeForCodeLanes       = $true
    requireBoundWorkerToStartSubstantialTasks = $true
    requireRuntimeBindingForLaneStart = $true
    autoPromoteParentTaskOnWorkerBind = $true
  }
}

function Get-CompanyRolePacks {
  param($CompanyModel)

  if ($null -ne $CompanyModel.rolePacks) {
    return $CompanyModel.rolePacks
  }

  return [pscustomobject]@{}
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

function Get-GatedLanes {
  param($CompanyModel)

  if ($null -ne $CompanyModel.gatedLanes -and @($CompanyModel.gatedLanes).Count -gt 0) {
    return @($CompanyModel.gatedLanes)
  }

  return @("qa", "review-release")
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

function Get-LaneRolePackName {
  param($LaneRecord)

  if ($null -eq $LaneRecord) {
    return $null
  }

  $property = $LaneRecord.PSObject.Properties['rolePack']
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

  $values = New-Object System.Collections.Generic.List[object]
  $rolePackName = Get-LaneRolePackName -LaneRecord $LaneRecord
  $rolePackRecord = Get-RolePackRecord -RolePacks $RolePacks -PackName $rolePackName

  foreach ($record in @($rolePackRecord, $LaneRecord)) {
    foreach ($value in @(Get-OptionalValues -Record $record -PropertyName $PropertyName)) {
      $values.Add($value) | Out-Null
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
      return $text.Trim()
    }
  }

  return ""
}

function Get-LaneGstackValues {
  param(
    $LaneRecord,
    $RolePacks
  )

  return @(Get-LanePolicyValues -LaneRecord $LaneRecord -RolePacks $RolePacks -PropertyName 'gstack')
}

function Get-LaneFollowUpGstackValues {
  param(
    $LaneRecord,
    $RolePacks
  )

  return @(Get-LanePolicyValues -LaneRecord $LaneRecord -RolePacks $RolePacks -PropertyName 'followUpGstack')
}

function Get-CompanyAutoBootstrapSettings {
  param($CompanyModel)

  $settings = [ordered]@{
    visualKeywords = @('ui', 'ux', 'design', 'mockup', 'wireframe', 'screen', 'landing', 'page', 'visual', 'prototype', 'frontend', '디자인', '화면', '목업', '랜딩', '프로토타입', '시각')
  }

  if ($null -eq $CompanyModel) {
    return [pscustomobject]$settings
  }

  $property = $CompanyModel.PSObject.Properties['autoBootstrap']
  if ($null -eq $property -or $null -eq $property.Value) {
    return [pscustomobject]$settings
  }

  $override = $property.Value
  foreach ($name in @('visualKeywords')) {
    $overrideProperty = $override.PSObject.Properties[$name]
    if ($null -eq $overrideProperty -or $null -eq $overrideProperty.Value) {
      continue
    }

    $settings[$name] = $overrideProperty.Value
  }

  return [pscustomobject]$settings
}

function Get-LaneDefinition {
  param(
    $CompanyModel,
    [string]$LaneName
  )

  foreach ($templateName in @($CompanyModel.templates.PSObject.Properties.Name)) {
    $templateRecord = $CompanyModel.templates.$templateName
    foreach ($laneRecord in @($templateRecord.lanes)) {
      if ([string]$laneRecord.lane -eq $LaneName) {
        return $laneRecord
      }
    }
  }

  return $null
}

function Get-PreferredLaneRuntime {
  param(
    $LaneRecord,
    [string]$LaneKind,
    $RuntimeRouting
  )

  if ($null -eq $RuntimeRouting) {
    return $null
  }

  if ($null -ne $LaneRecord) {
    $laneName = [string]$LaneRecord.lane
    $laneProperty = $RuntimeRouting.lanes.PSObject.Properties[$laneName]
    if ($null -ne $laneProperty -and -not [string]::IsNullOrWhiteSpace([string]$laneProperty.Value)) {
      return [string]$laneProperty.Value
    }
  }

  if ($LaneKind -eq "code") {
    return [string]$RuntimeRouting.defaults.code
  }

  return [string]$RuntimeRouting.defaults.role
}

function Test-TextContainsAny {
  param(
    [string]$Text,
    [string[]]$Keywords
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  foreach ($keyword in @($Keywords)) {
    if ([string]::IsNullOrWhiteSpace([string]$keyword)) {
      continue
    }

    if ($Text.Contains(([string]$keyword).ToLowerInvariant())) {
      return $true
    }
  }

  return $false
}

function Resolve-GstackSkillPath {
  param([string]$Prompt)

  if ([string]::IsNullOrWhiteSpace($Prompt)) {
    return $null
  }

  $skillName = ([string]$Prompt).Trim()
  if ($skillName.StartsWith('/')) {
    $skillName = $skillName.Substring(1)
  }

  if ([string]::IsNullOrWhiteSpace($skillName)) {
    return $null
  }

  $candidates = @(
    (Join-Path $env:USERPROFILE (".codex\skills\gstack-{0}\SKILL.md" -f $skillName)),
    (Join-Path $env:USERPROFILE (".gemini\skills\gstack-{0}\SKILL.md" -f $skillName)),
    (Join-Path $env:USERPROFILE (".claude\skills\gstack-{0}\SKILL.md" -f $skillName)),
    (Join-Path $env:USERPROFILE (".agents\skills\gstack-{0}\SKILL.md" -f $skillName)),
    (Join-Path $env:USERPROFILE (".codex\skills\gstack\{0}\SKILL.md" -f $skillName)),
    (Join-Path $env:USERPROFILE (".gemini\skills\gstack\{0}\SKILL.md" -f $skillName)),
    (Join-Path $env:USERPROFILE (".claude\skills\gstack\{0}\SKILL.md" -f $skillName))
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  return $null
}

function Get-SkillFreshnessNotes {
  param([string[]]$Prompts)

  $checkScriptPath = Join-Path $env:USERPROFILE '.agent-harness\scripts\check-skill-freshness.ps1'
  if (-not (Test-Path -LiteralPath $checkScriptPath)) {
    throw "Skill freshness check script is missing: $checkScriptPath"
  }

  $notes = New-Object System.Collections.Generic.List[string]
  $seen = New-Object System.Collections.Generic.HashSet[string]

  foreach ($prompt in @($Prompts)) {
    $promptText = [string]$prompt
    if ([string]::IsNullOrWhiteSpace($promptText) -or -not $seen.Add($promptText)) {
      continue
    }

    $skillPath = Resolve-GstackSkillPath -Prompt $promptText
    if ([string]::IsNullOrWhiteSpace($skillPath)) {
      throw ("Skill freshness check could not resolve prompt '{0}' to an installed skill path." -f $promptText)
    }

    $rawOutput = & pwsh -File $checkScriptPath -SkillPath $skillPath -AsJson 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw ("Skill freshness check failed for prompt '{0}' using path '{1}'." -f $promptText, $skillPath)
    }

    $result = (($rawOutput -join [Environment]::NewLine) | ConvertFrom-Json -Depth 20)

    $status = if ($null -ne $result -and -not [string]::IsNullOrWhiteSpace([string]$result.status)) {
      [string]$result.status
    } else {
      'unknown'
    }
    $findingCount = @($result.findings).Count
    $warningCount = @($result.warnings).Count
    if ($findingCount -gt 0) {
      $issueSummary = @(
        @($result.findings)
        @($result.warnings)
      ) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
      $issueText = if ($issueSummary.Count -gt 0) {
        ($issueSummary | Select-Object -First 3) -join ' | '
      } else {
        'unknown freshness finding'
      }
      $repairable = $null -ne $result -and $result.repairable -eq $true -and -not [string]::IsNullOrWhiteSpace([string]$result.syncCommand)
      $repairText = if ($repairable) {
        " Repair with: $([string]$result.syncCommand)"
      } else {
        ''
      }
      if ($repairable) {
        throw ("Skill freshness check blocked lane '{0}' for prompt '{1}' at '{2}' ({3}, {4} finding(s)). {5}{6}" -f $Lane, $promptText, $skillPath, $status, $findingCount, $issueText, $repairText)
      }

      $notes.Add(("skill_freshness={0}:degraded" -f $promptText)) | Out-Null
      continue
    }

    if ($warningCount -gt 0) {
      $notes.Add(("skill_freshness={0}:warn" -f $promptText)) | Out-Null
      continue
    }

    $notes.Add(("skill_freshness={0}:ok" -f $promptText)) | Out-Null
  }

  return @($notes.ToArray())
}

function Assert-ConcurrencyBudget {
  param(
    [string]$WorkspacePath,
    [string]$TaskId,
    $UnitRecord,
    [string]$LaneKind,
    $CompanyModel,
    $RuntimeRouting,
    $OrchestrationState
  )

  if ([string]$UnitRecord.status -eq "in_progress") {
    return
  }

  $activeUnits = @(
    $OrchestrationState.units |
      Where-Object {
        [string]$_.workspace -eq $WorkspacePath -and
        [string]$_.task_id -eq $TaskId -and
        [string]$_.status -eq "in_progress" -and
        [string]$_.id -ne [string]$UnitRecord.id
      }
  )

  $activeCodeCount = 0
  $activeRoleCount = 0

  foreach ($activeUnit in $activeUnits) {
    $activeLaneDefinition = Get-LaneDefinition -CompanyModel $CompanyModel -LaneName ([string]$activeUnit.lane)
    $activeLaneKind = if ($null -ne $activeLaneDefinition -and -not [string]::IsNullOrWhiteSpace([string]$activeLaneDefinition.kind)) {
      [string]$activeLaneDefinition.kind
    } else {
      "general"
    }

    if ($activeLaneKind -eq "code") {
      $activeCodeCount += 1
    } else {
      $activeRoleCount += 1
    }
  }

  $projectedActiveWorkers = $activeUnits.Count + 1
  if ($projectedActiveWorkers -gt [int]$RuntimeRouting.concurrency.maxActiveWorkers) {
    throw ("Lane '{0}' would exceed companyModel.runtimeRouting.concurrency.maxActiveWorkers={1} for task {2}. Complete active lanes or raise the task policy first." -f [string]$UnitRecord.lane, [int]$RuntimeRouting.concurrency.maxActiveWorkers, $TaskId)
  }

  if ($LaneKind -eq "code") {
    $projectedCodeWorkers = $activeCodeCount + 1
    if ($projectedCodeWorkers -gt [int]$RuntimeRouting.concurrency.maxCodeWorkers) {
      throw ("Lane '{0}' would exceed companyModel.runtimeRouting.concurrency.maxCodeWorkers={1} for task {2}. Complete or unbind another code lane first." -f [string]$UnitRecord.lane, [int]$RuntimeRouting.concurrency.maxCodeWorkers, $TaskId)
    }
    return
  }

  $projectedRoleSessions = $activeRoleCount + 1
  if ($projectedRoleSessions -gt [int]$RuntimeRouting.concurrency.maxRoleSessions) {
    throw ("Lane '{0}' would exceed companyModel.runtimeRouting.concurrency.maxRoleSessions={1} for task {2}. Complete or unbind another role lane first." -f [string]$UnitRecord.lane, [int]$RuntimeRouting.concurrency.maxRoleSessions, $TaskId)
  }
}

function Get-LatestWorkspaceVerification {
  param([string]$WorkspacePath)

  $verificationPath = Join-Path $env:USERPROFILE ".codex\data\system-intelligence\verifications.jsonl"
  $records = @(
    Get-JsonLines -LiteralPath $verificationPath |
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

function Get-CurrentRuntimeContext {
  $runtime = [Environment]::GetEnvironmentVariable("SYSINT_RUNTIME")
  if ([string]::IsNullOrWhiteSpace($runtime)) {
    $runtime = [Environment]::GetEnvironmentVariable("SYSINT_CURRENT_RUNTIME")
  }
  $agentId = [Environment]::GetEnvironmentVariable("SYSINT_AGENT_ID")
  if ([string]::IsNullOrWhiteSpace($agentId)) {
    $agentId = [Environment]::GetEnvironmentVariable("SYSINT_CURRENT_AGENT_ID")
  }

  if (-not [string]::IsNullOrWhiteSpace($runtime)) {
    return [ordered]@{
      runtime  = $runtime.Trim().ToLowerInvariant()
      agent_id = $agentId
      source   = "sysint_env"
    }
  }

  if (-not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("CODEX_THREAD_ID")) -or -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("CODEX_INTERNAL_ORIGINATOR_OVERRIDE"))) {
    return [ordered]@{
      runtime  = "codex"
      agent_id = [Environment]::GetEnvironmentVariable("CODEX_THREAD_ID")
      source   = "codex_env"
    }
  }

  foreach ($name in @("CLAUDECODE_SESSION_ID", "CLAUDE_CODE_SESSION_ID", "CLAUDE_SESSION_ID")) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return [ordered]@{
        runtime  = "claude"
        agent_id = $value
        source   = "claude_env"
      }
    }
  }

  foreach ($name in @("GEMINI_SESSION_ID", "GOOGLE_GENAI_SESSION_ID", "ANTIGRAVITY_SESSION_ID")) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return [ordered]@{
        runtime  = "gemini"
        agent_id = $value
        source   = "gemini_env"
      }
    }
  }

  return [ordered]@{
    runtime  = $null
    agent_id = $null
    source   = "none"
  }
}

function Set-OrClearEnvironmentValue {
  param(
    [string]$Name,
    [AllowNull()][string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    Remove-Item -Path ("Env:{0}" -f $Name) -ErrorAction SilentlyContinue
    return
  }

  Set-Item -Path ("Env:{0}" -f $Name) -Value $Value
}

$workspacePath = Resolve-WorkspacePath -PathOverride $Workspace
$policyPath = Join-Path $workspacePath ".sysint\system-intelligence.json"
$ledgerPath = Join-Path $env:USERPROFILE ".codex\data\system-intelligence\ledger.json"
$orchestrationPath = Join-Path $env:USERPROFILE ".codex\data\system-intelligence\orchestration.json"

$policy = Get-JsonFile -LiteralPath $policyPath
$ledger = Get-JsonFile -LiteralPath $ledgerPath
$orchestration = Get-JsonFile -LiteralPath $orchestrationPath
$taskRecord = Find-WorkspaceTaskRecord -TaskRef $Task -WorkspacePath $workspacePath -State $ledger
$taskId = [string]$taskRecord.id
$unitRecord = Find-OrchestrationUnitForLane -WorkspacePath $workspacePath -TaskId $taskId -LaneName $Lane -OrchestrationState $orchestration
$companyModel = Get-CompanyModel -Policy $policy
$activationPolicy = Get-CompanyActivationPolicy -CompanyModel $companyModel
$rolePacks = Get-CompanyRolePacks -CompanyModel $companyModel
$autoBootstrap = Get-CompanyAutoBootstrapSettings -CompanyModel $companyModel
$runtimeRouting = Get-CompanyRuntimeRouting -CompanyModel $companyModel
$gatedLanes = @(Get-GatedLanes -CompanyModel $companyModel)
$laneDefinition = Get-LaneDefinition -CompanyModel $companyModel -LaneName $Lane
$laneKind = if ($null -ne $laneDefinition -and -not [string]::IsNullOrWhiteSpace([string]$laneDefinition.kind)) { [string]$laneDefinition.kind } else { "general" }
$rolePackName = Get-LaneRolePackName -LaneRecord $laneDefinition
$entryGate = Get-LanePolicyText -LaneRecord $laneDefinition -RolePacks $rolePacks -PropertyName 'entryGate'
$gstackPrompts = @(Get-LaneGstackValues -LaneRecord $laneDefinition -RolePacks $rolePacks)
$followUpPrompts = @(Get-LaneFollowUpGstackValues -LaneRecord $laneDefinition -RolePacks $rolePacks)
$allLanePrompts = @($gstackPrompts + $followUpPrompts)
$firstPrompt = if ($gstackPrompts.Count -gt 0) { [string]$gstackPrompts[0] } else { "" }
$normalizedTaskText = ("{0} {1}" -f [string]$taskRecord.title, [string]$taskRecord.notes).ToLowerInvariant()
$visualScopeDetected = Test-TextContainsAny -Text $normalizedTaskText -Keywords @($autoBootstrap.visualKeywords)
$currentRuntimeContext = Get-CurrentRuntimeContext
$preferredRuntime = Get-PreferredLaneRuntime -LaneRecord $laneDefinition -LaneKind $laneKind -RuntimeRouting $runtimeRouting
$effectiveRuntime = if (-not [string]::IsNullOrWhiteSpace($Runtime)) {
  $Runtime.Trim().ToLowerInvariant()
} elseif (-not [string]::IsNullOrWhiteSpace($preferredRuntime)) {
  $preferredRuntime.Trim().ToLowerInvariant()
} else {
  [string]$currentRuntimeContext.runtime
}
$runtimeSource = if (-not [string]::IsNullOrWhiteSpace($Runtime)) {
  "explicit"
} elseif (-not [string]::IsNullOrWhiteSpace($preferredRuntime)) {
  "policy"
} elseif (-not [string]::IsNullOrWhiteSpace($effectiveRuntime)) {
  [string]$currentRuntimeContext.source
} else {
  "none"
}

if ([bool]$activationPolicy.requireBoundRuntimeForCodeLanes -and $laneKind -eq "code" -and [string]::IsNullOrWhiteSpace($effectiveRuntime)) {
  throw "Lane '$Lane' is a code lane and requires an explicit runtime or a detectable current runtime context."
}

$agentIdForBind = if ($PSBoundParameters.ContainsKey("AgentId")) {
  $AgentId
} elseif (-not [string]::IsNullOrWhiteSpace([string]$currentRuntimeContext.agent_id)) {
  [string]$currentRuntimeContext.agent_id
} else {
  $null
}

if ([bool]$activationPolicy.requireRuntimeBindingForLaneStart -and [string]::IsNullOrWhiteSpace($effectiveRuntime)) {
  throw "Lane '$Lane' requires a concrete runtime binding before activation."
}

if ([bool]$activationPolicy.requireBoundWorkerToStartSubstantialTasks -and [string]::IsNullOrWhiteSpace([string]$agentIdForBind)) {
  throw "Lane '$Lane' requires a bound worker context before activation. Pass -AgentId or activate from a runtime session with a detectable agent id."
}

if ([string]$rolePackName -eq 'design-review' -and -not $visualScopeDetected) {
  $entryGateText = if ([string]::IsNullOrWhiteSpace($entryGate)) {
    'Open this lane only when the task has real UI, UX, mockup, or live visual-surface scope.'
  } else {
    $entryGate
  }
  throw ("Lane '{0}' is blocked by the design-review entry gate. {1}" -f $Lane, $entryGateText)
}

if ([bool]$activationPolicy.requireDependencyCompletion) {
  $dependencyFailures = New-Object System.Collections.Generic.List[string]
  foreach ($dependencyLane in @($unitRecord.depends_on)) {
    $dependencyUnit = @(
      $orchestration.units |
        Where-Object {
          [string]$_.workspace -eq $workspacePath -and
          [string]$_.task_id -eq $taskId -and
          [string]$_.lane -eq [string]$dependencyLane
        } |
        Select-Object -First 1
    )

    if ($dependencyUnit.Count -eq 0) {
      $dependencyFailures.Add(("{0}:missing" -f [string]$dependencyLane)) | Out-Null
      continue
    }

    if ([string]$dependencyUnit[0].status -ne "completed") {
      $dependencyFailures.Add(("{0}:{1}" -f [string]$dependencyLane, [string]$dependencyUnit[0].status)) | Out-Null
    }
  }

  if ($dependencyFailures.Count -gt 0) {
    throw ("Lane '{0}' cannot activate until dependencies are completed: {1}" -f $Lane, ($dependencyFailures -join ", "))
  }
}

$isGatedLane = $gatedLanes -contains $Lane
$latestVerification = $null
if ($isGatedLane -and [bool]$activationPolicy.requireFreshVerificationForGatedLanes) {
  $latestVerification = Get-LatestWorkspaceVerification -WorkspacePath $workspacePath
  $staleHours = if ($null -ne $policy.health -and $null -ne $policy.health.staleVerificationHours) { [double]$policy.health.staleVerificationHours } else { 24 }

  if ($null -eq $latestVerification) {
    throw ("Lane '{0}' requires a fresh passed workspace verification before activation." -f $Lane)
  }
  if ([string]$latestVerification.status -ne "passed") {
    throw ("Lane '{0}' requires a fresh passed workspace verification before activation. Latest status: {1}" -f $Lane, [string]$latestVerification.status)
  }
  if (Test-TimestampStale -Timestamp ([string]$latestVerification.timestamp) -Hours $staleHours) {
    throw ("Lane '{0}' requires a fresh passed workspace verification before activation. Latest verification is older than {1} hour(s)." -f $Lane, $staleHours)
  }
}

Assert-ConcurrencyBudget -WorkspacePath $workspacePath -TaskId $taskId -UnitRecord $unitRecord -LaneKind $laneKind -CompanyModel $companyModel -RuntimeRouting $runtimeRouting -OrchestrationState $orchestration

$noteParts = New-Object System.Collections.Generic.List[string]
if (-not [string]::IsNullOrWhiteSpace($Notes)) {
  $noteParts.Add($Notes.Trim()) | Out-Null
}
if ($isGatedLane -and $null -ne $latestVerification) {
  $noteParts.Add(("Fresh verification gate satisfied at {0}" -f [string]$latestVerification.timestamp)) | Out-Null
}
if (-not [string]::IsNullOrWhiteSpace($effectiveRuntime)) {
  $noteParts.Add(("runtime={0}" -f $effectiveRuntime)) | Out-Null
}
if (-not [string]::IsNullOrWhiteSpace($preferredRuntime)) {
  $noteParts.Add(("preferred_runtime={0}" -f $preferredRuntime)) | Out-Null
}
if (-not [string]::IsNullOrWhiteSpace($rolePackName)) {
  $noteParts.Add(("role_pack={0}" -f $rolePackName)) | Out-Null
}
if (-not [string]::IsNullOrWhiteSpace($firstPrompt)) {
  $noteParts.Add(("first_prompt={0}" -f $firstPrompt)) | Out-Null
}
foreach ($freshnessNote in @(Get-SkillFreshnessNotes -Prompts $allLanePrompts)) {
  $noteParts.Add([string]$freshnessNote) | Out-Null
}

if ($DryRun) {
  $dryRunRuntimeLabel = if ([string]::IsNullOrWhiteSpace($effectiveRuntime)) { "none" } else { $effectiveRuntime }
  $dryRunPreferredLabel = if ([string]::IsNullOrWhiteSpace($preferredRuntime)) { "none" } else { $preferredRuntime }
  $dryRunAgentLabel = if ([string]::IsNullOrWhiteSpace([string]$agentIdForBind)) { "none" } else { [string]$agentIdForBind }
  Write-Output ("plan lane activation lane={0} task={1} runtime={2} preferred={3} source={4} kind={5} gated={6} agent={7}" -f $Lane, $taskId, $dryRunRuntimeLabel, $dryRunPreferredLabel, $runtimeSource, $laneKind, $isGatedLane, $dryRunAgentLabel)
  Write-Output "COMPANY_WORKSTREAM_LANE_DRY_RUN_OK"
  exit 0
}

$originalRuntime = [Environment]::GetEnvironmentVariable("SYSINT_RUNTIME")
$originalAgentId = [Environment]::GetEnvironmentVariable("SYSINT_AGENT_ID")

try {
  if (-not [string]::IsNullOrWhiteSpace($effectiveRuntime)) {
    Set-OrClearEnvironmentValue -Name "SYSINT_RUNTIME" -Value $effectiveRuntime
  }
  if (-not [string]::IsNullOrWhiteSpace($agentIdForBind)) {
    Set-OrClearEnvironmentValue -Name "SYSINT_AGENT_ID" -Value $agentIdForBind
  }

  $bindParams = @{
    Workspace = $workspacePath
    Task      = $taskId
    Lane      = $Lane
  }

  if (-not [string]::IsNullOrWhiteSpace($Owner)) {
    $bindParams.Owner = $Owner
  }

  if ($noteParts.Count -gt 0) {
    $bindParams.Notes = ($noteParts -join " | ")
  }

  sysint-orchestrate bind @bindParams | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "sysint-orchestrate bind failed for lane '$Lane'."
  }
}
finally {
  Set-OrClearEnvironmentValue -Name "SYSINT_RUNTIME" -Value $originalRuntime
  Set-OrClearEnvironmentValue -Name "SYSINT_AGENT_ID" -Value $originalAgentId
}

$updatedOrchestration = Get-JsonFile -LiteralPath $orchestrationPath
$updatedUnit = Find-OrchestrationUnitForLane -WorkspacePath $workspacePath -TaskId $taskId -LaneName $Lane -OrchestrationState $updatedOrchestration

if ([bool]$activationPolicy.autoPromoteParentTaskOnWorkerBind) {
  $updatedLedger = Get-JsonFile -LiteralPath $ledgerPath
  $updatedTaskRecord = Find-WorkspaceTaskRecord -TaskRef $taskId -WorkspacePath $workspacePath -State $updatedLedger
  if (@('pending', 'blocked') -contains [string]$updatedTaskRecord.status) {
    sysint-task start -Workspace $workspacePath -Task $taskId -Notes ("Auto-promoted after lane '{0}' bound to runtime '{1}'." -f $Lane, $effectiveRuntime) | Out-Null
  }
}

 $finalRuntimeLabel = if ([string]::IsNullOrWhiteSpace([string]$updatedUnit.runtime)) { "unbound" } else { [string]$updatedUnit.runtime }
 $finalAgentLabel = if ([string]::IsNullOrWhiteSpace([string]$updatedUnit.external_agent_id)) { "none" } else { [string]$updatedUnit.external_agent_id }
Write-Output ("COMPANY_WORKSTREAM_LANE_OK lane={0} status={1} runtime={2} agent={3}" -f `
    [string]$updatedUnit.lane, `
    [string]$updatedUnit.status, `
    $finalRuntimeLabel, `
    $finalAgentLabel)
