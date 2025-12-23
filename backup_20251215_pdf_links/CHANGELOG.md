# PDF 하이퍼링크 수정 작업 기록
**날짜**: 2025-12-15

## 해결된 문제
1. **PDF 파일명 문제**: UUID 대신 올바른 파일명으로 저장
2. **PDF 하이퍼링크 문제**: "사업자등록증", "통장사본" 링크 클릭 가능

## 핵심 변경사항

### 1. exportPdf.ts
- `html2canvas` + `jsPDF` 조합 유지 (레이아웃 정확도 우선)
- JPEG 0.95 품질 + jsPDF compress 옵션으로 파일 크기 최적화 (~430KB)
- `File System Access API (showSaveFilePicker)` 사용으로 파일명 문제 해결
- `pdf.link()` 메서드로 투명 클릭 영역 추가
- Y 좌표 오프셋 3mm 적용 (좌표 불일치 보정)

### 2. PreviewPanel.tsx
- 링크에 `pdf-target-link` 클래스 추가 (링크 타겟팅용)
- 그라데이션을 단색(`#0070B0`)으로 변경 (html2canvas 호환성)

### 3. App.tsx
- PDF 전용 숨겨진 컨테이너 추가 (`pdf-preview-panel`)
- 화면 밖에 배치하되 크기는 유지하여 html2canvas 캡처 가능

### 4. MainLayout.tsx
- Preview 영역을 조건부 렌더링에서 CSS visibility 방식으로 변경

## 백업 위치
`backup_20251215_pdf_links/` 폴더에 주요 파일 백업됨

## 향후 개선 가능
- OCR 가능한 PDF 생성 (텍스트 검색/복사 가능)
