# Agent Orchestrator WSL Design

## Goal

Windows 호스트에서 이 저장소를 Agent Orchestrator로 안정적으로 운영할 수 있는 기본 경로를 저장소 안에 명시한다.

## Decision

- 기본 운영 경로는 `WSL + tmux + codex + git worktree`
- `cmux`는 macOS 전용이므로 제외
- Windows 네이티브 `runtime-process`는 대안으로만 남기고 기본값으로 채택하지 않음

## Scope

1. `agent-orchestrator.yaml` 추가
2. `.agent-rules.md` 추가
3. `scripts/ao-wsl.ps1` 추가
4. 운영 문서 추가

## Repository Mapping

- GitHub repo: `rayben80/eformsign-quote-builder`
- 현재 WSL 경로: `/mnt/c/eformsign-견적서-빌더`
- metadata dir: `~/.agent-orchestrator`
- worktree dir: `~/.worktrees`

## Guardrails

- `.env*`는 수정하지 않음
- `backup_*`는 요청 없이는 건드리지 않음
- 한국어 카피와 PDF 레이아웃 보존
- 작업 종료 전 `npm run build` 수행

## Success Criteria

- Windows에서 `.\scripts\ao-wsl.ps1 -Command "ao status"`가 동작한다
- 운영자가 이 저장소만 보고 설치와 복구 경로를 이해할 수 있다
