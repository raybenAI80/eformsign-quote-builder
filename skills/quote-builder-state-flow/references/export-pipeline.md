# 출력물(PDF·PNG) 파이프라인과 검증

이 문서는 `SKILL.md` 7절에서 연결된다. 출력물(PDF·PNG·미리보기)을 바꾸기 전에 읽는다.
사실·측정값·근거 커밋은 볼트 `C:/Users/FORCS/.agent-harness/llm-wiki/wiki/packs/eformsign-quote-builder-pack/claims.md` 에도 있다(이 문서는 절차, 팩은 사실).

## 1. 출력 파이프라인 구조

| 구간 | 정본 파일 | 요점 |
|---|---|---|
| 화면 미리보기 | `src/components/PreviewPanel.tsx`, `preview/QuotePreviewD.tsx`, `preview/quotePreviewD.css` | 축소(약 0.627)해서 보여 준다. `#preview-panel` |
| PDF·PNG 용 숨김 렌더 | `App.tsx` 의 `#pdf-preview-panel`(폭 297mm), 여러 쪽이면 `#pdf-pages-panel` | 같은 `.qd-paper` 를 배율 1 로 그린다. 캡처 대상은 이쪽 |
| 캡처·PDF 생성 | `src/utils/exportPdf.ts` (`exportToPdf`, `exportMergedPdf`, `exportToImage`) | html2canvas 로 이미지 → jsPDF. 텍스트 레이어를 따로 얹는다 |
| 글자 위치 보정 | `src/utils/html2canvasMetrics.ts` (`installFontMetricsFix`) | PDF·PNG 모두 캡처 구간 동안 걸어야 한다 |
| 쪽 나눔 | `src/components/preview/pagination.ts` (순수 `paginate`, DOM 측정 `measureFlowPaper`) | 순수 함수라 단위 테스트가 있다 |
| 제목·문서 정보 | `preview/quoteTitle.ts`, `src/utils/pdfMetadata.ts` | 미리보기·PDF 공용 제목, author `FORCS`, lang `ko-KR` |
| 쪽 구성 선택 | `src/components/PdfSaveMenu.tsx`, `src/utils/pdfLayoutPref.ts`, `src/utils/pdfLayoutMenuText.ts` | 메뉴 문구는 순수 함수 `buildPdfLayoutMenuText` 가 만든다 |
| 하단 | `preview/QuoteFooterD.tsx`, `quoteFooterKind.ts` | 브랜딩 설정으로만 판정(일반=F2, 공공·AI=F1) |

## 2. 화질 상수와 바꾸는 방법

`exportPdf.ts` 의 `PDF_CAPTURE_SCALE = 3`, `PDF_JPEG_QUALITY = 0.9`(단일·병합 PDF 공통). PNG 저장은 `scale: 2`.

실측(품목 3건): 2배·JPEG 0.95 = 0.87 MB / 2배·PNG = 0.70 MB·3.5초(느림) / 3배·0.95 = 1.34 MB / **3배·0.9 = 1.05 MB(채택)**. 생성 시간은 2배와 3배가 같다.
배율에 의존하는 좌표 계산은 없다(이미지 배치는 `canvas.width`, 텍스트 레이어는 CSS 크기). 상수만 바꿔도 위치 보정은 필요 없다.

바꿀 때 측정 순서:
1. `tools/pdf-sharpness-compare.mjs <출력 폴더>` — 화질 상수를 치환해 가며 같은 견적을 여러 설정으로 저장하고 선명도 비교 이미지를 만든다.
2. `tools/measure-pdf-export.mjs <출력 폴더>` — PDF 1회 생성 시간·파일 크기. PNG 는 `tools/measure-png-export.mjs`.
3. 파일 크기(메일 첨부 부담)와 생성 시간을 표로 남기고 볼트 `claims.md` 의 실측표를 갱신한다.
(실행 방법은 5절. 이 세 도구도 같은 공통 모듈과 같은 실행 조건을 쓴다.)

## 3. 쪽 나눔 규칙과 측정값

