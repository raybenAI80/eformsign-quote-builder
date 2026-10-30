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

## 요금제 유형 (충전형 / 구독형)

- Definition: 견적서 품목의 category 로 판별하는 견적의 요금제 성격. `문서 충전` 이면 충전형, `구독형` 이면 구독형이고, 둘이 함께 있으면 혼합이다. 참고사항 기본 문구와 불일치 경고의 기준이다.
- Difference: 하단 종류(brandingMode)·sector(가격 계산용)와 별개 축이다. 서로 대신 쓰지 않는다.
- Example: `src/utils/planType.ts` 의 `detectPlanType`.
- Avoid: sector 나 brandingMode 로 요금제 유형을 추정하기, 품목명으로 충전형·구독형을 판별하기.

## 참고사항 불일치 경고

- Definition: 견적의 요금제 유형과 맞지 않는 문장(충전형에 청구일·이월 문구, 구독형에 계약기간·문서 사용기한 문구 등)이 참고사항에 있을 때 편집기에 표시하고 PDF·PNG 저장 직전에 확인창으로 한 번 더 묻는 장치.
- Difference: 문구를 자동으로 고치지 않는다. 경고만 한다. 병합 PDF 에는 확인창이 없다. 혼합·유형 없음 견적은 경고하지 않는다.
- Example: `NotesMismatchModal`, `findMismatchedNotes`.
- Avoid: 저장된 견적의 참고사항을 자동 수정하는 동작이라고 부르기.

## Term Template

- Name:
- Definition:
- Difference from nearby terms:
- Example:
- Forbidden mixed usage:

## Notes

- 운영 용어, 도메인 용어, 아키텍처 용어를 섞어 쓰지 않는다.
- 같은 의미를 가진 중복 용어가 생기면 하나를 표준으로 정하고 금지 표현을 남긴다.
