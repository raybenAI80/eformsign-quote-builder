import type { QuoteMeta } from '../../types';

/**
 * 견적서 하단 디자인 종류.
 * - 'public'  : 콜로폰 하단 (F1: 서명 + 강점 4칸 + 인증 엠블럼 한 줄). AI·공공 견적서가 쓴다.
 * - 'general' : 브랜드 밴드 하단 (F2: 엠블럼 + 강점 + 슬로건 밴드 + 일러스트). 일반 견적서가 쓴다.
 */
export type QuoteFooterKind = 'public' | 'general';

/**
 * 옵션 탭 「브랜딩 설정」(meta.brandingMode)만으로 하단 디자인을 고른다. 새 상태 필드는 없다.
 * - 'default' (일반 견적서, 이폼사인 SaaS) → 'general' (F2 브랜드 밴드)
 * - 'ai' (AI 견적서)·'public' (공공 견적서) → 'public' (F1 콜로폰)
 * - 값이 없으면 새 견적의 기본값(일반 견적서)과 같이 'general'.
 * 항목 탭의 섹터(meta.sector)는 하단 판정에 쓰지 않는다.
 */
export const selectFooterKind = (meta: Pick<QuoteMeta, 'brandingMode'>): QuoteFooterKind =>
  meta.brandingMode === 'ai' || meta.brandingMode === 'public' ? 'public' : 'general';
