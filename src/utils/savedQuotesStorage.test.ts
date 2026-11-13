// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryLabel } from '../constants';
import type { SavedQuote } from '../types';
import {
  SAVED_QUOTES_KEY,
  SAVED_QUOTES_LIMIT,
  UNNAMED_QUOTE_NAME,
  addSavedQuoteEntry,
  commitSavedQuotes,
  formatSavedAt,
  loadFromStorage,
  parseSavedQuotes,
  removeSavedQuoteEntry,
  renameSavedQuoteEntry,
  shortenName,
} from './savedQuotesStorage';

const entry = (id: string, extra: Partial<SavedQuote> = {}): SavedQuote =>
  ({ id, name: `견적 ${id}`, meta: { customerName: '고객' }, items: [], savedAt: '2026-11-13T05:05:00.000Z', ...extra }) as unknown as SavedQuote;

const put = (v: unknown) => localStorage.setItem(SAVED_QUOTES_KEY, typeof v === 'string' ? v : JSON.stringify(v));
const stored = (): SavedQuote[] => JSON.parse(localStorage.getItem(SAVED_QUOTES_KEY) ?? '[]');

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('loadFromStorage 검증 (D1)', () => {
  it.each([
    ['객체 {"a":1}', { a: 1 }],
    ['null', null],
    ['숫자', 7],
    ['문자열', 'abc'],
  ])('배열이 아닌 값(%s)은 빈 목록', (_n, v) => {
    put(v);
    expect(loadFromStorage()).toEqual([]);
  });

  it('JSON 이 깨졌으면 빈 목록', () => {
    put('{not json');
    expect(loadFromStorage()).toEqual([]);
  });

  it('[null] 과 meta·items 가 없는 항목은 버리고 유효한 항목만 남긴다', () => {
    put([null, 3, 'x', { id: 'a' }, { id: 'b', meta: {} }, { id: 'c', items: [] }, { id: 9, meta: {}, items: [] }, entry('ok')]);
    expect(loadFromStorage().map(q => q.id)).toEqual(['ok']);
  });

  it('meta 가 배열이거나 items 가 객체면 버린다', () => {
    put([{ id: 'a', meta: [], items: [] }, { id: 'b', meta: {}, items: {} }]);
    expect(loadFromStorage()).toEqual([]);
  });

  it('name 이 없으면 기본 이름, savedAt 이 잘못되면 빈 문자열(Invalid Date 방지)', () => {
    const [q] = parseSavedQuotes([{ id: 'a', meta: {}, items: [], savedAt: 'garbage' }]);
    expect(q.name).toBe(UNNAMED_QUOTE_NAME);
    expect(q.savedAt).toBe('');
    expect(formatSavedAt(q.savedAt)).toBe('날짜 없음');
    expect(formatSavedAt('garbage')).toBe('날짜 없음');
  });

  it('같은 id 가 둘이면 앞의 것만 남긴다', () => {
    expect(parseSavedQuotes([entry('a'), entry('a')])).toHaveLength(1);
  });

  it('잘못된 summary·categoryLabels 는 버리고 올바른 값은 유지한다', () => {
    const labels: CategoryLabel[] = [{ section: 'SaaS', label: '문서' }];
    const [bad] = parseSavedQuotes([entry('a', { summary: { grand: 'x' } as never, categoryLabels: 'no' as never })]);
    expect(bad.summary).toBeUndefined();
    expect(bad.categoryLabels).toBeUndefined();
    const [good] = parseSavedQuotes([entry('b', { summary: { msrpSum: 1, offerSum: 2, grand: 3 }, categoryLabels: labels })]);
    expect(good.summary).toEqual({ msrpSum: 1, offerSum: 2, grand: 3 });
    expect(good.categoryLabels).toEqual(labels);
  });
});

