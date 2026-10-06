---
name: quote-builder-state-flow
description: 견적서 빌더의 견적 상태 흐름(새 견적·초기화·앱 로드 복원·템플릿 불러오기)을 바꾸거나 필드를 추가할 때 사용한다. 경로별로 어떤 필드를 유지하고 비우는지, 필드 분류 상수, 완료 전 브라우저 검증 시나리오, 함정을 다룬다. 트리거 - 초기화, 복원, 새 견적, 견적일자, 담당자 유지, 고객사 비움, localStorage, resetQuote, normalizeRestoredMeta, buildResetMeta, RESET_PRESERVED_META_KEYS, RESET_CUSTOMER_META_KEYS, getLocalToday.
---

# 견적서 빌더 상태 흐름

정본 코드는 `src/hooks/useQuote.ts` 다. 테스트는 `src/hooks/useQuote.test.ts` 에 있다.
배경 커밋은 `8ba89e4`(초기화 시 담당자 유지·견적일자 오늘)와 `9ec3624`(앱 로드 복원 시 고객사 비움)다.
게이트는 `C:/Users/FORCS/.agent-harness/gates/gates.json` 의 `R25-ui-state-flow-browser-verify` 이고, 완료 전에 리시트 `ui-state-flow-browser-scenario` 가 필요하다.

## 1. 경로별 상태 흐름

| 경로 | 진입점 | 견적일자 | 유지 | 비움 | items |
|---|---|---|---|---|---|
| 초기화 버튼 (「견적 초기화」 확인 모달) | `App.tsx handleReset` → `actions.resetQuote()` → `buildResetMeta(prev)` | 오늘(로컬) | `RESET_PRESERVED_META_KEYS` 9개만 | 나머지 meta 전부(`createEmptyMeta()` 기준) — 고객사 4필드 포함 | 비움. history 도 비우고 `DATA_KEY` 를 삭제 |
| 앱 로드 / 새로고침 (localStorage 복원) | `useQuote` 마운트 effect → `normalizeRestoredMeta(parsed.meta)` | 오늘(로컬) | 고객사 외 meta 전부(담당자·옵션·표시 설정 등) | `RESET_CUSTOMER_META_KEYS` 4개 | 복원. presets·history·categoryLabels 도 복원 |
| 템플릿 「이어서 작성하기」 | `applyPreset(id)` | 저장 당시 값 | 저장 당시 meta 전부 | 없음 | 템플릿 items |
| 템플릿 「새로 작성하기」 | `applyPresetAsNew(id)` | `createDefaultMeta()` 의 오늘 | 템플릿 meta(고객사 포함) | quoteNo·quoteDate·validityDays·issueSequence 를 기본값으로 | 템플릿 items |

- 저장 키는 `src/constants.ts` 의 `DATA_KEY = 'eformsign_quote_simple_contacts_v2_ascii'` 다. 구 키 `eformsign_quote_simple` 도 복원할 때 읽는다. 저장은 300ms 디바운스로 이루어진다.
- quoteNo 는 이니셜·날짜·순번 effect 가 다시 계산한다. 복원 경로에서 직접 만들지 않는다.
- 템플릿 경로 두 개는 `normalizeRestoredMeta` 를 거치지 않는다. 의도된 동작이므로 바꾸려면 요구를 먼저 확인한다.

## 2. 필드 분류 상수와 새 필드 규칙

`src/hooks/useQuote.ts` 의 두 상수가 단일 진실이다.

- `RESET_PRESERVED_META_KEYS`: 우리 회사(영업) 쪽 정보다. 초기화해도 유지한다. `contactInitials`·`contactName`·`contactTitle`·`contactDirect`·`contactMobile`·`contactEmail`·`salesManager`·`salesEmail`·`salesContact` 이 여기에 속한다.
- `RESET_CUSTOMER_META_KEYS`: 고객사 쪽 정보다. 초기화와 앱 로드 복원 두 경로 모두에서 비운다. `customerName`·`customerManager`·`customerEmail`·`customerContact` 이 여기에 속한다.

`QuoteMeta` 에 새 필드를 추가하면 아래 순서로 판단한다.

