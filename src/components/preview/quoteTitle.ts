import type { QuoteMeta } from '../../types';

/**
 * 견적서 제목 문구. 미리보기 제목(QuotePreviewD)과 PDF 문서 정보 제목이 같은 규칙을 쓰도록 한 곳에 둔다.
 * - 'public' → 공공용 접두를 붙인다.
 * - 'ai'     → 미리보기는 글자 사이에 AI 아이콘 이미지를 넣어 그리지만, 글자로는 "이폼사인 AI 견적서"다.
 * - 그 외    → 일반 견적서.
 */
export const getQuoteTitleText = (brandingMode: QuoteMeta['brandingMode'] | undefined): string => {
  if (brandingMode === 'ai') return '이폼사인 AI 견적서';
  if (brandingMode === 'public') return '공공용 이폼사인 견적서';
  return '이폼사인 견적서';
};
