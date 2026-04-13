import React, { useRef, useCallback, useEffect, useState } from 'react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    rows?: number;
}

// 색상 팔레트
const COLORS = [
    { name: '검정', value: '#000000' },
    { name: '빨강', value: '#dc2626' },
    { name: '파랑', value: '#2563eb' },
    { name: '초록', value: '#16a34a' },
    { name: '주황', value: '#ea580c' },
    { name: '보라', value: '#7c3aed' },
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
    value,
    onChange,
    placeholder = '내용을 입력하세요',
    disabled = false,
    rows = 4,
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastValueRef = useRef(value);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);

    // 초기 마운트 시 value 설정
    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.innerHTML = value || '';
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 외부에서 value가 변경된 경우에만 동기화 (자체 입력은 무시)
    useEffect(() => {
        if (value !== lastValueRef.current && editorRef.current) {
            if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = value || '';
            }
            lastValueRef.current = value;
        }
    }, [value]);

    // 클릭 좌표 기반 커서 복원 — focus 리렌더 시 커서 점프 방지
    const clickPos = useRef<{ x: number; y: number } | null>(null);

    const restoreCursorFromPoint = useCallback(() => {
        if (!clickPos.current || !editorRef.current) return;
        const { x, y } = clickPos.current;
        clickPos.current = null;
        try {
            // caretPositionFromPoint (표준) 또는 caretRangeFromPoint (Chrome)
            let range: Range | null = null;
            if (document.caretPositionFromPoint) {
                const pos = document.caretPositionFromPoint(x, y);
                if (pos) {
                    range = document.createRange();
                    range.setStart(pos.offsetNode, pos.offset);
                    range.collapse(true);
                }
            } else if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(x, y);
            }
            if (range) {
                const sel = window.getSelection();
                if (sel) {
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        } catch { /* fallback: browser default position */ }
    }, []);

    // 커서/선택 변경 시 Bold·Italic 상태 동기화
    useEffect(() => {
        const updateFormatState = () => {
            if (document.activeElement !== editorRef.current) return;
            setIsBold(document.queryCommandState('bold'));
            setIsItalic(document.queryCommandState('italic'));
        };
        document.addEventListener('selectionchange', updateFormatState);
        return () => document.removeEventListener('selectionchange', updateFormatState);
    }, []);

    // 외부 클릭 시 색상 팔레트 닫기 (showColorPicker=true일 때만 리스너 등록)
    useEffect(() => {
        if (!showColorPicker) return;
        const handleClickOutside = () => {
            setShowColorPicker(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showColorPicker]);

    const handleInput = useCallback(() => {
        if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            lastValueRef.current = html;
            onChange(html);
        }
    }, [onChange]);

    const execCommand = useCallback((command: string, val?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, val);
        handleInput();
    }, [handleInput]);

    const toggleBold = () => execCommand('bold');
    const toggleItalic = () => execCommand('italic');
    const setColor = (color: string) => {
        execCommand('foreColor', color);
        setShowColorPicker(false);
        // 색상 적용 후 선택 해제
        window.getSelection()?.removeAllRanges();
    };

    const minHeight = rows * 24;

    return (
        <div
            className={`rounded-lg border border-gray-200 bg-gray-50/50 overflow-hidden transition-all focus-within:border-[var(--forcs-blue)] focus-within:ring-1 focus-within:ring-[var(--forcs-blue)] focus-within:bg-white ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
            onFocus={(e) => e.stopPropagation()}
        >
            {/* Compact Toolbar */}
            <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-gray-100 bg-gray-50">
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={toggleBold}
                    className={`p-1 rounded transition-colors ${isBold ? 'bg-gray-200 text-gray-900' : 'hover:bg-gray-200 text-gray-600'}`}
                    title="굵게"
                >
                    <span className="font-bold text-xs">B</span>
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={toggleItalic}
                    className={`p-1 rounded transition-colors ${isItalic ? 'bg-gray-200 text-gray-900' : 'hover:bg-gray-200 text-gray-600'}`}
                    title="기울임"
                >
                    <span className="italic text-xs">I</span>
                </button>

                {/* Color picker - click based */}
                <div className="relative">
                    <button
                        type="button"
                        className="p-1 rounded hover:bg-gray-200 transition-colors flex items-center gap-0.5"
                        title="색상"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowColorPicker(!showColorPicker);
                        }}
                    >
                        <span className="text-xs text-gray-600">A</span>
                        <div className="w-2.5 h-0.5 bg-gradient-to-r from-red-500 via-blue-500 to-green-500 rounded-full" />
                    </button>
                    {showColorPicker && (
                        <div
                            className="absolute left-0 top-full mt-1 p-1 bg-white rounded-lg shadow-lg border border-gray-200 flex gap-0.5 z-10"
                            onClick={e => e.stopPropagation()}
                        >
                            {COLORS.map(c => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setColor(c.value)}
                                    className="w-4 h-4 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: c.value }}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div
                ref={editorRef}
                contentEditable={!disabled}
                className="px-2 py-1.5 text-sm outline-none overflow-y-auto cursor-text"
                style={{ minHeight }}
                onInput={handleInput}
                onMouseDown={(e) => {
                    // 클릭 좌표 저장 — focus 후 해당 위치로 커서 복원
                    clickPos.current = { x: e.clientX, y: e.clientY };
                }}
                onFocus={() => {
                    // 부모 리렌더 후 클릭 좌표 기반으로 커서 복원
                    requestAnimationFrame(restoreCursorFromPoint);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        document.execCommand('insertLineBreak');
                        handleInput();
                    }
                }}
                onBlur={() => {
                    handleInput();
                    // 에디터 내부 selection만 해제 (전역 selection에 영향 안 줌)
                    const sel = window.getSelection();
                    if (sel && editorRef.current?.contains(sel.anchorNode)) {
                        sel.removeAllRanges();
                    }
                }}
                data-placeholder={placeholder}
                suppressContentEditableWarning
            />
        </div>
    );
};
