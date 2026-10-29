import { QuoteMeta, CalculationResult, CalculatedRow } from '../../types';
import { SUPPLIER_PROFILE, getCategoryLabel, CategorySection } from '../../constants';
import { addValidityEndLocal, parseLocalDate } from '../../hooks/useQuote';

/**
 * 견적서 미리보기의 표시 규칙.
 * 어떤 항목을 보이는지, 만료일·카테고리 묶음·요약 줄이 무엇인지는 여기서 한 번만 계산한다.
 * QuotePreviewD 는 이 결과를 그리기만 한다.
 */

export interface PreviewPanelProps {
  meta: QuoteMeta;
  calculation: CalculationResult;
  categoryLabels?: { section: string; label: string }[];
  showPolicies: boolean;
}

/**
 * 레거시 <font color="..."> 태그를 <span style="color:..."> 로 변환.
 * execCommand('foreColor')는 기본적으로 <font color> 를 생성하는데, 부모의
 * color 상속 때문에 렌더링이 무시되는 경우가 있어 inline style로 정규화한다.
 */
export const normalizeRichText = (html: string): string => {
  if (!html) return html;
  return html
    .replace(/<font\b([^>]*?)\scolor=(["'])([^"']+)\2([^>]*)>/gi,
      (_m, pre, _q, color, post) => `<span${pre} style="color:${color}"${post}>`)
    .replace(/<\/font>/gi, '</span>');
};

export const LABELS = {
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
  amount: '금액(원)',
  subtotal: '공급가액',
  tax: '부가세',
  grandTotal: '합계',
  notes: '참고사항',
};

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' → 한글 요일 한 글자 (로컬 날짜 기준) */
export const getDayName = (dateStr: string): string => DAY_NAMES[parseLocalDate(dateStr).getDay()];

/** 할인율이 적용된 단가 (표의 `→ 할인단가` 표기). 숫자 단가에서만 의미가 있다. */
export const discountedUnitPrice = (unitPrice: number, discountPct: number): number =>
  Math.round(unitPrice * (1 - discountPct / 100));

/** 단가가 비었거나 숫자가 아니면 금액 칸에 `-` 만 보인다 */
export const isAmountBlank = (row: Pick<CalculatedRow, 'unitPrice'>): boolean =>
  typeof row.unitPrice !== 'number' && (row.unitPrice === '' || isNaN(Number(row.unitPrice)));

export interface CategoryGroup {
  section: CategorySection;
  label: string;
  rows: CalculatedRow[];
}

export interface PreviewModel {
  isStamped: boolean;
  isSubsidy: boolean;
  discountLabel: string;
  discountAmountLabel: string;
  /** 행별 할인 열(할인율·→ 할인단가·(정가))을 보이는가. 지원사업용에서는 숨김 */
  showRowDiscount: boolean;
  validityMonths: number;
  /** 견적 기한 만료일 (견적일 당일 포함, addValidityEndLocal) */
  dueDateStr: string;
  hasEnterprise: boolean;
  /** 항목 순서에서 뽑은 카테고리 묶음 (중복 제거, 순서 유지) */
  groups: CategoryGroup[];
  /** 요약 칸 줄 표시 여부 */
  showDiscountLines: boolean;
  showSubsidyLine: boolean;
  showRoundingLine: boolean;
  contactEmailText: string;
  hasContactPhone: boolean;
}

export const getPreviewModel = (
  meta: QuoteMeta,
  calculation: CalculationResult,
  categoryLabels?: { section: string; label: string }[]
): PreviewModel => {
  const showDiscount = meta.showDiscount !== false;
  const isSubsidy = meta.sector === 'subsidy';

  // 견적 기한: 견적일 당일을 포함해 N개월 (기본 1개월). N개월 뒤 같은 날의 전날이 만료일이고,
  // 그 날짜가 없으면(월말 초과) 해당 월 말일 (로컬 날짜 기준)
  const validityMonths = meta.validityMonths && meta.validityMonths > 0 ? meta.validityMonths : 1;

  const seen = new Set<CategorySection>();
  const groups: CategoryGroup[] = [];
  for (const row of calculation.rows) {
    if (seen.has(row.section)) continue;
    seen.add(row.section);
    groups.push({
      section: row.section,
      label: categoryLabels?.find(c => c.section === row.section)?.label || getCategoryLabel(row.section),
      rows: calculation.rows.filter(r => r.section === row.section),
    });
  }

  return {
    isStamped: meta.sealMode === 'stamped',
    isSubsidy,
    discountLabel: isSubsidy ? '지원율' : '할인율',
    discountAmountLabel: isSubsidy ? '지원 금액' : '할인 금액',
    showRowDiscount: showDiscount && !isSubsidy,
    validityMonths,
    dueDateStr: addValidityEndLocal(meta.quoteDate, validityMonths),
    hasEnterprise: calculation.rows.some(r => r.section === 'SaaS' && String(r.item).includes('Enterprise')),
    groups,
    showDiscountLines: !isSubsidy && showDiscount && calculation.discountAmount > 0,
    showSubsidyLine: isSubsidy && calculation.subsidyAmount > 0,
    showRoundingLine: !isSubsidy && calculation.roundingCut > 0,
    contactEmailText: meta.contactEmail
      ? (meta.contactEmail.includes('@') ? meta.contactEmail : `${meta.contactEmail}@forcs.com`)
      : SUPPLIER_PROFILE.salesEmail,
    hasContactPhone: Boolean(meta.contactMobile || meta.contactDirect),
  };
};
