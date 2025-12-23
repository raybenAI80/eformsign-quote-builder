# OCR PDF 기능 구현 백업 (2025-12-15)

## 개요
html2canvas 이미지 기반 PDF에 투명 텍스트 레이어를 추가하여 검색/복사 가능한 PDF 생성

## 백업 파일
- `exportPdf.ts` - PDF 생성 메인 로직 + OCR 텍스트 레이어
- `fontLoader.ts` - NanumSquare 폰트 CDN 로드 + jsPDF 등록
- `textExtractor.ts` - DOM 텍스트 추출 (문자별 Y 위치 감지로 줄바꿈 처리)

## 주요 변경사항

### 1. 폰트 로딩 (fontLoader.ts)
- NanumSquare Regular/Bold CDN URL에서 로드
- Base64 변환 후 jsPDF VFS에 등록

### 2. 텍스트 추출 (textExtractor.ts)
- TreeWalker로 텍스트 노드 순회
- Range API로 문자별 Y 위치 확인하여 CSS 래핑 줄바꿈 감지
- 줄별 분리된 TextElement 배열 반환

### 3. PDF 생성 (exportPdf.ts)
- NanumSquare 폰트 로드 및 등록
- 텍스트 추출 후 투명(opacity 0.01) 텍스트 오버레이
- Y 오프셋: 3mm 기본 + fontSize * 0.35 * 0.85 baseline 보정
- DEBUG_OCR 플래그로 빨간색 가시 텍스트 디버깅 가능
- 페이지 높이를 콘텐츠 높이에 맞춤 (하단 여백 제거)
- 다중 페이지 조건 수정 (빈 페이지 생성 방지)

## 테스트 결과
- 113개 텍스트 요소 추출 (줄바꿈 포함)
- 텍스트 선택/복사 정상 작동
- Ctrl+F 검색 정상 작동
