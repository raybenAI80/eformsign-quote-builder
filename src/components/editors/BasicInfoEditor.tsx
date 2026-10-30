import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { QuoteItem, QuoteMeta } from '../../types';
import { buildQuoteNo, formatSequence, addValidityEndLocal, parseLocalDate } from '../../hooks/useQuote';
import { parseNum } from '../../utils/helpers';
import {
    PLAN_TYPE_LABEL,
    detectPlanType,
    findMismatchedNotes,
    otherPlanLabel,
    planBadgeLabel,
    type PlanType,
} from '../../utils/planType';
import {
    builtInNotes,
    notesForType,
    sameNotes,
    writeCustomNotes,
    type NoteSetType,
} from '../../utils/referenceNoteSets';
import {
    CUSTOMER_NAME_PLACEHOLDER,
    hasCustomerPlaceholder,
    renderReferenceNote,
    restoreCustomerPlaceholders,
    toEditableReferenceNote,
} from '../../utils/referenceNotes';

interface BasicInfoEditorProps {
    meta: QuoteMeta;
    /** 품목 기준 요금제(충전형·구독형) 판정에만 쓴다 */
    items: QuoteItem[];
    setMeta: React.Dispatch<React.SetStateAction<QuoteMeta>>;
    isEditing: boolean;
}

