import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  QuoteItem,
  QuoteMeta,
  CalculationResult,
  CalculatedRow,
  QuotePreset,
  QuoteSnapshot,
} from '../types';
import { parseNum, clamp, safeParse } from '../utils/helpers';
import { DATA_KEY, SUPPLIER_PROFILE, CategoryLabel, DEFAULT_CATEGORY_LABELS, DEFAULT_REFERENCE_NOTES } from '../constants';

interface StoredQuoteData {
  meta: QuoteMeta;
  items: QuoteItem[];
  presets?: QuotePreset[];
  history?: QuoteSnapshot[];
  categoryLabels?: CategoryLabel[];
}

const HISTORY_LIMIT = 10;
const PRESET_LIMIT = 10;

const generateId = (): string => {
  // crypto is available in modern browsers and Node.js 19+
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    buffer[6] = (buffer[6] & 0x0f) | 0x40;
    buffer[8] = (buffer[8] & 0x3f) | 0x80;
    const hex = Array.from(buffer, b => b.toString(16).padStart(2, '0'));
    return (
      hex.slice(0, 4).join('') +
      '-' +
      hex.slice(4, 6).join('') +
      '-' +
      hex.slice(6, 8).join('') +
      '-' +
      hex.slice(8, 10).join('') +
      '-' +
      hex.slice(10, 16).join('')
    );
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const formatSequence = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  // Keep only digits, do not auto-pad; cap length to avoid runaway input
  return digits.slice(0, 6);
};

export const buildQuoteNo = (initials: string | null | undefined, quoteDate: string | null | undefined, sequence: string | null | undefined): string => {
  const cleanedInitials = (initials || '').trim().toUpperCase() || 'AA';
  const datePart = quoteDate
    ? quoteDate.replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seqPart = formatSequence(sequence);
  return `FORCS-EFS-${cleanedInitials}-${datePart}${seqPart}`;
};

export const createDefaultMeta = (): QuoteMeta => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    quoteNo: '',
    quoteDate: today,
    validityDays: 30,
    validityMonths: 1,
    customerName: '',
    customerManager: '',
    customerEmail: '',
    customerContact: '',
    supplier: SUPPLIER_PROFILE.companyName,
    contactInitials: '',
    issueSequence: '',
    contactName: '',
    contactTitle: '',
    contactDirect: '',
    contactMobile: '',
    contactEmail: '',
    salesManager: '',
    salesEmail: '',
    salesContact: '',
    vatRate: 10,
    title: '이폼사인 견적서',
    subtitle: '',
    brandingMode: 'ai',
    sealMode: 'omitted',
    referenceNotes: [
      '본 견적은 『{customerName}의 전자계약 플랫폼 eformsign 도입』에 한하여 적용되는 견적입니다.',
      '계약기간: 계약 시작일로 부터 1년입니다.',
      '문서 사용기한: 계약 시작일로부터 최대 2년까지 사용할 수 있습니다.',
      '문서 소진 시, 본 견적에 포함된 사항 외에 별도로 사용된 유료 옵션은 실제 사용량에 따라 일괄 청구됩니다.',
      '클라우드 서비스 업데이트에 따라 추가된 신규 기능은 전면 무상 제공 (일부 기능은 유상, 반영 전 공지)',
      'Trial 기간 동안 API 연동에 대한 기술지원 요청 발생 시, 유선 및 원격 지원',
      '본 계약은 상호 신뢰를 바탕으로 계약을 체결하며, 이에 대한 분쟁이 있을 경우 상관례에 따라 상호 협의에 의하여 분쟁을 해결합니다.',
      '기타 사항은 www.eformsign.com 이용약관에 따릅니다.',
    ],
    bizNoLink: SUPPLIER_PROFILE.bizNoLink,
    bankAccountLink: SUPPLIER_PROFILE.bankAccountLink,
    showDiscount: true,
    sector: 'general',
    subsidyRate: 0,
    roundingUnit: 0,
  };
};

