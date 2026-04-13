import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { QuoteMeta } from '../../types';
import { buildQuoteNo, formatSequence } from '../../hooks/useQuote';
import { parseNum } from '../../utils/helpers';
import { DEFAULT_REFERENCE_NOTES } from '../../constants';

interface BasicInfoEditorProps {
    meta: QuoteMeta;
    setMeta: React.Dispatch<React.SetStateAction<QuoteMeta>>;
    isEditing: boolean;
}

export const BasicInfoEditor: React.FC<BasicInfoEditorProps> = ({ meta, setMeta, isEditing }) => {
    // Drag and drop sensors for reference notes
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleNoteDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const notes = meta.referenceNotes || [];
        const oldIndex = notes.findIndex((_, i) => `note-${i}` === active.id);
        const newIndex = notes.findIndex((_, i) => `note-${i}` === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const reorderedNotes = arrayMove(notes, oldIndex, newIndex);
            setMeta(m => ({ ...m, referenceNotes: reorderedNotes }));
        }
    };

    const applyMetaPatch = useCallback(
        (patch: Partial<QuoteMeta>) => {
            setMeta(prev => {
                const next = { ...prev, ...patch };
                if (
                    Object.prototype.hasOwnProperty.call(patch, 'contactInitials') ||
                    Object.prototype.hasOwnProperty.call(patch, 'issueSequence') ||
                    Object.prototype.hasOwnProperty.call(patch, 'quoteDate')
                ) {
                    next.quoteNo = buildQuoteNo(
                        next.contactInitials ?? '',
                        next.quoteDate ?? '',
                        next.issueSequence ?? ''
                    );
                }
                return next;
            });
        },
        [setMeta]
    );

    const handleInitialsChange = useCallback(
        (value: string) => {
            // Check for non-English characters before filtering
            const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value);
            const hasNumber = /[0-9]/.test(value);
            const hasOtherInvalid = /[^A-Za-z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value);

            if (hasNumber) {
                toast.warning('숫자는 입력할 수 없습니다. 영문 대문자만 가능합니다.', { id: 'initials-warning' });
            } else if (hasKorean || hasOtherInvalid) {
                toast.warning('영문 대문자만 입력 가능합니다.', { id: 'initials-warning' });
            }

            applyMetaPatch({ contactInitials: value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) });
        },
        [applyMetaPatch]
    );

    const handleSequenceChange = useCallback(
        (value: string) => {
            // Only keep digits, but don't auto-format to '01' on empty
            const digitsOnly = value.replace(/\D/g, '');
            applyMetaPatch({ issueSequence: digitsOnly });
        },
        [applyMetaPatch]
    );

    const handleSequenceBlur = useCallback(() => {
        // On blur, sanitize digits without forcing padding
        const formatted = formatSequence(meta.issueSequence);
        if (formatted !== meta.issueSequence) {
            applyMetaPatch({ issueSequence: formatted });
        }
    }, [meta.issueSequence, applyMetaPatch]);

    return (
        <div className="space-y-8">
            {/* Section 1: Quote Information */}
            <section className="card space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">견적 정보</h2>
                </div>

                <fieldset disabled={!isEditing} className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
                    <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            견적 일자
                        </label>
                        <input
                            type="date"
                            className="input-field w-full bg-gray-50/50"
                            value={meta.quoteDate}
                            onChange={e => applyMetaPatch({ quoteDate: e.target.value })}
                        />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        {meta.quoteDate && meta.validityDays > 0 && (
                            <div className="bg-teal-50/50 border border-teal-200 rounded-lg px-4 py-3">
                                <p className="text-xs text-gray-600 mb-1 font-medium">유효 기간</p>
                                <p className="text-sm text-[#00a99d] font-bold flex items-center gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    30일 (만료: {new Date(new Date(meta.quoteDate).setDate(new Date(meta.quoteDate).getDate() + meta.validityDays)).toLocaleDateString()})
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            담당자 이니셜
                        </label>
                        <input
                            type="text"
                            className="input-field w-full uppercase placeholder:normal-case bg-gray-50/50"
                            value={meta.contactInitials}
                            onChange={e => handleInitialsChange(e.target.value)}
                            placeholder="예: KD (영문 2~4자)"
                            maxLength={4}
                        />
                        <p className="mt-1.5 text-[11px] text-gray-400 font-medium">견적 번호 생성에 사용됩니다.</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            발행 순번
                        </label>
                        <input
                            type="text"
                            className="input-field w-full bg-gray-50/50"
                            value={meta.issueSequence}
                            onChange={e => handleSequenceChange(e.target.value)}
                        />
                    </div>
                </fieldset>
            </section>

            {/* Section 2: Customer Information */}
            <section className="card space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 shadow-sm">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">고객사</h2>
                </div>

                <fieldset disabled={!isEditing} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            고객사명
                        </label>
                        <input
                            type="text"
                            className="input-field w-full bg-gray-50/50"
                            value={meta.customerName}
                            onChange={e => setMeta(m => ({ ...m, customerName: e.target.value }))}
                            placeholder="예: (주)포시에스"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            고객사 담당자 이름
                        </label>
                        <input
                            type="text"
                            className="input-field w-full bg-gray-50/50"
                            value={meta.customerManager}
                            onChange={e => setMeta(m => ({ ...m, customerManager: e.target.value }))}
                            placeholder="예: 홍길동 팀장"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            고객사 이메일
                        </label>
                        <input
                            type="text"
                            className="input-field w-full bg-gray-50/50"
                            value={meta.customerEmail || ''}
                            onChange={e => setMeta(m => ({ ...m, customerEmail: e.target.value }))}
                            placeholder="email@example.com"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            고객사 연락처
                        </label>
                        <input
                            type="text"
                            className="input-field w-full bg-gray-50/50"
                            value={meta.customerContact || ''}
                            onChange={e => setMeta(m => ({ ...m, customerContact: e.target.value }))}
                            placeholder="010-0000-0000"
                        />
                    </div>
                </fieldset>
            </section>

            {/* Section 3: Manager Information */}
            <section className="card space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600 shadow-sm">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">영업 담당자 정보</h2>
                </div>

                <fieldset disabled={!isEditing} className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
                    <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            영업 담당자 이름
                        </label>
                        <input
                            type="text"
                            className="input-field w-full bg-gray-50/50"
                            value={meta.contactName}
                            onChange={e => setMeta(m => ({ ...m, contactName: e.target.value }))}
                            placeholder="이름 입력"
                        />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            직책
                        </label>
                        <input
                            type="text"
                            className="input-field w-full bg-gray-50/50"
                            value={meta.contactTitle || ''}
                            onChange={e => setMeta(m => ({ ...m, contactTitle: e.target.value }))}
                            placeholder="예: 프로, 파트리더, 팀장"
                        />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            이메일
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                className="input-field flex-1 bg-gray-50/50"
                                value={meta.contactEmail.replace(/@forcs\.com$/, '')}
                                onChange={e => {
                                    const localPart = e.target.value.replace(/@.*$/, '');
                                    setMeta(m => ({ ...m, contactEmail: localPart + '@forcs.com' }));
                                }}
                                placeholder="example"
                            />
                            <span className="text-sm font-medium text-gray-500">@forcs.com</span>
                        </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            휴대전화
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-500">010-</span>
                            <input
                                type="tel"
                                className="input-field flex-1 bg-gray-50/50"
                                value={meta.contactMobile.replace(/^010-/, '')}
                                onChange={e => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                                    let formatted = digits;
                                    if (digits.length > 4) {
                                        formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
                                    }
                                    setMeta(m => ({ ...m, contactMobile: '010-' + formatted }));
                                }}
                                placeholder="0000-0000"
                            />
                        </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            직통 번호
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-500">02-6188-</span>
                            <input
                                type="tel"
                                className="input-field flex-1 bg-gray-50/50"
                                value={meta.contactDirect.replace(/^02-6188-/, '')}
                                onChange={e => {
                                    const rest = e.target.value.replace(/^02-6188-/, '');
                                    setMeta(m => ({ ...m, contactDirect: '02-6188-' + rest }));
                                }}
                                placeholder="0000"
                            />
                        </div>
                    </div>
                </fieldset>
            </section>

            {/* Section 4: Reference Notes */}
            <section className="card space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shadow-sm">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">견적 참조 사항</h2>
                </div>

                <fieldset disabled={!isEditing} className="space-y-3">
                    <DndContext sensors={isEditing ? sensors : undefined} collisionDetection={closestCenter} onDragEnd={handleNoteDragEnd}>
                        <SortableContext items={(meta.referenceNotes || []).map((_, i) => `note-${i}`)} strategy={verticalListSortingStrategy}>
                            {meta.referenceNotes?.map((note, index) => (
                                <SortableNoteItem
                                    key={`note-${index}`}
                                    id={`note-${index}`}
                                    note={note}
                                    index={index}
                                    customerName={meta.customerName}
                                    onUpdate={(newValue) => {
                                        const newNotes = [...(meta.referenceNotes || [])];
                                        newNotes[index] = newValue;
                                        setMeta(m => ({ ...m, referenceNotes: newNotes }));
                                    }}
                                    onRemove={() => {
                                        const newNotes = (meta.referenceNotes || []).filter((_, i) => i !== index);
                                        setMeta(m => ({ ...m, referenceNotes: newNotes }));
                                    }}
                                    isEditing={isEditing}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>

                    <div className="flex gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => {
                                const newNotes = [...(meta.referenceNotes || []), ''];
                                setMeta(m => ({ ...m, referenceNotes: newNotes }));
                            }}
                            className="flex-1 py-2.5 px-4 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            새 항목 추가
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                // localStorage에서 저장된 커스텀 기본값이 있으면 사용, 없으면 DEFAULT_REFERENCE_NOTES 사용
                                const savedNotes = localStorage.getItem('eformsign_custom_reference_notes');
                                const notesToLoad = savedNotes ? JSON.parse(savedNotes) : [...DEFAULT_REFERENCE_NOTES];
                                setMeta(m => ({ ...m, referenceNotes: notesToLoad }));
                            }}
                            className="py-2.5 px-4 bg-purple-50 border border-purple-200 rounded-xl text-sm font-medium text-purple-600 hover:bg-purple-100 hover:border-purple-300 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            기본값 불러오기
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                // 현재 참조 사항을 localStorage에 저장
                                const notesToSave = meta.referenceNotes || [];
                                localStorage.setItem('eformsign_custom_reference_notes', JSON.stringify(notesToSave));
                                alert('현재 참조 사항이 기본값으로 저장되었습니다.');
                            }}
                            className="py-2.5 px-4 bg-green-50 border border-green-200 rounded-xl text-sm font-medium text-green-600 hover:bg-green-100 hover:border-green-300 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                <polyline points="17 21 17 13 7 13 7 21" />
                                <polyline points="7 3 7 8 15 8" />
                            </svg>
                            기본값으로 저장
                        </button>
                    </div>
                </fieldset>
            </section>

            {/* Section 5: Document Links */}
            <section className="card space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 shadow-sm">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">첨부 문서 링크</h2>
                </div>

                <div className="space-y-4">
                    {/* 사업자등록증 링크 */}
                    <LinkEditRow
                        label="📋 사업자등록증"
                        value={meta.bizNoLink || ''}
                        onChange={(val) => setMeta(m => ({ ...m, bizNoLink: val }))}
                        isEditing={isEditing}
                    />
                    {/* 통장사본 링크 */}
                    <LinkEditRow
                        label="🏦 통장사본"
                        value={meta.bankAccountLink || ''}
                        onChange={(val) => setMeta(m => ({ ...m, bankAccountLink: val }))}
                        isEditing={isEditing}
                    />
                </div>
            </section>

            <div className="rounded-xl bg-gray-50 p-4 text-xs text-gray-500 border border-gray-100">
                <p className="font-semibold mb-1">💡 참고</p>
                <p>공급사 기본 정보(상호, 대표자, 사업자번호, 주소 등)는 eformsign 표준 값이 자동으로 적용됩니다.</p>
            </div>
        </div>
    );
};

