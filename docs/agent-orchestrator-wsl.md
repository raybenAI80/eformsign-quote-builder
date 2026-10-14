# Agent Orchestrator on Windows + WSL

이 저장소의 권장 운영 경로는 `Windows + WSL + tmux + codex` 입니다.

## 왜 이 경로인가

- 현재 워크스페이스는 Windows에 있지만 Agent Orchestrator의 안정적인 기본 런타임은 `tmux`입니다.
- `cmux`는 macOS 전용이라 이 환경의 후보가 아닙니다.
- Windows 네이티브 `runtime-process`보다 `WSL + tmux`가 장기 세션 운영과 복구에 더 적합합니다.

## 저장소에 포함된 파일

- [`agent-orchestrator.yaml`](/c:/eformsign-견적서-빌더/agent-orchestrator.yaml)
- [`.agent-rules.md`](/c:/eformsign-견적서-빌더/.agent-rules.md)
- [`scripts/ao-wsl.ps1`](/c:/eformsign-견적서-빌더/scripts/ao-wsl.ps1)

## 현재 확인된 환경

2026-03-19 기준:

- Windows: `node`, `git`, `gh`, `codex` 확인
- WSL Ubuntu: `node`, `git`, `tmux`, `codex` 확인
- WSL Ubuntu: `gh` 설치 및 인증 확인
- 전체 대시보드 경로는 `~/src/agent-orchestrator` 소스 빌드 기준으로 검증

## WSL 1회 설정

```powershell
wsl -d Ubuntu
```

```bash
node -v
git --version
tmux -V
codex --version
```

`gh` 설치:

```bash
sudo apt update
sudo apt install -y gh
gh auth login
gh auth status
```

Agent Orchestrator 설치:

```bash
npm install -g @composio/agent-orchestrator
ao --version
ao doctor
```

이번 환경에서는 npm 배포판만으로는 `@composio/ao-web` 누락으로 대시보드가 뜨지 않았습니다.
대시보드까지 포함한 검증 경로는 아래와 같습니다.

```bash
mkdir -p ~/src
git clone https://github.com/ComposioHQ/agent-orchestrator.git ~/src/agent-orchestrator
cd ~/src/agent-orchestrator
bash scripts/setup.sh
```

## Windows에서 사용하는 명령

상태 확인:

```powershell
.\scripts\ao-wsl.ps1 -Command "ao status"
```

헬스 체크:

```powershell
.\scripts\ao-wsl.ps1 -Command "ao doctor"
```

대시보드 시작:

```powershell
.\scripts\ao-wsl.ps1 -Command "ao start eformsign-quote-builder"
```

이슈 스폰:

```powershell
.\scripts\ao-wsl.ps1 -Command "ao spawn eformsign-quote-builder 123"
```

세션에 지시 전달:

```powershell
.\scripts\ao-wsl.ps1 -Command "ao send eformsign-123 `"Run the build and fix the PDF export failure.`""
```

대시보드:

- `http://localhost:3310`

## 운영 메모

- `defaults.notifiers`는 비워 두었습니다. WSL 리눅스 데스크톱 알림을 가정하지 않기 위해서입니다.
- 워크트리 생성 후 `npm ci`를 실행하도록 했습니다.
- 현재 설정 경로는 `/mnt/c/eformsign-견적서-빌더` 입니다.
- 현재 검증된 WSL 메타데이터 경로는 `/home/forcs/.agent-orchestrator`, `/home/forcs/.worktrees` 입니다.
- `scripts/ao-wsl.ps1`는 Windows `HOME` 환경변수를 그대로 넘기지 않고 WSL 홈 경로로 정규화합니다.
- 성능이나 유니코드 문제가 보이면 WSL 내부 경로로 다시 클론한 뒤 `agent-orchestrator.yaml`의 `path`를 갱신하십시오.

## 트러블슈팅

`gh: command not found`

```bash
sudo apt update && sudo apt install -y gh
gh auth login
```

`codex: command not found`

- WSL 안에 Codex CLI가 설치되어 있는지 확인
- `codex --version`으로 재확인

`tmux: command not found`

```bash
sudo apt update && sudo apt install -y tmux
```

`Could not find @composio/ao-web package`

- npm 배포판만 설치된 상태에서 대시보드 패키지가 빠진 경우입니다.
- `~/src/agent-orchestrator`에 공식 저장소를 클론한 뒤 `bash scripts/setup.sh`를 실행하고 source-built CLI를 사용하십시오.

포트 충돌:

- [`agent-orchestrator.yaml`](/c:/eformsign-견적서-빌더/agent-orchestrator.yaml)의 `port`, `terminalPort`, `directTerminalPort`를 함께 변경
