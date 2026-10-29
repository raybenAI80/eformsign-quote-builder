import { describe, expect, it } from 'vitest';
import { selectFooterKind } from './quoteFooterKind';

describe('selectFooterKind', () => {
  it('기본값(AI 견적서 + 일반 기업용)은 일반 푸터', () => {
    expect(selectFooterKind({ brandingMode: 'ai', sector: 'general' })).toBe('general');
  });

  it('sector 가 없어도(구버전 저장본) 브랜딩 모드만으로 고른다', () => {
    expect(selectFooterKind({ brandingMode: 'default' })).toBe('general');
    expect(selectFooterKind({ brandingMode: 'public' })).toBe('public');
  });

  it('공공 견적서 브랜딩이면 sector 와 무관하게 공공 푸터', () => {
    expect(selectFooterKind({ brandingMode: 'public', sector: 'general' })).toBe('public');
    expect(selectFooterKind({ brandingMode: 'public', sector: 'subsidy' })).toBe('public');
  });

  it('정부·공공기관용 sector 면 브랜딩이 일반이어도 공공 푸터', () => {
    expect(selectFooterKind({ brandingMode: 'ai', sector: 'public' })).toBe('public');
    expect(selectFooterKind({ brandingMode: 'default', sector: 'public' })).toBe('public');
  });

  it('지원사업용은 공공이 아니므로 일반 푸터', () => {
    expect(selectFooterKind({ brandingMode: 'default', sector: 'subsidy' })).toBe('general');
    expect(selectFooterKind({ brandingMode: 'ai', sector: 'subsidy' })).toBe('general');
  });
});
