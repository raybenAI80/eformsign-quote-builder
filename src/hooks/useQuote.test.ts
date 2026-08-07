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

    describe('끝전 절사', () => {
        // 단일 항목으로 합계를 정확히 만들기 위한 헬퍼
        const itemsWithUnitPrice = (unitPrice: number): QuoteItem[] => [
            {
                id: '1',
                section: 'SaaS',
                category: '문서',
                item: '테스트',
                unitLabel: '건',
                qty: 1,
                unitPrice,
                discountPct: 0,
                notes: '',
            },
        ];

        // 공급가액 75,000,273 → 부가세 7,500,027 → 합계 82,500,300 (지저분한 끝전)
        const messyItems = itemsWithUnitPrice(75000273);

        it('단위 0(기본) - 기존 계산과 완전히 동일 (회귀)', () => {
            const base = calculateQuote(messyItems, 10);
            const withOption = calculateQuote(messyItems, 10, { roundingUnit: 0 });

            expect(base.offerSum).toBe(75000273);
            expect(base.vat).toBe(7500027);
            expect(base.grand).toBe(82500300);
            expect(base.roundingCut).toBe(0);
            expect(base.roundingUnit).toBe(0);

            expect(withOption.offerSum).toBe(base.offerSum);
            expect(withOption.vat).toBe(base.vat);
            expect(withOption.grand).toBe(base.grand);
            expect(withOption.roundingCut).toBe(0);
            expect(withOption.roundingUnit).toBe(0);
        });

        it('백만원 단위 - 82,500,300 → 82,000,000 (실제 영업 시나리오)', () => {
            const result = calculateQuote(messyItems, 10, { roundingUnit: 1000000 });

            expect(result.grand).toBe(82000000);
            expect(result.roundingCut).toBe(500300); // 82,500,300 - 82,000,000
            expect(result.roundingUnit).toBe(1000000);
            // 공급가액·부가세는 절사 전 금액 그대로 (역산하지 않음)
            expect(result.offerSum).toBe(75000273);
            expect(result.vat).toBe(7500027);
            expect(result.offerSum + result.vat - result.roundingCut).toBe(result.grand);
            expect(result.supplyPriceSum).toBe(result.offerSum);
            expect(result.vatSum).toBe(result.vat);
            // 정가합계는 절사 전 기준 유지
            expect(result.msrpSum).toBe(75000273);
        });

        it('만원 단위 - 1,358,024 → 1,350,000', () => {
            // 공급가액 1,234,567 → 부가세 123,457 → 합계 1,358,024
            const result = calculateQuote(itemsWithUnitPrice(1234567), 10, { roundingUnit: 10000 });

            expect(result.grand).toBe(1350000);
            expect(result.roundingCut).toBe(8024);
            expect(result.offerSum).toBe(1234567); // 절사 전 그대로
            expect(result.vat).toBe(123457);
            expect(result.offerSum + result.vat - result.roundingCut).toBe(result.grand);
        });

        it('십만원 단위 - 1,358,024 → 1,300,000', () => {
            const result = calculateQuote(itemsWithUnitPrice(1234567), 10, { roundingUnit: 100000 });

            expect(result.grand).toBe(1300000);
            expect(result.roundingCut).toBe(58024);
            expect(result.offerSum).toBe(1234567); // 절사 전 그대로
            expect(result.vat).toBe(123457);
            expect(result.offerSum + result.vat - result.roundingCut).toBe(result.grand);
        });

        it('합계 < 절사 단위 - 미적용 (견적이 0원이 되는 것 방지)', () => {
            // 공급가액 100,000 → 부가세 10,000 → 합계 110,000
            const result = calculateQuote(itemsWithUnitPrice(100000), 10, { roundingUnit: 1000000 });

            expect(result.grand).toBe(110000);
            expect(result.offerSum).toBe(100000);
            expect(result.vat).toBe(10000);
            expect(result.roundingCut).toBe(0);
            expect(result.roundingUnit).toBe(0);
        });

        it('이미 딱 떨어지는 합계 - 절사액 0, 합계 그대로', () => {
            // 공급가액 1,000,000 → 부가세 100,000 → 합계 1,100,000
            const result = calculateQuote(itemsWithUnitPrice(1000000), 10, { roundingUnit: 100000 });

            expect(result.grand).toBe(1100000);
            expect(result.roundingCut).toBe(0);
            expect(result.offerSum).toBe(1000000);
            expect(result.vat).toBe(100000);
            expect(result.offerSum + result.vat - result.roundingCut).toBe(result.grand);
        });

        it('지원사업용 모드 - 절사 단위를 설정해도 미적용', () => {
            const subsidyItems: QuoteItem[] = [
                {
                    id: '1',
                    section: 'SaaS',
                    category: '문서',
                    item: '테스트',
                    unitLabel: '건',
                    qty: 10,
                    unitPrice: 100000,
                    discountPct: 0,
                    notes: '',
                },
            ];

            const result = calculateQuote(subsidyItems, 10, {
                sector: 'subsidy',
                subsidyRate: 65,
                roundingUnit: 100000,
            });

            // 정가 1,000,000 + 부가세 100,000 - 지원금 650,000 = 450,000
            // 절사가 적용됐다면 400,000이 되었을 것
            expect(result.grand).toBe(450000);
            expect(result.roundingCut).toBe(0);
            expect(result.roundingUnit).toBe(0);
            expect(result.isSubsidy).toBe(true);
        });

        it('할인 금액은 절사 전 기준 유지 - 절사분이 할인으로 중복 표기되지 않음', () => {
            // 할인이 전혀 없는 견적: 절사를 켜도 할인 금액은 0이어야 한다
            const noDiscount = calculateQuote(messyItems, 10, { roundingUnit: 1000000 });
            expect(noDiscount.discountAmount).toBe(0);
            expect(noDiscount.totalDiscountPct).toBe(0);
            expect(noDiscount.roundingCut).toBe(500300);

            // 할인이 있는 견적: 할인 금액은 절사와 무관하게 동일해야 한다
            const discounted: QuoteItem[] = [
                {
                    id: '1',
                    section: 'SaaS',
                    category: '문서',
                    item: '테스트',
                    unitLabel: '건',
                    qty: 1,
                    unitPrice: 2000000,
                    discountPct: 30,
                    notes: '',
                },
            ];
            const off = calculateQuote(discounted, 10, { roundingUnit: 0 });
            const on = calculateQuote(discounted, 10, { roundingUnit: 1000000 });
            expect(off.discountAmount).toBe(600000); // 2,000,000 × 30%
            expect(on.discountAmount).toBe(600000); // 절사를 켜도 동일
            expect(on.roundingCut).toBeGreaterThan(0);
        });

        it('정부·공공(public) 모드에서도 적용', () => {
            const result = calculateQuote(messyItems, 10, { sector: 'public', roundingUnit: 1000000 });

            expect(result.grand).toBe(82000000);
            expect(result.roundingCut).toBe(500300);
            expect(result.offerSum + result.vat - result.roundingCut).toBe(result.grand);
        });

        it('세로 합산 항등식 - 공급가액 + 부가세 - 절사액 = 합계 (모든 단위)', () => {
            // 견적서 요약란이 위에서 아래로 그대로 더해져야 한다.
            for (const unit of [0, 10000, 100000, 1000000]) {
                for (const price of [75000273, 1234567, 2000000, 100000]) {
                    const r = calculateQuote(itemsWithUnitPrice(price), 10, { roundingUnit: unit });

                    // 세로 합산
                    expect(r.offerSum + r.vat - r.roundingCut).toBe(r.grand);
                    // 부가세는 표시되는 공급가액 기준으로 그대로 성립
                    expect(r.vat).toBe(Math.round(r.offerSum * 0.1));
                    // 정가합계 - 할인 금액 = 공급가액
                    expect(r.msrpSum - r.discountAmount).toBe(r.offerSum);
                }
            }
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
