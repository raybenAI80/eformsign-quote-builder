Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot

function Assert-Exists {
  param(
    [string]$LiteralPath,
    [string]$Label
  )

  if (-not (Test-Path -LiteralPath $LiteralPath)) {
    throw "Missing required harness file: $Label"
  }
}

function Assert-Contains {
  param(
    [string]$Text,
    [string[]]$Needles,
    [string]$Label
  )

  foreach ($needle in $Needles) {
    if ($Text -notmatch [regex]::Escape($needle)) {
      throw "$Label is missing required text: $needle"
    }
  }
}

function Read-JsonLines {
  param([string]$LiteralPath)

  if (-not (Test-Path -LiteralPath $LiteralPath)) {
    return @()
  }

  $items = New-Object System.Collections.Generic.List[object]
  foreach ($line in @(Get-Content -LiteralPath $LiteralPath | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })) {
    $items.Add(($line | ConvertFrom-Json -Depth 50)) | Out-Null
  }

  return @($items.ToArray())
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

$requiredRelativePaths = @(
  "AGENTS.md",
  ".harness\project-harness.json",
  ".sysint\system-intelligence.json",
  "docs\harness\README.md",
  "docs\harness\company-operating-model.md",
  "docs\harness\company-workstream-rehearsal.md",
  "docs\glossary\README.md",
  "docs\checklists\completion-gate.md",
  "docs\harness\failure-log.md",
  "docs\harness\weekly-harness-review.md",
  "docs\harness\adoption-order.md",
  "skills\company-workstream-bootstrap\SKILL.md",
  "skills\api-endpoint-workflow\SKILL.md",
  "scripts\run-completion-gate.ps1",
  "scripts\start-company-workstream.ps1",
  "scripts\auto-start-company-workstream.ps1",
  "scripts\activate-company-workstream-lane.ps1",
  "scripts\run-company-workstream-rehearsal.ps1",
  "scripts\install-git-hooks.ps1"
)

foreach ($relativePath in $requiredRelativePaths) {
  Assert-Exists -LiteralPath (Join-Path $workspace $relativePath) -Label $relativePath
}

$agentsPath = Join-Path $workspace "AGENTS.md"
$agentsLines = Get-Content -LiteralPath $agentsPath
$agentsText = $agentsLines -join "`n"
if ($agentsLines.Count -gt 60) {
  throw "AGENTS.md must stay concise. Expected 60 lines or fewer, found $($agentsLines.Count)."
}
Assert-Contains -Text $agentsText -Needles @("## Core Rules", "## Workflow", "## Verification", "## Completion") -Label "AGENTS.md"

$glossaryText = Get-Content -LiteralPath (Join-Path $workspace "docs\glossary\README.md") -Raw
Assert-Contains -Text $glossaryText -Needles @("## Harness", "## System Intelligence", "## Control Plane", "## Execution Plane", "## Role Plane", "## Role Pack", "## Workstream Template") -Label "docs/glossary/README.md"

$checklistText = Get-Content -LiteralPath (Join-Path $workspace "docs\checklists\completion-gate.md") -Raw
Assert-Contains -Text $checklistText -Needles @("run-completion-gate.ps1", "auto-start-company-workstream.ps1", "start-company-workstream.ps1", "activate-company-workstream-lane.ps1", "sysint-verify run", "bind dedicated company-workstream lanes") -Label "docs/checklists/completion-gate.md"
if ($checklistText -match '__LINT_COMMAND__|__TYPECHECK_COMMAND__|__TEST_COMMAND__') {
  throw "docs/checklists/completion-gate.md still contains unresolved verification command placeholders."
}

$companyModelText = Get-Content -LiteralPath (Join-Path $workspace "docs\harness\company-operating-model.md") -Raw
Assert-Contains -Text $companyModelText -Needles @("## Three Planes", "## Rehearsal", "## Runtime Routing", "## Role Packs", "## Team Topology", "## Workstream Templates", "## Activation Runbook", "## Current Limits", "gstack", "ao", "sysint", "sysint-orchestrate bind", "deliverables", "entry gate", "/office-hours", "/design-review") -Label "docs/harness/company-operating-model.md"

