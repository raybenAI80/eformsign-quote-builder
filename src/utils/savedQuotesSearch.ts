import type { QuoteMeta, SavedQuote } from '../types';
import { formatSavedAt } from './savedQuotesStorage';

/** 검색어 표시에 쓰는 최대 글자 수(안내 문구가 길어지지 않게 한다) */
export const SEARCH_QUERY_DISPLAY_MAX = 30;

/**
 * 비교용으로 문자열을 맞춘다: 유니코드 NFC 로 합치고(맥의 NFD 입력 대응) 소문자로 바꾸고 공백을 모두 뺀다.
 * 공백을 빼므로 「한빛 물산」으로 「한빛물산」을 찾는다.
 */
export function normalizeSearchText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').toLowerCase().replace(/\s+/g, '');
}

/** 저장 시각을 사용자 시간대의 YYYY-MM-DD 로 만든다(읽을 수 없으면 빈 문자열) */
function localIsoDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 검색 대상 글: 저장 이름·고객사·견적번호·고객 담당자·우리 쪽 담당자·영업 담당·저장 날짜(화면 표기와 YYYY-MM-DD) */
export function savedQuoteSearchFields(quote: SavedQuote): string[] {
  const meta: Partial<QuoteMeta> = quote.meta ?? {};
  return [
    quote.name,
    meta.customerName,
    meta.quoteNo,
    meta.customerManager,
    meta.contactName,
    meta.salesManager,
    formatSavedAt(quote.savedAt),
    localIsoDate(quote.savedAt),
  ].map(normalizeSearchText);
}

/**
 * 저장된 견적서 하나가 검색어에 맞는지. 검색어 전체를 한 덩어리 문자열로 보고 부분 일치만 쓴다(정규식을 만들지 않으므로
 * 「(」「+」「[」 같은 글자도 그대로 찾는다). 검색어가 비어 있으면(공백만 있는 경우 포함) 모두 맞는다.
 */
export function matchesSavedQuote(quote: SavedQuote, query: string): boolean {
  const q = normalizeSearchText(query);
  if (q === '') return true;
  return savedQuoteSearchFields(quote).some(field => field.includes(q));
}

export function filterSavedQuotes(quotes: readonly SavedQuote[], query: string): SavedQuote[] {
  return quotes.filter(q => matchesSavedQuote(q, query));
}

/** 안내 문구에 넣을 검색어: 앞뒤 공백을 지우고 길면 줄인다 */
export function truncateQueryForDisplay(query: string): string {
  const t = query.trim();
  const chars = Array.from(t);
  return chars.length > SEARCH_QUERY_DISPLAY_MAX ? chars.slice(0, SEARCH_QUERY_DISPLAY_MAX).join('') + '…' : t;
}
