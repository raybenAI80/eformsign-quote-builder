import { useState, useCallback } from 'react';
import { SavedQuote, QuoteMeta, QuoteItem } from '../types';

const SAVED_QUOTES_KEY = 'eq_saved_quotes';
const SAVED_QUOTES_LIMIT = 20;

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

function loadFromStorage(): SavedQuote[] {
  try {
    const raw = localStorage.getItem(SAVED_QUOTES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedQuote[];
  } catch {
    return [];
  }
}

function saveToStorage(quotes: SavedQuote[]): void {
  try {
    localStorage.setItem(SAVED_QUOTES_KEY, JSON.stringify(quotes));
  } catch {
    // storage full — ignore
  }
}

export function useSavedQuotes() {
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>(() => loadFromStorage());

  const saveQuote = useCallback(
    (
      name: string,
      meta: QuoteMeta,
      items: QuoteItem[],
      summary?: { msrpSum: number; offerSum: number; grand: number }
    ) => {
      const entry: SavedQuote = {
        id: generateId(),
        name: name.trim() || `견적서 ${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`,
        meta: JSON.parse(JSON.stringify(meta)),
        items: JSON.parse(JSON.stringify(items)),
        savedAt: new Date().toISOString(),
        summary,
      };
      setSavedQuotes(prev => {
        const next = [entry, ...prev].slice(0, SAVED_QUOTES_LIMIT);
        saveToStorage(next);
        return next;
      });
      return entry.id;
    },
    []
  );

  const removeSavedQuote = useCallback((id: string) => {
    setSavedQuotes(prev => {
      const next = prev.filter(q => q.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  const renameSavedQuote = useCallback((id: string, name: string) => {
    setSavedQuotes(prev => {
      const next = prev.map(q => (q.id === id ? { ...q, name: name.trim() || q.name } : q));
      saveToStorage(next);
      return next;
    });
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
