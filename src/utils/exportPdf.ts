import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import download from 'downloadjs';
import { loadNanumSquareFonts, registerNanumSquareFont } from './fontLoader';
import { extractTextElements, TextElement, MM_PER_PT } from './textExtractor';
import { QuoteMeta, QuoteItem } from '../types';

export const exportToImage = async (elementId: string, fileName: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id ${elementId} not found`);
        return;
    }

    try {
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
        });

        canvas.toBlob((blob) => {
            if (blob) {
                download(blob, `${fileName}.png`, 'image/png');
            }
        });
    } catch (error) {
        console.error('Error exporting to image:', error);
        toast.error('이미지 저장 중 오류가 발생했습니다.');
    }
};

export const exportToPdf = async (elementId: string, fileName: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id ${elementId} not found`);
        return;
    }

    try {
        // IMPORTANT: Request save location FIRST, before any heavy processing
        // This must happen within 5 seconds of user click (User Activation window)
        const safeFileName = fileName.replace(/[()\/\\:*?"<>|]/g, '_').trim() + '.pdf';
        let fileHandle: FileSystemFileHandle | null = null;

        if (window.showSaveFilePicker) {
            try {
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: safeFileName,
                    types: [{
                        description: 'PDF Document',
                        accept: { 'application/pdf': ['.pdf'] },
                    }],
                });
            } catch (err: unknown) {
                if (err instanceof Error && err.name === 'AbortError') {
                    // User cancelled the save dialog
                    return;
                }
                console.warn('File System Access API failed, will use fallback:', err);
            }
        }

        toast.loading('PDF 생성 중... (폰트 로딩)', { id: 'pdf-export' });

        // 0. Load Korean font first
        await loadNanumSquareFonts();

        toast.loading('PDF 생성 중... (이미지 캡처)', { id: 'pdf-export' });

        // Reset CSS scale on ancestor element for accurate capture
        // Find the ancestor with scale transform
        let scaleWrapper: HTMLElement | null = element.parentElement;
        let originalTransform = '';
        while (scaleWrapper) {
            if (scaleWrapper.style.transform && scaleWrapper.style.transform.includes('scale')) {
                originalTransform = scaleWrapper.style.transform;
                scaleWrapper.style.transform = 'scale(1)';
                // Force reflow to apply the style change
                void scaleWrapper.offsetHeight;
                break;
            }
            scaleWrapper = scaleWrapper.parentElement;
        }

        // 1. Get original element dimensions using offsetWidth/Height
        // These are NOT affected by CSS transforms, unlike getBoundingClientRect
        const elementWidth = element.offsetWidth;
        const elementHeight = element.offsetHeight;
        console.log('Element dimensions (offset):', elementWidth, 'x', elementHeight);

        if (elementWidth === 0 || elementHeight === 0) {
            throw new Error('요소가 화면에 표시되지 않습니다. (width 또는 height가 0)');
        }

        // Pre-calculate PDF dimensions before html2canvas
        // This allows us to pass the correct pxToMm to extractTextElements
        const a4Width = 210;
        const a4Height = 297;
        const marginX = 2; // Reduced from 5mm to prevent grid collapse
        const marginY = 2; // Reduced from 5mm
        const availableWidth = a4Width - (marginX * 2);
        const availableHeight = a4Height - (marginY * 2);

        const originalAspect = elementWidth / elementHeight;
        const targetAspect = availableWidth / availableHeight;

        let preImgWidth: number;
        let preImgHeight: number;
        let preOffsetX = marginX;
        let preOffsetY = marginY;

        if (originalAspect > targetAspect) {
            preImgWidth = availableWidth;
            preImgHeight = preImgWidth / originalAspect;
            // Top alignment instead of center - removes extra top/bottom margins
            preOffsetY = marginY;
        } else {
            preImgHeight = availableHeight;
            preImgWidth = preImgHeight * originalAspect;
            preOffsetX = marginX + (availableWidth - preImgWidth) / 2;
        }

        // pxToMm for text extraction (based on original element dimensions)
        const prePxToMm = preImgWidth / elementWidth;

        console.log('Pre-calculated PDF dimensions:', {
            preImgWidth, preImgHeight, preOffsetX, preOffsetY, prePxToMm
        });

        // Create a rect-like object for extractTextElements
        const elementBounds = element.getBoundingClientRect();
        const textElements: TextElement[] = extractTextElements(
            element,
            elementBounds,
            prePxToMm,
            0
        );
        console.log(`Extracted ${textElements.length} text elements from ORIGINAL DOM`);

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
        });

        // Validate canvas
        console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
        if (!canvas.width || !canvas.height) {
            throw new Error('html2canvas가 빈 캔버스를 반환했습니다.');
        }

        // Restore original CSS scale after capture
        if (scaleWrapper && originalTransform) {
            scaleWrapper.style.transform = originalTransform;
        }

        toast.loading('PDF 생성 중... (PDF 변환)', { id: 'pdf-export' });

        // Use JPEG quality 0.95
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        // Use pre-calculated dimensions (already computed before html2canvas)
        // The values are identical since element dimensions don't change
        const imgWidth = preImgWidth;
        const imgHeight = preImgHeight;
        const offsetX = preOffsetX;
        const offsetY = preOffsetY;

        // pxToMm for image placement (uses scaled canvas dimensions)
        const pxToMm = imgWidth / canvas.width;

        console.log('PDF dimensions:', {
            a4Width, a4Height, imgWidth, imgHeight, pxToMm, offsetX, offsetY,
            canvasWidth: canvas.width,
            elementWidth: elementWidth
        });

        if (!isFinite(pxToMm) || !isFinite(imgHeight)) {
            throw new Error('PDF 크기 계산 오류');
        }

        const pdf = new jsPDF({
            orientation: 'p',  // Portrait 세로
            unit: 'mm',
            format: 'a4',      // Standard A4 (210x297mm in portrait)
            compress: true
        });

        // Register Korean font
        registerNanumSquareFont(pdf);

        // 2. Add image (centered on A4 portrait page)
        pdf.addImage(imgData, 'JPEG', offsetX, offsetY, imgWidth, imgHeight);

        console.log('Generated single page A4 Portrait PDF');

        // 3. Link Overlay
        const links = element.querySelectorAll('a.pdf-target-link');
        const containerRect = element.getBoundingClientRect();
        const actualPxToMm = imgWidth / containerRect.width;

        links.forEach((link) => {
            const href = link.getAttribute('href');
            if (!href) return;

            const rect = link.getBoundingClientRect();
            // Calculate position and add offset
            const x = (rect.left - containerRect.left) * actualPxToMm + offsetX;
            const y = (rect.top - containerRect.top) * actualPxToMm + offsetY;
            const w = rect.width * actualPxToMm;
            const h = rect.height * actualPxToMm;

            if (y < a4Height && y > 0) {
                pdf.setPage(1);
                pdf.link(x, y, w, h, { url: href });
            }
        });

        // 4. OCR Text Layer - Using positions extracted from ORIGINAL DOM
        // ★ FIX: Now using original element coordinates which match pxToMm calculation
        toast.loading('PDF 생성 중... (텍스트 레이어)', { id: 'pdf-export' });

        try {
            if (textElements.length === 0) {
                console.warn('No text elements extracted');
            }

            // DEBUG MODE - Set to true to see text placement (red text visible)
            const DEBUG_OCR = false;

            pdf.setPage(1);
            pdf.setFont('NanumSquare', 'normal');

            if (DEBUG_OCR) {
                pdf.setTextColor(255, 0, 0); // Red for debugging
            } else {
                pdf.setTextColor(255, 255, 255);
                try {
                    // @ts-expect-error - jsPDF GState is not in type definitions
                    const gState = new pdf.GState({ opacity: 0.01 });
                    pdf.setGState(gState);
                } catch {
                    // GState not supported in this version
                }
            }

            for (const textEl of textElements) {
                const finalX = textEl.x + offsetX;
                // textEl.y는 line box 상단이고 jsPDF는 baseline 기준으로 그린다.
                // line-height가 큰 요소는 글리프가 line box 안에서 수직 중앙에 놓이므로,
                // (line box 높이 - 글리프 박스 높이)/2 만큼 내려간 지점을 글리프 상단으로 보고
                // 거기서 다시 baseline까지(글리프 높이의 80%) 내린다.
                const fontHeightMm = textEl.fontSize * MM_PER_PT;
                const lineBoxMm = textEl.lineHeight > 0 ? textEl.lineHeight : fontHeightMm;
                const glyphTopMm = Math.max(0, (lineBoxMm - fontHeightMm) / 2);
                const finalY = textEl.y + offsetY + glyphTopMm + fontHeightMm * 0.80;

                if (finalY > a4Height || finalY < 0) continue;
                if (finalX < 0 || finalX > a4Width) continue;

                pdf.setFontSize(textEl.fontSize);
                pdf.setFont('NanumSquare', textEl.isBold ? 'bold' : 'normal');

                pdf.text(textEl.text, finalX, finalY);
            }

            // Reset GState
            if (!DEBUG_OCR) {
                try {
                    // @ts-expect-error - jsPDF GState is not in type definitions
                    const normalState = new pdf.GState({ opacity: 1 });
                    pdf.setGState(normalState);
                } catch {
                    // GState not supported in this version
                }
            }

            console.log('OCR text layer added successfully');
        } catch (textError) {
            console.warn('Failed to add OCR text layer:', textError);
        }

        // 5. Save PDF using the fileHandle obtained earlier (or fallback to download)
        const blob = pdf.output('blob');

        if (fileHandle) {
            // Use the file handle obtained at the start (within User Activation window)
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            toast.success('PDF가 저장되었습니다. (검색 가능)', { id: 'pdf-export' });
        } else {
            // Fallback: direct download
            download(blob, safeFileName, 'application/pdf');
            toast.success('PDF가 다운로드 폴더에 저장되었습니다. (검색 가능)', { id: 'pdf-export' });
        }

    } catch (error) {
        console.error('Error exporting to PDF:', error);
        toast.error('PDF 저장 중 오류가 발생했습니다.', { id: 'pdf-export' });
    }
};