1. **고객사마다 달라지는 값**(고객 담당자·고객 주소·고객 사업자번호 등)이면 `RESET_CUSTOMER_META_KEYS` 에 넣는다. 그러면 두 경로 모두에서 비워진다.
2. **작성자·우리 회사 담당자 값**이면 `RESET_PRESERVED_META_KEYS` 에 넣는다. 넣지 않으면 초기화 때 사라진다.
3. **견적 단위 설정**(할인·표시 옵션·절사 단위 등)은 어느 상수에도 넣지 않는다. 그러면 초기화 때는 기본값으로 돌아가고 복원 때는 유지된다. 이 동작이 맞는지 요구와 대조한다.
4. 분류를 정했으면 `useQuote.test.ts` 의 `buildResetMeta`·`normalizeRestoredMeta` describe 에 케이스를 추가하고, 아래 3절 브라우저 시나리오를 다시 수행한다.

## 3. 브라우저 검증 시나리오 (완료 전 필수)

vitest 통과와 배포 번들 grep 은 완료 근거가 아니다. 아래를 실제 브라우저에서 수행한다.

- [ ] dev 서버를 띄운다: `preview_start name:"dev"`(`.claude/launch.json`, `vite --port 3001`).
- [ ] 로그인을 우회해 연다: `http://localhost:3001/?bypass-auth`. `ProtectedRoute.tsx` 가 DEV 에서만 허용한다.
- [ ] 온보딩 투어가 뜨면 「건너뛰기」를 누른다.
- [ ] 뷰포트를 **1440×1000** 으로 맞춘다. 폭이 1024 미만이면 편집기가 숨겨진다.
- [ ] 고객사명·담당자 이니셜·영업 담당자·**과거 견적일자**·항목 1개 이상을 입력한다.
- [ ] **새로고침**한다. 고객사 4필드만 빈칸이고 견적일자는 오늘이며, 이니셜·영업 담당자·항목은 그대로인지 확인한다.
- [ ] **초기화 버튼**을 누르고 확인한다. 항목까지 비워지고, 담당자 9필드는 유지되며, 견적일자는 오늘인지 확인한다.
- [ ] 변경한 경로가 더 있으면(템플릿 불러오기 등) 같은 방식으로 각 경로를 밟는다.
- [ ] 리시트를 남긴다:
  `node C:/Users/FORCS/.agent-harness/gates/gate-receipt.mjs --artifact <변경한 src 파일> --gate ui-state-flow-browser-scenario --verdict pass --evidence "<날짜> 브라우저 시나리오: 새로고침=<관찰값> / 초기화=<관찰값> · 1440x1000 · localhost:3001/?bypass-auth"`
- [ ] `node C:/Users/FORCS/.agent-harness/gates/gate-verify.mjs --task "<요청 원문>" --artifact <같은 파일>` 이 exit 0 인지 확인한다. 리시트는 sha256 에 묶여 있으므로 파일을 다시 고치면 리시트를 다시 발급해야 한다.

## 4. 함정

- **「~할 때」 해석**: "견적서 만들 때 고객사 비움" 같은 시점 표현은 그 상태에 이르는 **모든 경로**를 뜻한다. 초기화 버튼, 앱 로드 복원, 새로고침, 템플릿 새로 작성이 모두 포함된다. 2026-10-02 에는 이 요구를 초기화 버튼으로만 해석해 복원 경로를 빠뜨렸고, 사용자가 "고객정보가 그대로 남아있는데?"라고 지적했다.
- **toISOString 하루 어긋남**: `new Date().toISOString().slice(0,10)` 은 UTC 기준이다. KST 자정부터 09시까지는 어제 날짜가 나온다. 견적일자는 반드시 `getLocalToday()` 를 쓴다. `PreviewPanel.tsx`·`QuotePDFDocument.tsx` 의 납기일 계산과 `App.tsx` 의 파일명에는 아직 `toISOString` 이 남아 있다.
- **bypass-auth**: 쿼리 `?bypass-auth` 는 `import.meta.env.DEV` 에서만 동작한다. 배포본에서는 로그인이 필요하다.
- **1024px 편집기 숨김**: `MainLayout.tsx` 는 `innerWidth < 1024` 이면 편집기 패널을 숨긴다. mobile 프리셋에서는 입력란이 보이지 않는다.
- **온보딩 모달**: 첫 방문 시 투어가 화면을 가린다. 「건너뛰기」를 누르면 `localStorage` 에 완료 표시가 저장된다.
- **완료 보고 근거**: "단위 테스트 통과 + 배포 번들에서 함수명 grep" 으로 완료를 보고했다가 "테스트 안했어?"라는 지적을 받았다. 화면을 보지 않았다면 완료가 아니다.
