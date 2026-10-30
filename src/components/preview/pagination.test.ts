import { describe, it, expect } from 'vitest';
import { paginate, MIN_LAST_ITEMS, SAFETY_PX, type PaginationInput, type PaginationRow } from './pagination';

const cat = (h = 37.5): PaginationRow => ({ kind: 'cat', h });
const item = (h = 55): PaginationRow => ({ kind: 'item', h });

/** 실측값(26건 일반 견적서)에 가까운 입력. 높이는 px. */
const base = (rows: PaginationRow[], over: Partial<PaginationInput> = {}): PaginationInput => ({
  rows,
  pageH: 1587,
  firstHeadH: 426,
  contHeadH: 149,
  tailH: 640,
  reservedH: 56,
  ...over,
});

const group = (label: number, items: number, h = 55): PaginationRow[] => [cat(), ...Array.from({ length: items }, () => item(h))];
const itemsIn = (rows: PaginationRow[], s: { start: number; end: number }) => rows.slice(s.start, s.end).filter(r => r.kind === 'item').length;

describe('paginate', () => {
  it('행이 없으면 빈 1쪽', () => {
    expect(paginate(base([]))).toEqual([{ start: 0, end: 0, carry: null }]);
  });

  it('한 장에 들어가면 1쪽, 이어짐 없음', () => {
    const rows = [...group(0, 3)];
    const pages = paginate(base(rows));
    expect(pages).toEqual([{ start: 0, end: rows.length, carry: null }]);
  });

  it('26건이 두 구분에 걸치면 2쪽, 모든 행이 한 번씩만 들어간다', () => {
    const rows = [...group(0, 13), ...group(1, 13)];
    const pages = paginate(base(rows));
    expect(pages.length).toBe(2);
    expect(pages[0].start).toBe(0);
    expect(pages[pages.length - 1].end).toBe(rows.length);
    for (let p = 1; p < pages.length; p++) expect(pages[p].start).toBe(pages[p - 1].end);
  });

  it('쪽마다 높이 합이 쪽 높이를 넘지 않는다(마지막 쪽은 합계·푸터 포함)', () => {
    const input = base([...group(0, 40), ...group(1, 10)]);
    const pages = paginate(input);
    pages.forEach((pg, idx) => {
      const last = idx === pages.length - 1;
      const head = idx === 0 ? input.firstHeadH : input.contHeadH;
      const lead = pg.carry !== null ? input.rows[pg.carry].h : 0;
      const used = head + lead + input.rows.slice(pg.start, pg.end).reduce((s, r) => s + r.h, 0);
      const limit = last ? input.pageH - input.tailH : input.pageH - input.reservedH;
      expect(used).toBeLessThanOrEqual(limit);
    });
  });

  it('구분 행만 쪽 끝에 홀로 남기지 않는다', () => {
    // 1쪽 끝 직전에 구분 행이 오도록 높이를 맞춘다
    const rows = [...group(0, 11), ...group(1, 12)];
    for (let reserved = 30; reserved <= 200; reserved += 7) {
      const pages = paginate(base(rows, { reservedH: reserved }));
      pages.forEach(pg => {
        if (pg.end > pg.start) expect(rows[pg.end - 1].kind).toBe('item');
      });
    }
  });

  it('구분이 쪽을 넘어 이어지면 다음 쪽에서 그 구분 행을 다시 그린다', () => {
    const rows = [...group(0, 30)];
    const pages = paginate(base(rows));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].carry).toBeNull();
    for (let p = 1; p < pages.length; p++) {
      expect(pages[p].carry).toBe(0); // 구분 행은 rows[0] 하나뿐
    }
  });

  it('새 구분으로 시작하는 쪽은 이어짐 표시를 하지 않는다', () => {
    const rows = [...group(0, 8), ...group(1, 8)];
    // 1쪽 끝이 정확히 첫 구분 끝이 되도록 크게 키운 높이
    const pages = paginate(base(rows, { reservedH: 1587 - 426 - (37.5 + 8 * 55) - 20 - SAFETY_PX, tailH: 900 }));
    const starts = pages.map(p => rows[p.start].kind);
    pages.forEach((pg, idx) => {
      if (starts[idx] === 'cat') expect(pg.carry).toBeNull();
    });
  });

  it(`마지막 쪽에는 품목이 최소 ${MIN_LAST_ITEMS}건 함께 놓인다(합계만 남는 쪽 방지)`, () => {
    // 표는 1쪽에 들어가지만 합계·푸터가 안 들어가는 구간을 훑는다
    for (let count = 8; count <= 40; count++) {
      const rows = group(0, count);
      const pages = paginate(base(rows));
      if (pages.length === 1) continue;
      const last = pages[pages.length - 1];
      expect(itemsIn(rows, last)).toBeGreaterThanOrEqual(MIN_LAST_ITEMS);
    }
  });

  it('품목이 최소 건수보다 적으면 가능한 만큼만 둔다(무한 루프·빈 쪽 없음)', () => {
    const rows = [cat(), item(900), item(900)];
    const pages = paginate(base(rows));
    expect(pages.length).toBeGreaterThanOrEqual(1);
    pages.forEach(pg => expect(pg.end).toBeGreaterThan(pg.start));
    expect(pages[pages.length - 1].end).toBe(rows.length);
  });

  it('행 하나가 쪽보다 커도 진행한다', () => {
    const rows = [cat(), item(2000), item(55), item(55), item(55)];
    const pages = paginate(base(rows));
    expect(pages[pages.length - 1].end).toBe(rows.length);
    for (let p = 1; p < pages.length; p++) expect(pages[p].start).toBe(pages[p - 1].end);
  });

  it('행 높이가 섞여 있어도(1줄 행·긴 노트) 쪽 높이를 넘지 않는다', () => {
    const rows: PaginationRow[] = [cat()];
    for (let i = 0; i < 60; i++) rows.push(item(i % 7 === 0 ? 110 : i % 3 === 0 ? 38 : 55));
    const input = base(rows);
    const pages = paginate(input);
    pages.forEach((pg, idx) => {
      const last = idx === pages.length - 1;
      const head = idx === 0 ? input.firstHeadH : input.contHeadH;
      const lead = pg.carry !== null ? rows[pg.carry].h : 0;
      const used = head + lead + rows.slice(pg.start, pg.end).reduce((s, r) => s + r.h, 0);
      expect(used + (last ? input.tailH : input.reservedH)).toBeLessThanOrEqual(input.pageH);
    });
  });

  it('품목 50건은 3쪽 이상이고 모든 품목이 정확히 한 번씩 나온다', () => {
    const rows = [...group(0, 20), ...group(1, 20), ...group(2, 10)];
    const pages = paginate(base(rows));
    expect(pages.length).toBeGreaterThanOrEqual(3);
    const total = pages.reduce((s, pg) => s + itemsIn(rows, pg), 0);
    expect(total).toBe(50);
  });
});
