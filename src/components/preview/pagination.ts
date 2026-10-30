/**
 * PDF "여러 쪽으로 나눔"의 쪽 나눔 계산.
 *
 * 순수 함수(paginate)와 DOM 측정(measureFlowPaper)을 나눠 둔다. 측정은 한 장짜리 용지(.qd-paper)의 실제 행 높이를 읽고,
 * paginate 는 그 숫자만으로 어느 행이 어느 쪽에 들어갈지 정한다. 노트 길이에 따라 행 높이가 다르므로 추정 높이를 쓰지 않는다.
 *
 * 쪽 구성(시안 A):
 *  - 1쪽 = 전체 머리(로고·제목·거래 정보 3칸) + 표 머리 + 품목 행. 하단(푸터) 없음.
 *  - 2쪽부터 = 얇은 연속 머리 + 표 머리 반복 + 품목 행.
 *  - 합계·결제정보·비고·푸터는 마지막 쪽에만.
 * 규칙: 행은 쪽 경계에서 쪼개지 않는다 / 구분 행만 쪽 끝에 남기지 않는다 / 구분이 쪽을 넘어 이어지면 다음 쪽 첫 행에
 * 구분 행을 "(계속)" 으로 다시 둔다 / 마지막 쪽에 합계만 남지 않게 품목을 최소 MIN_LAST_ITEMS 건 함께 둔다.
 */

export interface PaginationRow {
  kind: 'cat' | 'item';
  /** 행 높이(px, 화면 배율 1 기준) */
  h: number;
}

export interface PaginationInput {
  rows: PaginationRow[];
  /** 용지 한 쪽 높이(px) */
  pageH: number;
  /** 1쪽: 용지 위 가장자리 ~ 표 머리 행 아래 가장자리 */
  firstHeadH: number;
  /** 2쪽부터: 용지 위 가장자리 ~ 표 머리 행 아래 가장자리 (연속 머리 + 표 머리) */
  contHeadH: number;
  /** 마지막 쪽: 표 끝 아래 합계·비고·본문 아래 여백·푸터가 차지하는 높이 */
  tailH: number;
  /** 마지막이 아닌 쪽: 아래에 비워 둘 높이(쪽 번호 자리) */
  reservedH: number;
}

export interface PageSpec {
  /** rows[start, end) 가 이 쪽에 들어간다 */
  start: number;
  end: number;
  /** 이 쪽 맨 위에 "(계속)" 으로 다시 그릴 구분 행의 rows 인덱스. 없으면 null */
  carry: number | null;
}

/** 마지막 쪽에 함께 둘 품목 수(합계만 덩그러니 남는 쪽을 막는다) */
export const MIN_LAST_ITEMS = 3;
/** 측정 오차를 흡수하는 여유(px) */
export const SAFETY_PX = 6;

/** 연속 머리(.qd-thin)의 높이와 표 윗 여백. CSS(quotePreviewD.css)와 같은 값을 써야 한다. */
export const THIN_HEAD_H = 52;
export const TABLE_MARGIN_TOP = 24;
/** 쪽 번호 자리로 마지막이 아닌 쪽 아래를 비우는 높이 */
export const PAGE_NO_RESERVED_H = 56;

const sumH = (rows: PaginationRow[], from: number, to: number): number => {
  let s = 0;
  for (let i = from; i < to; i++) s += rows[i].h;
  return s;
};

/** rows[idx] 이전(포함)에서 가장 가까운 구분 행의 인덱스 */
const findCatAtOrBefore = (rows: PaginationRow[], idx: number): number | null => {
  for (let k = idx; k >= 0; k--) if (rows[k].kind === 'cat') return k;
  return null;
};