- 두 방식: "A4 한 장에 맞춤"(기본) / "여러 쪽으로 나눔". PDF 분할 버튼 ▾ 메뉴에서 고르고 마지막 선택을 localStorage `eformsign_quote_pdf_layout` 에 기억한다. 견적 데이터에는 넣지 않는다. 초기화 버튼은 이 설정을 건드리지 않는다.
- 배치(시안 A): 1쪽 = 전체 머리 + 표 머리 + 품목(하단 없음) / 2쪽부터 = 얇은 연속 머리 + 표 머리 반복 / 마지막 쪽 = 합계·비고·하단 / 쪽 번호 「n / N」(1쪽이면 없음).
- 규칙: 행을 쪼개지 않는다 · 구분 행만 쪽 끝에 남기지 않는다 · 구분이 쪽을 넘으면 다음 쪽 첫 행에 「(계속)」 · 마지막 쪽에 품목 최소 3건(`MIN_LAST_ITEMS`) · 쪽 수 제한 없음.
- 병합 PDF: 견적 1건 = N쪽, 쪽 번호는 견적별. PNG 는 항상 한 장.
- 측정값(배율 1, px): 용지 폭 1123 / A4 한 쪽 1588 / 첫 품목 행까지 426 / 표 끝~용지 끝(합계·비고·하단) 712 / 2줄 행 55 · 1줄 행 37 / 한 장 모드 26건 축소율 약 0.60.
- 상수 `THIN_HEAD_H=52`, `TABLE_MARGIN_TOP=24`, `PAGE_NO_RESERVED_H=56`, `SAFETY_PX=6` 은 CSS(`.qd-thin`, 표 윗 여백)와 같은 값이어야 한다. CSS 만 바꾸면 쪽 끝 행이 잘린다 → `verify-pagination` 의 `clipped` 가 잡는다.
- 메뉴 문구: 한 장에 들어가면(축소율 99% 이상, 여러 쪽 결과 1쪽) 제목 줄 아래에 안내 한 줄을 보이고 항목 부제는 방식 설명이다. 넘치면 방식별 실제 결과(쪽 수·글자 %)를 보인다. 판정은 `pdfLayoutMenuText.ts`.

## 4. 함정 목록

1. **같은 id 두 개**: 화면 미리보기와 PDF용 숨김 렌더가 둘 다 `#preview-panel` 을 갖는다. `querySelector('#preview-panel')` 는 화면 쪽, Playwright 로케이터는 strict mode 위반이 난다 → `.first()` 또는 `#pdf-preview-panel .qd-paper`. 쪽 용지 `.qd-page` 에는 id 를 주지 않는다.
2. **미리보기를 끄면 캡처가 조용히 실패**: `#preview-panel` 이 `display:none`. PNG 는 이때 `#pdf-preview-panel` 을 캡처한다(`App.tsx`).
3. **PNG 글자 밀림 원인 2개**: `installFontMetricsFix` 누락(없으면 글자가 약 0.46em 아래로) + 축소된 미리보기를 그대로 캡처(`resetAncestorScale` 로 캡처 구간만 배율 복구).
4. **`::before` 가 `:first-child` 를 깬다**: html2canvas 가 `::before` 를 첫 자식 요소로 끼워 넣는다. 첫 칸 표식은 클래스(`qd-st-first`)로 준다.
5. **PDF 캡처 금지 CSS**: 넓은 자간·세로쓰기·미디어 쿼리 의존 레이아웃·box-shadow·blur. 쪽 카드의 그림자·바깥 선은 화면 전용 `.qd-pages-screen` 아래에만.
6. **글꼴 로드 전 캡처**: `loadScreenFonts()` 를 기다린다. 대체 글꼴로 찍히면 글자 폭이 달라진다.
7. **메뉴에서 방식을 바꾼 직후 저장**: `#pdf-pages-panel` 은 'paged' 일 때만 그려지므로 프레임 2번 기다린 뒤 저장한다(`handleExportPdfAs`).
8. **1024px 미만에서는 헤더 전체가 숨겨져** PDF·PNG 버튼이 모두 없다(PC 전용 도구라 의도한 동작. 좁은 화면용 저장 버튼은 만들지 않는다, 2026-10-30 결정).
9. **`PYI` 환경변수**: PDF 분석(pymupdf)은 시스템 `python` 에 있다. shim `pyi` 는 pymupdf 가 없다. 검증 도구를 돌릴 때 `PYI` 를 비운다.
10. **worktree 에는 환경변수 파일이 없다**: 메인 체크아웃 `D:\pjt\eformsign-견적서-빌더` 의 `.env`·`.env.local` 을 `node --env-file` 로 vite 에만 주입한다. 값을 출력하지 않는다.
11. **결제 정보·직인은 데이터에서 온다**: 결제 정보는 SaaS 행에 `Enterprise` 가 있을 때만(`hasEnterpriseItem`), 직인은 `meta.sealMode`(`hidden` 기본 / `omitted` / `stamped`)로 정한다. 예전 저장본에 `sealMode` 가 없으면 직인 영역을 그리지 않는다.

