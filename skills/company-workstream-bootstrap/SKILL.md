---
name: company-workstream-bootstrap
description: Use when a substantial task should be staffed like a small company team across product, design, engineering, QA, release, or submission lanes.
---

# Company Workstream Bootstrap

## When To Use

- New feature or platform initiative
- Cross-functional growth or launch work
- Submission or document work that needs explicit review lanes
- Any substantial task where `explore / implement / verify` is too coarse

## Workflow

1. Make sure the task already exists in `sysint`.
2. Use the helper first so the default template and first role lanes are chosen without improvisation:

```powershell
pwsh -File .\scripts\auto-start-company-workstream.ps1 -Task "<task-id>" -DryRun
```

3. Choose the matching template only when you need to override the helper:
   - `feature`
   - `platform`
   - `growth`
   - `submission`
4. Preview the staffing plan manually when the helper choice is not enough:

```powershell
pwsh -File .\scripts\start-company-workstream.ps1 -Task "<task-id>" -Template feature -DryRun
```

5. Apply the workstream through the helper by default:

```powershell
pwsh -File .\scripts\auto-start-company-workstream.ps1 -Task "<task-id>"
```

6. Apply the workstream template manually only when overriding the helper:

```powershell
pwsh -File .\scripts\start-company-workstream.ps1 -Task "<task-id>" -Template feature
```

7. Read the runtime staffing runbook printed by the script.
   - confirm it shows `preferred_runtime` for each lane
   - confirm it shows `role pack` and `pack brief` for non-code lanes
   - confirm it shows the non-code lane `entry gate`, `first prompt`, and any `use when` / `skip when` guidance
   - confirm it shows expected `deliverables` for non-code lanes
   - confirm it prints the current concurrency guide
8. Honor the role-pack entry gates before opening follow-on lanes.
   - `product-discovery` and `submission-strategy` lanes run `/office-hours` first when the scope, wedge, evaluator lens, or narrative is still unsettled
   - `design-review` lanes stay dormant unless the task has real UI, UX, mockup, or live visual-surface scope
   - use `/plan-design-review` before implementation and `/design-review` only after implementation on an actual visual surface
9. Activate the lane through the gated helper instead of bypassing the ledger:

```powershell
pwsh -File .\scripts\activate-company-workstream-lane.ps1 -Task "<task-id>" -Lane backend
```

10. Pass `-Runtime "<runtime>"` only when the actual worker differs from the preferred runtime in policy.
11. Spawn only code lanes into `ao` or other isolated runtimes.
12. Bind actual worker sessions back into `sysint` with `sysint-orchestrate bind -Task "<task-id>" -Lane "<lane>" -Runtime "<runtime>" -AgentId "<agent-id>"`.
   - lane activation now rejects missing bound-worker context, checks role-skill freshness before use, and can auto-promote the parent task after a successful bind
13. Keep QA and release lanes gated until dependencies and fresh verification evidence exist.
14. If lane policy, runtime routing, or gating changed, run the rehearsal drill before using the model for real work:

```powershell
pwsh -File .\scripts\run-company-workstream-rehearsal.ps1 -Template feature
```

## Verification

- `sysint-orchestrate list -Workspace "<workspace>"`
- `sysint-orchestrate status -Workspace "<workspace>"`
- confirm `auto-start-company-workstream.ps1 -DryRun` prints the inferred template and initial lane set
- confirm the dry-run or apply output includes lane-by-lane bind guidance, `preferred_runtime`, and the concurrency guide
- confirm `auto-start-company-workstream.ps1` falls back to staffing-only mode when no bound worker context exists
- confirm non-code lanes print `role pack`, `pack brief`, `entry gate`, `first prompt`, `use when` / `skip when`, and `deliverables`
- confirm the activation helper still enforces dependency, verification, and concurrency gates
- run `pwsh -File .\scripts\run-company-workstream-rehearsal.ps1 -Template feature` when validating company-model behavior end to end
- `pwsh -File .\scripts\run-completion-gate.ps1` when the company model docs, scripts, or policy changed

## Common Mistakes

- Using `ao` for every lane, including product and QA
- Waiting for the user to ask for orchestration instead of auto-starting the company workstream on substantial cross-functional work
- Skipping `/office-hours` on `product-discovery` or `submission-strategy` when the direction is still fuzzy
- Opening a `design-review` lane for document-only, infra, MCP, auth, or CLI work with no actual visual surface
- Spawning workers before the workstream template exists in the ledger
- Activating QA or review/release directly instead of going through the gated helper
- Letting the current shell runtime leak into a lane instead of using the policy preferred runtime
- Activating more lanes in one batch than `maxConcurrentActivations`
- Stuffing repeated prompt lists back into each template instead of keeping them in shared `rolePack` definitions
- Treating gstack as the control plane instead of the role plane
- Skipping the `review-release` gate because code lanes already passed
