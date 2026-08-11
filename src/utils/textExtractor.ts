/**
 * DOM에서 텍스트 요소를 추출하여 PDF 좌표로 변환
 *
 * PDF는 DOM 렌더 결과를 그대로 축소한 이미지 위에 투명 텍스트 레이어를 올린다.
 * 따라서 좌표뿐 아니라 글자 크기(fontSize)와 줄 높이(lineHeight)도
 * 동일한 축척(pxToMm)으로 변환해야 드래그 선택 하이라이트가 이미지와 일치한다.
 */

import { measureBaselinePx } from './html2canvasMetrics';

/** 1pt = 0.3527...mm */
export const MM_PER_PT = 0.3527777778;

/** 문자 단위 분할을 시도할 최대 길이 (레이아웃 질의 비용 가드) */
const MAX_CHARS_FOR_SPLIT = 600;

/** 같은 줄로 간주할 top 좌표 허용 오차 (px) */
const LINE_TOLERANCE_PX = 1;

export interface TextElement {
    text: string;
    x: number;          // PDF mm — 줄 좌측
    /**
     * PDF mm — Range.getClientRects()가 돌려주는 rect의 상단.
     *
     * ★ 이건 line box 상단이 아니라 "글리프 박스(ascent+descent)" 상단이다.
     *   (실측: 14px NanumSquare → rect.height 16px = ascent 12 + descent 4,
     *    line-height 20px/24px 어느 쪽이든 rect.height는 16px로 동일)
     *   html2canvas도 정확히 같은 rect를 기준으로 글자를 그리므로, 이 값 위에
     *   baselineMm만 더하면 이미지 글리프와 정확히 겹친다.
     */
    y: number;
    fontSize: number;   // pt — 반올림하지 않은 실제 렌더 크기
    isBold: boolean;
    /**
     * PDF mm — y(글리프 박스 상단)에서 baseline까지의 거리.
     * html2canvas가 쓰는 것과 동일한 탐침으로 측정한다. 추정 공식이 아니다.
     */
    baselineMm: number;
    /** PDF mm — rect 높이(ascent+descent). 진단/로깅용. */
    glyphBoxHeight: number;
}

/**
 * 폰트 크기 추출 (px → pt)
 *
 * ★ pxToMm(실제 PDF 축척)을 거쳐 변환한다.
 *   px * 0.75 는 96dpi(1px = 0.2646mm) 가정이라, 프리뷰가 축소되어
 *   PDF에 들어갈 때 글자만 원본 크기로 커지는 문제가 있었다.
 *   반올림도 하지 않는다 (13px → 9.75pt를 10pt로 올리면 렌더와 어긋남).
 */
function getFontSizePt(element: Element, pxToMm: number): number {
    const computed = window.getComputedStyle(element);
    const pxSize = parseFloat(computed.fontSize) || 12;
    return (pxSize * pxToMm) / MM_PER_PT;
}

/**
 * 글리프 박스 상단 → baseline 거리를 mm로 구한다.
 *
 * ★ 폰트 지표를 추정하지 않고, html2canvas가 이미지를 그릴 때 쓰는 것과
 *   동일한 탐침으로 측정한다. 그래야 이미지 글리프와 텍스트 레이어가
 *   같은 좌표계를 공유한다.
 */
function getBaselineMm(element: Element, pxToMm: number): number {
    const computed = window.getComputedStyle(element);
    return measureBaselinePx(computed.fontFamily, computed.fontSize) * pxToMm;
}

/**
 * 폰트 굵기 확인
 */
function isBoldFont(element: Element): boolean {
    const computed = window.getComputedStyle(element);
    const weight = parseInt(computed.fontWeight) || 400;
    return weight >= 600;
}

/**
 * 요소가 실제로 보이는지 확인
 */
function isVisible(element: Element): boolean {
    const computed = window.getComputedStyle(element);
    return (
        computed.display !== 'none' &&
        computed.visibility !== 'hidden' &&
        parseFloat(computed.opacity) > 0
    );
}

/**
 * jsPDF는 '\n'을 줄바꿈으로 처리하므로, 실제로는 한 줄로 렌더되는
 * 소스상의 줄바꿈은 공백으로 접어준다.
 */
function normalizeText(raw: string): string {
    return raw.replace(/\s*[\r\n]+\s*/g, ' ').trim();
}

interface LineSegment {
    text: string;
    left: number;   // px (viewport)
    top: number;    // px (viewport)
    height: number; // px — line box 높이
}

