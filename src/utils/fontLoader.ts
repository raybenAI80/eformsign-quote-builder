/**
 * NanumSquare 폰트 로더 for jsPDF
 * CDN에서 폰트를 로드하고 jsPDF에 등록합니다.
 */

import jsPDF from 'jspdf';

// NanumSquare (일반) CDN URLs - @1.0 버전 사용 (@2.0은 404)
const FONT_URLS = {
    regular: 'https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@1.0/NanumSquareR.ttf',
    bold: 'https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@1.0/NanumSquareB.ttf',
};

// 캐시된 폰트 데이터
let fontCache: { regular?: string; bold?: string } = {};
let isLoaded = false;

/**
 * TTF 파일을 Base64로 변환
 */
async function fetchFontAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // ArrayBuffer를 Base64로 변환
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
}

/**
 * NanumSquare 폰트를 로드하고 캐시
 */
export async function loadNanumSquareFonts(): Promise<void> {
    if (isLoaded) return;

    try {
        console.log('Loading NanumSquare fonts from CDN...');
        const [regular, bold] = await Promise.all([
            fetchFontAsBase64(FONT_URLS.regular),
            fetchFontAsBase64(FONT_URLS.bold),
        ]);

        fontCache = { regular, bold };
        isLoaded = true;
        console.log('NanumSquare fonts loaded successfully');
    } catch (error) {
        console.error('Failed to load NanumSquare fonts:', error);
        throw new Error('폰트 로딩 실패');
    }
}

/**
 * jsPDF 인스턴스에 NanumSquare 폰트 등록
 */
export function registerNanumSquareFont(pdf: jsPDF): void {
    if (!fontCache.regular || !fontCache.bold) {
        console.warn('NanumSquare fonts not loaded, using default font');
        return;
    }

    try {
        // Regular 폰트 등록
        pdf.addFileToVFS('NanumSquare-Regular.ttf', fontCache.regular);
        pdf.addFont('NanumSquare-Regular.ttf', 'NanumSquare', 'normal');

        // Bold 폰트 등록
        pdf.addFileToVFS('NanumSquare-Bold.ttf', fontCache.bold);
        pdf.addFont('NanumSquare-Bold.ttf', 'NanumSquare', 'bold');

        // 등록된 폰트 확인
        const fontList = pdf.getFontList();
        console.log('Registered fonts in PDF:', fontList);

        if (fontList['NanumSquare']) {
            console.log('✅ NanumSquare font registered successfully:', fontList['NanumSquare']);
        } else {
            console.error('❌ NanumSquare font NOT found in font list!');
        }
    } catch (error) {
        console.error('Error registering font:', error);
    }
}
