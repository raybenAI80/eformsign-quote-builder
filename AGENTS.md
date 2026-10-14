# Project Operating Contract

## Scope
- Keep only workspace-wide rules here.
- Put task-specific workflows in `skills/` or `docs/harness/`.

## Core Rules
- Solve the task directly when safe.
- Read relevant docs, config, and verification targets before editing.
- Update related docs when contracts, APIs, architecture, automation policy, or operating terms change.
- Reuse existing modules and patterns before adding new abstractions.
- Prefer `sysint` as the control plane for substantial multi-step work.
- Verify before claiming completion.
- Do not use destructive commands unless explicitly approved.
- If the same mistake repeats, encode the prevention into the harness.

## Workflow
- Start from the smallest source or doc surface that explains the change.
- Keep diffs small, reversible, and workspace-scoped.
- Use `docs/checklists/completion-gate.md` as the minimum exit gate.
- Use `skills/company-workstream-bootstrap/SKILL.md`, `scripts/start-company-workstream.ps1`, and `scripts/activate-company-workstream-lane.ps1` when a task should be staffed across product, design, engineering, QA, or release lanes.
- Add or update glossary entries when new terms or renamed concepts appear.
- Record meaningful progress in `sysint` for substantial work.
- When changing verification behavior, update `.sysint/system-intelligence.json` in the same work block.
- If this workspace is running under `ao` and automatic metadata updates fail, refresh session metadata through `~/.ao/bin/ao-metadata-helper.sh` before relying on lane state.

## Verification
- Prefer `sysint-verify run -Workspace "<workspace>"` for full-workspace proof.
- Run `pwsh -File .\scripts\run-completion-gate.ps1` for harness-structure changes.
- Do not report completion from inspection alone.

## Completion
- Report changed files.
- Report verification actually run.
- Report remaining risks or gaps.
- If verification could not run, say so explicitly.
