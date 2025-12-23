export const nf = new Intl.NumberFormat('ko-KR');

export const toKRW = (amount: number): string =>
  `${nf.format(Math.round(Number(amount || 0)))}원`;
