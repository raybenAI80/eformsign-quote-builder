import { describe, expect, it } from 'vitest';
import {
  applyBusinessOverageNotice,
  isBusinessSubscriptionItem,
  isOnOrAfterBusinessRaise,
} from './overageNotice';
import { getPreviewModel } from './previewModel';
import { createDefaultMeta } from '../../hooks/useQuote';
import type { CalculationResult } from '../../types';

const BIZ = '구독형 Business';
const DEFAULT_BIZ_NOTES = '멤버 무제한, 문서 100건/월 포함 (초과 시 600원/건)\n카카오톡 알림톡/SMS 알림 무제한';
const PERSONAL_NOTES = '멤버 1명, 문서 50건/월 포함 (초과 시 1,000원/건)\n카카오톡 알림톡/SMS 알림 무제한';

describe('applyBusinessOverageNotice (Business 초과 단가 600 → 800원/건, 견적일 기준)', () => {
  it('2026-12-31 견적: 600원과 2027년 1월 1일부터 800원을 함께 표기', () => {
    const out = applyBusinessOverageNotice(BIZ, DEFAULT_BIZ_NOTES, '2026-12-31', '2026-10-30');
    expect(out).toBe(
      '멤버 무제한, 문서 100건/월 포함 (초과 시 600원/건, 2027년 1월 1일부터 800원/건)\n카카오톡 알림톡/SMS 알림 무제한',
    );
  });

  it('2027-01-01 견적(당일 포함): 800원만 표기', () => {
    const out = applyBusinessOverageNotice(BIZ, DEFAULT_BIZ_NOTES, '2027-01-01', '2026-10-30');
    expect(out).toBe('멤버 무제한, 문서 100건/월 포함 (초과 시 800원/건)\n카카오톡 알림톡/SMS 알림 무제한');
    expect(out).not.toContain('600원');
  });

  it('2027-03-15 견적도 800원만', () => {
    expect(applyBusinessOverageNotice(BIZ, DEFAULT_BIZ_NOTES, '2027-03-15', '2026-10-30')).toContain(
      '(초과 시 800원/건)',
    );
  });

  it('견적일이 없으면 오늘 기준 (오늘이 2026-10-30 → 두 단가, 2027-01-01 → 800원)', () => {
    const before = applyBusinessOverageNotice(BIZ, DEFAULT_BIZ_NOTES, undefined, '2026-10-30');
    expect(before).toContain('(초과 시 600원/건, 2027년 1월 1일부터 800원/건)');
    const after = applyBusinessOverageNotice(BIZ, DEFAULT_BIZ_NOTES, '', '2027-01-01');
    expect(after).toContain('(초과 시 800원/건)');
    expect(applyBusinessOverageNotice(BIZ, DEFAULT_BIZ_NOTES, '잘못된-날짜', '2027-06-01')).toContain(
      '(초과 시 800원/건)',
    );
  });

  it('Business 가 아닌 행(Personal 1,000원/건)은 그대로', () => {
    expect(applyBusinessOverageNotice('구독형 Personal', PERSONAL_NOTES, '2026-12-31', '2026-10-30')).toBe(PERSONAL_NOTES);
    expect(applyBusinessOverageNotice('구독형 Personal', PERSONAL_NOTES, '2027-02-01', '2026-10-30')).toBe(PERSONAL_NOTES);
    // 다른 품목 비고에 600원 문구가 있어도 건드리지 않는다
    expect(applyBusinessOverageNotice('eformsign Enterprise', DEFAULT_BIZ_NOTES, '2027-02-01')).toBe(DEFAULT_BIZ_NOTES);
  });

  it('사용자가 문구를 바꾼 행은 그대로', () => {
    const edited = '멤버 무제한, 문서 100건/월 포함 (초과분 협의)';
    expect(applyBusinessOverageNotice(BIZ, edited, '2027-02-01', '2026-10-30')).toBe(edited);
    const editedPrice = '문서 100건/월 포함 (초과 시 650원/건)';
    expect(applyBusinessOverageNotice(BIZ, editedPrice, '2026-12-31', '2026-10-30')).toBe(editedPrice);
    const editedWording = '문서 100건/월 포함, 초과 시 600원/건';
    expect(applyBusinessOverageNotice(BIZ, editedWording, '2027-02-01', '2026-10-30')).toBe(editedWording);
  });

  it('이미 800원 문구가 저장된 행: 견적일이 2026년이면 전환 문구, 2027년이면 800원', () => {
    const saved800 = '문서 100건/월 포함 (초과 시 800원/건)';
    expect(applyBusinessOverageNotice(BIZ, saved800, '2026-12-31', '2026-10-30')).toBe(
      '문서 100건/월 포함 (초과 시 600원/건, 2027년 1월 1일부터 800원/건)',
    );
    expect(applyBusinessOverageNotice(BIZ, saved800, '2027-01-01', '2026-10-30')).toBe(saved800);
  });

  it('여러 번 적용해도 결과가 같다 (전환 문구가 저장돼 있어도 안전)', () => {
    const once = applyBusinessOverageNotice(BIZ, DEFAULT_BIZ_NOTES, '2026-12-31', '2026-10-30');
    expect(applyBusinessOverageNotice(BIZ, once, '2026-12-31', '2026-10-30')).toBe(once);
    // 전환 문구가 저장된 견적을 2027년 견적일로 다시 열면 800원만
    expect(applyBusinessOverageNotice(BIZ, once, '2027-01-01', '2026-10-30')).toContain('(초과 시 800원/건)');
    expect(applyBusinessOverageNotice(BIZ, once, '2027-01-01', '2026-10-30')).not.toContain('600원');
    // 서식 태그가 섞인 비고(리치 텍스트)에서도 일치하면 바꾼다
    const html = '<b>문서 100건</b> (초과 시 600원/건)';
    expect(applyBusinessOverageNotice(BIZ, html, '2027-01-01', '2026-10-30')).toBe('<b>문서 100건</b> (초과 시 800원/건)');
  });

  it('비고가 비었거나 undefined 면 빈 문자열', () => {
    expect(applyBusinessOverageNotice(BIZ, undefined, '2026-12-31')).toBe('');
    expect(applyBusinessOverageNotice(BIZ, '', '2026-12-31')).toBe('');
  });
});

