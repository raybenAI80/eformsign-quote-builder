import { describe, expect, it } from 'vitest';
import { applyReferenceNoteOverage } from './overageNotice';
import { PERSONAL_DOC_QUOTA, PERSONAL_OVERAGE_WON, QUICK_ADD_CATALOG, SUBSCRIPTION_REFERENCE_NOTES } from '../../constants';

// 현재 기본 문구(2026-10-30 확정)와 그 전에 저장된 옛 문구를 모두 다룬다. 저장 문구는 자동으로 다시 쓰지 않는다.
const LINE3 = SUBSCRIPTION_REFERENCE_NOTES[2];
const LINE4 = SUBSCRIPTION_REFERENCE_NOTES[3];
const OLD_LINE3 = '구독형 Business 요금제는 매월 기본 문서 100건 제공, 잔여문서는 이월되지 않습니다.';
const OLD_LINE4 = '초과 이용 문서에 대한 금액(1건 당 600원)은 추후 인상될 수 있습니다.';

describe('applyReferenceNoteOverage — Business (default)', () => {
  it('keeps 600원 before the raise date (2026-12-31)', () => {
    expect(applyReferenceNoteOverage(LINE4, '2026-12-31')).toBe(LINE4);
    expect(applyReferenceNoteOverage(OLD_LINE4, '2026-12-31')).toBe(OLD_LINE4);
  });
  it('shows 800원 on the raise date (2027-01-01) and after', () => {
    const out = applyReferenceNoteOverage(LINE4, '2027-01-01');
    expect(out).toBe('초과 이용 문서에 대한 금액(1건당 800원)은 추후 인상될 수 있습니다.');
    expect(applyReferenceNoteOverage(LINE4, '2027-01-02')).toBe(out);
    expect(applyReferenceNoteOverage(OLD_LINE4, '2027-01-01')).toBe('초과 이용 문서에 대한 금액(1건 당 800원)은 추후 인상될 수 있습니다.');
  });
  it('tolerates 1건당 and 600원/건 spellings', () => {
    expect(applyReferenceNoteOverage('초과 시 1건당 600원', '2027-01-01')).toBe('초과 시 1건당 800원');
    expect(applyReferenceNoteOverage('초과 시 600원/건 부과', '2027-01-01')).toBe('초과 시 800원/건 부과');
  });
  it('leaves lines without 초과 or without the 600원 pattern alone', () => {
    expect(applyReferenceNoteOverage('1건 당 600원 청구', '2027-01-01')).toBe('1건 당 600원 청구');
    expect(applyReferenceNoteOverage('초과 시 1,000원/건', '2027-01-01')).toBe('초과 시 1,000원/건');
    expect(applyReferenceNoteOverage('', '2027-01-01')).toBe('');
    expect(applyReferenceNoteOverage(undefined, '2027-01-01')).toBe('');
  });
  it('falls back to today when the quote date is empty or malformed', () => {
    expect(applyReferenceNoteOverage(LINE4, '', '2027-03-01')).toContain('800원');
    expect(applyReferenceNoteOverage(LINE4, 'bad', '2026-10-30')).toBe(LINE4);
  });
  it('does not touch the quota line and outputs plain text without tags', () => {
    expect(applyReferenceNoteOverage(LINE3, '2027-01-01')).toBe(LINE3);
    expect(applyReferenceNoteOverage(LINE4, '2027-01-01')).not.toMatch(/</);
  });
  it('default tier keeps the Business text', () => {
    expect(applyReferenceNoteOverage(LINE3, '2026-10-30', undefined, 'default')).toBe(LINE3);
    expect(applyReferenceNoteOverage(LINE4, '2026-10-30', undefined, 'default')).toBe(LINE4);
  });
});

