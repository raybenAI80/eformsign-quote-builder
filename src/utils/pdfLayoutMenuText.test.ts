import { describe, expect, it } from 'vitest';
import { buildPdfLayoutMenuText, fitsOnOnePage, SINGLE_PAGE_NOTICE } from './pdfLayoutMenuText';

describe('buildPdfLayoutMenuText', () => {
  it('한 장에 들어가면 안내 한 줄과 방식 설명 부제를 준다', () => {
    const t = buildPdfLayoutMenuText({ fitPct: 100, pagedPages: 1 });
    expect(t.notice).toBe(SINGLE_PAGE_NOTICE);
    expect(t.subtitles.fit).toBe('내용이 길면 한 장에 맞게 글자를 줄입니다');
    expect(t.subtitles.paged).toBe('내용이 길면 글자 크기를 유지하고 쪽을 나눕니다');
  });

  it('한 장을 넘으면 안내 없이 방식별 실제 결과를 준다', () => {
    const t = buildPdfLayoutMenuText({ fitPct: 60, pagedPages: 3 });
    expect(t.notice).toBeNull();
    expect(t.subtitles.fit).toBe('1쪽 · 글자 약 60%로 줄어듭니다');
    expect(t.subtitles.paged).toBe('3쪽 · 글자 크기 그대로');
  });

  it('측정값이 없으면 안내 없이 기본 부제', () => {
    const t = buildPdfLayoutMenuText(null);
    expect(t.notice).toBeNull();
    expect(t.subtitles).toEqual({ fit: '1쪽', paged: '글자 크기 그대로' });
  });

  it('축소가 없어도 여러 쪽 결과가 2쪽 이상이면 한 장에 들어간 것이 아니다', () => {
    expect(fitsOnOnePage({ fitPct: 100, pagedPages: 2 })).toBe(false);
  });

  it('축소율 99%는 한 장에 들어간 것으로 본다(반올림 오차)', () => {
    expect(fitsOnOnePage({ fitPct: 99, pagedPages: 1 })).toBe(true);
    expect(fitsOnOnePage({ fitPct: 98, pagedPages: 1 })).toBe(false);
  });
});
