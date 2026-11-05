// 천 단위 쉼표 입력용 순수 함수. 화면 입력칸(ThousandsInput)과 복원 경로가 같은 규칙을 쓴다.

/** 한 입력칸에 허용하는 최대 자릿수. Number 가 정확히 표현하는 범위(15자리) 안에서 막는다. */
export const MAX_THOUSANDS_DIGITS = 15;

const NON_DIGIT_RE = /[^0-9]/g;
/** 금액으로 읽을 수 있는 문자: 숫자·쉼표·공백·원·₩. 이 밖의 글자가 하나라도 있으면 글자 단가로 본다. */
const NUMERIC_ONLY_RE = /^[\d,\s원₩]*$/;

/** 숫자만 남긴다. 앞쪽 0 은 지우고(0005 → 5), 자릿수는 MAX_THOUSANDS_DIGITS 로 자른다. */
export const extractDigits = (raw: string): string => {
  const digits = raw.replace(NON_DIGIT_RE, '').slice(0, MAX_THOUSANDS_DIGITS);
  return digits.replace(/^0+(?=\d)/, '');
};

/** 숫자만 있는 문자열에 3자리마다 쉼표를 넣는다. */
export const groupDigits = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 입력 문자열을 쉼표 형식으로 바꾼다. 숫자가 없으면 빈 문자열. 단, 사용자가 쓴 "0" 은 "0" 으로 둔다. */
export const formatThousandsText = (raw: string): string => groupDigits(extractDigits(raw));

/** 저장된 숫자를 입력칸 표시 문자열로 바꾼다. 0·빈 값·NaN 은 빈 문자열(placeholder "0" 이 보인다). */
export const formatThousands = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '';
  return groupDigits(String(Math.floor(value)));
};

/** 쉼표·공백·글자를 걷어낸 숫자. 숫자가 하나도 없으면 0. */
export const parseThousands = (raw: string | number | null | undefined): number => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const digits = extractDigits(String(raw ?? ''));
  return digits ? Number(digits) : 0;
};

/**
 * 금액처럼 읽을 수 있는 문자열인가: 숫자가 1개 이상 있고 숫자·쉼표·공백·원·₩ 만 있다.
 * "2,00000"·" 1 234 567원" 은 true, "별도 협의"·"협의 2000"·"1.5" 는 false.
 */
export const isNumericText = (raw: string): boolean => /\d/.test(raw) && NUMERIC_ONLY_RE.test(raw);

/** 글자 단가인가: 비어 있지 않고 금액으로 읽을 수 없는 글자가 섞여 있다. */
export const isTextPrice = (raw: string): boolean => raw.trim() !== '' && !NUMERIC_ONLY_RE.test(raw);

/**
 * 단가 값을 정리한다. 숫자는 그대로, 금액으로 읽을 수 있는 문자열은 숫자로, 글자 단가는 그대로 둔다.
 * 이전 버전이 저장한 깨진 값("2,00000")을 복원할 때 쓴다.
 */
export const normalizeUnitPrice = (value: number | string): number | string => {
  if (typeof value !== 'string') return value;
  if (isNumericText(value)) return parseThousands(value);
  return value;
};

/** 커서 왼쪽에 있는 숫자 개수. */
export const countDigitsBefore = (text: string, caret: number): number =>
  (text.slice(0, Math.max(0, caret)).match(/\d/g) ?? []).length;

/** formatted 에서 숫자 digitCount 개 바로 뒤의 위치. 0 이면 맨 앞, 숫자 수를 넘으면 맨 끝. */
export const caretAfterDigits = (formatted: string, digitCount: number): number => {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
};

export interface ThousandsEdit {
  /** 입력칸에 표시할 문자열 */
  text: string;
  /** 숫자 값. 숫자가 없으면 0 */
  value: number;
  /** 재포맷 뒤 커서 위치 */
  caret: number;
}

/**
 * 입력 이벤트 한 번을 처리한다. rawText 는 브라우저가 방금 바꾼 입력칸 값, rawCaret 은 그때의 커서.
 * 커서 왼쪽 숫자 개수를 세어 두었다가 재포맷한 문자열에서 같은 개수 뒤에 커서를 놓는다.
 */
export const applyThousandsInput = (rawText: string, rawCaret: number): ThousandsEdit => {
  const digitsLeft = Math.min(countDigitsBefore(rawText, rawCaret), MAX_THOUSANDS_DIGITS);
  const digits = extractDigits(rawText);
  // 앞쪽 0 이 지워져 숫자 수가 줄었으면 커서 앞 숫자 수도 그만큼 넘지 않게 한다
  const left = Math.min(digitsLeft, digits.length);
  const text = groupDigits(digits);
  return { text, value: digits ? Number(digits) : 0, caret: caretAfterDigits(text, left) };
};
