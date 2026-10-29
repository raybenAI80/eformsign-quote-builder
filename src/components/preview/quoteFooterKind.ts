import type { QuoteMeta } from '../../types';

/**
 * 견적서 하단 디자인 종류.
 * - 'public'  : 공공용 푸터 (F1 콜로폰: 서명 + 강점 4칸 + 인증 엠블럼 한 줄)
 * - 'general' : 일반용 푸터 (F2 브랜드 밴드: 엠블럼 + 강점 + 슬로건 밴드 + 일러스트)
 */
export type QuoteFooterKind = 'public' | 'general';

/**
 * 기존 고객 구분값으로 하단 디자인을 고른다. 새 상태 필드는 없다.
 * - meta.brandingMode === 'public' (옵션 탭의 「공공 견적서」, 제목의 「공공용」 접두 기준)
 * - meta.sector === 'public' (항목 탭의 「정부·공공기관용」, 견적 정보 카드의 배지 기준)
 * 둘 중 하나라도 공공이면 'public', 그 밖의 값(ai·default·general·subsidy·미설정)은 'general'.
 */
export const selectFooterKind = (
  meta: Pick<QuoteMeta, 'brandingMode' | 'sector'>
): QuoteFooterKind =>
  meta.brandingMode === 'public' || meta.sector === 'public' ? 'public' : 'general';
