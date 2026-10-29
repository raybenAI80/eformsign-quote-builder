import { describe, expect, it } from 'vitest';
import type { QuoteMeta } from '../../types';
import { selectFooterKind } from './quoteFooterKind';

describe('selectFooterKind (브랜딩 설정으로만 판정)', () => {
  it('일반 견적서(default)는 F2 브랜드 밴드', () => {
    expect(selectFooterKind({ brandingMode: 'default' })).toBe('general');
  });

  it('AI 견적서(ai)는 F1 콜로폰', () => {
    expect(selectFooterKind({ brandingMode: 'ai' })).toBe('public');
  });

  it('공공 견적서(public)는 F1 콜로폰', () => {
    expect(selectFooterKind({ brandingMode: 'public' })).toBe('public');
  });

  it('값이 없으면 기본값(일반 견적서)과 같이 F2', () => {
    expect(selectFooterKind({} as Pick<QuoteMeta, 'brandingMode'>)).toBe('general');
  });

  it('섹터는 판정에 쓰지 않는다: default + 정부·공공기관용 sector 도 F2', () => {
    const meta = { brandingMode: 'default', sector: 'public' } as Pick<QuoteMeta, 'brandingMode'>;
    expect(selectFooterKind(meta)).toBe('general');
  });

  it('섹터는 판정에 쓰지 않는다: default + 지원사업용 sector 도 F2', () => {
    const meta = { brandingMode: 'default', sector: 'subsidy' } as Pick<QuoteMeta, 'brandingMode'>;
    expect(selectFooterKind(meta)).toBe('general');
  });

  it('섹터가 일반 기업용이어도 AI·공공 견적서는 F1', () => {
    const ai = { brandingMode: 'ai', sector: 'general' } as Pick<QuoteMeta, 'brandingMode'>;
    const pub = { brandingMode: 'public', sector: 'general' } as Pick<QuoteMeta, 'brandingMode'>;
    expect(selectFooterKind(ai)).toBe('public');
    expect(selectFooterKind(pub)).toBe('public');
  });
});
