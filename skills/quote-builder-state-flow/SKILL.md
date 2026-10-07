---
name: quote-builder-state-flow
description: 견적서 빌더의 견적 상태 흐름(새 견적·초기화·앱 로드 복원·템플릿 불러오기)을 바꾸거나 필드를 추가할 때 사용한다. 경로별로 어떤 필드를 유지하고 비우는지, 필드 분류 상수, 완료 전 브라우저 검증 시나리오, 함정을 다룬다. 트리거 - 초기화, 복원, 새 견적, 견적일자, 담당자 유지, 고객사 비움, localStorage, resetQuote, normalizeRestoredMeta, buildResetMeta, RESET_PRESERVED_META_KEYS, RESET_CUSTOMER_META_KEYS, getLocalToday, 참조사항, 자리표시자, 고객사명 연동, placeholder, referenceNotes, renderReferenceNote, restoreCustomerPlaceholder.
---

# 견적서 빌더 상태 흐름

정본 코드는 `src/hooks/useQuote.ts` 다. 테스트는 `src/hooks/useQuote.test.ts` 에 있다.
배경 커밋은 `8ba89e4`(초기화 시 담당자 유지·견적일자 오늘), `9ec3624`(앱 로드 복원 시 고객사 비움), `46050ca`(참조사항 자리표시자 보존)다. 참조사항 자리표시자 규칙은 5절에 있다.
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
- [ ] 참조사항을 건드렸으면 **자리표시자 연동**을 확인한다. 고객사명 입력 → 참조사항 첫 문구를 한 글자 편집 → 고객사명 변경 → 미리보기 문구가 새 고객사명을 따라가는지 본다. 이어서 견적 저장 → 초기화 → 저장 견적 불러오기 → 편집칸에 `{고객사명}` 이 남아 있고 미리보기가 그 견적의 고객사명인지 확인한다.
- [ ] 구 데이터 구제도 확인한다. localStorage 또는 저장 견적의 첫 문구를 `본 견적은 『고객사의 전자계약 서비스 eformsign 도입』…` 처럼 자리표시자 없이 바꾼 뒤 새로고침·불러오기를 해서 `{고객사명}` 으로 복원되는지 본다. 다른 회사명이 박힌 문구는 그대로 남아야 한다.
- [ ] 리시트를 남긴다:
  `node C:/Users/FORCS/.agent-harness/gates/gate-receipt.mjs --artifact <변경한 src 파일> --gate ui-state-flow-browser-scenario --verdict pass --evidence "<날짜> 브라우저 시나리오: 새로고침=<관찰값> / 초기화=<관찰값> · 1440x1000 · localhost:3001/?bypass-auth"`
- [ ] `node C:/Users/FORCS/.agent-harness/gates/gate-verify.mjs --task "<요청 원문>" --artifact <같은 파일>` 이 exit 0 인지 확인한다. 리시트는 sha256 에 묶여 있으므로 파일을 다시 고치면 리시트를 다시 발급해야 한다.

## 4. 함정

- **「~할 때」 해석**: "견적서 만들 때 고객사 비움" 같은 시점 표현은 그 상태에 이르는 **모든 경로**를 뜻한다. 초기화 버튼, 앱 로드 복원, 새로고침, 템플릿 새로 작성이 모두 포함된다. 2026-10-02 에는 이 요구를 초기화 버튼으로만 해석해 복원 경로를 빠뜨렸고, 사용자가 "고객정보가 그대로 남아있는데?"라고 지적했다.
- **toISOString 하루 어긋남**: `new Date().toISOString().slice(0,10)` 은 UTC 기준이다. KST 자정부터 09시까지는 어제 날짜가 나온다. 견적일자는 반드시 `getLocalToday()` 를 쓴다. `PreviewPanel.tsx`·`QuotePDFDocument.tsx` 의 납기일 계산과 `App.tsx` 의 파일명도 `3915d43` 에서 로컬 날짜로 바꿨다.
- **bypass-auth**: 쿼리 `?bypass-auth` 는 `import.meta.env.DEV` 에서만 동작한다. 배포본에서는 로그인이 필요하다.
- **1024px 편집기 숨김**: `MainLayout.tsx` 는 `innerWidth < 1024` 이면 편집기 패널을 숨긴다. mobile 프리셋에서는 입력란이 보이지 않는다.
- **온보딩 모달**: 첫 방문 시 투어가 화면을 가린다. 「건너뛰기」를 누르면 `localStorage` 에 완료 표시가 저장된다.
- **완료 보고 근거**: "단위 테스트 통과 + 배포 번들에서 함수명 grep" 으로 완료를 보고했다가 "테스트 안했어?"라는 지적을 받았다. 화면을 보지 않았다면 완료가 아니다.
- **표시용 치환 결과를 입력 value 로 쓰지 않는다**: 편집 가능한 입력(textarea·input)의 value 에 치환 결과를 넣으면, 한 글자만 고쳐도 치환된 리터럴이 저장되고 자리표시자가 사라진다. 그 뒤로는 고객사명과 영구히 연동되지 않는다. 편집칸은 원문을 다루고, 치환은 렌더할 때만 한다(2026-10-07, `46050ca`).
- **`.replace(문자열)` 은 첫 번째만 바꾼다**: 자리표시자가 두 번 이상 나올 수 있으면 `g` 플래그 정규식이나 `replaceAll` 을 쓴다. 치환을 여러 곳에 흩어 두지 말고 `renderReferenceNote` 하나로 모은다.
- **굳은 저장 데이터 구제는 보수적으로 한다**: 버그를 고칠 때는 이미 잘못 저장된 데이터를 되살릴 경로도 함께 설계한다. 다만 사용자가 의도해서 쓴 값은 건드리지 않는다. 그래서 구제는 기본 첫 문구 패턴에서 `'고객사'` 또는 그 견적의 고객사명일 때만 하고, 본문 전체 역치환은 하지 않는다. 일반 단어(예: "고객사")까지 자리표시자로 바뀌기 때문이다.