/**
 * Capture one page from the hidden merge panel into the jsPDF document.
 */
async function capturePageIntoPdf(
    pdf: jsPDF,
    element: HTMLElement,
    isFirstPage: boolean
): Promise<void> {
    // Reset scale transform for accurate capture
    let scaleWrapper: HTMLElement | null = element.parentElement;
    let originalTransform = '';
    while (scaleWrapper) {
        if (scaleWrapper.style.transform && scaleWrapper.style.transform.includes('scale')) {
            originalTransform = scaleWrapper.style.transform;
            scaleWrapper.style.transform = 'scale(1)';
            void scaleWrapper.offsetHeight;
            break;
        }
        scaleWrapper = scaleWrapper.parentElement;
    }

    const elementWidth = element.offsetWidth;
    const elementHeight = element.offsetHeight;

    const a4Width = 210;
    const a4Height = 297;
    const marginX = 2;
    const marginY = 2;
    const availableWidth = a4Width - marginX * 2;
    const availableHeight = a4Height - marginY * 2;
    const originalAspect = elementWidth / elementHeight;
    const targetAspect = availableWidth / availableHeight;

    let imgWidth: number, imgHeight: number, offsetX: number, offsetY: number;
    if (originalAspect > targetAspect) {
        imgWidth = availableWidth;
        imgHeight = imgWidth / originalAspect;
        offsetX = marginX;
        offsetY = marginY;
    } else {
        imgHeight = availableHeight;
        imgWidth = imgHeight * originalAspect;
        offsetX = marginX + (availableWidth - imgWidth) / 2;
        offsetY = marginY;
    }

    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
    });

    if (scaleWrapper && originalTransform) {
        scaleWrapper.style.transform = originalTransform;
    }

    if (!canvas.width || !canvas.height) {
        throw new Error('html2canvas가 빈 캔버스를 반환했습니다.');
    }

    if (!isFirstPage) {
        pdf.addPage();
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', offsetX, offsetY, imgWidth, imgHeight);
}

