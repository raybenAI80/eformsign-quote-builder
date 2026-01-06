import React, { useState, useEffect } from 'react';
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
} from '@dnd-kit/sortable';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { QuoteItem, CalculationResult } from '../../types';
import { QUICK_ADD_CATALOG } from '../../constants';
import { toKRW } from '../../utils/formatters';
import { SortableItemRow } from './SortableItemRow';

interface ItemEditorProps {
  items: QuoteItem[];
  calculation: CalculationResult;
  categoryLabels: { section: string; label: string; labelEn?: string }[];
  actions: {
    setItems: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
    addManyRows: (factory: () => Omit<QuoteItem, 'id'>, n: number) => void;
    removeRow: (id: string) => void;
    updateRow: (id: string, patch: Partial<QuoteItem>) => void;
    duplicateRow: (id: string) => void;
    reorderRow: (activeId: string, overId: string) => void;
    updateCategoryLabel: (section: string, label: string, labelEn?: string) => void;
    resetCategoryLabels: () => void;
  };
  openConfirm: (title: string, message: string, onConfirm: () => void, isDestructive?: boolean) => void;
  isEditing: boolean;
}

export const ItemEditor: React.FC<ItemEditorProps> = ({
  items,
  calculation,
  categoryLabels,
  actions,
  openConfirm,
  isEditing,
}) => {
  const [repeatCount, setRepeatCount] = useState(1);
  const [lastFocusedRow, setLastFocusedRow] = useState<string | null>(null);
  const [activeSector, setActiveSector] = useState<'general' | 'public'>('general');
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const activeSensors = isEditing ? sensors : undefined;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      actions.reorderRow(active.id as string, over?.id as string);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!lastFocusedRow) return;
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        actions.duplicateRow(lastFocusedRow);
        toast.success('행이 복제되었습니다.');
      } else if (e.key === 'Delete') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        e.preventDefault();
        openConfirm('행 삭제', '선택한 행을 삭제하시겠습니까?', () => {
          actions.removeRow(lastFocusedRow);
          toast.success('행이 삭제되었습니다.');
        }, true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lastFocusedRow, actions, openConfirm]);

  // 동적 카테고리 라벨 헬퍼 함수
  const getLabelFull = (section: string): string => {
    const cat = categoryLabels.find(c => c.section === section);
    if (!cat) return section;
    return cat.labelEn ? `${cat.label} (${cat.labelEn})` : cat.label;
  };

  const getLabel = (section: string): string => {
    const cat = categoryLabels.find(c => c.section === section);
    return cat ? cat.label : section;
  };

  return (
    <div className="space-y-8 pb-20 relative">
      {/* Section Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900">항목 관리</h2>
        <span className="ml-auto text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          총 {items.length}개
        </span>
      </div>

      <fieldset disabled={!isEditing} className={!isEditing ? 'opacity-60' : ''}>
        <div className="space-y-6">
          {/* Quick Add Toolbar */}
          <div className="rounded-xl border border-[var(--forcs-border)] bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[var(--forcs-blue)]"></div>
                <h3 className="text-sm font-bold text-[var(--forcs-text)]">항목 편집</h3>
                <button
                  onClick={() => setShowCategoryEditor(true)}
                  className="ml-2 text-[10px] font-medium text-gray-400 hover:text-[var(--forcs-blue)] transition-colors flex items-center gap-1"
                  title="카테고리 라벨 편집"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>

              {/* Sector Tabs */}
              <div className="flex rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => setActiveSector('general')}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${activeSector === 'general'
                    ? 'bg-white text-[var(--forcs-blue)] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  일반 기업용
                </button>
                <button
                  onClick={() => setActiveSector('public')}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${activeSector === 'public'
                    ? 'bg-white text-[var(--forcs-blue)] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  정부·공공기관용
                </button>
              </div>
            </div>

            {/* Category Editor Modal */}
            {showCategoryEditor && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCategoryEditor(false)}>
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">항목 라벨 편집</h3>
                    <button onClick={() => setShowCategoryEditor(false)} className="text-gray-400 hover:text-gray-600">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {categoryLabels.map((cat) => (
                      <div key={cat.section} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-24 shrink-0">{{ 'SaaS': '문서', 'Credit': '크레딧', 'Service': '프리미엄 서비스', 'Option': '추가 옵션' }[cat.section]}</span>
                        <input
                          type="text"
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[var(--forcs-blue)] focus:ring-1 focus:ring-[var(--forcs-blue)] outline-none"
                          value={cat.label}
                          onChange={(e) => actions.updateCategoryLabel(cat.section, e.target.value)}
                          placeholder="라벨 입력"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex justify-between items-center">
                    <button
                      onClick={() => {
                        actions.resetCategoryLabels();
                        toast.success('기본값으로 복원되었습니다.');
                      }}
                      className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                    >
                      기본값 복원
                    </button>
                    <button
                      onClick={() => {
                        setShowCategoryEditor(false);
                        toast.success('카테고리 라벨이 저장되었습니다.');
                      }}
                      className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                    >
                      저장
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* 1. Document (문서) */}
              <div>
                <h4 className="mb-3 text-xs font-bold text-blue-600 tracking-wider">항목: {getLabel('SaaS')}</h4>
                <div className="flex flex-wrap gap-2">
                  {(activeSector === 'general'
                    ? ['enterprise2000', 'welcome100Free']
                    : ['public1k']
                  ).map(key => {
                    const item = QUICK_ADD_CATALOG[key];
                    if (!item) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          actions.addManyRows(item.factory, 1);
                          toast.success(`${item.label}을 추가했습니다.`);
                        }}
                        className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all hover:shadow-md active:scale-95 ${item.style}`}
                      >
                        + {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Credit (크레딧) */}
              <div>
                <h4 className="mb-3 text-xs font-bold text-purple-600 tracking-wider">항목: {getLabel('Credit')}</h4>
                <div className="flex flex-wrap gap-2">
                  {['credit100k'].map(key => {
                    const item = QUICK_ADD_CATALOG[key];
                    if (!item) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          actions.addManyRows(item.factory, 1);
                          toast.success(`${item.label}을 추가했습니다.`);
                        }}
                        className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all hover:shadow-md active:scale-95 ${item.style}`}
                      >
                        + {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Premium Service (프리미엄 서비스) */}
              <div>
                <h4 className="mb-3 text-xs font-bold text-teal-600 tracking-wider">항목: {getLabel('Service')}</h4>
                <div className="flex flex-wrap gap-2">
                  {(activeSector === 'general'
                    ? ['formSetup3Free', 'accountSetupFree', 'training1HFree']
                    : ['setupGeneral', 'setupAccount', 'training1h', 'brandingKakao', 'brandingSms', 'brandingEmail']
                  ).map(key => {
                    const item = QUICK_ADD_CATALOG[key];
                    if (!item) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          actions.addManyRows(item.factory, 1);
                          toast.success(`${item.label}을 추가했습니다.`);
                        }}
                        className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all hover:shadow-md active:scale-95 ${item.style}`}
                      >
                        + {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Additional Options (추가 옵션) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-amber-600 tracking-wider">항목: {getLabel('Option')}</h4>
                  <button
                    onClick={() => {
                      const allOptions = [
                        'addOnSmsAlert',
                        'addOnSmsEmailAuth',
                        'addOnPersonalAuth',
                        'addOnCorpAuth',
                        'addOnTimestamp',
                        'addOnEdocStorage',
                        'addOnKakaoBrand',
                        'addOnSmsCallerId',
                        'addOnEmailFrom',
                      ];
                      allOptions.forEach(key => {
                        const item = QUICK_ADD_CATALOG[key];
                        if (item) {
                          actions.addManyRows(item.factory, 1);
                        }
                      });
                      toast.success('모든 추가 옵션이 추가되었습니다.');
                    }}
                    className="text-[10px] font-bold text-[var(--forcs-blue)] hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                  >
                    + 모두 추가
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    'addOnSmsAlert',
                    'addOnSmsEmailAuth',
                    'addOnPersonalAuth',
                    'addOnCorpAuth',
                    'addOnTimestamp',
                    'addOnEdocStorage',
                    'addOnKakaoBrand',
                    'addOnSmsCallerId',
                    'addOnEmailFrom',
                  ].map(key => {
                    const item = QUICK_ADD_CATALOG[key];
                    if (!item) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          actions.addManyRows(item.factory, 1);
                          toast.success(`${item.label}을 추가했습니다.`);
                        }}
                        className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all hover:shadow-md active:scale-95 ${item.style}`}
                      >
                        + {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Items List */}
          < div className="space-y-4 min-h-[200px]" >
            <DndContext sensors={activeSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {items.map((item, index) => (
                      <SortableItemRow
                        key={item.id}
                        item={item}
                        index={index}
                        categoryLabels={categoryLabels}
                        onUpdate={patch => actions.updateRow(item.id, patch)}
                        onRemove={() => actions.removeRow(item.id)}
                        onFocus={() => setLastFocusedRow(item.id)}
                        isFocused={lastFocusedRow === item.id}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </SortableContext>
            </DndContext>

            {
              items.length === 0 && (
                <div className="flex h-48 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 text-sm text-gray-400 transition-colors hover:bg-gray-50 hover:border-gray-300">
                  <div className="rounded-full bg-white p-4 shadow-sm ring-1 ring-gray-100">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-600">견적 항목이 없습니다</p>
                    <p className="mt-1 text-xs">위 '빠른 추가' 버튼을 눌러 항목을 추가하세요.</p>
                  </div>
                </div>
              )
            }
          </div >
        </div >
      </fieldset >

      {/* Sticky Summary Bar */}
      < div className="sticky bottom-0 z-20 -mx-6 -mb-6 border-t border-[var(--forcs-border)] bg-white/90 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] backdrop-blur-md sm:mx-0 sm:mb-0 sm:rounded-2xl sm:border sm:shadow-lg" >
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">총 견적 금액</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-[var(--forcs-blue)]">{toKRW(calculation.grand)}</span>
              {calculation.msrpSum > calculation.offerSum && (
                <span className="text-xs text-gray-400 line-through">
                  정가 {toKRW(calculation.msrpSum)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-xs text-gray-500">
              <span>공급가 합계: {toKRW(calculation.supplyPriceSum)}</span>
              {calculation.msrpSum > calculation.offerSum && (
                <span className="text-red-500 font-medium">
                  ★ 할인 금액 ({calculation.totalDiscountPct.toFixed(0)}%): -{toKRW(calculation.msrpSum - calculation.offerSum)}
                </span>
              )}
              <span>부가세({calculation.vatRate}%): {toKRW(calculation.vatSum)}</span>
            </div>
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-md transition-transform active:scale-95 hover:bg-slate-800"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              위로
            </button>
          </div>
        </div>
      </div >
    </div >
  );
};