// 빈 상태로 새 견적을 시작할 때 사용할 메타 (오늘 날짜만 채우고 나머지는 비움)
export const createEmptyMeta = (): QuoteMeta => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    quoteNo: '',
    quoteDate: today,
    validityDays: 0,
    customerName: '',
    customerManager: '',
    supplier: '',
    contactInitials: '',
    issueSequence: '',
    contactName: '',
    contactTitle: '',
    contactDirect: '',
    contactMobile: '',
    contactEmail: '',
    customerEmail: '',
    customerContact: '',
    salesManager: '',
    salesEmail: '',
    salesContact: '',
    vatRate: 10,
    title: '',
    subtitle: '',
    brandingMode: 'ai',
    sealMode: 'omitted',
    referenceNotes: [...DEFAULT_REFERENCE_NOTES],
    bizNoLink: SUPPLIER_PROFILE.bizNoLink,
    bankAccountLink: SUPPLIER_PROFILE.bankAccountLink,
    showDiscount: true,
    sector: 'general',
    subsidyRate: 0,
    roundingUnit: 0,
  };
};

const cloneMeta = (meta: QuoteMeta): QuoteMeta => ({ ...meta });
const cloneItems = (items: QuoteItem[]): QuoteItem[] => items.map(item => ({ ...item }));

const ensureMetaDefaults = (meta: QuoteMeta & { aiBranding?: boolean }): QuoteMeta => {
  const legacyAi = typeof meta.aiBranding === 'boolean' ? meta.aiBranding : undefined;
  const defaultNotes = [
    '본 견적은 『{customerName}의 전자계약 플랫폼 eformsign 도입』에 한하여 적용되는 견적입니다.',
    '계약기간: 계약 시작일로 부터 1년입니다.',
    '문서 사용기한: 계약 시작일로부터 최대 2년까지 사용할 수 있습니다.',
    '문서 소진 시, 본 견적에 포함된 사항 외에 별도로 사용된 유료 옵션은 실제 사용량에 따라 일괄 청구됩니다.',
    '클라우드 서비스 업데이트에 따라 추가된 신규 기능은 전면 무상 제공 (일부 기능은 유상, 반영 전 공지)',
    'Trial 기간 동안 API 연동에 대한 기술지원 요청 발생 시, 유선 및 원격 지원',
    '본 계약은 상호 신뢰를 바탕으로 계약을 체결하며, 이에 대한 분쟁이 있을 경우 상관례에 따라 상호 협의에 의하여 분쟁을 해결합니다.',
    '기타 사항은 www.eformsign.com 이용약관에 따릅니다.',
  ];
  return {
    ...meta,
    supplier: SUPPLIER_PROFILE.companyName,
    customerName: meta.customerName ?? '',
    customerManager: meta.customerManager ?? '',
    brandingMode:
      (typeof legacyAi === 'boolean' ? (legacyAi ? 'ai' : 'default') : meta.brandingMode ?? 'ai'),
    referenceNotes: meta.referenceNotes?.length ? meta.referenceNotes : defaultNotes,
    showDiscount: meta.showDiscount !== false,
    sector: meta.sector ?? 'general',
    subsidyRate: typeof meta.subsidyRate === 'number' ? meta.subsidyRate : 0,
    roundingUnit: typeof meta.roundingUnit === 'number' ? meta.roundingUnit : 0,
    validityMonths: typeof meta.validityMonths === 'number' && meta.validityMonths > 0 ? meta.validityMonths : 1,
  };
};

export interface CalculateQuoteOptions {
  sector?: 'general' | 'public' | 'subsidy';
  subsidyRate?: number;
  /** 끝전 절사 단위 (10000 | 100000 | 1000000). 0/미설정 = 사용 안 함 */
  roundingUnit?: number;
}

