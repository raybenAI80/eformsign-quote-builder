// Plan type (충전형 / 구독형) detection for reference-note guidance.
// Judged from item.category ONLY. category is set by the quick-add presets and has no input
// field in the UI, so users cannot break the judgement by editing item names.
import type { QuoteItem } from '../types';
import { toEditableReferenceNote } from './referenceNotes';

export type PlanType = 'prepaid' | 'subscription' | 'mixed' | 'none';

type CategoryItem = Pick<QuoteItem, 'category'> & { item?: unknown };

export const PREPAID_CATEGORY = '문서 충전';
export const SUBSCRIPTION_CATEGORY = '구독형';

/**
 * Decide the plan type of a quote from its items.
 * Enterprise / Public / 추가 문서 ('문서 생성') and every other category contribute nothing.
 * The preview renders every item row without hiding any, so every item is considered here too.
 */
export const detectPlanType = (items: ReadonlyArray<CategoryItem> | undefined): PlanType => {
  let prepaid = false;
  let subscription = false;
  for (const item of items ?? []) {
    const category = String(item?.category ?? '').trim();
    if (category === PREPAID_CATEGORY) prepaid = true;
    else if (category === SUBSCRIPTION_CATEGORY) subscription = true;
  }
  if (prepaid && subscription) return 'mixed';
  if (prepaid) return 'prepaid';
  if (subscription) return 'subscription';
  return 'none';
};

export interface MismatchedNote {
  /** 0-based index in referenceNotes */
  index: number;
  /** editable text (placeholder spelling unified) */
  text: string;
}

// Sentences that only belong to the other plan type.
const PREPAID_ONLY_RE = /계약기간|문서 사용기한|문서 소진 시/;
const SUBSCRIPTION_ONLY_RE = /청구일|이월되지 않|초과 이용 문서/;

/**
 * Notes that contradict the detected plan type. 'mixed' and 'none' never flag anything:
 * the app does not guess in those cases.
 */
export const findMismatchedNotes = (notes: ReadonlyArray<string> | undefined, planType: PlanType): MismatchedNote[] => {
  if (planType !== 'prepaid' && planType !== 'subscription') return [];
  const marker = planType === 'subscription' ? PREPAID_ONLY_RE : SUBSCRIPTION_ONLY_RE;
  const found: MismatchedNote[] = [];
  (notes ?? []).forEach((note, index) => {
    const text = toEditableReferenceNote(String(note ?? ''));
    if (marker.test(text)) found.push({ index, text });
  });
  return found;
};

export const PLAN_TYPE_LABEL: Record<Exclude<PlanType, 'none'>, string> = {
  prepaid: '충전형',
  subscription: '구독형',
  mixed: '충전형 + 구독형',
};

/** Label of the plan the flagged sentences belong to (the opposite of the detected type). */
export const otherPlanLabel = (planType: PlanType): string =>
  planType === 'subscription' ? '충전형' : planType === 'prepaid' ? '구독형' : '';

/**
 * 구독형 품목의 등급(Business / Personal). 품목에 등급을 나타내는 편집 불가 필드가 없어서(둘 다 category '구독형')
 * 품목명에 'Business' / 'Personal' 이 들어 있는지로 본다(overageNotice.ts 의 Business 판별과 같은 방식).
 * 이름이 둘 다 아닌 구독형 품목(사용자가 이름을 고친 경우)은 other 로 센다.
 */
export interface SubscriptionTiers {
  business: boolean;
  personal: boolean;
  other: boolean;
}

export const detectSubscriptionTiers = (items: ReadonlyArray<CategoryItem> | undefined): SubscriptionTiers => {
  const tiers: SubscriptionTiers = { business: false, personal: false, other: false };
  for (const it of items ?? []) {
    if (String(it?.category ?? '').trim() !== SUBSCRIPTION_CATEGORY) continue;
    const name = String(it?.item ?? '');
    if (name.includes('Business')) tiers.business = true;
    else if (name.includes('Personal')) tiers.personal = true;
    else tiers.other = true;
  }
  return tiers;
};

/** 참고사항을 Personal 수치로 보일지: 구독형이 Personal 뿐일 때만. Business·이름을 고친 구독형이 하나라도 있으면 저장 문구(Business) 그대로 */
export const isPersonalOnlySubscription = (items: ReadonlyArray<CategoryItem> | undefined): boolean => {
  const t = detectSubscriptionTiers(items);
  return t.personal && !t.business && !t.other;
};

/**
 * 참고사항 렌더 변환 방식(구독형 문구의 Business 수치를 어떻게 보일지).
 * - personal: 구독형이 Personal 뿐 → Personal 수치로
 * - both: Business 와 Personal 이 함께 있음 → 두 수치를 나란히
 * - default: 그 밖(Business 뿐, 이름을 고친 구독형 포함, 구독형 없음) → 저장 문구 그대로(Business)
 */
export type NoteTierMode = 'default' | 'personal' | 'both';

export const referenceNoteTierMode = (items: ReadonlyArray<CategoryItem> | undefined): NoteTierMode => {
  const t = detectSubscriptionTiers(items);
  if (t.business && t.personal) return 'both';
  if (t.personal && !t.business && !t.other) return 'personal';
  return 'default';
};

/** 편집기 배지 문구. 구독형은 등급(Business / Personal)까지 보인다. 품목이 없으면 빈 문자열 */
export const planBadgeLabel = (items: ReadonlyArray<CategoryItem> | undefined): string => {
  const plan = detectPlanType(items);
  if (plan === 'none') return '';
  if (plan === 'prepaid') return PLAN_TYPE_LABEL.prepaid;
  const t = detectSubscriptionTiers(items);
  const tierParts = [t.business ? 'Business' : '', t.personal ? 'Personal' : ''].filter(Boolean);
  const sub = tierParts.length ? `구독형 ${tierParts.join(' + ')}` : '구독형';
  return plan === 'mixed' ? `${PLAN_TYPE_LABEL.prepaid} + ${sub}` : sub;
};
