import React, { useLayoutEffect, useRef } from 'react';
import { applyThousandsInput, formatThousands, isNumericText, isTextPrice, parseThousands } from '../../utils/thousands';

export interface ThousandsInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** 저장된 값. 숫자이거나(allowText 일 때) 글자 단가 문자열 */
  value: number | string;
  /** 숫자는 number 로, 글자 단가는 string 으로 넘어온다. 빈 칸은 0 */
  onValueChange: (next: number | string) => void;
  /** true 면 금액으로 읽을 수 없는 글자가 섞인 입력을 글자 단가로 그대로 저장한다 */
  allowText?: boolean;
}

/**
 * 천 단위 쉼표 입력칸. 입력 중에도 항상 2,000,000 형식으로 보이고 저장값은 숫자다.
 * 입력·삭제·붙여넣기 뒤에도 커서가 원래 숫자 뒤에 남는다.
 */
export const ThousandsInput: React.FC<ThousandsInputProps> = ({ value, onValueChange, allowText = false, ...rest }) => {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  const display =
    typeof value === 'string'
      ? isNumericText(value)
        ? formatThousands(parseThousands(value))
        : value
      : formatThousands(value);

  // 다시 그려진 뒤에도 커서를 맞춘다(부모가 값을 바꿔 DOM 이 갱신된 경우 대비)
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && pendingCaret.current !== null && document.activeElement === el) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const raw = el.value;
    if (allowText && isTextPrice(raw)) {
      onValueChange(raw);
      return;
    }
    const edit = applyThousandsInput(raw, el.selectionStart ?? raw.length);
    // 값이 같아 다시 그려지지 않아도 화면 값과 커서를 바로 맞춘다
    el.value = edit.text;
    el.setSelectionRange(edit.caret, edit.caret);
    pendingCaret.current = edit.caret;
    onValueChange(edit.value);
  };

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode={allowText ? undefined : 'numeric'}
      value={display}
      onChange={handleChange}
    />
  );
};
