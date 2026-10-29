import type jsPDF from 'jspdf';
import type { QuoteMeta } from '../types';
import { getQuoteTitleText } from '../components/preview/quoteTitle';

/** PDF 문서 정보(파일 속성)에 들어가는 고정값 */
export const PDF_AUTHOR = 'FORCS';
export const PDF_CREATOR = 'eformsign 견적서 빌더';
export const PDF_SUBJECT = '견적서';
export const PDF_LANGUAGE = 'ko-KR';

export interface PdfInfo {
    title: string;
    keywords: string;
}

const clean = (value: string | undefined | null): string => (value ?? '').replace(/\s+/g, ' ').trim();

/**
 * 단일 견적서의 PDF 제목: `<제목 문구> <견적번호> <고객사명>`.
 * 견적번호·고객사명이 비어 있으면 그 항목만 생략한다. 제목 문구는 미리보기와 같은 규칙(공공용 접두)을 쓴다.
 */
export function buildPdfTitle(meta: Pick<QuoteMeta, 'brandingMode' | 'quoteNo' | 'customerName'>): string {
    return [getQuoteTitleText(meta.brandingMode), clean(meta.quoteNo), clean(meta.customerName)]
        .filter(Boolean)
        .join(' ');
}

/** 병합 PDF 의 제목: `이폼사인 견적서 N건` */
export function buildMergedPdfTitle(count: number): string {
    return `이폼사인 견적서 ${count}건`;
}

/** 단일 견적서의 검색 키워드. 고객사명·견적번호가 있으면 덧붙인다. */
export function buildPdfKeywords(meta: Pick<QuoteMeta, 'quoteNo' | 'customerName'>): string {
    return ['견적서', '이폼사인', 'eformsign', clean(meta.customerName), clean(meta.quoteNo)]
        .filter(Boolean)
        .join(', ');
}

export const MERGED_PDF_KEYWORDS = '견적서, 이폼사인, eformsign, 병합';

/** 문서 정보(제목·주제·작성자·생성 도구·키워드)와 문서 언어를 jsPDF 문서에 기록한다. */
export function applyPdfMetadata(pdf: jsPDF, info: PdfInfo): void {
    pdf.setProperties({
        title: info.title,
        subject: PDF_SUBJECT,
        author: PDF_AUTHOR,
        creator: PDF_CREATOR,
        keywords: info.keywords,
    });
    pdf.setLanguage(PDF_LANGUAGE);
}
