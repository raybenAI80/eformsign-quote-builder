import { QuoteItem, QuoteMeta } from '../types';

/**
 * 견적 품목 목록을 CSV 파일로 저장합니다.
 */
export const exportToCSV = (items: QuoteItem[], quoteNo: string = 'draft'): void => {
  const header = [
    'section',
    'category',
    'item',
    'unitLabel',
    'qty',
    'unitPrice',
    'discountPct',
    'notes',
  ];

  const lines = [header.join(',')].concat(
    items.map(row =>
      header
        .map(key => {
          const raw = row[key as keyof QuoteItem] ?? '';
          const value = String(raw).replace(/"/g, '""');
          return value.includes(',') || value.includes('\n') ? `"${value}"` : value;
        })
        .join(',')
    )
  );

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `eformsign_quote_${quoteNo}.csv`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};

/**
 * 견적 메타와 품목 목록을 JSON 파일로 저장합니다.
 */
export const exportToJSON = (items: QuoteItem[], meta: QuoteMeta): void => {
  const data = { meta, items };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `eformsign_quote_${meta.quoteNo || 'draft'}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};