/**
 * Render multiple quotes into a single multi-page PDF.
 *
 * @param quotes        Array of quote data to merge (each becomes one A4 page)
 * @param fileName      Output filename (without .pdf)
 * @param setRenderData Setter that swaps the hidden merge panel's data; pass null to clean up
 * @param elementId     DOM id of the hidden render panel (default: 'pdf-merge-panel')
 */
export const exportMergedPdf = async (
    quotes: Array<{ name: string; meta: QuoteMeta; items: QuoteItem[] }>,
    fileName: string,
    setRenderData: (data: { meta: QuoteMeta; items: QuoteItem[] } | null) => void,
    elementId: string = 'pdf-merge-panel'
): Promise<boolean> => {
    if (quotes.length === 0) {
        toast.error('병합할 견적서를 선택해주세요.');
        return false;
    }

    const safeFileName = fileName.replace(/[()\/\\:*?"<>|]/g, '_').trim() + '.pdf';
    let fileHandle: FileSystemFileHandle | null = null;

    // Request save location first (User Activation window)
    if (window.showSaveFilePicker) {
        try {
            fileHandle = await window.showSaveFilePicker({
                suggestedName: safeFileName,
                types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }],
            });
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return false;
            console.warn('File System Access API failed, will use fallback:', err);
        }
    }

    toast.loading(`병합 PDF 생성 중... (0/${quotes.length})`, { id: 'pdf-merge' });

    try {
        await loadNanumSquareFonts();

        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
        registerNanumSquareFont(pdf);

        for (let i = 0; i < quotes.length; i++) {
            toast.loading(`병합 PDF 생성 중... (${i + 1}/${quotes.length})`, { id: 'pdf-merge' });

            // Swap data in the hidden panel
            setRenderData({ meta: quotes[i].meta, items: quotes[i].items });

            // Wait for React to re-render (two animation frames = reliable render)
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            // Extra settle time for complex layouts
            await new Promise<void>(resolve => setTimeout(resolve, 150));

            const element = document.getElementById(elementId);
            if (!element) throw new Error(`병합 렌더링 패널(#${elementId})을 찾을 수 없습니다.`);

            await capturePageIntoPdf(pdf, element, i === 0);
        }

        const blob = pdf.output('blob');
        if (fileHandle) {
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            toast.success(`${quotes.length}개 견적서 병합 PDF 저장 완료!`, { id: 'pdf-merge' });
        } else {
            download(blob, safeFileName, 'application/pdf');
            toast.success(`${quotes.length}개 견적서 병합 PDF 다운로드 완료!`, { id: 'pdf-merge' });
        }
        return true;
    } catch (error) {
        console.error('Error exporting merged PDF:', error);
        toast.error('병합 PDF 저장 중 오류가 발생했습니다.', { id: 'pdf-merge' });
        return false;
    } finally {
        setRenderData(null);
    }
};