describe('저장 실패 (D2)', () => {
  it('setItem 이 던지면 ok=false, 목록은 저장소에 있던 그대로', () => {
    expect(addSavedQuoteEntry(entry('old')).ok).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const r = addSavedQuoteEntry(entry('new'));
    expect(r.ok).toBe(false);
    expect('reason' in r ? r.reason : null).toBe('storage');
    expect(r.list.map(q => q.id)).toEqual(['old']);
    vi.restoreAllMocks();
    expect(stored().map(q => q.id)).toEqual(['old']);
  });

  it('삭제·이름 변경도 실패하면 화면용 목록이 저장소와 같다', () => {
    addSavedQuoteEntry(entry('a'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const del = removeSavedQuoteEntry('a');
    expect(del.ok).toBe(false);
    expect(del.list.map(q => q.id)).toEqual(['a']);
    const ren = renameSavedQuoteEntry('a', '새 이름');
    expect(ren.ok).toBe(false);
    expect(ren.list[0].name).toBe('견적 a');
  });

  it('없는 id 의 이름 변경은 missing', () => {
    const r = renameSavedQuoteEntry('none', 'x');
    expect(r.ok).toBe(false);
    expect('reason' in r ? r.reason : null).toBe('missing');
  });
});

describe('쓰기 직전에 다시 읽기 (D3)', () => {
  it('다른 탭이 사이에 저장한 견적서를 덮어쓰지 않는다', () => {
    addSavedQuoteEntry(entry('a')); // 이 탭이 마운트 때 읽은 목록 = [a]
    const staleInMemory = loadFromStorage();
    put([entry('fromOtherTab'), ...staleInMemory]); // 다른 탭이 저장
    const r = addSavedQuoteEntry(entry('mine'));
    expect(r.ok).toBe(true);
    expect(stored().map(q => q.id)).toEqual(['mine', 'fromOtherTab', 'a']);
  });

  it('삭제도 최신 목록에 적용한다', () => {
    put([entry('x'), entry('y')]);
    commitSavedQuotes(f => f); // 이 탭이 [x, y] 를 읽음
    put([entry('z'), entry('x'), entry('y')]); // 다른 탭이 z 추가
    removeSavedQuoteEntry('x');
    expect(stored().map(q => q.id)).toEqual(['z', 'y']);
  });
});

describe('20개 한도 (D5)', () => {
  it('20개가 차면 21번째 저장은 막고 가장 오래된 것을 지우지 않는다', () => {
    for (let i = 0; i < SAVED_QUOTES_LIMIT; i++) expect(addSavedQuoteEntry(entry(`q${i}`)).ok).toBe(true);
    const r = addSavedQuoteEntry(entry('extra'));
    expect(r.ok).toBe(false);
    expect('reason' in r ? r.reason : null).toBe('full');
    const ids = stored().map(q => q.id);
    expect(ids).toHaveLength(SAVED_QUOTES_LIMIT);
    expect(ids).toContain('q0');
    expect(ids).not.toContain('extra');
  });

  it('하나 지우면 다시 저장할 수 있다', () => {
    for (let i = 0; i < SAVED_QUOTES_LIMIT; i++) addSavedQuoteEntry(entry(`q${i}`));
    removeSavedQuoteEntry('q3');
    expect(addSavedQuoteEntry(entry('extra')).ok).toBe(true);
  });
});

describe('구분 이름 왕복 (D4)', () => {
  it('저장한 categoryLabels 가 다시 읽어도 그대로다', () => {
    const labels: CategoryLabel[] = [
      { section: 'SaaS', label: '구독 문서', labelEn: 'Docs' },
      { section: 'Credit', label: '크레딧' },
    ];
    addSavedQuoteEntry(entry('a', { categoryLabels: labels }));
    addSavedQuoteEntry(entry('old')); // 필드가 없는 옛 저장본
    const list = loadFromStorage();
    expect(list.find(q => q.id === 'a')?.categoryLabels).toEqual(labels);
    expect(list.find(q => q.id === 'old')?.categoryLabels).toBeUndefined();
  });
});

describe('표시 도우미 (M1·M2)', () => {
  it('날짜 뒤에 시:분을 붙여 같은 이름 두 행을 구분한다', () => {
    const a = formatSavedAt('2026-11-13T05:05:00.000Z');
    const b = formatSavedAt('2026-11-13T05:41:00.000Z');
    expect(a).toMatch(/\d{2}:\d{2}$/);
    expect(a).not.toBe(b);
  });

  it('긴 이름은 30자 + … 로 줄이고 짧은 이름은 그대로 둔다', () => {
    const long = '가'.repeat(80);
    expect(shortenName(long)).toBe('가'.repeat(30) + '…');
    expect(shortenName('짧은 이름')).toBe('짧은 이름');
  });
});