describe('isBusinessSubscriptionItem / isOnOrAfterBusinessRaise', () => {
  it('품목명으로 Business 구독형만 인식', () => {
    expect(isBusinessSubscriptionItem('구독형 Business')).toBe(true);
    expect(isBusinessSubscriptionItem('구독형 Business (연간)')).toBe(true);
    expect(isBusinessSubscriptionItem('구독형 Personal')).toBe(false);
    expect(isBusinessSubscriptionItem('eformsign Enterprise')).toBe(false);
    expect(isBusinessSubscriptionItem('충전형 문서')).toBe(false);
    expect(isBusinessSubscriptionItem(undefined)).toBe(false);
  });

  it('경계: 2026-12-31 은 이전, 2027-01-01 은 이후', () => {
    expect(isOnOrAfterBusinessRaise('2026-12-31', '2026-10-30')).toBe(false);
    expect(isOnOrAfterBusinessRaise('2027-01-01', '2026-10-30')).toBe(true);
  });
});

describe('getPreviewModel — 미리보기·PDF 가 쓰는 행에 적용되고 원본 행은 그대로', () => {
  const baseRow = {
    id: 'r1', section: 'SaaS' as const, category: '구독형', item: BIZ, unitLabel: '개월',
    qty: 12, unitPrice: 40000, discountPct: 0, notes: DEFAULT_BIZ_NOTES,
    price: 480000, offerPrice: 480000, lineDiscount: 0,
  };
  const calc = (rows: unknown[]) => ({ rows } as unknown as CalculationResult);

  it('견적일에 따라 모델 행의 비고가 바뀌고 입력 행은 변하지 않는다', () => {
    const meta = { ...createDefaultMeta(), quoteDate: '2026-12-15' };
    const c = calc([baseRow]);
    const model = getPreviewModel(meta, c);
    expect(model.groups[0].rows[0].notes).toContain('(초과 시 600원/건, 2027년 1월 1일부터 800원/건)');
    expect(baseRow.notes).toBe(DEFAULT_BIZ_NOTES);

    const model2027 = getPreviewModel({ ...meta, quoteDate: '2027-01-01' }, c);
    expect(model2027.groups[0].rows[0].notes).toContain('(초과 시 800원/건)');
  });
});
