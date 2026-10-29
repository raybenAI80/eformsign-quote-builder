/**
 * 견적서 출력물 글꼴 로더 (Paperlogy 제목 / Pretendard 본문) — PDF 텍스트 레이어용
 *
 * 화면은 woff2(@font-face, preview/quotePreviewD.css), PDF 텍스트 레이어는 같은 글꼴의 TTF 다.
 * jsPDF 는 woff2 를 못 읽는다. 파일은 public/fonts/design-d/ (tools/build-design-fonts.py 로 만든다).
 * jsPDF 는 굵기를 normal/bold 둘만 알아서 두 가중치를 이렇게 대응시킨다.
 *   Paperlogy : 6 SemiBold -> normal, 8 ExtraBold -> bold
 *   Pretendard: Regular    -> normal, SemiBold   -> bold
 */

import jsPDF from 'jspdf';

const FONT_TTF = {
    paperlogySemiBold: '/fonts/design-d/Paperlogy-6SemiBold.ttf',
    paperlogyExtraBold: '/fonts/design-d/Paperlogy-8ExtraBold.ttf',
    pretendardRegular: '/fonts/design-d/Pretendard-Regular.ttf',
    pretendardSemiBold: '/fonts/design-d/Pretendard-SemiBold.ttf',
};

/** 화면 캡처 전에 미리 불러둘 @font-face (document.fonts) */
const SCREEN_FACES = [
    '600 14px "Paperlogy"',
    '800 14px "Paperlogy"',
    '400 14px "Pretendard"',
    '600 14px "Pretendard"',
];

let fontCache: Record<keyof typeof FONT_TTF, string> | null = null;

/**
 * TTF 파일을 Base64로 변환
 */
async function fetchFontAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`font fetch failed: ${url} (${response.status})`);
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
 * 화면 글꼴(woff2)을 브라우저에 미리 불러온다. html2canvas 가 글자를 그리는 시점에
 * 아직 로드 전이면 대체 글꼴로 찍히므로, 캡처·텍스트 추출 전에 기다려야 한다.
 */
export async function loadScreenFonts(): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts) return;
    await Promise.all(SCREEN_FACES.map(face => document.fonts.load(face)));
    await document.fonts.ready;
}

/** PDF 텍스트 레이어용 TTF 를 불러와 캐시한다 */
export async function loadPdfFonts(): Promise<void> {
    if (fontCache) return;
    try {
        const entries = await Promise.all(
            (Object.keys(FONT_TTF) as (keyof typeof FONT_TTF)[]).map(
                async key => [key, await fetchFontAsBase64(FONT_TTF[key])] as const
            )
        );
        fontCache = Object.fromEntries(entries) as Record<keyof typeof FONT_TTF, string>;
    } catch (error) {
        console.error('Failed to load PDF fonts:', error);
        throw new Error('폰트 로딩 실패');
    }
}

/** jsPDF 인스턴스에 Paperlogy·Pretendard 를 등록한다 (loadPdfFonts 이후) */
export function registerPdfFonts(pdf: jsPDF): void {
    if (!fontCache) {
        console.warn('PDF fonts not loaded, text layer will use the fallback font');
        return;
    }
    const add = (file: string, key: keyof typeof FONT_TTF, family: string, style: 'normal' | 'bold') => {
        pdf.addFileToVFS(file, fontCache![key]);
        pdf.addFont(file, family, style);
    };
    add('Paperlogy-6SemiBold.ttf', 'paperlogySemiBold', 'Paperlogy', 'normal');
    add('Paperlogy-8ExtraBold.ttf', 'paperlogyExtraBold', 'Paperlogy', 'bold');
    add('Pretendard-Regular.ttf', 'pretendardRegular', 'Pretendard', 'normal');
    add('Pretendard-SemiBold.ttf', 'pretendardSemiBold', 'Pretendard', 'bold');
}

export interface PdfFontChoice {
    family: 'Paperlogy' | 'Pretendard';
    style: 'normal' | 'bold';
}

/**
 * 화면 요소의 computed font-family / font-weight 에 대응하는 jsPDF 글꼴을 고른다.
 * Paperlogy 는 700 이상이면 bold, 그 밖의 글꼴은 Pretendard 로 대체하며 600 이상이면 bold.
 */
export function resolvePdfFont(cssFontFamily: string, cssFontWeight: number): PdfFontChoice {
    const first = cssFontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
    if (first === 'paperlogy') {
        return { family: 'Paperlogy', style: cssFontWeight >= 700 ? 'bold' : 'normal' };
    }
    return { family: 'Pretendard', style: cssFontWeight >= 600 ? 'bold' : 'normal' };
}
