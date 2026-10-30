import { describe, expect, it } from 'vitest';
import { detectPlanType, detectSubscriptionTiers, findMismatchedNotes, isPersonalOnlySubscription, planBadgeLabel, referenceNoteTierMode } from './planType';
import { PREPAID_REFERENCE_NOTES, SUBSCRIPTION_REFERENCE_NOTES } from '../constants';

const item = (category: string) => ({ category });

describe('detectPlanType', () => {
  it('returns none for no items or unrelated categories', () => {
    expect(detectPlanType([])).toBe('none');
    expect(detectPlanType(undefined)).toBe('none');
    expect(detectPlanType([item('문서 생성'), item('Professional Services'), item('추가 옵션')])).toBe('none');
  });
  it('detects prepaid from 문서 충전', () => {
    expect(detectPlanType([item('문서 충전')])).toBe('prepaid');
  });
  it('detects subscription from 구독형', () => {
    expect(detectPlanType([item('구독형'), item('구독형')])).toBe('subscription');
  });
  it('detects mixed', () => {
    expect(detectPlanType([item('문서 충전'), item('구독형')])).toBe('mixed');
  });
  it('ignores Enterprise / Public / 추가 문서 even beside a plan item', () => {
    expect(detectPlanType([item('문서 생성'), item('구독형')])).toBe('subscription');
    expect(detectPlanType([item('문서 생성'), item('문서 충전')])).toBe('prepaid');
  });
  it('does not use item names', () => {
    expect(detectPlanType([{ category: '문서 생성', item: '구독형 Business' } as never])).toBe('none');
  });
});

describe('findMismatchedNotes', () => {
  const idx = (r: { index: number }[]) => r.map(x => x.index);
  it('flags prepaid-only markers for subscription', () => {
    expect(idx(findMismatchedNotes(['계약기간: 1년'], 'subscription'))).toEqual([0]);
    expect(idx(findMismatchedNotes(['문서 사용기한: 2년'], 'subscription'))).toEqual([0]);
    expect(idx(findMismatchedNotes(['문서 소진 시, 유료 옵션은 청구'], 'subscription'))).toEqual([0]);
  });
  it('flags subscription-only markers for prepaid', () => {
    expect(idx(findMismatchedNotes(['청구일: 익월 1일'], 'prepaid'))).toEqual([0]);
    expect(idx(findMismatchedNotes(['잔여문서는 이월되지 않습니다.'], 'prepaid'))).toEqual([0]);
    expect(idx(findMismatchedNotes(['초과 이용 문서에 대한 금액'], 'prepaid'))).toEqual([0]);
  });
  it('does not flag user-edited lines without markers', () => {
    expect(findMismatchedNotes(['고객 요청에 따라 별도 협의합니다.', ''], 'subscription')).toEqual([]);
    expect(findMismatchedNotes(['고객 요청에 따라 별도 협의합니다.'], 'prepaid')).toEqual([]);
  });
  it('returns [] for mixed and none', () => {
    expect(findMismatchedNotes(['계약기간', '청구일'], 'mixed')).toEqual([]);
    expect(findMismatchedNotes(['계약기간', '청구일'], 'none')).toEqual([]);
  });
  it('returns the editable text with unified placeholder', () => {
    const r = findMismatchedNotes(['계약기간 {customerName}'], 'subscription');
    expect(r[0].text).toBe('계약기간 {고객사명}');
  });
  it('still flags the lines saved with the old wording', () => {
    const oldPrepaid = ['계약기간: 계약 시작일로 부터 1년입니다.', '문서 사용기한: 계약 시작일로부터 최대 2년까지 사용할 수 있습니다.', '문서 소진 시, 본 견적에 포함된 사항 외에 별도로 사용된 유료 옵션은 실제 사용량에 따라 일괄 청구됩니다.'];
    expect(idx(findMismatchedNotes(oldPrepaid, 'subscription'))).toEqual([0, 1, 2]);
    const oldSubscription = ['청구일: 익월 1일마다 등록된 카드로 청구', '청구일: 익월 1일 청구, 7일 등록된 카드로 결제', '구독형 Business 요금제는 매월 기본 문서 100건 제공, 잔여문서는 이월되지 않습니다.', '초과 이용 문서에 대한 금액(1건 당 600원)은 추후 인상될 수 있습니다.'];
    expect(idx(findMismatchedNotes(oldSubscription, 'prepaid'))).toEqual([0, 1, 2, 3]);
    expect(findMismatchedNotes(oldSubscription, 'subscription')).toEqual([]);
  });
  it('built-in sets only flag in the opposite direction', () => {
    expect(idx(findMismatchedNotes(PREPAID_REFERENCE_NOTES, 'subscription'))).toEqual([1, 2, 3]);
    expect(findMismatchedNotes(PREPAID_REFERENCE_NOTES, 'prepaid')).toEqual([]);
    expect(idx(findMismatchedNotes(SUBSCRIPTION_REFERENCE_NOTES, 'prepaid'))).toEqual([1, 2, 3]);
    expect(findMismatchedNotes(SUBSCRIPTION_REFERENCE_NOTES, 'subscription')).toEqual([]);
  });
});

