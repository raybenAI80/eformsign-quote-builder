
export interface QuoteItem {
  id: string;
  section: 'SaaS' | 'Credit' | 'Service' | 'Option';
  category: string;
  item: string;
  unitLabel: string;
  qty: number;
  unitPrice: number | string;
  discountPct: number;
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
  sealMode: 'stamped' | 'omitted';
  brandingMode: 'ai' | 'default' | 'public';
  referenceNotes: string[];
  bizNoLink: string;
  bankAccountLink: string;
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