## 5. 참조사항 자리표시자

정본 코드는 `src/utils/referenceNotes.ts` 다. 테스트는 `src/utils/referenceNotes.test.ts` 에 있다.

- **표기 2종**: `{고객사명}`(정본, 편집칸 표시와 저장에 쓴다)과 `{customerName}`(구 표기, 읽기만 허용한다). 둘 다 `PLACEHOLDER_RE` 하나로 잡는다.
- **치환 함수**: `renderReferenceNote(note, customerName)` 이 모든 자리표시자를 바꾼다. 고객사명이 비었거나 공백뿐이면 `'고객사'`(`CUSTOMER_NAME_FALLBACK`)를 넣는다. 미리보기(`PreviewPanel.tsx`)와 편집기 힌트가 이 함수 하나만 쓴다.
- **편집기는 원문을 편집한다**: `BasicInfoEditor.tsx` 의 참조사항 textarea value 는 `toEditableReferenceNote(note)`(구 표기를 `{고객사명}` 으로 통일한 원문)다. 치환 결과는 textarea 아래 힌트로만 보여 준다.
- **구제 함수**: `restoreCustomerPlaceholder(note, customerName)` 은 구 편집기가 남긴 굳은 문구를 되살린다. 기본 첫 문구 패턴 `본 견적은 『(.+?)의 전자계약 (서비스|플랫폼) eformsign 도입』` 에서 캡처가 `'고객사'` 이거나 그 견적의 `customerName` 과 같을 때만 `{고객사명}` 으로 바꾼다. 이미 자리표시자가 있으면 손대지 않는다. 배열용은 `restoreCustomerPlaceholders` 다.
- **구제 적용 경로** (빠지면 그 경로로 들어온 데이터만 굳은 채 남는다):

| 경로 | 위치 |
|---|---|
| 저장 견적 불러오기 | `App.tsx` 의 `handleLoadSavedQuote` |
| 앱 로드 복원·템플릿·이력 | `useQuote.ts` 의 `ensureMetaDefaults` |
| 「기본값 불러오기」 버튼 | `BasicInfoEditor.tsx` |

- **순서 주의**: `ensureMetaDefaults` 의 구제는 그 meta 의 `customerName` 을 쓴다. 따라서 고객사명을 비우는 `normalizeRestoredMeta` 보다 **먼저** 실행되어야 한다.
- **새 자리표시자를 추가할 때**:
  1. 정본 표기(한글)와 허용할 구 표기를 정하고 `referenceNotes.ts` 에 정규식 한 개로 둔다.
  2. 치환은 `renderReferenceNote` 처럼 렌더 함수 한 곳에서 `g` 플래그로 한다. 컴포넌트 안에서 따로 `.replace` 하지 않는다.
  3. 편집 입력의 value 는 원문이다. 치환 결과는 힌트·미리보기에만 쓴다.
  4. 저장 데이터에 이미 굳은 값이 있을 수 있으면 구제 함수와 적용 경로 3곳을 함께 갱신한다. 구제는 확실히 기본 문구에서 온 값만 대상으로 한다.
  5. `referenceNotes.test.ts` 에 다중 치환·빈 값·구제·비구제(다른 회사명) 케이스를 추가하고, 3절의 참조사항 브라우저 시나리오를 수행한다.
