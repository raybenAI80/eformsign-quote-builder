import type { CategoryLabel } from '../constants';
import type { QuoteItem, QuoteMeta, SavedQuote } from '../types';

export const SAVED_QUOTES_KEY = 'eq_saved_quotes';
export const SAVED_QUOTES_LIMIT = 20;

export const UNNAMED_QUOTE_NAME = '이름 없는 견적서';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 날짜로 읽을 수 있는 문자열만 통과시킨다. 읽을 수 없으면 빈 문자열(화면에서 「날짜 없음」으로 표시). */
const sanitizeSavedAt = (v: unknown): string =>
  typeof v === 'string' && !Number.isNaN(new Date(v).getTime()) ? v : '';

const sanitizeSummary = (v: unknown): SavedQuote['summary'] => {
  if (!isRecord(v)) return undefined;
  const { msrpSum, offerSum, grand } = v;
  if (!isFiniteNumber(msrpSum) || !isFiniteNumber(offerSum) || !isFiniteNumber(grand)) return undefined;
  return { msrpSum, offerSum, grand };
};

const sanitizeCategoryLabels = (v: unknown): CategoryLabel[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const labels = v.filter(
    (l): l is CategoryLabel => isRecord(l) && typeof l.section === 'string' && typeof l.label === 'string'
  );
  return labels.length > 0 ? labels : undefined;
};

/**
 * 저장소에서 읽은 값 하나를 SavedQuote 로 검증한다. 형식이 맞지 않으면 null.
 * 필수: 문자열 id, 객체 meta, 배열 items. name·savedAt 은 없거나 잘못되면 기본값으로 채운다.
 */
export function parseSavedQuote(raw: unknown): SavedQuote | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id === '') return null;
  if (!isRecord(raw.meta)) return null;
  if (!Array.isArray(raw.items)) return null;
  const items = raw.items.filter(isRecord);
  const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : UNNAMED_QUOTE_NAME;
  const entry: SavedQuote = {
    id: raw.id,
    name,
    // 저장소 값은 경계에서 한 번 검증했고, 안쪽 코드는 이 타입을 믿는다(meta·items 의 세부 필드는 App 의 normalize 단계가 맡는다).
    meta: raw.meta as unknown as QuoteMeta,
    items: items as unknown as QuoteItem[],
    savedAt: sanitizeSavedAt(raw.savedAt),
  };
  const summary = sanitizeSummary(raw.summary);
  if (summary) entry.summary = summary;
  const categoryLabels = sanitizeCategoryLabels(raw.categoryLabels);
  if (categoryLabels) entry.categoryLabels = categoryLabels;
  return entry;
}

/** JSON 으로 읽은 값에서 유효한 항목만 남긴다. 배열이 아니면 빈 목록. */
export function parseSavedQuotes(raw: unknown): SavedQuote[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedQuote[] = [];
  for (const r of raw) {
    const q = parseSavedQuote(r);
    if (!q || seen.has(q.id)) continue;
    seen.add(q.id);
    out.push(q);
  }
  return out;
}

/** localStorage 에서 저장 목록을 읽는다. 없거나 깨졌으면 빈 목록(예외를 던지지 않는다). */
export function loadFromStorage(): SavedQuote[] {
  try {
    const raw = localStorage.getItem(SAVED_QUOTES_KEY);
    if (!raw) return [];
    return parseSavedQuotes(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** 저장 목록을 쓴다. 용량 초과 등으로 실패하면 false. */
export function saveToStorage(quotes: SavedQuote[]): boolean {
  try {
    localStorage.setItem(SAVED_QUOTES_KEY, JSON.stringify(quotes));
    return true;
  } catch {
    return false;
  }
}

export type SaveResult =
  | { ok: true; id: string; name: string }
  | { ok: false; reason: 'full' | 'storage' };

export type MutateResult = { ok: true } | { ok: false; reason: 'storage' | 'missing' };

/** list = 변경 뒤 화면에 보여 줄 목록. 실패하면 저장소에 실제로 있는 목록이다(화면과 저장소가 어긋나지 않게). */
export type CommitResult =
  | { ok: true; list: SavedQuote[] }
  | { ok: false; reason: 'full' | 'missing' | 'storage'; list: SavedQuote[] };

/**
 * 저장 목록을 바꾼다. 쓰기 직전에 저장소에서 목록을 다시 읽어 그 위에 변경을 적용한다
 * (다른 탭이 그 사이에 저장한 견적서를 덮어쓰지 않기 위해, 마운트 때 읽어 둔 목록을 쓰지 않는다).
 * 쓰기에 성공했을 때만 ok.
 */
export function commitSavedQuotes(change: (fresh: SavedQuote[]) => SavedQuote[] | 'full' | 'missing'): CommitResult {
  const fresh = loadFromStorage();
  const next = change(fresh);
  if (next === 'full' || next === 'missing') return { ok: false, reason: next, list: fresh };
  if (!saveToStorage(next)) return { ok: false, reason: 'storage', list: fresh };
  return { ok: true, list: next };
}

/** 새 견적서를 맨 앞에 넣는다. 목록이 가득 차 있으면 가장 오래된 것을 조용히 지우지 않고 'full' 로 막는다. */
export const addSavedQuoteEntry = (entry: SavedQuote): CommitResult =>
  commitSavedQuotes(fresh => (fresh.length >= SAVED_QUOTES_LIMIT ? 'full' : [entry, ...fresh]));

export const removeSavedQuoteEntry = (id: string): CommitResult =>
  commitSavedQuotes(fresh => fresh.filter(q => q.id !== id));

export const renameSavedQuoteEntry = (id: string, name: string): CommitResult =>
  commitSavedQuotes(fresh =>
    fresh.some(q => q.id === id) ? fresh.map(q => (q.id === id ? { ...q, name: name.trim() || q.name } : q)) : 'missing'
  );

export const SAVE_FULL_MESSAGE = `최대 ${SAVED_QUOTES_LIMIT}개까지 저장할 수 있습니다. 지울 견적서를 고른 뒤 저장하세요.`;
export const SAVE_STORAGE_FAIL_MESSAGE = '저장 공간이 부족해 저장하지 못했습니다. 오래된 견적서를 지운 뒤 다시 저장하세요.';
export const MUTATE_STORAGE_FAIL_MESSAGE = '저장 공간에 쓰지 못해 변경하지 못했습니다. 잠시 뒤 다시 시도하세요.';

/** 토스트에 넣는 이름이 길면 줄인다. */
export function shortenName(name: string, max = 30): string {
  const chars = Array.from(name);
  return chars.length <= max ? name : `${chars.slice(0, max).join('')}…`;
}

/** 저장 목록 행에 보여 주는 날짜·시간(예: 26. 11. 13. 14:05). 읽을 수 없으면 「날짜 없음」. */
export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '날짜 없음';
  const date = d.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${date} ${time}`;
}