$rehearsalDocText = Get-Content -LiteralPath (Join-Path $workspace "docs\harness\company-workstream-rehearsal.md") -Raw
Assert-Contains -Text $rehearsalDocText -Needles @("# Company Workstream Rehearsal", "## Runtime Defaults", "COMPANY_WORKSTREAM_REHEARSAL_OK", "run-company-workstream-rehearsal.ps1") -Label "docs/harness/company-workstream-rehearsal.md"

$companySkillText = Get-Content -LiteralPath (Join-Path $workspace "skills\company-workstream-bootstrap\SKILL.md") -Raw
if ($companySkillText -notmatch '(?s)\A---\s*[\r\n]+name:\s*company-workstream-bootstrap\s*[\r\n]+description:\s*.+?[\r\n]+---') {
  throw "company-workstream-bootstrap skill is missing valid frontmatter."
}
Assert-Contains -Text $companySkillText -Needles @("# Company Workstream Bootstrap", "## When To Use", "## Workflow", "## Verification", "## Common Mistakes") -Label "skills/company-workstream-bootstrap/SKILL.md"

$configPath = Join-Path $workspace ".harness\project-harness.json"
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json -Depth 20
foreach ($name in @("lint", "typecheck", "test")) {
  $entry = $config.verification.commands.$name
  if ($null -eq $entry -or [string]::IsNullOrWhiteSpace([string]$entry.command) -or [string]$entry.command -match '^__.+__$') {
    throw ".harness/project-harness.json is missing a resolved '$name' verification command."
  }
}

$policyPath = Join-Path $workspace ".sysint\system-intelligence.json"
$policy = Get-Content -LiteralPath $policyPath -Raw | ConvertFrom-Json -Depth 50
if (-not $policy.verification -or -not $policy.verification.commands -or @($policy.verification.commands).Count -lt 1) {
  throw ".sysint/system-intelligence.json must define at least one verification command."
}

$gateCommand = @($policy.verification.commands | Where-Object { [string]$_.command -match 'run-completion-gate\.ps1' })
if ($gateCommand.Count -eq 0) {
  throw ".sysint/system-intelligence.json must include scripts/run-completion-gate.ps1 in verification commands."
}

if (-not $policy.orchestration) {
  throw ".sysint/system-intelligence.json must define an orchestration section."
}

$requiredOrchestrationFields = @(
  "defaultLanes",
  "defaultReviewRequired",
  "parallelDispatchDefault",
  "defaultForIndependentSubtasks",
  "minIndependentLanesForParallel",
  "avoidParallelOnCriticalPath",
  "avoidParallelOnOverlappingWriteScopes",
  "avoidParallelForTrivialTasks",
  "autoPlanForSubstantialTasks",
  "substantialTitleWordThreshold",
  "autoScaleForLargeTasks",
  "largeTaskWordThreshold",
  "largeTaskMinDomainCount",
  "maxAutoParallelLanes",
  "scaleTriggerTags",
  "companyModel"
)

foreach ($field in $requiredOrchestrationFields) {
  if ($null -eq $policy.orchestration.$field) {
    throw ".sysint/system-intelligence.json orchestration is missing required field: $field"
  }
}

$companyModel = $policy.orchestration.companyModel
if ($null -eq $companyModel.templates.feature -or $null -eq $companyModel.templates.platform -or $null -eq $companyModel.templates.growth -or $null -eq $companyModel.templates.submission) {
  throw ".sysint/system-intelligence.json must define feature, platform, growth, and submission company templates."
}

