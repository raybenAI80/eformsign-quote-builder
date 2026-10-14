# Company Operating Model

This workspace uses a company-style operating model for substantial cross-functional work. The goal is to staff one task with the right specialist lanes, keep state in one control plane, and keep release gates explicit.

## Three Planes

- `sysint` is the control plane.
  - It owns task state, orchestration units, verification history, handoff, recovery, and the official ledger.
- `ao` is the execution plane.
  - It owns isolated coding workers, worktrees, branches, and long-running code sessions.
- `gstack` is the role plane.
  - It supplies specialist roles and review prompts such as product review, design review, QA, and release.

Use all three together. Do not ask one plane to do another plane's job.

## Rehearsal

Before the first real staffed delivery, or after changing lane policy, gating, or staffing scripts, run a full rehearsal:

```powershell
pwsh -File .\scripts\run-company-workstream-rehearsal.ps1 -Template feature
```

The rehearsal is disposable operational evidence. It proves the current workspace can create, activate, gate, verify, and close a company-style workstream without improvisation.

To selectively refresh already-bootstrapped workspaces to the latest company baseline, run:

```powershell
pwsh -File C:\Users\FORCS\.agent-harness\scripts\sync-company-workstream-hardening.ps1
```

## Runtime Routing

Runtime defaults live in `.sysint/system-intelligence.json` under `orchestration.companyModel.runtimeRouting`.

- Default code runtime: `codex`
- Default role runtime: `gstack`
- Default code lanes: `backend`, `frontend`, `infra`, `analytics`
- Default role lanes: `product-strategy`, `strategy`, `design`, `growth-marketing`, `qa`, `review-release`, `submission-strategy`, `evidence-review`, `document-authoring`

`start-company-workstream.ps1` prints the preferred runtime for every lane and the concurrency guide for the current policy. `activate-company-workstream-lane.ps1` uses the preferred lane runtime automatically unless `-Runtime` is passed to override it, and it enforces the concurrency caps from the same policy.

The execution plane can still be `ao`. The runtime recorded on the lane is the actual worker runtime bound back into `sysint`.

## Role Packs

Reusable non-code lane defaults live in `.sysint/system-intelligence.json` under `orchestration.companyModel.rolePacks`.

- A `rolePack` gives one lane its specialist brief, pinned `gstack` prompts, expected deliverables, and any entry-gate guidance.
- Templates should reference packs instead of repeating prompt lists inside every lane.
- Lane records may extend a pack, but the pack remains canonical.
- `product-discovery` and `submission-strategy` lanes start with `/office-hours` when the scope or narrative is still unsettled.
- `design-review` is conditional, not blanket. Use `/plan-design-review` before implementation and `/design-review` only after implementation on a real visual surface.

The seeded baseline includes `product-discovery`, `design-review`, `architecture-review`, `quality-gate`, `release-governance`, `growth-strategy`, `growth-marketing`, `submission-strategy`, `submission-evidence`, `submission-authoring`, `submission-review`, and `submission-release`.

## Team Topology

The default company-style topology for a project seeded from this template is:

- product and strategy
- design
- frontend
- backend
- infra or analytics when needed
- QA
- review and release
- document-heavy work can add evidence and authoring lanes

Not every task should staff every lane. Staffing is template-based.

## Workstream Templates

Templates live in `.sysint/system-intelligence.json` under `orchestration.companyModel.templates`.

- `feature`
  - Product strategy -> design -> frontend/backend -> QA -> review and release
- `platform`
  - Architecture and scope -> backend/infra -> QA -> review and release
- `growth`
  - Strategy -> design -> frontend/analytics -> growth marketing -> QA -> review and release
- `submission`
  - Submission strategy -> evidence review -> document authoring -> QA -> review and release

Bootstrap a staffed workstream with:

```powershell
pwsh -File .\scripts\start-company-workstream.ps1 -Task "<task-id>" -Template feature
```

