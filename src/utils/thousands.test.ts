import { describe, it, expect } from 'vitest';
import {
  applyThousandsInput,
  caretAfterDigits,
  countDigitsBefore,
  extractDigits,
  formatThousands,
  formatThousandsText,
  isNumericText,
  isTextPrice,
  normalizeUnitPrice,
  parseThousands,
} from './thousands';
import { parseNum } from './helpers';

describe('formatThousands / formatThousandsText', () => {
  it('3자리마다 쉼표를 넣는다', () => {
    expect(formatThousands(2000000)).toBe('2,000,000');
    expect(formatThousands(1000)).toBe('1,000');
    expect(formatThousands(999)).toBe('999');
    expect(formatThousands(123456789)).toBe('123,456,789');
  });

  it('0·음수·NaN·빈 값은 빈 문자열(placeholder 0 이 보인다)', () => {
    expect(formatThousands(0)).toBe('');
    expect(formatThousands(-5)).toBe('');
    expect(formatThousands(NaN)).toBe('');
    expect(formatThousands(undefined)).toBe('');
  });

  it('입력 문자열을 쉼표 형식으로 바꾼다', () => {
    expect(formatThousandsText('2,0000')).toBe('20,000');
    expect(formatThousandsText('2,00000')).toBe('200,000');
    expect(formatThousandsText('0005')).toBe('5');
    expect(formatThousandsText('')).toBe('');
    expect(formatThousandsText('abc')).toBe('');
  });

  it('15자리를 넘기면 자른다', () => {
    expect(extractDigits('1234567890123456789')).toHaveLength(15);
  });
});

describe('parseThousands', () => {
  it('쉼표·공백·원을 걷어낸 숫자', () => {
    expect(parseThousands('1,234,567')).toBe(1234567);
    expect(parseThousands('1234567')).toBe(1234567);
    expect(parseThousands(' 1 234 567원')).toBe(1234567);
    expect(parseThousands('₩ 2,000')).toBe(2000);
  });

  it('숫자가 없으면 0', () => {
    expect(parseThousands('')).toBe(0);
    expect(parseThousands('별도 협의')).toBe(0);
    expect(parseThousands(null)).toBe(0);
    expect(parseThousands(undefined)).toBe(0);
  });

  it('숫자 타입은 그대로', () => {
    expect(parseThousands(500)).toBe(500);
    expect(parseThousands(NaN)).toBe(0);
  });
});

describe('글자 단가 판정', () => {
  it('금액으로 읽을 수 있으면 숫자 문자열', () => {
    expect(isNumericText('2,00000')).toBe(true);
    expect(isNumericText(' 1 234 567원')).toBe(true);
    expect(isNumericText('2000')).toBe(true);
  });

  it('글자가 하나라도 있으면 글자 단가', () => {
    expect(isTextPrice('별도 협의')).toBe(true);
    expect(isTextPrice('협의 2000')).toBe(true);
    expect(isTextPrice('2000협의')).toBe(true);
    expect(isTextPrice('1.5')).toBe(true);
  });

  it('숫자·쉼표·공백·원만 있으면 글자 단가가 아니다', () => {
    expect(isTextPrice('2,0000')).toBe(false);
    expect(isTextPrice('')).toBe(false);
    expect(isTextPrice('   ')).toBe(false);
    expect(isTextPrice('1,234원')).toBe(false);
  });
});

describe('normalizeUnitPrice (저장된 깨진 값 복원)', () => {
  it('깨진 쉼표 문자열을 숫자로 정리한다', () => {
    expect(normalizeUnitPrice('2,00000')).toBe(200000);
    expect(normalizeUnitPrice('2,0000')).toBe(20000);
    expect(normalizeUnitPrice(' 1 234 567원')).toBe(1234567);
  });

  it('숫자와 글자 단가는 그대로 둔다', () => {
    expect(normalizeUnitPrice(1200)).toBe(1200);
    expect(normalizeUnitPrice(0)).toBe(0);
    expect(normalizeUnitPrice('별도 협의')).toBe('별도 협의');
    expect(normalizeUnitPrice('')).toBe('');
  });
});

