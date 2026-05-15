
export interface QuoteItem {
  id: string;
  section: 'SaaS' | 'Credit' | 'Service' | 'Option';
  category: string;
  item: string;
  unitLabel: string;
  qty: number;
  unitPrice: number | string;
  discountPct: number;
  /** 할인단가 직접 입력 시 저장. 있으면 discountPct 역산 대신 이 값 × qty로 계산 */
  offerUnitPrice?: number;
  notes: string;
  /** @deprecated Use `notes` instead. Legacy compatibility field. */
  note?: string;
}

export interface QuoteMeta {
  quoteNo: string;
  quoteDate: string;
  validityDays: number;
  customerName: string;
  customerManager: string;
  customerEmail: string;
  customerContact: string;
  supplier: string;
  contactInitials: string;
  issueSequence: string;
  contactName: string;
  contactTitle: string;
  contactDirect: string;
  contactMobile: string;
  contactEmail: string;
  salesManager: string;
  salesEmail: string;
  salesContact: string;
  vatRate: number;
  title: string;
  subtitle: string;
  sealMode: 'stamped' | 'omitted' | 'hidden';
  /** 직인 이미지 (base64 data URL). sealMode='stamped'일 때 사용 */
  sealImage?: string;
  /** 직인 크기 (px). 기본 48 */
  sealSize?: number;
  /** 직인 수평 오프셋 (px). 0=대표이사명 바로 옆 */
  sealOffsetX?: number;
  /** 직인 수직 오프셋 (px). 0=기본 위치 */
  sealOffsetY?: number;
  brandingMode: 'ai' | 'default' | 'public';
  referenceNotes: string[];
  bizNoLink: string;
  bankAccountLink: string;
  showDiscount?: boolean;
  sector?: 'general' | 'public' | 'subsidy';
  /** 지원사업용(subsidy) 모드에서 정가합계에 적용하는 지원율 (%) */
  subsidyRate?: number;
}

export interface CalculatedRow extends QuoteItem {
  msrp: number;
  offer: number;
  // Compatibility fields added at runtime
  price: number;
  offerPrice: number;
  discountRate: number;
  note?: string;
}

export interface CalculationResult {
  rows: CalculatedRow[];
  msrpSum: number;
  offerSum: number;
  vat: number;
  vatRate: number;
  grand: number;
  supplyPriceSum: number;
  vatSum: number;
  totalDiscountPct: number;
  docsPaidQty: number;
  perDocPaid: number;
  /** 지원사업용일 때 정가합계 × 지원율로 계산된 금액 (그 외 0) */
  subsidyAmount: number;
  /** 지원율 (%) - subsidy 모드에서만 의미 */
  subsidyRate: number;
  /** 계산이 지원사업용 모드였는지 플래그 */
  isSubsidy: boolean;
}

export interface QuotePreset {
  id: string;
  name: string;
  createdAt: string;
  meta: QuoteMeta;
  items: QuoteItem[];
  summary?: {
    msrpSum: number;
    offerSum: number;
    grand: number;
  };
}

export interface QuoteSnapshot {
  id: string;
  label: string;
  createdAt: string;
  meta: QuoteMeta;
  items: QuoteItem[];
  summary: {
    msrpSum: number;
    offerSum: number;
    grand: number;
  };
}

export interface SavedQuote {
  id: string;
  name: string;
  meta: QuoteMeta;
  items: QuoteItem[];
  savedAt: string;
  summary?: {
    msrpSum: number;
    offerSum: number;
    grand: number;
  };
}
