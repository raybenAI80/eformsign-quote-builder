import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import download from 'downloadjs';

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
        toast.loading('PDF 생성 중...', { id: 'pdf-export' });

        // 1. Capture content
        // Log element dimensions first
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
            // Handle off-screen elements
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            // Ensure element is visible in cloned document
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

        // Use JPEG quality 0.95
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = 280;
        const pageHeight = 400;
        const pxToMm = imgWidth / canvas.width;
        const imgHeight = canvas.height * pxToMm;

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

        // 2. Add image
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        // 3. Link Overlay - Only target explicitly marked links
        const links = element.querySelectorAll('a.pdf-target-link');

        // Use the same element that html2canvas captures for coordinate calculation
        const containerRect = element.getBoundingClientRect();

        // IMPORTANT: Use actual element width for coordinate calculation, not canvas width
        // canvas.width is scaled (scale: 2), but getBoundingClientRect() returns original dimensions
        const actualPxToMm = imgWidth / containerRect.width;

        links.forEach((link) => {
            const href = link.getAttribute('href');
            if (!href) return;

            const rect = link.getBoundingClientRect();
            const x = (rect.left - containerRect.left) * actualPxToMm;
            // Add Y offset to adjust for coordinate mismatch
            const yOffset = 3; // mm
            const y = (rect.top - containerRect.top) * actualPxToMm + yOffset;
            const w = rect.width * actualPxToMm;
            const h = rect.height * actualPxToMm;

            if (y < pageHeight) {
                pdf.setPage(1);
                pdf.link(x, y, w, h, { url: href });
            }
        });

        // 4. Save Logic
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
                toast.success('PDF가 저장되었습니다.', { id: 'pdf-export' });
                return;
            } catch (err: any) {
                // If user cancels, stop. If error, fall back.
                if (err.name === 'AbortError') {
                    toast.dismiss('pdf-export');
                    return;
                }
                console.warn('File System Access API failed, falling back:', err);
            }
        }

        // Strategy 2: Fallback to downloadjs
        download(blob, safeFileName, 'application/pdf');
        toast.success('PDF가 다운로드 폴더에 저장되었습니다.', { id: 'pdf-export' });

    } catch (error) {
        console.error('Error exporting to PDF:', error);
        toast.error('PDF 저장 중 오류가 발생했습니다.', { id: 'pdf-export' });
    }
};