describe('커서 위치 계산', () => {
  it('커서 왼쪽 숫자 개수', () => {
    expect(countDigitsBefore('2,000,000', 0)).toBe(0);
    expect(countDigitsBefore('2,000,000', 2)).toBe(1);
    expect(countDigitsBefore('2,000,000', 9)).toBe(7);
  });

  it('숫자 n 개 바로 뒤 위치', () => {
    expect(caretAfterDigits('2,000,000', 0)).toBe(0);
    expect(caretAfterDigits('2,000,000', 1)).toBe(1);
    expect(caretAfterDigits('2,000,000', 2)).toBe(3);
    expect(caretAfterDigits('2,000,000', 7)).toBe(9);
    expect(caretAfterDigits('2,000,000', 99)).toBe(9);
  });

  it('끝에 한 자씩 입력하면 커서는 항상 끝', () => {
    let text = '';
    for (const ch of '2000000') {
      const edit = applyThousandsInput(text + ch, (text + ch).length);
      text = edit.text;
      expect(edit.caret).toBe(text.length);
    }
    expect(text).toBe('2,000,000');
  });

  it('"2,0000" 같은 입력은 숫자 20000 으로 저장된다', () => {
    const edit = applyThousandsInput('2,0000', 6);
    expect(edit.text).toBe('20,000');
    expect(edit.value).toBe(20000);
    expect(edit.caret).toBe(6);
  });

  it('중간 삽입: 쉼표 뒤에 5 를 넣으면 25,000,000 이고 커서는 5 뒤', () => {
    const edit = applyThousandsInput('2,5000,000', 3);
    expect(edit.text).toBe('25,000,000');
    expect(edit.value).toBe(25000000);
    expect(edit.caret).toBe(2);
  });

  it('쉼표 바로 뒤에서 Backspace: 쉼표가 지워져도 값은 같고 커서는 쉼표 앞으로', () => {
    const edit = applyThousandsInput('2000,000', 1);
    expect(edit.text).toBe('2,000,000');
    expect(edit.value).toBe(2000000);
    expect(edit.caret).toBe(1);
  });

  it('숫자 Delete: 2,0|00,000 에서 0 하나 삭제하면 200,000', () => {
    const edit = applyThousandsInput('2,00,000', 3);
    expect(edit.text).toBe('200,000');
    expect(edit.caret).toBe(2);
  });

  it('전체 선택 후 한 자 입력', () => {
    expect(applyThousandsInput('7', 1)).toEqual({ text: '7', value: 7, caret: 1 });
  });

  it('전부 지우면 빈 값과 0', () => {
    expect(applyThousandsInput('', 0)).toEqual({ text: '', value: 0, caret: 0 });
  });

  it('붙여넣기: 쉼표·공백·원이 섞여도 숫자로 정리한다', () => {
    expect(applyThousandsInput('1,234,567', 9).value).toBe(1234567);
    expect(applyThousandsInput('1234567', 7).text).toBe('1,234,567');
    expect(applyThousandsInput(' 1 234 567원', 12).text).toBe('1,234,567');
  });

  it('앞쪽 0 은 지워지고 커서가 범위를 넘지 않는다', () => {
    const edit = applyThousandsInput('05', 2);
    expect(edit.text).toBe('5');
    expect(edit.caret).toBe(1);
  });
});

describe('parseNum 쉼표 허용', () => {
  it('천 단위 쉼표가 든 문자열을 끝까지 읽는다', () => {
    expect(parseNum('1,234')).toBe(1234);
    expect(parseNum('2,00000')).toBe(200000);
    expect(parseNum('별도 협의')).toBe(0);
  });
});
