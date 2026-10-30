import { getLocalToday, parseLocalDate } from '../../hooks/useQuote';
import { PERSONAL_DOC_QUOTA, PERSONAL_OVERAGE_WON_TEXT } from '../../constants';

/**
 * 구독형 Business 초과 단가 문구를 견적일 기준으로 바꾼다 (렌더 시점, 저장값은 건드리지 않는다).
 *
 * 근거: 2026-10-30 사내 공지 — Business 구독형 문서 초과 단가가 2027-01-01 사용분부터
 * 600원/건 → 800원/건. 견적일이 2027-01-01 이전이면 두 단가를 함께, 이후(당일 포함)면 800원만 보인다.
 * 이렇게 하면 1월 1일에 재배포하지 않아도 되고, 저장된 옛 견적도 다시 열 때 견적일에 맞게 나온다.
 *
 * 건드리는 것: "구독형 Business" 품목의 비고에서 `(초과 시 600원/건)`, `(초과 시 800원/건)`,
 * 이 함수가 만든 전환 문구 셋 중 하나와 정확히 일치하는 부분. 사용자가 문구를 직접 고쳐 일치하지
 * 않으면 그대로 둔다. Personal(초과 1,000원/건)·Enterprise 품목은 대상이 아니다.
 */

/** 인상 적용 시작일. 이 날짜(당일 포함)의 견적부터 800원만 표기한다 */
export const BUSINESS_OVERAGE_RAISE_DATE = '2027-01-01';

/**
 * 인라인 태그(span 등)는 쓰지 않는다. PDF 의 보이지 않는 글자 층은 텍스트 노드마다 따로 만들고 앞뒤 공백을 잘라서,
 * 비고 안에 태그를 끼우면 "초과 시600원/건" 처럼 공백이 빠진 채 검색·복사된다. 줄 나눔은 한 줄(품목 칸 폭의 약 80%)에
 * 들어가므로 따로 묶지 않는다(tools/verify-business-overage.mjs 가 8줄 유지 여부를 확인한다).
 */
const NOTICE_BEFORE = '(초과 시 600원/건, 2027년 1월 1일부터 800원/건)';
const NOTICE_AFTER = '(초과 시 800원/건)';

/** 600원 단독·800원 단독·전환 문구 셋 중 하나와 정확히 일치하는 부분만 바꾼다 */
const OVERAGE_NOTICE_PATTERN = /\(초과 시 (?:600|800)원\/건(?:, 2027년 1월 1일부터 800원\/건)?\)/g;

/** 구독형 Business 품목인가. 품목명을 사용자가 조금 고쳐도(예: "구독형 Business (연간)") 인식한다 */
export const isBusinessSubscriptionItem = (item: unknown): boolean => {
  const name = String(item ?? '');
  return name.includes('구독형') && name.includes('Business');
};

/** 견적일('YYYY-MM-DD', 로컬 날짜 기준)이 인상 적용일 이후인가. 비었거나 형식이 틀리면 오늘 기준 */
export const isOnOrAfterBusinessRaise = (quoteDate: string | undefined, today: string = getLocalToday()): boolean => {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(quoteDate ?? '');
  const basis = valid ? getLocalToday(parseLocalDate(quoteDate)) : today;
  return basis >= BUSINESS_OVERAGE_RAISE_DATE;
};

/** 비고 문자열에서 초과 단가 문구를 견적일 기준 문구로 바꾼다. Business 품목이 아니면 그대로 돌려준다 */
export const applyBusinessOverageNotice = (
  item: unknown,
  notes: string | undefined,
  quoteDate: string | undefined,
  today: string = getLocalToday(),
): string => {
  const text = notes ?? '';
  if (!text || !isBusinessSubscriptionItem(item)) return text;
  const notice = isOnOrAfterBusinessRaise(quoteDate, today) ? NOTICE_AFTER : NOTICE_BEFORE;
  return text.replace(OVERAGE_NOTICE_PATTERN, notice);
};

/**
 * 참고사항 한 줄을 렌더 시점에 바꾼다 (저장 문구는 그대로). 인라인 태그 없이 평문만 돌려준다(PDF 글자 층에서 공백이 빠지지 않게).
 * 「초과」 줄의 「1건 당 600원」 「1건당 600원」 「600원/건」 은 견적일이 인상 적용일(당일 포함) 이후면 Business 단가가 800원이 된다.
 * tier 에 따라:
 * - default: Business 수치 그대로(위 인상 규칙만 적용).
 * - personal(구독형이 Personal 뿐): 「구독형 Business 요금제」·「100건」 줄은 Personal·50건으로, 초과 단가는 1,000원으로.
 *   Personal 은 인상 대상이 아니므로 날짜와 무관하게 1,000원이다.
 * - both(Business·Personal 함께): 「100건」 줄에 Personal 50건을 덧붙이고, 초과 단가는 「Business … , Personal …」 로 나란히 보인다.
 *   Business 단가는 인상 규칙을 따른다.
 */
const REFERENCE_OVERAGE_PATTERNS: ReadonlyArray<RegExp> = [/(1건\s*당\s*)600원/g, /600원(\/건)/g];

export type ReferenceNoteTier = 'default' | 'personal' | 'both';

export const applyReferenceNoteOverage = (
  note: string | undefined,
  quoteDate: string | undefined,
  today: string = getLocalToday(),
  tier: ReferenceNoteTier = 'default',
): string => {
  let text = note ?? '';
  if (!text) return text;
  const personal = `${PERSONAL_OVERAGE_WON_TEXT}원`;
  const business = isOnOrAfterBusinessRaise(quoteDate, today) ? '800원' : '600원';

  if (tier !== 'default' && text.includes('구독형 Business 요금제') && text.includes('100건')) {
    text =
      tier === 'personal'
        ? text.replace('구독형 Business 요금제', '구독형 Personal 요금제').replace('100건', `${PERSONAL_DOC_QUOTA}건`)
        : text.replace('100건', `100건, 구독형 Personal 요금제는 매월 기본 문서 ${PERSONAL_DOC_QUOTA}건`);
  }
  if (!text.includes('초과')) return text;

  if (tier === 'personal') {
    return text
      .replace(REFERENCE_OVERAGE_PATTERNS[0], (_m, pre: string) => `${pre}${personal}`)
      .replace(REFERENCE_OVERAGE_PATTERNS[1], (_m, unit: string) => `${personal}${unit}`);
  }
  if (tier === 'both') {
    return text
      .replace(REFERENCE_OVERAGE_PATTERNS[0], (_m, pre: string) => `Business ${pre}${business}, Personal ${pre}${personal}`)
      .replace(REFERENCE_OVERAGE_PATTERNS[1], (_m, unit: string) => `Business ${business}${unit}, Personal ${personal}${unit}`);
  }
  if (business === '600원') return text;
  return text
    .replace(REFERENCE_OVERAGE_PATTERNS[0], (_m, pre: string) => `${pre}800원`)
    .replace(REFERENCE_OVERAGE_PATTERNS[1], (_m, unit: string) => `800원${unit}`);
};