// Sortable Note Item Component
interface SortableNoteItemProps {
    id: string;
    note: string;
    index: number;
    customerName: string;
    onUpdate: (value: string) => void;
    onRemove: () => void;
    isEditing: boolean;
}

const SortableNoteItem: React.FC<SortableNoteItemProps> = ({
    id,
    note,
    index,
    customerName,
    onUpdate,
    onRemove,
    isEditing
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
    };

    // {customerName} 또는 {고객사명} 플레이스홀더를 동적으로 치환
    const displayValue = note
        .replace('{customerName}', customerName || '고객사')
        .replace('{고객사명}', customerName || '고객사');

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex gap-0 items-stretch rounded-xl border transition-all ${isDragging ? 'shadow-xl ring-2 ring-blue-400 bg-white rotate-1 scale-[1.02]' : 'border-gray-100 hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5'}`}
        >
            {/* Drag Handle - Always visible with left background */}
            <div
                {...attributes}
                {...listeners}
                className={`flex items-center justify-center px-2.5 bg-gradient-to-r from-gray-50 to-transparent cursor-grab active:cursor-grabbing rounded-l-xl transition-colors ${isEditing ? 'hover:from-blue-50' : 'hidden'}`}
                title="드래그하여 순서 변경"
            >
                <div className={`flex flex-col items-center gap-0.5 transition-colors ${isDragging ? 'text-blue-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="5" r="2" />
                        <circle cx="9" cy="12" r="2" />
                        <circle cx="9" cy="19" r="2" />
                        <circle cx="15" cy="5" r="2" />
                        <circle cx="15" cy="12" r="2" />
                        <circle cx="15" cy="19" r="2" />
                    </svg>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-1 p-2">
                <span className="text-blue-500 text-sm font-bold min-w-[24px]">{index + 1}.</span>
                <textarea
                    className="input-field flex-1 bg-gray-50/50 text-sm resize-none"
                    rows={2}
                    value={displayValue}
                    onChange={e => onUpdate(e.target.value)}
                    placeholder="참조 사항 입력..."
                />
                <button
                    type="button"
                    onClick={onRemove}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

// Link Edit Row Component - 링크 표시 + 수정 버튼
interface LinkEditRowProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    isEditing: boolean;
}

const LinkEditRow: React.FC<LinkEditRowProps> = ({ label, value, onChange, isEditing }) => {
    const [isEditMode, setIsEditMode] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    const handleSave = () => {
        onChange(tempValue);
        setIsEditMode(false);
    };

    const handleCancel = () => {
        setTempValue(value);
        setIsEditMode(false);
    };

    const truncateUrl = (url: string, maxLength: number = 50) => {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength) + '...';
    };

    return (
        <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700">{label}</span>
                {isEditing && !isEditMode && (
                    <button
                        type="button"
                        onClick={() => {
                            setTempValue(value);
                            setIsEditMode(true);
                        }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        수정
                    </button>
                )}
            </div>

            {isEditMode ? (
                <div className="space-y-2">
                    <input
                        type="url"
                        className="input-field w-full bg-white text-sm"
                        value={tempValue}
                        onChange={e => setTempValue(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                            저장
                        </button>
                    </div>
                </div>
            ) : (
                <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:text-blue-600 hover:underline break-all"
                    title={value}
                >
                    {truncateUrl(value)}
                </a>
            )}
        </div>
    );
};