export const calculateQuote = (
  items: QuoteItem[],
  vatRate: number,
  options: CalculateQuoteOptions = {}
): CalculationResult => {
  const rate = vatRate / 100;
  const isSubsidy = options.sector === 'subsidy';
  const subsidyRate = Math.max(0, Math.min(100, parseNum(options.subsidyRate ?? 0)));

  const rows: CalculatedRow[] = items.map(item => {
    const numericPrice = parseNum(item.unitPrice);
    const qty = parseNum(item.qty);
    const discountPct = parseNum(item.discountPct);

    const msrp = numericPrice * qty;
    // 지원사업용 모드: 행별 할인 무시 → offer = msrp
    // 할인단가 직접 입력(offerUnitPrice)이 있으면 % 역산 없이 직접 계산 (반올림 오차 방지)
    let offer: number;
    if (isSubsidy) {
      offer = msrp;
    } else if (typeof item.offerUnitPrice === 'number' && item.offerUnitPrice >= 0 && numericPrice > 0) {
      offer = item.offerUnitPrice * qty;
    } else {
      offer = Math.round(msrp * (1 - discountPct / 100));
    }

    return {
      ...item,
      qty,
      unitPrice: item.unitPrice, // preserve original (number or string)
      discountPct,
      msrp,
      offer,
      // Compatibility fields
      price: msrp,
      offerPrice: offer,
      discountRate: discountPct,
    };
  });

  const msrpSum = rows.reduce((sum, row) => sum + row.msrp, 0);
  const offerSum = rows.reduce((sum, row) => sum + row.offer, 0);

  // 부가세 기준: 지원사업용일 때는 정가합계(MSRP), 그 외는 공급가액
  const vatBase = isSubsidy ? msrpSum : offerSum;
  const vat = Math.round(vatBase * rate);

  // 지원금: 지원사업용일 때만 정가합계 × 지원율(%)
  const subsidyAmount = isSubsidy
    ? Math.round(msrpSum * subsidyRate / 100)
    : 0;

  // 합계: 지원사업용은 정가합계 + 부가세 - 지원금, 그 외는 공급가액 + 부가세
  const grand = isSubsidy
    ? msrpSum + vat - subsidyAmount
    : offerSum + vat;

  // totalDiscountPct: 지원사업용일 때는 지원율, 그 외는 기존 계산
  const totalDiscountPct = isSubsidy
    ? subsidyRate
    : (msrpSum > 0 ? (1 - offerSum / msrpSum) * 100 : 0);

  // Calculate docsPaidQty and perDocPaid for compatibility
  let docsPaidQty = 0;
  let docsPaidOffer = 0;
  rows.forEach(r => {
    const isDoc = r.section === 'SaaS' && (String(r.unitLabel ?? '').includes('건') || String(r.category ?? '').includes('문서'));
    if (isDoc && r.discountPct < 100) {
      docsPaidQty += r.qty;
      docsPaidOffer += r.offer;
    }
  });
  const perDocPaid = docsPaidQty > 0 ? docsPaidOffer / docsPaidQty : 0;

  // 끝전 절사: 합계를 단위(만원/십만원/백만원)로 내림한 뒤 공급가액·부가세를 역산한다.
  // 역산으로 "공급가액 + 부가세 = 합계"를 유지해 세금계산서 구조와 어긋나지 않게 한다.
  // 지원사업용(subsidy)은 합계 산식이 "정가합계 + 부가세 - 지원금"이라 역산이 성립하지 않으므로 미적용.
  // 합계가 단위보다 작으면 견적이 0원이 되므로 미적용.
  const requestedRoundingUnit = Math.max(0, Math.floor(parseNum(options.roundingUnit ?? 0)));
  const applyRounding = !isSubsidy && requestedRoundingUnit > 0 && grand >= requestedRoundingUnit;

  const roundedGrand = applyRounding
    ? Math.floor(grand / requestedRoundingUnit) * requestedRoundingUnit
    : grand;
  const roundedOfferSum = applyRounding ? Math.round(roundedGrand / (1 + rate)) : offerSum;
  // 1원 단위 반올림 잔차는 부가세가 흡수 (공급가액 + 부가세 = 합계 보장)
  const roundedVat = applyRounding ? roundedGrand - roundedOfferSum : vat;
  const roundingCut = applyRounding ? grand - roundedGrand : 0;

  return {
    rows,
    msrpSum,
    offerSum: roundedOfferSum,
    vat: roundedVat,
    vatRate,
    grand: roundedGrand,
    supplyPriceSum: roundedOfferSum,
    vatSum: roundedVat,
    totalDiscountPct,
    // 할인 금액은 절사 전 공급가액 기준 — 절사분이 할인으로 중복 표기되는 것을 방지
    discountAmount: msrpSum - offerSum,
    docsPaidQty,
    perDocPaid,
    subsidyAmount,
    subsidyRate: isSubsidy ? subsidyRate : 0,
    isSubsidy,
    roundingCut,
    roundingUnit: applyRounding ? requestedRoundingUnit : 0,
  };
};