if ($null -eq $companyModel.runtimeRouting) {
  throw ".sysint/system-intelligence.json must define companyModel.runtimeRouting."
}
if ($null -eq $companyModel.autoBootstrap) {
  throw ".sysint/system-intelligence.json must define companyModel.autoBootstrap."
}
foreach ($field in @("enabled", "helperScript", "activateInitialRoleLanes", "activateInitialCodeLanes", "discoveryKeywords", "visualKeywords", "submissionKeywords", "growthKeywords", "platformKeywords")) {
  if ($null -eq $companyModel.autoBootstrap.$field) {
    throw ".sysint/system-intelligence.json companyModel.autoBootstrap is missing required field: $field"
  }
}
foreach ($field in @("defaults", "lanes", "concurrency")) {
  if ($null -eq $companyModel.runtimeRouting.$field) {
    throw ".sysint/system-intelligence.json companyModel.runtimeRouting is missing required field: $field"
  }
}
foreach ($field in @("code", "role")) {
  if ([string]::IsNullOrWhiteSpace([string]$companyModel.runtimeRouting.defaults.$field)) {
    throw ".sysint/system-intelligence.json companyModel.runtimeRouting.defaults is missing required field: $field"
  }
}
foreach ($field in @("maxActiveWorkers", "maxCodeWorkers", "maxRoleSessions", "maxConcurrentActivations")) {
  if ($null -eq $companyModel.runtimeRouting.concurrency.$field) {
    throw ".sysint/system-intelligence.json companyModel.runtimeRouting.concurrency is missing required field: $field"
  }
}
foreach ($laneName in @("product-strategy", "backend", "frontend", "qa", "review-release")) {
  if ([string]::IsNullOrWhiteSpace([string]$companyModel.runtimeRouting.lanes.$laneName)) {
    throw ".sysint/system-intelligence.json companyModel.runtimeRouting.lanes is missing required lane mapping: $laneName"
  }
}

if ($null -eq $companyModel.rolePacks) {
  throw ".sysint/system-intelligence.json must define companyModel.rolePacks."
}
foreach ($packName in @("product-discovery", "design-review", "quality-gate", "release-governance", "submission-strategy", "submission-review", "submission-release")) {
  if ($null -eq $companyModel.rolePacks.$packName) {
    throw ".sysint/system-intelligence.json companyModel.rolePacks is missing required role pack: $packName"
  }
}
if (-not @($companyModel.rolePacks.'product-discovery'.gstack | Where-Object { [string]$_ -eq '/office-hours' })) {
  throw ".sysint/system-intelligence.json product-discovery role pack must include /office-hours."
}
if ([string]::IsNullOrWhiteSpace([string]$companyModel.rolePacks.'product-discovery'.entryGate)) {
  throw ".sysint/system-intelligence.json product-discovery role pack must define entryGate."
}
if (-not @($companyModel.rolePacks.'submission-strategy'.gstack | Where-Object { [string]$_ -eq '/office-hours' })) {
  throw ".sysint/system-intelligence.json submission-strategy role pack must include /office-hours."
}
if ([string]::IsNullOrWhiteSpace([string]$companyModel.rolePacks.'submission-strategy'.entryGate)) {
  throw ".sysint/system-intelligence.json submission-strategy role pack must define entryGate."
}
if ([string]::IsNullOrWhiteSpace([string]$companyModel.rolePacks.'design-review'.entryGate)) {
  throw ".sysint/system-intelligence.json design-review role pack must define entryGate."
}
if (-not @($companyModel.rolePacks.'design-review'.followUpGstack | Where-Object { [string]$_ -eq '/design-review' })) {
  throw ".sysint/system-intelligence.json design-review role pack must include followUpGstack=/design-review."
}
if (-not $companyModel.activation.requireBoundWorkerToStartSubstantialTasks) {
  throw ".sysint/system-intelligence.json companyModel.activation.requireBoundWorkerToStartSubstantialTasks must be true."
}
if (-not $companyModel.activation.requireRuntimeBindingForLaneStart) {
  throw ".sysint/system-intelligence.json companyModel.activation.requireRuntimeBindingForLaneStart must be true."
}
if (-not $companyModel.activation.autoPromoteParentTaskOnWorkerBind) {
  throw ".sysint/system-intelligence.json companyModel.activation.autoPromoteParentTaskOnWorkerBind must be true."
}
foreach ($templateName in @("feature", "platform", "growth", "submission")) {
  $templateRecord = $companyModel.templates.$templateName
  foreach ($laneRecord in @($templateRecord.lanes | Where-Object { [string]$_.kind -eq "non_code" })) {
    $rolePackName = [string]$laneRecord.rolePack
    if ([string]::IsNullOrWhiteSpace($rolePackName)) {
      throw ".sysint/system-intelligence.json template '$templateName' has a non_code lane without rolePack: $([string]$laneRecord.lane)"
    }
    if ($null -eq $companyModel.rolePacks.$rolePackName) {
      throw ".sysint/system-intelligence.json template '$templateName' references unknown rolePack '$rolePackName' on lane '$([string]$laneRecord.lane)'."
    }
  }
}

