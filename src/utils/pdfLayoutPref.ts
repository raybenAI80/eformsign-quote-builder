/**
 * PDF 저장 방식 설정. 사용자 기기(localStorage)에 기억한다. 읽기·쓰기가 막혀도(사생활 보호 창 등) 기본값으로 동작한다.
 * - 'fit'   : A4 한 장에 맞춤 (기본, 이전부터의 동작)
 * - 'paged' : 여러 쪽으로 나눔
 */
export type PdfLayout = 'fit' | 'paged';

export const PDF_LAYOUT_STORAGE_KEY = 'eformsign_quote_pdf_layout';
export const DEFAULT_PDF_LAYOUT: PdfLayout = 'fit';

export function readPdfLayout(): PdfLayout {
  try {
    const v = localStorage.getItem(PDF_LAYOUT_STORAGE_KEY);
    return v === 'paged' || v === 'fit' ? v : DEFAULT_PDF_LAYOUT;
  } catch {
    return DEFAULT_PDF_LAYOUT;
  }
}

/** 저장에 성공하면 true. 실패해도 화면의 현재 선택은 유지된다(다음 방문에 기본값으로 돌아갈 뿐). */
export function writePdfLayout(layout: PdfLayout): boolean {
  try {
    localStorage.setItem(PDF_LAYOUT_STORAGE_KEY, layout);
    return true;
  } catch {
    return false;
  }
}
