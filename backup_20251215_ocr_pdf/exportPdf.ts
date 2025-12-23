import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import download from 'downloadjs';
import { loadNanumSquareFonts, registerNanumSquareFont } from './fontLoader';
import { extractTextElements } from './textExtractor';

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
        toast.loading('PDF 생성 중... (폰트 로딩)', { id: 'pdf-export' });

        // 0. Load Korean font first
        await loadNanumSquareFonts();

        toast.loading('PDF 생성 중... (이미지 캡처)', { id: 'pdf-export' });

        // 1. Capture content
        const elementRect = element.getBoundingClientRect();
        console.log('Element dimensions:', elementRect.width, 'x', elementRect.height);
        console.log('Element position:', elementRect.left, elementRect.top);

        if (elementRect.width === 0 || elementRect.height === 0) {
            throw new Error('요소가 화면에 표시되지 않습니다. (width 또는 height가 0)');
        }

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: true,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc, clonedElement) => {
                clonedElement.style.display = 'block';
                clonedElement.style.visibility = 'visible';
                clonedElement.style.opacity = '1';
            }
        });

        // Validate canvas
        console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
        if (!canvas.width || !canvas.height || canvas.width === 0 || canvas.height === 0) {
            throw new Error('html2canvas가 빈 캔버스를 반환했습니다.');
        }

        toast.loading('PDF 생성 중... (PDF 변환)', { id: 'pdf-export' });

        // Use JPEG quality 0.95
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = 280;
        const pxToMm = imgWidth / canvas.width;
        const imgHeight = canvas.height * pxToMm;
        // Use actual content height instead of fixed 400mm to eliminate bottom white space
        const pageHeight = imgHeight;

        console.log('PDF dimensions:', { imgWidth, pageHeight, pxToMm, imgHeight });

        // Validate calculations
        if (!isFinite(pxToMm) || !isFinite(imgHeight)) {
            throw new Error('PDF 크기 계산 오류: NaN 또는 Infinity');
        }

        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: [imgWidth, pageHeight],
            compress: true
        });

        // Register Korean font
        registerNanumSquareFont(pdf);

        // 2. Add image (background layer)
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        // 3. Link Overlay
        const links = element.querySelectorAll('a.pdf-target-link');
        const containerRect = element.getBoundingClientRect();
        const actualPxToMm = imgWidth / containerRect.width;
        const yOffset = 3; // mm

        links.forEach((link) => {
            const href = link.getAttribute('href');
            if (!href) return;

            const rect = link.getBoundingClientRect();
            const x = (rect.left - containerRect.left) * actualPxToMm;
            const y = (rect.top - containerRect.top) * actualPxToMm + yOffset;
            const w = rect.width * actualPxToMm;
            const h = rect.height * actualPxToMm;

            if (y < pageHeight) {
                pdf.setPage(1);
                pdf.link(x, y, w, h, { url: href });
            }
        });

        // 4. OCR Text Layer - Invisible text overlay for search/copy
        toast.loading('PDF 생성 중... (텍스트 레이어)', { id: 'pdf-export' });

        try {
            // Text layer needs different offset than links
            // Positive offset to move text DOWN to match image position
            const textYOffset = 3; // mm - base offset, additional baseline offset added per element

            const textElements = extractTextElements(
                element,
                containerRect,
                actualPxToMm,
                textYOffset
            );

            console.log(`Extracted ${textElements.length} text elements for OCR layer`);

            // DEBUG MODE - Set to true to see text placement visually
            const DEBUG_OCR = false;

            // Set to first page
            pdf.setPage(1);

            // Set font to NanumSquare
            pdf.setFont('NanumSquare', 'normal');

            if (DEBUG_OCR) {
                // Debug mode: Draw visible red text to see exact placement
                pdf.setTextColor(255, 0, 0); // Red color
            } else {
                // Production mode: Use transparent text
                pdf.setTextColor(255, 255, 255);
                try {
                    const gState = new (pdf as any).GState({ opacity: 0.01 });
                    pdf.setGState(gState);
                } catch (e) {
                    console.log('GState not available, using white text color');
                }
            }

            for (const textEl of textElements) {
                // Skip if position is beyond page
                if (textEl.y > pageHeight || textEl.y < 0) continue;
                if (textEl.x < 0 || textEl.x > imgWidth) continue;

                // Set font size and weight
                pdf.setFontSize(textEl.fontSize);
                if (textEl.isBold) {
                    pdf.setFont('NanumSquare', 'bold');
                } else {
                    pdf.setFont('NanumSquare', 'normal');
                }

                // Add text at position
                // jsPDF uses baseline positioning, so add ascent offset
                // Ascent ≈ fontSize * 0.35 (pt to mm) * 0.85 (ascent ratio)
                const baselineOffset = textEl.fontSize * 0.35 * 0.85;
                pdf.text(textEl.text, textEl.x, textEl.y + baselineOffset);
            }

            // Reset GState
            try {
                const normalState = new (pdf as any).GState({ opacity: 1 });
                pdf.setGState(normalState);
            } catch (e) {
                // Ignore
            }

            console.log('OCR text layer added successfully');
        } catch (textError) {
            console.warn('Failed to add OCR text layer:', textError);
            // Continue without OCR layer - PDF will still work, just not searchable
        }

        // 5. Save Logic
        const safeFileName = fileName.replace(/[()\/\\:*?"<>|]/g, '_').trim() + '.pdf';
        const blob = pdf.output('blob');

        // Strategy 1: Modern File System Access API (Works on Chrome/Edge)
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: safeFileName,
                    types: [{
                        description: 'PDF Document',
                        accept: { 'application/pdf': ['.pdf'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                toast.success('PDF가 저장되었습니다. (검색 가능)', { id: 'pdf-export' });
                return;
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    toast.dismiss('pdf-export');
                    return;
                }
                console.warn('File System Access API failed, falling back:', err);
            }
        }

        // Strategy 2: Fallback to downloadjs
        download(blob, safeFileName, 'application/pdf');
        toast.success('PDF가 다운로드 폴더에 저장되었습니다. (검색 가능)', { id: 'pdf-export' });

    } catch (error) {
        console.error('Error exporting to PDF:', error);
        toast.error('PDF 저장 중 오류가 발생했습니다.', { id: 'pdf-export' });
    }
};
