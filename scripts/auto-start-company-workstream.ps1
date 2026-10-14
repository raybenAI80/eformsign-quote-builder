param(
  [Parameter(Mandatory = $true)]
  [string]$Task,
  [string]$Template,
  [string]$Workspace,
  [string[]]$ActivateLanes,
  [string]$Runtime,
  [string]$AgentId,
  [switch]$NoActivateInitialLanes,
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

function Get-CompanyModel {
  param($Policy)

  if ($null -eq $Policy.orchestration -or $null -eq $Policy.orchestration.companyModel) {
    throw "Workspace policy is missing orchestration.companyModel."
  }

  return $Policy.orchestration.companyModel
}

function Get-GatedLanes {
  param($CompanyModel)

  if ($null -ne $CompanyModel.gatedLanes -and @($CompanyModel.gatedLanes).Count -gt 0) {
    return @($CompanyModel.gatedLanes | ForEach-Object { [string]$_ })
  }

  return @("qa", "review-release")
}

function Get-CompanyActivationPolicy {
  param($CompanyModel)

  if ($null -ne $CompanyModel.activation) {
    return $CompanyModel.activation
  }

  return [pscustomobject]@{
    requireBoundWorkerToStartSubstantialTasks = $true
    requireRuntimeBindingForLaneStart = $true
  }
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

function Join-DisplayValues {
  param([string[]]$Values)

  $items = @($Values | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
  if ($items.Count -eq 0) {
    return "none"
  }

  return ($items -join ", ")
}

function Get-CompanyAutoBootstrapSettings {
  param($CompanyModel)

  $settings = [ordered]@{
    enabled                   = $true
    helperScript              = 'scripts\auto-start-company-workstream.ps1'
    activateInitialRoleLanes  = $true
    activateInitialCodeLanes  = $false
    discoveryKeywords         = @('idea', 'brainstorm', 'strategy', 'scope', 'narrative', 'rewrite', 'draft', 'framing', 'wedge', '기획', '아이디어', '전략', '방향', '구상', '재작성', '초안')
    visualKeywords            = @('ui', 'ux', 'design', 'mockup', 'wireframe', 'screen', 'landing', 'page', 'visual', 'prototype', 'frontend', '디자인', '화면', '목업', '랜딩', '프로토타입', '시각')
    submissionKeywords        = @('제출', '공고', '조달', '신청', '서식', '평가', '증빙', '설명서', 'proposal', 'submission', 'tender', 'rfp')
    growthKeywords            = @('growth', 'marketing', 'campaign', 'funnel', 'conversion', 'launch', 'seo', 'gtm')
    platformKeywords          = @('platform', 'infra', 'runtime', 'automation', 'orchestration', 'harness', 'ci', 'verification', 'pipeline')
  }

  if ($null -eq $CompanyModel) {
    return [pscustomobject]$settings
  }

  $property = $CompanyModel.PSObject.Properties['autoBootstrap']
  if ($null -eq $property -or $null -eq $property.Value) {
    return [pscustomobject]$settings
  }

  $override = $property.Value
  foreach ($name in @('enabled', 'helperScript', 'activateInitialRoleLanes', 'activateInitialCodeLanes', 'discoveryKeywords', 'visualKeywords', 'submissionKeywords', 'growthKeywords', 'platformKeywords')) {
    $overrideProperty = $override.PSObject.Properties[$name]
    if ($null -eq $overrideProperty -or $null -eq $overrideProperty.Value) {
      continue
    }

    $settings[$name] = $overrideProperty.Value
  }

  return [pscustomobject]$settings
}

function Get-TemplateName {
  param(
    [string]$ExplicitTemplate,
    $TaskRecord,
    $AutoBootstrap
  )

  $allowed = @('feature', 'platform', 'growth', 'submission')
  if (-not [string]::IsNullOrWhiteSpace($ExplicitTemplate)) {
    $normalized = $ExplicitTemplate.Trim().ToLowerInvariant()
    if ($allowed -notcontains $normalized) {
      throw "Template must be one of: $($allowed -join ', ')"
    }

    return [ordered]@{
      name   = $normalized
      source = 'explicit'
    }
  }

  $text = "{0} {1}" -f [string]$TaskRecord.title, [string]$TaskRecord.notes
  $normalizedText = $text.ToLowerInvariant()

  foreach ($keyword in @($AutoBootstrap.submissionKeywords)) {
    if (-not [string]::IsNullOrWhiteSpace([string]$keyword) -and $normalizedText.Contains(([string]$keyword).ToLowerInvariant())) {
      return [ordered]@{
        name   = 'submission'
        source = ("keyword:{0}" -f [string]$keyword)
      }
    }
  }

  foreach ($keyword in @($AutoBootstrap.growthKeywords)) {
    if (-not [string]::IsNullOrWhiteSpace([string]$keyword) -and $normalizedText.Contains(([string]$keyword).ToLowerInvariant())) {
      return [ordered]@{
        name   = 'growth'
        source = ("keyword:{0}" -f [string]$keyword)
      }
    }
  }

  foreach ($keyword in @($AutoBootstrap.platformKeywords)) {
    if (-not [string]::IsNullOrWhiteSpace([string]$keyword) -and $normalizedText.Contains(([string]$keyword).ToLowerInvariant())) {
      return [ordered]@{
        name   = 'platform'
        source = ("keyword:{0}" -f [string]$keyword)
      }
    }
  }

  return [ordered]@{
    name   = 'feature'
    source = 'default'
  }
}

function Get-CompanyRolePacks {
  param($CompanyModel)

  if ($null -ne $CompanyModel.rolePacks) {
    return $CompanyModel.rolePacks
  }

  return [pscustomobject]@{}
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

function Get-LaneGstackValues {
  param(
    $LaneRecord,
    $RolePacks
  )

  $values = New-Object System.Collections.Generic.List[string]
  $rolePackName = Get-LaneRolePackName -LaneRecord $LaneRecord
  $rolePackRecord = Get-RolePackRecord -RolePacks $RolePacks -PackName $rolePackName

  foreach ($record in @($rolePackRecord, $LaneRecord)) {
    foreach ($value in @(Get-OptionalValues -Record $record -PropertyName 'gstack')) {
      $text = [string]$value
      if ([string]::IsNullOrWhiteSpace($text) -or $values.Contains($text)) {
        continue
      }
      $values.Add($text) | Out-Null
    }
  }

  return @($values.ToArray())
}

function Get-CurrentRuntimeContext {
  $runtime = [Environment]::GetEnvironmentVariable('SYSINT_RUNTIME')
  if ([string]::IsNullOrWhiteSpace($runtime)) {
    $runtime = [Environment]::GetEnvironmentVariable('SYSINT_CURRENT_RUNTIME')
  }
  $agentId = [Environment]::GetEnvironmentVariable('SYSINT_AGENT_ID')
  if ([string]::IsNullOrWhiteSpace($agentId)) {
    $agentId = [Environment]::GetEnvironmentVariable('SYSINT_CURRENT_AGENT_ID')
  }

  if (-not [string]::IsNullOrWhiteSpace($runtime) -or -not [string]::IsNullOrWhiteSpace($agentId)) {
    return [ordered]@{
      runtime  = $runtime
      agent_id = $agentId
      source   = 'sysint_env'
    }
  }

  if (-not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable('CODEX_THREAD_ID')) -or -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable('CODEX_INTERNAL_ORIGINATOR_OVERRIDE'))) {
    return [ordered]@{
      runtime  = 'codex'
      agent_id = [Environment]::GetEnvironmentVariable('CODEX_THREAD_ID')
      source   = 'codex_env'
    }
  }

  foreach ($name in @('CLAUDECODE_SESSION_ID', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_SESSION_ID')) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return [ordered]@{
        runtime  = 'claude'
        agent_id = $value
        source   = 'claude_env'
      }
    }
  }

  foreach ($name in @('GEMINI_SESSION_ID', 'GOOGLE_GENAI_SESSION_ID', 'ANTIGRAVITY_SESSION_ID')) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return [ordered]@{
        runtime  = 'gemini'
        agent_id = $value
        source   = 'gemini_env'
      }
    }
  }

  return [ordered]@{
    runtime  = $null
    agent_id = $null
    source   = 'none'
  }
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

