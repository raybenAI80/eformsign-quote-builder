import { pdf } from '@react-pdf/renderer';
import { QuotePDFDocument } from '../components/QuotePDFDocument';
import { QuoteMeta, CalculationResult } from '../types';
import { toast } from 'sonner';
import React from 'react';
import { saveAs } from 'file-saver';

export const downloadQuotePdf = async (
    meta: QuoteMeta,
    calculation: CalculationResult,
    filename: string
): Promise<void> => {
    try {
        toast.loading('PDF 생성 중...', { id: 'pdf-loading' });

        // Get base URL for images
        const baseUrl = window.location.origin;

        // Generate PDF blob using @react-pdf/renderer
        const pdfBlob = await pdf(
            React.createElement(QuotePDFDocument, { meta, calculation, baseUrl })
        ).toBlob();

        // Ensure correct MIME type
        const blob = new Blob([pdfBlob], { type: 'application/pdf' });

        // Save the file using file-saver
        saveAs(blob, `${filename}.pdf`);

        toast.success('PDF가 저장되었습니다.', { id: 'pdf-loading' });
    } catch (error) {
        console.error('Error generating PDF:', error);
        toast.error('PDF 생성 중 오류가 발생했습니다.', { id: 'pdf-loading' });
    }
};
