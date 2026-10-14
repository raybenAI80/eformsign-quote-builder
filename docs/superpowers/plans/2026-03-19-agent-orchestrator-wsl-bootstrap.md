# Agent Orchestrator WSL Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이 저장소에 WSL 기준 Agent Orchestrator 운영 베이스라인을 추가한다.

**Architecture:** 설정 파일, 규칙 파일, Windows-to-WSL 실행 래퍼, 운영 문서를 저장소에 함께 둔다.

**Tech Stack:** YAML, Markdown, PowerShell, WSL, tmux, Codex CLI

---

## Chunk 1: Baseline Files

### Task 1: Orchestrator config

**Files:**
- Create: `agent-orchestrator.yaml`
- Create: `.agent-rules.md`

- [ ] `tmux`, `codex`, `worktree`를 기본값으로 둔다
- [ ] 프로젝트 경로를 `/mnt/c/eformsign-견적서-빌더`로 둔다
- [ ] 종료 전 `npm run build`와 필요한 `vitest` 실행 규칙을 둔다

### Task 2: Windows wrapper

**Files:**
- Create: `scripts/ao-wsl.ps1`

- [ ] 저장소 루트를 WSL 경로로 변환한다
- [ ] WSL 안에서 전달받은 `ao ...` 명령을 실행한다
- [ ] 종료 코드를 그대로 반환한다

## Chunk 2: Runbook

### Task 3: Operator documentation

**Files:**
- Create: `docs/agent-orchestrator-wsl.md`
- Modify: `README.md`

- [ ] 설치 절차를 문서화한다
- [ ] `ao status`, `ao start`, `ao spawn <project> [issue]` 사용 예시를 적는다
- [ ] `gh`, `tmux`, `codex` 누락 시 복구 절차를 적는다

## Chunk 3: Verification

### Task 4: Verify baseline

**Files:**
- Verify: `agent-orchestrator.yaml`
- Verify: `scripts/ao-wsl.ps1`
- Verify: `docs/agent-orchestrator-wsl.md`

- [ ] `npm run build`
- [ ] `.\scripts\ao-wsl.ps1 -Command "pwd && tmux -V && codex --version"`
- [ ] `.\scripts\ao-wsl.ps1 -Command "gh --version"` 결과로 WSL 상태를 재확인
