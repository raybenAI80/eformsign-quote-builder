/**
 * DOM에서 텍스트 요소를 추출하여 PDF 좌표로 변환
 * 
 * 핵심: Range API로 문자별 Y 위치를 확인하여 CSS 래핑된 줄바꿈도 감지
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

interface LineInfo {
    text: string;
    x: number;  // px
    y: number;  // px
}

/**
 * 텍스트 노드에서 각 시각적 줄의 위치를 감지
 * Range API로 문자별 Y 위치를 확인하여 줄바꿈 지점 탐지
 */
function detectVisualLines(textNode: Text, fullText: string): LineInfo[] {
    const lines: LineInfo[] = [];
    const range = document.createRange();

    let currentLineY: number | null = null;
    let currentLineX: number | null = null;
    let lineStart = 0;

    // 성능을 위해 샘플링 (모든 문자 대신 일부만 체크)
    const sampleInterval = Math.max(1, Math.floor(fullText.length / 100));

    for (let i = 0; i < fullText.length; i += sampleInterval) {
        try {
            const endIdx = Math.min(i + 1, fullText.length);
            range.setStart(textNode, i);
            range.setEnd(textNode, endIdx);
            const rect = range.getBoundingClientRect();

            if (rect.width === 0 && rect.height === 0) continue;

            // Y 위치가 크게 변하면 새 줄로 인식 (5px 이상 차이)
            if (currentLineY === null || Math.abs(rect.top - currentLineY) > 5) {
                // 이전 줄 저장
                if (currentLineY !== null && lineStart < i) {
                    const lineText = fullText.slice(lineStart, i).trim();
                    if (lineText) {
                        lines.push({
                            text: lineText,
                            x: currentLineX!,
                            y: currentLineY,
                        });
                    }
                }

                // 새 줄 시작
                currentLineY = rect.top;
                currentLineX = rect.left;
                lineStart = i;
            }
        } catch (e) {
            // Range 설정 실패 시 무시
        }
    }

    // 마지막 줄 저장
    if (lineStart < fullText.length && currentLineY !== null) {
        const lineText = fullText.slice(lineStart).trim();
        if (lineText) {
            lines.push({
                text: lineText,
                x: currentLineX!,
                y: currentLineY,
            });
        }
    }

    // 줄 감지 실패 시 전체 텍스트를 첫 위치에 배치
    if (lines.length === 0) {
        range.selectNodeContents(textNode);
        const rects = range.getClientRects();
        if (rects.length > 0) {
            lines.push({
                text: fullText,
                x: rects[0].left,
                y: rects[0].top,
            });
        }
    }

    return lines;
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

        // Range.getClientRects()로 줄 개수 확인
        const range = document.createRange();
        range.selectNodeContents(textNode);
        const rects = range.getClientRects();

        if (rects.length <= 1) {
            // 단일 줄 - 첫 번째 rect 위치 사용
            const rect = rects[0] || parent.getBoundingClientRect();
            elements.push({
                text: fullText,
                x: (rect.left - containerRect.left) * pxToMm,
                y: (rect.top - containerRect.top) * pxToMm + yOffset,
                fontSize,
                isBold,
            });
        } else {
            // 여러 줄 - 각 줄에 해당하는 텍스트 분리
            const visualLines = detectVisualLines(textNode, fullText);

            for (const line of visualLines) {
                elements.push({
                    text: line.text,
                    x: (line.x - containerRect.left) * pxToMm,
                    y: (line.y - containerRect.top) * pxToMm + yOffset,
                    fontSize,
                    isBold,
                });
            }
        }
    }

    return elements;
}
