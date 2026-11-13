// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuoteMeta } from '../types';
import { SAVED_QUOTES_KEY } from '../utils/savedQuotesStorage';
import { useSavedQuotes } from './useSavedQuotes';

const meta = { customerName: '고객' } as unknown as QuoteMeta;

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('useSavedQuotes', () => {
  it('저장에 실패하면 목록에 넣지 않고 실패를 알린다(D2)', () => {
    const { result } = renderHook(() => useSavedQuotes());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    let r: ReturnType<typeof result.current.saveQuote> | undefined;
    act(() => {
      r = result.current.saveQuote('견적', meta, []);
    });
    expect(r).toEqual({ ok: false, reason: 'storage' });
    expect(result.current.savedQuotes).toHaveLength(0);
  });

  it('다른 탭의 변경(storage 이벤트)을 목록에 반영한다(D3)', () => {
    const { result } = renderHook(() => useSavedQuotes());
    act(() => {
      result.current.saveQuote('내 견적', meta, []);
    });
    const other = { id: 'other', name: '다른 탭 견적', meta: {}, items: [], savedAt: '2026-11-13T00:00:00.000Z' };
    const mine = JSON.parse(localStorage.getItem(SAVED_QUOTES_KEY) ?? '[]');
    localStorage.setItem(SAVED_QUOTES_KEY, JSON.stringify([other, ...mine]));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: SAVED_QUOTES_KEY }));
    });
    expect(result.current.savedQuotes.map(q => q.id)).toContain('other');
    expect(result.current.savedQuotes).toHaveLength(2);
  });

  it('저장한 구분 이름이 항목에 들어간다(D4)', () => {
    const { result } = renderHook(() => useSavedQuotes());
    act(() => {
      result.current.saveQuote('견적', meta, [], undefined, [{ section: 'SaaS', label: '구독 문서' }]);
    });
    expect(result.current.savedQuotes[0].categoryLabels).toEqual([{ section: 'SaaS', label: '구독 문서' }]);
  });
});
