import React from 'react';
import { CalculationResult } from '../types';
import { toKRW, nf } from '../utils/formatters';

interface SummaryBarProps {
  calculation: CalculationResult;
  onExportCSV: () => void;
  showPolicies: boolean;
  onTogglePolicies: () => void;
  onPrint: () => void;
}

export const SummaryBar: React.FC<SummaryBarProps> = ({
  calculation: calc,
  onExportCSV,
  showPolicies,
  onTogglePolicies,
  onPrint,
}) => {
  return (
    <div className='no-print fixed inset-x-4 bottom-4 z-40'>
      <div className='metrics-card flex flex-wrap items-center gap-4 bg-white/95 backdrop-blur'>
        <div>
          <div className='text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--forcs-text-muted)]'>
            총 합계 (VAT 포함)
          </div>
          <div className='text-2xl font-black text-[var(--forcs-blue-dark)]'>
            {toKRW(calc.grand)}
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-4 text-xs text-[color:var(--forcs-text-muted)]'>
          <span>정가 {toKRW(calc.msrpSum)}</span>
          <span>제안가 {toKRW(calc.offerSum)}</span>
          <span>
            유상 문서 {nf.format(calc.docsPaidQty || 0)}건 · 1건당{' '}
            {(calc.docsPaidQty || 0) > 0
              ? `${nf.format(Math.round(calc.perDocPaid))}원`
              : '-'}
          </span>
          <span>총 할인율 {Math.round(calc.totalDiscountPct)}%</span>
        </div>
        <div className='ml-auto flex flex-wrap gap-2'>
          <button className='btn-ghost text-xs sm:text-sm' onClick={onTogglePolicies}>
            {showPolicies ? '정책 숨기기' : '정책 보이기'}
          </button>
          <button className='btn-ghost text-xs sm:text-sm' onClick={onExportCSV}>
            CSV 내보내기
          </button>
          <button className='btn-primary text-xs sm:text-sm' onClick={onPrint}>
            PDF / 인쇄
          </button>
        </div>
      </div>
    </div>
  );
};