/**
 * 텍스트 노드를 "실제로 렌더된 줄" 단위로 분할한다.
 *
 * Range API로 문자 하나씩 위치를 구해 top 좌표로 그룹핑하므로
 * CSS 래핑(word-wrap)과 white-space:pre-wrap의 명시적 줄바꿈을 모두 처리하고,
 * 각 줄의 실제 left(가운데/우측 정렬 포함)를 그대로 얻는다.
 */
function splitIntoRenderedLines(textNode: Text): LineSegment[] {
    const raw = textNode.textContent ?? '';
    const segments: LineSegment[] = [];
    const range = document.createRange();

    let chars: string[] = [];
    let left = 0;
    let top = 0;
    let bottom = 0;
    let leftLocked = false;
    let open = false;

    const flush = () => {
        if (!open) return;
        const text = normalizeText(chars.join(''));
        if (text) {
            segments.push({ text, left, top, height: bottom - top });
        }
        chars = [];
        open = false;
        leftLocked = false;
    };

    for (let i = 0; i < raw.length; i++) {
        range.setStart(textNode, i);
        range.setEnd(textNode, i + 1);
        const rect = range.getBoundingClientRect();
        const ch = raw[i];

        // 렌더되지 않는 문자(줄바꿈 문자, 접힌 공백 등)는 현재 줄에 붙여두고 trim으로 정리
        if (rect.width === 0 && rect.height === 0) {
            if (open) chars.push(ch);
            continue;
        }

        if (open && Math.abs(rect.top - top) <= LINE_TOLERANCE_PX) {
            chars.push(ch);
            // 줄 시작의 공백은 trim되므로, 첫 '보이는' 문자의 left를 줄의 x로 삼는다
            if (!leftLocked && ch.trim()) {
                left = rect.left;
                leftLocked = true;
            }
            if (rect.bottom > bottom) bottom = rect.bottom;
        } else {
            flush();
            open = true;
            chars = [ch];
            left = rect.left;
            leftLocked = ch.trim().length > 0;
            top = rect.top;
            bottom = rect.bottom;
        }
    }
    flush();

    return segments;
}

/**
 * DOM 컨테이너에서 텍스트 요소들을 추출
 */
export function extractTextElements(
    container: HTMLElement,
    containerRect: DOMRect,
    pxToMm: number,
    yOffset: number = 0
): TextElement[] {
    const elements: TextElement[] = [];
    const processedTexts = new Set<string>(); // 중복 방지

    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const text = node.textContent?.trim();
                if (!text) return NodeFilter.FILTER_REJECT;

                const parent = node.parentElement;
                if (!parent || !isVisible(parent)) return NodeFilter.FILTER_REJECT;
                if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let textNode: Text | null;
    while ((textNode = walker.nextNode() as Text | null)) {
        const parent = textNode.parentElement;
        if (!parent) continue;

        const raw = textNode.textContent ?? '';
        if (!raw.trim()) continue;

        const fontSize = getFontSizePt(parent, pxToMm);
        const isBold = isBoldFont(parent);
        const baselineMm = getBaselineMm(parent, pxToMm);

        const range = document.createRange();
        range.selectNodeContents(textNode);
        const rects = range.getClientRects();
        if (rects.length === 0) continue;

        // 여러 줄로 렌더된 경우에만 문자 단위 분할 (단일 줄은 rect 하나로 충분)
        let segments: LineSegment[] = [];
        if (rects.length > 1 && raw.length <= MAX_CHARS_FOR_SPLIT) {
            segments = splitIntoRenderedLines(textNode);
        }

        if (segments.length === 0) {
            const rect = rects[0];
            if (rect.width === 0 || rect.height === 0) continue;
            const text = normalizeText(raw);
            if (!text) continue;
            segments = [{ text, left: rect.left, top: rect.top, height: rect.height }];
        }

        for (const seg of segments) {
            if (seg.height <= 0) continue;

            // 중복 방지: 같은 텍스트가 같은 위치에 이미 있으면 스킵
            const uniqueKey = `${seg.text.substring(0, 30)}-${Math.round(seg.left)}-${Math.round(seg.top)}`;
            if (processedTexts.has(uniqueKey)) continue;
            processedTexts.add(uniqueKey);

            elements.push({
                text: seg.text,
                x: (seg.left - containerRect.left) * pxToMm,
                y: (seg.top - containerRect.top) * pxToMm + yOffset,
                fontSize,
                isBold,
                baselineMm,
                glyphBoxHeight: seg.height * pxToMm,
            });
        }
    }

    console.log(`Extracted ${elements.length} text elements`);
    return elements;
}
