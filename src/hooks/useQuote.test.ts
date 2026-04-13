import { describe, it, expect } from 'vitest';
import { calculateQuote, buildQuoteNo, formatSequence, createDefaultMeta } from './useQuote';
import { QuoteItem } from '../types';

describe('formatSequence', () => {
    it('숫자만 남기고 제거', () => {
        expect(formatSequence('01')).toBe('01');
        expect(formatSequence('abc123')).toBe('123');
        expect(formatSequence('12-34-56')).toBe('123456');
    });

    it('최대 6자리까지만 허용', () => {
        expect(formatSequence('1234567890')).toBe('123456');
    });

    it('빈 문자열 처리', () => {
        expect(formatSequence('')).toBe('');
    });

    it('null/undefined 처리', () => {
        expect(formatSequence(null)).toBe('');
        expect(formatSequence(undefined)).toBe('');
    });
});

describe('buildQuoteNo', () => {
    it('정상적인 견적번호 생성', () => {
        const result = buildQuoteNo('KM', '2024-01-15', '01');
        expect(result).toBe('FORCS-EFS-KM-2024011501');
    });

    it('이니셜이 비어있으면 AA로 대체', () => {
        const result = buildQuoteNo('', '2024-01-15', '01');
        expect(result).toBe('FORCS-EFS-AA-2024011501');
    });

    it('이니셜을 대문자로 변환', () => {
        const result = buildQuoteNo('km', '2024-01-15', '01');
        expect(result).toBe('FORCS-EFS-KM-2024011501');
    });

    it('날짜 형식에서 하이픈 제거', () => {
        const result = buildQuoteNo('AB', '2024-12-31', '99');
        expect(result).toBe('FORCS-EFS-AB-2024123199');
    });
});

describe('calculateQuote', () => {
    const sampleItems: QuoteItem[] = [
        {
            id: '1',
            section: 'SaaS',
            category: '문서',
            item: '이폼사인 Enterprise 2,000건',
            unitLabel: '건',
            qty: 2000,
            unitPrice: 500,
            discountPct: 0,
            notes: '',
        },
        {
            id: '2',
            section: 'Service',
            category: '프리미엄 서비스',
            item: '문서 세팅',
            unitLabel: '건',
            qty: 3,
            unitPrice: 100000,
            discountPct: 100, // 무료
            notes: '',
        },
    ];

    it('정상적인 합계 계산', () => {
        const result = calculateQuote(sampleItems, 10);

        // 첫 번째 항목: 2000 * 500 = 1,000,000
        // 두 번째 항목: 3 * 100000 * (1 - 100/100) = 0
        expect(result.msrpSum).toBe(1300000); // 1,000,000 + 300,000
        expect(result.offerSum).toBe(1000000); // 1,000,000 + 0
        expect(result.vat).toBe(100000); // 1,000,000 * 10%
        expect(result.grand).toBe(1100000); // 1,000,000 + 100,000
    });

    it('할인율 적용', () => {
        const itemsWithDiscount: QuoteItem[] = [
            {
                id: '1',
                section: 'SaaS',
                category: '문서',
                item: '테스트',
                unitLabel: '건',
                qty: 100,
                unitPrice: 1000,
                discountPct: 30,
                notes: '',
            },
        ];

        const result = calculateQuote(itemsWithDiscount, 10);

        expect(result.msrpSum).toBe(100000); // 100 * 1000
        expect(result.offerSum).toBe(70000); // 100,000 * 0.7
        expect(result.totalDiscountPct).toBeCloseTo(30, 5);
    });

    it('빈 항목 배열 처리', () => {
        const result = calculateQuote([], 10);

        expect(result.msrpSum).toBe(0);
        expect(result.offerSum).toBe(0);
        expect(result.vat).toBe(0);
        expect(result.grand).toBe(0);
    });

    it('VAT 계산 (0%)', () => {
        const items: QuoteItem[] = [
            {
                id: '1',
                section: 'SaaS',
                category: '문서',
                item: '테스트',
                unitLabel: '건',
                qty: 1,
                unitPrice: 100000,
                discountPct: 0,
                notes: '',
            },
        ];

        const result = calculateQuote(items, 0);

        expect(result.vat).toBe(0);
        expect(result.grand).toBe(100000);
    });

    describe('지원사업용(subsidy) 모드', () => {
        const subsidyItems: QuoteItem[] = [
            {
                id: '1',
                section: 'SaaS',
                category: '문서',
                item: '테스트',
                unitLabel: '건',
                qty: 10,
                unitPrice: 100000,
                discountPct: 50, // 지원사업용에서는 무시되어야 함
                notes: '',
            },
        ];

        it('지원율 70% - 시나리오 B', () => {
            const result = calculateQuote(subsidyItems, 10, { sector: 'subsidy', subsidyRate: 70 });
            expect(result.msrpSum).toBe(1000000);
            expect(result.offerSum).toBe(1000000); // 행별 할인 무시
            expect(result.vat).toBe(100000); // 정가 × 10%
            expect(result.subsidyAmount).toBe(700000); // 정가 × 70%
            expect(result.grand).toBe(400000); // 1,000,000 + 100,000 - 700,000
            expect(result.isSubsidy).toBe(true);
            expect(result.subsidyRate).toBe(70);
        });

        it('지원율 0% - 엣지 케이스', () => {
            const result = calculateQuote(subsidyItems, 10, { sector: 'subsidy', subsidyRate: 0 });
            expect(result.subsidyAmount).toBe(0);
            expect(result.grand).toBe(1100000); // 1,000,000 + 100,000
        });

        it('지원율 100% - 엣지 케이스', () => {
            const result = calculateQuote(subsidyItems, 10, { sector: 'subsidy', subsidyRate: 100 });
            expect(result.subsidyAmount).toBe(1000000);
            expect(result.grand).toBe(100000); // VAT만 남음
        });

        it('지원율 clamp (음수 → 0)', () => {
            const result = calculateQuote(subsidyItems, 10, { sector: 'subsidy', subsidyRate: -10 });
            expect(result.subsidyRate).toBe(0);
        });

        it('지원율 clamp (100 초과 → 100)', () => {
            const result = calculateQuote(subsidyItems, 10, { sector: 'subsidy', subsidyRate: 150 });
            expect(result.subsidyRate).toBe(100);
        });

        it('일반 모드는 옵션 전달해도 기존 동작 유지 (회귀)', () => {
            const result = calculateQuote(subsidyItems, 10, { sector: 'general', subsidyRate: 70 });
            expect(result.isSubsidy).toBe(false);
            expect(result.subsidyAmount).toBe(0);
            expect(result.offerSum).toBe(500000); // 할인 50% 적용
            expect(result.vat).toBe(50000); // 공급가액 × 10%
            expect(result.grand).toBe(550000);
        });
    });
});

describe('createDefaultMeta', () => {
    it('기본 메타 데이터 생성', () => {
        const meta = createDefaultMeta();

        expect(meta.supplier).toBe('㈜포시에스');
        expect(meta.vatRate).toBe(10);
        expect(meta.validityDays).toBe(30);
        expect(meta.brandingMode).toBe('ai');
        expect(meta.sealMode).toBe('omitted');
        expect(meta.quoteDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD 형식
    });

    it('참고사항 기본값 포함', () => {
        const meta = createDefaultMeta();

        expect(meta.referenceNotes.length).toBeGreaterThan(0);
        expect(meta.referenceNotes[0]).toContain('eformsign');
    });
});
