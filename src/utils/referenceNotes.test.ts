import { describe, it, expect } from 'vitest';
import {
  renderReferenceNote,
  toEditableReferenceNote,
  restoreCustomerPlaceholder,
  restoreCustomerPlaceholders,
} from './referenceNotes';

const DEFAULT_KO = '본 견적은 『{고객사명}의 전자계약 서비스 eformsign 도입』에 한하여 적용되는 견적입니다.';
const DEFAULT_EN = '본 견적은 『{customerName}의 전자계약 플랫폼 eformsign 도입』에 한하여 적용되는 견적입니다.';

describe('renderReferenceNote', () => {
  it('두 표기 모두 고객사명으로 치환', () => {
    expect(renderReferenceNote(DEFAULT_KO, '에이비씨')).toContain('『에이비씨의 전자계약 서비스');
    expect(renderReferenceNote(DEFAULT_EN, '에이비씨')).toContain('『에이비씨의 전자계약 플랫폼');
  });
  it('고객사명이 비면 "고객사"', () => {
    expect(renderReferenceNote(DEFAULT_KO, '')).toContain('『고객사의');
    expect(renderReferenceNote(DEFAULT_KO, '   ')).toContain('『고객사의');
    expect(renderReferenceNote(DEFAULT_KO, undefined)).toContain('『고객사의');
  });
  it('한 문장에 자리표시자가 여러 번 있어도 전부 치환', () => {
    expect(renderReferenceNote('{고객사명} / {customerName} / {고객사명}', 'A')).toBe('A / A / A');
  });
  it('고객사명에 $ 가 있어도 그대로 삽입', () => {
    expect(renderReferenceNote('{고객사명}', '$&Co')).toBe('$&Co');
  });
});

describe('toEditableReferenceNote', () => {
  it('{customerName} 을 {고객사명} 으로 통일', () => {
    expect(toEditableReferenceNote(DEFAULT_EN)).toContain('『{고객사명}의');
  });
});

describe('restoreCustomerPlaceholder (자리표시자 소실 데이터 구제)', () => {
  const baked = (who: string, kind = '서비스') =>
    `본 견적은 『${who}의 전자계약 ${kind} eformsign 도입』에 한하여 적용되는 견적입니다. (수정)`;

  it('"고객사" 로 굳은 문구 → 자리표시자 복원(뒤쪽 사용자 편집 보존)', () => {
    expect(restoreCustomerPlaceholder(baked('고객사'), '')).toBe(
      '본 견적은 『{고객사명}의 전자계약 서비스 eformsign 도입』에 한하여 적용되는 견적입니다. (수정)'
    );
  });
  it('견적의 고객사명과 같은 이름으로 굳은 문구 → 복원', () => {
    expect(restoreCustomerPlaceholder(baked('디이에프', '플랫폼'), '디이에프')).toContain('『{고객사명}의 전자계약 플랫폼');
  });
  it('다른 회사명으로 굳은 문구는 건드리지 않음', () => {
    expect(restoreCustomerPlaceholder(baked('지에이치'), '디이에프')).toBe(baked('지에이치'));
    expect(restoreCustomerPlaceholder(baked('지에이치'), '')).toBe(baked('지에이치'));
  });
  it('이미 자리표시자가 있거나 패턴이 다르면 그대로', () => {
    expect(restoreCustomerPlaceholder(DEFAULT_KO, '')).toBe(DEFAULT_KO);
    expect(restoreCustomerPlaceholder('계약기간: 1년', '고객사')).toBe('계약기간: 1년');
  });
  it('배열: 변경 없으면 같은 참조 반환', () => {
    const notes = [DEFAULT_KO, '계약기간'];
    expect(restoreCustomerPlaceholders(notes, 'A')).toBe(notes);
    expect(restoreCustomerPlaceholders([baked('A')], 'A')![0]).toContain('{고객사명}');
    expect(restoreCustomerPlaceholders(undefined, 'A')).toBeUndefined();
  });
});