## 5. 검증 도구 표

모든 도구는 `tools/lib/quote-driver.mjs`(vite 기동·playwright 로드·견적 입력)를 쓴다. 실행 조건: `PW_CHROME`=chrome-headless-shell.exe, 환경변수 파일은 vite 에만, 뷰포트 1440×1000, 접속은 `/?bypass-auth` + 온보딩 건너뛰기. `QB_BASE_URL` 이 있으면 vite 를 새로 띄우지 않고 그 주소를 쓴다.

| 언제 | 도구 | 판정 |
|---|---|---|
| **출력물을 바꾼 뒤 전부** | `npm run verify:export [-- <출력 폴더>] [--only pagination,payment,seal,png,footer,menu,overage]` | 7종을 순서대로 실행, 하나라도 실패하면 exit 1. 약 5분(쪽 구성 160초 + 결제 정보 75초가 대부분) |
| 쪽 나눔·PDF 메뉴·병합·PNG 를 바꿨을 때 | `tools/verify-pagination.mjs` | 쪽 수·글자 위치(dy)·잘린 행·메뉴 키보드·기억·병합. 결과 `results.json` |
| 결제 정보·합계 영역을 바꿨을 때 | `tools/verify-payment-info.mjs` | Enterprise 있음/없음, 여러 쪽, 병합, 기록 스냅샷 |
| 직인 표시·옵션 탭 카드를 바꿨을 때 | `tools/verify-seal-options.mjs` | 카드 순서·기본값·PDF 직인 글자 |
| 헤더 PNG 버튼·PNG 저장을 바꿨을 때 | `tools/verify-png-button.mjs` | 버튼 표시·파일명·이미지 크기·미리보기 끈 상태 |
| 하단 강점 칸 문구·정렬을 바꿨을 때 | `tools/verify-footer-copy.mjs` | F1·F2 문구 줄·칸 높이 같음, 스크린샷·PDF |
| PDF 저장 메뉴 문구를 바꿨을 때 | `tools/verify-pdf-menu-copy.mjs` | 1건·26건 메뉴 문구, 가로 넘침 없음, 스크린샷 |
| Business 구독형 초과 단가 문구(견적일 기준 600→800원)를 바꿨을 때 | `tools/verify-business-overage.mjs` | 견적일 2026-12-15·12-31·2027-01-01 의 미리보기·PDF 글자·줄 수. 문구 규칙은 `preview/overageNotice.ts` |
| 하단 종류 판정(브랜딩)을 바꿨을 때 | `tools/verify-footer-kind.mjs` | F1·F2 자동 선택, 새로고침 유지, 초기화 (`verify:export` 에 미포함) |
| 상태 흐름(초기화·복원) | `tools/verify-quote-scenario.mjs` | 3절 시나리오(SKILL.md) (`verify:export` 에 미포함) |
| 화질 상수를 바꿨을 때 | `tools/pdf-sharpness-compare.mjs`, `tools/measure-pdf-export.mjs`, `tools/measure-png-export.mjs` | 2절 |
| PDF 파일을 직접 볼 때 | `tools/inspect-pdf.py`(`--find`, `--png-all`), `tools/make-pdf-pages-sheet.py`, `tools/measure-pdf-alignment.py --page N` | 쪽별 글자·이미지 수, 한 장 시트, 래스터와 텍스트 레이어 어긋남(mm) |

