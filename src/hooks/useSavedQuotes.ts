import { useState, useCallback, useEffect } from 'react';
import { SavedQuote, QuoteMeta, QuoteItem } from '../types';
import type { CategoryLabel } from '../constants';
import {
  SAVED_QUOTES_KEY,
  addSavedQuoteEntry,
  loadFromStorage,
  removeSavedQuoteEntry,
  renameSavedQuoteEntry,
  type MutateResult,
  type SaveResult,
} from '../utils/savedQuotesStorage';

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export function useSavedQuotes() {
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>(() => loadFromStorage());

  // 다른 탭에서 저장·삭제하면 이 탭의 목록도 따라간다.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== SAVED_QUOTES_KEY) return;
      setSavedQuotes(loadFromStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const saveQuote = useCallback(
    (
      name: string,
      meta: QuoteMeta,
      items: QuoteItem[],
      summary?: { msrpSum: number; offerSum: number; grand: number },
      categoryLabels?: CategoryLabel[]
    ): SaveResult => {
      const now = new Date();
      const entry: SavedQuote = {
        id: generateId(),
        name: name.trim() || `견적서 ${now.toLocaleDateString('ko-KR')} ${now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`,
        meta: JSON.parse(JSON.stringify(meta)),
        items: JSON.parse(JSON.stringify(items)),
        savedAt: now.toISOString(),
        summary,
        categoryLabels: categoryLabels ? JSON.parse(JSON.stringify(categoryLabels)) : undefined,
      };
      const r = addSavedQuoteEntry(entry);
      setSavedQuotes(r.list);
      if ('reason' in r) return { ok: false, reason: r.reason === 'full' ? 'full' : 'storage' };
      return { ok: true, id: entry.id, name: entry.name };
    },
    []
  );

  const removeSavedQuote = useCallback((id: string): MutateResult => {
    const r = removeSavedQuoteEntry(id);
    setSavedQuotes(r.list);
    return 'reason' in r ? { ok: false, reason: 'storage' } : { ok: true };
  }, []);

  const renameSavedQuote = useCallback((id: string, name: string): MutateResult => {
    const r = renameSavedQuoteEntry(id, name);
    setSavedQuotes(r.list);
    if ('reason' in r) return { ok: false, reason: r.reason === 'missing' ? 'missing' : 'storage' };
    return { ok: true };
  }, []);

  const getSavedQuote = useCallback(
    (id: string): SavedQuote | undefined => {
      return savedQuotes.find(q => q.id === id);
    },
    [savedQuotes]
  );

  return {
    savedQuotes,
    saveQuote,
    removeSavedQuote,
    renameSavedQuote,
    getSavedQuote,
  };
}
