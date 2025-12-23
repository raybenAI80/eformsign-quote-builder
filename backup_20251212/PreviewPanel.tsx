import React from 'react';
import { QuoteMeta, CalculationResult, CalculatedRow } from '../types';
import { toKRW, nf } from '../utils/formatters';
import { SUPPLIER_PROFILE } from '../constants';
import { EformsignLogo } from './EformsignLogo';

interface PreviewPanelProps {
  meta: QuoteMeta;
  calculation: CalculationResult;
  showPolicies: boolean;
}

const LABELS = {
  quoteNo: 'ESTILMATE NO.', // Changed to English for modern look as per design
  quoteDate: 'DATE ISSUED',
  validity: 'DUE DATE', // Mapping Validity to Due Date conceptually
  total: 'TOTAL DUE',
  billTo: 'BILL TO',
  supplier: 'SUPPLIER',
  payment: 'PAYMENT INFO',
};

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ meta, calculation, showPolicies }) => {
  const isStamped = meta.sealMode === 'stamped';

  // Calculate Due Date
  const quoteDateObj = new Date(meta.quoteDate || new Date());
  const dueDateObj = new Date(quoteDateObj);
  dueDateObj.setDate(quoteDateObj.getDate() + (meta.validityDays || 14));
  const dueDateStr = dueDateObj.toISOString().split('T')[0];

  return (
    <div id="preview-panel" className='paper flex flex-row min-h-[297mm] bg-white text-[var(--forcs-text)] relative overflow-hidden font-sans'>

      {/* LEFT SIDEBAR - Split Background Design */}
      <aside className="w-[34%] flex flex-col relative z-10">
        {/* Top Section: Light Gray Background (Service Branding) */}
        <div className="bg-gray-100 p-4 space-y-2 text-center">
          {/* eformsign Logo */}
          <div className="w-44 mx-auto">
            <EformsignLogo className="w-full h-auto" />
          </div>

          {/* Full Promotional Section (전자 계약 + AI + 노트북 + 마케팅 문구) */}
          <div className="pb-3">
            <img
              src="/promo-full.png"
              alt="eformsign 전자계약 프로모션"
              className="w-full h-auto mx-auto"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Service Certifications (Supporting Element) */}
          <div className="pt-3">
            <img
              src="/badges/logo.png"
              alt="eformsign Certifications"
              className="h-10 w-auto mx-auto"
            />
          </div>
        </div>

        {/* Bottom Section: Brand Blue Background (Transaction Info) */}
        <div
          className="flex-1 p-6 text-white flex flex-col justify-between"
          style={{
            background: 'linear-gradient(180deg, #0085C8 0%, #0060A0 100%)',
            printColorAdjust: 'exact',
            WebkitPrintColorAdjust: 'exact'
          }}
        >
          <div className="space-y-6">
            {/* Supplier Info (Company) */}
            <div className="pb-4 border-b border-white/20">
              <h3 className="text-[10px] font-bold tracking-wider opacity-60 mb-3 uppercase">FROM</h3>
              <div className="text-sm leading-relaxed space-y-1">
                <p className="text-xl font-extrabold">{SUPPLIER_PROFILE.companyName}</p>
                <p className="opacity-90">{SUPPLIER_PROFILE.address}</p>
                <p className="opacity-90">{SUPPLIER_PROFILE.addressBuilding}</p>
                <p className="opacity-90 text-xs">사업자등록번호: {SUPPLIER_PROFILE.bizNo}</p>
                <p className="opacity-90 font-medium">{SUPPLIER_PROFILE.email}</p>
                <p className="opacity-90 font-medium">{SUPPLIER_PROFILE.tel}</p>
              </div>
            </div>

            {/* Bill To */}
            <div className="pb-4 border-b border-white/20">
              <h3 className="text-[10px] font-bold tracking-wider opacity-60 mb-3 uppercase">{LABELS.billTo}</h3>
              <div className="text-sm leading-relaxed space-y-1">
                <p className="text-xl font-bold">{meta.customerName || '고객사명'}</p>
                {meta.customerManager && <p className="opacity-90 font-medium">{meta.customerManager}</p>}
                {meta.customerEmail && <p className="opacity-90">{meta.customerEmail}</p>}
                {meta.customerContact && <p className="opacity-90">{meta.customerContact}</p>}
              </div>
            </div>

            {/* Contact (Sales Manager) */}
            <div>
              <h3 className="text-[10px] font-bold tracking-wider opacity-60 mb-2 uppercase">CONTACT</h3>
              <div className="text-sm leading-relaxed space-y-1">
                <p className="text-lg font-semibold">{meta.contactName || SUPPLIER_PROFILE.salesManager}</p>
                <p className="opacity-90">{meta.contactEmail || SUPPLIER_PROFILE.salesEmail}</p>
                {meta.contactMobile && <p className="opacity-90">{meta.contactMobile}</p>}
                {meta.contactDirect && <p className="opacity-90">{meta.contactDirect}</p>}
                {!meta.contactMobile && !meta.contactDirect && (
                  <p className="opacity-90">{SUPPLIER_PROFILE.salesContact}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Payment Info */}
            <div>
              <h3 className="text-[10px] font-bold tracking-wider opacity-60 mb-3 uppercase border-b border-white/20 pb-1 w-full">{LABELS.payment}</h3>
              <div className="text-xs font-medium opacity-90 leading-relaxed space-y-1">
                <p className="font-bold text-sm">{SUPPLIER_PROFILE.bankName}</p>
                <p>{SUPPLIER_PROFILE.accountNo}</p>
                <p>예금주: {SUPPLIER_PROFILE.depositor}</p>
                <div className="flex gap-4 pt-3 text-xs font-medium">
                  <a
                    href={SUPPLIER_PROFILE.bizNoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80"
                  >
                    📋 사업자등록증
                  </a>
                  <a
                    href={SUPPLIER_PROFILE.bankAccountLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80"
                  >
                    🏦 통장사본
                  </a>
                </div>
              </div>
            </div>

            {/* Total Due */}
            <div>
              <h3 className="text-[10px] font-bold tracking-wider opacity-60 mb-1 uppercase">{LABELS.total}</h3>
              <p className="text-3xl font-extrabold tracking-tight">￦ {toKRW(calculation.grand).replace('₩', '')}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT CONTENT (WHITE) */}
      <main className="flex-1 p-[10mm] flex flex-col relative">
        {/* Header */}
        <header className="flex justify-between items-start mb-12 border-b-2 border-gray-100 pb-6">
          <div>
            <h3 className="text-[10px] font-bold text-gray-400 tracking-wider mb-2 uppercase">INVOICE NUMBER</h3>
            <p className="text-2xl font-bold text-gray-800 tracking-tight">{meta.quoteNo || 'INV-0000-000'}</p>
          </div>
          <div className="text-right">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
              {meta.brandingMode === 'ai' ? 'AI 견적서' :
                meta.brandingMode === 'public' ? '공공 견적서' : '견적서'}
            </h1>
          </div>
        </header>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-12 mb-12 max-w-md">
          <div>
            <h3 className="text-[10px] font-bold text-gray-400 tracking-wider mb-1 uppercase">{LABELS.quoteDate}</h3>
            <p className="text-lg font-bold text-gray-800">{meta.quoteDate || '-'}</p>
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-gray-400 tracking-wider mb-1 uppercase">{LABELS.validity}</h3>
            <p className="text-lg font-bold text-gray-800">{dueDateStr}</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[45%]">ITEM DESCRIPTION</th>
                <th className="py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right w-[10%]">QTY</th>
                <th className="py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right w-[20%]">PRICE</th>
                <th className="py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right w-[25%]">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {calculation.rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-4 pr-4 align-top">
                    <p className="font-bold text-gray-800 text-sm">{row.item}</p>
                    {(row.notes || row.note) && <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{row.notes || row.note}</p>}
                  </td>
                  <td className="py-4 text-right align-top text-sm font-medium text-gray-600">{nf.format(row.qty)}</td>
                  <td className="py-4 text-right align-top text-sm font-medium text-gray-600">{nf.format(row.unitPrice)}</td>
                  <td className="py-4 text-right align-top text-sm font-bold text-gray-800">{nf.format(row.offerPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {calculation.rows.length === 0 && (
            <div className="text-center py-12 text-gray-300 text-sm">품목이 없습니다.</div>
          )}
        </div>

        {/* Summary */}
        <div className="mt-8 flex justify-end">
          <div className="w-[60%] bg-gray-50/50 rounded-xl p-6 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-gray-500">Subtotal</span>
              <span className="font-bold text-gray-800">{toKRW(calculation.offerSum)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-gray-500">Tax ({calculation.vatRate}%)</span>
              <span className="font-bold text-gray-800">{toKRW(calculation.vat)}</span>
            </div>
            <div className="border-t border-gray-200 my-2 pt-3 flex justify-between items-center">
              <span className="font-bold text-[var(--forcs-blue)] text-lg">Total</span>
              <span className="font-black text-[var(--forcs-blue)] text-xl">{toKRW(calculation.grand)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 bg-white rounded-lg p-6 border border-gray-100 relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-end border-t border-gray-200 pt-4">
              <div className="flex-1">
                {/* FORCS Logo */}
                <div className="w-40 mb-3">
                  <img
                    src="/Slogan_Original.png"
                    alt="FORCS Logo"
                    className="w-full h-auto opacity-70"
                  />
                </div>
                <h4 className="text-[10px] font-bold text-gray-900 uppercase">비고 (NOTES)</h4>
                <p className="text-xs text-gray-500">본 견적서는 {meta.validityDays}일간 유효합니다.</p>
              </div>

              {/* Seal Logic */}
              <div className="text-right relative min-w-[150px]">
                <p className="text-sm font-bold text-gray-800 mb-1">{SUPPLIER_PROFILE.companyName}</p>
                <p className="text-xs text-gray-500 mr-12">대표이사 {SUPPLIER_PROFILE.ceoName}</p>

                <div className="absolute right-0 bottom-[-10px] pointer-events-none">
                  {isStamped ? (
                    <div className="w-16 h-16 border-2 border-red-600 rounded-full flex items-center justify-center text-[10px] text-red-600 font-bold opacity-80" style={{ transform: 'rotate(-5deg)', boxShadow: '0 0 0 1px rgba(220, 38, 38, 0.2)' }}>
                      <span className="text-center leading-tight">주식회사<br />포시에스<br />인</span>
                    </div>
                  ) : (
                    <span className="text-gray-300 text-[10px] font-medium tracking-tighter">(직인 생략)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};
