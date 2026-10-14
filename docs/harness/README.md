# Harness Map

This folder is the local operating layer that applies the global harness manual to this workspace.

## Canonical References

- Global manual:
  - `C:\Users\FORCS\.agent-harness\HARNESS-ENGINEERING-MANUAL.md`
- Global control plane guide:
  - `C:\Users\FORCS\.agent-harness\GLOBAL-HARNESS.md`
- Global company operating model:
  - `C:\Users\FORCS\.agent-harness\COMPANY-OPERATING-MODEL.md`
- Global complements:
  - `C:\Users\FORCS\.agent-harness\COMPLEMENTS.md`

## Local Layer Map

- Layer A, constitution:
  - `AGENTS.md`
- Layer B, task-specific workflows:
  - `skills\company-workstream-bootstrap\SKILL.md`
  - `skills\api-endpoint-workflow\SKILL.md`
  - `docs\harness\adoption-order.md`
- Layer C, automatic enforcement:
  - `.harness\project-harness.json`
  - `.sysint\system-intelligence.json`
  - `scripts\run-completion-gate.ps1`
  - `scripts\start-company-workstream.ps1`
    - emits the per-lane runtime staffing runbook, role packs, and deliverables
  - `scripts\activate-company-workstream-lane.ps1`
  - `scripts\run-company-workstream-rehearsal.ps1`
  - `scripts\install-git-hooks.ps1`
  - `docs\checklists\completion-gate.md`
  - `docs\checklists\repeated-violation-promotion.md`
- Layer D, memory and learning:
  - `docs\glossary\README.md`
  - `docs\harness\company-operating-model.md`
  - `docs\harness\company-workstream-rehearsal.md`
  - `docs\harness\failure-log.md`
  - `docs\harness\weekly-harness-review.md`

## Adoption Sequence

1. Read the global manual, company operating model, and this repository contract.
2. Confirm the repository-standard `lint`, `typecheck`, and `test` commands in `.harness\project-harness.json`.
3. Confirm `.sysint\system-intelligence.json` exists and includes the local completion gate command.
4. Run `scripts\install-git-hooks.ps1` if this is a git repository and hooks were not installed yet.
5. Use the company workstream skill when the task is cross-functional instead of inventing ad-hoc lane names.
6. Read the staffing runbook printed by `start-company-workstream.ps1` before spawning code or review lanes, and use the published role packs instead of inventing new specialist prompt bundles inline.
7. Run `scripts\run-company-workstream-rehearsal.ps1` after changing runtime routing, activation policy, or lane gating.
8. Promote repeated misses into scripts, hooks, or checks.