export const BasicInfoEditor: React.FC<BasicInfoEditorProps> = ({ meta, items, setMeta, isEditing }) => {
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

    // ---- 참고사항: 요금제(충전형·구독형) 안내 ----
    const planType: PlanType = useMemo(() => detectPlanType(items), [items]);
    const badgeLabel = useMemo(() => planBadgeLabel(items), [items]);
    const notes = useMemo(() => meta.referenceNotes ?? [], [meta.referenceNotes]);
    const mismatches = useMemo(() => findMismatchedNotes(notes, planType), [notes, planType]);
    const mismatchIndexes = useMemo(() => new Set(mismatches.map(m => m.index)), [mismatches]);
    // 「이대로 둠」: 이 화면에서만 기억한다. 참고사항이나 요금제 품목이 바뀌면 키가 달라져 경고가 다시 보인다.
    const planItemCount = useMemo(
        () => items.filter(i => i.category === '문서 충전' || i.category === '구독형').length,
        [items]
    );
    const warnKey = `${planType}|${planItemCount}|${JSON.stringify(notes)}`;
    const [dismissedKey, setDismissedKey] = useState<string | null>(null);
    const showWarning = mismatches.length > 0 && dismissedKey !== warnKey;
    // 문구나 품목이 한 번이라도 바뀌면 「이대로 둠」을 풀어, 나중에 같은 상태로 돌아와도 경고가 다시 보이게 한다
    useEffect(() => {
        if (dismissedKey !== null && dismissedKey !== warnKey) setDismissedKey(null);
    }, [dismissedKey, warnKey]);
    const [saveChoiceOpen, setSaveChoiceOpen] = useState(false);
    const saveChoiceRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!saveChoiceOpen) return;
        const close = (e: MouseEvent) => {
            if (!saveChoiceRef.current?.contains(e.target as Node)) setSaveChoiceOpen(false);
        };
        const esc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSaveChoiceOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', esc);
        };
    }, [saveChoiceOpen]);

    /** 그 요금제의 문구로 참고사항 전체를 바꾼다. 지금 문구와 다르면 먼저 확인한다. */
    const loadNotesOfType = (type: NoteSetType, skipConfirmWhenPristineOther = false) => {
        const set = notesForType(type);
        const target = restoreCustomerPlaceholders(set, meta.customerName) ?? set;
        if (sameNotes(notes, target)) return;
        const otherType: NoteSetType = type === 'prepaid' ? 'subscription' : 'prepaid';
        // 경고 상자의 「바꾸기」: 사용자가 고치지 않은 다른 요금제 문구 그대로이면 잃을 것이 없으므로 묻지 않는다.
        const pristineOther =
            skipConfirmWhenPristineOther &&
            (sameNotes(notes, notesForType(otherType)) || sameNotes(notes, builtInNotes(otherType)));
        if (!pristineOther) {
            const label = PLAN_TYPE_LABEL[type];
            if (!window.confirm(`현재 참고사항 ${notes.length}줄이 모두 ${label} 문구로 바뀝니다. 계속할까요?`)) return;
        }
        setMeta(m => ({ ...m, referenceNotes: target }));
    };

    const saveNotesAsDefault = (type: NoteSetType) => {
        setSaveChoiceOpen(false);
        if (writeCustomNotes(type, notes)) {
            toast.success(`현재 참고사항을 ${PLAN_TYPE_LABEL[type]} 기본값으로 저장했습니다.`);
        } else {
            toast.error('이 브라우저에서는 기본값을 저장할 수 없습니다.');
        }
    };

    // 현재 sector 배지 정보
    const sector = meta.sector ?? 'general';
    const sectorBadge = {
        general: { label: '일반 기업용', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', dot: 'bg-blue-500' },
        public: { label: '정부·공공기관용', bg: 'bg-gray-100', text: 'text-gray-700', ring: 'ring-gray-300', dot: 'bg-gray-500' },
        subsidy: { label: '지원사업용', bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-200', dot: 'bg-green-500' },
    }[sector];
    const subsidyRatePct = Math.max(0, Math.min(100, Number(meta.subsidyRate ?? 0)));

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

                    {/* 현재 sector 배지 (모드 변경은 '항목' 탭에서) */}
                    <div
                        className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${sectorBadge.bg} ${sectorBadge.text} ring-1 ${sectorBadge.ring}`}
                        title="모드는 '항목' 탭의 상단에서 변경할 수 있습니다"
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${sectorBadge.dot}`}></span>
                        <span>{sectorBadge.label}</span>
                        {sector === 'subsidy' && subsidyRatePct > 0 && (
                            <span className="font-black">· 지원율 {subsidyRatePct}%</span>
                        )}
                    </div>
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
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            견적 기한
                        </label>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                                {[1, 2, 3, 6].map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => applyMetaPatch({ validityMonths: m })}
                                        className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                                            (meta.validityMonths ?? 1) === m
                                                ? 'bg-[var(--forcs-blue)] text-white border-[var(--forcs-blue)]'
                                                : 'bg-white text-gray-500 border-gray-200 hover:border-[var(--forcs-blue)] hover:text-[var(--forcs-blue)]'
                                        }`}
                                    >
                                        {m}개월
                                    </button>
                                ))}
                            </div>
                        </div>
                        {meta.quoteDate && (
                            <p className="mt-1.5 text-[11px] text-[#00a99d] font-medium">
                                만료: {parseLocalDate(addValidityEndLocal(meta.quoteDate, meta.validityMonths ?? 1)).toLocaleDateString()}
                            </p>
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
            <section id="reference-notes-card" tabIndex={-1} className="card space-y-5 outline-none">
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

                {planType !== 'none' && (
                    <div>
                        <span
                            data-testid="plan-type-badge"
                            className={`notes-kr inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                                planType === 'subscription'
                                    ? 'bg-blue-50 text-blue-700 ring-blue-200'
                                    : planType === 'prepaid'
                                      ? 'bg-teal-50 text-teal-700 ring-teal-200'
                                      : 'bg-gray-100 text-gray-700 ring-gray-300'
                            }`}
                        >
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                    planType === 'subscription' ? 'bg-blue-500' : planType === 'prepaid' ? 'bg-teal-500' : 'bg-gray-500'
                                }`}
                            />
                            품목 기준 요금제: {badgeLabel}
                        </span>
                    </div>
                )}

                {showWarning && planType !== 'none' && planType !== 'mixed' && (
                    <div
                        role="alert"
                        data-testid="notes-mismatch-warning"
                        className="notes-kr flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
                    >
                        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-700">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-[15px] font-extrabold text-amber-900" style={{ fontFamily: 'var(--font-heading)' }}>
                                참고사항이 요금제와 맞지 않습니다
                            </h3>
                            <p className="mt-0.5 text-[13px] text-amber-800">
                                {PLAN_TYPE_LABEL[planType]} 품목이 있는데 {otherPlanLabel(planType)} 문장이 남아 있습니다.
                            </p>
                            <ul className="mt-2.5 flex list-none flex-col gap-1.5 p-0">
                                {mismatches.map(m => (
                                    <li
                                        key={m.index}
                                        className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[13px] text-amber-900"
                                    >
                                        <b className="font-bold">{m.index + 1}번</b> {m.text.split('\n')[0]}
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    className="btn-primary"
                                    disabled={!isEditing}
                                    onClick={() => loadNotesOfType(planType === 'subscription' ? 'subscription' : 'prepaid', true)}
                                >
                                    {PLAN_TYPE_LABEL[planType]} 문구로 바꾸기
                                </button>
                                <button
                                    type="button"
                                    className="rounded-full px-3 py-2.5 text-sm font-semibold text-gray-500 underline decoration-gray-300 underline-offset-4 hover:text-gray-700"
                                    onClick={() => setDismissedKey(warnKey)}
                                >
                                    이대로 둠
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {planType === 'mixed' && (
                    <div
                        role="status"
                        data-testid="notes-mixed-info"
                        className="notes-kr flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4"
                    >
                        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-relaxed text-blue-900">
                                충전형과 구독형 품목이 함께 있습니다. 자동 판단을 하지 않으니 참고사항을 직접 확인해 주세요.
                            </p>
                            <div className="mt-2.5 flex flex-wrap gap-2">
                                <button type="button" disabled={!isEditing} onClick={() => loadNotesOfType('prepaid')} className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-100">
                                    충전형 문구 불러오기
                                </button>
                                <button type="button" disabled={!isEditing} onClick={() => loadNotesOfType('subscription')} className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-100">
                                    구독형 문구 불러오기
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                                    flag={mismatchIndexes.has(index) ? `${otherPlanLabel(planType)} 문구입니다` : undefined}
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
                            className="flex-1 whitespace-nowrap py-2.5 px-4 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            새 항목 추가
                        </button>
                        <div className="inline-flex overflow-hidden rounded-xl border border-purple-200 bg-purple-50" role="group" aria-label="요금제별 문구 불러오기">
                            <button
                                type="button"
                                onClick={() => loadNotesOfType('prepaid')}
                                className="flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-100"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                충전형 문구 불러오기
                            </button>
                            <button
                                type="button"
                                onClick={() => loadNotesOfType('subscription')}
                                className="whitespace-nowrap border-l border-purple-200 px-3.5 py-2.5 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-100"
                            >
                                구독형 문구 불러오기
                            </button>
                        </div>
                        <div className="relative" ref={saveChoiceRef}>
                            <button
                                type="button"
                                aria-haspopup="true"
                                aria-expanded={saveChoiceOpen}
                                onClick={() => setSaveChoiceOpen(o => !o)}
                                className="py-2.5 px-4 bg-green-50 border border-green-200 rounded-xl text-sm font-medium text-green-600 hover:bg-green-100 hover:border-green-300 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                기본값으로 저장
                            </button>
                            {saveChoiceOpen && (
                                <div
                                    role="menu"
                                    data-testid="save-default-choice"
                                    className="notes-kr absolute bottom-full right-0 z-20 mb-2 w-60 rounded-xl border border-gray-200 bg-white p-2 shadow-xl"
                                >
                                    <p className="px-2 pb-1.5 pt-1 text-xs text-gray-500">어느 요금제의 기본값으로 저장할까요?</p>
                                    {(['prepaid', 'subscription'] as const).map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            role="menuitem"
                                            onClick={() => saveNotesAsDefault(type)}
                                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-green-50 ${
                                                planType === type ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'text-gray-700'
                                            }`}
                                        >
                                            <span>{PLAN_TYPE_LABEL[type]} 기본값으로 저장</span>
                                            {planType === type && <span className="text-[11px] font-bold text-green-600">품목 기준</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
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
    /** 요금제와 맞지 않는 문장이면 붙이는 표시 문구 */
    flag?: string;
    onUpdate: (value: string) => void;
    onRemove: () => void;
    isEditing: boolean;
}

const SortableNoteItem: React.FC<SortableNoteItemProps> = ({
    id,
    note,
    index,
    customerName,
    flag,
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

    // The textarea edits the stored text (placeholder kept); the substituted text is
    // shown only as a hint. Editing the substituted text used to bake the customer
    // name into the note and break the link with the customer-name field.
    const editableValue = toEditableReferenceNote(note);
    const renderedValue = hasCustomerPlaceholder(note) ? renderReferenceNote(note, customerName) : null;

    return (
        <div
            ref={setNodeRef}
            style={style}
            data-note-flagged={flag ? 'true' : undefined}
            className={`group flex gap-0 items-stretch rounded-xl border transition-all ${isDragging ? 'shadow-xl ring-2 ring-blue-400 bg-white rotate-1 scale-[1.02]' : flag ? 'border-amber-200 border-l-4 border-l-amber-400 bg-amber-50' : 'border-gray-100 hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5'}`}
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
                <span className={`text-sm font-bold min-w-[24px] ${flag ? 'text-amber-700' : 'text-blue-500'}`}>{index + 1}.</span>
                <div className="flex-1 min-w-0 space-y-1">
                    <textarea
                        className={`input-field w-full text-sm resize-none ${flag ? 'bg-white border-amber-200' : 'bg-gray-50/50'}`}
                        rows={2}
                        value={editableValue}
                        onChange={e => onUpdate(e.target.value)}
                        placeholder="참조 사항 입력..."
                    />
                    {flag && (
                        <p className="notes-kr flex items-center gap-1 px-1 text-xs font-semibold text-amber-800" data-testid={`note-flag-${index}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {flag}
                        </p>
                    )}
                    {renderedValue !== null && (
                        <p className="px-1 text-xs text-gray-500 break-keep" data-testid={`note-rendered-${index}`}>
                            <span className="font-medium text-purple-600">{CUSTOMER_NAME_PLACEHOLDER}</span> → 고객사명으로 표시: {renderedValue}
                        </p>
                    )}
                </div>
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