const sub = (item: string) => ({ category: '구독형', item });
const prepaid = { category: '문서 충전', item: '충전형 문서' };

describe('subscription tiers and badge label', () => {
  it('detects Business / Personal by item name within 구독형 items only', () => {
    expect(detectSubscriptionTiers([sub('구독형 Business')])).toEqual({ business: true, personal: false, other: false });
    expect(detectSubscriptionTiers([sub('구독형 Personal')])).toEqual({ business: false, personal: true, other: false });
    expect(detectSubscriptionTiers([sub('구독형 Personal'), sub('구독형 Business')])).toEqual({ business: true, personal: true, other: false });
    expect(detectSubscriptionTiers([{ category: '문서 생성', item: 'Business Personal' }])).toEqual({ business: false, personal: false, other: false });
    expect(detectSubscriptionTiers([sub('구독형 (이름 수정)')]).other).toBe(true);
  });
  it('referenceNoteTierMode: personal only / both / default', () => {
    expect(referenceNoteTierMode([sub('구독형 Personal')])).toBe('personal');
    expect(referenceNoteTierMode([sub('구독형 Personal'), sub('구독형 Business')])).toBe('both');
    expect(referenceNoteTierMode([sub('구독형 Business')])).toBe('default');
    expect(referenceNoteTierMode([sub('구독형 Personal'), sub('구독형 (이름 수정)')])).toBe('default');
    expect(referenceNoteTierMode([prepaid])).toBe('default');
    expect(referenceNoteTierMode([])).toBe('default');
  });
  it('Personal wording only when Personal items and no Business / renamed subscription items', () => {
    expect(isPersonalOnlySubscription([sub('구독형 Personal')])).toBe(true);
    expect(isPersonalOnlySubscription([sub('구독형 Personal'), prepaid])).toBe(true);
    expect(isPersonalOnlySubscription([sub('구독형 Personal'), sub('구독형 Business')])).toBe(false);
    expect(isPersonalOnlySubscription([sub('구독형 Personal'), sub('구독형 (이름 수정)')])).toBe(false);
    expect(isPersonalOnlySubscription([sub('구독형 Business')])).toBe(false);
    expect(isPersonalOnlySubscription([])).toBe(false);
  });
  it('planBadgeLabel names the tier', () => {
    expect(planBadgeLabel([])).toBe('');
    expect(planBadgeLabel([{ category: '문서 생성', item: 'Enterprise' }])).toBe('');
    expect(planBadgeLabel([prepaid])).toBe('충전형');
    expect(planBadgeLabel([sub('구독형 Business')])).toBe('구독형 Business');
    expect(planBadgeLabel([sub('구독형 Personal')])).toBe('구독형 Personal');
    expect(planBadgeLabel([sub('구독형 Personal'), sub('구독형 Business')])).toBe('구독형 Business + Personal');
    expect(planBadgeLabel([sub('구독형 (이름 수정)')])).toBe('구독형');
    expect(planBadgeLabel([prepaid, sub('구독형 Business')])).toBe('충전형 + 구독형 Business');
    expect(planBadgeLabel([prepaid, sub('구독형 Personal')])).toBe('충전형 + 구독형 Personal');
    expect(planBadgeLabel([prepaid, sub('구독형 Business'), sub('구독형 Personal')])).toBe('충전형 + 구독형 Business + Personal');
  });
});
