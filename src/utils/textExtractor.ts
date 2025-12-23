/**
 * DOM에서 텍스트 요소를 추출하여 PDF 좌표로 변환
 * 
 * 간소화된 접근법: 각 텍스트 노드의 부모 요소 바운딩 박스 사용
 */

export interface TextElement {
    text: string;
    x: number;        // PDF mm 단위
    y: number;        // PDF mm 단위
    fontSize: number; // pt
    isBold: boolean;
}

/**
 * 폰트 크기 추출 (px → pt 변환)
 */
function getFontSize(element: Element): number {
    const computed = window.getComputedStyle(element);
    const pxSize = parseFloat(computed.fontSize) || 12;
    return Math.round(pxSize * 0.75);
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
 * 라인 높이 추정
 */
function getLineHeight(element: Element): number {
    const computed = window.getComputedStyle(element);
    const lineHeight = parseFloat(computed.lineHeight);
    if (isNaN(lineHeight)) {
        return parseFloat(computed.fontSize) * 1.2;
    }
    return lineHeight;
}

/**
 * DOM 컨테이너에서 텍스트 요소들을 추출
 * 간소화된 방식: Range API로 각 줄의 첫 문자 위치만 사용
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

        const fullText = textNode.textContent?.trim();
        if (!fullText) continue;

        const fontSize = getFontSize(parent);
        const isBold = isBoldFont(parent);
        const lineHeightPx = getLineHeight(parent);

        // Range를 사용하여 텍스트 노드의 실제 위치 가져오기
        const range = document.createRange();
        range.selectNodeContents(textNode);
        const rects = range.getClientRects();

        if (rects.length === 0) continue;

        // 명시적 줄바꿈(\n)이 있는 경우 분리
        const lines = fullText.split('\n').filter(l => l.trim());

        if (lines.length > 1) {
            // 멀티라인: 각 줄마다 별도 요소로 추가
            let currentY = rects[0].top;
            const baseX = rects[0].left;
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                const uniqueKey = `${trimmedLine}-${Math.round(baseX)}-${Math.round(currentY)}`;
                if (processedTexts.has(uniqueKey)) continue;
                processedTexts.add(uniqueKey);

                const x = (baseX - containerRect.left) * pxToMm;
                const y = (currentY - containerRect.top) * pxToMm + yOffset;

                elements.push({
                    text: trimmedLine,
                    x,
                    y,
                    fontSize,
                    isBold,
                });

                currentY += lineHeightPx;
            }
        } else {
            // 단일 라인 또는 CSS 래핑된 텍스트
            // 각 clientRect가 별도의 줄일 수 있음
            for (let i = 0; i < rects.length; i++) {
                const rect = rects[i];
                if (rect.width === 0 || rect.height === 0) continue;

                // 중복 방지: 같은 X,Y 위치에 같은 텍스트가 이미 있으면 스킵
                const roundedY = Math.round(rect.top);
                const roundedX = Math.round(rect.left);

                // 첫 번째 rect만 사용하고 전체 텍스트 할당
                if (i === 0) {
                    // X좌표도 포함하여 같은 행의 다른 컬럼 텍스트도 추출
                    const uniqueKey = `${fullText.substring(0, 30)}-${roundedX}-${roundedY}`;
                    if (processedTexts.has(uniqueKey)) continue;
                    processedTexts.add(uniqueKey);

                    const x = (rect.left - containerRect.left) * pxToMm;
                    const y = (rect.top - containerRect.top) * pxToMm + yOffset;

                    elements.push({
                        text: fullText,
                        x,
                        y,
                        fontSize,
                        isBold,
                    });
                    break; // 첫 번째 rect만 사용
                }
            }
        }
    }

    console.log(`Extracted ${elements.length} text elements`);
    return elements;
}
