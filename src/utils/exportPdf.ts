import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import download from 'downloadjs';
import { loadNanumSquareFonts, registerNanumSquareFont } from './fontLoader';
import { extractTextElements, TextElement } from './textExtractor';

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
                // Add baseline offset: getBoundingClientRect gives top of text box
                // jsPDF positions text at baseline. Increased to 80% to move text down more.
                const fontHeightMm = textEl.fontSize * 0.353; // pt to mm
                const baselineOffset = fontHeightMm * 0.80;
                const finalY = textEl.y + offsetY + baselineOffset;

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