function Get-AutoBootstrapGuidance {
  param(
    $TaskRecord,
    $TemplateRecord,
    $RolePacks,
    $AutoBootstrap
  )

  $normalizedText = ("{0} {1}" -f [string]$TaskRecord.title, [string]$TaskRecord.notes).ToLowerInvariant()
  $visualScopeDetected = Test-TextContainsAny -Text $normalizedText -Keywords @($AutoBootstrap.visualKeywords)
  $rootRoleLanes = @(
    $TemplateRecord.lanes |
      Where-Object {
        [string]$_.kind -ne 'code' -and
        @(Get-OptionalValues -Record $_ -PropertyName 'dependsOn' | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }).Count -eq 0
      }
  )

  $officeHoursFirst = $false
  foreach ($laneRecord in @($rootRoleLanes)) {
    if (@(Get-LaneGstackValues -LaneRecord $laneRecord -RolePacks $RolePacks) -contains '/office-hours') {
      $officeHoursFirst = $true
      break
    }
  }

  $hasDesignLane = @(
    $TemplateRecord.lanes |
      Where-Object { [string](Get-LaneRolePackName -LaneRecord $_) -eq 'design-review' }
  ).Count -gt 0

  $designReviewPolicy = 'n/a'
  if ($hasDesignLane) {
    $designReviewPolicy = if ($visualScopeDetected) {
      'plan-before-build_then_design-review-after-build'
    } else {
      'skip_until_visual_scope'
    }
  }

  return [ordered]@{
    officeHoursFirst = if ($officeHoursFirst) { 'yes' } else { 'no' }
    visualScopeDetected = if ($visualScopeDetected) { 'yes' } else { 'no' }
    designReviewPolicy = $designReviewPolicy
  }
}

