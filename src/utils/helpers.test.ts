import { describe, it, expect } from 'vitest';
import { parseNum, clamp, safeParse } from './helpers';

describe('parseNum', () => {
    it('숫자 문자열을 파싱', () => {
        expect(parseNum('123')).toBe(123);
        expect(parseNum('45.67')).toBe(45.67);
        expect(parseNum('-100')).toBe(-100);
    });

    it('숫자 타입은 그대로 반환', () => {
        expect(parseNum(123)).toBe(123);
        expect(parseNum(0)).toBe(0);
        expect(parseNum(-50)).toBe(-50);
    });

    it('NaN이면 0 반환', () => {
        expect(parseNum('abc')).toBe(0);
        expect(parseNum('')).toBe(0);
        expect(parseNum(null)).toBe(0);
        expect(parseNum(undefined)).toBe(0);
        expect(parseNum(NaN)).toBe(0);
    });
});

describe('clamp', () => {
    it('범위 내 값은 그대로 반환', () => {
        expect(clamp(50, 0, 100)).toBe(50);
        expect(clamp(0, 0, 100)).toBe(0);
        expect(clamp(100, 0, 100)).toBe(100);
    });

    it('최솟값보다 작으면 최솟값 반환', () => {
        expect(clamp(-10, 0, 100)).toBe(0);
        expect(clamp(-1, 0, 100)).toBe(0);
    });

    it('최댓값보다 크면 최댓값 반환', () => {
        expect(clamp(150, 0, 100)).toBe(100);
        expect(clamp(101, 0, 100)).toBe(100);
    });

    it('음수 범위도 처리', () => {
        expect(clamp(-50, -100, -10)).toBe(-50);
        expect(clamp(-150, -100, -10)).toBe(-100);
        expect(clamp(0, -100, -10)).toBe(-10);
    });
});

describe('safeParse', () => {
    it('유효한 JSON 파싱', () => {
        expect(safeParse('{"a": 1}', null)).toEqual({ a: 1 });
        expect(safeParse('[1, 2, 3]', [])).toEqual([1, 2, 3]);
        expect(safeParse('"hello"', '')).toBe('hello');
    });

    it('null이나 빈 문자열은 fallback 반환', () => {
        expect(safeParse(null, 'fallback')).toBe('fallback');
        expect(safeParse('', { default: true })).toEqual({ default: true });
    });

    it('잘못된 JSON은 fallback 반환', () => {
        expect(safeParse('invalid json', null)).toBe(null);
        expect(safeParse('{broken', [])).toEqual([]);
    });

    it('URL 인코딩된 JSON 처리', () => {
        const encoded = encodeURIComponent('{"test": "value"}');
        expect(safeParse(encoded, null)).toEqual({ test: 'value' });
    });

    it('퍼센트 기호가 있지만 유효한 JSON이 아닌 경우', () => {
        expect(safeParse('100%', 'fallback')).toBe('fallback');
    });
});
