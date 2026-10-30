import { describe, expect, it } from 'vitest';
import { hasEnterpriseItem } from './previewModel';

type Row = Parameters<typeof hasEnterpriseItem>[0][number];
const row = (section: Row['section'], item: string): Row => ({ section, item });

describe('hasEnterpriseItem (결제 정보는 Enterprise 견적에서만)', () => {
  it('SaaS 구역에 Enterprise 품목이 있으면 true', () => {
    expect(hasEnterpriseItem([row('SaaS', 'eformsign Enterprise'), row('SaaS', '추가 문서')])).toBe(true);
  });

  it('Enterprise 품목이 없으면 false (충전형·구독형·교육만 있는 견적)', () => {
    expect(
      hasEnterpriseItem([row('SaaS', '충전형 문서'), row('SaaS', '구독형 Business'), row('Service', '사용자 교육 1H')]),
    ).toBe(false);
  });

  it('SaaS 가 아닌 구역의 품목명에만 Enterprise 가 있으면 false', () => {
    expect(hasEnterpriseItem([row('Service', 'Enterprise 도입 컨설팅'), row('Credit', 'Enterprise 크레딧')])).toBe(false);
  });

  it('품목이 하나도 없으면 false', () => {
    expect(hasEnterpriseItem([])).toBe(false);
  });
});