if ($null -eq $companyModel.gatedLanes -or @($companyModel.gatedLanes).Count -lt 2) {
  throw ".sysint/system-intelligence.json must define companyModel.gatedLanes."
}
if ($null -eq $companyModel.activation) {
  throw ".sysint/system-intelligence.json must define companyModel.activation."
}
foreach ($field in @("requireDependencyCompletion", "requireFreshVerificationForGatedLanes", "requireBoundRuntimeForCodeLanes")) {
  if ($null -eq $companyModel.activation.$field) {
    throw ".sysint/system-intelligence.json companyModel.activation is missing required field: $field"
  }
}

$orchestrationPath = Join-Path $env:USERPROFILE ".codex\data\system-intelligence\orchestration.json"
if (Test-Path -LiteralPath $orchestrationPath) {
  $orchestration = Get-Content -Raw -LiteralPath $orchestrationPath | ConvertFrom-Json -Depth 50
  $gatedLanes = @($companyModel.gatedLanes | ForEach-Object { [string]$_ })
  $activeGatedUnits = @(
    $orchestration.units |
      Where-Object {
        [string]$_.workspace -eq $workspace -and
        [string]$_.status -eq "in_progress" -and
        ($gatedLanes -contains [string]$_.lane)
      }
  )

  if ($activeGatedUnits.Count -gt 0) {
    $verificationRecords = @(
      Read-JsonLines -LiteralPath (Join-Path $env:USERPROFILE ".codex\data\system-intelligence\verifications.jsonl") |
        Where-Object { [string]$_.workspace -eq $workspace } |
        Sort-Object timestamp -Descending
    )
    $latestVerification = if ($verificationRecords.Count -gt 0) { $verificationRecords[0] } else { $null }
    $staleHours = if ($null -ne $policy.health -and $null -ne $policy.health.staleVerificationHours) { [double]$policy.health.staleVerificationHours } else { 24 }

    if ($null -eq $latestVerification) {
      throw "Active gated company-workstream lanes require a fresh passed sysint verification."
    }
    if ([string]$latestVerification.status -ne "passed") {
      throw "Active gated company-workstream lanes require a passed sysint verification. Latest status: $([string]$latestVerification.status)"
    }
    if (Test-TimestampStale -Timestamp ([string]$latestVerification.timestamp) -Hours $staleHours) {
      throw "Active gated company-workstream lanes require a fresh passed sysint verification. Latest verification is stale."
    }
  }
}

$incidentPath = Join-Path $workspace "state\harness-self-incidents.ndjson"
if (Test-Path -LiteralPath $incidentPath) {
  $incidentRecords = @(
    Read-JsonLines -LiteralPath $incidentPath |
      Where-Object { [string]$_.severity -in @("error", "critical") } |
      Sort-Object timestamp -Descending
  )
  if ($incidentRecords.Count -gt 0) {
    $verificationRecords = @(
      Read-JsonLines -LiteralPath (Join-Path $env:USERPROFILE ".codex\data\system-intelligence\verifications.jsonl") |
        Where-Object { [string]$_.workspace -eq $workspace -and [string]$_.status -eq "passed" } |
        Sort-Object timestamp -Descending
    )
    $latestPassedVerification = if ($verificationRecords.Count -gt 0) { $verificationRecords[0] } else { $null }
    $blockingIncidents = if ($null -eq $latestPassedVerification) {
      $incidentRecords
    } else {
      @($incidentRecords | Where-Object { [datetimeoffset]$_.timestamp -gt [datetimeoffset]$latestPassedVerification.timestamp })
    }

    if ($blockingIncidents.Count -gt 0) {
      throw "Workspace has unresolved error-level harness self-incidents newer than the latest passed verification."
    }
  }
}

Write-Output "HARNESS_COMPLETION_GATE_OK: $($requiredRelativePaths.Count) required files checked"
