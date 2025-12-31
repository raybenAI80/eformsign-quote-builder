import React from 'react';
import { QuoteMeta, CalculationResult, CalculatedRow } from '../types';
import { toKRW, nf } from '../utils/formatters';
import { SUPPLIER_PROFILE, getCategoryLabel, CategorySection } from '../constants';
import { EformsignLogo } from './EformsignLogo';

interface PreviewPanelProps {
  meta: QuoteMeta;
  calculation: CalculationResult;
  categoryLabels?: { section: string; label: string }[];
  showPolicies: boolean;
}

const LABELS = {
  quoteNo: '견적번호',
  quoteDate: '견적일',
  validity: '견적 기한',
  total: '총 결제 금액',
  billTo: '고객사',
  supplier: '공급사',
  payment: '결제 정보',
  contact: '영업 담당자',
  itemDesc: '항목',
  qty: '수량(건)',
  price: '단가(원)',
  discount: '할인율',
  amount: '금액(원)',
  subtotal: '공급가액',
  tax: '부가세',
  grandTotal: '합계',
  notes: '참고사항',
};

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ meta, calculation, categoryLabels, showPolicies }) => {
  const isStamped = meta.sealMode === 'stamped';

  // Calculate Due Date
  const quoteDateObj = new Date(meta.quoteDate || new Date());
  const dueDateObj = new Date(quoteDateObj);
  dueDateObj.setDate(quoteDateObj.getDate() + 30); // 견적 기한: 견적일로부터 30일
  const dueDateStr = dueDateObj.toISOString().split('T')[0];

  // 한글 요일 포맷터 (요일은 날짜보다 작게)
  const formatDateWithDay = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[date.getDay()];
    return (
      <>
        {dateStr} <span className="text-sm font-medium text-gray-500">({dayName})</span>
      </>
    );
  };

  return (
    <div id="preview-panel" className='paper flex flex-row min-h-[297mm] bg-white text-[var(--forcs-text)] relative overflow-hidden font-sans'>

      {/* LEFT SIDEBAR - Split Background Design */}
      <aside className="w-[28%] flex flex-col relative z-10 bg-gray-100">
        {/* Top Section: Light Gray Background (Service Branding) */}
        <div className="bg-gray-100 pl-1 pr-3 pt-3 pb-1 text-center">
          {/* eformsign Logo */}
          <div className="w-36 mx-auto mb-2">
            <EformsignLogo className="w-full h-auto" />
          </div>

          {/* Full Promotional Section (전자 계약 + AI + 노트북 + 마케팅 문구) */}
          <div className="pb-0">
            <img
              src="/promo-full.png"
              alt="eformsign 전자계약 프로모션"
              className="w-full h-auto mx-auto"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Service Certifications (Supporting Element) */}
          <div className="pt-2">
            <img
              src="/badges/logo.png"
              alt="eformsign Certifications"
              className="h-10 w-auto mx-auto"
            />
          </div>
        </div>

        {/* Bottom Section: Brand Blue Background (Transaction Info) */}
        <div
          className="flex-1 p-6 ml-1 mr-3 text-white flex flex-col justify-between"
          style={{
            backgroundColor: '#0070B0',
            printColorAdjust: 'exact',
            WebkitPrintColorAdjust: 'exact'
          }}
        >
          <div className="space-y-6">
            {/* Supplier Info (Company) */}
            <div className="pb-4 border-b border-white/20">
              <h3 className="text-xs font-bold tracking-wider opacity-80 mb-3">{LABELS.supplier}</h3>
              <div className="text-sm leading-relaxed space-y-1">
                <p className="text-xl font-extrabold">{SUPPLIER_PROFILE.companyName}</p>
                <p className="opacity-90">{SUPPLIER_PROFILE.address}</p>
                <p className="opacity-90">{SUPPLIER_PROFILE.addressBuilding}</p>
                <p className="opacity-90">사업자등록번호: {SUPPLIER_PROFILE.bizNo}</p>
                <p className="opacity-90 font-medium">{SUPPLIER_PROFILE.email}</p>
                <p className="opacity-90 font-medium">{SUPPLIER_PROFILE.tel}</p>
                {/* 대표이사 + 직인 */}
                <div className="flex items-center gap-3 pt-1 pb-2 mt-2">
                  <span className="text-sm opacity-90" style={{ lineHeight: 1 }}>대표이사 {SUPPLIER_PROFILE.ceoName}</span>
                  {isStamped ? (
                    <div
                      className="w-10 h-10 border-2 border-red-400 rounded-full flex items-center justify-center text-[8px] text-red-400 font-bold"
                      style={{ transform: 'rotate(-5deg)' }}
                    >
                      <span className="text-center leading-tight">주식회사<br />포시에스<br />인</span>
                    </div>
                  ) : (
                    <span className="text-xs opacity-60">(직인 생략)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="pb-4 border-b border-white/20">
              <h3 className="text-xs font-bold tracking-wider opacity-80 mb-3">{LABELS.billTo}</h3>
              <div className="text-sm leading-relaxed space-y-1">
                <p className="text-xl font-bold">{meta.customerName || '고객사명'}</p>
                {meta.customerManager && <p className="opacity-90 font-medium">{meta.customerManager}</p>}
                {meta.customerEmail && <p className="opacity-90">{meta.customerEmail}</p>}
                {meta.customerContact && <p className="opacity-90">{meta.customerContact}</p>}
              </div>
            </div>

            {/* Contact (Sales Manager) */}
            <div className="pb-4 border-b border-white/20">
              <h3 className="text-xs font-bold tracking-wider opacity-80 mb-2">{LABELS.contact}</h3>
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
            <div className="pt-6">
              <h3 className="text-xs font-bold tracking-wider opacity-80 mb-3">{LABELS.payment}</h3>
              <div className="text-xs font-medium opacity-90 leading-relaxed space-y-1">
                <p className="font-semibold text-lg">{SUPPLIER_PROFILE.bankName}</p>
                <p>{SUPPLIER_PROFILE.accountNo}</p>
                <p>예금주: {SUPPLIER_PROFILE.depositor}</p>
                <p className="pt-1">대금지불조건: 세금계산서 발행 후<br />30일이내 현금 또는 카드결제</p>
                <div className="flex gap-4 pt-3 text-xs font-medium">
                  <a
                    href={meta.bizNoLink || SUPPLIER_PROFILE.bizNoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80 pdf-target-link"
                  >
                    📋 사업자등록증
                  </a>
                  <a
                    href={meta.bankAccountLink || SUPPLIER_PROFILE.bankAccountLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80 pdf-target-link"
                  >
                    🏦 통장사본
                  </a>
                </div>
              </div>
            </div>

            {/* Total Due */}
            <div>
              <h3 className="text-xs font-bold tracking-wider opacity-80 mb-1">{LABELS.total}</h3>
              <p className="text-2xl font-extrabold tracking-tight whitespace-nowrap">{toKRW(calculation.grand)}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT CONTENT (WHITE) */}
      <main className="flex-1 pl-[2mm] pr-[5mm] py-[5mm] flex flex-col relative">
        {/* Header */}
        <header className="flex justify-between items-start mb-6 border-b-2 border-gray-100 pb-4">
          <div className="text-right">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {meta.brandingMode === 'ai' ? (
                <span className="inline-flex items-center gap-1">
                  이폼사인
                  <img
                    src="/ai-icon.png"
                    alt="AI"
                    className="h-8 w-auto"
                  />
                  견적서
                </span>
              ) : meta.brandingMode === 'public' ? '공공용 이폼사인 견적서' : '이폼사인 견적서'}
            </h1>
          </div>
          <div className="text-right">
            <h3 className="text-xs font-bold text-gray-400 tracking-wider mb-1">{LABELS.quoteNo}</h3>
            <p className="text-sm font-medium text-gray-600 tracking-tight">{meta.quoteNo || 'FORCS-EFS-XX-0000000'}</p>
          </div>
        </header>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-8 mb-6 max-w-xl">
          <div>
            <h3 className="text-xs font-bold text-gray-400 tracking-wider mb-1">{LABELS.quoteDate}</h3>
            <p className="text-lg font-bold text-gray-800">{meta.quoteDate ? formatDateWithDay(meta.quoteDate) : '-'}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-400 tracking-wider mb-1">{LABELS.validity} <span className="font-normal text-gray-500">(견적일로부터 30일)</span></h3>
            <p className="text-lg font-bold text-gray-800">{formatDateWithDay(dueDateStr)}</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 text-xs font-bold text-gray-400 tracking-wider w-[45%]">{LABELS.itemDesc}</th>
                <th className="py-2 text-xs font-bold text-gray-400 tracking-wider text-right w-[8%]">{LABELS.qty}</th>
                <th className="py-2 text-xs font-bold text-gray-400 tracking-wider text-right w-[14%]">{LABELS.price}</th>
                <th className="py-2 text-xs font-bold text-gray-400 tracking-wider text-right w-[10%]">{LABELS.discount}</th>
                <th className="py-2 text-xs font-bold text-gray-400 tracking-wider text-right w-[18%]">{LABELS.amount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(() => {
                // 항목 순서에서 카테고리 순서 추출 (중복 제거, 순서 유지)
                const seenSections = new Set<CategorySection>();
                const categoryOrder: CategorySection[] = [];
                for (const row of calculation.rows) {
                  if (!seenSections.has(row.section)) {
                    seenSections.add(row.section);
                    categoryOrder.push(row.section);
                  }
                }

                // 카테고리별로 그룹핑 (순서 유지)
                const grouped = categoryOrder.reduce((acc, section) => {
                  acc[section] = calculation.rows.filter(r => r.section === section);
                  return acc;
                }, {} as Record<string, typeof calculation.rows>);

                return categoryOrder.map(section => {
                  const rows = grouped[section];
                  if (!rows || rows.length === 0) return null;

                  // Section-specific colors for better distinction
                  const sectionColors: Record<string, { bg: string; border: string; text: string }> = {
                    Credit: { bg: 'from-purple-50 to-white', border: 'border-purple-500', text: 'text-purple-600' },
                    SaaS: { bg: 'from-blue-50 to-white', border: 'border-blue-500', text: 'text-blue-600' },
                    Service: { bg: 'from-teal-50 to-white', border: 'border-teal-500', text: 'text-teal-600' },
                    Option: { bg: 'from-amber-50 to-white', border: 'border-amber-500', text: 'text-amber-600' },
                  };
                  const colors = sectionColors[section] || { bg: 'from-gray-50 to-white', border: 'border-gray-500', text: 'text-gray-600' };

                  return (
                    <React.Fragment key={section}>
                      {/* Category Header */}
                      <tr className={`bg-gradient-to-r ${colors.bg}`}>
                        <td colSpan={5} className={`py-2.5 pl-4 border-l-4 ${colors.border}`}>
                          <div className="flex items-center h-full">
                            <span className={`text-sm font-bold ${colors.text}`}>{categoryLabels?.find(c => c.section === section)?.label || getCategoryLabel(section)}</span>
                          </div>
                        </td>
                      </tr>
                      {/* Category Items */}
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td className="py-2 pr-4 align-top">
                            <p className="font-bold text-gray-800 text-sm">{row.item}</p>
                            {(row.notes || row.note) && (
                              <div
                                className="text-xs mt-1 whitespace-pre-wrap notes-html"
                                dangerouslySetInnerHTML={{ __html: row.notes || row.note || '' }}
                              />
                            )}
                          </td>
                          <td className="py-2 text-right align-top text-sm font-medium text-gray-600">{nf.format(row.qty)}</td>
                          <td className="py-2 text-right align-top text-sm font-medium text-gray-600">{nf.format(row.unitPrice)}</td>
                          <td className="py-2 text-right align-top text-sm font-medium text-gray-600">{row.discountPct > 0 ? `${row.discountPct}%` : '-'}</td>
                          <td className="py-2 text-right align-top">
                            {row.discountPct > 0 ? (
                              <div className="text-right">
                                <div className="text-xs text-gray-400">(정가 {nf.format(row.price)})</div>
                                <div className="text-sm font-bold text-blue-600">{nf.format(row.offerPrice)}</div>
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-gray-800">{nf.format(row.offerPrice)}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                });
              })()}
            </tbody>
          </table>

          {calculation.rows.length === 0 && (
            <div className="text-center py-12 text-gray-300 text-sm">항목이 없습니다.</div>
          )}
        </div>

        {/* Summary */}
        <div className="mt-8 flex justify-end">
          <div className="w-[60%] bg-gray-50/70 overflow-hidden">
            {/* 상세 내역 */}
            <div className="p-5 space-y-2.5">
              {calculation.msrpSum > calculation.offerSum && (
                <>
                  {/* 정가 합계 */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-2 font-medium text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                      정가 합계
                    </span>
                    <span className="text-gray-400">{toKRW(calculation.msrpSum)}</span>
                  </div>
                  {/* 할인 금액 */}
                  <div className="flex justify-between items-center text-sm bg-red-50/80 -mx-5 px-5 py-2.5 border-l-2 border-red-400">
                    <span className="flex items-center gap-2 font-semibold text-red-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                      할인 금액 ({Math.round(calculation.totalDiscountPct)}%)
                    </span>
                    <span className="font-bold text-red-500">-{toKRW(calculation.msrpSum - calculation.offerSum)}</span>
                  </div>
                </>
              )}
              {/* 공급가액 */}
              <div className="flex justify-between items-center text-sm pt-1">
                <span className="flex items-center gap-2 font-medium text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  {LABELS.subtotal}
                </span>
                <span className="font-bold text-gray-800">{toKRW(calculation.offerSum)}</span>
              </div>
              {/* 부가세 */}
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 font-medium text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  {LABELS.tax} ({calculation.vatRate}%)
                </span>
                <span className="font-bold text-gray-800">{toKRW(calculation.vat)}</span>
              </div>
            </div>
            {/* 합계 - 브랜드 블루 배경 */}
            <div
              className="px-5 py-4 flex justify-between items-center"
              style={{
                background: 'linear-gradient(to right, #0070B0, #0ea5e9)',
                printColorAdjust: 'exact',
                WebkitPrintColorAdjust: 'exact'
              }}
            >
              <span className="flex items-center gap-2 font-bold text-white text-lg">
                <span className="w-2 h-2 rounded-full bg-white/80"></span>
                {LABELS.grandTotal}
              </span>
              <span className="font-black text-white text-xl tracking-tight">{toKRW(calculation.grand)}</span>
            </div>
          </div>
        </div>

        {/* Reference Notes */}
        {meta.referenceNotes && meta.referenceNotes.length > 0 && (
          <div className="mt-8 bg-gray-50 rounded-lg p-5 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 tracking-wider mb-3">
              {LABELS.notes}
            </h3>
            <div className="space-y-2 text-[12px] text-gray-600 leading-relaxed">
              {meta.referenceNotes.map((note, i) => {
                const displayNote = note
                  .replace('{customerName}', meta.customerName || '고객사')
                  .replace('{고객사명}', meta.customerName || '고객사');
                return displayNote.trim() && (
                  <p key={i} className="flex gap-2">
                    <span className="text-gray-400 shrink-0">{i + 1}.</span>
                    <span className="whitespace-pre-wrap">{displayNote}</span>
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer - FORCS 강점 */}
        <div className="mt-4">
          {/* FORCS 강점 아이콘 배너 */}
          <div className="bg-gray-50 p-3 border-t border-b border-gray-100">
            <img
              src="/forcs-strengths.png"
              alt="FORCS 강점 - 30년 업력, 100% 자체 기술력, 시장 점유율 1위, 글로벌 진출, IPO 상장, 50여 개 수상"
              className="w-full h-auto"
            />
          </div>
        </div>

      </main>
    </div>
  );
};
