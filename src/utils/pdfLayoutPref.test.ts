import { describe, it, expect, afterEach, vi } from 'vitest';
import { readPdfLayout, writePdfLayout, PDF_LAYOUT_STORAGE_KEY, DEFAULT_PDF_LAYOUT } from './pdfLayoutPref';

describe('pdfLayoutPref', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('기본값은 한 장에 맞춤', () => {
    expect(DEFAULT_PDF_LAYOUT).toBe('fit');
    expect(readPdfLayout()).toBe('fit');
  });

  it('저장한 값을 다시 읽는다', () => {
    expect(writePdfLayout('paged')).toBe(true);
    expect(readPdfLayout()).toBe('paged');
    writePdfLayout('fit');
    expect(readPdfLayout()).toBe('fit');
  });

  it('알 수 없는 값은 기본값', () => {
    localStorage.setItem(PDF_LAYOUT_STORAGE_KEY, 'weird');
    expect(readPdfLayout()).toBe('fit');
  });

  it('저장소가 막혀 있으면 기본값을 돌려주고 쓰기는 false', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readPdfLayout()).toBe('fit');
    expect(writePdfLayout('paged')).toBe(false);
  });
});
