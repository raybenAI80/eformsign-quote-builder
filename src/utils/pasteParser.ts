import { QuoteItem } from '../types';
import { parseNum, clamp } from './helpers';

/**
 * 붙여넣은 헤더 텍스트를 QuoteItem 필드에 매핑합니다.
 */
export const headerMap = (h: string): keyof Omit<QuoteItem, 'id'> | null => {
  const t = h.trim().toLowerCase();
  if (/section|섹션|구분/.test(t)) return 'section';
  if (/category|카테고리|분류/.test(t)) return 'category';
  if (/item|항목|품목/.test(t)) return 'item';
  if (/unitlabel|단위/.test(t)) return 'unitLabel';
  if (/qty|수량|건수|quantity/.test(t)) return 'qty';
  if (/unitprice|단가|price/.test(t)) return 'unitPrice';
  if (/discount|할인/.test(t)) return 'discountPct';
  if (/note|비고|메모/.test(t)) return 'notes';
  return null;
};

/**
 * 붙여넣기 데이터를 QuoteItem 배열로 변환합니다.
 */
export const parsePastedTable = (text: string): QuoteItem[] => {
  const csvSplit = /\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map(line => line.split(csvSplit));
  if (!rows.length) return [];

  let useHeader = false;
  const mapIdx: { [key in keyof Omit<QuoteItem, 'id'>]?: number } = {};

  if (rows[0]) {
    const mapping = rows[0].map(headerMap);
    if (mapping.some(Boolean)) {
      useHeader = true;
      mapping.forEach((key, idx) => {
        if (key) mapIdx[key] = idx;
      });
    }
  }

  const body = useHeader ? rows.slice(1) : rows;
  const idx = <K extends keyof Omit<QuoteItem, 'id'>>(key: K, def: number): number =>
    useHeader ? mapIdx[key] ?? def : def;

  return body
    .filter(row => row.some(Boolean))
    .map(cols => {
      const section = cols[idx('section', 0)] === 'Service' ? 'Service' : 'SaaS';
      return {
        id: crypto.randomUUID(),
        section,
        category:
          (cols[idx('category', 1)] || (section === 'Service' ? '컨설팅' : '문서 생성')).trim(),
        item: (cols[idx('item', 2)] || '').trim(),
        unitLabel:
          (cols[idx('unitLabel', 3)] || (section === 'Service' ? '회' : '건')).trim(),
        qty: parseNum(cols[idx('qty', 4)]),
        unitPrice: parseNum(cols[idx('unitPrice', 5)]),
        discountPct: clamp(parseNum(cols[idx('discountPct', 6)]), 0, 100),
        notes: (cols[idx('notes', 7)] || '').trim(),
      };
    });
};