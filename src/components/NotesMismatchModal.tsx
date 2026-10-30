import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MismatchedNote, PlanType } from '../utils/planType';
import { otherPlanLabel, PLAN_TYPE_LABEL } from '../utils/planType';

interface NotesMismatchModalProps {
    isOpen: boolean;
    planType: PlanType;
    mismatches: MismatchedNote[];
    /** 참고사항 편집 칸으로 이동한다 (저장하지 않음) */
    onFix: () => void;
    /** 그대로 저장을 이어 간다 */
    onSaveAnyway: () => void;
    /** Esc·바깥 클릭: 저장하지 않고 닫는다 */
    onClose: () => void;
}

const firstLine = (text: string) => text.split('\n')[0];

/** PDF·PNG 저장 직전, 참고사항이 요금제와 맞지 않을 때 한 번 묻는다. 저장을 막지 않는다. */
export const NotesMismatchModal: React.FC<NotesMismatchModalProps> = ({
    isOpen,
    planType,
    mismatches,
    onFix,
    onSaveAnyway,
    onClose,
}) => {
    const fixRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        fixRef.current?.focus();
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen || planType === 'none' || planType === 'mixed') return null;

    const own = PLAN_TYPE_LABEL[planType];
    const other = otherPlanLabel(planType);

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onMouseDown={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="notes-kr w-full max-w-[520px] rounded-2xl bg-white p-7 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="notes-mismatch-title"
                data-testid="notes-mismatch-modal"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <h3 id="notes-mismatch-title" className="text-[19px] font-extrabold tracking-tight text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                        참고사항을 확인해 주세요
                    </h3>
                </div>
                <p className="mt-3.5 text-sm leading-relaxed text-gray-700" style={{ textWrap: 'pretty' }}>
                    이 견적은 {own} 품목으로 되어 있는데, 참고사항에 {other} 문장 {mismatches.length}개가 남아 있습니다.
                </p>
                <ul className="mt-3 flex list-none flex-col gap-1.5 p-0">
                    {mismatches.map(m => (
                        <li
                            key={m.index}
                            className="rounded-lg border border-amber-200 border-l-4 border-l-amber-400 bg-amber-50 px-3 py-2 text-[13.5px] leading-normal text-amber-900"
                        >
                            <b className="font-bold">{m.index + 1}번</b> {firstLine(m.text)}
                        </li>
                    ))}
                </ul>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn-secondary" onClick={onSaveAnyway}>
                        그대로 저장
                    </button>
                    <button ref={fixRef} type="button" className="btn-primary" onClick={onFix}>
                        참고사항 고치기
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