export const useQuote = () => {
  const [meta, setMeta] = useState<QuoteMeta>(() => createDefaultMeta());
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [presets, setPresets] = useState<QuotePreset[]>([]);
  const [history, setHistory] = useState<QuoteSnapshot[]>([]);
  const [categoryLabels, setCategoryLabels] = useState<CategoryLabel[]>(() => [...DEFAULT_CATEGORY_LABELS]);

  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const raw =
      localStorage.getItem(DATA_KEY) || localStorage.getItem('eformsign_quote_simple') || '';
    if (!raw) return;

    const parsed = safeParse<StoredQuoteData | null>(raw, null);
    if (parsed?.meta && parsed?.items) {
      setMeta(ensureMetaDefaults(parsed.meta));
      setItems(parsed.items);
      if (parsed.presets) setPresets(parsed.presets);
      if (parsed.history) setHistory(parsed.history);
      if (parsed.categoryLabels) setCategoryLabels(parsed.categoryLabels);
    }
  }, []);

  useEffect(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      const payload: StoredQuoteData = { meta, items, presets, history, categoryLabels };
      localStorage.setItem(DATA_KEY, JSON.stringify(payload));
      saveTimeoutRef.current = null;
    }, 300);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [meta, items, presets, history, categoryLabels]);

  useEffect(() => {
    setMeta(prev => {
      const normalizedSequence = formatSequence(prev.issueSequence);
      // 빈 이니셜/순번이면 자동 생성하지 않아 초기화 시 필드가 비워진 상태를 유지
      if (!prev.contactInitials && !normalizedSequence) return prev;
      const computed = buildQuoteNo(prev.contactInitials, prev.quoteDate, normalizedSequence);
      if (prev.quoteNo === computed && prev.issueSequence === normalizedSequence) return prev;
      return { ...prev, quoteNo: computed, issueSequence: normalizedSequence };
    });
  }, [meta.contactInitials, meta.quoteDate, meta.issueSequence]);

  useEffect(() => {
    setMeta(prev => ensureMetaDefaults(prev));
  }, []);

  const calculation = useMemo<CalculationResult>(() => {
    return calculateQuote(items, meta.vatRate, {
      sector: meta.sector,
      subsidyRate: meta.subsidyRate,
      roundingUnit: meta.roundingUnit,
    });
  }, [items, meta.vatRate, meta.sector, meta.subsidyRate, meta.roundingUnit]);

  const savePreset = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const preset: QuotePreset = {
        id: generateId(),
        name: trimmed,
        createdAt: new Date().toISOString(),
        meta: cloneMeta(meta),
        items: cloneItems(items),
        summary: {
          msrpSum: calculation.msrpSum,
          offerSum: calculation.offerSum,
          grand: calculation.grand,
        },
      };
      setPresets(prev => [preset, ...prev].slice(0, PRESET_LIMIT));
    },
    [meta, items, calculation]
  );

  const addRow = useCallback((row: Omit<QuoteItem, 'id'>) => {
    setItems(prev => [...prev, { id: generateId(), ...row }]);
  }, []);

  const addManyRows = useCallback((factory: () => Omit<QuoteItem, 'id'>, n: number) => {
    const newItems = Array.from({ length: clamp(n, 1, 999) }, () => ({
      id: generateId(),
      ...factory(),
    }));
    setItems(prev => [...prev, ...newItems]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setItems(prev => prev.filter(r => r.id !== id));
  }, []);

  const updateRow = useCallback((id: string, patch: Partial<QuoteItem>) => {
    setItems(prev =>
      prev.some(r => r.id === id) ? prev.map(r => (r.id === id ? { ...r, ...patch } : r)) : prev
    );
  }, []);

  const duplicateRow = useCallback((id: string) => {
    setItems(prev => {
      const found = prev.find(r => r.id === id);
      return found ? [...prev, { ...found, id: generateId() }] : prev;
    });
  }, []);

  const resetQuote = useCallback(() => {
    setMeta(createEmptyMeta());
    setItems([]);
    setHistory([]);
    localStorage.removeItem(DATA_KEY);
  }, []);

  const applyPreset = useCallback(
    (id: string) => {
      const preset = presets.find(p => p.id === id);
      if (!preset) return;
      setMeta(ensureMetaDefaults(cloneMeta(preset.meta)));
      setItems(cloneItems(preset.items));
    },
    [presets]
  );

  const applyPresetAsNew = useCallback(
    (id: string) => {
      const preset = presets.find(p => p.id === id);
      if (!preset) return;

      // Load meta but reset key fields for a "new" quote
      const newMeta = ensureMetaDefaults(cloneMeta(preset.meta));
      const defaults = createDefaultMeta();

      newMeta.quoteNo = defaults.quoteNo;
      newMeta.quoteDate = defaults.quoteDate;
      newMeta.validityDays = defaults.validityDays;
      newMeta.issueSequence = ''; // Reset sequence

      setMeta(newMeta);
      setItems(cloneItems(preset.items));
    },
    [presets]
  );

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
  }, []);

  const saveSnapshot = useCallback(
    (label?: string) => {
      const entry: QuoteSnapshot = {
        id: generateId(),
        label: label?.trim() || `${meta.quoteNo} 스냅샷`,
        createdAt: new Date().toISOString(),
        meta: cloneMeta(meta),
        items: cloneItems(items),
        summary: {
          msrpSum: calculation.msrpSum,
          offerSum: calculation.offerSum,
          grand: calculation.grand,
        },
      };
      setHistory(prev => [entry, ...prev].slice(0, HISTORY_LIMIT));
    },
    [meta, items, calculation]
  );

  const deleteSnapshot = useCallback((id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  }, []);

  const restoreSnapshot = useCallback(
    (id: string) => {
      const snapshot = history.find(h => h.id === id);
      if (!snapshot) return;
      setMeta(ensureMetaDefaults(cloneMeta(snapshot.meta)));
      setItems(cloneItems(snapshot.items));
    },
    [history]
  );

  const actions = {
    setMeta,
    setItems,
    addRow,
    addManyRows,
    removeRow,
    updateRow,
    duplicateRow,
    resetQuote,
    savePreset,
    applyPreset,
    loadPreset: applyPreset,
    applyPresetAsNew,
    deletePreset,
    saveSnapshot,
    deleteSnapshot,
    restoreSnapshot,
    clearHistory: useCallback(() => {
      setHistory([]);
    }, []),
    reorderRow: useCallback((activeId: string, overId: string) => {
      setItems((prev) => {
        const oldIndex = prev.findIndex((item) => item.id === activeId);
        const newIndex = prev.findIndex((item) => item.id === overId);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;

        const newItems = [...prev];
        const [movedItem] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, movedItem);
        return newItems;
      });
    }, []),
    // Category label actions
    setCategoryLabels,
    updateCategoryLabel: useCallback((section: string, label: string, labelEn?: string) => {
      setCategoryLabels(prev =>
        prev.map(cat =>
          cat.section === section
            ? { ...cat, label, labelEn: labelEn ?? cat.labelEn }
            : cat
        )
      );
    }, []),
    resetCategoryLabels: useCallback(() => {
      setCategoryLabels([...DEFAULT_CATEGORY_LABELS]);
    }, []),
  };

  return { meta, items, calculation, presets, history, categoryLabels, actions };
};
