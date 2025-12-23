import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { QuoteMeta, QuoteItem, CalculationResult, QuotePreset, QuoteSnapshot } from '../types';
import { QUICK_ADD_CATALOG, DATA_KEY, UI_KEY } from '../constants';
import { clamp, parseNum } from '../utils/helpers';
import { toKRW } from '../utils/formatters';
import { createDefaultMeta, buildQuoteNo, formatSequence } from '../hooks/useQuote';

// Brand theme options for color selection
const BRAND_THEMES = [
  { id: 'forcs-blue', label: 'FORCS 블루', color: '#00a99d' },
  { id: 'forcs-dark', label: 'FORCS 다크', color: '#1a237e' },
  { id: 'navy', label: '네이비', color: '#001f3f' },
  { id: 'purple', label: '퍼플', color: '#5e35b1' },
  { id: 'green', label: '그린', color: '#2e7d32' },
  { id: 'orange', label: '오렌지', color: '#e65100' },
];
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
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { ConfirmModal } from './ConfirmModal';
import { AnimatePresence, motion } from 'framer-motion';

interface ControlsPanelProps {
  meta: QuoteMeta;
  items: QuoteItem[];
  calculation: CalculationResult;
  presets: QuotePreset[];
  history: QuoteSnapshot[];
  actions: {
    setMeta: React.Dispatch<React.SetStateAction<QuoteMeta>>;
    setItems: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
    addManyRows: (factory: () => Omit<QuoteItem, 'id'>, n: number) => void;
    removeRow: (id: string) => void;
    updateRow: (id: string, patch: Partial<QuoteItem>) => void;
    duplicateRow: (id: string) => void;
    resetQuote: () => void;
    savePreset: (name: string) => void;
    applyPreset: (id: string) => void;
    deletePreset: (id: string) => void;
    saveSnapshot: (label?: string) => void;
    restoreSnapshot: (id: string) => void;
    reorderRow: (activeId: string, overId: string) => void;
  };
  pasteOpen: boolean;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  showAdvanced: boolean;
}

const numberFormatter = new Intl.NumberFormat('ko-KR');

const BRANDING_LABELS: Record<QuoteMeta['brandingMode'], string> = {
  ai: '이폼사인 AI 견적서',
  default: '이폼사인 견적서',
  public: '공공용 이폼사인 견적서',
};

