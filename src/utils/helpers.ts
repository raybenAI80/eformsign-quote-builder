export const parseNum = (v: any): number => {
  const parsed = parseFloat(v);
  return isNaN(parsed) ? 0 : parsed;
};

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  const candidates: string[] = [raw];

  if (raw.includes('%')) {
    try {
      candidates.push(decodeURIComponent(raw));
    } catch (_ignored) {
      // 퍼센트 인코딩이 아니면 무시
    }
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_ignored) {
      // 다음 후보 시도
    }
  }

  return fallback;
};
