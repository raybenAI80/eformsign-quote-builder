import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { QuoteItem } from '../../types';
import { clamp, parseNum } from '../../utils/helpers';
import { RichTextEditor } from '../RichTextEditor';

export interface SortableItemRowProps {
    item: QuoteItem;
    index: number;
    categoryLabels: { section: string; label: string }[];
    onUpdate: (patch: Partial<QuoteItem>) => void;
    onRemove: () => void;
    onFocus: () => void;
    isFocused: boolean;
}

export const SortableItemRow: React.FC<SortableItemRowProps> = ({
    item,
    index,
    categoryLabels,
    onUpdate,
    onRemove,
    onFocus,
    isFocused,
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

    // 섹션별 배경색 정의
    const sectionBgColors: Record<string, string> = {
        SaaS: 'bg-blue-50/50',
        Credit: 'bg-purple-50/50',
        Service: 'bg-teal-50/50',
        Option: 'bg-amber-50/50',
    };
    const sectionBg = sectionBgColors[item.section] || 'bg-white';

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
    };

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`group relative flex rounded-xl border ${sectionBg} shadow-sm transition-all duration-200 overflow-hidden ${isDragging ? 'shadow-xl ring-2 ring-[var(--forcs-blue)] rotate-1 scale-[1.02] z-50' : 'hover:border-[var(--forcs-blue-light)] hover:shadow-md hover:-translate-y-0.5'
                } ${isFocused ? 'ring-1 ring-[var(--forcs-blue)] border-[var(--forcs-blue)]' : 'border-[var(--forcs-border)]'}`}
            onClick={onFocus}
        >
            {/* Drag Handle - Always visible with left background */}
            <div
                {...attributes}
                {...listeners}
                className={`flex items-center justify-center px-2.5 bg-gradient-to-r from-gray-100 to-transparent cursor-grab active:cursor-grabbing rounded-l-xl transition-colors hover:from-blue-50 ${isDragging ? 'from-blue-100' : ''}`}
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

            <div className="flex-1 p-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
                {/* Row 1: Type & Name */}
                <div className="sm:col-span-12 flex gap-2">
                    <div className="relative">
                        <select
                            className="h-9 appearance-none rounded-lg border border-gray-200 bg-gray-50 pl-3 pr-8 text-xs font-medium outline-none focus:border-[var(--forcs-blue)] focus:ring-1 focus:ring-[var(--forcs-blue)] transition-all cursor-pointer hover:bg-gray-100"
                            value={item.section}
                            onChange={e => onUpdate({ section: e.target.value as QuoteItem['section'] })}
                        >
                            {categoryLabels.map(cat => (
                                <option key={cat.section} value={cat.section}>{cat.label}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </div>
                    </div>
                    <input
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium outline-none focus:border-[var(--forcs-blue)] focus:ring-1 focus:ring-[var(--forcs-blue)] transition-all placeholder:text-gray-300"
                        value={item.item}
                        onChange={e => onUpdate({ item: e.target.value })}
                        placeholder="항목명을 입력"
                    />
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                        title="삭제"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Row 2: Qty, Price, Discount in one row */}
                <div className="sm:col-span-12 grid grid-cols-3 sm:grid-cols-6 gap-3">
                    <label className="block group/field">
                        <span className="mb-1 block text-[10px] font-medium text-gray-400 transition-colors group-focus-within/field:text-[var(--forcs-blue)]">
                            수량
                        </span>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-right text-sm outline-none transition-all bg-gray-50/50 focus:border-[var(--forcs-blue)] focus:ring-1 focus:ring-[var(--forcs-blue)] focus:bg-white"
                            value={item.qty > 0 ? String(item.qty) : ''}
                            onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                let newQty = val ? parseInt(val, 10) : 0;
                                const patch: Partial<QuoteItem> = { qty: newQty };
                                // 충전형 문서: 수량별 자동 단가 조정 + 최대 3,000건 제한
                                if (item.category === '문서 충전') {
                                    if (newQty > 3000) {
                                        newQty = 3000;
                                        patch.qty = 3000;
                                    }
                                    patch.unitPrice = newQty <= 10 ? 1000 : 800;
                                }
                                onUpdate(patch);
                            }}
                            placeholder="0"
                        />
                    </label>
                    <label className="block group/field">
                        <span className="mb-1 block text-[10px] font-medium text-gray-400 transition-colors group-focus-within/field:text-[var(--forcs-blue)]">
                            단가
                        </span>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-right text-sm outline-none transition-all bg-gray-50/50 focus:border-[var(--forcs-blue)] focus:ring-1 focus:ring-[var(--forcs-blue)] focus:bg-white"
                            value={typeof item.unitPrice === 'string' && isNaN(Number(item.unitPrice)) ? item.unitPrice : (item.unitPrice ? Number(item.unitPrice).toLocaleString() : '')}
                            onChange={e => {
                                const raw = e.target.value;
                                const numOnly = raw.replace(/[^0-9]/g, '');
                                // If the input is purely numeric (or empty), store as number
                                if (raw === '' || raw === numOnly || raw === Number(numOnly).toLocaleString()) {
                                    onUpdate({ unitPrice: numOnly ? parseInt(numOnly, 10) : 0 });
                                } else {
                                    // Text/symbol input — store as string
                                    onUpdate({ unitPrice: raw });
                                }
                            }}
                            placeholder="0"
                        />
                        {item.discountPct > 0 && typeof item.unitPrice === 'number' && item.unitPrice > 0 && (
                            <span className="mt-0.5 block text-[10px] text-red-500 text-right">
                                ↳ 할인가 {Math.round(item.unitPrice * (1 - item.discountPct / 100)).toLocaleString()}원
                            </span>
                        )}
                    </label>
                    <label className="block group/field sm:col-span-4">
                        <span className="mb-1 block text-[10px] font-medium text-gray-400 transition-colors group-focus-within/field:text-[var(--forcs-blue)]">
                            할인(%)
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                className="flex-1 min-w-[80px] accent-[var(--forcs-blue)]"
                                value={item.discountPct ?? 0}
                                onChange={e => onUpdate({ discountPct: parseNum(e.target.value) })}
                            />
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    min={0}
                                    max={100}
                                    className="w-10 rounded border border-gray-200 px-1 py-1 text-right text-sm font-semibold outline-none focus:border-[var(--forcs-blue)] focus:ring-1 focus:ring-[var(--forcs-blue)]"
                                    value={item.discountPct != null && item.discountPct > 0 ? String(item.discountPct) : ''}
                                    onChange={e => {
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        const num = val ? parseInt(val, 10) : 0;
                                        onUpdate({ discountPct: clamp(num, 0, 100) });
                                    }}
                                    placeholder="0"
                                />
                                <span className="text-xs font-semibold text-gray-500">%</span>
                                <div className="flex gap-0.5 ml-1">
                                    {[30, 60, 100].map(v => (
                                        <button
                                            key={v}
                                            type="button"
                                            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition shrink-0 ${item.discountPct === v
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-500 hover:text-blue-500'
                                                }`}
                                            onClick={() => onUpdate({ discountPct: v })}
                                        >
                                            {v}%
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </label>
                </div>

                {/* Row 3: Notes - Full Width */}
                <div className="sm:col-span-12">
                    <label className="block group/field">
                        <span className="mb-1 block text-[10px] font-medium text-gray-400 transition-colors group-focus-within/field:text-[var(--forcs-blue)]">
                            비고
                        </span>
                        <RichTextEditor
                            value={item.note || item.notes || ''}
                            onChange={(html) => onUpdate({ notes: html })}
                            placeholder="비고를 입력해 주세요"
                            rows={2}
                        />
                    </label>
                </div>
            </div>
        </motion.div>
    );
};