const BRANDING_OPTIONS: Array<{ id: QuoteMeta['brandingMode']; label: string }> = [
  { id: 'ai', label: 'AI 적용' },
  { id: 'default', label: '일반' },
  { id: 'public', label: '공공용' },
];

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  meta,
  items,
  calculation,
  presets,
  history,
  actions,
  pasteOpen,
  handlePaste,
  showAdvanced,
}) => {
  const [repeatCount, setRepeatCount] = useState(1);
  const [lastFocusedRow, setLastFocusedRow] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [quoteCopied, setQuoteCopied] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const closeConfirmModal = useCallback(() => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const openConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void, isDestructive = false) => {
      setConfirmModal({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          onConfirm();
          closeConfirmModal();
        },
        isDestructive,
      });
    },
    [closeConfirmModal]
  );

  useEffect(() => {
    if (!quoteCopied) return;
    const timer = window.setTimeout(() => setQuoteCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [quoteCopied]);

  const applyMetaPatch = useCallback(
    (patch: Partial<QuoteMeta>) => {
      actions.setMeta(prev => {
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
    [actions]
  );

  const handleInitialsChange = useCallback(
    (value: string) => {
      applyMetaPatch({ contactInitials: value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) });
    },
    [applyMetaPatch]
  );

  const handleSequenceChange = useCallback(
    (value: string) => {
      const normalized = formatSequence(value);
      applyMetaPatch({ issueSequence: normalized });
    },
    [applyMetaPatch]
  );

  const handleQuoteDateChange = useCallback(
    (value: string) => {
      applyMetaPatch({ quoteDate: value });
    },
    [applyMetaPatch]
  );

  const copyQuoteNo = useCallback(() => {
    if (navigator?.clipboard) {
      navigator.clipboard
        .writeText(meta.quoteNo)
        .then(() => {
          setQuoteCopied(true);
          toast.success('견적 번호가 복사되었습니다.');
        })
        .catch(() => toast.error('클립보드 복사에 실패했습니다.'));
    } else {
      toast.error('클립보드를 지원하지 않는 환경입니다.');
    }
  }, [meta.quoteNo]);

  const incrementSequence = useCallback(() => {
    const current = parseInt(meta.issueSequence.replace(/\D/g, '') || '0', 10);
    const nextSeq = formatSequence(String(current + 1));
    applyMetaPatch({ issueSequence: nextSeq });
  }, [meta.issueSequence, applyMetaPatch]);

  const validation = useMemo(() => {
    const issues: string[] = [];
    const invalidRowIds = new Set<string>();

    if (!meta.quoteDate) {
      issues.push('견적 일자를 입력해 주세요.');
    }
    if (!meta.customerName.trim()) {
      issues.push('수신처(고객사명)를 입력해 주세요.');
    }
    if (!/^[A-Z]{2,4}$/.test(meta.contactInitials.trim())) {
      issues.push('담당자 이니셜은 영문 대문자 2~4자로 입력해 주세요.');
    }
    if (!/^\d{2,}$/.test(formatSequence(meta.issueSequence))) {
      issues.push('발행 순번은 최소 2자리 숫자로 입력해 주세요 (예: 01, 11, 123).');
    }
    if (items.length === 0) {
      issues.push('최소 1개의 항목을 추가해 주세요.');
    }

    items.forEach(item => {
      const nameEmpty = !item.item || item.item.trim().length === 0;
      const qtyInvalid = parseNum(item.qty) <= 0;
      const priceInvalid = parseNum(item.unitPrice) < 0;
      if (nameEmpty || qtyInvalid || priceInvalid) {
        invalidRowIds.add(item.id);
      }
      if (nameEmpty) {
        issues.push('항목명이 비어 있는 행이 있습니다.');
      }
      if (qtyInvalid) {
        issues.push('수량은 0보다 큰 값이어야 합니다.');
      }
      if (priceInvalid) {
        issues.push('단가는 0 이상이어야 합니다.');
      }
    });

    if (calculation.offerSum < 0) {
      issues.push('제안가 합계가 0보다 작습니다. 할인율을 조정해 주세요.');
    }

    return { issues: Array.from(new Set(issues)), invalidRowIds };
  }, [meta, items, calculation.offerSum]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!lastFocusedRow) return;
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        actions.duplicateRow(lastFocusedRow);
      } else if (e.key === 'Delete') {
        e.preventDefault();
        openConfirm('항목 삭제', '선택한 행을 삭제하시겠습니까?', () => {
          actions.removeRow(lastFocusedRow);
          toast.success('항목이 삭제되었습니다.');
        }, true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lastFocusedRow, actions, openConfirm]);

  const focusRow = (id: string) => () => setLastFocusedRow(id);

  const setBrandingMode = useCallback(
    (mode: QuoteMeta['brandingMode']) => {
      actions.setMeta(prev => ({ ...prev, brandingMode: mode }));
    },
    [actions]
  );



  return (
    <section className='forcs-card space-y-6 rounded-3xl p-5'>
      <div className='rounded-2xl border border-[rgba(0,169,157,0.2)] bg-[rgba(0,169,157,0.08)] p-4 text-sm text-[color:var(--forcs-text-muted)]'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex flex-wrap items-center gap-4'>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase tracking-[0.3em] text-[var(--forcs-blue-dark)]'>
                Quote Number
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <div className='text-xl font-bold text-[var(--forcs-text)]'>{meta.quoteNo}</div>
                <button className='btn-ghost text-xs' onClick={copyQuoteNo}>
                  번호 복사
                </button>
                <button className='btn-ghost text-xs' onClick={incrementSequence}>
                  순번 +1
                </button>
              </div>
              {quoteCopied && (
                <div className='text-xs text-[var(--forcs-blue-dark)]'>클립보드에 복사했습니다.</div>
              )}
            </div>
          </div>
          <div className='flex flex-col items-end gap-2 text-xs text-[color:var(--forcs-text-muted)]'>
            <span className='summary-chip text-xs'>
              현재 모드: {BRANDING_LABELS[meta.brandingMode]}
            </span>
            <div className='flex flex-wrap justify-end gap-2'>
              {BRANDING_OPTIONS.map(option => (
                <button
                  key={option.id}
                  type='button'
                  className={`btn-ghost text-xs ${meta.brandingMode === option.id
                    ? 'border border-[var(--forcs-blue-dark)] text-[var(--forcs-blue-dark)]'
                    : ''
                    }`}
                  onClick={() => setBrandingMode(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div>규칙: FORCS-EFS-{'{담당자 이니셜}'}-{'{YYYYMMDD}{순번}'}</div>
          </div>
        </div>
      </div>

      {validation.issues.length > 0 && (
        <div className='rounded-2xl border border-[var(--forcs-orange)] bg-[rgba(255,107,53,0.08)] p-4 text-sm text-[var(--forcs-orange)]'>
          <div className='font-semibold'>확인 필요</div>
          <ul className='mt-2 list-disc space-y-1 pl-4 text-xs'>
            {validation.issues.slice(0, 5).map(issue => (
              <li key={issue}>{issue}</li>
            ))}
            {validation.issues.length > 5 && (
              <li>기타 {validation.issues.length - 5}건의 경고가 있습니다.</li>
            )}
          </ul>
        </div>
      )}

      <div>
        <h2 className='section-heading'>견적 기본 정보</h2>
        <div className='mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2'>
          <Field
            label='견적 일자'
            value={meta.quoteDate}
            onChange={handleQuoteDateChange}
            type='date'
          />
          <Field
            label='담당자 이니셜'
            value={meta.contactInitials}
            onChange={handleInitialsChange}
            helper='영문 대문자 2~4자로 입력해 주세요'
          />
          <Field
            label='유효 기간(일)'
            value={String(meta.validityDays)}
            onChange={value => actions.setMeta(m => ({ ...m, validityDays: parseNum(value) }))}
            type='number'
          />
          <Field
            label='발행 순번'
            value={meta.issueSequence}
            onChange={handleSequenceChange}
            helper='견적 번호 생성에 사용됩니다.'
          />
          <Field
            label='수신처(고객사)'
            value={meta.customerName}
            onChange={value => actions.setMeta(m => ({ ...m, customerName: value }))}
            helper='견적서를 전달할 고객사명을 입력해 주세요.'
          />
          <Field
            label='수신처(담당자)'
            value={meta.customerManager}
            onChange={value => actions.setMeta(m => ({ ...m, customerManager: value }))}
            helper='고객사 담당자 직함/성명을 입력해 주세요.'
          />
          <Field
            label='담당자 이름'
            value={meta.contactName}
            onChange={value => actions.setMeta(m => ({ ...m, contactName: value }))}
            span
          />
          <Field
            label='직통 번호'
            value={meta.contactDirect}
            onChange={value => actions.setMeta(m => ({ ...m, contactDirect: value }))}
          />
          <Field
            label='휴대전화'
            value={meta.contactMobile}
            onChange={value => actions.setMeta(m => ({ ...m, contactMobile: value }))}
          />
          <Field
            label='이메일'
            value={meta.contactEmail}
            onChange={value => actions.setMeta(m => ({ ...m, contactEmail: value }))}
            span
          />
          <Field
            label='부가세율(%)'
            value={String(meta.vatRate)}
            onChange={value => actions.setMeta(m => ({ ...m, vatRate: parseNum(value) }))}
            type='number'
          />
        </div>
        <p className='mt-2 text-xs text-[color:var(--forcs-text-muted)] leading-relaxed'>
          공급사 기본 정보(상호, 대표자, 사업자번호, 주소, 대표 전화, 고객센터)는 eformsign 표준 값이 자동으로 적용됩니다.
        </p>
      </div>

      <div className='rounded-2xl border border-[var(--forcs-border)] bg-white/90 p-4 shadow-sm'>
        <h3 className='section-heading text-base'>브랜드 설정</h3>
        <label className='mt-3 block text-sm font-medium text-[color:var(--forcs-text)]'>
          <span className='mb-1 block text-xs uppercase tracking-[0.18em] text-[color:var(--forcs-text-muted)]'>
            브랜드 포인트 컬러
          </span>
          <select
            className='input-field w-full'
            value={meta.brandPrimary}
            onChange={e => actions.setMeta(m => ({ ...m, brandPrimary: e.target.value }))}
          >
            {BRAND_THEMES.map(theme => (
              <option key={theme.id} value={theme.color}>
                {theme.label}
              </option>
            ))}
          </select>
          <span className='mt-1 inline-flex items-center gap-2 text-xs text-[color:var(--forcs-text-muted)]'>
            <span
              className='inline-block h-3 w-3 rounded-full'
              style={{ backgroundColor: meta.brandPrimary }}
            />
            {meta.brandPrimary}
          </span>
        </label>
      </div>

      <div className='rounded-2xl border border-[var(--forcs-border)] bg-white/90 px-4 py-4 shadow-sm'>
        <div className='flex items-center justify-between gap-3'>
          <h3 className='text-base font-semibold text-[var(--forcs-text)]'>빠른 항목 추가</h3>
          <label className='flex items-center gap-2 text-xs text-[color:var(--forcs-text-muted)]'>
            반복 횟수
            <input
              type='number'
              min={1}
              max={999}
              className='input-field w-20 text-right'
              value={repeatCount}
              onChange={e => setRepeatCount(clamp(parseNum(e.target.value), 1, 999))}
            />
          </label>
        </div>
        <div className='mt-3 flex flex-wrap gap-2'>
          {Object.values(QUICK_ADD_CATALOG).map(item => (
            <button
              key={item.label}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition hover:-translate-y-[1px] ${item.style}`}
              onClick={() => actions.addManyRows(item.factory, repeatCount)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className='rounded-2xl border border-[var(--forcs-border)] bg-white/90 p-4 shadow-sm'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h3 className='text-base font-semibold text-[var(--forcs-text)]'>템플릿 프리셋</h3>
          <div className='flex gap-2'>
            <input
              className='input-field w-44'
              placeholder='예: SaaS 기본안'
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
            />
            <button
              className='btn-secondary text-xs sm:text-sm'
              onClick={() => {
                actions.savePreset(presetName);
                setPresetName('');
              }}
            >
              프리셋 저장
            </button>
          </div>
        </div>
        <div className='mt-3 space-y-2 text-sm'>
          {presets.length === 0 ? (
            <p className='text-xs text-[color:var(--forcs-text-muted)]'>저장된 프리셋이 없습니다. 자주 쓰는 견적 구성을 저장해 보세요.</p>
          ) : (
            presets.map(preset => (
              <div
                key={preset.id}
                className='flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--forcs-border)] bg-white px-3 py-2'
              >
                <div>
                  <div className='font-semibold text-[var(--forcs-text)]'>{preset.name}</div>
                  <div className='text-xs text-[color:var(--forcs-text-muted)]'>
                    {new Date(preset.createdAt).toLocaleString('ko-KR')}
                  </div>
                </div>
                <div className='flex gap-2 text-xs'>
                  <button
                    className='btn-secondary text-xs'
                    onClick={() => actions.applyPreset(preset.id)}
                  >
                    적용
                  </button>
                  <button
                    className='btn-ghost text-xs'
                    onClick={() => actions.deletePreset(preset.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className='rounded-2xl border border-[var(--forcs-border)] bg-white/90 p-4 shadow-sm'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h3 className='text-base font-semibold text-[var(--forcs-text)]'>작업 히스토리</h3>
          <div className='flex gap-2'>
            <input
              className='input-field w-44'
              placeholder='메모 (선택)'
              value={snapshotLabel}
              onChange={e => setSnapshotLabel(e.target.value)}
            />
            <button
              className='btn-secondary text-xs sm:text-sm'
              onClick={() => {
                actions.saveSnapshot(snapshotLabel);
                setSnapshotLabel('');
              }}
            >
              현재 상태 저장
            </button>
          </div>
        </div>
        <div className='mt-3 space-y-2 text-sm'>
          {history.length === 0 ? (
            <p className='text-xs text-[color:var(--forcs-text-muted)]'>저장된 스냅샷이 없습니다. 주요 변경 시점을 저장하면 비교 및 롤백이 쉬워집니다.</p>
          ) : (
            history.map(entry => (
              <div
                key={entry.id}
                className='flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--forcs-border)] bg-white px-3 py-2'
              >
                <div>
                  <div className='font-semibold text-[var(--forcs-text)]'>{entry.label}</div>
                  <div className='text-xs text-[color:var(--forcs-text-muted)]'>
                    {new Date(entry.createdAt).toLocaleString('ko-KR')} · 정가 {toKRW(entry.summary.msrpSum)} → 제안가 {toKRW(entry.summary.offerSum)}
                  </div>
                </div>
                <div className='flex gap-2 text-xs'>
                  <button
                    className='btn-secondary text-xs'
                    onClick={() => actions.restoreSnapshot(entry.id)}
                  >
                    불러오기
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showAdvanced && <AdvancedOptions items={items} actions={actions} openConfirm={openConfirm} />}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
        isDestructive={confirmModal.isDestructive}
      />

      {pasteOpen && (
        <div className='rounded-2xl border border-[var(--forcs-border)] bg-white/90 p-4 shadow-sm'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <h3 className='text-sm font-semibold text-[var(--forcs-text)]'>
                스프레드시트에서 항목 붙여넣기
              </h3>
              <p className='text-xs text-[color:var(--forcs-text-muted)]'>
                셀을 복사한 뒤 아래 영역에 <b>Ctrl/Cmd + V</b>를 눌러 붙여넣으세요. 헤더가 포함된 경우 섹션, 항목, 수량 등 필드를 자동으로 인식합니다.
              </p>
            </div>
          </div>
          <textarea
            onPaste={handlePaste}
            className='input-field mt-3 h-32 w-full resize-none'
            placeholder={'예) CSV/TSV\n섹션,항목,수량,단가,할인%\nSaaS,eformsign Enterprise,2000,600,0'}
          />
        </div>
      )}

      <ItemsEditor rows={calculation.rows} actions={actions} focusRow={focusRow} invalidIds={validation.invalidRowIds} />
    </section>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  helper?: string;
  span?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, type = 'text', helper, span }) => (
  <label className={`text-sm font-medium text-[color:var(--forcs-text)] ${span ? 'lg:col-span-2' : ''}`}>
    <span className='mb-1 block text-xs uppercase tracking-[0.18em] text-[color:var(--forcs-text-muted)]'>
      {label}
    </span>
    <input
      type={type}
      className='input-field w-full'
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
    />
    {helper && <p className='mt-1 text-xs text-[color:var(--forcs-text-muted)]'>{helper}</p>}
  </label>
);

const SAMPLE_META_PATCH: Partial<QuoteMeta> = {
  title: '디지털 전환 패키지 견적서',
  subtitle: 'eformsign + 프로페셔널 컨설팅 제안',
  customerName: '샘플 주식회사',
  customerManager: '홍길동 팀장',
  contactInitials: 'HT',
  issueSequence: '01',
  quoteDate: new Date().toISOString().slice(0, 10),
  brandingMode: 'ai',
};

const SAMPLE_ITEMS_SEED: Array<Omit<QuoteItem, 'id'>> = [
  {
    section: 'SaaS',
    category: '문서 생성',
    item: 'eformsign Enterprise 2,000건 패키지',
    unitLabel: '건',
    qty: 2000,
    unitPrice: 600,
    discountPct: 15,
    notes: '카카오톡/문자 OTP 인증 포함',
  },
  {
    section: 'SaaS',
    category: '문서 생성',
    item: '추가 API 호출 크레딧',
    unitLabel: '만 건',
    qty: 1,
    unitPrice: 350000,
    discountPct: 20,
    notes: 'Open API 확장 패키지',
  },
  {
    section: 'Service',
    category: '컨설팅',
    item: '온보딩 컨설팅 (2주)',
    unitLabel: '회',
    qty: 1,
    unitPrice: 1500000,
    discountPct: 0,
    notes: '프로세스 설계 및 관리자 교육',
  },
  {
    section: 'Service',
    category: '컨설팅',
    item: '사용자 교육 세션',
    unitLabel: '회',
    qty: 2,
    unitPrice: 300000,
    discountPct: 50,
    notes: '현업 담당자 실습형 교육',
  },
];

const AdvancedOptions: React.FC<{
  items: QuoteItem[];
  actions: ControlsPanelProps['actions'];
  openConfirm: (title: string, message: string, onConfirm: () => void, isDestructive?: boolean) => void;
}> = ({ items, actions, openConfirm }) => {
  const handleReset = useCallback(() => {
    openConfirm('새 견적 시작', '현재 입력된 내용을 모두 지우고 새 견적을 시작하시겠습니까?', () => {
      actions.resetQuote();
      toast.success('새 견적이 시작되었습니다.');
    }, true);
  }, [actions, openConfirm]);

  const handleLoadSample = useCallback(() => {
    openConfirm('샘플 데이터 불러오기', '샘플 데이터를 불러오면 현재 입력 내용이 모두 교체됩니다. 진행하시겠습니까?', () => {
      const base = createDefaultMeta();
      const sampleMeta: QuoteMeta = {
        ...base,
        ...SAMPLE_META_PATCH,
      };

      const sampleItems: QuoteItem[] = SAMPLE_ITEMS_SEED.map(item => ({
        ...item,
        id: crypto.randomUUID(),
      }));

      actions.setMeta(() => sampleMeta);
      actions.setItems(() => sampleItems);
      toast.success('샘플 데이터가 적용되었습니다.');
    }, true);
  }, [actions, openConfirm]);

  const handleClearStorage = useCallback(() => {
    openConfirm('저장소 비우기', '로컬 저장소에 남아 있는 임시 데이터를 모두 삭제하시겠습니까?', () => {
      localStorage.removeItem(DATA_KEY);
      localStorage.removeItem(UI_KEY);
      toast.success('로컬 저장소가 정리되었습니다.');
    }, true);
  }, [openConfirm]);

  return (
    <div className='rounded-2xl border border-[var(--forcs-border)] bg-white/90 p-4 shadow-sm'>
      <div className='flex items-center justify-between gap-2'>
        <h3 className='text-sm font-semibold text-[var(--forcs-text)]'>고급 옵션</h3>
        <span className='summary-chip text-xs'>현재 항목 {items.length}건</span>
      </div>
      <div className='mt-3 flex flex-wrap gap-2 text-xs'>
        <button className='btn-secondary' onClick={handleLoadSample}>
          샘플 데이터 불러오기
        </button>
        <button
          className='btn-secondary border-[color:var(--forcs-orange)] text-[color:var(--forcs-orange)]'
          onClick={handleReset}
        >
          새 견적 시작
        </button>
        <button
          className='btn-secondary border-[color:var(--forcs-red)] text-[color:var(--forcs-red)]'
          onClick={handleClearStorage}
        >
          로컬 저장소 비우기
        </button>
      </div>
      <p className='mt-2 text-xs text-[color:var(--forcs-text-muted)] leading-relaxed'>
        샘플 데이터는 앱 사용법을 빠르게 익히고 고객에게 데모를 보여줄 때 활용할 수 있습니다. 새 견적을
        시작하면 기본값으로 초기화되며, 입력한 내용은 자동으로 브라우저에 저장됩니다.
      </p>
    </div>
  );
};

interface ItemsEditorProps {
  rows: (QuoteItem & { offer: number; msrp: number })[];
  actions: {
    removeRow: (id: string) => void;
    updateRow: (id: string, patch: Partial<QuoteItem>) => void;
    duplicateRow: (id: string) => void;
    reorderRow: (activeId: string, overId: string) => void;
  };
  focusRow: (id: string) => () => void;
  invalidIds: Set<string>;
}

const ItemsEditor: React.FC<ItemsEditorProps> = ({ rows, actions, focusRow, invalidIds }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      actions.reorderRow(active.id as string, over?.id as string);
    }
  };

  if (rows.length === 0) {
    return (
      <div className='rounded-2xl border border-dashed border-[var(--forcs-border)] bg-white/70 p-6 text-center text-[color:var(--forcs-text-muted)]'>
        아직 항목이 없습니다. 위의 <b>빠른 항목 추가</b> 버튼을 눌러 시작해 보세요.
      </div>
    );
  }

  return (
    <>
      <div className='hidden lg:block overflow-hidden rounded-2xl border border-[var(--forcs-border)] bg-white shadow-sm'>
        <div className='overflow-x-auto'>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className='w-full text-sm'>
              <thead className='table-header'>
                <tr>
                  <th className='w-10 px-2 py-3'></th>
                  <th className='px-4 py-3 text-left font-semibold'>섹션</th>
                  <th className='px-4 py-3 text-left font-semibold'>항목</th>
                  <th className='px-4 py-3 text-right font-semibold'>수량</th>
                  <th className='px-4 py-3 text-right font-semibold'>단가</th>
                  <th className='px-4 py-3 text-right font-semibold'>할인(%)</th>
                  <th className='px-4 py-3 text-right font-semibold'>제안가</th>
                  <th className='px-4 py-3' />
                </tr>
              </thead>
              <tbody>
                <SortableContext items={rows} strategy={verticalListSortingStrategy}>
                  <AnimatePresence initial={false} mode='popLayout'>
                    {rows.map(row => (
                      <SortableItemRow
                        key={row.id}
                        item={row}
                        actions={actions}
                        focusRow={focusRow}
                        invalidIds={invalidIds}
                      />
                    ))}
                  </AnimatePresence>
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        </div>
      </div>

      <div className='lg:hidden space-y-3'>
        <AnimatePresence initial={false} mode='popLayout'>
          {rows.map(row => (
            <ItemCard key={row.id} item={row} actions={actions} focusRow={focusRow} invalidIds={invalidIds} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};

const SortableItemRow: React.FC<{
  item: QuoteItem & { offer: number; msrp: number };
  actions: ItemsEditorProps['actions'];
  focusRow: ItemsEditorProps['focusRow'];
  invalidIds: ItemsEditorProps['invalidIds'];
}> = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
    position: 'relative',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ItemRow
      ref={setNodeRef}
      style={style}
      dragHandleProps={{ ...attributes, ...listeners }}
      {...props}
    />
  );
};

const ItemRow = React.forwardRef<
  HTMLTableRowElement,
  {
    item: QuoteItem & { offer: number; msrp: number };
    actions: ItemsEditorProps['actions'];
    focusRow: ItemsEditorProps['focusRow'];
    invalidIds: ItemsEditorProps['invalidIds'];
    style?: React.CSSProperties;
    dragHandleProps?: any;
  }
>(({ item, actions, focusRow, invalidIds, style, dragHandleProps }, ref) => {
  const invalid = invalidIds.has(item.id);
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, backgroundColor: 'rgba(0, 169, 157, 0.1)' }}
      animate={{ opacity: 1, backgroundColor: invalid ? 'rgba(255, 107, 53, 0.06)' : '#ffffff' }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      ref={ref}
      style={style}
      className={`border-b border-[var(--forcs-border)] transition-colors hover:bg-[rgba(0,169,157,0.06)] ${invalid ? 'border-[rgba(255,107,53,0.4)]' : ''
        }`}
    >
      <td className='px-2 py-3 align-top text-center'>
        <button
          className='cursor-grab text-[color:var(--forcs-text-muted)] hover:text-[var(--forcs-blue)] active:cursor-grabbing'
          {...dragHandleProps}
        >
          ⋮⋮
        </button>
      </td>
      <td className='px-4 py-3 align-top'>
        <select
          className={`input-field w-full ${invalid ? 'border-[var(--forcs-orange)]' : ''}`}
          value={item.section}
          onFocus={focusRow(item.id)}
          onChange={e =>
            actions.updateRow(item.id, { section: e.target.value as 'SaaS' | 'Service' })
          }
        >
          <option value='SaaS'>SaaS</option>
          <option value='Service'>Service</option>
        </select>
      </td>
      <td className='px-4 py-3 align-top'>
        <input
          className={`input-field w-full ${invalid ? 'border-[var(--forcs-orange)]' : ''}`}
          value={item.item}
          onFocus={focusRow(item.id)}
          onChange={e => actions.updateRow(item.id, { item: e.target.value })}
        />
        <div className='mt-1 text-xs text-[color:var(--forcs-text-muted)]'>
          {item.category} · {item.unitLabel || '단위 미설정'}
        </div>
      </td>
      <td className='px-4 py-3 align-top text-right'>
        <input
          type='number'
          className={`input-field w-full text-right ${invalid ? 'border-[var(--forcs-orange)]' : ''}`}
          value={item.qty}
          onFocus={focusRow(item.id)}
          onChange={e => actions.updateRow(item.id, { qty: parseNum(e.target.value) })}
        />
      </td>
      <td className='px-4 py-3 align-top text-right'>
        <input
          type='number'
          className={`input-field w-full text-right ${invalid ? 'border-[var(--forcs-orange)]' : ''}`}
          value={item.unitPrice}
          onFocus={focusRow(item.id)}
          onChange={e => actions.updateRow(item.id, { unitPrice: parseNum(e.target.value) })}
        />
      </td>
      <td className='px-4 py-3 align-top'>
        <div className='flex flex-col items-end gap-2'>
          <input
            type='range'
            min={0}
            max={100}
            step={5}
            value={item.discountPct}
            onFocus={focusRow(item.id)}
            onChange={e => actions.updateRow(item.id, { discountPct: parseNum(e.target.value) })}
            className='w-full'
          />
          <div className='text-sm font-semibold text-[var(--forcs-blue-dark)]'>
            {numberFormatter.format(item.discountPct)}%
          </div>
          <div className='flex gap-1'>
            {[0, 30, 60, 100].map(v => (
              <button
                key={v}
                className={`rounded-full border px-2 py-1 text-xs font-semibold transition ${item.discountPct === v
                  ? 'bg-[var(--forcs-blue)] text-white border-[var(--forcs-blue)]'
                  : 'bg-white text-[color:var(--forcs-text-muted)] border-[var(--forcs-border)] hover:border-[var(--forcs-blue)]'
                  }`}
                onClick={() => actions.updateRow(item.id, { discountPct: v })}
              >
                {v}%
              </button>
            ))}
          </div>
        </div>
      </td>
      <td className='px-4 py-3 align-top text-right font-semibold text-[var(--forcs-text)]'>
        {numberFormatter.format(item.offer)}
      </td>
      <td className='px-4 py-3 align-top text-right'>
        <div className='flex justify-end gap-2 text-xs font-semibold'>
          <button
            className='text-[color:var(--forcs-text-muted)] hover:text-[var(--forcs-blue)]'
            onClick={() => actions.duplicateRow(item.id)}
          >
            복제
          </button>
          <button
            className='text-[color:var(--forcs-red)] hover:underline'
            onClick={() => actions.removeRow(item.id)}
          >
            삭제
          </button>
        </div>
      </td>
    </motion.tr>
  );
});

const ItemCard: React.FC<{
  item: QuoteItem & { offer: number; msrp: number };
  actions: ItemsEditorProps['actions'];
  focusRow: ItemsEditorProps['focusRow'];
  invalidIds: ItemsEditorProps['invalidIds'];
}> = ({ item, actions, focusRow, invalidIds }) => {
  const invalid = invalidIds.has(item.id);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-2xl border bg-white p-4 shadow-sm ${invalid
        ? 'border-[rgba(255,107,53,0.4)] bg-[rgba(255,107,53,0.05)]'
        : 'border-[var(--forcs-border)]'
        }`}
    >
      <div className='flex items-center justify-between gap-2'>
        <select
          className={`input-field ${invalid ? 'border-[var(--forcs-orange)]' : ''}`}
          value={item.section}
          onFocus={focusRow(item.id)}
          onChange={e => actions.updateRow(item.id, { section: e.target.value as 'SaaS' | 'Service' })}
        >
          <option value='SaaS'>SaaS</option>
          <option value='Service'>Service</option>
        </select>
        <div className='text-sm font-semibold text-[var(--forcs-text)]'>
          제안가 {numberFormatter.format(item.offer)}원
        </div>
      </div>
      <input
        className={`input-field mt-3 w-full ${invalid ? 'border-[var(--forcs-orange)]' : ''}`}
        value={item.item}
        onFocus={focusRow(item.id)}
        onChange={e => actions.updateRow(item.id, { item: e.target.value })}
      />
      <div className='mt-1 text-xs text-[color:var(--forcs-text-muted)]'>
        {item.category} · {item.unitLabel || '단위 미설정'}
      </div>
      <div className='mt-3 grid grid-cols-2 gap-3'>
        <label className='text-xs text-[color:var(--forcs-text-muted)]'>
          수량
          <input
            type='number'
            className={`input-field mt-1 w-full text-right ${invalid ? 'border-[var(--forcs-orange)]' : ''}`}
            value={item.qty}
            onFocus={focusRow(item.id)}
            onChange={e => actions.updateRow(item.id, { qty: parseNum(e.target.value) })}
          />
        </label>
        <label className='text-xs text-[color:var(--forcs-text-muted)]'>
          단가
          <input
            type='number'
            className={`input-field mt-1 w-full text-right ${invalid ? 'border-[var(--forcs-orange)]' : ''}`}
            value={item.unitPrice}
            onFocus={focusRow(item.id)}
            onChange={e => actions.updateRow(item.id, { unitPrice: parseNum(e.target.value) })}
          />
        </label>
      </div>
      <div className='mt-3'>
        <div className='flex items-center gap-2'>
          <input
            type='range'
            min={0}
            max={100}
            step={5}
            className='w-full'
            value={item.discountPct}
            onFocus={focusRow(item.id)}
            onChange={e => actions.updateRow(item.id, { discountPct: parseNum(e.target.value) })}
          />
          <div className='w-14 text-right text-sm font-semibold text-[var(--forcs-blue-dark)]'>
            {numberFormatter.format(item.discountPct)}%
          </div>
        </div>
        <div className='mt-1 flex gap-1'>
          {[0, 30, 60, 100].map(v => (
            <button
              key={v}
              className={`rounded-full border px-2 py-1 text-xs font-semibold transition ${item.discountPct === v
                ? 'bg-[var(--forcs-blue)] text-white border-[var(--forcs-blue)]'
                : 'bg-white text-[color:var(--forcs-text-muted)] border-[var(--forcs-border)] hover:border-[var(--forcs-blue)]'
                }`}
              onClick={() => actions.updateRow(item.id, { discountPct: v })}
            >
              {v}%
            </button>
          ))}
        </div>
      </div>
      <div className='mt-3 flex justify-end gap-3 text-sm font-semibold'>
        <button
          className='text-[color:var(--forcs-text-muted)] hover:text-[var(--forcs-blue)]'
          onClick={() => actions.duplicateRow(item.id)}
        >
          복제
        </button>
        <button
          className='text-[color:var(--forcs-red)] hover:underline'
          onClick={() => actions.removeRow(item.id)}
        >
          삭제
        </button>
      </div>
    </motion.div>
  );
};
