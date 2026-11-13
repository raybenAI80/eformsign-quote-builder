import { describe, expect, it } from 'vitest';
import type { SavedQuote } from '../types';
import { filterSavedQuotes, matchesSavedQuote, normalizeSearchText, truncateQueryForDisplay } from './savedQuotesSearch';

const quote = (name: string, meta: Record<string, unknown> = {}, savedAt = '2026-11-13T05:05:00.000Z'): SavedQuote =>
  ({ id: name, name, meta, items: [], savedAt }) as unknown as SavedQuote;

const hanbit = quote('문서 5천건 견적', {
  customerName: '(주)한빛물산',
  quoteNo: 'FORCS-EFS-2611-007',
  customerManager: '김하늘 팀장',
  contactName: '조병철',
  salesManager: '이서연',
});

describe('matchesSavedQuote', () => {
  it('빈 검색어와 공백만 있는 검색어는 모두 맞는다', () => {
    expect(matchesSavedQuote(hanbit, '')).toBe(true);
    expect(matchesSavedQuote(hanbit, '   ')).toBe(true);
    expect(filterSavedQuotes([hanbit, quote('다른')], '')).toHaveLength(2);
  });

  it('저장 이름·고객사·견적번호·담당자 이름으로 찾는다', () => {
    for (const q of ['문서 5천', '한빛', 'FORCS-EFS-2611', '김하늘', '조병철', '이서연']) {
      expect(matchesSavedQuote(hanbit, q), q).toBe(true);
    }
    expect(matchesSavedQuote(hanbit, '없는이름')).toBe(false);
  });

  it('대소문자를 구분하지 않는다', () => {
    expect(matchesSavedQuote(hanbit, 'forcs-efs')).toBe(true);
    expect(matchesSavedQuote(quote('ABC Corp'), 'abc corp')).toBe(true);
  });

  it('NFD 로 입력해도 NFC 로 저장된 이름을 찾는다(반대도 같다)', () => {
    const nfc = '한빛물산';
    const nfd = nfc.normalize('NFD');
    expect(nfd).not.toBe(nfc);
    expect(matchesSavedQuote(quote(nfc), nfd)).toBe(true);
    expect(matchesSavedQuote(quote(nfd), nfc)).toBe(true);
  });

  it('공백은 무시한다', () => {
    expect(matchesSavedQuote(hanbit, '한빛 물산')).toBe(true);
    expect(matchesSavedQuote(hanbit, ' 문서5천건 ')).toBe(true);
    expect(matchesSavedQuote(quote('한빛물산'), '한 빛 물 산')).toBe(true);
    expect(matchesSavedQuote(quote('한빛 물산'), '한빛물산')).toBe(true);
  });

  it.each(['(', ')', '+', '[', ']', '*', '?', String.fromCharCode(92), '^', '$', '|', '{'])('특수문자 %s 는 오류 없이 글자 그대로 찾는다', ch => {
    expect(() => matchesSavedQuote(hanbit, ch)).not.toThrow();
    expect(matchesSavedQuote(quote(`견적${ch}끝`), ch)).toBe(true);
    expect(matchesSavedQuote(quote('견적끝'), ch)).toBe(false);
  });

  it('정규식 의미가 없다: ".*" 는 아무 글자와도 맞지 않는다', () => {
    expect(matchesSavedQuote(hanbit, '.*')).toBe(false);
    expect(matchesSavedQuote(quote('견적 .* 끝'), '.*')).toBe(true);
  });

  it('(주) 를 괄호 포함으로 찾는다', () => {
    expect(matchesSavedQuote(hanbit, '(주)한빛')).toBe(true);
  });

  it('meta 필드가 없거나 null·숫자여도 오류 없이 동작한다', () => {
    const odd = quote('이름', { customerName: null, quoteNo: undefined, customerManager: 5, contactName: {}, salesManager: [] });
    expect(() => matchesSavedQuote(odd, '무엇')).not.toThrow();
    expect(matchesSavedQuote(odd, '이름')).toBe(true);
    expect(matchesSavedQuote(odd, 'null')).toBe(false);
    const noMeta = { id: 'x', name: '메타없음', items: [], savedAt: '' } as unknown as SavedQuote;
    expect(matchesSavedQuote(noMeta, '메타없음')).toBe(true);
  });

  it('저장 날짜는 YYYY-MM-DD 와 화면 표기(yy. MM. dd.)로 찾는다', () => {
    // 시간대에 따라 날짜가 바뀌지 않도록 한낮(UTC 03:00 = 한국 12:00)으로 둔다
    const q = quote('날짜견적', {}, new Date(2026, 10, 13, 12, 0).toISOString());
    expect(matchesSavedQuote(q, '2026-11-13')).toBe(true);
    expect(matchesSavedQuote(q, '2026-11')).toBe(true);
    expect(matchesSavedQuote(q, '26.11.13')).toBe(true);
    expect(matchesSavedQuote(q, '26. 11. 13.')).toBe(true);
    expect(matchesSavedQuote(q, '2026-11-14')).toBe(false);
  });

  it('날짜를 읽을 수 없는 항목도 오류 없이 이름으로 찾는다', () => {
    const q = quote('날짜없음견적', {}, '');
    expect(matchesSavedQuote(q, '날짜없음견적')).toBe(true);
    expect(matchesSavedQuote(q, '2026')).toBe(false);
  });

  it('필터는 목록 순서를 바꾸지 않는다', () => {
    const list = [quote('가 견적'), quote('나 다른'), quote('다 견적')];
    expect(filterSavedQuotes(list, '견적').map(q => q.name)).toEqual(['가 견적', '다 견적']);
  });
});

describe('normalizeSearchText / truncateQueryForDisplay', () => {
  it('문자열이 아니면 빈 문자열', () => {
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(3)).toBe('');
  });
  it('긴 검색어는 30자에서 줄인다', () => {
    expect(truncateQueryForDisplay('가'.repeat(40))).toBe('가'.repeat(30) + '…');
    expect(truncateQueryForDisplay('  짧다  ')).toBe('짧다');
  });
});
