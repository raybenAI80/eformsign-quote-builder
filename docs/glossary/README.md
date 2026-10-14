# Glossary

## Harness

- Definition: The operating layer around the model, including rules, workflows, tools, gates, and memory.
- Difference: Not the model itself and not just one prompt file.
- Example: `AGENTS.md`, `skills/`, `.sysint/system-intelligence.json`, verification scripts.
- Avoid: Using "harness" to mean only a system prompt.

## System Intelligence

- Definition: The workspace control plane used for task state, verification history, handoff, recovery, and operational memory.
- Difference: Not the same thing as a coding skill or a dashboard page.
- Example: `sysint-resume`, `sysint-verify`, `sysint-dashboard`.
- Avoid: Using "sysint" as a synonym for the entire harness.

## Control Plane

- Definition: The layer that decides task state, work breakdown, verification gates, and recovery posture.
- Difference: It plans and records work; it does not execute the code changes by itself.
- Example: `sysint`, `.sysint/system-intelligence.json`, orchestration units.
- Avoid: Mixing control-plane policy with worker-specific prompts.

## Execution Plane

- Definition: The layer that runs isolated worker sessions against code or documents.
- Difference: It executes lanes; it does not own the canonical task ledger.
- Example: `ao`, worktrees, runtime-bound worker sessions.
- Avoid: Treating execution tools as the source of truth for project state.

## Role Plane

- Definition: The layer that supplies specialist roles and repeatable operating prompts.
- Difference: It shapes how a worker thinks about a lane, not whether the lane exists.
- Example: `gstack` roles for product, design, QA, and release review.
- Avoid: Confusing role prompts with orchestration policy.

## Role Pack

- Definition: A reusable contract for one non-code lane that bundles its specialist brief, pinned prompts, and expected deliverables.
- Difference: A role plane is the whole surface; a role pack is one reusable staffing unit inside that surface.
- Example: `product-discovery`, `design-review`, `quality-gate`, `submission-review`.
- Avoid: Repeating the same prompt list in every workstream template instead of assigning a shared pack.

## Workstream Template

- Definition: A reusable staffing pattern that expands one task into role-based lanes with explicit dependencies.
- Difference: It is more concrete than a high-level plan and more reusable than one-off lane names.
- Example: feature, platform, growth, and submission templates in `.sysint/system-intelligence.json`.
- Avoid: Creating a fresh lane taxonomy for every task.

## Term Template

- Name:
- Definition:
- Difference from nearby terms:
- Example:
- Forbidden mixed usage:

## Notes

- 운영 용어, 도메인 용어, 아키텍처 용어를 섞어 쓰지 않는다.
- 같은 의미를 가진 중복 용어가 생기면 하나를 표준으로 정하고 금지 표현을 남긴다.
