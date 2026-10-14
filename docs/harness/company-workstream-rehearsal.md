# Company Workstream Rehearsal

Run this drill when one of these is true:

- the company-style operating model was just introduced
- lane policy, gating, or runtime binding behavior changed
- the team has not exercised a full company-style flow in a while

The goal is not to ship product work. The goal is to prove that the workstream can be staffed, gated, verified, and closed without ad hoc operator moves.

## What The Drill Covers

- template dry-run output
- policy-driven preferred runtime selection
- concurrency guidance emission
- lane creation in the `sysint` ledger
- lane activation through the gated helper
- dependency enforcement between lanes
- fresh verification before `qa` and `review-release`
- end-to-end closure of a disposable rehearsal task

## Runtime Defaults

The rehearsal reads `.sysint/system-intelligence.json` under `orchestration.companyModel.runtimeRouting`.

- Code lanes default to the policy code runtime.
- Role lanes default to the policy role runtime.
- Lane-specific overrides win by default.
- `-CodeRuntime` and `-RoleRuntime` are rehearsal-only overrides when you want to prove a different runtime mix without editing policy first.

## Standard Command

```powershell
pwsh -File .\scripts\run-company-workstream-rehearsal.ps1 -Template feature
```

## Useful Variants

Dry-run only:

```powershell
pwsh -File .\scripts\run-company-workstream-rehearsal.ps1 -Template feature -DryRunOnly
```

Leave the rehearsal task open for manual inspection:

```powershell
pwsh -File .\scripts\run-company-workstream-rehearsal.ps1 -Template feature -KeepTaskOpen
```

Skip the fresh verification rerun only when the goal is staffing inspection rather than a full gate rehearsal:

```powershell
pwsh -File .\scripts\run-company-workstream-rehearsal.ps1 -Template feature -SkipVerification
```

## Expected Evidence

- a dedicated rehearsal task appears in `sysint`
- dry-run emits `COMPANY_WORKSTREAM_DRY_RUN_OK`
- apply emits `COMPANY_WORKSTREAM_OK`
- final output emits `COMPANY_WORKSTREAM_REHEARSAL_OK`
- output records the resolved runtime defaults for the rehearsal run
- non-gated lanes move through `in_progress` to `completed`
- gated lanes only activate after fresh verification is available

## Pass Criteria

The rehearsal passes when all of these are true:

- template dry-run succeeds
- all planned lanes are created
- non-gated lanes can be activated and completed in order
- gated lanes do not bypass dependency or verification rules
- the rehearsal task can be marked complete without manual ledger repair

## Failure Handling

- If dry-run fails, fix template or policy shape first.
- If a lane activates out of order, fix dependency or activation policy.
- If a gated lane opens without fresh verification, fix the gate before trusting the company model.
- If the task cannot close cleanly, inspect `sysint-orchestrate` state and recovery posture before changing the script.
