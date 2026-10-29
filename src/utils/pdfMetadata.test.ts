import { describe, expect, it, vi } from 'vitest';
import {
    applyPdfMetadata,
    buildMergedPdfTitle,
    buildPdfKeywords,
    buildPdfTitle,
    PDF_AUTHOR,
    PDF_CREATOR,
    PDF_SUBJECT,
} from './pdfMetadata';
import { getQuoteTitleText } from '../components/preview/quoteTitle';

describe('getQuoteTitleText (미리보기 제목과 공유)', () => {
    it('일반 / 공공 / AI 문구', () => {
        expect(getQuoteTitleText('default')).toBe('이폼사인 견적서');
        expect(getQuoteTitleText('public')).toBe('공공용 이폼사인 견적서');
        expect(getQuoteTitleText('ai')).toBe('이폼사인 AI 견적서');
    });

    it('값이 없으면 일반 견적서', () => {
        expect(getQuoteTitleText(undefined)).toBe('이폼사인 견적서');
    });
});

describe('buildPdfTitle', () => {
    it('일반 견적서: 제목 문구 + 견적번호 + 고객사명', () => {
        expect(
            buildPdfTitle({ brandingMode: 'default', quoteNo: 'FORCS-EFS-BC-1001', customerName: '(주)한빛물산' }),
        ).toBe('이폼사인 견적서 FORCS-EFS-BC-1001 (주)한빛물산');
    });

    it('공공 견적서: 공공용 접두를 붙인다', () => {
        expect(
            buildPdfTitle({ brandingMode: 'public', quoteNo: 'FORCS-EFS-BC-1002', customerName: '서울시청' }),
        ).toBe('공공용 이폼사인 견적서 FORCS-EFS-BC-1002 서울시청');
    });

    it('빈 값은 생략한다 (연속 공백 없음)', () => {
        expect(buildPdfTitle({ brandingMode: 'default', quoteNo: '', customerName: '(주)한빛물산' })).toBe(
            '이폼사인 견적서 (주)한빛물산',
        );
        expect(buildPdfTitle({ brandingMode: 'default', quoteNo: 'FORCS-EFS-BC-1001', customerName: '  ' })).toBe(
            '이폼사인 견적서 FORCS-EFS-BC-1001',
        );
        expect(buildPdfTitle({ brandingMode: 'default', quoteNo: '', customerName: '' })).toBe('이폼사인 견적서');
    });

    it('값 안의 연속 공백·줄바꿈은 한 칸으로 정리한다', () => {
        expect(buildPdfTitle({ brandingMode: 'default', quoteNo: ' A  B ', customerName: '가\n나' })).toBe(
            '이폼사인 견적서 A B 가 나',
        );
    });
});

describe('buildMergedPdfTitle / buildPdfKeywords', () => {
    it('병합 제목은 건수를 붙인다', () => {
        expect(buildMergedPdfTitle(3)).toBe('이폼사인 견적서 3건');
    });

    it('키워드에 고객사명·견적번호를 덧붙이고 빈 값은 뺀다', () => {
        expect(buildPdfKeywords({ quoteNo: 'Q-1', customerName: '(주)한빛물산' })).toBe(
            '견적서, 이폼사인, eformsign, (주)한빛물산, Q-1',
        );
        expect(buildPdfKeywords({ quoteNo: '', customerName: '' })).toBe('견적서, 이폼사인, eformsign');
    });
});

describe('applyPdfMetadata', () => {
    it('문서 정보와 언어를 jsPDF 에 기록한다', () => {
        const pdf = { setProperties: vi.fn(), setLanguage: vi.fn() };
        applyPdfMetadata(pdf as never, { title: '제목', keywords: '키' });
        expect(pdf.setProperties).toHaveBeenCalledWith({
            title: '제목',
            subject: PDF_SUBJECT,
            author: PDF_AUTHOR,
            creator: PDF_CREATOR,
            keywords: '키',
        });
        expect(pdf.setLanguage).toHaveBeenCalledWith('ko-KR');
        expect(PDF_AUTHOR).toBe('FORCS');
        expect(PDF_CREATOR).toBe('eformsign 견적서 빌더');
        expect(PDF_SUBJECT).toBe('견적서');
    });
});
