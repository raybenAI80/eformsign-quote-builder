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
    /** computed font-family 문자열 (PDF 텍스트 레이어가 화면과 같은 글꼴을 고르는 데 쓴다) */
    fontFamily: string;
    /** computed font-weight (400, 600, 800 …) */
    fontWeight: number;
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

/**
 * 텍스트 노드 경계의 공백을 텍스트 레이어 문자열에 되살린다.
 *
 * `{'사업자등록번호 '}<span>108-81-85184</span>` 처럼 공백이 앞쪽 텍스트 노드 끝에 있으면,
 * 노드마다 trim 해 내보내던 예전 방식은 그 공백을 버려 PDF 에서 「사업자등록번호 108-81-85184」(공백 포함)를 검색할 수 없었다.
 * 화면에서 실제로 그려진 공백(폭이 있는 공백)만 다룬다. 줄 끝에서 접힌 공백이나 들여쓰기용 공백은 폭이 0 이라 넣지 않는다.
 * 원문에 이미 있던 공백만 되살리므로 단어·숫자·한글 어절 안에는 공백이 생기지 않는다.
 */
export function withBoundarySpaces(
    text: string,
    opts: { leading: boolean; trailing: boolean; prevEndsWithSpace: boolean }
): string {
    let out = text;
    if (opts.leading && !opts.prevEndsWithSpace && !out.startsWith(' ')) out = ' ' + out;
    if (opts.trailing && !out.endsWith(' ')) out = out + ' ';
    return out;
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

/** 텍스트 노드의 문자 하나가 화면에서 차지하는 사각형 */
function charRect(textNode: Text, index: number): DOMRect {
    const range = document.createRange();
    range.setStart(textNode, index);
    range.setEnd(textNode, index + 1);
    return range.getBoundingClientRect();
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
                // 공백뿐인 노드(`<b>신한은행</b> <span>…</span>` 의 가운데 공백)도 받아서, 아래에서 앞 요소의 끝 공백으로 되살린다
                if (!node.textContent) return NodeFilter.FILTER_REJECT;

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
        if (!raw.trim()) {
            // 요소 사이에서 실제로 그려진 공백은 같은 줄의 앞 요소 끝 공백으로 남긴다(새 요소를 만들지 않는다)
            const spaceRange = document.createRange();
            spaceRange.selectNodeContents(textNode);
            const spaceRect = spaceRange.getBoundingClientRect();
            const last = elements[elements.length - 1];
            if (last && spaceRect.width > 0 && !last.text.endsWith(' ')) {
                const spaceY = (spaceRect.top - containerRect.top) * pxToMm + yOffset;
                if (Math.abs(last.y - spaceY) <= last.glyphBoxHeight / 2) last.text += ' ';
            }
            continue;
        }

        const fontSize = getFontSizePt(parent, pxToMm);
        const isBold = isBoldFont(parent);
        const computedStyle = window.getComputedStyle(parent);
        const fontFamily = computedStyle.fontFamily;
        const fontWeight = parseInt(computedStyle.fontWeight) || 400;
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

        // 노드 앞뒤 경계에 화면에서 그려진 공백이 있는지(폭이 있는 공백만)
        const leadingRect = /^\s/.test(raw) ? charRect(textNode, 0) : null;
        const trailingRect = /\s$/.test(raw) ? charRect(textNode, raw.length - 1) : null;
        const hasLeading = !!leadingRect && leadingRect.width > 0;
        const hasTrailing = !!trailingRect && trailingRect.width > 0;
        const prev = elements[elements.length - 1];

        for (let si = 0; si < segments.length; si++) {
            const seg = segments[si];
            if (seg.height <= 0) continue;

            // 중복 방지: 같은 텍스트가 같은 위치에 이미 있으면 스킵
            const uniqueKey = `${seg.text.substring(0, 30)}-${Math.round(seg.left)}-${Math.round(seg.top)}`;
            if (processedTexts.has(uniqueKey)) continue;
            processedTexts.add(uniqueKey);

            const leading = si === 0 && hasLeading;
            const trailing = si === segments.length - 1 && hasTrailing;
            // 앞 요소가 이미 공백으로 끝나면(앞 노드가 경계 공백을 가져갔으면) 다시 넣지 않는다
            const prevEndsWithSpace = !prev || prev.text.endsWith(' ');
            const text = withBoundarySpaces(seg.text, { leading, trailing, prevEndsWithSpace });
            // 앞 공백을 넣으면 줄의 시작 좌표도 그 공백의 왼쪽으로 옮겨 나머지 글자 위치가 그대로 유지되게 한다
            const x = leading && !prevEndsWithSpace && leadingRect ? leadingRect.left : seg.left;

            elements.push({
                text,
                x: (x - containerRect.left) * pxToMm,
                y: (seg.top - containerRect.top) * pxToMm + yOffset,
                fontSize,
                isBold,
                fontFamily,
                fontWeight,
                baselineMm,
                glyphBoxHeight: seg.height * pxToMm,
            });
        }
    }

    console.log(`Extracted ${elements.length} text elements`);
    return elements;
}
