# Completion Gate

Before declaring completion, answer each item with evidence:

1. Did I read the relevant operating contract, workflow, and source files first?
2. Did I update related docs or terms if contracts, policies, or workflows changed?
3. Did I run `pwsh -File .\scripts\run-completion-gate.ps1` for harness-structure changes?
4. Did I run the relevant project-standard verification commands?
5. Did I run `sysint-verify run -Workspace "<workspace>"` before making a full-workspace completion claim?
6. Did I verify the user-visible behavior or document outcome, not just the source change?
7. Did I start substantial cross-functional work through `auto-start-company-workstream.ps1` or explicitly justify why I overrode it?
8. Did I use the right workstream template if the task was cross-functional?
9. Did I activate company lanes through `activate-company-workstream-lane.ps1` or an equivalent gated path instead of bypassing the ledger?
10. Did I keep gated lanes such as QA and review/release closed until fresh verification evidence existed?
11. Did I bind dedicated company-workstream lanes back into `sysint` if I used separate workers or role sessions?
12. Did I report remaining risks or gaps honestly?

## Minimum Verification Paths

- Harness docs, skill, or policy changes:
  - `pwsh -File .\scripts\run-completion-gate.ps1`
  - `sysint-verify run -Workspace "<workspace>"`
- Cross-functional workstream setup changes:
  - `pwsh -File .\scripts\auto-start-company-workstream.ps1 -Task "<task-id>" -DryRun`
  - `pwsh -File .\scripts\start-company-workstream.ps1 -Task "<task-id>" -Template feature -DryRun`
  - `pwsh -File .\scripts\activate-company-workstream-lane.ps1 -Task "<task-id>" -Lane "<lane>" -DryRun`
  - inspect the inferred template, emitted runtime staffing runbook, activation helper, and gated-lane rules
- Project-standard verification:
  - `pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-project-verification.ps1 -Name lint`
  - `pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-project-verification.ps1 -Name typecheck`
  - `pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-project-verification.ps1 -Name test`

## Honesty Rule

- No completion claim without fresh verification evidence.
- If a command could not be run, say that directly and explain the gap.