export function paginate(input: PaginationInput): PageSpec[] {
  const { rows, pageH, firstHeadH, contHeadH, tailH, reservedH } = input;
  const n = rows.length;
  if (n === 0) return [{ start: 0, end: 0, carry: null }];

  const pages: PageSpec[] = [];
  let i = 0;
  let carryIdx: number | null = null; // 이 쪽 맨 위에 다시 그릴 구분 행

  while (i < n) {
    const first = pages.length === 0;
    const headH = first ? firstHeadH : contHeadH;
    // 직전 쪽에서 이어지는 품목이면 구분 행을 맨 위에 다시 둔다
    const carry = rows[i].kind === 'item' ? carryIdx : null;
    const lead = carry !== null ? rows[carry].h : 0;

    // 남은 행 전부 + 합계·푸터가 이 쪽에 들어가면 마지막 쪽
    if (headH + lead + sumH(rows, i, n) + tailH + SAFETY_PX <= pageH) {
      pages.push({ start: i, end: n, carry });
      break;
    }

    // 아래를 쪽 번호 자리만큼 비우고 위에서부터 채운다
    const avail = pageH - headH - reservedH - SAFETY_PX;
    let used = lead;
    let j = i;
    while (j < n && used + rows[j].h <= avail) {
      used += rows[j].h;
      j++;
    }

    // 남은 행이 모두 들어가도 합계가 안 들어가는 경우(j == n)와, 남은 품목이 너무 적은 경우:
    // 마지막 쪽에 품목이 MIN_LAST_ITEMS 건 남도록 뒤쪽 행을 다음 쪽으로 넘긴다.
    let remainingItems = 0;
    for (let r = j; r < n; r++) if (rows[r].kind === 'item') remainingItems++;
    if (j >= n || remainingItems < MIN_LAST_ITEMS) {
      let items = remainingItems;
      while (j > i + 1 && items < MIN_LAST_ITEMS) {
        j--;
        if (rows[j].kind === 'item') items++;
      }
    }

    // 구분 행으로 끝나면 그 행을 다음 쪽으로 넘긴다(구분 행만 쪽 끝에 남기지 않는다)
    while (j > i && rows[j - 1].kind === 'cat') j--;

    // 한 행도 못 넣는 경우(행 하나가 쪽보다 큼 등): 진행을 보장하려고 구분 행 + 다음 행까지 강제로 넣는다
    if (j <= i) {
      j = i + 1;
      if (rows[i].kind === 'cat' && j < n) j++;
    }

    pages.push({ start: i, end: j, carry });
    carryIdx = j < n && rows[j].kind === 'item' ? findCatAtOrBefore(rows, j - 1) : null;
    i = j;
  }

  return pages;
}

/** 쪽 수·행 수 같은 요약. 화면 문구용. */
export function summarizePages(pages: PageSpec[], rows: PaginationRow[]): { pageCount: number; itemsPerPage: number[] } {
  return {
    pageCount: pages.length,
    itemsPerPage: pages.map(p => {
      let c = 0;
      for (let r = p.start; r < p.end; r++) if (rows[r].kind === 'item') c++;
      return c;
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM 측정
// ─────────────────────────────────────────────────────────────────────────────

export interface FlowMeasure extends PaginationInput {
  /** 한 장짜리 용지의 현재 높이(px) */
  paperH: number;
}

/**
 * 한 장짜리 용지(.paper.qd-paper, 푸터까지 전부 그린 것)를 읽어 쪽 나눔 입력을 만든다.
 * 미리보기는 CSS scale 로 줄어 있을 수 있으므로 getBoundingClientRect 값을 레이아웃 폭 대비 비율로 되돌린다.
 */
export function measureFlowPaper(paper: HTMLElement): FlowMeasure | null {
  const table = paper.querySelector<HTMLElement>('table.qd-items');
  const thead = table?.querySelector<HTMLElement>('thead');
  const body = paper.querySelector<HTMLElement>('.qd-body');
  const foot = paper.querySelector<HTMLElement>('.qd-foot');
  if (!table || !thead || !body || !foot) return null;

  const layoutW = parseFloat(getComputedStyle(paper).width);
  const paperRect = paper.getBoundingClientRect();
  if (!layoutW || !paperRect.width) return null;
  const scale = paperRect.width / layoutW;
  const px = (v: number) => v / scale;

  const trs = Array.from(table.querySelectorAll<HTMLElement>('tbody tr')).filter(tr => !tr.classList.contains('qd-empty'));
  const rows: PaginationRow[] = trs.map(tr => ({
    kind: tr.classList.contains('qd-cat') ? 'cat' : 'item',
    h: px(tr.getBoundingClientRect().height),
  }));

  const tableRect = table.getBoundingClientRect();
  const theadRect = thead.getBoundingClientRect();
  const tailEl = paper.querySelector<HTMLElement>('.qd-notes') ?? paper.querySelector<HTMLElement>('.qd-sumrow');
  const tailContent = tailEl ? px(tailEl.getBoundingClientRect().bottom - tableRect.bottom) : 0;
  const bodyPadBottom = parseFloat(getComputedStyle(body).paddingBottom) || 0;
  const paperPadTop = parseFloat(getComputedStyle(paper).paddingTop) || 0;

  const firstHeadH = px(theadRect.bottom - paperRect.top);
  const theadH = px(theadRect.height);

  return {
    rows,
    pageH: (layoutW * 297) / 210,
    firstHeadH,
    contHeadH: paperPadTop + THIN_HEAD_H + TABLE_MARGIN_TOP + theadH,
    tailH: tailContent + bodyPadBottom + foot.offsetHeight,
    reservedH: PAGE_NO_RESERVED_H,
    paperH: px(paperRect.height),
  };
}