function Get-InitialActivateLanes {
  param(
    [object[]]$LaneRecords,
    [string[]]$GatedLanes,
    $AutoBootstrap
  )

  $selected = New-Object System.Collections.Generic.List[string]
  foreach ($laneRecord in @($LaneRecords)) {
    $laneName = [string]$laneRecord.lane
    if ([string]::IsNullOrWhiteSpace($laneName)) {
      continue
    }

    if ($GatedLanes -contains $laneName) {
      continue
    }

    $dependsOn = @(Get-OptionalValues -Record $laneRecord -PropertyName 'dependsOn' | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
    if ($dependsOn.Count -gt 0) {
      continue
    }

    $kind = [string]$laneRecord.kind
    if ($kind -eq 'code' -and -not [bool]$AutoBootstrap.activateInitialCodeLanes) {
      continue
    }

    if ($kind -ne 'code' -and -not [bool]$AutoBootstrap.activateInitialRoleLanes) {
      continue
    }

    if (-not $selected.Contains($laneName)) {
      $selected.Add($laneName) | Out-Null
    }
  }

  return @($selected.ToArray())
}

function Get-FirstLanePrompt {
  param(
    $LaneRecord,
    $RolePacks
  )

  $prompts = @(Get-LaneGstackValues -LaneRecord $LaneRecord -RolePacks $RolePacks)
  if ($prompts.Count -gt 0) {
    return [string]$prompts[0]
  }

  return ''
}

function Apply-AutoBootstrapActivationPolicy {
  param(
    [string[]]$LaneNames,
    $TemplateRecord,
    $RolePacks,
    $TaskRecord,
    $AutoBootstrap,
    [bool]$ExplicitSelection
  )

  $selected = New-Object System.Collections.Generic.List[string]
  foreach ($laneName in @($LaneNames)) {
    if ([string]::IsNullOrWhiteSpace([string]$laneName) -or $selected.Contains([string]$laneName)) {
      continue
    }
    $selected.Add([string]$laneName) | Out-Null
  }

  if ($ExplicitSelection) {
    return @($selected.ToArray())
  }

  $normalizedText = ("{0} {1}" -f [string]$TaskRecord.title, [string]$TaskRecord.notes).ToLowerInvariant()
  $visualScopeDetected = Test-TextContainsAny -Text $normalizedText -Keywords @($AutoBootstrap.visualKeywords)
  $selectedLaneRecords = @(
    $TemplateRecord.lanes |
      Where-Object { $selected.Contains([string]$_.lane) }
  )

  $officeHoursLanes = @(
    $selectedLaneRecords |
      Where-Object {
        [string]$_.kind -ne 'code' -and
        [string](Get-FirstLanePrompt -LaneRecord $_ -RolePacks $RolePacks) -eq '/office-hours'
      } |
      ForEach-Object { [string]$_.lane }
  )

  if ($officeHoursLanes.Count -gt 0) {
    $selected = New-Object System.Collections.Generic.List[string]
    foreach ($laneName in $officeHoursLanes) {
      if (-not $selected.Contains($laneName)) {
        $selected.Add($laneName) | Out-Null
      }
    }
  }

  if (-not $visualScopeDetected) {
    $filtered = New-Object System.Collections.Generic.List[string]
    foreach ($laneName in @($selected.ToArray())) {
      $laneRecord = @($TemplateRecord.lanes | Where-Object { [string]$_.lane -eq [string]$laneName } | Select-Object -First 1)
      if ($laneRecord.Count -eq 0 -or [string](Get-LaneRolePackName -LaneRecord $laneRecord[0]) -ne 'design-review') {
        $filtered.Add([string]$laneName) | Out-Null
      }
    }
    $selected = $filtered
  }

  return @($selected.ToArray())
}

$workspacePath = Resolve-WorkspacePath -PathOverride $Workspace
$policyPath = Join-Path $workspacePath '.sysint\system-intelligence.json'
$ledgerPath = Join-Path $env:USERPROFILE '.codex\data\system-intelligence\ledger.json'
$startScriptPath = Join-Path $workspacePath 'scripts\start-company-workstream.ps1'

$policy = Get-JsonFile -LiteralPath $policyPath
$ledger = Get-JsonFile -LiteralPath $ledgerPath
$taskRecord = Find-WorkspaceTaskRecord -TaskRef $Task -WorkspacePath $workspacePath -State $ledger
$companyModel = Get-CompanyModel -Policy $policy
$autoBootstrap = Get-CompanyAutoBootstrapSettings -CompanyModel $companyModel
$activationPolicy = Get-CompanyActivationPolicy -CompanyModel $companyModel
$gatedLanes = @(Get-GatedLanes -CompanyModel $companyModel)
$templateSelection = Get-TemplateName -ExplicitTemplate $Template -TaskRecord $taskRecord -AutoBootstrap $autoBootstrap
$templateName = [string]$templateSelection.name
$templateSource = [string]$templateSelection.source
$templateRecord = $companyModel.templates.$templateName
$rolePacks = Get-CompanyRolePacks -CompanyModel $companyModel
$currentRuntimeContext = Get-CurrentRuntimeContext

if ($null -eq $templateRecord) {
  throw "Company template not found in policy: $templateName"
}

$explicitSelection = $PSBoundParameters.ContainsKey('ActivateLanes') -and @($ActivateLanes).Count -gt 0
$requestedActivateLanes = @($ActivateLanes | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
$plannedActivateLanes = if ($PSBoundParameters.ContainsKey('ActivateLanes') -and @($requestedActivateLanes).Count -gt 0) {
  @($requestedActivateLanes)
} elseif ($NoActivateInitialLanes) {
  @()
} else {
  @(Get-InitialActivateLanes -LaneRecords @($templateRecord.lanes) -GatedLanes $gatedLanes -AutoBootstrap $autoBootstrap)
}
$plannedActivateLanes = @(Apply-AutoBootstrapActivationPolicy -LaneNames $plannedActivateLanes -TemplateRecord $templateRecord -RolePacks $rolePacks -TaskRecord $taskRecord -AutoBootstrap $autoBootstrap -ExplicitSelection:$explicitSelection)
$effectiveAgentId = if (-not [string]::IsNullOrWhiteSpace($AgentId)) {
  $AgentId
} elseif (-not [string]::IsNullOrWhiteSpace([string]$currentRuntimeContext.agent_id)) {
  [string]$currentRuntimeContext.agent_id
} else {
  $null
}
$activationMode = 'auto'
$activationReason = 'eligible'
$autoActivateInitialLanes = @($plannedActivateLanes).Count -gt 0
if ($autoActivateInitialLanes -and [bool]$activationPolicy.requireBoundWorkerToStartSubstantialTasks -and [string]::IsNullOrWhiteSpace([string]$effectiveAgentId)) {
  $autoActivateInitialLanes = $false
  $activationMode = 'planned_only'
  $activationReason = 'missing_bound_worker_context'
}
$activationAgentContext = if ([string]::IsNullOrWhiteSpace([string]$effectiveAgentId)) { 'none' } else { 'present' }

Write-Output ("AUTO_COMPANY_WORKSTREAM template={0} source={1} activate_initial_lanes=[{2}] helper={3}" -f `
    $templateName, `
    $templateSource, `
    (Join-DisplayValues -Values $plannedActivateLanes), `
    [string]$autoBootstrap.helperScript)

$guidance = Get-AutoBootstrapGuidance -TaskRecord $taskRecord -TemplateRecord $templateRecord -RolePacks $rolePacks -AutoBootstrap $autoBootstrap
Write-Output ("AUTO_COMPANY_GUIDANCE office_hours_first={0} visual_scope_detected={1} design_review_policy={2}" -f `
    [string]$guidance.officeHoursFirst, `
    [string]$guidance.visualScopeDetected, `
    [string]$guidance.designReviewPolicy)
Write-Output ("AUTO_COMPANY_ACTIVATION mode={0} reason={1} agent_context={2}" -f `
    $activationMode, `
    $activationReason, `
    $activationAgentContext)

$startArgs = @(
  '-File', $startScriptPath,
  '-Workspace', $workspacePath,
  '-Task', [string]$taskRecord.id,
  '-Template', $templateName
)

if (-not [string]::IsNullOrWhiteSpace($Runtime)) {
  $startArgs += @('-Runtime', $Runtime)
}
if (-not [string]::IsNullOrWhiteSpace([string]$effectiveAgentId)) {
  $startArgs += @('-AgentId', [string]$effectiveAgentId)
}

if ($DryRun) {
  $startArgs += '-DryRun'
} elseif ($autoActivateInitialLanes) {
  $startArgs += '-ActivateLanes'
  $startArgs += $plannedActivateLanes
}

& pwsh @startArgs
if ($LASTEXITCODE -ne 0) {
  throw "auto-start-company-workstream failed for task '$([string]$taskRecord.id)'."
}
