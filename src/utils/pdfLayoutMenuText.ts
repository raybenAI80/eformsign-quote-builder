import type { PdfLayout } from './pdfLayoutPref';

/** PDF 저장 메뉴가 열릴 때 잰 값(PdfSaveMenu 의 PdfLayoutInfo 와 같은 모양) */
export interface PdfLayoutMenuInput {
  /** 한 장에 맞출 때 글자가 줄어드는 비율(%). 줄어들지 않으면 100 */
  fitPct: number;
  /** 여러 쪽으로 나눴을 때 쪽 수 */
  pagedPages: number;
}

export interface PdfLayoutMenuText {
  /** 제목 줄 아래 안내 한 줄. 한 장을 넘으면 null */
  notice: string | null;
  subtitles: Record<PdfLayout, string>;
}

export const SINGLE_PAGE_NOTICE = '지금은 한 장에 들어가서 두 방식의 결과가 같습니다.';

/** 축소 없이 한 장에 들어가고 여러 쪽으로 나눠도 1쪽이면 두 방식의 결과가 같다. */
export const fitsOnOnePage = (info: PdfLayoutMenuInput): boolean => info.fitPct >= 99 && info.pagedPages <= 1;

/** 메뉴의 안내 문구와 항목 부제. 한 장에 들어가면 결과가 같으므로 방식 설명을, 넘치면 방식별 실제 결과를 보여 준다. */
export function buildPdfLayoutMenuText(info: PdfLayoutMenuInput | null): PdfLayoutMenuText {
  if (!info) return { notice: null, subtitles: { fit: '1쪽', paged: '글자 크기 그대로' } };
  if (fitsOnOnePage(info)) {
    return {
      notice: SINGLE_PAGE_NOTICE,
      subtitles: {
        fit: '내용이 길면 한 장에 맞게 글자를 줄입니다',
        paged: '내용이 길면 글자 크기를 유지하고 쪽을 나눕니다',
      },
    };
  }
  return {
    notice: null,
    subtitles: {
      fit: info.fitPct >= 99 ? '1쪽 · 글자 크기 그대로' : `1쪽 · 글자 약 ${info.fitPct}%로 줄어듭니다`,
      paged: `${info.pagedPages}쪽 · 글자 크기 그대로`,
    },
  };
}