Default bootstrap path for substantial work:

```powershell
pwsh -File .\scripts\auto-start-company-workstream.ps1 -Task "<task-id>"
```

Preview without changing the ledger:

```powershell
pwsh -File .\scripts\start-company-workstream.ps1 -Task "<task-id>" -Template feature -DryRun
```

The script also prints a runtime staffing runbook for each lane so the next handoff is explicit. For non-code lanes, the runbook must include the `role pack`, `pack brief`, `entry gate`, `first prompt`, any `use when` / `skip when` guidance, and expected `deliverables`.

## Activation Runbook

1. Create or resume the `sysint` task first.
2. Run `auto-start-company-workstream.ps1 -Task "<task-id>" -DryRun` first. Use its inferred template unless there is a concrete reason to override it.
3. Preview the template with `-DryRun`, then apply it for real when the helper path is not enough.
4. Staff code lanes on the execution plane.
   - Use `ao` for isolated coding workers.
   - Open the lane through `pwsh -File .\scripts\activate-company-workstream-lane.ps1 -Task "<task-id>" -Lane "<lane>"` to use the policy default runtime.
   - Pass `-Runtime "<runtime>"` only when the real worker differs from the preferred runtime.
   - When the real worker exists, bind the lane back with `sysint-orchestrate bind -Task "<task-id>" -Lane "<lane>" -Runtime "<runtime>" -AgentId "<agent-id>"`.
5. Staff non-code lanes on the role plane.
   - Use the pinned `gstack` prompts and deliverables printed from the assigned role pack in `start-company-workstream.ps1`.
   - If the lane prints `/office-hours` as the first prompt, run it before ad hoc planning or writing.
   - If the lane is `design-review`, do not activate it unless the task has real UI, UX, mockup, or live visual-surface scope.
   - Lane activation now checks the selected role skills for freshness before trusting the prompt pack.
   - Any freshness finding or warning blocks activation until the printed repair command has been handled.
   - If a dedicated review session owns the lane, open it through `pwsh -File .\scripts\activate-company-workstream-lane.ps1 -Task "<task-id>" -Lane "<lane>"`.
   - Pass `-Runtime "<runtime>"` only when the review lane is intentionally bound to another runtime.
6. Keep `qa` and `review-release` lanes pending until upstream evidence is fresh.
7. If there is no bound worker context yet, `auto-start-company-workstream.ps1` may staff the workstream but leave initial lanes pending.
8. Binding a lane can auto-promote the parent task back to `in_progress` when the task was still `pending`.

## Operating Rules

- Start with a `sysint` task.
- For substantial cross-functional work, start with `scripts\auto-start-company-workstream.ps1` instead of waiting for a user reminder.
- Apply the right workstream template when the task spans multiple functions.
- Spawn only code lanes into `ao`.
- Keep non-code lanes in the control plane and run them through role prompts or normal agent sessions.
- Treat `rolePack` as the reusable contract for non-code lanes, not optional decoration.
- Do not skip `/office-hours` on discovery or submission-strategy lanes when framing is still fuzzy.
- Do not use design-review lanes as a generic quality ritual for document-only or infrastructure work.
- Prefer policy-driven lane runtimes over the current shell runtime.
- Do not force auto-activation when there is no real worker or agent context to bind.
- Activate lanes through `scripts\activate-company-workstream-lane.ps1` so dependency and verification gates stay enforceable.
- Treat concurrency caps as enforced policy, not advisory notes.
- Bind real workers back into `sysint` with `sysint-orchestrate bind`.
- Do not move to review or release without fresh QA and verification evidence.

## Current Limits

- `sysint` auto-scale default: 7 lanes
- `ao` backlog worker cap default: 8 via `AO_MAX_CONCURRENT_AGENTS`
- recommended active worker count: 6
- recommended code workers at once: 4
- recommended role sessions at once: 3
- recommended concurrent lane activations: 4
- these caps are enforced by the company workstream helpers