describe('applyReferenceNoteOverage — Personal only', () => {
  const P = 'personal' as const;
  it('swaps the Business quota line to Personal / 50건 (new and old wording)', () => {
    expect(applyReferenceNoteOverage(LINE3, '2026-10-30', undefined, P)).toBe(
      '구독형 Personal 요금제는 매월 기본 문서 50건을 제공하며, 남은 문서는 이월되지 않습니다.',
    );
    expect(applyReferenceNoteOverage(OLD_LINE3, '2026-10-30', undefined, P)).toBe(
      '구독형 Personal 요금제는 매월 기본 문서 50건 제공, 잔여문서는 이월되지 않습니다.',
    );
  });
  it('shows 1,000원 in the overage line before and after 2027-01-01 (never 800원)', () => {
    for (const d of ['2026-10-30', '2026-12-31', '2027-01-01', '2027-06-01']) {
      expect(applyReferenceNoteOverage(LINE4, d, undefined, P)).toBe('초과 이용 문서에 대한 금액(1건당 1,000원)은 추후 인상될 수 있습니다.');
      expect(applyReferenceNoteOverage(OLD_LINE4, d, undefined, P)).toBe('초과 이용 문서에 대한 금액(1건 당 1,000원)은 추후 인상될 수 있습니다.');
    }
  });
  it('keeps the numbers in one place next to the Personal preset', () => {
    expect(PERSONAL_DOC_QUOTA).toBe(50);
    expect(PERSONAL_OVERAGE_WON).toBe(1000);
    expect(QUICK_ADD_CATALOG.subscriptionPersonal.factory().notes).toContain('문서 50건/월 포함 (초과 시 1,000원/건)');
  });
  it('tolerates the other overage spellings', () => {
    expect(applyReferenceNoteOverage('초과 시 1건당 600원', '2026-10-30', undefined, P)).toBe('초과 시 1건당 1,000원');
    expect(applyReferenceNoteOverage('초과 시 600원/건 부과', '2026-10-30', undefined, P)).toBe('초과 시 1,000원/건 부과');
  });
  it('leaves user-edited lines without the markers untouched', () => {
    expect(applyReferenceNoteOverage('고객 요청에 따라 문서 100건을 제공합니다.', '2027-01-01', undefined, P)).toBe('고객 요청에 따라 문서 100건을 제공합니다.');
    expect(applyReferenceNoteOverage('구독형 Business 요금제 별도 협의', '2027-01-01', undefined, P)).toBe('구독형 Business 요금제 별도 협의');
    expect(applyReferenceNoteOverage('본 견적은 600원 기준입니다.', '2027-01-01', undefined, P)).toBe('본 견적은 600원 기준입니다.');
  });
});

describe('applyReferenceNoteOverage — Business + Personal both present', () => {
  const B = 'both' as const;
  it('shows both quotas in the quota line (new and old wording, any date)', () => {
    for (const d of ['2026-10-30', '2027-01-02']) {
      expect(applyReferenceNoteOverage(LINE3, d, undefined, B)).toBe(
        '구독형 Business 요금제는 매월 기본 문서 100건, 구독형 Personal 요금제는 매월 기본 문서 50건을 제공하며, 남은 문서는 이월되지 않습니다.',
      );
      expect(applyReferenceNoteOverage(OLD_LINE3, d, undefined, B)).toBe(
        '구독형 Business 요금제는 매월 기본 문서 100건, 구독형 Personal 요금제는 매월 기본 문서 50건 제공, 잔여문서는 이월되지 않습니다.',
      );
    }
  });
  it('shows Business 600원 before and 800원 from 2027-01-01, Personal stays 1,000원', () => {
    expect(applyReferenceNoteOverage(LINE4, '2026-12-31', undefined, B)).toBe(
      '초과 이용 문서에 대한 금액(Business 1건당 600원, Personal 1건당 1,000원)은 추후 인상될 수 있습니다.',
    );
    expect(applyReferenceNoteOverage(LINE4, '2027-01-01', undefined, B)).toBe(
      '초과 이용 문서에 대한 금액(Business 1건당 800원, Personal 1건당 1,000원)은 추후 인상될 수 있습니다.',
    );
    expect(applyReferenceNoteOverage(OLD_LINE4, '2027-01-01', undefined, B)).toBe(
      '초과 이용 문서에 대한 금액(Business 1건 당 800원, Personal 1건 당 1,000원)은 추후 인상될 수 있습니다.',
    );
  });
  it('tolerates other spellings and leaves unrelated lines alone', () => {
    expect(applyReferenceNoteOverage('초과 시 600원/건 부과', '2027-01-01', undefined, B)).toBe('초과 시 Business 800원/건, Personal 1,000원/건 부과');
    expect(applyReferenceNoteOverage('고객 요청에 따라 문서 100건을 제공합니다.', '2027-01-01', undefined, B)).toBe('고객 요청에 따라 문서 100건을 제공합니다.');
    expect(applyReferenceNoteOverage('본 견적은 600원 기준입니다.', '2027-01-01', undefined, B)).toBe('본 견적은 600원 기준입니다.');
  });
  it('outputs plain text without tags', () => {
    expect(applyReferenceNoteOverage(LINE4, '2027-01-01', undefined, B)).not.toMatch(/</);
  });
});