실행 예(PowerShell):
```powershell
npm run verify:export -- .work/verify-export
# 개별 도구: PW_CHROME 지정, PYI 비움, 메인 체크아웃의 환경변수 파일을 vite 에만 주입
$env:PW_CHROME = "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-1243\chrome-headless-shell-win64\chrome-headless-shell.exe"
Remove-Item Env:PYI -ErrorAction SilentlyContinue
node --env-file=D:\pjt\eformsign-견적서-빌더\.env --env-file=D:\pjt\eformsign-견적서-빌더\.env.local tools/verify-seal-options.mjs .work/seal
```
`verify:export` 는 환경변수 파일을 저장소 루트에서, 없으면 메인 체크아웃에서 찾고, `PW_CHROME` 이 없으면 ms-playwright 의 최신 chrome-headless-shell 을 쓴다. `PYI` 는 스스로 비운다.
쪽 구성·결제 정보·직인·PNG 도구는 관찰값만 출력하므로, 기대값 대조는 실행기 `tools/verify-export-all.mjs` 가 한다. 새 기대값은 거기에 추가한다. 하단·메뉴 도구는 스스로 exit 1 한다.

## 6. 운영 배포 확인 절차

main 병합 → Vercel 이 운영(https://eformsign-quote-builder-liart.vercel.app)에 자동 배포한다. "배포됐을 것"으로 보고하지 않는다.
```powershell
node tools/check-prod-deploy.mjs --sha <병합 커밋 또는 origin/main> --expect "<이번 변경의 고유 UI 문구>" [--expect "<문구>" ...]
```
GitHub commit status context `Vercel` 이 `success` 가 될 때까지 15초 간격·최대 10분 기다리고(`--interval`, `--timeout` 으로 조정), 운영 `index.html` 의 `/assets/*.js` 번들에서 문자열을 찾아 표로 보인다. 하나라도 MISSING 이면 exit 1.
병합 직후에는 로컬에 병합 커밋이 없는 것이 보통이다(`gh pr merge` 는 원격에서만 병합한다). 도구가 스스로 처리하므로 먼저 `git fetch` 할 필요가 없다: 로컬에 없으면 `git fetch origin` 을 한 번 하고 다시 시도하고, 그래도 없으면(포크·권한 등) `gh api` 로 sha·제목을 구한다. 짧은 sha(7자)도 된다. 커밋 제목은 표시용이라 못 구해도 판정은 그대로 진행한다. 구현 `tools/lib/commit-info.mjs`, 경로별 검증 `node tools/verify-commit-info.mjs`(git·gh 실패를 주입, 네트워크 불필요).
고유 문자열은 번들에 남는 UI 문구를 쓴다(식별자는 최소화로 바뀐다). PR 에 Vercel 봇이 남기는 배포 상태 표 댓글은 리뷰 의견이 아니다 — Auto-fix 에서 코드 변경 없이 넘긴다.

## 7. 회귀·누락을 주장하기 전에 (자기 오판 기록)

2026-10-30 오케스트레이터가 `isEnterprise` 같은 추측 식별자로 grep 했고, 못 찾자 "디자인 개편 때 결제 정보 조건이 빠졌다"고 사용자에게 보고했다. 틀렸다. 조건은 `hasEnterpriseItem`(`previewModel.ts`)이라는 다른 이름으로 처음부터 있었다.

규율:
1. 블록을 그리는 JSX 를 열어 실제 조건식을 읽는다. 식별자를 추측해 grep 한 무결과는 "없다"의 증거가 아니다.
2. 브라우저로 재현한다(조건이 참인 견적과 거짓인 견적 둘 다). 결제 정보는 `node tools/verify-payment-info.mjs`.
3. 재현되지 않으면 "문제 없음, 조건은 X 에 있다"고 보고한다.
사용자 결정: 결제 정보 수동 토글은 만들지 않고 원래 기능을 유지한다.
